// Unit tests for polymorphic filter / every / any over Vec / Set /
// Map with N-arity conduit dispatch on Map, plus the type-classifier
// nullary operands.
//
// Map dispatch rule under test: the predicate conduit's `:params`
// arity chooses the axis — 0 or 1 → value as pipeValue, 2 → (key,
// value) as captured-arg values, 3+ → per-operand ArityInvalid error.
//
// Each per-site error class is asserted three ways per review
// discipline: class name, `instanceof QlangTypeError` or
// `instanceof ArityError`, and structured context fields via
// the error-value descriptor.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { QlangTypeError, ArityError } from '../../src/errors.mjs';
import { isQMap, isQSet, keyword } from '../../src/types.mjs';
import {
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

  it('Map with 0-arity pipeline predicate fires against value', async () => {
    const mapResult = await evalQuery('{:a 1 :b 2 :c 3} | filter(gt(1))');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get(keyword('b'))).toBe(2);
    expect(mapResult.get(keyword('c'))).toBe(3);
    expect(mapResult.has(keyword('a'))).toBe(false);
  });

  it('Map with 0-arity named conduit predicate fires against value', async () => {
    const mapResult = await evalQuery(
      '{:a 1 :b 2 :c 3} | let(:big, gt(1)) | filter(big)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
  });

  it('Map with 2-arity conduit — key axis', async () => {
    const mapResult = await evalQuery(
      '{:apple 1 :banana 2 :avocado 3} | let(:@isA, [:k :v], k | eq(:apple)) | filter(@isA)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('apple'))).toBe(1);
  });

  it('Map with 2-arity conduit — compound key and value', async () => {
    const mapResult = await evalQuery(
      '{:apple 1 :banana 2 :avocado 3} | let(:@hot, [:k :v], and(k | eq(:avocado), v | gt(1))) | filter(@hot)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.get(keyword('avocado'))).toBe(3);
  });

  it('Map with 2-arity conduit — correlation (k ↔ v inspection)', async () => {
    // Clean-named conduit — exercises the non-effectful dispatch branch
    // of invokeConduitWithFixedArgs (conduitEffectful=false).
    const mapResult = await evalQuery(
      '{:a {:tier :a} :b {:tier :b} :c {:tier :x}} '
      + '| let(:selfTiered, [:k :v], eq(k, v | /tier)) '
      + '| filter(selfTiered)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has(keyword('a'))).toBe(true);
    expect(mapResult.has(keyword('b'))).toBe(true);
    expect(mapResult.has(keyword('c'))).toBe(false);
  });

  it('Map with unresolved-identifier pred — falls to per-value path, surfaces on fail-track', async () => {
    // Exercises the envHas=false branch of resolveCapturedConduit:
    // the captured-arg identifier is not in env, so conduit resolution
    // returns null and the per-value predLambda path runs; the lookup
    // error then surfaces on the fail-track.
    const errorValue = await evalQuery('{:a 1} | filter(unknownPred) !| /thrown');
    expect(errorValue).toEqual(keyword('UnresolvedIdentifierError'));
  });

  it('Map with non-conduit snapshot as pred — falls to per-value path, all entries pass', async () => {
    // Exercises the non-Map branch of resolveCapturedConduit: the
    // captured-arg resolves to a number (through snapshot auto-unwrap),
    // so conduit resolution returns null. The per-value path then fires
    // the predicate identifier per entry, which replaces pipeValue with
    // the truthy number — all entries survive.
    const count = await evalQuery('42 | as(:n) | {:a 1 :b 2} | filter(n) | count');
    expect(count).toBe(2);
  });

  it('Map with effectful 2-arity conduit reached via clean name → EffectLaunderingAtCall', async () => {
    // An @-named (effectful) conduit extracted through env projection and
    // snapshotted under a clean name is then referenced inside filter.
    // invokeConduitWithFixedArgs must refuse the clean-name invocation
    // with EffectLaunderingAtCall — the same safety net applyConduit
    // enforces for ordinary conduit calls.
    const errorValue = await evalQuery(
      'let(:@hot, [:k :v], v | gt(0)) '
      + '| env | /@hot | as(:clean) '
      + '| {:a 1 :b 2} | filter(clean) !| /thrown'
    );
    expect(errorValue).toEqual(keyword('EffectLaunderingAtCall'));
  });

  it('Map empty subject — returns empty Map for 0-arity pred', async () => {
    const mapResult = await evalQuery('{} | filter(gt(0))');
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(0);
  });

  it('Map empty subject — returns empty Map for 2-arity pred', async () => {
    const mapResult = await evalQuery(
      '{} | let(:@never, [:k :v], false) | filter(@never)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(0);
  });

  it('Map preserves insertion order of surviving entries', async () => {
    const mapResult = await evalQuery('{:c 3 :a 1 :b 2} | filter(gt(1))');
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

  it('Map with 3-arity conduit — FilterMapPredArityInvalid', async () => {
    const errorValue = await expectErrorThrown(
      '{:a 1} | let(:@tooWide, [:x :y :z], true) | filter(@tooWide)',
      'FilterMapPredArityInvalid'
    );
    const originalErr = expectOriginalError(errorValue, ArityError);
    expect(originalErr.name).toBe('FilterMapPredArityInvalid');
    expect(originalErr.context.conduitName).toBe('@tooWide');
    expect(originalErr.context.actualArity).toBe(3);
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

  it('Map 0-arity — all values positive', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | every(gt(0))')).toBe(true);
  });

  it('Map 0-arity — one value fails', async () => {
    expect(await evalQuery('{:a 1 :b -2 :c 3} | every(gt(0))')).toBe(false);
  });

  it('Map 2-arity conduit — both axes satisfied', async () => {
    expect(await evalQuery(
      '{:a 1 :b 2} | let(:@bothOk, [:k :v], and(v | gt(0), k | isKeyword)) | every(@bothOk)'
    )).toBe(true);
  });

  it('Map 2-arity conduit — one entry fails', async () => {
    expect(await evalQuery(
      '{:a 1 :b -2} | let(:@bothOk, [:k :v], v | gt(0)) | every(@bothOk)'
    )).toBe(false);
  });

  it('Map empty — vacuously true', async () => {
    expect(await evalQuery('{} | every(gt(0))')).toBe(true);
  });

  it('non-container subject lifts to EverySubjectNotContainer on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | every(gt(0))', 'EverySubjectNotContainer');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('EverySubjectNotContainer');
    expect(originalErr.context.operand).toBe('every');
    expect(originalErr.context.expectedType).toBe('Vec, Set, or Map');
  });

  it('Map with 3-arity conduit — EveryMapPredArityInvalid', async () => {
    const errorValue = await expectErrorThrown(
      '{:a 1} | let(:@tooWide, [:x :y :z], true) | every(@tooWide)',
      'EveryMapPredArityInvalid'
    );
    const originalErr = expectOriginalError(errorValue, ArityError);
    expect(originalErr.context.conduitName).toBe('@tooWide');
    expect(originalErr.context.actualArity).toBe(3);
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

  it('Map 0-arity — any value positive', async () => {
    expect(await evalQuery('{:a -1 :b 0 :c 2} | any(gt(0))')).toBe(true);
  });

  it('Map 2-arity conduit — any entry by key', async () => {
    expect(await evalQuery(
      '{:apple 1 :banana 2} | let(:@isApple, [:k :v], k | eq(:apple)) | any(@isApple)'
    )).toBe(true);
  });

  it('Map empty — vacuously false', async () => {
    expect(await evalQuery('{} | any(gt(0))')).toBe(false);
  });

  it('non-container subject lifts to AnySubjectNotContainer on fail-track', async () => {
    const errorValue = await expectErrorThrown('42 | any(gt(0))', 'AnySubjectNotContainer');
    const originalErr = expectOriginalError(errorValue, QlangTypeError);
    expect(originalErr.name).toBe('AnySubjectNotContainer');
    expect(originalErr.context.operand).toBe('any');
  });

  it('Map with 3-arity conduit — AnyMapPredArityInvalid', async () => {
    const errorValue = await expectErrorThrown(
      '{:a 1} | let(:@tooWide, [:x :y :z], true) | any(@tooWide)',
      'AnyMapPredArityInvalid'
    );
    const originalErr = expectOriginalError(errorValue, ArityError);
    expect(originalErr.context.conduitName).toBe('@tooWide');
    expect(originalErr.context.actualArity).toBe(3);
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

  it('isMap reports false for conduit descriptor Maps', async () => {
    expect(await evalQuery('let(:double, mul(2)) | env | /double | isMap')).toBe(false);
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
  it('filter(isString) over Map keeps only String-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossTerm "..." :GlossDef {:para "..."} :Count 42} | filter(isString)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.has(keyword('ID'))).toBe(true);
    expect(mapResult.has(keyword('GlossTerm'))).toBe(true);
    expect(mapResult.has(keyword('GlossDef'))).toBe(false);
    expect(mapResult.has(keyword('Count'))).toBe(false);
  });

  it('filter(isMap) over Map keeps only Map-valued entries', async () => {
    const mapResult = await evalQuery(
      '{:ID "SGML" :GlossDef {:para "..."}} | filter(isMap)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(1);
    expect(mapResult.has(keyword('GlossDef'))).toBe(true);
  });
});

// ── Conduit portability — same pred works on Vec and on Map ──

describe('filter — conduit portability across containers', () => {
  it('0-arity conduit fires uniformly on Vec elements and Map values', async () => {
    const vecResult = await evalQuery(
      'let(:big, gt(1)) | [1 2 3] | filter(big)'
    );
    expect(vecResult).toEqual([2, 3]);

    const mapResult = await evalQuery(
      'let(:big, gt(1)) | {:a 1 :b 2 :c 3} | filter(big)'
    );
    expect(isQMap(mapResult)).toBe(true);
    expect(mapResult.size).toBe(2);
    expect(mapResult.get(keyword('b'))).toBe(2);
    expect(mapResult.get(keyword('c'))).toBe(3);
  });
});

// ── Error-value propagation from predicate, per container branch ─

describe('filter/every/any — predicate returning error value propagates on fail-track', () => {
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
