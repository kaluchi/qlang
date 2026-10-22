import { it, expect } from 'vitest';
import { cliSources } from '../../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';

it('hands the source of the command line with the primitives of its verbs', () => {
  const [cliSource] = cliSources(silentStreams);
  expect(cliSource.uri).toBe('cli');
  expect(cliSource.source).toContain(':vec/table');
  expect(Object.keys(cliSource.primitives)).toEqual(expect.arrayContaining(['any/in', 'any/out', 'any/err', 'any/tap', 'vec/table']));
});

const evalInCli = async (query) => {
  const session = await createSession({ sources: cliSources(silentStreams) });
  return (await session.evalCell(query)).result;
};

it('declares the topic of the command line beside the names a reader declares', async () => {
  expect(await evalInCli(':x 1 | env | get [~(has :x) ~(has :cli) ~(has :table)]')).toEqual([true, false, false]);
  expect(await evalInCli('::cli | doc | type')).toEqual(await evalInCli('::doc'));
});
