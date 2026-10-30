// Compile src/grammar.peggy into gen/grammar.mjs.
//
// Run via `npm run build:grammar`. Idempotent. The input lives in
// src/ because it is hand-authored; the output lives in gen/ so
// build artifacts never share a directory with hand-written source
// files. gen/ is gitignored and included in the npm publish tarball
// via the `files` array in package.json.
// The rules it holds: [QSGAT#workspaces].

import peggy from 'peggy';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const grammarPath = join(here, '..', 'src', 'grammar.peggy');
const outputDir   = join(here, '..', 'gen');
const outputPath  = join(outputDir, 'grammar.mjs');

// parserSourceOf(trace) → the parser of the grammar as a module of `gen/`, its
// tracer kept where `trace` asks for it.
export function parserSourceOf(trace = false) {
  return peggy.generate(readFileSync(grammarPath, 'utf8'), {
    output: 'source',
    format: 'es',
    trace,
    allowedStartRules: ['Query']
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, parserSourceOf());
  console.log(`grammar compiled → ${outputPath}`);
}
