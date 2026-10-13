import { describe, it, expect } from 'vitest';
import { cliSources } from '../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core/session';
import { silentStreams } from './helpers/silent-streams.mjs';

describe('cliSources', () => {
  it('hands the source of the command line with the primitives of its verbs', () => {
    const [cliSource] = cliSources(silentStreams);
    expect(cliSource.uri).toBe('cli');
    expect(cliSource.source).toContain(':vec/table');
    expect(Object.keys(cliSource.impls)).toEqual(expect.arrayContaining(['any/in', 'any/out', 'any/err', 'any/tap', 'vec/table']));
  });
});

describe('the verbs of the command line [D153]', () => {
  const evalInCli = async (query) => {
    const session = await createSession({ sources: cliSources(silentStreams) });
    return (await session.evalCell(query)).result;
  };

  it('lets a query call the verbs of the command line by their names', async () => {
    expect(await evalInCli('[{:a 1}] | table')).toContain('| a |');
  });

  it('declares its topic beside the names a reader declares', async () => {
    expect(await evalInCli(':x 1 | env | get [~(has :x) ~(has :cli) ~(has :table)]')).toEqual([true, false, false]);
    expect(await evalInCli('::cli | doc | type')).toEqual(await evalInCli('::doc'));
  });

  it('declares its verbs under the kinds of their subjects', async () => {
    expect(await evalInCli('::cli | doc | content | contains "command line"')).toBe(true);
    expect(await evalInCli('::vec | manifest | has ::vec/table')).toBe(true);
    expect(await evalInCli('::any | manifest | has ::any/out')).toBe(true);
  });
});
