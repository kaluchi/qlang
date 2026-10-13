// Edge-case branch coverage for runtime modules, grouped per
// target source file. Each `describe` block names the module and
// the specific branch / path it exercises (right-operand checks
// in `arith.mjs`, non-keyword key fallback in `setops.mjs`'s
// `UseModuleCollisionError` site, binding-record classifier in
// `types.mjs::formOf`,
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
  formOf,
  typeKeyword,
  keyword,
  makeTag,
  makeBinding,
  makeErrorValue,
  isErrorValue
} from '../../src/types.mjs';
import { locationToQlangMap } from '../../src/walk.mjs';
import { parse } from '../../src/parse.mjs';
import { errorFromParse } from '../../src/error-convert.mjs';
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

describe('formOf of a binding record and of a vector under a tag', async () => {
  it('formOf reads a binding record as a value under a tag, underTag', async () => {
    const record = makeBinding({ name: keyword('x'), value: 42 });
    expect(formOf(record)).toBe('underTag');
  });

  it('formOf answers "underTag" for a vector under a tag', async () => {
    const { makeTaggedInstance, makeTag } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTag('Box'), [42]);
    expect(formOf(instance)).toBe('underTag');
  });

  it('toPlain writes a vector under a tag as its tag beside its payload', async () => {
    const { makeTaggedInstance, makeTag } = await import('../../src/types.mjs');
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const tagged = makeTaggedInstance(makeTag('Box'), [42, 'inner']);
    const plainTagged = toPlain(tagged);
    expect(plainTagged.$tag).toBe('Box');
    expect(plainTagged.payload).toEqual([42, 'inner']);
  });

  it('isTaggedInstance takes a descriptor under ::builtin as the value under a tag it is', async () => {
    const { isTaggedInstance } = await import('../../src/types.mjs');
    expect(isTaggedInstance(await evalQuery('::builtin{:a 1}'))).toBe(true);
    expect(isTaggedInstance(await evalQuery('{:kind ::builtin}'))).toBe(false);
  });

  it('typeKeyword reads identity off the JS header, not off a `:kind` field', async () => {
    const { makeTag, isTag, stampTagHeader } = await import('../../src/types.mjs');
    const carriesKindField = new Map([
      ['kind', makeTag('Box')],
      ['payload', [42, 'inner']]
    ]);
    expect(typeKeyword(carriesKindField).name).toBe('map');

    const stamped = new Map([['payload', [42, 'inner']]]);
    stampTagHeader(stamped, makeTag('Box'));
    const tk = typeKeyword(stamped);
    expect(isTag(tk)).toBe(true);
    expect(tk.name).toBe('Box');
  });
});

describe('typeKeyword covers all value kinds', () => {

  it('typeKeyword returns :unknown for an unrecognized object', () => {
    expect(typeKeyword({ type: 'alien' }).name).toBe('unknown');
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
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const errVal = errorFromParse(parseError, await langRuntime());
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.has('uri')).toBe(false);
  });
});

describe('a part takes no modifiers', async () => {
  it('a part holding a value refuses modifiers as any value does', async () => {
    // Inside the body, `n` is the record of a part holding a value, so
    // a modifier handed to it is refused with CallValueTakesNoModifiersError.
    const result = await evalQuery(':any/f ~(n 42) | :any/f/n /0 | 0 | f 5');
    expect(isErrorValue(result)).toBe(true);
    const e = result.originalError;
    expect(e.name).toBe('ValueTakesNoModifiersError');
    expect(e.facts.name.name).toBe('n');
  });
});


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
    const err = makeErrorValue(makeTag('Test'), new Map([['index', 1]]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain(':index 1');
  });

  it('pretty-prints error with many descriptor fields', async () => {
    const err = makeErrorValue(makeTag('Test'), new Map([
      ['actualType', makeTag('number')],
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

  it('Error value of its own tag', async () => {
    // The print form writes the tag before the bang and re-parse
    // recovers the same value [D13].
    await assertRoundTrip('::Foo!{:message "boom"}', 'Error');
  });

  it('Error value with a :kind fact under the kind of errors', async () => {
    await assertRoundTrip('!{:kind ::Foo :message "boom"}', 'Error');
  });

  it('Error with trail', async () => {
    await assertRoundTrip('!{:message "boom" :trail ~(| count)}', 'Error trail');
  });

  it('deeply nested composite', async () => {
    await assertRoundTrip('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}', 'deep composite');
  });
});
