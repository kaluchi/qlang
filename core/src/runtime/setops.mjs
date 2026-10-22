// [QSORD#order], [QSCOL#algebra]

import { isSet, isVec, isMap, beneathTags, TagsInCommon, pairRefused } from '../types.mjs';
import { compareValues, makeSet, kindsExpected } from '../ordering.mjs';
import { declareRefusal, refusingTheSubject, refusingAPart } from '../errors.mjs';
import { registerPrimitive, registerStateReader, combines } from '../primitives.mjs';
import { isKeyAlone, keyNameOf, KINDS_OF_A_KEY_ALONE } from '../path-read.mjs';
import { underSharedTags } from '../eval.mjs';

// [QSORD#order]
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

function unionOfMaps(left, right) {
  const merged = new Map(left);
  for (const [key, value] of right) merged.set(key, value);
  return merged;
}

// [QSPTH#key]
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

// [QSCOL#algebra]
const mismatched = (left, right, at) => refusingAPart(pairRefused(left, right), at);

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

function foldOf(values, pair, refusals, readsEvery, state) {
  if (values.length === 0) throw refusingTheSubject(new refusals.SubjectEmptyError({ actualValue: values }));
  const first = beneathTags(values[0]);
  const tally = new TagsInCommon();
  let folded = first;
  for (const [at, value] of values.entries()) {
    const read = beneathTags(value);
    if ((readsEvery || at === 0) && !isSet(read) && !isMap(read)) throw refusingAPart(new refusals.ElementKindNotTakenError({ expected: kindsExpected('map', 'set'), actualValue: value }), at);
    if (at > 0) folded = pair(folded, read, refusals, at);
    const met = at === 0 || readsEvery || isSet(first) ? tally.meet(value) : null;
    if (met !== null) throw refusingAPart(pairRefused(met, value), at);
  }
  return underSharedTags(folded, tally.tags, state);
}

const VEC_UNION = {
  SubjectEmptyError: declareRefusal('vec/union/SubjectEmptyError'),
  ElementKindNotTakenError: declareRefusal('vec/union/ElementKindNotTakenError')
};

registerStateReader('vec/union', (vector, state) => foldOf(vector, unionPair, VEC_UNION, true, state));
registerPrimitive('set/union', combines((set, other) => mergeSets(set, other, UNION_KEEPS)));
registerPrimitive('map/union', combines((map, other) => unionOfMaps(map, other)));

const MapMinusKeysElementKindNotTakenError = declareRefusal('map/minus/keys/ElementKindNotTakenError');

const VEC_MINUS = {
  SubjectEmptyError: declareRefusal('vec/minus/SubjectEmptyError'),
  ElementKindNotTakenError: declareRefusal('vec/minus/ElementKindNotTakenError'),
  KeyKindNotTakenError: declareRefusal('vec/minus/KeyKindNotTakenError')
};

registerStateReader('vec/minus', (vector, state) => foldOf(vector, minusPair, VEC_MINUS, false, state));
registerPrimitive('set/minus', combines((set, other) => mergeSets(set, other, MINUS_KEEPS)));
registerPrimitive('map/minus', (map, keys) => minusOfMap(map, keys, MapMinusKeysElementKindNotTakenError));

const MapInterKeysElementKindNotTakenError = declareRefusal('map/inter/keys/ElementKindNotTakenError');

const VEC_INTER = {
  SubjectEmptyError: declareRefusal('vec/inter/SubjectEmptyError'),
  ElementKindNotTakenError: declareRefusal('vec/inter/ElementKindNotTakenError'),
  KeyKindNotTakenError: declareRefusal('vec/inter/KeyKindNotTakenError')
};

registerStateReader('vec/inter', (vector, state) => foldOf(vector, interPair, VEC_INTER, false, state));
registerPrimitive('set/inter', combines((set, other) => mergeSets(set, other, INTER_KEEPS)));
registerPrimitive('map/inter', (map, keys) => interOfMap(map, keys, MapInterKeysElementKindNotTakenError));
