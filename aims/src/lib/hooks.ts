/**
 * AIMS v4.1 — Hooks SDK
 *
 * PRINCIPE : L'humain doit voir TOUT ce qui se passe.
 * Chaque hook qui observe une action significative DOIT la journaliser
 * dans le ticket ServiceDesk via un commentaire dual-view.
 *
 * v4.1 : Signature HookCallback corrigee — 3 arguments :
 *   (input, toolUseID, { signal }) => Promise<HookOutput>
 *
 * Ref: docs/CLAUDE_AGENT_SDK_REFERENCE.md
 */

import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import type { StructuredLog, AgentId } from "./types.js";
import { ServiceDeskClient } from "./servicedesk-client.js";
import { commentSubAgentStarted, commentSubAgentCompleted, commentProgress } from "./dual-view.js";

// --- Circuit Breaker ---

let consecutiveFailures = 0;
let lastFailureTime: number | null = null;
const MAX_FAILURES = 5;
const COOLDOWN_MS = 300_000; // 5 min

export function isCircuitOpen(): boolean {
  if (consecutiveFailures < MAX_FAILURES) return false;
  if (!lastFailureTime) return false;
  if (Date.now() - lastFailureTime > COOLDOWN_MS) {
    consecutiveFailures = 0;
    return false;
  }
  return true;
}

export function recordFailure(): void {
  consecutiveFailures++;
  lastFailureTime = Date.now();
}

export function recordSuccess(): void {
  consecutiveFailures = 0;
  lastFailureTime = null;
}

// --- Hook : Audit Loi 25 (PostToolUse) ---

/**
 * Log chaque action outil dans l'audit trail ServiceDesk.
 * Aussi accumule les tools utilises pour le rapport de progression.
 */
export function createAuditHook(
  servicedeskClient: ServiceDeskClient,
  agentId: AgentId,
  getTraceId: () => string,
  toolsAccumulator: string[],
  applicationId?: string,
): HookCallback {
  return async (input, toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;
    const toolName = hookInput.tool_name as string || "unknown";

    // Accumuler les outils utilises
    if (!toolsAccumulator.includes(toolName)) {
      toolsAccumulator.push(toolName);
    }

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      trace_id: getTraceId(),
      agent_id: agentId,
      action: `tool.${toolName}`,
      detail: `PostToolUse: ${toolName}`,
      meta: {
        hook_event: hookInput.hook_event_name,
        session_id: hookInput.session_id,
        tool_use_id: toolUseID,
      },
    };

    // Log local
    console.log(JSON.stringify(log));

    // Audit trail : log structure JSON (postAuditLog supprime en v4.1)
    // L'audit persiste via les logs du conteneur (collectes par le runtime)

    return {};
  };
}

// --- Hook : Sub-agent demarre (SubagentStart) ---

/**
 * Poste un commentaire dual-view quand un sub-agent demarre.
 * L'humain voit quel agent est lance et pourquoi.
 */
export function createSubAgentStartHook(
  servicedeskClient: ServiceDeskClient,
  agentId: AgentId,
  getTicketId: () => string,
  getTraceId: () => string,
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;
    const subAgentId = hookInput.agent_id as string || "unknown";
    const subAgentType = hookInput.agent_type as string || subAgentId;

    const comment = commentSubAgentStarted(
      getTraceId(),
      agentId,
      subAgentType,
      `Execution en cours...`,
    );

    // Poster dans le ticket ServiceDesk
    await servicedeskClient.postComment(
      getTicketId(),
      comment,
    ).catch((err) => console.error("[hook:SubagentStart] postComment failed:", err));

    return {};
  };
}

// --- Hook : Sub-agent termine (SubagentStop) ---

/**
 * Poste un commentaire dual-view quand un sub-agent termine.
 * L'humain voit le resultat, les fichiers modifies, la branche.
 */
export function createSubAgentStopHook(
  servicedeskClient: ServiceDeskClient,
  agentId: AgentId,
  getTicketId: () => string,
  getTraceId: () => string,
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;
    const subAgentId = hookInput.agent_id as string || "unknown";
    const subAgentType = hookInput.agent_type as string || subAgentId;
    const transcriptPath = hookInput.agent_transcript_path as string || "";

    const comment = commentSubAgentCompleted(
      getTraceId(),
      agentId,
      subAgentType,
      `Execution terminee, passage a la validation.`,
    );

    await servicedeskClient.postComment(
      getTicketId(),
      comment,
    ).catch((err) => console.error("[hook:SubagentStop] postComment failed:", err));

    // Log structure
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      trace_id: getTraceId(),
      event: "subagent_stop",
      agent_id: subAgentId,
      agent_type: subAgentType,
      transcript_path: transcriptPath,
    }));

    return {};
  };
}

// --- Hook : Notification core-comm (Notification) ---

/**
 * Forward les notifications SDK vers core-comm (Slack).
 */
export function createNotificationHook(
  coreCommUrl: string,
  notifChannel: string,
  getTicketId: () => string,
  getTraceId: () => string,
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;
    const message = hookInput.message as string || "Agent status update";

    try {
      await fetch(`${coreCommUrl}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: notifChannel,
          message: `*AIMS*\n*Ticket:* ${getTicketId()}\n*Trace:* \`${getTraceId()}\`\n\n${message}`,
        }),
      });
    } catch {
      // Silencieux — ne pas bloquer l'agent
    }

    return {};
  };
}

// --- Hook : Protection fichiers sensibles (PreToolUse) ---

/**
 * Empeche la modification de fichiers sensibles.
 * Log le blocage dans le ticket pour que l'humain voie.
 */
export function createFileProtectionHook(
  protectedPatterns: string[],
  servicedeskClient: ServiceDeskClient,
  getTicketId: () => string,
  getTraceId: () => string,
  agentId: AgentId,
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;

    const toolInput = hookInput.tool_input as Record<string, unknown> | undefined;
    const filePath = toolInput?.file_path as string || "";

    for (const pattern of protectedPatterns) {
      if (filePath.includes(pattern)) {
        // Log le blocage dans le ticket
        const comment = commentProgress(
          getTraceId(),
          agentId,
          `**Fichier protege** — Tentative de modification bloquee : \`${filePath}\`\n` +
          `_Pattern protege : \`${pattern}\`_`,
        );

        await servicedeskClient.postComment(
          getTicketId(),
          comment,
        ).catch(() => {});

        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `Fichier protege: ${pattern}`,
          },
        };
      }
    }

    return {};
  };
}

// --- Hook : Progression periodique (PostToolUse) ---

/**
 * Poste un commentaire de progression toutes les N utilisations d'outils.
 * Permet a l'humain de voir que l'agent travaille et ce qu'il fait.
 */
export function createProgressHook(
  servicedeskClient: ServiceDeskClient,
  agentId: AgentId,
  getTicketId: () => string,
  getTraceId: () => string,
  intervalToolCalls: number = 10,
): HookCallback {
  let toolCallCount = 0;
  const toolsSeen: string[] = [];

  return async (input, _toolUseID, { signal }) => {
    const hookInput = input as Record<string, unknown>;
    const toolName = hookInput.tool_name as string || "unknown";

    toolCallCount++;
    if (!toolsSeen.includes(toolName)) toolsSeen.push(toolName);

    // Poster un commentaire de progression tous les N appels
    if (toolCallCount % intervalToolCalls === 0) {
      const comment = commentProgress(
        getTraceId(),
        agentId,
        `**Progression** — ${toolCallCount} operations effectuees`,
        [...toolsSeen],
      );

      await servicedeskClient.postComment(
        getTicketId(),
        comment,
      ).catch(() => {});

      // Reset les outils vus pour le prochain batch
      toolsSeen.length = 0;
    }

    return {};
  };
}
