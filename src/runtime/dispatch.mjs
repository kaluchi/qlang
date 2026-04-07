// Dispatch helpers for operand impls.
//
// All operand impls under the new Rule 10 receive
// `(pipeValue, lambdas)` where lambdas is an array of
// `(input) => value` closures. These helpers package the common
// patterns:
//
//   valueOp(name, n, impl)
//     - For "value" operands like add, sub, mul, gt, eq.
//     - Partial (k = n - 1): subject = pipeValue, modifiers =
//       lambdas resolved against pipeValue.
//     - Full (k = n): all slots = lambdas resolved against
//       pipeValue (the context).
//     - impl signature: (slot1, slot2, ..., slotN) → result
//
//   higherOrderOp(name, n, impl)
//     - For higher-order operands like filter, sort(key).
//     - Subject is always pipeValue (no full form for these).
//     - Captured lambdas are passed UNRESOLVED so the impl can
//       invoke them per element.
//     - impl signature: (subject, lambda1, lambda2, ...) → result

import { makeFn } from '../rule10.mjs';
import { ArityError } from '../errors.mjs';

export function valueOp(name, n, impl) {
  return makeFn(name, n, (pipeValue, lambdas) => {
    const k = lambdas.length;
    if (k === n - 1) {
      // Partial: subject = pipeValue, modifiers resolved against pipeValue.
      const modifiers = lambdas.map(lam => lam(pipeValue));
      return impl(pipeValue, ...modifiers);
    }
    if (k === n) {
      // Full: every slot from a captured lambda, resolved against pipeValue.
      const slots = lambdas.map(lam => lam(pipeValue));
      return impl(...slots);
    }
    throw new ArityError(
      `${name} expects ${n - 1} or ${n} captured args, got ${k}`
    );
  });
}

export function higherOrderOp(name, n, impl) {
  return makeFn(name, n, (pipeValue, lambdas) => {
    const k = lambdas.length;
    if (k === n - 1) {
      // Subject is pipeValue; modifiers stay unresolved (lambdas).
      return impl(pipeValue, ...lambdas);
    }
    throw new ArityError(
      `${name} expects ${n - 1} captured args (higher-order), got ${k}`
    );
  });
}

// nullaryOp(name, impl) — arity 1, no captured args, subject = pipeValue.
export function nullaryOp(name, impl) {
  return makeFn(name, 1, (pipeValue, lambdas) => {
    if (lambdas.length !== 0) {
      throw new ArityError(`${name} takes no arguments, got ${lambdas.length}`);
    }
    return impl(pipeValue);
  });
}
