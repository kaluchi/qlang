// The evaluation depth budget across every re-entry seam: a
// runaway recursion through any seam the evaluator descends —
// verb body, captured-arg lambda, a verb run as code or as a fold,
// `apply`, Quote-bodied tag constructor, `runLaws`,
// locator-loaded module — terminates on the fail-track as
// `::EvaluationDepthExceededError` with `:depth` and `:limit`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { EVAL_DEPTH_LIMIT } from '../../src/state.mjs';
import { QlangError, EvaluationDepthExceededError } from '../../src/errors.mjs';
import { makeTagKeyword } from '../../src/types.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

describe('depth budget — self-calling verb', () => {
  it('lifts ::EvaluationDepthExceededError with :depth and :limit on the descriptor', async () => {
    const runaway = await evalQuery(':inf ::verb~(add 1 | inf) | 0 | inf');
    expect(runaway.tag).toEqual(makeTagKeyword('EvaluationDepthExceededError'));
    expect(runaway.descriptor.get('depth')).toBe(EVAL_DEPTH_LIMIT + 1);
    expect(runaway.descriptor.get('limit')).toBe(EVAL_DEPTH_LIMIT);
    const original = runaway.originalError;
    expect(original).toBeInstanceOf(EvaluationDepthExceededError);
    expect(original).toBeInstanceOf(QlangError);
    expect(original.name).toBe('EvaluationDepthExceededError');
    expect(original.kind).toBe('resourceLimit');
    expect(original.context).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
  });

  it('leaves the budget intact for recursion that terminates', async () => {
    const nodeCount = await evalQuery(
      ':total ::verb~(add 1 (/children * total | sum)) '
      + '| {:children [{:children [{:children []}]} {:children []}]} | total'
    );
    expect(nodeCount).toBe(4);
  });
});

describe('depth budget — every re-entry seam', () => {
  const seams = [
    ['apply on a self-referential Quote',           ':q ~(apply q) | apply q'],
    ['distribute body naming its own verb',         ':f ::verb~([/] * f | first) | 1 | f'],
    ['captured-arg lambda naming its own verb',     ':p ::verb~([/] | filter ~(p)) | [1] | p'],
    ['a verb folding through reduce',               ':r ::verb~(:el ::any | [1] | reduce 0 ~r) | [1] | reduce 0 ~r'],
    ['a verb predicate over a Map',                 ':k ::verb~({:a 1} | filter ~k) | {:a 1} | filter ~k'],
    ['Quote-bodied tag constructor minting itself', '::T {:impl ~(::T(/))} | ::T(1)']
  ];
  for (const [seamName, query] of seams) {
    it(`terminates on ${seamName}`, async () => {
      const original = await catchOriginalError(query);
      expect(original).toBeInstanceOf(EvaluationDepthExceededError);
      expect(original.context).toEqual({ depth: EVAL_DEPTH_LIMIT + 1, limit: EVAL_DEPTH_LIMIT });
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
      locator: async namespaceName => (namespaceName === 'tests/tally'
        ? {
            source: ':tallyFrame ::verb~(::builtin{:impl :tests/tally/tallyFrame})',
            impls: { tallyFrame: subject => { frameTally++; return subject; } }
          }
        : null)
    });
    await sessionInstance.evalCell('use :tests/tally');
    const cellEntry = await sessionInstance.evalCell(
      ':x |~~ ~(:x | runLaws | tallyFrame | count | eq 1) ~~| 1 | :x | runLaws | tallyFrame'
    );
    expect(cellEntry.result).toHaveLength(1);
    expect(cellEntry.result[0].get('ok')).toBe(true);
    expect(frameTally).toBe(EVAL_DEPTH_LIMIT);
  });

  it('a locator-loaded module evaluates one frame below the use step, so a module using itself terminates', async () => {
    let locatorCalls = 0;
    const sessionInstance = await createSession({
      locator: async (namespaceName) => {
        locatorCalls++;
        return namespaceName === 'self' ? { source: 'use :self' } : null;
      }
    });
    // The root and every frame below it reach the locator once; on
    // the frame at the budget, the `:self` captured-arg lambda is
    // the first descent past it, so that frame's `use` step lifts
    // the error before its locator call.
    await sessionInstance.evalCell('use :self');
    expect(locatorCalls).toBe(EVAL_DEPTH_LIMIT);
  });
});
