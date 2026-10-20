// The errors of the runtime: a refusal of a query, one kind for every
// place that refuses, whose facts the catalog declares [QSERR#site], and the
// defects of the runtime and of what its host handed, which never reach
// a query as values. Every QlangError carries `.facts`, the facts its site
// hands, which the lift into an error value orders as the catalog declares them.

import { splitAddress } from './address.mjs';

export class QlangError extends Error {
  constructor(message, facts = {}) {
    super(message);
    this.name = 'QlangError';
    this.facts = facts;
  }
}

// A defect of the runtime or of what a host handed: the table of
// primitives, the bootstrap, the root a host's sources declare. It is
// raised past the fail track to the host, with its message.
export class QlangDefect extends QlangError {
  constructor(message, facts = {}) {
    super(message, facts);
    this.name = 'QlangDefect';
  }
}

// The addresses of the errors the runtime declares, one site each, which
// the catalog pages under the place each names [QSERR#site].
const declaredAddresses = new Set();

export function recordRefusal(address) {
  if (declaredAddresses.has(address)) throw new BuiltinRefusalDeclaredTwiceError({ address });
  declaredAddresses.add(address);
}

export function declaredRefusals() {
  return declaredAddresses.values();
}

// A class answers the last name of its address as `name`, which a stack
// frame reads, and carries the address, the tag of the error [QSERR#site].
export function brand(Cls, address) {
  Object.defineProperty(Cls, 'name', { value: splitAddress(address)[1] });
  Object.defineProperty(Cls.prototype, 'address', { value: address });
  return Cls;
}

// declareRefusal(address) → the class of the refusal of one place, whose
// instances hand the facts of the site; the address is its tag and the
// name of its page, the procedure, and its message [QSERR#site].
export function declareRefusal(address) {
  recordRefusal(address);
  const Cls = class extends QlangError {
    constructor(facts = {}) {
      super(`::${address}`, facts);
      this.name = splitAddress(address)[1];
    }
  };
  return brand(Cls, address);
}

// declareDefect(address, buildMessage) → the class of a defect,
// its message built from the facts the site hands.
export function declareDefect(address, buildMessage) {
  recordRefusal(address);
  const Cls = class extends QlangDefect {
    constructor(facts = {}) {
      super(buildMessage(facts), facts);
      this.name = splitAddress(address)[1];
    }
  };
  return brand(Cls, address);
}

// declareForeignError(address, buildMessage) → the class of a failure of
// the embedding, which extends `Error`: the loader of the sources throws it
// at the boot, which reads every source before a step runs, so it rides out
// to the host, and a primitive that throws it inside a step answers
// `::call/HostFailureError`, its message the `:message` [QSERR#site].
export function declareForeignError(address, buildMessage) {
  recordRefusal(address);
  const Cls = class extends Error {
    constructor(facts = {}) {
      super(buildMessage(facts));
      this.name = splitAddress(address)[1];
      this.facts = facts;
    }
  };
  return brand(Cls, address);
}

// First among the classes, which `recordRefusal` reaches for on an
// address declared twice.
export const BuiltinRefusalDeclaredTwiceError = declareDefect('builtin/RefusalDeclaredTwiceError',
  ({ address }) => `${address} is declared by two sites of the runtime, and one page names it`);

export const CallUnknownNameError = declareRefusal('call/UnknownNameError');

// A name with a path that no declaration names [QSDSP#walk], [QSDSP#residence].
export const CallUnknownAddressError = declareRefusal('call/UnknownAddressError');

// A step one deeper than the limit of the evaluation depth, a runaway in
// the recursion of the query (`state.mjs`) [QSNAM#verb].
export const CallEvaluationDepthExceededError = declareRefusal('call/EvaluationDepthExceededError');

// A declaration of a name an earlier step of its scope declared, or of an
// address the root holds [QSNAM#scope], [QSNAM#address].
export const BindNameDeclaredTwiceError = declareRefusal('bind/NameDeclaredTwiceError');
