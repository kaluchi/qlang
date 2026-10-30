import { describe, it, expect } from 'vitest';
import { makeKeyword, makeErrorValue, makeTag, makeTagged } from '../../../src/types.mjs';
import { makeSet, compareValues } from '../../../src/ordering.mjs';
import { evalQuery } from '../../../src/notebook.mjs';

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
    for (const value of [null, 42, makeKeyword('oops'), new Map([['a', 1]])]) expect(compareValues(raised, value)).toBe(1);
    for (const query of ['::Foo!{:a 1} | raise !| it', '::Foo{:a 1}', '!{:a 1}', '1 | desc']) expect(compareValues(raised, await evalQuery(query))).toBe(1);
    expect(compareValues(await evalQuery('!{:a 1} | raise'), await evalQuery('!{:a 1} | raise !| it'))).toBe(1);
  });
});

describe('the one order tells a vector, a map and a set under a tag from one under none', () => {
  it('tells a vector under a tag from the bare vector of the same elements', () => {
    const tagged = makeTagged(makeTag('A'), [1, 2, 3]);
    expect(compareValues(tagged, [1, 2, 3]) === 0).toBe(false);
  });

  it('tells a map under a tag from the bare map of the same entries', () => {
    const tagged = makeTagged(makeTag('U'), new Map([['k', 1]]));
    expect(compareValues(tagged, new Map([['k', 1]])) === 0).toBe(false);
  });

  it('tells a set under a tag from the set of the same elements', () => {
    const tagged = makeTagged(makeTag('S'), makeSet([1, 2]));
    expect(compareValues(tagged, makeSet([1, 2])) === 0).toBe(false);
  });
});

const LADDER = [
  'null', 'false', 'true', '-1', '0', '1.5', '""', '"a"', '"b"', '#"a"', '#"a"i', ':a', ':b', '::A', '::B',
  '/a', '/a/0', '/b', '[]', '[1]', '[1 2]', '[2]', '#[]', '#[1]', '#[2]',
  '{}', '{:a 1}', '{:a 2}', '{:a 1 :b 1}', '{:b 1}', '~(a)', '~(b)', '|~~ a ~~|',
  '::A#1', '::A#2', '::A{:a 1}', '::B#1', '::Z!{:a 1}', '2 | desc', '1 | desc', '!{:a 1}', '::excerpt{:count 1}',
  '::Z!{:a 1} | raise', '!{:a 1} | raise', '!{:a 2} | raise'
];

it('ranks each value of a ladder after the one before it, the sign of the ranks of every two values', async () => {
  const values = [];
  for (const query of LADDER) values.push(await evalQuery(query));
  for (const [at, value] of values.entries()) {
    for (const [other, than] of values.entries()) {
      expect(compareValues(value, than), `${LADDER[at]} against ${LADDER[other]}`).toBe(Math.sign(at - other));
    }
  }
});

describe('the one order over keywords and tags', async () => {
  it('gt / lt / gte / lte on Keywords compare by .name', async () => {
    const { evalQuery } = await import('../../../src/notebook.mjs');
    expect(await evalQuery(':a | gt :b')).toBe(false);
    expect(await evalQuery(':a | lt :b')).toBe(true);
    expect(await evalQuery(':a | gte :a')).toBe(true);
    expect(await evalQuery(':a | lte :a')).toBe(true);
  });

  it('lt on tags compares by .name', async () => {
    const { evalQuery } = await import('../../../src/notebook.mjs');
    expect(await evalQuery('::A | lt ::B')).toBe(true);
  });
});
