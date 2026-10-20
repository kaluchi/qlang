// The primitives of the language by the address of the verb or the kind each
// serves, `number/add`, `vec` [QSDSP#residence]: each module of the runtime
// registers its own as it loads, and the bootstrap hands each source of the
// language those under its noun as a host hands its own and seals the table
// [D389].

import { declareDefect } from './errors.mjs';
import { splitAddress } from './address.mjs';
import { accountOfForeign } from './types.mjs';
import { kindsExpected } from './ordering.mjs';

const BuiltinAddressKindNotTakenError = declareDefect(
  'builtin/AddressKindNotTakenError',
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
    if (typeof address !== 'string') throw new BuiltinAddressKindNotTakenError({ expected: kindsExpected('string'), actualValue: accountOfForeign(address) });
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

// The inputs a primitive reads as code, by name [QSHST#source]: `runs` closed at the call,
// `runsWithin` the quotes of a template [QSPTH#template], `folds` folding [QSCOL#reduce].
const INPUTS_AS_CODE = new WeakMap();

const marking = way => (names, primitive) => {
  INPUTS_AS_CODE.set(primitive, { ...INPUTS_AS_CODE.get(primitive), [way]: new Set(names) });
  return primitive;
};

export const runs = marking('run');
export const runsWithin = marking('within');
export const folds = marking('folded');
export const inputsAsCode = primitive => INPUTS_AS_CODE.get(primitive);

// A primitive that combines its subject with the value its input takes, whose
// value of the subject's kind shares its tags [QSDSP#answer].
const COMBINERS = new WeakSet();

export function combines(primitive) {
  COMBINERS.add(primitive);
  return primitive;
}

export const combinesItsInput = primitive => COMBINERS.has(primitive);
