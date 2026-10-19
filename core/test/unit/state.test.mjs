// state.mjs — the pair of the value and the scope, the scopes it makes
// without changing one, and the states that carry the evaluation depth and
// its limit.
// The rules it holds: [QSDSP#residence], [QSNAM#verb].

import { describe, it, expect } from 'vitest';
import {
  rootState, withPipeValue, withScope, nestState, EVAL_DEPTH_LIMIT,
  scopeSet, scopeHas
} from '../../src/state.mjs';
import { QlangError, CallEvaluationDepthExceededError } from '../../src/errors.mjs';

describe('state.mjs scopes', () => {
  it('scopeSet returns a new Map without mutating the original', () => {
    const initial = new Map();
    const extended = scopeSet(initial, 'foo', 42);
    expect(initial.size).toBe(0);
    expect(extended.size).toBe(1);
    expect(extended.get('foo')).toBe(42);
    expect(scopeHas(extended, 'foo')).toBe(true);
    expect(scopeHas(extended, 'bar')).toBe(false);
  });
});

describe('state.mjs evaluation depth', () => {
  it('rootState opens depth 0; withPipeValue and withScope stay at its depth', () => {
    const root = rootState(null, new Map());
    expect(root.depth).toBe(0);
    expect(Object.isFrozen(root)).toBe(true);
    const nextValue = withPipeValue(root, 42);
    expect(nextValue.pipeValue).toBe(42);
    expect(nextValue.scope).toBe(root.scope);
    expect(nextValue.depth).toBe(0);
    const nextScope = withScope(nextValue, scopeSet(root.scope, 'x', 1));
    expect(nextScope.pipeValue).toBe(42);
    expect(nextScope.scope.get('x')).toBe(1);
    expect(nextScope.depth).toBe(0);
  });

  it('nestState goes one deeper with the inner pair', () => {
    const root = rootState(1, new Map());
    const inner = nestState(root, 2, scopeSet(root.scope, 'y', 2));
    expect(inner.depth).toBe(1);
    expect(inner.pipeValue).toBe(2);
    expect(inner.scope.get('y')).toBe(2);
    const deeper = nestState(inner, 3, inner.scope);
    expect(deeper.depth).toBe(2);
  });

  it('nestState admits the depth EVAL_DEPTH_LIMIT and refuses the one past it', () => {
    let state = rootState(null, new Map());
    for (let level = 0; level < EVAL_DEPTH_LIMIT; level++) state = nestState(state, null, state.scope);
    expect(state.depth).toBe(EVAL_DEPTH_LIMIT);
    let thrown = null;
    try { nestState(state, null, state.scope); } catch (depthErr) { thrown = depthErr; }
    expect(thrown).toBeInstanceOf(CallEvaluationDepthExceededError);
    expect(thrown).toBeInstanceOf(QlangError);
    expect(thrown.name).toBe('EvaluationDepthExceededError');
    expect(thrown.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    expect(thrown.message).toBe('::call/EvaluationDepthExceededError');
  });
});
