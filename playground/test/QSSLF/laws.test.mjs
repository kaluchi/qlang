import { it, expect } from 'vitest';
import { failingLawsOf, reportOfLaws } from '../../../core/test/helpers/catalog-pages.mjs';
import { answerOf, stdioNames } from '../helpers/cli-notebook.mjs';

it('the catalog of the command line runs the laws of every name it declares to true', async () => {
  const failures = await failingLawsOf(answerOf, stdioNames);
  expect(reportOfLaws(failures)).toBe('');
}, 60_000);
