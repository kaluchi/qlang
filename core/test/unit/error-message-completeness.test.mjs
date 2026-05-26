// Smoke test catching factory-builder messages that interpolate
// `undefined` because a throw site forgot to pass a destructured
// arg. The factories in `operand-errors.mjs` build messages
// through `({ key, length, … }) => `…${key}…`` templates — a
// throw site missing one of those slots produces a message like
// `/undefined — index out of bounds …` while the per-site error
// class still binds correctly, so existing conformance and unit
// tests (which compare descriptor shape, not `.message`) miss it.
// Gemini reviews keep catching the same shape — this test runs
// every error-producing conformance case through `evalQuery` and
// asserts the unwrapped `originalError.message` does not contain
// the literal substring `"undefined"`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue } from '../../src/types.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', 'conformance');
const conformanceFiles = readdirSync(conformanceDir, { recursive: true })
  .filter(f => f.endsWith('.jsonl'))
  .map(f => f.split(/[\\/]/).join('/'))
  .sort();

function loadConformanceCases() {
  const cases = [];
  for (const file of conformanceFiles) {
    const lines = readFileSync(join(conformanceDir, file), 'utf8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('//'));
    for (const line of lines) {
      const test = JSON.parse(line);
      cases.push({ file, ...test });
    }
  }
  return cases;
}

describe('factory-builder error messages — no `undefined` interpolation', () => {
  const cases = loadConformanceCases();
  for (const conformanceCase of cases) {
    it(`${conformanceCase.file}::${conformanceCase.name}`, async () => {
      const queryResult = await evalQuery(conformanceCase.query);
      if (!isErrorValue(queryResult)) return;
      const originalMessage = queryResult.originalError?.message;
      if (!originalMessage) return;
      expect(
        originalMessage.includes('undefined'),
        `${conformanceCase.file}::${conformanceCase.name} message contains "undefined": ${originalMessage}`
      ).toBe(false);
    });
  }
});

// Direct regression cases for the Gemini-reported sites — covers
// the JS `.message` surface that conformance descriptor-shape
// assertions miss when a key happens to be present but message
// rendering breaks on a different slot.
describe('ProjectionIndexOutOfBoundsError — Gemini round 4', () => {
  it('Vec out-of-bounds index — message renders /<key>', async () => {
    const queryResult = await evalQuery('[10 20 30] | /99');
    expect(isErrorValue(queryResult)).toBe(true);
    const originalMessage = queryResult.originalError.message;
    expect(originalMessage).toContain('/99');
    expect(originalMessage).not.toContain('undefined');
  });

  it('Set out-of-bounds index — message renders /<key>', async () => {
    const queryResult = await evalQuery('#[10 20 30] | /99');
    expect(isErrorValue(queryResult)).toBe(true);
    const originalMessage = queryResult.originalError.message;
    expect(originalMessage).toContain('/99');
    expect(originalMessage).not.toContain('undefined');
  });

  it('JsonArray out-of-bounds index — message renders /<key>', async () => {
    const queryResult = await evalQuery('::json[10 20 30] | /99');
    expect(isErrorValue(queryResult)).toBe(true);
    const originalMessage = queryResult.originalError.message;
    expect(originalMessage).toContain('/99');
    expect(originalMessage).not.toContain('undefined');
  });
});
