// Verbs and kinds under a label [QSBLD#label]: a kind its chain
// builds, the verbs declared under it running on its values, the inputs a
// call's args hold, a host's primitive under a label, and the refusals
// named by the address of what refused.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { runs } from '../../src/primitives.mjs';
import { makeTag, makeTagged } from '../../src/types.mjs';

// The steps of a query a line each, joined by `|` [QSSYN#line].
const lines = (...steps) => steps.join('\n| ');

const BOX = lines(
  ':Box |~~ A parcel. ~~| (::kind | holds :LengthNotPositiveError |~~ A box has a length. ~~| ~(get /0 | gt 0))',
  ':Box/length |~~ The length. ~~| ~(get /0)',
  ':Box/put |~~ The same box with another weight inside. ~~| (::fn | takes :weight |~~ The weight to put inside. ~~| /0 | holds :weight/NotANumberError |~~ The weight is a number. ~~| ~(type | eq ::number) | impl ~(within ~(take 1 | append weight)))',
  ':Box/scaled |~~ The length scaled. ~~| (::fn | takes :factor |~~ The factor, one less than the scale. ~~| ~(get /0 | add 1) | impl ~(length | mul (factor | add 1)))',
  ':Box/tally |~~ The lead and the rest. ~~| (::fn | takes :lead |~~ The lead, null when left out. ~~| ~(query /0) | takes :rest |~~ The values after the lead. ~~| ~(drop 1) | impl ~(get [~(lead) ~(rest)]))',
  ':Box/past |~~ A place past the end. ~~| ~(get /9)',
  ''
);

describe('a kind built from ::kind', () => {
  it('refuses a payload that breaks an invariant of its kind, the constructor attaching or refusing [QSLIT#tag]', async () => {
    expect(await evalQuery(lines(
      ':Small |~~ A number below ten. ~~| (::kind | holds :TooBigError |~~ Below ten. ~~| ~(lt 10))',
      '::Small#12 !| type'
    ))).toEqual(makeTag('Small/TooBigError'));
  });

  it('answers the error the recipe of its verb answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | past !| type')).toEqual(makeTag('path/IndexOutOfBoundsError'));
  });

  it('calls a verb under it by its address', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | Box/length')).toBe(4);
  });

  it('refuses under the verb a subject the walk of whose tags reaches no value of the label', async () => {
    expect(await evalQuery(BOX + '5 | Box/length !| type')).toEqual(makeTag('Box/length/SubjectNotBoxError'));
  });
});

describe('the args of a call', () => {
  it('refuses under the input a place the args do not hold', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put !| type')).toEqual(makeTag('Box/put/weight/NotGivenError'));
  });

  it('hands on the error an input answers for a place it holds', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | scaled "x" !| type')).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

  it('hands on the error a modifier answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put (get /missing) !| type')).toEqual(makeTag('path/IndexNotIntegerError'));
  });

  it('reads a place softly by query, and the values after the lead by any other step', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | get [~(tally) ~(tally 1 2 3)]')).toEqual(await evalQuery('[[null []] [1 [2 3]]]'));
  });

  it('reads the page of the invariant that refused, named by its refusal', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put "x" !| explain | page | content'))
      .toBe(' The weight is a number. ');
  });

  it('lets a verb under a label fold as a reducer', async () => {
    expect(await evalQuery(lines(
      ':number/addTo |~~ The sum with n. ~~| (::fn | takes :n |~~ The number added. ~~| /0 | impl ~(add n))',
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
  it('runs over the served value and the values of its inputs, a quote closed at the call where the input is run', async () => {
    const session = await createSession({
      sources: [{
        uri: 'probe/gauge',
        source: lines(
          ':Gauge |~~ A reading. ~~| (::kind | impl ::builtin{})',
          ':Gauge/over |~~ Whether the reading passes the test. ~~| (::fn | takes :test |~~ The test. ~~| /0 ::quote | impl ::builtin{})',
          ':Gauge/shifted |~~ The reading shifted. ~~| (::fn | takes :by |~~ The shift. ~~| /0 | impl ::builtin{})',
          ':Dial |~~ A reading of a dial. ~~| (::kind | impl ::builtin{})'
        ),
        impls: {
          'Gauge/construct': payload => payload * 2,
          'Gauge/over': runs(['test'], async (reading, test) => test(reading)),
          'Gauge/shifted': (reading, by) => reading.payload + by,
          'Dial/construct': payload => makeTagged(makeTag('Dial'), payload + 1)
        }
      }]
    });
    expect((await session.evalCell('::Gauge#5 | payload')).result).toBe(10);
    expect((await session.evalCell('::Gauge#5 | over ~(gt 9)')).result).toBe(true);
    expect((await session.evalCell('::Gauge#5 | shifted 3')).result).toBe(13);
    expect((await session.evalCell('::Dial#1 | payload')).result).toBe(2);
  });

  it('computes the modifiers of a call up to the first that answers an error, and runs none after it [QSQUO#modifier]', async () => {
    let noted = 0;
    const session = await createSession({
      sources: [{ uri: 'probe/note', source: ':any/note ::builtin{}', impls: { 'any/note': subject => { noted += 1; return subject; } } }]
    });
    expect((await session.evalCell('[1 2] | query (get /nope) ("ran" | note) !| type')).result).toEqual(makeTag('path/IndexNotIntegerError'));
    expect(noted).toBe(0);
  });

  it('reads the values after a primitive\'s lead by code over the args', async () => {
    const session = await createSession({
      sources: [{
        uri: 'probe/zap',
        source: ':vec/zap (::fn | takes :lead |~~ The lead. ~~| /0 | takes :rest |~~ The values after the lead. ~~| ~(drop 1) | impl ::builtin{})',
        impls: { 'vec/zap': (subject, lead, rest) => [lead, rest.length] }
      }]
    });
    expect((await session.evalCell('[9] | zap 1 2 3')).result).toEqual([1, 2]);
  });

  it('hands a primitive its inputs in the order its chain takes them, whatever their places', async () => {
    const session = await createSession({
      sources: [{
        uri: 'probe/pair',
        source: ':vec/pair2 (::fn | takes :b |~~ The second. ~~| /1 | takes :a |~~ The first. ~~| /0 | impl ::builtin{})',
        impls: { 'vec/pair2': (subject, b, a) => [a, b] }
      }]
    });
    expect((await session.evalCell('[0] | pair2 1 2')).result).toEqual([1, 2]);
  });
});
