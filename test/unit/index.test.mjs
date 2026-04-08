// Public-API smoke test for src/index.mjs.

import { describe, it, expect } from 'vitest';
import {
  parse,
  evalQuery,
  evalAst,
  langRuntime,
  createSession,
  serializeSession,
  deserializeSession
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
});
