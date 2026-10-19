// The kind built from `::kind` by commands [QSBLD#kind]: the refusals it raises by
// rule, which the catalog's drift test holds against the pages of the root's
// kinds, the reading of its chain as the body of a bare name, the
// declarations under it its chain holds alone, and a constructor its host has
// not yet handed.

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { ruleRefusalsOf } from '../../src/nouns.mjs';
import { printValue } from '../../src/print-value.mjs';
import { isGroupStep, isConstructStep, builtFrom } from '../../src/steps.mjs';
import { isTag } from '../../src/types.mjs';

const answers = async query => printValue(await evalQuery(query));

describe('the refusals a kind raises by rule [QSBLD#kind]', () => {
  it('names the payload of none of its kinds, each field left out and of none of its kinds, and a field of no kinds left out alone', async () => {
    const own = await createSession();
    await own.evalCell([
      ':Box',
      '  |~~ A parcel. ~~|',
      '  ::kind',
      '    | wraps |~~ The sizes. ~~| ::map',
      '    | reads :w |~~ The width. ~~| /w ::number',
      '    | reads :tags |~~ The tags. ~~| ~(query /tags []) [::keyword]',
      '    | reads :note |~~ A note. ~~| /note'
    ].join('\n'));
    expect(ruleRefusalsOf(own.scope, 'Box')).toEqual([
      'Box/PayloadKindNotTakenError',
      'Box/w/NotGivenError',
      'Box/w/KindNotTakenError',
      'Box/tags/NotGivenError',
      'Box/tags/KindNotTakenError',
      'Box/tags/ElementKindNotTakenError',
      'Box/note/NotGivenError'
    ]);
  });

  it('names a payload that is no vector where it names the kinds of each element', async () => {
    const own = await createSession();
    await own.evalCell(':Nums\n  |~~ Numbers. ~~|\n  ::kind\n    | wraps |~~ The numbers. ~~| [::number]');
    expect(ruleRefusalsOf(own.scope, 'Nums')).toEqual(['Nums/PayloadKindNotTakenError', 'Nums/ElementKindNotTakenError']);
    expect(printValue((await own.evalCell('::Nums#5 !| type')).result)).toBe('::Nums/PayloadKindNotTakenError');
  });

  it('names no refusal of a kind of no payload and no field', async () => {
    const own = await createSession();
    await own.evalCell(':Mark\n  |~~ A mark. ~~|\n  ::kind\n    | proves :holds |~~ It holds. ~~| ~(true)');
    expect(ruleRefusalsOf(own.scope, 'Mark')).toEqual([]);
  });
});

describe('a field of a kind', () => {
  it('refuses a value that is no vector where it names the kinds of each element', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :xs |~~ Values. ~~| /xs [::number]) | ::Box{:xs 5} !| type'))
      .toBe('::Box/xs/KindNotTakenError');
  });

  it('answers the failure of a quote that reads it, past a place it leaves out', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w | add "x")) | ::Box{:w 1} !| type'))
      .toBe('::number/add/addend/KindNotTakenError');
  });

  it('refuses a place a quote reads that the payload leaves out as left out', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w)) | ::Box{} !| type'))
      .toBe('::Box/w/NotGivenError');
  });
});

describe('the chain of a kind as the body of a bare name [QSBLD#kind]', () => {
  const bodyOf = source => parse(source)[0].get('body');

  it('reads the chain of a bare name with its page begun on a later line, the group of its steps', () => {
    const body = bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind\n    | wraps |~~ The sizes. ~~| ::map');
    expect(isGroupStep(body)).toBe(true);
    expect(body.payload.length).toBe(2);
  });

  it('reads one step on the line of the name', () => {
    expect(isTag(bodyOf(':Box |~~ A parcel. ~~| ::kind | wraps |~~ The sizes. ~~| ::map'))).toBe(true);
  });

  it('reads one step of a bare name with no page', () => {
    expect(isTag(bodyOf(':s\n::vec\n| s'))).toBe(true);
  });

  it('reads a literal of a kind as the body, which no chain heads', () => {
    expect(isConstructStep(bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind[~() null]'))).toBe(true);
  });

  it('builds a body from the noun its literal names, in a group or not, and a group of another step from none', () => {
    expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| (::kind[~() null])'))).toBe('kind');
    expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| ::kind[~() null]'))).toBe('kind');
    expect(builtFrom(bodyOf(':x (count)'))).toBe(null);
  });

  it('declares a word of a literal by the chain of a kind, and refuses it any other body', () => {
    expect(() => parse(':null\n  |~~ Nothing. ~~|\n  ::kind\n    | wraps |~~ Null. ~~|')).not.toThrow();
    expect(() => parse(':null\n  |~~ Nothing. ~~|\n  ::kind[~() null]')).not.toThrow();
    expect(() => parse(':null |~~ Nothing. ~~| 5')).toThrow(/word of a literal/);
  });
});

describe('a declaration under a label that the chain of its kind holds alone [QSBLD#chain]', () => {
  it('refuses an invariant and a constructor and takes a page and a law', async () => {
    const kind = ':Pos |~~ A positive number. ~~| (::kind | wraps |~~ The number. ~~| ::number)';
    expect(await answers(`${kind} | :Pos/NotPositiveError ::invariant~(gt 0) !| type`)).toBe('::bind/WrittenOutsideItsChainError');
    expect(await answers(`${kind} | :Pos/construct ~(add 0) !| type`)).toBe('::bind/WrittenOutsideItsChainError');
    expect(await answers(`${kind} | :Pos/note |~~ A note. ~~| | ::Pos/note | doc | content | trim`)).toBe('"A note."');
  });

  it('refuses an invariant and a constructor under a label declared by its page, a kind of no commands', async () => {
    expect(await answers(':Pos |~~ A positive number. ~~| | :Pos/NotPositiveError ::invariant~(gt 0) !| type')).toBe('::bind/WrittenOutsideItsChainError');
    expect(await answers(':Pos |~~ A positive number. ~~| | :Pos/construct ~(add 0) !| type')).toBe('::bind/WrittenOutsideItsChainError');
  });
});

describe('the constructor a host hands a kind', () => {
  it('lays the tag over the payload as it is until the host hands the constructor, and runs it after', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/hosted-kind',
      source: ':Hk\n  |~~ A kind its host builds. ~~|\n  ::kind[~() ::builtin{}]\n| :Hk/early ::law~(::Hk#1 | payload | eq 1)',
      primitives: { 'Hk/construct': payload => payload + 1 }
    }] });
    expect(printValue((await hosted.evalCell('::Hk#1 | payload')).result)).toBe('2');
    expect(printValue((await hosted.evalCell('::Hk | runLaws | map /ok')).result)).toBe('[false]');
  });
});

describe('a command a function and a kind share, called on another tag', () => {
  it('meets the verbs of both nouns, each reached by its address', async () => {
    expect(await answers('::number | holds :E |~~ An e. ~~| ~(true) !| get [~(type) /addresses]'))
      .toBe('[::call/KindAnswersNoVerbError #[::fn/holds ::kind/holds]]');
  });
});
