import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { ruleRefusalsOf } from '../../../src/nouns.mjs';
import { makeTag } from '../../../src/types.mjs';
import { BOX } from '../../helpers/box.mjs';

describe('the refusals by rule of an input that names the kinds of each element', () => {
  it('names a value that is no vector where its place reads one arg, and an element of none of its kinds', async () => {
    const own = await createNotebook();
    await own.evalCell(':number/each (::fn | takes :xs |~~ Values. ~~| /0 [::number] | impl ~(xs))');
    expect(ruleRefusalsOf(own.scope, 'number/each')).toEqual([
      'number/each/SubjectNotNumberError',
      'number/each/ArgsBeyondInputsError',
      'number/each/xs/NotGivenError',
      'number/each/xs/KindNotTakenError',
      'number/each/xs/ElementKindNotTakenError'
    ]);
  });

  it('names an element of none of its kinds alone where its place reads the args whole, which are a vector', async () => {
    const own = await createNotebook();
    await own.evalCell(':number/all (::fn | takes :xs |~~ Values. ~~| ~(it) [::number] | impl ~(xs))');
    expect(ruleRefusalsOf(own.scope, 'number/all')).toEqual(['number/all/SubjectNotNumberError', 'number/all/xs/ElementKindNotTakenError']);
  });
});

describe('the place of an input', () => {
  const answerOf = async query => (await (await createNotebook()).evalCell(query)).result;

  it('fills the head of the code with the step that answers the value of each input, a value of every kind', async () => {
    for (const [value, written] of [
      ['[1 2]', '[1 2]'], ['{:a 1}', '{:a 1}'], ['#[1]', '#[1]'], ['::Box[1]', '::Box[1]'], ['!{:a 1}', '!{:a 1}'],
      ['::Foo!{:a 1}', '::Foo!{:a 1}'], ['~(add 1)', '~(add 1)'], ['("/a" | parse)', '::quote[/a]'], ['|~~ d ~~|', '(|~~ d ~~|)'],
      ['[~(add 1) {:b #[2]}]', '[~(add 1) {:b #[2]}]']
    ]) {
      const filled = await answerOf(`(::fn | takes :v |~~ V. ~~| /0 | impl ~(v)) | fill ${value} | get [~(toString) ~(:q it | null | apply q | eq ${value})]`);
      expect(filled, value).toEqual([`:v |~~ V. ~~| ${written} | v`, true]);
    }
  });

  it('reads a place of a path a quote holds alone as the path', async () => {
    expect(await answerOf(':any/h (::fn | takes :n |~~ N. ~~| ("/0" | parse) | impl ~(n)) | 1 | h 7')).toBe(7);
  });

  it('runs a place that reads a part deeper than one arg as code over the args', async () => {
    expect(await answerOf(':any/deep (::fn | takes :n |~~ N. ~~| ~(query /0/a 5) | impl ~(n)) | 1 | get [~(deep {:a 7}) ~(deep {:b 1})]')).toEqual([7, 5]);
  });

  it('runs a place of `query` with more modifiers than it takes as code, which `query` refuses', async () => {
    expect((await answerOf(':any/three (::fn | takes :n |~~ N. ~~| ~(query /0 1 2) | impl ~(n)) | 1 | three 9')).tag.name).toBe('any/query/ArgsBeyondInputsError');
  });

  it('reads the args whole by `~(it)` alone, so a failed modifier is the answer under any other place', async () => {
    for (const place of ['~(it | first)', '~(it 1)']) {
      const failed = await answerOf(`:any/g (::fn | takes :code |~~ C. ~~| ${place} ::quote | impl ~(code)) | 1 | g (count)`);
      expect(failed.tag.name, place).toBe('call/KindAnswersNoVerbError');
    }
  });
});

describe('the args of a call', () => {
  it('refuses under the input a place the args do not hold', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put !| type')).toEqual(makeTag('Box/put/weight/NotGivenError'));
  });

  it('reads a place softly by query, and the values after the lead by any other step, under the tag of the call\'s args', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | get [~(tally) ~(tally 1 2 3)]')).toEqual(await evalQuery('[[null ::Box/tally[]] [1 ::Box/tally[2 3]]]'));
  });
});

it('a host\'s primitive under a label reads the values after its lead by code over the args', async () => {
  const notebook = await createNotebook({
    sources: [{
      uri: 'probe/zap',
      source: ':vec/zap (::fn | takes :lead |~~ The lead. ~~| /0 | takes :rest |~~ The values after the lead. ~~| ~(drop 1) | impl ::builtin{})',
      primitives: { 'vec/zap': (subject, lead, rest) => [lead, rest.length] }
    }]
  });
  expect((await notebook.evalCell('[9] | zap 1 2 3')).result).toEqual([1, 2]);
});
