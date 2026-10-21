import { describe, it, expect } from 'vitest';
import { printValue } from '../../../src/print-value.mjs';

describe('the finite-double domain holds at every render seam', () => {
  it('prints a number at the bounds of the doubles by its exponent', () => {
    expect(printValue(1e308)).toBe('1e+308');
    expect(printValue(-1e308)).toBe('-1e+308');
  });
});
