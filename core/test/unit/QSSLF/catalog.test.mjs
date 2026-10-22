import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { proseQuotesOf } from '../../helpers/catalog-pages.mjs';
import { catalogReaders } from '../../helpers/catalog-readers.mjs';

it('no quote of a page is read as prose', async () => {
  // [QSSLF#doc]
  expect(await proseQuotesOf(evalQuery, await catalogReaders())).toEqual([]);
}, 30000);
