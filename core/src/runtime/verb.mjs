// What a call reads of the kinds: the walk of a value's tags to a kind a name
// serves, the value put under a tag through its label [QSBLD#kind], the answer
// kept as its subject's kind under the tags the walk passed [QSDSP#answer], and
// the primitive a host handed run over the value the walk served [QSDSP#walk].

import { readsState, readsPassedTags, PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { queryStateOf } from '../state.mjs';
import { layTag } from '../eval.mjs';
import { ANY_KIND_NAME, TAGGED_KIND_NAME, bareNameReach, isVerbValue, nodeOf, residencesOf, verbsReaching } from './nouns.mjs';
import { chainOfFn } from './chain.mjs';
import { declareRefusal, QlangError, QlangInvariantError } from '../errors.mjs';
import { printPath } from './print-value.mjs';
import {
  bindingValueOf, isFn, isVec, isMap, isTagged, isValueClass, isKeyword, isTag, isRegex, isPath, isErrorValue,
  makeTag, makePath, typeOf, primitiveOf, accountOfForeign, TAG_HEADER_SYMBOL, BuiltinForeignValueError
} from '../types.mjs';

export { layTag };

// A call of a name no kind of whose subject answers names what the reader
// needs: where the verbs of the name live [QSDSP#refusal].
export const CallKindAnswersNoVerbError = declareRefusal('call/KindAnswersNoVerbError');

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

// The value under the tags from the innermost out, each laid again through
// its kind [QSDSP#answer]; an error passes as it is, as it does under every
// tag [QSERR#flow].
async function underTags(value, tags, state) {
  let wrapped = value;
  for (const tag of [...tags].reverse()) wrapped = await layTag(tag.name, wrapped, state);
  return wrapped;
}

// The answer of the subject's own kind, made by its constructor, a set's, a
// tag's or a quote's among them, under the tags the walk passed
// [QSDSP#answer], [QSSLF#catalog], and at once where it is of the kind and the
// walk passed no tag.
export function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = typeOf(served).name;
  const reached = walkToKinds(answer, [ownKind]);
  if (reached !== null && passedTags.length === 0) return reached.served;
  return keptUnderTags(answer, reached, ownKind, passedTags, state);
}

async function keptUnderTags(answer, reached, ownKind, passedTags, state) {
  const kept = reached?.served ?? await layTag(ownKind, answer, state);
  return await underTags(kept, passedTags, state);
}

// Whether an answer is waited on: anything with a `then`, so a host's
// promise of another realm and a thenable resolve as the core's own do.
export const isThenable = value => typeof value?.then === 'function';

// The primitive a descriptor holds runs over the value the walk served and the
// values of the inputs of the call, a reader of the tags its subject stood
// beneath over the tags the walk passed after them, and a reader of the scope
// over the state of the call after those, its scope the tree of the query,
// wherever it is called, held at the door under the address of its call
// [QSDSP#residence], [QSNAM#owner], [D359], [D361].
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
// address and the path where it stands, a value the call handed in as it is [D361].
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

// takenFromAHost(value) → a value a host hands where the core takes it, the
// subject of a cell or what a name of a scope holds, held by the walk of the
// door, a value of no kind raised as `::builtin/ForeignValueError`; a scope is
// taken name by name, its root and the keys of the runtime's own aside [D361].
export function takenFromAHost(value) {
  const foreign = foreignPartOf(value, NOTHING_HANDED);
  if (foreign !== null) throw new BuiltinForeignValueError({ actualValue: foreign.account });
  return value;
}

export function scopeTakenFromAHost(scope) {
  for (const [name, entry] of scope) if (typeof name === 'string') takenFromAHost(entry);
  return scope;
}

const NOTHING_HANDED = new Set();

// The first part of a value of no kind with the path where it stands, or null,
// by one walk of a stack of its own at any depth, a container met twice walked
// once, one met again within its own walk holding itself, and a hole of a
// vector no element.
function foreignPartOf(value, handed) {
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

// shownFor(scope, name, kindNames?) → what a tool shows for a name, `{ address,
// inputs }`: the verb a subject of the kinds reaches, or, where the tool
// knows no kinds or they reach none, the address the name reaches with no
// subject, or the first verb of a name several kinds answer, and the names
// of the inputs its function takes [QSHST#tools]; undefined for a name that reaches
// no name under a label.
export function shownFor(scope, name, kindNames = null) {
  const reached = kindNames === null ? undefined : verbsReaching(scope, kindNames).get(name);
  const record = reached === undefined
    ? bareNameReach(scope, name)?.record ?? residencesOf(scope, name)[0]?.[1]
    : nodeOf(scope, reached.address.name);
  const value = bindingValueOf(record);
  if (!isVerbValue(value)) return undefined;
  const inputs = isFn(value) ? chainOfFn(value).inputs.map(({ name: input }) => input.name) : [];
  return { address: makeTag(record.get('name').name), inputs };
}
