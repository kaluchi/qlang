// The letters of a name, read by the grammar and by the printer, which
// writes a keyword bare where its name reads back so: UAX #31 `ID_Start`
// and `ID_Continue`, `_` starting a name and `_` and `-` continuing one,
// a character a code unit as the parser reads it.
// The rules it holds: [QSNAM#letters].

const NAME_START = /^[_\p{ID_Start}]$/u;
const NAME_CONTINUE = /^[\p{ID_Continue}_-]$/u;

// The words of the literals, which no name takes.
export const LITERAL_WORDS = new Set(['true', 'false', 'null']);

export const isNameStart = character => NAME_START.test(character);
export const isNameContinue = character => NAME_CONTINUE.test(character);

// Whether `:name` reads back as the keyword of the name: names joined by
// `/`, each a start and its continuation.
export function readsAsBareKeyword(name) {
  return name.split('/').every(segment =>
    segment.length > 0 && isNameStart(segment[0]) && segment.split('').slice(1).every(isNameContinue));
}
