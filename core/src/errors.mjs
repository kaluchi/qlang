// [QSERR#site]

import { splitAddress } from './address.mjs';

export class QlangError extends Error {
  constructor(message, facts = {}) {
    super(message);
    this.name = 'QlangError';
    this.facts = facts;
  }
}

// [QSERR#site], [QSERR#trace]
export const refusingAPart = (refusal, ...segments) => Object.assign(refusal, { part: segments });

export class QlangDefect extends QlangError {
  constructor(message, facts = {}) {
    super(message, facts);
    this.name = 'QlangDefect';
  }
}

// [QSERR#site]
const declaredAddresses = new Set();

export function recordRefusal(address) {
  if (declaredAddresses.has(address)) throw new BuiltinRefusalDeclaredTwiceError({ address });
  declaredAddresses.add(address);
}

export function declaredRefusals() {
  return declaredAddresses.values();
}

export function brand(Cls, address) {
  Object.defineProperty(Cls, 'name', { value: splitAddress(address)[1] });
  Object.defineProperty(Cls.prototype, 'address', { value: address });
  return Cls;
}

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

export const BuiltinRefusalDeclaredTwiceError = declareDefect('builtin/RefusalDeclaredTwiceError',
  ({ address }) => `${address} is declared by two sites of the runtime, and one page names it`);

export const CallUnknownNameError = declareRefusal('call/UnknownNameError');

// [QSDSP#walk], [QSDSP#residence]
export const CallUnknownAddressError = declareRefusal('call/UnknownAddressError');

// [QSCND#compare], [QSDSP#answer]
export const CallKindsMismatchedError = declareRefusal('call/KindsMismatchedError');

// [QSNAM#verb]
export const CallEvaluationDepthExceededError = declareRefusal('call/EvaluationDepthExceededError');

// [QSNAM#scope], [QSNAM#address]
export const BindNameDeclaredTwiceError = declareRefusal('bind/NameDeclaredTwiceError');
