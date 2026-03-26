/**
 * AIMS v4.1 — Proof of Work
 *
 * Orchestre la validation qualite apres l'execution d'un sub-agent.
 * Utilise sub-agent-qa pour verifier build, tests, lint, types.
 *
 * v4.1 : Capture session_id via message.type === "result",
 *         ajout de security_gate dans le PoW.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { ProofOfWorkResult } from "./types.js";

/**
 * Construit le prompt de Proof of Work.
 * v4.1 : inclut la verification de securite (security_gate).
 */
export function buildPoWPrompt(branch: string): string {
  return `Tu es le sub-agent QA. Execute le Proof of Work sur la branche \`${branch}\`.

Verifie :
1. \`npm run build\` (ou equivalent)
2. \`npm test\`
3. \`npm run lint\`
4. \`npx tsc --noEmit\`
5. Verification securite basique : pas de secrets exposes, pas de .env commites

Retourne UNIQUEMENT un JSON :
\`\`\`json
{
  "status": "PASS|FAIL",
  "checks": { "build": true, "tests": true, "lint": true, "types": true, "security": true },
  "errors": [],
  "summary": "Resultat du PoW"
}
\`\`\``;
}

/**
 * Execute le Proof of Work via un query() dedie.
 * v4.1 : session_id capture correctement, security_gate dans le parsing.
 */
export async function executeProofOfWork(
  branch: string,
  qaAgentDef: AgentDefinition,
): Promise<{ raw: string; parsed: ProofOfWorkResult | null; sessionId?: string }> {
  let powRaw = "";
  let sessionId: string | undefined;

  for await (const message of query({
    prompt: buildPoWPrompt(branch),
    options: {
      allowedTools: ["Bash", "Read"],
      agents: { "sub-agent-qa": qaAgentDef },
      permissionMode: "acceptEdits",
    },
  })) {
    if (message.type === "result") {
      sessionId = message.session_id;
      if (message.subtype === "success") {
        powRaw = message.result;
      }
    }
  }

  return {
    raw: powRaw,
    parsed: parsePoWResult(powRaw),
    sessionId,
  };
}

/**
 * Parse le resultat JSON du PoW.
 * v4.1 : inclut security_gate dans le parsing.
 */
export function parsePoWResult(result: string): ProofOfWorkResult | null {
  try {
    const jsonMatch = result.match(/\{[\s\S]*"checks"[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ci_green: parsed.checks?.build ?? null,
      tests_pass: parsed.checks?.tests ?? null,
      security_gate: parsed.checks?.security ?? null, // v4.1 : etait toujours null en v4
      lint_clean: parsed.checks?.lint ?? null,
      type_check: parsed.checks?.types ?? null,
      custom_checks: {},
      all_passed: parsed.status === "PASS",
      checked_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
