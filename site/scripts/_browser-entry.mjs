// Reference browser-embedding entry point for qlang.
//
// Bundles into `site/public/qlang.js` through
// `site/scripts/bundle-qlang.mjs`. The bundler's `text` loader
// rewrites each `import <name> from '<path>.qlang'` line into a
// JS string at build time, so the resulting bundle ships the sources of
// the language alongside the evaluator and resolves every one of them
// from an in-process Map without a network fetch.
//
// Embedders hosting qlang in a browser tab copy this pattern:
// re-export the core API from `@kaluchi/qlang-core`, statically
// import every source of the language, and expose an
// `inlineCatalogLocator` named export. Consumer code then calls
// `await langRuntime({ locator: inlineCatalogLocator })` to bootstrap.
// No `<script type="importmap">`, no `fetch`, no host-side resolver
// glue.

import qlangSource from '@kaluchi/qlang-core/lib/qlang.qlang';
import builtinSource from '@kaluchi/qlang-core/lib/qlang/builtin.qlang';
import verbSource from '@kaluchi/qlang-core/lib/qlang/verb.qlang';
import tagSource from '@kaluchi/qlang-core/lib/qlang/tag.qlang';
import nullSource from '@kaluchi/qlang-core/lib/qlang/null.qlang';
import booleanSource from '@kaluchi/qlang-core/lib/qlang/boolean.qlang';
import numberSource from '@kaluchi/qlang-core/lib/qlang/number.qlang';
import stringSource from '@kaluchi/qlang-core/lib/qlang/string.qlang';
import keywordSource from '@kaluchi/qlang-core/lib/qlang/keyword.qlang';
import vecSource from '@kaluchi/qlang-core/lib/qlang/vec.qlang';
import setSource from '@kaluchi/qlang-core/lib/qlang/set.qlang';
import mapSource from '@kaluchi/qlang-core/lib/qlang/map.qlang';
import quoteSource from '@kaluchi/qlang-core/lib/qlang/quote.qlang';
import docSource from '@kaluchi/qlang-core/lib/qlang/doc.qlang';
import errorSource from '@kaluchi/qlang-core/lib/qlang/error.qlang';
import descSource from '@kaluchi/qlang-core/lib/qlang/desc.qlang';
import explanationSource from '@kaluchi/qlang-core/lib/qlang/explanation.qlang';
import taggedSource from '@kaluchi/qlang-core/lib/qlang/tagged.qlang';
import constructSource from '@kaluchi/qlang-core/lib/qlang/construct.qlang';
import callSource from '@kaluchi/qlang-core/lib/qlang/call.qlang';
import projSource from '@kaluchi/qlang-core/lib/qlang/proj.qlang';
import bindSource from '@kaluchi/qlang-core/lib/qlang/bind.qlang';
import eachSource from '@kaluchi/qlang-core/lib/qlang/each.qlang';
import failSource from '@kaluchi/qlang-core/lib/qlang/fail.qlang';
import groupSource from '@kaluchi/qlang-core/lib/qlang/group.qlang';
import anySource from '@kaluchi/qlang-core/lib/qlang/any.qlang';

// The sources of the language by the names the runtime asks for them
// [D153].
const CATALOG = new Map([
  ['qlang', qlangSource],
  ['qlang/builtin', builtinSource],
  ['qlang/verb', verbSource],
  ['qlang/tag', tagSource],
  ['qlang/null', nullSource],
  ['qlang/boolean', booleanSource],
  ['qlang/number', numberSource],
  ['qlang/string', stringSource],
  ['qlang/keyword', keywordSource],
  ['qlang/vec', vecSource],
  ['qlang/set', setSource],
  ['qlang/map', mapSource],
  ['qlang/quote', quoteSource],
  ['qlang/doc', docSource],
  ['qlang/error', errorSource],
  ['qlang/desc', descSource],
  ['qlang/explanation', explanationSource],
  ['qlang/tagged', taggedSource],
  ['qlang/construct', constructSource],
  ['qlang/call', callSource],
  ['qlang/proj', projSource],
  ['qlang/bind', bindSource],
  ['qlang/each', eachSource],
  ['qlang/fail', failSource],
  ['qlang/group', groupSource],
  ['qlang/any', anySource]
]);

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
  langRuntime,
  parse,
  createSession,
  isErrorValue,
  verbNames
} from '@kaluchi/qlang-core';
