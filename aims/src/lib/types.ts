/**
 * AIMS v5 — Types partages
 *
 * v5 : Migration vers 1 container orchestrator + 5 subagents SDK-natifs.
 *       Nouveaux etats (ANALYZING, PLANNING, APPROVED), Slack direct,
 *       suppression core-comm, ajout sub-agent-analyst.
 */

import type { AgentDefinition, HookCallback } from "@anthropic-ai/claude-agent-sdk";

// Re-export des types SDK pour usage interne
export type { AgentDefinition, HookCallback };

// --- Identifiants agents ---

export type AgentId =
  | "dev-orchestrator"
  | "sub-agent-analyst"
  | "sub-agent-dev"
  | "sub-agent-qa"
  | "sub-agent-security"
  | "sub-agent-devops";

export const AGENT_IDS: AgentId[] = [
  "dev-orchestrator",
  "sub-agent-analyst",
  "sub-agent-dev",
  "sub-agent-qa",
  "sub-agent-security",
  "sub-agent-devops",
];

// --- Types de taches ---

export type TaskType =
  | "client.request"
  | "dev.implement"
  | "dev.review"
  | "dev.test"
  | "security.audit"
  | "security.validate"
  | "devops.deploy"
  | "devops.monitor"
  | "workflow.run"
  | "workflow.proof_of_work"
  | "workflow.landing"
  | "workflow.response_handler" // v4.1
  | "system.heartbeat"
  | "system.health_check";

// --- Statut de run ---

export type RunStatus =
  | "QUEUED"
  | "ANALYZING"    // v5: sub-agent-analyst en cours
  | "PLANNING"     // v5: analyse presentee a l'architecte
  | "APPROVED"     // v5: architecte a valide le plan
  | "BLOCKED"
  | "RUNNING"
  | "VALIDATING"
  | "LANDING"
  | "DONE"
  | "FAILED";

/** Valid state transitions for RunStatus (v5) */
export const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  QUEUED:     ["ANALYZING"],
  ANALYZING:  ["PLANNING", "FAILED"],
  PLANNING:   ["APPROVED", "BLOCKED", "FAILED"],
  BLOCKED:    ["PLANNING", "RUNNING"],
  APPROVED:   ["RUNNING"],
  RUNNING:    ["BLOCKED", "VALIDATING", "FAILED"],
  VALIDATING: ["LANDING", "RUNNING", "FAILED"],
  LANDING:    ["DONE", "FAILED"],
  DONE:       [],
  FAILED:     [],
};

// --- Statuts de ticket (conformes a l'API Desk reelle) ---

export type TicketStatus =
  | "new"
  | "in_review"
  | "ready_to_deploy"
  | "in_progress"
  | "qa"
  | "completed";

export type TicketType = "incident" | "improvement" | "request";

// --- Ticket ServiceDesk ---

export interface ServiceDeskTicket {
  id: string;
  ticket_id: string;                    // Format "T-YYYYMMDD-NNNN"
  title: string;
  description: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high" | "urgent";
  type: TicketType;
  application_id: string;
  silo_assigned: boolean;
  assigned_to: string | null;
  delivery_id: string | null;
  created_at: string;
  updated_at: string;
  metadata?: TicketMetadata;
  applications?: { id: string; name: string };       // Join retourne par l'API
  ticket_comments?: TicketComment[];                  // Inclus dans GET /:id
  ticket_history?: Array<Record<string, unknown>>;    // Inclus dans GET /:id
}

export interface TicketComment {
  id: string;
  content: string;
  user_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// --- Resultat silo_discover (MCP) ---

export interface SiloDiscoverResult {
  pending_analysis: ServiceDeskTicket[];    // status=new, silo_assigned=true
  pending_review: ServiceDeskTicket[];      // status=in_review, silo_assigned=true
  ready_for_dev: ServiceDeskTicket[];       // status=ready_to_deploy, silo_assigned=true
}

export interface TicketMetadata {
  run_status?: RunStatus;
  run_id?: string;
  trace_id?: string;
  run_claimed_by?: string;
  run_executed_by?: string;
  run_updated_at?: string;
  orchestrator_trace?: OrchestratorTrace;
  session_id?: string;          // SDK session ID pour resume
  blocked_from?: "PLANNING" | "RUNNING";  // v5: etat d'origine du BLOCKED
  blocked_question?: string;    // v4.1 : question qui a cause le BLOCKED
  blocked_at?: string;          // v4.1 : timestamp du BLOCKED
  human_response?: {            // v4.1 : reponse humaine recue
    answer: string;
    source: "slack" | "servicedesk" | "unknown";
    responded_at: string;
  };
  retry_count?: number;
  run_duration_ms?: number;
  [key: string]: unknown;
}

// --- Implementation Run ---

export interface ImplementationRun {
  run_id: string;
  ticket_id: string;
  trace_id: string;
  status: RunStatus;
  claimed_by: string | null;
  executed_by: string | null;
  branch_name: string | null;
  pr_url: string | null;
  proof_of_work: ProofOfWorkResult | null;
  landing_strategy: LandingStrategy;
  orchestrator_trace: OrchestratorTrace | null;
  session_id: string | null;
  retry_count: number;
  max_retries: number;
  events: RunEvent[];
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface RunEvent {
  from: RunStatus;
  to: RunStatus;
  agent_id: string;
  reason: string;
  timestamp: string;
}

// --- Orchestrator Trace ---

export interface OrchestratorTrace {
  analyzed_at: string;
  classification: {
    ticket_type: "feature" | "bugfix" | "refactor" | "migration" | "config" | "docs" | "report";
    complexity: "simple" | "medium" | "complex";
    risk_level: "low" | "medium" | "high";
  };
  execution_mode: "sub-agent" | "worker";
  sub_agent_type: string | null;
  worker_name?: string | null;           // Optionnel — seulement si mode "worker"
  reason: string;
  files_likely_affected: string[];
  estimated_duration_min: number;
  context_hash?: string;                 // Optionnel — genere par l'orchestrator si pertinent
  priority_assessed?: "P1" | "P2" | "P3" | "P4";      // Priorite evaluee par l'orchestrator
  security_concern?: boolean;                           // True si le ticket touche des donnees sensibles ou RLS
  human_summary?: string;                               // Resume lisible pour l'architecte AIMS
  needs_clarification?: boolean;                          // True si le ticket est trop vague pour etre execute
  clarification_question?: string | null;                 // Question a poser au client pour debloquer
}

// --- Proof of Work ---

export interface ProofOfWorkResult {
  ci_green: boolean | null;
  tests_pass: boolean | null;
  security_gate: boolean | null;
  lint_clean: boolean | null;
  type_check: boolean | null;
  custom_checks: Record<string, boolean>;
  all_passed: boolean;
  checked_at: string;
}

// --- Dual-View Agent Context ---

export interface AgentContext {
  run_id: string;
  trace_id: string;
  status: RunStatus;
  agent_id: string;
  executed_by: string | null;
  timestamp: string;
  branch: string | null;
  files_modified: string[];
  diff_summary: { additions: number; deletions: number; files_changed: number } | null;
  ontologie_refs: string[];
  decisions: string[];
  errors_encountered: string[];
  dependencies_remaining: string[];
  resume_context: string;
  proof_of_work: ProofOfWorkResult | null;
  session_id: string | null;
  orchestrator_trace?: OrchestratorTrace; // v4.1 : pour le commentaire d'analyse
}

// --- Landing Strategy ---

export type LandingStrategy = "auto-merge" | "human-gate" | "staged-rollout";

// --- Sub-Agent Config (utilise AgentDefinition du SDK) ---

export interface SubAgentSpec {
  id: string;
  agentFile: string;        // Chemin vers agents/*/agent.md
  description: string;
  tools: string[];
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  timeout_ms: number;
}

// --- Configuration orchestrator ---

export interface OrchestratorConfig {
  agent_id: AgentId;
  application_id: string;
  servicedesk_mcp_url: string;          // URL du serveur MCP : {base}/functions/v1/servicedesk-mcp
  servicedesk_api_key: string;          // MCP API Key (sk_live_...)
  // v5: Slack direct (remplace core_comm_url)
  slack_bot_token: string;
  slack_poll_interval_ms: number;
  poll_interval_ms: number;
  max_concurrent_runs: number;
  max_retries: number;
  workspace: string;
  anthropic_api_key: string;
  github_token: string;
  github_owner: string;
  github_repo: string;
  // @deprecated v5 compat — notif_* still used as guards in response-handler.ts
  notif_enabled?: boolean;
  notif_channel?: string;
  notif_mention?: string;
}

// --- Resultat sub-agent (convention de sortie) ---

export interface DevResult {
  status: "SUCCESS" | "FAILURE";
  branch: string;
  files_modified: string[];
  summary: string;
}

export interface SecurityResult {
  status: "APPROVED" | "REJECTED";
  findings: Array<{
    severity: "low" | "medium" | "high" | "critical";
    file: string;
    description: string;
  }>;
  summary: string;
}

export interface QAResult {
  status: "PASS" | "FAIL";
  checks: {
    build: boolean;
    tests: boolean;
    lint: boolean;
    types: boolean;
    security: boolean; // v4.1
  };
  errors: string[];
  summary: string;
}

export interface DevopsResult {
  status: "SUCCESS" | "FAILURE";
  deployment?: {
    app: string;
    version: string;
    url: string;
  };
  summary: string;
}

// --- Analyst Output (v5) ---

export interface AnalystOutput {
  status: "READY" | "NEEDS_CLARIFICATION";
  classification: "feature" | "bugfix" | "refactor" | "infra";
  complexity: "simple" | "moderate" | "complex";
  entities: string[];
  security_concerns: string[];
  loi25_impact: "none" | "low" | "high";
  execution_plan: {
    steps: string[];
    subagents_needed: string[];
    estimated_risk: "low" | "medium" | "high";
  };
  questions: string[];
}

// --- Token Usage Stats ---

export interface TokenUsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalCostUSD: number;
  numTurns: number;
}

// --- Log structure (Loi 25 compliance) ---

export interface StructuredLog {
  timestamp: string;
  trace_id: string;
  agent_id: AgentId;
  action: string;
  detail: string;
  meta?: Record<string, unknown>;
}
