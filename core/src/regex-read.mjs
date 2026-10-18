// Reading a regex: a source the engine reads as it is written, in the
// dialect of ECMAScript of 2018 the engine reads alike on every platform,
// with the flags `i`, `m` and `s`, and always by code points, as Unicode
// reads characters.
// The rules it holds: [D362].

// The flags a regex may take, in the order they are written.
export const REGEX_FLAGS = 'ims';

// engineOf(source, flags, extra?) → the expression of the engine a regex
// reads as, `extra` the flags of a reading, `g` for every match.
export function engineOf(source, flags, extra = '') {
  return new RegExp(source, `u${flags}${extra}`);
}

// The offsets where the groups of a source open, read past its escapes
// and its classes.
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

// A group of flags, `(?i)` or `(?i:…)`, and the name of a group, `(?<y>…)`,
// each read where a group opens.
const FLAG_GROUP = /\(\?(?:[a-zA-Z]+(?:-[a-zA-Z]*)?|-[a-zA-Z]+)[:)]/y;
const GROUP_NAME = /\(\?<([^>=!][^>]*)>/y;

function readAt(expression, source, at) {
  expression.lastIndex = at;
  return expression.exec(source);
}

// What a source writes of an edition later than the dialect, which one
// engine reads and another refuses: a group of flags, and a group name
// written twice.
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

// What the engine says of a source it cannot read, its literal of the
// source cut, or null for one it reads.
const ENGINE_PREFIX = /^Invalid regular expression: (?:\/[\s\S]*\/[a-z]*: )?/;

function engineReason(source, flags) {
  try {
    engineOf(source, flags);
    return null;
  } catch (error) {
    return error.message.replace(ENGINE_PREFIX, '');
  }
}

// Whether the engine reads a source once each backslash goes that stands
// before a character no escape takes, `\-` or `\:`, the habit of a dialect
// that reads such an escape as the character.
const ESCAPE = /\\([\s\S])/gu;
const TAKES_AN_ESCAPE = /[\p{L}\p{N}^$\\.*+?()[\]{}|/]/u;

function readsWithoutNeedlessEscapes(source, flags) {
  const plain = source.replace(ESCAPE, (escape, character) => (TAKES_AN_ESCAPE.test(character) ? escape : character));
  return engineReason(plain, flags) === null;
}

// regexProblem(source, flags) → what keeps a source from being a regex,
// `{ reason, habit }`, its habit that of another dialect where one wrote it,
// `flags` or `escape`, or null for a regex.
export function regexProblem(source, flags) {
  const later = laterEditionOf(source);
  if (later !== null) return later;
  const reason = engineReason(source, flags);
  if (reason === null) return null;
  return { reason, habit: readsWithoutNeedlessEscapes(source, flags) ? 'escape' : null };
}

// The repair of each habit, for a literal and for a source given as text.
const NEEDED_ESCAPES = 'a backslash stands before `^ $ \\ . * + ? ( ) [ ] { } | /`, a letter of a class such as `\\d`, and `-` in brackets';
const REPAIRS = {
  flags: { literal: 'the flags follow the closing quote, `#"error"i`', text: 'the flags are the input `flags` of `toRegex`, `toRegex "i"`' },
  escape: { literal: `${NEEDED_ESCAPES}, and \`\\"\` writes a quote`, text: NEEDED_ESCAPES }
};

// regexRefusal(source, flags, problem) → the sentence that refuses a
// literal whose source is no regex: the reason, and the repair of the
// habit that wrote it where one shows.
export function regexRefusal(source, flags, { reason, habit }) {
  const said = `\`${regexLiteral(source, flags)}\` is no regex: ${reason}`;
  return habit === null ? said : `${said}; ${REPAIRS[habit].literal}`;
}

// textRefusal(problem) → what the refusal of a source given as text says.
export function textRefusal({ reason, habit }) {
  return habit === null ? reason : `${reason}; ${REPAIRS[habit].text}`;
}

// regexLiteral(source, flags) → the literal a regex writes: its source
// as the engine reads it, a quote in it written `\"`, which the literal
// reads back as the quote, and every backslash with the character after
// it as it stands.
export function regexLiteral(source, flags) {
  let body = '';
  for (let at = 0; at < source.length; at++) {
    if (source[at] === '\\') body += source[at] + source[++at];
    else body += source[at] === '"' ? '\\"' : source[at];
  }
  return `#"${body}"${flags}`;
}

// canonicalFlags(written) → the flags a literal writes, in their order,
// or null for a letter that is no flag or a flag written twice.
export function canonicalFlags(written) {
  const letters = [...written];
  if (letters.some((letter, index) => !REGEX_FLAGS.includes(letter) || letters.indexOf(letter) !== index)) return null;
  return [...REGEX_FLAGS].filter(flag => letters.includes(flag)).join('');
}
