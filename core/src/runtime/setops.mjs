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
  isQSet, isKeyword,
  isVecShape, isMapShape, mapShapeEntries, mapLikeOf
} from '../types.mjs';
import {
  declareSubjectError,
  declareComparabilityError,
  declareShapeError
} from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { setHasStructurally, addStructurallyUnique } from '../equality.mjs';

// Map-minus-Set / Map-inter-Set drop or keep entries by their
// String key. The Set typically carries Keywords (`#[:tmp]`) — the
// keyword's `.name` matches the Map's String key. Composite Set
// members would not be meaningful as Map-key filters, so the
// lookup stays keyword-name-only.
function setHasMapKey(s, k) {
  for (const v of s) if (isKeyword(v) && v.name === k) return true;
  return false;
}

const UnionBareSubjectNotVecError    = declareSubjectError('UnionBareSubjectNotVecError',    'union', 'vec');
const MinusBareSubjectNotVecError    = declareSubjectError('MinusBareSubjectNotVecError',    'minus', 'vec');
const InterBareSubjectNotVecError    = declareSubjectError('InterBareSubjectNotVecError',    'inter', 'vec');

const UnionPairIncompatibleError = declareComparabilityError('UnionPairIncompatibleError', 'union');
const MinusPairIncompatibleError = declareComparabilityError('MinusPairIncompatibleError', 'minus');
const InterPairIncompatibleError = declareComparabilityError('InterPairIncompatibleError', 'inter');

const UnionBareEmptyError = declareShapeError('UnionBareEmptyError',
  () => 'union (bare form) requires a non-empty Vec of operands');
const MinusBareEmptyError = declareShapeError('MinusBareEmptyError',
  () => 'minus (bare form) requires a non-empty Vec of operands');
const InterBareEmptyError = declareShapeError('InterBareEmptyError',
  () => 'inter (bare form) requires a non-empty Vec of operands');

function unionPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set(left);
    for (const v of right) addStructurallyUnique(out, v);
    return out;
  }
  if (isMapShape(left) && isMapShape(right)) {
    const merged = [...mapShapeEntries(left)];
    const keyToIndex = new Map(merged.map(([k], i) => [k, i]));
    for (const [k, v] of mapShapeEntries(right)) {
      const existingIdx = keyToIndex.get(k);
      if (existingIdx !== undefined) {
        merged[existingIdx] = [k, v];
      } else {
        keyToIndex.set(k, merged.length);
        merged.push([k, v]);
      }
    }
    return mapLikeOf(merged, left);
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
  if (isMapShape(left) && isMapShape(right)) {
    const rightKeySet = new Set();
    for (const [rk] of mapShapeEntries(right)) rightKeySet.add(rk);
    const out = [];
    for (const [k, v] of mapShapeEntries(left)) {
      if (!rightKeySet.has(k)) out.push([k, v]);
    }
    return mapLikeOf(out, left);
  }
  if (isMapShape(left) && isQSet(right)) {
    const out = [];
    for (const [k, v] of mapShapeEntries(left)) {
      if (!setHasMapKey(right, k)) out.push([k, v]);
    }
    return mapLikeOf(out, left);
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
  if (isMapShape(left) && isMapShape(right)) {
    const rightKeySet = new Set();
    for (const [rk] of mapShapeEntries(right)) rightKeySet.add(rk);
    const out = [];
    for (const [k, v] of mapShapeEntries(left)) {
      if (rightKeySet.has(k)) out.push([k, v]);
    }
    return mapLikeOf(out, left);
  }
  if (isMapShape(left) && isQSet(right)) {
    const out = [];
    for (const [k, v] of mapShapeEntries(left)) {
      if (setHasMapKey(right, k)) out.push([k, v]);
    }
    return mapLikeOf(out, left);
  }
  throw new InterPairIncompatibleError(left, right);
}

export const union = overloadedOp('union', 2, {
  0: (vec) => {
    if (!isVecShape(vec)) throw new UnionBareSubjectNotVecError(vec);
    if (vec.length === 0) throw new UnionBareEmptyError();
    return [...vec].reduce(unionPair);
  },
  1: async (unionSubject, unionRightLambda) => unionPair(unionSubject, await unionRightLambda(unionSubject)),
  2: async (unionCtx, unionLeftLambda, unionRightLambda) =>
    unionPair(await unionLeftLambda(unionCtx), await unionRightLambda(unionCtx))
});

export const minus = overloadedOp('minus', 2, {
  0: (vec) => {
    if (!isVecShape(vec)) throw new MinusBareSubjectNotVecError(vec);
    if (vec.length === 0) throw new MinusBareEmptyError();
    return [...vec].reduce(minusPair);
  },
  1: async (minusSubject, minusRightLambda) => minusPair(minusSubject, await minusRightLambda(minusSubject)),
  2: async (minusCtx, minusLeftLambda, minusRightLambda) =>
    minusPair(await minusLeftLambda(minusCtx), await minusRightLambda(minusCtx))
});

export const inter = overloadedOp('inter', 2, {
  0: (vec) => {
    if (!isVecShape(vec)) throw new InterBareSubjectNotVecError(vec);
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
