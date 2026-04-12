// Bundle qlang evaluator for browser use.
//
// Produces public/qlang.js exporting evalQuery so the REPL
// component can evaluate qlang expressions client-side.

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(ROOT, '..', 'src', 'index.mjs')],
  bundle: true,
  format: 'esm',
  outfile: resolve(ROOT, 'public', 'qlang.js'),
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
