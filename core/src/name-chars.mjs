// [QSNAM#letters], [QSLSP#extension]

const START = '[_\\p{ID_Start}]';
const CONTINUE = '[\\p{ID_Continue}_-]';
const NAME_START = new RegExp(`^${START}$`, 'u');
const NAME_CONTINUE = new RegExp(`^${CONTINUE}$`, 'u');

// [QSLSP#extension]
export const NAME_REGEX = new RegExp(`${START}${CONTINUE}*`, 'u');

export const LITERAL_WORDS = new Set(['true', 'false', 'null']);

export const isNameStart = character => NAME_START.test(character);
export const isNameContinue = character => NAME_CONTINUE.test(character);

const BARE_KEYWORD = new RegExp(`^${START}${CONTINUE}*(?:/${START}${CONTINUE}*)*$`, 'u');

export const readsAsBareKeyword = name => BARE_KEYWORD.test(name);

export const readsAsName = name => readsAsBareKeyword(name) && !name.includes('/') && !LITERAL_WORDS.has(name);
