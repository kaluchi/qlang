// Tests for error value type, trail, deepEqual, codec, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import {
  keyword, isErrorValue, makeErrorValue, appendTrailNode, materializeTrail, describeType
} from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { toTaggedJSON, fromTaggedJSON } from '../../src/codec.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { QlangTypeError, UnresolvedIdentifierError, DivisionByZeroError } from '../../src/errors.mjs';

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces frozen error object', () => {
    const descriptor = new Map([[keyword('kind'), keyword('oops')]]);
    const ev = makeErrorValue(descriptor);
    expect(isErrorValue(ev)).toBe(true);
    expect(Object.isFrozen(ev)).toBe(true);
    expect(ev.type).toBe('error');
    expect(ev.descriptor).toBe(descriptor);
  });
});

// ── describeType ────────────────────────────────────────────────

describe('describeType for error values', () => {
  it('returns "Error" for error values', () => {
    const ev = makeErrorValue(new Map());
    expect(describeType(ev)).toBe('Error');
  });
});

// ── trail (appendTrailNode / materializeTrail) ──────────────────

describe('trail', () => {
  it('appendTrailNode builds linked list', () => {
    const ev0 = makeErrorValue(new Map());
    const node1 = { type: 'OperandCall', text: 'count' };
    const ev1 = appendTrailNode(ev0, node1);
    expect(Object.isFrozen(ev1)).toBe(true);
    expect(ev1._trailHead.text).toBe('count');
    expect(ev1._trailHead.prev).toBeNull();

    const node2 = { type: 'OperandCall', text: 'filter' };
    const ev2 = appendTrailNode(ev1, node2);
    expect(ev2._trailHead.text).toBe('filter');
    expect(ev2._trailHead.prev.text).toBe('count');
  });

  it('materializeTrail returns chronological Vec', () => {
    const ev0 = makeErrorValue(new Map());
    const ev1 = appendTrailNode(ev0, { text: 'first' });
    const ev2 = appendTrailNode(ev1, { text: 'second' });
    const ev3 = appendTrailNode(ev2, { text: 'third' });
    const trail = materializeTrail(ev3);
    expect(trail).toEqual(['first', 'second', 'third']);
  });

  it('materializeTrail on fresh error returns empty', () => {
    const ev = makeErrorValue(new Map());
    expect(materializeTrail(ev)).toEqual([]);
  });
});

// ── deepEqual ───────────────────────────────────────────────────

describe('deepEqual for error values', () => {
  it('compares error values by descriptor', () => {
    const d1 = new Map([[keyword('kind'), keyword('oops')]]);
    const d2 = new Map([[keyword('kind'), keyword('oops')]]);
    const ev1 = makeErrorValue(d1);
    const ev2 = makeErrorValue(d2);
    expect(deepEqual(ev1, ev2)).toBe(true);
  });

  it('rejects error vs non-error', () => {
    const ev = makeErrorValue(new Map([[keyword('kind'), keyword('oops')]]));
    expect(deepEqual(ev, new Map([[keyword('kind'), keyword('oops')]]))).toBe(false);
    expect(deepEqual(ev, null)).toBe(false);
    expect(deepEqual(ev, 42)).toBe(false);
  });
});

// ── codec ───────────────────────────────────────────────────────

describe('codec round-trips error values through tagged JSON', () => {
  it('round-trips an error value', () => {
    const descriptor = new Map([
      [keyword('kind'), keyword('oops')],
      [keyword('message'), 'something went wrong']
    ]);
    const ev = makeErrorValue(descriptor);
    const tagged = toTaggedJSON(ev);
    expect(tagged).toHaveProperty('$error');
    const restored = fromTaggedJSON(tagged);
    expect(isErrorValue(restored)).toBe(true);
    expect(deepEqual(ev, restored)).toBe(true);
  });
});

// ── errorFromQlang ──────────────────────────────────────────────

describe('errorFromQlang', () => {
  it('converts QlangTypeError — kind, thrown, operand, actualValue filtered', () => {
    const err = new QlangTypeError('bad type', {
      operand: 'add',
      expectedType: 'number',
      actualType: 'string',
      actualValue: 'SECRET-PII'
    });
    const ev = errorFromQlang(err, null);
    expect(isErrorValue(ev)).toBe(true);
    const d = ev.descriptor;
    expect(d.get(keyword('kind'))).toEqual(keyword('type-error'));
    expect(d.get(keyword('thrown'))).toEqual(keyword('QlangTypeError'));
    expect(d.get(keyword('operand'))).toBe('add');
    expect(d.has(keyword('actualValue'))).toBe(false);
  });

  it('converts UnresolvedIdentifierError', () => {
    const err = new UnresolvedIdentifierError('myName');
    const ev = errorFromQlang(err, null);
    const d = ev.descriptor;
    expect(d.get(keyword('kind'))).toEqual(keyword('unresolved-identifier'));
    expect(d.get(keyword('thrown'))).toEqual(keyword('UnresolvedIdentifierError'));
  });

  it('converts DivisionByZeroError', () => {
    const err = new DivisionByZeroError();
    const ev = errorFromQlang(err, null);
    const d = ev.descriptor;
    expect(d.get(keyword('kind'))).toEqual(keyword('division-by-zero'));
    expect(d.get(keyword('thrown'))).toEqual(keyword('DivisionByZeroError'));
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  it('converts plain JS Error — kind, thrown, message, operand, originalError', () => {
    const jsErr = new Error('something went wrong');
    const astNode = { text: 'myOp' };
    const ev = errorFromForeign(jsErr, astNode);
    expect(isErrorValue(ev)).toBe(true);
    const d = ev.descriptor;
    expect(d.get(keyword('kind'))).toEqual(keyword('foreign-error'));
    expect(d.get(keyword('thrown'))).toEqual(keyword('Error'));
    expect(d.get(keyword('message'))).toBe('something went wrong');
    expect(d.get(keyword('operand'))).toBe('myOp');
    expect(ev.originalError).toBe(jsErr);
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
    const ev = errorFromForeign(appErr, null);
    const d = ev.descriptor;
    expect(d.get(keyword('status'))).toBe(404);
    expect(d.get(keyword('code'))).toBe('NOT_FOUND');
  });

  it('collects cause chain', () => {
    const cause2 = new Error('root cause');
    const cause1 = new Error('intermediate', { cause: cause2 });
    const top = new Error('top error', { cause: cause1 });
    const ev = errorFromForeign(top, null);
    const causes = ev.descriptor.get(keyword('causes'));
    expect(Array.isArray(causes)).toBe(true);
    expect(causes).toHaveLength(2);
    expect(causes[0].get(keyword('message'))).toBe('intermediate');
    expect(causes[1].get(keyword('message'))).toBe('root cause');
  });

  it('extracts enumerable own props', () => {
    const err = new Error('custom');
    err.customField = 'myValue';
    const ev = errorFromForeign(err, null);
    expect(ev.descriptor.get(keyword('customField'))).toBe('myValue');
  });

  it('coerces nested objects to Maps', () => {
    const err = new Error('nested');
    err.meta = { type: 'context', value: 42 };
    const ev = errorFromForeign(err, null);
    const meta = ev.descriptor.get(keyword('meta'));
    expect(meta instanceof Map).toBe(true);
    expect(meta.get(keyword('type'))).toBe('context');
    expect(meta.get(keyword('value'))).toBe(42);
  });

  it('errorFromForeign coerces Error nested in context to Map', () => {
    const inner = new TypeError('inner');
    const err = new Error('outer');
    err.wrapped = inner;
    const ev = errorFromForeign(err, null);
    const wrapped = ev.descriptor.get(keyword('wrapped'));
    expect(wrapped instanceof Map).toBe(true);
    expect(wrapped.get(keyword('message'))).toBe('inner');
    expect(wrapped.get(keyword('thrown')).name).toBe('TypeError');
  });

  it('errorFromForeign coerces non-object to string', () => {
    const err = new Error('fail');
    err.fn = () => {};
    const ev = errorFromForeign(err, null);
    const fn = ev.descriptor.get(keyword('fn'));
    expect(typeof fn).toBe('string');
  });
});

import { withName, makeConduit, makeSnapshot } from '../../src/types.mjs';

describe('withName coverage', () => {
  it('renames a conduit', () => {
    const c = makeConduit(null, { name: 'old', params: ['a'], docs: ['doc'] });
    const renamed = withName(c, 'new');
    expect(renamed.name).toBe('new');
    expect(renamed.type).toBe('conduit');
    expect(renamed.params).toEqual(['a']);
    expect(renamed.docs).toEqual(['doc']);
  });

  it('renames a snapshot', () => {
    const s = makeSnapshot(42, { name: 'old', docs: ['snap doc'] });
    const renamed = withName(s, 'new');
    expect(renamed.name).toBe('new');
    expect(renamed.type).toBe('snapshot');
    expect(renamed.value).toBe(42);
    expect(renamed.docs).toEqual(['snap doc']);
  });

  it('returns other values unchanged', () => {
    const v = { type: 'other', name: 'x' };
    expect(withName(v, 'y')).toBe(v);
  });
});

describe('error-convert coercion edge cases', () => {
  it('coerces qlang keyword values through errorFromQlang context', () => {
    const e = new QlangTypeError('test', { site: 'X', myKey: keyword('val') });
    e.fingerprint = 'X';
    const ev = errorFromQlang(e, null);
    expect(ev.descriptor.get(keyword('myKey'))).toEqual(keyword('val'));
  });

  it('coerces null/undefined context values to nil', () => {
    const e = new QlangTypeError('test', { site: 'X', nullField: null, undefField: undefined });
    e.fingerprint = 'X';
    const ev = errorFromQlang(e, null);
    expect(ev.descriptor.get(keyword('nullField'))).toBe(null);
  });

  it('coerces array context values to Vec', () => {
    const e = new QlangTypeError('test', { site: 'X', items: [1, 'two', true] });
    e.fingerprint = 'X';
    const ev = errorFromQlang(e, null);
    const items = ev.descriptor.get(keyword('items'));
    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([1, 'two', true]);
  });

  it('errorFromForeign with deeply nested cause chain caps at 8', () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    const ev = errorFromForeign(current, null);
    const causes = ev.descriptor.get(keyword('causes'));
    expect(causes.length).toBe(8);
  });

  it('errorFromQlang without fingerprint uses error name', () => {
    const e = new QlangTypeError('no fingerprint', {});
    const ev = errorFromQlang(e, null);
    expect(ev.descriptor.get(keyword('thrown')).name).toBe('QlangTypeError');
  });

  it('errorFromQlang without context field', () => {
    const e = new DivisionByZeroError();
    const ev = errorFromQlang(e, null);
    expect(ev.descriptor.get(keyword('kind')).name).toBe('division-by-zero');
  });

  it('errorFromForeign without cause (no causes field)', () => {
    const e = new Error('no cause');
    const ev = errorFromForeign(e, null);
    expect(ev.descriptor.has(keyword('causes'))).toBe(false);
  });

  it('errorFromForeign coerce depth limit returns string', () => {
    const e = new Error('deep');
    let obj = { leaf: true };
    for (let i = 0; i < 8; i++) obj = { nested: obj };
    e.deep = obj;
    const ev = errorFromForeign(e, null);
    // Traverse into the coerced structure until depth limit kicks in
    let val = ev.descriptor.get(keyword('deep'));
    while (val instanceof Map && val.has(keyword('nested'))) val = val.get(keyword('nested'));
    expect(typeof val).toBe('string');
  });

  it('errorFromForeign coerce function to string', () => {
    const e = new Error('fn');
    e.callback = () => {};
    const ev = errorFromForeign(e, null);
    expect(typeof ev.descriptor.get(keyword('callback'))).toBe('string');
  });

  it('errorFromForeign coerce null values', () => {
    const e = new Error('nulls');
    e.missing = null;
    const ev = errorFromForeign(e, null);
    expect(ev.descriptor.get(keyword('missing'))).toBe(null);
  });

  it('errorFromForeign coerce array values', () => {
    const e = new Error('arr');
    e.items = [1, 'two', null];
    const ev = errorFromForeign(e, null);
    expect(ev.descriptor.get(keyword('items'))).toEqual([1, 'two', null]);
  });

  it('errorFromForeign well-known prop already set by standard fields', () => {
    // 'message' is both well-known and set by standard — should not duplicate
    const e = new Error('test');
    const ev = errorFromForeign(e, null);
    expect(ev.descriptor.get(keyword('message'))).toBe('test');
  });
});
