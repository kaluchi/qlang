// Every link of the catalog opens a page [D108], [D121]: a link is a
// query a name holds for its reader to follow, declared under it [D174],
// so a verb renamed or a tag removed under it fails here, where a mention
// in the prose would have gone stale in silence. The links are read at
// the address of every name the root holds.

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
  const addresses = rootAddressesOf(await langRuntime());
  const links = [];
  const snippets = [];
  for (const address of addresses) {
    for (const link of await evalQuery(`${address} | links | vals`)) links.push({ page: address, query: queryOfLink(link) });
    for (const snippet of await evalQuery(`${address} | snippets | vals`)) snippets.push({ page: address, query: queryOfLink(snippet) });
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
