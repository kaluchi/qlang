// Reference browser-embedding entry point for qlang.
//
// Bundles into `site/public/qlang.js` through
// `site/scripts/bundle-qlang.mjs`. The bundler's `text` loader
// rewrites each `import <name> from '<path>.qlang'` line into a
// JS string at build time, so the resulting bundle ships the sources of
// the language alongside the evaluator and resolves every one of them
// from an in-process Map without a network fetch.
//
// Embedders hosting qlang in a browser tab do the same:
// re-export the core API from `@kaluchi/qlang-core`, statically
// import every source of the language, which the bundler lists from
// `LANGUAGE_SOURCES`, and expose an `inlineCatalogLocator` named export.
// Consumer code then calls `await langRuntime({ locator:
// inlineCatalogLocator })` to bootstrap, and the page reads every
// source from the bundle it loaded.

// The sources of the language by the names the runtime asks for them,
// which the bundler writes from LANGUAGE_SOURCES [QSHST#source].
import { CATALOG } from 'qlang:language-sources';

export async function inlineCatalogLocator(uri) {
  return CATALOG.has(uri) ? { source: CATALOG.get(uri) } : null;
}

// Re-export the API the embedding script consumes. Bundling
// through this entry keeps `@kaluchi/qlang-core` as a peer of the
// inline-catalog locator — the consumer imports both from the
// same `qlang.js` bundle without ever touching the locator
// machinery itself.
export {
  evalQuery,
  printValue,
  caretOf,
  langRuntime,
  parse,
  createSession,
  isErrorValue,
  verbNames
} from '@kaluchi/qlang-core';
export { cellShown } from '../src/lib/cell-shown.js';
