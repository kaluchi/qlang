import { loadSource } from '#qlang/load-source';
import { declareDefect } from '../errors.mjs';

// [QSDSP#residence]
export const LANGUAGE_SOURCES = Object.freeze([
  'qlang/builtin', 'qlang/kind', 'qlang/fn', 'qlang', 'qlang/tag', 'qlang/null', 'qlang/boolean', 'qlang/number', 'qlang/string',
  'qlang/keyword', 'qlang/regex', 'qlang/vec', 'qlang/set', 'qlang/map', 'qlang/quote', 'qlang/doc',
  'qlang/binding', 'qlang/error', 'qlang/trace', 'qlang/frame', 'qlang/each', 'qlang/absent', 'qlang/nullable', 'qlang/shape', 'qlang/elision', 'qlang/desc',
  'qlang/link', 'qlang/snippet', 'qlang/law', 'qlang/invariant',
  'qlang/tagged', 'qlang/construct', 'qlang/call', 'qlang/path', 'qlang/span', 'qlang/point', 'qlang/bind',
  'qlang/fail', 'qlang/group', 'qlang/any'
]);

// [QSHST#source]
export const BuiltinBootstrapSourceMissingError = declareDefect(
  'builtin/BootstrapSourceMissingError',
  ({ origin }) => `qlang bootstrap: '#${origin.name}' must resolve to a source of the language — ` +
    'add an entry to package.json#imports or the import map');

export async function platformLocator(uri) {
  const source = await loadSource(uri);
  return source === null ? null : { source };
}
