// The one order held by its sign over a ladder of values, each after the one
// before it, kind before kind and within a kind by value [QSORD#order], and its
// tie, which the tests compare a value of the language by [QSWRK#cases].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { compareValues } from '../../src/ordering.mjs';
import { makeTag } from '../../src/types.mjs';

const LADDER = [
  'null', 'false', 'true', '-1', '0', '1.5', '""', '"a"', '"b"', '#"a"', '#"a"i', ':a', ':b', '::A', '::B',
  '/a', '/a/0', '/b', '[]', '[1]', '[1 2]', '[2]', '#[]', '#[1]', '#[2]',
  '{}', '{:a 1}', '{:a 2}', '{:a 1 :b 1}', '{:b 1}', '~(a)', '~(b)', '|~~ a ~~|',
  '::A#1', '::A#2', '::A{:a 1}', '::B#1', '::Z!{:a 1}', '2 | desc', '1 | desc', '::elision{:size 1}', '!{:a 1}',
  '::Z!{:a 1} | raise', '!{:a 1} | raise', '!{:a 2} | raise'
];

describe('the one order ranks each value of a ladder after the one before it', () => {
  it('answers the sign of the places of every two values', async () => {
    const values = [];
    for (const query of LADDER) values.push(await evalQuery(query));
    for (const [at, value] of values.entries()) {
      for (const [other, than] of values.entries()) {
        expect(compareValues(value, than), `${LADDER[at]} against ${LADDER[other]}`).toBe(Math.sign(at - other));
      }
    }
  });
});

describe('the tests compare a value of the language by the tie of the one order', () => {
  it('tells a set and a value under a tag from the vector and the map of no tag', async () => {
    expect(await evalQuery('#[1 2]')).not.toEqual([1, 2]);
    expect(await evalQuery('::Box{:a 1}')).not.toEqual(new Map([['a', 1]]));
    expect(await evalQuery('[#[1]]')).not.toEqual([[1]]);
  });

  it('leaves a value of no kind and a container of one to vitest', () => {
    expect([{ start: 1 }]).toEqual([{ start: 1 }]);
    expect(makeTag('number')).toMatchObject({ name: 'number' });
  });
});
