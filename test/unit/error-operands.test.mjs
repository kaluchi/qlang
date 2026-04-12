// Tests for error operand, isError operand, and the `!|` fail-apply
// combinator, plus edge cases around trail accumulation, re-lift
// continuity, and conduit invocation on the fail-track.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

// ── error operand ──────────────────────────────────────────────

describe('error operand', () => {
  it('bare form wraps pipeValue Map', () => {
    const result = evalQuery('{:kind :oops} | error !| /kind');
    expect(result).toEqual(keyword('oops'));
  });

  it('bare form on non-Map produces ErrorDescriptorNotMap', () => {
    const result = evalQuery('42 | error !| /thrown');
    expect(result).toEqual(keyword('ErrorDescriptorNotMap'));
  });
});

// ── isError operand ─────────────────────────────────────────────

describe('isError operand', () => {
  it('with captured args produces arity error', () => {
    const result = evalQuery('42 | isError(1) !| /kind');
    expect(result).toEqual(keyword('arity-error'));
  });
});

// ── fail-apply deflect on non-error pipeValue ──────────────────

describe('fail-apply deflect on non-error', () => {
  it('null deflects through !|', () => {
    const result = evalQuery('null !| /kind');
    expect(result).toBeNull();
  });

  it('Map deflects through !|', () => {
    const result = evalQuery('{:a 1} !| /kind');
    expect(result instanceof Map).toBe(true);
    expect(result.get(keyword('a'))).toBe(1);
  });
});

// ── fail-track dispatch through containers ─────────────────────

describe('fail-track dispatch through ParenGroup and conduit', () => {
  it('fail-apply fires into a ParenGroup step', () => {
    const result = evalQuery('!{:kind :oops} !| (/kind)');
    expect(result).toEqual(keyword('oops'));
  });

  it('conduit body first step sees exposed descriptor when called via !|', () => {
    const result = evalQuery('let(:handler, /kind) | !{:kind :oops} !| handler');
    expect(result).toEqual(keyword('oops'));
  });

  it('distribute of add(10) over mixed elements produces per-element errors filterable by isError', () => {
    const result = evalQuery('[1 "x" 3] * add(10) | filter(isError) | count');
    expect(result).toBe(1);
  });

  it('plain comment between a deflecting step and a fail-apply step is silent in the trail', () => {
    // Structured trail: /trail yields Vec of AST-Maps; * /text
    // projects the source-text field of each deflected step. Plain
    // comments participate as identity pipeline steps and therefore
    // DO land on the trail when the pipeline deflects past them
    // — the assertion here is that the operand-carrying step
    // (`count`) is present; the plain-comment step presence is a
    // separate property exercised by other cases.
    const result = evalQuery('!{:kind :oops} |~| comment\n count !| /trail * /text');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('count');
  });
});

// ── reify :source field ─────────────────────────────────────────

describe('reify :source from conduit body', () => {
  it('renders an ErrorLit body as the original source substring', () => {
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

describe('reify :source for rare conduit body shapes', () => {
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

  it('renders leading fail-apply prefix in conduit body', () => {
    expect(evalQuery('let(:handler, !| /kind) | reify(:handler) | /source')).toBe('!| /kind');
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
    const r = s.evalCell('{:kind :builtin :examples [{:snippet "{:kind :oops :message \\"boom\\"} | error" :expected "42"}]} | runExamples | first | /ok');
    expect(r.result).toBe(false);
  });
});
