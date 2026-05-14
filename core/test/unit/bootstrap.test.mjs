// Per-site coverage for `core/src/runtime/bootstrap.mjs` —
// `platformLocator` resolves logical names through the calling
// package's `imports` field, `BootstrapRootMissingError` fires
// when `#qlang/core` itself is unmapped, and `use(:ns)` without
// a locator in env surfaces `UseNamespaceNotFoundError`.

import { describe, it, expect } from 'vitest';
import {
  platformLocator,
  BootstrapRootMissingError
} from '../../src/runtime/bootstrap.mjs';
import { langRuntime, buildLangRuntime } from '../../src/runtime/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { makeTagKeyword, RUNTIME_LOCATOR_KEY } from '../../src/types.mjs';

describe('platformLocator', () => {
  it('returns null for an unmapped namespace', async () => {
    const result = await platformLocator('does/not/exist/anywhere');
    expect(result).toBeNull();
  });

  it('returns { source } for a mapped namespace', async () => {
    const result = await platformLocator('qlang/core');
    expect(typeof result.source).toBe('string');
    expect(result.source.length).toBeGreaterThan(100);
  });
});

describe('BootstrapRootMissingError', () => {
  it('constructs with a clear diagnostic message and stable fingerprint', () => {
    const err = new BootstrapRootMissingError();
    expect(err.name).toBe('BootstrapRootMissingError');
    expect(err.fingerprint).toBe('BootstrapRootMissingError');
    expect(err.message).toContain('#qlang/core');
    expect(err.message).toContain('package.json#imports');
    expect(err.context).toEqual({});
  });

  it('fires from buildLangRuntime when the locator returns null for the root', async () => {
    const nullLocator = async () => null;
    await expect(buildLangRuntime(nullLocator)).rejects.toBeInstanceOf(BootstrapRootMissingError);
  });
});

describe('use without a locator in env raises UseNamespaceNotFoundError', () => {
  it('falls into the no-locator branch when env lacks the locator key', async () => {
    // Build a minimal env: langRuntime's seed plus locator stripped.
    // `use(:nonexistent)` then has no way to resolve, hits the
    // explicit no-locator throw branch in resolveNamespaceEnv.
    const env = new Map(await langRuntime());
    env.delete(RUNTIME_LOCATOR_KEY);
    const result = await evalQuery('use(:absolutely-nonexistent-namespace) !| /thrown', env);
    expect(result).toEqual(makeTagKeyword('UseNamespaceNotFoundError'));
  });
});
