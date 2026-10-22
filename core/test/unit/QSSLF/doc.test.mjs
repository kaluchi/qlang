import { describe, it, expect, beforeAll } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { langRuntime } from '../../../src/runtime/index.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { rootAddressesOf } from '../../helpers/root-addresses.mjs';
import { declaredPagesOf, linksOf, wrongLinksOf, wrongTarget } from '../../helpers/catalog-pages.mjs';
import { isGroupStep } from '../../../src/steps.mjs';
import { stepOf, refusalOf } from '../../helpers/read-text.mjs';

let links;
let declaredPages;

beforeAll(async () => {
  const addresses = rootAddressesOf(await langRuntime());
  links = await linksOf(evalQuery, addresses);
  declaredPages = await declaredPagesOf(evalQuery, addresses);
}, 120_000);

describe('the links of the catalog', () => {
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
    expect(await wrongLinksOf(evalQuery, links, declaredPages)).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
  }, 120_000);
});

it('reads the quote of a doc under the tag of a group or of the fail track as a segment that computes nothing, in a literal and as a modifier', () => {
  const readAs = doc => [...doc].map(segment => (typeof segment === 'string' ? segment : 'code'));
  expect(isGroupStep(stepOf('|~~ see ::group~(add 1) ~~|')[1])).toBe(true);
  for (const source of ['[|~~ ::group~(add 1) ~~|]', '{:k |~~ ::group~(x) ~~|}', '::Box[|~~ ::group~(x) ~~|]', '!{:k |~~ ::group~(x) ~~|}']) {
    expect(refusalOf(source), source).toBeNull();
  }
  expect(readAs(stepOf('f |~~ ::fail~(x) ~~|').get('modifiers')[0])).toEqual(['code']);
  expect(readAs(stepOf('|~~ ~([|~~ ::group~(x) ~~|]) ~~|'))).toEqual(['code']);
});
