// Tests for TaggedLit / BareTypeKeyword grammar + eval: a tag is the
// address of a node of the tree of names, and ::tag<payload> builds the
// value through the constructor the kind's spec declares [D152].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { isErrorValue, isQuote, makeTagKeyword } from '../../src/types.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe('TaggedLit grammar parses ::tag<payload> as own AST node', () => {
  it('parses ::holds~(body) as TaggedLit with a quote payload', () => {
    const ast = parse('::holds~(mul 2)');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.tag).toBe('holds');
    expect(ast.payload.type).toBe('QuoteLit');
  });

  it('parses bare ::tag (no payload) as BareTypeKeyword', () => {
    const ast = parse('::Box');
    expect(ast.type).toBe('BareTypeKeyword');
    expect(ast.tag).toBe('Box');
  });

  it('TaggedLit has higher priority than BareTypeKeyword in ordered choice', () => {
    const ast = parse('::Box{:k 1}');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.payload.type).toBe('MapLit');
  });
});

describe('a word under a label runs when its name is mentioned', () => {
  it('a word invokes through BindStep + identifier lookup', async () => {
    const result = await evalQuery(':any/double ~(mul 2) | 5 | double');
    expect(result).toBe(10);
  });

  it('a word binds its parts from the modifiers', async () => {
    const result = await evalQuery(
      ':any/@surround ~(prepend pfx | append sfx) | :any/@surround/pfx ~(/0) | :any/@surround/pfx/NotStringError ::holds~(is ::string) | :any/@surround/sfx ~(/1) | :any/@surround/sfx/NotStringError ::holds~(is ::string) | "x" | @surround "[" "]"'
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
  it('makes ::myType invokable through the constructor its host handed [D73]', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'tests/kind', source: ':myType |~~ myType. ~~| | :myType/construct ::builtin{}', impls: { 'myType/construct': payload => payload * 2 } }]
    });
    expect((await sessionInstance.evalCell('::myType(4) | [type payload]')).result).toEqual([makeTagKeyword('myType'), 8]);
  });

  it('a construct a reader declares as ::builtin{} reaches no primitive, and the tag lays over the payload [D73]', async () => {
    const result = await evalQuery(':myType |~~ myType. ~~| | :myType/construct ::builtin{} | ::myType~(add 1) | type');
    expect(result).toEqual(makeTagKeyword('myType'));
  });

  it('an axis finds the ::Tag … call form when navigating ::Tag | source', async () => {
    const source = await evalQuery(
      ':myType |~~ myType. ~~| | :myType/construct ::builtin{} | ::myType | source'
    );
    expect(isQuote(source)).toBe(true);
    expect(printQuoteSource(source)).toContain(':myType');
  });
});

describe('axis-operand subject classification', () => {
  it('a value tagged by a user tag reads the source of that tag', async () => {
    const source = await evalQuery(':Box |~~ A box. ~~| | ::Box#[3 1] | source');
    expect(printQuoteSource(source)).toBe(':Box |~~ A box. ~~|');
  });

  it('a map holding a tag in its :kind field reads ::map, since a field names nothing', async () => {
    expect(await evalQuery(
      ':myType |~~ myType. ~~| | :myType/construct ::builtin{} | {:kind ::myType :payload []} | source | eq (::map | source)'
    )).toBe(true);
  });
});

describe('BareTypeKeyword resolves to a TagKeyword identifier', () => {
  it('::Box evaluates to a TagKeyword named Box', async () => {
    const { isTagKeyword } = await import('../../src/types.mjs');
    const result = await evalQuery('::Box');
    expect(isTagKeyword(result)).toBe(true);
    expect(result.name).toBe('Box');
  });

  it('an unbound ::tag literal is identity-as-value — TagKeyword with no env touch', async () => {
    // Symmetric to `:foo` (a keyword) which evaluates
    // to `keyword('foo')` whether anything declared `:foo` or not.
    // Typos catch on use-site probes (TaggedLit constructor, axis
    // operands) rather than at literal construction.
    const { isTagKeyword } = await import('../../src/types.mjs');
    const result = await evalQuery('::someUnboundType');
    expect(isTagKeyword(result)).toBe(true);
    expect(result.name).toBe('someUnboundType');
  });
});

describe('TaggedLit error paths', () => {
  it('a tag no node answers puts the value under it as identity', async () => {
    const evalResult = await evalQuery('::unboundTag[1 2 3] | type');
    expect(evalResult).toEqual(makeTagKeyword('unboundTag'));
  });

  it('raises ConstructTagNotKindError when the node a tag addresses is neither a kind nor a word', async () => {
    const err = await evalQuery(':limit 5 | ::limit[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('construct/TagNotKindError'));
  });

  it('lays the tag of a word over the args of a call of it, which read back [D173]', async () => {
    expect(await evalQuery('1 | add 1 2 !| /actualValue | eq ::number/add[1 2]')).toBe(true);
    expect(await evalQuery('::vec/count[] | type')).toEqual(makeTagKeyword('vec/count'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a String (would silently char-iterate)', async () => {
    const err = await evalQuery('::builtin"hello"');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('builtin/PayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTagKeyword('string'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a Vec', async () => {
    const err = await evalQuery('::builtin[1 2 3]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('builtin/PayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTagKeyword('vec'));
  });

  it('tag bound-form propagates a fail-track tag-keyword expression instead of wrapping it', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });

  it('tag hands on an error in the pipe instead of wrapping it', async () => {
    const err = await evalQuery('("not-a-number" | add 1) | tag ::Box');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });

  it('tag hands on an error its modifier answers', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });

});

describe('a kind without a body — identity', () => {
  // Two value-class branches by literal form:
  //   ErrorLit payload   → ErrorValue (fail-track), `:kind`
  //                        restamped onto the descriptor.
  //   Anything else      → TaggedInstance Map (success-track),
  //                        payload value lifted under
  //                        `:payload` slot.

  it('ErrorLit payload (`::Tag!{…}`) lifts to ErrorValue with `:kind` restamped', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const err = await evalQuery('::number/add/SubjectNotNumberError!{:custom "field" :note 42}');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
    expect(err.descriptor.get('custom')).toBe('field');
    expect(err.descriptor.get('note')).toBe(42);
  });

  it('Vec payload (`::Tag[…]`) overlays the tag identity onto the Array — `/n` indexes the Vec directly', async () => {
    // Identity-overlay design: the tag stamps the JS-header
    // TAG_HEADER_SYMBOL slot on the Array payload itself. The
    // value stays `isVec`, indexes through `/n`, iterates via
    // `*`, reduces via `count` / `first` — every Vec affordance
    // unchanged. Identity reads through `type` operand.
    const { isVec, isTaggedInstance, typeKeyword, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError[1 2 3]');
    expect(Array.isArray(instance)).toBe(true);
    expect(isVec(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
    expect(typeKeyword(instance)).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
    expect(instance.length).toBe(3);
    expect(instance[0]).toBe(1);
    expect(instance[1]).toBe(2);
  });

  it('Map payload (`::Tag{…}`) overlays the tag identity onto the Map — `keys` / `/field` work directly', async () => {
    // Identity-overlay: tag stamps the JS-header slot on the
    // Map payload, fields land as ordinary Map entries. `keys`,
    // `vals`, `/field` projection read the underlying Map data
    // plane unchanged. A `:kind` field on the inner Map data
    // coexists with the instance's identity because identity
    // rides on the JS-header alone.
    const { isQMap, isTaggedInstance, TAG_HEADER_SYMBOL } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError{:custom "field" :position 1}');
    expect(isQMap(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.has('kind')).toBe(false);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
    expect(instance.get('custom')).toBe('field');
    expect(instance.get('position')).toBe(1);
  });

  it('String payload (`::Tag"s"`) — wrap-object shape, `payload` operand extracts', async () => {
    // Scalars / value-class objects (String / Number / Keyword
    // / Quote / Doc / Error / already-tagged
    // composite) cannot carry the header on themselves,
    // so the constructor returns an opaque frozen `{type, tag,
    // payload}` wrapper. The wrap shape keeps `/payload`
    // projection out of reach (the wrapper is not a Map);
    // the `payload` operand is the dedicated extractor.
    const { isTaggedInstance, typeKeyword } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError"hello"');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(typeKeyword(instance)).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
    expect(instance.payload).toBe('hello');
    const extracted = await evalQuery('::number/add/SubjectNotNumberError"hello" | payload');
    expect(extracted).toBe('hello');
  });

  it('Keyword payload (`::Tag:foo`) — `:` opens unambiguously, wraps in an opaque object', async () => {
    const { isTaggedInstance, isKeyword } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError:foo');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(isKeyword(instance.payload)).toBe(true);
    expect(instance.payload.name).toBe('foo');
  });

  it('ParenGroup-wrapped scalar payload (`::Tag(42)`) — Number / Boolean / Null need the wrap', async () => {
    // Bare `42` after `Tag` would fuse into the identifier tail
    // (`Tag42`). ParenGroup makes the parser split cleanly. The
    // scalar payload routes through the wrap-object branch of
    // the constructor.
    const { isTaggedInstance } = await import('../../src/types.mjs');
    const instance = await evalQuery('::number/add/SubjectNotNumberError(42)');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.payload).toBe(42);
  });
});

describe('TaggedLit / BareTypeKeyword steps', () => {
  it('TaggedLit leaves a ::construct step over the step of its payload [D115]', async () => {
    expect(await evalQuery('~(::holds~(mul 2)) | first | [type /tag /payload]'))
      .toEqual(await evalQuery('[::construct ::holds ~(mul 2)]'));
  });

  it('BareTypeKeyword leaves the tag name itself', async () => {
    expect(await evalQuery('~(::Box) | first')).toEqual(makeTagKeyword('Box'));
  });
});

describe('TagKeyword value mechanics', () => {
  // The base TagKeyword machinery — `makeTagKeyword` /
  // `describeType` / `typeKeyword` / `printValue` — exercised at
  // the value level. Tagged-instance identity rides on the
  // JS-header `TAG_HEADER_SYMBOL` slot, read back through
  // `typeKeyword`; the named-error / `::Tag!{…}` round-trip lives
  // under the error-values suite.

  it('describeType / typeKeyword distinguish TagKeyword from Keyword', async () => {
    const { describeType, typeKeyword, makeTagKeyword } = await import('../../src/types.mjs');
    const k = makeTagKeyword('foo');
    expect(describeType(k)).toBe('TagKeyword');
    expect(typeKeyword(k)).toEqual(makeTagKeyword('tag'));
  });

  it('TagKeyword equality compares by name', async () => {
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    expect(deepEqual(makeTagKeyword('foo'), makeTagKeyword('foo'))).toBe(true);
    expect(deepEqual(makeTagKeyword('foo'), makeTagKeyword('bar'))).toBe(false);
  });

  it('printValue renders a TagKeyword as ::name', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { makeTagKeyword } = await import('../../src/types.mjs');
    expect(printValue(makeTagKeyword('foo'))).toBe('::foo');
  });

});

describe('parse and apply accept Quote subjects transparently', () => {
  it('`~(code) | parse` prints the quote as its text', async () => {
    expect(await evalQuery('~(5 | mul 2) | parse')).toBe('5 | mul 2');
  });

  it('`~(code) | apply /` runs the Quote source against the subject', async () => {
    expect(await evalQuery('~(5 | mul 2) | apply /')).toBe(10);
  });
});

describe('a tag no node answers is a kind of identity, and declares nothing [D152]', () => {
  it('leaves no binding to read', async () => {
    const result = await evalQuery('::Top(1) | ::Top | binding');
    expect(result.tag.name).toBe('any/binding/UnknownNameError');
    expect(await evalQuery('::Zap(1) | env | has :Zap')).toBe(false);
  });
});

describe('a kind whose spec has a body of steps', () => {
  it('applies the Quote body against payload as pipeValue, then auto-wraps with the tag', async () => {
    const result = await evalQuery(
      ':wrap |~~ wrap. ~~| | :wrap/construct ~(prepend "[" | append "]") | "x" | ::wrap"x" | payload'
    );
    expect(result).toBe('[x]');
  });

  it('the body of the spec takes the payload as its subject, read through payload after the tag', async () => {
    const result = await evalQuery(
      ':shout |~~ shout. ~~| | :shout/construct ~(append "!") | ::shout"ready" | payload'
    );
    expect(result).toBe('ready!');
  });

  it('Quote body resolves identifiers from the invocation env', async () => {
    const result = await evalQuery(
      ':any/exclaim ~(append "!") | :shout |~~ shout. ~~| | :shout/construct ~(exclaim) | ::shout"go" | payload'
    );
    expect(result).toBe('go!');
  });

  it('auto-wrap stamps the tag identity on the constructor result', async () => {
    const result = await evalQuery(
      ':wrap |~~ wrap. ~~| | :wrap/construct ~(prepend "[" | append "]") | ::wrap"x" | type'
    );
    expect(result).toEqual(makeTagKeyword('wrap'));
  });

  it('Quote body that already produces the same-tag TaggedInstance passes through (no double-wrap)', async () => {
    // `tag` runs the constructor, so tagging an instance again hands
    // the constructor an instance of its own tag.
    const result = await evalQuery(
      ':echo |~~ echo. ~~| | :echo/construct ~(/) | ::echo"hi" | tag ::echo | payload'
    );
    expect(result).toBe('hi');
  });

  it('Quote body that fails on the fail-track propagates the error untagged', async () => {
    const err = await evalQuery(
      ':strictAdd |~~ strictAdd. ~~| | :strictAdd/construct ~(add "not-a-number") | ::strictAdd(5)'
    );
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('number/add/addend/NotNumberError'));
  });

});

describe('within edits under one tag and rewraps it', () => {
  // The payload runs through the quote as a fork and mints back under
  // the subject's tag, whose constructor runs once, at the rewrap [D41].
  it('a set normalizes the vector the edit answers', async () => {
    expect(await evalQuery('#[1 2] | within ~([/0 /0 /1]) | eq #[1 2]')).toBe(true);
  });

  it('a tag of identity alone stamps its header back on the answer', async () => {
    expect(await evalQuery(':Box |~~ Box. ~~| | ::Box[1 2] | within ~(reverse) | eq ::Box[2 1]')).toBe(true);
  });

  it('the constructor runs once, at the rewrap', async () => {
    expect(await evalQuery(
      ':wrap |~~ wrap. ~~| | :wrap/construct ~(prepend "[" | append "]") | ::wrap"x" | within ~(append "!") | payload'
    )).toBe('[[x]!]');
  });

  it('a constructor that refuses the answer refuses the edit', async () => {
    expect(await evalQuery('#[1 2] | within ~(count) !| type'))
      .toEqual(makeTagKeyword('set/PayloadNotVecError'));
  });

  it('the declarations of the edit stay inside it', async () => {
    expect(await evalQuery('#[1 2] | within ~(:k 5 | [/0 /1]) | env | has :k')).toBe(false);
  });

  it('an error the edit answers passes as it is, and one the code answers is refused by its slot', async () => {
    expect(await evalQuery('#[1 2] | within ~(!{:k 2}) !| /k')).toBe(2);
    expect(await evalQuery('#[1 2] | within (!{:k 1}) !| type')).toEqual(makeTagKeyword('tagged/within/code/NotQuoteError'));
  });

  it('a subject with no tag and a code that is no quote are refused', async () => {
    expect(await evalQuery('[1 2] | within ~(reverse) !| type'))
      .toEqual(makeTagKeyword('tagged/within/SubjectNotTaggedError'));
    expect(await evalQuery('#[1 2] | within 1 !| type'))
      .toEqual(makeTagKeyword('tagged/within/code/NotQuoteError'));
  });
});
