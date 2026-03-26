/**
 * AIMS v5 — Graceful Shutdown
 *
 * Gere SIGTERM pour drain propre des runs actifs.
 */

import type { ServiceDeskClient } from './servicedesk-client.js';

interface ShutdownContext {
  activeTicketIds: () => string[];
  stopPolling: () => void;
  serviceDeskClient: ServiceDeskClient;
  drainTimeoutMs: number;
}

export function setupGracefulShutdown(ctx: ShutdownContext): void {
  const handler = async (signal: string) => {
    console.log(`[shutdown] ${signal} received, draining...`);
    ctx.stopPolling();

    // Attendre que les runs actifs se terminent
    const start = Date.now();
    while (ctx.activeTicketIds().length > 0 && Date.now() - start < ctx.drainTimeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
    }

    // Re-queue les tickets encore actifs
    const remaining = ctx.activeTicketIds();
    if (remaining.length > 0) {
      console.log(`[shutdown] ${remaining.length} tickets still active, re-queuing...`);
      for (const ticketId of remaining) {
        try {
          await ctx.serviceDeskClient.addComment(
            ticketId,
            'Orchestrator shutdown — ticket re-queued for resume.',
          );
        } catch (err) {
          console.error(`[shutdown] Failed to requeue ${ticketId}:`, err);
        }
      }
    }

    console.log('[shutdown] Clean exit.');
    process.exit(0);
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}
