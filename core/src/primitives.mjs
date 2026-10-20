// The primitives of the language by the address of the verb or the kind each
// serves, `number/add`, `vec` [QSDSP#residence]: each module of the runtime
// registers its own as it loads, and the bootstrap hands each source of the
// language those under its noun as a host hands its own and seals the table
// [QSHST#source].

import { declareDefect } from './errors.mjs';
import { splitAddress } from './address.mjs';
import { accountOfForeign } from './types.mjs';

const BuiltinAddressNotStringError = declareDefect(
  'builtin/AddressNotStringError',
  ({ actualValue }) => `register: an address must be a string, got ${actualValue}`);

const BuiltinAddressRegisteredTwiceError = declareDefect(
  'builtin/AddressRegisteredTwiceError',
  ({ address }) => `register: ${address} is already registered; two runtime modules claim the same address`);

const BuiltinTableSealedError = declareDefect(
  'builtin/TableSealedError',
  ({ address }) => `register: the table is sealed; cannot register ${address} after the bootstrap`);

const primitives = new Map();
const registered = new WeakSet();
let sealed = false;

// The table the runtime registers into and the bootstrap seals.
export const PRIMITIVE_REGISTRY = {
  register(address, primitive) {
    if (sealed) throw new BuiltinTableSealedError({ address });
    if (typeof address !== 'string') throw new BuiltinAddressNotStringError({ actualValue: accountOfForeign(address) });
    if (primitives.has(address)) throw new BuiltinAddressRegisteredTwiceError({ address });
    primitives.set(address, primitive);
    registered.add(primitive);
  },

  // Whether the table holds a primitive, one of the core's own.
  holds(primitive) {
    return registered.has(primitive);
  },

  // The primitives under a noun, by address, each a name under one.
  primitivesUnder(nounName) {
    const under = {};
    for (const [address, primitive] of primitives) {
      if (splitAddress(address)[0] === nounName) under[address] = primitive;
    }
    return under;
  },

  seal() {
    sealed = true;
  }
};

// registerPrimitive(addresses, primitive) — registers a primitive under the
// address of each verb or kind it serves, one or several.
export function registerPrimitive(addresses, primitive) {
  for (const address of [addresses].flat()) PRIMITIVE_REGISTRY.register(address, primitive);
}

// A primitive that reads the state of its call takes it after the values of
// its inputs, and every other takes the values alone [QSHST#source].
const STATE_READERS = new WeakSet();

export function readingState(primitive) {
  STATE_READERS.add(primitive);
  return primitive;
}

export function registerStateReader(addresses, primitive) {
  registerPrimitive(addresses, readingState(primitive));
}

export function readsState(primitive) {
  return STATE_READERS.has(primitive);
}

// A primitive whose answer names the tags its subject stood beneath takes
// the tags the walk of its subject passed, from the outside in, after its
// values [QSDSP#walk]: `raise` names its error by the outermost [QSERR#raise].
const READERS_OF_PASSED_TAGS = new WeakSet();

export function registerReaderOfPassedTags(addresses, primitive) {
  READERS_OF_PASSED_TAGS.add(primitive);
  registerPrimitive(addresses, primitive);
}

export function readsPassedTags(primitive) {
  return READERS_OF_PASSED_TAGS.has(primitive);
}

// runs(names, primitive) → the primitive, which runs the inputs of those
// names as code [QSHST#source]: its call hands each as code closed at the call, each
// element of one that holds the args of the call whole, and any other value
// as it is.
const INPUTS_RUN = new WeakMap();

export function runs(names, primitive) {
  INPUTS_RUN.set(primitive, new Set(names));
  return primitive;
}

export function inputsRunBy(primitive) {
  return INPUTS_RUN.get(primitive);
}

// runsWithin(names, primitive) → the primitive, which runs the quotes a
// template of those inputs holds, at any depth of it, as code closed at the
// call, its paths and its other values handed as they are [QSPTH#template].
const INPUTS_RUN_WITHIN = new WeakMap();

export function runsWithin(names, primitive) {
  INPUTS_RUN_WITHIN.set(primitive, new Set(names));
  return primitive;
}

export function inputsRunWithin(primitive) {
  return INPUTS_RUN_WITHIN.get(primitive);
}

// folds(names, primitive) → the primitive, which folds by the inputs of
// those names, each handed as the code that folds the value so far and an
// element [QSCOL#reduce].
const INPUTS_FOLDED_BY = new WeakMap();

export function folds(names, primitive) {
  INPUTS_FOLDED_BY.set(primitive, new Set(names));
  return primitive;
}

export function inputsFoldedBy(primitive) {
  return INPUTS_FOLDED_BY.get(primitive);
}
