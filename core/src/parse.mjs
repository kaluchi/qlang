// The one caller of the generated parser: `parse` answers the tree of a
// source or throws a `ParseError`, and the tools that read the tree
// through walk.mjs, the editor's hover, completion and references among
// them, find on it:
//   - an .id on each node, counted within the parse
//   - a .parent on each node but the root
//   - the source on the root as .source, and its name as .uri, a file
//     path, 'inline' or 'cell-N'
//   - .comments on the root, the plain comments the grammar read as
//     whitespace [QSSYN#comment], in the order of the source

import {
  parse as peggyParse
} from '../gen/grammar.mjs';
import { assignAstNodeIds, attachAstParents } from './walk.mjs';


// ParseError mirrors peggy's syntactic-failure shape into a qlang
// surface. `expected` is the Vec of `{ type, description, text }`
// alternatives peggy enumerated at the failure offset (raw shape
// from `peg$buildStructuredError`); `found` is the unexpected
// substring at the offset (one character for char-class mismatches,
// `null` for end-of-input); `source` is the verbatim input text
// so that downstream consumers (CLI caret-pointer, LSP diagnostic)
// can quote the offending span without re-reading the file;
// `sentence` is what a source cut short with a bracket left open is
// told, beside the closers in `expected` [QSSYN#refusal].
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

// parse(source, opts?) → AST root node
//
// opts:
//   uri — string identifier for the source (file path,
//         'inline', 'cell-N'). Defaults to 'inline'.
//
// Throws ParseError on syntactic failure. The AST is a tree of
// plain JS objects with a `type` field; see grammar.peggy for the
// catalog of node types. Every node carries .location, .text, .id,
// and (except the root) .parent. The root additionally carries
// .source, .uri and .comments.
export function parse(source, opts = {}) {
  if (typeof source !== 'string') {
    throw new ParseError(
      'parse() expects a string source',
      null,
      opts.uri ?? null
    );
  }
  const commentTrivia = new Map();
  let ast;
  try {
    ast = peggyParse(source, { commentTrivia });
  } catch (err) {
    // A refusal the grammar writes holds its own sentence; a failure where
    // the source ends names what completes it [QSSYN#refusal].
    const atTheEnd = err.expected !== null && err.found === null;
    const unclosed = atTheEnd ? bracketLeftOpen(source) : null;
    const sentence = unclosed?.message ?? (atTheEnd ? stepMissedAtTheEnd(source) : undefined);
    throw new ParseError(sentence ?? err.message, err.location, opts.uri ?? null, {
      expected: unclosed?.expected ?? err.expected,
      found: err.found,
      source,
      sentence
    });
  }
  // Post-pass decoration: AST parent pointers and ids first, so the
  // root receives .parent = null and id 0, then the root's metadata.
  attachAstParents(ast);
  assignAstNodeIds(ast);
  ast.source = source;
  ast.uri = opts.uri ?? 'inline';
  ast.comments = [...commentTrivia.values()].sort((left, right) => left.location.start.offset - right.location.start.offset);
  return ast;
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

// The tree of a source, or the closers the parser expects where a source
// cut short stops, in the order of `OPENERS_BY_CLOSER`; none where it
// stops before its end, which no closer written after it completes.
function attemptOf(candidate) {
  try {
    return { tree: peggyParse(candidate, { commentTrivia: new Map() }), closers: [] };
  } catch (refusal) {
    if (refusal.location.start.offset !== candidate.length) return { tree: null, closers: [] };
    const expected = new Set(refusal.expected.map(alternative => alternative.text));
    return { tree: null, closers: [...OPENERS_BY_CLOSER.keys()].filter(closer => expected.has(closer)) };
  }
}

// The step a source that ends with a combinator misses, `[1] |` and
// `[1] !|` [QSSYN#combinator].
function stepMissedAtTheEnd(source) {
  const combinator = /(?:^|\s)(!?\|)\s*$/.exec(source)?.[1];
  return combinator === undefined ? undefined : `\`${combinator}\` joins two steps, and the step after it is missing`;
}

// The shortest run of closers that completes a source, each a closer the
// parser expects where the source stops, with the tree the completed
// source parses to, or null when none within CLOSER_DEPTH does.
function completionOf(source) {
  let frontier = [{ run: [], closers: attemptOf(source).closers }];
  for (let depth = 1; depth <= CLOSER_DEPTH && frontier.length > 0; depth++) {
    const next = [];
    for (const { run, closers } of frontier) {
      for (const closer of closers) {
        const extended = [...run, closer];
        const attempt = attemptOf(source + extended.join(''));
        if (attempt.tree !== null) return { closers: extended, tree: attempt.tree };
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

// The innermost node that ends at `offset` and opens with one of
// `openers`: nodes that end together nest, and the walk meets the outer
// before the inner.
function nodeClosedAt(tree, offset, openers) {
  let found = null;
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node.text === 'string' && node.location.end.offset === offset
      && openers.some(opener => node.text.startsWith(opener))) found = node;
    for (const value of Object.values(node)) visit(value);
  };
  visit(tree);
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
  const opened = nodeClosedAt(completion.tree, source.length + innermostCloser.length, openers);
  if (opened === null) return null;
  const opener = openers.find(candidate => opened.text.startsWith(candidate));
  const { line, column } = opened.location.start;
  return {
    message: `\`${opener}\` opened at line ${line}, column ${column} is never closed; \`${completion.closers.join('')}\` completes the source`,
    expected: [{ type: 'literal', text: innermostCloser }]
  };
}
