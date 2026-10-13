// The implementations of the language by the address of the verb or the
// kind each serves, `number/add`, `vec` [D157]: each runtime module binds
// its own as it loads, the bootstrap hands each source of the language
// those under its noun as a host hands its own [D80], and seals the
// table.

import { declareInvariantError } from './errors.mjs';
import { splitAddress } from './address.mjs';

const BuiltinAddressNotStringError = declareInvariantError(
  'builtin/AddressNotStringError',
  ({ actualType }) => `bind: an address must be a string, got ${actualType}`);

const BuiltinAddressBoundTwiceError = declareInvariantError(
  'builtin/AddressBoundTwiceError',
  ({ address }) => `bind: ${address} is already bound; two runtime modules claim the same address`);

const BuiltinTableSealedError = declareInvariantError(
  'builtin/TableSealedError',
  ({ address }) => `bind: the table is sealed; cannot bind ${address} after the bootstrap`);

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

    has(key) {
      return bindings.has(key);
    },

    // The implementations under a noun, by address, each a name under
    // one.
    implsUnder(nounName) {
      const under = {};
      for (const [address, impl] of bindings) {
        if (splitAddress(address)[0] === nounName) under[address] = impl;
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
// values [D34]: `raise` names its error by the outermost [D13].
const READERS_OF_PASSED_TAGS = new WeakSet();

export function bindReaderOfPassedTags(addresses, impl) {
  READERS_OF_PASSED_TAGS.add(impl);
  bindPrim(addresses, impl);
}

export function readsPassedTags(impl) {
  return READERS_OF_PASSED_TAGS.has(impl);
}

// runs(names, impl) → the primitive, which runs the inputs of those names
// as code [D251]: its call hands each as code closed at the call, each
// element of one that holds the objects of the call whole, and any other
// value as it is.
const INPUTS_RUN = new WeakMap();

export function runs(names, impl) {
  INPUTS_RUN.set(impl, new Set(names));
  return impl;
}

export function inputsRunBy(impl) {
  return INPUTS_RUN.get(impl);
}

