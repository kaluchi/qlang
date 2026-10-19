// Tests for src/primitives.mjs — the table of the primitives of the
// language by the address of the verb or the kind each serves, which the
// bootstrap hands each source of the language [QSDSP#residence], [QSHST#source].
//
// Every test registers into an isolated table via createPrimitiveRegistry()
// so state does not leak between cases; PRIMITIVE_REGISTRY, which the
// runtime modules register into as they load, is read and never written.

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

  it('register(address, primitive) stores the primitive under the address', () => {
    const k = 'qlang/test-prim/foo';
    const primitive = (state, _lambdas) => state;
    registry.register(k, primitive);
    expect(registry.size).toBe(1);
    expect(registry.primitivesUnder('qlang/test-prim')[k]).toBe(primitive);
  });

  it('register answers the address it registered under', () => {
    const k = 'qlang/test-prim/re-export';
    const primitive = () => null;
    const returned = registry.register(k, primitive);
    expect(returned).toBe(k);
    expect(registry.primitivesUnder('qlang/test-prim')[returned]).toBe(primitive);
  });

  it('has(address) reports whether a primitive is registered under it', () => {
    const k = 'qlang/test-prim/foo';
    expect(registry.has(k)).toBe(false);
    registry.register(k, () => null);
    expect(registry.has(k)).toBe(true);
  });

  it('holds(primitive) tells a primitive the table holds from one it does not [QSHST#source]', () => {
    const registered = () => 'registered';
    registry.register('qlang/test-prim/held', registered);
    expect(registry.holds(registered)).toBe(true);
    expect(registry.holds(() => 'registered')).toBe(false);
  });

  it('multiple primitives grow the size counter', () => {
    registry.register('qlang/test-prim/a', () => 'a');
    registry.register('qlang/test-prim/b', () => 'b');
    registry.register('qlang/test-prim/c', () => 'c');
    expect(registry.size).toBe(3);
  });

  it('seal() closes the registry against further registering', () => {
    registry.seal();
    expect(registry.isSealed).toBe(true);
  });

  it('seal is idempotent', () => {
    registry.seal();
    registry.seal();
    expect(registry.isSealed).toBe(true);
  });

  it('the primitives stay readable after seal', () => {
    const k = 'qlang/test-prim/foo';
    const primitive = () => 42;
    registry.register(k, primitive);
    registry.seal();
    expect(registry.primitivesUnder('qlang/test-prim')[k]).toBe(primitive);
    expect(registry.has(k)).toBe(true);
  });
});

describe('createPrimitiveRegistry — the refusals of registering', () => {
  let registry;

  beforeEach(() => {
    registry = createPrimitiveRegistry();
  });

  it('rejects non-string addresses with BuiltinAddressNotStringError, naming the address as JavaScript holds it [QSHST#source]', () => {
    expect(() => registry.register(Symbol('bad'), () => null))
      .toThrow('an address must be a string, got symbol Symbol(bad)');
  });

  it('rejects number addresses', () => {
    expect(() => registry.register(42, () => null))
      .toThrow('an address must be a string, got number 42');
  });

  it('rejects object addresses', () => {
    expect(() => registry.register({ not: 'keyword' }, () => null))
      .toThrow('an address must be a string, got object Object');
  });

  it('non-string rejection is a QlangInvariantError, its :actualValue the address as JavaScript holds it [QSHST#source]', () => {
    try {
      registry.register(null, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('AddressNotStringError');
      expect(e.facts).toEqual({ actualValue: 'null' });
    }
  });

  it('rejects an address registered twice with BuiltinAddressRegisteredTwiceError [QSHST#source]', () => {
    const k = 'qlang/test-prim/dup';
    registry.register(k, () => 'first');
    expect(() => registry.register(k, () => 'second'))
      .toThrow(/qlang\/test-prim\/dup is already registered/);
  });

  it('an address registered twice is a QlangInvariantError carrying the address', () => {
    const k = 'qlang/test-prim/dup';
    registry.register(k, () => null);
    try {
      registry.register(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('AddressRegisteredTwiceError');
      expect(e.address).toBe('builtin/AddressRegisteredTwiceError');
      expect(e.facts.address).toBe('qlang/test-prim/dup');
    }
  });

  it('rejects registering after seal with BuiltinTableSealedError', () => {
    registry.seal();
    const k = 'qlang/test-prim/late';
    expect(() => registry.register(k, () => null))
      .toThrow(/the table is sealed; cannot register qlang\/test-prim\/late/);
  });

  it('sealed-registry error is a QlangInvariantError', () => {
    registry.seal();
    const k = 'qlang/test-prim/late';
    try {
      registry.register(k, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangInvariantError);
      expect(e.name).toBe('TableSealedError');
      expect(e.facts.address).toBe('qlang/test-prim/late');
    }
  });

  it('sealed-registry check fires before the check of the address', () => {
    // The order matters: if you try to register under a non-string after
    // seal, the sealed check wins and reports the more useful
    // "table is sealed" error rather than a type complaint.
    registry.seal();
    expect(() => registry.register(42, () => null))
      .toThrow(/the table is sealed/);
  });
});

describe('createPrimitiveRegistry — isolation between instances', () => {
  it('isolated instances do not share state', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    const k = 'qlang/test-prim/iso';
    const primitive = () => 'a-primitive';
    a.register(k, primitive);
    expect(a.has(k)).toBe(true);
    expect(b.has(k)).toBe(false);
    expect(b.holds(primitive)).toBe(false);
  });

  it('sealing one instance does not seal another', () => {
    const a = createPrimitiveRegistry();
    const b = createPrimitiveRegistry();
    a.seal();
    expect(a.isSealed).toBe(true);
    expect(b.isSealed).toBe(false);
    b.register('qlang/test-prim/b', () => null);
    expect(b.size).toBe(1);
  });
});

describe('PRIMITIVE_REGISTRY', () => {
  it('is the module-level singleton with the methods of a registry', () => {
    expect(PRIMITIVE_REGISTRY).toBeDefined();
    expect(typeof PRIMITIVE_REGISTRY.register).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.primitivesUnder).toBe('function');
    expect(typeof PRIMITIVE_REGISTRY.holds).toBe('function');
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

describe('PRIMITIVE_REGISTRY — the primitives of the language by address [QSDSP#residence]', () => {
  it('registers one under the address of every verb and kind of the language that ends in ::builtin{}, a function whose recipe it is among them, and no other', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { ROOT_KEY } = await import('../../src/scope-keys.mjs');
    const { isBuiltinDescriptor, isFn, recipeOf } = await import('../../src/types.mjs');
    const root = (await langRuntime()).get(ROOT_KEY);
    const builtinOf = value => (isFn(value) ? recipeOf(value) : value);
    const answeredByPrimitives = [...root].filter(([, record]) => isBuiltinDescriptor(builtinOf(record.get('value')))).map(([name]) => name);
    expect(answeredByPrimitives.every(name => PRIMITIVE_REGISTRY.has(name))).toBe(true);
    expect(PRIMITIVE_REGISTRY.size).toBe(answeredByPrimitives.length);
    expect(PRIMITIVE_REGISTRY.has('number/add') && PRIMITIVE_REGISTRY.has('vec/construct')).toBe(true);
  });

  it('hands a source of the language the primitives under its noun, each one the table holds', () => {
    const underNumber = PRIMITIVE_REGISTRY.primitivesUnder('number');
    expect(Object.keys(underNumber)).toContain('number/add');
    expect(PRIMITIVE_REGISTRY.holds(underNumber['number/add'])).toBe(true);
    expect(Object.keys(PRIMITIVE_REGISTRY.primitivesUnder('vec'))).toContain('vec/construct');
    expect(PRIMITIVE_REGISTRY.primitivesUnder(null)).toEqual({});
  });
});
