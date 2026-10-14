// Tests for src/primitives.mjs — the table of the implementations of
// the language by the address of the verb or the kind each serves,
// which the bootstrap hands each source of the language [D72].
//
// Every test binds into an isolated table via createPrimitiveRegistry()
// so state does not leak between cases; PRIMITIVE_REGISTRY, which the
// runtime modules bind into as they load, is read and never bound into.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrimitiveRegistry,
  PRIMITIVE_REGISTRY
} from '../../src/primitives.mjs';

import { QlangInvariantError } from '../../src/errors.mjs';

describe('createPrimitiveRegistry — lifecycle', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('starts empty and unsealed', () => {
    expect(registry.size).toBe(0);
    expect(registry.isSealed).toBe(false);
  });

  it('bind(key, impl) stores the impl under the key', () => {
    const k = 'qlang/test-prim/foo';
    const impl = (state, _lambdas) => state;
    registry.bind(k, impl);
    expect(registry.size).toBe(1);
    expect(registry.implsUnder('qlang/test-prim')[k]).toBe(impl);
  });

  it('bind returns the key to enable fluent re-export', () => {
    // The idiom: `export const add = PRIMITIVE_REGISTRY.bind(key, impl);`
    // so the runtime module's export IS the keyword that core.qlang's
    // :impl field points to.
    const k = 'qlang/test-prim/re-export';
    const impl = () => null;
    const returned = registry.bind(k, impl);
    expect(returned).toBe(k);
    expect(registry.implsUnder('qlang/test-prim')[returned]).toBe(impl);
  });

  it('has(key) reports binding state', () => {
    const k = 'qlang/test-prim/foo';
    expect(registry.has(k)).toBe(false);
    registry.bind(k, () => null);
    expect(registry.has(k)).toBe(true);
  });

  it('multiple bindings grow the size counter', () => {
    registry.bind('qlang/test-prim/a', () => 'a');
    registry.bind('qlang/test-prim/b', () => 'b');
    registry.bind('qlang/test-prim/c', () => 'c');
    expect(registry.size).toBe(3);
  });

  it('seal() closes the registry against further binding', () => {
    registry.seal();
    expect(registry.isSealed).toBe(true);
  });

  it('seal is idempotent', () => {
    registry.seal();
    registry.seal();
    expect(registry.isSealed).toBe(true);
  });

  it('the implementations stay readable after seal', () => {
    const k = 'qlang/test-prim/foo';
    const impl = () => 42;
    registry.bind(k, impl);
    registry.seal();
    expect(registry.implsUnder('qlang/test-prim')[k]).toBe(impl);
    expect(registry.has(k)).toBe(true);
  });
});

describe('createPrimitiveRegistry — bind error classes', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('rejects non-string keys with BuiltinAddressNotStringError', () => {
    expect(() => registry.bind(Symbol('bad'), () => null))
      .toThrow(/an address must be a string, got symbol/);
  });

  it('rejects number keys', () => {
    expect(() => registry.bind(42, () => null))
      .toThrow(/an address must be a string, got number/);
  });

  it('rejects plain object keys', () => {
    expect(() => registry.bind({ not: 'keyword' }, () => null))
      .toThrow(/an address must be a string, got object/);
  });

  it('non-string rejection is a QlangInvariantError', () => {
    try {
      registry.bind(null, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('AddressNotStringError');
      expect(e.facts.actualType).toBe('object');
    }
  });

  it('rejects duplicate keys with BuiltinAddressBoundTwiceError', () => {
    const k = 'qlang/test-prim/dup';
    registry.bind(k, () => 'first');
    expect(() => registry.bind(k, () => 'second'))
      .toThrow(/qlang\/test-prim\/dup is already bound/);
  });

  it('duplicate-key error is a QlangInvariantError carrying the address', () => {
    const k = 'qlang/test-prim/dup';
    registry.bind(k, () => null);
    try {
      registry.bind(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('AddressBoundTwiceError');
      expect(e.facts.address).toBe('qlang/test-prim/dup');
    }
  });

  it('rejects binding after seal with BuiltinTableSealedError', () => {
    registry.seal();
    const k = 'qlang/test-prim/late';
    expect(() => registry.bind(k, () => null))
      .toThrow(/the table is sealed/);
  });

  it('sealed-registry error is a QlangInvariantError', () => {
    registry.seal();
    const k = 'qlang/test-prim/late';
    try {
      registry.bind(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('TableSealedError');
      expect(e.facts.address).toBe('qlang/test-prim/late');
    }
  });

  it('sealed-registry check fires before keyword type check', () => {
    // The order matters: if you try to bind a non-keyword after
    // seal, the sealed check wins and reports the more useful
    // "registry is sealed" error rather than a type complaint.
    // Verified against a non-keyword input so both checks would fail.
    registry.seal();
    expect(() => registry.bind('not-a-keyword', () => null))
      .toThrow(/the table is sealed/);
  });
});

describe('createPrimitiveRegistry — isolation between instances', () => {
  it('isolated instances do not share state', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    const k = 'qlang/test-prim/iso';
    a.bind(k, () => 'a-impl');
    expect(a.has(k)).toBe(true);
    expect(b.has(k)).toBe(false);
  });

  it('sealing one instance does not seal another', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    a.seal();
    expect(a.isSealed).toBe(true);
    expect(b.isSealed).toBe(false);
    b.bind('qlang/test-prim/b', () => null);
    expect(b.size).toBe(1);
  });
});

describe('PRIMITIVE_REGISTRY', () => {
  it('is the module-level singleton with the registry shape', () => {
    expect(PRIMITIVE_REGISTRY).toBeDefined();
    expect(typeof PRIMITIVE_REGISTRY.bind).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.implsUnder).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.has).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.seal).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.isSealed).toBe('boolean');
    expect(typeof PRIMITIVE_REGISTRY.size).toBe('number');
  });

  it('is the same instance across module re-imports (singleton)', async () => {
    const mod = await import('../../src/primitives.mjs');
    expect(mod.PRIMITIVE_REGISTRY).toBe(PRIMITIVE_REGISTRY);
  });
});

describe('PRIMITIVE_REGISTRY — the implementations of the language by address [D72]', () => {
  it('binds one under the address of every verb and kind of the language that ends in ::builtin{}, a function whose recipe it is among them, and no other', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { ROOT_KEY } = await import('../../src/env-keys.mjs');
    const { isBuiltinDescriptor, isFn, recipeOf } = await import('../../src/types.mjs');
    const root = (await langRuntime()).get(ROOT_KEY);
    const builtinOf = value => (isFn(value) ? recipeOf(value) : value);
    const builtins = [...root].filter(([, record]) => isBuiltinDescriptor(builtinOf(record.get('value')))).map(([name]) => name);
    expect(builtins.every(name => PRIMITIVE_REGISTRY.has(name))).toBe(true);
    expect(PRIMITIVE_REGISTRY.size).toBe(builtins.length);
    expect(PRIMITIVE_REGISTRY.has('number/add') && PRIMITIVE_REGISTRY.has('vec/construct')).toBe(true);
  });

  it('hands a source of the language the implementations under its noun', () => {
    expect(Object.keys(PRIMITIVE_REGISTRY.implsUnder('number'))).toContain('number/add');
    expect(Object.keys(PRIMITIVE_REGISTRY.implsUnder('vec'))).toContain('vec/construct');
    expect(PRIMITIVE_REGISTRY.implsUnder(null)).toEqual({});
  });
});
