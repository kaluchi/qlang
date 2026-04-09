// Compile src/manifest.qlang into src/manifest.generated.mjs.
//
// Embeds the manifest source as a string constant so the bootstrap
// evaluator can parse it at runtime without filesystem access
// (browser-clean). Follows the same pattern as build-grammar.mjs.
//
// Run via `npm run build:manifest`. Idempotent.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const inputPath = join(here, '..', 'src', 'manifest.qlang');
const outputPath = join(here, '..', 'src', 'manifest.generated.mjs');

const source = readFileSync(inputPath, 'utf8');

const output = `// Generated from manifest.qlang — do not edit.\n` +
  `// Run \`npm run build:manifest\` to regenerate.\n\n` +
  `export const MANIFEST_SOURCE = ${JSON.stringify(source)};\n`;

writeFileSync(outputPath, output);
console.log(`manifest compiled → ${outputPath}`);
