// The rare branches of the runtime's modules that the laws of the catalog
// and the conformance cases leave out, a `describe` for each module: the
// forms of values, `source` and the verbs of control.
// The rules it holds: [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import {
  keyword,
  formOf,
  isSet,
  makeTag,
  makeRegex,
  makePath,
  makeQuote,
  makeDoc,
  makeTagged,
  makeErrorValue
} from '../../src/types.mjs';
import { makeSet } from '../../src/ordering.mjs';

describe('types.mjs', () => {
  it('[QSLIT#kind] formOf names the form of every value', () => {
    expect(formOf(null)).toBe('null');
    expect(formOf(undefined)).toBe('null');
    expect(formOf(true)).toBe('boolean');
    expect(formOf(42)).toBe('number');
    expect(formOf('s')).toBe('string');
    expect(formOf(makeRegex('a', ''))).toBe('regex');
    expect(formOf(keyword('k'))).toBe('keyword');
    expect(formOf(makePath(['a']))).toBe('path');
    expect(formOf(makeTag('T'))).toBe('tag');
    expect(formOf([])).toBe('vec');
    expect(formOf(new Map())).toBe('map');
    expect(formOf(makeSet([]))).toBe('set');
    expect(formOf(makeQuote([]))).toBe('quote');
    expect(formOf(makeDoc(['a']))).toBe('doc');
    expect(formOf(makeTagged(makeTag('Box'), 1))).toBe('underTag');
    expect(formOf(makeErrorValue(makeTag('T'), new Map()))).toBe('error');
  });

  it('[QSORD#set] isSet tells a set from a vector', () => {
    expect(isSet(makeSet([]))).toBe(true);
    expect(isSet([])).toBe(false);
  });
});

describe('source on a declaration of it', () => {
  // `source` reads the declaration of `it` under the name it declares, as written [QSSLF#axis].
  it('[QSSLF#axis] source on a declaration of it answers the declaration', async () => {
    const source = await evalQuery('42 | :snap it | ::snap | source | toString');
    expect(source).toBe(':snap it');
  });
});

describe('runtime/control.mjs coalesce', () => {
  it('[QSCND#coalesce] coalesce leaves the alternatives after the first value unrun', async () => {
    // A verb of the host counts its runs: the walk ends at `/a`, a value,
    // and reaches the verb where `/b` fails.
    let runs = 0;
    const counting = await createSession({
      sources: [{
        uri: 'tests/counted',
        source: ':any/counted ::builtin{}',
        primitives: { 'any/counted': subject => { runs++; return subject; } }
      }]
    });
    expect((await counting.evalCell('{:a 1} | coalesce /a ~(counted)')).result).toBe(1);
    expect(runs).toBe(0);
    await counting.evalCell('{:a 1} | coalesce /b ~(counted)');
    expect(runs).toBe(1);
  });
});
