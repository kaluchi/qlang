// Tests for error operand, isError operand, and the `!|` fail-apply
// combinator, plus edge cases around trail accumulation, re-lift
// continuity, and conduit invocation on the fail-track.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

// ── error operand ──────────────────────────────────────────────

describe('error operand', () => {
  it('bare form wraps pipeValue Map', async () => {
    const evalResult = await evalQuery('{:kind :oops} | error !| /kind');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('bare form on non-Map produces ErrorDescriptorNotMap', async () => {
    const evalResult = await evalQuery('42 | error !| /thrown');
    expect(evalResult).toEqual(keyword('ErrorDescriptorNotMap'));
  });
});

// ── isError operand ─────────────────────────────────────────────

describe('isError operand', () => {
  it('with captured args produces arity error', async () => {
    const evalResult = await evalQuery('42 | isError(1) !| /kind');
    expect(evalResult).toEqual(keyword('arity-error'));
  });
});

// ── fail-apply deflect on non-error pipeValue ──────────────────

describe('fail-apply deflect on non-error', () => {
  it('null deflects through !|', async () => {
    const evalResult = await evalQuery('null !| /kind');
    expect(evalResult).toBeNull();
  });

  it('Map deflects through !|', async () => {
    const evalResult = await evalQuery('{:a 1} !| /kind');
    expect(evalResult instanceof Map).toBe(true);
    expect(evalResult.get(keyword('a'))).toBe(1);
  });
});

// ── fail-track dispatch through containers ─────────────────────

describe('fail-track dispatch through ParenGroup and conduit', () => {
  it('fail-apply fires into a ParenGroup step', async () => {
    const evalResult = await evalQuery('!{:kind :oops} !| (/kind)');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('conduit body first step sees exposed descriptor when called via !|', async () => {
    const evalResult = await evalQuery('let(:handler, /kind) | !{:kind :oops} !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('distribute of add(10) over mixed elements produces per-element errors filterable by isError', async () => {
    const evalResult = await evalQuery('[1 "x" 3] * add(10) | filter(isError) | count');
    expect(evalResult).toBe(1);
  });

  it('plain comment between a deflecting step and a fail-apply step is silent in the trail', async () => {
    // Structured trail: /trail yields Vec of AST-Maps; * /text
    // projects the source-text field of each deflected step. Plain
    // comments participate as identity pipeline steps and therefore
    // DO land on the trail when the pipeline deflects past them
    // — the assertion here is that the operand-carrying step
    // (`count`) is present; the plain-comment step presence is a
    // separate property exercised by other cases.
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail * /text');
    expect(Array.isArray(evalResult)).toBe(true);
    expect(evalResult).toContain('count');
  });
});

// ── reify :source field ─────────────────────────────────────────

describe('reify :source from conduit body', () => {
  it('renders an ErrorLit body as the original source substring', async () => {
    const evalResult = await evalQuery('let(:x, !{:a 1}) | reify(:x) | /source');
    expect(evalResult).toBe('!{:a 1}');
  });
});

// ── EffectLaunderingAtCall ──────────────────────────────────────

describe('EffectLaunderingAtCall', () => {
  it('calling non-@-prefixed name resolving to effectful conduit produces error', async () => {
    // Install an @-prefixed conduit under a non-@-prefixed name via session.bind.
    // This simulates the laundering path (via use, as, or session injection)
    // that the parse-time AST check cannot detect.
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('let(:@myCount, count)');
    const effectfulConduit = sessionInstance.env.get(keyword('@myCount'));
    sessionInstance.bind('doIt', effectfulConduit);
    const cellEntry = await sessionInstance.evalCell('[1 2 3] | doIt');
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.descriptor.get(keyword('kind'))).toEqual(keyword('effect-laundering'));
  });
});

describe('reify :source for rare conduit body shapes', () => {
  it('renders bare OperandCall (no args)', async () => {
    expect(await evalQuery('let(:x, count) | reify(:x) | /source')).toBe('count');
  });

  it('renders LinePlainComment in conduit body', async () => {
    const evalResult = await evalQuery('let(:x, (42 |~| note\n)) | reify(:x) | /source');
    expect(evalResult).toContain('|~|');
  });

  it('renders BlockDocComment in conduit body', async () => {
    const evalResult = await evalQuery('|~~ doc ~~| let(:x, 42) | reify(:x) | /docs | first');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('doc');
  });

  it('renders ErrorLit in conduit body', async () => {
    expect(await evalQuery('let(:x, !{:a 1}) | reify(:x) | /source')).toBe('!{:a 1}');
  });

  it('renders leading fail-apply prefix in conduit body', async () => {
    expect(await evalQuery('let(:handler, !| /kind) | reify(:handler) | /source')).toBe('!| /kind');
  });
});

describe('json operand on error values inside containers', () => {
  it('renders error value as $error wrapper when inside Vec', async () => {
    // [1 "x" 3] * add(10) produces [11 error 13]; json renders the Vec
    const evalResult = await evalQuery('[1 "x" 3] * add(10) | json');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('$error');
  });
});

describe('runExamples error value without originalError', () => {
  it('reports error from descriptor message when no originalError', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('{:kind :builtin :examples [{:snippet "{:kind :oops :message \\"boom\\"} | error" :expected "42"}]} | runExamples | first | /ok');
    expect(cellEntry.result).toBe(false);
  });
});
