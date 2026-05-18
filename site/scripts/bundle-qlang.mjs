// Bundle qlang for browser use.
//
// Produces `public/qlang.js` from `_browser-entry.mjs` — the
// reference embedding entry point. The browser entry statically
// imports every `.qlang` catalog file the runtime needs;
// esbuild's `text` loader rewrites each `import <name> from
// '<path>.qlang'` into a JS string literal at build time, so the
// resulting bundle is self-contained: no `<script
// type="importmap">`, no network fetch, no host-side glue.
//
// Inline sourcemaps keep stack traces from runtime exceptions
// pointing at the original `core/src/runtime/<file>.mjs` line
// instead of the bundled `qlang.js` line — debugging a failing
// query in browser DevTools lands on the operand impl in source
// form.

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const ENTRY     = resolve(__dirname, '_browser-entry.mjs');

await build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'esm',
  outfile: resolve(SITE_ROOT, 'public', 'qlang.js'),
  platform: 'browser',
  target: 'es2022',
  // `text` loader on `.qlang` rewrites every static import in
  // `_browser-entry.mjs` to a JS string literal — that is the
  // single seam between catalog source files and the bundle.
  loader: { '.qlang': 'text' },
  // Inline sourcemap so a browser exception's stack frame links
  // back to `core/src/runtime/<file>.mjs` instead of an opaque
  // `qlang.js:N:M` line. `sourcesContent: true` keeps the
  // original source embedded in the map so DevTools renders
  // readable frames without a separate roundtrip.
  sourcemap: 'inline',
  sourcesContent: true,
  minify: false,
  // `runtime/index.mjs` carries bare `import './<family>.mjs'`
  // lines that register operand impls into `PRIMITIVE_REGISTRY`
  // at module-load time. Even with `core/package.json#sideEffects`
  // pinning the runtime/ folder, `ignoreAnnotations: true` tells
  // esbuild to keep them in the bundle unconditionally — a
  // single-source-of-truth knob for the registration semantics.
  ignoreAnnotations: true
});

console.log('  bundled public/qlang.js (inline catalog, inline sourcemap)');
