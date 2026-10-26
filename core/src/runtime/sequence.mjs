// [QSBLD#fn], [QSDSP#walk], [QSORD#order], [QSDSP#residence], [QSCOL#map], [QSTXT#string], [QSERR#site]

import { beneathTags, isNumber, isKeyword, isPath, isSet, isErrorValue, isVec, NULL, makePath, tagOf, TagsInCommon, pairRefused } from '../types.mjs';
import { compareValues, makeSet, kindsExpected } from '../ordering.mjs';
import { declareRefusal, refusingAPart } from '../errors.mjs';
import { registerPrimitive, registerStateReader, runsAsCode, foldsAsCode, asCombiner } from '../primitives.mjs';
import { underSharedTags } from '../eval.mjs';
import { atPath } from '../eval-trace.mjs';
import { keywordFiledFor, KINDS_A_KEY_FILES_UNDER } from './convert.mjs';
import { writtenAsText } from './string-primitives.mjs';
import { pathReads } from './path-primitives.mjs';

// [QSERR#trace]
const entriesOf = elements => [...elements.entries()];

const failedAt = (code, error, segment) => atPath(code, error, makePath([String(segment)]));

registerPrimitive('string/count', text => Array.from(text).length);
registerPrimitive('vec/count', sequence => sequence.length);
registerPrimitive('map/count', map => map.size);

registerPrimitive('vec/empty', sequence => sequence.length === 0);
registerPrimitive('map/empty', map => map.size === 0);

const firstOf = items => (items.length === 0 ? NULL : items[0]);
const lastOf = items => (items.length === 0 ? NULL : items[items.length - 1]);
registerPrimitive('vec/first', firstOf);
registerPrimitive('map/first', map => firstOf([...map.values()]));
registerPrimitive('vec/last', lastOf);
registerPrimitive('map/last', map => lastOf([...map.values()]));

// [QSCOL#sequence], [QSORD#set]
const VecZipElementKindNotTakenError = declareRefusal('vec/zip/ElementKindNotTakenError');
const SetZipElementKindNotTakenError = declareRefusal('set/zip/ElementKindNotTakenError');
function columnsOf(vectors, ElementKindNotTakenError) {
  const columns = vectors.map(beneathTags);
  columns.forEach((column, index) => {
    if (!Array.isArray(column)) throw refusingAPart(new ElementKindNotTakenError({ 'subject/expected': kindsExpected('vec') }), index);
  });
  const length = columns.length === 0 ? 0 : Math.min(...columns.map(column => column.length));
  return Array.from({ length }, (_, index) => columns.map(column => column[index]));
}
registerPrimitive('vec/zip', vectors => columnsOf(vectors, VecZipElementKindNotTakenError));
registerPrimitive('set/zip', vectors => columnsOf(vectors, SetZipElementKindNotTakenError));

// [QSNUM#arithmetic]
function numberBeneath(element) {
  const beneath = beneathTags(element);
  return isNumber(beneath) ? beneath : undefined;
}

// [QSCOL#sequence]
function eachNumber(elements, ElementKindNotTakenError, take) {
  const tally = new TagsInCommon();
  for (const [count, [at, element]] of elements.entries()) {
    const number = numberBeneath(element);
    if (number === undefined) throw refusingAPart(new ElementKindNotTakenError({ 'subject/expected': kindsExpected('number') }), at);
    const met = tally.meet(element);
    if (met !== null) throw refusingAPart(pairRefused(met, element), at);
    take(number, count);
  }
  return tally.tags;
}

function totalOf(elements, ElementKindNotTakenError, state) {
  let total = 0;
  const tags = eachNumber(elements, ElementKindNotTakenError, number => { total += number; });
  return underSharedTags(total, tags, state);
}

const VecSumElementKindNotTakenError = declareRefusal('vec/sum/ElementKindNotTakenError');
const MapSumElementKindNotTakenError = declareRefusal('map/sum/ElementKindNotTakenError');
registerStateReader('vec/sum', (vector, state) => totalOf(entriesOf(vector), VecSumElementKindNotTakenError, state));
registerStateReader('map/sum', (map, state) => totalOf(entriesOf(map), MapSumElementKindNotTakenError, state));

function meanOf(elements, ElementKindNotTakenError, state) {
  if (elements.length === 0) return NULL;
  let mean = 0;
  const tags = eachNumber(elements, ElementKindNotTakenError, (number, count) => {
    const gap = number - mean;
    mean += Number.isFinite(gap) ? gap / (count + 1) : number / (count + 1) - mean / (count + 1);
  });
  return underSharedTags(mean, tags, state);
}

const VecAvgElementKindNotTakenError = declareRefusal('vec/avg/ElementKindNotTakenError');
const MapAvgElementKindNotTakenError = declareRefusal('map/avg/ElementKindNotTakenError');
registerStateReader('vec/avg', (vector, state) => meanOf(entriesOf(vector), VecAvgElementKindNotTakenError, state));
registerStateReader('map/avg', (map, state) => meanOf(entriesOf(map), MapAvgElementKindNotTakenError, state));

// [QSERR#flow], [QSORD#sort]
function errorOfKey(rankKey) {
  if (isErrorValue(rankKey)) return rankKey;
  return isVec(rankKey) ? rankKey.find(isErrorValue) ?? null : null;
}

async function keyedEntries(entries, key) {
  const ranked = [];
  for (const entry of entries) {
    if (key === NULL) {
      ranked.push({ entry, sortKey: entry[1] });
      continue;
    }
    const sortKey = await key(entry[1]);
    const failed = errorOfKey(sortKey);
    if (failed !== null) return failedAt(key, failed, entry[0]);
    ranked.push({ entry, sortKey });
  }
  return ranked;
}

// [QSORD#sort]
async function extremeOf(entries, key, pick) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  if (ranked.length === 0) return NULL;
  let best = ranked[0];
  for (const candidate of ranked.slice(1)) {
    if (tagOf(ranked[0].sortKey).name !== tagOf(candidate.sortKey).name) throw refusingAPart(pairRefused(ranked[0].sortKey, candidate.sortKey), candidate.entry[0]);
    if (pick(compareValues(candidate.sortKey, best.sortKey))) best = candidate;
  }
  return best.entry[1];
}

const least = order => order < 0;
const greatest = order => order > 0;
registerPrimitive('vec/min', runsAsCode(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, least)));
registerPrimitive('map/min', runsAsCode(['key'], (map, key) => extremeOf([...map], key, least)));
registerPrimitive('vec/max', runsAsCode(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, greatest)));
registerPrimitive('map/max', runsAsCode(['key'], (map, key) => extremeOf([...map], key, greatest)));

// [QSERR#flow], [QSORD#sort]
async function sortedEntries(entries, key) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  ranked.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  return ranked.map(({ entry }) => entry);
}

registerPrimitive(['vec/sort', 'set/sort'], runsAsCode(['key'], async (sequence, key) => {
  const sorted = await sortedEntries([...sequence.entries()], key);
  return isErrorValue(sorted) ? sorted : sorted.map(([, element]) => element);
}));
registerPrimitive('map/sort', runsAsCode(['key'], async (map, key) => {
  const sorted = await sortedEntries([...map], key);
  return isErrorValue(sorted) ? sorted : new Map(sorted);
}));

// [QSCOL#image], [QSERR#trace]
async function answersOf(elements, code) {
  const answers = [];
  for (const [at, element] of elements) {
    const answer = await code(element);
    if (isErrorValue(answer)) return failedAt(code, answer, at);
    answers.push(answer);
  }
  return answers;
}

registerPrimitive('vec/map', runsAsCode(['code'], (sequence, code) => answersOf(entriesOf(sequence), code)));
registerPrimitive('map/map', runsAsCode(['code'], async (map, code) => {
  const answers = await answersOf(entriesOf(map), code);
  return isErrorValue(answers) ? answers : new Map([...map.keys()].map((key, index) => [key, answers[index]]));
}));

// [QSCND#boolean], [QSERR#trace]
async function verdictOf(predicate, at, element, ConditionKindNotTakenError) {
  const verdict = await predicate(element);
  if (isErrorValue(verdict)) return failedAt(predicate, verdict, at);
  const beneath = beneathTags(verdict);
  if (typeof beneath === 'boolean') return beneath;
  throw refusingAPart(new ConditionKindNotTakenError({ 'predicate/expected': kindsExpected('boolean'), 'predicate/answer': verdict }), at);
}

async function keptElements(sequence, predicate, ConditionKindNotTakenError) {
  const kept = [];
  for (const [at, element] of entriesOf(sequence)) {
    const verdict = await verdictOf(predicate, at, element, ConditionKindNotTakenError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.push(element);
  }
  return kept;
}

async function keptEntries(map, predicate, ConditionKindNotTakenError) {
  const kept = new Map();
  for (const [key, value] of map) {
    const verdict = await verdictOf(predicate, key, value, ConditionKindNotTakenError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.set(key, value);
  }
  return kept;
}

const VecFilterConditionKindNotTakenError = declareRefusal('vec/filter/ConditionKindNotTakenError');
const MapFilterConditionKindNotTakenError = declareRefusal('map/filter/ConditionKindNotTakenError');
registerPrimitive('vec/filter', runsAsCode(['predicate'], (vector, predicate) => keptElements(vector, predicate, VecFilterConditionKindNotTakenError)));
registerPrimitive('map/filter', runsAsCode(['predicate'], (map, predicate) => keptEntries(map, predicate, MapFilterConditionKindNotTakenError)));

async function firstVerdict(elements, predicate, decisive, ConditionKindNotTakenError) {
  for (const [at, element] of elements) {
    const verdict = await verdictOf(predicate, at, element, ConditionKindNotTakenError);
    if (isErrorValue(verdict) || verdict === decisive) return verdict;
  }
  return !decisive;
}

const VecEveryConditionKindNotTakenError = declareRefusal('vec/every/ConditionKindNotTakenError');
const MapEveryConditionKindNotTakenError = declareRefusal('map/every/ConditionKindNotTakenError');
registerPrimitive('vec/every', runsAsCode(['predicate'], (vector, predicate) => firstVerdict(entriesOf(vector), predicate, false, VecEveryConditionKindNotTakenError)));
registerPrimitive('map/every', runsAsCode(['predicate'], (map, predicate) => firstVerdict(entriesOf(map), predicate, false, MapEveryConditionKindNotTakenError)));

const VecAnyConditionKindNotTakenError = declareRefusal('vec/any/ConditionKindNotTakenError');
const MapAnyConditionKindNotTakenError = declareRefusal('map/any/ConditionKindNotTakenError');
registerPrimitive('vec/any', runsAsCode(['predicate'], (vector, predicate) => firstVerdict(entriesOf(vector), predicate, true, VecAnyConditionKindNotTakenError)));
registerPrimitive('map/any', runsAsCode(['predicate'], (map, predicate) => firstVerdict(entriesOf(map), predicate, true, MapAnyConditionKindNotTakenError)));

// [QSCOL#group]
async function keywordOf(key, element, index, KeyAnswerKindNotTakenError, KeyTakenError, filed) {
  const answer = key === NULL ? element : await key(element);
  if (isErrorValue(answer)) return failedAt(key, answer, index);
  const named = keywordFiledFor(beneathTags(answer));
  if (named === null) throw refusingAPart(new KeyAnswerKindNotTakenError({ 'key/expected': KINDS_A_KEY_FILES_UNDER, 'key/answer': answer }), index);
  const taken = filed.get(named.name);
  if (taken === undefined) filed.set(named.name, answer);
  else if (compareValues(taken, answer) !== 0) throw refusingAPart(new KeyTakenError({ 'key/answer': named, taken }), index);
  return named;
}

async function bucketsOf(sequence, key, KeyAnswerKindNotTakenError, KeyTakenError) {
  const buckets = new Map();
  const filed = new Map();
  for (const [index, element] of sequence.entries()) {
    const bucketKey = await keywordOf(key, element, index, KeyAnswerKindNotTakenError, KeyTakenError, filed);
    if (isErrorValue(bucketKey)) return bucketKey;
    if (!buckets.has(bucketKey.name)) buckets.set(bucketKey.name, []);
    buckets.get(bucketKey.name).push(element);
  }
  return buckets;
}

const VecGroupByKeyAnswerKindNotTakenError = declareRefusal('vec/groupBy/KeyAnswerKindNotTakenError');
const VecGroupByKeyTakenError = declareRefusal('vec/groupBy/KeyTakenError');
const SetGroupByKeyAnswerKindNotTakenError = declareRefusal('set/groupBy/KeyAnswerKindNotTakenError');
const SetGroupByKeyTakenError = declareRefusal('set/groupBy/KeyTakenError');
registerPrimitive('vec/groupBy', runsAsCode(['key'], (vector, key) => bucketsOf(vector, key, VecGroupByKeyAnswerKindNotTakenError, VecGroupByKeyTakenError)));
registerPrimitive('set/groupBy', runsAsCode(['key'], async (set, key) => {
  const buckets = await bucketsOf(set, key, SetGroupByKeyAnswerKindNotTakenError, SetGroupByKeyTakenError);
  return isErrorValue(buckets) ? buckets : new Map([...buckets].map(([name, elements]) => [name, makeSet(elements)]));
}));

async function indexOf(sequence, key, KeyAnswerKindNotTakenError, KeyTakenError) {
  const index = new Map();
  const filed = new Map();
  for (const [position, element] of sequence.entries()) {
    const indexKey = await keywordOf(key, element, position, KeyAnswerKindNotTakenError, KeyTakenError, filed);
    if (isErrorValue(indexKey)) return indexKey;
    index.set(indexKey.name, element);
  }
  return index;
}

const VecIndexByKeyAnswerKindNotTakenError = declareRefusal('vec/indexBy/KeyAnswerKindNotTakenError');
const VecIndexByKeyTakenError = declareRefusal('vec/indexBy/KeyTakenError');
registerPrimitive('vec/indexBy', runsAsCode(['key'], (vector, key) => indexOf(vector, key, VecIndexByKeyAnswerKindNotTakenError, VecIndexByKeyTakenError)));

// [QSERR#site]
registerPrimitive('string/take', (text, count) => Array.from(text).slice(0, Math.max(0, count)).join(''));
registerPrimitive('vec/take', (sequence, count) => sequence.slice(0, Math.max(0, count)));
registerPrimitive('map/take', (map, count) => new Map([...map].slice(0, Math.max(0, count))));
registerPrimitive('string/drop', (text, count) => Array.from(text).slice(Math.max(0, count)).join(''));
registerPrimitive('vec/drop', (sequence, count) => sequence.slice(Math.max(0, count)));
registerPrimitive('map/drop', (map, count) => new Map([...map].slice(Math.max(0, count))));

// [QSORD#order], [QSCOL#sequence]
function containsElement(vector, element) {
  if (!isSet(vector)) return vector.some(held => compareValues(held, element) === 0);
  let low = 0;
  let high = vector.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const byOrder = compareValues(vector[middle], element);
    if (byOrder === 0) return true;
    if (byOrder < 0) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

// [QSPTH#has]
registerPrimitive('vec/has', (vector, element) => (isPath(element) ? pathReads(vector, element) : containsElement(vector, element)));
registerPrimitive('vec/contains', containsElement);

registerPrimitive('vec/prepend', (vector, element) => [element, ...vector]);
registerPrimitive('vec/append', (vector, element) => [...vector, element]);

// [QSCOL#sequence]
registerPrimitive('vec/concat', asCombiner((vector, vectors) => [...vector, ...vectors.flat()]));

// [QSTXT#string], [QSCOL#sequence]
const VecJoinElementKindNotTakenError = declareRefusal('vec/join/ElementKindNotTakenError');

registerStateReader('vec/join', (subject, separator, state) => {
  const tally = new TagsInCommon();
  const texts = subject.map((element, at) => {
    const text = beneathTags(element);
    if (typeof text !== 'string' && !isKeyword(text)) throw refusingAPart(new VecJoinElementKindNotTakenError({ 'subject/expected': kindsExpected('keyword', 'string') }), at);
    const met = isKeyword(text) ? null : tally.meet(element);
    if (met !== null) throw refusingAPart(pairRefused(met, element), at);
    return writtenAsText(text);
  });
  const joined = texts.join(writtenAsText(separator));
  return underSharedTags(joined, tally.tags, state);
});

registerPrimitive(['vec/reverse', 'set/reverse'], sequence => [...sequence].reverse());
registerPrimitive('map/reverse', map => new Map([...map].reverse()));

// [QSCOL#sequence], [QSCOL#algebra]
registerPrimitive('vec/flat', sequence => sequence.flatMap(element => (isVec(beneathTags(element)) ? beneathTags(element) : [element])));

// [QSCOL#reduce]
async function foldOf(entries, seed, reducer) {
  let acc = seed;
  for (const [segment, element] of entries) {
    acc = await reducer(acc, element);
    if (isErrorValue(acc)) return failedAt(reducer, acc, segment);
  }
  return acc;
}

registerPrimitive('vec/reduce', foldsAsCode(['reducer'], (sequence, seed, reducer) => foldOf(sequence.entries(), seed, reducer)));
registerPrimitive('map/reduce', foldsAsCode(['reducer'], (map, seed, reducer) => foldOf(map, seed, reducer)));
