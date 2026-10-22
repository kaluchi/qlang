// [QSNAM#letters], [QSLSP#extension]

const START = '[_\\p{ID_Start}]';
const CONTINUE = '[\\p{ID_Continue}_-]';
const NAME_START = new RegExp(`^${START}$`, 'u');
const NAME_CONTINUE = new RegExp(`^${CONTINUE}$`, 'u');

// [QSLSP#extension]
const UNIT = '(?![\\u{10000}-\\u{10FFFF}])';
export const NAME_REGEX = new RegExp(`${UNIT}${START}(?:${UNIT}${CONTINUE})*`, 'u');

export const LITERAL_WORDS = new Set(['true', 'false', 'null']);

export const isNameStart = character => NAME_START.test(character);
export const isNameContinue = character => NAME_CONTINUE.test(character);

export function readsAsBareKeyword(name) {
  return name.split('/').every(segment =>
    segment.length > 0 && isNameStart(segment[0]) && segment.split('').slice(1).every(isNameContinue));
}
