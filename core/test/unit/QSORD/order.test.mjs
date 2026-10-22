import { describe, it, expect } from 'vitest';
import { keyword, makeErrorValue, makeTag, makeTagged } from '../../../src/types.mjs';
import { makeSet, compareValues } from '../../../src/ordering.mjs';
import { evalQuery } from '../../../src/session.mjs';

describe('the one order ranks a failure raised after every value, by its tag and then its facts', () => {
  it('ties two failures of one tag and one set of facts', () => {
    const tag = makeTag('Oops');
    const errorVal1 = makeErrorValue(tag, new Map([['index', 1]]));
    const errorVal2 = makeErrorValue(tag, new Map([['index', 1]]));
    expect(compareValues(errorVal1, errorVal2)).toBe(0);
  });

  it('ranks two failures by their tags, then by their facts', () => {
    const facts = new Map([['index', 1]]);
    expect(compareValues(makeErrorValue(makeTag('Bar'), facts), makeErrorValue(makeTag('Foo'), facts))).toBe(-1);
    expect(compareValues(makeErrorValue(makeTag('Foo'), new Map([['index', 2]])), makeErrorValue(makeTag('Foo'), facts))).toBe(1);
  });

  it('ranks a failure raised after its error at rest, a value under its tag and every value', async () => {
    const raised = await evalQuery('::Foo!{:a 1} | raise');
    for (const value of [null, 42, keyword('oops'), new Map([['a', 1]])]) expect(compareValues(raised, value)).toBe(1);
    for (const query of ['::Foo!{:a 1} | raise !| it', '::Foo{:a 1}', '!{:a 1}', '1 | desc']) expect(compareValues(raised, await evalQuery(query))).toBe(1);
    expect(compareValues(await evalQuery('!{:a 1} | raise'), await evalQuery('!{:a 1} | raise !| it'))).toBe(1);
  });
});

describe('the one order tells an Array, a Map and a Set under a tag from one under none', () => {
  // Collections that hold their tag on themselves, of one content under
  // another tag or none, are not equal.
  it('rejects tagged Array vs untagged Array with same elements', () => {
    const tagged = makeTagged(makeTag('A'), [1, 2, 3]);
    expect(compareValues(tagged, [1, 2, 3]) === 0).toBe(false);
  });

  it('rejects tagged Map vs untagged Map with same entries', () => {
    const tagged = makeTagged(makeTag('U'), new Map([['k', 1]]));
    expect(compareValues(tagged, new Map([['k', 1]])) === 0).toBe(false);
  });

  it('rejects a tag over a set vs the set of the same elements', () => {
    const tagged = makeTagged(makeTag('S'), makeSet([1, 2]));
    expect(compareValues(tagged, makeSet([1, 2])) === 0).toBe(false);
  });
});

const LADDER = [
  'null', 'false', 'true', '-1', '0', '1.5', '""', '"a"', '"b"', '#"a"', '#"a"i', ':a', ':b', '::A', '::B',
  '/a', '/a/0', '/b', '[]', '[1]', '[1 2]', '[2]', '#[]', '#[1]', '#[2]',
  '{}', '{:a 1}', '{:a 2}', '{:a 1 :b 1}', '{:b 1}', '~(a)', '~(b)', '|~~ a ~~|',
  '::A#1', '::A#2', '::A{:a 1}', '::B#1', '::Z!{:a 1}', '2 | desc', '1 | desc', '::elision{:size 1}', '!{:a 1}',
  '::Z!{:a 1} | raise', '!{:a 1} | raise', '!{:a 2} | raise'
];

it('ranks each value of a ladder after the one before it, the sign of the places of every two values', async () => {
  const values = [];
  for (const query of LADDER) values.push(await evalQuery(query));
  for (const [at, value] of values.entries()) {
    for (const [other, than] of values.entries()) {
      expect(compareValues(value, than), `${LADDER[at]} against ${LADDER[other]}`).toBe(Math.sign(at - other));
    }
  }
});

// Keyword / tag ordering — sort / min / max / gt / lt / gte /
// lte pairwise comparability extends to pairs of names through
// lexicographic `.name` compare, the one order of `compareValues` in
// `ordering.mjs`; these tests cover its keyword and tag branches.
describe('the one order over keywords and tags', async () => {
  it('gt / lt / gte / lte on Keywords compare by .name', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    expect(await evalQuery(':a | gt :b')).toBe(false);
    expect(await evalQuery(':a | lt :b')).toBe(true);
    expect(await evalQuery(':a | gte :a')).toBe(true);
    expect(await evalQuery(':a | lte :a')).toBe(true);
  });

  it('lt on tags compares by .name', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    expect(await evalQuery('::A | lt ::B')).toBe(true);
  });
});
