/**
 * AIMS v5 — Response Handler
 *
 * Gere le flux BLOCKED -> RUNNING :
 *   1. Poll le ServiceDesk pour les tickets BLOCKED ayant recu une reponse
 *   2. La reponse peut venir de :
 *      - Un commentaire dans le ticket ServiceDesk
 *      - Un reply dans le thread Slack (detecte par polling direct)
 *   3. Quand une reponse est detectee, resume la session SDK
 *   4. Les pieces jointes Slack sont telecharges, extraites et uploadees sur ServiceDesk
 *
 * v5 : Slack direct (plus de core-comm), support pieces jointes
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { ServiceDeskClient } from "./servicedesk-client.js";
import type { SlackClient } from "./slack-client.js";
import { processSlackFiles, uploadFilesToServiceDesk, formatFilesForPrompt } from "./file-handler.js";
import type { ExtractedFile } from "./file-handler.js";

/**
 * Extrait les champs AIMS d'un ticket.
 * Les colonnes AIMS (run_status, trace_id, session_id, etc.) sont stockees
 * comme colonnes directes sur le ticket, pas dans un sous-objet "metadata".
 * Ce helper supporte les deux formats pour compatibilite.
 */
function getTicketMeta(ticket: any): Record<string, any> {
  // Priorite aux colonnes directes (nouveau schema)
  return {
    run_status: ticket.run_status ?? ticket.metadata?.run_status,
    trace_id: ticket.trace_id ?? ticket.metadata?.trace_id,
    session_id: ticket.session_id ?? ticket.metadata?.session_id,
    blocked_question: ticket.blocked_question ?? ticket.metadata?.blocked_question,
    blocked_at: ticket.blocked_at ?? ticket.metadata?.blocked_at,
    run_updated_at: ticket.run_updated_at ?? ticket.metadata?.run_updated_at,
    human_response: ticket.human_response ?? ticket.metadata?.human_response,
    orchestrator_trace: ticket.orchestrator_trace ?? ticket.metadata?.orchestrator_trace,
    slack_thread_ts: ticket.slack_thread_ts ?? ticket.metadata?.slack_thread_ts,
  };
}

/**
 * Envoie un message Slack lie a un ticket en respectant le thread existant.
 * Pattern unifie pour le response-handler.
 */
async function sendSlackInThread(
  slackClient: SlackClient | null,
  config: OrchestratorConfig,
  channel: string,
  text: string,
  ticket: any,
  client: ServiceDeskClient,
): Promise<void> {
  const existingThreadTs = getTicketMeta(ticket).slack_thread_ts;
  if (slackClient) {
    if (existingThreadTs) {
      await slackClient.postThreadReply(channel, existingThreadTs, text);
    } else {
      const result = await slackClient.postMessage(channel, text);
      if (result.ok && result.ts) {
        try { await client.updateSlackThreadTs(ticket.id, result.ts); } catch { /* log only */ }
      }
    }
  } else {
    console.warn(`[response-handler] No Slack client — message not sent: ${text.slice(0, 100)}`);
  }
}

import {
  commentProgress,
  commentDone,
  commentFailed,
  commentBlocked,
  commentValidatingStarted,
  commentValidatingResult,
  commentLanding,
  commentReadyForQA,
} from "./dual-view.js";
import { executeProofOfWork } from "./proof-of-work.js";
import { executeLanding } from "./landing.js";
import { parseSubAgentResult, log as sharedLog, waitForDeployPreview, checkPRMergeable, attemptAutoRebase } from "./helpers.js";
import type { DeployPreviewResult } from "./helpers.js";
import {
  createAuditHook,
  createSubAgentStartHook,
  createSubAgentStopHook,
  createNotificationHook,
  createFileProtectionHook,
  createProgressHook,
  recordFailure,
  recordSuccess,
} from "./hooks.js";
import type {
  OrchestratorConfig,
  ServiceDeskTicket,
  ProofOfWorkResult,
} from "./types.js";

/** v5 compat: extract notif fields with defaults (deprecated optional fields) */
function getNotifChannel(config: OrchestratorConfig, slackChannel?: string): string {
  return slackChannel || config.notif_channel || "#aims-notifications";
}
function getNotifMention(config: OrchestratorConfig): string {
  return config.notif_mention || "@here";
}

// --- Types ---

export interface HumanResponse {
  ticketId: string;
  answer: string;
  source: "slack" | "servicedesk" | "unknown";
  respondedAt: string;
  commentId?: string;
  files?: ExtractedFile[];
}

export interface BlockedTicketInfo {
  ticket: ServiceDeskTicket;
  sessionId: string;
  traceId: string;
  question: string;
  blockedAt: string;
}

// --- Detection de reponse ---

/**
 * Verifie si un ticket BLOCKED a recu une reponse humaine.
 *
 * Strategies de detection :
 * 1. Commentaire avec tag [ANSWER] (poste par core-comm depuis Slack)
 * 2. Commentaire d'un auteur non-AIMS apres le dernier commentaire BLOCKED
 * 3. Metadata `human_response` patchee par un webhook externe
 */
export async function checkForHumanResponse(
  client: ServiceDeskClient,
  ticketId: string,
  blockedAt: string,
): Promise<HumanResponse | null> {
  try {
    const comments = await client.getTicketComments(ticketId);

    // Filtrer les commentaires apres le blocage
    const postBlockComments = comments.filter(
      (c: any) => new Date(c.created_at) > new Date(blockedAt),
    );

    for (const comment of postBlockComments) {
      const content = comment.content || "";

      // Strategie 1 : Tag [ANSWER] (callback Slack via core-comm)
      if (content.includes("[ANSWER]")) {
        const answer = content.split("[ANSWER]")[1]?.trim() || content;
        return {
          ticketId,
          answer: cleanAnswer(answer),
          source: comment.metadata?.source === "slack" ? "slack" : "servicedesk",
          respondedAt: comment.created_at,
          commentId: comment.id,
        };
      }

      // Strategie 2 : Commentaire humain
      // Filtrer les commentaires generes par le systeme :
      //   - author_label "AIMS Orchestrator" ou "Slack Thread"
      //   - Prefixe ctx:base64 ou ancien format AGENT_CONTEXT
      //   - Contenu dual-view (emoji headings comme 🚫, 🔵, 🔄, ✅, ⛔)
      const authorLabel = (comment.author_label || "").toLowerCase();
      const isSystemAuthor = authorLabel.includes("aims") || authorLabel.includes("slack thread") || authorLabel.includes("orchestrator");
      const isAimsComment = isSystemAuthor
        || /^ctx:[A-Za-z0-9+/=]+$/m.test(content)
        || content.includes("<!-- AGENT_CONTEXT -->")
        || /^[\u{1F6AB}\u{1F535}\u{1F504}\u{2705}\u{26D4}\u{270B}]/u.test(content.trim());
      if (!isAimsComment) {
        return {
          ticketId,
          answer: cleanAnswer(content),
          source: "servicedesk",
          respondedAt: comment.created_at,
          commentId: comment.id,
        };
      }
    }

    // Strategie 3 : Metadata patchee par webhook
    const ticket = await client.getTicket(ticketId);
    const humanResponse = (ticket as any).human_response ?? (ticket.metadata as any)?.human_response;
    if (humanResponse && new Date(humanResponse.responded_at) > new Date(blockedAt)) {
      return {
        ticketId,
        answer: humanResponse.answer,
        source: humanResponse.source || "unknown",
        respondedAt: humanResponse.responded_at,
      };
    }

    return null;
  } catch (error) {
    console.error(`[response-handler] checkForHumanResponse failed for ${ticketId}:`, error);
    return null;
  }
}

/**
 * Nettoie la reponse humaine des tags et formatage dual-view.
 */
function cleanAnswer(raw: string): string {
  return raw
    // Nouveau format v4.1 : supprimer la ligne ctx:base64 et le separateur
    .replace(/\n---\nctx:[A-Za-z0-9+/=]+\s*$/, "")
    .replace(/^ctx:[A-Za-z0-9+/=]+$/m, "")
    // Ancien format v4 (compatibilite)
    .replace(/<!--\s*HUMAN_VIEW\s*-->/, "")
    .replace(/<!--\s*\/HUMAN_VIEW\s*-->/, "")
    .replace(/<!--\s*AGENT_CONTEXT\s*-->[\s\S]*?<!--\s*\/AGENT_CONTEXT\s*-->/, "")
    .replace(/\[ANSWER\]/g, "")
    .trim();
}

// --- Resume du run ---

/**
 * Reprend un run BLOCKED apres reception d'une reponse humaine.
 *
 * Utilise options.resume avec le session_id sauvegarde dans le ticket.
 * Le sub-agent reprend avec son contexte complet + la reponse injectee.
 */
export async function resumeBlockedRun(
  blocked: BlockedTicketInfo,
  response: HumanResponse,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  slackChannel?: string,
  slackClient?: SlackClient | null,
): Promise<void> {
  const notifChannel = getNotifChannel(config, slackChannel);
  const { ticket, sessionId, traceId } = blocked;
  const startTime = Date.now();

  log("response-handler.resume", `Ticket ${ticket.id}: reponse recue de ${response.source}`, traceId);
  clearRelance(ticket.id);

  // Poster un commentaire de reprise
  await client.postComment(
    ticket.id,
    commentProgress(
      traceId,
      config.agent_id,
      `**Reponse recue** (via ${response.source}) — Reprise du run...\n\n` +
      `> ${response.answer.slice(0, 500)}`,
    ),
  );

  // Passer de BLOCKED a RUNNING
  await client.updateRunStatus(ticket.id, "RUNNING", traceId, config.agent_id, {
    human_response: {
      answer: response.answer,
      source: response.source,
      responded_at: response.respondedAt,
    },
  });

  try {
    // Upload files to ServiceDesk and format for prompt
    let filesPromptContent = "";
    if (response.files && response.files.length > 0) {
      await uploadFilesToServiceDesk(client, ticket.id, response.files);
      filesPromptContent = formatFilesForPrompt(response.files);
    }

    // Resume la session SDK avec la reponse humaine
    const resumePrompt = buildResumePrompt(
      blocked.question, response.answer, ticket.id, traceId, filesPromptContent,
    );

    const toolsAccumulator: string[] = [];
    const getTicketId = () => ticket.id;
    const getTraceId = () => traceId;

    let executionResult = "";
    let newSessionId: string | undefined;

    for await (const message of query({
      prompt: resumePrompt,
      options: {
        resume: sessionId,
        permissionMode: "acceptEdits",
        mcpServers: {
          "servicedesk": {
            type: "http" as const,
            url: config.servicedesk_mcp_url,
            headers: { Authorization: `Bearer ${config.servicedesk_api_key}` },
          },
        },
        hooks: {
          PostToolUse: [
            {
              hooks: [
                createAuditHook(client, config.agent_id, getTraceId, toolsAccumulator, config.application_id),
                createProgressHook(client, config.agent_id, getTicketId, getTraceId, 10),
              ],
            },
          ],
          SubagentStart: [
            { hooks: [createSubAgentStartHook(client, config.agent_id, getTicketId, getTraceId)] },
          ],
          SubagentStop: [
            { hooks: [createSubAgentStopHook(client, config.agent_id, getTicketId, getTraceId)] },
          ],
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
          Notification: [
            {
              hooks: [
                // DEPRECATED v5: core-comm removed. Notification hook disabled.
                // createNotificationHook(config.core_comm_url, notifChannel, getTicketId, getTraceId),
              ],
            },
          ],
        },
      },
    })) {
      if (message.type === "result") {
        newSessionId = message.session_id;
        if (message.subtype === "success") {
          executionResult = message.result;
        }
      }
    }

    // Detecter si le sub-agent pose une NOUVELLE question
    if (executionResult.includes("[QUESTION]")) {
      const newQuestion = executionResult.split("[QUESTION]")[1]?.trim() || "Question non specifiee";

      await client.updateRunStatus(ticket.id, "BLOCKED", traceId, config.agent_id, {
        session_id: newSessionId || sessionId,
        blocked_question: newQuestion,
        blocked_at: new Date().toISOString(),
      });

      await client.postComment(
        ticket.id,
        commentProgress(
          traceId,
          config.agent_id,
          `**Nouvelle question** — Le run est de nouveau bloque.\n\n> ${newQuestion}\n\n` +
          `_Repondez dans le ticket ou sur Slack pour debloquer._`,
        ),
      );

      if (config.notif_enabled) {
        const reBlockedText = `${getNotifMention(config)} J'ai une autre question :\n\n> ${newQuestion}\n\n_Repondez dans ce thread._`;

        if (slackClient) {
          const existingThreadTs = getTicketMeta(ticket).slack_thread_ts;
          const result = existingThreadTs
            ? await slackClient.postThreadReply(notifChannel, existingThreadTs, reBlockedText)
            : await slackClient.postMessage(notifChannel, reBlockedText);
          if (result.ok && result.ts && !existingThreadTs) {
            try { await client.updateSlackThreadTs(ticket.id, result.ts); } catch { /* log only */ }
          }
        } else {
          log("response-handler.slack_degraded", "No Slack client — re-blocked notification skipped", traceId);
        }
      }

      log("response-handler.re-blocked", `Nouvelle question: ${newQuestion.slice(0, 200)}`, traceId);
      return;
    }

    // Continuer le workflow normal : PoW -> Landing -> Done
    await continueAfterResume(
      ticket, traceId, config, client, agents,
      executionResult, newSessionId || sessionId, startTime, notifChannel, slackClient || null,
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    log("response-handler.error", `Resume failed: ${errorMsg}`, traceId);

    // Si le resume echoue (session expiree, crash SDK), remettre en QUEUED
    // avec la reponse humaine enrichie dans la description pour reprocessing complet
    const isSessionError = errorMsg.includes("exited with code 1") || errorMsg.includes("session");
    if (isSessionError) {
      log("response-handler.retry_as_new", `Session expiree — requeue ticket ${ticket.id} pour reprocessing complet`, traceId);

      // Enrichir la description avec la reponse humaine
      const enrichedDescription = [
        ticket.description || ticket.title,
        `\n\n[Contexte additionnel de l'humain]: ${response.answer}`,
      ].join("");

      await client.updateRunStatus(ticket.id, "QUEUED", traceId, config.agent_id, {
        session_id: null,
        blocked_question: null,
        blocked_at: null,
        orchestrator_trace: null,
      });

      // Mettre a jour la description et le status pour reprocessing
      try {
        await client.updateTicket(ticket.id, {
          description: enrichedDescription,
          status: "new",
        });
      } catch { /* best effort */ }

      await client.postComment(
        ticket.id,
        commentProgress(
          traceId,
          config.agent_id,
          `**Resume echoue** (session expiree) — Ticket remis en file pour reprocessing complet avec la reponse humaine integree.\n\n> ${response.answer.slice(0, 300)}`,
        ),
      );
      return;
    }

    await client.updateRunStatus(ticket.id, "FAILED", traceId, config.agent_id, {
      session_id: sessionId,
      run_duration_ms: durationMs,
    });
    await client.postComment(
      ticket.id,
      commentFailed(traceId, config.agent_id, errorMsg, 0, config.max_retries, sessionId),
    );

    if (config.notif_enabled) {
      const failText = `Oups, j'ai eu un probleme :warning:\n\n${errorMsg.slice(0, 200)}\n\n_Details dans le ticket ServiceDesk._`;
      await sendSlackInThread(slackClient || null, config, notifChannel, failText, ticket, client);
    }

    recordFailure();
  }
}

// --- Suite du workflow apres resume ---

async function continueAfterResume(
  ticket: ServiceDeskTicket,
  traceId: string,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  executionResult: string,
  sessionId: string | undefined,
  startTime: number,
  notifChannel: string,
  slackClient: SlackClient | null,
): Promise<void> {
  const subResult = parseSubAgentResult(executionResult);
  const branch = subResult.branch || `aims/${ticket.id}`; // fallback connu

  // VALIDATING
  await client.updateRunStatus(ticket.id, "VALIDATING", traceId, config.agent_id, {
    session_id: sessionId,
  });
  await client.postComment(
    ticket.id,
    commentValidatingStarted(traceId, config.agent_id),
  );

  let powResult: ProofOfWorkResult | null = null;
  if (branch) {
    const powOutput = await executeProofOfWork(branch, agents["sub-agent-qa"]);
    powResult = powOutput.parsed;
  }

  if (powResult) {
    await client.postComment(
      ticket.id,
      commentValidatingResult(traceId, config.agent_id, powResult),
    );

    if (!powResult.all_passed) {
      await client.updateRunStatus(ticket.id, "FAILED", traceId, config.agent_id);
      await client.postComment(
        ticket.id,
        commentFailed(traceId, config.agent_id, "Proof of Work echoue apres resume", 0, config.max_retries, sessionId),
      );
      recordFailure();
      return;
    }
  }

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

        if (config.notif_enabled) {
          const conflictText = `${getNotifMention(config)} :warning: *PR en conflit — rebase auto echoue*\n` +
            `*Ticket:* ${ticket.id} — ${ticket.title}\n` +
            `*PR:* #${mergeCheck.prNumber}\n` +
            `*Branche:* \`${branch}\`\n` +
            `*Trace:* \`${traceId}\`\n\n` +
            `_Le rebase automatique a echoue. Intervention manuelle requise._`;
          await sendSlackInThread(slackClient || null, config, notifChannel, conflictText, ticket, client);
        }
        return; // Ne PAS envoyer en QA
      }
    }
  }

  // IN_REVIEW — Pret pour QA humain (human-in-the-loop)
  const durationMs = Date.now() - startTime;
  const deployUrl = deployPreview?.status === "success" ? deployPreview.url : undefined;

  await client.updateRunStatus(ticket.id, "VALIDATING", traceId, config.agent_id, {
    session_id: sessionId,
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

  if (config.notif_enabled) {
    const deployLine = deployPreview?.status === "success"
      ? `*Preview:* ${deployPreview.url}\n`
      : deployPreview?.status === "failure"
        ? `:warning: *Le deploy preview a echoue* — verifiez le build Netlify\n`
        : "";
    const prLine = subResult.prUrl ? `:link: *PR :* ${subResult.prUrl}\n` : "";
    const qaText = `${getNotifMention(config)} C'est pret pour review :eyes:\n\n${prLine}${deployLine}\nDites-moi si c'est bon, ou ce qu'il faut ajuster.`;

    // Poster dans le thread Slack existant si disponible
    const existingThreadTs = getTicketMeta(ticket).slack_thread_ts;
    if (slackClient && existingThreadTs) {
      await slackClient.postThreadReply(notifChannel, existingThreadTs, qaText);
    } else if (slackClient) {
      const result = await slackClient.postMessage(notifChannel, qaText);
      // Sauvegarder le thread_ts si c'est un nouveau message
      if (result.ok && result.ts) {
        try { await client.updateSlackThreadTs(ticket.id, result.ts); } catch { /* log only */ }
      }
    } else {
      console.warn(`[response-handler] No Slack client — QA ready notification skipped`);
    }
  }

  log("response-handler.ready_for_qa", `Resume pret pour QA en ${Math.round(durationMs / 1000)}s — attente validation humaine`, traceId);
  recordSuccess();
}

// --- Prompt de resume ---

function buildResumePrompt(
  originalQuestion: string,
  humanAnswer: string,
  ticketId: string,
  traceId: string,
  filesContent?: string,
): string {
  const filesSection = filesContent
    ? `\n\n## Pieces jointes\n${filesContent}`
    : "";

  return `L'humain a repondu a ta question. Continue l'implementation.

## Question posee
> ${originalQuestion}

## Reponse de l'humain
> ${humanAnswer}${filesSection}

## Contexte
- **Ticket :** ${ticketId}
- **Trace :** ${traceId}

## Instructions
Continue la ou tu t'etais arrete. Utilise la reponse pour debloquer ton travail.
Retourne ton resultat JSON habituel quand tu as termine.
Si tu as besoin d'une autre clarification, retourne [QUESTION].`;
}

// --- Boucle de polling BLOCKED ---

/**
 * Poll les tickets en attente de reponse humaine (BLOCKED + QA).
 * Appele depuis la boucle principale de l'orchestrator.
 *
 * v4.4 : Gere deux types de tickets :
 *   - BLOCKED (in_review) : question humaine → resume SDK session
 *   - QA (qa) : validation humaine → marquer completed ou re-ouvrir
 */
export async function pollBlockedTickets(
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  slackChannel?: string,
  slackClient?: SlackClient | null,
  processTicketFn?: (ticket: ServiceDeskTicket, revisionFeedback: string) => Promise<void>,
): Promise<void> {
  const notifChannel = getNotifChannel(config, slackChannel);
  try {
    const awaitingTickets = await client.getBlockedTickets(config.application_id);

    for (const ticket of awaitingTickets) {
      const metadata = getTicketMeta(ticket);
      if (!metadata?.trace_id) continue;

      const runStatus = metadata.run_status as string;
      const blockedAt = metadata.blocked_at || metadata.run_updated_at || "";
      let response = await checkForHumanResponse(client, ticket.id, blockedAt);

      // Fallback: check Slack thread directly if no ServiceDesk response found
      if (!response && slackClient && metadata.slack_thread_ts && notifChannel) {
        response = await checkSlackThreadForResponse(
          slackClient, client, ticket.id, notifChannel, metadata.slack_thread_ts, blockedAt,
        );
      }

      if (!response) continue;

      // Ticket en QA (VALIDATING) : validation humaine
      if (runStatus === "VALIDATING" || ticket.status === "qa") {
        handleQAResponse(ticket, response, config, client, notifChannel, slackClient, processTicketFn)
          .catch((err) => log("response-handler.error", `QA handler: ${err}`, metadata.trace_id));
        continue;
      }

      // Ticket BLOCKED : resume SDK session
      if (!metadata.session_id) {
        // Pas de session a reprendre (ex: gate de completude) →
        // Enrichir la description avec la reponse et remettre en QUEUED
        log("response-handler.no_session", `Ticket ${ticket.id}: BLOCKED sans session — requeue avec reponse`, metadata.trace_id);

        const enrichedDescription = [
          ticket.description || ticket.title,
          `\n\n[Contexte additionnel de l'humain]: ${response.answer}`,
        ].join("");

        await client.updateRunStatus(ticket.id, "QUEUED", metadata.trace_id, config.agent_id, {
          session_id: null,
          blocked_question: null,
          blocked_at: null,
          orchestrator_trace: null,
        });

        try {
          await client.updateTicket(ticket.id, {
            description: enrichedDescription,
            status: "new",
          });
        } catch { /* best effort */ }

        await client.postComment(
          ticket.id,
          commentProgress(
            metadata.trace_id,
            config.agent_id,
            `**Reponse recue** (via ${response.source}) — Ticket enrichi et remis en file.\n\n> ${response.answer.slice(0, 300)}`,
          ),
        );

        // Notifier Slack
        if (config.notif_enabled) {
          const requeueText = `Merci, je m'en occupe :thumbsup:`;
          const existingThreadTs = metadata.slack_thread_ts;
          if (slackClient && existingThreadTs) {
            await slackClient.postThreadReply(notifChannel, existingThreadTs, requeueText);
          } else if (slackClient) {
            await slackClient.postMessage(notifChannel, requeueText);
          }
        }

        continue;
      }

      const blockedInfo: BlockedTicketInfo = {
        ticket,
        sessionId: metadata.session_id,
        traceId: metadata.trace_id,
        question: metadata.blocked_question || "Question inconnue",
        blockedAt,
      };

      // Lancer la reprise (sans await pour ne pas bloquer le poll)
      resumeBlockedRun(blockedInfo, response, config, client, agents, notifChannel, slackClient)
        .catch((err) => log("response-handler.error", `Unhandled: ${err}`, metadata.trace_id));
    }
  } catch (error) {
    console.error("[response-handler] pollBlockedTickets failed:", error);
  }
}

// --- Classification QA ---

/**
 * Classifie la reponse QA : approbation ou demande de revision.
 * Heuristiques d'abord, fallback Claude si ambigu.
 */
async function classifyQAResponse(answer: string): Promise<"approval" | "revision" | "question"> {
  const lower = answer.toLowerCase().trim();

  // Questions d'information (pas une revision!)
  if (/^(c[' ]?(est )?quoi|qu[' ]?(est-ce que|est ce)|ou est|quel(le)?|comment|pourquoi|combien|montre|envoie|link|lien|url|pr\??)/i.test(lower)) {
    return "question";
  }

  // Approbations courtes/explicites
  if (/^(ok|oui|parfait|approved?|lgtm|c['']?est bon|go|merge|accepte|good|nice|super|bravo|merci|excellent|top|genial|impeccable)/i.test(lower)) {
    return "approval";
  }
  // Rejections/revisions explicites
  if (/^(non|pas bon|change|modifie|corrige|plutot|refai|ajuste|mauvais|faux|erreur|bug|probleme|issue|fix|revise|redo)/i.test(lower)) {
    return "revision";
  }

  // Ambigu → Claude classification (1 turn, pas de tools)
  try {
    let classifyResult = "";
    for await (const message of query({
      prompt: `Ce commentaire QA est-il :
- "approval" : l'humain valide/approuve (ok, c'est bon, merge, etc.)
- "revision" : l'humain demande un changement (change X, corrige Y, etc.)
- "question" : l'humain pose une question d'info (c'est quoi la PR, ou est le lien, etc.)

Reponds UNIQUEMENT "approval", "revision" ou "question".

Commentaire: "${answer.slice(0, 500)}"`,
      options: {
        allowedTools: [],
        permissionMode: "acceptEdits",
      },
    })) {
      if (message.type === "result" && message.subtype === "success") {
        classifyResult = message.result;
      }
    }

    const text = classifyResult.toLowerCase().trim();
    if (text.includes("approval")) return "approval";
    if (text.includes("question")) return "question";
    if (text.includes("revision")) return "revision";

    // Default securitaire : mieux vaut re-traiter que d'approuver a tort
    return "revision";
  } catch (error) {
    log("response-handler.classify_error", `Classification Claude echouee: ${error} — default revision`);
    return "revision";
  }
}

/**
 * Gere la reponse humaine sur un ticket en QA.
 * Classifie la reponse : approbation → DONE, revision → relance processTicket.
 */
export async function handleQAResponse(
  ticket: ServiceDeskTicket,
  response: HumanResponse,
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  notifChannel: string,
  slackClient?: SlackClient | null,
  processTicketFn?: (ticket: ServiceDeskTicket, revisionFeedback: string) => Promise<void>,
): Promise<void> {
  const metadata = getTicketMeta(ticket);
  const traceId = metadata?.trace_id || "";

  log("response-handler.qa_response", `Ticket ${ticket.id}: reponse QA recue de ${response.source}`, traceId);
  clearRelance(ticket.id);

  // Classifier la reponse
  const classification = await classifyQAResponse(response.answer);
  log("response-handler.qa_classify", `Ticket ${ticket.id}: classification = ${classification}`, traceId);

  if (classification === "question") {
    // === CHEMIN QUESTION — repondre sans relancer de cycle ===
    log("response-handler.qa_question", `Ticket ${ticket.id}: question d'info detectee`, traceId);

    const lower = response.answer.toLowerCase();
    const prUrl = (ticket as any).github_pr_url;
    const prNumber = (ticket as any).github_pr_number;
    const branch = metadata?.orchestrator_trace?.files_likely_affected ? `aims/${ticket.id}` : undefined;

    let replyText = "";
    if (/pr|pull|lien|link|url/i.test(lower)) {
      replyText = prUrl
        ? `Voici la PR : ${prUrl}`
        : "Il n'y a pas encore de PR pour ce ticket.";
    } else if (/preview|netlify|deploy/i.test(lower)) {
      replyText = prNumber
        ? `Le preview Netlify : https://deploy-preview-${prNumber}--orbit.netlify.app`
        : "Pas de preview disponible pour le moment.";
    } else if (/branch|branche/i.test(lower)) {
      replyText = branch ? `La branche : \`${branch}\`` : "Branche non disponible.";
    } else {
      // Question generique → repondre avec un resume
      replyText = `Voici les infos du ticket :\n` +
        (prUrl ? `:link: *PR :* ${prUrl}\n` : "") +
        (prNumber ? `:globe_with_meridians: *Preview :* https://deploy-preview-${prNumber}--orbit.netlify.app\n` : "") +
        `\nDites-moi si c'est bon pour merger, ou ce qu'il faut ajuster.`;
    }

    // Poster la reponse dans le thread — PAS de relance de cycle
    const existingThreadTs = metadata?.slack_thread_ts;
    if (slackClient && existingThreadTs) {
      await slackClient.postThreadReply(notifChannel, existingThreadTs, replyText);
    } else if (slackClient) {
      await slackClient.postMessage(notifChannel, replyText);
    }
    return; // Rien d'autre a faire

  } else if (classification === "approval") {
    // === CHEMIN APPROBATION ===

    // Accuse de reception immediat
    const existingThreadTs = metadata?.slack_thread_ts;
    if (config.notif_enabled && slackClient && existingThreadTs) {
      await slackClient.postThreadReply(notifChannel, existingThreadTs, "Parfait, je merge :rocket:");
    }

    await client.postComment(
      ticket.id,
      commentProgress(
        traceId,
        config.agent_id,
        `**Reponse QA recue** (via ${response.source})\n\n> ${response.answer.slice(0, 500)}\n\n_Ticket marque comme termine._`,
      ),
    );

    await client.updateRunStatus(ticket.id, "DONE", traceId, config.agent_id, {
      session_id: metadata?.session_id,
      human_response: {
        answer: response.answer,
        source: response.source,
        responded_at: response.respondedAt,
      },
    });

    // Confirmation finale (le merge effectif est gere par mergeApprovedPR dans orchestrator)
    if (config.notif_enabled) {
      const qaText = `Ticket valide :white_check_mark: Le merge va suivre.`;
      if (slackClient && existingThreadTs) {
        await slackClient.postThreadReply(notifChannel, existingThreadTs, qaText);
      } else if (slackClient) {
        await slackClient.postMessage(notifChannel, qaText);
      } else {
        console.warn(`[response-handler] No Slack client — QA approval notification skipped`);
      }
    }

    log("response-handler.qa_completed", `Ticket ${ticket.id}: marque DONE apres validation QA`, traceId);
    recordSuccess();
  } else {
    // === CHEMIN REVISION ===
    log("response-handler.qa_revision", `Ticket ${ticket.id}: revision demandee — relance`, traceId);

    // Accuse de reception immediat
    const existingThreadTs = metadata?.slack_thread_ts;
    if (config.notif_enabled && slackClient && existingThreadTs) {
      await slackClient.postThreadReply(notifChannel, existingThreadTs, "Compris, je corrige ca :wrench:");
    }

    // Poster un commentaire de prise en charge
    await client.postComment(
      ticket.id,
      commentProgress(
        traceId,
        config.agent_id,
        `**Feedback QA recu** (via ${response.source})\n\n> ${response.answer.slice(0, 500)}\n\n_Demande de revision detectee — relance de l'agent en cours..._`,
      ),
    );

    // Remettre en QUEUED pour reprocessing avec feedback
    await client.updateRunStatus(ticket.id, "QUEUED", traceId, config.agent_id, {
      session_id: metadata?.session_id,
      human_response: {
        answer: response.answer,
        source: response.source,
        responded_at: response.respondedAt,
        qa_revision: true,
      },
    });

    // Pas de notification supplementaire — l'accuse de reception suffit
    // La confirmation viendra avec le prochain message "C'est pret pour review"

    // Lancer processTicket en mode revision si la fonction est disponible
    if (processTicketFn) {
      processTicketFn(ticket, response.answer)
        .catch((err) => log("response-handler.revision_error", `Revision failed: ${err}`, traceId));
    }
  }
}

// --- Slack thread response detection ---

/**
 * Verifie si un humain a repondu dans le thread Slack lie au ticket BLOCKED.
 * Si une reponse est trouvee :
 *   1. Poste un commentaire [ANSWER] dans le ServiceDesk (tracabilite)
 *   2. Ajoute une reaction check sur le message Slack
 *   3. Retourne le HumanResponse
 */
export async function checkSlackThreadForResponse(
  slackClient: SlackClient,
  sdClient: ServiceDeskClient,
  ticketId: string,
  channel: string,
  threadTs: string,
  blockedAt: string,
): Promise<HumanResponse | null> {
  try {
    // conversations.replies requires channel ID, not channel name
    // Resolve #channel-name to C0... ID if needed
    let channelId = channel;
    if (channel.startsWith("#") || !/^[A-Z0-9]+$/i.test(channel)) {
      const resolved = await slackClient.resolveChannelId(channel);
      if (!resolved) {
        console.error(`[response-handler] Could not resolve channel "${channel}" to ID`);
        return null;
      }
      channelId = resolved;
    }

    // Convert blockedAt ISO to Slack timestamp (epoch seconds)
    const oldest = blockedAt ? String(new Date(blockedAt).getTime() / 1000) : undefined;
    const result = await slackClient.getThreadReplies(channelId, threadTs, oldest);

    if (!result.ok || result.messages.length === 0) return null;

    // Filter human replies (not bot, not thread parent) and take the first one
    const humanReplies = result.messages.filter(
      (m) => m.ts !== threadTs && !m.bot_id && m.user,
    );
    if (humanReplies.length === 0) return null;

    const reply = humanReplies[0];
    const answer = reply.text.trim();

    // Process attached files if present (BEFORE null check — files-only messages are valid)
    let extractedFiles: ExtractedFile[] = [];
    if (reply.files && reply.files.length > 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      if (apiKey) {
        const fileResult = await processSlackFiles(slackClient, reply.files, apiKey);
        extractedFiles = fileResult.files;
        if (fileResult.errors.length > 0) {
          log("files.partial", `${fileResult.errors.length} file errors: ${fileResult.errors.join(", ")}`);
        }
      }
    }

    // Return null only if no text AND no files
    if (!answer && extractedFiles.length === 0) return null;

    const answerText = answer || "[fichier(s) attache(s)]";

    // 1. Post as [ANSWER] comment on ServiceDesk for traceability
    await sdClient.postComment(
      ticketId,
      `[ANSWER] ${answerText}\n\n_Source: Slack thread (user: ${reply.user})_`,
    );

    // 2. Add check reaction on the Slack reply
    await slackClient.addReaction(channelId, reply.ts, "white_check_mark");

    return {
      ticketId,
      answer: answerText,
      source: "slack",
      respondedAt: new Date(parseFloat(reply.ts) * 1000).toISOString(),
      files: extractedFiles,
    };
  } catch (error) {
    console.error(`[response-handler] checkSlackThreadForResponse failed for ${ticketId}:`, error);
    return null;
  }
}

// --- Relance periodique pour tickets BLOCKED ---

const RELANCE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const lastRelanceMap = new Map<string, number>(); // ticketId -> timestamp derniere relance

/**
 * Verifie les tickets BLOCKED et envoie un rappel Slack toutes les 15 min
 * tant que le ticket reste bloque sans reponse.
 */
export async function checkAndSendRelances(
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  slackChannel?: string,
  slackClient?: SlackClient | null,
): Promise<void> {
  const notifChannel = getNotifChannel(config, slackChannel);
  if (!config.notif_enabled) return;

  try {
    const blockedTickets = await client.getBlockedTickets(config.application_id);
    const now = Date.now();

    // Cleanup : supprimer du map les tickets qui ne sont plus BLOCKED
    const blockedIds = new Set(blockedTickets.map((t: ServiceDeskTicket) => t.id));
    for (const ticketId of lastRelanceMap.keys()) {
      if (!blockedIds.has(ticketId)) {
        lastRelanceMap.delete(ticketId);
      }
    }

    for (const ticket of blockedTickets) {
      const metadata = getTicketMeta(ticket);
      if (!metadata?.trace_id) continue;

      // Ne pas relancer les tickets QA — seuls les BLOCKED (questions) sont relances
      const runStatus = metadata.run_status as string;
      if (runStatus === "VALIDATING" || ticket.status === "qa") continue;

      const blockedAt = metadata.blocked_at || metadata.run_updated_at || "";
      if (!blockedAt) continue;

      const blockedSinceMs = now - new Date(blockedAt).getTime();
      if (blockedSinceMs < RELANCE_INTERVAL_MS) continue; // Pas encore 15 min

      const lastRelance = lastRelanceMap.get(ticket.id) || 0;
      if (now - lastRelance < RELANCE_INTERVAL_MS) continue; // Deja relance recemment

      const blockedMinutes = Math.round(blockedSinceMs / 60000);
      const question = metadata.blocked_question || "Question non specifiee";

      const relanceText = `${getNotifMention(config)} Petit rappel — ca attend votre retour depuis ${blockedMinutes} min :point_up:\n\n> ${question}\n\n_Repondez dans ce thread._`;

      // If we have a slack_thread_ts, reply in thread; otherwise send new message
      if (slackClient && metadata.slack_thread_ts) {
        await slackClient.postThreadReply(notifChannel, metadata.slack_thread_ts, relanceText);
      } else if (slackClient) {
        await slackClient.postMessage(notifChannel, relanceText);
      } else {
        console.warn(`[response-handler] No Slack client — relance notification skipped`);
      }

      lastRelanceMap.set(ticket.id, now);
      log("relance", `Relance envoyee pour ticket ${ticket.id} (bloque depuis ${blockedMinutes} min)`, metadata.trace_id);
    }
  } catch (error) {
    console.error("[response-handler] checkAndSendRelances failed:", error);
  }
}

/**
 * Supprime un ticket du map de relances (a appeler quand le ticket sort de BLOCKED).
 */
export function clearRelance(ticketId: string): void {
  lastRelanceMap.delete(ticketId);
}

// --- Fast-track Slack thread polling ---

/**
 * Poll rapide (10s) des threads Slack pour les tickets BLOCKED.
 * Ne touche QUE l'API Slack (pas le ServiceDesk) sauf si une reponse est detectee.
 * Complementaire a pollBlockedTickets qui fait le check complet (ServiceDesk + Slack).
 */
export async function quickPollSlackThreads(
  config: OrchestratorConfig,
  client: ServiceDeskClient,
  agents: Record<string, any>,
  slackChannel?: string,
  slackClient?: SlackClient | null,
  processTicketFn?: (ticket: ServiceDeskTicket, revisionFeedback: string) => Promise<void>,
): Promise<void> {
  if (!slackClient) return; // Pas de client Slack direct = skip

  const notifChannel = getNotifChannel(config, slackChannel);
  const blockedTickets = await client.getBlockedTickets(config.application_id);

  for (const ticket of blockedTickets) {
    const metadata = getTicketMeta(ticket);
    if (!metadata?.slack_thread_ts || !metadata?.trace_id) continue;

    // Check Slack thread UNIQUEMENT (pas ServiceDesk — pollBlocked s'en charge)
    const blockedAt = metadata.blocked_at || metadata.run_updated_at || "";
    const response = await checkSlackThreadForResponse(
      slackClient, client, ticket.id, notifChannel,
      metadata.slack_thread_ts, blockedAt,
    );

    if (!response) continue;

    // Detecte! Deleguer au handler normal
    const runStatus = metadata.run_status as string;
    if (runStatus === "VALIDATING" || ticket.status === "qa") {
      handleQAResponse(ticket, response, config, client, notifChannel, slackClient, processTicketFn)
        .catch((err) => log("quick-poll.error", `QA handler: ${err}`, metadata.trace_id));
    } else if (metadata.session_id) {
      const blockedInfo: BlockedTicketInfo = {
        ticket,
        sessionId: metadata.session_id,
        traceId: metadata.trace_id,
        question: metadata.blocked_question || "",
        blockedAt,
      };
      resumeBlockedRun(blockedInfo, response, config, client, agents, notifChannel, slackClient)
        .catch((err) => log("quick-poll.error", `Resume: ${err}`, metadata.trace_id));
    }
    // Si pas de session_id, on laisse pollBlocked gerer le requeue
  }
}

// --- Helpers (importes depuis ./helpers.js) ---
// parseSubAgentResult -> helpers.js

function log(action: string, detail: string, traceId?: string): void {
  sharedLog("response-handler", action, detail, traceId);
}
