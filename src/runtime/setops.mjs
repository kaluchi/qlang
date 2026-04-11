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
// Each throw site has its own unique error class.
// Meta lives in manifest.qlang.

import { overloadedOp } from './dispatch.mjs';
import { isVec, isQMap, isQSet, isKeyword, describeType, keyword } from '../types.mjs';
import {
  declareSubjectError,
  declareComparabilityError,
  declareShapeError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const UnionBareSubjectNotVec    = declareSubjectError('UnionBareSubjectNotVec',    'union', 'Vec');
const MinusBareSubjectNotVec    = declareSubjectError('MinusBareSubjectNotVec',    'minus', 'Vec');
const InterBareSubjectNotVec    = declareSubjectError('InterBareSubjectNotVec',    'inter', 'Vec');

const UnionPairIncompatible = declareComparabilityError('UnionPairIncompatible', 'union');
const MinusPairIncompatible = declareComparabilityError('MinusPairIncompatible', 'minus');
const InterPairIncompatible = declareComparabilityError('InterPairIncompatible', 'inter');

const UnionBareEmpty = declareShapeError('UnionBareEmpty',
  () => 'union (bare form) requires a non-empty Vec of operands');
const MinusBareEmpty = declareShapeError('MinusBareEmpty',
  () => 'minus (bare form) requires a non-empty Vec of operands');
const InterBareEmpty = declareShapeError('InterBareEmpty',
  () => 'inter (bare form) requires a non-empty Vec of operands');

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
  throw new UnionPairIncompatible(describeType(left), describeType(right));
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
  throw new MinusPairIncompatible(describeType(left), describeType(right));
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
  throw new InterPairIncompatible(describeType(left), describeType(right));
}

export const union = overloadedOp('union', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new UnionBareSubjectNotVec(describeType(vec), vec);
    if (vec.length === 0) throw new UnionBareEmpty();
    return vec.reduce(unionPair);
  },
  1: (pipeValue, rightLambda) => unionPair(pipeValue, rightLambda(pipeValue)),
  2: (pipeValue, leftLambda, rightLambda) =>
    unionPair(leftLambda(pipeValue), rightLambda(pipeValue))
});

export const minus = overloadedOp('minus', 2, {
  0: (vec) => {
    if (!Array.isArray(vec)) throw new MinusBareSubjectNotVec(describeType(vec), vec);
    if (vec.length === 0) throw new MinusBareEmpty();
    return vec.reduce(minusPair);
  },
  1: (pipeValue, rightLambda) => minusPair(pipeValue, rightLambda(pipeValue)),
  2: (pipeValue, leftLambda, rightLambda) =>
    minusPair(leftLambda(pipeValue), rightLambda(pipeValue))
});

export const inter = overloadedOp('inter', 2, {
  0: (vec) => {
    if (!Array.isArray(vec)) throw new InterBareSubjectNotVec(describeType(vec), vec);
    if (vec.length === 0) throw new InterBareEmpty();
    return vec.reduce(interPair);
  },
  1: (pipeValue, rightLambda) => interPair(pipeValue, rightLambda(pipeValue)),
  2: (pipeValue, leftLambda, rightLambda) =>
    interPair(leftLambda(pipeValue), rightLambda(pipeValue))
});

// Variant-B primitive registry bindings — coexist with IMPLS.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/union'), union);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/minus'), minus);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/inter'), inter);
