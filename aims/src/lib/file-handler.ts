/**
 * AIMS v5 — File Handler
 *
 * Gere le cycle de vie des fichiers attaches aux reponses Slack :
 *   1. Telechargement depuis Slack (Bearer token)
 *   2. Extraction de contenu (Vision pour images, pdf-parse pour PDF, UTF-8 pour texte)
 *   3. Upload vers ServiceDesk via MCP ticket-attachments
 *   4. Formatage pour injection dans le prompt de reprise du sub-agent
 */

import type { SlackClient, SlackFile } from "./slack-client.js";
import { ServiceDeskClient } from "./servicedesk-client.js";
import Anthropic from "@anthropic-ai/sdk";

// --- Constants ---

const MAX_FILE_SIZE = parseInt(process.env.AIMS_MAX_FILE_SIZE || String(10 * 1024 * 1024)); // 10 MB default

const ALLOWED_MIMETYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv",
  "application/json",
  "text/javascript", "text/typescript",
  // Common Slack variants
  "text/x-typescript", "text/x-python", "text/x-java",
]);

// --- Types ---

export interface ExtractedFile {
  name: string;
  mimetype: string;
  size: number;
  content: string;
  extractionMethod: "vision" | "pdf" | "text" | "none";
  buffer?: Buffer;
}

export interface FileProcessingResult {
  files: ExtractedFile[];
  errors: string[];
}

// --- Helpers ---

function isImage(mimetype: string): boolean {
  return mimetype.startsWith("image/");
}

function isPDF(mimetype: string): boolean {
  return mimetype === "application/pdf";
}

function isText(mimetype: string): boolean {
  return mimetype.startsWith("text/") || mimetype === "application/json";
}

function log(action: string, detail: string): void {
  console.log(`[file-handler] [${new Date().toISOString()}] ${action}: ${detail}`);
}

// --- Core functions ---

export async function processSlackFiles(
  slackClient: SlackClient,
  files: SlackFile[],
  anthropicApiKey: string,
): Promise<FileProcessingResult> {
  const result: FileProcessingResult = { files: [], errors: [] };

  for (const file of files) {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      log("skip", `${file.name}: unsupported type ${file.mimetype}`);
      result.errors.push(`${file.name}: type ${file.mimetype} non supporte`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      log("skip", `${file.name}: ${file.size} bytes exceeds ${MAX_FILE_SIZE} limit`);
      result.errors.push(`${file.name}: taille ${Math.round(file.size / 1024 / 1024)}MB depasse la limite`);
      continue;
    }

    const download = await slackClient.downloadFile(file.url_private_download);
    if (!download.ok || !download.buffer) {
      log("error", `${file.name}: download failed — ${download.error}`);
      result.errors.push(`${file.name}: telechargement echoue (${download.error})`);
      continue;
    }

    log("downloaded", `${file.name} (${file.mimetype}, ${download.buffer.length} bytes)`);

    let content = "";
    let extractionMethod: ExtractedFile["extractionMethod"] = "none";

    try {
      if (isImage(file.mimetype)) {
        content = await extractImageContent(download.buffer, file.mimetype, file.name, anthropicApiKey);
        extractionMethod = "vision";
      } else if (isPDF(file.mimetype)) {
        content = await extractPDFContent(download.buffer, file.name);
        extractionMethod = "pdf";
      } else if (isText(file.mimetype)) {
        content = download.buffer.toString("utf-8");
        extractionMethod = "text";
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log("extraction_error", `${file.name}: ${errMsg}`);
      result.errors.push(`${file.name}: extraction echouee (${errMsg})`);
    }

    result.files.push({
      name: file.name,
      mimetype: file.mimetype,
      size: file.size,
      content,
      extractionMethod,
      buffer: download.buffer,
    });
  }

  return result;
}

async function extractImageContent(
  buffer: Buffer,
  mimetype: string,
  filename: string,
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const base64 = buffer.toString("base64");
  const mediaType = mimetype as "image/png" | "image/jpeg" | "image/gif" | "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Decris cette image de maniere detaillee et structuree. Si c'est un schema d'architecture, un wireframe ou un screenshot d'interface, identifie les composants, les connexions et les labels. Fichier: ${filename}`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "[image description unavailable]";
}

async function extractPDFContent(buffer: Buffer, filename: string): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    log("pdf_extracted", `${filename}: ${data.numpages} pages, ${data.text.length} chars`);
    return data.text;
  } catch {
    log("pdf_extract_failed", `${filename}: pdf-parse not available — install pdf-parse if PDF extraction is needed`);
    return `[PDF content extraction unavailable for ${filename} — install pdf-parse]`;
  }
}

export async function uploadFilesToServiceDesk(
  client: ServiceDeskClient,
  ticketId: string,
  files: ExtractedFile[],
): Promise<string[]> {
  const uploaded: string[] = [];

  for (const file of files) {
    if (!file.buffer) continue;

    try {
      await client.addTicketAttachment(ticketId, {
        filename: file.name,
        mimetype: file.mimetype,
        content_base64: file.buffer.toString("base64"),
      });
      uploaded.push(file.name);
      log("uploaded", `${file.name} → ticket ${ticketId}`);
    } catch (err) {
      log("upload_error", `${file.name}: ${err}`);
    }
  }

  return uploaded;
}

export function formatFilesForPrompt(files: ExtractedFile[]): string {
  if (files.length === 0) return "";

  const sections = files.map((f) => {
    const header = `[ATTACHMENT: ${f.name}]`;
    if (!f.content) return `${header}\n(fichier stocke sur ServiceDesk, extraction non disponible)`;

    const label = f.extractionMethod === "vision" ? "Description" : "Contenu extrait";
    const maxLen = f.extractionMethod === "text" ? 10000 : 5000;
    const content = f.content.length > maxLen
      ? f.content.slice(0, maxLen) + "\n[... tronque]"
      : f.content;

    return `${header}\n${label}: ${content}`;
  });

  return "\n\n" + sections.join("\n\n");
}
