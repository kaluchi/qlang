// Edge-case branch coverage for runtime modules, grouped per
// target source file. Each `describe` block names the module and
// the specific branch / path it exercises (right-operand checks
// in `arith.mjs`, non-keyword key fallback in `setops.mjs`'s
// `UseNamespaceCollisionError` site, snapshot-classifier in
// `types.mjs::describeType`, codec round-trip through
// `walk.mjs`'s `locationFromQlangMap(null)` path, etc.). The
// topical test files (`error-values.test.mjs`,
// `print-value-extras.test.mjs`, `effect-check.test.mjs`,
// `setops.test.mjs`, …) cover the happy-path semantics; this
// file fills the per-branch tails the language-spec walkthrough
// does not name on its own.
//
// Adding a new edge case: place its `describe` block alongside
// the ones already targeting the same source module so the
// per-module grouping stays derivable top-to-bottom.

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { deepEqual } from '../../src/equality.mjs';
import {
  describeType,
  typeKeyword,
  keyword,
  makeTagKeyword,
  makeSnapshot,
  makeConduit,
  makeErrorValue,
  isErrorValue
} from '../../src/types.mjs';
import {
  stateOpVariadic,
  higherOrderOpVariadic
} from '../../src/runtime/dispatch.mjs';
import { QlangInvariantError } from '../../src/errors.mjs';
import { createSession } from '../../src/session.mjs';
import { astNodeToMap, qlangMapToAst } from '../../src/ast-codec.mjs';
import { makeState } from '../../src/state.mjs';
import { errorFromParse, errorFromForeign } from '../../src/error-convert.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/runtime/format.mjs';

describe('arith right-operand type checks', () => {
  it('sub with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | sub("x")'))).toBe(true);
  });

  it('mul with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | mul("x")'))).toBe(true);
  });

  it('div with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | div("x")'))).toBe(true);
  });
});

describe('vec.flat non-Vec elements', async () => {
  it('flat preserves non-Vec elements alongside Vec elements', async () => {
    expect(await evalQuery('[1 [2 3] 4] | flat')).toEqual([1, 2, 3, 4]);
  });
});

describe('equality.deepEqual rejection branches', async () => {
  it('returns false when only one side is null', async () => {
    expect(deepEqual(null, 5)).toBe(false);
    expect(deepEqual(5, null)).toBe(false);
  });

  it('returns false when types differ', async () => {
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('returns false when one side is array and the other is not', async () => {
    expect(deepEqual([1, 2], 'x')).toBe(false);
  });

  it('returns false when arrays have different length', async () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false when one side is Set and the other is not', async () => {
    expect(deepEqual(new Set([1]), [1])).toBe(false);
  });

  it('returns false when Sets have different size', async () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
  });
});

describe('describeType for conduit and snapshot', async () => {
  it('describeType returns "Snapshot" for a snapshot value', async () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(describeType(snap)).toBe('Snapshot');
  });

  it('describeType returns "Conduit" for a conduit value', async () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1, text: '1' }, { name: 'x' });
    expect(describeType(conduit)).toBe('Conduit');
  });

  it('describeType returns "TaggedInstance" for a tagged-instance Map', async () => {
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['kind', makeTagKeyword('Box')],
      ['payload', [42]]
    ]);
    expect(describeType(instance)).toBe('TaggedInstance');
  });

  it('isTaggedInstance rejects the reserved-kind Maps that conduit / snapshot mint', async () => {
    // Conduit and snapshot factories stamp their own dedicated
    // TagKeyword on `:kind`. `isTaggedInstance` excludes them
    // so the generic tagged-instance render path does not collide
    // with `printConduit` / `printSnapshot`.
    const { makeTagKeyword, isTaggedInstance } = await import('../../src/types.mjs');
    const conduitLike = new Map([
      ['kind', makeTagKeyword('conduit')],
      ['payload', []]
    ]);
    const snapshotLike = new Map([
      ['kind', makeTagKeyword('snapshot')],
      ['payload', []]
    ]);
    expect(isTaggedInstance(conduitLike)).toBe(false);
    expect(isTaggedInstance(snapshotLike)).toBe(false);
  });

  it('typeKeyword returns the tag as a TagKeyword for a tagged-instance Map', async () => {
    const { makeTagKeyword, isTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['kind', makeTagKeyword('Box')],
      ['payload', [42, 'inner']]
    ]);
    const tk = typeKeyword(instance);
    expect(isTagKeyword(tk)).toBe(true);
    expect(tk.name).toBe('Box');
  });
});

describe('typeKeyword covers all value kinds', () => {
  it('typeKeyword returns :function for a function value', () => {
    const fnValue = Object.freeze({ type: 'function', impl: () => {} });
    expect(typeKeyword(fnValue).name).toBe('function');
  });

  it('typeKeyword returns :unknown for an unrecognized object', () => {
    expect(typeKeyword({ type: 'alien' }).name).toBe('unknown');
  });

  it('typeKeyword returns :conduit for a conduit', () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1, text: '1' }, { name: 'x' });
    expect(typeKeyword(conduit).name).toBe('conduit');
  });

  it('typeKeyword returns :snapshot for a snapshot', () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(typeKeyword(snap).name).toBe('snapshot');
  });
});

describe('dispatch variadic registration invariants', async () => {
  it('stateOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s)).toThrow(QlangInvariantError);
  });

  it('stateOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s, null)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv, null)).toThrow(QlangInvariantError);
  });
});

describe('setops bare-form non-Vec subject errors', async () => {
  it('union bare on non-Vec/non-Set throws UnionBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | union'))).toBe(true);
  });

  it('union bare on a Set (which is also non-Array) throws', async () => {
    expect(isErrorValue(await evalQuery('#{:a} | union'))).toBe(true);
  });

  it('minus bare on non-Vec throws MinusBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | minus'))).toBe(true);
  });

  it('inter bare on non-Vec throws InterBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | inter'))).toBe(true);
  });
});

describe('setops full form (two captured args)', async () => {
  it('minus full form computes left minus right via two captured pipelines', async () => {
    const result = await evalQuery('null | minus({:a 1 :b 2 :tmp 3}, #{:tmp})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('tmp')).toBe(false);
  });

  it('inter full form computes left inter right via two captured pipelines', async () => {
    const result = await evalQuery('null | inter({:a 1 :b 2 :c 3}, #{:a :b})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(false);
  });

  it('union full form computes left union right via two captured pipelines', async () => {
    const result = await evalQuery('null | union({:a 1}, {:b 2})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });
});

describe('vec.min and vec.max on empty Vec', async () => {
  it('min on empty Vec returns null', async () => {
    expect(await evalQuery('[] | min')).toBeNull();
  });

  it('max on empty Vec returns null', async () => {
    expect(await evalQuery('[] | max')).toBeNull();
  });

  it('min on singleton Vec returns the only element', async () => {
    expect(await evalQuery('[42] | min')).toBe(42);
  });

  it('max on singleton Vec returns the only element', async () => {
    expect(await evalQuery('[42] | max')).toBe(42);
  });
});

describe('vec.sort with key on non-Vec subject', async () => {
  it('sort with key throws SortByKeySubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | sort(/x)'))).toBe(true);
  });
});

describe('higherOrderOp / nullaryOp arity errors', async () => {
  it('nullaryOp called with captured args throws', async () => {
    expect(isErrorValue(await evalQuery('[1 2 3] | count(:foo)'))).toBe(true);
  });

  it('higherOrderOp filter called with zero captured args throws', async () => {
    // Bare `filter` returns filter's descriptor Map for REPL
    // introspection because its minCaptured > 0. The empty-call
    // form `filter()` forces actual application with zero lambdas
    // and triggers the arity error inside the higherOrderOp
    // dispatch wrapper.
    expect(isErrorValue(await evalQuery('[1 2 3] | filter()'))).toBe(true);
  });
});

describe('manifest-op.mjs — :type :unknown lift for non-classifiable host values', async () => {
  it('manifest descriptor for a Symbol-bound value carries :type :unknown', async () => {
    // session.bind drops any JS value into env. The describeBinding
    // fall-through (non-Map / non-conduit / non-snapshot / non-function)
    // wraps it as a :kind :value descriptor and stamps :type via
    // typeKeyword — which lifts unrecognised host values to :unknown.
    const s = await createSession();
    s.bind('weird', Symbol('weird'));
    const result = (await s.evalCell('manifest | filter(/name | eq("weird")) | first | /type')).result;
    expect(result).toEqual(keyword('unknown'));
  });
});

describe('deepEqual Set vs non-Set non-Array', async () => {
  it('returns false when first is Set and second is plain object', async () => {
    expect(deepEqual(new Set([1]), {})).toBe(false);
  });

  it('returns false when same-size Sets contain different elements', async () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });
});

describe('count and friends on a Map subject', async () => {
  it('count on a Map returns its size', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | count')).toBe(3);
  });
});

describe('valueOp arity overflow', async () => {
  it('add with zero captured args throws ArityError', async () => {
    // Bare `add` returns add's descriptor for REPL introspection
    // because its minCaptured is 1. The empty-call form `add()`
    // forces actual application with zero lambdas and triggers
    // ValueOpArityMismatchError.
    expect(isErrorValue(await evalQuery('5 | add()'))).toBe(true);
  });
});

describe('error-convert.mjs — errorFromParse without uri', async () => {
  it('omits :uri from descriptor when ParseError has no .uri', async () => {
    const parseError = Object.assign(new Error('unexpected token'), { location: null });
    // no .uri property — tests the false arm of `if (parseError.uri)`
    const errVal = errorFromParse(parseError);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.has('uri')).toBe(false);
  });
});

describe('error-convert.mjs — coerce with QSet and errorValue', async () => {
  const coerceFault = Object.freeze(new Map([
    ['step', Object.freeze(new Map([['text', 'hostCoerce']]))],
    ['input', 'coerce-input']
  ]));

  it('coerce passes through a QSet (JS Set) unchanged', async () => {
    const qset = new Set([1, 2, 3]);
    const err = Object.assign(new Error('foreign'), { mySet: qset });
    const errVal = errorFromForeign(err, null, coerceFault);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get('mySet')).toBe(qset);
  });

  it('coerce passes through an errorValue unchanged', async () => {
    const inner = makeErrorValue(new Map(), { originalError: new Error('inner') });
    const err = Object.assign(new Error('foreign'), { cause: null, myErr: inner });
    const errVal = errorFromForeign(err, null, coerceFault);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get('myErr')).toBe(inner);
  });
});

describe('types.mjs — appendTrailNode stamps {combinator, text} fragments on the trail head', async () => {
  it('stamps the fragment frozen-as-given and materializes through COMBINATOR_SYNTAX', async () => {
    // appendTrailNode stamps the fragment record onto _trailHead in
    // chronological order. Production callsites in eval.mjs::trailEntry
    // produce a `{combinator, text}` shape — `combinator` ∈
    // COMBINATOR_SYNTAX keys, `text` the deflected step's source slice.
    // materializeTrail walks the chain and joins each fragment via
    // `${COMBINATOR_SYNTAX[combinator]} ${text}` into the
    // pipeline-suffix Quote source.
    const { appendTrailNode, materializeTrail, isQuote } = await import('../../src/types.mjs');
    const errVal = makeErrorValue(new Map([['kind', keyword('type-error')]]));
    const fragment = Object.freeze({ combinator: 'pipe', text: 'count' });
    const trailed = appendTrailNode(errVal, fragment);
    expect(isErrorValue(trailed)).toBe(true);
    expect(trailed._trailHead.entry).toBe(fragment);
    const quote = materializeTrail(trailed);
    expect(isQuote(quote)).toBe(true);
    expect(quote.source).toBe('| count');
  });
});

describe('setops bare-form empty Vec', async () => {
  it('minus bare on empty Vec throws MinusBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | minus'))).toBe(true);
  });

  it('inter bare on empty Vec throws InterBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | inter'))).toBe(true);
  });

  it('union bare on empty Vec throws UnionBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | union'))).toBe(true);
  });
});

describe('conduit effect-laundering at call site', async () => {
  it('conduit with @-name called via clean alias triggers EffectLaunderingAtCallError', async () => {
    const s = await createSession();
    // Declare an @-prefixed conduit, then shadow it under a clean name
    // via use, triggering the runtime safety net in applyConduit.
    await s.evalCell(':@effFn count');
    await s.evalCell('{:clean (env | /@effFn)} | use');
    const cell = await s.evalCell('[1 2 3] | clean');
    // EffectLaunderingAtCallError produces an error value.
    expect(isErrorValue(cell.result)).toBe(true);
    expect(cell.result.originalError.name).toBe('EffectLaunderingAtCallError');
  });
});

describe('conduit-parameter arity error', async () => {
  it('calling a conduit parameter with captured args throws ConduitParameterNoCapturedArgsError', async () => {
    // Inside the body, `n` is a conduit-parameter proxy (nullary
    // function value). Calling it with captured args (n(42)) should
    // raise ConduitParameterNoCapturedArgsError with structured context.
    const result = await evalQuery(':f [:n] n(42) | 0 | f(5)');
    expect(isErrorValue(result)).toBe(true);
    const e = result.originalError;
    expect(e.name).toBe('ConduitParameterNoCapturedArgsError');
    expect(e.context.paramName).toBe('n');
    expect(e.context.actualCount).toBe(1);
  });
});


describe('manifest descriptor for a snapshot bound directly via session.bind', async () => {
  it('manifest entry carries :kind ::snapshot plus :type and :value', async () => {
    const s = await createSession();
    s.bind('snap', makeSnapshot(42, { name: 'snap' }));
    const result = (await s.evalCell('manifest | filter(/name | eq("snap")) | first')).result;
    expect(result.get('kind')).toEqual(makeTagKeyword('snapshot'));
    expect(result.get('value')).toBe(42);
    expect(result.get('type')).toEqual(keyword('number'));
  });
});

describe('min/max subject type checks', async () => {
  it('min on a non-Vec-or-Set throws MinSubjectNotVecOrSetError', async () => {
    const result = await evalQuery('42 | min');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MinSubjectNotVecOrSetError');
  });

  it('max on a non-Vec-or-Set throws MaxSubjectNotVecOrSetError', async () => {
    const result = await evalQuery('"hello" | max');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MaxSubjectNotVecOrSetError');
  });
});


describe('mergeFlat non-Vec element passthrough', async () => {
  it('>> passes non-Vec elements through unchanged', async () => {
    const result = await evalQuery('[1, [2, 3], 4] >> count');
    expect(result).toBe(4);
  });
});

import { deserializeSession } from '../../src/session.mjs';

describe('session deserialization edge cases', async () => {
  it('deserializes conduit binding without params field', async () => {
    const payload = {
      schemaVersion: 1,
      bindings: [{ kind: 'conduit', name: 'x', source: 'mul(2)', docs: [] }],
      cells: []
    };
    const s = await deserializeSession(payload);
    const r = await s.evalCell('5 | x');
    expect(r.result).toBe(10);
  });
});


describe('importSelectiveNamespace single keyword fallback', async () => {
  it('use(:ns, :singleKeyword) wraps keyword in array', async () => {
    const s = await createSession();
    const lib = new Map();
    lib.set('x', 10);
    lib.set('y', 20);
    s.bind('lib', lib);
    const r = await s.evalCell('use(:lib, :x) | x');
    expect(r.result).toBe(10);
  });
});



describe('manifest descriptor — describeBinding branch coverage', async () => {
  // `describeBinding` in manifest-op.mjs switches on the env-value's
  // runtime shape (builtin descriptor / conduit / snapshot / function
  // value / plain). Each branch lands in `manifest`'s output Vec
  // through its dedicated build* helper.

  it('conduit binding surfaces :kind ::conduit with the declared name', async () => {
    const r = await evalQuery(':x mul(2) | manifest | filter(/name | eq("x")) | first');
    expect(r.get('kind')).toEqual(makeTagKeyword('conduit'));
    expect(r.get('name')).toBe('x');
  });

  it('snapshot binding surfaces :kind ::snapshot with the declared name', async () => {
    const r = await evalQuery('42 | as(:v) | manifest | filter(/name | eq("v")) | first');
    expect(r.get('kind')).toEqual(makeTagKeyword('snapshot'));
    expect(r.get('name')).toBe('v');
  });
});

// ── walk.mjs uncovered branches ────────────────────────────────
// Three defensive paths only reachable via direct codec API calls
// (not through parse() → eval()); exercised here so the codec
// contract is tested rather than silently untested.

describe('walk.mjs — locationToQlangMap(null) → null (line 397)', async () => {
  it('roundtrip through qlangMapToAst+astNodeToMap with :location null produces null location map entry', async () => {
    // Build a minimal NumberLit AST Map with :location explicitly null.
    // qlangMapToAst fires locationFromQlangMap(null) (line 405: !isQMap → null),
    // then astNodeToMap on the result fires locationToQlangMap(null) (line 397: !loc → null).
    const m = new Map();
    m.set('kind', keyword('NumberLit'));
    m.set('value', 42);
    m.set('location', null);            // present but non-Map → fires 405
    const node = qlangMapToAst(m);
    expect(node.location).toBe(null);            // locationFromQlangMap(null) → null
    const back = astNodeToMap(node);
    // locationToQlangMap(null) → null; stampCommonFields sets :location null
    expect(back.get('location')).toBe(null);  // fires 397
  });
});

describe('walk.mjs — qlangMapToAst with non-keyword :kind uses String() fallback (line 603)', async () => {
  it('throws AstMapKindUnknownError with String(kindKw) label when kind is not a keyword', async () => {
    const m = new Map();
    m.set('kind', null);   // present but null → String(null) = "null"
    expect(() => qlangMapToAst(m)).toThrow('null');
  });
});

// ── runtime/use-op.mjs uncovered branches ─────────────────────

describe('use-op.mjs — UseNamespaceCollisionError keyword vs raw-key collisions', async () => {
  it('keyword-keyed collision uses k.name in error context', async () => {
    // importUnorderedNamespaces — collision on a keyword key.
    // isKeyword(k) is true → k.name branch taken (existing coverage).
    const s = await createSession();
    s.bind('nsA', new Map([['shared', 1]]));
    s.bind('nsB', new Map([['shared', 2]]));
    const r = await s.evalCell('use(#{:nsA, :nsB})');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNamespaceCollisionError');
  });

  it('non-keyword-keyed collision uses String(k) fallback in error context (line 138)', async () => {
    // Namespaces with raw string keys (non-keyword). isKeyword(k) is
    // false → String(k) branch fires on line 138.
    const s = await createSession();
    s.bind('nsC', new Map([['rawKey', 1]]));
    s.bind('nsD', new Map([['rawKey', 2]]));
    const r = await s.evalCell('use(#{:nsC, :nsD})');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.collidingName).toBe('rawKey');
  });
});

describe('use-op.mjs — UseNameNotExportedError keyword vs raw-name selection', async () => {
  it('selective use(:ns, :missing) produces an error when name is absent', async () => {
    const s = await createSession();
    s.bind('myNs', new Map([['x', 99]]));
    const r = await s.evalCell('use(:myNs, :missing)');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNameNotExportedError');
  });

  it('non-keyword selection uses String(name) fallback in error context (line 157)', async () => {
    // Pass a Vec with a number element as the selection — the number is
    // not a so isKeyword(name) is false → String(name) fires.
    const s = await createSession();
    s.bind('myNs2', new Map([['x', 99]]));
    // use(:myNs2, [42]) — selection Vec contains number 42, not a keyword
    const r = await s.evalCell('use(:myNs2, [42])');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.exportName).toBe('42');
  });
});

describe('manifest-op.mjs — buildValueDescriptor :type lift for directly-bound error', async () => {
  // `buildValueDescriptor` reads `typeKeyword(v)` for the
  // descriptor's `:type` field. `typeKeyword`'s isErrorValue
  // branch surfaces the error's `:kind` TagKeyword when one is
  // present (tagged-instance identity-via-:kind invariant), or
  // the generic `:error` Keyword fallback when `:kind` is a plain
  // Keyword (or missing). Cover both branches.

  it('error :kind as TagKeyword surfaces as the TagKeyword on the :type field', async () => {
    const s = await createSession();
    const errVal = makeErrorValue(new Map([['kind', makeTagKeyword('test')]]));
    s.bind('myErr', errVal);
    const r = await s.evalCell('manifest | filter(/name | eq("myErr")) | first | /type');
    expect(r.result).toEqual(makeTagKeyword('test'));
  });

  it('error :kind as plain Keyword falls through to the generic :error :type', async () => {
    const s = await createSession();
    const errVal = makeErrorValue(new Map([['kind', keyword('test')]]));
    s.bind('myErr', errVal);
    const r = await s.evalCell('manifest | filter(/name | eq("myErr")) | first | /type');
    expect(r.result).toEqual(keyword('error'));
  });
});

describe('printValue — qlang literal serialization', async () => {
  it('prints scalars', async () => {
    expect(printValue(null)).toBe('null');
    expect(printValue(undefined)).toBe('null');
    expect(printValue(true)).toBe('true');
    expect(printValue(false)).toBe('false');
    expect(printValue(42)).toBe('42');
    expect(printValue(3.14)).toBe('3.14');
    expect(printValue(-1)).toBe('-1');
  });

  it('prints strings with escapes', async () => {
    expect(printValue('hello')).toBe('"hello"');
    expect(printValue('a"b')).toBe('"a\\"b"');
    expect(printValue('a\nb')).toBe('"a\\nb"');
    expect(printValue('a\\b')).toBe('"a\\\\b"');
    expect(printValue('a\bb')).toBe('"a\\bb"');
    expect(printValue('a\fb')).toBe('"a\\fb"');
  });

  it('prints keywords', async () => {
    expect(printValue(keyword('name'))).toBe(':name');
    expect(printValue(keyword('qlang/error'))).toBe(':qlang/error');
  });

  it('prints Vec', async () => {
    expect(printValue([1, 2, 3])).toBe('[1 2 3]');
    expect(printValue([])).toBe('[]');
    expect(printValue(['a', 'b'])).toBe('["a" "b"]');
  });

  it('prints Set', async () => {
    expect(printValue(new Set([1, 2]))).toBe('#{1 2}');
  });

  it('prints small Map inline', async () => {
    const m = new Map([['a', 1], ['b', 2]]);
    expect(printValue(m)).toBe('{:a 1 :b 2}');
  });

  it('pretty-prints Map with more than 2 entries', async () => {
    const m = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
    const out = printValue(m);
    expect(out).toContain('\n');
    expect(out).toMatch(/^\{/);
    expect(out).toMatch(/\}$/);
    expect(out).toContain(':a 1');
    expect(out).toContain(':b 2');
    expect(out).toContain(':c 3');
  });

  it('prints error value with descriptor', async () => {
    const desc = new Map([['kind', keyword('test')]]);
    const err = makeErrorValue(desc);
    const out = printValue(err);
    expect(out).toMatch(/^!\{/);
    expect(out).toContain(':kind :test');
  });

  it('pretty-prints error with many descriptor fields', async () => {
    const desc = new Map([
      ['origin', keyword('qlang/eval')],
      ['kind', keyword('type-error')],
      ['message', 'boom']
    ]);
    const err = makeErrorValue(desc);
    const out = printValue(err);
    expect(out).toContain('\n');
    expect(out).toContain(':origin :qlang/eval');
    expect(out).toContain(':message "boom"');
  });

  it('falls back to String() for exotic values', async () => {
    const out = printValue(Symbol('x'));
    expect(out).toBe('Symbol(x)');
  });
});


describe('keyword-literal.mjs — canonicalKeywordLiteral', async () => {
  it('returns bare form for identifier-safe names', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/keyword-literal.mjs');
    expect(canonicalKeywordLiteral('foo')).toBe(':foo');
    expect(canonicalKeywordLiteral('qlang/error')).toBe(':qlang/error');
  });

  it('returns quoted form for names that need quoting', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/keyword-literal.mjs');
    expect(canonicalKeywordLiteral('1')).toBe(':"1"');
    expect(canonicalKeywordLiteral('foo bar')).toBe(':"foo bar"');
    expect(canonicalKeywordLiteral('$ref')).toBe(':"$ref"');
    expect(canonicalKeywordLiteral('')).toBe(':""');
  });
});

describe('evalSetLit keyword dedup', async () => {
  it('deduplicates keywords by name in Set literals', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('#{:a :b :a}');
    expect(result.size).toBe(2);
  });
});

describe('setops Set×Set keyword-aware operations', async () => {
  it('union deduplicates keywords across Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#{:a :b} #{:b :c}] | union');
    expect(result.size).toBe(3);
  });

  it('minus removes keywords by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#{:a :b :c} #{:b}] | minus');
    expect(result.size).toBe(2);
  });

  it('inter keeps keywords present in both', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#{:a :b :c} #{:b :d}] | inter');
    expect(result.size).toBe(1);
  });
});

describe('Set keyword membership without interning', async () => {
  it('has(:key) on Set finds keyword by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#{:a :b :c} | has(:b)')).toBe(true);
    expect(await evalQuery('#{:a :b :c} | has(:z)')).toBe(false);
  });

  it('deepEqual on Sets with keywords compares by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    const s1 = await evalQuery('#{:x :y}');
    const s2 = await evalQuery('#{:x :y}');
    expect(deepEqual(s1, s2)).toBe(true);
    const s3 = await evalQuery('#{:x :z}');
    expect(deepEqual(s1, s3)).toBe(false);
  });

  it('Map×Set minus drops keys present in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #{:b}] | minus');
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });

  it('Map×Set inter keeps keys present in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #{:a :c}] | inter');
    expect(result.size).toBe(2);
  });
});

describe('has on Set with non-keyword values', async () => {
  it('finds number in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#{1 2 3} | has(2)')).toBe(true);
    expect(await evalQuery('#{1 2 3} | has(9)')).toBe(false);
  });
});

describe('codec $map with keyword-tagged keys decodes to string-keyed Map', async () => {
  it('decodes old-format $map entries with $keyword keys to string-keyed Maps', async () => {
    const { fromTaggedJSON } = await import('../../src/codec.mjs');
    const oldFormat = { $map: [[{$keyword: 'name'}, 'alice'], [{$keyword: 'age'}, 30]] };
    const result = fromTaggedJSON(oldFormat);
    expect(result.get('name')).toBe('alice');
    expect(result.get('age')).toBe(30);
  });
});

describe('deepEqual Set keyword mismatch', async () => {
  it('returns false when keyword names differ between Sets', async () => {
    const { keyword } = await import('../../src/types.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    const s1 = new Set([keyword('a'), keyword('b')]);
    const s2 = new Set([keyword('a'), keyword('c')]);
    expect(deepEqual(s1, s2)).toBe(false);
  });
});

describe('setops keyword-aware minus/inter with mixed Set members', async () => {
  it('Map×Set minus with Set containing non-keyword members', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2}, #{:a 42}] | minus');
    expect(result.has('b')).toBe(true);
  });

  it('Map×Set inter with Set containing non-keyword members', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #{:b 99}] | inter');
    expect(result.has('b')).toBe(true);
  });
});

describe('setops Set×Set non-keyword elements', async () => {
  it('minus of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#{1 2 3}, #{2}] | minus');
    expect(result.size).toBe(2);
  });

  it('inter of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#{1 2 3}, #{2 3}] | inter');
    expect(result.size).toBe(2);
  });
});

describe('printValue keyword round-trip', async () => {
  it('quoted keywords round-trip through printValue → parse → eval', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');

    const cases = [':"1"', ':"foo bar"', ':"$ref"', ':""', ':"123"', ':foo', ':qlang/error'];
    for (const src of cases) {
      const original = await evalQuery(src);
      const printed = printValue(original);
      const reparsed = await evalQuery(printed);
      expect(deepEqual(original, reparsed), ).toBe(true);
    }
  });

  it('Map with quoted-keyword keys round-trips through printValue', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');

    const original = await evalQuery('{:"$ref" 1 :"foo bar" 2}');
    const printed = printValue(original);
    const reparsed = await evalQuery(printed);
    expect(deepEqual(original, reparsed)).toBe(true);
  });
});

describe('printValue round-trip — all composite types', async () => {
  const { evalQuery } = await import('../../src/eval.mjs');
  const { printValue } = await import('../../src/runtime/format.mjs');
  const { deepEqual } = await import('../../src/equality.mjs');

  async function assertRoundTrip(src, label) {
    const original = await evalQuery(src);
    const printed = printValue(original);
    const reparsed = await evalQuery(printed);
    expect(deepEqual(original, reparsed), `${label}: ${src} → ${printed}`).toBe(true);
  }

  it('Vec of mixed types', async () => {
    await assertRoundTrip('[1 "two" :three true null]', 'mixed Vec');
  });

  it('Vec with quoted keywords', async () => {
    await assertRoundTrip('[:"$ref" :"foo bar" :normal]', 'quoted kw Vec');
  });

  it('Set of keywords', async () => {
    await assertRoundTrip('#{:a :b :c}', 'keyword Set');
  });

  it('Set with quoted keywords', async () => {
    await assertRoundTrip('#{:"$ref" :normal}', 'quoted kw Set');
  });

  it('Set of numbers', async () => {
    await assertRoundTrip('#{1 2 3}', 'number Set');
  });

  it('Map with bare keys', async () => {
    await assertRoundTrip('{:name "alice" :age 30}', 'bare key Map');
  });

  it('Map with quoted keys', async () => {
    await assertRoundTrip('{:"$ref" 1 :"foo bar" 2}', 'quoted key Map');
  });

  it('Map with keyword values', async () => {
    await assertRoundTrip('{:kind :type-error :origin :qlang/eval}', 'keyword val Map');
  });

  it('nested Map', async () => {
    await assertRoundTrip('{:a {:b {:c 42}}}', 'nested Map');
  });

  it('Error value', async () => {
    await assertRoundTrip('!{:kind :oops :message "boom"}', 'Error');
  });

  it('Error with trail', async () => {
    await assertRoundTrip('!{:kind :oops :trail ~{| count}}', 'Error trail');
  });

  it('deeply nested composite', async () => {
    await assertRoundTrip('{:data [{:id 1 :tags #{:a :b}} {:id 2 :tags #{:c}}]}', 'deep composite');
  });
});
