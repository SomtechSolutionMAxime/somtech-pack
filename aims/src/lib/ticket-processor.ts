/**
 * AIMS v5 -- Ticket Processor
 *
 * Extracted from orchestrator.ts: processTicket() and its direct helpers
 * (analysis, prompt building, parsing, Slack plan formatting).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { ServiceDeskClient } from "./servicedesk-client.js";
import type { SlackClient } from "./slack-client.js";
import type { ActiveThread } from "./slack-poller.js";
import { generateTraceId } from "./trace.js";
import {
  commentAnalysisComplete,
  commentBlocked,
  commentFailed,
  commentAnalyzing,
  commentPlanning,
} from "./dual-view.js";
import { recordSuccess, recordFailure } from "./hooks.js";
import { log as sharedLog } from "./helpers.js";
import type {
  OrchestratorConfig,
  ServiceDeskTicket,
  OrchestratorTrace,
  TokenUsageStats,
  AnalystOutput,
} from "./types.js";

// --- Logging ---

function log(action: string, detail: string, traceId?: string): void {
  sharedLog("dev-orchestrator", action, detail, traceId);
}

// --- Token usage helpers ---

export function emptyUsage(): TokenUsageStats {
  return { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, totalCostUSD: 0, numTurns: 0 };
}

export function extractUsage(message: any): TokenUsageStats {
  const usage = emptyUsage();
  usage.totalCostUSD = message.total_cost_usd ?? 0;
  usage.numTurns = message.num_turns ?? 0;
  if (message.modelUsage) {
    for (const m of Object.values(message.modelUsage) as any[]) {
      usage.inputTokens += m.inputTokens ?? 0;
      usage.outputTokens += m.outputTokens ?? 0;
      usage.cacheReadInputTokens += m.cacheReadInputTokens ?? 0;
      usage.cacheCreationInputTokens += m.cacheCreationInputTokens ?? 0;
    }
  }
  return usage;
}

// --- Prompt builders ---

/**
 * Build the analysis prompt for initial ticket classification.
 */
export function buildAnalysisPrompt(
  ticket: ServiceDeskTicket,
  orchestratorSkills: string,
  projectContext: string,
): string {
  return `Tu es l'orchestrator AIMS v4.1, expert en gestion de demandes et d'incidents.

## Ton role
- Gestion rigoureuse du cycle de vie des tickets (statuts, transitions, informations)
- Chaque ticket doit avoir un statut precis, une classification claire, un historique lisible
- L'architecte AIMS doit pouvoir suivre toutes les demandes en lisant les tickets
- Les commentaires doivent etre factuels, structures et utiles

## Regles de qualite
- Priorite : evaluer l'impact reel (pas juste ce que le client dit)
- Classification : utiliser les termes metier corrects de l'ontologie
- Risque : considerer l'architecture de securite (RLS, guards, Loi 25)
- Si le ticket touche des donnees sensibles ou des PII → risk_level = "high"
- Si le ticket touche le schema DB ou les policies RLS → verifier l'ontologie
${projectContext}

## Ticket
- **ID:** ${ticket.id}
- **Titre:** ${ticket.title}
- **Description:** ${ticket.description}
- **Priorite:** ${ticket.priority}

## Instructions

### Completude du ticket (OBLIGATOIRE — evaluer AVANT de classifier)

Applique les principes du skill requirement-intake : avant toute classification, evalue si le ticket est ACTIONNABLE par un developpeur.

Un ticket est actionnable si :
- Il precise QUOI modifier (quel composant, page, element, fonctionnalite)
- Il precise le RESULTAT ATTENDU (quelle couleur, quel texte, quel comportement)
- Un developpeur pourrait l'executer SANS deviner l'intention du client

Si le ticket est trop vague ou ambigu :
- "needs_clarification": true
- "clarification_question": question courte et precise (sera envoyee au client sur Slack)
- Les autres champs de classification restent a leur meilleure estimation

Exemples de tickets NON actionnables :
- "Change la couleur" → question: "Quelle couleur souhaitez-vous, et sur quel element (bouton, fond, titre, etc.) ?"
- "Ca marche pas" → question: "Pouvez-vous decrire le probleme ? Quelle page, quel comportement observe vs attendu ?"
- "Ajouter un bouton" → question: "Ou placer le bouton, quel texte/label, et quelle action au clic ?"

Exemples de tickets actionnables :
- "Changer la couleur du bouton principal en bleu (#0066CC) dans le header" → needs_clarification: false
- "Le formulaire de contact crash quand on soumet sans email — erreur TypeError" → needs_clarification: false

Analyse le ticket et retourne UNIQUEMENT un JSON (pas de texte autour) :

\`\`\`json
{
  "orchestrator_trace": {
    "analyzed_at": "${new Date().toISOString()}",
    "needs_clarification": false,
    "clarification_question": null,
    "classification": {
      "ticket_type": "feature|bugfix|refactor|migration|config|docs|report",
      "complexity": "simple|medium|complex",
      "risk_level": "low|medium|high"
    },
    "execution_mode": "sub-agent",
    "sub_agent_type": "sub-agent-dev|sub-agent-security|sub-agent-qa|sub-agent-devops",
    "reason": "Explication courte de pourquoi ce sub-agent",
    "files_likely_affected": ["chemin/fichier1.ts"],
    "estimated_duration_min": 15,
    "priority_assessed": "P1|P2|P3|P4",
    "security_concern": true,
    "human_summary": "Resume lisible en 1-2 phrases pour l'architecte AIMS"
  }
}
\`\`\`

### Echelle de priorite
- **P1** : Bloquant production, perte de donnees, faille securite active
- **P2** : Degradation significative, feature critique bloquee
- **P3** : Amelioration importante, bug non-bloquant
- **P4** : Cosmetique, documentation, optimisation mineure

### security_concern = true si :
- Le ticket touche des donnees personnelles (PII) ou sensibles
- Le ticket modifie des policies RLS, des guards ou l'authentification
- Le ticket touche le schema DB sur des tables avec RLS
- Le ticket implique des secrets, tokens ou cles API

### Classification "report"
Utilise \`ticket_type: "report"\` quand le ticket demande :
- Un rapport, un audit, une analyse, un inventaire
- Un livrable de communication (pas de modification de code)
- Un resultat a envoyer sur Slack ou par email (pas de PR)
Le chemin "report" envoie le resultat directement sur Slack sans branche Git ni PR.

Choisis le sub-agent :
- \`sub-agent-dev\` : implementation, feature, bugfix, refactor
- \`sub-agent-security\` : audit securite, RLS, vulnerabilites
- \`sub-agent-qa\` : validation build/tests/lint/types
- \`sub-agent-devops\` : deploiement, infra, migrations
${orchestratorSkills}`;
}

/**
 * Build the execution prompt for the sub-agent.
 */
export function buildExecutionPrompt(
  ticket: ServiceDeskTicket,
  trace: OrchestratorTrace,
  traceId: string,
): string {
  return `Tu executes une tache AIMS v4.1.

## Ticket
- **ID:** ${ticket.id}
- **Titre:** ${ticket.title}
- **Description:** ${ticket.description}
- **Priorite:** ${ticket.priority}
- **Trace ID:** ${traceId}

## Classification
- **Type :** ${trace.classification.ticket_type}
- **Complexite :** ${trace.classification.complexity}
- **Risque :** ${trace.classification.risk_level}
- **Fichiers cibles :** ${trace.files_likely_affected.join(", ") || "a determiner"}
- **Raison :** ${trace.reason}

## Instructions

Utilise le sub-agent \`${trace.sub_agent_type}\` pour executer cette tache.

Le sub-agent doit retourner un JSON avec son resultat.
Si tu as besoin d'une clarification humaine, retourne :
\`\`\`
[QUESTION]
Ta question ici
\`\`\`

## Suivi pour l'architecte AIMS
- Chaque action significative doit etre tracable dans le ticket
- Le resultat final doit etre comprehensible par un humain non-technique
- Respecter les termes metier de l'ontologie (Entreprise, pas Client)
- Verifier les regles de securite si le code touche des donnees utilisateur

## Pull Request (OBLIGATOIRE)
Apres avoir commite, tu DOIS :
1. Pousser la branche : \`git push origin aims/${ticket.id}\`
2. Creer une PR : \`gh pr create --base main --head aims/${ticket.id} --title "type(scope): description" --body "..."\`
3. Inclure le \`pr_url\` dans ton JSON de sortie

## INTERDIT
- Ne JAMAIS modifier le statut du ticket dans le ServiceDesk
- Ne JAMAIS utiliser le MCP servicedesk pour mettre a jour des tickets
- La gestion des statuts est le role EXCLUSIF de l'orchestrator

## Workspace
Le repo se trouve dans ${process.env.WORKSPACE || "/workspace"}.
Respecte les conventions du repo (ontologie, constitution, securite).
Branche de travail : \`aims/${ticket.id}\``;
}

// --- Parsing ---

/**
 * Parse the orchestrator_trace JSON from the analysis result.
 */
export function parseOrchestratorTrace(result: string): OrchestratorTrace | null {
  try {
    const jsonMatch = result.match(/\{[\s\S]*"orchestrator_trace"[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.orchestrator_trace || null;
  } catch {
    return null;
  }
}

// --- Analysis runner ---

/**
 * Run the analysis sub-agent on a ticket and return the parsed trace.
 */
export async function runAnalysis(
  ticket: ServiceDeskTicket,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  orchestratorSkills: string,
  projectContext: string,
  traceId: string,
): Promise<OrchestratorTrace> {
  let analysisResult = "";
  for await (const message of query({
    prompt: buildAnalysisPrompt(ticket, orchestratorSkills, projectContext),
    options: {
      allowedTools: ["Read", "Grep", "Glob"],
      permissionMode: "acceptEdits",
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        analysisResult = message.result;
      }
    }
  }

  const trace = parseOrchestratorTrace(analysisResult);
  if (!trace) {
    throw new Error(`Analyse echouee — impossible de parser l'orchestrator_trace.\nResultat brut: ${analysisResult.slice(0, 300)}`);
  }
  return trace;
}

// --- Slack formatting ---

/**
 * Format an AnalystOutput into a human-readable Slack message for the architect.
 */
export function formatPlanForSlack(analysis: AnalystOutput, ticketTitle: string): string {
  const lines: string[] = [
    `:brain: *Analyse terminee* — ${ticketTitle}`,
    "",
    `*Type:* ${analysis.classification} | *Complexite:* ${analysis.complexity} | *Risque:* ${analysis.execution_plan.estimated_risk}`,
  ];

  if (analysis.entities.length > 0) {
    lines.push(`*Entites:* ${analysis.entities.join(", ")}`);
  }

  if (analysis.security_concerns.length > 0) {
    lines.push(`*Securite:* ${analysis.security_concerns.join(", ")}`);
  }

  if (analysis.loi25_impact !== "none") {
    lines.push(`:shield: *Impact Loi 25:* ${analysis.loi25_impact}`);
  }

  if (analysis.execution_plan.steps.length > 0) {
    lines.push("");
    lines.push("*Plan d'execution:*");
    for (const [i, step] of analysis.execution_plan.steps.entries()) {
      lines.push(`${i + 1}. ${step}`);
    }
  }

  if (analysis.questions.length > 0) {
    lines.push("");
    lines.push(":question: *Questions:*");
    for (const q of analysis.questions) {
      lines.push(`> ${q}`);
    }
  }

  lines.push("");
  lines.push("_Tu valides ce plan ? (go/ok/valide pour lancer, ou pose des questions)_");

  return lines.join("\n");
}

// --- Slack helpers ---

/**
 * Send a Slack message, returning the thread_ts.
 */
async function sendSlack(
  slack: SlackClient | null,
  channel: string,
  text: string,
  opts?: { blocks?: any[]; threadTs?: string },
): Promise<string | undefined> {
  if (!slack) {
    log("slack.degraded", "No Slack client — message not sent");
    return undefined;
  }

  const result = opts?.threadTs
    ? await slack.postThreadReply(channel, opts.threadTs, text, opts?.blocks)
    : await slack.postMessage(channel, text, opts?.blocks);
  return result.ok ? result.ts : undefined;
}

/**
 * Send a Slack message tied to a ticket, respecting existing thread.
 */
async function sendSlackThreaded(
  slack: SlackClient | null,
  channel: string,
  text: string,
  ticket: ServiceDeskTicket,
  client: ServiceDeskClient,
  traceId?: string,
): Promise<string | undefined> {
  const existingThreadTs = (ticket as any).slack_thread_ts
    ?? (ticket.metadata as any)?.slack_thread_ts;

  const threadTs = await sendSlack(
    slack, channel, text,
    existingThreadTs ? { threadTs: existingThreadTs } : undefined,
  );

  // Save thread_ts if this is a new top-level message
  if (threadTs && !existingThreadTs) {
    try {
      await client.updateSlackThreadTs(ticket.id, threadTs);
      (ticket as any).slack_thread_ts = threadTs;
    } catch (err) {
      if (traceId) {
        log("workflow.slack_thread", `Failed to save slack_thread_ts: ${err}`, traceId);
      }
    }
  }

  return threadTs;
}

// --- Processing context ---

export interface ProcessingContext {
  config: OrchestratorConfig;
  client: ServiceDeskClient;
  agents: Record<string, any>;
  orchestratorSkills: string;
  projectContext: string;
  slackChannel: string;
  slack: SlackClient | null;
  activeThreads: Map<string, ActiveThread>;
}

// --- Main processing function ---

/**
 * Process a ticket through the analysis and planning phases.
 * If Slack is available, posts the plan and waits for architect approval (PLANNING gate).
 * If no Slack or revision mode, delegates directly to executeApprovedTicket (caller's responsibility).
 *
 * @param revisionFeedback If present, skip analysis and inject QA feedback.
 * @param executeApprovedTicketFn Callback to execute after auto-approve (degraded/revision mode).
 */
export async function processTicket(
  ticket: ServiceDeskTicket,
  ctx: ProcessingContext,
  revisionFeedback?: string,
  executeApprovedTicketFn?: (
    ticket: ServiceDeskTicket,
    trace: OrchestratorTrace,
    traceId: string,
    revisionFeedback?: string,
  ) => Promise<void>,
): Promise<void> {
  const { config, client, orchestratorSkills, projectContext, slackChannel, slack, activeThreads } = ctx;
  const traceId = generateTraceId();
  let sessionId: string | undefined;

  // Token usage accumulators
  let analysisUsage = emptyUsage();

  const isRevision = !!revisionFeedback;
  log("workflow.claim", `Ticket ${ticket.id}: ${ticket.title}${isRevision ? " (REVISION)" : ""}`, traceId);

  // ================================================================
  // STEP 1: ANALYZING
  // ================================================================

  await client.updateRunStatus(ticket.id, "ANALYZING", traceId, config.agent_id);
  await client.postComment(
    ticket.id,
    commentAnalyzing(traceId, isRevision ? `[REVISION] ${ticket.title}` : ticket.title),
  );

  try {
    // ================================================================
    // STEP 2: ANALYSE -- Classification (SKIP if revision)
    // ================================================================

    let trace: OrchestratorTrace;

    if (isRevision) {
      const existingTrace = (ticket as any).orchestrator_trace ?? (ticket.metadata as any)?.orchestrator_trace;
      if (existingTrace) {
        trace = existingTrace;
        log("workflow.analyze", "SKIP analyse (revision) — reutilisation orchestrator_trace existant", traceId);
      } else {
        log("workflow.analyze", "Revision sans trace existant — re-analyse", traceId);
        trace = await runAnalysis(ticket, config, client, orchestratorSkills, projectContext, traceId);
        analysisUsage = emptyUsage();
      }
    } else {
      log("workflow.analyze", "Analyse du ticket en cours", traceId);
      trace = await runAnalysis(ticket, config, client, orchestratorSkills, projectContext, traceId);
    }

    // Post analysis comment
    if (!isRevision) {
      await client.postComment(
        ticket.id,
        commentAnalysisComplete(traceId, config.agent_id, trace),
      );
    }

    log("workflow.analyzed", `Classification: ${trace.classification.ticket_type}/${trace.classification.complexity}, sub-agent: ${trace.sub_agent_type}`, traceId);

    // Sync assessed priority
    if (trace.priority_assessed) {
      const priorityMap: Record<string, string> = {
        P1: "critical",
        P2: "high",
        P3: "medium",
        P4: "low",
      };
      const mappedPriority = priorityMap[trace.priority_assessed];
      if (mappedPriority) {
        try {
          await client.updateTicket(ticket.id, { priority: mappedPriority });
          log("workflow.priority_sync", `Priorite mise a jour: ${trace.priority_assessed} → ${mappedPriority}`, traceId);
        } catch (error) {
          log("workflow.priority_sync", `Echec mise a jour priorite: ${error}`, traceId);
        }
      }
    }

    // ================================================================
    // STEP 2c: COMPLETENESS CHECK
    // ================================================================

    if (trace.needs_clarification && trace.clarification_question) {
      const question = trace.clarification_question;

      await client.updateRunStatus(ticket.id, "BLOCKED", traceId, config.agent_id, {
        blocked_question: question,
        blocked_at: new Date().toISOString(),
      });
      await client.postComment(
        ticket.id,
        commentBlocked(traceId, config.agent_id, question, sessionId),
      );

      if (slack) {
        const questionText = `${"@here"} J'ai une question avant de continuer :\n\n> ${question}\n\n_Repondez dans ce thread._`;
        await sendSlackThreaded(slack, slackChannel, questionText, ticket, client, traceId);
      }

      log("workflow.incomplete", `Clarification requise: ${question.slice(0, 200)}`, traceId);
      return;
    }

    // ================================================================
    // STEP 2d: PLANNING GATE
    // ================================================================

    if (slack && !isRevision) {
      await client.updateRunStatus(ticket.id, "PLANNING", traceId, config.agent_id, {
        orchestrator_trace: trace,
        session_id: sessionId,
      });

      await client.postComment(
        ticket.id,
        commentPlanning(traceId, {
          classification: `${trace.classification.ticket_type}/${trace.classification.complexity}`,
          complexity: trace.classification.complexity,
          entities: trace.files_likely_affected,
          security_concerns: trace.security_concern ? ["Donnees sensibles ou RLS identifiees"] : [],
          loi25_impact: "none",
          execution_plan: {
            steps: [trace.reason],
            subagents_needed: trace.sub_agent_type ? [trace.sub_agent_type] : [],
            estimated_risk: trace.classification.risk_level,
          },
        }),
      );

      // Post plan in Slack thread
      const planText = [
        `:clipboard: *Plan d'execution — ${ticket.ticket_id}*`,
        `*${ticket.title}*`,
        ``,
        `*Type:* ${trace.classification.ticket_type} | *Complexite:* ${trace.classification.complexity} | *Risque:* ${trace.classification.risk_level}`,
        trace.sub_agent_type ? `*Sub-agent:* \`${trace.sub_agent_type}\`` : "",
        trace.human_summary ? `\n${trace.human_summary}` : "",
        ``,
        `*Fichiers probables:*`,
        ...trace.files_likely_affected.slice(0, 10).map((f: string) => `  • \`${f}\``),
        ``,
        `_Trace: \`${traceId}\`_`,
        ``,
        `:arrow_right: *Dis "go" ou "ok" pour lancer, ou pose des questions.*`,
      ].filter(Boolean).join("\n");

      const threadTs = await sendSlackThreaded(slack, slackChannel, planText, ticket, client, traceId);

      // Register active thread for Slack polling
      if (threadTs || (ticket as any).slack_thread_ts) {
        const ts = threadTs || (ticket as any).slack_thread_ts;
        activeThreads.set(ticket.id, {
          ticketId: ticket.id,
          channel: slackChannel || "",
          threadTs: ts,
          lastProcessedTs: ts,
          runStatus: "PLANNING",
        });
        log("workflow.planning", `Thread Slack enregistre pour ${ticket.id} — en attente approbation architecte`, traceId);
      }

      recordSuccess();
      return; // STOP -- architect must approve before execution
    }

    // Degraded mode (no Slack) or revision: auto-approve
    await client.updateRunStatus(ticket.id, "RUNNING", traceId, config.agent_id, {
      orchestrator_trace: trace,
      session_id: sessionId,
    });
    log("workflow.auto_approved", isRevision ? "Revision — skip PLANNING" : "Pas de Slack — auto-approve", traceId);

    // Delegate to executeApprovedTicket
    if (executeApprovedTicketFn) {
      await executeApprovedTicketFn(ticket, trace, traceId, revisionFeedback);
    }
    return;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log("workflow.error", `Analysis phase failed: ${errorMsg}`, traceId);

    await client.updateRunStatus(ticket.id, "FAILED", traceId, config.agent_id);
    await client.postComment(
      ticket.id,
      commentFailed(traceId, config.agent_id, errorMsg, 0, config.max_retries, undefined),
    );
    recordFailure();
  }
}
