// state.mjs — the (pipeValue, env) accessors, the immutable env
// updaters, and the states that carry the evaluation depth and its
// limit.
// The rules it holds: [QSDSP#residence], [QSNAM#verb].

import { describe, it, expect } from 'vitest';
import {
  rootState, withPipeValue, withEnv, nestState, EVAL_DEPTH_LIMIT,
  envSet, envHas, envMerge
} from '../../src/state.mjs';
import { QlangError, CallEvaluationDepthExceededError } from '../../src/errors.mjs';

describe('state.mjs env updaters', () => {
  it('envSet returns a new Map without mutating the original', () => {
    const initial = new Map();
    const extended = envSet(initial, 'foo', 42);
    expect(initial.size).toBe(0);
    expect(extended.size).toBe(1);
    expect(extended.get('foo')).toBe(42);
    expect(envHas(extended, 'foo')).toBe(true);
    expect(envHas(extended, 'bar')).toBe(false);
  });

  it('envMerge merges a Map into another, incoming wins on conflict', () => {
    const base    = envSet(envSet(new Map(), 'a', 1), 'shared', 'base');
    const incoming = envSet(envSet(new Map(), 'b', 2), 'shared', 'incoming');
    const merged = envMerge(base, incoming);
    expect(merged.get('a')).toBe(1);
    expect(merged.get('b')).toBe(2);
    expect(merged.get('shared')).toBe('incoming');
  });
});

describe('state.mjs evaluation depth', () => {
  it('rootState opens depth 0; withPipeValue and withEnv stay at its depth', () => {
    const root = rootState(null, new Map());
    expect(root.depth).toBe(0);
    expect(Object.isFrozen(root)).toBe(true);
    const nextValue = withPipeValue(root, 42);
    expect(nextValue.pipeValue).toBe(42);
    expect(nextValue.env).toBe(root.env);
    expect(nextValue.depth).toBe(0);
    const nextEnv = withEnv(nextValue, envSet(root.env, 'x', 1));
    expect(nextEnv.pipeValue).toBe(42);
    expect(nextEnv.env.get('x')).toBe(1);
    expect(nextEnv.depth).toBe(0);
  });

  it('nestState goes one deeper with the inner pair', () => {
    const root = rootState(1, new Map());
    const inner = nestState(root, 2, envSet(root.env, 'y', 2));
    expect(inner.depth).toBe(1);
    expect(inner.pipeValue).toBe(2);
    expect(inner.env.get('y')).toBe(2);
    const deeper = nestState(inner, 3, inner.env);
    expect(deeper.depth).toBe(2);
  });

  it('nestState admits the depth EVAL_DEPTH_LIMIT and refuses the one past it', () => {
    let state = rootState(null, new Map());
    for (let level = 0; level < EVAL_DEPTH_LIMIT; level++) state = nestState(state, null, state.env);
    expect(state.depth).toBe(EVAL_DEPTH_LIMIT);
    let thrown = null;
    try { nestState(state, null, state.env); } catch (depthErr) { thrown = depthErr; }
    expect(thrown).toBeInstanceOf(CallEvaluationDepthExceededError);
    expect(thrown).toBeInstanceOf(QlangError);
    expect(thrown.name).toBe('EvaluationDepthExceededError');
    expect(thrown.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    expect(thrown.message).toBe('::call/EvaluationDepthExceededError');
  });
});
