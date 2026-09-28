// Every link of every page of the catalog answers without an error
// [D108]: a link is a query a page names for its reader to follow, so a
// verb renamed or a tag removed under it fails here, where a mention in
// the prose would have gone stale in silence. The pages are read at the
// address of each verb of each noun and at the name of each tag the
// catalog declares.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printQuoteSource } from '../../src/quote.mjs';
import { isErrorValue, isValueClass } from '../../src/types.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { catalogEntriesOf } from '../helpers/catalog-entries.mjs';

// The quote beneath the stack of tags of a link.
function queryOfLink(link) {
  let beneath = link;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return printQuoteSource(beneath);
}

async function catalogLinks() {
  const tagNames = catalogEntriesOf(await langRuntime(), { tags: true }).map(entry => entry.get('name'));
  const pageNames = [...await evalQuery('::qlang | manifest * manifest | flat'), ...await evalQuery(`[${tagNames.join(' ')}]`)];
  const links = [];
  for (const pageName of pageNames) {
    const pageLinks = await evalQuery(`${printValue(pageName)} | doc | links`);
    for (const link of pageLinks) links.push({ page: printValue(pageName), query: queryOfLink(link) });
  }
  return links;
}

describe('the links of the catalog [D108]', () => {
  it('every link answers without an error', async () => {
    const links = await catalogLinks();
    const dead = [];
    for (const link of links) {
      if (isErrorValue(await evalQuery(link.query))) dead.push(`${link.page}: ${link.query}`);
    }
    expect(dead).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
  }, 60_000);
});
