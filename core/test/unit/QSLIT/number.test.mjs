import { it, expect } from 'vitest';
import { printValue } from '../../../src/print-value.mjs';

it('prints a number at the bounds of the doubles by its exponent', () => {
  expect(printValue(1e308)).toBe('1e+308');
  expect(printValue(-1e308)).toBe('-1e+308');
});
