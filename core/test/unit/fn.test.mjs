// The refusals a word that is a function raises by rule, read from its
// signature as its call raises them, which the catalog's drift test holds
// against the pages of the root's words [D251].

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { ruleRefusalsOf } from '../../src/runtime/nouns.mjs';

const session = await createSession();
await session.evalCell([
  ':number/pick (::fn | takes :by |~~ How much. ~~| /0 ::number | returns |~~ A boolean or a string. ~~| #[::boolean ::string] | impl ~(gt by))',
  ':number/keep (::fn | returns |~~ A number or a string. ~~| #[::number ::string] | impl ~(add 1))',
  ':number/plain (::fn | takes :by |~~ How much. ~~| ~(query /0 1) | impl ~(add by))'
].join(' | '));

describe('the refusals a word that is a function raises by rule [D251]', () => {
  it('names an answer of none of several kinds where its label is none of them', () => {
    expect(ruleRefusalsOf(session.env, 'number/pick')).toEqual([
      'number/pick/SubjectNotNumberError',
      'number/pick/ArgsBeyondPartsError',
      'number/pick/by/NotGivenError',
      'number/pick/by/NotNumberError',
      'number/pick/answer/NotBooleanOrStringError'
    ]);
  });

  it('names no refusal of an answer whose kinds hold its label', () => {
    expect(ruleRefusalsOf(session.env, 'number/keep')).toEqual(['number/keep/SubjectNotNumberError', 'number/keep/ArgsBeyondPartsError']);
  });

  it('names no refusal of an answer it does not name, nor of an input its place reads softly', () => {
    expect(ruleRefusalsOf(session.env, 'number/plain')).toEqual(['number/plain/SubjectNotNumberError', 'number/plain/ArgsBeyondPartsError']);
  });
});

describe('the refusals by rule of an input that names the kinds of each element [D251]', () => {
  it('names a value that is no vector where its place reads one object, and an element of none of its kinds', async () => {
    const own = await createSession();
    await own.evalCell(':number/each (::fn | takes :xs |~~ Values. ~~| /0 [::number] | impl ~(xs))');
    expect(ruleRefusalsOf(own.env, 'number/each')).toEqual([
      'number/each/SubjectNotNumberError',
      'number/each/ArgsBeyondPartsError',
      'number/each/xs/NotGivenError',
      'number/each/xs/NotVecError',
      'number/each/xs/ElementNotNumberError'
    ]);
  });
});

describe('a word written as declarations under its address keeps its call [D251]', () => {
  it('runs the code parts of a host\'s word, a quote written in the step in the scope of the step', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared',
      source: [
        ':number/twice |~~ Runs the code twice. ~~| ::builtin{}',
        '| :number/twice/code |~~ The code. ~~| /0',
        '| :number/twice/code/NotQuoteOrPathError |~~ A quote or a path. ~~| ::holds~(is ::quote ::path)',
        '| :number/each |~~ Runs each code. ~~| ::builtin{}',
        '| :number/each/codes |~~ The codes. ~~| ~(it)'
      ].join('\n'),
      impls: {
        'number/twice': async (subject, code) => await code(await code(subject)),
        'number/each': async (subject, codes) => await Promise.all(codes.map(code => code(subject)))
      }
    }] });
    expect((await hosted.evalCell('5 | twice ~(add 1)')).result).toBe(7);
    expect((await hosted.evalCell(':k 10 | 5 | each ~(add k) ~(mul 2)')).result).toEqual([15, 10]);
  });

  it('hands a host\'s word a part that asks for no code as it is, a path as code, and a value among code as it is', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared-values',
      source: [
        ':any/both |~~ Runs the code on the subject for each of two. ~~| ::builtin{}',
        '| :any/both/code |~~ The code. ~~| /0',
        '| :any/both/code/NotQuoteOrPathError |~~ A quote or a path. ~~| ::holds~(is ::quote ::path)',
        '| :any/pair |~~ Pairs the subject with a value. ~~| ::builtin{}',
        '| :any/pair/value |~~ The value. ~~| /0',
        '| :any/each |~~ Runs each code, and keeps each other value. ~~| ::builtin{}',
        '| :any/each/items |~~ The codes and the values. ~~| ~(it)'
      ].join('\n'),
      impls: {
        'any/both': async (subject, code) => [await code(subject), await code(subject)],
        'any/pair': (subject, value) => [subject, value],
        'any/each': async (subject, items) => await Promise.all(items.map(item => (typeof item === 'function' ? item(subject) : item)))
      }
    }] });
    expect((await hosted.evalCell('{:x 3} | both /x')).result).toEqual([3, 3]);
    expect((await hosted.evalCell('5 | pair 3')).result).toEqual([5, 3]);
    expect((await hosted.evalCell('5 | each ~(add 1) 7')).result).toEqual([6, 7]);
  });

  it('refuses an object that failed where a part asks for code, the part that reads the args whole naming its place', async () => {
    const answers = await Promise.all([
      ':number/w ~(1) | :number/w/c |~~ Code. ~~| /0 | :number/w/c/NotQuoteError |~~ A quote. ~~| ::holds~(is ::quote) | 5 | w (get /x) !| type',
      ':number/w ~(1) | :number/w/cs |~~ Codes. ~~| ~(it) | :number/w/cs/ElementNotQuoteError |~~ Quotes. ~~| ::holds~(every ~(is ::quote)) | 5 | w ~(add 1) (get /x) !| [type (get /index)]'
    ].map(async query => (await (await createSession()).evalCell(query)).result));
    expect(answers[0].name).toBe('number/w/c/NotQuoteError');
    expect(answers[1].map(fact => fact.name ?? fact)).toEqual(['number/w/cs/ElementNotQuoteError', 1]);
  });

  it('answers the failure of an object no part that asks for code reads', async () => {
    const answers = await Promise.all([
      ':number/w ~(1) | 5 | w (get /x) !| type',
      ':number/w ~(by) | :number/w/by |~~ By. ~~| /0 | 5 | w (get /x) !| type',
      ':number/w ~(by) | :number/w/by |~~ By. ~~| /0 | :number/w/by/NotNumberError |~~ A number. ~~| ::holds~(is ::number) | 5 | w (get /x) !| type'
    ].map(async query => (await (await createSession()).evalCell(query)).result));
    expect(answers.every(answer => answer.name === 'path/SubjectNotProjectableError')).toBe(true);
  });

  it('names the refusals its declarations raise by rule', async () => {
    const own = await createSession();
    await own.evalCell([
      ':number/w ~(by)',
      ':number/w/by |~~ By. ~~| /0',
      ':number/w/soft |~~ Soft. ~~| ~(query /1 0)',
      ':number/w/answer |~~ A boolean or a string. ~~| #[::boolean ::string]'
    ].join(' | '));
    expect(ruleRefusalsOf(own.env, 'number/w')).toEqual([
      'number/w/SubjectNotNumberError',
      'number/w/ArgsBeyondPartsError',
      'number/w/by/NotGivenError',
      'number/w/answer/NotBooleanOrStringError'
    ]);
    await own.evalCell(':number/v ~(1) | :number/v/all |~~ All. ~~| ~(it)');
    expect(ruleRefusalsOf(own.env, 'number/v')).toEqual(['number/v/SubjectNotNumberError']);
  });
});

describe('a word a later source declares as a function [D251]', () => {
  it('runs by its function, its recipe reading its input past a value of the reader of the name', async () => {
    const hosted = await createSession({ sources: [{ uri: 'test/twice', source: ':number/twice ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by | add by)]' }] });
    expect((await hosted.evalCell(':by 99 | 5 | twice 1')).result).toBe(7);
  });
});
