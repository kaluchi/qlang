// [QSDSP#walk], [QSHST#door]

import { readsState, readsPassedTags, PRIMITIVE_REGISTRY } from './primitives.mjs';
import { queryStateOf } from './state.mjs';
import { splitAddress, ANY_KIND_NAME, TAGGED_KIND_NAME } from './address.mjs';
import { QlangError, QlangDefect } from './errors.mjs';
import { printPath } from './print-value.mjs';
import { kindsOfWalk } from './nouns.mjs';
import { functionOfRecipe, chainOfFn } from './chain.mjs';
import {
  isVec, isMap, isTagged, isValueClass, isKeyword, isTag, isRegex, isPath, isErrorValue, isFn,
  makeTag, makePath, tagOf, accountOfForeign, bindingValueOf, TAG_HEADER_SYMBOL
} from './types.mjs';

// [QSLIT#number]
function isOfKind(value, kindName) {
  switch (kindName) {
    case ANY_KIND_NAME: return true;
    case 'number': return Number.isFinite(value);
    case 'vec':   return isVec(value);
    case 'map':   return isMap(value);
    case TAGGED_KIND_NAME: return isTagged(value);
    default:      return tagOf(value).name === kindName;
  }
}

// [QSDSP#walk]
export function walkToKinds(value, kindNames) {
  const passedTags = [];
  let served = value;
  while (!kindNames.some(kindName => isOfKind(served, kindName))) {
    if (!isValueClass(served, 'underTag')) return null;
    passedTags.push(served.tag);
    served = served.payload;
  }
  return { served, passedTags };
}

// [QSDSP#tagname]
export function subjectOfCall(chain, labelName, subject) {
  const onKinds = chain.subject?.kinds ?? null;
  if (labelName === null) return onKinds === null ? { served: subject, passedTags: [] } : walkToKinds(subject, onKinds);
  const byLabel = walkToKinds(subject, [labelName]);
  if (byLabel !== null) return { ...byLabel, byLabel: true };
  const byKinds = onKinds === null ? null : walkToKinds(subject, onKinds);
  return byKinds !== null && isTag(byKinds.served) && ![...kindsOfWalk(byKinds.served)].includes(labelName) ? null : byKinds;
}

// [QSNAM#reach], [QSLSP#server]
export function servesTheSubject(record, subject) {
  const value = bindingValueOf(record);
  const fn = isFn(value) ? value : functionOfRecipe(value);
  return subjectOfCall(chainOfFn(fn), splitAddress(record.get('name').name)[0], subject) !== null;
}

export const isThenable = value => typeof value?.then === 'function';

// [QSDSP#residence], [QSNAM#owner], [QSERR#raise], [QSHST#source]
export function runPrimitive(primitive, served, passedTags, inputValues, state, address) {
  const read = readsPassedTags(primitive) ? [...inputValues, passedTags] : inputValues;
  const run = () => (readsState(primitive) ? primitive(served, ...read, queryStateOf(state)) : primitive(served, ...read));
  return heldAtTheDoor(primitive, run, address, [served, ...inputValues]);
}

// [QSHST#door]
export function heldAtTheDoor(primitive, run, address, handed) {
  if (PRIMITIVE_REGISTRY.holds(primitive)) return run();
  let answer;
  try {
    answer = run();
  } catch (thrown) {
    throw refusalHeld(thrown, address, handed);
  }
  if (!isThenable(answer)) return lawfulAnswer(answer, address, handed);
  return Promise.resolve(answer).then(settled => lawfulAnswer(settled, address, handed), thrown => { throw refusalHeld(thrown, address, handed); });
}

function lawfulAnswer(answer, address, handed) {
  const foreign = foreignPartOf(answer, new Set(handed));
  if (foreign !== null) throw failureOfTheDoor(address, foreign);
  return answer;
}

function refusalHeld(thrown, address, handed) {
  if (!(thrown instanceof QlangError) || thrown instanceof QlangDefect) return thrown;
  const foreign = foreignPartOf(new Map(Object.entries(thrown.facts).filter(([, fact]) => fact !== undefined)), new Set(handed));
  return foreign === null ? thrown : failureOfTheDoor(address, foreign);
}

function failureOfTheDoor(address, { path, account }) {
  const where = path.length === 0 ? 'is' : `holds at ${printPath(makePath(path))}`;
  return new Error(`the answer of ${makeTag(address).literal} ${where} ${account}, a value of no kind of the language`);
}

const NOTHING_HANDED = new Set();

export function foreignPartOf(value, handed = NOTHING_HANDED) {
  const opened = new Set();
  const scanned = new Set();
  const scans = [];
  let part = value;
  for (;;) {
    const read = readAtTheDoor(part, handed, opened, scanned);
    if (typeof read === 'string') return { path: scans.map(({ segment }) => segment), account: read };
    if (read !== null) {
      opened.add(read);
      scans.push({ container: read, parts: (isVec(read) ? Array.prototype.entries : Map.prototype.entries).call(read), segment: null });
    }
    let next;
    while (scans.length > 0 && (next = scans[scans.length - 1].parts.next()).done) scanned.add(scans.pop().container);
    if (scans.length === 0) return null;
    const top = scans[scans.length - 1];
    [top.segment, part] = next.value;
    if (isVec(top.container) && !(top.segment in top.container)) return { path: scans.map(({ segment }) => segment), account: 'a hole of a vector' };
  }
}

function readAtTheDoor(value, handed, opened, scanned) {
  let part = value;
  for (;;) {
    if (handed.has(part)) return null;
    if (part === null || part === undefined || typeof part === 'boolean' || typeof part === 'string' || Number.isFinite(part)) return null;
    if (typeof part !== 'object') return accountOfForeign(part);
    if (scanned.has(part) || isKeyword(part) || isTag(part) || isRegex(part) || isPath(part)) return null;
    if (!isErrorValue(part) && !isValueClass(part, 'underTag')) return containerAtTheDoor(part, opened);
    if (!isTag(part.tag)) return `${isErrorValue(part) ? 'an error' : 'a value'} whose tag ${accountOfForeign(part.tag)} is no tag`;
    if (isErrorValue(part) && !isMap(part.facts)) return `an error whose facts ${accountOfForeign(part.facts)} are no map`;
    part = isErrorValue(part) ? part.facts : part.payload;
  }
}

function containerAtTheDoor(part, opened) {
  if (!isVec(part) && !isMap(part)) return accountOfForeign(part);
  const kind = isVec(part) ? 'a vector' : 'a map';
  if (opened.has(part)) return `${kind} that holds itself`;
  const tag = part[TAG_HEADER_SYMBOL];
  if (tag !== undefined && !isTag(tag)) return `${kind} whose tag ${accountOfForeign(tag)} is no tag`;
  if (isMap(part)) for (const key of Map.prototype.keys.call(part)) if (typeof key !== 'string') return `a map whose key ${accountOfForeign(key)} is no string`;
  return part;
}
