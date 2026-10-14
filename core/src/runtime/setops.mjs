// The algebra of containers: union, minus, inter, each a plain function
// over the subject and the inputs of its call [D251], one for each word
// of a kind [D46]. A set meets the other set its call gives, and a map
// the other map or the keys a vector or a set names; a vector holds the
// values it folds and takes none beside it, and a set its call leaves
// without the other value folds the values it holds [QSORD#order], [D74].
// Inside a fold a value of no kind of the algebra is refused at its
// index, and the values meet in pairs, a pair the algebra has no rule for
// refused by the word with the kinds it met.
//
// The verbs live in lib/qlang/set.qlang, map.qlang and vec.qlang.

import { isQSet, isKeyword, isString, isVec, isQMap, makeSet, NULL, typeKeyword } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';

// The algebra of two sets is a merge of their elements in the one
// order [QSORD#order]: each operation keeps the elements of the left alone,
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
// its entries by key [QSCOL#map]: the other map's keys, or the keys the vector
// names, a set among them (`#[:tmp]`, `[:a "c"]`), a keyword or a
// string naming a key as `at` and `has` read it, and any other element
// refused where it stands [QSPTH#key].
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
function mismatched(left, right, KindsMismatchedError) {
  return new KindsMismatchedError({ leftType: typeKeyword(left), rightType: typeKeyword(right) });
}

function unionPair(left, right, { KindsMismatchedError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, UNION_KEEPS);
  if (isQMap(left) && isQMap(right)) return unionOfMaps(left, right);
  throw mismatched(left, right, KindsMismatchedError);
}

function minusPair(left, right, { KindsMismatchedError, KeyNotKeywordOrStringError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, MINUS_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) return minusOfMap(left, right, KeyNotKeywordOrStringError);
  throw mismatched(left, right, KindsMismatchedError);
}

function interPair(left, right, { KindsMismatchedError, KeyNotKeywordOrStringError }) {
  if (isQSet(left) && isQSet(right)) return mergeSets(left, right, INTER_KEEPS);
  if (isQMap(left) && (isQMap(right) || isVec(right))) return interOfMap(left, right, KeyNotKeywordOrStringError);
  throw mismatched(left, right, KindsMismatchedError);
}

// The fold of the values a vector or a set holds, from the first; it
// holds one at least, and the values it reads as sets or maps, every one
// of a union and the first of a difference or a common part, are sets or
// maps.
function foldOf(values, pair, refusals, readsEvery) {
  if (values.length === 0) throw new refusals.SubjectEmptyError();
  (readsEvery ? values : values.slice(0, 1)).forEach((value, index) => {
    if (!isQSet(value) && !isQMap(value)) throw new refusals.ElementNotSetOrMapError({ index, actualValue: value });
  });
  return [...values].reduce((left, right) => pair(left, right, refusals));
}

// ── union ──────────────────────────────────────────────────────

const VEC_UNION = {
  KindsMismatchedError: declareRefusal('vec/union/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/union/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/union/ElementNotSetOrMapError')
};
const SET_UNION = {
  KindsMismatchedError: declareRefusal('set/union/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('set/union/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('set/union/ElementNotSetOrMapError')
};

bindPrim('vec/union', vector => foldOf(vector, unionPair, VEC_UNION, true));
bindPrim('set/union', (set, other) => (other === NULL ? foldOf(set, unionPair, SET_UNION, true) : mergeSets(set, other, UNION_KEEPS)));
bindPrim('map/union', (map, other) => unionOfMaps(map, other));

// ── minus ──────────────────────────────────────────────────────

const MapMinusKeyNotKeywordOrStringError = declareRefusal('map/minus/KeyNotKeywordOrStringError');

const VEC_MINUS = {
  KindsMismatchedError: declareRefusal('vec/minus/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/minus/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/minus/ElementNotSetOrMapError'),
  KeyNotKeywordOrStringError: declareRefusal('vec/minus/KeyNotKeywordOrStringError')
};
// A set holds a vector before a map in the one order, so its fold never
// meets a map and the keys a vector names.
const SET_MINUS = {
  KindsMismatchedError: declareRefusal('set/minus/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('set/minus/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('set/minus/ElementNotSetOrMapError')
};

bindPrim('vec/minus', vector => foldOf(vector, minusPair, VEC_MINUS, false));
bindPrim('set/minus', (set, other) => (other === NULL ? foldOf(set, minusPair, SET_MINUS, false) : mergeSets(set, other, MINUS_KEEPS)));
bindPrim('map/minus', (map, keys) => minusOfMap(map, keys, MapMinusKeyNotKeywordOrStringError));

// ── inter ──────────────────────────────────────────────────────

const MapInterKeyNotKeywordOrStringError = declareRefusal('map/inter/KeyNotKeywordOrStringError');

const VEC_INTER = {
  KindsMismatchedError: declareRefusal('vec/inter/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/inter/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/inter/ElementNotSetOrMapError'),
  KeyNotKeywordOrStringError: declareRefusal('vec/inter/KeyNotKeywordOrStringError')
};
const SET_INTER = {
  KindsMismatchedError: declareRefusal('set/inter/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('set/inter/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('set/inter/ElementNotSetOrMapError')
};

bindPrim('vec/inter', vector => foldOf(vector, interPair, VEC_INTER, false));
bindPrim('set/inter', (set, other) => (other === NULL ? foldOf(set, interPair, SET_INTER, false) : mergeSets(set, other, INTER_KEEPS)));
bindPrim('map/inter', (map, keys) => interOfMap(map, keys, MapInterKeyNotKeywordOrStringError));
