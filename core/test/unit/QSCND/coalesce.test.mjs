import { describe, it, expect } from 'vitest';
import { createSession } from '../../../src/session.mjs';

describe('runtime/control.mjs coalesce', () => {
  it('coalesce leaves the alternatives after the first value unrun', async () => {
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
