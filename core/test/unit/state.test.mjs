// state.mjs — the (pipeValue, env) accessors, the immutable env
// updaters, and the frame constructors that carry the evaluation
// depth budget.

import { describe, it, expect } from 'vitest';
import {
  rootState, withPipeValue, withEnv, nestState, ascendState, EVAL_DEPTH_LIMIT,
  envSet, envHas, envGet, envMerge
} from '../../src/state.mjs';
import { QlangError, EvaluationDepthExceededError } from '../../src/errors.mjs';

describe('state.mjs env updaters', () => {
  it('envSet returns a new Map without mutating the original', () => {
    const initial = new Map();
    const extended = envSet(initial, 'foo', 42);
    expect(initial.size).toBe(0);
    expect(extended.size).toBe(1);
    expect(envGet(extended, 'foo')).toBe(42);
    expect(envHas(extended, 'foo')).toBe(true);
    expect(envHas(extended, 'bar')).toBe(false);
  });

  it('envMerge merges a Map into another, incoming wins on conflict', () => {
    const base    = envSet(envSet(new Map(), 'a', 1), 'shared', 'base');
    const incoming = envSet(envSet(new Map(), 'b', 2), 'shared', 'incoming');
    const merged = envMerge(base, incoming);
    expect(envGet(merged, 'a')).toBe(1);
    expect(envGet(merged, 'b')).toBe(2);
    expect(envGet(merged, 'shared')).toBe('incoming');
  });
});

describe('state.mjs frames', () => {
  it('rootState opens depth 0; withPipeValue and withEnv stay on the frame', () => {
    const root = rootState(null, new Map());
    expect(root.depth).toBe(0);
    expect(Object.isFrozen(root)).toBe(true);
    const nextValue = withPipeValue(root, 42);
    expect(nextValue.pipeValue).toBe(42);
    expect(nextValue.env).toBe(root.env);
    expect(nextValue.depth).toBe(0);
    const nextEnv = withEnv(nextValue, envSet(root.env, 'x', 1));
    expect(nextEnv.pipeValue).toBe(42);
    expect(envGet(nextEnv.env, 'x')).toBe(1);
    expect(nextEnv.depth).toBe(0);
  });

  it('nestState descends one frame; ascendState returns to the outer frame with the inner pair', () => {
    const root = rootState(1, new Map());
    const inner = nestState(root, 2, envSet(root.env, 'y', 2));
    expect(inner.depth).toBe(1);
    expect(inner.pipeValue).toBe(2);
    expect(envGet(inner.env, 'y')).toBe(2);
    const deeper = nestState(inner, 3, inner.env);
    expect(deeper.depth).toBe(2);
    const ascended = ascendState(root, deeper);
    expect(ascended.depth).toBe(0);
    expect(ascended.pipeValue).toBe(3);
    expect(ascended.env).toBe(deeper.env);
  });

  it('nestState admits the frame at EVAL_DEPTH_LIMIT and refuses the frame past it', () => {
    let frame = rootState(null, new Map());
    for (let level = 0; level < EVAL_DEPTH_LIMIT; level++) frame = nestState(frame, null, frame.env);
    expect(frame.depth).toBe(EVAL_DEPTH_LIMIT);
    let thrown = null;
    try { nestState(frame, null, frame.env); } catch (depthErr) { thrown = depthErr; }
    expect(thrown).toBeInstanceOf(EvaluationDepthExceededError);
    expect(thrown).toBeInstanceOf(QlangError);
    expect(thrown.name).toBe('EvaluationDepthExceededError');
    expect(thrown.fingerprint).toBe('EvaluationDepthExceededError');
    expect(thrown.kind).toBe('resourceLimit');
    expect(thrown.context).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    expect(thrown.message).toBe(
      `evaluation depth ${EVAL_DEPTH_LIMIT + 1} exceeds the budget of ${EVAL_DEPTH_LIMIT} nested frames`
    );
  });
});
