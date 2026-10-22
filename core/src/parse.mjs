// [QSQUO#step]

import {
  parse as peggyParse,
  SyntaxError as PeggySyntaxError
} from '../gen/grammar.mjs';
import { keepParts } from './walk.mjs';


// [QSSYN#refusal]
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
    // [QSQUO#step], [QSSYN#refusal]
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

// [QSSYN#refusal]
export function nameOfContinuation(alternative) {
  if (alternative.type === 'end') return 'end-of-source';
  return alternative.type === 'any' ? 'any-character' : alternative.description;
}

function expectedSentence(expected, found) {
  const named = [...new Set(expected.map(alternative => (alternative.type === 'literal' ? JSON.stringify(alternative.text) : nameOfContinuation(alternative))))].sort();
  const listed = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
  return `Expected ${listed} but ${found === null ? nameOfContinuation({ type: 'end' }) : JSON.stringify(found)} found.`;
}

const OPENERS_BY_CLOSER = new Map([
  [')', ['~(', '(']],
  [']', ['#[', '[']],
  ['}', ['!{', '{']],
  ['~~|', ['|~~']],
  ['"', ['"']]
]);
const CLOSER_DEPTH = 4;

// [QSQUO#step]
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

// [QSSYN#combinator]
function stepMissedAtTheEnd(source) {
  const combinator = /(?:^|\s)(!?\|)\s*$/.exec(source)?.[1];
  return combinator === undefined ? undefined : `\`${combinator}\` joins two steps, and the step after it is missing`;
}

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

export function closersCompleting(source) {
  return completionOf(source)?.closers ?? null;
}

function partClosedAt(root, completed, offset, openers) {
  let found = null;
  const visit = read => {
    if (read.span.end.offset === offset && openers.some(opener => completed.startsWith(opener, read.span.start.offset))) found = read;
    read.parts.forEach(visit);
  };
  visit(root);
  return found;
}

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
