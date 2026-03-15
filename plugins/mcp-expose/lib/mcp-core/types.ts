/**
 * Types MCP communs partagés entre tous les serveurs MCP modulaires (Deno)
 */

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCallArgs {
  [key: string]: unknown;
}

export interface HttpOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

