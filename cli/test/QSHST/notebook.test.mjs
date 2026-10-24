import { it, expect } from 'vitest';
import { isErrorValue } from '@kaluchi/qlang-core';
import { runQuery } from '../../src/run.mjs';
import { captureIoContext } from '../helpers/captured-streams.mjs';

it('answers a query as a cell of a fresh notebook', async () => {
  const cellEntry = await runQuery('[1 2 3] | sum', captureIoContext());
  expect(cellEntry.defect).toBeNull();
  expect(cellEntry.result).toBe(6);
  expect(cellEntry.source).toBe('[1 2 3] | sum');
});

it('answers a query that does not parse by its failure, the cell no defect', async () => {
  const cellEntry = await runQuery('[1 2', captureIoContext());
  expect(cellEntry.defect).toBeNull();
  expect(isErrorValue(cellEntry.result)).toBe(true);
  expect(cellEntry.result.tag.name).toBe('quote/ParseError');
});
