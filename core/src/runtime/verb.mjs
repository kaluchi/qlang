// The verb [D67]: a tag over a quote, `::verb~(:x ::number | add x)`,
// whose leading declarations of a role or with a literal body are its
// signature, read from the quote's tree before anything runs [D53]; the
// first declaration whose body computes begins the body [D70]. A
// declaration whose body is a tag
// name is a slot a call must fill; one whose body is a set of kinds takes
// a value of any of them and may be left out when `::null` is among
// them; one whose body is any other literal takes that literal when it
// is left out and a value of the literal's kind otherwise; `* :name
// kind` gathers the modifiers that remain. `:subject` and `:returns` are
// the roles: the kind the verb serves, and the kind it answers, `/` for
// its subject's own; a verb declared under a noun, `:vec/count`, resides
// on it and serves that kind [D72]. A call fills the slots in order from its
// modifiers, each evaluated at the call against the subject [D43] and
// checked by its kind, and runs the rest of the quote, the body, in the
// scope of the verb with the slots bound; a `::builtin{}` in it is a step
// [D73], [D167]. A verb without a body is a contract, which answers no
// call and declares once the parts its kinds share [D167].

import { bindPrim, readsState, readsPassedTags } from '../primitives.mjs';
import { evalAst, mintTaggedInstance } from '../eval.mjs';
import { addressesOf, bareNameReach, isMemberValue, nodeOf, partsOfName, residencesOf } from './nouns.mjs';
import { envSet, nestState, withEnv, withPipeValue } from '../state.mjs';
import { astOfQuote, printQuoteSource, quoteOfBody, quoteOfSource, slotDocsOf, stepOfNode } from '../quote.mjs';
import { declaredNameOf, isPureLiteralAst, repeatsDeclarationInScope } from '../walk.mjs';
import { classifyEffect } from '../effect.mjs';
import { findFirstEffectfulIdentifier } from '../effect-check.mjs';
import {
  BindNameDeclaredTwiceError, CallEffectMarkMissingError, declareArityError, declareShapeError
} from '../errors.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import {
  bindingValueOf, isBuiltinDescriptor, isDoc, isQuote, isVec, isQMap, isSpec, isVerb, isErrorValue, isTaggedInstance, isValueClass, keyword, makeTagKeyword,
  makeBinding,
  makeQuote, makeSet, makeTaggedInstance, makeVerb, quoteInEnv, residenceOfVerb, addressOfVerb, hostImplOf, isHostDeclared, typeKeyword,
  verbEnvRef,
  BIND_TAG, BUILTIN_TAG, SPEC_TAG
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

const VerbPayloadNotQuoteError = declareSubjectError('verb/PayloadNotQuoteError', '::verb', 'quote');
const VerbSlotWithoutBodyError = declareShapeError('verb/SlotWithoutBodyError',
  ({ slot }) => `::verb declares a slot by a kind or a literal, and ${slot.literal} has neither`,
  { operand: '::verb' });
const VerbRoleNotKindError = declareShapeError('verb/RoleNotKindError',
  ({ role }) => `::verb role ${role.literal} is declared by a kind or a set of kinds, and :returns by / as well`,
  { operand: '::verb' });
const VerbSlotMissingError = declareArityError('verb/SlotMissingError',
  ({ verbName, slot }) => `${verbName.literal} takes ${slot.literal}, and the call leaves it empty`,
  { operand: '::verb' });
const VerbModifiersBeyondSlotsError = declareArityError('verb/ModifiersBeyondSlotsError',
  ({ verbName, slotCount, actualCount }) => `${verbName.literal} has ${slotCount} slots, and the call gives ${actualCount} modifiers`,
  { operand: '::verb' });
const VerbSlotNotOfKindsError = declareShapeError('verb/SlotNotOfKindsError',
  ({ slot, actualType }) => `${slot.literal} takes a value of one of its kinds, got ${actualType.name}`,
  { operand: '::verb' });
const VerbCodeNotQuoteError = declareShapeError('verb/CodeNotQuoteError',
  ({ slot, actualType }) => `${slot.literal} takes code, a quote \`~(…)\` or a verb, got ${actualType.name}`,
  { operand: '::verb', expectedType: 'quote' });
// A call no kind of whose subject answers its word names what the reader
// needs: where the word lives [D146], [D169]; a verb without a body
// answers no call at all.
export const CallKindAnswersNoVerbError = declareShapeError('call/KindAnswersNoVerbError',
  ({ verbName, addresses, actualType }) => (addresses?.length > 0 && actualType !== undefined
    ? `${actualType.literal} has no verb ${verbName.name}; the verbs of the name live on ${[...addresses].map(address => address.literal).join(' ')}`
    : `${verbName.literal} declares a signature and no body, and answers no call`),
  { operand: '::verb' });

const ROLE_NAMES = new Set(['subject', 'returns']);
const RETURNS_SUBJECT = Symbol('returnsSubject');
const CODE_KIND_NAMES = new Set(['quote', 'verb']);

// ── the signature ──────────────────────────────────────────────

// slotMemberOf(verb, slotName) → the record of the slot the verb's head
// declares under the name, the member an axis reads [D88], or null: the
// docs of its declaration, the declaration itself as its source, and as
// its value the kind it names, the kinds of a set, or the default it
// writes.
export function slotMemberOf(verb, slotName) {
  const signature = signatureOf(verb.payload);
  const slot = [...signature.slots, ...(signature.rest === null ? [] : [signature.rest])]
    .find(candidate => candidate.name === slotName);
  if (slot === undefined) return null;
  return makeBinding({ name: keyword(slot.name), docs: slot.docs, value: slotValueOf(slot), source: slot.source });
}

function slotValueOf(slot) {
  if (slot.kindNames === null) return stepOfNode(slot.defaultNode);
  return slot.kindNames.length === 1 ? makeTagKeyword(slot.kindNames[0]) : makeSet(slot.kindNames.map(makeTagKeyword));
}

// A quote is read once, and every verb over it shares the reading.
const SIGNATURE_OF_QUOTE = new WeakMap();

function signatureOf(quote) {
  let signature = SIGNATURE_OF_QUOTE.get(quote);
  if (signature === undefined) {
    signature = readSignature(quote);
    SIGNATURE_OF_QUOTE.set(quote, signature);
  }
  return signature;
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

// A declaration of a value the body derives, `:self /` or `:limit (k |
// mul 2)`, stands outside the head.
const derivesInBody = declaration => declaration.key.type === 'Keyword'
  && !ROLE_NAMES.has(declaration.key.name)
  && declaration.body !== null
  && !isPureLiteralAst(declaration.body);

// The leading declarations up to the first that derives a value, a
// declaration after `*` the last of them.
function headLengthOf(units) {
  let headLength = 0;
  while (headLength < units.length) {
    const { combinator, step } = units[headLength];
    if (step.type !== 'BindStep' || (combinator !== '|' && combinator !== '*')) break;
    if (derivesInBody(step)) break;
    headLength++;
    if (combinator === '*') break;
  }
  return headLength;
}

function bodyOf(bodyUnits, quote) {
  if (bodyUnits.length === 0) return null;
  const [first, ...rest] = bodyUnits;
  if (rest.length === 0 && first.combinator === '|') return first.step;
  const { location, text } = astOfQuote(quote);
  return { type: 'Pipeline', steps: [first.step, ...rest], leadingCombinator: first.combinator, location, text };
}

// The kinds a tag name or a set of tag names declares, in the one
// order, or null for any other body.
function kindsNamedBy(body) {
  if (body?.type === 'BareTypeKeyword') return [body.tag];
  if (body?.type !== 'SetLit' || body.elements.length === 0) return null;
  if (!body.elements.every(element => element.type === 'BareTypeKeyword')) return null;
  return body.elements.map(element => element.tag).sort();
}

function kindsOfRole(declaration) {
  const { key, body } = declaration;
  if (key.name === 'returns' && body?.type === 'Projection' && body.keys.length === 0) return RETURNS_SUBJECT;
  const kinds = kindsNamedBy(body);
  if (kinds === null) throw new VerbRoleNotKindError({ role: keyword(key.name) });
  return kinds;
}

function slotOf(declaration) {
  const slot = { name: declaration.key.name, docs: slotDocsOf(declaration), source: quoteOfBody(declaration) };
  const kinds = kindsNamedBy(declaration.body);
  if (kinds !== null) return { ...slot, kindNames: kinds, optional: kinds.includes('null'), defaultNode: null };
  return { ...slot, kindNames: null, optional: true, defaultNode: declaration.body };
}

function readSignature(quote) {
  const units = unitsOf(quote);
  const headLength = headLengthOf(units);
  const signature = { headLength, subjectKinds: null, returns: null, slots: [], rest: null };
  for (const { combinator, step: declaration } of units.slice(0, headLength)) {
    if (repeatsDeclarationInScope(declaration)) throw new BindNameDeclaredTwiceError({ name: declaredNameOf(declaration) });
    const name = declaration.key.name;
    if (ROLE_NAMES.has(name)) {
      if (name === 'subject') signature.subjectKinds = kindsOfRole(declaration);
      else signature.returns = kindsOfRole(declaration);
      continue;
    }
    if (declaration.body === null) throw new VerbSlotWithoutBodyError({ slot: keyword(name) });
    if (combinator === '*') signature.rest = slotOf(declaration);
    else signature.slots.push(slotOf(declaration));
  }
  signature.body = bodyOf(units.slice(headLength), quote);
  signature.builtin = isBuiltinStep(signature.body);
  signature.effectfulName = signature.body === null ? null : findFirstEffectfulIdentifier(signature.body);
  return signature;
}

// Whether a body is one `::builtin{}` step, which a host's declaration
// runs as the implementation the host handed for it [D72], [D73], [D157].
function isBuiltinStep(body) {
  return body?.type === 'TaggedLit' && body.tag === BUILTIN_TAG.name && body.payload.type === 'MapLit';
}

// endsInBuiltin(value) → whether a kind ends in a `::builtin{}` step, or
// a name under a label is one, which runs an implementation of the
// host's [D164]; in a verb it is a step [D73].
export function endsInBuiltin(value) {
  if (isBuiltinDescriptor(value)) return true;
  return isSpec(value) && signatureOf(value.payload).builtin;
}

// `::verb~(…)` — the verb over a quote, whose head is read here, so a
// head the constructor refuses is refused where the verb is made. The
// scope of the verb is the one it is made in.
function verbConstructor(payload, state) {
  if (!isQuote(payload)) throw new VerbPayloadNotQuoteError(payload);
  signatureOf(payload);
  return makeVerb(payload, { env: state.env });
}

bindPrim('verb', verbConstructor);

// constructorOfSpec(spec) → what a kind's declaration constructs with
// [D152]: `{ primitive }` for a body that is one `::builtin{}` step of a
// kind a host's source declared, the implementation it handed [D73],
// [D157], `{ body }` for a body of steps, and `{}` for a kind without a
// body, which is identity. Its leading declarations are its fields.
export function constructorOfSpec(spec) {
  const signature = signatureOf(spec.payload);
  if (signature.builtin && isHostDeclared(spec)) return { primitive: hostImplOf(spec) };
  return signature.body === null ? {} : { body: signature.body };
}

// The name a verb's body calls that carries the effect marker, or null.
export function effectfulNameOfVerb(verb) {
  return signatureOf(verb.payload).effectfulName;
}

// ── kinds ──────────────────────────────────────────────────────

// A vector, a set and a quote are read as vectors, a tagged map as a
// map, and a verb is taken where code is [D67]; a number is a finite
// double [D169].
function isOfKind(value, kindName) {
  switch (kindName) {
    case 'any':   return true;
    case 'number': return Number.isFinite(value);
    case 'vec':   return isVec(value);
    case 'map':   return isQMap(value);
    case 'quote': return isQuote(value) || isVerb(value);
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

// What a declaration of kinds takes from a value: the value of one of
// its kinds beneath the tags the walk passed, or, for a modifier's slot
// of one kind, the value its constructor reads, which is the check of the
// kind [D60], [D68]; a subject and code are taken only as they are
// [D156]. `place` names the slot or the role, `{ slot }`, and for a value of
// the rest its index from 1, `{ slot, index }` [D77].
async function servedByKinds(value, kindNames, state, place) {
  const walked = walkToKinds(value, kindNames);
  if (walked !== null) return walked;
  const refusalFacts = { ...place, actualType: typeKeyword(value), actualValue: value };
  if (kindNames.length === 1 && CODE_KIND_NAMES.has(kindNames[0])) throw new VerbCodeNotQuoteError(refusalFacts);
  if (kindNames.length > 1 || place.slot.name === 'subject') {
    throw new VerbSlotNotOfKindsError({ ...refusalFacts, kinds: makeSet(kindNames.map(makeTagKeyword)) });
  }
  return { served: await mintUnderTag(state, makeTagKeyword(kindNames[0]), value), passedTags: [] };
}

// The value under the tags from the innermost out, their constructors
// run again [D41]; an error passes as it is, as it does under every tag
// [D86].
async function underTags(value, tags, state) {
  let wrapped = value;
  for (const tag of [...tags].reverse()) wrapped = await mintUnderTag(state, tag, wrapped);
  return wrapped;
}

// ── the call ───────────────────────────────────────────────────

async function kindNamesOfSlot(slot, scopeState) {
  if (slot.kindNames !== null) return { kindNames: slot.kindNames, defaultValue: null };
  const defaultValue = (await evalAst(slot.defaultNode, scopeState)).pipeValue;
  return { kindNames: [typeKeyword(defaultValue).name], defaultValue };
}

function slotRecord(slot, value) {
  return makeBinding({ name: keyword(slot.name), docs: slot.docs, value, source: slot.source });
}

// A slot of code alone takes no value the call computed, the error of
// a step that ran on the subject by mistake among them, so its refusal
// names the quote it wanted.
function takesCodeAlone(kindNames) {
  return kindNames.every(kindName => CODE_KIND_NAMES.has(kindName));
}

// A slot of code takes a verb as the quote that runs it with its
// defaults [D67], the slot's name mentioned where that name is the
// verb, so the slot holds code whatever the call handed it and `apply`
// runs it.
function asCodeOfSlot(slot, kindNames, value, scopeEnv) {
  if (!isVerb(value) || !kindNames.includes('quote')) return value;
  return quoteInEnv(quoteOfSource(slot.name), envSet(scopeEnv, slot.name, slotRecord(slot, value)));
}

// The scope of the body: the verb's own with each slot bound to the
// record of its value, or the error a modifier or a constructor
// answered. The kinds of the head are read in the verb's scope.
async function bodyScopeOf(signature, slotLambdas, state, scopeEnv, verbName) {
  const { slots, rest } = signature;
  const scopeState = withPipeValue(withEnv(state, scopeEnv), null);
  const takeModifier = async (slot, kindNames, modifierLambda, place) => {
    const modifier = await modifierLambda(state.pipeValue);
    if (isErrorValue(modifier) && !takesCodeAlone(kindNames)) return modifier;
    const { served } = await servedByKinds(modifier, kindNames, scopeState, place);
    return asCodeOfSlot(slot, kindNames, served, scopeEnv);
  };
  let bodyEnv = scopeEnv;
  for (const [index, slot] of slots.entries()) {
    const { kindNames, defaultValue } = await kindNamesOfSlot(slot, scopeState);
    let value;
    if (index < slotLambdas.length) value = await takeModifier(slot, kindNames, slotLambdas[index], { slot: keyword(slot.name) });
    else if (slot.optional) value = defaultValue;
    else throw new VerbSlotMissingError({ verbName, slot: keyword(slot.name) });
    if (isErrorValue(value)) return { failed: value };
    bodyEnv = envSet(bodyEnv, slot.name, slotRecord(slot, value));
  }
  if (rest !== null) {
    const { kindNames } = await kindNamesOfSlot(rest, scopeState);
    const gathered = [];
    for (const [restIndex, modifierLambda] of slotLambdas.slice(slots.length).entries()) {
      const value = await takeModifier(rest, kindNames, modifierLambda, { slot: keyword(rest.name), index: restIndex + 1 });
      if (isErrorValue(value)) return { failed: value };
      gathered.push(value);
    }
    bodyEnv = envSet(bodyEnv, rest.name, slotRecord(rest, Object.freeze(gathered)));
  }
  return { bodyEnv };
}

// The answer under the kind the verb returns: as it is without
// `:returns`, of the declared kind with the passed tags left behind, or
// of the subject's own kind, minted by its constructor, a quote's among
// them, under the tags the walk passed, which the scope of the call
// reads, where the subject came from.
async function answerOfKind(answer, returns, served, passedTags, scopeState, state) {
  if (returns === null || isErrorValue(answer)) return answer;
  if (returns !== RETURNS_SUBJECT) return (await servedByKinds(answer, returns, scopeState, { slot: keyword('returns') })).served;
  return await keptAsSubject(answer, served, passedTags, state);
}

// The answer of the subject's own kind, minted by its constructor, a
// set's, a tag's or a quote's among them, under the tags the walk passed
// [D41], [D166].
export async function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = typeKeyword(served).name;
  const kept = walkToKinds(answer, [ownKind])?.served ?? await mintUnderTag(state, makeTagKeyword(ownKind), answer);
  return await underTags(kept, passedTags, state);
}

// The kinds a verb serves when its head names none: the noun it resides
// on, or any value.
function residenceKindsOf(verb) {
  const residence = residenceOfVerb(verb);
  return residence === null ? null : [residence];
}

// Whether a verb's head names its subject, `:subject kind`.
export function namesItsSubject(verb) {
  return signatureOf(verb.payload).subjectKinds !== null;
}

export function isContract(verb) {
  return signatureOf(verb.payload).body === null;
}

// callVerb(verb, modifierLambdas, state, verbName) → the verb's answer
// against the subject of `state`, the value in the pipe always [D165];
// `verbName` is the keyword the call reached it by, the name of the slot
// for a verb run as code [D67].
export async function callVerb(verb, modifierLambdas, state, verbName) {
  return await callVerbOn(verb, state.pipeValue, modifierLambdas, state, verbName);
}

// callVerbOn(verb, subject, slotLambdas, state, verbName) → the verb's
// answer against `subject`, its slots filled from `slotLambdas`, each
// evaluated against the value in the pipe of `state` [D43].
export async function callVerbOn(verb, subject, slotLambdas, state, verbName) {
  const signature = signatureOf(verb.payload);
  if (signature.body === null) {
    throw new CallKindAnswersNoVerbError({ verbName, addresses: addressesOf(state.env, verbName.name), actualType: typeKeyword(subject) });
  }
  if (signature.rest === null && slotLambdas.length > signature.slots.length) {
    throw new VerbModifiersBeyondSlotsError({ verbName, slotCount: signature.slots.length, actualCount: slotLambdas.length });
  }
  const scopeEnv = verbEnvRef(verb).env;
  const scopeState = withEnv(state, scopeEnv);
  const subjectKinds = signature.subjectKinds ?? residenceKindsOf(verb);
  const { served, passedTags } = subjectKinds === null
    ? { served: subject, passedTags: [] }
    : await servedByKinds(subject, subjectKinds, scopeState, { slot: keyword('subject') });
  const { bodyEnv, failed } = await bodyScopeOf(signature, slotLambdas, state, scopeEnv, verbName);
  if (failed !== undefined) return failed;
  const answer = (await evalAst(signature.body, nestState(state, served, bodyEnv))).pipeValue;
  return await answerOfKind(answer, signature.returns, served, passedTags, scopeState, state);
}

// A primitive runs over the value the walk served and the values of the
// parts of the call's object, a reader of the scope over the state of
// the call after them [D79], and a reader of the tags its subject stood
// beneath over the tags the walk passed [D86].
export function runPrimitive(primitive, served, passedTags, slotArguments, state) {
  if (readsState(primitive)) return primitive(served, ...slotArguments, state);
  if (readsPassedTags(primitive)) return primitive(served, ...slotArguments, passedTags);
  return primitive(served, ...slotArguments);
}

// A name without the effect marker refuses a verb whose body calls one.
function refuseLaunderedVerb(verb, lookupName) {
  const effectfulName = effectfulNameOfVerb(verb);
  if (effectfulName !== null && !classifyEffect(lookupName)) {
    throw new CallEffectMarkMissingError({ bindingName: lookupName, effectfulName });
  }
}

// A name bound to a verb runs it when mentioned [D44].
export async function applyVerb(verb, modifierLambdas, state, lookupName) {
  refuseLaunderedVerb(verb, lookupName);
  return withPipeValue(state, await callVerb(verb, modifierLambdas, state, keyword(lookupName)));
}

// A name whose verb was found from a subject the call already read runs
// it against that subject.
export async function applyVerbOn(verb, subject, slotLambdas, state, lookupName) {
  refuseLaunderedVerb(verb, lookupName);
  return withPipeValue(state, await callVerbOn(verb, subject, slotLambdas, state, keyword(lookupName)));
}

// ── the signature as a value ───────────────────────────────────

const declarationStep = (name, body) => makeTaggedInstance(BIND_TAG, new Map([['name', keyword(name)], ['body', body]]));

// slotLabelsOf(verb) → the slots of a verb as its head writes them,
// `:addend ::number` and `* :xs ::any` for the rest, which the tooling
// shows for a call's modifiers.
export function slotLabelsOf(verb) {
  const { slots, rest } = signatureOf(verb.payload);
  const labels = slots.map(slot => printQuoteSource(slot.source));
  return rest === null ? labels : [...labels, `* ${printQuoteSource(rest.source)}`];
}

// verbShownFor(env, name) → the verb a tool shows for a name: the one
// the name reaches with no subject, a contract giving way to the first
// verb it answers for; undefined for a name that reaches no verb.
export function verbShownFor(env, name) {
  const reached = bindingValueOf(bareNameReach(env, name)?.record ?? residencesOf(env, name)[0]?.[1]);
  if (!isVerb(reached)) return undefined;
  const first = bindingValueOf(residencesOf(env, name)[0]?.[1]);
  return isContract(reached) && isVerb(first) ? first : reached;
}

// shownFor(env, name) → what a tool shows for a name, `{ address, labels }`:
// the address the name reaches with no subject, or the first word of a
// name several kinds answer, and the labels of what a call of it takes,
// the slots of a verb's head or the parts of the object of a name under a
// label [D164], [D169]; undefined for a name that reaches neither.
export function shownFor(env, name) {
  const record = bareNameReach(env, name)?.record ?? residencesOf(env, name)[0]?.[1];
  const value = bindingValueOf(record);
  if (isVerb(value)) return { address: makeTagKeyword(addressOfVerb(value)), labels: slotLabelsOf(value) };
  if (!isMemberValue(value)) return undefined;
  const address = record.get('name').name;
  const labels = partsOfName(env, address).map(([partName]) => partName);
  return { address: makeTagKeyword(address), labels };
}

// The signature `spec` answers for a verb: its head as a `::spec~(…)`,
// its subject filled, the noun it resides on or any value [D72], [D152].
export function signatureSpecOf(verb) {
  const signature = signatureOf(verb.payload);
  const headSteps = verb.payload.slice(0, signature.headLength);
  const subjectSteps = signature.subjectKinds === null
    ? [declarationStep('subject', makeTagKeyword(residenceOfVerb(verb) ?? 'any'))]
    : [];
  return makeTaggedInstance(SPEC_TAG, makeQuote([...subjectSteps, ...headSteps]));
}
