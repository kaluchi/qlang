// Bundle qlang for browser use.
//
// Produces `public/qlang.js` from `_browser-entry.mjs`, which imports the
// sources of the language as one module the plugin below writes, each
// source read as a string by esbuild's `text` loader, so the bundle holds
// them all and fetches none.
//
// Inline sourcemaps keep stack traces from runtime exceptions
// pointing at the original `core/src/runtime/<file>.mjs` line
// instead of the bundled `qlang.js` line — debugging a failing
// query in browser DevTools lands on the implementation of the word
// in source form.

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGE_SOURCES } from '@kaluchi/qlang-core';

// The module `qlang:language-sources` the entry imports: a static import
// of each source of the language, `lib/<uri>.qlang` as
// `package.json#imports` maps it, in a Map by its uri [QSHST#source].
const languageSources = {
  name: 'language-sources',
  setup(builder) {
    builder.onResolve({ filter: /^qlang:language-sources$/ }, () => ({ path: 'language-sources', namespace: 'qlang' }));
    builder.onLoad({ filter: /.*/, namespace: 'qlang' }, () => ({
      resolveDir: __dirname,
      contents: [
        ...LANGUAGE_SOURCES.map((uri, index) => `import source${index} from '@kaluchi/qlang-core/lib/${uri}.qlang';`),
        `export const CATALOG = new Map([${LANGUAGE_SOURCES.map((uri, index) => `['${uri}', source${index}]`).join(', ')}]);`
      ].join('\n')
    }));
  }
};

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
  // A `.qlang` source the module of the sources imports reads as a string.
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
  // lines, each module binding the implementations of the language's
  // verbs and kinds into `PRIMITIVE_REGISTRY` as it loads
  // [QSDSP#residence], and `ignoreAnnotations: true` keeps them in
  // the bundle whatever `core/package.json#sideEffects` declares.
  ignoreAnnotations: true,
  plugins: [languageSources]
});

console.log('  bundled public/qlang.js (inline catalog, inline sourcemap)');
