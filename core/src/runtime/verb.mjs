// What a call reads of the kinds: the walk of a value's tags to a kind a
// name serves, the value put under a tag through its label
// [D252], the answer kept as its subject's kind under the tags the walk
// passed [D41], and the primitive a host handed run over the value the
// walk served [D34].

import { readsState, readsPassedTags } from '../primitives.mjs';
import { queryStateOf } from '../state.mjs';
import { mintTaggedInstance } from '../eval.mjs';
import { ANY_KIND_NAME, TAGGED_KIND_NAME, bareNameReach, isMemberValue, nodeOf, residencesOf, verbsReaching } from './nouns.mjs';
import { signatureOf } from './signature.mjs';
import { declareRefusal } from '../errors.mjs';
import {
  bindingValueOf, isFn, isVec, isQMap, isTaggedInstance, isValueClass,
  makeTag, typeKeyword
} from '../types.mjs';

// The value under a tag as its literal puts it there, for the verbs that
// keep a kind and for `tag` [D164].
export async function mintUnderTag(state, tag, value) {
  return await mintTaggedInstance(tag.name, value, state);
}

// A call no kind of whose subject answers its word names what the reader
// needs: where the word lives [D146], [D168].
export const CallKindAnswersNoVerbError = declareRefusal('call/KindAnswersNoVerbError');

// ── kinds ──────────────────────────────────────────────────────

// A vector, a set and a quote are read as vectors and a tagged map as a
// map; a number is a finite double [D168].
function isOfKind(value, kindName) {
  switch (kindName) {
    case ANY_KIND_NAME: return true;
    case 'number': return Number.isFinite(value);
    case 'vec':   return isVec(value);
    case 'map':   return isQMap(value);
    case TAGGED_KIND_NAME: return isTaggedInstance(value);
    default:      return typeKeyword(value).name === kindName;
  }
}

// The value of one of the kinds a walk of the value's tags reaches from
// the outside in, and the tags it passed [D34], or null.
export function walkToKinds(value, kindNames) {
  const passedTags = [];
  let served = value;
  while (!kindNames.some(kindName => isOfKind(served, kindName))) {
    if (!isValueClass(served, 'taggedInstance')) return null;
    passedTags.push(served.tag);
    served = served.payload;
  }
  return { served, passedTags };
}

// The value under the tags from the innermost out, their constructors
// run again [D41]; an error passes as it is, as it does under every tag
// [D13].
async function underTags(value, tags, state) {
  let wrapped = value;
  for (const tag of [...tags].reverse()) wrapped = await mintUnderTag(state, tag, wrapped);
  return wrapped;
}

// The answer of the subject's own kind, minted by its constructor, a
// set's, a tag's or a quote's among them, under the tags the walk passed
// [D41], [D168], and at once where it is of the kind and the walk passed
// no tag.
export function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = typeKeyword(served).name;
  const reached = walkToKinds(answer, [ownKind]);
  if (reached !== null && passedTags.length === 0) return reached.served;
  return keptUnderTags(answer, reached, ownKind, passedTags, state);
}

async function keptUnderTags(answer, reached, ownKind, passedTags, state) {
  const kept = reached?.served ?? await mintUnderTag(state, makeTag(ownKind), answer);
  return await underTags(kept, passedTags, state);
}

// A primitive runs over the value the walk served and the values of the
// inputs of the call, a reader of the scope over the state of the call
// after them, its scope the tree of the query, wherever it is
// called [D72], [QSNAM#owner], and a reader of the tags its subject stood
// beneath over the tags the walk passed [D13].
export function runPrimitive(primitive, served, passedTags, inputValues, state) {
  if (readsState(primitive)) return primitive(served, ...inputValues, queryStateOf(state));
  if (readsPassedTags(primitive)) return primitive(served, ...inputValues, passedTags);
  return primitive(served, ...inputValues);
}

// shownFor(env, name, kindNames?) → what a tool shows for a name,
// `{ address, inputs }`: the word a subject of the kinds reaches [D34], or,
// where the tool knows no kinds or they reach none, the address the name
// reaches with no subject, or the first word of a name several kinds
// answer, and the names of the inputs its function takes [D251];
// undefined for a name that reaches no name under a label.
export function shownFor(env, name, kindNames = null) {
  const reached = kindNames === null ? undefined : verbsReaching(env, kindNames).get(name);
  const record = reached === undefined
    ? bareNameReach(env, name)?.record ?? residencesOf(env, name)[0]?.[1]
    : nodeOf(env, reached.address.name);
  const value = bindingValueOf(record);
  if (!isMemberValue(value)) return undefined;
  const inputs = isFn(value) ? signatureOf(value).inputs.map(({ name: input }) => input.name) : [];
  return { address: makeTag(record.get('name').name), inputs };
}
