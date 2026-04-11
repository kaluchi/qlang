// Public-API smoke test for src/index.mjs.

import { describe, it, expect } from 'vitest';
import {
  parse,
  ParseError,
  evalQuery,
  evalAst,
  langRuntime,
  createSession,
  serializeSession,
  deserializeSession,
  walkAst,
  astChildrenOf,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes,
  toTaggedJSON,
  fromTaggedJSON,
  QlangError,
  QlangTypeError,
  ArityError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  EffectLaunderingError,
  EffectLaunderingAtLetParse,
  EffectLaunderingAtCall,
  QlangInvariantError,
  classifyEffect,
  EFFECT_MARKER_PREFIX,
  keyword
} from '../../src/index.mjs';

describe('public API', () => {
  it('exports parse', () => {
    expect(typeof parse).toBe('function');
    const ast = parse('42');
    expect(ast.type).toBe('NumberLit');
    expect(ast.value).toBe(42);
  });

  it('exports evalQuery', () => {
    expect(typeof evalQuery).toBe('function');
    expect(evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('exports evalAst', () => {
    expect(typeof evalAst).toBe('function');
  });

  it('exports langRuntime as a Map factory', () => {
    expect(typeof langRuntime).toBe('function');
    const rt = langRuntime();
    expect(rt).toBeInstanceOf(Map);
    expect(rt.size).toBeGreaterThan(20);
  });

  it('exports createSession / serializeSession / deserializeSession', () => {
    expect(typeof createSession).toBe('function');
    expect(typeof serializeSession).toBe('function');
    expect(typeof deserializeSession).toBe('function');
  });

  it('exports the AST traversal primitives from walk.mjs', () => {
    expect(typeof walkAst).toBe('function');
    expect(typeof astChildrenOf).toBe('function');
    expect(typeof findAstNodeAtOffset).toBe('function');
    expect(typeof findIdentifierOccurrences).toBe('function');
    expect(typeof bindingNamesVisibleAt).toBe('function');
    expect(typeof astNodeSpan).toBe('function');
    expect(typeof astNodeContainsOffset).toBe('function');
    expect(typeof triviaBetweenAstNodes).toBe('function');
  });

  it('exports the tagged-JSON value codec', () => {
    expect(typeof toTaggedJSON).toBe('function');
    expect(typeof fromTaggedJSON).toBe('function');
  });

  it('exports the error hierarchy for instanceof checks', () => {
    expect(typeof QlangError).toBe('function');
    expect(typeof QlangTypeError).toBe('function');
    expect(typeof ArityError).toBe('function');
    expect(typeof UnresolvedIdentifierError).toBe('function');
    expect(typeof DivisionByZeroError).toBe('function');
    expect(typeof ParseError).toBe('function');
    expect(typeof EffectLaunderingError).toBe('function');
    expect(typeof EffectLaunderingAtLetParse).toBe('function');
    expect(typeof EffectLaunderingAtCall).toBe('function');
    expect(typeof QlangInvariantError).toBe('function');
  });

  it('exports the effect-marker classification surface', () => {
    expect(typeof classifyEffect).toBe('function');
    expect(EFFECT_MARKER_PREFIX).toBe('@');
  });

  it('exports keyword as the interning constructor', () => {
    expect(typeof keyword).toBe('function');
    const a = keyword('count');
    const b = keyword('count');
    expect(a).toBe(b); // interning: same name → same identity
    expect(a.name).toBe('count');
    // langRuntime() Map can be queried with the interned keyword.
    const rt = langRuntime();
    expect(rt.has(keyword('count'))).toBe(true);
  });
});
