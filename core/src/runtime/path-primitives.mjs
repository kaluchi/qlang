// [QSPTH#get], [QSPTH#query], [QSPTH#template], [QSPTH#write], [QSPTH#verbs]

import { registerPrimitive, registerStateReader, runsAsCode, runsWithinAsCode } from '../primitives.mjs';
import { declareRefusal, refusingAPart, QlangError, QlangDefect } from '../errors.mjs';
import { kindsExpected, makeSet } from '../ordering.mjs';
import { readPath, MISSED, segmentIndex, keyNotInMap, indexIn, noPartsOn, tagClosed, partsOfTemplate, isKeyAlone, keyNameOf, KINDS_OF_A_KEY_ALONE } from '../path-read.mjs';
import { errorAtRestOf, readOne, readTemplate, relaid } from '../eval.mjs';
import { errorFromQlang } from '../error-convert.mjs';
import { atPath } from '../eval-trace.mjs';
import { isPath, makePath, isMap, isVec, isSet, isValueClass, isErrorValue, makeKeyword, beneathTags, wiringOf } from '../types.mjs';

const StringToPathTextNotPathError = declareRefusal('string/toPath/TextNotPathError');
const VecToPathElementKindNotTakenError = declareRefusal('vec/toPath/ElementKindNotTakenError');
const VecToPathSubjectEmptyError = declareRefusal('vec/toPath/SubjectEmptyError');

// [QSPTH#key]
const pathOf = pathOrKey => (isPath(pathOrKey) ? pathOrKey : makePath([keyNameOf(pathOrKey)]));

// [QSLIT#tag]
export function readByPath(subject, path, soft, fallback, state) {
  const key = beneathTags(path);
  return isPath(path) || isKeyAlone(key) ? readOne(subject, pathOf(key), soft, fallback) : readTemplate(subject, path, soft, fallback, state);
}

registerStateReader('any/get', runsWithinAsCode(['path'], (subject, path, state) => readByPath(subject, path, false, null, state)));
registerStateReader('any/query', runsWithinAsCode(['path'], (subject, path, fallback, state) => readByPath(subject, path, true, fallback, state)));

// [QSPTH#template], [QSERR#catch]
async function outcomeOf(subject, question, state) {
  let answer;
  try {
    answer = await readTemplate(subject, question, false, null, state);
  } catch (refusal) {
    if (!(refusal instanceof QlangError) || refusal instanceof QlangDefect) throw refusal;
    answer = errorFromQlang(refusal, state.scope);
  }
  if (!isErrorValue(answer)) return new Map([['ok', true], ['value', answer]]);
  return new Map([['ok', false], ['error', await errorAtRestOf(answer, state)]]);
}

const AnySettleQuestionsKindNotTakenError = declareRefusal('any/settle/QuestionsKindNotTakenError');

registerStateReader('any/settle', runsWithinAsCode(['questions'], async (subject, questions, state) => {
  const parts = partsOfTemplate(questions);
  if (parts === null) throw new AnySettleQuestionsKindNotTakenError({ 'questions/expected': kindsExpected('map', 'set', 'vec') });
  const outcomes = [];
  for (const question of parts) outcomes.push(await outcomeOf(subject, question, state));
  if (isMap(questions)) return new Map([...questions.keys()].map((key, at) => [key, outcomes[at]]));
  return isSet(questions) ? makeSet(outcomes) : Object.freeze(outcomes);
}));

// [QSPTH#write], [QSERR#trace]
async function written(value, path, at, write, state) {
  if (wiringOf(value) !== undefined) throw tagClosed(value, path, at);
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

registerStateReader('any/put', (subject, pathOrKey, value, state) =>
  written(subject, pathOf(pathOrKey), 0, { adds: true, removes: false, part: () => value }, state));
registerStateReader('any/update', runsAsCode(['code'], (subject, pathOrKey, code, state) => {
  const path = pathOf(pathOrKey);
  const part = async old => {
    const answer = await code(old);
    return isErrorValue(answer) ? atPath(code, answer, path) : answer;
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
  return Number.isNaN(index) || String(index) !== segment ? makeKeyword(segment) : index;
})));

// [QSPTH#key]
registerPrimitive('vec/at', (vector, index) => readPath(vector, makePath([String(index)])));
registerPrimitive('map/at', (map, key) => readPath(map, makePath([keyNameOf(key)])));

// [QSPTH#value], [QSPTH#key], [QSPTH#verbs]
registerPrimitive('vec/toPath', keys => {
  if (keys.length === 0) throw new VecToPathSubjectEmptyError({});
  return makePath(keys.map((element, index) => {
    const key = beneathTags(element);
    if (!isKeyAlone(key)) throw refusingAPart(new VecToPathElementKindNotTakenError({ 'subject/expected': kindsExpected(...KINDS_OF_A_KEY_ALONE) }), index);
    return keyNameOf(key);
  }));
});
registerPrimitive('path/toPath', path => path);

registerPrimitive('string/toPath', text => {
  const pointer = text.startsWith('#') ? text.slice(1) : text;
  if (!pointer.startsWith('/')) throw new StringToPathTextNotPathError({});
  return makePath(pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~')));
});
