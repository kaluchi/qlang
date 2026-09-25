// Unit tests for polymorphic filter / every / any over Vec / Set /
// Map, plus classification through `type | eq(:kind)`.
//
// A predicate is code applied to each element, a map's value being its
// element [D15]: a quote runs against the element as its subject, and
// so does a verb it names or a verb handed in its place [D67].
//
// Each per-site error class is asserted three ways per review
// discipline: class name, `instanceof QlangTypeError`, and structured
// context fields via the error-value descriptor.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { QlangTypeError } from '../../src/errors.mjs';
import { isQMap, isQSet, keyword, makeTagKeyword } from '../../src/types.mjs';
import {
  expectErrorThrown,
  expectOriginalError
} from '../helpers/error-assertions.mjs';

// ── Polymorphic filter over Vec/Set/Map ───────────────────────

describe('filter — container polymorphism', () => {
  it('Vec element predicate filters through subject-first comparator', async () => {
    expect(await evalQuery('[1 2 3 4 5] | filter ~(gt 2)')).toEqual([3, 4, 5]);
  });

  it('Vec field predicate on Map elements', async () => {
    const result = await evalQuery('[{:age 25} {:age 15} {:age 30}] | filter ~(/age | gte 18)');
    expect(result).toHaveLength(2);
    expect(result[0].get('age')).toBe(25);
    expect(result[1].get('age')).toBe(30);
  });

  it('Set element predicate — returns Set, preserves insertion order', async () => {
    const setResult = await evalQuery('#[1 2 3 4 5] | filter ~(gt 2)');
    expect(isQSet(setResult)).toBe(true);
    expect([...setResult].sort()).toEqual([3, 4, 5]);
  });

  it('Map with a quote predicate fires against value', async () => {
    const mapResult = await evalQuery('{:a 1 :b 2 :c 3} | filter ~(gt 1)');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get('b')).toBe(2);
    expect(mapResult.get('c')).toBe(3);
    expect(mapResult.has('a')).toBe(false);
  });

  it('Map with a declared verb predicate fires against value', async () => {
    const mapResult = await evalQuery(
      '{:a 1 :b 2 :c 3} | :big ::verb~(gt 1) | filter ~big'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
  });

  it('Map with a verb predicate reading a field of the value', async () => {
    const mapResult = await evalQuery(
      '{:a {:tier :a} :b {:tier :b} :c {:tier :x}} '
      + '| :tiered ::verb~(/tier | eq :x | not) '
      + '| filter ~tiered'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has('a')).toBe(true);
    expect(mapResult.has('b')).toBe(true);
    expect(mapResult.has('c')).toBe(false);
  });

  it('Map with an unresolved name for pred — surfaces on fail-track', async () => {
    const errorValue = await evalQuery('{:a 1} | filter ~(unknownPred) !| type');
    expect(errorValue).toEqual(makeTagKeyword('UnresolvedIdentifierError'));
  });

  it('Map with a value bound for pred — every entry passes', async () => {
    // The quote names a boolean, the value of its record, which
    // replaces the element — every entry survives.
    const count = await evalQuery('true | as :n | {:a 1 :b 2} | filter ~(n) | count');
    expect(count).toBe(2);
  });

  it('Map empty subject — returns empty Map', async () => {
    const mapResult = await evalQuery('{} | filter ~(gt 0)');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(0);
  });

  it('Map preserves insertion order of surviving entries', async () => {
    const mapResult = await evalQuery('{:c 3 :a 1 :b 2} | filter ~(gt 1)');
    const orderedKeys = [...mapResult.keys()];
    expect(orderedKeys).toEqual(['c', 'b']);
  });

  it('non-container subject lifts to FilterSubjectNotContainerError on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | filter ~(gt 0)', 'FilterSubjectNotContainerError');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('FilterSubjectNotContainerError');
    expect(originalErr.context.actualType.name).toBe('number');
  });

  it('Vec with a verb handed as the predicate', async () => {
    expect(await evalQuery('[1 -2 3] | filter ::verb~(gt 0)')).toEqual([1, 3]);
  });

  it('Set with a verb handed as the predicate', async () => {
    const setResult = await evalQuery('#[1 -2 3] | filter ::verb~(gt 0)');
    expect(isQSet(setResult)).toBe(true);
    expect([...setResult].sort()).toEqual([1, 3]);
  });

  it('Map with a verb handed as the predicate', async () => {
    const mapResult = await evalQuery('{:a 1 :b -2 :c 3} | filter ::verb~(gt 0)');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get('a')).toBe(1);
    expect(mapResult.get('c')).toBe(3);
  });
});

// ── Polymorphic every over Vec/Set/Map ────────────────────────

describe('every — container polymorphism', () => {
  it('Vec all-match', async () => {
    expect(await evalQuery('[2 4 6] | every ~(gt 0)')).toBe(true);
  });

  it('Vec some-fail', async () => {
    expect(await evalQuery('[1 2 3] | every ~(gt 2)')).toBe(false);
  });

  it('Set all-match', async () => {
    expect(await evalQuery('#[2 4 6] | every ~(gt 0)')).toBe(true);
  });

  it('Set some-fail', async () => {
    expect(await evalQuery('#[1 2 3] | every ~(gt 2)')).toBe(false);
  });

  it('Map — all values positive', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | every ~(gt 0)')).toBe(true);
  });

  it('Map — one value fails', async () => {
    expect(await evalQuery('{:a 1 :b -2 :c 3} | every ~(gt 0)')).toBe(false);
  });

  it('Map empty — vacuously true', async () => {
    expect(await evalQuery('{} | every ~(gt 0)')).toBe(true);
  });

  it('non-container subject lifts to EverySubjectNotContainerError on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | every ~(gt 0)', 'EverySubjectNotContainerError');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('EverySubjectNotContainerError');
  });

  it('Vec with a declared verb predicate', async () => {
    expect(await evalQuery('[1 2 3] | :positive ::verb~(gt 0) | every ~positive')).toBe(true);
    expect(await evalQuery('[1 -2 3] | :positive ::verb~(gt 0) | every ~positive')).toBe(false);
  });

  it('Set with a verb handed as the predicate', async () => {
    expect(await evalQuery('#[2 4 6] | every ::verb~(gt 0)')).toBe(true);
  });

  it('Map with a declared verb predicate', async () => {
    expect(await evalQuery('{:a 1 :b 2} | :positive ::verb~(gt 0) | every ~positive')).toBe(true);
    expect(await evalQuery('{:a 1 :b -2} | :positive ::verb~(gt 0) | every ~positive')).toBe(false);
  });
});

// ── Polymorphic any over Vec/Set/Map ──────────────────────────

describe('any — container polymorphism', () => {
  it('Vec one-matches', async () => {
    expect(await evalQuery('[1 2 3] | any ~(gt 2)')).toBe(true);
  });

  it('Vec none-match', async () => {
    expect(await evalQuery('[1 2 3] | any ~(gt 99)')).toBe(false);
  });

  it('Set one-matches', async () => {
    expect(await evalQuery('#[1 2 3] | any ~(gt 2)')).toBe(true);
  });

  it('Map — any value positive', async () => {
    expect(await evalQuery('{:a -1 :b 0 :c 2} | any ~(gt 0)')).toBe(true);
  });

  it('Map empty — vacuously false', async () => {
    expect(await evalQuery('{} | any ~(gt 0)')).toBe(false);
  });

  it('non-container subject lifts to AnySubjectNotContainerError on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | any ~(gt 0)', 'AnySubjectNotContainerError');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('AnySubjectNotContainerError');
  });
});

// ── Type classifiers ──────────────────────────────────────────

describe('classification through `type | eq(:kind)` — string / number / vec / map / set / keyword / boolean / null', () => {
  it('type answers :string for String subjects', async () => {
    expect(await evalQuery('"hello" | type | eq ::string')).toBe(true);
    expect(await evalQuery('42 | type | eq ::string')).toBe(false);
    expect(await evalQuery(':name | type | eq ::string')).toBe(false);
    expect(await evalQuery('[1] | type | eq ::string')).toBe(false);
  });

  it('type answers :number for Number subjects', async () => {
    expect(await evalQuery('42 | type | eq ::number')).toBe(true);
    expect(await evalQuery('3.14 | type | eq ::number')).toBe(true);
    expect(await evalQuery('"42" | type | eq ::number')).toBe(false);
    expect(await evalQuery('null | type | eq ::number')).toBe(false);
  });

  it('type answers :vec for Vec subjects', async () => {
    expect(await evalQuery('[1 2 3] | type | eq ::vec')).toBe(true);
    expect(await evalQuery('[] | type | eq ::vec')).toBe(true);
    expect(await evalQuery('#[1] | type | eq ::vec')).toBe(false);
    expect(await evalQuery('{:a 1} | type | eq ::vec')).toBe(false);
  });

  it('type answers :map for Map subjects', async () => {
    expect(await evalQuery('{:a 1} | type | eq ::map')).toBe(true);
    expect(await evalQuery('{} | type | eq ::map')).toBe(true);
    expect(await evalQuery('[] | type | eq ::map')).toBe(false);
    expect(await evalQuery('#[:a] | type | eq ::map')).toBe(false);
  });

  it('type answers ::binding, not :map, for the record of a verb', async () => {
    expect(await evalQuery(':double ::verb~(mul 2) | env | /double | type | eq ::map')).toBe(false);
    expect(await evalQuery(':double ::verb~(mul 2) | env | /double | type | eq ::binding')).toBe(true);
  });

  it('type answers ::set for Set subjects', async () => {
    expect(await evalQuery('#[1 2] | type | eq ::set')).toBe(true);
    expect(await evalQuery('#[] | type | eq ::set')).toBe(true);
    expect(await evalQuery('[1 2] | type | eq ::set')).toBe(false);
    expect(await evalQuery('{:a 1} | type | eq ::set')).toBe(false);
  });

  it('type answers :keyword for bare and namespaced keywords', async () => {
    expect(await evalQuery(':name | type | eq ::keyword')).toBe(true);
    expect(await evalQuery(':kind | type | eq ::keyword')).toBe(true);
    expect(await evalQuery('"name" | type | eq ::keyword')).toBe(false);
    expect(await evalQuery('42 | type | eq ::keyword')).toBe(false);
  });

  it('type answers :boolean for the literals alone', async () => {
    expect(await evalQuery('true | type | eq ::boolean')).toBe(true);
    expect(await evalQuery('false | type | eq ::boolean')).toBe(true);
    expect(await evalQuery('0 | type | eq ::boolean')).toBe(false);
    expect(await evalQuery('null | type | eq ::boolean')).toBe(false);
    expect(await evalQuery('"" | type | eq ::boolean')).toBe(false);
  });

  it('type answers :null for null alone', async () => {
    expect(await evalQuery('null | type | eq ::null')).toBe(true);
    // A Map entry whose value is the explicit `null` is the only
    // post-strict-projection path to null-via-projection. A missing
    // key now errors (::ProjectionKeyNotInMapError) instead of silently
    // returning null.
    expect(await evalQuery('{:nothing null} | /nothing | type | eq ::null')).toBe(true);
    expect(await evalQuery('0 | type | eq ::null')).toBe(false);
    expect(await evalQuery('"" | type | eq ::null')).toBe(false);
    expect(await evalQuery('false | type | eq ::null')).toBe(false);
  });
});

// ── Integration — filter with type classifiers over Map ──────

describe('filter + type classifiers integration', () => {
  it('filter(type | eq(:string)) over Map keeps only String-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossTerm "..." :GlossDef {:para "..."} :Count 42} | filter ~(type | eq ::string)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has('ID')).toBe(true);
    expect(mapResult.has('GlossTerm')).toBe(true);
    expect(mapResult.has('GlossDef')).toBe(false);
    expect(mapResult.has('Count')).toBe(false);
  });

  it('filter(type | eq(:map)) over Map keeps only Map-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossDef {:para "..."}} | filter ~(type | eq ::map)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.has('GlossDef')).toBe(true);
  });
});

// ── Verb portability — same pred works on Vec and on Map ──

describe('filter — verb portability across containers', () => {
  it('a declared verb fires uniformly on Vec elements and Map values', async () => {
    const vecResult = await evalQuery(
      ':big ::verb~(gt 1) | [1 2 3] | filter ~big'
    );
    expect(vecResult).toEqual([2, 3]);

    const mapResult = await evalQuery(
      ':big ::verb~(gt 1) | {:a 1 :b 2 :c 3} | filter ~big'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get('b')).toBe(2);
    expect(mapResult.get('c')).toBe(3);
  });
});

// ── Error-value propagation from predicate, per container branch ─

describe('filter/every/any — predicate returning error value propagates on fail-track', () => {
  it('filter over Set — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('#[1 2] | filter ~(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('filter over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1 :b 2} | filter ~(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('every over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1} | every ~(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('any over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1} | any ~(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });
});
