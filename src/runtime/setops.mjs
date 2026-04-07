// Polymorphic set operations: union, minus, inter.
//
// Each operand dispatches on the number of captured arguments via
// overloadedOp:
//
//   bare   (0 captured): subject is a non-empty Vec of operands;
//                        left-fold the binary pair function across it.
//   bound  (1 captured): subject is left, captured is right; apply
//                        the pair function to (left, right-resolved).
//   full   (2 captured): pipeValue is context; both captured args
//                        resolve against it, then apply the pair.
//
// Type dispatch of the underlying pair function:
//   Set × Set      → Set
//   Map × Map      → Map (union: last wins; minus: M1 ∖ keys(M2);
//                         inter: M1 ∩ keys(M2))
//   Map × Set      → Map (key-set semantics; minus/inter only)

import { overloadedOp } from './dispatch.mjs';
import { ensureVec } from './guards.mjs';
import { ComparabilityError, QlangTypeError } from '../errors.mjs';
import { isQMap, isQSet, isKeyword, describeType } from '../types.mjs';

// incompatible — shared helper for "these two operands cannot be
// combined" errors from the three pair functions below. Uses
// ComparabilityError because union/minus/inter across mismatched
// container types is conceptually the same failure mode as
// comparing a number with a string: two values of incompatible
// shape for the operation.
function incompatible(operand, left, right) {
  return new ComparabilityError(operand, describeType(left), describeType(right));
}

function unionPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set(left);
    for (const v of right) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map(left);
    for (const [k, v] of right) out.set(k, v);
    return out;
  }
  throw incompatible('union', left, right);
}

function minusPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) if (!right.has(v)) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map();
    for (const [k, v] of left) if (!right.has(k)) out.set(k, v);
    return out;
  }
  if (isQMap(left) && isQSet(right)) {
    const out = new Map();
    for (const [k, v] of left) {
      if (!isKeyword(k) || !right.has(k)) out.set(k, v);
    }
    return out;
  }
  throw incompatible('minus', left, right);
}

function interPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) if (right.has(v)) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map();
    for (const [k, v] of left) if (right.has(k)) out.set(k, v);
    return out;
  }
  if (isQMap(left) && isQSet(right)) {
    const out = new Map();
    for (const [k, v] of left) {
      if (isKeyword(k) && right.has(k)) out.set(k, v);
    }
    return out;
  }
  throw incompatible('inter', left, right);
}

// polymorphicSetOp — shared factory for union/minus/inter.
//
// Each set operation needs to support three call shapes:
//   bare   `[a b c] | op`        → left-fold pair across the Vec
//   bound  `a | op(b)`           → pair(a, b-resolved-against-a)
//   full   `ctx | op(a, b)`      → pair(a-resolved, b-resolved), ctx is context
//
// overloadedOp dispatches on captured-arg count; each case resolves
// its own lambdas so bare and bound can share a single identifier.
function polymorphicSetOp(name, pair) {
  return overloadedOp(name, 2, {
    0: (vec) => {
      ensureVec(name, vec);
      if (vec.length === 0) {
        throw new QlangTypeError(
          `${name} (bare form) requires a non-empty Vec of operands`,
          { operand: name, form: 'bare', received: 'empty Vec' }
        );
      }
      return vec.reduce(pair);
    },
    1: (pipeValue, rightLambda) => pair(pipeValue, rightLambda(pipeValue)),
    2: (pipeValue, leftLambda, rightLambda) =>
      pair(leftLambda(pipeValue), rightLambda(pipeValue))
  });
}

export const union = polymorphicSetOp('union', unionPair);
export const minus = polymorphicSetOp('minus', minusPair);
export const inter = polymorphicSetOp('inter', interPair);
