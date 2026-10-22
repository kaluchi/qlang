import { it, expect } from 'vitest';
import { failingLawsOf, reportOfLaws } from '../../../core/test/helpers/catalog-pages.mjs';
import { answerOf, cliNames } from '../helpers/cli-session.mjs';

it('the catalog of the command line runs the laws of every name it declares to true', async () => {
  const failures = await failingLawsOf(answerOf, cliNames);
  expect(reportOfLaws(failures)).toBe('');
}, 60_000);
