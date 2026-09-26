// Tests for error value type and its trail, deepEqual, codec, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeErrorValue, errorFromKindDescriptor, describeType, makeTagKeyword, makeSet, ErrorTrailNotVecError } from '../../src/types.mjs';
import { quoteOfSource } from '../../src/quote.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { toTaggedJSON, fromTaggedJSON } from '../../src/codec.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { QlangTypeError, UnresolvedIdentifierError } from '../../src/errors.mjs';
import { DivisionByZeroError } from '../../src/runtime/arith.mjs';

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces frozen error object with tag on JS-header and the empty :trail when descriptor lacks one', () => {
    // makeErrorValue takes the identity tag as a first-class arg
    // (rides on the JS-header `tag` slot, opaque to descriptor
    // projection) and enforces the invariant that every error
    // descriptor carries :trail — the empty path when no step has
    // raised the error or handed it on, otherwise the stops of its
    // path [D85]. The returned descriptor is a fresh Map (not the
    // caller's original input) when the input lacked :trail.
    const tag = makeTagKeyword('Oops');
    const descriptor = new Map([['message', 'boom']]);
    const errorVal = makeErrorValue(tag, descriptor);
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.tag).toBe(tag);
    expect(errorVal.descriptor.get('trail')).toEqual([]);
    expect(errorVal.descriptor.has('kind')).toBe(false);
  });

  it('preserves caller-supplied :trail in descriptor', () => {
    // When the caller already includes :trail in the descriptor
    // — typically a re-lifted descriptor carrying the path the fail
    // track read — makeErrorValue keeps the supplied value untouched
    // and skips the invariant-fill branch.
    const preTrail = Object.freeze([new Map([
      ['step', quoteOfSource('add 1')], ['subject', 'x'], ['skipped', quoteOfSource('mul 2 | count')]
    ])]);
    const descriptor = new Map([['trail', preTrail]]);
    const errorVal = makeErrorValue(makeTagKeyword('Oops'), descriptor);
    expect(errorVal.descriptor).toBe(descriptor);
    expect(errorVal.descriptor.get('trail')).toBe(preTrail);
  });

  it('fires ErrorTrailNotVecError when :trail carries anything except a vector of stops', () => {
    // `:trail` is runtime-owned — a step the error skips joins the
    // `:skipped` quote of the last stop, so the mint site refuses
    // anything under it but a vector of maps that hold one.
    const refusedTrails = [
      [null, 'null'], [5, 'number'], [[1, 2], 'vec'], [quoteOfSource('| pre'), 'quote'], [makeSet([]), 'set'],
      [[new Map([['step', quoteOfSource('pre')]])], 'vec']
    ];
    for (const [refusedTrail, kindName] of refusedTrails) {
      let thrown = null;
      try { makeErrorValue(makeTagKeyword('Oops'), new Map([['trail', refusedTrail]])); }
      catch (mintErr) { thrown = mintErr; }
      expect(thrown).toBeInstanceOf(ErrorTrailNotVecError);
      expect(thrown).toBeInstanceOf(QlangTypeError);
      expect(thrown.name).toBe('ErrorTrailNotVecError');
      expect(thrown.context.actualType).toEqual(makeTagKeyword(kindName));
      expect(thrown.context.actualValue).toBe(refusedTrail);
    }
  });
});

// ── errorFromKindDescriptor ─────────────────────────────────────
//
// Host-facing convenience for hosts (jdt, future bridges) that
// build descriptors keyword-by-keyword and place the per-site
// `::TagKeyword` under `:kind`. The helper extracts the tag and
// delegates to `makeErrorValue`, freeing the host site from
// repeating `makeErrorValue(d.get('kind'), d)` at every throw.

describe('errorFromKindDescriptor', () => {
  it('extracts the :kind TagKeyword and produces a tagged ErrorValue', () => {
    const tag = makeTagKeyword('CoverageNoActiveSession');
    const descriptor = new Map([
      ['kind',    tag],
      ['origin',  keyword('jdt/coverage')],
      ['message', 'No active coverage session — pin one via @coverage'],
    ]);
    const errorVal = errorFromKindDescriptor(descriptor);
    expect(isErrorValue(errorVal)).toBe(true);
    expect(errorVal.tag).toBe(tag);
    expect(errorVal.descriptor.get('origin')).toEqual(keyword('jdt/coverage'));
    expect(errorVal.descriptor.get('trail')).toEqual([]);
  });

  it('forwards opts.location and opts.originalError to makeErrorValue', () => {
    const tag = makeTagKeyword('BridgeNotResponding');
    const cause = new TypeError('socket hang up');
    const loc = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } };
    const descriptor = new Map([['kind', tag], ['message', 'down']]);
    const errorVal = errorFromKindDescriptor(descriptor, { location: loc, originalError: cause });
    expect(errorVal.location).toBe(loc);
    expect(errorVal.originalError).toBe(cause);
  });

});


// ── describeType ────────────────────────────────────────────────

describe('describeType for error values', () => {
  it('returns "Error" for error values', () => {
    const errorVal = makeErrorValue(makeTagKeyword('Error'), new Map());
    expect(describeType(errorVal)).toBe('Error');
  });
});

// ── deepEqual ───────────────────────────────────────────────────

describe('deepEqual for error values', () => {
  it('compares error values by tag and descriptor', () => {
    const tag = makeTagKeyword('Oops');
    const errorVal1 = makeErrorValue(tag, new Map([['index', 1]]));
    const errorVal2 = makeErrorValue(tag, new Map([['index', 1]]));
    expect(deepEqual(errorVal1, errorVal2)).toBe(true);
  });

  it('separates errors carrying the same descriptor under different tags', () => {
    const desc = new Map([['index', 1]]);
    const left  = makeErrorValue(makeTagKeyword('Foo'), desc);
    const right = makeErrorValue(makeTagKeyword('Bar'), desc);
    expect(deepEqual(left, right)).toBe(false);
  });

  it('rejects error vs non-error', () => {
    const errorVal = makeErrorValue(makeTagKeyword('Oops'), new Map());
    expect(deepEqual(errorVal, new Map([['kind', keyword('oops')]]))).toBe(false);
    expect(deepEqual(errorVal, null)).toBe(false);
    expect(deepEqual(errorVal, 42)).toBe(false);
  });
});

// ── codec ───────────────────────────────────────────────────────

describe('codec round-trips error values through tagged JSON', () => {
  it('round-trips an error value with tag preserved on the envelope', () => {
    const tag = makeTagKeyword('Oops');
    const descriptor = new Map([['message', 'something went wrong']]);
    const errorVal = makeErrorValue(tag, descriptor);
    const tagged = toTaggedJSON(errorVal);
    expect(tagged.$error.$tag).toBe('Oops');
    const restored = fromTaggedJSON(tagged);
    expect(isErrorValue(restored)).toBe(true);
    expect(deepEqual(errorVal, restored)).toBe(true);
    expect(restored.tag.name).toBe('Oops');
  });
});

describe('codec round-trips TaggedInstance through $tagged envelope', () => {
  // The TaggedInstance encoder envelopes identity on `$tag` and
  // recurses on the payload, so every overlay shape (Vec / Set /
  // Map) plus the opaque wrap-object scalar shape survives a
  // `JSON.stringify` round-trip. Each shape exercises a distinct
  // encoder branch — listed compactly here so coverage hits the
  // full quartet.
  it('round-trips tagged Vec (overlay on Array)', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Box'), [1, 2, 3]);
    const envelope = toTaggedJSON(tagged);
    expect(envelope.$tagged.$tag).toBe('Box');
    const restored = fromTaggedJSON(envelope);
    expect(deepEqual(restored, tagged)).toBe(true);
  });

  it('round-trips a tag over a set, the set its payload', async () => {
    const { makeTaggedInstance, makeSet } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Keys'), makeSet([keyword('b'), keyword('a')]));
    const envelope = toTaggedJSON(tagged);
    expect(envelope.$tagged.$tag).toBe('Keys');
    const restored = fromTaggedJSON(envelope);
    expect(deepEqual(restored, tagged)).toBe(true);
  });

  it('round-trips tagged Map (overlay on Map)', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('User'), new Map([['name', 'alice']]));
    const envelope = toTaggedJSON(tagged);
    expect(envelope.$tagged.$tag).toBe('User');
    const restored = fromTaggedJSON(envelope);
    expect(deepEqual(restored, tagged)).toBe(true);
  });

  it('round-trips tagged scalar (wrap-object shape)', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Count'), 42);
    const envelope = toTaggedJSON(tagged);
    expect(envelope.$tagged.$tag).toBe('Count');
    expect(envelope.$tagged.payload).toBe(42);
    const restored = fromTaggedJSON(envelope);
    expect(deepEqual(restored, tagged)).toBe(true);
    expect(restored.payload).toBe(42);
  });
});

describe('deepEqual respects TaggedInstance identity on Array / Map / Set', () => {
  // Tag mismatch on overlay-shape collections — same content,
  // different (or absent) header tag — must not compare equal.
  // Each branch (Array / Map / Set) gets its own assertion.
  it('rejects tagged Array vs untagged Array with same elements', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('A'), [1, 2, 3]);
    expect(deepEqual(tagged, [1, 2, 3])).toBe(false);
  });

  it('rejects tagged Map vs untagged Map with same entries', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('U'), new Map([['k', 1]]));
    expect(deepEqual(tagged, new Map([['k', 1]]))).toBe(false);
  });

  it('rejects a tag over a set vs the set with same members', async () => {
    const { makeTaggedInstance, makeSet } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('S'), makeSet([1, 2]));
    expect(deepEqual(tagged, makeSet([1, 2]))).toBe(false);
  });
});

// ── errorFromQlang ──────────────────────────────────────────────

describe('errorFromQlang', () => {
  // The facts of the site come before the trail, and the step and the
  // subject leave the descriptor for the first stop of the trail [D85].
  it('converts QlangTypeError — tag on JS-header, the facts of its site before the trail', () => {
    const typeErr = new QlangTypeError('bad type', {
      actualType: { name: 'string' },
      actualValue: 'the-value'
    });
    const errorVal = errorFromQlang(typeErr, 'the-subject');
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(typeErr.kind).toBe('typeError');
    expect(errorVal.tag).toEqual(makeTagKeyword('QlangTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualType')).toEqual({ name: 'string' });
    expect([...desc.keys()]).toEqual(['actualValue', 'actualType', 'trail']);
  });

  it('converts UnresolvedIdentifierError with its name before the trail', () => {
    const unresolvedErr = new UnresolvedIdentifierError({ identifierName: 'myName' });
    const errorVal = errorFromQlang(unresolvedErr, 42);
    expect(unresolvedErr.kind).toBe('unresolvedIdentifier');
    expect(errorVal.tag).toEqual(makeTagKeyword('UnresolvedIdentifierError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['identifierName', 'trail']);
  });

  it('converts DivisionByZeroError, whose site has no facts, to the trail alone', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr, 10);
    expect(divErr.kind).toBe('numericDomain');
    expect(errorVal.tag).toEqual(makeTagKeyword('DivisionByZeroError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['trail']);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  it('converts plain JS Error — tag on JS-header, message, operand, originalError', () => {
    const jsErr = new Error('something went wrong');
    const astNode = { text: 'myOp' };
    const errorVal = errorFromForeign(jsErr, astNode);
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(desc.has('category')).toBe(false);
    expect(desc.has('kind')).toBe(false);
    expect(errorVal.tag).toEqual(makeTagKeyword('ForeignFailureError'));
    expect(desc.get('name')).toBe('Error');
    expect(desc.get('message')).toBe('something went wrong');
    expect(desc.get('operand')).toBe('myOp');
    expect(errorVal.originalError).toBe(jsErr);
    expect([...desc.keys()]).toEqual(['message', 'name', 'stack', 'operand', 'trail']);
  });

  it('extracts well-known properties', () => {
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
    expect(desc.get('status')).toBe(404);
    expect(desc.get('code')).toBe('NOT_FOUND');
  });

  it('collects cause chain', () => {
    const cause2 = new Error('root cause');
    const cause1 = new Error('intermediate', { cause: cause2 });
    const top = new Error('top error', { cause: cause1 });
    const errorVal = errorFromForeign(top, null);
    const causes = errorVal.descriptor.get('causes');
    expect(Array.isArray(causes)).toBe(true);
    expect(causes).toHaveLength(2);
    // Cause-chain entries are inert Map records: each carries
    // `:name`, the JS-side cause's class, plus `:message`.
    expect(causes[0].get('message')).toBe('intermediate');
    expect(causes[0].get('name')).toBe('Error');
    expect(causes[1].get('message')).toBe('root cause');
  });

  it('extracts enumerable own props', () => {
    const foreignErr = new Error('custom');
    foreignErr.customField = 'myValue';
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get('customField')).toBe('myValue');
  });

  it('coerces nested objects to Maps', () => {
    const foreignErr = new Error('nested');
    foreignErr.meta = { type: 'context', value: 42 };
    const errorVal = errorFromForeign(foreignErr, null);
    const meta = errorVal.descriptor.get('meta');
    expect(meta instanceof Map).toBe(true);
    expect(meta.get('type')).toBe('context');
    expect(meta.get('value')).toBe(42);
  });

  it('coerces Error nested in context to Map carrying :name', () => {
    const inner = new TypeError('inner');
    const foreignErr = new Error('outer');
    foreignErr.wrapped = inner;
    const errorVal = errorFromForeign(foreignErr, null);
    const wrapped = errorVal.descriptor.get('wrapped');
    expect(wrapped instanceof Map).toBe(true);
    expect(wrapped.get('message')).toBe('inner');
    expect(wrapped.get('name')).toBe('TypeError');
  });

  it('coerces non-object to string', () => {
    const foreignErr = new Error('fail');
    foreignErr.fn = () => {};
    const errorVal = errorFromForeign(foreignErr, null);
    expect(typeof errorVal.descriptor.get('fn')).toBe('string');
  });
});

describe('error-convert coercion edge cases', () => {
  it('coerces qlang keyword values through errorFromQlang context', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', myKey: keyword('val') });
    const errorVal = errorFromQlang(typeErr, 42);
    expect(errorVal.descriptor.get('myKey')).toEqual(keyword('val'));
  });

  it('coerces null/undefined context values to null', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', nullField: null, undefField: undefined });
    const errorVal = errorFromQlang(typeErr, null);
    expect(errorVal.descriptor.get('nullField')).toBe(null);
  });

  it('coerces array context values to Vec', () => {
    const typeErr = new QlangTypeError('test', { site: 'X', items: [1, 'two', true] });
    const errorVal = errorFromQlang(typeErr, []);
    const items = errorVal.descriptor.get('items');
    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([1, 'two', true]);
  });

  it('errorFromForeign with deeply nested cause chain caps at 8', () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    const errorVal = errorFromForeign(current, null);
    const causes = errorVal.descriptor.get('causes');
    expect(causes.length).toBe(8);
  });

  it('errorFromQlang takes the tag from the error name', () => {
    const typeErr = new QlangTypeError('a bare type error', {});
    const errorVal = errorFromQlang(typeErr, [1, 2]);
    expect(errorVal.tag.name).toBe('QlangTypeError');
  });

  it('errorFromQlang without context field', () => {
    const divErr = new DivisionByZeroError();
    const errorVal = errorFromQlang(divErr, 10);
    expect(errorVal.tag.name).toBe('DivisionByZeroError');
    expect(errorVal.descriptor.has('category')).toBe(false);
  });

  it('errorFromForeign without cause (no causes field)', () => {
    const foreignErr = new Error('no cause');
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.has('causes')).toBe(false);
  });

  it('errorFromForeign coerce depth limit returns string', () => {
    const foreignErr = new Error('deep');
    let obj = { leaf: true };
    for (let i = 0; i < 8; i++) obj = { nested: obj };
    foreignErr.deep = obj;
    const errorVal = errorFromForeign(foreignErr, null);
    let val = errorVal.descriptor.get('deep');
    while (val instanceof Map && val.has('nested')) val = val.get('nested');
    expect(typeof val).toBe('string');
  });

  it('errorFromForeign coerce function to string', () => {
    const foreignErr = new Error('fn');
    foreignErr.callback = () => {};
    const errorVal = errorFromForeign(foreignErr, null);
    expect(typeof errorVal.descriptor.get('callback')).toBe('string');
  });

  it('errorFromForeign coerce null values', () => {
    const foreignErr = new Error('nulls');
    foreignErr.missing = null;
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get('missing')).toBe(null);
  });

  it('errorFromForeign coerce array values', () => {
    const foreignErr = new Error('arr');
    foreignErr.items = [1, 'two', null];
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get('items')).toEqual([1, 'two', null]);
  });

  it('errorFromForeign well-known prop already set by standard fields', () => {
    const foreignErr = new Error('test');
    const errorVal = errorFromForeign(foreignErr, null);
    expect(errorVal.descriptor.get('message')).toBe('test');
  });

  it('actualValue ref-equal to the subject of the step is dedup-skipped on lift', () => {
    // Subject-shape error on a partial application: actualValue
    // (the JS context field) is the same reference as the subject
    // (the pipeValue the step received), which the first stop of the
    // trail names. errorFromQlang dedup skips the redundant lift; the
    // descriptor surface stays single-source-of-truth.
    const subject = { nested: 1 };
    const typeErr = new QlangTypeError('subject error', { actualValue: subject, actualType: keyword('map') });
    const errorVal = errorFromQlang(typeErr, subject);
    expect(errorVal.descriptor.has('actualValue')).toBe(false);
    expect(errorVal.descriptor.get('actualType').name).toBe('map');
  });

  it('actualValue distinct from the subject is preserved on lift (drill-down signal)', () => {
    // Drill-down case (multi-segment projection, element iteration,
    // full-application captured-arg): actualValue is a different
    // reference. Lift proceeds so the presence-of-actualValue
    // surfaces «look here for the offending sub-value».
    const container = [1, 'x', 3];
    const drilled = 'x';
    const typeErr = new QlangTypeError('element error', { actualValue: drilled, actualType: keyword('string'), index: 1 });
    const errorVal = errorFromQlang(typeErr, container);
    expect(errorVal.descriptor.get('actualValue')).toBe(drilled);
    expect(errorVal.descriptor.get('index')).toBe(1);
  });
});
