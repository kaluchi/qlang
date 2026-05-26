// Tests for TaggedLit / BareTypeKeyword grammar + eval — the
// tag-namespace literal form. Tag bindings live in env under the
// `::`-prefixed key; ::tag<payload> looks up the binding, resolves
// its constructor, and invokes it against the payload-value.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { isErrorValue, keyword, describeType, makeTagKeyword } from '../../src/types.mjs';

describe('TaggedLit grammar parses ::tag<payload> as own AST node', () => {
  it('parses ::conduit[[] body] as TaggedLit with Vec payload', () => {
    const ast = parse('::conduit[[] ~{mul(2)}]');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.tag).toBe('conduit');
    expect(ast.payload.type).toBe('VecLit');
  });

  it('parses bare ::tag (no payload) as BareTypeKeyword', () => {
    const ast = parse('::conduit');
    expect(ast.type).toBe('BareTypeKeyword');
    expect(ast.tag).toBe('conduit');
  });

  it('TaggedLit has higher priority than BareTypeKeyword in ordered choice', () => {
    const ast = parse('::conduit{:k 1}');
    expect(ast.type).toBe('TaggedLit');
    expect(ast.payload.type).toBe('MapLit');
  });
});

describe('::conduit constructor builds a Conduit-value', () => {
  it('non-recursive 0-param produces a Conduit', async () => {
    const result = await evalQuery('::conduit[[] ~{mul(2)}]');
    expect(describeType(result)).toBe('Conduit');
  });

  it('Conduit invokes through BindStep + identifier lookup', async () => {
    const result = await evalQuery(':double ::conduit[[] ~{mul(2)}] | 5 | double');
    expect(result).toBe(10);
  });

  it('parametric Conduit binds captured args', async () => {
    const result = await evalQuery(
      ':@surround ::conduit[[:pfx :sfx] ~{prepend(pfx) | append(sfx)}] | "x" | @surround("[", "]")'
    );
    expect(result).toBe('[x]');
  });

  it('3-element payload with self-name produces a recursive Conduit', async () => {
    const result = await evalQuery(
      ':walk ::conduit[:walk [] ~{if(empty, 0, first | add(1))}] | [1 2 3] | walk'
    );
    expect(result).toBe(2);
  });
});

describe('::tag descriptor registers a tag-namespace binding', () => {
  it('makes ::myType invokable through the ::conduit constructor handle', async () => {
    const result = await evalQuery(
      '::myType {:kind :tag :impl :qlang/type/conduit} | :f ::myType[[] ~{add(1)}] | 4 | f'
    );
    expect(result).toBe(5);
  });

  it('axis-operand finds the ::Tag … OperandCall form when navigating ::Tag | source', async () => {
    const source = await evalQuery(
      '::myType {:kind :tag :impl :qlang/type/conduit} | ::myType | source'
    );
    expect(source.type).toBe('quote');
    expect(source.source).toContain('::myType');
  });
});

describe('axis-operand subject classification', () => {
  it('a tagged-instance Map (kind is TagKeyword) resolves through its tag to the tag-binding source', async () => {
    const source = await evalQuery(
      '::myType {:kind :tag :impl :qlang/type/conduit} | {:kind ::myType :payload []} | source'
    );
    expect(source.type).toBe('quote');
    expect(source.source).toContain('::myType');
  });
});

describe('BareTypeKeyword resolves to a TagKeyword identifier', () => {
  it('::conduit evaluates to a TagKeyword named conduit', async () => {
    const { isTagKeyword } = await import('../../src/types.mjs');
    const result = await evalQuery('::conduit');
    expect(isTagKeyword(result)).toBe(true);
    expect(result.name).toBe('conduit');
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
  it('raises TaggedLitTagNotFoundError when an unbound tag is invoked as a constructor', async () => {
    const err = await evalQuery('::unboundTag[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('TaggedLitTagNotFoundError'));
  });

  it('raises TaggedLitNotTagBindingError when tag-binding resolves to a non-Map value', async () => {
    const err = await evalQuery('::badType 42 | ::badType[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('TaggedLitNotTagBindingError'));
  });

  it('::conduit raises ConduitPayloadNotVecError when payload is not a Vec', async () => {
    const err = await evalQuery('::conduit{:not :a-vec}');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitPayloadNotVecError'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a String (would silently char-iterate)', async () => {
    const err = await evalQuery('::builtin"hello"');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('BuiltinPayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(keyword('string'));
  });

  it('::builtin raises BuiltinPayloadNotMapError when payload is a Vec', async () => {
    const err = await evalQuery('::builtin[1 2 3]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('BuiltinPayloadNotMapError'));
    expect(err.descriptor.get('actualType')).toEqual(keyword('vec'));
  });

  it('::conduit raises ConduitArityInvalidError for 1-element payload', async () => {
    const err = await evalQuery('::conduit[42]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitArityInvalidError'));
  });

  it('::conduit raises ConduitSelfNameNotKeywordError for 3-element payload with non-keyword selfName', async () => {
    const err = await evalQuery('::conduit[42 [] ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitSelfNameNotKeywordError'));
  });

  it('::conduit raises ConduitParamsNotVecError when params slot is not a Vec', async () => {
    const err = await evalQuery('::conduit[42 ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitParamsNotVecError'));
  });

  it('::conduit raises ConduitParamNotKeywordError when a params element is not a Keyword', async () => {
    const err = await evalQuery('::conduit[[42] ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitParamNotKeywordError'));
  });

  it('::conduit raises ConduitBodyNotQuoteError when body is not a Quote', async () => {
    const err = await evalQuery('::conduit[[] 42]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ConduitBodyNotQuoteError'));
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
    // plane unchanged. The pre-Phase-3 nested-identity-loss bug
    // (Map-merge collision on `:kind`) cannot recur because
    // identity rides on the header, not in a Map field.
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
    // / Quote / Doc / Error / Conduit / Snapshot / already-
    // tagged composite) cannot carry the header on themselves,
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

describe('TaggedLit / BareTypeKeyword AST codec round-trip', () => {
  it('TaggedLit round-trips through astNodeToMap / qlangMapToAst', async () => {
    const { astNodeToMap, qlangMapToAst } = await import('../../src/ast-codec.mjs');
    const ast = parse('::conduit[[] ~{mul(2)}]');
    const back = qlangMapToAst(astNodeToMap(ast));
    expect(back.type).toBe('TaggedLit');
    expect(back.tag).toBe('conduit');
    expect(back.payload.type).toBe('VecLit');
  });

  it('BareTypeKeyword round-trips through astNodeToMap / qlangMapToAst', async () => {
    const { astNodeToMap, qlangMapToAst } = await import('../../src/ast-codec.mjs');
    const ast = parse('::conduit');
    const back = qlangMapToAst(astNodeToMap(ast));
    expect(back.type).toBe('BareTypeKeyword');
    expect(back.tag).toBe('conduit');
  });
});

describe('printValue named conduit paths', () => {
  it('zero-arity named conduit renders as ::conduit[:name [] ~{body}]', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery(':double mul(2) | env | /:double');
    expect(printValue(value)).toBe('::conduit[:double [] ~{mul(2)}]');
  });

  it('parametric named conduit renders with params in :name [params] body form', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery(':wrap [:p :s] (prepend(p) | append(s)) | env | /:wrap');
    // The body source preserves the BindStep's `(…)` ParenGroup
    // wrapper around a Pipeline-shaped body — Primary-only is the
    // grammar's body slot, so a multi-step body lives inside parens.
    expect(printValue(value)).toBe('::conduit[:wrap [:p :s] ~{(prepend(p) | append(s))}]');
  });
});

describe('printValue Conduit handles named vs anonymous form', () => {
  it('anonymous Conduit renders as ::conduit[...] tagged literal', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery('::conduit[[] ~{mul(2)}]');
    expect(printValue(value)).toBe('::conduit[[] ~{mul(2)}]');
  });
});

describe('TagKeyword as :kind discriminator', () => {
  // Tagged-instance Maps carry `:kind <TagKeyword>` plus
  // `:payload` (the constructor's source-form Vec). The
  // base TagKeyword machinery — `makeTagKeyword` /
  // `describeType` / `typeKeyword` — is exercised at the value
  // level here; the named-error / `::Tag!{…}` round-trip lives
  // under the error-values suite.

  it('describeType / typeKeyword distinguish TagKeyword from Keyword', async () => {
    const { describeType, typeKeyword, makeTagKeyword, keyword } = await import('../../src/types.mjs');
    const k = makeTagKeyword('foo');
    expect(describeType(k)).toBe('TagKeyword');
    expect(typeKeyword(k)).toEqual(keyword('tagKeyword'));
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

  it('printValue on a raw Snapshot value defers to the inner payload', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { makeSnapshot } = await import('../../src/types.mjs');
    const snap = makeSnapshot(42, { name: 'answer' });
    expect(printValue(snap)).toBe('42');
  });
});

describe('parse and eval accept Quote subjects transparently', () => {
  it('~{code} | parse returns the AST-Map of the Quote source', async () => {
    expect(await evalQuery('~{5 | mul(2)} | parse | /:kind')).toEqual(keyword('Pipeline'));
  });

  it('~{code} | eval runs the Quote source against the current state', async () => {
    expect(await evalQuery('~{5 | mul(2)} | eval')).toBe(10);
  });
});

describe('User-defined tag binding with Quote :impl', () => {
  it('applies the Quote body against payload as pipeValue', async () => {
    const result = await evalQuery(
      '::wrap {:kind :tag :impl ~{prepend("[") | append("]")}} | "x" | ::wrap"x"'
    );
    expect(result).toBe('[x]');
  });

  it('Quote body sees the tag-binding payload as its initial pipeValue', async () => {
    const result = await evalQuery(
      '::shout {:kind :tag :impl ~{append("!")}} | ::shout"ready"'
    );
    expect(result).toBe('ready!');
  });

  it('Quote body resolves identifiers from the invocation env', async () => {
    const result = await evalQuery(
      ':exclaim append("!") | ::shout {:kind :tag :impl ~{exclaim}} | ::shout"go"'
    );
    expect(result).toBe('go!');
  });

  it(':impl that is neither Keyword nor Quote raises TagBindingHasNoConstructorError', async () => {
    const err = await evalQuery(
      '::bad {:kind :tag :impl 42} | ::bad"x"'
    );
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('TagBindingHasNoConstructorError'));
  });
});
