/**
 * AIMS v4.3 — Dual-View Comment Builder
 *
 * Commentaires 100% lisibles, format professionnel.
 * Sauts de ligne, bullet points, paragraphes structures.
 *
 * Le suivi machine passe par les vrais champs du ticket
 * (status, assigned_to) via MCP — PAS dans les commentaires.
 */

import type { RunStatus, OrchestratorTrace, ProofOfWorkResult, TokenUsageStats } from "./types.js";

const STATUS_EMOJI: Record<RunStatus, string> = {
  QUEUED: "\u{1F7E1}",
  ANALYZING: "\u{1F9E0}",
  PLANNING: "\u{1F4CB}",
  APPROVED: "\u{2705}",
  BLOCKED: "\u{1F6AB}",
  RUNNING: "\u{1F504}",
  VALIDATING: "\u{1F50D}",
  LANDING: "\u{1F6EC}",
  DONE: "\u2705",
  FAILED: "\u274C",
};

const STATUS_LABEL: Record<RunStatus, string> = {
  QUEUED: "En attente",
  ANALYZING: "Analyse en cours",
  PLANNING: "Plan propose",
  APPROVED: "Plan approuve",
  BLOCKED: "Bloque",
  RUNNING: "En cours",
  VALIDATING: "Validation",
  LANDING: "Livraison",
  DONE: "Termine",
  FAILED: "Echec",
};

const SEPARATOR = "\n\n---\n\n";

// --- Builder principal ---

function heading(status: RunStatus, title: string): string {
  const emoji = STATUS_EMOJI[status] || "\u26AA";
  const label = STATUS_LABEL[status] || status;
  return `${emoji} **${label}** — ${title}`;
}

function section(title: string, content: string): string {
  return `**${title}**\n\n${content}`;
}

function bulletList(items: string[]): string {
  return items.map(item => `- ${item}`).join("\n");
}

function keyValue(pairs: [string, string][]): string {
  return pairs.map(([k, v]) => `- **${k} :** ${v}`).join("\n");
}

// --- Builders specialises ---

/** @deprecated v5: CLAIMED replaced by ANALYZING. Kept for backward compat. */
export function commentClaimed(traceId: string, agentId: string, ticketTitle: string): string {
  return commentAnalyzing(traceId, ticketTitle);
}

/** Commentaire RUNNING apres analyse : classification + choix du sub-agent */
export function commentAnalysisComplete(
  traceId: string,
  _agentId: string,
  trace: OrchestratorTrace,
): string {
  const riskEmoji = trace.classification.risk_level === "high" ? "\u{1F534}" : trace.classification.risk_level === "medium" ? "\u{1F7E0}" : "\u{1F7E2}";
  const securityFlag = trace.security_concern ? "\u{1F512} Oui — attention requise" : "Non";

  const parts: string[] = [
    heading("RUNNING", "Analyse terminee"),
  ];

  // Resume humain
  if (trace.human_summary) {
    parts.push(trace.human_summary);
  }

  // Classification
  parts.push(section("Classification", keyValue([
    ["Type", trace.classification.ticket_type],
    ["Complexite", trace.classification.complexity],
    ["Risque", `${riskEmoji} ${trace.classification.risk_level}`],
    ["Priorite", trace.priority_assessed || "N/A"],
    ["Securite", securityFlag],
    ["Duree estimee", `~${trace.estimated_duration_min} min`],
  ])));

  // Raison du choix
  parts.push(section("Strategie", bulletList([
    `Sub-agent choisi : \`${trace.sub_agent_type}\``,
    `Raison : ${trace.reason}`,
  ])));

  // Fichiers
  if (trace.files_likely_affected.length > 0) {
    parts.push(section(
      `Fichiers probablement affectes (${trace.files_likely_affected.length})`,
      bulletList(trace.files_likely_affected.map(f => `\`${f}\``)),
    ));
  }

  parts.push("_Lancement du sub-agent..._");

  return parts.join(SEPARATOR);
}

/** Commentaire quand un sub-agent demarre */
export function commentSubAgentStarted(
  _traceId: string,
  _agentId: string,
  subAgentType: string,
  taskDescription: string,
): string {
  return [
    heading("RUNNING", `Sub-agent \`${subAgentType}\` demarre`),
    taskDescription,
  ].join(SEPARATOR);
}

/** Commentaire quand un sub-agent termine avec succes */
export function commentSubAgentCompleted(
  _traceId: string,
  _agentId: string,
  subAgentType: string,
  summary: string,
  branch?: string,
  filesModified?: string[],
): string {
  const parts: string[] = [
    heading("RUNNING", `Sub-agent \`${subAgentType}\` termine`),
    summary,
  ];

  const details: [string, string][] = [];
  if (branch) details.push(["Branche", `\`${branch}\``]);
  if (filesModified && filesModified.length > 0) {
    details.push(["Fichiers modifies", `${filesModified.length}`]);
  }
  if (details.length > 0) {
    parts.push(keyValue(details));
  }

  if (filesModified && filesModified.length > 0) {
    parts.push(section(
      "Fichiers modifies",
      bulletList(filesModified.slice(0, 15).map(f => `\`${f}\``))
      + (filesModified.length > 15 ? `\n- _...et ${filesModified.length - 15} autres_` : ""),
    ));
  }

  return parts.join(SEPARATOR);
}

/** Commentaire quand un sub-agent echoue */
export function commentSubAgentFailed(
  _traceId: string,
  _agentId: string,
  subAgentType: string,
  error: string,
): string {
  return [
    heading("RUNNING", `Sub-agent \`${subAgentType}\` echoue`),
    section("Erreur", `\`\`\`\n${error.slice(0, 500)}\n\`\`\``),
  ].join(SEPARATOR);
}

/** Commentaire VALIDATING : debut du Proof of Work */
export function commentValidatingStarted(_traceId: string, _agentId: string): string {
  return [
    heading("VALIDATING", "Proof of Work en cours"),
    section("Verifications", bulletList([
      "Build CI",
      "Tests unitaires et integration",
      "Analyse de securite",
      "Lint",
      "Verification de types",
    ])),
  ].join(SEPARATOR);
}

/** Commentaire VALIDATING : resultat du Proof of Work */
export function commentValidatingResult(
  _traceId: string,
  _agentId: string,
  pow: ProofOfWorkResult,
): string {
  const icon = (val: boolean | null) => val === true ? "\u2705" : val === false ? "\u274C" : "\u23ED\uFE0F";
  const status: RunStatus = pow.all_passed ? "VALIDATING" : "FAILED";

  const checks: string[] = [
    `${icon(pow.ci_green)} Build CI`,
    `${icon(pow.tests_pass)} Tests`,
    `${icon(pow.security_gate)} Securite`,
    `${icon(pow.lint_clean)} Lint`,
    `${icon(pow.type_check)} Types`,
    ...Object.entries(pow.custom_checks).map(([k, v]) => `${icon(v)} ${k}`),
  ];

  return [
    heading(status, pow.all_passed ? "Proof of Work reussi" : "Proof of Work echoue"),
    section("Resultats", bulletList(checks)),
  ].join(SEPARATOR);
}

/** Commentaire LANDING : strategie de landing */
export function commentLanding(
  _traceId: string,
  _agentId: string,
  strategy: string,
  prUrl?: string,
  branch?: string,
): string {
  const details: [string, string][] = [
    ["Strategie", strategy],
  ];
  if (branch) details.push(["Branche", `\`${branch}\``]);
  if (prUrl) details.push(["Pull Request", `[Voir la PR](${prUrl})`]);

  const parts: string[] = [
    heading("LANDING", "Livraison en cours"),
    keyValue(details),
  ];

  if (strategy === "human-gate") {
    parts.push("\u23F3 _En attente d'approbation humaine pour le merge._");
  } else {
    parts.push("_Merge automatique en cours..._");
  }

  return parts.join(SEPARATOR);
}

/** Commentaire DONE : recapitulatif final */
export function commentDone(
  traceId: string,
  _agentId: string,
  summary: string,
  branch?: string,
  filesModified?: string[],
  prUrl?: string,
  pow?: ProofOfWorkResult,
  durationMs?: number,
): string {
  const duration = durationMs ? `${Math.round(durationMs / 1000)}s` : "N/A";
  const fileCount = filesModified?.length || 0;

  const parts: string[] = [
    heading("DONE", "Run termine avec succes"),
    summary,
  ];

  // Metriques
  const metrics: [string, string][] = [
    ["Duree", duration],
    ["Fichiers modifies", `${fileCount}`],
    ["Trace", `\`${traceId}\``],
  ];
  if (branch) metrics.push(["Branche", `\`${branch}\``]);
  if (prUrl) metrics.push(["Pull Request", `[Voir la PR](${prUrl})`]);
  parts.push(section("Metriques", keyValue(metrics)));

  // Fichiers
  if (filesModified && filesModified.length > 0) {
    parts.push(section(
      `Fichiers modifies (${fileCount})`,
      bulletList(filesModified.slice(0, 20).map(f => `\`${f}\``))
      + (fileCount > 20 ? `\n- _...et ${fileCount - 20} autres_` : ""),
    ));
  }

  // Checklist de verification
  parts.push(section("Verification suggeree", bulletList([
    "Verifier les fichiers modifies",
    "Valider le build et les tests",
    "Reviewer la PR si applicable",
    "Tester manuellement les changements critiques",
  ])));

  return parts.join(SEPARATOR);
}

/** Commentaire BLOCKED : question pour l'humain */
export function commentBlocked(
  traceId: string,
  _agentId: string,
  question: string,
  _sessionId?: string,
): string {
  return [
    heading("BLOCKED", "Action humaine requise"),
    section("Question", `> ${question}`),
    keyValue([
      ["Trace", `\`${traceId}\``],
    ]),
    "_Repondez dans le ticket ou sur Slack pour debloquer le run._",
  ].join(SEPARATOR);
}

/** Commentaire FAILED : erreur */
export function commentFailed(
  traceId: string,
  _agentId: string,
  error: string,
  retryCount: number,
  maxRetries: number,
  _sessionId?: string,
): string {
  // Determiner la cause probable et l'action recommandee
  let cause: string;
  let action: string;

  if (error.includes("parse") || error.includes("orchestrator_trace")) {
    cause = "L'analyse n'a pas retourne un JSON valide.";
    action = "Verifier le format du ticket (titre et description).";
  } else if (error.includes("timeout") || error.includes("TIMEOUT")) {
    cause = "Depassement du delai d'execution.";
    action = "Reduire la complexite du ticket ou augmenter le timeout.";
  } else if (error.includes("permission") || error.includes("denied")) {
    cause = "Permissions insuffisantes (fichier protege ou acces refuse).";
    action = "Verifier les permissions et les fichiers cibles.";
  } else {
    cause = "Erreur inattendue durant l'execution.";
    action = `Consulter les logs du trace \`${traceId}\` pour plus de details.`;
  }

  const parts: string[] = [
    heading("FAILED", "Run echoue"),
    section("Erreur", `\`\`\`\n${error.slice(0, 500)}\n\`\`\``),
    section("Diagnostic", keyValue([
      ["Cause probable", cause],
      ["Action recommandee", action],
    ])),
  ];

  if (retryCount < maxRetries) {
    parts.push(`\u{1F504} _Retry ${retryCount + 1}/${maxRetries} sera tente automatiquement._`);
  } else {
    parts.push(`\u26D4 _Retries epuises (${retryCount}/${maxRetries}). Intervention humaine requise._`);
  }

  return parts.join(SEPARATOR);
}

/** Commentaire de progression intermediaire */
export function commentProgress(
  _traceId: string,
  _agentId: string,
  progressMessage: string,
  toolsUsed?: string[],
): string {
  const parts: string[] = [
    heading("RUNNING", "Progression"),
    progressMessage,
  ];

  if (toolsUsed && toolsUsed.length > 0) {
    parts.push(`_Outils utilises : ${toolsUsed.join(", ")}_`);
  }

  return parts.join(SEPARATOR);
}

/** Commentaire IN_REVIEW : pret pour QA humain */
export function commentReadyForQA(
  traceId: string,
  _agentId: string,
  summary: string,
  branch?: string,
  filesModified?: string[],
  prUrl?: string,
  durationMs?: number,
  deployUrl?: string,
): string {
  const duration = durationMs ? `${Math.round(durationMs / 1000)}s` : "N/A";
  const fileCount = filesModified?.length || 0;

  const parts: string[] = [
    heading("VALIDATING", "Implementation terminee — Pret pour QA"),
    summary,
  ];

  // Metriques
  const metrics: [string, string][] = [
    ["Duree", duration],
    ["Fichiers modifies", `${fileCount}`],
    ["Trace", `\`${traceId}\``],
  ];
  if (branch) metrics.push(["Branche", `\`${branch}\``]);
  if (prUrl) metrics.push(["Pull Request", `[Voir la PR](${prUrl})`]);
  if (deployUrl) metrics.push(["Deploy Preview", `[Voir le preview](${deployUrl})`]);
  parts.push(section("Metriques", keyValue(metrics)));

  // Fichiers
  if (filesModified && filesModified.length > 0) {
    parts.push(section(
      `Fichiers modifies (${fileCount})`,
      bulletList(filesModified.slice(0, 20).map(f => `\`${f}\``))
      + (fileCount > 20 ? `\n- _...et ${fileCount - 20} autres_` : ""),
    ));
  }

  // Instructions pour l'humain
  parts.push(section("Prochaines etapes", bulletList([
    "Reviewer la PR sur GitHub",
    deployUrl
      ? `Tester sur le [deploy preview](${deployUrl})`
      : "Attendre le deploy preview Netlify (pas encore disponible)",
    "Valider le build et les tests",
    "Merger la PR si tout est OK",
    "Repondre dans le ticket ou sur Slack pour signaler un probleme",
  ])));

  parts.push("_En attente de validation humaine. Le ticket sera ferme apres votre approbation._");

  return parts.join(SEPARATOR);
}

/** Commentaire BLOCKED : migration DB detectee, transfert a l'humain */
export function commentMigrationTransfer(
  traceId: string,
  _agentId: string,
  ticketTitle: string,
  trace: OrchestratorTrace,
): string {
  const files = trace.files_likely_affected.length > 0
    ? bulletList(trace.files_likely_affected.map(f => `\`${f}\``))
    : "_(non determines)_";

  return [
    heading("BLOCKED", "Migration DB detectee — Transfert a l'humain"),
    section("Demande", ticketTitle),
    section("Analyse", trace.human_summary || trace.reason),
    section("Classification", keyValue([
      ["Type", trace.classification.ticket_type],
      ["Complexite", trace.classification.complexity],
      ["Risque", trace.classification.risk_level],
      ["Priorite", trace.priority_assessed || "N/A"],
      ["Securite", trace.security_concern ? "Oui" : "Non"],
    ])),
    section("Fichiers concernes", files),
    section("Action requise", bulletList([
      "Les migrations de base de donnees doivent etre executees par un humain",
      "Verifier le schema dans l'ontologie avant toute modification",
      "Creer la migration dans `supabase/migrations/`",
      "Tester avec `supabase db reset`",
      "Pousser en prod via MCP Supabase",
    ])),
    `_Trace : \`${traceId}\`_`,
  ].join(SEPARATOR);
}

/** Commentaire consommation de tokens */
export function commentTokenUsage(
  analysisUsage: TokenUsageStats,
  executionUsage: TokenUsageStats,
): string {
  const total: TokenUsageStats = {
    inputTokens: analysisUsage.inputTokens + executionUsage.inputTokens,
    outputTokens: analysisUsage.outputTokens + executionUsage.outputTokens,
    cacheReadInputTokens: analysisUsage.cacheReadInputTokens + executionUsage.cacheReadInputTokens,
    cacheCreationInputTokens: analysisUsage.cacheCreationInputTokens + executionUsage.cacheCreationInputTokens,
    totalCostUSD: analysisUsage.totalCostUSD + executionUsage.totalCostUSD,
    numTurns: analysisUsage.numTurns + executionUsage.numTurns,
  };

  const fmt = (n: number) => n.toLocaleString("en-US");
  const fmtCost = (n: number) => `$${n.toFixed(4)}`;

  const parts: string[] = [
    "\u{1F4CA} **Consommation** — Tokens utilises",
    section("Resume", keyValue([
      ["Input tokens", fmt(total.inputTokens)],
      ["Output tokens", fmt(total.outputTokens)],
      ["Cache read", fmt(total.cacheReadInputTokens)],
      ["Cache creation", fmt(total.cacheCreationInputTokens)],
      ["Turns", `${total.numTurns}`],
      ["Cout estime", fmtCost(total.totalCostUSD)],
    ])),
    section("Detail par phase", bulletList([
      `**Analyse :** ${fmt(analysisUsage.inputTokens)} in / ${fmt(analysisUsage.outputTokens)} out — ${fmtCost(analysisUsage.totalCostUSD)}`,
      `**Execution :** ${fmt(executionUsage.inputTokens)} in / ${fmt(executionUsage.outputTokens)} out — ${fmtCost(executionUsage.totalCostUSD)}`,
    ])),
  ];

  return parts.join(SEPARATOR);
}

// --- v5 State Templates ---

/** Commentaire ANALYZING : le sub-agent-analyst est en cours */
export function commentAnalyzing(traceId: string, ticketTitle: string): string {
  return [
    heading("ANALYZING", "Analyse en cours"),
    section("Demande", ticketTitle),
    keyValue([
      ["Trace", `\`${traceId}\``],
    ]),
    "_Le sub-agent-analyst lit l'ontologie, la constitution et l'architecture de securite..._",
  ].join(SEPARATOR);
}

/** Commentaire PLANNING : plan d'execution presente a l'architecte */
export function commentPlanning(traceId: string, analysisJson: {
  classification?: string;
  complexity?: string;
  entities?: string[];
  security_concerns?: string[];
  loi25_impact?: string;
  execution_plan?: { steps?: string[]; subagents_needed?: string[]; estimated_risk?: string };
  questions?: string[];
}): string {
  const parts: string[] = [
    heading("PLANNING", "Plan d'execution propose"),
  ];

  // Classification
  const classItems: [string, string][] = [];
  if (analysisJson.classification) classItems.push(["Type", analysisJson.classification]);
  if (analysisJson.complexity) classItems.push(["Complexite", analysisJson.complexity]);
  if (analysisJson.loi25_impact) classItems.push(["Impact Loi 25", analysisJson.loi25_impact]);
  if (classItems.length > 0) {
    parts.push(section("Classification", keyValue(classItems)));
  }

  // Entites touchees
  if (analysisJson.entities && analysisJson.entities.length > 0) {
    parts.push(section("Entites touchees", bulletList(analysisJson.entities)));
  }

  // Risques securite
  if (analysisJson.security_concerns && analysisJson.security_concerns.length > 0) {
    parts.push(section("Risques securite", bulletList(analysisJson.security_concerns)));
  }

  // Plan d'execution
  if (analysisJson.execution_plan) {
    const plan = analysisJson.execution_plan;
    if (plan.steps && plan.steps.length > 0) {
      parts.push(section("Etapes", bulletList(plan.steps.map((s, i) => `${i + 1}. ${s}`))));
    }
    if (plan.subagents_needed && plan.subagents_needed.length > 0) {
      parts.push(section("Sub-agents requis", bulletList(plan.subagents_needed.map(a => `\`${a}\``))));
    }
    if (plan.estimated_risk) {
      const riskEmoji = plan.estimated_risk === "high" ? "\u{1F534}" : plan.estimated_risk === "medium" ? "\u{1F7E0}" : "\u{1F7E2}";
      parts.push(`${riskEmoji} **Risque estime :** ${plan.estimated_risk}`);
    }
  }

  // Questions
  if (analysisJson.questions && analysisJson.questions.length > 0) {
    parts.push(section("Questions", bulletList(analysisJson.questions.map(q => `> ${q}`))));
  }

  parts.push(keyValue([["Trace", `\`${traceId}\``]]));
  parts.push("_En attente de validation de l'architecte..._");

  return parts.join(SEPARATOR);
}

/** Commentaire APPROVED : l'architecte a valide le plan */
export function commentApproved(traceId: string): string {
  return [
    heading("APPROVED", "Plan approuve par l'architecte"),
    keyValue([
      ["Trace", `\`${traceId}\``],
    ]),
    "_Lancement de l'implementation..._",
  ].join(SEPARATOR);
}

// Re-export for backward compat
export function buildComment(status: RunStatus, humanSummary: string): string {
  return [heading(status, ""), humanSummary].join("\n\n");
}
