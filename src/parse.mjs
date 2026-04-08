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
  parse as peggyParse,
  SyntaxError as PeggySyntaxError
} from './grammar.generated.mjs';
import { assignAstNodeIds, attachAstParents } from './walk.mjs';
import {
  decorateAstWithEffectMarkers,
  validateEffectMarkers
} from './effect-check.mjs';

let parseCounter = 0;
const AST_SCHEMA_VERSION = 1;

export class ParseError extends Error {
  constructor(message, location, uri = null) {
    super(message);
    this.name = 'ParseError';
    this.location = location;
    this.uri = uri;
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
    ast = peggyParse(source);
  } catch (err) {
    if (err instanceof PeggySyntaxError) {
      throw new ParseError(err.message, err.location ?? null, opts.uri ?? null);
    }
    throw err;
  }
  // Post-pass decoration: AST parent pointers and ids first (so the
  // root receives .parent = null and id 0), then effect-marker
  // decoration so every OperandCall/LetStep/AsStep/Projection node
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
  // @-effect-marker invariant: see src/effect-check.mjs. Throws
  // EffectLaunderingAtLetParse with the offending binding's source
  // location on violation; that error is a QlangError, not a
  // ParseError, so callers can distinguish syntactic from semantic
  // failures via instanceof / .kind.
  validateEffectMarkers(ast);
  return ast;
}
