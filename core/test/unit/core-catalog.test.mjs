// The verbs and the kinds the catalog declares, as a query meets them: the
// listing and the inputs of `filter`, the refusal of a call that leaves an
// input empty, the chain every kind of the root is built by, and the code
// `apply` takes [QSDSP#residence].

import { describe, it, expect } from 'vitest';
import { makeTag } from '../../src/types.mjs';
import { makeSet } from '../../src/ordering.mjs';
import { evalQuery } from '../../src/session.mjs';

describe('the chain of `filter` as a query reads it', () => {
  it('[QSSLF#manifest] filter of maps lists under its address its predicate, its answer and the refusal of a verdict that is no boolean', async () => {
    expect(await evalQuery('::map/filter | manifest')).toEqual(makeSet([makeTag('map/filter/ConditionKindNotTakenError'), makeTag('map/filter/answer'), makeTag('map/filter/predicate')]));
  });

  it('[QSCOL#filter] filter takes its predicate as code, a quote or a path, on each kind that declares it', async () => {
    expect(await evalQuery('[::vec/filter ::map/filter] | map ~(binding | get /value | inputs | map /kinds) | print')).toBe('[[#[::path ::quote]] [#[::path ::quote]]]');
  });
});

// A call that leaves the place of an input empty is refused under the input
// [QSBLD#fn].
describe('a call that leaves an input empty', () => {
  it('[QSBLD#fn] mul given no multiplier is refused under its input', async () => {
    expect(await evalQuery('5 | mul !| type')).toEqual(makeTag('number/mul/multiplier/NotGivenError'));
  });
});

describe('the root of the language', () => {
  it('[QSBLD#label] every kind of the root is built by the chain of a kind', async () => {
    expect(await evalQuery('kinds | map ~(binding | get /value | type) | distinct')).toEqual(await evalQuery('#[::kind]'));
  });
});

// `apply` takes a quote, a path or a function as its code, and text once
// `parse` reads it [QSQUO#apply].
describe('the code `apply` takes', () => {
  it('[QSQUO#apply] apply refuses text as its code, which parse reads first', async () => {
    expect(await evalQuery('"not-a-quote" | apply it !| type')).toEqual(makeTag('any/apply/code/KindNotTakenError'));
  });
});
