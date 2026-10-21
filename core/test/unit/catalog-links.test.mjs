// Every link of every page of the catalog leads to the page of another
// name of the language [QSSLF#doc]: a link is a query a page
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
import { evalQuery } from '../../src/session.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/print-value.mjs';
import { rootAddressesOf } from '../helpers/root-addresses.mjs';
import { declaredPagesOf, linksOf, wrongLinksOf, wrongTarget } from '../helpers/catalog-pages.mjs';

// The links of every page, each with the address of the page it stands
// on, and the printed page of every name of the root.
let links;
let declaredPages;

beforeAll(async () => {
  const addresses = rootAddressesOf(await langRuntime());
  links = await linksOf(evalQuery, addresses);
  declaredPages = await declaredPagesOf(evalQuery, addresses);
}, 120_000);

describe('the links of the catalog', () => {
  it('[QSSLF#doc] tells a dead link, a doc no name declares and a link to its own page', async () => {
    const pages = new Set([printValue(await evalQuery('::qlang/values | doc'))]);
    const ownPage = printValue(await evalQuery('::qlang | doc'));
    expect(wrongTarget(await evalQuery('::qlang/nothing | doc'), pages, ownPage)).toBe('answers the error ::any/doc/UnknownNameError');
    expect(wrongTarget(await evalQuery('::qlang/values | manifest'), pages, ownPage)).toBe('answers no page');
    expect(wrongTarget(await evalQuery('|~~ a page of no name ~~|'), pages, ownPage)).toBe('answers a doc no name declares');
    expect(wrongTarget(await evalQuery('::qlang/values | doc'), new Set([ownPage]), printValue(await evalQuery('::qlang/values | doc')))).toBe('answers a doc no name declares');
    expect(wrongTarget(await evalQuery('::qlang | doc'), new Set([ownPage]), ownPage)).toBe('leads back to its own page');
    expect(wrongTarget(await evalQuery('::qlang/values | doc'), pages, ownPage)).toBeNull();
  });

  it('[QSSLF#doc] every link leads to the page of another name of the language', async () => {
    expect(await wrongLinksOf(evalQuery, links, declaredPages)).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
  }, 120_000);
});
