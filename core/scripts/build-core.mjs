// Compile lib/qlang/core.qlang into gen/core.mjs.
//
// Embeds the core runtime source as a string constant so the
// langRuntime bootstrap can parse it at runtime without
// filesystem access (browser-clean). Mirror of build-grammar.mjs:
// hand-authored input in lib/ or src/, generated output in gen/,
// so source and build artifacts never share a directory.
//
// Run via `npm run build:core`. Idempotent.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const coreInputPath     = join(here, '..', 'lib', 'qlang', 'core.qlang');
const registryInputPath = join(here, '..', 'lib', 'qlang', 'error', 'registry.qlang');
const outputDir         = join(here, '..', 'gen');
const outputPath        = join(outputDir, 'core.mjs');

mkdirSync(outputDir, { recursive: true });

// CORE_SOURCE concatenates the authored catalog (core.qlang) with the
// named-error type-binding registry (error/registry.qlang). The
// registry declares each `::Tag` referenced in `:throws` Vecs so the
// env carries a type-binding under every such key — `evalBareTypeKeyword`
// finds them when an error-value's `:thrown` TagKeyword surfaces or
// when an authored `!{:thrown ::Tag ...}` literal is evaluated. The
// two files are joined by a section divider; downstream BindStep
// declarations install into the same env.
// Order: registry FIRST, then core.qlang. Core.qlang's catalog
// entries reference `::Tag` BareTypeKeyword's in their `:throws` Vec
// values — these evaluate via `evalBareTypeKeyword` at bootstrap and
// require the target tag to already be present in the env. Loading
// the registry up-front installs every named-error type-binding so
// the subsequent core.qlang def-steps see them and produce
// descriptor Vec'и carrying TagKeyword references (not lifted
// TaggedLitTagNotFoundError error-values).
const coreSource     = readFileSync(coreInputPath,     'utf8');
const registrySource = readFileSync(registryInputPath, 'utf8');
const divider = '\n\n|~ ──────────────── Operand catalog ──────────────── ~|\n\n';
const source = registrySource + divider + coreSource;

const output = `// Generated from lib/qlang/core.qlang + lib/qlang/error/registry.qlang — do not edit.\n` +
  `// Run \`npm run build:core\` to regenerate.\n\n` +
  `export const CORE_SOURCE = ${JSON.stringify(source)};\n`;

writeFileSync(outputPath, output);
console.log(`core compiled → ${outputPath}`);
