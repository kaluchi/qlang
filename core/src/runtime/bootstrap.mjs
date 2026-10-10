// The sources of the language and the locator that reads them:
// `#qlang/<name>` resolves through the `imports` field of `package.json`
// on Node and through the import map in a browser, read by the loader the
// condition of `#qlang/load-source` picks.

import { loadSource } from '#qlang/load-source';
import { declareInvariantError } from '../errors.mjs';

// The sources the language declares its root by, in order [D153]: `qlang`
// declares the kinds and the topic of the language with its chapters, and
// each source after it the verbs, refusals and members of the noun its
// declarations name.
export const LANGUAGE_SOURCES = Object.freeze([
  'qlang',
  'qlang/builtin', 'qlang/tag', 'qlang/null', 'qlang/boolean', 'qlang/number', 'qlang/string',
  'qlang/keyword', 'qlang/vec', 'qlang/set', 'qlang/map', 'qlang/quote', 'qlang/doc',
  'qlang/error', 'qlang/desc',
  'qlang/explanation', 'qlang/tagged', 'qlang/construct', 'qlang/call', 'qlang/proj', 'qlang/bind',
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
