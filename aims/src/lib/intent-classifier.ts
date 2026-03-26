/**
 * AIMS v5 — Intent Classifier
 *
 * Utilise Claude pour interpreter les messages de l'architecte
 * dans le contexte conversationnel du thread Slack.
 *
 * Utilise @anthropic-ai/sdk directement (pas le Agent SDK).
 */

import Anthropic from "@anthropic-ai/sdk";

export type ArchitectIntent =
  | "approve"
  | "question"
  | "reject"
  | "directive"
  | "ambiguous";

export interface IntentResult {
  intent: ArchitectIntent;
  confidence: number;
  summary: string; // resume pour le log
}

function buildPrompt(
  message: string,
  runStatus: string,
  lastAction: string,
  conversationHistory?: string[],
  planSummary?: string,
): string {
  let prompt = `Tu es l'orchestrator AIMS. L'architecte vient de poster un message dans le thread Slack d'un ticket.

Contexte du ticket :
- Status actuel : ${runStatus}
- Derniere action : ${lastAction}
`;

  if (conversationHistory?.length) {
    prompt += `\nMessages precedents dans ce thread :\n`;
    for (const msg of conversationHistory.slice(-5)) {
      prompt += `- ${msg}\n`;
    }
  }

  if (planSummary) {
    prompt += `\nPlan presente a l'architecte :\n${planSummary}\n`;
  }

  prompt += `
Message de l'architecte :
"${message}"

Determine l'intention :
- "approve" : l'architecte valide/approuve (go, ok, valide, lance, on y va, parfait, etc.)
- "question" : l'architecte pose une question ou demande un ajustement
- "reject" : l'architecte rejette/annule (stop, annule, non, arrete, etc.)
- "directive" : l'architecte donne une instruction proactive (change la priorite, ajoute ceci, etc.)
- "ambiguous" : impossible de determiner l'intention

Reponds en JSON :
{"intent": "...", "confidence": 0.0-1.0, "summary": "..."}`;

  return prompt;
}

/**
 * Classifie l'intention d'un message de l'architecte via Claude.
 *
 * Retourne un IntentResult avec l'intention detectee, un score de confiance,
 * et un resume lisible. En cas d'erreur de parsing, retourne 'ambiguous'.
 */
export async function classifyIntent(
  anthropicApiKey: string,
  message: string,
  runStatus: string,
  lastAction: string,
  conversationHistory?: string[],
  planSummary?: string,
): Promise<IntentResult> {
  const client = new Anthropic({ apiKey: anthropicApiKey });
  const prompt = buildPrompt(message, runStatus, lastAction, conversationHistory, planSummary);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  let result: IntentResult;
  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Handle potential markdown code blocks in the response
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const json = JSON.parse(cleaned);
    result = {
      intent: json.intent ?? "ambiguous",
      confidence: json.confidence ?? 0,
      summary: json.summary ?? "",
    };
  } catch {
    result = {
      intent: "ambiguous",
      confidence: 0,
      summary: "Failed to parse intent",
    };
  }

  console.log(JSON.stringify({
    event: "intent_classified",
    intent: result.intent,
    confidence: result.confidence,
    runStatus,
    lastAction,
    hasHistory: !!conversationHistory?.length,
    hasPlan: !!planSummary,
  }));

  return result;
}
