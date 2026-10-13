// The words of a path [D248]: `get` reads it strictly and `query` softly,
// over a path, a key or a literal that holds paths; `paths` answers the
// outline of a value; `segments` and `toPath` turn a path and its keys
// into each other, JSON Pointer's form read with its escapes.

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex } from '../path-read.mjs';
import {
  isPath, makePath, isKeyword, isQMap, isQSet, isQuote, isDoc, isVec, isValueClass, keyword, makeSet,
  makeTaggedInstance, TAG_HEADER_SYMBOL
} from '../types.mjs';

const StringToPathNotPointerError = declareRefusal('string/toPath/NotPointerError');
const VecToPathElementNotKeyError = declareRefusal('vec/toPath/ElementNotKeyError');

// The path a key names, a keyword, a string or a number, of one segment.
function pathOfKey(key) {
  return makePath([isKeyword(key) ? key.name : String(key)]);
}

const isKey = value => isKeyword(value) || typeof value === 'string' || typeof value === 'number';

// A path or a key read from the subject; any other value a shape whose
// paths are read in their places, its other values kept.
function readObject(subject, object, soft, fallback) {
  if (isPath(object) || isKey(object)) {
    const read = readPath(subject, isPath(object) ? object : pathOfKey(object), soft);
    return read === MISSED ? fallback : read;
  }
  return readShape(subject, object, soft, fallback);
}

function readShape(subject, shape, soft, fallback) {
  if (isPath(shape)) {
    const read = readPath(subject, shape, soft);
    return read === MISSED ? fallback : read;
  }
  if (isValueClass(shape, 'taggedInstance') || isQuote(shape) || isDoc(shape)) return shape;
  if (isQSet(shape)) return makeSet(shape.map(element => readShape(subject, element, soft, fallback)));
  const tag = shape?.[TAG_HEADER_SYMBOL];
  let read;
  if (isVec(shape)) read = shape.map(element => readShape(subject, element, soft, fallback));
  else if (isQMap(shape)) read = new Map([...shape].map(([key, value]) => [key, readShape(subject, value, soft, fallback)]));
  else return shape;
  return tag === undefined ? (isVec(read) ? Object.freeze(read) : read) : makeTaggedInstance(tag, read);
}

bindPrim('any/get', (subject, object) => readObject(subject, object, false, null));
bindPrim('any/query', (subject, object, fallback) => readObject(subject, object, true, fallback));

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

bindPrim('vec/toPath', keys => makePath(keys.map((key, index) => {
  if (!isKey(key) || (typeof key === 'number' && !Number.isInteger(key))) {
    throw new VecToPathElementNotKeyError({ index, actualValue: key });
  }
  return isKeyword(key) ? key.name : String(key);
})));

// A string in JSON Pointer's form, a fragment's `#` before it read too,
// `~1` a slash and `~0` a tilde within a segment.
bindPrim('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw new StringToPathNotPointerError({ actualValue: text });
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
