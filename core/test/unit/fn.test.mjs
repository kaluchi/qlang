// The refusals a verb that is a function raises by rule, read from its
// chain as its call raises them, which the guard of the pages of the
// refusals holds against the pages of the root's verbs [QSERR#site].

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { ruleRefusalsOf } from '../../src/nouns.mjs';
import { runs } from '../../src/primitives.mjs';

const session = await createSession();
await session.evalCell([
  ':number/pick (::fn | takes :by |~~ How much. ~~| /0 ::number | returns |~~ A boolean or a string. ~~| #[::boolean ::string] | impl ~(gt by))',
  ':number/keep (::fn | returns |~~ A number or a string. ~~| #[::number ::string] | impl ~(add 1))',
  ':number/plain (::fn | takes :by |~~ How much. ~~| ~(query /0 1) | impl ~(add by))'
].join(' | '));

describe('the refusals a verb that is a function raises by rule [QSERR#site]', () => {
  it('names an answer of none of several kinds where its label is none of them', () => {
    expect(ruleRefusalsOf(session.scope, 'number/pick')).toEqual([
      'number/pick/SubjectNotNumberError',
      'number/pick/ArgsBeyondInputsError',
      'number/pick/by/NotGivenError',
      'number/pick/by/KindNotTakenError',
      'number/pick/answer/KindNotTakenError'
    ]);
  });

  it('names no refusal of an answer whose kinds hold its label', () => {
    expect(ruleRefusalsOf(session.scope, 'number/keep')).toEqual(['number/keep/SubjectNotNumberError', 'number/keep/ArgsBeyondInputsError']);
  });

  it('names no refusal of an answer it does not name, nor of an input its place reads softly', () => {
    expect(ruleRefusalsOf(session.scope, 'number/plain')).toEqual(['number/plain/SubjectNotNumberError', 'number/plain/ArgsBeyondInputsError']);
  });
});

describe('the refusals by rule of an input that names the kinds of each element [QSBLD#fn]', () => {
  it('names a value that is no vector where its place reads one arg, and an element of none of its kinds', async () => {
    const own = await createSession();
    await own.evalCell(':number/each (::fn | takes :xs |~~ Values. ~~| /0 [::number] | impl ~(xs))');
    expect(ruleRefusalsOf(own.scope, 'number/each')).toEqual([
      'number/each/SubjectNotNumberError',
      'number/each/ArgsBeyondInputsError',
      'number/each/xs/NotGivenError',
      'number/each/xs/KindNotTakenError',
      'number/each/xs/ElementKindNotTakenError'
    ]);
  });
});

describe('a host\'s verb written as the chain of its function [QSHST#source]', () => {
  it('runs the code inputs of a host\'s verb, a quote written in the step in the scope of the step', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared',
      source: [
        ':number/twice |~~ Runs the code twice. ~~| (::fn | takes :code |~~ The code. ~~| /0 #[::path ::quote] | impl ::builtin{})',
        '| :number/each |~~ Runs each code. ~~| (::fn | takes :codes |~~ The codes. ~~| ~(it) [#[::path ::quote]] | impl ::builtin{})'
      ].join('\n'),
      primitives: {
        'number/twice': runs(['code'], async (subject, code) => await code(await code(subject))),
        'number/each': runs(['codes'], async (subject, codes) => await Promise.all(codes.map(code => code(subject))))
      }
    }] });
    expect((await hosted.evalCell('5 | twice ~(add 1)')).result).toBe(7);
    expect((await hosted.evalCell(':k 10 | 5 | each ~(add k) ~(mul 2)')).result).toEqual([15, 10]);
  });

  it('hands a host\'s verb an input it runs as code, a path among it, and an input it does not run as it is', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared-values',
      source: [
        ':any/both |~~ Runs the code on the subject for each of two. ~~| (::fn | takes :code |~~ The code. ~~| /0 #[::path ::quote] | impl ::builtin{})',
        '| :any/pair |~~ Pairs the subject with a value. ~~| (::fn | takes :value |~~ The value. ~~| /0 | impl ::builtin{})',
        '| :any/each |~~ Runs each code, and keeps each other value. ~~| (::fn | takes :items |~~ The codes and the values. ~~| ~(it) | impl ::builtin{})'
      ].join('\n'),
      primitives: {
        'any/both': runs(['code'], async (subject, code) => [await code(subject), await code(subject)]),
        'any/pair': (subject, value) => [subject, value],
        'any/each': runs(['items'], async (subject, items) => await Promise.all(items.map(item => (typeof item === 'function' ? item(subject) : item))))
      }
    }] });
    expect((await hosted.evalCell('{:x 3} | both /x')).result).toEqual([3, 3]);
    expect((await hosted.evalCell('5 | pair 3')).result).toEqual([5, 3]);
    expect((await hosted.evalCell('5 | each ~(add 1) 7')).result).toEqual([6, 7]);
  });

  it('names the refusals of a verb written as its recipe alone, the function of no commands it is [QSBLD#recipe]', async () => {
    const own = await createSession();
    await own.evalCell(':number/v ~(1)');
    expect(ruleRefusalsOf(own.scope, 'number/v')).toEqual(['number/v/SubjectNotNumberError', 'number/v/ArgsBeyondInputsError']);
  });
});

describe('a verb a later source declares as a function [QSBLD#recipe]', () => {
  it('runs by its function, its recipe reading its input past a value of the reader of the name', async () => {
    const hosted = await createSession({ sources: [{ uri: 'test/twice', source: ':number/twice ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by | add by)]' }] });
    expect((await hosted.evalCell(':by 99 | 5 | twice 1')).result).toBe(7);
  });
});

// An input reads the args by its place: one step that reads one arg, a path
// or `query` with a default or none, is read where it stands, a quote of a
// path alone as the path, and any other place runs as code over the args,
// `~(it)` alone reading them whole [QSBLD#input].
describe('the place of an input [QSBLD#input]', () => {
  const answerOf = async query => (await (await createSession()).evalCell(query)).result;

  it('fills the head of the code with the step that answers the value of each input, a value of every kind [QSBLD#fn]', async () => {
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
