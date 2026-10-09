// The implementations of the language by the address of the verb or the
// kind each serves, `number/add`, `vec` [D157]: each runtime module binds
// its own as it loads, the bootstrap hands each source of the language
// those under its noun as a host hands its own [D80], and seals the
// table.

import { declareInvariantError, declarePerSiteError } from './errors.mjs';

const BuiltinAddressNotStringError = declareInvariantError(
  'builtin/AddressNotStringError',
  ({ actualType }) => `bind: an address must be a string, got ${actualType}`,
  { operand: '::builtin' }
);

const BuiltinAddressBoundTwiceError = declareInvariantError(
  'builtin/AddressBoundTwiceError',
  ({ address }) => `bind: ${address} is already bound; two runtime modules claim the same address`,
  { operand: '::builtin' }
);

const BuiltinTableSealedError = declareInvariantError(
  'builtin/TableSealedError',
  ({ address }) => `bind: the table is sealed; cannot bind ${address} after the bootstrap`,
  { operand: '::builtin' }
);

// A verb or a kind ending in `::builtin{}` that no implementation was
// handed for, refused as the root is declared [D157].
export const BuiltinImplementationNotHandedError = declarePerSiteError(
  'builtin/ImplementationNotHandedError', 'primitiveUnbound',
  ({ name }) => `no implementation is handed for ${name}, which ends in ::builtin{}`,
  { operand: '::builtin' }
);

// createPrimitiveRegistry() → a table of its own, for a test.
export function createPrimitiveRegistry() {
  const bindings = new Map();
  let sealed = false;

  return {
    bind(key, impl) {
      if (sealed) {
        throw new BuiltinTableSealedError({ address: key });
      }
      if (typeof key !== 'string') {
        throw new BuiltinAddressNotStringError({ actualType: typeof key });
      }
      if (bindings.has(key)) {
        throw new BuiltinAddressBoundTwiceError({ address: key });
      }
      bindings.set(key, impl);
      return key;
    },

    resolve(key) {
      if (!bindings.has(key)) {
        throw new BuiltinImplementationNotHandedError({ name: key });
      }
      return bindings.get(key);
    },

    has(key) {
      return bindings.has(key);
    },

    // The implementations under a noun, by address, each a name under
    // one; the language's own source, which declares under none, takes
    // none.
    implsUnder(nounName) {
      const under = {};
      for (const [address, impl] of bindings) {
        if (address.slice(0, address.lastIndexOf('/')) === nounName) under[address] = impl;
      }
      return under;
    },

    seal() {
      sealed = true;
    },

    get isSealed() {
      return sealed;
    },

    get size() {
      return bindings.size;
    }
  };
}

// The table every runtime module binds into.
export const PRIMITIVE_REGISTRY = createPrimitiveRegistry();

// bindPrim(addresses, impl) — binds an implementation under the address
// of each verb or kind it serves, one or several.
export function bindPrim(addresses, impl) {
  for (const address of [addresses].flat()) PRIMITIVE_REGISTRY.bind(address, impl);
}

// A primitive that reads the scope of its call takes the state of the
// call after its values [D79]; every other primitive is a plain function
// over the values of the parts of the call [D164].
const STATE_READERS = new WeakSet();

export function bindStateReader(addresses, impl) {
  STATE_READERS.add(impl);
  bindPrim(addresses, impl);
}

export function readsState(impl) {
  return STATE_READERS.has(impl);
}

// A primitive whose answer names the tags its subject stood beneath takes
// the tags the walk of its subject passed, from the outside in, after its
// values [D34]: `raise` names its error by the outermost [D86].
const READERS_OF_PASSED_TAGS = new WeakSet();

export function bindReaderOfPassedTags(addresses, impl) {
  READERS_OF_PASSED_TAGS.add(impl);
  bindPrim(addresses, impl);
}

export function readsPassedTags(impl) {
  return READERS_OF_PASSED_TAGS.has(impl);
}

