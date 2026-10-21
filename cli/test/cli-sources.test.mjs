import { describe, it, expect } from 'vitest';
import { cliSources } from '../src/cli-sources.mjs';
import { createSession } from '@kaluchi/qlang-core';
import { silentStreams } from './helpers/silent-streams.mjs';

describe('cliSources', () => {
  it('[QSHST#source] hands the source of the command line with the primitives of its verbs', () => {
    const [cliSource] = cliSources(silentStreams);
    expect(cliSource.uri).toBe('cli');
    expect(cliSource.source).toContain(':vec/table');
    expect(Object.keys(cliSource.primitives)).toEqual(expect.arrayContaining(['any/in', 'any/out', 'any/err', 'any/tap', 'vec/table']));
  });
});

describe('the topic of the command line and the residence of its verbs', () => {
  const evalInCli = async (query) => {
    const session = await createSession({ sources: cliSources(silentStreams) });
    return (await session.evalCell(query)).result;
  };

  it('[QSHST#source] declares its topic beside the names a reader declares', async () => {
    expect(await evalInCli(':x 1 | env | get [~(has :x) ~(has :cli) ~(has :table)]')).toEqual([true, false, false]);
    expect(await evalInCli('::cli | doc | type')).toEqual(await evalInCli('::doc'));
  });

  it('[QSSLF#page] declares the page of the command line under its topic', async () => {
    expect(await evalInCli('::cli | doc | content | contains "command line"')).toBe(true);
  });
});
