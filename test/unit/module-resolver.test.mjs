// Tests for module-resolver.mjs using the actual lib/ directory.
// NOTE: No top-level await. libDir computed at module scope via fileURLToPath.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { discoverModules, resolveModules, installModules } from '../../host/module-resolver.mjs';
import { createSession } from '../../src/session.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

// Compute lib directory at module scope (no top-level await needed —
// fileURLToPath/dirname/join are synchronous).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const libDir = join(__dirname, '..', '..', 'lib', 'qlang');

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
  it('produces a catalog of Maps (keyword → export Map)', () => {
    const catalog = resolveModules(libDir);
    expect(catalog instanceof Map).toBe(true);
    expect(catalog.size).toBeGreaterThan(0);
    for (const [k, v] of catalog) {
      // Keys are keyword objects
      expect(k !== null && typeof k === 'object' && k.type === 'keyword').toBe(true);
      // Values are Maps (module export envs)
      expect(v instanceof Map).toBe(true);
    }
  });

  it('resolved error module exports retry, recover, mapError, withContext', () => {
    const catalog = resolveModules(libDir);
    const errorModule = catalog.get(keyword('error'));
    expect(errorModule instanceof Map).toBe(true);
    expect(errorModule.has(keyword('retry'))).toBe(true);
    expect(errorModule.has(keyword('recover'))).toBe(true);
    expect(errorModule.has(keyword('mapError'))).toBe(true);
    expect(errorModule.has(keyword('withContext'))).toBe(true);
  });

  it('resolved error/guards module exports assert and ensure', () => {
    const catalog = resolveModules(libDir);
    const guards = catalog.get(keyword('error/guards'));
    expect(guards instanceof Map).toBe(true);
    expect(guards.has(keyword('assert'))).toBe(true);
    expect(guards.has(keyword('ensure'))).toBe(true);
  });

  it('resolved error/observe module exports tap and finally', () => {
    const catalog = resolveModules(libDir);
    const observe = catalog.get(keyword('error/observe'));
    expect(observe instanceof Map).toBe(true);
    expect(observe.has(keyword('tap'))).toBe(true);
    expect(observe.has(keyword('finally'))).toBe(true);
  });
});

// ── installModules ──────────────────────────────────────────────

describe('installModules', () => {
  it('makes namespaces available via use(:ns)', () => {
    const catalog = resolveModules(libDir);
    const session = createSession();
    installModules(session, catalog);

    // After installModules, :error namespace is in env
    expect(session.env.has(keyword('error'))).toBe(true);

    // use(:error) imports retry into current env
    const entry = session.evalCell('nil | use(:error) | reify(:retry) | /kind');
    expect(entry.error).toBeNull();
    expect(entry.result).toEqual(keyword('conduit'));
  });

  it('resolveModules with explicit dependencies uses topo sort', () => {
    // libDir points to lib/qlang/, so module names are error, error/guards, etc.
    const deps = new Map();
    deps.set('error/guards', ['error']);
    deps.set('error/observe', ['error']);
    const catalog = resolveModules(libDir, { dependencies: deps });
    expect(catalog.size).toBeGreaterThanOrEqual(3);
    const names = [...catalog.keys()].map(k => k.name).sort();
    expect(names).toContain('error');
    expect(names).toContain('error/guards');
    expect(names).toContain('error/observe');
  });

  it('imported conduits (retry, recover, assert, tap) are conduit type', () => {
    const catalog = resolveModules(libDir);
    const session = createSession();
    installModules(session, catalog);
    session.evalCell('nil | use(:error)');
    session.evalCell('nil | use(:error/guards)');
    session.evalCell('nil | use(:error/observe)');

    for (const name of ['retry', 'recover', 'assert', 'tap']) {
      const entry = session.evalCell(`reify(:${name}) | /kind`);
      expect(entry.error).toBeNull();
      expect(entry.result).toEqual(keyword('conduit'));
    }
  });
});
