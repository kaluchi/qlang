// Tests for module-resolver.mjs over the modules of test/fixtures/modules.
// NOTE: No top-level await. libDir computed at module scope via fileURLToPath.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { discoverModules, resolveModules, installModules } from '../../host/module-resolver.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword } from '../../src/types.mjs';
import { moduleNamespaceKey } from '../../src/env-keys.mjs';

// Compute the fixture directory at module scope (no top-level await
// needed — fileURLToPath/dirname/join are synchronous).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const libDir = join(__dirname, '..', 'fixtures', 'modules');

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
    expect(discovered.has('number')).toBe(true);
    expect(discovered.has('number/scale')).toBe(true);
    expect(discovered.has('number/thirds')).toBe(true);
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

  it('resolved number module exports double and halve', async () => {
    const catalog = await resolveModules(libDir);
    const numberEntry = catalog.get('number');
    expect(numberEntry.exports instanceof Map).toBe(true);
    expect(numberEntry.exports.has('double')).toBe(true);
    expect(numberEntry.exports.has('halve')).toBe(true);
  });

  it('resolved sub-modules export their own verbs', async () => {
    const catalog = await resolveModules(libDir);
    expect(catalog.get('number/scale').exports.has('tenfold')).toBe(true);
    expect(catalog.get('number/thirds').exports.has('triple')).toBe(true);
  });
});

// ── installModules ──────────────────────────────────────────────

describe('installModules', () => {
  it('a verb a module outside a noun exports resides on no noun [D72]', async () => {
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);
    const cellEntry = await sessionInstance.evalCell('use :number | :double 5 | double 1 !| /addresses | count');
    expect(cellEntry.result).toBe(0);
  });

  it('makes namespaces available via use(:ns)', async () => {
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);

    // After installModules, the :number export Map sits under its
    // namespace cache key
    expect(sessionInstance.env.has(moduleNamespaceKey('number'))).toBe(true);

    // use(:number) imports double into current env, a verb whose spec
    // is its signature
    const cellEntry = await sessionInstance.evalCell('use :number | :double | spec | type');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual(makeTagKeyword('spec'));
  });

  it('keeps the export Map off the identifier-lookup plane, so a module sharing a stem with a kind of the core leaves its verbs intact', async () => {
    // `number.qlang` resolves to the namespace `number`, the stem of the
    // kind `::number` whose module declares `add`. The cache key
    // `qlang/namespace/number` is where `resolveNamespaceEnv` probes for
    // a loaded namespace, a key the runtime keeps for itself — so the
    // verbs of numbers keep resolving, `use(:number)` still reaches the
    // exports, and no export Map surfaces as a binding of the scope.
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);

    const addCell = await sessionInstance.evalCell('5 | add 1');
    expect(addCell.error).toBeNull();
    expect(addCell.result).toBe(6);

    const scopeCell = await sessionInstance.evalCell('env | keys | count');
    expect(scopeCell.error).toBeNull();
    expect(scopeCell.result).toBe(0);
  });

  it('resolveModules with explicit dependencies uses topo sort', async () => {
    const deps = new Map();
    deps.set('number/scale', ['number']);
    deps.set('number/thirds', ['number']);
    const catalog = await resolveModules(libDir, { dependencies: deps });
    expect(catalog.size).toBeGreaterThanOrEqual(3);
    const names = [...catalog.keys()].sort();
    expect(names).toContain('number');
    expect(names).toContain('number/scale');
    expect(names).toContain('number/thirds');
  });

  it('imported verbs answer their signatures and run', async () => {
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);
    await sessionInstance.evalCell('use :number');
    await sessionInstance.evalCell('use :number/scale');
    await sessionInstance.evalCell('use :number/thirds');

    for (const name of ['double', 'halve', 'tenfold', 'triple']) {
      const cellEntry = await sessionInstance.evalCell(`:${name} | spec | type`);
      expect(cellEntry.error).toBeNull();
      expect(cellEntry.result).toEqual(makeTagKeyword('spec'));
    }
    const runCell = await sessionInstance.evalCell('2 | double | tenfold | triple');
    expect(runCell.result).toBe(120);
  });

  it('install-loaded module AST is stamped under qlang/ast/<ns> so axis-operands reach the BindStep', async () => {
    // Symmetry with locator-pathway: `use(:ns)` via createSession({locator}) stamps
    // moduleAstKey(ns) so `:name | source / docs / examples` resolve. installModules
    // must stamp the same key, otherwise install-loaded modules' bindings are invisible
    // to the axis trio even after `use(:ns)` merges their exports into env.
    const catalog = await resolveModules(libDir);
    const sessionInstance = await createSession();
    installModules(sessionInstance, catalog);
    await sessionInstance.evalCell('use :number');
    const docsCell = await sessionInstance.evalCell(':double | doc | content');
    expect(docsCell.error).toBeNull();
    expect(typeof docsCell.result).toBe('string');
    expect(docsCell.result).toContain('Doubles');
  });
});

describe('locator exports that are not builtin descriptors', () => {
  it('leaves a `::Tag` bound to a literal alone rather than stamping a throw-site spec onto it', async () => {
    // `stampThrowSiteSpec` reads the recorded facts for the class the
    // tag names, and a module binding that name to a literal holds a
    // number in its record, not a `::builtin` descriptor, so the stamp
    // finds no descriptor to write `:category` / `:operand` /
    // `:expectedType` onto.
    const sessionInstance = await createSession({
      locator: async (namespaceName) => namespaceName === 'tests/literal-tag'
        ? { source: '::AsNameNotKeywordError 42' }
        : null
    });

    const specCell = await sessionInstance.evalCell(
      'use :tests/literal-tag | ::AsNameNotKeywordError | spec');
    expect(specCell.error).toBeNull();
    expect(specCell.result).toBe(42);

  });
});
