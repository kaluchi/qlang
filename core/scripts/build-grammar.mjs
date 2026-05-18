// Compile src/grammar.peggy into gen/grammar.mjs.
//
// Run via `npm run build:grammar`. Idempotent. The input lives in
// src/ because it is hand-authored; the output lives in gen/ so
// build artifacts never share a directory with hand-written source
// files. gen/ is gitignored and included in the npm publish tarball
// via the `files` array in package.json.

import peggy from 'peggy';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const grammarPath = join(here, '..', 'src', 'grammar.peggy');
const outputDir   = join(here, '..', 'gen');
const outputPath  = join(outputDir, 'grammar.mjs');

mkdirSync(outputDir, { recursive: true });

const source = readFileSync(grammarPath, 'utf8');

const parserSource = peggy.generate(source, {
  output: 'source',
  format: 'es',
  trace: false,
  // Query is the default start rule for full-source qlang queries.
  // TaggedLit / Primary are exposed for sub-parsers (notably the
  // Doc-content tokenizer in src/doc-segments.mjs) that need to
  // match a single TaggedLit inside surrounding text.
  allowedStartRules: ['Query', 'TaggedLit', 'Primary']
});

writeFileSync(outputPath, parserSource);
console.log(`grammar compiled → ${outputPath}`);
