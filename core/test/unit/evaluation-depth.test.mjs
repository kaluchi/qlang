// The limit of the evaluation depth across every re-entry seam: a runaway
// recursion through any seam the evaluator descends — verb body, a quote a
// verb runs, a verb run as code or as a fold, `apply`, an invariant of a kind
// that lays its own tag, `runLaws` — terminates on the fail track as
// `::call/EvaluationDepthExceededError` with `:depth` and `:limit`. The
// rules it holds: [QSNAM#verb].

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { EVAL_DEPTH_LIMIT } from '../../src/state.mjs';
import { CallEvaluationDepthExceededError } from '../../src/errors.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

describe('the limit of the evaluation depth — self-calling verb', () => {
  it('[QSNAM#verb] answers ::call/EvaluationDepthExceededError with :depth and :limit among its facts', async () => {
    const runaway = await evalQuery(':any/inf ~(add 1 | inf) | 0 | inf');
    expect(runaway.facts.get('depth')).toBe(EVAL_DEPTH_LIMIT + 1);
    expect(runaway.facts.get('limit')).toBe(EVAL_DEPTH_LIMIT);
    const original = runaway.originalError;
    expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
    expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
  });
});

describe('the limit of the evaluation depth — every re-entry seam', () => {
  const seams = [
    ['a body under map naming its own verb',         ':any/f ~(get [~(it)] | map ~f | first) | 1 | f'],
    ['a quote filter runs naming its own verb',     ':any/p ~(get [~(it)] | filter ~(p)) | [1] | p'],
    ['a verb folding through reduce',               ':any/r (::fn | takes :el |~~ The element. ~~| /0 | impl ~([1] | reduce 0 ~r)) | [1] | reduce 0 ~r'],
    ['a verb predicate over a map',                 ':any/k ~({:a 1} | filter ~k) | {:a 1} | filter ~k'],
    ['code apply runs naming its own verb',          ':any/a ~(apply ~(a)) | 1 | a'],
    ['an invariant of a kind laying its own tag',    ':T |~~ T. ~~| (::kind | holds :E |~~ e ~~| ~(::T#1 | payload | eq 1)) | ::T#1']
  ];
  for (const [seamName, query] of seams) {
    it(`[QSNAM#verb] terminates on ${seamName}`, async () => {
      const original = await catchOriginalError(query);
      expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
      expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    });
  }
});

describe('the limit of the evaluation depth — host seams', () => {
  it('[QSNAM#verb] runLaws runs each law one deeper than its step, so a law that runs its own laws terminates', async () => {
    // The host's tally counts the depths whose `runLaws` step returned, the
    // root and every depth below it up to the limit, the step at the depth
    // refused answering the failure, which skips the tally.
    let depthTally = 0;
    const sessionInstance = await createSession({
      sources: [{
        uri: 'tests/tally',
        source: ':any/tallyDepth ::builtin{}',
        primitives: { 'any/tallyDepth': subject => { depthTally++; return subject; } }
      }]
    });
    const cellEntry = await sessionInstance.evalCell(
      ':X |~~ X. ~~| | :X/runsItself ::law~(::X | runLaws | tallyDepth | count | eq 1) | ::X | runLaws | tallyDepth'
    );
    expect(cellEntry.result).toHaveLength(1);
    expect(cellEntry.result[0].get('ok')).toBe(true);
    expect(depthTally).toBe(EVAL_DEPTH_LIMIT);
  });
});
