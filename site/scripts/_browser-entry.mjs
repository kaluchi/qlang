// Reference browser-embedding entry point for qlang.
//
// Bundles into `site/public/qlang.js` through
// `site/scripts/bundle-qlang.mjs`. The bundler's `text` loader
// rewrites each `import <name> from '<path>.qlang'` line into a
// JS string at build time, so the resulting bundle ships catalog
// source-of-truth alongside the evaluator and resolves every
// `use(:qlang/<ns>)` from an in-process Map without a network
// fetch.
//
// Embedders hosting qlang in a browser tab copy this pattern:
// re-export the core API from `@kaluchi/qlang-core`, statically
// import every `.qlang` catalog file the runtime needs, and
// expose an `inlineCatalogLocator` named export. Consumer code
// then calls `await langRuntime({ locator: inlineCatalogLocator })`
// to bootstrap. No `<script type="importmap">`, no `fetch`, no
// host-side resolver glue.

import coreSource              from '@kaluchi/qlang-core/lib/qlang/core.qlang';
import runtimeInvariantsSource from '@kaluchi/qlang-core/lib/qlang/runtime-invariants.qlang';
import tagSource               from '@kaluchi/qlang-core/lib/qlang/tag.qlang';
import numberSource            from '@kaluchi/qlang-core/lib/qlang/number.qlang';
import stringNounSource        from '@kaluchi/qlang-core/lib/qlang/string.qlang';
import keywordSource           from '@kaluchi/qlang-core/lib/qlang/keyword.qlang';
import vecNounSource           from '@kaluchi/qlang-core/lib/qlang/vec.qlang';
import setSource               from '@kaluchi/qlang-core/lib/qlang/set.qlang';
import mapSource               from '@kaluchi/qlang-core/lib/qlang/map.qlang';
import booleanSource           from '@kaluchi/qlang-core/lib/qlang/boolean.qlang';
import quoteSource             from '@kaluchi/qlang-core/lib/qlang/quote.qlang';
import taggedSource            from '@kaluchi/qlang-core/lib/qlang/tagged.qlang';
import anySource               from '@kaluchi/qlang-core/lib/qlang/any.qlang';
import reflectiveSource        from '@kaluchi/qlang-core/lib/qlang/operand/reflective.qlang';

// Logical-name keys here mirror `core.qlang`'s `use([:qlang/<ns>])`
// invocation list — the locator is the only seam the runtime calls
// to fetch a namespace.
const CATALOG = new Map([
  ['qlang/core',                    coreSource],
  ['qlang/runtime-invariants',      runtimeInvariantsSource],
  ['qlang/tag',                     tagSource],
  ['qlang/number',                  numberSource],
  ['qlang/string',                  stringNounSource],
  ['qlang/keyword',                 keywordSource],
  ['qlang/vec',                     vecNounSource],
  ['qlang/set',                     setSource],
  ['qlang/map',                     mapSource],
  ['qlang/boolean',                 booleanSource],
  ['qlang/quote',                   quoteSource],
  ['qlang/tagged',                  taggedSource],
  ['qlang/any',                     anySource],
  ['qlang/operand/reflective',      reflectiveSource]
]);

export async function inlineCatalogLocator(namespaceName) {
  return CATALOG.has(namespaceName)
    ? { source: CATALOG.get(namespaceName) }
    : null;
}

// Re-export the API the embedding script consumes. Bundling
// through this entry keeps `@kaluchi/qlang-core` as a peer of the
// inline-catalog locator — the consumer imports both from the
// same `qlang.js` bundle without ever touching the locator
// machinery itself.
export {
  evalQuery,
  printValue,
  langRuntime,
  parse,
  createSession,
  serializeSession,
  deserializeSession
} from '@kaluchi/qlang-core';
