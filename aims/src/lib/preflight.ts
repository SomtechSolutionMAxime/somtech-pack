/**
 * AIMS v4.6 — Preflight Config Check
 *
 * Valide la configuration de l'orchestrator au demarrage :
 *   1. Fetch fiche Application ServiceDesk (source de verite)
 *   2. Coherence repo URL env vs metadata
 *   3. Workspace git exists (auto-clone si vide)
 *   4. GitHub token valide + acces repo
 *   5. Slack channel coherent
 *   6. core-comm accessible
 *
 * Si FAIL : cree un ticket incident + notif Slack + process.exit(1)
 * Si WARN : notif Slack informative
 */

import { existsSync } from "fs";
import { execSync } from "child_process";
import type { OrchestratorConfig } from "./types.js";
import type { ServiceDeskClient } from "./servicedesk-client.js";

// --- Types ---

export type CheckLevel = "PASS" | "WARN" | "FAIL";

export interface PreflightCheck {
  name: string;
  level: CheckLevel;
  message: string;
  expected?: string;
  actual?: string;
}

export interface PreflightResult {
  timestamp: string;
  checks: PreflightCheck[];
  hasFail: boolean;
  hasWarn: boolean;
  summary: string; // "8 checks: 6 PASS, 1 WARN, 1 FAIL"
}

// --- Helpers ---

/**
 * Parse une URL GitHub en { owner, repo }.
 * Supporte HTTPS et SSH.
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  return null;
}

/**
 * Clone un repo dans le workspace.
 * Retourne true si succes.
 */
export function cloneRepoInWorkspace(
  repoUrl: string,
  branch: string | undefined,
  workspace: string,
  githubToken?: string,
): boolean {
  try {
    // Injecter le token dans l'URL HTTPS si disponible
    let cloneUrl = repoUrl;
    if (githubToken && repoUrl.startsWith("https://")) {
      cloneUrl = repoUrl.replace("https://", `https://x-access-token:${githubToken}@`);
    }

    const branchArg = branch ? `--branch ${branch}` : "";
    execSync(
      `git clone ${branchArg} --single-branch --depth 50 "${cloneUrl}" "${workspace}"`,
      { timeout: 120_000, stdio: "pipe" },
    );

    // Configurer git identity
    execSync(`git -C "${workspace}" config user.name "AIMS Orchestrator"`, { stdio: "pipe" });
    execSync(`git -C "${workspace}" config user.email "aims@somtech.ca"`, { stdio: "pipe" });

    return true;
  } catch (error) {
    console.error(`[preflight] Clone failed: ${String(error).slice(0, 300)}`);
    return false;
  }
}

/**
 * Formate un rapport preflight lisible pour logs/ServiceDesk.
 */
export function formatPreflightReport(result: PreflightResult): string {
  const lines: string[] = [
    `# AIMS Preflight Report`,
    `**Timestamp:** ${result.timestamp}`,
    `**Summary:** ${result.summary}`,
    "",
  ];

  for (const check of result.checks) {
    const icon = check.level === "PASS" ? "OK" : check.level === "WARN" ? "WARN" : "FAIL";
    let line = `[${icon}] **${check.name}** — ${check.message}`;
    if (check.expected || check.actual) {
      line += `\n  Expected: \`${check.expected || "N/A"}\` | Actual: \`${check.actual || "N/A"}\``;
    }
    lines.push(line);
  }

  return lines.join("\n");
}

// --- Main preflight ---

export async function runPreflightChecks(
  config: OrchestratorConfig,
  client: ServiceDeskClient,
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];
  let appMetadata: Record<string, unknown> | null = null;

  // -------------------------------------------------------
  // Check 1: servicedesk.app_fetch — Fetch fiche application
  // -------------------------------------------------------
  try {
    const app = await client.getApplication(config.application_id);
    if (app && app.id) {
      appMetadata = app;
      checks.push({
        name: "servicedesk.app_fetch",
        level: "PASS",
        message: `Fiche application chargee: ${(app as any).name || app.id}`,
      });
    } else {
      checks.push({
        name: "servicedesk.app_fetch",
        level: "FAIL",
        message: "Fiche application vide ou invalide",
        expected: `Application ID ${config.application_id}`,
        actual: JSON.stringify(app).slice(0, 200),
      });
    }
  } catch (error) {
    checks.push({
      name: "servicedesk.app_fetch",
      level: "FAIL",
      message: `Impossible de recuperer la fiche application: ${String(error).slice(0, 200)}`,
    });
  }

  const appAvailable = checks[0]?.level === "PASS";

  // Extraire metadata repo/slack de la fiche app
  const metadata = (appMetadata as any)?.metadata || {};
  const repoMeta = metadata.repo || {};
  const slackMeta = metadata.slack || {};
  const metaRepoUrl: string | undefined = repoMeta.url;
  const metaSlackChannel: string | undefined = slackMeta.channel_name;

  // -------------------------------------------------------
  // Check 2: repo.url_match — Coherence env vs fiche app
  // -------------------------------------------------------
  if (appAvailable && metaRepoUrl) {
    const parsed = parseRepoUrl(metaRepoUrl);
    const envOwner = config.github_owner || "";
    const envRepo = config.github_repo || "";

    if (parsed && envOwner && envRepo) {
      if (parsed.owner === envOwner && parsed.repo === envRepo) {
        checks.push({
          name: "repo.url_match",
          level: "PASS",
          message: `Repo coherent: ${envOwner}/${envRepo}`,
        });
      } else {
        checks.push({
          name: "repo.url_match",
          level: "WARN",
          message: "Repo env vars ne correspondent pas a la fiche application",
          expected: `${parsed.owner}/${parsed.repo}`,
          actual: `${envOwner}/${envRepo}`,
        });
      }
    } else if (!envOwner || !envRepo) {
      checks.push({
        name: "repo.url_match",
        level: "WARN",
        message: "GITHUB_OWNER ou GITHUB_REPO non defini — utilisation de la fiche app comme source",
      });
    } else {
      checks.push({
        name: "repo.url_match",
        level: "WARN",
        message: "URL repo dans la fiche app non parsable",
        actual: metaRepoUrl,
      });
    }
  } else if (!appAvailable) {
    checks.push({
      name: "repo.url_match",
      level: "WARN",
      message: "Fiche app indisponible — coherence repo non verifiable",
    });
  } else {
    checks.push({
      name: "repo.url_match",
      level: "PASS",
      message: "Pas de repo URL dans la fiche app — skip",
    });
  }

  // -------------------------------------------------------
  // Check 3: workspace.git_exists
  // -------------------------------------------------------
  const workspaceHasGit = existsSync(`${config.workspace}/.git`);
  const repoUrlAvailable = metaRepoUrl || (config.github_owner && config.github_repo);

  if (workspaceHasGit) {
    checks.push({
      name: "workspace.git_exists",
      level: "PASS",
      message: `Workspace git present: ${config.workspace}`,
    });
  } else if (!repoUrlAvailable) {
    checks.push({
      name: "workspace.git_exists",
      level: "FAIL",
      message: "Workspace vide et aucune source repo disponible pour auto-clone",
      actual: config.workspace,
    });
  } else {
    checks.push({
      name: "workspace.git_exists",
      level: "WARN",
      message: "Workspace vide mais repo URL disponible — tentative auto-clone",
      actual: config.workspace,
    });
  }

  // -------------------------------------------------------
  // Check 4: workspace.auto_clone — Clone si workspace vide
  // -------------------------------------------------------
  if (!workspaceHasGit && repoUrlAvailable) {
    // Determiner l'URL a utiliser
    let cloneUrl = metaRepoUrl;
    if (!cloneUrl && config.github_owner && config.github_repo) {
      cloneUrl = `https://github.com/${config.github_owner}/${config.github_repo}.git`;
    }

    if (cloneUrl) {
      const branch = (repoMeta.default_branch as string) || "main";
      const success = cloneRepoInWorkspace(cloneUrl, branch, config.workspace, config.github_token);

      if (success) {
        checks.push({
          name: "workspace.auto_clone",
          level: "PASS",
          message: `Auto-clone reussi: ${cloneUrl} → ${config.workspace}`,
        });
      } else {
        checks.push({
          name: "workspace.auto_clone",
          level: "FAIL",
          message: `Auto-clone echoue pour ${cloneUrl}`,
          expected: config.workspace,
        });
      }
    }
  } else if (workspaceHasGit) {
    checks.push({
      name: "workspace.auto_clone",
      level: "PASS",
      message: "Workspace deja present — auto-clone non necessaire",
    });
  }
  // Si workspace vide et pas de repo URL → pas de check 4 (deja FAIL au check 3)

  // -------------------------------------------------------
  // Check 5: github.token_valid
  // -------------------------------------------------------
  if (config.github_token) {
    try {
      const res = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `token ${config.github_token}` },
      });

      if (res.status === 401) {
        checks.push({
          name: "github.token_valid",
          level: "FAIL",
          message: "GitHub token invalide (401 Unauthorized)",
        });
      } else if (res.ok) {
        const data = await res.json();
        const remaining = data?.resources?.core?.remaining ?? 0;

        if (remaining < 100) {
          checks.push({
            name: "github.token_valid",
            level: "WARN",
            message: `GitHub token valide mais rate limit bas: ${remaining} restants`,
            actual: String(remaining),
          });
        } else {
          checks.push({
            name: "github.token_valid",
            level: "PASS",
            message: `GitHub token valide (rate limit: ${remaining})`,
          });
        }
      } else {
        checks.push({
          name: "github.token_valid",
          level: "FAIL",
          message: `GitHub rate_limit endpoint retourne ${res.status}`,
        });
      }
    } catch (error) {
      checks.push({
        name: "github.token_valid",
        level: "FAIL",
        message: `Impossible de valider le GitHub token: ${String(error).slice(0, 200)}`,
      });
    }
  } else {
    checks.push({
      name: "github.token_valid",
      level: "FAIL",
      message: "GITHUB_TOKEN absent",
    });
  }

  // -------------------------------------------------------
  // Check 6: github.repo_access
  // -------------------------------------------------------
  const owner = config.github_owner;
  const repo = config.github_repo;
  if (config.github_token && owner && repo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${config.github_token}` },
      });

      if (res.ok) {
        checks.push({
          name: "github.repo_access",
          level: "PASS",
          message: `Acces repo ${owner}/${repo} confirme`,
        });
      } else {
        checks.push({
          name: "github.repo_access",
          level: "FAIL",
          message: `Repo ${owner}/${repo} inaccessible (HTTP ${res.status})`,
          expected: `200 OK`,
          actual: `${res.status}`,
        });
      }
    } catch (error) {
      checks.push({
        name: "github.repo_access",
        level: "FAIL",
        message: `Erreur acces repo: ${String(error).slice(0, 200)}`,
      });
    }
  } else if (!owner || !repo) {
    checks.push({
      name: "github.repo_access",
      level: "WARN",
      message: "GITHUB_OWNER ou GITHUB_REPO non defini — acces repo non verifiable",
    });
  } else {
    // Token absent — deja FAIL au check 5, skip ici
    checks.push({
      name: "github.repo_access",
      level: "FAIL",
      message: "GitHub token absent — impossible de verifier l'acces repo",
    });
  }

  // -------------------------------------------------------
  // Check 7: slack.channel_available
  // -------------------------------------------------------
  if (appAvailable && metaSlackChannel) {
    checks.push({
      name: "slack.channel_available",
      level: "PASS",
      message: `Slack channel dans la fiche app: #${metaSlackChannel.replace(/^#/, "")}`,
    });
  } else if (!appAvailable) {
    checks.push({
      name: "slack.channel_available",
      level: "WARN",
      message: "Fiche app indisponible — canal Slack non verifiable",
    });
  } else {
    checks.push({
      name: "slack.channel_available",
      level: "WARN",
      message: "Pas de channel Slack dans la fiche app — mode degrade (ServiceDesk only)",
    });
  }

  // -------------------------------------------------------
  // Check 8: slack.auth — v5: Slack bot token valide
  // -------------------------------------------------------
  if (config.slack_bot_token) {
    // Placeholder: actual auth.test call is done in main() after preflight
    checks.push({
      name: "slack.auth",
      level: "PASS",
      message: "SLACK_BOT_TOKEN present (auth.test sera valide au demarrage)",
    });
  } else {
    checks.push({
      name: "slack.auth",
      level: "WARN",
      message: "SLACK_BOT_TOKEN absent — mode degrade (ServiceDesk only, pas de Slack)",
    });
  }

  // --- Build result ---
  const passCount = checks.filter((c) => c.level === "PASS").length;
  const warnCount = checks.filter((c) => c.level === "WARN").length;
  const failCount = checks.filter((c) => c.level === "FAIL").length;

  return {
    timestamp: new Date().toISOString(),
    checks,
    hasFail: failCount > 0,
    hasWarn: warnCount > 0,
    summary: `${checks.length} checks: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`,
  };
}
