// Tests for TaggedLit / BareTypeKeyword grammar + eval — the
// tag-namespace literal form. Tag bindings live in env under the
// `::`-prefixed key; ::tag<payload> looks up the binding, resolves
// its constructor, and invokes it against the payload-value.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { isErrorValue, isQuote, keyword, describeType, makeTagKeyword } from '../../src/types.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe('TaggedLit grammar parses ::tag<payload> as own AST node', () => {
  it('parses ::verb~(body) as TaggedLit with a quote payload', () => {
    const ast = parse('::verb~(mul 2)');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.tag).toBe('verb');
    expect(ast.payload.type).toBe('QuoteLit');
  });

  it('parses bare ::tag (no payload) as BareTypeKeyword', () => {
    const ast = parse('::verb');
    expect(ast.type).toBe('BareTypeKeyword');
    expect(ast.tag).toBe('verb');
  });

  it('TaggedLit has higher priority than BareTypeKeyword in ordered choice', () => {
    const ast = parse('::verb{:k 1}');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.payload.type).toBe('MapLit');
  });
});

describe('::verb constructor builds a verb', () => {
  it('a verb is a tagged instance over its quote', async () => {
    const result = await evalQuery('::verb~(mul 2)');
    expect(describeType(result)).toBe('TaggedInstance');
  });

  it('a verb invokes through BindStep + identifier lookup', async () => {
    const result = await evalQuery(':double ::verb~(mul 2) | 5 | double');
    expect(result).toBe(10);
  });

  it('a verb binds its slots from the modifiers', async () => {
    const result = await evalQuery(
      ':@surround ::verb~(:pfx ::string | :sfx ::string | prepend pfx | append sfx) | "x" | @surround "[" "]"'
    );
    expect(result).toBe('[x]');
  });

  it('a declared verb recurses by its own name', async () => {
    const result = await evalQuery(
      ':walk ::verb~(if empty ~(0) ~(drop 1 | walk | add 1)) | [1 2 3] | walk'
    );
    expect(result).toBe(3);
  });
});

describe('::tag descriptor registers a tag-namespace binding', () => {
  it('makes ::myType invokable through the ::verb constructor handle', async () => {
    const result = await evalQuery(
      '::myType {:impl :qlang/type/verb} | :f ::myType~(add 1) | 4 | f'
    );
    expect(result).toBe(5);
  });

  it('axis-operand finds the ::Tag … OperandCall form when navigating ::Tag | source', async () => {
    const source = await evalQuery(
      '::myType {:impl :qlang/type/verb} | ::myType | source'
    );
    expect(isQuote(source)).toBe(true);
    expect(printQuoteSource(source)).toContain('::myType');
  });
});

describe('axis-operand subject classification', () => {
  it('a value tagged by a user tag reads the source of that tag', async () => {
    const source = await evalQuery('::Box |~~ A box. ~~| | ::Box#[3 1] | source');
    expect(printQuoteSource(source)).toBe('::Box |~~ A box. ~~|');
  });

  it('a map holding a tag in its :kind field reads ::map, since a field names nothing', async () => {
    expect(await evalQuery(
      '::myType {:impl :qlang/type/verb} | {:kind ::myType :payload []} | source | eq (::map | source)'
    )).toBe(true);
  });
});

describe('BareTypeKeyword resolves to a TagKeyword identifier', () => {
  it('::verb evaluates to a TagKeyword named verb', async () => {
    const { isTagKeyword } = await import('../../src/types.mjs');
    const result = await evalQuery('::verb');
    expect(isTagKeyword(result)).toBe(true);
    expect(result.name).toBe('verb');
  });

  it('an unbound ::tag literal is identity-as-value — TagKeyword with no env touch', async () => {
    // Symmetric to `:foo` (value-namespace Keyword) which evaluates
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
  it('auto-declares an identity-only binding for an unbound tag and mints the instance', async () => {
    const evalResult = await evalQuery('::unboundTag[1 2 3] | type');
    expect(evalResult).toEqual(makeTagKeyword('unboundTag'));
  });

  it('an auto-declared binding carries :declarationOrigin :implicit', async () => {
    const evalResult = await evalQuery('::silentBox[1] | ::silentBox | spec | /declarationOrigin');
    expect(evalResult).toEqual(keyword('implicit'));
  });

  it('raises TaggedLitNotTagBindingError when tag-binding resolves to a non-Map value', async () => {
    const err = await evalQuery('::badType 42 | ::badType[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('TaggedLitNotTagBindingError'));
  });

  it('::verb raises VerbPayloadNotQuoteError when payload is not a quote', async () => {
    const err = await evalQuery('::verb{:not :a-quote}');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('VerbPayloadNotQuoteError'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a String (would silently char-iterate)', async () => {
    const err = await evalQuery('::builtin"hello"');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('BuiltinPayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTagKeyword('string'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a Vec', async () => {
    const err = await evalQuery('::builtin[1 2 3]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('BuiltinPayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(makeTagKeyword('vec'));
  });

  it('tag bound-form propagates a fail-track tag-keyword expression instead of wrapping it', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('AddLeftNotNumberError'));
  });

  it('tag full-form propagates a fail-track value expression instead of wrapping it', async () => {
    const err = await evalQuery('null | tag ("not-a-number" | add 1) ::Box');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('AddLeftNotNumberError'));
  });

  it('tag full-form propagates a fail-track tag-keyword expression', async () => {
    const err = await evalQuery('null | tag 42 ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('AddLeftNotNumberError'));
  });

});

describe('default constructor — tag-binding without :impl', () => {
  // Two value-class branches by literal form:
  //   ErrorLit payload   → ErrorValue (fail-track), `:kind`
  //                        restamped onto the descriptor.
  //   Anything else      → TaggedInstance Map (success-track),
  //                        payload value lifted under
  //                        `:payload` slot.

  it('ErrorLit payload (`::Tag!{…}`) lifts to ErrorValue with `:kind` restamped', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const err = await evalQuery('::AddLeftNotNumberError!{:custom "field" :note 42}');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('AddLeftNotNumberError'));
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
    const instance = await evalQuery('::AddLeftNotNumberError[1 2 3]');
    expect(Array.isArray(instance)).toBe(true);
    expect(isVec(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTagKeyword('AddLeftNotNumberError'));
    expect(typeKeyword(instance)).toEqual(makeTagKeyword('AddLeftNotNumberError'));
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
    const instance = await evalQuery('::AddLeftNotNumberError{:custom "field" :position 1}');
    expect(isQMap(instance)).toBe(true);
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.has('kind')).toBe(false);
    expect(instance[TAG_HEADER_SYMBOL]).toEqual(makeTagKeyword('AddLeftNotNumberError'));
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
    const instance = await evalQuery('::AddLeftNotNumberError"hello"');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(typeKeyword(instance)).toEqual(makeTagKeyword('AddLeftNotNumberError'));
    expect(instance.payload).toBe('hello');
    const extracted = await evalQuery('::AddLeftNotNumberError"hello" | payload');
    expect(extracted).toBe('hello');
  });

  it('Keyword payload (`::Tag:foo`) — `:` opens unambiguously, wraps in an opaque object', async () => {
    const { isTaggedInstance, isKeyword } = await import('../../src/types.mjs');
    const instance = await evalQuery('::AddLeftNotNumberError:foo');
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
    const instance = await evalQuery('::AddLeftNotNumberError(42)');
    expect(isTaggedInstance(instance)).toBe(true);
    expect(instance.payload).toBe(42);
  });
});

describe('TaggedLit / BareTypeKeyword steps', () => {
  it('TaggedLit leaves a ::tagged step over the step of its payload', async () => {
    expect(await evalQuery('~(::verb~(mul 2)) | first | [type /tag /payload]'))
      .toEqual(await evalQuery('[::tagged ::verb ~(mul 2)]'));
  });

  it('BareTypeKeyword leaves the tag name itself', async () => {
    expect(await evalQuery('~(::verb) | first')).toEqual(makeTagKeyword('verb'));
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

describe('auto-declared ::Tag binding respects fork isolation', () => {
  // `::Tag<payload>` auto-declares an identity-only tag binding on
  // first use. That declaration is an env write: it persists to
  // later pipeline steps (like any BindStep) yet stays inside a
  // fork (ParenGroup / Vec element / Map value), obeying the same
  // env-immutability contract every other binding follows.

  it('a top-level auto-declaration is visible to later steps', async () => {
    expect(await evalQuery('::Top(1) | ::Top | spec | /declarationOrigin'))
      .toEqual(keyword('implicit'));
  });

  it('an auto-declaration inside a ParenGroup fork does not leak out', async () => {
    const result = await evalQuery('(::Foo(1)) | ::Foo | spec');
    expect(isErrorValue(result)).toBe(true);
    expect(result.tag.name).toBe('SpecBindingNotFoundError');
  });

  it('an auto-declaration inside a fork leaves no trace in the outer env', async () => {
    expect(await evalQuery('(::Zap(1)) | env | keys | has :"::Zap"')).toBe(false);
  });

  it('a self-referential payload resolves the tag the literal declares', async () => {
    // The tag is declared before the payload evaluates, so a payload
    // that references the same tag (`::Tag(::Tag | spec)`) resolves the
    // binding the literal is introducing — like a declared verb's body
    // seeing its own name.
    expect(await evalQuery('::SelfRef(::SelfRef | spec | /declarationOrigin) | payload'))
      .toEqual(keyword('implicit'));
  });
});

describe('User-defined tag binding with Quote :impl', () => {
  it('applies the Quote body against payload as pipeValue, then auto-wraps with the tag', async () => {
    const result = await evalQuery(
      '::wrap {:impl ~(prepend "[" | append "]")} | "x" | ::wrap"x" | payload'
    );
    expect(result).toBe('[x]');
  });

  it('Quote body sees the tag-binding payload as its initial pipeValue (read through payload after auto-wrap)', async () => {
    const result = await evalQuery(
      '::shout {:impl ~(append "!")} | ::shout"ready" | payload'
    );
    expect(result).toBe('ready!');
  });

  it('Quote body resolves identifiers from the invocation env', async () => {
    const result = await evalQuery(
      ':exclaim ::verb~(append "!") | ::shout {:impl ~(exclaim)} | ::shout"go" | payload'
    );
    expect(result).toBe('go!');
  });

  it('auto-wrap stamps the tag identity on the constructor result', async () => {
    const result = await evalQuery(
      '::wrap {:impl ~(prepend "[" | append "]")} | ::wrap"x" | type'
    );
    expect(result).toEqual(makeTagKeyword('wrap'));
  });

  it('Quote body that already produces the same-tag TaggedInstance passes through (no double-wrap)', async () => {
    // `tag` runs the constructor, so tagging an instance again hands
    // the constructor an instance of its own tag.
    const result = await evalQuery(
      '::echo {:impl ~(/)} | ::echo"hi" | tag ::echo | payload'
    );
    expect(result).toBe('hi');
  });

  it('Quote body that fails on the fail-track propagates the error untagged', async () => {
    const err = await evalQuery(
      '::strictAdd {:impl ~(add "not-a-number")} | ::strictAdd(5)'
    );
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('AddRightNotNumberError'));
  });

  it(':impl that is neither Keyword nor Quote raises TagBindingHasNoConstructorError', async () => {
    const err = await evalQuery(
      '::bad {:impl 42} | ::bad"x"'
    );
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('TagBindingHasNoConstructorError'));
  });
});

describe('within edits under one tag and rewraps it', () => {
  // The payload runs through the quote as a fork and mints back under
  // the subject's tag, whose constructor runs once, at the rewrap [D41].
  it('a set normalizes the vector the edit answers', async () => {
    expect(await evalQuery('#[1 2] | within ~([/0 /0 /1]) | eq #[1 2]')).toBe(true);
  });

  it('a tag of identity alone stamps its header back on the answer', async () => {
    expect(await evalQuery('::Box {} | ::Box[1 2] | within ~(reverse) | eq ::Box[2 1]')).toBe(true);
  });

  it('the constructor runs once, at the rewrap', async () => {
    expect(await evalQuery(
      '::wrap {:impl ~(prepend "[" | append "]")} | ::wrap"x" | within ~(append "!") | payload'
    )).toBe('[[x]!]');
  });

  it('a constructor that refuses the answer refuses the edit', async () => {
    expect(await evalQuery('#[1 2] | within ~(count) !| type'))
      .toEqual(makeTagKeyword('SetPayloadNotVecError'));
  });

  it('the declarations of the edit stay inside it', async () => {
    expect(await evalQuery('#[1 2] | within ~(:k 5 | [/0 /1]) | env | has :k')).toBe(false);
  });

  it('an error the edit or the code answers passes as it is', async () => {
    expect(await evalQuery('#[1 2] | within ~(!{:k 2}) !| /k')).toBe(2);
    expect(await evalQuery('#[1 2] | within (!{:k 1}) !| /k')).toBe(1);
  });

  it('a subject with no tag and a code that is no quote are refused', async () => {
    expect(await evalQuery('[1 2] | within ~(reverse) !| type'))
      .toEqual(makeTagKeyword('WithinSubjectNotTaggedInstanceError'));
    expect(await evalQuery('#[1 2] | within 1 !| type'))
      .toEqual(makeTagKeyword('WithinCodeNotQuoteError'));
  });
});
