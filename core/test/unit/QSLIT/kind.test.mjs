import { describe, it, expect } from 'vitest';
import { makeKeyword, formOf, makeTag, makeRegex, makePath, makeQuote, makeDoc, makeTagged, makeErrorValue, makeBinding } from '../../../src/types.mjs';
import { makeSet } from '../../../src/ordering.mjs';

it('names the form a writer of the core reads each value by', () => {
  expect(formOf(null)).toBe('null');
  expect(formOf(undefined)).toBe('null');
  expect(formOf(true)).toBe('boolean');
  expect(formOf(42)).toBe('number');
  expect(formOf('s')).toBe('string');
  expect(formOf(makeRegex('a', ''))).toBe('regex');
  expect(formOf(makeKeyword('k'))).toBe('keyword');
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

it('names the form of an error value `error`', () => {
  const errorVal = makeErrorValue(makeTag('Error'), new Map());
  expect(formOf(errorVal)).toBe('error');
});

describe('a binding record, a vector under a tag and a descriptor are values under a tag', async () => {
  it('reads a binding record as a value under a tag', async () => {
    const record = makeBinding({ name: makeKeyword('x'), value: 42 });
    expect(formOf(record)).toBe('underTag');
  });

  it('reads a vector under a tag as a value under a tag', async () => {
    const { makeTagged, makeTag } = await import('../../../src/types.mjs');
    const tagged = makeTagged(makeTag('Box'), [42]);
    expect(formOf(tagged)).toBe('underTag');
  });
});
