// Tests for error value type, trail, deepEqual, codec, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeErrorValue, appendTrailNode, materializeTrail, describeType, isQuote, makeTagKeyword } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { toTaggedJSON, fromTaggedJSON } from '../../src/codec.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { QlangTypeError, UnresolvedIdentifierError, DivisionByZeroError } from '../../src/errors.mjs';

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
  it('converts QlangTypeError — kind, thrown, operand, actualValue preserved, fault stamped', () => {
    const faultMap = Object.freeze(new Map([
      ['step', new Map([['text', 'add(1)']])],
      ['input', 'the-subject']
    ]));
    const typeErr = new QlangTypeError('bad type', {
      operand: 'add',
      expectedType: 'Number',
      actualType: { name: 'string' },
      actualValue: 'the-value'
    });
    const errorVal = errorFromQlang(typeErr, faultMap);
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.get('kind')).toEqual(keyword('type-error'));
    expect(desc.get('thrown')).toEqual(makeTagKeyword('QlangTypeError'));
    expect(desc.get('operand')).toBe('add');
    expect(desc.get('actualValue')).toBe('the-value');
    const fault = desc.get('fault');
    expect(fault).toBeInstanceOf(Map);
    expect(fault.get('step').get('text')).toBe('add(1)');
    expect(fault.get('input')).toBe('the-subject');
  });

  it('converts UnresolvedIdentifierError with fault carrying AST-Map step', () => {
    const unresolvedErr = new UnresolvedIdentifierError('myName');
    const stepMap = Object.freeze(new Map([
      ['qlang/kind', keyword('OperandCall')],
      ['name', 'myName'],
      ['text', 'myName']
    ]));
    const faultMap = Object.freeze(new Map([['step', stepMap], ['input', 42]]));
    const errorVal = errorFromQlang(unresolvedErr, faultMap);
    const desc = errorVal.descriptor;
    expect(desc.get('kind')).toEqual(keyword('unresolved-identifier'));
    expect(desc.get('thrown')).toEqual(makeTagKeyword('UnresolvedIdentifierError'));
    const fault = desc.get('fault');
    expect(fault.get('step').get('name')).toBe('myName');
    expect(fault.get('input')).toBe(42);
  });

  it('converts DivisionByZeroError with fault carrying pipeline input', () => {
    const divErr = new DivisionByZeroError();
    const stepMap = Object.freeze(new Map([
      ['qlang/kind', keyword('OperandCall')],
      ['name', 'div'],
      ['text', 'div(0)']
    ]));
    const faultMap = Object.freeze(new Map([['step', stepMap], ['input', 10]]));
    const errorVal = errorFromQlang(divErr, faultMap);
    const desc = errorVal.descriptor;
    expect(desc.get('kind')).toEqual(keyword('division-by-zero'));
    expect(desc.get('thrown')).toEqual(makeTagKeyword('DivisionByZeroError'));
    const fault = desc.get('fault');
    expect(fault.get('step').get('text')).toBe('div(0)');
    expect(fault.get('input')).toBe(10);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  it('converts plain JS Error — kind, thrown, message, operand, originalError, fault', () => {
    const jsErr = new Error('something went wrong');
    const astNode = { text: 'myOp' };
    const faultMap = Object.freeze(new Map([
      ['step', new Map([['text', 'myOp']])],
      ['input', 'inputVal']
    ]));
    const errorVal = errorFromForeign(jsErr, astNode, faultMap);
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.get('kind')).toEqual(keyword('foreign-error'));
    expect(desc.get('thrown')).toEqual(makeTagKeyword('Error'));
    expect(desc.get('message')).toBe('something went wrong');
    expect(desc.get('operand')).toBe('myOp');
    expect(errorVal.originalError).toBe(jsErr);
    expect(desc.get('fault')).toBe(faultMap);
  });

  it('extracts well-known properties and preserves fault', () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const appErr = new AppError();
    const fault = makeFault('hostCall', { user: 'alice' });
    const errorVal = errorFromForeign(appErr, null, fault);
    const desc = errorVal.descriptor;
    expect(desc.get('status')).toBe(404);
    expect(desc.get('code')).toBe('NOT_FOUND');
    expect(desc.get('fault')).toBe(fault);
    expect(desc.get('fault').get('input').user).toBe('alice');
  });

  it('collects cause chain and preserves fault', () => {
    const cause2 = new Error('root cause');
    const cause1 = new Error('intermediate', { cause: cause2 });
    const top = new Error('top error', { cause: cause1 });
    const fault = makeFault('chainedOp', [1, 2, 3]);
    const errorVal = errorFromForeign(top, null, fault);
    const causes = errorVal.descriptor.get('causes');
    expect(Array.isArray(causes)).toBe(true);
    expect(causes).toHaveLength(2);
    expect(causes[0].get('message')).toBe('intermediate');
    expect(causes[1].get('message')).toBe('root cause');
    expect(errorVal.descriptor.get('fault').get('input')).toEqual([1, 2, 3]);
  });

  it('extracts enumerable own props and preserves fault', () => {
    const foreignErr = new Error('custom');
    foreignErr.customField = 'myValue';
    const fault = makeFault('customOp', 'custom-input');
    const errorVal = errorFromForeign(foreignErr, null, fault);
    expect(errorVal.descriptor.get('customField')).toBe('myValue');
    expect(errorVal.descriptor.get('fault')).toBe(fault);
  });

  it('coerces nested objects to Maps and preserves fault', () => {
    const foreignErr = new Error('nested');
    foreignErr.meta = { type: 'context', value: 42 };
    const fault = makeFault('nestedOp', { nested: true });
    const errorVal = errorFromForeign(foreignErr, null, fault);
    const meta = errorVal.descriptor.get('meta');
    expect(meta instanceof Map).toBe(true);
    expect(meta.get('type')).toBe('context');
    expect(meta.get('value')).toBe(42);
    expect(errorVal.descriptor.get('fault').get('step').get('text')).toBe('nestedOp');
  });

  it('coerces Error nested in context to Map', () => {
    const inner = new TypeError('inner');
    const foreignErr = new Error('outer');
    foreignErr.wrapped = inner;
    const fault = makeFault('wrappedOp', 'wrap-input');
    const errorVal = errorFromForeign(foreignErr, null, fault);
    const wrapped = errorVal.descriptor.get('wrapped');
    expect(wrapped instanceof Map).toBe(true);
    expect(wrapped.get('message')).toBe('inner');
    expect(wrapped.get('thrown').name).toBe('TypeError');
    expect(errorVal.descriptor.get('fault').get('input')).toBe('wrap-input');
  });

  it('coerces non-object to string and preserves fault', () => {
    const foreignErr = new Error('fail');
    foreignErr.fn = () => {};
    const fault = makeFault('fnOp', 99);
    const errorVal = errorFromForeign(foreignErr, null, fault);
    expect(typeof errorVal.descriptor.get('fn')).toBe('string');
    expect(errorVal.descriptor.get('fault').get('input')).toBe(99);
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
    expect(renamed.get('qlang/value')).toBe(42);
    expect([...renamed.get('docs')]).toEqual(['snap doc']);
  });

  it('returns other values unchanged', () => {
    const otherVal = { type: 'other', name: 'x' };
    expect(withName(otherVal, 'y')).toBe(otherVal);
  });
});

function makeFault(stepText, input) {
  return Object.freeze(new Map([
    ['step', Object.freeze(new Map([['text', stepText]]))],
    ['input', input]
  ]));
}

describe('error-convert coercion edge cases', () => {
  it('coerces qlang keyword values through errorFromQlang context', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', myKey: keyword('val') });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr, makeFault('testOp', 42));
    expect(errorVal.descriptor.get('myKey')).toEqual(keyword('val'));
  });

  it('coerces null/undefined context values to null', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', nullField: null, undefField: undefined });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr, makeFault('testOp', null));
    expect(errorVal.descriptor.get('nullField')).toBe(null);
  });

  it('coerces array context values to Vec', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', items: [1, 'two', true] });
    typeErr.fingerprint = 'X';
    const errorVal = errorFromQlang(typeErr, makeFault('testOp', []));
    const items = errorVal.descriptor.get('items');
    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([1, 'two', true]);
  });

  it('errorFromForeign with deeply nested cause chain caps at 8', () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    const errorVal = errorFromForeign(current, null, makeFault('hostOp', 'deep-input'));
    const causes = errorVal.descriptor.get('causes');
    expect(causes.length).toBe(8);
  });

  it('errorFromQlang without fingerprint uses error name', () => {
    const typeErr = new QlangTypeError('no fingerprint', {});
    const errorVal = errorFromQlang(typeErr, makeFault('count', [1, 2]));
    expect(errorVal.descriptor.get('thrown').name).toBe('QlangTypeError');
  });

  it('errorFromQlang without context field', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr, makeFault('div(0)', 10));
    expect(errorVal.descriptor.get('kind').name).toBe('division-by-zero');
  });

  it('errorFromForeign without cause (no causes field)', () => {
    const foreignErr = new Error('no cause');
    const errorVal = errorFromForeign(foreignErr, null, makeFault('hostOp', 'input'));
    expect(errorVal.descriptor.has('causes')).toBe(false);
  });

  it('errorFromForeign coerce depth limit returns string', () => {
    const foreignErr = new Error('deep');
    let obj = { leaf: true };
    for (let i = 0; i < 8; i++) obj = { nested: obj };
    foreignErr.deep = obj;
    const errorVal = errorFromForeign(foreignErr, null, makeFault('deepOp', obj));
    let val = errorVal.descriptor.get('deep');
    while (val instanceof Map && val.has('nested')) val = val.get('nested');
    expect(typeof val).toBe('string');
  });

  it('errorFromForeign coerce function to string', () => {
    const foreignErr = new Error('fn');
    foreignErr.callback = () => {};
    const errorVal = errorFromForeign(foreignErr, null, makeFault('fnOp', 99));
    expect(typeof errorVal.descriptor.get('callback')).toBe('string');
  });

  it('errorFromForeign coerce null values', () => {
    const foreignErr = new Error('nulls');
    foreignErr.missing = null;
    const errorVal = errorFromForeign(foreignErr, null, makeFault('nullOp', null));
    expect(errorVal.descriptor.get('missing')).toBe(null);
  });

  it('errorFromForeign coerce array values', () => {
    const foreignErr = new Error('arr');
    foreignErr.items = [1, 'two', null];
    const errorVal = errorFromForeign(foreignErr, null, makeFault('arrOp', []));
    expect(errorVal.descriptor.get('items')).toEqual([1, 'two', null]);
  });

  it('errorFromForeign well-known prop already set by standard fields', () => {
    const foreignErr = new Error('test');
    const errorVal = errorFromForeign(foreignErr, null, makeFault('testOp', 'val'));
    expect(errorVal.descriptor.get('message')).toBe('test');
  });
});
