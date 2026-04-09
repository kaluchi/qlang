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

import { overloadedOp } from './dispatch.mjs';
import { isVec, isQMap, isQSet, isKeyword, describeType } from '../types.mjs';
import {
  declareSubjectError,
  declareComparabilityError,
  declareShapeError
} from './operand-errors.mjs';

// ── Unique per-operand error classes ──────────────────────────

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

// ── Pair implementations ──────────────────────────────────────

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

// ── Operand registration ──────────────────────────────────────

export const union = overloadedOp('union', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new UnionBareSubjectNotVec(describeType(vec), vec);
    if (vec.length === 0) throw new UnionBareEmpty();
    return vec.reduce(unionPair);
  },
  1: (pipeValue, rightLambda) => unionPair(pipeValue, rightLambda(pipeValue)),
  2: (pipeValue, leftLambda, rightLambda) =>
    unionPair(leftLambda(pipeValue), rightLambda(pipeValue))
}, {
  category: 'set-op',
  subject: 'Set or Map (or Vec for bare form)',
  modifiers: ['Set or Map (bound) / two operands (full)'],
  returns: 'Set or Map',
  docs: ['Polymorphic union: Set ∪ Set, Map ∪ Map (last wins on key conflict). Bare form left-folds across a non-empty Vec of operands. Bound form `a | union(b)` evaluates b against a as context. Full form `union(a, b)` resolves both args against pipeValue.'],
  examples: ['[#{:a :b} #{:b :c}] | union → #{:a :b :c}', '{:name "a"} | union({:age 20}) → {:name "a" :age 20}'],
  throws: ['UnionBareSubjectNotVec', 'UnionBareEmpty', 'UnionPairIncompatible']
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
}, {
  category: 'set-op',
  subject: 'Set or Map (or Vec for bare form)',
  modifiers: ['Set or Map (bound) / two operands (full)'],
  returns: 'Set or Map',
  docs: ['Polymorphic difference: Set \\ Set, Map \\ keys(Map2), Map \\ Set (drop fields). Bare form left-folds across a non-empty Vec.'],
  examples: ['[#{:a :b :c} #{:b}] | minus → #{:a :c}', '{:a 1 :b 2 :tmp 3} | minus(#{:tmp}) → {:a 1 :b 2}'],
  throws: ['MinusBareSubjectNotVec', 'MinusBareEmpty', 'MinusPairIncompatible']
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
}, {
  category: 'set-op',
  subject: 'Set or Map (or Vec for bare form)',
  modifiers: ['Set or Map (bound) / two operands (full)'],
  returns: 'Set or Map',
  docs: ['Polymorphic intersection: Set ∩ Set, Map ∩ keys(Map2), Map ∩ Set (select fields). Values from the first operand. Bare form left-folds across a non-empty Vec.'],
  examples: ['[#{:a :b :c} #{:b :d}] | inter → #{:b}', '{:a 1 :b 2 :c 3} | inter(#{:a :b}) → {:a 1 :b 2}'],
  throws: ['InterBareSubjectNotVec', 'InterBareEmpty', 'InterPairIncompatible']
});
