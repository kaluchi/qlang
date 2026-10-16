// Tests for error value type and its trail, deepEqual, the literal,
// error-convert.mjs.

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeErrorValue, formOf, makeTag, makeSet, makeFrame, makeTrail, isTrail, ErrorTrailNotFramesError } from '../../src/types.mjs';
import { quoteOfSource } from '../../src/quote.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { QlangError, CallUnknownNameError, declareRefusal } from '../../src/errors.mjs';

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces a frozen error under its tag that holds no :trail while no step raised it [QSERR#rest]', () => {
    const tag = makeTag('Oops');
    const errorVal = makeErrorValue(tag, new Map([['message', 'boom']]));
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.tag).toBe(tag);
    expect([...errorVal.descriptor.keys()]).toEqual(['message']);
  });

  it('takes an empty :trail out of the facts it is handed [QSERR#rest]', () => {
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'boom'], ['trail', Object.freeze([])]]));
    expect([...errorVal.descriptor.keys()]).toEqual(['message']);
  });

  it('keeps a trail it is handed as it is [QSERR#trail]', () => {
    const preTrail = makeTrail([makeFrame('x', quoteOfSource('add 1 | mul 2 | count'))]);
    const descriptor = new Map([['trail', preTrail]]);
    const errorVal = makeErrorValue(makeTag('Oops'), descriptor);
    expect(errorVal.descriptor).toBe(descriptor);
    expect(errorVal.descriptor.get('trail')).toBe(preTrail);
  });

  it('lays a plain vector of frames under ::trail [QSERR#trail]', () => {
    const frames = [makeFrame('x', quoteOfSource('add 1'))];
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'boom'], ['trail', frames]]));
    expect([...errorVal.descriptor.keys()]).toEqual(['message', 'trail']);
    expect(isTrail(errorVal.descriptor.get('trail'))).toBe(true);
    expect(deepEqual([...errorVal.descriptor.get('trail')], frames)).toBe(true);
  });

  it('fires ErrorTrailNotFramesError when :trail carries anything except a vector of frames [QSERR#trail]', async () => {
    // A step the error skips joins the steps of the last frame, so the
    // mint site refuses anything under `:trail` but a vector of frames.
    const refusedTrails = [
      [null, 'null'], [5, 'number'], [[1, 2], 'vec'], [quoteOfSource('| pre'), 'quote'], [makeSet([]), 'set'],
      [[new Map([['step', quoteOfSource('pre')]])], 'vec']
    ];
    const env = await langRuntime();
    for (const [refusedTrail, kindName] of refusedTrails) {
      let thrown = null;
      try { makeErrorValue(makeTag('Oops'), new Map([['trail', refusedTrail]])); }
      catch (mintErr) { thrown = mintErr; }
      expect(thrown).toBeInstanceOf(ErrorTrailNotFramesError);
      expect(thrown).toBeInstanceOf(QlangError);
      expect(thrown.name).toBe('TrailNotFramesError');
      expect(thrown.facts.actualValue).toBe(refusedTrail);
      expect(errorFromQlang(thrown, undefined, env).descriptor.get('actualType')).toEqual(makeTag(kindName));
    }
  });
});

// ── formOf ────────────────────────────────────────────────

describe('formOf for error values', () => {
  it('answers "error" for an error value', () => {
    const errorVal = makeErrorValue(makeTag('Error'), new Map());
    expect(formOf(errorVal)).toBe('error');
  });
});

// ── deepEqual ───────────────────────────────────────────────────

describe('deepEqual for error values', () => {
  it('compares error values by tag and descriptor', () => {
    const tag = makeTag('Oops');
    const errorVal1 = makeErrorValue(tag, new Map([['index', 1]]));
    const errorVal2 = makeErrorValue(tag, new Map([['index', 1]]));
    expect(deepEqual(errorVal1, errorVal2)).toBe(true);
  });

  it('separates errors carrying the same descriptor under different tags', () => {
    const desc = new Map([['index', 1]]);
    const left  = makeErrorValue(makeTag('Foo'), desc);
    const right = makeErrorValue(makeTag('Bar'), desc);
    expect(deepEqual(left, right)).toBe(false);
  });

  it('rejects error vs non-error', () => {
    const errorVal = makeErrorValue(makeTag('Oops'), new Map());
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
  it('reads back an error value raised, and a tag over each payload shape', async () => {
    const { makeTaggedInstance, makeSet } = await import('../../src/types.mjs');
    const { printValue } = await import('../../src/runtime/format.mjs');
    const { evalQuery } = await import('../../src/eval.mjs');
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'something went wrong']]));
    const restoredError = await evalQuery(`${printValue(errorVal)} | raise`);
    expect(isErrorValue(restoredError)).toBe(true);
    expect(restoredError.tag.name).toBe('Oops');
    expect(restoredError.descriptor.get('message')).toBe('something went wrong');
    const hostBuilt = [
      makeTaggedInstance(makeTag('Box'), [1, 2, 3]),
      makeTaggedInstance(makeTag('Keys'), makeSet([keyword('b'), keyword('a')])),
      makeTaggedInstance(makeTag('User'), new Map([['name', 'alice']])),
      makeTaggedInstance(makeTag('Count'), 42)
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
    const tagged = makeTaggedInstance(makeTag('A'), [1, 2, 3]);
    expect(deepEqual(tagged, [1, 2, 3])).toBe(false);
  });

  it('rejects tagged Map vs untagged Map with same entries', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTag('U'), new Map([['k', 1]]));
    expect(deepEqual(tagged, new Map([['k', 1]]))).toBe(false);
  });

  it('rejects a tag over a set vs the set with same members', async () => {
    const { makeTaggedInstance, makeSet } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTag('S'), makeSet([1, 2]));
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
  // [QSERR#rest], [QSERR#site].
  it('converts a refusal — its address the tag, its facts in the order the catalog declares them [QSERR#site]', async () => {
    const typeErr = new TestsProbeTypeError({ actualValue: 'the-value' });
    const errorVal = errorFromQlang(typeErr, 'the-subject', await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.descriptor;
    expect(typeErr).toBeInstanceOf(QlangError);
    expect(typeErr.name).toBe('ProbeTypeError');
    expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualType')).toEqual(makeTag('string'));
    expect([...desc.keys()]).toEqual(['actualType', 'actualValue']);
  });

  it('converts CallUnknownNameError with the facts its label declares', async () => {
    const unresolvedErr = new CallUnknownNameError({ addresses: makeSet([]), name: keyword('myName') });
    const errorVal = errorFromQlang(unresolvedErr, 42, await langRuntime());
    expect(errorVal.tag).toEqual(makeTag('call/UnknownNameError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['name', 'addresses']);
  });

  it('refuses a fact neither the label nor ::error declares, a defect of the runtime', async () => {
    const env = await langRuntime();
    expect(() => errorFromQlang(new TestsProbeTypeError({ undeclared: 1 }), 42, env)).toThrow(/carries :undeclared/);
  });

  it('converts a refusal whose site hands no facts to an error of no facts [QSERR#rest]', async () => {
    const errorVal = errorFromQlang(new TestsProbeTypeError(), 10, await langRuntime());
    expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
    expect([...errorVal.descriptor.keys()]).toEqual([]);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  // A host's failure carries the facts every host can give, its account
  // and the accounts of the failures beneath it [QSHST#answer], [QSERR#site].
  it('lifts a JavaScript error to its account under the tag of the language', async () => {
    const jsErr = new Error('something went wrong');
    const errorVal = errorFromForeign(jsErr, { location: null }, await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    expect(errorVal.tag).toEqual(makeTag('call/HostFailureError'));
    expect([...errorVal.descriptor.keys()]).toEqual(['message']);
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
    expect([...errorVal.descriptor.keys()]).toEqual(['message']);
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
    expect(errorVal.descriptor.get('actualType')).toEqual(makeTag('null'));
  });

  it('actualValue ref-equal to the subject of the step is dedup-skipped on lift', async () => {
    // Subject-shape error on a partial application: actualValue
    // (the JS context field) is the same reference as the subject
    // (the pipeValue the step received), which the first frame of the
    // trail names. errorFromQlang dedup skips the redundant lift; the
    // descriptor surface stays single-source-of-truth.
    const subject = new Map([['nested', 1]]);
    const typeErr = new TestsProbeTypeError({ actualValue: subject });
    const errorVal = errorFromQlang(typeErr, subject, await langRuntime());
    expect(errorVal.descriptor.has('actualValue')).toBe(false);
    expect(errorVal.descriptor.get('actualType').name).toBe('map');
  });

  it('actualValue distinct from the subject is preserved on lift (drill-down signal)', async () => {
    // Drill-down case (multi-segment path, element iteration,
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
