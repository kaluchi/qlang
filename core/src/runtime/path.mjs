// [QSPTH#get], [QSPTH#query], [QSPTH#template], [QSPTH#write], [QSPTH#verbs]

import { registerPrimitive, registerStateReader, runs, runsWithin } from '../primitives.mjs';
import { declareRefusal, refusingTheSubject, refusingAPart } from '../errors.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, indexIn, noPartsOn, partsOfTemplate, isKeyAlone, keyNameOf, KINDS_OF_A_KEY_ALONE } from '../path-read.mjs';
import { kindsExpected } from '../ordering.mjs';
import { layTag } from '../eval.mjs';
import { atPlace } from '../eval-trace.mjs';
import { isPath, makePath, isMap, isVec, isValueClass, isErrorValue, keyword, beneathTags, TAG_HEADER_SYMBOL } from '../types.mjs';

const StringToPathNotPointerError = declareRefusal('string/toPath/NotPointerError');
const VecToPathElementKindNotTakenError = declareRefusal('vec/toPath/ElementKindNotTakenError');
const VecToPathSubjectEmptyError = declareRefusal('vec/toPath/SubjectEmptyError');

// [QSPTH#key]
const pathOf = pathOrKey => (isPath(pathOrKey) ? pathOrKey : makePath([keyNameOf(pathOrKey)]));

function readOne(subject, path, soft, fallback) {
  const read = readPath(subject, path, soft);
  return read === MISSED ? fallback : read;
}

// [QSLIT#tag]
export function readByPath(subject, path, soft, fallback, state) {
  const key = beneathTags(path);
  return isPath(path) || isKeyAlone(key) ? readOne(subject, pathOf(key), soft, fallback) : readTemplate(subject, path, soft, fallback, state);
}

export async function readTemplate(subject, template, soft, fallback, state) {
  if (typeof template === 'function') return await template(subject);
  if (isPath(template)) return readOne(subject, template, soft, fallback);
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

// [QSPTH#write], [QSERR#trace]
async function written(value, path, at, write, state) {
  if (isValueClass(value, 'underTag')) return await relaid(value, await written(value.payload, path, at, write, state), state);
  const segment = path.segments[at];
  const last = at === path.segments.length - 1;
  let bare;
  let slot;
  if (isMap(value)) {
    if (!value.has(segment) && !(last && write.adds)) throw keyNotInMap(value, segment, path, at);
    bare = new Map(value);
    slot = segment;
  } else if (isVec(value)) {
    bare = [...value];
    slot = indexIn(value, segment, path, at);
  } else {
    throw noPartsOn(value, segment, path, at);
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
    return isErrorValue(answer) ? atPlace(code, answer, path) : answer;
  };
  return written(subject, path, 0, { adds: false, removes: false, part }, state);
}));
registerStateReader('any/delete', (subject, pathOrKey, state) =>
  written(subject, pathOf(pathOrKey), 0, { adds: false, removes: true }, state));

// [QSPTH#has]
export function pathReads(subject, path) {
  try {
    return readPath(subject, path, true) !== MISSED;
  } catch {
    return false;
  }
}

registerPrimitive('path/segments', path => Object.freeze(path.segments.map(segment => {
  const index = segmentIndex(segment);
  return Number.isNaN(index) || String(index) !== segment ? keyword(segment) : index;
})));

// [QSPTH#value], [QSPTH#key], [QSPTH#verbs]
registerPrimitive('vec/toPath', keys => {
  if (keys.length === 0) throw refusingTheSubject(new VecToPathSubjectEmptyError({ actualValue: keys }));
  return makePath(keys.map((element, index) => {
    const key = beneathTags(element);
    if (!isKeyAlone(key)) throw refusingAPart(new VecToPathElementKindNotTakenError({ expected: kindsExpected(...KINDS_OF_A_KEY_ALONE), actualValue: element }), index);
    return keyNameOf(key);
  }));
});
registerPrimitive('path/toPath', path => path);

registerPrimitive('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw refusingTheSubject(new StringToPathNotPointerError({ actualValue: text }));
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
