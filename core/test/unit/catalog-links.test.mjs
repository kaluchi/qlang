// Every link of every page of the catalog opens a page [D108], [D121]:
// a link is a query a page names for its reader to follow, so a
// verb renamed or a tag removed under it fails here, where a mention in
// the prose would have gone stale in silence. The pages are read at the
// address of every name the root holds.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printQuoteSource } from '../../src/quote.mjs';
import { isDoc, isErrorValue, isValueClass } from '../../src/types.mjs';
import { rootAddressesOf } from '../helpers/root-addresses.mjs';

// The quote beneath the stack of tags of a link.
function queryOfLink(link) {
  let beneath = link;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return printQuoteSource(beneath);
}

async function catalogLinks() {
  const pageQueries = rootAddressesOf(await langRuntime()).map(address => `${address} | doc`);
  const links = [];
  const snippets = [];
  for (const pageQuery of pageQueries) {
    for (const link of await evalQuery(`${pageQuery} | links`)) links.push({ page: pageQuery, query: queryOfLink(link) });
    for (const snippet of await evalQuery(`${pageQuery} | snippets`)) snippets.push({ page: pageQuery, query: queryOfLink(snippet) });
  }
  return { links, snippets };
}

describe('the links of the catalog [D108]', () => {
  it('every link opens a page', async () => {
    const { links } = await catalogLinks();
    const dead = [];
    for (const link of links) {
      if (!isDoc(await evalQuery(link.query))) dead.push(`${link.page}: ${link.query}`);
    }
    expect(dead).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
  }, 60_000);

  it('every snippet answers without an error [D122]', async () => {
    const { snippets } = await catalogLinks();
    const failing = [];
    for (const snippet of snippets) {
      if (isErrorValue(await evalQuery(snippet.query))) failing.push(`${snippet.page}: ${snippet.query}`);
    }
    expect(failing).toEqual([]);
    expect(snippets.length).toBeGreaterThan(0);
  }, 60_000);
});
