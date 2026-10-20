// Tests for src/primitives.mjs — the table of the primitives of the
// language by the address of the verb or the kind each serves, which the
// bootstrap hands each source of the language and seals [QSDSP#residence],
// [QSHST#source].
//
// The table is one: the tests register into it before this file loads the
// runtime, then read what the runtime registered, and last meet its seal.

import { describe, it, expect } from 'vitest';
import { PRIMITIVE_REGISTRY } from '../../src/primitives.mjs';
import { QlangDefect } from '../../src/errors.mjs';

describe('the table of the primitives — registering before the bootstrap', () => {
  it('holds a primitive registered under an address, the primitives under its noun answering it [QSHST#source]', () => {
    const primitive = () => 'held';
    PRIMITIVE_REGISTRY.register('testPrim/held', primitive);
    expect(PRIMITIVE_REGISTRY.primitivesUnder('testPrim')).toEqual({ 'testPrim/held': primitive });
    expect(PRIMITIVE_REGISTRY.holds(primitive)).toBe(true);
    expect(PRIMITIVE_REGISTRY.holds(() => 'held')).toBe(false);
  });

  it('refuses an address that is no string, naming the address as JavaScript holds it [QSHST#source]', () => {
    for (const [address, account] of [[Symbol('bad'), 'symbol Symbol(bad)'], [42, 'number 42'], [{ not: 'keyword' }, 'object Object']]) {
      expect(() => PRIMITIVE_REGISTRY.register(address, () => null)).toThrow(`an address must be a string, got ${account}`);
    }
    try {
      PRIMITIVE_REGISTRY.register(null, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangDefect);
      expect(e.name).toBe('AddressNotStringError');
      expect(e.facts).toEqual({ actualValue: 'null' });
    }
  });

  it('refuses an address registered twice, carrying the address [QSHST#source]', () => {
    PRIMITIVE_REGISTRY.register('testPrim/twice', () => 'first');
    try {
      PRIMITIVE_REGISTRY.register('testPrim/twice', () => 'second');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangDefect);
      expect(e.address).toBe('builtin/AddressRegisteredTwiceError');
      expect(e.facts.address).toBe('testPrim/twice');
      expect(e.message).toMatch(/testPrim\/twice is already registered/);
    }
  });
});

describe('the table of the primitives — the primitives of the language by address [QSDSP#residence]', () => {
  it('registers one under the address of every verb and kind of the language that ends in ::builtin{}, a function whose recipe it is among them, and no other', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { ROOT_KEY } = await import('../../src/scope-keys.mjs');
    const { splitAddress } = await import('../../src/address.mjs');
    const { isBuiltinDescriptor, isFn, recipeOf, bindingValueOf } = await import('../../src/types.mjs');
    const root = (await langRuntime()).get(ROOT_KEY);
    const builtinOf = value => (isFn(value) ? recipeOf(value) : value);
    const answeredByPrimitives = [...root].filter(([, record]) => isBuiltinDescriptor(builtinOf(bindingValueOf(record)))).map(([name]) => name);
    const nouns = new Set([...root.keys()].map(name => splitAddress(name)[0]));
    const registered = [...nouns].flatMap(noun => Object.keys(PRIMITIVE_REGISTRY.primitivesUnder(noun)));
    expect(registered.sort()).toEqual(answeredByPrimitives.sort());
    expect(registered).toContain('number/add');
    expect(registered).toContain('vec/construct');
  });

  it('hands a source of the language the primitives under its noun, each one the table holds', () => {
    const underNumber = PRIMITIVE_REGISTRY.primitivesUnder('number');
    expect(PRIMITIVE_REGISTRY.holds(underNumber['number/add'])).toBe(true);
    expect(PRIMITIVE_REGISTRY.primitivesUnder(null)).toEqual({});
  });

  it('refuses a register after the bootstrap sealed the table, before it reads the address', () => {
    try {
      PRIMITIVE_REGISTRY.register(42, () => null);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(QlangDefect);
      expect(e.name).toBe('TableSealedError');
      expect(e.facts.address).toBe(42);
      expect(e.message).toMatch(/the table is sealed/);
    }
    expect(PRIMITIVE_REGISTRY.primitivesUnder('testPrim')).toHaveProperty('testPrim/held');
  });
});
