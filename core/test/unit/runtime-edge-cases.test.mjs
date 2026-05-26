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
import { evalQuery } from '../../src/eval.mjs';
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
import { createSession } from '../../src/session.mjs';
import { astNodeToMap, qlangMapToAst } from '../../src/ast-codec.mjs';
import { errorFromParse, errorFromForeign } from '../../src/error-convert.mjs';
import { printValue } from '../../src/runtime/format.mjs';

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
    const { makeTaggedInstance, makeTagKeyword } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTagKeyword('Box'), [42]);
    expect(describeType(instance)).toBe('TaggedInstance');
  });

  it('TaggedInstance toPlain on Vec payload — overlay identity, encoded payload is the Array data', async () => {
    // Identity-overlay design: tag rides on the JS-header slot
    // of the Array payload itself. `toPlain` encodes the
    // underlying array as `payload`, identity rides on `$tag`.
    // (`Conduit` deliberately has no toPlain handler — its
    // internal `:envRef` / `:body` slots are JS-opaque and the
    // bidirectional codec for conduits is the session serializer.)
    const { makeTaggedInstance, makeTagKeyword } = await import('../../src/types.mjs');
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Box'), [42, 'inner']);
    const plainTagged = toPlain(tagged);
    expect(plainTagged.$tag).toBe('Box');
    expect(plainTagged.payload).toEqual([42, 'inner']);
  });

  it('isTaggedInstance rejects real conduit / snapshot values without checking :kind field shape', async () => {
    // After Phase 2 the conduit / snapshot identity rides on the
    // Map's JS-header `TAG_HEADER_SYMBOL` slot. `isTaggedInstance`
    // routes through `isConduit` / `isSnapshot` first so the
    // generic tagged-instance render path stays disjoint from
    // `printConduit` / `printSnapshot`, regardless of whether a
    // bystander Map happens to carry `:kind ::conduit` as ordinary
    // data.
    const { makeConduit, makeSnapshot, isTaggedInstance } = await import('../../src/types.mjs');
    const realConduit = makeConduit({ type: 'NumberLit', value: 1, text: '1' });
    const realSnapshot = makeSnapshot(42, { name: 'x' });
    expect(isTaggedInstance(realConduit)).toBe(false);
    expect(isTaggedInstance(realSnapshot)).toBe(false);
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
  const { makeQuote } = await import('../../src/types.mjs');
  const coerceFaultStep = makeQuote('hostCoerce');
  const coerceFaultInput = 'coerce-input';

  it('coerce passes through a QSet (JS Set) unchanged', async () => {
    const qset = new Set([1, 2, 3]);
    const err = Object.assign(new Error('foreign'), { mySet: qset });
    const errVal = errorFromForeign(err, null, coerceFaultStep, coerceFaultInput);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get('mySet')).toBe(qset);
  });

  it('coerce passes through an errorValue unchanged', async () => {
    const inner = makeErrorValue(makeTagKeyword('Inner'), new Map(), { originalError: new Error('inner') });
    const err = Object.assign(new Error('foreign'), { cause: null, myErr: inner });
    const errVal = errorFromForeign(err, null, coerceFaultStep, coerceFaultInput);
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
    const errVal = makeErrorValue(makeTagKeyword('TypeError'), new Map());
    const fragment = Object.freeze({ combinator: 'pipe', text: 'count' });
    const trailed = appendTrailNode(errVal, fragment);
    expect(isErrorValue(trailed)).toBe(true);
    expect(trailed._trailHead.entry).toBe(fragment);
    const quote = materializeTrail(trailed);
    expect(isQuote(quote)).toBe(true);
    expect(quote.source).toBe('| count');
  });
});

describe('conduit effectLaundering at call site', async () => {
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

describe('conduitParameter arity error', async () => {
  it('calling a conduit parameter with captured args throws ConduitParameterNoCapturedArgsError', async () => {
    // Inside the body, `n` is a conduitParameter proxy (nullary
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
    // importCollisionStrictNamespaces — collision on a keyword key.
    // isKeyword(k) is true → k.name branch taken (existing coverage).
    const s = await createSession();
    s.bind('nsA', new Map([['shared', 1]]));
    s.bind('nsB', new Map([['shared', 2]]));
    const r = await s.evalCell('use(#[:nsA, :nsB])');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNamespaceCollisionError');
  });

  it('non-keyword-keyed collision uses String(k) fallback in error context (line 138)', async () => {
    // Namespaces with raw string keys (non-keyword). isKeyword(k) is
    // false → String(k) branch fires on line 138.
    const s = await createSession();
    s.bind('nsC', new Map([['rawKey', 1]]));
    s.bind('nsD', new Map([['rawKey', 2]]));
    const r = await s.evalCell('use(#[:nsC, :nsD])');
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
  // descriptor's `:type` field. After Phase 1's identity-on-JS-
  // header refactor, `typeKeyword`'s isErrorValue branch returns
  // `error.tag` directly — the universal identity slot every
  // error carries on the JS-header `tag` field (defaulting to
  // `::Error` for user `!{}` without explicit `:kind`). No
  // generic fallback path remains.

  it('error tag surfaces as the TagKeyword on the :type field', async () => {
    const s = await createSession();
    const errVal = makeErrorValue(makeTagKeyword('test'), new Map());
    s.bind('myErr', errVal);
    const r = await s.evalCell('manifest | filter(/name | eq("myErr")) | first | /type');
    expect(r.result).toEqual(makeTagKeyword('test'));
  });

  it('default ::Error tag surfaces when no explicit tag was lifted', async () => {
    const s = await createSession();
    const errVal = makeErrorValue(makeTagKeyword('Error'), new Map());
    s.bind('myErr', errVal);
    const r = await s.evalCell('manifest | filter(/name | eq("myErr")) | first | /type');
    expect(r.result).toEqual(makeTagKeyword('Error'));
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
    expect(printValue(new Set([1, 2]))).toBe('#[1 2]');
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

  it('prints error value with tag head and descriptor', async () => {
    const err = makeErrorValue(makeTagKeyword('Test'), new Map([['faultInput', 1]]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain(':faultInput 1');
  });

  it('pretty-prints error with many descriptor fields', async () => {
    const err = makeErrorValue(makeTagKeyword('Test'), new Map([
      ['actualType', keyword('number')],
      ['message', 'boom'],
      ['faultInput', 1]
    ]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain('\n');
    expect(out).toContain(':actualType :number');
    expect(out).toContain(':message "boom"');
  });

  it('falls back to String() for exotic values', async () => {
    const out = printValue(Symbol('x'));
    expect(out).toBe('Symbol(x)');
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
    await assertRoundTrip('#[:a :b :c]', 'keyword Set');
  });

  it('Set with quoted keywords', async () => {
    await assertRoundTrip('#[:"$ref" :normal]', 'quoted kw Set');
  });

  it('Set of numbers', async () => {
    await assertRoundTrip('#[1 2 3]', 'number Set');
  });

  it('Map with bare keys', async () => {
    await assertRoundTrip('{:name "alice" :age 30}', 'bare key Map');
  });

  it('Map with quoted keys', async () => {
    await assertRoundTrip('{:"$ref" 1 :"foo bar" 2}', 'quoted key Map');
  });

  it('Map with keyword values', async () => {
    await assertRoundTrip('{:kind :typeError :origin :qlang/eval}', 'keyword val Map');
  });

  it('nested Map', async () => {
    await assertRoundTrip('{:a {:b {:c 42}}}', 'nested Map');
  });

  it('Error value with TagKeyword :kind lift', async () => {
    // `:kind` carrying a TagKeyword lifts to `error.tag` on
    // construction; the print form re-emits `::Error!{…}` with the
    // remaining fields, and re-parse recovers the same value.
    await assertRoundTrip('!{:kind ::Error :message "boom"}', 'Error');
  });

  it('Error value with plain-keyword :kind stays in descriptor under default ::Error tag', async () => {
    await assertRoundTrip('!{:kind :oops :message "boom"}', 'Error');
  });

  it('Error with trail', async () => {
    await assertRoundTrip('!{:kind ::Error :trail ~{| count}}', 'Error trail');
  });

  it('deeply nested composite', async () => {
    await assertRoundTrip('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}', 'deep composite');
  });
});
