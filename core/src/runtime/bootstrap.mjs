// The sources of the language and the locator that reads them:
// `#qlang/<name>` resolves through the `imports` field of `package.json`
// on Node and through the import map in a browser, read by the loader the
// condition of `#qlang/load-source` picks.

import { loadSource } from '#qlang/load-source';
import { declareInvariantError } from '../errors.mjs';

// The sources the language declares its root by, in order [QSDSP#residence],
// each the source of one noun, its page and what is declared under it
// [QSDSP#residence]: the kinds whose literals build the others first,
// `builtin`, `kind` and `fn`, then `qlang` the topic of the language, its
// first page and chapters, and each source after it a kind.
export const LANGUAGE_SOURCES = Object.freeze([
  'qlang/builtin', 'qlang/kind', 'qlang/fn', 'qlang', 'qlang/tag', 'qlang/null', 'qlang/boolean', 'qlang/number', 'qlang/string',
  'qlang/keyword', 'qlang/regex', 'qlang/vec', 'qlang/set', 'qlang/map', 'qlang/quote', 'qlang/doc',
  'qlang/binding', 'qlang/error', 'qlang/trail', 'qlang/frame', 'qlang/each', 'qlang/absent', 'qlang/nullable', 'qlang/shape', 'qlang/elision', 'qlang/desc',
  'qlang/link', 'qlang/snippet', 'qlang/law', 'qlang/holds',
  'qlang/explanation', 'qlang/tagged', 'qlang/construct', 'qlang/call', 'qlang/path', 'qlang/span', 'qlang/point', 'qlang/bind',
  'qlang/fail', 'qlang/group', 'qlang/any'
]);

// A source of the language the locator does not serve leaves the root
// without the declarations it holds.
export const BuiltinBootstrapSourceMissingError = declareInvariantError(
  'builtin/BootstrapSourceMissingError',
  ({ uri }) => `qlang bootstrap: '#${uri}' must resolve to a source of the language — ` +
    'add an entry to package.json#imports or the import map');

// platformLocator(uri) → Promise<{ source } | null>: the source `qlang/number`
// read from `#qlang/number` through the `imports` field or the import map,
// null for a name neither maps.
export async function platformLocator(uri) {
  const source = await loadSource('#' + uri);
  return source === null ? null : { source };
}
