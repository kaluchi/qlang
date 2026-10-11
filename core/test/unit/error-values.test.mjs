// Tests for error value type and its trail, deepEqual, the literal, error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeErrorValue, formOf, makeTagKeyword, makeSet, ErrorTrailNotVecError } from '../../src/types.mjs';
import { quoteOfSource } from '../../src/quote.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { QlangError, CallUnknownNameError, declareRefusal } from '../../src/errors.mjs';

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

  it('fires ErrorTrailNotVecError when :trail carries anything except a vector of stops', async () => {
    // `:trail` is runtime-owned — a step the error skips joins the
    // `:skipped` quote of the last stop, so the mint site refuses
    // anything under it but a vector of maps that hold one.
    const refusedTrails = [
      [null, 'null'], [5, 'number'], [[1, 2], 'vec'], [quoteOfSource('| pre'), 'quote'], [makeSet([]), 'set'],
      [[new Map([['step', quoteOfSource('pre')]])], 'vec']
    ];
    const env = await langRuntime();
    for (const [refusedTrail, kindName] of refusedTrails) {
      let thrown = null;
      try { makeErrorValue(makeTagKeyword('Oops'), new Map([['trail', refusedTrail]])); }
      catch (mintErr) { thrown = mintErr; }
      expect(thrown).toBeInstanceOf(ErrorTrailNotVecError);
      expect(thrown).toBeInstanceOf(QlangError);
      expect(thrown.name).toBe('TrailNotVecError');
      expect(thrown.facts.actualValue).toBe(refusedTrail);
      expect(errorFromQlang(thrown, undefined, env).descriptor.get('actualType')).toEqual(makeTagKeyword(kindName));
    }
  });
});

// ── formOf ────────────────────────────────────────────────

describe('formOf for error values', () => {
  it('answers "error" for an error value', () => {
    const errorVal = makeErrorValue(makeTagKeyword('Error'), new Map());
    expect(formOf(errorVal)).toBe('error');
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

// ── the literal ─────────────────────────────────────────────────

describe('the literal reads back error values and tagged instances', () => {
  // `printValue` writes the literal the parser reads, so every value
  // the host builds survives the trip; each shape exercises a distinct
  // branch of the printer.
  it('reads back an error value, and a tag over each payload shape', async () => {
    const { makeTaggedInstance, makeSet } = await import('../../src/types.mjs');
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { evalQuery } = await import('../../src/eval.mjs');
    const errorVal = makeErrorValue(makeTagKeyword('Oops'), new Map([['message', 'something went wrong']]));
    const restoredError = await evalQuery(printValue(errorVal));
    expect(isErrorValue(restoredError)).toBe(true);
    expect(restoredError.tag.name).toBe('Oops');
    expect(restoredError.descriptor.get('message')).toBe('something went wrong');
    const hostBuilt = [
      makeTaggedInstance(makeTagKeyword('Box'), [1, 2, 3]),
      makeTaggedInstance(makeTagKeyword('Keys'), makeSet([keyword('b'), keyword('a')])),
      makeTaggedInstance(makeTagKeyword('User'), new Map([['name', 'alice']])),
      makeTaggedInstance(makeTagKeyword('Count'), 42)
    ];
    for (const value of hostBuilt) {
      expect(deepEqual(await evalQuery(printValue(value)), value)).toBe(true);
    }
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

// A refusal no page of the catalog declares facts for: the facts it
// carries are those every refusal shares under `::error`.
const TestsProbeTypeError = declareRefusal('tests/ProbeTypeError');

describe('errorFromQlang', () => {
  // The facts of the site come in the order the catalog declares them,
  // its label's first and those of `::error` after, and the trail last
  // [D85], [D172].
  it('converts a refusal — its address the tag, its facts in the order the catalog declares them [D158]', async () => {
    const typeErr = new TestsProbeTypeError({ actualValue: 'the-value' });
    const errorVal = errorFromQlang(typeErr, 'the-subject', await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(typeErr).toBeInstanceOf(QlangError);
    expect(typeErr.name).toBe('ProbeTypeError');
    expect(errorVal.tag).toEqual(makeTagKeyword('tests/ProbeTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualType')).toEqual(makeTagKeyword('string'));
    expect([...desc.keys()]).toEqual(['actualType', 'actualValue', 'trail']);
  });

  it('converts CallUnknownNameError with the facts its label declares before the trail', async () => {
    const unresolvedErr = new CallUnknownNameError({ addresses: makeSet([]), name: keyword('myName') });
    const errorVal = errorFromQlang(unresolvedErr, 42, await langRuntime());
    expect(errorVal.tag).toEqual(makeTagKeyword('call/UnknownNameError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['name', 'addresses', 'trail']);
  });

  it('refuses a fact neither the label nor ::error declares, a defect of the runtime', async () => {
    const env = await langRuntime();
    expect(() => errorFromQlang(new TestsProbeTypeError({ undeclared: 1 }), 42, env)).toThrow(/carries :undeclared/);
  });

  it('converts a refusal whose site hands no facts to the trail alone', async () => {
    const errorVal = errorFromQlang(new TestsProbeTypeError(), 10, await langRuntime());
    expect(errorVal.tag).toEqual(makeTagKeyword('tests/ProbeTypeError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['trail']);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  // A host's failure carries the facts every host can give, its account
  // and the accounts of the failures beneath it [D7], [D172].
  it('lifts a JavaScript error to its account under the tag of the language', async () => {
    const jsErr = new Error('something went wrong');
    const errorVal = errorFromForeign(jsErr, { location: null }, await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    expect(errorVal.tag).toEqual(makeTagKeyword('call/HostFailureError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['message', 'trail']);
    expect(errorVal.descriptor.get('message')).toBe('something went wrong');
    expect(errorVal.originalError).toBe(jsErr);
  });

  it('leaves the stack, the class and the fields of the host error with the host', async () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const errorVal = errorFromForeign(new AppError(), null, await langRuntime());
    expect([...errorVal.descriptor.keys()]).toEqual(['message', 'trail']);
    expect(errorVal.originalError.code).toBe('NOT_FOUND');
  });

  it('recounts the accounts of the failures beneath it, outermost first', async () => {
    const top = new Error('top error', { cause: new Error('intermediate', { cause: 'root cause' }) });
    const errorVal = errorFromForeign(top, null, await langRuntime());
    expect(errorVal.descriptor.get('causes')).toEqual(['intermediate', 'root cause']);
  });

  it('recounts eight failures beneath it at most', async () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    expect(errorFromForeign(current, null, await langRuntime()).descriptor.get('causes')).toHaveLength(8);
  });

  it('gives no causes where none stands beneath it', async () => {
    const env = await langRuntime();
    expect(errorFromForeign(new Error('no cause'), null, env).descriptor.has('causes')).toBe(false);
    expect(errorFromForeign(new Error('a null cause', { cause: null }), null, env).descriptor.has('causes')).toBe(false);
  });

  it('takes a thrown value that is no error by its text', async () => {
    expect(errorFromForeign('a bare string', null, await langRuntime()).descriptor.get('message')).toBe('a bare string');
  });
});

describe('error-convert coercion edge cases', () => {
  it('leaves out a fact its site hands as undefined', async () => {
    const typeErr = new TestsProbeTypeError({ index: undefined, actualValue: null });
    const errorVal = errorFromQlang(typeErr, 42, await langRuntime());
    expect(errorVal.descriptor.has('index')).toBe(false);
    expect(errorVal.descriptor.get('actualValue')).toBe(null);
    expect(errorVal.descriptor.get('actualType')).toEqual(makeTagKeyword('null'));
  });

  it('actualValue ref-equal to the subject of the step is dedup-skipped on lift', async () => {
    // Subject-shape error on a partial application: actualValue
    // (the JS context field) is the same reference as the subject
    // (the pipeValue the step received), which the first stop of the
    // trail names. errorFromQlang dedup skips the redundant lift; the
    // descriptor surface stays single-source-of-truth.
    const subject = new Map([['nested', 1]]);
    const typeErr = new TestsProbeTypeError({ actualValue: subject });
    const errorVal = errorFromQlang(typeErr, subject, await langRuntime());
    expect(errorVal.descriptor.has('actualValue')).toBe(false);
    expect(errorVal.descriptor.get('actualType').name).toBe('map');
  });

  it('actualValue distinct from the subject is preserved on lift (drill-down signal)', async () => {
    // Drill-down case (multi-segment projection, element iteration,
    // full-application captured-arg): actualValue is a different
    // reference. Lift proceeds so the presence-of-actualValue
    // surfaces «look here for the offending sub-value».
    const container = [1, 'x', 3];
    const drilled = 'x';
    const typeErr = new TestsProbeTypeError({ actualValue: drilled, index: 1 });
    const errorVal = errorFromQlang(typeErr, container, await langRuntime());
    expect(errorVal.descriptor.get('actualValue')).toBe(drilled);
    expect(errorVal.descriptor.get('index')).toBe(1);
  });
});
