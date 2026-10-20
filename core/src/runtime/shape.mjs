// The shape of a value and its leaves [QSPTH#shape]: `shape` answers the structure
// of the subject beneath its tags as a value of `::shape`, with the marks it
// lays over a part, and `paths` the pair of the path and the kind of each leaf.

import { registerPrimitive } from '../primitives.mjs';
import {
  makePath, makeTag, isMap, isVec, isSet, isTagged, makeTagged, beneathTags, payloadBeneath, typeOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { makeSet, compareValues } from '../ordering.mjs';

// The tag of a shape and the marks a shape lays over a part [QSPTH#shape].
const SHAPE_TAG = makeTag('shape');
const ABSENT_TAG = makeTag('absent');
const NULLABLE_TAG = makeTag('nullable');
const EACH_TAG = makeTag('each');

// The subject opens beneath its tags, and below it a vector, a set or a map a
// reader writes, a part under a tag standing whole as a leaf of its kind.
const isOpened = (value, top) => (isMap(value) || isVec(value)) && (top || !isTagged(value) || isSet(value));

// The pairs of the path and the kind of every leaf, an empty container among them.
registerPrimitive('any/paths', subject => {
  const found = [];
  const walk = (current, segments) => {
    const top = segments.length === 0;
    const value = top ? beneathTags(current) : current;
    const parts = !isOpened(value, top) ? [] : isMap(value) ? [...value] : value.map((element, index) => [String(index), element]);
    if (parts.length === 0) {
      if (!top) found.push(Object.freeze([makePath(segments), typeOf(value)]));
      return;
    }
    for (const [segment, part] of parts) walk(part, [...segments, segment]);
  };
  walk(subject, []);
  return makeSet(found);
});

// The shape of a value: a map its keys, folded into `::each` where they are
// data or many names, a vector and a set one element whose shape holds of all,
// or a tuple, an empty one itself, and an atom its kind.
function shapeOf(current, top) {
  const value = top ? beneathTags(current) : current;
  if (!isOpened(value, top)) return typeOf(value);
  if (isMap(value)) {
    const shapes = new Map([...value].map(([key, part]) => [key, shapeOf(part, false)]));
    return foldedOf(value, shapes) ?? shapes;
  }
  const elements = [...value];
  const element = elements.length === 0 ? [] : [tupleOf(elements) ?? collapsed(elements.map(part => shapeOf(part, false)))];
  return isSet(value) ? makeSet(element) : Object.freeze(element);
}

// Vectors of one length and two elements or more whose indices part are a
// tuple, a shape for each index, and a list where every index holds one.
function tupleOf(elements) {
  if (!elements.every(isList) || new Set(elements.map(element => element.length)).size !== 1 || elements[0].length < 2) return null;
  const byIndex = elements[0].map((_, index) => collapsed(elements.map(element => shapeOf(element[index], false))));
  return byIndex.every(shape => compareValues(shape, byIndex[0]) === 0) ? null : Object.freeze(byIndex);
}

// A map whose values are not all null folds into `::each` over its first key
// and the shape of its values where every key is data, an id of digits, a
// date or a time, a uuid or an email, and where more than eight names hold
// containers, values under a tag or null of one shape.
const DATA_KEYS = [
  /^-?\d+(\.\d+)?$/,
  /^\d{4}-\d{2}-\d{2}/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/
];
const isDataKey = key => DATA_KEYS.some(regex => regex.test(key));
const NAMES_A_RECORD_HOLDS = 8;
const holdsParts = part => part === null || isMap(part) || isVec(part) || isTagged(part);

function foldedOf(value, shapes) {
  const parts = [...value.values()];
  if (value.size === 0 || parts.every(part => part === null)) return null;
  const keyedByData = [...value.keys()].every(isDataKey);
  if (!keyedByData && (value.size <= NAMES_A_RECORD_HOLDS || !parts.every(holdsParts))) return null;
  const merged = collapsed([...shapes.values()]);
  if (!keyedByData && isAlternatives(marksOf(merged).core)) return null;
  const [first] = value.keys();
  return makeTagged(EACH_TAG, new Map([[first, merged]]));
}

// The shape stands under `::shape`, whose page tells how a shape reads [QSPTH#shape].
registerPrimitive('any/shape', subject => makeTagged(SHAPE_TAG, shapeOf(subject, true)));

// The marks over the core of a shape, `::absent` outside, a key some records
// lack, and `::nullable` within, a part null in some, a part null in all `::null`.
const NULL_KIND = typeOf(null);
const isMark = (value, tag) => isTagged(value) && value[TAG_HEADER_SYMBOL].name === tag.name;

function marksOf(shape) {
  let core = shape;
  const absent = isMark(core, ABSENT_TAG);
  if (absent) core = payloadBeneath(core);
  const nullable = isMark(core, NULLABLE_TAG);
  if (nullable) core = payloadBeneath(core);
  return { absent, nullable, core };
}

function marked({ absent, nullable, core }) {
  const held = nullable && compareValues(core, NULL_KIND) !== 0 ? makeTagged(NULLABLE_TAG, core) : core;
  return absent ? makeTagged(ABSENT_TAG, held) : held;
}

// The shape two parts share: their marks joined over the shape their cores
// share, a null giving way to the other as `::nullable`.
function mergedShape(left, right) {
  if (compareValues(left, right) === 0) return left;
  const l = marksOf(left);
  const r = marksOf(right);
  const leftNull = compareValues(l.core, NULL_KIND) === 0;
  const rightNull = compareValues(r.core, NULL_KIND) === 0;
  const core = leftNull ? r.core : rightNull ? l.core : mergedCore(l.core, r.core);
  return marked({ absent: l.absent || r.absent, nullable: l.nullable || r.nullable || leftNull || rightNull, core });
}

// The shape two cores share: two lists, two tuples index by index or two sets
// one element, an empty one marking it `::absent`, two records sharing a key
// the record of both, a key one lacks `::absent`, two folds of one shape or a
// fold and an empty map one fold, and any other two the set of their kinds,
// merged until no two of them merge.
const isSetOf = shape => isSet(shape) && shape.length < 2;
const isAlternatives = shape => isSet(shape) && shape.length > 1;
const isRecord = shape => isMap(shape) && !isTagged(shape);
const isList = shape => isVec(shape) && !isTagged(shape);
const shareAKey = (left, right) => left.size === 0 || right.size === 0 || [...left.keys()].some(key => right.has(key));
const eachKey = each => [...payloadBeneath(each).keys()][0];
const eachShape = each => [...payloadBeneath(each).values()][0];
const eachesMerge = (left, right) => isMark(left, EACH_TAG) && isMark(right, EACH_TAG) && !isAlternatives(mergedShape(eachShape(left), eachShape(right)));
const isEmptyRecord = shape => isRecord(shape) && shape.size === 0;
const eachAndEmpty = (left, right) => (isMark(left, EACH_TAG) && isEmptyRecord(right)) || (isEmptyRecord(left) && isMark(right, EACH_TAG));
const mergesWith = (left, right) => compareValues(left, right) === 0 || eachesMerge(left, right) || eachAndEmpty(left, right) || (isSetOf(left) && isSetOf(right))
  || (isList(left) && isList(right)) || (isRecord(left) && isRecord(right) && shareAKey(left, right));
const lacked = shape => marked({ ...marksOf(shape), absent: true });
// The shape the shapes of parts share, merged in the one order [QSPTH#shape].
const collapsed = shapes => [...shapes].sort(compareValues).reduce(mergedShape);

function mergedByIndex(left, right) {
  if (left.length === 0 || right.length === 0) return [lacked(collapsed(left.length === 0 ? right : left))];
  if (left.length !== right.length) return [collapsed([...left, ...right])];
  const byIndex = left.map((shape, index) => mergedShape(shape, right[index]));
  return byIndex.every(shape => compareValues(shape, byIndex[0]) === 0) ? [byIndex[0]] : byIndex;
}

function mergedCore(left, right) {
  if (compareValues(left, right) === 0) return left;
  if (eachesMerge(left, right)) return makeTagged(EACH_TAG, new Map([[eachKey(left), mergedShape(eachShape(left), eachShape(right))]]));
  if (eachAndEmpty(left, right)) {
    const each = isEmptyRecord(left) ? right : left;
    return makeTagged(EACH_TAG, new Map([[eachKey(each), lacked(eachShape(each))]]));
  }
  if (isSetOf(left) && isSetOf(right)) return makeSet(mergedByIndex(left, right));
  if (isList(left) && isList(right)) return Object.freeze(mergedByIndex(left, right));
  if (isRecord(left) && isRecord(right) && shareAKey(left, right)) {
    const keys = [...new Set([...left.keys(), ...right.keys()])];
    return new Map(keys.map(key => [key, left.has(key) && right.has(key) ? mergedShape(left.get(key), right.get(key)) : lacked(left.get(key) ?? right.get(key))]));
  }
  const kinds = [...(isAlternatives(left) ? left : [left]), ...(isAlternatives(right) ? right : [right])];
  for (let found = true; found;) {
    found = false;
    for (let at = 0; at < kinds.length && !found; at += 1) {
      const with_ = kinds.findIndex((kind, index) => index > at && mergesWith(kinds[at], kind));
      if (with_ !== -1) {
        kinds[at] = mergedCore(kinds[at], kinds[with_]);
        kinds.splice(with_, 1);
        found = true;
      }
    }
  }
  const set = makeSet(kinds);
  return set.length === 1 ? set[0] : set;
}
