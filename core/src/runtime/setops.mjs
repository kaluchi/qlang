// The algebra of containers: union, minus, inter, each taking the values alone,
// the subject and the inputs of its call, one for each verb of a kind: a set
// meets the other set its call gives, a map the other map or the keys a
// vector or a set names, and a vector folds the values it holds and takes
// none beside it, a value of no kind of the algebra refused at its index and
// a pair the algebra has no rule for refused by the verb with the kinds it
// met [QSORD#order], [QSCOL#algebra].

import { isSet, isVec, isMap, typeOf, beneathTags, underTagsNamed } from '../types.mjs';
import { compareValues, makeSet, kindsExpected } from '../ordering.mjs';
import { declareRefusal, refusingTheSubject, refusingAPart, CallKindsMismatchedError } from '../errors.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { isKeyAlone, keyNameOf, KINDS_OF_A_KEY_ALONE } from '../path-read.mjs';
import { tagsTheElementsShare } from './sequence.mjs';

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

// A map minus or inter a map or a vector of keys drops or keeps its entries
// by key, each a key alone, an element of another kind refused at its index [QSPTH#key].
const KINDS_NAMING_A_MAP_KEY = kindsExpected(...KINDS_OF_A_KEY_ALONE);

function keyNamesOf(keysValue, KeyRefusal, at) {
  if (isMap(keysValue)) return keysValue;
  return new Set(keysValue.map((keyOfEntry, index) => {
    const key = beneathTags(keyOfEntry);
    if (isKeyAlone(key)) return keyNameOf(key);
    if (at === undefined) throw new KeyRefusal({ index, expected: KINDS_NAMING_A_MAP_KEY, actualValue: keyOfEntry });
    throw refusingAPart(new KeyRefusal({ expected: KINDS_NAMING_A_MAP_KEY, actualValue: keyOfEntry }), at, index);
  }));
}

const minusOfMap = (map, keys, KeyRefusal, at) => {
  const names = keyNamesOf(keys, KeyRefusal, at);
  return new Map([...map].filter(([key]) => !names.has(key)));
};

const interOfMap = (map, keys, KeyRefusal, at) => {
  const names = keyNamesOf(keys, KeyRefusal, at);
  return new Map([...map].filter(([key]) => names.has(key)));
};

// The pairs a fold meets: two sets merge, two maps merge, and a map
// drops or keeps the keys a map, a vector or a set names; any other pair
// is refused with the kinds it met [D388].
function mismatched(left, right, at) {
  return refusingAPart(new CallKindsMismatchedError({ leftType: typeOf(left), rightType: typeOf(right) }), at);
}

function unionPair(left, right, refusals, at) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, UNION_KEEPS);
  if (isMap(left) && isMap(right)) return unionOfMaps(left, right);
  throw mismatched(left, right, at);
}

function minusPair(left, right, { KeyKindNotTakenError }, at) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, MINUS_KEEPS);
  if (isMap(left) && (isMap(right) || isVec(right))) return minusOfMap(left, right, KeyKindNotTakenError, at);
  throw mismatched(left, right, at);
}

function interPair(left, right, { KeyKindNotTakenError }, at) {
  if (isSet(left) && isSet(right)) return mergeSets(left, right, INTER_KEEPS);
  if (isMap(left) && (isMap(right) || isVec(right))) return interOfMap(left, right, KeyKindNotTakenError, at);
  throw mismatched(left, right, at);
}

// The fold of the values a vector holds beneath their tags, from the first as
// it is written; it holds one at least, and the values it reads as sets or
// maps, every one of a union and the first of a difference or a common part,
// are sets or maps. The answer stands under the tags the values of the first's
// kind share, a vector of keys none of them [D388].
function foldOf(values, pair, refusals, readsEvery) {
  if (values.length === 0) throw refusingTheSubject(new refusals.SubjectEmptyError({ actualValue: values }));
  const read = values.map(beneathTags);
  (readsEvery ? read : read.slice(0, 1)).forEach((value, index) => {
    if (!isSet(value) && !isMap(value)) throw refusingAPart(new refusals.ElementNotSetOrMapError({ actualValue: values[index] }), index);
  });
  const ofTheKind = isSet(read[0]) ? isSet : isMap;
  const tags = tagsTheElementsShare([...values.entries()].filter((_, at) => ofTheKind(read[at])));
  return underTagsNamed(read.reduce((left, right, at) => pair(left, right, refusals, at)), tags);
}

// ── union ──────────────────────────────────────────────────────

const VEC_UNION = {
  SubjectEmptyError: declareRefusal('vec/union/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/union/ElementNotSetOrMapError')
};

registerPrimitive('vec/union', vector => foldOf(vector, unionPair, VEC_UNION, true));
registerPrimitive('set/union', (set, other) => mergeSets(set, other, UNION_KEEPS));
registerPrimitive('map/union', (map, other) => unionOfMaps(map, other));

// ── minus ──────────────────────────────────────────────────────

const MapMinusKeysElementKindNotTakenError = declareRefusal('map/minus/keys/ElementKindNotTakenError');

const VEC_MINUS = {
  SubjectEmptyError: declareRefusal('vec/minus/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/minus/ElementNotSetOrMapError'),
  KeyKindNotTakenError: declareRefusal('vec/minus/KeyKindNotTakenError')
};

registerPrimitive('vec/minus', vector => foldOf(vector, minusPair, VEC_MINUS, false));
registerPrimitive('set/minus', (set, other) => mergeSets(set, other, MINUS_KEEPS));
registerPrimitive('map/minus', (map, keys) => minusOfMap(map, keys, MapMinusKeysElementKindNotTakenError));

// ── inter ──────────────────────────────────────────────────────

const MapInterKeysElementKindNotTakenError = declareRefusal('map/inter/keys/ElementKindNotTakenError');

const VEC_INTER = {
  SubjectEmptyError: declareRefusal('vec/inter/SubjectEmptyError'),
  ElementNotSetOrMapError: declareRefusal('vec/inter/ElementNotSetOrMapError'),
  KeyKindNotTakenError: declareRefusal('vec/inter/KeyKindNotTakenError')
};

registerPrimitive('vec/inter', vector => foldOf(vector, interPair, VEC_INTER, false));
registerPrimitive('set/inter', (set, other) => mergeSets(set, other, INTER_KEEPS));
registerPrimitive('map/inter', (map, keys) => interOfMap(map, keys, MapInterKeysElementKindNotTakenError));
