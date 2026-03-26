// AIMS-TEMPLATE-GENERATED — do not remove this line (used for idempotence detection)
/**
 * AIMS v5 — Orchestrator Principal
 *
 * PRINCIPE FONDAMENTAL : Slack = canal humain conversationnel.
 * On envoie sur Slack ce qui est pertinent pour l'humain maintenant.
 * Le journal technique complet reste dans les commentaires ServiceDesk.
 *
 * v5 — Changements par rapport a v4.1 :
 *   - 1 container unique, 5 subagents ephemeres via Agent SDK query()
 *   - Slack direct (propre bot token, polling API) — core-comm supprime
 *   - Nouveaux etats : ANALYZING, PLANNING, APPROVED
 *   - Sub-agent-analyst pour l'analyse initiale
 *   - Conversation bidirectionnelle architecte dans les threads Slack
 *   - Graceful shutdown (SIGTERM) avec drain et re-queue
 *   - Suppression containers clientele + security
 *
 * Flux v5 (human-in-the-loop) :
 *   QUEUED -> ANALYZING (sub-agent-analyst lit ontologie/constitution/securite)
 *          -> PLANNING (plan presente a l'architecte dans le thread Slack)
 *          -> APPROVED (architecte valide — "go"/"ok"/"valide")
 *          -> RUNNING (sub-agent-dev implemente)
 *          -> VALIDATING (sub-agent-qa Proof of Work)
 *          -> LANDING (PR prete, human-gate)
 *          -> DONE
 *
 *   BLOCKED possible depuis PLANNING ou RUNNING (question a l'architecte)
 *   FAILED possible a tout moment
 *
 * Ref SDK : docs/CLAUDE_AGENT_SDK_REFERENCE.md
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { ServiceDeskClient } from "./lib/servicedesk-client.js";
import { loadAgentDefinitions, loadOrchestratorSkills } from "./lib/agents.js";
import { generateTraceId } from "./lib/trace.js";
import {
  commentBlocked,
  commentDone,
  commentFailed,
  commentValidatingStarted,
  commentValidatingResult,
  commentLanding,
  commentProgress,
  commentReadyForQA,
  commentMigrationTransfer,
  commentTokenUsage,
} from "./lib/dual-view.js";
import {
  createAuditHook,
  createSubAgentStartHook,
  createSubAgentStopHook,
  createNotificationHook,
  createFileProtectionHook,
  createProgressHook,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
} from "./lib/hooks.js";
import { executeProofOfWork } from "./lib/proof-of-work.js";
import { executeLanding } from "./lib/landing.js";
import { pollBlockedTickets, checkAndSendRelances, quickPollSlackThreads } from "./lib/response-handler.js";
import { parseSubAgentResult, uploadFileToSlack, log as sharedLog, waitForDeployPreview, checkPRMergeable, attemptAutoRebase } from "./lib/helpers.js";
import type { DeployPreviewResult } from "./lib/helpers.js";
import { runPreflightChecks, formatPreflightReport } from "./lib/preflight.js";
import { createSlackClient } from "./lib/slack-client.js";
import type { SlackClient } from "./lib/slack-client.js";
import { pollSlackThreads, type ActiveThread, type NewArchitectMessage } from "./lib/slack-poller.js";
import { classifyIntent } from "./lib/intent-classifier.js";
import { setupGracefulShutdown } from "./lib/graceful-shutdown.js";
// commentAnalyzing, commentPlanning, commentApproved moved to lib/ticket-processor.ts and lib/state-machine.ts
import type {
  OrchestratorConfig,
  ServiceDeskTicket,
  OrchestratorTrace,
  ProofOfWorkResult,
  AnalystOutput,
} from "./lib/types.js";

// --- Extracted modules ---
import {
  markProcessed,
  isProcessed,
  unmarkProcessed,
  cleanupProcessedTickets,
  processedTicketsSize,
  processedTicketIds,
  transitionToApproved as smTransitionToApproved,
  transitionToFailed as smTransitionToFailed,
} from "./lib/state-machine.js";
import type { TransitionContext } from "./lib/state-machine.js";
import {
  processTicket as tpProcessTicket,
  buildExecutionPrompt,
  emptyUsage,
  extractUsage,
} from "./lib/ticket-processor.js";
import type { ProcessingContext } from "./lib/ticket-processor.js";

// --- Configuration ---

function loadConfig(): OrchestratorConfig {
  return {
    agent_id: (process.env.AGENT_ID || "dev-orchestrator") as any,
    application_id: process.env.AIMS_APPLICATION_ID || "",
    servicedesk_mcp_url: process.env.SERVICEDESK_MCP_URL || "",     // Ex: https://<ref>.supabase.co/functions/v1/servicedesk-mcp
    servicedesk_api_key: process.env.SERVICEDESK_API_KEY || "",      // MCP API Key (sk_live_...)
    // v5: Slack direct (remplace core_comm_url, notif_enabled, notif_channel, notif_mention)
    slack_bot_token: process.env.SLACK_BOT_TOKEN || "",
    slack_poll_interval_ms: parseInt(process.env.SLACK_POLL_INTERVAL || "15") * 1000,
    poll_interval_ms: parseInt(process.env.POLL_INTERVAL || "30") * 1000,
    max_concurrent_runs: parseInt(process.env.MAX_CONCURRENT_RUNS || "2"),
    max_retries: parseInt(process.env.MAX_RETRIES || "2"),
    workspace: process.env.WORKSPACE || "/workspace",
    anthropic_api_key: process.env.ANTHROPIC_API_KEY || "",
    github_token: process.env.GITHUB_TOKEN || "",
    github_owner: process.env.GITHUB_OWNER || "",
    github_repo: process.env.GITHUB_REPO || "",
  };
}

// --- Etat global ---

const mergedTickets = new Map<string, number>(); // ticketId -> timestamp (evite double-merge)
const PROCESSED_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures (used by mergedTickets cleanup)
let activeRuns = 0;

// --- v5 State ---
const activeThreads = new Map<string, ActiveThread>();
let botUserId: string | undefined;
let slackChannel: string | undefined;
let isPolling = true;
let lastChannelFetch = Date.now();
let lastSlackPoll: Date | undefined;
let lastServiceDeskPoll: Date | undefined;

// v5: References for post-approval execution (set during startOrchestrator)
let orchestratorContext: {
  config: OrchestratorConfig;
  client: ServiceDeskClient;
  agents: Record<string, any>;
  orchestratorSkills: string;
  projectContext: string;
  slackChannel: string;
  slackClient: SlackClient | null;
} | null = null;

// --- v5: Crash Recovery ---

/**
 * Recover active threads from ServiceDesk after a restart.
 * Reads tickets with non-terminal run_status and slack_thread_ts,
 * and populates the activeThreads map so Slack polling can resume.
 */
async function recoverActiveThreads(
  client: ServiceDeskClient,
  applicationId: string,
  channel: string,
): Promise<number> {
  try {
    const discovered = await client.siloDiscover(applicationId);
    // Also fetch in_progress tickets (PLANNING/APPROVED/RUNNING have status=in_progress)
    let inProgressTickets: ServiceDeskTicket[] = [];
    try {
      inProgressTickets = await client.listTickets(applicationId, { status: "in_progress", silo_assigned: true });
    } catch { /* best effort */ }
    const allTickets = [
      ...discovered.pending_analysis,
      ...discovered.pending_review,
      ...discovered.ready_for_dev,
      ...inProgressTickets,
    ];

    let recovered = 0;
    for (const ticket of allTickets) {
      const runStatus = (ticket as any).run_status ?? (ticket as any).metadata?.run_status;
      const threadTs = (ticket as any).slack_thread_ts ?? (ticket as any).metadata?.slack_thread_ts;

      // Only recover tickets that have an active Slack thread and non-terminal status
      if (threadTs && runStatus && !["DONE", "FAILED", "QUEUED"].includes(runStatus)) {
        activeThreads.set(ticket.id, {
          ticketId: ticket.id,
          channel,
          threadTs,
          lastProcessedTs: threadTs, // Start from thread creation (may re-process some messages)
          runStatus,
        });
        recovered++;
      }
    }

    return recovered;
  } catch (err) {
    log("recovery.error", `Failed to recover active threads: ${err}`);
    return 0;
  }
}

// --- v5: Health Endpoint ---

const startTime = Date.now();

/**
 * Build health check response object.
 * Used by the HTTP health endpoint (GET /health).
 */
function buildHealthResponse(): Record<string, unknown> {
  return {
    status: "healthy",
    version: "v5",
    uptime_s: Math.round((Date.now() - startTime) / 1000),
    active_runs: activeRuns,
    active_threads: activeThreads.size,
    processed_tickets: processedTicketsSize(),
    circuit_breaker: isCircuitOpen() ? "open" : "closed",
    last_servicedesk_poll: lastServiceDeskPoll?.toISOString() ?? null,
    last_slack_poll: lastSlackPoll?.toISOString() ?? null,
    bot_user_id: botUserId ?? null,
    slack_channel: slackChannel ?? null,
    is_polling: isPolling,
  };
}

// --- Logging (wrapper autour du helper partage) ---

function log(action: string, detail: string, traceId?: string): void {
  sharedLog("dev-orchestrator", action, detail, traceId);
}

// --- Slack direct helper ---

/**
 * v5: Envoie un message Slack via le client direct.
 * Si pas de client Slack, log un warning et retourne undefined (mode degrade).
 * Retourne le thread_ts si le message est envoye avec succes.
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
 * Envoie un message Slack lie a un ticket, en respectant le thread existant.
 * - Si le ticket a deja un slack_thread_ts, repond dans le thread.
 * - Sinon, cree un nouveau message et sauvegarde le thread_ts sur le ticket.
 * - Mute l'objet ticket local pour que les appels suivants reutilisent le thread.
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
      // Update local ticket object so subsequent calls in the same run use this thread
      (ticket as any).slack_thread_ts = threadTs;
    } catch (err) {
      if (traceId) {
        log("workflow.slack_thread", `Failed to save slack_thread_ts: ${err}`, traceId);
      }
    }
  }

  return threadTs;
}

// --- Contexte projet ---

/**
 * Charge les fichiers de reference du projet (ontologie, securite)
 * pour injecter le contexte metier dans les prompts d'analyse.
 * Appele une fois au demarrage, le resultat est reutilise pour tous les tickets.
 */
function loadProjectContext(workspace: string): string {
  const files = [
    { path: "memory/constitution.md", label: "Constitution du projet" },
    { path: "ontologie/01_ontologie.md", label: "Ontologie metier" },
    { path: "security/ARCHITECTURE_DE_SECURITÉ.md", label: "Architecture de securite" },
  ];
  const sections: string[] = [];
  for (const f of files) {
    const fullPath = resolve(workspace, f.path);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf-8");
      // Tronquer a ~2000 chars pour ne pas exploser le context window
      const truncated = content.slice(0, 2000);
      sections.push(`## ${f.label}\n${truncated}`);
      log("system.context", `${f.label} charge (${truncated.length} chars)`);
    } else {
      log("system.context", `${f.label} non trouve: ${fullPath}`);
    }
  }
  return sections.length > 0
    ? `\n\n# === CONTEXTE PROJET ===\n${sections.join("\n\n")}`
    : "";
}

// --- Prompts ---

// parseSubAgentResult -> importe depuis ./lib/helpers.js

// --- v5 Helper Functions ---

/**
 * Build the prompt for the sub-agent-analyst.
 * Includes ticket info + project context (ontology, constitution, security).
 */
function buildAnalystPrompt(ticket: ServiceDeskTicket, projectContext: string): string {
  return `Tu es le sub-agent-analyst AIMS v5. Analyse ce ticket et retourne un JSON structure.

## Ticket
- **ID:** ${ticket.ticket_id}
- **Titre:** ${ticket.title}
- **Description:** ${ticket.description || "(aucune)"}
- **Type:** ${ticket.type}
- **Priorite:** ${ticket.priority}

${projectContext}

## Instructions
1. Lis l'ontologie, la constitution et l'architecture de securite ci-dessus
2. Analyse le ticket par rapport a ces sources de verite
3. Identifie les entites metier touchees
4. Evalue les risques securite et l'impact Loi 25
5. Propose un plan d'execution structure

## Format de sortie (JSON strict)
\`\`\`json
{
  "status": "READY | NEEDS_CLARIFICATION",
  "classification": "feature | bugfix | refactor | infra",
  "complexity": "simple | moderate | complex",
  "entities": ["Offre", "Contrat"],
  "security_concerns": ["RLS requis sur nouvelle table"],
  "loi25_impact": "none | low | high",
  "execution_plan": {
    "steps": ["Creer migration", "Modifier composant OffreForm", "Ajouter tests"],
    "subagents_needed": ["dev", "qa"],
    "estimated_risk": "low"
  },
  "questions": []
}
\`\`\`

Retourne UNIQUEMENT le JSON, sans texte additionnel.`;
}

/**
 * Parse the structured output from the analyst sub-agent.
 */
function parseAnalystOutput(rawOutput: string): AnalystOutput | null {
  try {
    // Try to find JSON in the output (may be wrapped in markdown code blocks)
    const cleaned = rawOutput.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      status: parsed.status ?? "READY",
      classification: parsed.classification ?? "feature",
      complexity: parsed.complexity ?? "simple",
      entities: parsed.entities ?? [],
      security_concerns: parsed.security_concerns ?? [],
      loi25_impact: parsed.loi25_impact ?? "none",
      execution_plan: {
        steps: parsed.execution_plan?.steps ?? [],
        subagents_needed: parsed.execution_plan?.subagents_needed ?? [],
        estimated_risk: parsed.execution_plan?.estimated_risk ?? "low",
      },
      questions: parsed.questions ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the Slack channel name from the ServiceDesk application metadata.
 * Returns the channel name or null if not found.
 */
async function fetchSlackChannel(
  client: ServiceDeskClient,
  applicationId: string,
): Promise<string | null> {
  try {
    const appInfo = await client.getApplication(applicationId);
    return (appInfo as any)?.metadata?.slack?.channel_name ?? null;
  } catch {
    return null;
  }
}

/**
 * Handle a message from the architect in a Slack thread.
 * Classifies the intent and takes action based on the current ticket state.
 */
async function handleArchitectMessage(
  msg: NewArchitectMessage,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  slackClient: SlackClient,
  channel: string,
): Promise<void> {
  const traceId = (await client.getTicket(msg.ticketId) as any)?.trace_id ?? "";
  const thread = activeThreads.get(msg.ticketId);
  if (!thread) return;

  const intentResult = await classifyIntent(
    config.anthropic_api_key,
    msg.message.text,
    thread.runStatus,
    "plan_presented",
  );

  log("slack.intent", `Ticket ${msg.ticketId}: intent=${intentResult.intent} confidence=${intentResult.confidence}`, traceId);

  // Build transition context for state-machine module
  const transCtx: TransitionContext = {
    config,
    client,
    slack: slackClient,
    channel,
    activeThreads,
  };

  switch (intentResult.intent) {
    case "approve":
      if (thread.runStatus === "PLANNING") {
        // Transition state via extracted module
        await smTransitionToApproved(msg.ticketId, transCtx, traceId);

        // v5: Kick off execution after approval (stays in orchestrator — accesses global state)
        if (orchestratorContext) {
          const ctx = orchestratorContext;
          try {
            const ticket = await client.getTicket(msg.ticketId) as ServiceDeskTicket;
            const trace = ((ticket as any).orchestrator_trace ?? (ticket as any).metadata?.orchestrator_trace) as OrchestratorTrace | undefined;

            if (!trace) {
              log("workflow.error", `APPROVED ticket ${msg.ticketId} missing orchestrator_trace — cannot execute`, traceId);
              break;
            }

            activeRuns++;
            executeApprovedTicket(ticket, trace, traceId, ctx.config, ctx.client, ctx.agents, ctx.orchestratorSkills, ctx.projectContext, ctx.slackChannel, ctx.slackClient)
              .catch((err) => log("workflow.error", `Execution after approval failed for ${msg.ticketId}: ${err}`, traceId))
              .finally(() => { activeRuns--; });
          } catch (err) {
            log("workflow.error", `Failed to kick off execution for ${msg.ticketId}: ${err}`, traceId);
          }
        }
      }
      break;
    case "reject":
      await smTransitionToFailed(msg.ticketId, transCtx, traceId, "Rejete par l'architecte");
      break;
    case "question":
    case "directive":
      await respondToArchitect(msg, config, slackClient, channel, traceId, intentResult.summary);
      break;
    case "ambiguous":
      await slackClient.postThreadReply(channel, msg.threadTs,
        "Je n'ai pas bien compris. Tu veux que je lance l'implementation ? (oui/non)");
      break;
  }
}

/**
 * Respond to the architect's question or directive in the thread.
 */
async function respondToArchitect(
  msg: NewArchitectMessage,
  _config: OrchestratorConfig,
  slack: SlackClient,
  channel: string,
  traceId: string,
  summary: string,
): Promise<void> {
  await slack.postThreadReply(channel, msg.threadTs,
    `Compris. ${summary}\n_Le plan reste en attente de validation. Dis "go" pour lancer, ou continue d'ajuster._`);
  log("slack.response", `Responded to architect on ticket ${msg.ticketId}: ${summary}`, traceId);
}

// --- Flux principal ---

/**
 * Traite un ticket. Delegates to the extracted ticket-processor module.
 * Keeps the same signature for backward compatibility with polling loops.
 */
async function processTicket(
  ticket: ServiceDeskTicket,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  orchestratorSkills: string,
  projectContext: string,
  slackChannel: string,
  slack: SlackClient | null,
  revisionFeedback?: string,
): Promise<void> {
  const ctx: ProcessingContext = {
    config,
    client,
    agents,
    orchestratorSkills,
    projectContext,
    slackChannel,
    slack,
    activeThreads,
  };

  await tpProcessTicket(
    ticket,
    ctx,
    revisionFeedback,
    // Callback for auto-approve (degraded/revision mode)
    async (t, trace, traceId, feedback) => {
      await executeApprovedTicket(t, trace, traceId, config, client, agents, orchestratorSkills, projectContext, slackChannel, slack, feedback);
    },
  );
}

/**
 * Execute un ticket apres approbation (APPROVED → RUNNING → VALIDATING → DONE/FAILED).
 * Appele soit par transitionToApproved (flux v5 normal),
 * soit directement par processTicket (mode degraded ou revision).
 */
async function executeApprovedTicket(
  ticket: ServiceDeskTicket,
  trace: OrchestratorTrace,
  traceId: string,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  orchestratorSkills: string,
  projectContext: string,
  slackChannel: string,
  slack: SlackClient | null,
  revisionFeedback?: string,
): Promise<void> {
  const startTime = Date.now();
  let sessionId: string | undefined;
  let retryCount = 0;
  const isRevision = !!revisionFeedback;
  const toolsAccumulator: string[] = [];
  let analysisUsage = emptyUsage();
  let executionUsage = emptyUsage();

  const getTicketId = () => ticket.id;
  const getTraceId = () => traceId;

  try {
    // Set RUNNING if not already (transitionToApproved sets APPROVED, we advance to RUNNING)
    await client.updateRunStatus(ticket.id, "RUNNING", traceId, config.agent_id, {
      orchestrator_trace: trace,
      session_id: sessionId,
    });

    // Detection migration -> transfert a l'humain
    if (trace.classification.ticket_type === "migration") {
      await client.updateRunStatus(ticket.id, "BLOCKED", traceId, config.agent_id);
      await client.postComment(
        ticket.id,
        commentMigrationTransfer(traceId, config.agent_id, ticket.title, trace),
      );

      if (slack) { // v5: send if Slack client available
        await sendSlackThreaded(slack, slackChannel,
          `${"@here" /* v5: hardcoded mention */} *Migration DB detectee* — transfert a l'humain\n*Ticket:* ${ticket.ticket_id} — ${ticket.title}\n*Trace:* \`${traceId}\`\n\n_Les migrations doivent etre executees manuellement._`,
          ticket, client, traceId,
        );
      }

      log("workflow.migration_transfer", `Migration detectee, transfert a l'humain`, traceId);
      return;
    }

    // ================================================================
    // ETAPE 2b : REPORT — Livrable Slack (pas de PR)
    // ================================================================

    if (trace.classification.ticket_type === "report") {
      log("workflow.report", "Type report detecte — execution sub-agent en lecture seule", traceId);

      // Spawn sub-agent en lecture seule (pas de Write/Edit)
      let reportResult = "";
      for await (const message of query({
        prompt: `Tu executes une tache AIMS v4.1 de type RAPPORT.

## Ticket
- **ID:** ${ticket.id}
- **Titre:** ${ticket.title}
- **Description:** ${ticket.description}
- **Priorite:** ${ticket.priority}

## Classification
- **Type :** report
- **Sub-agent :** ${trace.sub_agent_type}
- **Raison :** ${trace.reason}

## Instructions
Analyse le codebase et produis un rapport structure en markdown.
Le rapport sera envoie directement sur Slack — PAS de commit, PAS de PR, PAS de fichier.
Retourne UNIQUEMENT le contenu du rapport en markdown Slack (max 4000 chars).
Utilise des bullet points, des titres (*bold*), et un resume executif en haut.

## Workspace
Le repo se trouve dans ${config.workspace}.`,
        options: {
          allowedTools: ["Read", "Grep", "Glob"],
          permissionMode: "acceptEdits",
        },
      })) {
        if (message.type === "result") {
          sessionId = message.session_id;
          executionUsage = extractUsage(message);
          if (message.subtype === "success") {
            reportResult = message.result;
          }
        }
      }

      if (!reportResult) {
        throw new Error("Sub-agent report n'a retourne aucun resultat");
      }

      // Le canal Slack est deja resolu au demarrage (slackChannel param)

      // Generer le resume court pour le message Slack (max 3000 chars)
      const summaryLines = reportResult.split("\n").slice(0, 50);
      let summary = summaryLines.join("\n");
      if (summary.length > 3000) {
        summary = summary.slice(0, 2950) + "\n\n_... (tronque)_";
      }

      // Envoyer sur Slack : resume (dans le thread du ticket)
      if (slack) { // v5: send if Slack client available
        await sendSlackThreaded(slack, slackChannel,
          `*Rapport — ${ticket.title}*\n_Ticket: ${ticket.id} | Trace: \`${traceId}\`_\n\n${summary}`,
          ticket, client, traceId,
        );

        log("workflow.report", `Rapport envoye sur Slack ${slackChannel}`, traceId);
      }

      // Marquer DONE avec commentaire dual-view
      const durationMs = Date.now() - startTime;
      await client.updateRunStatus(ticket.id, "DONE", traceId, config.agent_id, {
        session_id: sessionId,
        run_duration_ms: durationMs,
      });
      await client.postComment(
        ticket.id,
        commentDone(traceId, config.agent_id,
          `Rapport envoye sur Slack ${slackChannel}. Pas de branche Git ni PR (type: report).`,
        ),
      );

      // Poster le commentaire de consommation de tokens
      await client.postComment(
        ticket.id,
        commentTokenUsage(analysisUsage, executionUsage),
      );

      log("workflow.report_done", `Rapport livre sur ${slackChannel} en ${Math.round(durationMs / 1000)}s`, traceId);
      recordSuccess();
      return;
    }

    // ================================================================
    // ETAPE 3 : EXECUTION — Spawn du sub-agent
    // ================================================================

    let executionPrompt = buildExecutionPrompt(ticket, trace, traceId);

    // Mode revision : injecter le feedback QA dans le prompt
    if (isRevision && revisionFeedback) {
      executionPrompt += `\n\n## MODE REVISION — Feedback QA

L'humain a demande une revision apres la QA. Voici son feedback :

> ${revisionFeedback}

## Instructions revision
- La branche \`aims/${ticket.id}\` existe deja — travaille dessus (pas besoin de la recreer)
- La PR existe deja — pousse tes corrections sur la meme branche
- Corrige UNIQUEMENT ce que le feedback demande, ne refais pas tout
- Commite avec un message qui reference le feedback (ex: "fix: correction selon feedback QA")
- Retourne le meme format JSON de resultat habituel`;
    }

    let executionResult = "";

    // v4.1 : options inline, pas de ClaudeAgentOptions
    // v4.5 : MCP ServiceDesk RETIRE du sub-agent — seul l'orchestrator gere les statuts
    for await (const message of query({
      prompt: executionPrompt,
      options: {
        allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Agent"],
        agents,
        permissionMode: "acceptEdits",
        hooks: {
          // Audit Loi 25 : log chaque outil utilise
          PostToolUse: [
            {
              hooks: [
                createAuditHook(client, config.agent_id, getTraceId, toolsAccumulator, config.application_id),
                createProgressHook(client, config.agent_id, getTicketId, getTraceId, 10),
              ],
            },
          ],
          // Sub-agent lifecycle : log dans le ticket
          SubagentStart: [
            {
              hooks: [
                createSubAgentStartHook(client, config.agent_id, getTicketId, getTraceId),
              ],
            },
          ],
          SubagentStop: [
            {
              hooks: [
                createSubAgentStopHook(client, config.agent_id, getTicketId, getTraceId),
              ],
            },
          ],
          // Protection fichiers sensibles
          PreToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                createFileProtectionHook(
                  [".env", "credentials", "secret", ".pem", ".key"],
                  client, getTicketId, getTraceId, config.agent_id,
                ),
              ],
            },
          ],
          // Notifications SDK -> core-comm
          Notification: [
            {
              hooks: [
                // DEPRECATED v5: core-comm removed. Notification hook disabled.
                // createNotificationHook(config.core_comm_url, slackChannel, getTicketId, getTraceId),
              ],
            },
          ],
        },
      },
    })) {
      if (message.type === "result") {
        sessionId = message.session_id;
        executionUsage = extractUsage(message);
        if (message.subtype === "success") {
          executionResult = message.result;
        }
      }
    }

    // ================================================================
    // ETAPE 3b : DETECTION [QUESTION] -> BLOCKED
    // ================================================================

    if (executionResult.includes("[QUESTION]")) {
      const question = executionResult.split("[QUESTION]")[1]?.trim() || "Question non specifiee";

      // v4.1 : sauvegarder blocked_question et blocked_at pour le response-handler
      await client.updateRunStatus(ticket.id, "BLOCKED", traceId, config.agent_id, {
        session_id: sessionId,
        blocked_question: question,
        blocked_at: new Date().toISOString(),
      });
      await client.postComment(
        ticket.id,
        commentBlocked(traceId, config.agent_id, question, sessionId),
      );

      // Notifier Slack (direct ou via core-comm fallback)
      if (slack) { // v5: send if Slack client available
        const questionText = `${"@here" /* v5: hardcoded mention */} J'ai une question avant de continuer :\n\n> ${question}\n\n_Repondez dans ce thread._`;
        await sendSlackThreaded(slack, slackChannel, questionText, ticket, client, traceId);
      }

      log("workflow.blocked", `Question: ${question.slice(0, 200)}`, traceId);
      return; // Le response-handler se charge de la reprise
    }

    // ================================================================
    // ETAPE 4 : VALIDATING — Proof of Work (DESACTIVE temporairement)
    // ================================================================

    const subResult = parseSubAgentResult(executionResult);
    const branch = subResult.branch || `aims/${ticket.id}`; // fallback connu
    const powResult: ProofOfWorkResult | null = null;

    log("workflow.validating", "Proof of Work SKIP (desactive)", traceId);

    // Persister les infos PR sur le ticket si disponibles
    if (subResult.prUrl) {
      try {
        await client.updatePRInfo(ticket.id, subResult.prUrl);
        log("workflow.pr_info", `PR liee au ticket: ${subResult.prUrl}`, traceId);
      } catch (error) {
        log("workflow.pr_info", `Echec mise a jour PR info: ${error}`, traceId);
      }
    }

    // ================================================================
    // ETAPE 5 : IN_REVIEW — Pret pour QA humain
    // ================================================================
    // L'humain est dans la loop : on ne marque PAS completed.
    // On met en in_review et on attend la validation humaine.

    // Attendre le deploy preview Netlify si PR disponible
    let deployPreview: DeployPreviewResult | null = null;
    if (subResult.prUrl && config.github_token) {
      log("workflow.deploy_preview", "Attente du deploy preview Netlify...", traceId);
      await client.postComment(ticket.id,
        commentProgress(traceId, config.agent_id, "Attente du deploy preview Netlify...")
      );
      deployPreview = await waitForDeployPreview(subResult.prUrl, {
        github_token: config.github_token,
        github_owner: config.github_owner || "",
        github_repo: config.github_repo || "",
      });
      if (deployPreview) {
        log("workflow.deploy_preview", `Deploy preview: ${deployPreview.status} — ${deployPreview.url}`, traceId);
      } else {
        log("workflow.deploy_preview", "Timeout — aucun deploy preview trouve", traceId);
      }
    }

    // Verifier que la PR est mergeable avant d'envoyer en QA
    if (subResult.prUrl && config.github_token) {
      const mergeCheck = await checkPRMergeable(subResult.prUrl, {
        github_token: config.github_token,
        github_owner: config.github_owner || "",
        github_repo: config.github_repo || "",
      });

      if (mergeCheck && !mergeCheck.mergeable) {
        log("workflow.conflict_detected", `PR #${mergeCheck.prNumber} en conflit (${mergeCheck.mergeStateStatus}) — tentative rebase auto`, traceId);

        await client.postComment(ticket.id,
          commentProgress(traceId, config.agent_id,
            `PR #${mergeCheck.prNumber} en conflit avec \`main\` — rebase automatique en cours...`,
          ),
        );

        const rebaseResult = attemptAutoRebase(branch, config.workspace);

        if (rebaseResult.success) {
          log("workflow.rebase_success", `Rebase auto reussi pour ${branch}`, traceId);
          await client.postComment(ticket.id,
            commentProgress(traceId, config.agent_id,
              `Rebase automatique reussi. La branche \`${branch}\` est a jour avec \`main\`.`,
            ),
          );
          // Continuer vers la QA normalement
        } else {
          log("workflow.rebase_failed", `Rebase auto echoue: ${rebaseResult.error?.slice(0, 200)}`, traceId);

          await client.updateRunStatus(ticket.id, "BLOCKED", traceId, config.agent_id, {
            session_id: sessionId,
            blocked_question: `La PR #${mergeCheck.prNumber} est en conflit avec main. Le rebase automatique a echoue — intervention manuelle requise.`,
            blocked_at: new Date().toISOString(),
          });

          await client.postComment(ticket.id,
            commentBlocked(traceId, config.agent_id,
              `La PR #${mergeCheck.prNumber} est en conflit avec \`main\`. Le rebase automatique a echoue.\n\n` +
              `**Erreur:**\n\`\`\`\n${rebaseResult.error?.slice(0, 300)}\n\`\`\`\n\n` +
              `Rebase manuel necessaire :\n` +
              "```\n" +
              `git checkout ${branch}\n` +
              `git fetch origin && git rebase origin/main\n` +
              `# Resoudre les conflits\n` +
              `git push --force-with-lease\n` +
              "```",
              sessionId,
            ),
          );

          if (slack) { // v5: send if Slack client available
            await sendSlack(slack, slackChannel,
              `${"@here" /* v5: hardcoded mention */} :warning: *PR en conflit — rebase auto echoue*\n` +
              `*Ticket:* ${ticket.ticket_id} — ${ticket.title}\n` +
              `*PR:* #${mergeCheck.prNumber}\n` +
              `*Branche:* \`${branch}\`\n` +
              `*Trace:* \`${traceId}\`\n\n` +
              `_Le rebase automatique a echoue. Intervention manuelle requise._`,
            );
          }
          return; // Ne PAS envoyer en QA
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const deployUrl = deployPreview?.status === "success" ? deployPreview.url : undefined;

    await client.updateRunStatus(ticket.id, "VALIDATING", traceId, config.agent_id, {
      session_id: sessionId,
      run_executed_by: trace.sub_agent_type,
      run_duration_ms: durationMs,
    });
    await client.postComment(
      ticket.id,
      commentReadyForQA(
        traceId,
        config.agent_id,
        subResult.summary,
        branch,
        subResult.filesModified,
        subResult.prUrl,
        durationMs,
        deployUrl,
      ),
    );

    // Poster le commentaire de consommation de tokens
    await client.postComment(
      ticket.id,
      commentTokenUsage(analysisUsage, executionUsage),
    );

    if (slack) { // v5: send if Slack client available
      const prLine = subResult.prUrl ? `:link: *PR :* ${subResult.prUrl}\n` : "";
      const deployLine = deployPreview?.status === "success"
        ? `:globe_with_meridians: *Preview :* ${deployPreview.url}\n`
        : deployPreview?.status === "failure"
          ? `:warning: *Le deploy preview a echoue* — verifiez le build Netlify\n`
          : "";
      const summaryText = subResult.summary ? `\n${subResult.summary}\n` : "";
      const qaText = `${"@here" /* v5: hardcoded mention */} C'est pret pour review :eyes:\n${summaryText}\n${prLine}${deployLine}\nDites-moi si c'est bon, ou ce qu'il faut ajuster.`;

      // Poster dans le thread Slack existant si disponible
      const existingThreadTs = (ticket as any).slack_thread_ts ?? (ticket.metadata as any)?.slack_thread_ts;
      try {
        const threadTs = await sendSlack(slack, slackChannel, qaText, existingThreadTs ? { threadTs: existingThreadTs } : undefined);

        // Sauvegarder le thread_ts si c'est un nouveau message
        if (threadTs && !existingThreadTs) {
          try { await client.updateSlackThreadTs(ticket.id, threadTs); } catch { /* log only */ }
        }
        if (!threadTs) {
          log("workflow.slack_qa_no_ts", "sendSlack QA returned undefined — notification possiblement non envoyee", traceId);
        }
      } catch (slackErr) {
        log("workflow.slack_qa_error", `Slack QA notification failed: ${slackErr}`, traceId);
      }
    }

    log("workflow.ready_for_qa", `Pret pour QA en ${Math.round(durationMs / 1000)}s — attente validation humaine`, traceId);
    recordSuccess();

  } catch (error) {
    // ================================================================
    // FAILED — Erreur avec retry
    // ================================================================

    const errorMsg = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    log("workflow.error", `Run failed: ${errorMsg}`, traceId);

    await client.updateRunStatus(ticket.id, "FAILED", traceId, config.agent_id, {
      session_id: sessionId,
      run_duration_ms: durationMs,
    });
    await client.postComment(
      ticket.id,
      commentFailed(traceId, config.agent_id, errorMsg, retryCount, config.max_retries, sessionId),
    );

    // Poster le commentaire de consommation de tokens (meme en echec)
    await client.postComment(
      ticket.id,
      commentTokenUsage(analysisUsage, executionUsage),
    );

    if (slack) { // v5: send if Slack client available
      await sendSlackThreaded(slack, slackChannel,
        `Oups, j'ai eu un probleme :warning:\n\n${errorMsg.slice(0, 200)}\n\n_Details dans le ticket ServiceDesk._`,
        ticket, client, traceId,
      );
    }

    recordFailure();

    // Retry si possible
    if (retryCount < config.max_retries) {
      retryCount++;
      log("workflow.retry", `Retry ${retryCount}/${config.max_retries}`, traceId);
      await client.postComment(
        ticket.id,
        commentProgress(traceId, config.agent_id, `**Retry ${retryCount}/${config.max_retries}** — Nouvelle tentative en cours...`),
      );
      // Remettre en QUEUED pour reprocessing
      unmarkProcessed(ticket.id);
      await client.updateRunStatus(ticket.id, "QUEUED", traceId, config.agent_id, {
        retry_count: retryCount,
      });
    }
  }
}

// --- v5: core-comm notifications removed. sendSlack() used directly. ---

// --- Merge approuve par l'humain ---

/**
 * Merge une PR GitHub apres approbation humaine sur le ServiceDesk.
 *
 * Flux : ticket passe de "qa" a "completed" par l'humain
 *        → l'orchestrator detecte le changement
 *        → merge la PR via gh pr merge --squash
 *        → met a jour le run_status AIMS en DONE
 *        → poste un commentaire de cloture
 */
async function mergeApprovedPR(
  ticket: ServiceDeskTicket,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  slackChannel: string,
  slack: SlackClient | null,
): Promise<void> {
  const traceId = generateTraceId();
  log("workflow.merge_approved", `Ticket ${ticket.id} approuve — merge en cours`, traceId);

  // Recuperer les infos PR depuis le ticket
  const fullTicket = await client.getTicket(ticket.id);
  const prUrl = (fullTicket as any).github_pr_url || (fullTicket.metadata as any)?.github_pr_url;
  const prNumber = (fullTicket as any).github_pr_number || (fullTicket.metadata as any)?.github_pr_number;

  if (!prUrl && !prNumber) {
    // Chercher la PR par branche aims/{ticket-id}
    const branch = `aims/${ticket.id}`;
    log("workflow.merge_approved", `Pas de PR URL sur le ticket — recherche par branche ${branch}`, traceId);

    try {
      const prList = execSync(
        `gh pr list --repo ${config.github_owner}/${config.github_repo} --head ${branch} --state open --json number,url --limit 1`,
        { encoding: "utf-8", timeout: 15_000 },
      ).trim();

      const prs = JSON.parse(prList || "[]");
      if (prs.length === 0) {
        log("workflow.merge_approved", `Aucune PR ouverte trouvee pour ${branch} — skip merge`, traceId);
        await client.updateRunStatus(ticket.id, "DONE", traceId, config.agent_id);
        await client.postComment(ticket.id,
          `**DONE** — Ticket approuve et clos.\n\n_Aucune PR a merger (branche \`${branch}\` non trouvee)._\n\nTrace: \`${traceId}\``,
        );
        return;
      }

      const pr = prs[0];
      await doMerge(pr.number, pr.url, ticket, config, client, traceId, slackChannel, slack);
    } catch (error) {
      log("workflow.merge_error", `Recherche PR echouee: ${error}`, traceId);
      await client.postComment(ticket.id,
        `**MERGE ECHOUE** — Erreur lors de la recherche de PR.\n\nErreur: ${String(error).slice(0, 200)}\n\nTrace: \`${traceId}\``,
      );
    }
    return;
  }

  // PR connue — merge directement
  const num = prNumber || prUrl?.match(/\/pull\/(\d+)/)?.[1];
  if (num) {
    await doMerge(Number(num), prUrl || "", ticket, config, client, traceId, slackChannel, slack);
  }
}

async function doMerge(
  prNumber: number,
  prUrl: string,
  ticket: ServiceDeskTicket,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  traceId: string,
  slackChannel: string,
  slack: SlackClient | null,
): Promise<void> {
  log("workflow.merge", `Merge PR #${prNumber}...`, traceId);

  // Verifier mergeable avant de tenter le merge — rebase auto si conflit
  if (config.github_token) {
    const mergeCheck = await checkPRMergeable(prUrl, {
      github_token: config.github_token,
      github_owner: config.github_owner || "",
      github_repo: config.github_repo || "",
    });
    if (mergeCheck && !mergeCheck.mergeable) {
      log("workflow.merge_conflict", `PR #${prNumber} en conflit — tentative rebase auto`, traceId);
      const branch = `aims/${ticket.id}`;
      const rebaseResult = attemptAutoRebase(branch, config.workspace);

      if (rebaseResult.success) {
        log("workflow.rebase_success", `Rebase auto reussi avant merge pour ${branch}`, traceId);
      } else {
        log("workflow.rebase_failed", `Rebase auto echoue avant merge: ${rebaseResult.error?.slice(0, 200)}`, traceId);
        await client.postComment(ticket.id,
          `**MERGE BLOQUE** — La PR #${prNumber} est en conflit et le rebase automatique a echoue.\n\n` +
          `**Erreur:**\n\`\`\`\n${rebaseResult.error?.slice(0, 300)}\n\`\`\`\n\nTrace: \`${traceId}\``,
        );
        return;
      }
    }
  }

  try {
    const mergeOutput = execSync(
      `gh pr merge ${prNumber} --repo ${config.github_owner}/${config.github_repo} --squash --delete-branch`,
      { encoding: "utf-8", timeout: 30_000 },
    ).trim();
    log("workflow.merged", `PR #${prNumber} mergee: ${mergeOutput}`, traceId);

    // Mettre a jour le ticket en DONE
    await client.updateRunStatus(ticket.id, "DONE", traceId, config.agent_id);
    await client.postComment(ticket.id,
      commentDone(traceId, config.agent_id,
        `PR #${prNumber} mergee avec succes (squash). Branche supprimee.`,
        undefined, undefined, prUrl || undefined,
      ),
    );

    // Notification Slack
    if (slack) { // v5: send if Slack client available
      await sendSlack(slack, slackChannel,
        `C'est merge et deploye :white_check_mark: Branche supprimee.`,
      );
    }
  } catch (error) {
    const errMsg = String(error).slice(0, 300);
    log("workflow.merge_error", `Merge PR #${prNumber} echoue: ${errMsg}`, traceId);

    await client.postComment(ticket.id,
      `**MERGE ECHOUE** — La PR #${prNumber} n'a pas pu etre mergee automatiquement.\n\nErreur: ${errMsg}\n\n_Mergez manuellement si necessaire._\n\nTrace: \`${traceId}\``,
    );
  }
}

// --- Boucle principale ---

async function main(): Promise<void> {
  const config = loadConfig();

  // Validation config
  if (!config.servicedesk_mcp_url || !config.servicedesk_api_key) {
    console.error("[FATAL] SERVICEDESK_MCP_URL et SERVICEDESK_API_KEY sont requis");
    process.exit(1);
  }
  if (!config.application_id) {
    console.error("[FATAL] AIMS_APPLICATION_ID est requis");
    process.exit(1);
  }

  const client = new ServiceDeskClient(config.servicedesk_mcp_url, config.servicedesk_api_key);
  const mcpConfig = [{
    name: "servicedesk",
    url: config.servicedesk_mcp_url,
    apiKey: config.servicedesk_api_key,
  }];
  const agents = loadAgentDefinitions(process.cwd(), mcpConfig);
  const orchestratorSkills = loadOrchestratorSkills(process.cwd());

  log("system.startup", `AIMS v5 orchestrator demarre (SDK) — poll ${config.poll_interval_ms}ms, slack_poll ${config.slack_poll_interval_ms}ms, max_concurrent=${config.max_concurrent_runs}`);
  log("system.skills", `Skills orchestrator charges: ${(orchestratorSkills.match(/## SKILL:/g) || []).length} skills`);

  // Health check initial
  const healthy = await client.healthCheck();
  log("system.health", healthy ? "ServiceDesk OK" : "ServiceDesk UNREACHABLE — continuing anyway");

  // === PREFLIGHT CONFIG CHECK ===
  log("system.preflight", "Verifications preflight...");
  const preflight = await runPreflightChecks(config, client);
  log("system.preflight", preflight.summary);
  for (const check of preflight.checks) {
    log("system.preflight", `[${check.level}] ${check.name}: ${check.message}`);
  }

  if (preflight.hasFail) {
    const report = formatPreflightReport(preflight);
    // Creer un ticket incident pour tracer le probleme
    try {
      await client.createTicket({
        title: `[AIMS-PREFLIGHT] Config check failed — ${config.agent_id}`,
        description: report,
        application_id: config.application_id,
        type: "incident",
        priority: "high",
      });
    } catch { /* log only */ }

    // SlackClient may not be available yet at preflight stage, create temporary one
    const preflightSlack = config.slack_bot_token ? createSlackClient(config.slack_bot_token) : null;
    if (preflightSlack) { // v5: send if Slack client available
      await sendSlack(preflightSlack, "#aims-notifications",
        `:x: *AIMS Preflight FAILED* — \`${config.agent_id}\`\n${preflight.summary}\n_Ticket incident cree dans le ServiceDesk._`,
      );
    }
    console.error(`[FATAL] Preflight failed: ${preflight.summary}`);
    process.exit(1);
  }

  if (preflight.hasWarn) {
    const preflightSlack = config.slack_bot_token ? createSlackClient(config.slack_bot_token) : null;
    if (preflightSlack) await sendSlack(preflightSlack, "#aims-notifications",
      `:warning: *AIMS Preflight WARNING* — \`${config.agent_id}\`\n${preflight.summary}`,
    );
  }
  log("system.preflight", "Preflight OK");

  // Resoudre le canal Slack depuis la fiche application ServiceDesk
  let resolvedSlackChannel = "#aims-notifications"; // v5: fallback, overridden by ServiceDesk app metadata
  try {
    const appInfo = await client.getApplication(config.application_id);
    const channel = (appInfo as any)?.metadata?.slack?.channel_name;
    if (channel) {
      resolvedSlackChannel = channel;
      log("system.slack", `Canal Slack resolu depuis ServiceDesk: ${channel}`);
    } else {
      log("system.slack", `Pas de canal Slack dans la fiche app — fallback: ${resolvedSlackChannel}`);
    }
  } catch (err) {
    log("system.slack", `Erreur lecture fiche app — fallback: ${resolvedSlackChannel}: ${err}`);
  }

  // Charger le contexte projet APRES le preflight (le workspace peut avoir ete clone)
  const projectContext = loadProjectContext(config.workspace);
  log("system.context", `Contexte projet charge: ${projectContext.length} chars total`);

  // --- v5: Slack client direct ---
  const slackClient = config.slack_bot_token ? createSlackClient(config.slack_bot_token) : null;
  if (slackClient) {
    log("system.slack", "Slack client direct initialise (SLACK_BOT_TOKEN present)");

    // v5: Validate Slack bot token via auth.test
    const authResult = await slackClient.authTest();
    if (authResult.ok) {
      botUserId = authResult.bot_id;
      log("system.slack", `Slack auth OK — bot_id: ${botUserId}`);
    } else {
      log("system.slack", `Slack auth FAILED: ${authResult.error} — mode degrade (ServiceDesk only)`);
    }

    // Warm up channel ID cache — resolvedSlackChannel becomes the ID for all API calls
    const channelId = await slackClient.resolveChannelId(resolvedSlackChannel);
    if (channelId) {
      slackChannel = channelId;
      log("system.slack", `Channel ID resolu: ${resolvedSlackChannel} → ${channelId}`);
      resolvedSlackChannel = channelId; // v5: use channel ID everywhere (conversations.replies requires ID, not name)
    } else {
      log("system.slack", `WARN: impossible de resoudre le channel ID pour "${resolvedSlackChannel}" — Slack sera en mode degrade`);
    }
  } else {
    log("system.slack", "Pas de SLACK_BOT_TOKEN — mode degrade (ServiceDesk only)");
  }

  // --- v5: Graceful Shutdown ---
  setupGracefulShutdown({
    activeTicketIds: () => processedTicketIds(),
    stopPolling: () => { isPolling = false; },
    serviceDeskClient: client,
    drainTimeoutMs: 120_000,
  });

  // --- v5: Crash Recovery — Recover active Slack threads from ServiceDesk ---
  if (slackClient && botUserId) {
    const recoveredCount = await recoverActiveThreads(client, config.application_id, resolvedSlackChannel);
    if (recoveredCount > 0) {
      log("recovery.threads", `Recovered ${recoveredCount} active Slack threads from ServiceDesk`);
    }
  }

  // --- v5: Set orchestrator context for post-approval execution ---
  orchestratorContext = {
    config,
    client,
    agents,
    orchestratorSkills,
    projectContext,
    slackChannel: resolvedSlackChannel,
    slackClient,
  };

  // --- v5: HTTP Health Endpoint ---
  const http = await import("http");
  const healthServer = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const health = buildHealthResponse();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  healthServer.listen(8080, () => {
    log("system.health", "Health endpoint listening on :8080/health");
  });

  // --- Boucle de polling via silo_discover ---
  const pollQueued = async () => {
    if (!isPolling) return;
    if (isCircuitOpen()) {
      log("system.circuit_open", "Circuit breaker ouvert — 5 echecs consecutifs, pause 5 min");
      return;
    }

    lastServiceDeskPoll = new Date();
    try {
      // v4.1 MCP : utilise silo_discover au lieu de getQueuedTickets
      // Retourne les tickets groupes par etape silo :
      //   - pending_analysis : status=new (a analyser)
      //   - pending_review : status=in_review (attente reponse humaine)
      //   - ready_for_dev : status=ready_to_deploy (prets pour le dev)
      const discovered = await client.siloDiscover(config.application_id);

      // Les tickets ready_for_dev sont ceux qu'on peut traiter
      // Les pending_analysis seront traites par l'analyse initiale
      // Les pending_review orphelins (sans trace_id ni run_status) sont des tickets
      // jamais traites — les inclure pour declencher la notification Slack
      const orphanReview = (discovered.pending_review || []).filter(
        (t: any) => !t.trace_id && !t.run_status
      );
      const actionableTickets = [
        ...discovered.pending_analysis,
        ...discovered.ready_for_dev,
        ...orphanReview,
      ];

      for (const ticket of actionableTickets) {
        if (isProcessed(ticket.id)) continue;

        // Verifier le run_status AIMS (pas le status Desk)
        const runStatus = (ticket as any).run_status ?? (ticket.metadata as any)?.run_status;
        // Accepter les tickets sans run_status (nouveaux) ou en QUEUED
        if (runStatus && runStatus !== "QUEUED") continue;

        if (activeRuns >= config.max_concurrent_runs) {
          log("system.throttle", `Max concurrent runs atteint (${activeRuns}/${config.max_concurrent_runs}) — ticket ${ticket.id} reporte`);
          break;
        }

        markProcessed(ticket.id);
        activeRuns++;

        // v4.1 : await avec gestion d'erreur propre
        processTicket(ticket, config, client, agents, orchestratorSkills, projectContext, resolvedSlackChannel, slackClient)
          .catch((err) => log("workflow.error", `Unhandled error: ${err}`, ""))
          .finally(() => { activeRuns--; });
      }
    } catch (error) {
      log("system.error", `Poll failed: ${error}`);
      recordFailure();
    }
  };

  // --- Callback pour revision QA → processTicket ---
  const processTicketForRevision = async (ticket: ServiceDeskTicket, revisionFeedback: string) => {
    activeRuns++;
    try {
      await processTicket(ticket, config, client, agents, orchestratorSkills, projectContext, resolvedSlackChannel, slackClient, revisionFeedback);
    } finally {
      activeRuns--;
    }
  };

  // --- Boucle de polling BLOCKED (response-handler) ---
  const pollBlocked = async () => {
    if (isCircuitOpen()) return;
    await pollBlockedTickets(config, client, agents, resolvedSlackChannel, slackClient, processTicketForRevision);
    await checkAndSendRelances(config, client, resolvedSlackChannel, slackClient);
  };

  // --- Helper pour construire les lignes PR + preview Netlify ---
  async function buildPrLines(ticket: ServiceDeskTicket, cfg: OrchestratorConfig): Promise<string> {
    const prUrl = (ticket as any).github_pr_url as string | undefined;
    if (!prUrl) return "";

    let lines = `*PR:* ${prUrl}\n`;

    if (cfg.github_token) {
      try {
        const deployPreview = await waitForDeployPreview(prUrl, {
          github_token: cfg.github_token,
          github_owner: cfg.github_owner || "",
          github_repo: cfg.github_repo || "",
        });
        if (deployPreview?.status === "success") {
          lines += `*Preview:* ${deployPreview.url}\n`;
        } else if (deployPreview?.status === "failure") {
          lines += `:warning: *Le deploy preview a echoue* — verifiez le build Netlify\n`;
        }
      } catch {
        // Degradation gracieuse — pas de ligne preview
      }
    }

    return lines;
  }

  // --- Watchdog sante tickets (detecte et corrige les etats inconsistants) ---
  const healthRelanceMap = new Map<string, number>(); // ticketId -> timestamp derniere relance

  const pollTicketHealth = async () => {
    try {
      // Recuperer TOUS les tickets actifs du silo
      const discovered = await client.siloDiscover(config.application_id);
      let qaTickets: ServiceDeskTicket[] = [];
      try {
        qaTickets = await client.listTickets(config.application_id, { status: "qa", silo_assigned: true });
      } catch { /* best effort */ }

      const allActive: ServiceDeskTicket[] = [
        ...discovered.pending_analysis,
        ...discovered.pending_review,
        ...discovered.ready_for_dev,
        ...qaTickets,
      ];

      for (const ticket of allActive) {
        const runStatus = (ticket as any).run_status ?? (ticket as any).metadata?.run_status;
        const status = ticket.status;
        const runUpdatedAt = (ticket as any).run_updated_at ?? (ticket as any).metadata?.run_updated_at;
        const ageMs = runUpdatedAt ? Date.now() - new Date(runUpdatedAt).getTime() : Infinity;
        const traceId = (ticket as any).trace_id ?? (ticket as any).metadata?.trace_id ?? "";
        const threadTs = (ticket as any).slack_thread_ts ?? (ticket as any).metadata?.slack_thread_ts;

        // 1. QA sans VALIDATING (etat corrompu — ex: status=qa mais run_status=QUEUED)
        if (status === "qa" && runStatus && runStatus !== "VALIDATING" && runStatus !== "DONE" && runStatus !== "LANDING") {
          log("health.qa_inconsistent", `${ticket.ticket_id}: status=qa mais run_status=${runStatus} — correction`, traceId);
          try {
            await client.updateRunStatus(ticket.id, "VALIDATING", traceId, config.agent_id);
          } catch { /* best effort */ }

          // Re-notifier Slack
          if (slackClient) { // v5: send if Slack client available
            const prLines = await buildPrLines(ticket, config);
            const fixText = `${"@here" /* v5: hardcoded mention */} C'est pret pour review :eyes:\n${prLines}\nDites-moi si c'est bon, ou ce qu'il faut ajuster.`;
            try {
              const ts = await sendSlack(slackClient, resolvedSlackChannel, fixText, threadTs ? { threadTs } : undefined);
              if (ts && !threadTs) {
                try { await client.updateSlackThreadTs(ticket.id, ts); } catch { /* log only */ }
              }
            } catch { /* best effort */ }
          }
          continue;
        }

        // 2. QA dormant (VALIDATING > 1h sans reponse)
        if (status === "qa" && runStatus === "VALIDATING" && ageMs > 60 * 60 * 1000) {
          const lastRelance = healthRelanceMap.get(ticket.id) || 0;
          if (Date.now() - lastRelance < 60 * 60 * 1000) continue; // Max 1 relance/heure

          log("health.qa_dormant", `${ticket.ticket_id}: en QA depuis ${Math.round(ageMs / 60000)} min — relance`, traceId);
          if (slackClient) { // v5: send if Slack client available
            const prLines = await buildPrLines(ticket, config);
            const relanceText = `${"@here" /* v5: hardcoded mention */} Petit rappel — ca attend votre retour depuis ${Math.round(ageMs / 3600000)}h :point_up:\n${prLines}\nDites-moi si c'est bon, ou ce qu'il faut ajuster.`;
            try {
              await sendSlack(slackClient, resolvedSlackChannel, relanceText, threadTs ? { threadTs } : undefined);
            } catch { /* best effort */ }
          }
          healthRelanceMap.set(ticket.id, Date.now());
          continue;
        }

        // 3. Notification manquante (QA ou BLOCKED sans thread Slack)
        if ((runStatus === "VALIDATING" || runStatus === "BLOCKED") && !threadTs && slackClient) {
          log("health.missing_slack", `${ticket.ticket_id}: ${runStatus} sans thread Slack — notification de rattrapage`, traceId);
          const question = (ticket as any).blocked_question ?? (ticket as any).metadata?.blocked_question ?? "";
          const prLines = await buildPrLines(ticket, config);
          const text = runStatus === "BLOCKED"
            ? `${"@here" /* v5: hardcoded mention */} J'ai une question avant de continuer :\n\n> ${question}\n\n_Repondez dans ce thread._`
            : `${"@here" /* v5: hardcoded mention */} C'est pret pour review :eyes:\n${prLines}\nDites-moi si c'est bon, ou ce qu'il faut ajuster.`;
          try {
            const ts = await sendSlack(slackClient, resolvedSlackChannel, text);
            if (ts) {
              try { await client.updateSlackThreadTs(ticket.id, ts); } catch { /* log only */ }
            }
          } catch { /* best effort */ }
        }
      }

      // Cleanup healthRelanceMap (supprimer les tickets qui ne sont plus actifs)
      const activeIds = new Set(allActive.map((t) => t.id));
      for (const id of healthRelanceMap.keys()) {
        if (!activeIds.has(id)) healthRelanceMap.delete(id);
      }
    } catch (error) {
      console.error("[health] pollTicketHealth failed:", error);
    }
  };

  // --- Boucle de polling APPROVED (merge PR apres approbation humaine) ---
  const pollApproved = async () => {
    try {
      // Chercher les tickets completed + silo_assigned (approuves par l'humain)
      const completedTickets = await client.listTickets(config.application_id, {
        status: "completed",
        silo_assigned: true,
      });

      for (const ticket of completedTickets) {
        // Eviter double-merge (cache memoire + check run_status persistant)
        if (mergedTickets.has(ticket.id)) continue;
        const meta = (ticket as any).run_status ?? (ticket as any).metadata?.run_status;
        if (meta === "DONE") {
          mergedTickets.set(ticket.id, Date.now()); // cache pour ne plus re-checker
          continue;
        }
        mergedTickets.set(ticket.id, Date.now());

        log("workflow.approved_detected", `Ticket ${ticket.id} approuve par l'humain — lancement merge`, "");
        await mergeApprovedPR(ticket, config, client, resolvedSlackChannel, slackClient);
      }

      // Cleanup mergedTickets (meme TTL que processedTickets)
      const now = Date.now();
      for (const [id, ts] of mergedTickets) {
        if (now - ts > PROCESSED_TTL_MS) mergedTickets.delete(id);
      }
    } catch (error) {
      log("system.error", `pollApproved failed: ${error}`, "");
    }
  };

  // --- v5: Slack polling loop (architect messages in active threads) ---
  const pollSlack = async () => {
    if (!isPolling || !slackClient || !botUserId) return;

    try {
      const threads = Array.from(activeThreads.values());
      if (threads.length === 0) return;

      const newMessages = await pollSlackThreads(slackClient, threads, botUserId);
      lastSlackPoll = new Date();

      for (const msg of newMessages) {
        try {
          await handleArchitectMessage(msg, config, client, slackClient, resolvedSlackChannel);
        } catch (err) {
          log("slack.handler_error", `Error handling architect message for ${msg.ticketId}: ${err}`);
        }
      }

      // Refresh channel from ServiceDesk every 5 min — resolve to ID
      if (Date.now() - lastChannelFetch > 5 * 60 * 1000) {
        const freshChannelName = await fetchSlackChannel(client, config.application_id);
        if (freshChannelName && slackClient) {
          const freshId = await slackClient.resolveChannelId(freshChannelName);
          const resolved = freshId || freshChannelName;
          if (resolved !== resolvedSlackChannel) {
            log("system.slack", `Canal Slack mis a jour: ${resolvedSlackChannel} → ${resolved}`);
            resolvedSlackChannel = resolved;
          }
        }
        lastChannelFetch = Date.now();
      }
    } catch (err) {
      log("system.error", `pollSlack failed: ${err}`);
    }
  };

  // Premier poll immediat
  await pollQueued();
  await pollBlocked();
  await pollApproved();

  // Puis intervalles reguliers
  setInterval(() => { if (isPolling) pollQueued(); }, config.poll_interval_ms);
  setInterval(() => { if (isPolling) pollBlocked(); }, config.poll_interval_ms);
  setInterval(() => { if (isPolling) pollApproved(); }, config.poll_interval_ms);

  // v5: Slack polling loop — separate interval for architect responses
  if (slackClient && botUserId) {
    setInterval(pollSlack, config.slack_poll_interval_ms);
    log("system.slack", `Slack polling loop demarre (${config.slack_poll_interval_ms}ms)`);
  }

  // Fast-track : poll Slack threads toutes les 10s pour les tickets BLOCKED (v4 compat)
  if (slackClient) {
    setInterval(async () => {
      if (!isPolling) return;
      try {
        await quickPollSlackThreads(
          config, client, agents, resolvedSlackChannel, slackClient, processTicketForRevision,
        );
      } catch (err) {
        log("system.error", `quickPollSlackThreads failed: ${err}`, "");
      }
    }, 10_000);
  }

  // Watchdog sante — toutes les 2 minutes
  setInterval(async () => {
    if (!isPolling || isCircuitOpen()) return;
    await pollTicketHealth();
  }, 120_000);

  // Nettoyage periodique du cache
  setInterval(cleanupProcessedTickets, 10 * 60 * 1000); // Toutes les 10 min

}

// --- Demarrage ---

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
