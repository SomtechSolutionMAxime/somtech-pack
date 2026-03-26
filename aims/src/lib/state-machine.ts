/**
 * AIMS v5 -- State Machine
 *
 * Extracted from orchestrator.ts: state transition functions and
 * processed-ticket tracking (TTL-based dedup cache).
 */

import type { ServiceDeskClient } from "./servicedesk-client.js";
import type { SlackClient } from "./slack-client.js";
import type { OrchestratorConfig } from "./types.js";
import type { ActiveThread } from "./slack-poller.js";
import { commentApproved } from "./dual-view.js";
import { log as sharedLog } from "./helpers.js";

// --- Logging (wrapper around shared helper) ---

function log(action: string, detail: string, traceId?: string): void {
  sharedLog("dev-orchestrator", action, detail, traceId);
}

// --- Processed tickets cache (TTL-based dedup) ---

const processedTickets = new Map<string, number>(); // ticketId -> timestamp
const PROCESSED_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function markProcessed(ticketId: string): void {
  processedTickets.set(ticketId, Date.now());
}

export function isProcessed(ticketId: string): boolean {
  const ts = processedTickets.get(ticketId);
  if (!ts) return false;
  if (Date.now() - ts > PROCESSED_TTL_MS) {
    processedTickets.delete(ticketId);
    return false;
  }
  return true;
}

export function unmarkProcessed(ticketId: string): void {
  processedTickets.delete(ticketId);
}

/**
 * Periodic cleanup of expired entries in the processedTickets map.
 */
export function cleanupProcessedTickets(): void {
  const now = Date.now();
  for (const [id, ts] of processedTickets) {
    if (now - ts > PROCESSED_TTL_MS) {
      processedTickets.delete(id);
    }
  }
}

/**
 * Returns the current size of the processedTickets map (for health checks).
 */
export function processedTicketsSize(): number {
  return processedTickets.size;
}

/**
 * Returns all processed ticket IDs (for graceful shutdown).
 */
export function processedTicketIds(): string[] {
  return Array.from(processedTickets.keys());
}

// --- Transition context ---

export interface TransitionContext {
  config: OrchestratorConfig;
  client: ServiceDeskClient;
  slack: SlackClient | null;
  channel: string;
  activeThreads: Map<string, ActiveThread>;
}

/**
 * Transition a ticket from PLANNING to APPROVED.
 * Does NOT trigger execution -- the caller is responsible for that.
 * Returns the updated thread (if any) so the caller can kick off execution.
 */
export async function transitionToApproved(
  ticketId: string,
  ctx: TransitionContext,
  traceId: string,
): Promise<void> {
  await ctx.client.updateRunStatus(ticketId, "APPROVED", traceId, ctx.config.agent_id);
  await ctx.client.postComment(ticketId, commentApproved(traceId));

  const thread = ctx.activeThreads.get(ticketId);
  if (thread && ctx.slack) {
    thread.runStatus = "APPROVED";
    await ctx.slack.postThreadReply(ctx.channel, thread.threadTs,
      ":white_check_mark: Merci ! Je lance l'implementation.");
  }

  log("workflow.approved", `Ticket ${ticketId} approuve par l'architecte`, traceId);
}

/**
 * Transition a ticket to FAILED state.
 * Cleans up the active thread and unmarks the ticket from processed cache.
 */
export async function transitionToFailed(
  ticketId: string,
  ctx: TransitionContext,
  traceId: string,
  reason: string,
): Promise<void> {
  await ctx.client.updateRunStatus(ticketId, "FAILED", traceId, "dev-orchestrator");

  const thread = ctx.activeThreads.get(ticketId);
  if (thread && ctx.slack) {
    await ctx.slack.postThreadReply(ctx.channel, thread.threadTs,
      `:no_entry_sign: Ticket annule. Raison : ${reason}`);
    ctx.activeThreads.delete(ticketId);
  }

  unmarkProcessed(ticketId);
  log("workflow.failed", `Ticket ${ticketId}: ${reason}`, traceId);
}
