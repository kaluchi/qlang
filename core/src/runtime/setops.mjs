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
// Meta lives in lib/qlang/operand/setOp.qlang.

import { overloadedOp } from './dispatch.mjs';
import {
  isQSet, isKeyword, isVec, isQMap
} from '../types.mjs';
import {
  declareSubjectError,
  declareComparabilityError
} from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { setHasStructurally, addStructurallyUnique } from '../equality.mjs';

// A map minus keys / a map inter keys drops or keeps entries by
// their String key [D15]. The keys arrive as a Set or a Vector of
// Keywords (`#[:tmp]`, `[:a :c]`) — the keyword's `.name` matches the
// Map's String key. Composite members would not be meaningful as
// key filters, so the lookup stays keyword-name-only.
function keysHaveMapKey(keysValue, k) {
  for (const v of keysValue) if (isKeyword(v) && v.name === k) return true;
  return false;
}

function isKeysValue(value) {
  return isQSet(value) || isVec(value);
}

const UnionBareSubjectNotVecError    = declareSubjectError('UnionBareSubjectNotVecError',    'union', 'vec');
const MinusBareSubjectNotVecError    = declareSubjectError('MinusBareSubjectNotVecError',    'minus', 'vec');
const InterBareSubjectNotVecError    = declareSubjectError('InterBareSubjectNotVecError',    'inter', 'vec');

const UnionPairIncompatibleError = declareComparabilityError('UnionPairIncompatibleError', 'union');
const MinusPairIncompatibleError = declareComparabilityError('MinusPairIncompatibleError', 'minus');
const InterPairIncompatibleError = declareComparabilityError('InterPairIncompatibleError', 'inter');

const UnionBareEmptyError = declareShapeError('UnionBareEmptyError',
  () => 'union (bare form) requires a non-empty Vec of operands',
  { operand: 'union' }
);
const MinusBareEmptyError = declareShapeError('MinusBareEmptyError',
  () => 'minus (bare form) requires a non-empty Vec of operands',
  { operand: 'minus' }
);
const InterBareEmptyError = declareShapeError('InterBareEmptyError',
  () => 'inter (bare form) requires a non-empty Vec of operands',
  { operand: 'inter' }
);

function unionPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set(left);
    for (const v of right) addStructurallyUnique(out, v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const merged = [...left];
    const keyToIndex = new Map(merged.map(([k], i) => [k, i]));
    for (const [k, v] of right) {
      const existingIdx = keyToIndex.get(k);
      if (existingIdx !== undefined) {
        merged[existingIdx] = [k, v];
      } else {
        keyToIndex.set(k, merged.length);
        merged.push([k, v]);
      }
    }
    return new Map(merged);
  }
  throw new UnionPairIncompatibleError(left, right);
}

function minusPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) {
      if (!setHasStructurally(right, v)) addStructurallyUnique(out, v);
    }
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const rightKeySet = new Set();
    for (const [rk] of right) rightKeySet.add(rk);
    const out = [];
    for (const [k, v] of left) {
      if (!rightKeySet.has(k)) out.push([k, v]);
    }
    return new Map(out);
  }
  if (isQMap(left) && isKeysValue(right)) {
    const out = [];
    for (const [k, v] of left) {
      if (!keysHaveMapKey(right, k)) out.push([k, v]);
    }
    return new Map(out);
  }
  throw new MinusPairIncompatibleError(left, right);
}

function interPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) {
      if (setHasStructurally(right, v)) addStructurallyUnique(out, v);
    }
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const rightKeySet = new Set();
    for (const [rk] of right) rightKeySet.add(rk);
    const out = [];
    for (const [k, v] of left) {
      if (rightKeySet.has(k)) out.push([k, v]);
    }
    return new Map(out);
  }
  if (isQMap(left) && isKeysValue(right)) {
    const out = [];
    for (const [k, v] of left) {
      if (keysHaveMapKey(right, k)) out.push([k, v]);
    }
    return new Map(out);
  }
  throw new InterPairIncompatibleError(left, right);
}

export const union = overloadedOp('union', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new UnionBareSubjectNotVecError(vec);
    if (vec.length === 0) throw new UnionBareEmptyError();
    return [...vec].reduce(unionPair);
  },
  1: async (unionSubject, unionRightLambda) => unionPair(unionSubject, await unionRightLambda(unionSubject)),
  2: async (unionCtx, unionLeftLambda, unionRightLambda) =>
    unionPair(await unionLeftLambda(unionCtx), await unionRightLambda(unionCtx))
});

export const minus = overloadedOp('minus', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new MinusBareSubjectNotVecError(vec);
    if (vec.length === 0) throw new MinusBareEmptyError();
    return [...vec].reduce(minusPair);
  },
  1: async (minusSubject, minusRightLambda) => minusPair(minusSubject, await minusRightLambda(minusSubject)),
  2: async (minusCtx, minusLeftLambda, minusRightLambda) =>
    minusPair(await minusLeftLambda(minusCtx), await minusRightLambda(minusCtx))
});

export const inter = overloadedOp('inter', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new InterBareSubjectNotVecError(vec);
    if (vec.length === 0) throw new InterBareEmptyError();
    return [...vec].reduce(interPair);
  },
  1: async (interSubject, interRightLambda) => interPair(interSubject, await interRightLambda(interSubject)),
  2: async (interCtx, interLeftLambda, interRightLambda) =>
    interPair(await interLeftLambda(interCtx), await interRightLambda(interCtx))
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('union', union);
bindPrim('minus', minus);
bindPrim('inter', inter);
