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
  it('JSON Object → JsonObject / :json-object', () => {
    const o = makeJsonObject({});
    expect(describeType(o)).toBe('JsonObject');
    expect(typeKeyword(o)).toEqual(keyword('json-object'));
  });

  it('JSON Array → JsonArray / :json-array', () => {
    const a = makeJsonArray([]);
    expect(describeType(a)).toBe('JsonArray');
    expect(typeKeyword(a)).toEqual(keyword('json-array'));
  });

  it('qlang Map / Vec keep their original kinds', () => {
    expect(describeType(new Map())).toBe('Map');
    expect(describeType([])).toBe('Vec');
  });
});

describe('::qlang / ::json constructors convert between shape domains', () => {
  it('::qlang on a JSON Object produces a qlang Map', async () => {
    const result = await evalQuery('::qlang{"k": "v"} | isMap');
    expect(result).toBe(true);
  });

  it('::json on a qlang Map produces a JSON Object', async () => {
    const result = await evalQuery('::json{:k 1} | isJsonObject');
    expect(result).toBe(true);
  });

  it('::qlang recurses into nested JSON Arrays / Objects', async () => {
    const result = await evalQuery('::qlang{"users": [{"name": "alice"}]} | /users | first | /name');
    expect(result).toBe('alice');
  });

  it('::json recurses into nested qlang Maps / Vecs', async () => {
    const result = await evalQuery('::json{:users [{:name "alice"}]} | isJsonObject');
    expect(result).toBe(true);
  });

  it('::json on a qlang Vec produces a JSON Array', async () => {
    const result = await evalQuery('::json[1 2 3] | isJsonArray');
    expect(result).toBe(true);
  });
});

describe('isJsonObject / isJsonArray operands', () => {
  it('isJsonObject true on JSON Object, false on qlang Map', async () => {
    expect(await evalQuery('::json{:k 1} | isJsonObject')).toBe(true);
    expect(await evalQuery('{:k 1} | isJsonObject')).toBe(false);
  });

  it('isJsonArray true on JSON Array, false on qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] | isJsonArray')).toBe(true);
    expect(await evalQuery('[1 2 3] | isJsonArray')).toBe(false);
  });

  it('isVec false on a JSON Array (qlang Vec narrowed)', async () => {
    expect(await evalQuery('::json[1 2 3] | isVec')).toBe(false);
  });

  it('isMap false on a JSON Object (qlang Map narrowed)', async () => {
    expect(await evalQuery('::json{:k 1} | isMap')).toBe(false);
  });
});

describe('printValue handles JSON Object / JSON Array', () => {
  it('JSON Object renders with quoted string keys and ~{:} separators', async () => {
    const { printValue } = await import('../../src/runtime/format.mjs');
    const o = makeJsonObject({ k: 1, name: 'alice' });
    expect(printValue(o)).toBe('{"k": 1, "name": "alice"}');
  });

  it('JSON Object empty renders as ~{{}}', async () => {
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
    const result = await evalQuery('::qlang(::json{:k 1}) | isMap');
    expect(result).toBe(true);
  });

  it('::qlang on a JSON Array converts to qlang Vec', async () => {
    const result = await evalQuery('::qlang(::json[1 2 3]) | isVec');
    expect(result).toBe(true);
  });

  it('::qlang recurses into nested JSON containers', async () => {
    const result = await evalQuery('::qlang(::json{:items [::json{:n 1} ::json{:n 2}]}) | /items | first | /n');
    expect(result).toBe(1);
  });
});

describe('* and >> retag per element on JsonArray subject', () => {
  it('JsonArray * (number → number) keeps JsonArray tag', async () => {
    expect(await evalQuery('::json[1 2 3] * add(10) | isJsonArray')).toBe(true);
  });

  it('JsonArray * (number → keyword) degrades to qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] * keyword | isJsonArray')).toBe(false);
    expect(await evalQuery('::json[1 2 3] * keyword | isVec')).toBe(true);
  });

  it('JsonArray * (number → JsonObject) keeps JsonArray tag', async () => {
    expect(await evalQuery('::json[1 2 3] * (as(:n) | ::json{:n n}) | isJsonArray')).toBe(true);
  });

  it('JsonArray * (number → qlang Map) degrades to qlang Vec', async () => {
    expect(await evalQuery('::json[1 2 3] * (as(:n) | {:n n}) | isJsonArray')).toBe(false);
    expect(await evalQuery('::json[1 2 3] * (as(:n) | {:n n}) | isVec')).toBe(true);
  });

  it('qlang Vec * anything stays qlang Vec', async () => {
    expect(await evalQuery('[1 2 3] * add(10) | isVec')).toBe(true);
    expect(await evalQuery('[1 2 3] * add(10) | isJsonArray')).toBe(false);
  });

  it('JsonArray >> stays JsonArray when flattened elements all JSON-storeable', async () => {
    expect(await evalQuery('::json[::json[1 2] ::json[3 4]] >> take(99) | isJsonArray')).toBe(true);
  });

  it('JsonArray >> degrades to qlang Vec when any flat element is qlang-only', async () => {
    expect(await evalQuery('::json[[:a :b] [:c]] >> take(99) | isJsonArray')).toBe(false);
  });
});

describe('container-shape operands preserve JSON-tag on output', () => {
  it('filter on a JsonObject returns a JsonObject', async () => {
    const result = await evalQuery('::json{:a 1 :b 2 :c 3} | filter(gte(2)) | isJsonObject');
    expect(result).toBe(true);
  });

  it('at on a JsonObject reads a string-keyed field', async () => {
    expect(await evalQuery('::json{:k 7} | at("k")')).toBe(7);
  });

  it('at on a JsonObject misses to null on absent key', async () => {
    expect(await evalQuery('::json{:k 7} | at("missing")')).toBe(null);
  });

  it('projection on a JsonObject misses to null on absent key', async () => {
    expect(await evalQuery('::json{:k 7} | /missing')).toBe(null);
  });

  it('reify of an attached JsonObject literal walks through walk codec', async () => {
    const result = await evalQuery('def(:obj, ::json{:k 1}) | reify(:obj) | /value | isJsonObject');
    expect(result).toBe(true);
  });

  it('astNodeToMap descends into JsonObjectLit AST entries', async () => {
    const { astNodeToMap } = await import('../../src/walk.mjs');
    const { parse } = await import('../../src/parse.mjs');
    const ast = parse('{"k": 1, "n": 2}');
    const m = astNodeToMap(ast);
    expect(m.get('qlang/kind').name).toBe('JsonObjectLit');
    expect(m.get('entries').length).toBe(2);
  });
});

describe('deepEqual cross-shape equivalences', () => {
  it('JsonObject equals Map with same entries', async () => {
    expect(await evalQuery('::json{:k 1 :n 2} | eq({:k 1 :n 2})')).toBe(true);
  });

  it('JsonObject differs from Map of different size', async () => {
    expect(await evalQuery('::json{:k 1} | eq({:k 1 :n 2})')).toBe(false);
  });

  it('JsonArray equals Vec with same elements', async () => {
    expect(await evalQuery('::json[1 2 3] | eq([1 2 3])')).toBe(true);
  });

  it('Map vs JsonObject — both directions structurally equal', async () => {
    expect(await evalQuery('{:k 1 :n 2} | eq(::json{:k 1 :n 2})')).toBe(true);
  });

  it('JsonObject vs JsonObject — same shape on both sides', async () => {
    expect(await evalQuery('::json{:k 1} | eq(::json{:k 1})')).toBe(true);
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
