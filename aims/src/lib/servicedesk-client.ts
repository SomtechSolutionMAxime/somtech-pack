/**
 * AIMS v4.2 — ServiceDesk MCP Client
 *
 * Client JSON-RPC qui communique avec le serveur MCP du ServiceDesk.
 *
 * v4.2 : Correction complete du format d'appel :
 *   - JSON-RPC 2.0 (method: "tools/call", params: { name: "tickets", arguments: {...} })
 *   - Tool unique "tickets" avec parametre "action" (get, list, update, add_comment, silo_discover)
 *   - Mise a jour REELLE du statut ticket (pas juste metadata)
 *   - Suppression du fallback metadata-as-comment
 */

import type {
  ServiceDeskTicket,
  SiloDiscoverResult,
  RunStatus,
  TicketStatus,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

/**
 * Mapping RunStatus AIMS → TicketStatus ServiceDesk.
 * L'orchestrator met a jour le VRAI statut du ticket a chaque transition.
 */
const RUN_STATUS_TO_TICKET_STATUS: Record<RunStatus, TicketStatus | null> = {
  QUEUED: null,              // Pas de changement (deja new ou ready_to_deploy)
  ANALYZING: "in_progress",  // v5: analyse sub-agent-analyst
  PLANNING: "in_progress",   // v5: plan presente a l'architecte
  APPROVED: "in_progress",   // v5: architecte a valide
  RUNNING: "in_progress",   // En cours d'execution
  BLOCKED: "in_review",     // Attente reponse humaine
  VALIDATING: "qa",         // Validation en cours
  LANDING: "qa",            // En attente merge
  DONE: "completed",        // Termine
  FAILED: "in_progress",    // Echec — reste en cours pour retry ou intervention
};

// --- Client principal ---

export class ServiceDeskClient {
  private requestId = 0;
  private directUrl: string;

  constructor(
    private mcpBaseUrl: string,
    private apiKey: string,
  ) {
    // Derive manage-tickets Edge Function URL from MCP URL
    // MCP: https://xxx.supabase.co/functions/v1/servicedesk-mcp
    // Direct: https://xxx.supabase.co/functions/v1/manage-tickets/tickets
    this.directUrl = this.mcpBaseUrl.replace(/servicedesk-mcp$/, "manage-tickets/tickets");
  }

  // ================================================================
  // Core MCP — Appel JSON-RPC 2.0
  // ================================================================

  /**
   * Appelle le tool "tickets" du MCP ServiceDesk via JSON-RPC 2.0.
   *
   * Format :
   *   POST {mcpBaseUrl}
   *   {
   *     "jsonrpc": "2.0",
   *     "id": 1,
   *     "method": "tools/call",
   *     "params": {
   *       "name": "tickets",
   *       "arguments": { "action": "get", "id": "..." }
   *     }
   *   }
   *
   * Retourne le contenu parse depuis result.content[0].text
   */
  private async callTickets(
    action: string,
    args: Record<string, unknown>,
    retries: number = MAX_RETRIES,
  ): Promise<any> {
    this.requestId++;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        const res = await fetch(this.mcpBaseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: this.requestId,
            method: "tools/call",
            params: {
              name: "tickets",
              arguments: { action, ...args },
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status >= 500 && attempt < retries) {
            await sleep(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          const body = await res.text().catch(() => "");
          throw new Error(`MCP tickets/${action} failed: ${res.status} — ${body.slice(0, 300)}`);
        }

        const json = await res.json();

        // JSON-RPC error
        if (json.error) {
          throw new Error(`MCP tickets/${action} error: ${json.error.message || JSON.stringify(json.error)}`);
        }

        // Extraire le contenu depuis result.content[0].text
        const textContent = json.result?.content?.[0]?.text;
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent);
            return parsed;
          } catch {
            return textContent;
          }
        }

        return json.result || json;
      } catch (error) {
        if (attempt === retries) throw error;
        if ((error as any)?.name === "AbortError") {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw error;
      }
    }

    throw new Error(`callTickets: all retries exhausted for tickets/${action}`);
  }

  /**
   * Met a jour les champs AIMS sur un ticket via le MCP proxy.
   * v4.6 : Remplace callDirectUpdate (manage-tickets 404) par callMcpTool("tickets", update).
   */
  private async callDirectUpdate(
    ticketId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.callMcpTool("tickets", {
          action: "update",
          id: ticketId,
          ...fields,
        });
        console.log(`[servicedesk] callDirectUpdate OK for ${ticketId}: ${JSON.stringify(fields)}`);
        return;
      } catch (error) {
        console.error(`[servicedesk] callDirectUpdate attempt ${attempt + 1} failed for ${ticketId}:`, error);
        if (attempt === 0) await sleep(1_000);
      }
    }
    throw new Error(`callDirectUpdate failed after 2 attempts for ${ticketId}`);
  }

  // ================================================================
  // Tickets — Polling et lecture
  // ================================================================

  /**
   * Decouvre les tickets silo a traiter.
   *
   * Retourne les tickets groupes par etape :
   *   - pending_analysis : status=new, silo_assigned=true
   *   - pending_review : status=in_review, silo_assigned=true
   *   - ready_for_dev : status=ready_to_deploy, silo_assigned=true
   */
  async siloDiscover(applicationId: string): Promise<SiloDiscoverResult> {
    const result = await this.callTickets("silo_discover", {
      application_id: applicationId,
    });

    return {
      pending_analysis: result?.pending_analysis || [],
      pending_review: result?.pending_review || [],
      ready_for_dev: result?.ready_for_dev || [],
    };
  }

  /**
   * Liste les tickets avec filtres.
   */
  async listTickets(
    applicationId: string,
    filters?: { status?: TicketStatus; silo_assigned?: boolean; limit?: number },
  ): Promise<ServiceDeskTicket[]> {
    const result = await this.callTickets("list", {
      application_id: applicationId,
      ...filters,
    });

    if (Array.isArray(result)) return result;
    return result?.tickets || [];
  }

  /**
   * Recupere un ticket par ID (avec commentaires et historique).
   */
  async getTicket(ticketId: string): Promise<ServiceDeskTicket> {
    const result = await this.callTickets("get", { id: ticketId });
    return result?.ticket || result;
  }

  // ================================================================
  // Tickets — Mise a jour
  // ================================================================

  /**
   * Met a jour les champs d'un ticket (status, priority, assigned_to, etc.)
   */
  async updateTicket(
    ticketId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await this.callTickets("update", {
      id: ticketId,
      ...fields,
    });
  }

  /**
   * Change le statut Desk d'un ticket.
   */
  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
  ): Promise<void> {
    await this.updateTicket(ticketId, { status });
  }

  /**
   * Met a jour le run_status AIMS et le statut reel du ticket.
   *
   * v4.2 : Met a jour le VRAI statut du ticket via MCP (in_progress, qa, completed, etc.)
   * Plus de fallback metadata-as-comment — si ca echoue, on log et on continue.
   */
  async updateRunStatus(
    ticketId: string,
    runStatus: RunStatus,
    traceId: string,
    agentId: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const ticketStatus = RUN_STATUS_TO_TICKET_STATUS[runStatus];

    // 1. Propager les champs AIMS via appel direct AVANT le statut
    //    v4.5 : L'ordre est critique — callDirectUpdate d'abord, puis le statut ticket.
    //    manage-tickets peut mapper run_status vers un status incorrect,
    //    donc on applique le vrai status en DERNIER pour qu'il ait le dernier mot.
    const aimsFields: Record<string, unknown> = {
      run_status: runStatus,
      trace_id: traceId,
      run_claimed_by: agentId,
      run_updated_at: new Date().toISOString(),
    };

    if (runStatus === "ANALYZING") {
      aimsFields.silo_claimed_by = agentId;
      aimsFields.silo_claimed_at = new Date().toISOString();
    }

    if (runStatus === "RUNNING" && extra?.orchestrator_trace) {
      aimsFields.ai_analyzed = true;
    }

    // Persister les extra fields AIMS (session_id, blocked_question, blocked_at, etc.)
    if (extra) {
      const aimsExtraKeys = [
        "session_id", "blocked_question", "blocked_at",
        "human_response", "retry_count", "run_duration_ms",
        "orchestrator_trace", "run_executed_by",
      ];
      for (const key of aimsExtraKeys) {
        if (key in extra) {
          aimsFields[key] = extra[key];
        }
      }
    }

    // Priority sync (MCP-compatible field, goes through normal update)
    if (extra?.priority) {
      try {
        await this.updateTicket(ticketId, { priority: extra.priority });
        console.log(`[servicedesk] Ticket ${ticketId}: priority updated to ${extra.priority}`);
      } catch (error) {
        console.error(`[servicedesk] updateTicket priority failed for ${ticketId}:`, error);
      }
    }

    // Envoyer les AIMS fields (SANS le status — le status vient apres)
    await this.callDirectUpdate(ticketId, aimsFields);

    // 2. Mettre a jour le VRAI statut du ticket EN DERNIER (dernier ecrivain gagne)
    //    v4.5 : Le statut est applique APRES callDirectUpdate pour eviter qu'un
    //    mapping automatique de run_status ecrase la valeur voulue.
    if (ticketStatus) {
      try {
        await this.updateTicketStatus(ticketId, ticketStatus);
      } catch (error) {
        console.error(`[servicedesk] updateTicketStatus(${ticketId}, ${ticketStatus}) failed — fallback direct:`, error);
        // Fallback : forcer le status via appel direct
        await this.callDirectUpdate(ticketId, { status: ticketStatus });
      }
    }

    console.log(`[servicedesk] Ticket ${ticketId}: ${runStatus} → status=${ticketStatus || "(unchanged)"}`);
  }

  // ================================================================
  // Commentaires
  // ================================================================

  /**
   * Ajoute un commentaire sur un ticket.
   */
  async addComment(
    ticketId: string,
    content: string,
    authorLabel: string = "AIMS Orchestrator",
  ): Promise<void> {
    await this.callTickets("add_comment", {
      id: ticketId,
      content,
      author_label: authorLabel,
    });
  }

  /**
   * Poste un commentaire lisible par l'humain.
   */
  async postComment(
    ticketId: string,
    content: string,
    authorLabel?: string,
  ): Promise<void> {
    await this.addComment(ticketId, content, authorLabel || "AIMS Orchestrator");
  }

  /**
   * Recupere les commentaires d'un ticket.
   */
  async getTicketComments(ticketId: string): Promise<any[]> {
    try {
      const ticket = await this.getTicket(ticketId);
      return ticket.ticket_comments || [];
    } catch (error) {
      console.error(`[servicedesk] getTicketComments failed for ${ticketId}:`, error);
      return [];
    }
  }

  // ================================================================
  // Ticket creation
  // ================================================================

  /**
   * Cree un nouveau ticket dans le ServiceDesk.
   */
  async createTicket(fields: {
    title: string;
    description: string;
    application_id: string;
    type: string;
    priority: string;
  }): Promise<Record<string, unknown>> {
    return await this.callTickets("create", fields);
  }

  // ================================================================
  // Attachments
  // ================================================================

  /**
   * Upload un fichier en piece jointe sur un ticket ServiceDesk.
   * Necessite le tool ticket-attachments dans le MCP.
   */
  async addTicketAttachment(
    ticketId: string,
    file: { filename: string; mimetype: string; content_base64: string },
  ): Promise<void> {
    await this.callMcpTool("ticket-attachments", {
      action: "upload",
      ticket_id: ticketId,
      filename: file.filename,
      mimetype: file.mimetype,
      content_base64: file.content_base64,
    });
  }

  // ================================================================
  // Application
  // ================================================================

  /**
   * Recupere les metadonnees d'une application.
   * Note: utilise un tool separe "applications" si disponible, sinon fallback.
   */
  async getApplication(applicationId: string): Promise<Record<string, unknown>> {
    // Utilise le tool MCP "applications" (action: "get") via JSON-RPC 2.0
    // — meme proxy que callTickets mais avec name: "applications"
    try {
      const result = await this.callMcpTool("applications", { action: "get", id: applicationId });
      // L'executor retourne { success: true, application: { id, name, metadata, ... } }
      const app = result?.application || result;
      if (app && typeof app === "object" && (app.id || app.name || app.metadata)) {
        return app;
      }
      return { id: applicationId };
    } catch (err) {
      console.warn(`[servicedesk] getApplication failed: ${err}`);
      return { id: applicationId };
    }
  }

  /**
   * Appelle un tool MCP arbitraire via JSON-RPC 2.0 (meme pattern que callTickets).
   */
  private async callMcpTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    this.requestId++;
    const res = await fetch(this.mcpBaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.requestId,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`MCP ${toolName} failed: ${res.status} — ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(`MCP ${toolName} error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    const textContent = json.result?.content?.[0]?.text;
    if (textContent) {
      try { return JSON.parse(textContent); } catch { return textContent; }
    }
    return json.result || json;
  }

  // ================================================================
  // Helpers — Polling BLOCKED (filtre cote client)
  // ================================================================

  /**
   * Recupere les tickets silo en attente de reponse humaine.
   *
   * v4.2 : in_review = BLOCKED (question humaine)
   * v4.4 : inclut aussi les tickets en QA (VALIDATING) qui attendent validation
   */
  async getBlockedTickets(applicationId: string): Promise<ServiceDeskTicket[]> {
    try {
      const discovered = await this.siloDiscover(applicationId);
      const blocked = discovered.pending_review || [];

      // Aussi recuperer les tickets en QA (attente validation humaine)
      try {
        const qaTickets = await this.listTickets(applicationId, {
          status: "qa",
          silo_assigned: true,
        });
        return [...blocked, ...qaTickets];
      } catch {
        // Si listTickets echoue, retourner au moins les blocked
        return blocked;
      }
    } catch (error) {
      console.error("[servicedesk] getBlockedTickets failed:", error);
      return [];
    }
  }

  // ================================================================
  // GitHub PR — Mise a jour des champs PR sur le ticket
  // ================================================================

  /**
   * Met a jour github_pr_url et github_pr_number sur le ticket.
   * Utilise callDirectUpdate (bypass MCP proxy) car ces champs
   * ne sont pas declares dans le schema MCP tool.
   */
  async updatePRInfo(ticketId: string, prUrl: string): Promise<void> {
    const prNumber = extractPRNumber(prUrl);
    const fields: Record<string, unknown> = {
      github_pr_url: prUrl,
    };
    if (prNumber !== null) {
      fields.github_pr_number = prNumber;
    }
    await this.callDirectUpdate(ticketId, fields);
    console.log(`[servicedesk] Ticket ${ticketId}: PR info updated (url=${prUrl}, number=${prNumber})`);
  }

  /**
   * Met a jour le slack_thread_ts sur un ticket (pour le polling Slack direct).
   * Utilise callDirectUpdate (bypass MCP proxy).
   */
  async updateSlackThreadTs(ticketId: string, threadTs: string): Promise<void> {
    await this.callDirectUpdate(ticketId, { slack_thread_ts: threadTs });
  }

  // ================================================================
  // Health check
  // ================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.mcpBaseUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}

// --- Utils ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrait le numero de PR depuis une URL GitHub.
 * Ex: "https://github.com/org/repo/pull/123" → 123
 */
function extractPRNumber(prUrl: string): number | null {
  const match = prUrl.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
