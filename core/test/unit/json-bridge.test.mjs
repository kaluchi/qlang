// JSON value-class infrastructure: JSON Object / JSON Array
// runtime-distinct from qlang Map / Vec, ::qlang and ::json
// converters between the two domains, isJsonObject / isJsonArray
// classifiers.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import {
  isJsonObject, isJsonArray, isQMap, isVec,
  makeJsonObject, makeJsonArray, JSON_OBJECT_TAG, JSON_ARRAY_TAG,
  describeType, typeKeyword, keyword
} from '../../src/types.mjs';

describe('makeJsonObject / makeJsonArray stamp the discriminator Symbol', () => {
  it('makeJsonObject produces a frozen plain object with JSON_OBJECT_TAG', () => {
    const o = makeJsonObject({ k: 1 });
    expect(Object.isFrozen(o)).toBe(true);
    expect(o[JSON_OBJECT_TAG]).toBe(true);
    expect(isJsonObject(o)).toBe(true);
    expect(isQMap(o)).toBe(false);
  });

  it('makeJsonArray produces a frozen Array with JSON_ARRAY_TAG', () => {
    const a = makeJsonArray([1, 2, 3]);
    expect(Object.isFrozen(a)).toBe(true);
    expect(a[JSON_ARRAY_TAG]).toBe(true);
    expect(isJsonArray(a)).toBe(true);
    expect(isVec(a)).toBe(false);
  });

  it('JSON_OBJECT_TAG / JSON_ARRAY_TAG are non-enumerable', () => {
    const o = makeJsonObject({ k: 1 });
    expect(Object.keys(o)).toEqual(['k']);
    const a = makeJsonArray([1, 2]);
    expect(Object.getOwnPropertyNames(a).filter(n => !/^\d+$|^length$/.test(n))).toEqual([]);
  });
});

describe('describeType / typeKeyword distinguish JSON vs qlang shapes', () => {
  it('JSON Object → JsonObject / :jsonObject', () => {
    const o = makeJsonObject({});
    expect(describeType(o)).toBe('JsonObject');
    expect(typeKeyword(o)).toEqual(keyword('jsonObject'));
  });

  it('JSON Array → JsonArray / :jsonArray', () => {
    const a = makeJsonArray([]);
    expect(describeType(a)).toBe('JsonArray');
    expect(typeKeyword(a)).toEqual(keyword('jsonArray'));
  });

  it('qlang Map / Vec keep their original kinds', () => {
    expect(describeType(new Map())).toBe('Map');
    expect(describeType([])).toBe('Vec');
  });
});

describe('::qlang / ::json constructors convert between shape domains', () => {
  it('::qlang on a JSON Object produces a qlang Map', async () => {
    const result = await evalQuery('::qlang{"k": "v"} | type | eq :map');
    expect(result).toBe(true);
  });

  it('::json on a qlang Map produces a JSON Object', async () => {
    const result = await evalQuery('::json{:k 1} | type | eq :jsonObject');
    expect(result).toBe(true);
  });

  it('::qlang recurses into nested JSON Arrays / Objects', async () => {
    const result = await evalQuery('::qlang{"users": [{"name": "alice"}]} | /users | first | /name');
    expect(result).toBe('alice');
  });

  it('::json recurses into nested qlang Maps / Vecs', async () => {
    const result = await evalQuery('::json{:users [{:name "alice"}]} | type | eq :jsonObject');
    expect(result).toBe(true);
  });

  it('::json on a qlang Vec produces a JSON Array', async () => {
    const result = await evalQuery('::json[1 2 3] | type | eq :jsonArray');
    expect(result).toBe(true);
  });
});

describe('type discriminates JSON-tagged shapes from qlang containers', () => {
  it('type answers :jsonObject for a JSON Object and :map for a qlang Map', async () => {
    expect(await evalQuery('::json{:k 1} | type | eq :jsonObject')).toBe(true);
    expect(await evalQuery('{:k 1} | type | eq :jsonObject')).toBe(false);
  });

  it('type answers :jsonArray for a JSON Array and :vec for a qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] | type | eq :jsonArray')).toBe(true);
    expect(await evalQuery('[1 2 3] | type | eq :jsonArray')).toBe(false);
  });

  it('a JSON Array does not answer :vec', async () => {
    expect(await evalQuery('::json[1 2 3] | type | eq :vec')).toBe(false);
  });

  it('a JSON Object does not answer :map', async () => {
    expect(await evalQuery('::json{:k 1} | type | eq :map')).toBe(false);
  });
});

describe('printValue handles JSON Object / JSON Array', () => {
  it('JSON Object renders with quoted string keys and `:` separators', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const o = makeJsonObject({ k: 1, name: 'alice' });
    expect(printValue(o)).toBe('{"k": 1, "name": "alice"}');
  });

  it('JSON Object empty renders as `{}`', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    expect(printValue(makeJsonObject({}))).toBe('{}');
  });

  it('JSON Array renders comma-separated', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    expect(printValue(makeJsonArray([1, 2, 3]))).toBe('[1, 2, 3]');
  });
});

describe('::qlang / ::json passthrough on non-container scalars', () => {
  it('::qlang on a number passes through unchanged', async () => {
    expect(await evalQuery('::qlang(42)')).toBe(42);
  });

  it('::json on a string passes through unchanged', async () => {
    expect(await evalQuery('::json"hello"')).toBe('hello');
  });
});

describe('::qlang on actual JSON-tagged value recurses through containers', () => {
  it('::qlang on a JSON Object converts to qlang Map', async () => {
    const result = await evalQuery('::qlang(::json{:k 1}) | type | eq :map');
    expect(result).toBe(true);
  });

  it('::qlang on a JSON Array converts to qlang Vec', async () => {
    const result = await evalQuery('::qlang(::json[1 2 3]) | type | eq :vec');
    expect(result).toBe(true);
  });

  it('::qlang recurses into nested JSON containers', async () => {
    const result = await evalQuery('::qlang(::json{:items [::json{:n 1} ::json{:n 2}]}) | /items | first | /n');
    expect(result).toBe(1);
  });
});

describe('* retags per element on JsonArray subject', () => {
  it('JsonArray * (number → number) keeps JsonArray tag', async () => {
    expect(await evalQuery('::json[1 2 3] * add 10 | type | eq :jsonArray')).toBe(true);
  });

  it('JsonArray * (number → keyword) degrades to qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] * keyword | type | eq :jsonArray')).toBe(false);
    expect(await evalQuery('::json[1 2 3] * keyword | type | eq :vec')).toBe(true);
  });

  it('JsonArray * (number → JsonObject) keeps JsonArray tag', async () => {
    expect(await evalQuery('::json[1 2 3] * (as :n | ::json{:n n}) | type | eq :jsonArray')).toBe(true);
  });

  it('JsonArray * (number → qlang Map) degrades to qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] * (as :n | {:n n}) | type | eq :jsonArray')).toBe(false);
    expect(await evalQuery('::json[1 2 3] * (as :n | {:n n}) | type | eq :vec')).toBe(true);
  });

  it('qlang Vec * anything stays qlang Vec', async () => {
    expect(await evalQuery('[1 2 3] * add 10 | type | eq :vec')).toBe(true);
    expect(await evalQuery('[1 2 3] * add 10 | type | eq :jsonArray')).toBe(false);
  });
});

describe('container-shape operands preserve JSON-tag on output', () => {
  it('filter on a JsonObject returns a JsonObject', async () => {
    const result = await evalQuery('::json{:a 1 :b 2 :c 3} | filter ~(gte 2) | type | eq :jsonObject');
    expect(result).toBe(true);
  });

  it('at on a JsonObject reads a string-keyed field', async () => {
    expect(await evalQuery('::json{:k 7} | at "k"')).toBe(7);
  });

  it('at on a JsonObject misses to null on absent key', async () => {
    expect(await evalQuery('::json{:k 7} | at "missing"')).toBe(null);
  });

  it('projection on a JsonObject without the key raises ProjectionKeyNotInMapError', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const result = await evalQuery('::json{:k 7} | /missing');
    expect(isErrorValue(result)).toBe(true);
    expect(result.tag.name).toBe('ProjectionKeyNotInMapError');
    expect(result.descriptor.get('key')).toBe('missing');
  });

  it('snapshot-bound JsonObject literal survives identifier-lookup unwrap as JsonObject', async () => {
    const result = await evalQuery(':obj ::json{:k 1} | obj | type | eq :jsonObject');
    expect(result).toBe(true);
  });
});

describe('deepEqual cross-shape equivalences', () => {
  it('JsonObject equals Map with same entries', async () => {
    expect(await evalQuery('::json{:k 1 :n 2} | eq {:k 1 :n 2}')).toBe(true);
  });

  it('JsonObject differs from Map of different size', async () => {
    expect(await evalQuery('::json{:k 1} | eq {:k 1 :n 2}')).toBe(false);
  });

  it('JsonArray equals Vec with same elements', async () => {
    expect(await evalQuery('::json[1 2 3] | eq [1 2 3]')).toBe(true);
  });

  it('Map vs JsonObject — both directions structurally equal', async () => {
    expect(await evalQuery('{:k 1 :n 2} | eq ::json{:k 1 :n 2}')).toBe(true);
  });

  it('JsonObject vs JsonObject — same shape on both sides', async () => {
    expect(await evalQuery('::json{:k 1} | eq ::json{:k 1}')).toBe(true);
  });
});

describe('table cell + inline rendering for JSON-shape values', () => {
  it('table renders a JsonObject-valued cell as inline JSON', async () => {
    const result = await evalQuery('[{:cell ::json{:k 1}}] | table');
    expect(result).toContain('"k": 1');
  });

  it('table renders a JsonArray-valued cell as inline JSON Array', async () => {
    const result = await evalQuery('[{:items ::json[1 2 3]}] | table');
    expect(result).toContain('[1, 2, 3]');
  });

  it('toPlain on a JSON Object returns its native plain shape', async () => {
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const o = makeJsonObject({ k: 1, name: 'alice' });
    const plain = toPlain(o);
    expect(plain).toEqual({ k: 1, name: 'alice' });
  });

  it('toPlain on a JSON Array returns its native plain shape', async () => {
    const { toPlain } = await import('../../src/runtime/format.mjs');
    expect(toPlain(makeJsonArray([1, 2, 3]))).toEqual([1, 2, 3]);
  });
});

describe('JSON object whose data key "type" collides with a value-class name', () => {
  // A JsonObject is a frozen plain object; `"type"` is ordinary JSON
  // data, never a value-class discriminator. The discriminator rides
  // on the VALUE_CLASS_TAG symbol that only the real value-class
  // factories stamp, so a JSON document carrying `"type":"quote"`
  // stays a JsonObject through classification, projection, equality,
  // and the lossy/lossless JSON codecs.

  it('classifies as JsonObject regardless of the "type" data value', () => {
    for (const typeValue of ['quote', 'doc', 'keyword', 'tagKeyword', 'error', 'function', 'taggedInstance']) {
      const o = makeJsonObject({ type: typeValue, extra: 1 });
      expect(describeType(o), `describeType for type=${typeValue}`).toBe('JsonObject');
      expect(isJsonObject(o), `isJsonObject for type=${typeValue}`).toBe(true);
    }
  });

  it('value-class predicates reject a JsonObject that forges their .type tag', async () => {
    const { isKeyword, isQuote, isDoc, isErrorValue, isFunctionValue, isTagKeyword } = await import('../../src/types.mjs');
    expect(isKeyword(makeJsonObject({ type: 'keyword', name: 'x' }))).toBe(false);
    expect(isQuote(makeJsonObject({ type: 'quote', source: 'x' }))).toBe(false);
    expect(isDoc(makeJsonObject({ type: 'doc', content: 'x' }))).toBe(false);
    expect(isErrorValue(makeJsonObject({ type: 'error' }))).toBe(false);
    expect(isFunctionValue(makeJsonObject({ type: 'function' }))).toBe(false);
    expect(isTagKeyword(makeJsonObject({ type: 'tagKeyword', name: 'X' }))).toBe(false);
  });

  it('| json preserves a {"type":"keyword"} document losslessly', async () => {
    const jsonText = await evalQuery('{"type": "keyword", "name": "x"} | json');
    expect(JSON.parse(jsonText)).toEqual({ type: 'keyword', name: 'x' });
  });

  it('| json does not rewrite a {"type":"quote"} document into a Quote literal', async () => {
    const jsonText = await evalQuery('{"type": "quote", "source": "hi"} | json');
    expect(JSON.parse(jsonText)).toEqual({ type: 'quote', source: 'hi' });
  });

  it('a {"type":"error"} document does not crash the evaluator', async () => {
    const result = await evalQuery('{"type": "error", "msg": "boom"} | type');
    expect(result).toEqual(keyword('jsonObject'));
  });

  it('deepEqual on a {"type":"taggedInstance"} document does not crash', async () => {
    const { deepEqual } = await import('../../src/equality.mjs');
    const a = makeJsonObject({ type: 'taggedInstance' });
    const b = makeJsonObject({ type: 'taggedInstance' });
    expect(deepEqual(a, b)).toBe(true);
  });

  it('toTaggedJSON round-trips a {"type":"keyword"} document as a JsonObject', async () => {
    const { toTaggedJSON, fromTaggedJSON } = await import('../../src/codec.mjs');
    const o = makeJsonObject({ type: 'keyword', name: 'x' });
    const wire = toTaggedJSON(o);
    const back = fromTaggedJSON(wire);
    expect(isJsonObject(back)).toBe(true);
    expect(describeType(back)).toBe('JsonObject');
  });
});

describe('fromPlain refuses a JSON number past the finite double range', () => {
  // `JSON.parse` reads a magnitude past the range as an infinity, so
  // the lift is the boundary that keeps it out of the pipeline —
  // `cat huge.json | qlang '/big'` seeds through this exact path.
  it('lifts an out-of-range magnitude into a per-site codec error', async () => {
    const { fromPlain, FromPlainNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(FromPlainNumberNotFiniteError);
    expect(thrown.name).toBe('FromPlainNumberNotFiniteError');
    expect(thrown.fingerprint).toBe('FromPlainNumberNotFiniteError');
    expect(thrown.kind).toBe('codecError');
    expect(thrown.context.path).toEqual([]);
  });

  it('names the slot it walked to when the magnitude sits nested', async () => {
    const { fromPlain, FromPlainNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('{"a": {"b": [1, 1e400]}}')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(FromPlainNumberNotFiniteError);
    expect(thrown.context.path).toEqual(['a', 'b', 1]);
  });

  it('lifts every in-range magnitude unchanged', async () => {
    const { fromPlain } = await import('../../src/runtime/format.mjs');
    expect(fromPlain(JSON.parse('1e308'))).toBe(1e308);
    expect(fromPlain(JSON.parse('-1e308'))).toBe(-1e308);
    expect(fromPlain(JSON.parse('0'))).toBe(0);
  });
});
