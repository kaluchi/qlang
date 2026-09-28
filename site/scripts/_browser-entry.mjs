// Reference browser-embedding entry point for qlang.
//
// Bundles into `site/public/qlang.js` through
// `site/scripts/bundle-qlang.mjs`. The bundler's `text` loader
// rewrites each `import <name> from '<path>.qlang'` line into a
// JS string at build time, so the resulting bundle ships catalog
// source-of-truth alongside the evaluator and resolves every module
// the catalog root lists from an in-process Map without a network
// fetch.
//
// Embedders hosting qlang in a browser tab copy this pattern:
// re-export the core API from `@kaluchi/qlang-core`, statically
// import every `.qlang` catalog file the runtime needs, and
// expose an `inlineCatalogLocator` named export. Consumer code
// then calls `await langRuntime({ locator: inlineCatalogLocator })`
// to bootstrap. No `<script type="importmap">`, no `fetch`, no
// host-side resolver glue.

import coreCatalogSource from '@kaluchi/qlang-core/lib/qlang/core.qlang';
import builtinCatalogSource from '@kaluchi/qlang-core/lib/qlang/builtin.qlang';
import verbCatalogSource from '@kaluchi/qlang-core/lib/qlang/verb.qlang';
import tagCatalogSource from '@kaluchi/qlang-core/lib/qlang/tag.qlang';
import nullCatalogSource from '@kaluchi/qlang-core/lib/qlang/null.qlang';
import booleanCatalogSource from '@kaluchi/qlang-core/lib/qlang/boolean.qlang';
import numberCatalogSource from '@kaluchi/qlang-core/lib/qlang/number.qlang';
import stringCatalogSource from '@kaluchi/qlang-core/lib/qlang/string.qlang';
import keywordCatalogSource from '@kaluchi/qlang-core/lib/qlang/keyword.qlang';
import vecCatalogSource from '@kaluchi/qlang-core/lib/qlang/vec.qlang';
import setCatalogSource from '@kaluchi/qlang-core/lib/qlang/set.qlang';
import mapCatalogSource from '@kaluchi/qlang-core/lib/qlang/map.qlang';
import quoteCatalogSource from '@kaluchi/qlang-core/lib/qlang/quote.qlang';
import docCatalogSource from '@kaluchi/qlang-core/lib/qlang/doc.qlang';
import specCatalogSource from '@kaluchi/qlang-core/lib/qlang/spec.qlang';
import bindingCatalogSource from '@kaluchi/qlang-core/lib/qlang/binding.qlang';
import errorCatalogSource from '@kaluchi/qlang-core/lib/qlang/error.qlang';
import elisionCatalogSource from '@kaluchi/qlang-core/lib/qlang/elision.qlang';
import linkCatalogSource from '@kaluchi/qlang-core/lib/qlang/link.qlang';
import snippetCatalogSource from '@kaluchi/qlang-core/lib/qlang/snippet.qlang';
import explanationCatalogSource from '@kaluchi/qlang-core/lib/qlang/explanation.qlang';
import taggedCatalogSource from '@kaluchi/qlang-core/lib/qlang/tagged.qlang';
import callCatalogSource from '@kaluchi/qlang-core/lib/qlang/call.qlang';
import projCatalogSource from '@kaluchi/qlang-core/lib/qlang/proj.qlang';
import bindCatalogSource from '@kaluchi/qlang-core/lib/qlang/bind.qlang';
import eachCatalogSource from '@kaluchi/qlang-core/lib/qlang/each.qlang';
import failCatalogSource from '@kaluchi/qlang-core/lib/qlang/fail.qlang';
import groupCatalogSource from '@kaluchi/qlang-core/lib/qlang/group.qlang';
import anyCatalogSource from '@kaluchi/qlang-core/lib/qlang/any.qlang';
import qlangCatalogSource from '@kaluchi/qlang-core/lib/qlang/qlang.qlang';

// The keys are the names the root `core.qlang` lists, and the locator is
// the one seam the runtime calls to fetch a module.
const CATALOG = new Map([
  ['qlang/core', coreCatalogSource],
  ['qlang/builtin', builtinCatalogSource],
  ['qlang/verb', verbCatalogSource],
  ['qlang/tag', tagCatalogSource],
  ['qlang/null', nullCatalogSource],
  ['qlang/boolean', booleanCatalogSource],
  ['qlang/number', numberCatalogSource],
  ['qlang/string', stringCatalogSource],
  ['qlang/keyword', keywordCatalogSource],
  ['qlang/vec', vecCatalogSource],
  ['qlang/set', setCatalogSource],
  ['qlang/map', mapCatalogSource],
  ['qlang/quote', quoteCatalogSource],
  ['qlang/doc', docCatalogSource],
  ['qlang/spec', specCatalogSource],
  ['qlang/binding', bindingCatalogSource],
  ['qlang/error', errorCatalogSource],
  ['qlang/elision', elisionCatalogSource],
  ['qlang/link', linkCatalogSource],
  ['qlang/snippet', snippetCatalogSource],
  ['qlang/explanation', explanationCatalogSource],
  ['qlang/tagged', taggedCatalogSource],
  ['qlang/call', callCatalogSource],
  ['qlang/proj', projCatalogSource],
  ['qlang/bind', bindCatalogSource],
  ['qlang/each', eachCatalogSource],
  ['qlang/fail', failCatalogSource],
  ['qlang/group', groupCatalogSource],
  ['qlang/any', anyCatalogSource],
  ['qlang/qlang', qlangCatalogSource]
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
