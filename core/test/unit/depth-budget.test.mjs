// The evaluation depth budget across every re-entry seam: a
// runaway recursion through any seam the evaluator descends —
// verb body, captured-arg lambda, a verb run as code or as a fold,
// `apply`, Quote-bodied tag constructor, `runLaws` — terminates on
// the fail-track as `::call/EvaluationDepthExceededError` with `:depth`
// and `:limit`.
// The decisions it exists for: [D202].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { EVAL_DEPTH_LIMIT } from '../../src/state.mjs';
import { QlangError, CallEvaluationDepthExceededError } from '../../src/errors.mjs';
import { makeTag } from '../../src/types.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

describe('depth budget — self-calling verb', () => {
  it('lifts ::call/EvaluationDepthExceededError with :depth and :limit on the descriptor', async () => {
    const runaway = await evalQuery(':any/inf ~(add 1 | inf) | 0 | inf');
    expect(runaway.tag).toEqual(makeTag('call/EvaluationDepthExceededError'));
    expect(runaway.descriptor.get('depth')).toBe(EVAL_DEPTH_LIMIT + 1);
    expect(runaway.descriptor.get('limit')).toBe(EVAL_DEPTH_LIMIT);
    const original = runaway.originalError;
    expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
    expect(original).toBeInstanceOf(QlangError);
    expect(original.name).toBe('EvaluationDepthExceededError');
    expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
  });

  it('leaves the budget intact for recursion that terminates', async () => {
    const nodeCount = await evalQuery(
      ':any/total ~(sumOf 1 (get /children | map ~total | sum)) '
      + '| {:children [{:children [{:children []}]} {:children []}]} | total'
    );
    expect(nodeCount).toBe(4);
  });
});

describe('depth budget — every re-entry seam', () => {
  const seams = [
    ['apply on a self-referential Quote',           ':q ~(apply q) | apply q'],
    ['a body under map naming its own verb',         ':any/f ~(get [~(it)] | map ~f | first) | 1 | f'],
    ['captured-arg lambda naming its own verb',     ':any/p ~(get [~(it)] | filter ~(p)) | [1] | p'],
    ['a verb folding through reduce',               ':any/r (::fn | takes :el |~~ The element. ~~| /0 | impl ~([1] | reduce 0 ~r)) | [1] | reduce 0 ~r'],
    ['a verb predicate over a Map',                 ':any/k ~({:a 1} | filter ~k) | {:a 1} | filter ~k'],
    ['an invariant of a kind minting its own tag',   ':T |~~ T. ~~| (::kind | holds :E |~~ e ~~| ~(::T#1 | payload | eq 1)) | ::T#1']
  ];
  for (const [seamName, query] of seams) {
    it(`terminates on ${seamName}`, async () => {
      const original = await catchOriginalError(query);
      expect(original).toBeInstanceOf(CallEvaluationDepthExceededError);
      expect(original.facts).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
    });
  }
});

describe('depth budget — host seams', () => {
  it('runLaws evaluates each example one frame below the step, so an example running its own examples terminates', async () => {
    // Example outcomes are data: every frame that ran its example
    // answers `:ok` for it, and the depth error sits on the frame
    // the budget refused. The host-bound tally counts the frames
    // whose `runLaws` step returned — the root and every frame
    // below it up to the budget; the refused frame's `runLaws`
    // step lifts the error and the tally deflects.
    let frameTally = 0;
    const sessionInstance = await createSession({
      sources: [{
        uri: 'tests/tally',
        source: ':any/tallyFrame ::builtin{}',
        impls: { 'any/tallyFrame': subject => { frameTally++; return subject; } }
      }]
    });
    const cellEntry = await sessionInstance.evalCell(
      ':x 1 | :x/runsItself ::law~(::x | runLaws | tallyFrame | count | eq 1) | ::x | runLaws | tallyFrame'
    );
    expect(cellEntry.result).toHaveLength(1);
    expect(cellEntry.result[0].get('ok')).toBe(true);
    expect(frameTally).toBe(EVAL_DEPTH_LIMIT);
  });
});
