import { describe, it, expect } from 'vitest';
import { createCliLocator } from '../src/cli-locator.mjs';
import { createSession } from '@kaluchi/qlang-core/session';

const noopCtx = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('createCliLocator', () => {
  it('answers the module of the provider of the command line with its primitives', async () => {
    const result = await createCliLocator(noopCtx)('cli');
    expect(result.source).toContain(':table');
    expect(Object.keys(result.impls)).toEqual(expect.arrayContaining(['@in', '@out', '@err', '@tap', 'table']));
  });

  it('binds the provider beside the language at the root', async () => {
    expect((await createCliLocator(noopCtx)('qlang/core')).source).toContain(':cli');
  });

  it('answers no other path', async () => {
    const locator = createCliLocator(noopCtx);
    expect(await locator('cli/io')).toBeNull();
    expect(await locator('qlang/number')).toBeNull();
    expect(await locator('')).toBeNull();
  });
});

describe('the verbs of the command line [D92], [D152]', () => {
  const evalInCli = async (query) => {
    const session = await createSession({ locator: createCliLocator(noopCtx) });
    return (await session.evalCell(query)).result;
  };

  it('lets a query call the verbs of the command line by their names', async () => {
    expect(await evalInCli('[{:a 1}] | table')).toContain('| a |');
  });

  it('keeps them out of the names the session declares', async () => {
    expect(await evalInCli(':x 1 | env | keys')).toEqual(await evalInCli('#[:x]'));
  });

  it('lists them under the provider of the command line', async () => {
    expect(await evalInCli('::cli | doc | content | contains "command line"')).toBe(true);
    expect(await evalInCli('::cli | manifest | has ::cli/table')).toBe(true);
  });
});
