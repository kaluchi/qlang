// The errors of the runtime: a refusal of a query, one kind for every
// place that refuses, whose facts the catalog declares [D172], and the
// defects of the runtime and of what its host handed, which never reach
// a query as values.
//
// Every QlangError carries:
//   .facts    — the facts its site hands, which the lift into an error
//               value orders as the catalog declares them [D172];
//   .location — the position in the query of the step that raised it,
//               set as it bubbles past a node, so an editor marks it.

export class QlangError extends Error {
  constructor(message, facts = {}) {
    super(message);
    this.name = 'QlangError';
    this.facts = facts;
    this.location = null;
  }
}

// A defect of the runtime or of what a host handed: the table of
// implementations, the bootstrap, the root a host's sources declare. It is
// raised past the fail track to the host, with its message.
export class QlangInvariantError extends QlangError {
  constructor(message, facts = {}) {
    super(message, facts);
    this.name = 'QlangInvariantError';
  }
}

// The addresses of the errors the runtime declares, one site each, which
// the catalog pages under the place each names [D158].
const declaredAddresses = new Set();

export function recordRefusal(address) {
  if (declaredAddresses.has(address)) throw new BuiltinRefusalDeclaredTwiceError({ address });
  declaredAddresses.add(address);
}

export function declaredRefusals() {
  return declaredAddresses.values();
}

// A class answers the last name of its address as `name`, which a stack
// frame reads, and carries the address, the tag of the error [D158].
export function brand(Cls, address) {
  Object.defineProperty(Cls, 'name', { value: lastNameOf(address) });
  Object.defineProperty(Cls.prototype, 'address', { value: address });
  return Cls;
}

export function lastNameOf(address) {
  return address.slice(address.lastIndexOf('/') + 1);
}

// declareRefusal(address) → the class of the refusal of one place, whose
// instances hand the facts of the site; the address is its tag and the
// name of its page, the procedure, and its message [D158], [D172].
export function declareRefusal(address) {
  recordRefusal(address);
  const Cls = class extends QlangError {
    constructor(facts = {}) {
      super(`::${address}`, facts);
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}

// declareInvariantError(address, buildMessage) → the class of a defect,
// its message built from the facts the site hands.
export function declareInvariantError(address, buildMessage) {
  recordRefusal(address);
  const Cls = class extends QlangInvariantError {
    constructor(facts = {}) {
      super(buildMessage(facts), facts);
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}

// declareForeignError(address, buildMessage) → the class of a failure of
// the embedding, which the host could not hand the runtime: it extends
// `Error`, so the fail track never sees it and it rides out to the host.
export function declareForeignError(address, buildMessage) {
  recordRefusal(address);
  const Cls = class extends Error {
    constructor(facts = {}) {
      super(buildMessage(facts));
      this.name = lastNameOf(address);
      this.facts = facts;
    }
  };
  return brand(Cls, address);
}

// First among the classes, which `recordRefusal` reaches for on an
// address declared twice.
export const BuiltinRefusalDeclaredTwiceError = declareInvariantError('builtin/RefusalDeclaredTwiceError',
  ({ address }) => `${address} is declared by two sites of the runtime, and one page names it`);

export const CallUnknownNameError = declareRefusal('call/UnknownNameError');

// A name with a path that no declaration names [D62], [D153].
export const CallUnknownAddressError = declareRefusal('call/UnknownAddressError');

// One more nested frame of evaluation past the budget, a runaway in the
// recursion of the query (`state.mjs`).
export const CallEvaluationDepthExceededError = declareRefusal('call/EvaluationDepthExceededError');

// A declaration of a name an earlier step of its scope declared [D44],
// [D71], or of an address the root holds [D153].
export const BindNameDeclaredTwiceError = declareRefusal('bind/NameDeclaredTwiceError');

// A name whose code calls a name marked `@` carries the mark itself [D69].
export const BindEffectMarkMissingError = declareRefusal('bind/EffectMarkMissingError');
