// The algebra of containers: union, minus, inter, each a plain function
// over the values the head of its verb checked [D72]. The verbs reside
// on `::set` and `::map`, the other operand in their slot, and on
// `::vec`, where the subject is the vector of operands the primitive
// folds; one primitive serves the three by the arguments it takes. A
// pair of kinds apart can meet only inside the fold, whose refusal names
// the pair.
//
// The verbs live in lib/qlang/set.qlang, map.qlang and vec.qlang.

import { isQSet, isKeyword, isVec, isQMap, makeSet, NULL } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareComparabilityError } from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';

// A map minus or inter another map or a vector of keys drops or keeps
// its entries by key [D15]: the other map's keys, or the names of the
// keywords in the vector, a set among them (`#[:tmp]`, `[:a :c]`).
function keyNamesOf(keysValue) {
  return isQMap(keysValue) ? keysValue : new Set(keysValue.filter(isKeyword).map(keyOfEntry => keyOfEntry.name));
}

// The algebra of two sets is a merge of their elements in the one
// order [D16]: each operation keeps the elements of the left alone,
// of both, or of the right alone.
const UNION_KEEPS = { leftAlone: true,  both: true,  rightAlone: true  };
const MINUS_KEEPS = { leftAlone: true,  both: false, rightAlone: false };
const INTER_KEEPS = { leftAlone: false, both: true,  rightAlone: false };

function mergeSets(left, right, keeps) {
  const merged = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const byOrder = compareValues(left[leftIndex], right[rightIndex]);
    if (byOrder < 0) {
      if (keeps.leftAlone) merged.push(left[leftIndex]);
      leftIndex++;
    } else if (byOrder > 0) {
      if (keeps.rightAlone) merged.push(right[rightIndex]);
      rightIndex++;
    } else {
      if (keeps.both) merged.push(left[leftIndex]);
      leftIndex++;
      rightIndex++;
    }
  }
  if (keeps.leftAlone) merged.push(...left.slice(leftIndex));
  if (keeps.rightAlone) merged.push(...right.slice(rightIndex));
  return makeSet(merged);
}

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
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, UNION_KEEPS);
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
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, MINUS_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) {
    const rightNames = keyNamesOf(right);
    return new Map([...left].filter(([k]) => !rightNames.has(k)));
  }
  throw new MinusPairIncompatibleError(left, right);
}

function interPair(left, right) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, INTER_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) {
    const rightNames = keyNamesOf(right);
    return new Map([...left].filter(([k]) => rightNames.has(k)));
  }
  throw new InterPairIncompatibleError(left, right);
}

// A pair's answer for the verbs of sets and maps, and the fold of a
// non-empty vector of operands for the verb of vectors, which takes no
// other operand, and for a set whose other operand is left out, a set
// of sets being the vector of its elements [D16].
function pairOrFold(pair, EmptyError) {
  return (subject, ...other) => {
    if (other.length === 1 && other[0] !== NULL) return pair(subject, other[0]);
    if (subject.length === 0) throw new EmptyError();
    return [...subject].reduce(pair);
  };
}

bindPrim('union', pairOrFold(unionPair, UnionBareEmptyError));
bindPrim('minus', pairOrFold(minusPair, MinusBareEmptyError));
bindPrim('inter', pairOrFold(interPair, InterBareEmptyError));
