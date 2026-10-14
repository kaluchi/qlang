// A tag is the address of a node of the tree of names, and a tagged
// literal puts its payload under the tag through the constructor of the
// kind, which attaches the tag or refuses the payload [D152], [D279].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { isErrorValue, isQuote, makeTag } from '../../src/types.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe('the parser reads a tag before a payload as a tagged literal', () => {
  it('reads a quote after a tag as its payload', () => {
    const ast = parse('::holds~(mul 2)');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.tag).toBe('holds');
    expect(ast.payload.type).toBe('QuoteLit');
  });

  it('reads a tag alone as the tag name', () => {
    const ast = parse('::Box');
    expect(ast.type).toBe('TagLit');
    expect(ast.tag).toBe('Box');
  });

  it('reads a map touching a tag as its payload', () => {
    const ast = parse('::Box{:k 1}');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.payload.type).toBe('MapLit');
  });
});

describe('a word under a label runs when its name is mentioned', () => {
  it('a word runs when its name is called', async () => {
    const result = await evalQuery(':any/double ~(mul 2) | 5 | double');
    expect(result).toBe(10);
  });

  it('a word binds its inputs from the modifiers', async () => {
    const result = await evalQuery(
      ':any/surround (::fn | takes :pfx |~~ The prefix. ~~| /0 ::string | takes :sfx |~~ The suffix. ~~| /1 ::string | impl ~(prepend pfx | append sfx)) | "x" | surround "[" "]"'
    );
    expect(result).toBe('[x]');
  });

  it('a declared word recurses by its own name', async () => {
    const result = await evalQuery(
      ':any/walk ~(if empty ~(0) ~(drop 1 | walk | add 1)) | [1 2 3] | walk'
    );
    expect(result).toBe(3);
  });
});

describe('a kind whose construct is a primitive of the host', () => {
  it('puts a payload under the tag through the check its host hands [D34]', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'tests/kind', source: ':myType |~~ myType. ~~| (::kind | impl ::builtin{})', impls: { 'myType/construct': payload => payload * 2 } }]
    });
    expect((await sessionInstance.evalCell('::myType#4 | get [~(type) ~(payload)]')).result).toEqual([makeTag('myType'), 8]);
  });

  it('a construct a reader declares as ::builtin{} reaches no primitive, and the tag lays over the payload [D34]', async () => {
    const result = await evalQuery(':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | ::myType~(add 1) | type');
    expect(result).toEqual(makeTag('myType'));
  });

  it('`source` reads the declaration of a kind from its tag', async () => {
    const source = await evalQuery(
      ':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | ::myType | source'
    );
    expect(isQuote(source)).toBe(true);
    expect(printQuoteSource(source)).toContain(':myType');
  });
});

describe('the subject an axis reads', () => {
  it('a value tagged by a user tag reads the source of that tag', async () => {
    const source = await evalQuery(':Box |~~ A box. ~~| | ::Box#[3 1] | source');
    expect(printQuoteSource(source)).toBe(':Box |~~ A box. ~~|');
  });

  it('a map holding a tag in its :kind field reads ::map, since a field names nothing', async () => {
    expect(await evalQuery(
      ':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | {:kind ::myType :payload []} | source | eq (::map | source)'
    )).toBe(true);
  });
});

describe('a tag alone is the tag name', () => {
  it('`::Box` answers the tag named Box', async () => {
    const { isTag } = await import('../../src/types.mjs');
    const result = await evalQuery('::Box');
    expect(isTag(result)).toBe(true);
    expect(result.name).toBe('Box');
  });

  it('a tag no declaration answers is the tag name all the same, as a keyword is', async () => {
    const { isTag } = await import('../../src/types.mjs');
    const result = await evalQuery('::someUnboundType');
    expect(isTag(result)).toBe(true);
    expect(result.name).toBe('someUnboundType');
  });
});

describe('what a tag before a payload refuses and hands on', () => {
  it('a tag no node answers puts the value under it as identity', async () => {
    const evalResult = await evalQuery('::unboundTag[1 2 3] | type');
    expect(evalResult).toEqual(makeTag('unboundTag'));
  });

  it('refuses a tag whose node is neither a kind nor a word', async () => {
    const err = await evalQuery(':limit 5 | ::limit[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('construct/TagNotKindError'));
  });

  it('lays the tag of a word over the args of a call of it, which read back [D164]', async () => {
    expect(await evalQuery('1 | add 1 2 !| get /actualValue | eq ::number/add[1 2]')).toBe(true);
    expect(await evalQuery('::vec/count[] | type')).toEqual(makeTag('vec/count'));
  });

  it('`::builtin` refuses a string for its payload', async () => {
    const err = await evalQuery('::builtin"hello"');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('builtin/PayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTag('string'));
  });

  it('`::builtin` refuses a vector for its payload', async () => {
    const err = await evalQuery('::builtin[1 2 3]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('builtin/PayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTag('vec'));
  });

  it('tag hands on an error in the pipe and lays no tag over it', async () => {
    const err = await evalQuery('("not-a-number" | add 1) | tag ::Box');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

  it('tag hands on an error its modifier answers', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

});

describe('a tag no declaration answers lays itself over any payload', () => {

  it('an error literal under a tag, raised, is a failure of that tag [D13]', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const err = await evalQuery('::number/add/SubjectNotNumberError!{:custom "field" :note 42} | raise');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(err.descriptor.get('custom')).toBe('field');
    expect(err.descriptor.get('note')).toBe(42);
  });

  it('a vector under a tag is read as a vector, and `type` reads the tag', async () => {
    const { isVec, isTaggedInstance, typeKeyword, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError[1 2 3]');
    expect(Array.isArray(instance)).toBe(true);
    expect(isVec(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(typeKeyword(instance)).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(instance.length).toBe(3);
    expect(instance[0]).toBe(1);
    expect(instance[1]).toBe(2);
  });

  it('a map under a tag is read as a map, its entries its own', async () => {
    const { isQMap, isTaggedInstance, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError{:custom "field" :position 1}');
    expect(isQMap(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.has('kind')).toBe(false);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(instance.get('custom')).toBe('field');
    expect(instance.get('position')).toBe(1);
  });

  it('a string under a tag is held whole, and `payload` takes it off', async () => {
    const { isTaggedInstance, typeKeyword } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError"hello"');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(typeKeyword(instance)).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(instance.payload).toBe('hello');
    const extracted = await evalQuery('::number/add/SubjectNotNumberError"hello" | payload');
    expect(extracted).toBe('hello');
  });

  it('a keyword touches its tag by its colon', async () => {
    const { isTaggedInstance, isKeyword } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError:foo');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(isKeyword(instance.payload)).toBe(true);
    expect(instance.payload.name).toBe('foo');
  });

  it('a number touches its tag by `#`, since `::Tag42` reads as one name [D279]', async () => {
    const { isTaggedInstance } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError#42');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.payload).toBe(42);
  });
});

describe('the steps of a tagged literal and of a tag', () => {
  it('a tagged literal is a `::construct` step over the step of its payload [D8]', async () => {
    expect(await evalQuery('~(::holds~(mul 2)) | first | get [~(type) /tag /payload]'))
      .toEqual(await evalQuery('[::construct ::holds ~(mul 2)]'));
  });

  it('a tag alone is its name as a step', async () => {
    expect(await evalQuery('~(::Box) | first')).toEqual(makeTag('Box'));
  });
});

describe('a tag name as a value', () => {

  it('formOf / typeKeyword tell a tag name from a keyword', async () => {
    const { formOf, typeKeyword, makeTag } = await import('../../src/types.mjs');
    const k = makeTag('foo');
    expect(formOf(k)).toBe('tag');
    expect(typeKeyword(k)).toEqual(makeTag('tag'));
  });

  it('tag equality compares by name', async () => {
    const { makeTag } = await import('../../src/types.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    expect(deepEqual(makeTag('foo'), makeTag('foo'))).toBe(true);
    expect(deepEqual(makeTag('foo'), makeTag('bar'))).toBe(false);
  });

  it('printValue renders a tag as ::name', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { makeTag } = await import('../../src/types.mjs');
    expect(printValue(makeTag('foo'))).toBe('::foo');
  });

});

describe('a quote is text to `parse` and code to `apply`', () => {
  it('`~(code) | parse` prints the quote as its text', async () => {
    expect(await evalQuery('~(5 | mul 2) | parse')).toBe('5 | mul 2');
  });

  it('`~(code) | apply it` runs the quote on itself', async () => {
    expect(await evalQuery('~(5 | mul 2) | apply it')).toBe(10);
  });
});

describe('a tag no node answers is a kind of identity, and declares nothing [D152]', () => {
  it('leaves no binding to read', async () => {
    const result = await evalQuery('::Top#1 | :minted it | ::Top | binding');
    expect(result.tag.name).toBe('any/binding/UnknownNameError');
    expect(await evalQuery('::Zap#1 | env | has :Zap')).toBe(false);
  });
});

describe('within edits under one tag and rewraps it', () => {
  // The payload runs through the quote as a fork and mints back under
  // the subject's tag, whose constructor runs once, at the rewrap [D41].
  it('a set normalizes the vector the edit answers', async () => {
    expect(await evalQuery('#[1 2] | within ~(get [/0 /0 /1]) | eq #[1 2]')).toBe(true);
  });

  it('a tag of identity alone stamps its header back on the answer', async () => {
    expect(await evalQuery(':Box |~~ Box. ~~| | ::Box[1 2] | within ~(reverse) | eq ::Box[2 1]')).toBe(true);
  });

  it('a constructor that refuses the answer refuses the edit', async () => {
    expect(await evalQuery('#[1 2] | within ~(count) !| type'))
      .toEqual(makeTag('set/PayloadNotVecError'));
  });

  it('the declarations of the edit stay inside it', async () => {
    expect(await evalQuery('#[1 2] | within ~(:k 5 | get [/0 /1]) | env | has :k')).toBe(false);
  });

  it('an error the edit answers passes as it is, and one the code answers is refused by its input', async () => {
    expect(await evalQuery('#[1 2] | within ~(!{:k 2} | raise) !| get /k')).toBe(2);
    expect(await evalQuery('#[1 2] | within (!{:k 1} | raise) !| type')).toEqual(makeTag('tagged/within/code/NotPathOrQuoteError'));
  });

  it('a subject with no tag and a code that is no quote are refused', async () => {
    expect(await evalQuery('[1 2] | within ~(reverse) !| type'))
      .toEqual(makeTag('tagged/within/SubjectNotTaggedError'));
    expect(await evalQuery('#[1 2] | within 1 !| type'))
      .toEqual(makeTag('tagged/within/code/NotPathOrQuoteError'));
  });
});
