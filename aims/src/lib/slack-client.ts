/**
 * AIMS v5 — Slack Web API Client (direct)
 *
 * Client Slack minimal utilisant fetch() directement (pas de SDK).
 * Remplace le passage par core-comm pour les notifications.
 *
 * Toutes les methodes sont resilientes : pas de throw, logs prefixes [slack].
 */

// --- Interfaces ---

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  url_private_download: string;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  bot_id?: string;
  files?: SlackFile[];
}

/** @deprecated Use SlackMessage instead */
export type SlackThreadReply = SlackMessage;

export interface SlackClient {
  postMessage(channel: string, text: string, blocks?: any[]): Promise<{ ok: boolean; ts?: string; error?: string }>;
  postThreadReply(channel: string, threadTs: string, text: string, blocks?: any[]): Promise<{ ok: boolean; ts?: string; error?: string }>;
  getThreadReplies(channel: string, threadTs: string, oldest?: string): Promise<{ ok: boolean; messages: SlackMessage[]; error?: string }>;
  downloadFile(fileUrl: string): Promise<{ ok: boolean; buffer?: Buffer; error?: string }>;
  authTest(): Promise<{ ok: boolean; bot_id?: string; error?: string }>;
  addReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
  resolveChannelId(channelName: string): Promise<string | null>;
}

// --- Implementation ---

const SLACK_API = "https://slack.com/api";

async function slackGet(
  token: string,
  method: string,
  params: URLSearchParams,
): Promise<any> {
  try {
    const resp = await fetch(`${SLACK_API}/${method}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(`[slack] ${method} HTTP ${resp.status}: ${text.slice(0, 200)}`);
      return { ok: false, error: `http_${resp.status}` };
    }

    return await resp.json();
  } catch (err) {
    console.error(`[slack] ${method} fetch error:`, err);
    return { ok: false, error: String(err) };
  }
}

async function slackFetch(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<any> {
  try {
    const resp = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(`[slack] ${method} HTTP ${resp.status}: ${text.slice(0, 200)}`);
      return { ok: false, error: `http_${resp.status}` };
    }

    return await resp.json();
  } catch (err) {
    console.error(`[slack] ${method} fetch error:`, err);
    return { ok: false, error: String(err) };
  }
}

// --- Channel ID cache ---

const channelIdCache = new Map<string, string>();

// --- Factory ---

export function createSlackClient(token: string): SlackClient {
  return {
    async postMessage(
      channel: string,
      text: string,
      blocks?: any[],
    ): Promise<{ ok: boolean; ts?: string; error?: string }> {
      const payload: Record<string, unknown> = { channel, text };
      if (blocks && blocks.length > 0) {
        payload.blocks = blocks;
      }

      const data = await slackFetch(token, "chat.postMessage", payload);

      if (!data.ok) {
        console.error(`[slack] postMessage failed: ${data.error}`);
        return { ok: false, error: data.error };
      }

      // Cache channel name → ID mapping from the response
      if (data.channel) {
        const name = channel.replace(/^#/, "");
        if (name !== data.channel) {
          channelIdCache.set(name, data.channel);
          console.log(`[slack] Cached channel mapping: ${name} → ${data.channel}`);
        }
      }

      return { ok: true, ts: data.ts };
    },

    async postThreadReply(
      channel: string,
      threadTs: string,
      text: string,
      blocks?: any[],
    ): Promise<{ ok: boolean; ts?: string; error?: string }> {
      const payload: Record<string, unknown> = { channel, text, thread_ts: threadTs };
      if (blocks && blocks.length > 0) {
        payload.blocks = blocks;
      }
      const data = await slackFetch(token, "chat.postMessage", payload);

      if (!data.ok) {
        console.error(`[slack] postThreadReply failed: ${data.error}`);
        return { ok: false, error: data.error };
      }

      // Cache channel name → ID mapping from the response
      if (data.channel) {
        const name = channel.replace(/^#/, "");
        if (name !== data.channel) {
          channelIdCache.set(name, data.channel);
        }
      }

      return { ok: true, ts: data.ts };
    },

    async getThreadReplies(
      channel: string,
      threadTs: string,
      oldest?: string,
    ): Promise<{ ok: boolean; messages: SlackMessage[]; error?: string }> {
      // conversations.replies requires GET with query params (not POST JSON)
      const qs = new URLSearchParams({
        channel,
        ts: threadTs,
        limit: "100",
      });
      if (oldest) {
        qs.set("oldest", oldest);
      }

      const data = await slackGet(token, "conversations.replies", qs);

      if (!data.ok) {
        console.error(`[slack] getThreadReplies failed: ${data.error}`);
        return { ok: false, messages: [], error: data.error };
      }

      const rawMessages: any[] = data.messages || [];

      // Return all messages mapped to SlackMessage
      // (filtering is the caller's responsibility — e.g. slack-poller filters human-only)
      const messages: SlackMessage[] = rawMessages.map((m) => ({
        ts: m.ts,
        user: m.user,
        text: m.text || "",
        bot_id: m.bot_id,
        files: m.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimetype: f.mimetype,
          size: f.size,
          url_private_download: f.url_private_download,
        })),
      }));

      return { ok: true, messages };
    },

    async authTest(): Promise<{ ok: boolean; bot_id?: string; error?: string }> {
      const data = await slackFetch(token, "auth.test", {});

      if (!data.ok) {
        console.error(`[slack] authTest failed: ${data.error}`);
        return { ok: false, error: data.error };
      }

      return { ok: true, bot_id: data.bot_id ?? data.user_id };
    },

    async addReaction(
      channel: string,
      timestamp: string,
      emoji: string,
    ): Promise<void> {
      const data = await slackFetch(token, "reactions.add", {
        channel,
        timestamp,
        name: emoji,
      });

      // Silently ignore errors (e.g. already_reacted)
      if (!data.ok && data.error !== "already_reacted") {
        console.error(`[slack] addReaction failed: ${data.error}`);
      }
    },

    async resolveChannelId(channelName: string): Promise<string | null> {
      // Strip leading # if present
      const name = channelName.replace(/^#/, "");

      // If it already looks like a channel ID (starts with C/G and is alphanumeric), return as-is
      if (/^[CG][A-Z0-9]+$/.test(name)) return name;

      // Check cache first (populated by postMessage/postThreadReply responses)
      const cached = channelIdCache.get(name);
      if (cached) return cached;

      // Fallback: send a temporary postMessage to resolve the channel ID
      // chat.postMessage accepts #name and returns the real channel ID
      // The message is deleted immediately after to stay invisible
      console.log(`[slack] resolveChannelId: cache miss for "${name}" — sending probe`);
      const probeData = await slackFetch(token, "chat.postMessage", {
        channel: `#${name}`,
        text: `_resolving channel..._`,
      });

      if (probeData.ok && probeData.channel) {
        channelIdCache.set(name, probeData.channel);
        console.log(`[slack] resolveChannelId: resolved ${name} → ${probeData.channel}`);
        // Delete the probe message immediately
        await slackFetch(token, "chat.delete", {
          channel: probeData.channel,
          ts: probeData.ts,
        });
        return probeData.channel;
      }

      console.error(`[slack] resolveChannelId: could not resolve "${name}" — ${probeData.error}`);
      return null;
    },

    async downloadFile(fileUrl: string): Promise<{ ok: boolean; buffer?: Buffer; error?: string }> {
      try {
        const resp = await fetch(fileUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          console.error(`[slack] downloadFile HTTP ${resp.status}`);
          return { ok: false, error: `http_${resp.status}` };
        }
        const arrayBuffer = await resp.arrayBuffer();
        return { ok: true, buffer: Buffer.from(arrayBuffer) };
      } catch (err) {
        console.error(`[slack] downloadFile error:`, err);
        return { ok: false, error: String(err) };
      }
    },
  };
}
