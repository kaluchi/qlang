import { describe, it, expect } from 'vitest';
import { createCliLocator, CLI_NAMESPACES, installCliCatalog } from '../src/cli-locator.mjs';
import { createSession } from '@kaluchi/qlang-core/session';

const noopCtx = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('createCliLocator', () => {
  it('returns source + impls for each :cli/* namespace', async () => {
    const locator = createCliLocator(noopCtx);
    for (const ns of ['cli/io', 'cli/format', 'cli/parse']) {
      const result = await locator(ns);
      expect(result).toBeDefined();
      expect(typeof result.source).toBe('string');
      expect(result.source.length).toBeGreaterThan(0);
      expect(result.impls).toBeDefined();
      expect(Object.keys(result.impls).length).toBeGreaterThan(0);
    }
  });

  it('returns null for any namespace outside the :cli/* family', async () => {
    const locator = createCliLocator(noopCtx);
    expect(await locator('not/a/cli/namespace')).toBeNull();
    expect(await locator('qlang/operand/arith')).toBeNull();
    expect(await locator('')).toBeNull();
  });
});

describe('installCliCatalog', () => {
  it('binds every cli/* operand into the session env', async () => {
    const session = await createSession({ locator: createCliLocator(noopCtx) });
    await installCliCatalog(session);
    const { result } = await session.evalCell(
      'manifest * /name | filter(eq("@out") | not | not)'
    );
    expect(result).toContain('@out');
  });
});

describe('CLI_NAMESPACES', () => {
  it('lists every advertised cli host namespace', () => {
    expect(CLI_NAMESPACES).toEqual([':cli/io', ':cli/format', ':cli/parse']);
  });
});
