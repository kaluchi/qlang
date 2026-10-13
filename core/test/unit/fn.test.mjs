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

describe('a word a later source declares as a function [D251]', () => {
  it('runs by its function, its recipe reading its input past a value of the reader of the name', async () => {
    const hosted = await createSession({ sources: [{ uri: 'test/twice', source: ':number/twice ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by | add by)]' }] });
    expect((await hosted.evalCell(':by 99 | 5 | twice 1')).result).toBe(7);
  });
});
