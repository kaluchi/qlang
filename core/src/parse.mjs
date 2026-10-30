// [QSQUO#step]

import {
  parse as peggyParse,
  SyntaxError as PeggySyntaxError
} from '../gen/grammar.mjs';
import { keepParts } from './parsed-parts.mjs';


// [QSSYN#refusal]
export class SourceParseError extends Error {
  constructor(message, location, uri = null, opts = {}) {
    super(message);
    this.name = 'SourceParseError';
    this.location = location;
    this.uri = uri;
    this.expected = opts.expected ?? null;
    this.found = opts.found ?? null;
    this.source = opts.source ?? null;
    this.sentence = opts.sentence ?? null;
  }
}

export function parseSource(source, opts = {}) {
  if (typeof source !== 'string') {
    throw new SourceParseError(
      'a source is a string: the host handed a value of another kind',
      null,
      opts.uri ?? null
    );
  }
  const commentTrivia = new Map();
  const uri = opts.uri ?? 'inline';
  const read = { commentTrivia, grammarSource: uri };
  let root;
  try {
    root = peggyParse(source, read);
  } catch (err) {
    // [QSQUO#step], [QSSYN#refusal]
    if (!(err instanceof PeggySyntaxError)) throw err;
    const atTheEnd = err.expected !== null && err.found === null;
    const missed = atTheEnd ? read.stepMissed : undefined;
    const unclosed = missed === undefined && (atTheEnd || (err.expected !== null && source.includes(COMMENT_OPENER))) ? bracketLeftOpen(source) : null;
    const sentence = missed !== undefined ? `\`${missed}\` joins two steps, and the step after it is missing` : unclosed?.message ?? spaceNotRead(err);
    const location = unclosed === null || atTheEnd ? err.location : endOf(source, err.location.source);
    throw new SourceParseError(sentence ?? (err.expected === null ? err.message : expectedSentence(err.expected, err.found)), location, opts.uri ?? null, {
      expected: unclosed?.expected ?? err.expected,
      found: unclosed === null ? err.found : null,
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
function spaceNotRead({ expected, found }) {
  if (expected === null || found === null || !/^\s$/u.test(found) || /^[ \t\n\r]$/.test(found)) return undefined;
  const codePoint = `U+${found.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
  return `${codePoint} is a space of Unicode that qlang reads as no whitespace: its whitespace is a space, a tab or a line break`;
}

function endOf(source, grammarSource) {
  const lines = source.split('\n');
  const end = { offset: source.length, line: lines.length, column: lines[lines.length - 1].length + 1 };
  return { source: grammarSource, start: end, end };
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

const COMMENT_OPENER = '|~';
const COMMENT_CLOSER = '~|';

const OPENERS_BY_CLOSER = new Map([
  [')', ['~(', '(']],
  [']', ['#[', '[']],
  ['}', ['!{', '{']],
  ['~~|', ['|~~']],
  [COMMENT_CLOSER, [COMMENT_OPENER]],
  ['"', ['"']]
]);
const CLOSER_DEPTH = 4;

// [QSQUO#step], [QSSYN#refusal]
function attemptOf(candidate) {
  const read = { commentTrivia: new Map(), nestedBlocks: new Map() };
  try {
    return { root: peggyParse(candidate, read), read, closers: [] };
  } catch (refusal) {
    if (!(refusal instanceof PeggySyntaxError)) throw refusal;
    const expected = new Set(refusal.location.start.offset === candidate.length ? refusal.expected.map(alternative => alternative.text) : []);
    if (candidate.includes(COMMENT_OPENER)) expected.add(COMMENT_CLOSER);
    return { root: null, closers: [...OPENERS_BY_CLOSER.keys()].filter(closer => expected.has(closer)) };
  }
}

// [QSSYN#refusal]
function blockClosedAt({ commentTrivia, nestedBlocks }, offset) {
  for (const { location } of commentTrivia.values()) if (location.end.offset === offset) return location.start;
  return nestedBlocks.get(offset) ?? null;
}

function completionOf(source) {
  let frontier = [{ run: [], closers: attemptOf(source).closers }];
  for (let depth = 1; depth <= CLOSER_DEPTH && frontier.length > 0; depth++) {
    const next = [];
    for (const { run, closers } of frontier) {
      for (const closer of closers) {
        const extended = [...run, closer];
        const attempt = attemptOf(source + extended.join(''));
        if (attempt.root !== null) return { closers: extended, root: attempt.root, read: attempt.read };
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
  const closedAt = source.length + innermostCloser.length;
  const opened = partClosedAt(completion.root, completed, closedAt, openers)?.span.start ?? blockClosedAt(completion.read, closedAt);
  if (opened === null) return null;
  const opener = openers.find(candidate => completed.startsWith(candidate, opened.offset));
  const { line, column } = opened;
  return {
    message: `\`${opener}\` opened at line ${line}, column ${column} is never closed; \`${completion.closers.join('')}\` completes the source`,
    expected: [{ type: 'literal', text: innermostCloser }]
  };
}
