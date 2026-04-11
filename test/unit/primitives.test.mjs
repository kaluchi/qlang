// Tests for src/primitives.mjs — the primitive registry that bridges
// qlang-level Map-form binding descriptors (carrying :qlang/impl
// keywords) and their JS-level executable impls in runtime/*.mjs.
//
// Every test creates an isolated registry via createPrimitiveRegistry()
// so state does not leak between cases; SHARED_REGISTRY has a small
// sanity test that confirms it exists and behaves like any other
// instance but does NOT mutate it (production runtime/*.mjs modules
// will populate it under Variant B, and tests here run before those
// modules exist so polluting it would poison later steps).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrimitiveRegistry,
  SHARED_REGISTRY
} from '../../src/primitives.mjs';
import { keyword } from '../../src/types.mjs';
import { QlangError, QlangInvariantError } from '../../src/errors.mjs';

describe('createPrimitiveRegistry — lifecycle', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('starts empty and unfrozen', () => {
    expect(registry.size).toBe(0);
    expect(registry.isFrozen).toBe(false);
  });

  it('register(key, impl) stores the impl under the key', () => {
    const k = keyword('qlang/test-prim/foo');
    const impl = (state, _lambdas) => state;
    registry.register(k, impl);
    expect(registry.size).toBe(1);
    expect(registry.get(k)).toBe(impl);
  });

  it('register returns the key to enable fluent re-export', () => {
    // The idiom: `export const add = registerPrimitive(key, impl);`
    // so the runtime module's export IS the keyword that core.qlang's
    // :qlang/impl field points to.
    const k = keyword('qlang/test-prim/re-export');
    const impl = () => null;
    const returned = registry.register(k, impl);
    expect(returned).toBe(k);
    expect(registry.get(returned)).toBe(impl);
  });

  it('has(key) reports registration state', () => {
    const k = keyword('qlang/test-prim/foo');
    expect(registry.has(k)).toBe(false);
    registry.register(k, () => null);
    expect(registry.has(k)).toBe(true);
  });

  it('multiple registrations grow the size counter', () => {
    registry.register(keyword('qlang/test-prim/a'), () => 'a');
    registry.register(keyword('qlang/test-prim/b'), () => 'b');
    registry.register(keyword('qlang/test-prim/c'), () => 'c');
    expect(registry.size).toBe(3);
  });

  it('freeze() locks the registry', () => {
    registry.freeze();
    expect(registry.isFrozen).toBe(true);
  });

  it('freeze is idempotent', () => {
    registry.freeze();
    registry.freeze();
    expect(registry.isFrozen).toBe(true);
  });

  it('get still works after freeze', () => {
    const k = keyword('qlang/test-prim/foo');
    const impl = () => 42;
    registry.register(k, impl);
    registry.freeze();
    expect(registry.get(k)).toBe(impl);
    expect(registry.has(k)).toBe(true);
  });
});

describe('createPrimitiveRegistry — register error classes', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('rejects string keys with PrimitiveKeyNotKeywordError', () => {
    expect(() => registry.register('not-a-keyword', () => null))
      .toThrow(/key must be a keyword, got string/);
  });

  it('rejects number keys', () => {
    expect(() => registry.register(42, () => null))
      .toThrow(/key must be a keyword, got number/);
  });

  it('rejects plain object keys', () => {
    expect(() => registry.register({ not: 'keyword' }, () => null))
      .toThrow(/key must be a keyword, got object/);
  });

  it('non-keyword rejection is a QlangInvariantError', () => {
    try {
      registry.register('not-a-keyword', () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.fingerprint).toBe('PrimitiveKeyNotKeywordError');
      expect(e.kind).toBe('invariant-error');
      expect(e.context.site).toBe('PrimitiveKeyNotKeywordError');
      expect(e.context.actualType).toBe('string');
    }
  });

  it('rejects duplicate keys with PrimitiveKeyAlreadyRegisteredError', () => {
    const k = keyword('qlang/test-prim/dup');
    registry.register(k, () => 'first');
    expect(() => registry.register(k, () => 'second'))
      .toThrow(/key :qlang\/test-prim\/dup already bound/);
  });

  it('duplicate-key error is a QlangInvariantError carrying keyName', () => {
    const k = keyword('qlang/test-prim/dup');
    registry.register(k, () => null);
    try {
      registry.register(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.fingerprint).toBe('PrimitiveKeyAlreadyRegisteredError');
      expect(e.context.keyName).toBe('qlang/test-prim/dup');
    }
  });

  it('rejects registration after freeze with PrimitiveRegistryFrozenError', () => {
    registry.freeze();
    const k = keyword('qlang/test-prim/late');
    expect(() => registry.register(k, () => null))
      .toThrow(/registry is frozen/);
  });

  it('frozen-registry error is a QlangInvariantError', () => {
    registry.freeze();
    const k = keyword('qlang/test-prim/late');
    try {
      registry.register(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.fingerprint).toBe('PrimitiveRegistryFrozenError');
      expect(e.context.keyLabel).toBe('qlang/test-prim/late');
    }
  });

  it('frozen-registry check fires before keyword type check', () => {
    // The order matters: if you try to register a non-keyword after
    // freeze, the frozen check wins and reports the more useful
    // "registry is frozen" error rather than a type complaint.
    // Verified against a non-keyword input so both checks would fail.
    registry.freeze();
    expect(() => registry.register('not-a-keyword', () => null))
      .toThrow(/registry is frozen/);
  });
});

describe('createPrimitiveRegistry — get error class', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('throws PrimitiveKeyNotRegisteredError on missing key', () => {
    const k = keyword('qlang/test-prim/missing');
    expect(() => registry.get(k))
      .toThrow(/no primitive registered under :qlang\/test-prim\/missing/);
  });

  it('not-registered is a QlangError (lifts to fail-track)', () => {
    // Critical classification: this is a DATA error, not an invariant.
    // A hand-crafted descriptor Map with a bad :qlang/impl keyword
    // should fail gracefully through evalNode's try/catch and become
    // an error value, not crash the evaluator.
    const k = keyword('qlang/test-prim/missing');
    try {
      registry.get(k);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangError);
      expect(e).not.toBeInstanceOf(QlangInvariantError);
      expect(e.kind).toBe('primitive-not-registered');
      expect(e.fingerprint).toBe('PrimitiveKeyNotRegisteredError');
      expect(e.context.keyLabel).toBe('qlang/test-prim/missing');
    }
  });

  it('tolerates non-keyword lookup with a readable label', () => {
    // get() is stricter than register() because it only throws
    // PrimitiveKeyNotRegisteredError when the key is unknown — it does
    // not separately validate the key type. A non-keyword lookup
    // produces the missing-key error with a typeof label.
    expect(() => registry.get('not-a-keyword'))
      .toThrow(/no primitive registered under :string/);
    expect(() => registry.get(42))
      .toThrow(/no primitive registered under :number/);
  });
});

describe('createPrimitiveRegistry — isolation between instances', () => {
  it('isolated instances do not share state', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    const k = keyword('qlang/test-prim/iso');
    a.register(k, () => 'a-impl');
    expect(a.has(k)).toBe(true);
    expect(b.has(k)).toBe(false);
    expect(() => b.get(k)).toThrow(/no primitive registered/);
  });

  it('freezing one instance does not freeze another', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    a.freeze();
    expect(a.isFrozen).toBe(true);
    expect(b.isFrozen).toBe(false);
    b.register(keyword('qlang/test-prim/b'), () => null);
    expect(b.size).toBe(1);
  });
});

describe('SHARED_REGISTRY', () => {
  it('is the module-level singleton with the registry shape', () => {
    expect(SHARED_REGISTRY).toBeDefined();
    expect(typeof SHARED_REGISTRY.register).toBe('function');
    expect(typeof SHARED_REGISTRY.get).toBe('function');
    expect(typeof SHARED_REGISTRY.has).toBe('function');
    expect(typeof SHARED_REGISTRY.freeze).toBe('function');
    expect(typeof SHARED_REGISTRY.isFrozen).toBe('boolean');
    expect(typeof SHARED_REGISTRY.size).toBe('number');
  });

  it('is the same instance across module re-imports (singleton)', async () => {
    const mod = await import('../../src/primitives.mjs');
    expect(mod.SHARED_REGISTRY).toBe(SHARED_REGISTRY);
  });
});
