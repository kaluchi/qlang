// Tests for error value type, trail, deepEqual, codec, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeErrorValue, makeQuote, appendTrailNode, materializeTrail, describeType, isQuote, makeTagKeyword } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { toTaggedJSON, fromTaggedJSON } from '../../src/codec.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { QlangTypeError, UnresolvedIdentifierError, DivisionByZeroError } from '../../src/errors.mjs';

// fault(stepText, input) — pair-builder for the flat
// `:faultStep` / `:faultInput` descriptor shape. errorFromQlang
// and errorFromForeign accept the two fields as separate arguments
// to stamp them directly without an intermediate Map wrapper.
function fault(stepText, input) {
  return [makeQuote(stepText), input];
}

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces frozen error object with :trail null when descriptor lacks one', () => {
    // makeErrorValue enforces the invariant that every error
    // descriptor carries :trail — null when no success-track
    // combinator has deflected after the fault, otherwise a
    // Quote-value carrying the joined pipeline-suffix source. The
    // returned descriptor is a fresh Map (not the caller's
    // original input) when the input lacked :trail.
    const descriptor = new Map([['kind', keyword('oops')]]);
    const errorVal = makeErrorValue(descriptor);
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.type).toBe('error');
    expect(errorVal.descriptor.get('kind')).toEqual(keyword('oops'));
    expect(errorVal.descriptor.get('trail')).toBeNull();
  });

  it('preserves caller-supplied :trail in descriptor', () => {
    // When the caller already includes :trail in the descriptor
    // — typically a re-lifted descriptor carrying a Quote-value
    // trail from an earlier fail-apply materialization — makeErrorValue
    // keeps the supplied value untouched and skips the
    // invariant-fill branch.
    const preTrail = '| mul(2) | count';
    const descriptor = new Map([
      ['kind', keyword('oops')],
      ['trail', preTrail]
    ]);
    const errorVal = makeErrorValue(descriptor);
    expect(errorVal.descriptor).toBe(descriptor);
    expect(errorVal.descriptor.get('trail')).toBe(preTrail);
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
  it('appendTrailNode stores {combinator, text} fragments in a linked list', () => {
    // Trail-fragment shape: a frozen `{combinator, text}` record
    // where `combinator` is one of the COMBINATOR_SYNTAX keys
    // ('pipe' / 'distribute' / 'merge') and `text` is the deflected
    // step's source slice. eval.mjs::trailEntry produces this shape
    // at every success-track combinator deflect site;
    // materializeTrail joins the chain into a Quote source on demand.
    const fragment1 = Object.freeze({ combinator: 'pipe', text: 'count' });
    const errorVal0 = makeErrorValue(new Map());
    const errorVal1 = appendTrailNode(errorVal0, fragment1);
    expect(Object.isFrozen(errorVal1)).toBe(true);
    expect(errorVal1._trailHead.entry).toBe(fragment1);
    expect(errorVal1._trailHead.prev).toBeNull();

    const fragment2 = Object.freeze({ combinator: 'pipe', text: 'filter(gt(2))' });
    const errorVal2 = appendTrailNode(errorVal1, fragment2);
    expect(errorVal2._trailHead.entry).toBe(fragment2);
    expect(errorVal2._trailHead.prev.entry).toBe(fragment1);
  });

  it('materializeTrail joins chronological fragments into a Quote-value source', () => {
    // Chronological order is reconstructed by walking the linked list
    // and reversing — first deflect ends up first in the source.
    const errorVal0 = makeErrorValue(new Map());
    const errorVal1 = appendTrailNode(errorVal0,
      Object.freeze({ combinator: 'pipe',       text: 'mul(2)' }));
    const errorVal2 = appendTrailNode(errorVal1,
      Object.freeze({ combinator: 'distribute', text: 'inc' }));
    const errorVal3 = appendTrailNode(errorVal2,
      Object.freeze({ combinator: 'merge',      text: 'flatten' }));
    const quote = materializeTrail(errorVal3);
    expect(isQuote(quote)).toBe(true);
    expect(quote.source).toBe('| mul(2) * inc >> flatten');
  });

  it('materializeTrail on fresh error returns null', () => {
    const errorVal = makeErrorValue(new Map());
    expect(materializeTrail(errorVal)).toBeNull();
  });
});

// ── deepEqual ───────────────────────────────────────────────────

describe('deepEqual for error values', () => {
  it('compares error values by descriptor', () => {
    const desc1 = new Map([['kind', keyword('oops')]]);
    const desc2 = new Map([['kind', keyword('oops')]]);
    const errorVal1 = makeErrorValue(desc1);
    const errorVal2 = makeErrorValue(desc2);
    expect(deepEqual(errorVal1, errorVal2)).toBe(true);
  });

  it('rejects error vs non-error', () => {
    const errorVal = makeErrorValue(new Map([['kind', keyword('oops')]]));
    expect(deepEqual(errorVal, new Map([['kind', keyword('oops')]]))).toBe(false);
    expect(deepEqual(errorVal, null)).toBe(false);
    expect(deepEqual(errorVal, 42)).toBe(false);
  });
});

// ── codec ───────────────────────────────────────────────────────

describe('codec round-trips error values through tagged JSON', () => {
  it('round-trips an error value', () => {
    const descriptor = new Map([
      ['kind', keyword('oops')],
      ['message', 'something went wrong']
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
  it('converts QlangTypeError — kind, category, actualValue preserved, faultStep+faultInput stamped flat', () => {
    const typeErr = new QlangTypeError('bad type', {
      actualType: { name: 'string' },
      actualValue: 'the-value'
    });
    const errorVal = errorFromQlang(typeErr, ...fault('add(1)', 'the-subject'));
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.has('category')).toBe(false);
    expect(typeErr.kind).toBe('typeError');
    expect(desc.get('kind')).toEqual(makeTagKeyword('QlangTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualType')).toEqual({ name: 'string' });
    expect(desc.get('faultStep').source).toBe('add(1)');
    expect(desc.get('faultInput')).toBe('the-subject');
  });

  it('converts UnresolvedIdentifierError with faultStep/faultInput stamped flat', () => {
    const unresolvedErr = new UnresolvedIdentifierError('myName');
    const errorVal = errorFromQlang(unresolvedErr, ...fault('myName', 42));
    const desc = errorVal.descriptor;
    expect(desc.has('category')).toBe(false);
    expect(unresolvedErr.kind).toBe('unresolvedIdentifier');
    expect(desc.get('kind')).toEqual(makeTagKeyword('UnresolvedIdentifierError'));
    expect(desc.get('faultStep').source).toBe('myName');
    expect(desc.get('faultInput')).toBe(42);
  });

  it('converts DivisionByZeroError with faultStep/faultInput stamped flat', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr, ...fault('div(0)', 10));
    const desc = errorVal.descriptor;
    expect(desc.has('category')).toBe(false);
    expect(divErr.kind).toBe('divisionByZero');
    expect(desc.get('kind')).toEqual(makeTagKeyword('DivisionByZeroError'));
    expect(desc.get('faultStep').source).toBe('div(0)');
    expect(desc.get('faultInput')).toBe(10);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  it('converts plain JS Error — kind, message, operand, originalError, faultStep, faultInput', () => {
    const jsErr = new Error('something went wrong');
    const astNode = { text: 'myOp' };
    const errorVal = errorFromForeign(jsErr, astNode, ...fault('myOp', 'inputVal'));
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.has('category')).toBe(false);
    expect(desc.get('kind')).toEqual(makeTagKeyword('Error'));
    expect(desc.get('message')).toBe('something went wrong');
    expect(desc.get('operand')).toBe('myOp');
    expect(errorVal.originalError).toBe(jsErr);
    expect(desc.get('faultStep').source).toBe('myOp');
    expect(desc.get('faultInput')).toBe('inputVal');
  });

  it('extracts well-known properties and preserves faultStep/faultInput', () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const appErr = new AppError();
    const errorVal = errorFromForeign(appErr, null, ...fault('hostCall', { user: 'alice' }));
    const desc = errorVal.descriptor;
    expect(desc.get('status')).toBe(404);
    expect(desc.get('code')).toBe('NOT_FOUND');
    expect(desc.get('faultStep').source).toBe('hostCall');
    expect(desc.get('faultInput').user).toBe('alice');
  });

  it('collects cause chain and preserves faultStep/faultInput', () => {
    const cause2 = new Error('root cause');
    const cause1 = new Error('intermediate', { cause: cause2 });
    const top = new Error('top error', { cause: cause1 });
    const errorVal = errorFromForeign(top, null, ...fault('chainedOp', [1, 2, 3]));
    const causes = errorVal.descriptor.get('causes');
    expect(Array.isArray(causes)).toBe(true);
    expect(causes).toHaveLength(2);
    expect(causes[0].get('message')).toBe('intermediate');
    expect(causes[1].get('message')).toBe('root cause');
    expect(errorVal.descriptor.get('faultInput')).toEqual([1, 2, 3]);
  });

  it('extracts enumerable own props and preserves faultStep/faultInput', () => {
    const foreignErr = new Error('custom');
    foreignErr.customField = 'myValue';
    const errorVal = errorFromForeign(foreignErr, null, ...fault('customOp', 'custom-input'));
    expect(errorVal.descriptor.get('customField')).toBe('myValue');
    expect(errorVal.descriptor.get('faultStep').source).toBe('customOp');
    expect(errorVal.descriptor.get('faultInput')).toBe('custom-input');
  });

  it('coerces nested objects to Maps and preserves faultStep/faultInput', () => {
    const foreignErr = new Error('nested');
    foreignErr.meta = { type: 'context', value: 42 };
    const errorVal = errorFromForeign(foreignErr, null, ...fault('nestedOp', { nested: true }));
    const meta = errorVal.descriptor.get('meta');
    expect(meta instanceof Map).toBe(true);
    expect(meta.get('type')).toBe('context');
    expect(meta.get('value')).toBe(42);
    expect(errorVal.descriptor.get('faultStep').source).toBe('nestedOp');
  });

  it('coerces Error nested in context to Map', () => {
    const inner = new TypeError('inner');
    const foreignErr = new Error('outer');
    foreignErr.wrapped = inner;
    const errorVal = errorFromForeign(foreignErr, null, ...fault('wrappedOp', 'wrap-input'));
    const wrapped = errorVal.descriptor.get('wrapped');
    expect(wrapped instanceof Map).toBe(true);
    expect(wrapped.get('message')).toBe('inner');
    expect(wrapped.get('kind').name).toBe('TypeError');
    expect(errorVal.descriptor.get('faultInput')).toBe('wrap-input');
  });

  it('coerces non-object to string and preserves faultStep/faultInput', () => {
    const foreignErr = new Error('fail');
    foreignErr.fn = () => {};
    const errorVal = errorFromForeign(foreignErr, null, ...fault('fnOp', 99));
    expect(typeof errorVal.descriptor.get('fn')).toBe('string');
    expect(errorVal.descriptor.get('faultInput')).toBe(99);
  });
});

import { withName, makeConduit, makeSnapshot, isConduit, isSnapshot } from '../../src/types.mjs';

describe('withName coverage', () => {
  it('renames a conduit', () => {
    const conduitVal = makeConduit({ type: 'NumberLit', value: 1, text: '1' }, { name: 'old', params: ['a'], docs: ['doc'] });
    const renamed = withName(conduitVal, 'new');
    expect(isConduit(renamed)).toBe(true);
    expect(renamed.get('name')).toBe('new');
    expect([...renamed.get('params')]).toEqual(['a']);
    expect([...renamed.get('docs')]).toEqual(['doc']);
  });

  it('renames a snapshot', () => {
    const snapVal = makeSnapshot(42, { name: 'old', docs: ['snap doc'] });
    const renamed = withName(snapVal, 'new');
    expect(isSnapshot(renamed)).toBe(true);
    expect(renamed.get('name')).toBe('new');
    expect(renamed.get('payload')).toBe(42);
    expect([...renamed.get('docs')]).toEqual(['snap doc']);
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
    const errorVal = errorFromQlang(typeErr, ...fault('testOp', 42));
    expect(errorVal.descriptor.get('myKey')).toEqual(keyword('val'));
  });

  it('coerces null/undefined context values to null', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', nullField: null, undefField: undefined });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr, ...fault('testOp', null));
    expect(errorVal.descriptor.get('nullField')).toBe(null);
  });

  it('coerces array context values to Vec', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', items: [1, 'two', true] });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr, ...fault('testOp', []));
    const items = errorVal.descriptor.get('items');
    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([1, 'two', true]);
  });

  it('errorFromForeign with deeply nested cause chain caps at 8', () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    const errorVal = errorFromForeign(current, null, ...fault('hostOp', 'deep-input'));
    const causes = errorVal.descriptor.get('causes');
    expect(causes.length).toBe(8);
  });

  it('errorFromQlang without fingerprint uses error name', () => {
    const typeErr = new QlangTypeError('no fingerprint', {});
    const errorVal = errorFromQlang(typeErr, ...fault('count', [1, 2]));
    expect(errorVal.descriptor.get('kind').name).toBe('QlangTypeError');
  });

  it('errorFromQlang without context field', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr, ...fault('div(0)', 10));
    expect(errorVal.descriptor.get('kind').name).toBe('DivisionByZeroError');
    expect(errorVal.descriptor.has('category')).toBe(false);
  });

  it('errorFromForeign without cause (no causes field)', () => {
    const foreignErr = new Error('no cause');
    const errorVal = errorFromForeign(foreignErr, null, ...fault('hostOp', 'input'));
    expect(errorVal.descriptor.has('causes')).toBe(false);
  });

  it('errorFromForeign coerce depth limit returns string', () => {
    const foreignErr = new Error('deep');
    let obj = { leaf: true };
    for (let i = 0; i < 8; i++) obj = { nested: obj };
    foreignErr.deep = obj;
    const errorVal = errorFromForeign(foreignErr, null, ...fault('deepOp', obj));
    let val = errorVal.descriptor.get('deep');
    while (val instanceof Map && val.has('nested')) val = val.get('nested');
    expect(typeof val).toBe('string');
  });

  it('errorFromForeign coerce function to string', () => {
    const foreignErr = new Error('fn');
    foreignErr.callback = () => {};
    const errorVal = errorFromForeign(foreignErr, null, ...fault('fnOp', 99));
    expect(typeof errorVal.descriptor.get('callback')).toBe('string');
  });

  it('errorFromForeign coerce null values', () => {
    const foreignErr = new Error('nulls');
    foreignErr.missing = null;
    const errorVal = errorFromForeign(foreignErr, null, ...fault('nullOp', null));
    expect(errorVal.descriptor.get('missing')).toBe(null);
  });

  it('errorFromForeign coerce array values', () => {
    const foreignErr = new Error('arr');
    foreignErr.items = [1, 'two', null];
    const errorVal = errorFromForeign(foreignErr, null, ...fault('arrOp', []));
    expect(errorVal.descriptor.get('items')).toEqual([1, 'two', null]);
  });

  it('errorFromForeign well-known prop already set by standard fields', () => {
    const foreignErr = new Error('test');
    const errorVal = errorFromForeign(foreignErr, null, ...fault('testOp', 'val'));
    expect(errorVal.descriptor.get('message')).toBe('test');
  });

  it('actualValue ref-equal to faultInput is dedup-skipped on lift', () => {
    // Subject-shape error on a partial application: actualValue
    // (the JS context field) is the same reference as faultInput
    // (the pipeValue the step received). errorFromQlang dedup
    // skips the redundant lift; the descriptor surface stays
    // single-source-of-truth.
    const subject = { nested: 1 };
    const typeErr = new QlangTypeError('subject error', { actualValue: subject, actualType: keyword('map') });
    typeErr.fingerprint = 'TestSubjectError';
    const errorVal = errorFromQlang(typeErr, ...fault('firstNonZero', subject));
    expect(errorVal.descriptor.get('faultInput')).toBe(subject);
    expect(errorVal.descriptor.has('actualValue')).toBe(false);
    expect(errorVal.descriptor.get('actualType').name).toBe('map');
  });

  it('actualValue distinct from faultInput is preserved on lift (drill-down signal)', () => {
    // Drill-down case (multi-segment projection, element iteration,
    // full-application captured-arg): actualValue is a different
    // reference. Lift proceeds so the presence-of-actualValue
    // surfaces «look here for the offending sub-value».
    const container = [1, 'x', 3];
    const drilled = 'x';
    const typeErr = new QlangTypeError('element error', { actualValue: drilled, actualType: keyword('string'), index: 1 });
    typeErr.fingerprint = 'TestElementError';
    const errorVal = errorFromQlang(typeErr, ...fault('sum', container));
    expect(errorVal.descriptor.get('faultInput')).toBe(container);
    expect(errorVal.descriptor.get('actualValue')).toBe(drilled);
    expect(errorVal.descriptor.get('index')).toBe(1);
  });
});
