#!/usr/bin/env node
/**
 * AIMS Silo v2 — YAML → JSON parser
 *
 * Usage: node parse-yaml.js <path-to-yaml-file>
 * Output: JSON to stdout
 *
 * Called by entrypoint.sh to parse .aims/workflow.yaml.
 * Uses the `yaml` npm package (~200KB, no python required).
 */

const fs = require('fs');
const { parse } = require('yaml');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node parse-yaml.js <path>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parse(content);
  console.log(JSON.stringify(parsed));
} catch (err) {
  if (err.code === 'ENOENT') {
    // File not found — output empty object (defaults will apply)
    console.log('{}');
  } else {
    console.error(`Error parsing YAML: ${err.message}`);
    process.exit(1);
  }
}
