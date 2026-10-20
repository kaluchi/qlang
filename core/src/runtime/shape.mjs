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

// A map whose values are not all null folds into `::each` over its least key
// [D385] and the shape of its values where every key is data, an id of digits, a
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
  return makeTagged(EACH_TAG, new Map([[leastOf(value.keys()), merged]]));
}

const leastOf = keys => [...keys].sort(compareValues)[0];

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

const isNullShape = shape => compareValues(shape, NULL_KIND) === 0;

function marked({ absent, nullable, core }) {
  const held = nullable && !isNullShape(core) ? makeTagged(NULLABLE_TAG, core) : core;
  return absent ? makeTagged(ABSENT_TAG, held) : held;
}

const lacked = shape => marked({ ...marksOf(shape), absent: true });
const isSetOf = shape => isSet(shape) && shape.length < 2;
const isAlternatives = shape => isSet(shape) && shape.length > 1;
const isRecord = shape => isMap(shape) && !isTagged(shape);
const isList = shape => isVec(shape) && !isTagged(shape);
const isFold = shape => isMark(shape, EACH_TAG);
const eachKey = each => [...payloadBeneath(each).keys()][0];
const eachShape = each => [...payloadBeneath(each).values()][0];

// The shape the shapes of parts share, merged from all of them at once, so data
// in any order answers one shape at any depth [D385]: their marks joined over the
// cores they share, a null giving way to the rest as `::nullable`.
function collapsed(shapes) {
  const marks = shapes.map(marksOf);
  const cores = marks.flatMap(({ core }) => (isNullShape(core) ? [] : isAlternatives(core) ? [...core] : [core]));
  return marked({
    absent: marks.some(({ absent }) => absent),
    nullable: marks.some(({ nullable, core }) => nullable || isNullShape(core)),
    core: cores.length === 0 ? NULL_KIND : mergedCores(cores)
  });
}

// The cores of parts merged: vectors into one, sets into one, records that
// share a key into one, folds whose values merge into one, and an empty map,
// which holds no key, lacking each key of the records and folds beside it; the
// rest stand apart as the set of their kinds [D385].
function mergedCores(cores) {
  const kinds = [...makeSet(cores)];
  const lacks = kinds.some(kind => isRecord(kind) && kind.size === 0) && kinds.some(kind => (isRecord(kind) && kind.size > 0) || isFold(kind));
  const parts = classesOf(lacks ? kinds.filter(kind => !isRecord(kind) || kind.size > 0) : kinds);
  const merged = makeSet(parts.map(members => mergedClass(members, lacks)));
  return merged.length === 1 ? merged[0] : merged;
}

// The kinds gathered into the classes that merge, until no two classes do.
function classesOf(kinds) {
  const classes = kinds.map(kind => [kind]);
  for (let found = true; found;) {
    found = false;
    for (let at = 0; at < classes.length && !found; at += 1) {
      const other = classes.findIndex((members, index) => index > at && mergeTogether(classes[at], members));
      if (other !== -1) {
        classes[at] = [...classes[at], ...classes.splice(other, 1)[0]];
        found = true;
      }
    }
  }
  return classes;
}

function mergeTogether(left, right) {
  const [one] = left;
  const [other] = right;
  if (isList(one) || isList(other)) return isList(one) && isList(other);
  if (isSetOf(one) || isSetOf(other)) return isSetOf(one) && isSetOf(other);
  if (isRecord(one) || isRecord(other)) return isRecord(one) && isRecord(other) && keysOf(left).some(key => right.some(record => record.has(key)));
  return isFold(one) && isFold(other) && !isAlternatives(marksOf(collapsed([...left, ...right].map(eachShape))).core);
}

const keysOf = records => [...new Set([...records].sort(compareValues).flatMap(record => [...record.keys()]))];

function mergedClass(members, lacks) {
  const [first] = members;
  if (isList(first)) return Object.freeze(elementsMerged(members));
  if (isSetOf(first)) return makeSet(elementsMerged(members));
  if (isRecord(first)) return recordMerged(members, lacks);
  if (!isFold(first)) return first;
  const values = collapsed(members.map(eachShape));
  return makeTagged(EACH_TAG, new Map([[leastOf(members.map(eachKey)), lacks ? lacked(values) : values]]));
}

// The element vectors or sets share: none where all are empty, marked
// `::absent` where some are, a tuple where tuples of one length part index by
// index, and one element of all of them else.
function elementsMerged(members) {
  const filled = members.filter(member => member.length > 0);
  if (filled.length === 0) return [];
  const elements = filled.flatMap(member => [...member]);
  if (filled.length < members.length) return [lacked(collapsed(elements))];
  if (filled.some(member => member.length !== filled[0].length)) return [collapsed(elements)];
  const byIndex = filled[0].map((_, index) => collapsed(filled.map(member => member[index])));
  return byIndex.every(shape => compareValues(shape, byIndex[0]) === 0) ? [byIndex[0]] : byIndex;
}

// The record records that share a key make: the keys of all of them, each over
// the shape its values share, marked `::absent` where some lack it or an empty
// map stands beside them.
function recordMerged(records, lacks) {
  return new Map(keysOf(records).map(key => {
    const holding = records.filter(record => record.has(key));
    const shape = collapsed(holding.map(record => record.get(key)));
    return [key, lacks || holding.length < records.length ? lacked(shape) : shape];
  }));
}
