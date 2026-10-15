// The checks a catalog's pages are held to, over the addresses of the names a
// test walks and a query answered where they live, the root of the language or
// the session of a host: the laws of each name answer true [QSSLF#laws], every
// link of a page leads to the page of another name [QSSLF#doc], and no quote
// of a page falls to its prose, where a link a change of the grammar breaks
// would go stale in silence [QSSLF#doc].

import { printQuoteSource } from '../../src/quote.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { isDoc, isErrorValue, isValueClass } from '../../src/types.mjs';

// The prose of a page with its code spans taken out: a `~(` left in it is
// a quote the parser refused, which reads as prose [QSSLF#doc].
export const quoteInProse = prose => prose.replace(/`[^`]*`/g, '').includes('~(');

function printed(value) {
  try { return printValue(value); }
  catch { return JSON.stringify(value); }
}

// The quote beneath the stack of tags of a link.
function queryOfLink(link) {
  let beneath = link;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return printQuoteSource(beneath);
}

// What is wrong with where a link leads, or null when it leads to the page
// of another name: its answer, the printed pages of the names, and the
// printed page it stands on.
export function wrongTarget(answer, declaredPages, ownPage) {
  if (!isDoc(answer)) return `answers ${isErrorValue(answer) ? `the error ${printValue(answer.tag)}` : 'no page'}`;
  const page = printValue(answer);
  if (!declaredPages.has(page)) return 'answers a doc no name declares';
  if (page === ownPage) return 'leads back to its own page';
  return null;
}

// The printed page of every name among the addresses that declares one.
export async function declaredPagesOf(answerOf, addresses) {
  const pages = new Set();
  for (const address of addresses) {
    const page = await answerOf(`${address} | doc !| null`);
    if (isDoc(page)) pages.add(printValue(page));
  }
  return pages;
}

// The links of the pages of the names, each with the address and the
// printed page it stands on and the query it names.
export async function linksOf(answerOf, addresses) {
  const links = [];
  for (const address of addresses) {
    const page = await answerOf(`${address} | doc !| null`);
    if (!isDoc(page)) continue;
    for (const link of await answerOf(`${address} | doc | links`)) links.push({ address, page: printValue(page), query: queryOfLink(link) });
  }
  return links;
}

// Each link that leads nowhere the page of another name stands, told.
export async function wrongLinksOf(answerOf, links, declaredPages) {
  const wrong = [];
  for (const link of links) {
    const target = wrongTarget(await answerOf(link.query), declaredPages, link.page);
    if (target !== null) wrong.push(`${link.address}: ~(${link.query}) ${target}`);
  }
  return wrong;
}

// The names among the addresses whose page holds a quote in its prose.
export async function proseQuotesOf(answerOf, addresses) {
  const holding = [];
  for (const address of addresses) {
    const prose = await answerOf(`${address} | doc !| |~~ ~~| | segments | filter ~(type | eq ::string) | join ""`);
    if (quoteInProse(prose)) holding.push(address);
  }
  return holding;
}

// Each law of the names that answers anything but true, with what it
// answered and the error it raised.
export async function failingLawsOf(answerOf, addresses) {
  const failures = [];
  for (const address of addresses) {
    const outcomes = await answerOf(`${address} | runLaws`);
    if (!Array.isArray(outcomes)) {
      failures.push({ address, law: 'runLaws', printed: printed(outcomes) });
      continue;
    }
    for (const outcome of outcomes) {
      if (outcome.get('ok') === true) continue;
      failures.push({ address, law: printed(outcome.get('law')), error: outcome.get('error'), printed: printed(outcome.get('actual')) });
    }
  }
  return failures;
}

// The report of the laws that failed, one paragraph each.
export function reportOfLaws(failures) {
  return failures
    .map(failure => `[${failure.address}] ${failure.law}\n  => ${failure.printed}${failure.error ? `\n  error: ${printed(failure.error)}` : ''}`)
    .join('\n');
}
