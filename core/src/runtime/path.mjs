// The words of a path [D248]: `get` reads it strictly and `query` softly,
// over a path, a key or a literal that holds paths; `put`, `update` and
// `delete` write it [D250]; `paths` answers the outline of a value;
// `segments` and `toPath` turn a path and its keys into each other, JSON
// Pointer's form read with its escapes.

import { bindPrim, bindStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, placeIn, noPartsOn, partsOfTemplate } from '../path-read.mjs';
import { mintUnderTag } from './verb.mjs';
import {
  isPath, makePath, isKeyword, isQMap, isVec, isValueClass, isErrorValue, keyword, makeSet,
  TAG_HEADER_SYMBOL
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
// under its tags as a write lays it, the first failure the answer [D279].
function readObject(subject, object, soft, fallback, state) {
  if (isPath(object) || isKey(object)) {
    const read = readPath(subject, isPath(object) ? object : pathOfKey(object), soft);
    return read === MISSED ? fallback : read;
  }
  return readShape(subject, object, soft, fallback, state);
}

async function readShape(subject, shape, soft, fallback, state) {
  if (typeof shape === 'function') return await shape(subject);
  if (isPath(shape)) {
    const read = readPath(subject, shape, soft);
    return read === MISSED ? fallback : read;
  }
  const parts = partsOfTemplate(shape);
  if (parts === null) return shape;
  const read = await readParts(subject, [...parts], soft, fallback, state);
  if (isErrorValue(read)) return read;
  return await relaid(shape, isQMap(shape) ? new Map([...shape.keys()].map((key, at) => [key, read[at]])) : read, state);
}

// The parts of a template read one after another, the first failure the
// answer.
async function readParts(subject, shapes, soft, fallback, state) {
  const parts = [];
  for (const shape of shapes) {
    const part = await readShape(subject, shape, soft, fallback, state);
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

// The outline of a value: the path of every part that holds no parts, an
// empty container among them, beneath the tags stacked over each.
bindPrim('any/paths', value => {
  const found = [];
  const walk = (current, segments) => {
    let beneath = current;
    while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
    const parts = isQMap(beneath) ? [...beneath] : isVec(beneath) ? beneath.map((element, index) => [String(index), element]) : null;
    if (parts === null || parts.length === 0) {
      if (segments.length > 0) found.push(makePath(segments));
      return;
    }
    for (const [segment, part] of parts) walk(part, [...segments, segment]);
  };
  walk(value, []);
  return makeSet(found);
});

// The keys and places of a path, a place as its number and a key as its
// keyword.
bindPrim('path/segments', path => Object.freeze(path.segments.map(segment => {
  const place = segmentIndex(segment);
  return Number.isNaN(place) ? keyword(segment) : place;
})));

// A path names one segment at least, the value itself being `it` [D248].
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
