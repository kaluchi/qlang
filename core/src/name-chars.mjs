// The letters of a name, one predicate for the grammar, which reads a
// name by them, and for the printer, which writes a keyword bare when
// its name reads back so: UAX #31 `ID_Start` and `ID_Continue`, with `@`
// starting a name and `_` and `-` continuing one, a character being a
// code unit as the parser reads it.

const NAME_START = /^[@_\p{ID_Start}]$/u;
const NAME_CONTINUE = /^[\p{ID_Continue}_-]$/u;

export const isNameStart = character => NAME_START.test(character);
export const isNameContinue = character => NAME_CONTINUE.test(character);

// Whether `:name` reads back as the keyword of the name: names joined by
// `/`, each a start and its continuation.
export function readsAsBareKeyword(name) {
  return name.split('/').every(segment =>
    segment.length > 0 && isNameStart(segment[0]) && segment.split('').slice(1).every(isNameContinue));
}
