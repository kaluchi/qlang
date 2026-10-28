import { it, expect } from 'vitest';
import { playgroundSources } from '../../src/playground-sources.mjs';
import { createNotebook } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';
import { cliNames } from '../helpers/cli-notebook.mjs';

it('the streams declare their topic and their verbs in their own source', () => {
  expect(cliNames).toEqual(expect.arrayContaining(['::stdio', '::any/in', '::any/out', '::any/err', '::any/tap', '::vec/table']));
});

const evalInCli = async (query) => {
  const notebook = await createNotebook({ sources: playgroundSources(silentStreams) });
  return (await notebook.evalCell(query)).result;
};

it('declares the page of the streams under their topic', async () => {
  expect(await evalInCli('::stdio | doc | content | contains "streams"')).toBe(true);
});
