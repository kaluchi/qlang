// The algebra of containers: union, minus, inter, each a plain function
// over the subject and the parts of its object [D167], one for each word
// of a kind [D172]. A set meets the other set its call gives, and a map
// the other map or the keys a vector or a set names; a vector holds the
// operands it folds, and a set its call leaves without the other operand
// folds the operands it holds [D16]. Inside a fold the operands meet in
// pairs, and a pair of kinds apart is refused by the word with the kinds
// it met.
//
// The verbs live in lib/qlang/set.qlang, map.qlang and vec.qlang.

import { isQSet, isKeyword, isString, isVec, isQMap, makeSet, NULL, typeKeyword } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';

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

// The entries of both maps, the other map's value winning a key both
// hold, in the order the keys first appear.
function unionOfMaps(left, right) {
  const merged = new Map(left);
  for (const [key, value] of right) merged.set(key, value);
  return merged;
}

// A map minus or inter another map or a vector of keys drops or keeps
// its entries by key [D15]: the other map's keys, or the keys the vector
// names, a set among them (`#[:tmp]`, `[:a "c"]`), a keyword or a
// string naming a key as `at` and `has` read it, and any other element
// refused where it stands [D139].
function keyNamesOf(keysValue, KeyNotKeywordOrStringError) {
  if (isQMap(keysValue)) return keysValue;
  return new Set(keysValue.map((keyOfEntry, index) => {
    if (isKeyword(keyOfEntry)) return keyOfEntry.name;
    if (isString(keyOfEntry)) return keyOfEntry;
    throw new KeyNotKeywordOrStringError({ index, actualValue: keyOfEntry });
  }));
}

const minusOfMap = (map, keys, KeyNotKeywordOrStringError) => {
  const names = keyNamesOf(keys, KeyNotKeywordOrStringError);
  return new Map([...map].filter(([key]) => !names.has(key)));
};

const interOfMap = (map, keys, KeyNotKeywordOrStringError) => {
  const names = keyNamesOf(keys, KeyNotKeywordOrStringError);
  return new Map([...map].filter(([key]) => names.has(key)));
};

// The pairs a fold meets: two sets merge, two maps merge, and a map
// drops or keeps the keys a map, a vector or a set names; any other pair
// is refused with the kinds it met.
function mismatched(left, right, OperandsMismatchedError) {
  return new OperandsMismatchedError({ leftType: typeKeyword(left), rightType: typeKeyword(right) });
}

function unionPair(left, right, { OperandsMismatchedError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, UNION_KEEPS);
  if (isQMap(left) && isQMap(right)) return unionOfMaps(left, right);
  throw mismatched(left, right, OperandsMismatchedError);
}

function minusPair(left, right, { OperandsMismatchedError, KeyNotKeywordOrStringError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, MINUS_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) return minusOfMap(left, right, KeyNotKeywordOrStringError);
  throw mismatched(left, right, OperandsMismatchedError);
}

function interPair(left, right, { OperandsMismatchedError, KeyNotKeywordOrStringError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, INTER_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) return interOfMap(left, right, KeyNotKeywordOrStringError);
  throw mismatched(left, right, OperandsMismatchedError);
}

// The fold of the operands a vector or a set holds, from the first; it
// holds one at least.
function foldOf(operands, pair, refusals) {
  if (operands.length === 0) throw new refusals.NoOperandsError();
  return [...operands].reduce((left, right) => pair(left, right, refusals));
}

// ── union ──────────────────────────────────────────────────────

const VecUnionOperandsMismatchedError = declareRefusal('vec/union/OperandsMismatchedError');
const VecUnionNoOperandsError = declareRefusal('vec/union/NoOperandsError');
const SetUnionOperandsMismatchedError = declareRefusal('set/union/OperandsMismatchedError');
const SetUnionNoOperandsError = declareRefusal('set/union/NoOperandsError');

const VEC_UNION = { OperandsMismatchedError: VecUnionOperandsMismatchedError, NoOperandsError: VecUnionNoOperandsError };
const SET_UNION = { OperandsMismatchedError: SetUnionOperandsMismatchedError, NoOperandsError: SetUnionNoOperandsError };

// A vector is no operand of the algebra, so an operand its call gives
// beside it is refused with the pair.
bindPrim('vec/union', (vector, other) => {
  if (other !== NULL) throw mismatched(vector, other, VecUnionOperandsMismatchedError);
  return foldOf(vector, unionPair, VEC_UNION);
});
bindPrim('set/union', (set, other) => (other === NULL ? foldOf(set, unionPair, SET_UNION) : mergeSets(set, other, UNION_KEEPS)));
bindPrim('map/union', (map, other) => unionOfMaps(map, other));

// ── minus ──────────────────────────────────────────────────────

const VecMinusOperandsMismatchedError = declareRefusal('vec/minus/OperandsMismatchedError');
const VecMinusNoOperandsError = declareRefusal('vec/minus/NoOperandsError');
const VecMinusKeyNotKeywordOrStringError = declareRefusal('vec/minus/KeyNotKeywordOrStringError');
const SetMinusOperandsMismatchedError = declareRefusal('set/minus/OperandsMismatchedError');
const SetMinusNoOperandsError = declareRefusal('set/minus/NoOperandsError');
const MapMinusKeyNotKeywordOrStringError = declareRefusal('map/minus/KeyNotKeywordOrStringError');

const VEC_MINUS = {
  OperandsMismatchedError: VecMinusOperandsMismatchedError,
  NoOperandsError: VecMinusNoOperandsError,
  KeyNotKeywordOrStringError: VecMinusKeyNotKeywordOrStringError
};
// A set holds a vector before a map in the one order, so its fold never
// meets a map and the keys a vector names.
const SET_MINUS = { OperandsMismatchedError: SetMinusOperandsMismatchedError, NoOperandsError: SetMinusNoOperandsError };

bindPrim('vec/minus', (vector, other) => {
  if (other !== NULL) throw mismatched(vector, other, VecMinusOperandsMismatchedError);
  return foldOf(vector, minusPair, VEC_MINUS);
});
bindPrim('set/minus', (set, other) => (other === NULL ? foldOf(set, minusPair, SET_MINUS) : mergeSets(set, other, MINUS_KEEPS)));
bindPrim('map/minus', (map, keys) => minusOfMap(map, keys, MapMinusKeyNotKeywordOrStringError));

// ── inter ──────────────────────────────────────────────────────

const VecInterOperandsMismatchedError = declareRefusal('vec/inter/OperandsMismatchedError');
const VecInterNoOperandsError = declareRefusal('vec/inter/NoOperandsError');
const VecInterKeyNotKeywordOrStringError = declareRefusal('vec/inter/KeyNotKeywordOrStringError');
const SetInterOperandsMismatchedError = declareRefusal('set/inter/OperandsMismatchedError');
const SetInterNoOperandsError = declareRefusal('set/inter/NoOperandsError');
const MapInterKeyNotKeywordOrStringError = declareRefusal('map/inter/KeyNotKeywordOrStringError');

const VEC_INTER = {
  OperandsMismatchedError: VecInterOperandsMismatchedError,
  NoOperandsError: VecInterNoOperandsError,
  KeyNotKeywordOrStringError: VecInterKeyNotKeywordOrStringError
};
const SET_INTER = { OperandsMismatchedError: SetInterOperandsMismatchedError, NoOperandsError: SetInterNoOperandsError };

bindPrim('vec/inter', (vector, other) => {
  if (other !== NULL) throw mismatched(vector, other, VecInterOperandsMismatchedError);
  return foldOf(vector, interPair, VEC_INTER);
});
bindPrim('set/inter', (set, other) => (other === NULL ? foldOf(set, interPair, SET_INTER) : mergeSets(set, other, INTER_KEEPS)));
bindPrim('map/inter', (map, keys) => interOfMap(map, keys, MapInterKeyNotKeywordOrStringError));
