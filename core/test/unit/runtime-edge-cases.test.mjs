// Edge-case branch coverage for runtime modules, grouped per
// target source file. Each `describe` block names the module and
// the specific branch / path it exercises (right-operand checks
// in `arith.mjs`, non-keyword key fallback in `setops.mjs`'s
// `UseNamespaceCollisionError` site, binding-record classifier in
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
import { makeSet } from '../../src/types.mjs';
import {
  describeType,
  typeKeyword,
  keyword,
  makeTagKeyword,
  makeBinding,
  makeErrorValue,
  isErrorValue
} from '../../src/types.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { createSession } from '../../src/session.mjs';
import { locationToQlangMap } from '../../src/walk.mjs';
import { parse } from '../../src/parse.mjs';
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

  it('returns false when one side is a set and the other its vector', async () => {
    expect(deepEqual(makeSet([1]), [1])).toBe(false);
  });

  it('returns false when sets have different size', async () => {
    expect(deepEqual(makeSet([1, 2]), makeSet([1, 2, 3]))).toBe(false);
  });
});

describe('describeType for a verb and a binding record', async () => {
  it('describeType reads a binding record as the tagged Map it is', async () => {
    const record = makeBinding({ name: keyword('x'), value: 42 });
    expect(describeType(record)).toBe('TaggedInstance');
  });

  it('describeType reads a verb as the tagged instance it is', async () => {
    expect(describeType(await evalQuery('::verb~(mul 2)'))).toBe('TaggedInstance');
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
    const { makeTaggedInstance, makeTagKeyword } = await import('../../src/types.mjs');
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Box'), [42, 'inner']);
    const plainTagged = toPlain(tagged);
    expect(plainTagged.$tag).toBe('Box');
    expect(plainTagged.payload).toEqual([42, 'inner']);
  });

  it('isTaggedInstance rejects a builtin descriptor without checking :kind field shape', async () => {
    // A descriptor's identity rides on the Map's JS-header
    // `TAG_HEADER_SYMBOL` slot under the reserved `::builtin`, so the
    // generic tagged-instance render path stays disjoint from the
    // descriptor's, whatever a bystander Map carries as `:kind`.
    const { isTaggedInstance } = await import('../../src/types.mjs');
    expect(isTaggedInstance(await evalQuery('::builtin{:a 1}'))).toBe(false);
  });

  it('typeKeyword reads identity off the JS header, not off a `:kind` field', async () => {
    const { makeTagKeyword, isTagKeyword, stampTagHeader } = await import('../../src/types.mjs');
    const carriesKindField = new Map([
      ['kind', makeTagKeyword('Box')],
      ['payload', [42, 'inner']]
    ]);
    expect(typeKeyword(carriesKindField).name).toBe('map');

    const stamped = new Map([['payload', [42, 'inner']]]);
    stampTagHeader(stamped, makeTagKeyword('Box'));
    const tk = typeKeyword(stamped);
    expect(isTagKeyword(tk)).toBe(true);
    expect(tk.name).toBe('Box');
  });
});

describe('typeKeyword covers all value kinds', () => {
  it('typeKeyword returns :function for a function value', () => {
    const fnValue = makeFn('probe', 1, () => {});
    expect(typeKeyword(fnValue).name).toBe('function');
  });

  it('typeKeyword returns :unknown for an unrecognized object', () => {
    expect(typeKeyword({ type: 'alien' }).name).toBe('unknown');
  });

  it('typeKeyword returns ::verb for a verb', async () => {
    expect(typeKeyword(await evalQuery('::verb~(mul 2)')).name).toBe('verb');
  });

  it('typeKeyword returns ::binding for a binding record', () => {
    const record = makeBinding({ name: keyword('x'), value: 42 });
    expect(typeKeyword(record).name).toBe('binding');
  });
});

describe('deepEqual Set vs non-Set non-Array', async () => {
  it('returns false when first is a set and second is plain object', async () => {
    expect(deepEqual(makeSet([1]), {})).toBe(false);
  });

  it('returns false when same-size sets contain different elements', async () => {
    expect(deepEqual(makeSet([1, 2]), makeSet([1, 3]))).toBe(false);
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
  it('coerce passes through a set unchanged', async () => {
    const qset = makeSet([1, 2, 3]);
    const err = Object.assign(new Error('foreign'), { mySet: qset });
    const errVal = errorFromForeign(err, null);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get('mySet')).toBe(qset);
  });

  it('coerce passes through an errorValue unchanged', async () => {
    const inner = makeErrorValue(makeTagKeyword('Inner'), new Map(), { originalError: new Error('inner') });
    const err = Object.assign(new Error('foreign'), { cause: null, myErr: inner });
    const errVal = errorFromForeign(err, null);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get('myErr')).toBe(inner);
  });
});

describe('verb effectLaundering at call site', async () => {
  it('an effectful verb called via a clean alias triggers EffectLaunderingAtCallError', async () => {
    const s = await createSession();
    // Declare a verb whose body calls an @-name under an @-name, then
    // bind it under a clean name via use, triggering the runtime safety
    // net in applyVerb.
    await s.evalCell(':@effFn ::verb~(@callers | count)');
    await s.evalCell('{:clean (env | /@effFn)} | use');
    const cell = await s.evalCell('[1 2 3] | clean');
    // EffectLaunderingAtCallError produces an error value.
    expect(isErrorValue(cell.result)).toBe(true);
    expect(cell.result.originalError.name).toBe('EffectLaunderingAtCallError');
  });
});

describe('a slot takes no modifiers', async () => {
  it('a slot holding a value refuses modifiers as any value does', async () => {
    // Inside the body, `n` is the record of a slot holding a value, so
    // a modifier handed to it is refused with ApplyToNonFunctionError.
    const result = await evalQuery(':f ::verb~(:n ::any | n 42) | 0 | f 5');
    expect(isErrorValue(result)).toBe(true);
    const e = result.originalError;
    expect(e.name).toBe('ApplyToNonFunctionError');
    expect(e.context.name).toBe('n');
  });
});


import { deserializeSession } from '../../src/session.mjs';

describe('session deserialization edge cases', async () => {
  it('deserializes a verb binding from its quote under its tag', async () => {
    const payload = {
      schemaVersion: 3,
      bindings: [{ name: 'x', value: { $tagged: { $tag: 'verb', payload: { $quote: 'mul 2' } } }, docs: [] }],
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
    const r = await s.evalCell('use :lib :x | x');
    expect(r.result).toBe(10);
  });
});



// ── walk.mjs location view ─────────────────────────────────────

describe('walk.mjs — locationToQlangMap', async () => {
  it('answers null for a declaration without a site', async () => {
    expect(locationToQlangMap(null)).toBe(null);
  });

  it('carries the start and the end of a location as Maps', async () => {
    const view = locationToQlangMap(parse('42').location);
    expect(view.get('start').get('offset')).toBe(0);
    expect(view.get('end').get('column')).toBe(3);
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
    const r = await s.evalCell('use #[:nsA :nsB]');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNamespaceCollisionError');
  });

  it('non-keyword-keyed collision uses String(k) fallback in error context (line 138)', async () => {
    // Namespaces with raw string keys (non-keyword). isKeyword(k) is
    // false → String(k) branch fires on line 138.
    const s = await createSession();
    s.bind('nsC', new Map([['rawKey', 1]]));
    s.bind('nsD', new Map([['rawKey', 2]]));
    const r = await s.evalCell('use #[:nsC :nsD]');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.collidingName).toBe('rawKey');
  });
});

describe('use-op.mjs — UseNameNotExportedError keyword vs raw-name selection', async () => {
  it('selective use(:ns, :missing) produces an error when name is absent', async () => {
    const s = await createSession();
    s.bind('myNs', new Map([['x', 99]]));
    const r = await s.evalCell('use :myNs :missing');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNameNotExportedError');
  });

  it('non-keyword selection uses String(name) fallback in error context (line 157)', async () => {
    // Pass a Vec with a number element as the selection — the number is
    // not a so isKeyword(name) is false → String(name) fires.
    const s = await createSession();
    s.bind('myNs2', new Map([['x', 99]]));
    // use(:myNs2, [42]) — selection Vec contains number 42, not a keyword
    const r = await s.evalCell('use :myNs2 [42]');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.exportName).toBe('42');
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
    expect(printValue(makeSet([2, 1]))).toBe('#[1 2]');
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
    const err = makeErrorValue(makeTagKeyword('Test'), new Map([['index', 1]]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain(':index 1');
  });

  it('pretty-prints error with many descriptor fields', async () => {
    const err = makeErrorValue(makeTagKeyword('Test'), new Map([
      ['actualType', makeTagKeyword('number')],
      ['message', 'boom'],
      ['index', 1]
    ]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain('\n');
    expect(out).toContain(':actualType ::number');
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
      expect(deepEqual(original, reparsed), `quoted-keyword round-trip drift on ${src} → ${printed}`).toBe(true);
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
    // construction; the print form leaves the kind of errors out,
    // `!{…}` with the remaining fields, and re-parse recovers the
    // same value.
    await assertRoundTrip('!{:kind ::error :message "boom"}', 'Error');
  });

  it('Error value with plain-keyword :kind stays in descriptor under the kind of errors', async () => {
    await assertRoundTrip('!{:kind :oops :message "boom"}', 'Error');
  });

  it('Error with trail', async () => {
    await assertRoundTrip('!{:kind ::error :trail ~(| count)}', 'Error trail');
  });

  it('deeply nested composite', async () => {
    await assertRoundTrip('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}', 'deep composite');
  });
});
