/**
 * AIMS v4.1 — Helpers partages
 *
 * Fonctions utilitaires utilisees par orchestrator.ts et response-handler.ts.
 * Centralise pour eviter la duplication de code.
 */

import { execSync } from "child_process";

// --- Deploy Preview (GitHub Deployments API) ---

export interface DeployPreviewResult {
  url: string;
  status: "success" | "failure" | "pending" | "timeout";
  environment: string;
}

/**
 * Poll l'API GitHub Deployments pour recuperer le deploy preview Netlify.
 * Attend jusqu'a maxWaitMs (defaut 8 min) avec un intervalle de pollIntervalMs (30s).
 * Retourne le premier deployment "success" avec une target_url, ou null si timeout.
 */
export async function waitForDeployPreview(
  prUrl: string,
  config: { github_token: string; github_owner: string; github_repo: string },
  maxWaitMs = 8 * 60 * 1000,
  pollIntervalMs = 30_000,
): Promise<DeployPreviewResult | null> {
  // Extraire le PR number
  const prMatch = prUrl.match(/\/pull\/(\d+)/);
  if (!prMatch) return null;
  const prNumber = prMatch[1];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.github_token}`,
  };

  // Recuperer le head SHA du PR
  let sha: string;
  try {
    const prResp = await fetch(
      `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/pulls/${prNumber}`,
      { headers },
    );
    if (!prResp.ok) return null;
    const prData = await prResp.json();
    sha = prData.head?.sha;
    if (!sha) return null;
  } catch {
    return null;
  }

  // Poll les deployments pour ce SHA
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const deplResp = await fetch(
        `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/deployments?sha=${sha}&per_page=10`,
        { headers },
      );
      if (deplResp.ok) {
        const deployments = await deplResp.json();
        for (const depl of deployments) {
          const statusResp = await fetch(
            `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/deployments/${depl.id}/statuses`,
            { headers },
          );
          if (!statusResp.ok) continue;
          const statuses = await statusResp.json();
          if (!statuses.length) continue;

          // Le premier status est le plus recent
          const latest = statuses[0];
          if (latest.state === "success" && latest.target_url) {
            return {
              url: latest.target_url,
              status: "success",
              environment: depl.environment || "",
            };
          }
          if (latest.state === "failure" || latest.state === "error") {
            return {
              url: latest.target_url || "",
              status: "failure",
              environment: depl.environment || "",
            };
          }
        }
      }
    } catch {
      // Silencieux — on retry
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return null;
}

// --- Parsing des resultats sub-agent ---

export interface SubAgentParsedResult {
  branch?: string;
  filesModified?: string[];
  summary: string;
  prUrl?: string;
}

/**
 * Parse le resultat texte d'un sub-agent pour extraire les infos structurees.
 *
 * v4.3 : Extraction amelioree :
 *   - Cherche un JSON avec "status" OU "result" OU "summary"
 *   - Extraction des fichiers modifies depuis les patterns de chemins
 *   - Summary tronque a 1500 chars max (pas au milieu d'un mot)
 *   - Si le resultat est un objet avec .result ou .text, extrait le contenu
 */
export function parseSubAgentResult(result: string): SubAgentParsedResult {
  // Essayer de parser un JSON structure
  try {
    const jsonMatch = result.match(/\{[\s\S]*?"(?:status|result|summary)"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Support nested .result ou .text
      const innerResult = parsed.result || parsed.text || "";
      const rawSummary = parsed.summary || (typeof innerResult === "string" ? innerResult : "") || result;
      return {
        branch: parsed.branch,
        filesModified: parsed.files_modified || extractFilePaths(typeof innerResult === "string" ? innerResult : result),
        summary: truncateSummary(rawSummary, 1500),
        prUrl: parsed.pr_url,
      };
    }
  } catch { /* fallback */ }

  // Fallback : extraire les fichiers depuis le texte brut
  const filesModified = extractFilePaths(result);

  return {
    summary: truncateSummary(result, 1500),
    filesModified: filesModified.length > 0 ? filesModified : undefined,
  };
}

/**
 * Extrait les chemins de fichiers mentionnes dans un texte.
 * Cherche des patterns type src/..., modules/..., supabase/..., etc.
 */
function extractFilePaths(text: string): string[] {
  const filePatterns = text.match(/(?:^|\s|`)((?:src|lib|modules|supabase|tests|orbit|components|pages|app)\/[\w./-]+\.\w{1,10})/gm);
  if (!filePatterns) return [];

  const files = filePatterns
    .map(p => p.trim().replace(/^`|`$/g, ""))
    .filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate

  return files.slice(0, 50); // cap a 50 fichiers
}

/**
 * Tronque un texte a maxLen caracteres sans couper au milieu d'un mot.
 */
function truncateSummary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Trouver le dernier espace avant maxLen
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  const cutPoint = lastSpace > maxLen * 0.8 ? lastSpace : maxLen;
  return truncated.slice(0, cutPoint) + "...";
}

// --- PR Mergeable Check (GitHub REST API) ---

export interface PRMergeableResult {
  mergeable: boolean;
  mergeStateStatus: string; // "clean" | "dirty" | "blocked" | "unknown"
  prNumber: number;
}

/**
 * Verifie si une PR GitHub est mergeable (pas de conflit avec main).
 * Utilise le meme pattern d'auth que waitForDeployPreview.
 * Retourne null si impossible de determiner (erreur reseau, PR introuvable).
 *
 * Note: GitHub peut retourner mergeable=null si pas encore calcule.
 * Dans ce cas, on retry une fois apres 3s.
 */
export async function checkPRMergeable(
  prUrl: string,
  config: { github_token: string; github_owner: string; github_repo: string },
): Promise<PRMergeableResult | null> {
  const prMatch = prUrl.match(/\/pull\/(\d+)/);
  if (!prMatch) return null;
  const prNumber = parseInt(prMatch[1]);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.github_token}`,
  };

  const fetchPR = async (): Promise<any> => {
    const resp = await fetch(
      `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/pulls/${prNumber}`,
      { headers },
    );
    if (!resp.ok) return null;
    return resp.json();
  };

  try {
    let data = await fetchPR();
    if (!data) return null;

    // GitHub peut retourner mergeable=null si pas encore calcule — retry apres 3s
    if (data.mergeable === null) {
      await new Promise((r) => setTimeout(r, 3000));
      data = await fetchPR();
      if (!data) return null;
    }

    return {
      mergeable: data.mergeable === true,
      mergeStateStatus: data.mergeable_state || "unknown",
      prNumber,
    };
  } catch {
    return null;
  }
}

// --- Auto-rebase sur conflit PR ---

export interface RebaseResult {
  success: boolean;
  error?: string;
}

/**
 * Tente un rebase automatique de la branche sur origin/main.
 * Utilise execSync dans le workspace du repo.
 *
 * Flux :
 *   1. git fetch origin
 *   2. git checkout {branch}
 *   3. git rebase origin/main
 *   4. git push --force-with-lease
 *
 * Si le rebase echoue (vrai conflit), on abort et retourne success=false.
 */
export function attemptAutoRebase(
  branch: string,
  workspace: string,
): RebaseResult {
  const opts = { cwd: workspace, encoding: "utf-8" as const, timeout: 60_000 };

  try {
    execSync("git fetch origin", opts);
    execSync(`git checkout ${branch}`, opts);
    execSync("git rebase origin/main", opts);
    execSync("git push --force-with-lease", opts);
    return { success: true };
  } catch (err) {
    // Abort le rebase en cours si echec
    try {
      execSync("git rebase --abort", opts);
    } catch { /* ignore — peut-etre pas en rebase */ }

    return {
      success: false,
      error: String(err).slice(0, 500),
    };
  }
}

// --- Notifications Slack ---
// DEPRECATED v5: core-comm dependency removed. Use sendSlack() in orchestrator.ts directly.
// These functions are kept for backward compatibility but will be removed in a future version.

/**
 * @deprecated v5: Use sendSlack() in orchestrator.ts directly.
 * Envoie une notification a core-comm (passerelle Slack).
 * Silencieux en cas d'erreur — ne jamais bloquer le run pour une notification.
 */
export async function notifySlack(
  _config: any,
  _endpoint: string,
  _payload: Record<string, unknown>,
): Promise<{ ok: boolean; ts?: string } | null> {
  console.warn("[notifySlack] DEPRECATED v5: core-comm notifier removed. Use sendSlack() directly.");
  return null;
}

/**
 * @deprecated v5: Use Slack Web API directly via SlackClient.
 * Upload un fichier sur Slack via core-comm /upload-file.
 */
export async function uploadFileToSlack(
  _config: any,
  _channel: string,
  _filename: string,
  _fileBuffer: Buffer,
  _title?: string,
  _initialComment?: string,
  _threadTs?: string,
): Promise<void> {
  console.warn("[uploadFileToSlack] DEPRECATED v5: core-comm notifier removed.");
}

// --- Logging structure ---

/**
 * Log structure au format JSON pour l'observabilite.
 */
export function log(
  agentLabel: string,
  action: string,
  detail: string,
  traceId?: string,
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    agent_id: agentLabel,
    action,
    detail,
    trace_id: traceId || "",
  }));
}
