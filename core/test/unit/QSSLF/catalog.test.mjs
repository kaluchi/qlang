import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { proseQuotesOf } from '../../helpers/catalog-pages.mjs';
import { catalogReaders } from '../../helpers/catalog-readers.mjs';

describe('the laws of the catalog, run by runLaws', () => {
  it('no quote of a page is read as prose', async () => {
    // A quote the parser refuses reads as prose [QSSLF#doc], so a link or a
    // snippet a change of the grammar breaks leaves its page with no
    // failure to show; prose names code inside backticks alone.
    expect(await proseQuotesOf(evalQuery, await catalogReaders())).toEqual([]);
  }, 30000);
});
