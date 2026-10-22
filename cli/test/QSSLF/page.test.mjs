import { it, expect } from 'vitest';
import { cliSources } from '../../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';
import { cliNames } from '../helpers/cli-session.mjs';

it('the command line declares its topic and its verbs in its own source', () => {
  expect(cliNames).toEqual(expect.arrayContaining(['::cli', '::any/in', '::any/out', '::any/err', '::any/tap', '::vec/table']));
});

const evalInCli = async (query) => {
  const session = await createSession({ sources: cliSources(silentStreams) });
  return (await session.evalCell(query)).result;
};

it('declares the page of the command line under its topic', async () => {
  expect(await evalInCli('::cli | doc | content | contains "command line"')).toBe(true);
});
