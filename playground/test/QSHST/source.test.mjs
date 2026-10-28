import { it, expect } from 'vitest';
import { playgroundSources } from '../../src/playground-sources.mjs';
import { createNotebook } from '@kaluchi/qlang-core';
import { silentStreams } from '../helpers/silent-streams.mjs';

it('hands the source of the command line with the primitives of its verbs', () => {
  const [stdioSource] = playgroundSources(silentStreams);
  expect(stdioSource.uri).toBe('stdio');
  expect(stdioSource.source).toContain(':vec/table');
  expect(Object.keys(stdioSource.primitives)).toEqual(expect.arrayContaining(['any/in', 'any/out', 'any/err', 'any/tap', 'vec/table']));
});

const evalInCli = async (query) => {
  const notebook = await createNotebook({ sources: playgroundSources(silentStreams) });
  return (await notebook.evalCell(query)).result;
};

it('declares the topic of the command line beside the names a reader declares', async () => {
  expect(await evalInCli(':Box |~~ A box. ~~| | env | get [~(has :Box) ~(has :stdio) ~(has :table)]')).toEqual([true, false, false]);
  expect(await evalInCli('::stdio | doc | tag')).toEqual(await evalInCli('::doc'));
});
