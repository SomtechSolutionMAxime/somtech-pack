/**
 * AIMS v4.1 — Agent Definitions Loader
 *
 * Charge les AgentDefinition depuis les fichiers agents/*.md
 * et les configure pour le Claude Agent SDK.
 *
 * v4.1 : Injection des skills pertinentes dans le prompt de chaque sub-agent.
 * Les skills transversaux sont injectes dans TOUS les sub-agents.
 * Les skills specialises sont injectes selon le role.
 *
 * Mapping agent -> skills :
 *   sub-agent-dev      : transversal/* + dev-workers/* + dev-orchestrator/branch-strategy
 *   sub-agent-security : transversal/* + security-auditor/* + security-validator/*
 *   sub-agent-qa       : transversal/* + dev-workers/test-writing + dev-workers/code-review
 *   sub-agent-devops   : transversal/* + devops-silo/*
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { SubAgentSpec } from "./types.js";

// --- Mapping sub-agent -> skills ---

/**
 * Definit quels repertoires de skills chaque sub-agent recoit.
 * Les transversaux sont automatiquement ajoutes a tous.
 */
const AGENT_SKILL_MAP: Record<string, string[]> = {
  "sub-agent-dev": [
    "dev-workers/code-implementation",
    "dev-workers/test-writing",
    "dev-workers/code-review",
    "dev-workers/pr-workflow",
    "dev-orchestrator/branch-strategy",
  ],
  "sub-agent-security": [
    "security-auditor/vulnerability-scan",
    "security-auditor/compliance-audit",
    "security-validator/pr-security-gate",
  ],
  "sub-agent-qa": [
    "dev-workers/test-writing",
    "dev-workers/code-review",
  ],
  "sub-agent-devops": [
    "devops-silo/deploy-pipeline",
    "devops-silo/infra-monitoring",
    "devops-silo/migration-runner",
  ],
};

/**
 * Skills propres a l'orchestrator.
 * Ces skills sont charges dans les prompts de l'orchestrator lui-meme
 * (analyse, triage, coordination) — PAS dans les sub-agents.
 *
 * Inclut les skills clientele car en v4.1, l'orchestrator gere
 * directement le triage et la communication client (pas de conteneur
 * clientele separe comme en v1/v2).
 */
const ORCHESTRATOR_SKILLS = [
  "dev-orchestrator/task-distribution",
  "dev-orchestrator/sprint-coordination",
  "clientele/ticket-triage",
  "clientele/client-response",
  "clientele/requirement-intake",
];

/**
 * Skills transversaux — charges par TOUS les sub-agents.
 */
const TRANSVERSAL_SKILLS = [
  "transversal/silo-logging",
  "transversal/desk-comm",
  "transversal/error-escalation",
  "transversal/audit-trail",
  "transversal/problem-analysis",
];

// --- Specifications des sub-agents ---

const SUB_AGENT_SPECS: SubAgentSpec[] = [
  {
    id: "sub-agent-dev",
    agentFile: "agents/sub-agent-dev/agent.md",
    description:
      "Implementation de code (feature, bugfix, refactor). " +
      "Utiliser pour toute tache de developpement : creer des branches, " +
      "implementer des changements, commit avec messages conventionnels.",
    tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    timeout_ms: 600_000, // 10 min
  },
  {
    id: "sub-agent-security",
    agentFile: "agents/sub-agent-security/agent.md",
    description:
      "Audit de securite (RLS, guards, vulnerabilites, Loi 25). " +
      "Utiliser pour valider la securite du code : policies RLS, " +
      "injection SQL, XSS, secrets exposes, conformite Loi 25.",
    tools: ["Read", "Grep", "Glob", "Bash"],
    model: "sonnet",
    timeout_ms: 300_000, // 5 min
  },
  {
    id: "sub-agent-qa",
    agentFile: "agents/sub-agent-qa/agent.md",
    description:
      "Validation qualite (build, tests, lint, type-check). " +
      "Utiliser pour le Proof of Work : verifier que le code compile, " +
      "que les tests passent, que le linting est propre.",
    tools: ["Bash", "Read"],
    model: "sonnet",
    timeout_ms: 300_000, // 5 min
  },
  {
    id: "sub-agent-devops",
    agentFile: "agents/sub-agent-devops/agent.md",
    description:
      "Deploiement, infrastructure, migrations DB. " +
      "Utiliser pour les operations d'infrastructure : deploy Fly.io, " +
      "migrations Supabase, gestion des variables d'environnement.",
    tools: ["Bash", "Read", "Write"],
    timeout_ms: 300_000, // 5 min
  },
];

// --- Chargement des skills ---

/**
 * Charge un fichier SKILL.md et retourne son contenu.
 * Retourne null si le fichier n'existe pas.
 */
function loadSkillContent(basePath: string, skillPath: string): string | null {
  const fullPath = resolve(basePath, "skills", skillPath, "SKILL.md");
  if (!existsSync(fullPath)) {
    console.warn(`[agents] Skill introuvable: ${fullPath}`);
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}

/**
 * Charge tous les skills pour un sub-agent donne.
 * Retourne un bloc de texte avec tous les skills concatenes.
 */
function loadSkillsForAgent(basePath: string, agentId: string): string {
  const specializedPaths = AGENT_SKILL_MAP[agentId] || [];
  const allPaths = [...TRANSVERSAL_SKILLS, ...specializedPaths];

  const sections: string[] = [];

  for (const skillPath of allPaths) {
    const content = loadSkillContent(basePath, skillPath);
    if (content) {
      sections.push(
        `\n---\n## SKILL: ${skillPath}\n---\n\n${content}`,
      );
    }
  }

  if (sections.length === 0) return "";

  return `\n\n# === SKILLS CHARGES (${sections.length}) ===\n` +
    `# Les skills suivants definissent tes patterns, conventions et regles operationnelles.\n` +
    `# Tu DOIS les respecter dans ton execution.\n` +
    sections.join("\n");
}

// --- Chargement des agents ---

/**
 * Charge tous les AgentDefinition depuis les fichiers agent.md + skills.
 *
 * v4.1 : Le prompt de chaque agent = agent.md + skills transversaux + skills specialises.
 * Cela permet aux sub-agents natifs SDK d'heriter de toute l'expertise AIMS.
 *
 * @param basePath - Chemin de base du projet (contient agents/ et skills/)
 * @returns Record de AgentDefinition indexe par ID
 */
export function loadAgentDefinitions(
  basePath: string,
  mcpServers?: Array<{ name: string; url: string; apiKey: string }>,
): Record<string, AgentDefinition> {
  // Convertir en format SDK : AgentMcpServerSpec[]
  const sdkMcpServers = mcpServers?.map((s) => ({
    [s.name]: {
      type: "http" as const,
      url: s.url,
      headers: { Authorization: `Bearer ${s.apiKey}` },
    },
  }));
  const agents: Record<string, AgentDefinition> = {};

  for (const spec of SUB_AGENT_SPECS) {
    const agentFilePath = resolve(basePath, spec.agentFile);

    if (!existsSync(agentFilePath)) {
      console.warn(`[agents] Fichier agent introuvable: ${agentFilePath}`);
      continue;
    }

    // Charger le prompt de base de l'agent
    const basePrompt = readFileSync(agentFilePath, "utf-8");

    // Charger les skills pertinentes
    const skillsBlock = loadSkillsForAgent(basePath, spec.id);

    // Combiner : prompt agent + skills
    const fullPrompt = basePrompt + skillsBlock;

    agents[spec.id] = {
      description: spec.description,
      prompt: fullPrompt,
      tools: spec.tools,
      ...(sdkMcpServers ? { mcpServers: sdkMcpServers } : {}),
      ...(spec.model ? { model: spec.model } : {}),
    };

    // Log le chargement
    const skillCount = (skillsBlock.match(/## SKILL:/g) || []).length;
    console.log(`[agents] ${spec.id}: prompt ${basePrompt.length} chars + ${skillCount} skills`);
  }

  return agents;
}

/**
 * Charge les skills propres a l'orchestrator.
 *
 * L'orchestrator n'est pas un sub-agent — il a son propre processus.
 * Cette fonction retourne un bloc de skills (transversaux + orchestrator + clientele)
 * que l'orchestrator injecte dans ses prompts d'analyse et de coordination.
 *
 * @param basePath - Chemin de base du projet (contient skills/)
 * @returns Bloc de texte avec les skills concatenes
 */
export function loadOrchestratorSkills(basePath: string): string {
  const allPaths = [...TRANSVERSAL_SKILLS, ...ORCHESTRATOR_SKILLS];

  const sections: string[] = [];

  for (const skillPath of allPaths) {
    const content = loadSkillContent(basePath, skillPath);
    if (content) {
      sections.push(
        `\n---\n## SKILL: ${skillPath}\n---\n\n${content}`,
      );
    }
  }

  if (sections.length === 0) return "";

  return `\n\n# === SKILLS ORCHESTRATOR (${sections.length}) ===\n` +
    `# Skills de triage, distribution, coordination et communication client.\n` +
    `# Tu DOIS les respecter dans ton analyse et ta coordination.\n` +
    sections.join("\n");
}

/**
 * Retourne les specs des sub-agents (pour reference).
 */
export function getSubAgentSpecs(): SubAgentSpec[] {
  return SUB_AGENT_SPECS;
}

/**
 * Retourne le mapping complet agent -> skills (pour reference/debug).
 * Inclut l'orchestrator et tous les sub-agents.
 */
export function getAgentSkillMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {
    "dev-orchestrator": [...TRANSVERSAL_SKILLS, ...ORCHESTRATOR_SKILLS],
  };

  for (const [agent, specialized] of Object.entries(AGENT_SKILL_MAP)) {
    map[agent] = [...TRANSVERSAL_SKILLS, ...specialized];
  }

  return map;
}
