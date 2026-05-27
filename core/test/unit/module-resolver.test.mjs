// Tests for module-resolver.mjs using the actual lib/ directory.
// NOTE: No top-level await. libDir computed at module scope via fileURLToPath.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { discoverModules, resolveModules, installModules } from '../../host/module-resolver.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword } from '../../src/types.mjs';

// Compute lib directory at module scope (no top-level await needed —
// fileURLToPath/dirname/join are synchronous).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const libDir = join(__dirname, '..', '..', 'lib', 'extras');

// ── discoverModules ─────────────────────────────────────────────

describe('discoverModules', () => {
  it('finds .qlang files in the lib directory', () => {
    const discovered = discoverModules(libDir);
    expect(discovered instanceof Map).toBe(true);
    expect(discovered.size).toBeGreaterThan(0);
    // All keys are strings (namespace names)
    for (const key of discovered.keys()) {
      expect(typeof key).toBe('string');
    }
    // Values are absolute paths to .qlang files (extension present in path)
    for (const filePath of discovered.values()) {
      expect(typeof filePath).toBe('string');
      expect(filePath.endsWith('.qlang')).toBe(true);
    }
  });

  it('discovered namespaces include known modules', () => {
    const discovered = discoverModules(libDir);
    expect(discovered.has('error')).toBe(true);
    expect(discovered.has('error/guards')).toBe(true);
    expect(discovered.has('error/observe')).toBe(true);
  });
});

// ── resolveModules ──────────────────────────────────────────────

describe('resolveModules', () => {
  it('produces a catalog of { exports, source, ast } entries per namespace', async () => {
    const catalog = await resolveModules(libDir);
    expect(catalog instanceof Map).toBe(true);
    expect(catalog.size).toBeGreaterThan(0);
    for (const [catalogKey, entry] of catalog) {
      expect(typeof catalogKey === 'string').toBe(true);
      expect(entry.exports instanceof Map).toBe(true);
      expect(typeof entry.source).toBe('string');
      expect(entry.source.length).toBeGreaterThan(0);
      expect(entry.ast).not.toBeNull();
      expect(entry.ast.type).toBeDefined();
    }
  });

  it('resolved error module exports retry, recover, mapError, withContext', async () => {
    const catalog = await resolveModules(libDir);
    const errorEntry = catalog.get('error');
    expect(errorEntry.exports instanceof Map).toBe(true);
    expect(errorEntry.exports.has('retry')).toBe(true);
    expect(errorEntry.exports.has('recover')).toBe(true);
    expect(errorEntry.exports.has('mapError')).toBe(true);
    expect(errorEntry.exports.has('withContext')).toBe(true);
  });

  it('resolved error/guards module exports assert and ensure', async () => {
    const catalog = await resolveModules(libDir);
    const guardsEntry = catalog.get('error/guards');
    expect(guardsEntry.exports instanceof Map).toBe(true);
    expect(guardsEntry.exports.has('assert')).toBe(true);
    expect(guardsEntry.exports.has('ensure')).toBe(true);
  });

  it('resolved error/observe module exports tap and finally', async () => {
    const catalog = await resolveModules(libDir);
    const observeEntry = catalog.get('error/observe');
    expect(observeEntry.exports instanceof Map).toBe(true);
    expect(observeEntry.exports.has('tap')).toBe(true);
    expect(observeEntry.exports.has('finally')).toBe(true);
  });
});

// ── installModules ──────────────────────────────────────────────

describe('installModules', () => {
  it('makes namespaces available via use(:ns)', async () => {
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);

    // After installModules, :error namespace is in env
    expect(sessionInstance.env.has('error')).toBe(true);

    // use(:error) imports retry into current env
    const cellEntry = await sessionInstance.evalCell('use(:error) | manifest | filter(/name | eq("retry")) | first | /kind');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual(makeTagKeyword('conduit'));
  });

  it('resolveModules with explicit dependencies uses topo sort', async () => {
    // libDir points to lib/qlang/, so module names are error, error/guards, etc.
    const deps = new Map();
    deps.set('error/guards', ['error']);
    deps.set('error/observe', ['error']);
    const catalog = await resolveModules(libDir, { dependencies: deps });
    expect(catalog.size).toBeGreaterThanOrEqual(3);
    const names = [...catalog.keys()].sort();
    expect(names).toContain('error');
    expect(names).toContain('error/guards');
    expect(names).toContain('error/observe');
  });

  it('imported conduits (retry, recover, assert, tap) are conduit type', async () => {
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);
    await sessionInstance.evalCell('use(:error)');
    await sessionInstance.evalCell('use(:error/guards)');
    await sessionInstance.evalCell('use(:error/observe)');

    for (const name of ['retry', 'recover', 'assert', 'tap']) {
      const cellEntry = await sessionInstance.evalCell(`manifest | filter(/name | eq("${name}")) | first | /kind`);
      expect(cellEntry.error).toBeNull();
      expect(cellEntry.result).toEqual(makeTagKeyword('conduit'));
    }
  });

  it('install-loaded module AST is stamped under qlang/ast/<ns> so axis-operands reach the BindStep', async () => {
    // Symmetry with locator-pathway: `use(:ns)` via createSession({locator}) stamps
    // moduleAstKey(ns) so `:name | source / docs / examples` resolve. installModules
    // must stamp the same key, otherwise install-loaded modules' bindings are invisible
    // to the axis trio even after `use(:ns)` merges their exports into env.
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);
    await sessionInstance.evalCell('use(:error)');
    const docsCell = await sessionInstance.evalCell(':retry | docs | first | /content');
    expect(docsCell.error).toBeNull();
    expect(typeof docsCell.result).toBe('string');
    expect(docsCell.result).toContain('Retry');
  });
});
