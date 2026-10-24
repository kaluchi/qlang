import { it, expect } from 'vitest';
import { cliSources } from '../../src/cli-sources.mjs';
import { createNotebook } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';
import { cliNames } from '../helpers/cli-notebook.mjs';

it('the command line declares its topic and its verbs in its own source', () => {
  expect(cliNames).toEqual(expect.arrayContaining(['::cli', '::any/in', '::any/out', '::any/err', '::any/tap', '::vec/table']));
});

const evalInCli = async (query) => {
  const notebook = await createNotebook({ sources: cliSources(silentStreams) });
  return (await notebook.evalCell(query)).result;
};

it('declares the page of the command line under its topic', async () => {
  expect(await evalInCli('::cli | doc | content | contains "command line"')).toBe(true);
});
