// The catalog of the command line is held as the core's is, by the same
// checks [D19], [D108], [D123]: the laws of every name its source
// declares answer true, every link of its pages leads to the page of
// another name, and no quote of a page falls to its prose, where a link
// whose quote does not parse would go stale in silence.

import { describe, it, expect, beforeAll } from 'vitest';
import { cliSources } from '../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core/session';
import { nodeAddresses } from '@kaluchi/qlang-core';
import { silentStreams } from './helpers/silent-streams.mjs';
import { declaredPagesOf, failingLawsOf, linksOf, proseQuotesOf, quoteInProse, reportOfLaws, wrongLinksOf } from '../../core/test/helpers/catalog-pages.mjs';

let session;
const answerOf = async query => (await session.evalCell(query)).result;

let names;
let cliNames;

beforeAll(async () => {
  session = await createSession({ sources: cliSources(silentStreams) });
  names = nodeAddresses(session.env).map(name => `::${name}`);
  cliNames = await answerOf(`[${names.join(' ')}] | filter ~(binding | get /origin | eq :cli) | map ~print`);
}, 120_000);

describe('the catalog of the command line', () => {
  it('declares its topic and its words in its own source', () => {
    expect(cliNames).toEqual(expect.arrayContaining(['::cli', '::any/in', '::any/out', '::any/err', '::any/tap', '::vec/table']));
  });

  it('runs the laws of every name it declares to true', async () => {
    const failures = await failingLawsOf(answerOf, cliNames);
    expect(reportOfLaws(failures)).toBe('');
  }, 60_000);

  it('leads every link of its pages to the page of another name', async () => {
    expect(await wrongLinksOf(answerOf, await linksOf(answerOf, cliNames), await declaredPagesOf(answerOf, names))).toEqual([]);
  }, 120_000);

  it('holds no quote of a page in its prose', async () => {
    expect(await proseQuotesOf(answerOf, cliNames)).toEqual([]);
  }, 60_000);

  it('tells a link whose quote does not parse, which falls to the prose', async () => {
    const proseOf = async doc => answerOf(`${doc} | segments | filter ~(type | eq ::string) | join ""`);
    expect(quoteInProse(await proseOf('|~~ shows a value on stderr ::link~(::any/@tap | doc) ~~|'))).toBe(true);
    expect(quoteInProse(await proseOf('|~~ shows a value on stderr ::link~(::any/tap | doc) ~~|'))).toBe(false);
  });
});
