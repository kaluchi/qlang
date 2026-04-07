// Parser entry point. Wraps the peggy-generated parser to give us
// a small, stable API and a uniform error type.

import { parse as peggyParse, SyntaxError as PeggySyntaxError } from './grammar.generated.mjs';

export class ParseError extends Error {
  constructor(message, location) {
    super(message);
    this.name = 'ParseError';
    this.location = location;
  }
}

// parse(source) → AST root node
//
// Throws ParseError on syntactic failure. The AST is a tree of
// plain JS objects with a `type` field; see grammar.peggy for the
// catalog of node types.
export function parse(source) {
  if (typeof source !== 'string') {
    throw new ParseError('parse() expects a string source', null);
  }
  try {
    return peggyParse(source);
  } catch (err) {
    if (err instanceof PeggySyntaxError) {
      throw new ParseError(err.message, err.location ?? null);
    }
    throw err;
  }
}
