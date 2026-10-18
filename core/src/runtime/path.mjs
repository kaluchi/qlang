// The verbs of a path: `get` reads it strictly and `query` softly, over a
// path, a key or a literal that holds paths; `put`, `update` and `delete`
// write it; `paths` answers the outline of a value and `shape` its schema;
// `segments` and `toPath` turn a path and its keys into each other, JSON
// Pointer's form read with its escapes [QSPTH].

import { registerPrimitive, registerStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, indexIn, noPartsOn, partsOfTemplate } from '../path-read.mjs';
import { layTag } from './verb.mjs';
import { atPlace } from '../eval-trace.mjs';
import { deepEqual } from '../equality.mjs';
import {
  isPath, makePath, isKeyword, isMap, isVec, isSet, isValueClass, isErrorValue, isTagged, keyword, makeSet,
  makeTagged, beneathTags, payloadBeneath, typeOf, TAG_HEADER_SYMBOL, ABSENT_TAG, EACH_TAG, NULLABLE_TAG, SHAPE_TAG
} from '../types.mjs';

const StringToPathNotPointerError = declareRefusal('string/toPath/NotPointerError');
const VecToPathElementNotKeyError = declareRefusal('vec/toPath/ElementNotKeyError');
const VecToPathSubjectEmptyError = declareRefusal('vec/toPath/SubjectEmptyError');

// The path a key names, a keyword, a string or a number, of one segment.
function pathOfKey(key) {
  return makePath([isKeyword(key) ? key.name : String(key)]);
}

const isKey = value => isKeyword(value) || typeof value === 'string' || typeof value === 'number';

// A path or a key read from the subject; any other value a template whose
// paths are read and whose quotes, closed at the call, are run against the
// subject in their places, its other values kept, each container laid back
// under its tags as a write lays it, the first failure the answer [QSLIT#tag].
function readByPath(subject, path, soft, fallback, state) {
  if (isPath(path) || isKey(path)) {
    const read = readPath(subject, isPath(path) ? path : pathOfKey(path), soft);
    return read === MISSED ? fallback : read;
  }
  return readTemplate(subject, path, soft, fallback, state);
}

async function readTemplate(subject, template, soft, fallback, state) {
  if (typeof template === 'function') return await template(subject);
  if (isPath(template)) {
    const read = readPath(subject, template, soft);
    return read === MISSED ? fallback : read;
  }
  if (isValueClass(template, 'underTag')) {
    const payload = await readTemplate(subject, template.payload, soft, fallback, state);
    if (payload === template.payload) return template;
    return isErrorValue(payload) ? payload : await relaid(template, payload, state);
  }
  const parts = partsOfTemplate(template);
  if (parts === null) return template;
  const read = await readParts(subject, [...parts], soft, fallback, state);
  if (isErrorValue(read)) return read;
  return await relaid(template, isMap(template) ? new Map([...template.keys()].map((key, at) => [key, read[at]])) : read, state);
}

// The parts of a template read one after another, the first failure the
// answer.
async function readParts(subject, templates, soft, fallback, state) {
  const parts = [];
  for (const template of templates) {
    const part = await readTemplate(subject, template, soft, fallback, state);
    if (isErrorValue(part)) return part;
    parts.push(part);
  }
  return parts;
}

registerStateReader('any/get', runsWithin(['path'], (subject, path, state) => readByPath(subject, path, false, null, state)));
registerStateReader('any/query', runsWithin(['path'], (subject, path, fallback, state) => readByPath(subject, path, true, fallback, state)));

// The subject with the part at a path written: `put` lays a value there,
// a key the last map lacks added, `update` lays what its code answers for
// the part there, and `delete` takes the part out, the elements after an
// index it takes moving up. The path is followed as `get` follows it, and
// every container on the way is built again and laid under the tags it
// stood under, each laid again through its kind, as `within` lays
// its answer; an error the code answers is the answer, at its path [D360].
async function written(value, path, at, write, state) {
  if (isValueClass(value, 'underTag')) return await relaid(value, await written(value.payload, path, at, write, state), state);
  const segment = path.segments[at];
  const last = at === path.segments.length - 1;
  let bare;
  let slot;
  if (isMap(value)) {
    if (!value.has(segment) && !(last && write.adds)) throw keyNotInMap(value, segment, path);
    bare = new Map(value);
    slot = segment;
  } else if (isVec(value)) {
    bare = [...value];
    slot = indexIn(value, segment, path);
  } else {
    throw noPartsOn(value, segment, path);
  }
  if (last && write.removes) {
    if (isMap(bare)) bare.delete(slot);
    else bare.splice(slot, 1);
    return await relaid(value, bare, state);
  }
  const old = isMap(bare) ? bare.get(slot) : bare[slot];
  const part = last ? await write.part(old) : await written(old, path, at + 1, write, state);
  if (isErrorValue(part)) return part;
  if (isMap(bare)) bare.set(slot, part);
  else bare[slot] = part;
  return await relaid(value, bare, state);
}

async function relaid(original, rebuilt, state) {
  if (isErrorValue(rebuilt)) return rebuilt;
  const tag = original[TAG_HEADER_SYMBOL];
  if (tag === undefined) return isVec(rebuilt) ? Object.freeze(rebuilt) : rebuilt;
  return await layTag(tag.name, rebuilt, state);
}

const pathOf = pathOrKey => (isPath(pathOrKey) ? pathOrKey : pathOfKey(pathOrKey));

registerStateReader('any/put', (subject, pathOrKey, value, state) =>
  written(subject, pathOf(pathOrKey), 0, { adds: true, removes: false, part: () => value }, state));
registerStateReader('any/update', runs(['code'], (subject, pathOrKey, code, state) => {
  const path = pathOf(pathOrKey);
  const part = async old => {
    const answer = await code(old);
    return isErrorValue(answer) ? atPlace(answer, path) : answer;
  };
  return written(subject, path, 0, { adds: false, removes: false, part }, state);
}));
registerStateReader('any/delete', (subject, pathOrKey, state) =>
  written(subject, pathOf(pathOrKey), 0, { adds: false, removes: true }, state));

// `has` asks whether a path reads, beside whether a value of any other kind
// is held [QSPTH#has].
export function pathReads(subject, path) {
  try {
    return readPath(subject, path, true) !== MISSED;
  } catch {
    return false;
  }
}

// The outline and the shape read the subject beneath its tags, and below it a
// vector, a set or a map as a reader writes one, a part under a tag standing
// whole as a leaf of its kind, which tells of itself on its page [QSPTH#verbs].
const isOpened = (value, top) => (isMap(value) || isVec(value)) && (top || !isTagged(value) || isSet(value));

// The outline of a value: the pair of the path and the kind of every part
// that holds no parts, an empty container among them.
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

// The shape of a value: each map with its keys, a map keyed by data or by
// many names folding into `::each`, each vector and each set one element
// whose shape holds of all its elements, a set as `#[E]`, vectors of one
// length that part index by index a tuple, and each part that holds no parts
// its kind.
function shapeOf(current, top) {
  const value = top ? beneathTags(current) : current;
  if (!isOpened(value, top)) return typeOf(value);
  if (isMap(value)) {
    const shapes = new Map([...value].map(([key, part]) => [key, shapeOf(part, false)]));
    return foldedOf(value, shapes) ?? shapes;
  }
  const elements = [...value];
  const element = elements.length === 0 ? [] : [tupleOf(elements) ?? elements.map(part => shapeOf(part, false)).reduce(mergedShape)];
  return isSet(value) ? makeSet(element) : Object.freeze(element);
}

// Vectors of one length, two elements or more, that part index by index are
// tuples, the shape at each index across them, `[A B]`, so a path of the data
// through an index reads it; where every index holds one shape they are
// lists, `[E]`.
function tupleOf(elements) {
  if (!elements.every(isList) || new Set(elements.map(element => element.length)).size !== 1 || elements[0].length < 2) return null;
  const byIndex = elements[0].map((_, index) => elements.map(element => shapeOf(element[index], false)).reduce(mergedShape));
  return byIndex.every(shape => deepEqual(shape, byIndex[0])) ? null : Object.freeze(byIndex);
}

// A map folds into `::each` over its first key and the shape of its values,
// the one key standing for all of them, where every key is data, an id of
// digits, a date or a time, a uuid, an address, whatever its values hold,
// kinds that part among them; and where it holds more than eight names
// whose values, maps, vectors, sets, values under a tag or null, share one
// shape, the map a reader's data keys by its users' names. A map of names
// over atoms keeps them however many, the fields a reader reads by `get`,
// a key that reads as no name, `@type`, among them, as a map of fewer
// names or of names whose values part does.
const DATA_KEYS = [
  /^-?\d+(\.\d+)?$/,
  /^\d{4}-\d{2}-\d{2}/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/
];
const isDataKey = key => DATA_KEYS.some(pattern => pattern.test(key));
const NAMES_A_RECORD_HOLDS = 8;
const holdsParts = part => part === null || isMap(part) || isVec(part) || isTagged(part);

function foldedOf(value, shapes) {
  const parts = [...value.values()];
  if (value.size === 0 || parts.every(part => part === null)) return null;
  const keyedByData = [...value.keys()].every(isDataKey);
  if (!keyedByData && (value.size <= NAMES_A_RECORD_HOLDS || !parts.every(holdsParts))) return null;
  const merged = [...shapes.values()].reduce(mergedShape);
  if (!keyedByData && isAlternatives(merged)) return null;
  const [first] = value.keys();
  return makeTagged(EACH_TAG, new Map([[first, merged]]));
}

// The schema stands under `::shape`, whose page tells how a shape reads.
registerPrimitive('any/shape', subject => makeTagged(SHAPE_TAG, shapeOf(subject, true)));

// The marks a shape carries over its core, `::absent` outside, a key some
// records lack, and `::nullable` within, a part null in some of the data;
// a part that is null alone stands as `::null`.
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
  const held = nullable && !deepEqual(core, NULL_KIND) ? makeTagged(NULLABLE_TAG, core) : core;
  return absent ? makeTagged(ABSENT_TAG, held) : held;
}

// The shape two parts share: their marks joined over the shape their cores
// share, a null giving way to the other as `::nullable`.
function mergedShape(left, right) {
  if (deepEqual(left, right)) return left;
  const l = marksOf(left);
  const r = marksOf(right);
  const leftNull = deepEqual(l.core, NULL_KIND);
  const rightNull = deepEqual(r.core, NULL_KIND);
  const core = leftNull ? r.core : rightNull ? l.core : mergedCore(l.core, r.core);
  return marked({ absent: l.absent || r.absent, nullable: l.nullable || r.nullable || leftNull || rightNull, core });
}

// The shape two cores share: two vectors the vector of their elements'
// shape, two tuples of one length index by index, and two sets the set of
// it, the element of one that is empty marked `::absent`, its first index
// missing there; two records that share a key, an empty one among them, the
// record of the keys of both, a key one of them lacks marked `::absent`;
// two folds `::each` over the shape their values share, where they share
// one, and an empty map a fold whose value it marks `::absent`; and any
// other two the set of their kinds, two or more where they part, any two
// of them that merge merged until none do, so records that share keys
// merge whatever their order. Records of no common key stand apart, so the
// shape folds records as far as they share their keys.
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
const mergesWith = (left, right) => deepEqual(left, right) || eachesMerge(left, right) || eachAndEmpty(left, right) || (isSetOf(left) && isSetOf(right))
  || (isList(left) && isList(right)) || (isRecord(left) && isRecord(right) && shareAKey(left, right));
const lacked = shape => marked({ ...marksOf(shape), absent: true });
const collapsed = shapes => shapes.reduce(mergedShape);

function mergedByIndex(left, right) {
  if (left.length === 0 || right.length === 0) return [lacked(collapsed(left.length === 0 ? right : left))];
  if (left.length !== right.length) return [collapsed([...left, ...right])];
  const byIndex = left.map((shape, index) => mergedShape(shape, right[index]));
  return byIndex.every(shape => deepEqual(shape, byIndex[0])) ? [byIndex[0]] : byIndex;
}

function mergedCore(left, right) {
  if (deepEqual(left, right)) return left;
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

// The keys and indices of a path, an index as its number and a key as its
// keyword.
registerPrimitive('path/segments', path => Object.freeze(path.segments.map(segment => {
  const index = segmentIndex(segment);
  return Number.isNaN(index) || String(index) !== segment ? keyword(segment) : index;
})));

// A path names one segment at least, the value itself being `it` [D360].
registerPrimitive('vec/toPath', keys => {
  if (keys.length === 0) throw new VecToPathSubjectEmptyError({ actualValue: keys });
  return makePath(keys.map((key, index) => {
    if (!isKey(key) || (typeof key === 'number' && !Number.isInteger(key))) {
      throw new VecToPathElementNotKeyError({ index, actualValue: key });
    }
    return isKeyword(key) ? key.name : String(key);
  }));
});

// A string in JSON Pointer's form, a fragment's `#` before it read too,
// `~1` a slash and `~0` a tilde within a segment.
registerPrimitive('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw new StringToPathNotPointerError({ actualValue: text });
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
