import { it, expect } from 'vitest';
import { cliSources } from '../../src/cli-sources.mjs';
import { createNotebook } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';

it('hands the source of the command line with the primitives of its verbs', () => {
  const [cliSource] = cliSources(silentStreams);
  expect(cliSource.uri).toBe('cli');
  expect(cliSource.source).toContain(':vec/table');
  expect(Object.keys(cliSource.primitives)).toEqual(expect.arrayContaining(['any/in', 'any/out', 'any/err', 'any/tap', 'vec/table']));
});

const evalInCli = async (query) => {
  const notebook = await createNotebook({ sources: cliSources(silentStreams) });
  return (await notebook.evalCell(query)).result;
};

it('declares the topic of the command line beside the names a reader declares', async () => {
  expect(await evalInCli(':Box |~~ A box. ~~| | env | get [~(has :Box) ~(has :cli) ~(has :table)]')).toEqual([true, false, false]);
  expect(await evalInCli('::cli | doc | tag')).toEqual(await evalInCli('::doc'));
});
