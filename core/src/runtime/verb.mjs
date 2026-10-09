// What a call reads of the kinds [D34]: the walk of a value's tags to a
// kind a name serves, the value put under a tag through its label
// [D168], the answer kept as its subject's kind under the tags the walk
// passed [D41], and the primitive a host handed run over the value the
// walk served [D73].

import { readsState, readsPassedTags } from '../primitives.mjs';
import { mintTaggedInstance } from '../eval.mjs';
import { bareNameReach, isMemberValue, nodeOf, partsOfName, residencesOf } from './nouns.mjs';
import { declareShapeError } from '../errors.mjs';
import {
  bindingValueOf, isDoc, isVec, isQMap, isErrorValue, isTaggedInstance, isValueClass,
  makeTagKeyword, makeTaggedInstance, typeKeyword
} from '../types.mjs';

// The value under a tag: through its label, the construct and the laws
// declared under it, when the tag names one, as a bare overlay when the
// tag names an identity alone; the verbs that keep a kind and `tag`
// share it. A tag laid over an error answers the error, since no tag
// stands over one [D86].
export async function mintUnderTag(state, tag, value) {
  if (isErrorValue(value)) return value;
  if (!isDoc(bindingValueOf(nodeOf(state.env, tag.name)))) return makeTaggedInstance(tag, value);
  return await mintTaggedInstance(tag.name, value, state);
}

// A call no kind of whose subject answers its word names what the reader
// needs: where the word lives [D146], [D169].
export const CallKindAnswersNoVerbError = declareShapeError('call/KindAnswersNoVerbError',
  ({ verbName, addresses, actualType }) =>
    `${actualType.literal} has no verb ${verbName.name}; the verbs of the name live on ${[...addresses].map(address => address.literal).join(' ')}`,
  { operand: '::call' });

// ── kinds ──────────────────────────────────────────────────────

// A vector, a set and a quote are read as vectors and a tagged map as a
// map; a number is a finite double [D169].
function isOfKind(value, kindName) {
  switch (kindName) {
    case 'any':   return true;
    case 'number': return Number.isFinite(value);
    case 'vec':   return isVec(value);
    case 'map':   return isQMap(value);
    case 'tagged': return isTaggedInstance(value);
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
// [D86].
async function underTags(value, tags, state) {
  let wrapped = value;
  for (const tag of [...tags].reverse()) wrapped = await mintUnderTag(state, tag, wrapped);
  return wrapped;
}

// The answer of the subject's own kind, minted by its constructor, a
// set's, a tag's or a quote's among them, under the tags the walk passed
// [D41], [D166].
export async function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = typeKeyword(served).name;
  const kept = walkToKinds(answer, [ownKind])?.served ?? await mintUnderTag(state, makeTagKeyword(ownKind), answer);
  return await underTags(kept, passedTags, state);
}

// A primitive runs over the value the walk served and the values of the
// parts of the call's object, a reader of the scope over the state of
// the call after them [D79], and a reader of the tags its subject stood
// beneath over the tags the walk passed [D86].
export function runPrimitive(primitive, served, passedTags, partValues, state) {
  if (readsState(primitive)) return primitive(served, ...partValues, state);
  if (readsPassedTags(primitive)) return primitive(served, ...partValues, passedTags);
  return primitive(served, ...partValues);
}

// shownFor(env, name) → what a tool shows for a name, `{ address, labels }`:
// the address the name reaches with no subject, or the first word of a
// name several kinds answer, and the parts of the object of a call of it
// [D164], [D169]; undefined for a name that reaches no name under a
// label.
export function shownFor(env, name) {
  const record = bareNameReach(env, name)?.record ?? residencesOf(env, name)[0]?.[1];
  if (!isMemberValue(bindingValueOf(record))) return undefined;
  const address = record.get('name').name;
  const labels = partsOfName(env, address).map(([partName]) => partName);
  return { address: makeTagKeyword(address), labels };
}
