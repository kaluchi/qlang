// [QSTXT#regex]

export const REGEX_FLAGS = 'ims';

export function engineOf(source, flags, extra = '') {
  return new RegExp(source, `u${flags}${extra}`);
}

function groupOpenings(source) {
  const openings = [];
  let inClass = false;
  for (let at = 0; at < source.length; at++) {
    if (source[at] === '\\') at++;
    else if (inClass) inClass = source[at] !== ']';
    else if (source[at] === '[') inClass = true;
    else if (source[at] === '(') openings.push(at);
  }
  return openings;
}

const FLAG_GROUP = /\(\?(?:[a-zA-Z]+(?:-[a-zA-Z]*)?|-[a-zA-Z]+)[:)]/y;
const GROUP_NAME = /\(\?<([^>=!][^>]*)>/y;

function readAt(expression, source, at) {
  expression.lastIndex = at;
  return expression.exec(source);
}

function laterEditionOf(source) {
  const names = new Set();
  for (const at of groupOpenings(source)) {
    if (readAt(FLAG_GROUP, source, at) !== null) return { reason: 'a group of flags stands in the source', habit: 'flags' };
    const name = readAt(GROUP_NAME, source, at)?.[1];
    if (name === undefined) continue;
    if (names.has(name)) return { reason: `the group name \`${name}\` is written twice`, habit: null };
    names.add(name);
  }
  return null;
}

const ENGINE_PREFIX = /^Invalid regular expression: (?:\/[\s\S]*\/[a-z]*: )?/;

function engineReason(source, flags) {
  try {
    engineOf(source, flags);
    return null;
  } catch (error) {
    return error.message.replace(ENGINE_PREFIX, '');
  }
}

const ESCAPE = /\\([\s\S])/gu;
const TAKES_AN_ESCAPE = /[\p{L}\p{N}^$\\.*+?()[\]{}|/]/u;

function readsWithoutNeedlessEscapes(source, flags) {
  const plain = source.replace(ESCAPE, (escape, character) => (TAKES_AN_ESCAPE.test(character) ? escape : character));
  return engineReason(plain, flags) === null;
}

export function regexProblem(source, flags) {
  const later = laterEditionOf(source);
  if (later !== null) return later;
  const reason = engineReason(source, flags);
  if (reason === null) return null;
  return { reason, habit: readsWithoutNeedlessEscapes(source, flags) ? 'escape' : null };
}

const NEEDED_ESCAPES = 'a backslash stands before `^ $ \\ . * + ? ( ) [ ] { } | /`, a letter of a class such as `\\d`, and `-` in brackets';
const REPAIRS = {
  flags: { literal: 'the flags follow the closing quote, `#"error"i`', text: 'the flags are the input `flags` of `toRegex`, `toRegex "i"`' },
  escape: { literal: `${NEEDED_ESCAPES}, and \`\\"\` writes a quote`, text: NEEDED_ESCAPES }
};

export function regexRefusal(source, flags, { reason, habit }) {
  const said = `\`${regexLiteral(source, flags)}\` is no regex: ${reason}`;
  return habit === null ? said : `${said}; ${REPAIRS[habit].literal}`;
}

export function textRefusal({ reason, habit }) {
  return habit === null ? reason : `${reason}; ${REPAIRS[habit].text}`;
}

export function regexLiteral(source, flags) {
  let body = '';
  for (let at = 0; at < source.length; at++) {
    if (source[at] === '\\') body += source[at] + source[++at];
    else body += source[at] === '"' ? '\\"' : source[at];
  }
  return `#"${body}"${flags}`;
}

export function canonicalFlags(written) {
  const letters = [...written];
  if (letters.some((letter, index) => !REGEX_FLAGS.includes(letter) || letters.indexOf(letter) !== index)) return null;
  return [...REGEX_FLAGS].filter(flag => letters.includes(flag)).join('');
}
