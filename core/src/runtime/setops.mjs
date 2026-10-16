// The algebra of containers: union, minus, inter, each a plain function over
// the subject and the inputs of its call [QSBLD#fn], one for each word of a
// kind [QSERR#site]: a set meets the other set its call gives, a map the other
// map or the keys a vector or a set names, and a vector folds the values it
// holds and takes none beside it, a value of no kind of the algebra refused at
// its index and a pair the algebra has no rule for refused by the word with
// the kinds it met [QSORD#order], [D355].

import { isSet, isKeyword, isString, isVec, isMap, makeSet, kindsExpected, typeKeyword } from '../types.mjs';
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

// A map minus or inter another map or a vector of keys drops or keeps its
// entries by key: the other map's keys, or the keys the vector names, a set
// among them (`#[:tmp]`, `[:a "c"]`), each a keyword or a string naming a key
// as `get` and `has` read it, and an element of another kind refused at its
// index with those two kinds as `:expected` [D355].
const KINDS_NAMING_A_MAP_KEY = kindsExpected('keyword', 'string');

function keyNamesOf(keysValue, KeyRefusal) {
  if (isMap(keysValue)) return keysValue;
  return new Set(keysValue.map((keyOfEntry, index) => {
    if (isKeyword(keyOfEntry)) return keyOfEntry.name;
    if (isString(keyOfEntry)) return keyOfEntry;
    throw new KeyRefusal({ index, expected: KINDS_NAMING_A_MAP_KEY, actualValue: keyOfEntry });
  }));
}

const minusOfMap = (map, keys, KeyRefusal) => {
  const names = keyNamesOf(keys, KeyRefusal);
  return new Map([...map].filter(([key]) => !names.has(key)));
};

const interOfMap = (map, keys, KeyRefusal) => {
  const names = keyNamesOf(keys, KeyRefusal);
  return new Map([...map].filter(([key]) => names.has(key)));
};

// The pairs a fold meets: two sets merge, two maps merge, and a map
// drops or keeps the keys a map, a vector or a set names; any other pair
// is refused with the kinds it met.
function mismatched(left, right, KindsMismatchedError) {
  return new KindsMismatchedError({ leftType: typeKeyword(left), rightType: typeKeyword(right) });
}

function unionPair(left, right, { KindsMismatchedError }) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, UNION_KEEPS);
  if (isMap(left) && isMap(right)) return unionOfMaps(left, right);
  throw mismatched(left, right, KindsMismatchedError);
}

function minusPair(left, right, { KindsMismatchedError, KeyKindNotTakenError }) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, MINUS_KEEPS);
  if (isMap(left) && (isMap(right) || isVec(right))) return minusOfMap(left, right, KeyKindNotTakenError);
  throw mismatched(left, right, KindsMismatchedError);
}

function interPair(left, right, { KindsMismatchedError, KeyKindNotTakenError }) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, INTER_KEEPS);
  if (isMap(left) && (isMap(right) || isVec(right))) return interOfMap(left, right, KeyKindNotTakenError);
  throw mismatched(left, right, KindsMismatchedError);
}

// The fold of the values a vector holds, from the first as it is written;
// it holds one at least, and the values it reads as sets or maps, every one
// of a union and the first of a difference or a common part, are sets or
// maps.
function foldOf(values, pair, refusals, readsEvery) {
  if (values.length === 0) throw new refusals.SubjectEmptyError();
  (readsEvery ? values : values.slice(0, 1)).forEach((value, index) => {
    if (!isSet(value) && !isMap(value)) throw new refusals.ElementNotSetOrMapError({ index, actualValue: value });
  });
  return [...values].reduce((left, right) => pair(left, right, refusals));
}

// ── union ──────────────────────────────────────────────────────

const VEC_UNION = {
  KindsMismatchedError: declareRefusal('vec/union/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/union/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/union/ElementNotSetOrMapError')
};

bindPrim('vec/union', vector => foldOf(vector, unionPair, VEC_UNION, true));
bindPrim('set/union', (set, other) => mergeSets(set, other, UNION_KEEPS));
bindPrim('map/union', (map, other) => unionOfMaps(map, other));

// ── minus ──────────────────────────────────────────────────────

const MapMinusKeysElementKindNotTakenError = declareRefusal('map/minus/keys/ElementKindNotTakenError');

const VEC_MINUS = {
  KindsMismatchedError: declareRefusal('vec/minus/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/minus/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/minus/ElementNotSetOrMapError'),
  KeyKindNotTakenError: declareRefusal('vec/minus/KeyKindNotTakenError')
};

bindPrim('vec/minus', vector => foldOf(vector, minusPair, VEC_MINUS, false));
bindPrim('set/minus', (set, other) => mergeSets(set, other, MINUS_KEEPS));
bindPrim('map/minus', (map, keys) => minusOfMap(map, keys, MapMinusKeysElementKindNotTakenError));

// ── inter ──────────────────────────────────────────────────────

const MapInterKeysElementKindNotTakenError = declareRefusal('map/inter/keys/ElementKindNotTakenError');

const VEC_INTER = {
  KindsMismatchedError: declareRefusal('vec/inter/KindsMismatchedError'),
  SubjectEmptyError: declareRefusal('vec/inter/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/inter/ElementNotSetOrMapError'),
  KeyKindNotTakenError: declareRefusal('vec/inter/KeyKindNotTakenError')
};

bindPrim('vec/inter', vector => foldOf(vector, interPair, VEC_INTER, false));
bindPrim('set/inter', (set, other) => mergeSets(set, other, INTER_KEEPS));
bindPrim('map/inter', (map, keys) => interOfMap(map, keys, MapInterKeysElementKindNotTakenError));
