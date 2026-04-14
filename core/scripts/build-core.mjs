// Compile lib/qlang/core.qlang into gen/core.mjs.
//
// Embeds the core runtime source as a string constant so the
// Variant-B langRuntime bootstrap can parse it at runtime without
// filesystem access (browser-clean). Mirror of build-grammar.mjs /
// build-manifest.mjs: hand-authored input in lib/ or src/,
// generated output in gen/, so source and build artifacts never
// share a directory.
//
// Run via `npm run build:core`. Idempotent.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const inputPath  = join(here, '..', 'lib', 'qlang', 'core.qlang');
const outputDir  = join(here, '..', 'gen');
const outputPath = join(outputDir, 'core.mjs');

mkdirSync(outputDir, { recursive: true });

const source = readFileSync(inputPath, 'utf8');

const output = `// Generated from lib/qlang/core.qlang — do not edit.\n` +
  `// Run \`npm run build:core\` to regenerate.\n\n` +
  `export const CORE_SOURCE = ${JSON.stringify(source)};\n`;

writeFileSync(outputPath, output);
console.log(`core compiled → ${outputPath}`);
