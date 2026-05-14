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

describe('SourceLoadError shared base — Node and Web loaders share the class', () => {
  // Both loaders (`host/load-source-node.mjs`,
  // `src/load-source-web.mjs`) raise the same `SourceLoadError`
  // class imported from `src/source-load-error.mjs`. The class
  // carries `host` / `logicalName` / `sourceLocation` plus a
  // host-specific tail (`cause` for Node, `status` for Web).

  it('Node-shape error carries host="node" and the inner cause message', async () => {
    const { SourceLoadError } = await import('../../src/source-load-error.mjs');
    const cause = new Error('EACCES: permission denied');
    const err = new SourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/locked/core.qlang',
      cause
    });
    expect(err.name).toBe('SourceLoadError');
    expect(err.fingerprint).toBe('SourceLoadError');
    expect(err.message).toContain('#qlang/core');
    expect(err.message).toContain('/locked/core.qlang');
    expect(err.message).toContain('EACCES: permission denied');
    expect(err.context).toEqual({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/locked/core.qlang',
      cause,
      status: undefined
    });
  });

  it('Web-shape error carries host="web" and the HTTP status tail', async () => {
    const { SourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new SourceLoadError({
      host: 'web',
      logicalName: '#qlang/core',
      sourceLocation: 'https://cdn.example/qlang/core.qlang',
      status: 503
    });
    expect(err.name).toBe('SourceLoadError');
    expect(err.message).toContain('HTTP 503');
    expect(err.context.host).toBe('web');
    expect(err.context.status).toBe(503);
  });

  it('cause-shaped object without `.message` falls through to String(cause)', async () => {
    const { SourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new SourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/x.qlang',
      cause: 'raw-string-cause'
    });
    expect(err.message).toContain('raw-string-cause');
  });

  it('no cause and no status — message ends after the source location', async () => {
    const { SourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new SourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/x.qlang'
    });
    expect(err.message).toBe(`failed to read qlang source '#qlang/core' from /x.qlang`);
  });
});
