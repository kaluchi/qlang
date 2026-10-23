// [QSDSP#residence], [QSHST#source]

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

export const PRIMITIVE_REGISTRY = {
  register(address, primitive) {
    if (sealed) throw new BuiltinTableSealedError({ address });
    if (typeof address !== 'string') throw new BuiltinAddressKindNotTakenError({ expected: kindsExpected('string'), actualValue: accountOfForeign(address) });
    if (primitives.has(address)) throw new BuiltinAddressRegisteredTwiceError({ address });
    primitives.set(address, primitive);
    registered.add(primitive);
  },

  holds(primitive) {
    return registered.has(primitive);
  },

  primitivesUnder(nounName) {
    const under = {};
    for (const [address, primitive] of primitives) {
      if ((splitAddress(address)[0] ?? address) === nounName) under[address] = primitive;
    }
    return under;
  },

  seal() {
    sealed = true;
  }
};

export function registerPrimitive(addresses, primitive) {
  for (const address of [addresses].flat()) PRIMITIVE_REGISTRY.register(address, primitive);
}

// [QSHST#source]
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

// [QSDSP#walk], [QSERR#raise]
const READERS_OF_PASSED_TAGS = new WeakSet();

export function registerReaderOfPassedTags(addresses, primitive) {
  READERS_OF_PASSED_TAGS.add(primitive);
  registerPrimitive(addresses, primitive);
}

export function readsPassedTags(primitive) {
  return READERS_OF_PASSED_TAGS.has(primitive);
}

// [QSHST#source], [QSPTH#template], [QSCOL#reduce]
const INPUTS_AS_CODE = new WeakMap();

const marking = way => (names, primitive) => {
  INPUTS_AS_CODE.set(primitive, { ...INPUTS_AS_CODE.get(primitive), [way]: new Set(names) });
  return primitive;
};

export const runs = marking('run');
export const runsWithin = marking('within');
export const folds = marking('folded');
export const inputsAsCode = primitive => INPUTS_AS_CODE.get(primitive);

// [QSDSP#answer]
const COMBINERS = new WeakSet();

export function combines(primitive) {
  COMBINERS.add(primitive);
  return primitive;
}

export const combinesItsInput = primitive => COMBINERS.has(primitive);
