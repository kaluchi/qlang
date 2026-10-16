// The words of a path [QSPTH#value]: `get` reads it strictly and `query`
// softly, over a path, a key or a literal that holds paths; `put`, `update`
// and `delete` write it [QSPTH#write]; `paths` answers the outline of a value
// and `shape` its schema [QSPTH#words]; `segments` and `toPath` turn a path
// and its keys into each other, JSON Pointer's form read with its escapes.

import { bindPrim, bindStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, placeIn, noPartsOn, partsOfTemplate } from '../path-read.mjs';
import { mintUnderTag } from './verb.mjs';
import { atPlace } from '../eval-trail.mjs';
import { deepEqual } from '../equality.mjs';
import {
  isPath, makePath, isKeyword, isQMap, isVec, isQSet, isValueClass, isErrorValue, isTaggedInstance, keyword, makeSet,
  makeTaggedInstance, typeKeyword, TAG_HEADER_SYMBOL, ABSENT_TAG, EACH_TAG, NULLABLE_TAG, SHAPE_TAG
} from '../types.mjs';

const StringToPathNotPointerError = declareRefusal('string/toPath/NotPointerError');
const VecToPathElementNotKeyError = declareRefusal('vec/toPath/ElementNotKeyError');
const VecToPathEmptyError = declareRefusal('vec/toPath/EmptyError');

// The path a key names, a keyword, a string or a number, of one segment.
function pathOfKey(key) {
  return makePath([isKeyword(key) ? key.name : String(key)]);
}

const isKey = value => isKeyword(value) || typeof value === 'string' || typeof value === 'number';

// A path or a key read from the subject; any other value a template whose
// paths are read and whose quotes, closed at the call, are run against the
// subject in their places, its other values kept, each container laid back
// under its tags as a write lays it, the first failure the answer [QSLIT#tag].
function readObject(subject, object, soft, fallback, state) {
  if (isPath(object) || isKey(object)) {
    const read = readPath(subject, isPath(object) ? object : pathOfKey(object), soft);
    return read === MISSED ? fallback : read;
  }
  return readTemplate(subject, object, soft, fallback, state);
}

async function readTemplate(subject, template, soft, fallback, state) {
  if (typeof template === 'function') return await template(subject);
  if (isPath(template)) {
    const read = readPath(subject, template, soft);
    return read === MISSED ? fallback : read;
  }
  if (isValueClass(template, 'taggedInstance')) {
    const payload = await readTemplate(subject, template.payload, soft, fallback, state);
    if (payload === template.payload) return template;
    return isErrorValue(payload) ? payload : await relaid(template, payload, state);
  }
  const parts = partsOfTemplate(template);
  if (parts === null) return template;
  const read = await readParts(subject, [...parts], soft, fallback, state);
  if (isErrorValue(read)) return read;
  return await relaid(template, isQMap(template) ? new Map([...template.keys()].map((key, at) => [key, read[at]])) : read, state);
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

bindStateReader('any/get', runsWithin(['path'], (subject, object, state) => readObject(subject, object, false, null, state)));
bindStateReader('any/query', runsWithin(['path'], (subject, object, fallback, state) => readObject(subject, object, true, fallback, state)));

// The subject with the part at a path written: `put` lays a value there,
// a key the last map lacks added, `update` lays what its code answers for
// the part there, and `delete` takes the part out, the elements after a
// place it takes moving up. The path is followed as `get` follows it, and
// every container on the way is built again and laid under the tags it
// stood under, their constructors and invariants run, as `within` lays
// its answer; an error the code answers is the answer, at the path of the
// part [D337].
async function written(value, path, at, write, state) {
  if (isValueClass(value, 'taggedInstance')) return await relaid(value, await written(value.payload, path, at, write, state), state);
  const segment = path.segments[at];
  const last = at === path.segments.length - 1;
  let bare;
  let slot;
  if (isQMap(value)) {
    if (!value.has(segment) && !(last && write.adds)) throw keyNotInMap(value, segment, path);
    bare = new Map(value);
    slot = segment;
  } else if (isVec(value)) {
    bare = [...value];
    slot = placeIn(value, segment, path);
  } else {
    throw noPartsOn(value, segment, path);
  }
  if (last && write.removes) {
    if (isQMap(bare)) bare.delete(slot);
    else bare.splice(slot, 1);
    return await relaid(value, bare, state);
  }
  const old = isQMap(bare) ? bare.get(slot) : bare[slot];
  const part = last ? await write.part(old) : await written(old, path, at + 1, write, state);
  if (isErrorValue(part)) return part;
  if (isQMap(bare)) bare.set(slot, part);
  else bare[slot] = part;
  return await relaid(value, bare, state);
}

async function relaid(original, rebuilt, state) {
  if (isErrorValue(rebuilt)) return rebuilt;
  const tag = original[TAG_HEADER_SYMBOL];
  if (tag === undefined) return isVec(rebuilt) ? Object.freeze(rebuilt) : rebuilt;
  return await mintUnderTag(state, tag, rebuilt);
}

const pathOf = object => (isPath(object) ? object : pathOfKey(object));

bindStateReader('any/put', (subject, object, value, state) =>
  written(subject, pathOf(object), 0, { adds: true, removes: false, part: () => value }, state));
bindStateReader('any/update', runs(['code'], (subject, object, code, state) => {
  const path = pathOf(object);
  const part = async old => {
    const answer = await code(old);
    return isErrorValue(answer) ? atPlace(answer, path) : answer;
  };
  return written(subject, path, 0, { adds: false, removes: false, part }, state);
}));
bindStateReader('any/delete', (subject, object, state) =>
  written(subject, pathOf(object), 0, { adds: false, removes: true }, state));

// `has` asks whether a path reads, beside the membership it answers for any
// other value.
export function pathReads(subject, path) {
  try {
    return readPath(subject, path, true) !== MISSED;
  } catch {
    return false;
  }
}

// The value the outline and the shape read: the subject beneath the tags
// over it, and below it a vector, a set or a map as a reader writes one, a
// part under a tag standing whole as a leaf of its kind, which tells of
// itself on its page [QSPTH#words].
function beneathItsTags(subject) {
  let beneath = subject;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

const isOpened = (value, top) => (isQMap(value) || isVec(value)) && (top || !isTaggedInstance(value) || isQSet(value));

// The outline of a value: the pair of the path and the kind of every part
// that holds no parts, an empty container among them.
bindPrim('any/paths', subject => {
  const found = [];
  const walk = (current, segments) => {
    const top = segments.length === 0;
    const value = top ? beneathItsTags(current) : current;
    const parts = !isOpened(value, top) ? [] : isQMap(value) ? [...value] : value.map((element, index) => [String(index), element]);
    if (parts.length === 0) {
      if (!top) found.push(Object.freeze([makePath(segments), typeKeyword(value)]));
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
// length whose places part a tuple, and each part that holds no parts its
// kind.
function shapeOf(current, top) {
  const value = top ? beneathItsTags(current) : current;
  if (!isOpened(value, top)) return typeKeyword(value);
  if (isQMap(value)) {
    const shapes = new Map([...value].map(([key, part]) => [key, shapeOf(part, false)]));
    return foldedOf(value, shapes) ?? shapes;
  }
  const elements = [...value];
  const element = elements.length === 0 ? [] : [tupleOf(elements) ?? elements.map(part => shapeOf(part, false)).reduce(mergedShape)];
  return isQSet(value) ? makeSet(element) : Object.freeze(element);
}

// Vectors of one length, two places or more, whose places part are tuples,
// the shape of each place across them, `[A B]`, so a path of the data
// through a place reads it; where every place holds one shape they are
// lists, `[E]`.
function tupleOf(elements) {
  if (!elements.every(isList) || new Set(elements.map(element => element.length)).size !== 1 || elements[0].length < 2) return null;
  const places = elements[0].map((_, index) => elements.map(element => shapeOf(element[index], false)).reduce(mergedShape));
  return places.every(place => deepEqual(place, places[0])) ? null : Object.freeze(places);
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
const holdsParts = part => part === null || isQMap(part) || isVec(part) || isTaggedInstance(part);

function foldedOf(value, shapes) {
  const parts = [...value.values()];
  if (value.size === 0 || parts.every(part => part === null)) return null;
  const keyedByData = [...value.keys()].every(isDataKey);
  if (!keyedByData && (value.size <= NAMES_A_RECORD_HOLDS || !parts.every(holdsParts))) return null;
  const merged = [...shapes.values()].reduce(mergedShape);
  if (!keyedByData && isAlternatives(merged)) return null;
  const [first] = value.keys();
  return makeTaggedInstance(EACH_TAG, new Map([[first, merged]]));
}

// The schema stands under `::shape`, whose page tells how a shape reads.
bindPrim('any/shape', subject => makeTaggedInstance(SHAPE_TAG, shapeOf(subject, true)));

// The marks a shape carries over its core, `::absent` outside, a key some
// records lack, and `::nullable` within, a part null in some of the data;
// a part that is null alone stands as `::null`.
const NULL_KIND = typeKeyword(null);
const isMark = (value, tag) => isTaggedInstance(value) && value[TAG_HEADER_SYMBOL].name === tag.name;
const under = value => (isValueClass(value, 'taggedInstance') ? value.payload : isVec(value) ? Object.freeze([...value]) : new Map(value));

function marksOf(shape) {
  let core = shape;
  const absent = isMark(core, ABSENT_TAG);
  if (absent) core = under(core);
  const nullable = isMark(core, NULLABLE_TAG);
  if (nullable) core = under(core);
  return { absent, nullable, core };
}

function marked({ absent, nullable, core }) {
  const held = nullable && !deepEqual(core, NULL_KIND) ? makeTaggedInstance(NULLABLE_TAG, core) : core;
  return absent ? makeTaggedInstance(ABSENT_TAG, held) : held;
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
// shape, two tuples of one length place by place, and two sets the set of
// it, the element of one that is empty marked `::absent`, its first place
// missing there; two records that share a key, an empty one among them, the
// record of the keys of both, a key one of them lacks marked `::absent`;
// two folds `::each` over the shape their values share, where they share
// one, and an empty map a fold whose value it marks `::absent`; and any
// other two the set of their kinds, two or more where they part, any two
// of them that merge merged until none do, so records that share keys
// merge whatever their order. Records of no common key stand apart, so the
// shape folds records as far as they share their keys.
const isSetOf = shape => isQSet(shape) && shape.length < 2;
const isAlternatives = shape => isQSet(shape) && shape.length > 1;
const isRecord = shape => isQMap(shape) && !isTaggedInstance(shape);
const isList = shape => isVec(shape) && !isTaggedInstance(shape);
const shareAKey = (left, right) => left.size === 0 || right.size === 0 || [...left.keys()].some(key => right.has(key));
const eachKey = each => [...under(each).keys()][0];
const eachShape = each => [...under(each).values()][0];
const eachesMerge = (left, right) => isMark(left, EACH_TAG) && isMark(right, EACH_TAG) && !isAlternatives(mergedShape(eachShape(left), eachShape(right)));
const isEmptyRecord = shape => isRecord(shape) && shape.size === 0;
const eachAndEmpty = (left, right) => (isMark(left, EACH_TAG) && isEmptyRecord(right)) || (isEmptyRecord(left) && isMark(right, EACH_TAG));
const mergesWith = (left, right) => deepEqual(left, right) || eachesMerge(left, right) || eachAndEmpty(left, right) || (isSetOf(left) && isSetOf(right))
  || (isList(left) && isList(right)) || (isRecord(left) && isRecord(right) && shareAKey(left, right));
const lacked = shape => marked({ ...marksOf(shape), absent: true });
const collapsed = places => places.reduce(mergedShape);

function mergedPlaces(left, right) {
  if (left.length === 0 || right.length === 0) return [lacked(collapsed(left.length === 0 ? right : left))];
  if (left.length !== right.length) return [collapsed([...left, ...right])];
  const places = left.map((place, index) => mergedShape(place, right[index]));
  return places.every(place => deepEqual(place, places[0])) ? [places[0]] : places;
}

function mergedCore(left, right) {
  if (deepEqual(left, right)) return left;
  if (eachesMerge(left, right)) return makeTaggedInstance(EACH_TAG, new Map([[eachKey(left), mergedShape(eachShape(left), eachShape(right))]]));
  if (eachAndEmpty(left, right)) {
    const each = isEmptyRecord(left) ? right : left;
    return makeTaggedInstance(EACH_TAG, new Map([[eachKey(each), lacked(eachShape(each))]]));
  }
  if (isSetOf(left) && isSetOf(right)) return makeSet(mergedPlaces(left, right));
  if (isList(left) && isList(right)) return Object.freeze(mergedPlaces(left, right));
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

// The keys and places of a path, a place as its number and a key as its
// keyword.
bindPrim('path/segments', path => Object.freeze(path.segments.map(segment => {
  const place = segmentIndex(segment);
  return Number.isNaN(place) || String(place) !== segment ? keyword(segment) : place;
})));

// A path names one segment at least, the value itself being `it` [QSPTH#value].
bindPrim('vec/toPath', keys => {
  if (keys.length === 0) throw new VecToPathEmptyError({ actualValue: keys });
  return makePath(keys.map((key, index) => {
    if (!isKey(key) || (typeof key === 'number' && !Number.isInteger(key))) {
      throw new VecToPathElementNotKeyError({ index, actualValue: key });
    }
    return isKeyword(key) ? key.name : String(key);
  }));
});

// A string in JSON Pointer's form, a fragment's `#` before it read too,
// `~1` a slash and `~0` a tilde within a segment.
bindPrim('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw new StringToPathNotPointerError({ actualValue: text });
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
