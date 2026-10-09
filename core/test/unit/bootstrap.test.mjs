// Per-site coverage for `core/src/runtime/bootstrap.mjs` and the root
// it declares: `platformLocator` resolves the sources of the language
// through the calling package's `imports` field, a source it cannot find
// refuses the bootstrap by `BootstrapSourceMissingError`, and a source
// the parser refuses raises its `ParseError` [D153].

import { describe, it, expect } from 'vitest';
import { platformLocator, BuiltinBootstrapSourceMissingError } from '../../src/runtime/bootstrap.mjs';
import { ParseError } from '../../src/parse.mjs';
import { buildLangRuntime } from '../../src/runtime/index.mjs';

describe('platformLocator', () => {
  it('returns null for an unmapped source', async () => {
    expect(await platformLocator('does/not/exist/anywhere')).toBeNull();
  });

  it('returns { source } for a source of the language', async () => {
    const result = await platformLocator('qlang');
    expect(typeof result.source).toBe('string');
    expect(result.source.length).toBeGreaterThan(100);
  });
});

describe('BootstrapSourceMissingError', () => {
  it('names the source it missed and where a host maps it', () => {
    const err = new BuiltinBootstrapSourceMissingError({ uri: 'qlang/vec' });
    expect(err.name).toBe('BootstrapSourceMissingError');
    expect(err.message).toContain('#qlang/vec');
    expect(err.message).toContain('package.json#imports');
  });

  it('fires from buildLangRuntime when the locator serves no source', async () => {
    await expect(buildLangRuntime(async () => null)).rejects.toBeInstanceOf(BuiltinBootstrapSourceMissingError);
  });
});

describe('a source of the language the parser refuses', () => {
  it('raises its parse error, which names the source', async () => {
    let thrown = null;
    try { await buildLangRuntime(async () => ({ source: ':unclosed (mul(2)' })); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(ParseError);
    expect(thrown.uri).toBe('qlang');
  });
});

describe('SourceLoadError shared base — Node and Web loaders share the class', () => {
  // Both loaders (`host/load-source-node.mjs`,
  // `src/load-source-web.mjs`) raise the same `SourceLoadError`
  // class imported from `src/source-load-error.mjs`. The class
  // carries `host` / `logicalName` / `sourceLocation` plus a
  // host-specific tail (`cause` for Node, `status` for Web).

  it('Node-shape error carries host="node" and the inner cause message', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const cause = new Error('EACCES: permission denied');
    const err = new BuiltinSourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/locked/core.qlang',
      cause
    });
    expect(err.name).toBe('SourceLoadError');

    expect(err.message).toContain('#qlang/core');
    expect(err.message).toContain('/locked/core.qlang');
    expect(err.message).toContain('EACCES: permission denied');
    expect(err.facts).toEqual({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/locked/core.qlang',
      cause,
      status: undefined
    });
  });

  it('Web-shape error carries host="web" and the HTTP status tail', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new BuiltinSourceLoadError({
      host: 'web',
      logicalName: '#qlang/core',
      sourceLocation: 'https://cdn.example/qlang/core.qlang',
      status: 503
    });
    expect(err.name).toBe('SourceLoadError');
    expect(err.message).toContain('HTTP 503');
    expect(err.facts.host).toBe('web');
    expect(err.facts.status).toBe(503);
  });

  it('cause-shaped object without `.message` falls through to String(cause)', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new BuiltinSourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/x.qlang',
      cause: 'raw-string-cause'
    });
    expect(err.message).toContain('raw-string-cause');
  });

  it('no cause and no status — message ends after the source location', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new BuiltinSourceLoadError({
      host: 'node',
      logicalName: '#qlang/core',
      sourceLocation: '/x.qlang'
    });
    expect(err.message).toBe(`failed to read qlang source '#qlang/core' from /x.qlang`);
  });
});
