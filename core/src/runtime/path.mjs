// The words of a path [QSPTH#value]: `get` reads it strictly and `query`
// softly, over a path, a key or a literal that holds paths; `put`, `update`
// and `delete` write it [QSPTH#write]; `paths` answers the outline of a value
// and `shape` its schema [QSPTH#words]; `segments` and `toPath` turn a path
// and its keys into each other, JSON Pointer's form read with its escapes.

import { bindPrim, bindStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, placeIn, noPartsOn, partsOfTemplate } from '../path-read.mjs';
import { mintUnderTag } from './verb.mjs';
import { deepEqual } from '../equality.mjs';
import {
  isPath, makePath, isKeyword, isQMap, isVec, isQSet, isValueClass, isErrorValue, isTaggedInstance, keyword, makeSet,
  makeTaggedInstance, typeKeyword, TAG_HEADER_SYMBOL, EACH_TAG, SHAPE_TAG
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
// its answer; an error the code answers is the answer.
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
bindStateReader('any/update', runs(['code'], (subject, object, code, state) =>
  written(subject, pathOf(object), 0, { adds: false, removes: false, part: code }, state)));
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
// over it, and below it a vector or a map as a reader writes one, a part
// under a tag standing whole as a leaf of its kind [QSPTH#words].
function beneathItsTags(subject) {
  let beneath = subject;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

const isOpened = (value, top) => (isQMap(value) || isVec(value)) && (top || !isTaggedInstance(value));

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

// The shape of a value: each map with its keys, a map whose values share
// one shape folding into `::each` over it, each vector one element whose
// shape holds of all its elements, and each part that holds no parts its
// kind.
function shapeOf(current, top) {
  const value = top ? beneathItsTags(current) : current;
  if (!isOpened(value, top)) return typeKeyword(value);
  if (isQMap(value)) {
    const shapes = new Map([...value].map(([key, part]) => [key, shapeOf(part, false)]));
    return foldedOf(value, shapes) ?? shapes;
  }
  return Object.freeze(value.length === 0 ? [] : [value.map(element => shapeOf(element, false)).reduce(mergedShape)]);
}

// A map of more than one value, every value a map, a vector or a value
// under a tag, whose shapes merge into one, no kinds parting among them,
// folds into `::each` over that shape, its keys left to the data. A map of
// one key, of atoms, whose keys are the fields a reader reads, or of
// values of other kinds keeps its keys.
const holdsParts = part => isQMap(part) || isVec(part) || isTaggedInstance(part);

function foldedOf(value, shapes) {
  if (value.size < 2 || ![...value.values()].every(holdsParts)) return null;
  const merged = [...shapes.values()].reduce(mergedShape);
  return isQSet(merged) ? null : makeTaggedInstance(EACH_TAG, merged);
}

const isEach = value => isTaggedInstance(value) && value[TAG_HEADER_SYMBOL].name === EACH_TAG.name;
const eachOf = value => (isValueClass(value, 'taggedInstance') ? value.payload : isVec(value) ? Object.freeze([...value]) : new Map(value));
const eachesMerge = (left, right) => isEach(left) && isEach(right) && !isQSet(mergedShape(eachOf(left), eachOf(right)));

// The schema stands under `::shape`, whose page tells how a shape reads.
bindPrim('any/shape', subject => makeTaggedInstance(SHAPE_TAG, shapeOf(subject, true)));

// The shape two parts share: two maps of the same keys a map of their
// shapes key by key; two vectors the vector of their elements' shape, an
// empty one giving way; two folds `::each` over the shape their values
// share, where they share one; and any other two the set of their kinds, a
// vector in it merged with a vector, a fold with a fold and a map with a
// map of the same keys. Maps of other keys stand apart, no key stitched in
// that one of them lacks, so the shape folds the records as far as their
// keys agree and no further.
const sameKeys = (left, right) => left.size === right.size && [...left.keys()].every(key => right.has(key));
const merging = (left, right) => eachesMerge(left, right)
  || (isOpened(left, false) && isOpened(right, false) && isQMap(left) === isQMap(right) && (!isQMap(left) || sameKeys(left, right)));

function mergedShape(left, right) {
  if (deepEqual(left, right)) return left;
  if (eachesMerge(left, right)) return makeTaggedInstance(EACH_TAG, mergedShape(eachOf(left), eachOf(right)));
  if (merging(left, right)) {
    if (isQMap(left)) return new Map([...left.keys()].map(key => [key, mergedShape(left.get(key), right.get(key))]));
    return left.length === 0 ? right : right.length === 0 ? left : Object.freeze([mergedShape(left[0], right[0])]);
  }
  const kinds = [];
  for (const shape of [...(isQSet(left) ? left : [left]), ...(isQSet(right) ? right : [right])]) {
    const same = kinds.findIndex(kept => merging(kept, shape));
    if (same === -1) kinds.push(shape);
    else kinds[same] = mergedShape(kinds[same], shape);
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
