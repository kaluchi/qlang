// Per-site coverage for `core/src/runtime/bootstrap.mjs` and the root
// it declares: `platformLocator` resolves the sources of the language
// through the calling package's `imports` field, a source it cannot find
// refuses the bootstrap by `BootstrapSourceMissingError`, and a source
// the parser refuses raises its `ParseError` [QSDSP#residence], [D361].

import { describe, it, expect } from 'vitest';
import { platformLocator, BuiltinBootstrapSourceMissingError } from '../../src/runtime/bootstrap.mjs';
import { ParseError } from '../../src/parse.mjs';
import { buildLangRuntime } from '../../src/runtime/index.mjs';
import { keyword } from '../../src/types.mjs';

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
  it('names the source it missed as its origin, and where a host maps it', () => {
    const err = new BuiltinBootstrapSourceMissingError({ origin: keyword('qlang/vec') });
    expect(err.name).toBe('BootstrapSourceMissingError');
    expect(err.message).toContain('#qlang/vec');
    expect(err.message).toContain('package.json#imports');
  });

  it('fires from buildLangRuntime when the locator serves no source, naming the first as its origin', async () => {
    await expect(buildLangRuntime(async () => null)).rejects.toMatchObject({
      name: 'BootstrapSourceMissingError', facts: { origin: keyword('qlang/builtin') }
    });
    await expect(buildLangRuntime(async () => null)).rejects.toBeInstanceOf(BuiltinBootstrapSourceMissingError);
  });
});

describe('a source of the language the parser refuses', () => {
  it('raises its parse error, which names the source', async () => {
    let thrown = null;
    try { await buildLangRuntime(async () => ({ source: ':unclosed (mul 2' })); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(ParseError);
    expect(thrown.uri).toBe('qlang/builtin');
  });
});

describe('SourceLoadError, which every loader raises alike [D361]', () => {
  // Both loaders (`host/load-source-node.mjs`, `src/load-source-web.mjs`)
  // raise the same `SourceLoadError` class imported from
  // `src/source-load-error.mjs`, its facts the origin of the source, where
  // it was looked for and the host's account of the failure.

  it('carries the origin, the location and the cause, and names no platform', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const cause = new Error('EACCES: permission denied');
    const err = new BuiltinSourceLoadError({ origin: keyword('qlang/vec'), sourceLocation: '/locked/vec.qlang', cause });
    expect(err.name).toBe('SourceLoadError');
    expect(err.message).toBe("failed to read qlang source 'qlang/vec' from /locked/vec.qlang — EACCES: permission denied");
    expect(err.facts).toEqual({ origin: keyword('qlang/vec'), sourceLocation: '/locked/vec.qlang', cause });
  });

  it('writes a cause that is no error as its text', async () => {
    const { BuiltinSourceLoadError } = await import('../../src/source-load-error.mjs');
    const err = new BuiltinSourceLoadError({ origin: keyword('qlang/vec'), sourceLocation: '/x.qlang', cause: 'raw-string-cause' });
    expect(err.message).toBe("failed to read qlang source 'qlang/vec' from /x.qlang — raw-string-cause");
  });
});
