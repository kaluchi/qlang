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
//   - stamps a .parsedAt epoch ms on the root
//   - records .schemaVersion for forward-compat AST evolution

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
// can quote the offending span without re-reading the file.
export class ParseError extends Error {
  constructor(message, location, uri = null, opts = {}) {
    super(message);
    this.name = 'ParseError';
    this.location = location;
    this.uri = uri;
    this.expected = opts.expected ?? null;
    this.found = opts.found ?? null;
    this.source = opts.source ?? null;
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
// .source, .uri, .parseId, .parsedAt, .schemaVersion.
export function parse(source, opts = {}) {
  if (typeof source !== 'string') {
    throw new ParseError(
      'parse() expects a string source',
      null,
      opts.uri ?? null
    );
  }
  let ast;
  try {
    ast = peggyParse(source, opts.startRule ? { startRule: opts.startRule } : undefined);
  } catch (err) {
    throw new ParseError(err.message, err.location, opts.uri ?? null, {
      expected: err.expected,
      found: err.found,
      source
    });
  }
  // Post-pass decoration: AST parent pointers and ids first (so the
  // root receives .parent = null and id 0), then effect-marker
  // decoration so every OperandCall/conduit declaration/snapshot declaration/Projection node
  // carries a structured `.effectful` field, then root metadata,
  // then semantic validation that depends on the decorated tree.
  attachAstParents(ast);
  assignAstNodeIds(ast);
  decorateAstWithEffectMarkers(ast);
  ast.source = source;
  ast.uri = opts.uri ?? 'inline';
  ast.parseId = ++parseCounter;
  ast.parsedAt = Date.now();
  ast.schemaVersion = AST_SCHEMA_VERSION;
  return ast;
}
