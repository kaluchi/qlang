// Every link of every page of the catalog leads to the page of another
// name of the language [D108], [D121], [D175]: a link is a query a page
// names for its reader to follow, its payload applied answers a `::doc`,
// and that doc is a page some name of the root declares, not the page the
// link stands on. A verb renamed, a tag removed or an anchor misspelt under
// a link fails here, where a mention in the prose would have gone stale in
// silence. The pages are read at the address of every name the root holds.
// A snippet answers whatever the situation it reproduces gives, an error
// among them, and is held to reading as code alone: one that does not
// falls to the prose of its page, where the check of the catalog's prose
// finds it.

import { describe, it, expect, beforeAll } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printQuoteSource } from '../../src/quote.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { isDoc, isErrorValue, isValueClass } from '../../src/types.mjs';
import { rootAddressesOf } from '../helpers/root-addresses.mjs';

// The quote beneath the stack of tags of a link.
function queryOfLink(link) {
  let beneath = link;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return printQuoteSource(beneath);
}

// What is wrong with where a link leads, or null when it leads to the page
// of another name: its answer, the printed pages of the names of the root,
// and the printed page it stands on.
function wrongTarget(answer, declaredPages, ownPage) {
  if (!isDoc(answer)) return `answers ${isErrorValue(answer) ? `the error ${printValue(answer.tag)}` : 'no page'}`;
  const printed = printValue(answer);
  if (!declaredPages.has(printed)) return 'answers a doc no name declares';
  if (printed === ownPage) return 'leads back to its own page';
  return null;
}

// The links of every page, each with the address of the page it stands
// on, and the printed page of every name of the root.
let links;
let declaredPages;

beforeAll(async () => {
  links = [];
  declaredPages = new Set();
  for (const address of rootAddressesOf(await langRuntime())) {
    const page = await evalQuery(`${address} | doc`);
    if (!isDoc(page)) continue;
    declaredPages.add(printValue(page));
    for (const link of await evalQuery(`${address} | doc | links`)) links.push({ address, page: printValue(page), query: queryOfLink(link) });
  }
}, 120_000);

describe('the links of the catalog [D108], [D175]', () => {
  it('tells a dead link, a doc no name declares and a link to its own page', async () => {
    const pages = new Set([printValue(await evalQuery('::qlang/values | doc'))]);
    const ownPage = printValue(await evalQuery('::qlang | doc'));
    expect(wrongTarget(await evalQuery('::qlang/nothing | doc'), pages, ownPage)).toBe('answers the error ::any/doc/UnknownNameError');
    expect(wrongTarget(await evalQuery('::qlang/values | manifest'), pages, ownPage)).toBe('answers no page');
    expect(wrongTarget(await evalQuery('|~~ a page of no name ~~|'), pages, ownPage)).toBe('answers a doc no name declares');
    expect(wrongTarget(await evalQuery('::qlang/values | doc'), new Set([ownPage]), printValue(await evalQuery('::qlang/values | doc')))).toBe('answers a doc no name declares');
    expect(wrongTarget(await evalQuery('::qlang | doc'), new Set([ownPage]), ownPage)).toBe('leads back to its own page');
    expect(wrongTarget(await evalQuery('::qlang/values | doc'), pages, ownPage)).toBeNull();
  });

  it('every link leads to the page of another name of the language', async () => {
    const wrong = [];
    for (const link of links) {
      const target = wrongTarget(await evalQuery(link.query), declaredPages, link.page);
      if (target !== null) wrong.push(`${link.address}: ~(${link.query}) ${target}`);
    }
    expect(wrong).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
  }, 120_000);
});
