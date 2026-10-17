// What a call reads of the kinds: the walk of a value's tags to a kind a name
// serves, the value put under a tag through its label [QSBLD#kind], the answer
// kept as its subject's kind under the tags the walk passed [QSDSP#answer], and
// the primitive a host handed run over the value the walk served [QSDSP#walk].

import { readsState, readsPassedTags } from '../primitives.mjs';
import { queryStateOf } from '../state.mjs';
import { layTag } from '../eval.mjs';
import { ANY_KIND_NAME, TAGGED_KIND_NAME, bareNameReach, isVerbValue, nodeOf, residencesOf, verbsReaching } from './nouns.mjs';
import { chainOfFn } from './chain.mjs';
import { declareRefusal } from '../errors.mjs';
import {
  bindingValueOf, isFn, isVec, isMap, isTagged, isValueClass,
  makeTag, typeOf
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

// A primitive runs over the value the walk served and the values of the inputs
// of the call, a reader of the tags its subject stood beneath over the tags
// the walk passed after them, and a reader of the scope over the state of the
// call after those, its scope the tree of the query, wherever it is called
// [QSDSP#residence], [QSNAM#owner], [D359].
export function runPrimitive(primitive, served, passedTags, inputValues, state) {
  const read = readsPassedTags(primitive) ? [...inputValues, passedTags] : inputValues;
  return readsState(primitive) ? primitive(served, ...read, queryStateOf(state)) : primitive(served, ...read);
}

// shownFor(env, name, kindNames?) → what a tool shows for a name, `{ address,
// inputs }`: the verb a subject of the kinds reaches, or, where the tool
// knows no kinds or they reach none, the address the name reaches with no
// subject, or the first verb of a name several kinds answer, and the names
// of the inputs its function takes [QSHST#tools]; undefined for a name that reaches
// no name under a label.
export function shownFor(env, name, kindNames = null) {
  const reached = kindNames === null ? undefined : verbsReaching(env, kindNames).get(name);
  const record = reached === undefined
    ? bareNameReach(env, name)?.record ?? residencesOf(env, name)[0]?.[1]
    : nodeOf(env, reached.address.name);
  const value = bindingValueOf(record);
  if (!isVerbValue(value)) return undefined;
  const inputs = isFn(value) ? chainOfFn(value).inputs.map(({ name: input }) => input.name) : [];
  return { address: makeTag(record.get('name').name), inputs };
}
