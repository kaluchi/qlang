// Compile src/grammar.peggy into src/grammar.generated.mjs.
//
// Run via `npm run build:grammar`. Idempotent.

import peggy from 'peggy';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const grammarPath = join(here, '..', 'src', 'grammar.peggy');
const outputPath = join(here, '..', 'src', 'grammar.generated.mjs');

const source = readFileSync(grammarPath, 'utf8');

const parserSource = peggy.generate(source, {
  output: 'source',
  format: 'es',
  trace: false
});

writeFileSync(outputPath, parserSource);
console.log(`grammar compiled → ${outputPath}`);
