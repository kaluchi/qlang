// The patterns of text: a source the engine of the host reads as it is
// written, in the dialect of ECMAScript every engine of the core shares,
// with the flags `i`, `m` and `s`, and always by code points, as Unicode
// reads characters.
// The decisions it exists for: [D246].

// The flags a pattern may take, in the order they are written.
export const PATTERN_FLAGS = 'ims';

// engineOf(source, flags, extra?) → the expression of the engine a pattern
// reads as, `extra` the flags of a reading, `g` for every match.
export function engineOf(source, flags, extra = '') {
  return new RegExp(source, `u${flags}${extra}`);
}

// patternProblem(source, flags) → what the engine says of a source it
// cannot read, or null for one it reads.
export function patternProblem(source, flags) {
  try {
    engineOf(source, flags);
    return null;
  } catch (error) {
    return error.message;
  }
}

// patternRefusal(source, flags, problem) → the sentence that refuses a
// source the engine does not read: what the engine says, and the habit of
// another dialect that wrote it where one shows, flags written inside the
// pattern or a backslash before a character that needs none.
export function patternRefusal(source, flags, problem) {
  const said = `\`${patternLiteral(source, flags)}\` is no pattern the engine reads: ${problem}`;
  if (/^\(\?[a-z]+\)/.test(source)) return `${said}; the flags follow the closing quote, \`#"error"i\``;
  if (/Invalid escape/.test(problem)) return `${said}; a backslash stands before \`^ $ \\ . * + ? ( ) [ ] { } | /\`, a letter of a class such as \`\\d\`, and \`-\` in brackets, and \`\\"\` writes a quote`;
  return said;
}

// patternLiteral(source, flags) → the literal a pattern writes: its source
// as the engine reads it, a quote in it written `\"`, which the literal
// reads back as the quote, and every backslash with the character after
// it as it stands.
export function patternLiteral(source, flags) {
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
  if (letters.some((letter, index) => !PATTERN_FLAGS.includes(letter) || letters.indexOf(letter) !== index)) return null;
  return [...PATTERN_FLAGS].filter(flag => letters.includes(flag)).join('');
}
