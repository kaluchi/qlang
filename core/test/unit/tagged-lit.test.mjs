// Tests for TaggedLit / BareTypeKeyword grammar + eval — the
// type-namespace literal form. Type bindings live in env under the
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

  it('Conduit invokes through def + identifier lookup', async () => {
    const result = await evalQuery('def(:double, ::conduit[[] ~{mul(2)}]) | 5 | double');
    expect(result).toBe(10);
  });

  it('parametric Conduit binds captured args', async () => {
    const result = await evalQuery(
      'def(:@surround, ::conduit[[:pfx :sfx] ~{prepend(pfx) | append(sfx)}]) | "x" | @surround("[", "]")'
    );
    expect(result).toBe('[x]');
  });

  it('3-element payload with self-name produces a recursive Conduit', async () => {
    const result = await evalQuery(
      'def(:walk, ::conduit[:walk [] ~{if(empty, 0, first | add(1))}]) | [1 2 3] | walk'
    );
    expect(result).toBe(2);
  });
});

describe('def(::tag, descriptor) registers a type-namespace binding', () => {
  it('makes ::myType invokable through the ::conduit constructor handle', async () => {
    const result = await evalQuery(
      'def(::myType, {:qlang/kind :type :qlang/impl :qlang/type/conduit}) | def(:f, ::myType[[] ~{add(1)}]) | 4 | f'
    );
    expect(result).toBe(5);
  });

  it('axis-operand finds the def(::Tag, …) OperandCall form when navigating ::Tag | source', async () => {
    const source = await evalQuery(
      'def(::myType, {:qlang/kind :type :qlang/impl :qlang/type/conduit}) | ::myType | source'
    );
    expect(source.type).toBe('quote');
    expect(source.source).toContain('::myType');
  });
});

describe('axis-operand subject classification', () => {
  it('a tagged-instance Map (kind is TagKeyword) resolves through its tag to the type-binding source', async () => {
    const source = await evalQuery(
      'def(::myType, {:qlang/kind :type :qlang/impl :qlang/type/conduit}) | {:qlang/kind ::myType :qlang/payload []} | source'
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

  it('an unbound ::tag still raises TaggedLitTagNotFound at the BareTypeKeyword resolution site', async () => {
    const err = await evalQuery('::someUnboundType');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('TaggedLitTagNotFound'));
  });
});

describe('TaggedLit error paths', () => {
  it('raises TaggedLitTagNotFound for an unbound tag in TaggedLit', async () => {
    const err = await evalQuery('::unboundTag[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('TaggedLitTagNotFound'));
  });

  it('raises TaggedLitTagNotFound for an unbound bare ::tag reference', async () => {
    const err = await evalQuery('::unboundBare');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('TaggedLitTagNotFound'));
  });

  it('raises TaggedLitNotType when type-binding resolves to a non-Map value', async () => {
    const err = await evalQuery('def(::badType, 42) | ::badType[]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('TaggedLitNotType'));
  });

  it('::conduit raises ConduitPayloadNotVec when payload is not a Vec', async () => {
    const err = await evalQuery('::conduit{:not :a-vec}');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitPayloadNotVec'));
  });

  it('::conduit raises ConduitArityInvalid for 1-element payload', async () => {
    const err = await evalQuery('::conduit[42]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitArityInvalid'));
  });

  it('::conduit raises ConduitSelfNameNotKeyword for 3-element payload with non-keyword selfName', async () => {
    const err = await evalQuery('::conduit[42 [] ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitSelfNameNotKeyword'));
  });

  it('::conduit raises ConduitParamsNotVec when params slot is not a Vec', async () => {
    const err = await evalQuery('::conduit[42 ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitParamsNotVec'));
  });

  it('::conduit raises ConduitParamNotKeyword when a params element is not a Keyword', async () => {
    const err = await evalQuery('::conduit[[42] ~{mul(2)}]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitParamNotKeyword'));
  });

  it('::conduit raises ConduitBodyNotQuote when body is not a Quote', async () => {
    const err = await evalQuery('::conduit[[] 42]');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ConduitBodyNotQuote'));
  });
});

describe('TaggedLit / BareTypeKeyword AST codec round-trip', () => {
  it('TaggedLit round-trips through astNodeToMap / qlangMapToAst', async () => {
    const { astNodeToMap, qlangMapToAst } = await import('../../src/walk.mjs');
    const ast = parse('::conduit[[] ~{mul(2)}]');
    const back = qlangMapToAst(astNodeToMap(ast));
    expect(back.type).toBe('TaggedLit');
    expect(back.tag).toBe('conduit');
    expect(back.payload.type).toBe('VecLit');
  });

  it('BareTypeKeyword round-trips through astNodeToMap / qlangMapToAst', async () => {
    const { astNodeToMap, qlangMapToAst } = await import('../../src/walk.mjs');
    const ast = parse('::conduit');
    const back = qlangMapToAst(astNodeToMap(ast));
    expect(back.type).toBe('BareTypeKeyword');
    expect(back.tag).toBe('conduit');
  });
});

describe('printValue named conduit paths', () => {
  it('zero-arity named conduit renders as ::conduit[:name [] ~{body}]', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery('def(:double, mul(2)) | env | /:double');
    expect(printValue(value)).toBe('::conduit[:double [] ~{mul(2)}]');
  });

  it('parametric named conduit renders with params in :name [params] body form', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery('def(:wrap, [:p :s], prepend(p) | append(s)) | env | /:wrap');
    expect(printValue(value)).toBe('::conduit[:wrap [:p :s] ~{prepend(p) | append(s)}]');
  });
});

describe('printValue Conduit handles named vs anonymous form', () => {
  it('anonymous Conduit renders as ::conduit[...] tagged literal', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const value = await evalQuery('::conduit[[] ~{mul(2)}]');
    expect(printValue(value)).toBe('::conduit[[] ~{mul(2)}]');
  });
});

describe('TagKeyword as :qlang/kind discriminator', () => {
  // The tagged-instance Map shape (`:qlang/kind <TagKeyword> +
  // :qlang/payload`) lands in M4 alongside error classes as
  // first-class type-bindings (`::ClassName!{...}`). The base
  // TagKeyword machinery is exercised here at the value level
  // through `makeTagKeyword`; the higher-level Map projection
  // gets its own coverage once M4 introduces the constructor
  // primitive that stamps it.

  it('describeType / typeKeyword distinguish TagKeyword from Keyword', async () => {
    const { describeType, typeKeyword, makeTagKeyword, keyword } = await import('../../src/types.mjs');
    const k = makeTagKeyword('foo');
    expect(describeType(k)).toBe('TagKeyword');
    expect(typeKeyword(k)).toEqual(keyword('tag-keyword'));
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
    expect(await evalQuery('~{5 | mul(2)} | parse | /:qlang/kind')).toEqual(keyword('Pipeline'));
  });

  it('~{code} | eval runs the Quote source against the current state', async () => {
    expect(await evalQuery('~{5 | mul(2)} | eval')).toBe(10);
  });
});

describe('User-defined type binding with Quote :qlang/impl', () => {
  it('applies the Quote body against payload as pipeValue', async () => {
    const result = await evalQuery(
      'def(::wrap, {:qlang/kind :type :qlang/impl ~{prepend("[") | append("]")}}) | "x" | ::wrap"x"'
    );
    expect(result).toBe('[x]');
  });

  it('Quote body sees the type-binding payload as its initial pipeValue', async () => {
    const result = await evalQuery(
      'def(::shout, {:qlang/kind :type :qlang/impl ~{append("!")}}) | ::shout"ready"'
    );
    expect(result).toBe('ready!');
  });

  it('Quote body resolves identifiers from the invocation env', async () => {
    const result = await evalQuery(
      'def(:exclaim, append("!")) | def(::shout, {:qlang/kind :type :qlang/impl ~{exclaim}}) | ::shout"go"'
    );
    expect(result).toBe('go!');
  });

  it(':qlang/impl that is neither Keyword nor Quote raises TaggedLitImplNotResolvable', async () => {
    const err = await evalQuery(
      'def(::bad, {:qlang/kind :type :qlang/impl 42}) | ::bad"x"'
    );
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('TaggedLitImplNotResolvable'));
  });
});
