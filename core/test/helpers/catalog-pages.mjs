// [QSSLF#laws], [QSSLF#page], [QSSLF#doc]

import { printQuoteSource, printValue } from '../../src/print-value.mjs';
import { beneathTags, isDoc, isErrorValue } from '../../src/types.mjs';

function printed(value) {
  try { return printValue(value); }
  catch { return JSON.stringify(value); }
}

function queryOfLink(link) {
  return printQuoteSource(beneathTags(link));
}

export function wrongTarget(answer, declaredPages, ownPage) {
  if (!isDoc(answer)) return `answers ${isErrorValue(answer) ? `the error ${printValue(answer.tag)}` : 'no page'}`;
  const page = printValue(answer);
  if (!declaredPages.has(page)) return 'answers a doc no name declares';
  if (page === ownPage) return 'leads back to its own page';
  return null;
}

export async function declaredPagesOf(answerOf, addresses) {
  const pages = new Set();
  for (const address of addresses) {
    const page = await answerOf(`${address} | doc !| null`);
    if (isDoc(page)) pages.add(printValue(page));
  }
  return pages;
}

export async function linksOf(answerOf, addresses) {
  const links = [];
  for (const address of addresses) {
    const page = await answerOf(`${address} | doc !| null`);
    if (!isDoc(page)) continue;
    for (const link of await answerOf(`${address} | doc | links`)) links.push({ address, page: printValue(page), query: queryOfLink(link) });
  }
  return links;
}

// [QSSLF#doc]
export async function wrongLinksOf(answerOf, links, declaredPages) {
  const wrong = [];
  for (const link of links) {
    const target = wrongTarget(await answerOf(`::link~(${link.query}) | open`), declaredPages, link.page);
    if (target !== null) wrong.push(`${link.address}: ::link~(${link.query}) ${target}`);
  }
  return wrong;
}

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

export function reportOfLaws(failures) {
  return failures
    .map(failure => `[${failure.address}] ${failure.law}\n  => ${failure.printed}${failure.error ? `\n  error: ${printed(failure.error)}` : ''}`)
    .join('\n');
}
