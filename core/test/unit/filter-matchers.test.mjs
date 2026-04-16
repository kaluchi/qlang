// Unit tests for polymorphic filter/every/any over Vec/Set/Map
// plus the byKey/byValue entry matchers, kwName, and the
// type-classifier nullary operands.
//
// Each per-site error class is asserted three ways per review
// discipline: class name, `instanceof QlangTypeError`, and
// structured context fields via the error-value descriptor.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { QlangTypeError } from '../../src/errors.mjs';
import { isErrorValue, isQMap, isQSet, isVec, keyword } from '../../src/types.mjs';
import {
  expectErrorKind,
  expectErrorThrown,
  expectOriginalError
} from '../helpers/error-assertions.mjs';

// ── Polymorphic filter over Vec/Set/Map ───────────────────────

describe('filter — container polymorphism', () => {
  it('Vec element predicate works as before', async () => {
    expect(await evalQuery('[1 2 3 4 5] | filter(gt(2))')).toEqual([3, 4, 5]);
  });

  it('Vec field predicate on Map elements', async () => {
    const result = await evalQuery('[{:age 25} {:age 15} {:age 30}] | filter(/age | gte(18))');
    expect(result).toHaveLength(2);
    expect(result[0].get(keyword('age'))).toBe(25);
    expect(result[1].get(keyword('age'))).toBe(30);
  });

  it('Set element predicate — returns Set, preserves insertion order', async () => {
    const setResult = await evalQuery('#{1 2 3 4 5} | filter(gt(2))');
    expect(isQSet(setResult)).toBe(true);
    expect([...setResult].sort()).toEqual([3, 4, 5]);
  });

  it('Map value-axis filter via byValue', async () => {
    const mapResult = await evalQuery('{:a 1 :b 2 :c 3} | filter(byValue(gt(1)))');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get(keyword('b'))).toBe(2);
    expect(mapResult.get(keyword('c'))).toBe(3);
    expect(mapResult.has(keyword('a'))).toBe(false);
  });

  it('Map key-axis filter via byKey + kwName + startsWith', async () => {
    const mapResult = await evalQuery(
      '{:apple 1 :banana 2 :cherry 3} | filter(byKey(kwName | startsWith("a")))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('apple'))).toBe(1);
  });

  it('Map compound key+value predicate via and(byKey, byValue)', async () => {
    const mapResult = await evalQuery(
      '{:apple 1 :banana 2 :avocado 3} | filter(and(byKey(kwName | startsWith("a")), byValue(gt(1))))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('avocado'))).toBe(3);
  });

  it('Map empty subject — returns empty Map', async () => {
    const mapResult = await evalQuery('{} | filter(byValue(gt(0)))');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(0);
  });

  it('Map preserves insertion order of surviving entries', async () => {
    const mapResult = await evalQuery('{:c 3 :a 1 :b 2} | filter(byValue(gt(1)))');
    const orderedKeys = [...mapResult.keys()].map(k => k.name);
    expect(orderedKeys).toEqual(['c', 'b']);
  });

  it('non-container subject lifts to FilterSubjectNotContainer on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | filter(gt(0))', 'FilterSubjectNotContainer');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('FilterSubjectNotContainer');
    expect(originalErr.context.operand).toBe('filter');
    expect(originalErr.context.position).toBe('subject');
    expect(originalErr.context.expectedType).toBe('Vec, Set, or Map');
    expect(originalErr.context.actualType).toBe('Number');
  });
});

// ── Polymorphic every over Vec/Set/Map ────────────────────────

describe('every — container polymorphism', () => {
  it('Vec all-match', async () => {
    expect(await evalQuery('[2 4 6] | every(gt(0))')).toBe(true);
  });

  it('Vec some-fail', async () => {
    expect(await evalQuery('[1 2 3] | every(gt(2))')).toBe(false);
  });

  it('Set all-match', async () => {
    expect(await evalQuery('#{2 4 6} | every(gt(0))')).toBe(true);
  });

  it('Set some-fail', async () => {
    expect(await evalQuery('#{1 2 3} | every(gt(2))')).toBe(false);
  });

  it('Map all-values-positive via byValue', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | every(byValue(gt(0)))')).toBe(true);
  });

  it('Map some-value-fails via byValue', async () => {
    expect(await evalQuery('{:a 1 :b -2 :c 3} | every(byValue(gt(0)))')).toBe(false);
  });

  it('Map empty — vacuously true', async () => {
    expect(await evalQuery('{} | every(byValue(gt(0)))')).toBe(true);
  });

  it('non-container subject lifts to EverySubjectNotContainer on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | every(gt(0))', 'EverySubjectNotContainer');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('EverySubjectNotContainer');
    expect(originalErr.context.operand).toBe('every');
    expect(originalErr.context.expectedType).toBe('Vec, Set, or Map');
  });
});

// ── Polymorphic any over Vec/Set/Map ──────────────────────────

describe('any — container polymorphism', () => {
  it('Vec one-matches', async () => {
    expect(await evalQuery('[1 2 3] | any(gt(2))')).toBe(true);
  });

  it('Vec none-match', async () => {
    expect(await evalQuery('[1 2 3] | any(gt(99))')).toBe(false);
  });

  it('Set one-matches', async () => {
    expect(await evalQuery('#{1 2 3} | any(gt(2))')).toBe(true);
  });

  it('Map any-value-matches via byValue', async () => {
    expect(await evalQuery('{:a -1 :b 0 :c 2} | any(byValue(gt(0)))')).toBe(true);
  });

  it('Map any-key-matches via byKey + kwName + startsWith', async () => {
    expect(await evalQuery('{:apple 1 :banana 2} | any(byKey(kwName | startsWith("a")))')).toBe(true);
  });

  it('Map empty — vacuously false', async () => {
    expect(await evalQuery('{} | any(byValue(gt(0)))')).toBe(false);
  });

  it('non-container subject lifts to AnySubjectNotContainer on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | any(gt(0))', 'AnySubjectNotContainer');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('AnySubjectNotContainer');
    expect(originalErr.context.operand).toBe('any');
    expect(originalErr.context.expectedType).toBe('Vec, Set, or Map');
  });
});

// ── byKey / byValue matchers — guard classes ──────────────────

describe('byKey — matcher guard sites', () => {
  it('non-Map subject lifts to ByKeySubjectNotMap', async () => {
    const errorValue = await expectErrorThrown('42 | byKey(kwName)', 'ByKeySubjectNotMap');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('ByKeySubjectNotMap');
    expect(originalErr.context.operand).toBe('byKey');
    expect(originalErr.context.actualType).toBe('Number');
  });

  it('user Map lacking :qlang/key lifts to ByKeyMapNotFilterPair', async () => {
    // Invoking byKey directly on a user Map — NOT via a filter
    // dispatch — fires the second guard because the namespaced
    // :qlang/key field is absent.
    const errorValue = await expectErrorThrown(
      '{:a 1 :b 2} | byKey(kwName)',
      'ByKeyMapNotFilterPair'
    );
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('ByKeyMapNotFilterPair');
    expect(originalErr.context.actualKeys).toContain(':a');
    expect(originalErr.context.actualKeys).toContain(':b');
  });

  it('empty Map subject renders `(empty Map)` in the diagnostic', async () => {
    const errorValue = await expectErrorThrown(
      '{} | byKey(kwName)',
      'ByKeyMapNotFilterPair'
    );
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.context.actualKeys).toBe('(empty Map)');
  });
});

describe('byValue — matcher guard sites', () => {
  it('non-Map subject lifts to ByValueSubjectNotMap', async () => {
    const errorValue = await expectErrorThrown('42 | byValue(gt(0))', 'ByValueSubjectNotMap');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('ByValueSubjectNotMap');
    expect(originalErr.context.operand).toBe('byValue');
    expect(originalErr.context.actualType).toBe('Number');
  });

  it('user Map lacking :qlang/value lifts to ByValueMapNotFilterPair', async () => {
    const errorValue = await expectErrorThrown(
      '{:a 1 :b 2} | byValue(gt(0))',
      'ByValueMapNotFilterPair'
    );
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('ByValueMapNotFilterPair');
    expect(originalErr.context.actualKeys).toContain(':a');
  });
});

// ── kwName ────────────────────────────────────────────────────

describe('kwName — Keyword to String', () => {
  it('bare keyword', async () => {
    expect(await evalQuery(':foo | kwName')).toBe('foo');
  });

  it('namespaced keyword', async () => {
    expect(await evalQuery(':qlang/prim/add | kwName')).toBe('qlang/prim/add');
  });

  it('quoted keyword with arbitrary characters', async () => {
    expect(await evalQuery(':"foo bar" | kwName')).toBe('foo bar');
  });

  it('non-keyword subject lifts to KwNameSubjectNotKeyword', async () => {
    const errorValue = await expectErrorThrown('"foo" | kwName', 'KwNameSubjectNotKeyword');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('KwNameSubjectNotKeyword');
    expect(originalErr.context.operand).toBe('kwName');
    expect(originalErr.context.expectedType).toBe('Keyword');
    expect(originalErr.context.actualType).toBe('String');
  });
});

// ── Type classifiers ──────────────────────────────────────────

describe('type classifiers — isString / isNumber / isVec / isMap / isSet / isKeyword / isBoolean / isNull', () => {
  it('isString classifies String vs the rest', async () => {
    expect(await evalQuery('"hello" | isString')).toBe(true);
    expect(await evalQuery('42 | isString')).toBe(false);
    expect(await evalQuery(':name | isString')).toBe(false);
    expect(await evalQuery('[1] | isString')).toBe(false);
  });

  it('isNumber classifies Number vs the rest', async () => {
    expect(await evalQuery('42 | isNumber')).toBe(true);
    expect(await evalQuery('3.14 | isNumber')).toBe(true);
    expect(await evalQuery('"42" | isNumber')).toBe(false);
    expect(await evalQuery('null | isNumber')).toBe(false);
  });

  it('isVec classifies Vec vs Set and the rest', async () => {
    expect(await evalQuery('[1 2 3] | isVec')).toBe(true);
    expect(await evalQuery('[] | isVec')).toBe(true);
    expect(await evalQuery('#{1} | isVec')).toBe(false);
    expect(await evalQuery('{:a 1} | isVec')).toBe(false);
  });

  it('isMap classifies Map vs the rest', async () => {
    expect(await evalQuery('{:a 1} | isMap')).toBe(true);
    expect(await evalQuery('{} | isMap')).toBe(true);
    expect(await evalQuery('[] | isMap')).toBe(false);
    expect(await evalQuery('#{:a} | isMap')).toBe(false);
  });

  it('isSet classifies Set vs the rest', async () => {
    expect(await evalQuery('#{1 2} | isSet')).toBe(true);
    expect(await evalQuery('#{} | isSet')).toBe(true);
    expect(await evalQuery('[1 2] | isSet')).toBe(false);
    expect(await evalQuery('{:a 1} | isSet')).toBe(false);
  });

  it('isKeyword classifies bare and namespaced keywords', async () => {
    expect(await evalQuery(':name | isKeyword')).toBe(true);
    expect(await evalQuery(':qlang/kind | isKeyword')).toBe(true);
    expect(await evalQuery('"name" | isKeyword')).toBe(false);
    expect(await evalQuery('42 | isKeyword')).toBe(false);
  });

  it('isBoolean classifies literal true/false only', async () => {
    expect(await evalQuery('true | isBoolean')).toBe(true);
    expect(await evalQuery('false | isBoolean')).toBe(true);
    expect(await evalQuery('0 | isBoolean')).toBe(false);
    expect(await evalQuery('null | isBoolean')).toBe(false);
    expect(await evalQuery('"" | isBoolean')).toBe(false);
  });

  it('isNull classifies null vs the rest', async () => {
    expect(await evalQuery('null | isNull')).toBe(true);
    expect(await evalQuery('{} | /missing | isNull')).toBe(true);
    expect(await evalQuery('0 | isNull')).toBe(false);
    expect(await evalQuery('"" | isNull')).toBe(false);
    expect(await evalQuery('false | isNull')).toBe(false);
  });
});

// ── Integration — filter with type classifiers over Map ──────

describe('filter + type classifiers integration', () => {
  // Mirrors the glossary-JSON use cases from the design
  // discussion: separate scalar-valued entries from Map-valued
  // entries inside a heterogeneous Map.

  it('byValue(isString) keeps only String-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossTerm "..." :GlossDef {:para "..."} :Count 42} | filter(byValue(isString))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has(keyword('ID'))).toBe(true);
    expect(mapResult.has(keyword('GlossTerm'))).toBe(true);
    expect(mapResult.has(keyword('GlossDef'))).toBe(false);
    expect(mapResult.has(keyword('Count'))).toBe(false);
  });

  it('byValue(isMap) keeps only Map-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossDef {:para "..."}} | filter(byValue(isMap))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.has(keyword('GlossDef'))).toBe(true);
  });

  it('byValue(isString | not) keeps composite-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossDef {:para "..."}} | filter(byValue(isString | not))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.has(keyword('GlossDef'))).toBe(true);
  });
});

// ── Integration — correlation via raw namespaced access (escape hatch) ──

describe('filter + raw pair-Map access — correlation escape hatch', () => {
  it('full-app predicate over both axes via /:qlang/key and /:qlang/value', async () => {
    // "keep entries where value's :name matches the key's name"
    // The pair-Map is namespaced to avoid collision with user
    // domain keys; raw projection through /:qlang/key / /:qlang/value
    // is the escape hatch for correlation predicates that matchers
    // alone cannot express. Note: the namespaced keyword-segment
    // parser is greedy on `/` separators, so the descent into the
    // inner Map-value's :name field must sit after an explicit
    // pipeline break — `/:qlang/value | /name` reads as "project
    // :qlang/value, then project :name from that result".
    const mapResult = await evalQuery(
      '{:alice {:name "alice"} :bob {:name "eve"} :carol {:name "carol"}} '
      + '| filter(eq(/:qlang/key | kwName, /:qlang/value | /name))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has(keyword('alice'))).toBe(true);
    expect(mapResult.has(keyword('carol'))).toBe(true);
    expect(mapResult.has(keyword('bob'))).toBe(false);
  });
});

// ── Error-value propagation from predicate, per container branch ─

describe('filter/every/any — predicate returning error value propagates on fail-track', () => {
  // When the predicate lambda itself yields an error value (e.g.
  // the pred body is an ErrorLit, or an inner projection raises),
  // the enclosing container operand short-circuits and returns the
  // error value as its own pipeValue — subsequent success-track
  // combinators deflect, !| fires against the materialized
  // descriptor. Each container branch (Vec / Set / Map) owns the
  // same propagation rule.

  it('filter over Set — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('#{1 2} | filter(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('filter over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1 :b 2} | filter(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('every over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1} | every(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });

  it('any over Map — predicate ErrorLit propagates', async () => {
    const errorValue = await evalQuery('{:a 1} | any(!{:kind :pred-failed}) !| /kind');
    expect(errorValue).toEqual(keyword('pred-failed'));
  });
});

// ── Collision safety — user domain keys :key / :value do not confuse matchers ──

describe('filter over Map with user domain keys :key / :value', () => {
  it('a user Map with :key / :value as domain keys still filters cleanly', async () => {
    // The namespaced pair-Map uses :qlang/key / :qlang/value so
    // user domain keys called :key / :value never collide with
    // the matcher's projection axes.
    const mapResult = await evalQuery(
      '{:key :superKey :value "vee" :other 42} | filter(byValue(isString))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('value'))).toBe('vee');
  });

  it('byKey reaches the domain key :key without confusion', async () => {
    // Every entry's KEY flows through byKey: the entry whose
    // domain key IS the keyword :key lands under :qlang/key in
    // the pair-Map, byKey projects through the namespace, inner
    // pred compares it to the literal keyword :key.
    const mapResult = await evalQuery(
      '{:key :superKey :value "vee" :other 42} | filter(byKey(eq(:key)))'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('key'))).toEqual(keyword('superKey'));
  });
});
