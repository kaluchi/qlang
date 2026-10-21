// A tag is the address of a node of the tree of names, and a tagged literal
// puts its payload under the tag through the constructor of the kind, which
// attaches the tag or refuses the payload [QSNAM#address], [QSLIT#tag].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { isErrorValue, isMap, makeTag } from '../../src/types.mjs';
import { isConstructStep } from '../../src/steps.mjs';
import { printQuoteSource } from '../../src/print-value.mjs';

describe('the parser reads a tag before a payload as a tagged literal', () => {
  it('[QSLIT#tag] reads a map touching a tag as its payload', () => {
    const [step] = parse('::Box{:k 1}');
    expect(isConstructStep(step)).toBe(true);
    expect(isMap(step.get('payload'))).toBe(true);
  });
});

describe('a kind whose construct is a primitive of the host', () => {
  it('[QSHST#source] puts a payload under the tag through the constructor its host hands', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'tests/kind', source: ':myType |~~ myType. ~~| (::kind | impl ::builtin{})', primitives: { 'myType/construct': payload => payload * 2 } }]
    });
    expect((await sessionInstance.evalCell('::myType#4 | get [~(type) ~(payload)]')).result).toEqual([makeTag('myType'), 8]);
  });

  it('[QSHST#source] a kind a reader declares with a constructor no host hands lays its tag over a quote', async () => {
    const result = await evalQuery(':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | ::myType~(add 1) | type');
    expect(result).toEqual(makeTag('myType'));
  });
});

describe('the subject an axis reads', () => {
  it('[QSSLF#axis] a value tagged by a user tag reads the source of that tag', async () => {
    const source = await evalQuery(':Box |~~ A box. ~~| | ::Box#[3 1] | source');
    expect(printQuoteSource(source)).toBe(':Box |~~ A box. ~~|');
  });

  it('[QSSLF#axis] a map holding a tag in its :kind field reads ::map, since a field names nothing', async () => {
    expect(await evalQuery(
      ':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | {:kind ::myType :payload []} | source | eq (::map | source)'
    )).toBe(true);
  });
});

describe('what `tag` hands on', () => {
  it('[QSERR#catch] tag hands on an error in the pipe and lays no tag over it', async () => {
    const err = await evalQuery('("not-a-number" | add 1) | tag ::Box');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

  it('[QSQUO#modifier] tag hands on an error its modifier answers', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });
});

describe('the tag `tag` lays is computed against the value in the pipe', () => {
  it('[QSQUO#modifier] a tag a vector holds beside a value is read through a name of the vector', async () => {
    // The subject of a call is the value in the pipe [QSNUM#combine], so the pair is named before its value takes the tag it holds.
    const r = await evalQuery('[42 ::Box] | :pair it | get /0 | tag (pair | get /1) | type');
    expect(r).toEqual(makeTag('Box'));
  });
});

describe('a tag no declaration answers lays itself over any payload', () => {
  it('[QSLIT#tag] a vector under a tag is read as a vector, and `type` reads the tag', async () => {
    const { isVec, isTagged, typeOf, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const tagged = await evalQuery('::Loose[1 2 3]');
    expect(Array.isArray(tagged)).toBe(true);
    expect(isVec(tagged)).toBe(true);
    expect(isTagged(tagged)).toBe(true);
    expect(tagged[TAG_HEADER_SYMBOL]).toEqual(makeTag('Loose'));
    expect(typeOf(tagged)).toEqual(makeTag('Loose'));
    expect(tagged.length).toBe(3);
    expect(tagged[0]).toBe(1);
    expect(tagged[1]).toBe(2);
  });

  it('[QSLIT#tag] a map under a tag is read as a map, its entries its own', async () => {
    const { isMap, isTagged, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const tagged = await evalQuery('::Loose{:custom "field" :position 1}');
    expect(isMap(tagged)).toBe(true);
    expect(isTagged(tagged)).toBe(true);
    expect(tagged[TAG_HEADER_SYMBOL]).toEqual(makeTag('Loose'));
    expect(tagged.get('custom')).toBe('field');
    expect(tagged.get('position')).toBe(1);
  });

  it('[QSLIT#tag] a string under a tag is held whole, and `payload` takes it off', async () => {
    const { isTagged, typeOf } = await import('../../src/types.mjs');
    const tagged = await evalQuery('::Loose"hello"');
    expect(isTagged(tagged)).toBe(true);
    expect(typeOf(tagged)).toEqual(makeTag('Loose'));
    expect(tagged.payload).toBe('hello');
    const extracted = await evalQuery('::Loose"hello" | payload');
    expect(extracted).toBe('hello');
  });

  it('[QSLIT#tag] a keyword touches its tag by its colon', async () => {
    const { isTagged, isKeyword } = await import('../../src/types.mjs');
    const tagged = await evalQuery('::Loose:foo');
    expect(isTagged(tagged)).toBe(true);
    expect(isKeyword(tagged.payload)).toBe(true);
    expect(tagged.payload.name).toBe('foo');
  });

  it('[QSLIT#tag] a number touches its tag by `#`, since `::Tag42` reads as one name', async () => {
    const { isTagged } = await import('../../src/types.mjs');
    const tagged = await evalQuery('::Loose#42');
    expect(isTagged(tagged)).toBe(true);
    expect(tagged.payload).toBe(42);
  });
});

describe('the steps of a tagged literal and of a tag', () => {
  it('[QSQUO#step] a tagged literal is a `::construct` step over the step of its payload', async () => {
    expect(await evalQuery('~(::invariant~(mul 2)) | first | get [~(type) /tag /payload]'))
      .toEqual(await evalQuery('[::construct ::invariant ~(mul 2)]'));
  });

  it('[QSQUO#step] a tag alone is its name as a step', async () => {
    expect(await evalQuery('~(::Box) | first')).toEqual(makeTag('Box'));
  });
});

describe('a tag name as a value', () => {
  it('[QSPRN#print] printValue renders a tag as ::name', async () => {
    const { printValue } = await import('../../src/print-value.mjs');
    expect(printValue(makeTag('foo'))).toBe('::foo');
  });
});

describe('within edits under one tag and lays the tag back', () => {
  // The payload runs through the quote as a fork and the subject's tag is
  // laid back over the answer, its constructor running once [QSDSP#answer].
  it('[QSCOL#within] a constructor that refuses the answer refuses the edit', async () => {
    expect(await evalQuery('#[1 2] | within ~(count) !| type'))
      .toEqual(makeTag('set/PayloadKindNotTakenError'));
  });

  it('[QSCOL#within] an error the edit answers passes as it is, and one the code answers is refused by its input', async () => {
    expect(await evalQuery('#[1 2] | within ~(!{:k 2} | raise) !| get /k')).toBe(2);
    expect(await evalQuery('#[1 2] | within (!{:k 1} | raise) !| type')).toEqual(makeTag('tagged/within/code/KindNotTakenError'));
  });
});
