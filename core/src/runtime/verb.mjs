// What a call reads of the kinds [D34]: the walk of a value's tags to a
// kind a name serves, the value put under a tag through its constructor
// [D152], the answer kept as its subject's kind under the tags the walk
// passed [D41], and the primitive a host handed run over the value the
// walk served [D73]. A kind's `::spec~(…)` is read here as well: its
// leading declarations of a kind are its fields, and the steps after
// them its constructor, a `::builtin{}` among them a step [D167].

import { readsState, readsPassedTags } from '../primitives.mjs';
import { mintTaggedInstance } from '../eval.mjs';
import { bareNameReach, isMemberValue, nodeOf, partsOfName, residencesOf } from './nouns.mjs';
import { astOfQuote } from '../quote.mjs';
import { declareShapeError } from '../errors.mjs';
import {
  bindingValueOf, isBuiltinDescriptor, isDoc, isVec, isQMap, isSpec, isErrorValue, isTaggedInstance, isValueClass,
  makeTagKeyword, makeTaggedInstance, hostImplOf, isHostDeclared, typeKeyword,
  BUILTIN_TAG
} from '../types.mjs';

// Whether a tag's node is a kind whose declaration has a body, the
// constructor that re-establishes the tag's invariant on a payload.
function tagCarriesConstructor(state, tagName) {
  const declared = bindingValueOf(nodeOf(state.env, tagName));
  if (isDoc(declared)) return true;
  return isSpec(declared) && Object.keys(constructorOfSpec(declared)).length > 0;
}

// The value under a tag: through the tag's constructor when it carries
// one, as a bare overlay when the tag names an identity alone; the verbs
// that keep a kind and `tag` share it. A tag laid over an error answers
// the error, since no tag stands over one [D86].
export async function mintUnderTag(state, tag, value) {
  if (isErrorValue(value)) return value;
  if (!tagCarriesConstructor(state, tag.name)) return makeTaggedInstance(tag, value);
  return await mintTaggedInstance(tag.name, value, state);
}

// A call no kind of whose subject answers its word names what the reader
// needs: where the word lives [D146], [D169].
export const CallKindAnswersNoVerbError = declareShapeError('call/KindAnswersNoVerbError',
  ({ verbName, addresses, actualType }) =>
    `${actualType.literal} has no verb ${verbName.name}; the verbs of the name live on ${[...addresses].map(address => address.literal).join(' ')}`,
  { operand: '::call' });

// ── the declaration of a kind ──────────────────────────────────

// A quote is read once, and every kind over it shares the reading.
const READING_OF_QUOTE = new WeakMap();

function readingOf(quote) {
  let reading = READING_OF_QUOTE.get(quote);
  if (reading === undefined) {
    reading = readSpec(quote);
    READING_OF_QUOTE.set(quote, reading);
  }
  return reading;
}

// The steps of a quote's tree with the combinator each rides, resolved
// as `evalPipeline` resolves it, so they stand one to one with the
// quote's own steps; a quote without a step has none.
function unitsOf(quote) {
  if (quote.length === 0) return [];
  const ast = astOfQuote(quote);
  if (ast.type !== 'Pipeline') return [{ combinator: '|', step: ast }];
  return [{ combinator: ast.leadingCombinator ?? '|', step: ast.steps[0] }, ...ast.steps.slice(1)];
}

// The fields of a kind, its leading declarations of a kind or a set of
// kinds, `:w ::number`, up to the first step that computes.
const FIELD_BODY_TYPES = new Set(['BareTypeKeyword', 'SetLit']);
const isField = step => step.type === 'BindStep' && FIELD_BODY_TYPES.has(step.body?.type);

function fieldCountOf(units) {
  const count = units.findIndex(({ step }) => !isField(step));
  return count < 0 ? units.length : count;
}

function bodyOf(bodyUnits, quote) {
  if (bodyUnits.length === 0) return null;
  const [first, ...rest] = bodyUnits;
  if (rest.length === 0 && first.combinator === '|') return first.step;
  const { location, text } = astOfQuote(quote);
  return { type: 'Pipeline', steps: [first.step, ...rest], leadingCombinator: first.combinator, location, text };
}

function readSpec(quote) {
  const units = unitsOf(quote);
  const body = bodyOf(units.slice(fieldCountOf(units)), quote);
  return { body, builtin: isBuiltinStep(body) };
}

// Whether a body is one `::builtin{}` step, which a host's declaration
// runs as the implementation the host handed for it [D73], [D157].
function isBuiltinStep(body) {
  return body?.type === 'TaggedLit' && body.tag === BUILTIN_TAG.name && body.payload.type === 'MapLit';
}

// endsInBuiltin(value) → whether a kind ends in a `::builtin{}` step, or
// a name under a label is one, which runs an implementation of the
// host's [D164].
export function endsInBuiltin(value) {
  if (isBuiltinDescriptor(value)) return true;
  return isSpec(value) && readingOf(value.payload).builtin;
}

// constructorOfSpec(spec) → what a kind's declaration constructs with
// [D152]: `{ primitive }` for a body that is one `::builtin{}` step of a
// kind a host's source declared, the implementation it handed [D73],
// [D157], `{ body }` for a body of steps, and `{}` for a kind without a
// body, which is identity.
export function constructorOfSpec(spec) {
  const { body, builtin } = readingOf(spec.payload);
  if (builtin && isHostDeclared(spec)) return { primitive: hostImplOf(spec) };
  return body === null ? {} : { body };
}

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
