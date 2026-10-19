// The walk of a value's tags to a kind a name serves [QSDSP#walk], and the
// primitive a host handed run over the value the walk served, what it answers
// held at the door by the walk that holds what a host hands a session [QSHST#source].

import { readsState, readsPassedTags, PRIMITIVE_REGISTRY } from './primitives.mjs';
import { queryStateOf } from './state.mjs';
import { splitAddress, ANY_KIND_NAME, TAGGED_KIND_NAME } from './address.mjs';
import { QlangError, QlangInvariantError } from './errors.mjs';
import { printPath } from './print-value.mjs';
import { kindsOfWalk } from './nouns.mjs';
import { functionOfRecipe, chainOfFn } from './chain.mjs';
import {
  isVec, isMap, isTagged, isValueClass, isKeyword, isTag, isRegex, isPath, isErrorValue, isFn,
  makeTag, makePath, typeOf, primitiveOf, accountOfForeign, bindingValueOf, TAG_HEADER_SYMBOL
} from './types.mjs';

// ── kinds ──────────────────────────────────────────────────────

// A vector, a set and a quote are read as vectors and a tagged map as a
// map; a number is a finite double [QSLIT#number].
function isOfKind(value, kindName) {
  switch (kindName) {
    case ANY_KIND_NAME: return true;
    case 'number': return Number.isFinite(value);
    case 'vec':   return isVec(value);
    case 'map':   return isMap(value);
    case TAGGED_KIND_NAME: return isTagged(value);
    default:      return typeOf(value).name === kindName;
  }
}

// The value of one of the kinds a walk of the value's tags reaches from
// the outside in, and the tags it passed [QSDSP#walk], or null.
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

// subjectOfCall(chain, labelName, subject) → the subject a function's call
// serves: for a verb, the value of its label the walk of the subject's tags
// reaches, or of a kind `on` names beside it, the noun's own tag name for a
// verb of the noun itself, since the walk of a tag name passes the noun it
// names and no other [QSDSP#tagname]; for a function `apply` runs, a value of
// the kinds `on` names, or the subject as it is; null where the walk reaches none.
export function subjectOfCall(chain, labelName, subject) {
  const onKinds = chain.subject?.kinds ?? null;
  if (labelName === null) return onKinds === null ? { served: subject, passedTags: [] } : walkToKinds(subject, onKinds);
  const byLabel = walkToKinds(subject, [labelName]);
  if (byLabel !== null) return { ...byLabel, byLabel: true };
  const byKinds = onKinds === null ? null : walkToKinds(subject, onKinds);
  return byKinds !== null && isTag(byKinds.served) && ![...kindsOfWalk(byKinds.served)].includes(labelName) ? null : byKinds;
}

// servesTheSubject(record, subject) → whether the verb a record holds serves
// the subject, as its call would [QSNAM#reach], [QSHST#tools].
export function servesTheSubject(record, subject) {
  const value = bindingValueOf(record);
  const fn = isFn(value) ? value : functionOfRecipe(value);
  return subjectOfCall(chainOfFn(fn), splitAddress(record.get('name').name)[0], subject) !== null;
}

// Whether an answer is waited on: anything with a `then`, so a host's
// promise of another realm and a thenable resolve as the core's own do.
export const isThenable = value => typeof value?.then === 'function';

// The primitive a descriptor holds runs over the value the walk served and the
// values of the inputs of the call, a reader of the tags its subject stood
// beneath over the tags the walk passed after them, and a reader of the scope
// over the state of the call after those, its scope the tree of the query,
// wherever it is called, held at the door under the address of its call
// [QSDSP#residence], [QSNAM#owner], [QSERR#raise], [QSHST#source].
export function runPrimitive(descriptor, served, passedTags, inputValues, state, address) {
  const primitive = primitiveOf(descriptor);
  const read = readsPassedTags(primitive) ? [...inputValues, passedTags] : inputValues;
  const run = () => (readsState(primitive) ? primitive(served, ...read, queryStateOf(state)) : primitive(served, ...read));
  return heldAtTheDoor(primitive, run, address, [served, ...inputValues]);
}

// heldAtTheDoor(primitive, run, address, handed) → what `run` answers, one of
// the core's table unheld, one a host handed beside its source held to the
// kinds of the language at any depth with the facts of a refusal it throws, a
// value of no kind failing the call as `::call/HostFailureError` naming the
// address and the path where it stands, a value the call handed in as it is [QSHST#source].
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

// A refusal whose facts hold a value of no kind fails as such an answer does,
// a fact left undefined none.
function refusalHeld(thrown, address, handed) {
  if (!(thrown instanceof QlangError) || thrown instanceof QlangInvariantError) return thrown;
  const foreign = foreignPartOf(new Map(Object.entries(thrown.facts).filter(([, fact]) => fact !== undefined)), new Set(handed));
  return foreign === null ? thrown : failureOfTheDoor(address, foreign);
}

function failureOfTheDoor(address, { path, account }) {
  const where = path.length === 0 ? 'is' : `holds at ${printPath(makePath(path))}`;
  return new Error(`the answer of ${makeTag(address).literal} ${where} ${account}, a value of no kind of the language`);
}

const NOTHING_HANDED = new Set();

// foreignPartOf(value, handed?) → the first part of a value of no kind with the
// path where it stands, or null, by one walk of a stack of its own at any depth,
// a part the call handed in passed over, a container met twice walked once, one
// met again within its own walk holding itself, and a hole of a vector no
// element [QSHST#source].
export function foreignPartOf(value, handed = NOTHING_HANDED) {
  const opened = new Set();
  const walked = new Set();
  const walks = [];
  let part = value;
  for (;;) {
    const read = readAtTheDoor(part, handed, opened, walked);
    if (typeof read === 'string') return { path: walks.map(({ segment }) => segment), account: read };
    if (read !== null) {
      opened.add(read);
      walks.push({ container: read, parts: (isVec(read) ? Array.prototype.entries : Map.prototype.entries).call(read), segment: null });
    }
    let next;
    while (walks.length > 0 && (next = walks[walks.length - 1].parts.next()).done) walked.add(walks.pop().container);
    if (walks.length === 0) return null;
    const top = walks[walks.length - 1];
    [top.segment, part] = next.value;
    if (isVec(top.container) && !(top.segment in top.container)) return { path: walks.map(({ segment }) => segment), account: 'a hole of a vector' };
  }
}

// What the door reads of a part: null for a value it need not walk, a value
// the call handed in and one JavaScript leaves undefined, which reads as null,
// among them, the account of a value of no kind, or the vector or the map to
// walk, a failure read through to the map of its facts and a value under a tag
// to its payload.
function readAtTheDoor(value, handed, opened, walked) {
  let part = value;
  for (;;) {
    if (handed.has(part)) return null;
    if (part === null || part === undefined || typeof part === 'boolean' || typeof part === 'string' || Number.isFinite(part)) return null;
    if (typeof part !== 'object') return accountOfForeign(part);
    if (walked.has(part) || isKeyword(part) || isTag(part) || isRegex(part) || isPath(part)) return null;
    if (!isErrorValue(part) && !isValueClass(part, 'underTag')) return containerAtTheDoor(part, opened);
    if (!isTag(part.tag)) return `${isErrorValue(part) ? 'an error' : 'a value'} whose tag ${accountOfForeign(part.tag)} is no tag`;
    if (isErrorValue(part) && !isMap(part.descriptor)) return `an error whose facts ${accountOfForeign(part.descriptor)} are no map`;
    part = isErrorValue(part) ? part.descriptor : part.payload;
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
