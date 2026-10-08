// Tests for src/primitives.mjs — the primitive registry that bridges
// qlang-level Map-form binding descriptors (carrying :impl
// keywords) and their JS-level executable impls in runtime/*.mjs.
//
// Every test binds into an isolated registry via createPrimitiveRegistry()
// so state does not leak between cases; PRIMITIVE_REGISTRY has a small
// sanity test that confirms it exists and behaves like any other
// instance but does NOT mutate it (production runtime/*.mjs modules
// will bind into it under Variant B, and tests here run before those
// modules exist so polluting it would poison later steps).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrimitiveRegistry,
  PRIMITIVE_REGISTRY
} from '../../src/primitives.mjs';

import { QlangError, QlangInvariantError } from '../../src/errors.mjs';

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
    expect(registry.resolve(k)).toBe(impl);
  });

  it('bind returns the key to enable fluent re-export', () => {
    // The idiom: `export const add = PRIMITIVE_REGISTRY.bind(key, impl);`
    // so the runtime module's export IS the keyword that core.qlang's
    // :impl field points to.
    const k = 'qlang/test-prim/re-export';
    const impl = () => null;
    const returned = registry.bind(k, impl);
    expect(returned).toBe(k);
    expect(registry.resolve(returned)).toBe(impl);
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

  it('resolve still works after seal', () => {
    const k = 'qlang/test-prim/foo';
    const impl = () => 42;
    registry.bind(k, impl);
    registry.seal();
    expect(registry.resolve(k)).toBe(impl);
    expect(registry.has(k)).toBe(true);
  });
});

describe('createPrimitiveRegistry — bind error classes', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('rejects non-string keys with AddressNotStringError', () => {
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
      expect(e.kind).toBe('invariantError');
      expect(e.context.actualType).toBe('object');
    }
  });

  it('rejects duplicate keys with AddressBoundTwiceError', () => {
    const k = 'qlang/test-prim/dup';
    registry.bind(k, () => 'first');
    expect(() => registry.bind(k, () => 'second'))
      .toThrow(/qlang\/test-prim\/dup is already bound/);
  });

  it('duplicate-key error is a QlangInvariantError carrying keyName', () => {
    const k = 'qlang/test-prim/dup';
    registry.bind(k, () => null);
    try {
      registry.bind(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('AddressBoundTwiceError');
      expect(e.context.keyName).toBe('qlang/test-prim/dup');
    }
  });

  it('rejects binding after seal with TableSealedError', () => {
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
      expect(e.context.keyLabel).toBe('qlang/test-prim/late');
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

describe('createPrimitiveRegistry — resolve error class', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('throws ImplementationNotHandedError on missing key', () => {
    const k = 'qlang/test-prim/missing';
    expect(() => registry.resolve(k))
      .toThrow(/no implementation is handed for qlang\/test-prim\/missing/);
  });

  it('unbound-key is a QlangError (lifts to fail-track)', () => {
    // Critical classification: this is a DATA error, not an invariant.
    // A hand-crafted descriptor Map with a bad :impl keyword
    // should fail gracefully through evalNode's try/catch and become
    // an error value, not crash the evaluator.
    const k = 'qlang/test-prim/missing';
    try {
      registry.resolve(k);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangError);
      expect(e).not.toBeInstanceOf(QlangInvariantError);
      expect(e.kind).toBe('primitiveUnbound');
      expect(e.name).toBe('ImplementationNotHandedError');
      expect(e.context.keyLabel).toContain('qlang/test-prim/missing');
    }
  });

  it('tolerates non-keyword lookup with a readable label', () => {
    // resolve() is stricter than bind() because it only throws
    // ImplementationNotHandedError when the key is unknown — it does not
    // separately validate the key type. A non-keyword lookup
    // produces the missing-key error with a typeof label.
    expect(() => registry.resolve('not-a-keyword'))
      .toThrow(/no implementation is handed for /);
    expect(() => registry.resolve(42))
      .toThrow(/no implementation is handed for 42/);
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
    expect(() => b.resolve(k)).toThrow(/no implementation is handed/);
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
    expect(typeof PRIMITIVE_REGISTRY.resolve).toBe('function');
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

describe('PRIMITIVE_REGISTRY — the implementations of the language by address [D157]', () => {
  it('binds one under the address of every verb and kind of the language that ends in ::builtin{}, and no other', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { ROOT_KEY } = await import('../../src/env-keys.mjs');
    const { endsInBuiltin } = await import('../../src/runtime/verb.mjs');
    const root = (await langRuntime()).get(ROOT_KEY);
    const builtins = [...root].filter(([, record]) => endsInBuiltin(record.get('value'))).map(([name]) => name);
    expect(builtins.every(name => PRIMITIVE_REGISTRY.has(name))).toBe(true);
    expect(PRIMITIVE_REGISTRY.size).toBe(builtins.length);
    expect(PRIMITIVE_REGISTRY.has('number/add') && PRIMITIVE_REGISTRY.has('vec')).toBe(true);
  });

  it('hands a source of the language the implementations under its noun', () => {
    expect(Object.keys(PRIMITIVE_REGISTRY.implsUnder('number'))).toContain('number/add');
    expect(Object.keys(PRIMITIVE_REGISTRY.implsUnder(null))).toContain('vec');
  });
});
