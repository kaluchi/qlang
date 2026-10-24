import { it, expect } from 'vitest';
import { parseDocument } from '../../src/features.mjs';

it('puts the diagnostic of a source refused after a line doc whose `~(` reads as no code where its reading stopped', () => {
  const { diagnostics } = parseDocument('[|~~| x ~(a\n 1 2 , 3]', 'test.qlang');
  expect(diagnostics.map(({ startLine, startChar, endLine, endChar }) => [startLine, startChar, endLine, endChar])).toEqual([[1, 5, 1, 6]]);
});

