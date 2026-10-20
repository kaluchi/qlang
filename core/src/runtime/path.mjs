// The verbs of a path: `get` reads it strictly and `query` softly, over a
// path, a key or a literal that holds paths; `put`, `update` and `delete`
// write it; `segments` and `toPath` turn a path and its keys into each other,
// JSON Pointer's form read with its escapes [QSPTH#get], [QSPTH#query],
// [QSPTH#template], [QSPTH#write], [QSPTH#verbs].

import { registerPrimitive, registerStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, indexIn, noPartsOn, partsOfTemplate, isKeyAlone, keyNameOf } from '../path-read.mjs';
import { layTag } from '../eval.mjs';
import { atPlace } from '../eval-trace.mjs';
import { isPath, makePath, isMap, isVec, isValueClass, isErrorValue, keyword, TAG_HEADER_SYMBOL } from '../types.mjs';

const StringToPathNotPointerError = declareRefusal('string/toPath/NotPointerError');
const VecToPathElementNotKeyError = declareRefusal('vec/toPath/ElementNotKeyError');
const VecToPathSubjectEmptyError = declareRefusal('vec/toPath/SubjectEmptyError');

// A path, or the path of one segment a key alone names [QSPTH#key].
const pathOf = pathOrKey => (isPath(pathOrKey) ? pathOrKey : makePath([keyNameOf(pathOrKey)]));

// A path or a key read from the subject; any other value a template whose
// paths are read and whose quotes, closed at the call, are run against the
// subject in their places, its other values kept, each container laid back
// under its tags as a write lays it, the first failure the answer [QSLIT#tag].
function readByPath(subject, path, soft, fallback, state) {
  if (isPath(path) || isKeyAlone(path)) {
    const read = readPath(subject, pathOf(path), soft);
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
// its answer; an error the code answers is the answer, at its path
// [QSPTH#write], [QSERR#trace].
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

// The keys and indices of a path, an index as its number and a key as its
// keyword.
registerPrimitive('path/segments', path => Object.freeze(path.segments.map(segment => {
  const index = segmentIndex(segment);
  return Number.isNaN(index) || String(index) !== segment ? keyword(segment) : index;
})));

// A path names one segment at least, the value itself being `it` [QSPTH#value],
// each the text of a key alone [QSPTH#key]; a path is itself.
registerPrimitive('vec/toPath', keys => {
  if (keys.length === 0) throw new VecToPathSubjectEmptyError({ actualValue: keys });
  return makePath(keys.map((key, index) => {
    if (!isKeyAlone(key)) throw new VecToPathElementNotKeyError({ index, actualValue: key });
    return keyNameOf(key);
  }));
});
registerPrimitive('path/toPath', path => path);

// A string in JSON Pointer's form, a fragment's `#` before it read too,
// `~1` a slash and `~0` a tilde within a segment.
registerPrimitive('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw new StringToPathNotPointerError({ actualValue: text });
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
