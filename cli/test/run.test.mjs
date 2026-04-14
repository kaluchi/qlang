// run.mjs is a one-line composition over createSession + evalCell.
// One success-path test confirms the seam holds end-to-end and that
// the cell entry shape matches what render.mjs expects to consume.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';

describe('runQuery', () => {
  it('materialises a cell entry from a freshly seeded session', async () => {
    const cellEntry = await runQuery('[1 2 3] | sum');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(6);
    expect(cellEntry.source).toBe('[1 2 3] | sum');
  });

  it('captures a parse error on the cell entry without throwing', async () => {
    const cellEntry = await runQuery('[1 2');
    expect(cellEntry.error).not.toBeNull();
    expect(cellEntry.result).toBeNull();
  });
});
