// Names under a label [D164], [D166]: a label declared by its page, the
// names declared under it running on its values, a call's object and its
// parts, a host's primitive under a label, and the refusals named by the
// address of what refused.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword, makeTaggedInstance } from '../../src/types.mjs';

const lines = (...steps) => steps.join('\n');

const BOX = lines(
  ':Box |~~ A parcel. ::holds~(/0 | gt 0) ~~|',
  ':Box/length |~~ The length. ~~| ~(/0)',
  ':Box/put |~~ The same box with another weight inside. ~~| ~(within ~(take 1 | append weight))',
  ':Box/put/weight |~~ The weight to put inside. ::holds~(type | eq ::number) ~~| ~(/0)',
  ':Box/scaled |~~ The length scaled. ~~| ~(length | mul (factor | add 1))',
  ':Box/scaled/factor |~~ The factor, one less than the scale. ~~| ~(/0 | add 1)',
  ':Box/tally |~~ The lead and the tail. ~~| ~([lead tail])',
  ':Box/tally/lead |~~ The lead, null when left out. ~~| ~(at 0)',
  ':Box/tally/tail |~~ The tail. ~~| ~(drop 1)',
  ':Box/past |~~ A place past the end. ~~| ~(/9)',
  ''
);

describe('a label declared by its page', () => {
  it('builds its payload by the construct declared under it', async () => {
    expect(await evalQuery(lines(
      ':Pair |~~ Two values. ~~|',
      ':Pair/construct |~~ The pair of a value. ~~| ~([/ /])',
      '::Pair(3) | payload'
    ))).toEqual([3, 3]);
  });

  it('answers the error its construct answers', async () => {
    expect(await evalQuery(lines(
      ':Small |~~ A number below ten. ~~|',
      ':Small/construct |~~ The number, if below ten. ~~| ~(if (lt 10) ~(/) ~(!{:reason :big}))',
      '::Small(12) !| /reason'
    ))).toEqual(await evalQuery(':big'));
  });

  it('answers the error its body answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | past !| type')).toEqual(makeTagKeyword('proj/IndexOutOfBoundsError'));
  });

  it('calls a name under it by its address', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | Box/length')).toBe(4);
  });

  it('refuses under the name a subject the walk of whose tags reaches no value of the label', async () => {
    expect(await evalQuery(BOX + '5 | Box/length !| type')).toEqual(makeTagKeyword('Box/length/SubjectNotBoxError'));
  });
});

describe('the object of a call', () => {
  it('refuses under the part a place the object does not hold', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put !| type')).toEqual(makeTagKeyword('Box/put/weight/NotGivenError'));
  });

  it('hands on the error a part answers for a place it holds', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | scaled "x" !| type')).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });

  it('hands on the error a modifier answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put (/missing) !| type')).toEqual(makeTagKeyword('proj/IndexNotIntegerError'));
  });

  it('reads a place softly by at, and the tail by any other step', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | [tally (tally 1 2 3)]')).toEqual(await evalQuery('[[null []] [1 [2 3]]]'));
  });

  it('reads the page of what refused for a refusal named by its address', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put "x" !| explain | page | content'))
      .toBe(' The weight to put inside. ::holds~(type | eq ::number) ');
  });

  it('lets a name under a label fold as a reducer', async () => {
    expect(await evalQuery(lines(
      ':number/addTo |~~ The sum with n. ~~| ~(add n)',
      ':number/addTo/n |~~ The number added. ~~| ~(/0)',
      '[1 2 3] | reduce 0 ~(addTo)'
    ))).toBe(6);
  });

  it('puts the answer back under the passed tags when its page marks ::keeps~()', async () => {
    expect(await evalQuery(lines(
      ':vec/backwards |~~ The elements reversed. ::keeps~() ~~| ~(reverse)',
      '::Crate[1 2] | backwards'
    ))).toEqual(await evalQuery('::Crate[2 1]'));
  });
});

describe('a host\'s primitive under a label', () => {
  it('runs over the served value and the parts of the object, a quote closed at the call where the part asks for one', async () => {
    const session = await createSession({
      sources: [{
        uri: 'probe/gauge',
        source: lines(
          ':Gauge |~~ A reading. ~~|',
          ':Gauge/construct |~~ The reading as a number. ~~| ::builtin{}',
          ':Gauge/over |~~ Whether the reading passes the test. ~~| ::builtin{}',
          ':Gauge/over/test |~~ The test. ::holds~(isA ::quote) ~~| ~(/0)',
          ':Gauge/shifted |~~ The reading shifted. ~~| ::builtin{}',
          ':Gauge/shifted/by |~~ The shift. ~~| ~(/0)',
          ':Dial |~~ A reading of a dial. ~~|',
          ':Dial/construct |~~ The reading under the label already. ~~| ::builtin{}'
        ),
        impls: {
          'Gauge/construct': payload => payload * 2,
          'Gauge/over': async (reading, test) => test(reading),
          'Gauge/shifted': (reading, by) => reading.payload + by,
          'Dial/construct': payload => makeTaggedInstance(makeTagKeyword('Dial'), payload + 1)
        }
      }]
    });
    expect((await session.evalCell('::Gauge(5) | payload')).result).toBe(10);
    expect((await session.evalCell('::Gauge(5) | over ~(gt 9)')).result).toBe(true);
    expect((await session.evalCell('::Gauge(5) | shifted 3')).result).toBe(13);
    expect((await session.evalCell('::Dial(1) | payload')).result).toBe(2);
  });

  it('computes the modifiers of a call up to the first that answers an error, and runs none after it [D167]', async () => {
    let noted = 0;
    const session = await createSession({
      sources: [{ uri: 'probe/note', source: ':any/@note ::builtin{}', impls: { 'any/@note': subject => { noted += 1; return subject; } } }]
    });
    expect((await session.evalCell('[1 2] | at /nope ("ran" | @note) !| type')).result).toEqual(makeTagKeyword('proj/IndexNotIntegerError'));
    expect(noted).toBe(0);
  });
});
