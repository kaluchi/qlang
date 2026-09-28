import { describe, it, expect } from 'vitest';
import { createCliLocator, installCliCatalog } from '../src/cli-locator.mjs';
import { createSession } from '@kaluchi/qlang-core/session';

const noopCtx = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('createCliLocator', () => {
  it('answers the module of the noun of the command line with its primitives', async () => {
    const result = await createCliLocator(noopCtx)('qlang/cli');
    expect(result.source).toContain('::qlang/cli');
    expect(Object.keys(result.impls)).toEqual(expect.arrayContaining(['@in', '@out', '@err', '@tap', 'table']));
  });

  it('answers no other namespace', async () => {
    const locator = createCliLocator(noopCtx);
    expect(await locator('cli/io')).toBeNull();
    expect(await locator('qlang/number')).toBeNull();
    expect(await locator('')).toBeNull();
  });
});

describe('installCliCatalog [D92]', () => {
  const evalInCli = async (query) => {
    const session = await createSession({ locator: createCliLocator(noopCtx) });
    await installCliCatalog(session);
    return (await session.evalCell(query)).result;
  };

  it('lets a query call the verbs of the command line by their names', async () => {
    expect(await evalInCli('[{:a 1}] | table')).toContain('| a |');
  });

  it('keeps them out of the names the session declares', async () => {
    expect(await evalInCli(':x 1 | env | keys')).toEqual(await evalInCli('#[:x]'));
  });

  it('lists them under the noun of the command line', async () => {
    expect(await evalInCli('::qlang | manifest | has ::cli')).toBe(true);
    expect(await evalInCli('::cli | manifest | has ::cli/table')).toBe(true);
  });
});
