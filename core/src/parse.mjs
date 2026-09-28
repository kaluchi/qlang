// Parser entry point. Wraps the peggy-generated parser to give us
// a small, stable API and a uniform `ParseError` type, plus
// source-mapping metadata on the AST root and per-node ids/parents
// that downstream tooling (editor hover, autocomplete, refactor,
// session restore) consumes via walk.mjs.
//
// Every parse:
//   - assigns each node a stable .id (counter, monotonic per parse)
//   - attaches a .parent pointer to each non-root node
//   - records the original source string on the root as .source
//   - records the source uri (file path or 'inline'/'repl-cell-N')
//     as .uri
//   - records a per-process .parseId for cross-parse identity
//   - records .schemaVersion for forward-compat AST evolution
//   - records .comments, the plain comments the grammar read as
//     whitespace [D81], in the order of the source, for the tools

import {
  parse as peggyParse
} from '../gen/grammar.mjs';
import { assignAstNodeIds, attachAstParents } from './walk.mjs';
import { decorateAstWithEffectMarkers } from './effect-check.mjs';

let parseCounter = 0;
const AST_SCHEMA_VERSION = 1;

// ParseError mirrors peggy's syntactic-failure shape into a qlang
// surface. `expected` is the Vec of `{ type, description, text }`
// alternatives peggy enumerated at the failure offset (raw shape
// from `peg$buildStructuredError`); `found` is the unexpected
// substring at the offset (one character for char-class mismatches,
// `null` for end-of-input); `source` is the verbatim input text
// so that downstream consumers (CLI caret-pointer, LSP diagnostic)
// can quote the offending span without re-reading the file;
// `sentence` is what a source cut short with a bracket left open is
// told, beside the closers in `expected` [D125].
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
//         'inline', 'repl-cell-N', etc.). Defaults to 'inline'.
//
// Throws ParseError on syntactic failure. The AST is a tree of
// plain JS objects with a `type` field; see grammar.peggy for the
// catalog of node types. Every node carries .location, .text, .id,
// and (except the root) .parent. The root additionally carries
// .source, .uri, .parseId, .schemaVersion.
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
    const unclosed = err.found === null ? bracketLeftOpen(source) : null;
    throw new ParseError(unclosed?.message ?? err.message, err.location, opts.uri ?? null, {
      expected: unclosed?.expected ?? err.expected,
      found: err.found,
      source,
      sentence: unclosed?.message
    });
  }
  // Post-pass decoration: AST parent pointers and ids first (so the
  // root receives .parent = null and id 0), then effect-marker
  // decoration so every OperandCall and Projection node carries a
  // structured `.effectful` field that downstream consumers read
  // without re-derivation; root metadata; finally any semantic
  // validation that depends on the decorated tree.
  attachAstParents(ast);
  assignAstNodeIds(ast);
  decorateAstWithEffectMarkers(ast);
  ast.source = source;
  ast.uri = opts.uri ?? 'inline';
  ast.parseId = ++parseCounter;
  ast.schemaVersion = AST_SCHEMA_VERSION;
  ast.comments = [...commentTrivia.values()].sort((left, right) => left.location.start.offset - right.location.start.offset);
  return ast;
}

// ── the bracket a source left open [D125] ─────────────────────────

// Each closer with the openers it closes.
const OPENERS_BY_CLOSER = new Map([
  [')', ['~(', '(']],
  [']', ['#[', '[']],
  ['}', ['!{', '{']],
  ['~~|', ['|~~']],
  ['"', ['"']]
]);
const CLOSER_DEPTH = 4;

// The tree of a source, or null when it does not parse.
function treeOf(candidate) {
  try {
    return peggyParse(candidate, { commentTrivia: new Map() });
  } catch {
    return null;
  }
}

// The shortest run of closers that completes a source, with the tree the
// completed source parses to, or null when none within CLOSER_DEPTH does.
function completionOf(source) {
  let runs = [[]];
  for (let depth = 1; depth <= CLOSER_DEPTH; depth++) {
    runs = runs.flatMap(run => [...OPENERS_BY_CLOSER.keys()].map(closer => [...run, closer]));
    for (const run of runs) {
      const tree = treeOf(source + run.join(''));
      if (tree !== null) return { closers: run, tree };
    }
  }
  return null;
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
