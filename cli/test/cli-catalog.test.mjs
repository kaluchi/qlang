// The catalog of the command line is held as the core's is [D108], [D121],
// [D19], [D123]: the laws of every name its source declares answer true,
// every link of its pages leads to the page of another name, and no quote
// of a page falls to its prose, where a link the grammar no longer reads,
// `::link~(::any/@tap | doc)` once the sigil left, would go stale in
// silence.

import { describe, it, expect, beforeAll } from 'vitest';
import { cliSources } from '../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core/session';
import { nodeAddresses } from '@kaluchi/qlang-core';

const noopCtx = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

let session;
const answerOf = async query => (await session.evalCell(query)).result;

// The prose of a page with its code spans taken out: a `~(` left in it is
// a quote the parser refused, which reads as prose [D19].
const quoteInProse = prose => prose.replace(/`[^`]*`/g, '').includes('~(');

let cliNames;
let declaredPages;

beforeAll(async () => {
  session = await createSession({ sources: cliSources(noopCtx) });
  const names = nodeAddresses(session.env).map(name => `::${name}`);
  cliNames = await answerOf(`[${names.join(' ')}] | filter ~(binding | /origin | eq :cli) | map ~print`);
  declaredPages = new Set(await answerOf(`[${names.join(' ')}] | map ~(doc !| null) | filter ~(type | eq ::doc) | map ~print`));
}, 120_000);

describe('the catalog of the command line', () => {
  it('declares its topic and its words in its own source', () => {
    expect(cliNames).toEqual(expect.arrayContaining(['::cli', '::any/in', '::any/out', '::any/err', '::any/tap', '::vec/table']));
  });

  it('runs the laws of every name it declares to true', async () => {
    expect(await answerOf(`[${cliNames.join(' ')}] | map ~(runLaws | map ~/ok) | flat | every ~(eq true)`)).toBe(true);
  }, 60_000);

  it('leads every link of its pages to the page of another name', async () => {
    const wrong = [];
    for (const name of cliNames) {
      const own = await answerOf(`${name} | doc !| null | print`);
      for (const target of await answerOf(`${name} | doc | links | map ~(open !| null | print)`)) {
        if (!declaredPages.has(target)) wrong.push(`${name}: a link answers ${target}, the page of no name`);
        else if (target === own) wrong.push(`${name}: a link leads back to its own page`);
      }
    }
    expect(wrong).toEqual([]);
  }, 60_000);

  it('holds no quote of a page in its prose', async () => {
    const stale = [];
    for (const name of cliNames) {
      const prose = await answerOf(`${name} | doc !| |~~ ~~| | segments | filter ~(type | eq ::string) | join ""`);
      if (quoteInProse(prose)) stale.push(name);
    }
    expect(stale).toEqual([]);
  }, 60_000);

  it('tells a link the grammar no longer reads, which falls to the prose', async () => {
    const prose = await answerOf('|~~ shows a value on stderr ::link~(::any/@tap | doc) ~~| | segments | filter ~(type | eq ::string) | join ""');
    expect(quoteInProse(prose)).toBe(true);
    expect(quoteInProse(await answerOf('|~~ shows a value on stderr ::link~(::any/tap | doc) ~~| | segments | filter ~(type | eq ::string) | join ""'))).toBe(false);
  });
});
