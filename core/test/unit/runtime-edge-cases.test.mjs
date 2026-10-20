// The branches of equality, of the forms of values, of the reading of a
// parse failure and of the printer that the laws of the catalog leave
// out, a `describe` for each.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { makeSet } from '../../src/ordering.mjs';
import {
  formOf,
  typeOf,
  keyword,
  makeTag,
  makeBinding,
  makeErrorValue,
  isErrorValue
} from '../../src/types.mjs';
import { parse } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { errorFromParse, spanOfLocation } from '../../src/error-convert.mjs';
import { printValue } from '../../src/print-value.mjs';

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
    const { makeTagged, makeTag } = await import('../../src/types.mjs');
    const tagged = makeTagged(makeTag('Box'), [42]);
    expect(formOf(tagged)).toBe('underTag');
  });

  it('toPlain writes a vector under a tag as its tag beside its payload', async () => {
    const { makeTagged, makeTag } = await import('../../src/types.mjs');
    const { toPlain } = await import('../../src/runtime/json.mjs');
    const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
    const plainTagged = toPlain(tagged);
    expect(plainTagged.$tag).toBe('Box');
    expect(plainTagged.payload).toEqual([42, 'inner']);
  });

  it('isTagged takes a descriptor under ::builtin as the value under a tag it is', async () => {
    const { isTagged } = await import('../../src/types.mjs');
    expect(isTagged(await evalQuery('::builtin{:a 1}'))).toBe(true);
    expect(isTagged(await evalQuery('{:kind ::builtin}'))).toBe(false);
  });

  it('typeOf reads identity off the JS header, not off a `:kind` field', async () => {
    const { makeTag, isTag, stampTagHeader } = await import('../../src/types.mjs');
    const carriesKindField = new Map([
      ['kind', makeTag('Box')],
      ['payload', [42, 'inner']]
    ]);
    expect(typeOf(carriesKindField).name).toBe('map');

    const stamped = new Map([['payload', [42, 'inner']]]);
    stampTagHeader(stamped, makeTag('Box'));
    const kind = typeOf(stamped);
    expect(isTag(kind)).toBe(true);
    expect(kind.name).toBe('Box');
  });
});

describe('typeOf covers all value kinds', () => {

  it('typeOf refuses an object of JavaScript, a value of no kind of the language [QSHST#source]', () => {
    expect(() => typeOf({ type: 'alien' })).toThrow('the core met object Object, a value of no kind of the language');
  });

  it('typeOf returns ::binding for a binding record', () => {
    const record = makeBinding({ name: keyword('x'), value: 42 });
    expect(typeOf(record).name).toBe('binding');
  });
});

describe('deepEqual Set vs non-Set non-Array', async () => {
  it('returns false when first is a set and second is an object of JavaScript', async () => {
    expect(deepEqual(makeSet([1]), {})).toBe(false);
  });

  it('returns false when same-size sets contain different elements', async () => {
    expect(deepEqual(makeSet([1, 2]), makeSet([1, 3]))).toBe(false);
  });
});

describe('error-convert.mjs — errorFromParse and the origin of a text [QSHST#source]', async () => {
  it('names no origin where the text came from no source a host named', async () => {
    const parseError = Object.assign(new Error('unexpected token'), { location: null });
    // no .uri property — tests the false arm of `if (uri)`
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const errVal = errorFromParse(parseError, await langRuntime());
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.facts.has('origin')).toBe(false);
  });

  it('names as its origin, a keyword, the uri of the source the text came from', async () => {
    const parseError = Object.assign(new Error('unexpected token'), { location: null, uri: 'shop.qlang' });
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const errVal = errorFromParse(parseError, await langRuntime());
    expect(errVal.facts.get('origin')).toEqual(keyword('shop.qlang'));
  });
});

describe('an input takes no modifiers', async () => {
  it('an input holding a value refuses modifiers as any value does', async () => {
    // Inside the recipe, `n` is the record of an input holding a value, so
    // a modifier handed to it is refused with CallValueTakesNoModifiersError.
    const result = await evalQuery(':any/f (::fn | takes :n |~~ N. ~~| /0 | impl ~(n 42)) | 0 | f 5');
    expect(isErrorValue(result)).toBe(true);
    const e = result.originalError;
    expect(e.name).toBe('ValueTakesNoModifiersError');
    expect(e.facts.name.name).toBe('n');
  });
});


describe('error-convert.mjs — spanOfLocation [QSPRN#span]', async () => {
  it('answers null for a location that is none', async () => {
    expect(spanOfLocation(null)).toBe(null);
  });

  it('writes the start and the end of a location as the six numbers of a span', async () => {
    const span = spanOfLocation(partOf(parse('42')).span, '42');
    expect(typeOf(span).name).toBe('span');
    expect([...span]).toEqual([0, 1, 1, 2, 1, 3]);
  });
});

describe('printValue — qlang literal serialization', async () => {
  it('prints atoms', async () => {
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

  it('prints error value with tag head and facts', async () => {
    const err = makeErrorValue(makeTag('Test'), new Map([['index', 1]]));
    const out = printValue(err);
    expect(out).toMatch(/^::Test!\{/);
    expect(out).toContain(':index 1');
  });

  it('pretty-prints error with many facts', async () => {
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

  it('refuses a value of no kind of the language where it reads its kind [QSHST#source]', async () => {
    expect(() => printValue(Symbol('x'))).toThrow('the core met symbol Symbol(x), a value of no kind of the language');
  });
});


describe('printValue keyword round-trip', async () => {
  it('quoted keywords round-trip through printValue → parse → eval', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const { printValue } = await import('../../src/print-value.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');

    const cases = [':"1"', ':"foo bar"', ':"$ref"', ':""', ':"123"', ':foo', ':qlang/error'];
    for (const src of cases) {
      const original = await evalQuery(src);
      const printed = printValue(original);
      const reparsed = await evalQuery(printed);
      expect(deepEqual(original, reparsed), `a quoted keyword read back as another value: ${src} → ${printed}`).toBe(true);
    }
  });

  it('Map with quoted-keyword keys round-trips through printValue', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const { printValue } = await import('../../src/print-value.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');

    const original = await evalQuery('{:"$ref" 1 :"foo bar" 2}');
    const printed = printValue(original);
    const reparsed = await evalQuery(printed);
    expect(deepEqual(original, reparsed)).toBe(true);
  });
});

describe('printValue round-trip — all composite types', async () => {
  const { evalQuery } = await import('../../src/session.mjs');
  const { printValue } = await import('../../src/print-value.mjs');
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
    // recovers the same value [QSERR#rest].
    await assertRoundTrip('::Foo!{:message "boom"}', 'Error');
  });

  it('Error value with a :kind fact under the kind of errors', async () => {
    await assertRoundTrip('!{:kind ::Foo :message "boom"}', 'Error');
  });

  it('Error with a trace of another shape', async () => {
    await assertRoundTrip('!{:message "boom" :trace ~(| count)}', 'Error trace');
  });

  it('deeply nested composite', async () => {
    await assertRoundTrip('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}', 'deep composite');
  });
});

describe('string/toNumber — the number a text writes whole [QSCND#convert]', () => {
  it('refuses a text that writes a number beside whitespace', async () => {
    for (const text of ['"5 "', '" 5"']) {
      expect(await evalQuery(`${text} | toNumber !| type`), text).toEqual(await evalQuery('::string/toNumber/TextNotNumberError'));
    }
  });
});
