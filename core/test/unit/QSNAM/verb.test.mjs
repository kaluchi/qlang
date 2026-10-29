import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { EVAL_DEPTH_LIMIT, rootState, withPipeValue, withScope, nestState, scopeSet } from '../../../src/state.mjs';
import { CallEvaluationDepthExceededError } from '../../../src/errors.mjs';
import { catchOriginalError } from '../../helpers/error-assertions.mjs';

it('a verb that calls itself answers ::call/EvaluationDepthExceededError with :depth and :limit among its facts', async () => {
  const runaway = await evalQuery(':any/inf ~(add 1 | inf); 0 | inf');
  expect(runaway.facts.get('depth')).toBe(EVAL_DEPTH_LIMIT + 1);
  expect(runaway.facts.get('limit')).toBe(EVAL_DEPTH_LIMIT);
  const original = runaway.originalError;
  expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
  expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
});

describe('the limit of the evaluation depth — every re-entry seam', () => {
  const seams = [
    ['a body under map naming its own verb',         ':any/f ~(get [~(it)] | map ~f | first); 1 | f'],
    ['a quote filter runs naming its own verb',     ':any/p ~(get [~(it)] | filter ~(p)); [1] | p'],
    ['a verb folding through reduce',               ':any/r (::fn | takes :el |~~ The element. ~~| /0 | impl ~([1] | reduce 0 ~r)); [1] | reduce 0 ~r'],
    ['a verb predicate over a map',                 ':any/k ~({:a 1} | filter ~k); {:a 1} | filter ~k'],
    ['code apply runs naming its own verb',          ':any/a ~(apply ~(a)); 1 | a'],
    ['an invariant of a kind laying its own tag',    ':T |~~ T. ~~| (::kind | holds :E |~~ e ~~| ~(::T#1 | payload | eq 1)); ::T#1']
  ];
  for (const [seamName, query] of seams) {
    it(`terminates on ${seamName}`, async () => {
      const original = await catchOriginalError(query);
      expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
      expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    });
  }
});

it('runLaws runs each law one deeper than its step, so a law that runs its own laws terminates', async () => {
  let depthTally = 0;
  const sessionInstance = await createNotebook({
    sources: [{
      uri: 'tests/tally',
      source: ':any/tallyDepth ::builtin{};',
      primitives: { 'any/tallyDepth': subject => { depthTally++; return subject; } }
    }]
  });
  const cellEntry = await sessionInstance.evalCell(
    ':X |~~ X. ~~|; :X/runsItself ::law~(::X | runLaws | tallyDepth | count | eq 1); ::X | runLaws | tallyDepth'
  );
  expect(cellEntry.result).toHaveLength(1);
  expect(cellEntry.result[0].get('ok')).toBe(true);
  expect(depthTally).toBe(EVAL_DEPTH_LIMIT);
});

it('a name with a path calls the verb its address names, with the modifiers the call takes', async () => {
  expect(await evalQuery('[1 2 3] | vec/filter ~(gt 1)')).toEqual([2, 3]);
});

describe('the evaluation depth of a state', () => {
  it('the state of the root opens depth 0, and a state with a new value or scope stays at its depth', () => {
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

  it('a nested state goes one deeper with the inner pair', () => {
    const root = rootState(1, new Map());
    const inner = nestState(root, 2, scopeSet(root.scope, 'y', 2));
    expect(inner.depth).toBe(1);
    expect(inner.pipeValue).toBe(2);
    expect(inner.scope.get('y')).toBe(2);
    const deeper = nestState(inner, 3, inner.scope);
    expect(deeper.depth).toBe(2);
  });

  it('a nested state admits the limit of the depth and refuses the one past it', () => {
    let state = rootState(null, new Map());
    for (let level = 0; level < EVAL_DEPTH_LIMIT; level++) state = nestState(state, null, state.scope);
    expect(state.depth).toBe(EVAL_DEPTH_LIMIT);
    let thrown = null;
    try { nestState(state, null, state.scope); } catch (depthErr) { thrown = depthErr; }
    expect(thrown).toBeInstanceOf(CallEvaluationDepthExceededError);
    expect(thrown.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
  });
});
