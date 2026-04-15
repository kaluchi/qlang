// Tests for error value type, trail, deepEqual, codec, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import {
  keyword, isErrorValue, makeErrorValue, appendTrailNode, materializeTrail, describeType
} from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { toTaggedJSON, fromTaggedJSON } from '../../src/codec.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { QlangTypeError, UnresolvedIdentifierError, DivisionByZeroError } from '../../src/errors.mjs';

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces frozen error object with :trail invariant', () => {
    // makeErrorValue enforces the invariant that every error
    // descriptor carries :trail as a Vec — so the descriptor
    // returned on the wrapper is a fresh Map, not the caller's
    // original input, when the input lacked :trail.
    const descriptor = new Map([[keyword('kind'), keyword('oops')]]);
    const errorVal = makeErrorValue(descriptor);
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.type).toBe('error');
    expect(errorVal.descriptor.get(keyword('kind'))).toEqual(keyword('oops'));
    expect(errorVal.descriptor.get(keyword('trail'))).toEqual([]);
  });

  it('preserves caller-supplied :trail in descriptor', () => {
    // When the caller already includes :trail in the descriptor
    // — for example a re-lifted descriptor that carries a trail
    // from an earlier fail-apply materialization, or a user literal
    // `!{:trail [...]}` — makeErrorValue keeps the supplied Vec
    // untouched and skips the invariant-fill branch.
    const preTrail = ['phase-1', 'phase-2'];
    const descriptor = new Map([
      [keyword('kind'), keyword('oops')],
      [keyword('trail'), preTrail]
    ]);
    const errorVal = makeErrorValue(descriptor);
    expect(errorVal.descriptor).toBe(descriptor);
    expect(errorVal.descriptor.get(keyword('trail'))).toBe(preTrail);
  });
});

// ── describeType ────────────────────────────────────────────────

describe('describeType for error values', () => {
  it('returns "Error" for error values', () => {
    const errorVal = makeErrorValue(new Map());
    expect(describeType(errorVal)).toBe('Error');
  });
});

// ── trail (appendTrailNode / materializeTrail) ──────────────────

describe('trail', () => {
  it('appendTrailNode stores entries verbatim in a linked list', () => {
    // Under the structured-trail design, appendTrailNode accepts any
    // qlang value as a trail entry and stores it verbatim — the
    // eval.mjs callsites pass Maps produced by walk.mjs::astNodeToMap,
    // but the value-class module stays agnostic about shape.
    const trailEntry1 = new Map([
      [keyword('qlang/kind'), keyword('OperandCall')],
      [keyword('name'), 'count'],
      [keyword('text'), 'count']
    ]);
    const errorVal0 = makeErrorValue(new Map());
    const errorVal1 = appendTrailNode(errorVal0, trailEntry1);
    expect(Object.isFrozen(errorVal1)).toBe(true);
    expect(errorVal1._trailHead.entry).toBe(trailEntry1);
    expect(errorVal1._trailHead.prev).toBeNull();

    const trailEntry2 = new Map([
      [keyword('qlang/kind'), keyword('OperandCall')],
      [keyword('name'), 'filter'],
      [keyword('text'), 'filter(gt(2))']
    ]);
    const errorVal2 = appendTrailNode(errorVal1, trailEntry2);
    expect(errorVal2._trailHead.entry).toBe(trailEntry2);
    expect(errorVal2._trailHead.prev.entry).toBe(trailEntry1);
  });

  it('materializeTrail returns chronological Vec of entries', () => {
    const firstEntry  = new Map([[keyword('text'), 'first']]);
    const secondEntry = new Map([[keyword('text'), 'second']]);
    const thirdEntry  = new Map([[keyword('text'), 'third']]);
    const errorVal0 = makeErrorValue(new Map());
    const errorVal1 = appendTrailNode(errorVal0, firstEntry);
    const errorVal2 = appendTrailNode(errorVal1, secondEntry);
    const errorVal3 = appendTrailNode(errorVal2, thirdEntry);
    const trail = materializeTrail(errorVal3);
    expect(trail).toHaveLength(3);
    expect(trail[0]).toBe(firstEntry);
    expect(trail[1]).toBe(secondEntry);
    expect(trail[2]).toBe(thirdEntry);
  });

  it('materializeTrail on fresh error returns empty', () => {
    const errorVal = makeErrorValue(new Map());
    expect(materializeTrail(errorVal)).toEqual([]);
  });

  it('stores non-Map entries unchanged — shape-agnostic storage', () => {
    // While the production caller passes AST-Maps, types.mjs is not
    // a validator; any qlang value (string, Vec, Scalar) round-trips
    // through the linked list as-is. This keeps the value-class
    // module free of AST shape knowledge.
    const errorVal0 = makeErrorValue(new Map());
    const errorVal1 = appendTrailNode(errorVal0, 'plain-string');
    const errorVal2 = appendTrailNode(errorVal1, [1, 2, 3]);
    const trail = materializeTrail(errorVal2);
    expect(trail).toEqual(['plain-string', [1, 2, 3]]);
  });
});

// ── deepEqual ───────────────────────────────────────────────────

describe('deepEqual for error values', () => {
  it('compares error values by descriptor', () => {
    const desc1 = new Map([[keyword('kind'), keyword('oops')]]);
    const desc2 = new Map([[keyword('kind'), keyword('oops')]]);
    const errorVal1 = makeErrorValue(desc1);
    const errorVal2 = makeErrorValue(desc2);
    expect(deepEqual(errorVal1, errorVal2)).toBe(true);
  });

  it('rejects error vs non-error', () => {
    const errorVal = makeErrorValue(new Map([[keyword('kind'), keyword('oops')]]));
    expect(deepEqual(errorVal, new Map([[keyword('kind'), keyword('oops')]]))).toBe(false);
    expect(deepEqual(errorVal, null)).toBe(false);
    expect(deepEqual(errorVal, 42)).toBe(false);
  });
});

// ── codec ───────────────────────────────────────────────────────

describe('codec round-trips error values through tagged JSON', () => {
  it('round-trips an error value', () => {
    const descriptor = new Map([
      [keyword('kind'), keyword('oops')],
      [keyword('message'), 'something went wrong']
    ]);
    const errorVal = makeErrorValue(descriptor);
    const tagged = toTaggedJSON(errorVal);
    expect(tagged).toHaveProperty('$error');
    const restored = fromTaggedJSON(tagged);
    expect(isErrorValue(restored)).toBe(true);
    expect(deepEqual(errorVal, restored)).toBe(true);
  });
});

// ── errorFromQlang ──────────────────────────────────────────────

describe('errorFromQlang', () => {
  it('converts QlangTypeError — kind, thrown, operand, actualValue filtered', () => {
    const typeErr = new QlangTypeError('bad type', {
      operand: 'add',
      expectedType: 'Number',
      actualType: 'String',
      actualValue: 'SECRET-PII'
    });
    const errorVal = errorFromQlang(typeErr);
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.get(keyword('kind'))).toEqual(keyword('type-error'));
    expect(desc.get(keyword('thrown'))).toEqual(keyword('QlangTypeError'));
    expect(desc.get(keyword('operand'))).toBe('add');
    expect(desc.has(keyword('actualValue'))).toBe(false);
  });

  it('converts UnresolvedIdentifierError', () => {
    const unresolvedErr = new UnresolvedIdentifierError('myName');
    const errorVal = errorFromQlang(unresolvedErr);
    const desc = errorVal.descriptor;
    expect(desc.get(keyword('kind'))).toEqual(keyword('unresolved-identifier'));
    expect(desc.get(keyword('thrown'))).toEqual(keyword('UnresolvedIdentifierError'));
  });

  it('converts DivisionByZeroError', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr);
    const desc = errorVal.descriptor;
    expect(desc.get(keyword('kind'))).toEqual(keyword('division-by-zero'));
    expect(desc.get(keyword('thrown'))).toEqual(keyword('DivisionByZeroError'));
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  it('converts plain JS Error — kind, thrown, message, operand, originalError', () => {
    const jsErr = new Error('something went wrong');
    const astNode = { text: 'myOp' };
    const errorVal = errorFromForeign(jsErr, astNode);
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.get(keyword('kind'))).toEqual(keyword('foreign-error'));
    expect(desc.get(keyword('thrown'))).toEqual(keyword('Error'));
    expect(desc.get(keyword('message'))).toBe('something went wrong');
    expect(desc.get(keyword('operand'))).toBe('myOp');
    expect(errorVal.originalError).toBe(jsErr);
  });

  it('extracts well-known properties: status, code', () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const appErr = new AppError();
    const errorVal = errorFromForeign(appErr, null);
    const desc = errorVal.descriptor;
    expect(desc.get(keyword('status'))).toBe(404);
    expect(desc.get(keyword('code'))).toBe('NOT_FOUND');
  });

  it('collects cause chain', () => {
    const cause2 = new Error('root cause');
    const cause1 = new Error('intermediate', { cause: cause2 });
    const top = new Error('top error', { cause: cause1 });
    const errorVal = errorFromForeign(top, null);
    const causes = errorVal.descriptor.get(keyword('causes'));
    expect(Array.isArray(causes)).toBe(true);
    expect(causes).toHaveLength(2);
    expect(causes[0].get(keyword('message'))).toBe('intermediate');
    expect(causes[1].get(keyword('message'))).toBe('root cause');
  });

  it('extracts enumerable own props', () => {
    const foreignErr = new Error('custom');
    foreignErr.customField = 'myValue';
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get(keyword('customField'))).toBe('myValue');
  });

  it('coerces nested objects to Maps', () => {
    const foreignErr = new Error('nested');
    foreignErr.meta = { type: 'context', value: 42 };
    const errorVal = errorFromForeign(foreignErr, null);
    const meta = errorVal.descriptor.get(keyword('meta'));
    expect(meta instanceof Map).toBe(true);
    expect(meta.get(keyword('type'))).toBe('context');
    expect(meta.get(keyword('value'))).toBe(42);
  });

  it('errorFromForeign coerces Error nested in context to Map', () => {
    const inner = new TypeError('inner');
    const foreignErr = new Error('outer');
    foreignErr.wrapped = inner;
    const errorVal = errorFromForeign(foreignErr, null);
    const wrapped = errorVal.descriptor.get(keyword('wrapped'));
    expect(wrapped instanceof Map).toBe(true);
    expect(wrapped.get(keyword('message'))).toBe('inner');
    expect(wrapped.get(keyword('thrown')).name).toBe('TypeError');
  });

  it('errorFromForeign coerces non-object to string', () => {
    const foreignErr = new Error('fail');
    foreignErr.fn = () => {};
    const errorVal = errorFromForeign(foreignErr, null);
    const fnField = errorVal.descriptor.get(keyword('fn'));
    expect(typeof fnField).toBe('string');
  });
});

import { withName, makeConduit, makeSnapshot, isConduit, isSnapshot } from '../../src/types.mjs';

describe('withName coverage', () => {
  it('renames a conduit', () => {
    const conduitVal = makeConduit(null, { name: 'old', params: ['a'], docs: ['doc'] });
    const renamed = withName(conduitVal, 'new');
    expect(isConduit(renamed)).toBe(true);
    expect(renamed.get(keyword('name'))).toBe('new');
    expect([...renamed.get(keyword('params'))]).toEqual(['a']);
    expect([...renamed.get(keyword('docs'))]).toEqual(['doc']);
  });

  it('renames a snapshot', () => {
    const snapVal = makeSnapshot(42, { name: 'old', docs: ['snap doc'] });
    const renamed = withName(snapVal, 'new');
    expect(isSnapshot(renamed)).toBe(true);
    expect(renamed.get(keyword('name'))).toBe('new');
    expect(renamed.get(keyword('qlang/value'))).toBe(42);
    expect([...renamed.get(keyword('docs'))]).toEqual(['snap doc']);
  });

  it('returns other values unchanged', () => {
    const otherVal = { type: 'other', name: 'x' };
    expect(withName(otherVal, 'y')).toBe(otherVal);
  });
});

describe('error-convert coercion edge cases', () => {
  it('coerces qlang keyword values through errorFromQlang context', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', myKey: keyword('val') });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr);
    expect(errorVal.descriptor.get(keyword('myKey'))).toEqual(keyword('val'));
  });

  it('coerces null/undefined context values to null', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', nullField: null, undefField: undefined });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr);
    expect(errorVal.descriptor.get(keyword('nullField'))).toBe(null);
  });

  it('coerces array context values to Vec', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', items: [1, 'two', true] });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr);
    const items = errorVal.descriptor.get(keyword('items'));
    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([1, 'two', true]);
  });

  it('errorFromForeign with deeply nested cause chain caps at 8', () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    const errorVal = errorFromForeign(current, null);
    const causes = errorVal.descriptor.get(keyword('causes'));
    expect(causes.length).toBe(8);
  });

  it('errorFromQlang without fingerprint uses error name', () => {
    const typeErr = new QlangTypeError('no fingerprint', {});
    const errorVal = errorFromQlang(typeErr);
    expect(errorVal.descriptor.get(keyword('thrown')).name).toBe('QlangTypeError');
  });

  it('errorFromQlang without context field', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr);
    expect(errorVal.descriptor.get(keyword('kind')).name).toBe('division-by-zero');
  });

  it('errorFromForeign without cause (no causes field)', () => {
    const foreignErr = new Error('no cause');
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.has(keyword('causes'))).toBe(false);
  });

  it('errorFromForeign coerce depth limit returns string', () => {
    const foreignErr = new Error('deep');
    let obj = { leaf: true };
    for (let i = 0; i < 8; i++) obj = { nested: obj };
    foreignErr.deep = obj;
    const errorVal = errorFromForeign(foreignErr, null);
    // Traverse into the coerced structure until depth limit kicks in
    let val = errorVal.descriptor.get(keyword('deep'));
    while (val instanceof Map && val.has(keyword('nested'))) val = val.get(keyword('nested'));
    expect(typeof val).toBe('string');
  });

  it('errorFromForeign coerce function to string', () => {
    const foreignErr = new Error('fn');
    foreignErr.callback = () => {};
    const errorVal = errorFromForeign(foreignErr, null);
    expect(typeof errorVal.descriptor.get(keyword('callback'))).toBe('string');
  });

  it('errorFromForeign coerce null values', () => {
    const foreignErr = new Error('nulls');
    foreignErr.missing = null;
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get(keyword('missing'))).toBe(null);
  });

  it('errorFromForeign coerce array values', () => {
    const foreignErr = new Error('arr');
    foreignErr.items = [1, 'two', null];
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get(keyword('items'))).toEqual([1, 'two', null]);
  });

  it('errorFromForeign well-known prop already set by standard fields', () => {
    // 'message' is both well-known and set by standard — should not duplicate
    const foreignErr = new Error('test');
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get(keyword('message'))).toBe('test');
  });
});
