// Tests for error/catch/isError operands + propagation edge cases.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

// ── error operand ──────────────────────────────────────────────

describe('error operand', () => {
  it('bare form wraps pipeValue Map', () => {
    const result = evalQuery('{:kind :oops} | error | catch | /kind');
    expect(result).toEqual(keyword('oops'));
  });

  it('on non-Map produces type error', () => {
    const result = evalQuery('42 | error | catch | /thrown');
    expect(result).toEqual(keyword('ErrorDescriptorNotMap'));
  });
});

// ── isError operand ─────────────────────────────────────────────

describe('isError operand', () => {
  it('with captured args produces arity error', () => {
    const result = evalQuery('42 | isError(1) | catch | /kind');
    expect(result).toEqual(keyword('arity-error'));
  });
});

// ── catch pass-through ──────────────────────────────────────────

describe('catch pass-through', () => {
  it('pass-through for nil', () => {
    const result = evalQuery('nil | catch');
    expect(result).toBeNull();
  });

  it('pass-through for Map', () => {
    const result = evalQuery('{:a 1} | catch');
    expect(result instanceof Map).toBe(true);
    expect(result.get(keyword('a'))).toBe(1);
  });
});

// ── propagation ─────────────────────────────────────────────────

describe('error propagation', () => {
  it('propagates through ParenGroup', () => {
    const result = evalQuery('!{:kind :oops} | (catch | /kind)');
    expect(result).toEqual(keyword('oops'));
  });

  it('propagates through conduit with catch', () => {
    const result = evalQuery('let(:handler, catch(/kind)) | !{:kind :oops} | handler');
    expect(result).toEqual(keyword('oops'));
  });

  it('error in distribute per-element: only string+10 fails', () => {
    const result = evalQuery('[1 "x" 3] * add(10) | filter(isError) | count');
    expect(result).toBe(1);
  });

  it('comments are silent in propagation', () => {
    const result = evalQuery('!{:kind :oops} |~| comment\n count | catch | /trail');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('count');
  });
});

// ── sourceOfAst ─────────────────────────────────────────────────

describe('sourceOfAst', () => {
  it('renders ErrorLit source via reify', () => {
    const result = evalQuery('let(:x, !{:a 1}) | reify(:x) | /source');
    expect(result).toBe('!{:a 1}');
  });
});

// ── EffectLaunderingAtCall ──────────────────────────────────────

describe('EffectLaunderingAtCall', () => {
  it('calling non-@-prefixed name resolving to effectful conduit produces error', () => {
    // Install an @-prefixed conduit under a non-@-prefixed name via session.bind.
    // This simulates the laundering path (via use, as, or session injection)
    // that the parse-time AST check cannot detect.
    const s = createSession();
    s.evalCell('let(:@myCount, count)');
    const effectfulConduit = s.env.get(keyword('@myCount'));
    s.bind('doIt', effectfulConduit);
    const entry = s.evalCell('[1 2 3] | doIt');
    expect(isErrorValue(entry.result)).toBe(true);
    expect(entry.result.descriptor.get(keyword('kind'))).toEqual(keyword('effect-laundering'));
  });
});

describe('sourceOfAst coverage for rare node types', () => {
  it('renders bare OperandCall (no args)', () => {
    expect(evalQuery('let(:x, count) | reify(:x) | /source')).toBe('count');
  });

  it('renders LinePlainComment in conduit body', () => {
    const r = evalQuery('let(:x, (42 |~| note\n)) | reify(:x) | /source');
    expect(r).toContain('|~|');
  });

  it('renders BlockDocComment in conduit body', () => {
    const r = evalQuery('|~~ doc ~~| let(:x, 42) | reify(:x) | /docs | first');
    expect(typeof r).toBe('string');
    expect(r).toContain('doc');
  });

  it('renders ErrorLit in conduit body', () => {
    expect(evalQuery('let(:x, !{:a 1}) | reify(:x) | /source')).toBe('!{:a 1}');
  });
});

describe('json operand on error values inside containers', () => {
  it('renders error value as $error wrapper when inside Vec', () => {
    // [1 "x" 3] * add(10) produces [11 error 13]; json renders the Vec
    const r = evalQuery('[1 "x" 3] * add(10) | json');
    expect(typeof r).toBe('string');
    expect(r).toContain('$error');
  });
});

describe('runExamples error value without originalError', () => {
  it('reports error from descriptor message when no originalError', () => {
    const s = createSession();
    const r = s.evalCell('{:kind :builtin :examples ["error({:kind :oops :message \\"boom\\"}) → 42"]} | runExamples | first | /ok');
    expect(r.result).toBe(false);
  });
});
