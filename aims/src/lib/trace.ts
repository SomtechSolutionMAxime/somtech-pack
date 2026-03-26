/**
 * AIMS v4 — Trace ID Generator
 * Format: aims-{timestamp_hex}-{random_hex}
 * Inchange depuis v3.
 */

import { randomBytes } from "crypto";

export function generateTraceId(): string {
  const timestampHex = Date.now().toString(16);
  const randomHex = randomBytes(4).toString("hex");
  return `aims-${timestampHex}-${randomHex}`;
}
