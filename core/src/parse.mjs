// The one caller of the generated parser: `parse` answers the quote of a
// source, the records of its steps, or throws a `ParseError`; the parts it
// read stand beside the records in walk.mjs, the root holding the source,
// its uri and the comments the grammar read as whitespace, in the order of
// the source [QSQUO#step].

import {
  parse as peggyParse,
  SyntaxError as PeggySyntaxError
} from '../gen/grammar.mjs';
import { keepParts } from './walk.mjs';


// The refusal of a source [QSSYN#refusal]: `location` holds its place, `uri`
// the name the caller gives the source or null, `source` the text,
// `expected` the alternatives the parser expected there, the closer a reader
// writes next where a bracket is left open, `found` the character found
// there, null at the end of the source, the two null where the grammar
// writes the refusal, and `sentence` what a source cut short is told.
export class ParseError extends Error {
  constructor(message, location, uri = null, opts = {}) {
    super(message);
    this.name = 'ParseError';
    this.location = location;
    this.uri = uri;
    this.expected = opts.expected ?? null;
    this.found = opts.found ?? null;
    this.source = opts.source ?? null;
    this.sentence = opts.sentence ?? null;
  }
}

// parse(source, opts?) → the quote of the source, `opts.uri` naming it, a
// file path, a cell, `inline` where the caller names none.
export function parse(source, opts = {}) {
  if (typeof source !== 'string') {
    throw new ParseError(
      'parse() expects a string source',
      null,
      opts.uri ?? null
    );
  }
  const commentTrivia = new Map();
  const uri = opts.uri ?? 'inline';
  let root;
  try {
    root = peggyParse(source, { commentTrivia, grammarSource: uri });
  } catch (err) {
    // A throw of the parser that is no refusal of the text passes as it is
    // [QSQUO#step]; a refusal the grammar writes holds its own sentence, and a
    // failure where the source ends names what completes it [QSSYN#refusal].
    if (!(err instanceof PeggySyntaxError)) throw err;
    const atTheEnd = err.expected !== null && err.found === null;
    const unclosed = atTheEnd ? bracketLeftOpen(source) : null;
    const sentence = unclosed?.message ?? (atTheEnd ? stepMissedAtTheEnd(source) : undefined);
    throw new ParseError(sentence ?? (err.expected === null ? err.message : expectedSentence(err.expected, err.found)), err.location, opts.uri ?? null, {
      expected: unclosed?.expected ?? err.expected,
      found: err.found,
      source,
      sentence
    });
  }
  root.source = source;
  root.uri = uri;
  root.comments = [...commentTrivia.values()].sort((left, right) => left.location.start.offset - right.location.start.offset);
  return keepParts(root).value;
}

// nameOfContinuation(alternative) → the name the language gives a continuation
// no literal is: the end of the source, any character, or a rule's name [QSSYN#refusal].
export function nameOfContinuation(alternative) {
  if (alternative.type === 'end') return 'end-of-source';
  return alternative.type === 'any' ? 'any-character' : alternative.description;
}

// The sentence of a failure no rule of the grammar writes: the continuations
// as `:expected` names them, a literal in its quotes, and what it met [QSSYN#refusal].
function expectedSentence(expected, found) {
  const named = [...new Set(expected.map(alternative => (alternative.type === 'literal' ? JSON.stringify(alternative.text) : nameOfContinuation(alternative))))].sort();
  const listed = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
  return `Expected ${listed} but ${found === null ? nameOfContinuation({ type: 'end' }) : JSON.stringify(found)} found.`;
}

// ── the bracket a source left open [QSSYN#refusal] ─────────────────────────

// Each closer with the openers it closes.
const OPENERS_BY_CLOSER = new Map([
  [')', ['~(', '(']],
  [']', ['#[', '[']],
  ['}', ['!{', '{']],
  ['~~|', ['|~~']],
  ['"', ['"']]
]);
const CLOSER_DEPTH = 4;

// The parts of a source, or the closers the parser expects where a source
// cut short stops, in the order of `OPENERS_BY_CLOSER`, none where it stops
// before its end, a throw that is no refusal passing as it is [QSQUO#step].
function attemptOf(candidate) {
  try {
    return { root: peggyParse(candidate, { commentTrivia: new Map() }), closers: [] };
  } catch (refusal) {
    if (!(refusal instanceof PeggySyntaxError)) throw refusal;
    if (refusal.location.start.offset !== candidate.length) return { root: null, closers: [] };
    const expected = new Set(refusal.expected.map(alternative => alternative.text));
    return { root: null, closers: [...OPENERS_BY_CLOSER.keys()].filter(closer => expected.has(closer)) };
  }
}

// The step a source that ends with a combinator misses, `[1] |` and
// `[1] !|` [QSSYN#combinator].
function stepMissedAtTheEnd(source) {
  const combinator = /(?:^|\s)(!?\|)\s*$/.exec(source)?.[1];
  return combinator === undefined ? undefined : `\`${combinator}\` joins two steps, and the step after it is missing`;
}

// The shortest run of closers that completes a source, each a closer the
// parser expects where the source stops, with the parts the completed
// source reads as, or null when none within CLOSER_DEPTH does.
function completionOf(source) {
  let frontier = [{ run: [], closers: attemptOf(source).closers }];
  for (let depth = 1; depth <= CLOSER_DEPTH && frontier.length > 0; depth++) {
    const next = [];
    for (const { run, closers } of frontier) {
      for (const closer of closers) {
        const extended = [...run, closer];
        const attempt = attemptOf(source + extended.join(''));
        if (attempt.root !== null) return { closers: extended, root: attempt.root };
        next.push({ run: extended, closers: attempt.closers });
      }
    }
    frontier = next;
  }
  return null;
}

// closersCompleting(source) → the shortest run of closers that
// completes a source, or null.
export function closersCompleting(source) {
  return completionOf(source)?.closers ?? null;
}

// The innermost part of a completed source that ends at `offset` and opens
// with one of `openers`: parts that end together nest, and the walk meets
// the outer before the inner.
function partClosedAt(root, completed, offset, openers) {
  let found = null;
  const visit = read => {
    if (read.span.end.offset === offset && openers.some(opener => completed.startsWith(opener, read.span.start.offset))) found = read;
    read.parts.forEach(visit);
  };
  visit(root);
  return found;
}

// The bracket a source cut short left open: the closers that complete
// it, the first of them the one a reader writes next, and where the
// innermost opened; null when no run of closers completes it.
function bracketLeftOpen(source) {
  const completion = completionOf(source);
  if (completion === null) return null;
  const [innermostCloser] = completion.closers;
  const openers = OPENERS_BY_CLOSER.get(innermostCloser);
  const completed = source + completion.closers.join('');
  const opened = partClosedAt(completion.root, completed, source.length + innermostCloser.length, openers);
  if (opened === null) return null;
  const opener = openers.find(candidate => completed.startsWith(candidate, opened.span.start.offset));
  const { line, column } = opened.span.start;
  return {
    message: `\`${opener}\` opened at line ${line}, column ${column} is never closed; \`${completion.closers.join('')}\` completes the source`,
    expected: [{ type: 'literal', text: innermostCloser }]
  };
}
