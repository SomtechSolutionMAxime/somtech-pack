/**
 * AIMS v5 — Slack Poller
 *
 * Poll les threads Slack actifs pour detecter les messages de l'architecte.
 * Chaque thread est associe a un ticket ServiceDesk via slack_thread_ts.
 */

import type { SlackClient, SlackMessage } from "./slack-client.js";

export interface ActiveThread {
  ticketId: string;
  channel: string;
  threadTs: string;
  lastProcessedTs: string; // ts du dernier message traite
  runStatus: string;
}

export interface NewArchitectMessage {
  ticketId: string;
  channel: string;
  threadTs: string;
  message: SlackMessage;
}

/**
 * Poll tous les threads actifs et retourne les nouveaux messages humains.
 *
 * Pour chaque thread, appelle getThreadReplies avec `oldest` = lastProcessedTs
 * pour ne recuperer que les messages recents. Filtre les messages bot et le
 * parent du thread, ne gardant que les messages humains non traites.
 *
 * Met a jour `lastProcessedTs` in-place pour chaque thread ayant de nouveaux messages.
 */
export async function pollSlackThreads(
  slack: SlackClient,
  threads: ActiveThread[],
  botUserId: string,
): Promise<NewArchitectMessage[]> {
  const newMessages: NewArchitectMessage[] = [];

  for (const thread of threads) {
    const result = await slack.getThreadReplies(
      thread.channel,
      thread.threadTs,
      thread.lastProcessedTs,
    );

    if (!result.ok) continue;

    // Filtrer: seulement les messages humains (pas du bot, pas le parent du thread)
    const humanMessages = result.messages.filter(
      (m) =>
        m.user &&
        m.user !== botUserId &&
        !m.bot_id &&
        m.ts !== thread.threadTs,
    );

    for (const msg of humanMessages) {
      if (msg.ts > thread.lastProcessedTs) {
        newMessages.push({
          ticketId: thread.ticketId,
          channel: thread.channel,
          threadTs: thread.threadTs,
          message: msg,
        });
        thread.lastProcessedTs = msg.ts;
      }
    }
  }

  return newMessages;
}
