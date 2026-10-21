// Code assembled from data runs as code read from text, a quote a template of
// a set holds reads the names of its step, and a path no modifier wrote is no
// code a refusal repairs [QSQUO#step], [QSQUO#held], [QSPTH#code].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { evalPipeline } from '../../src/eval.mjs';
import { callOf } from '../../src/steps.mjs';
import { asPrinted } from '../../src/print-value.mjs';
import { keyword, makeQuote } from '../../src/types.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('code assembled from data', () => {
  it('[QSQUO#step] runs the verb a call record names, a step no text wrote', async () => {
    const quote = makeQuote([callOf(new Map([['name', keyword('count')]]), asPrinted)]);
    const state = rootState([1, 2, 3], await langRuntime());
    expect((await evalPipeline(quote, state)).pipeValue).toBe(3);
  });
});

describe('a quote a template holds', () => {
  it('[QSQUO#held] runs a template of a set as code written in the step, its quotes reading the names of the step', async () => {
    expect(await evalQuery(':k 5 | [1] | get #[~(k)]')).toEqual(await evalQuery('#[5]'));
  });
});

describe('a path no modifier wrote', () => {
  it('[QSPTH#code] repairs no refusal of a path that no modifier of the call wrote', async () => {
    expect(await evalQuery(':any/f (::fn | returns |~~ N. ~~| ::number | impl ~(it)) | /a | f !| get [~(type) ~(has :repair)]'))
      .toEqual(await evalQuery('[::any/f/answer/KindNotTakenError false]'));
  });
});
