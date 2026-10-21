import { describe, it, expect } from 'vitest';
import { failingLawsOf, reportOfLaws } from '../../../core/test/helpers/catalog-pages.mjs';
import { answerOf, cliNames } from '../helpers/cli-session.mjs';

describe('the catalog of the command line', () => {
  it('runs the laws of every name it declares to true', async () => {
    const failures = await failingLawsOf(answerOf, cliNames);
    expect(reportOfLaws(failures)).toBe('');
  }, 60_000);
});
