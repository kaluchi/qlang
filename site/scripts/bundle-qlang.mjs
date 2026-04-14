// Bundle qlang evaluator for browser use.
//
// Produces public/qlang.js exporting evalQuery so the REPL
// component can evaluate qlang expressions client-side. Reaches
// into the sibling `core/` workspace for the language entry point —
// esbuild inlines every `core/src` import into one browser bundle.

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const CORE_SRC  = resolve(SITE_ROOT, '..', 'core', 'src', 'index.mjs');

await build({
  entryPoints: [CORE_SRC],
  bundle: true,
  format: 'esm',
  outfile: resolve(SITE_ROOT, 'public', 'qlang.js'),
  platform: 'browser',
  target: 'es2022',
  minify: false,
  sourcemap: true,
  // runtime/index.mjs has bare imports that register primitives
  // into PRIMITIVE_REGISTRY — esbuild must not drop them despite
  // the root package.json sideEffects: false declaration.
  ignoreAnnotations: true
});

console.log('  bundled public/qlang.js');
