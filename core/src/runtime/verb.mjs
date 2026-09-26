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
// its subject's own; a verb declared in the module of a noun resides on
// it and serves that kind [D72]. A call fills the slots in order from its
// modifiers, each evaluated at the call against the subject [D43] and
// checked by its kind, and runs the rest of the quote, the body, in the
// scope of the verb with the slots bound, or, for a built-in, the
// primitive its `::builtin{:impl}` step names over the checked values. A
// verb without a body is a contract, which answers no call.

import { PRIMITIVE_REGISTRY, bindTypeConstructor } from '../primitives.mjs';
import { codeOf, evalAst } from '../eval.mjs';
import { mintUnderTag } from './dispatch.mjs';
import { addressesOf, residencesOf } from './nouns.mjs';
import { envSet, nestState, withEnv, withPipeValue } from '../state.mjs';
import { astOfQuote, printQuoteSource, quoteOfBody, quoteOfSource } from '../quote.mjs';
import { declaredNameOf, isPlainCommentStep, isPureLiteralAst, repeatsDeclarationInScope } from '../walk.mjs';
import { canonicalTagName, tagBindingKey } from '../env-keys.mjs';
import { classifyEffect } from '../effect.mjs';
import { findFirstEffectfulIdentifier } from '../effect-check.mjs';
import {
  BindNameDeclaredTwiceError, EffectLaunderingAtCallError, declareArityError, declareShapeError, isPlaceRefusal,
  placeRefusalOf, throwSiteTagsRaisedBy
} from '../errors.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import {
  bindingValueOf, isQuote, isVec, isQMap, isVerb, isErrorValue, isValueClass, keyword, makeTagKeyword, makeBinding,
  makeQuote, makeSet, makeTaggedInstance, makeVerb, quoteInEnv, residenceOfVerb, typeKeyword, verbEnvRef,
  BIND_TAG, BUILTIN_TAG, SPEC_TAG
} from '../types.mjs';

const nameOfVerb = verbName => verbName?.literal ?? 'the verb';

const VerbPayloadNotQuoteError = declareSubjectError('VerbPayloadNotQuoteError', '::verb', 'quote');
const VerbSlotNameNotKeywordError = declareShapeError('VerbSlotNameNotKeywordError',
  ({ slot }) => `::verb names a slot by a keyword, and its head declares ${slot.literal}`,
  { operand: '::verb' });
const VerbSlotWithoutBodyError = declareShapeError('VerbSlotWithoutBodyError',
  ({ slot }) => `::verb declares a slot by a kind or a literal, and ${slot.literal} has neither`,
  { operand: '::verb' });
const VerbRoleNotKindError = declareShapeError('VerbRoleNotKindError',
  ({ role }) => `::verb role ${role.literal} is declared by a kind or a set of kinds, and :returns by / as well`,
  { operand: '::verb' });
const VerbSlotMissingError = declareArityError('VerbSlotMissingError',
  ({ verbName, slot }) => `${nameOfVerb(verbName)} takes ${slot.literal}, and the call leaves it empty`,
  { operand: '::verb' });
const VerbModifiersBeyondSlotsError = declareArityError('VerbModifiersBeyondSlotsError',
  ({ verbName, slotCount, actualCount }) => `${nameOfVerb(verbName)} has ${slotCount} slots, and the call gives ${actualCount} modifiers`,
  { operand: '::verb' });
const VerbSlotNotOfKindsError = declareShapeError('VerbSlotNotOfKindsError',
  ({ slot, actualType }) => `${slot.literal} takes a value of one of its kinds, got ${actualType.name}`,
  { operand: '::verb' });
const VerbCodeNotQuoteError = declareShapeError('VerbCodeNotQuoteError',
  ({ slot, actualType }) => `${slot.literal} takes code, a quote \`~(…)\` or a verb, got ${actualType.name}`,
  { operand: '::verb', expectedType: 'quote' });
const VerbWithoutBodyError = declareShapeError('VerbWithoutBodyError',
  ({ verbName }) => `${nameOfVerb(verbName)} declares a signature and no body, and answers no call`,
  { operand: '::verb' });

const ROLE_NAMES = new Set(['subject', 'returns']);
// The positions a site's refusal declares for the subject; the k-th slot
// is at k + 1 [D72].
const SUBJECT_POSITIONS = ['subject', 1];
const slotPositions = index => [index + 2];
const RETURNS_SUBJECT = Symbol('returnsSubject');
const CODE_KIND_NAMES = new Set(['quote', 'verb']);

// ── the signature ──────────────────────────────────────────────

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
  const units = [];
  let leadingCombinator = ast.leadingCombinator;
  ast.steps.forEach((unit, index) => {
    const step = index === 0 ? unit : unit.step;
    if (isPlainCommentStep(step)) return;
    units.push({ combinator: leadingCombinator ?? (index === 0 ? null : unit.combinator) ?? '|', step });
    leadingCombinator = null;
  });
  return units;
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
  if (body?.type === 'BareTypeKeyword') return [canonicalTagName(body.tag)];
  if (body?.type !== 'SetLit' || body.elements.length === 0) return null;
  if (!body.elements.every(element => element.type === 'BareTypeKeyword')) return null;
  return body.elements.map(element => canonicalTagName(element.tag)).sort();
}

function kindsOfRole(declaration) {
  const { key, body } = declaration;
  if (key.name === 'returns' && body?.type === 'Projection' && body.keys.length === 0) return RETURNS_SUBJECT;
  const kinds = kindsNamedBy(body);
  if (kinds === null) throw new VerbRoleNotKindError({ role: keyword(key.name) });
  return kinds;
}

function slotOf(declaration) {
  const slot = { name: declaration.key.name, docs: declaration.docs ?? [], source: quoteOfBody(declaration) };
  const kinds = kindsNamedBy(declaration.body);
  if (kinds !== null) return { ...slot, kindNames: kinds, optional: kinds.includes('null'), defaultNode: null };
  return { ...slot, kindNames: null, optional: true, defaultNode: declaration.body };
}

function readSignature(quote) {
  const units = unitsOf(quote);
  const headLength = headLengthOf(units);
  const signature = { headLength, subjectKinds: null, returns: null, slots: [], rest: null };
  for (const { combinator, step: declaration } of units.slice(0, headLength)) {
    if (declaration.key.type !== 'Keyword') {
      throw new VerbSlotNameNotKeywordError({ slot: makeTagKeyword(declaration.key.tag) });
    }
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
  signature.primitiveKey = primitiveKeyOf(signature.body);
  signature.siteName = signature.primitiveKey === null
    ? null
    : signature.primitiveKey.slice(signature.primitiveKey.lastIndexOf('/') + 1);
  signature.effectfulName = signature.body === null ? null : findFirstEffectfulIdentifier(signature.body);
  return signature;
}

// The primitive a built-in's body calls, the handle its one
// `::builtin{:impl}` step names [D72], or null for a body of steps.
function primitiveKeyOf(body) {
  if (body?.type !== 'TaggedLit' || body.tag !== BUILTIN_TAG.name || body.payload.type !== 'MapLit') return null;
  const implEntry = body.payload.entries.find(entry => entry.key.name === 'impl' && entry.value.type === 'Keyword');
  return implEntry === undefined ? null : implEntry.value.name;
}

// `::verb~(…)` — the verb over a quote, whose head is read here, so a
// head the constructor refuses is refused where the verb is made. The
// scope of the verb is the one it is made in.
function verbConstructor(payload, state) {
  if (!isQuote(payload)) throw new VerbPayloadNotQuoteError(payload);
  signatureOf(payload);
  return makeVerb(payload, { env: state.env });
}

bindTypeConstructor('verb', verbConstructor);

// The name a verb's body calls that carries the effect marker, or null.
export function effectfulNameOfVerb(verb) {
  return signatureOf(verb.payload).effectfulName;
}

// ── kinds ──────────────────────────────────────────────────────

// A vector, a set and a quote are read as vectors, a tagged map as a
// map, and a verb is taken where code is [D67].
function isOfKind(value, kindName) {
  switch (kindName) {
    case 'any':   return true;
    case 'vec':   return isVec(value);
    case 'map':   return isQMap(value);
    case 'quote': return isQuote(value) || isVerb(value);
    default:      return typeKeyword(value).name === kindName;
  }
}

// The value of one of the kinds a walk of the value's tags reaches from
// the outside in, and the tags it passed [D34], or null.
function walkToKinds(value, kindNames) {
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
// its kinds beneath the tags the walk passed, or, for a declaration of
// one kind, the value its constructor reads, which is the check of the
// kind [D60]; code is taken only as it is. `place` names the slot or the
// role, `{ slot }`, and for a value of the rest its index from 1,
// `{ slot, index }` [D77]; `PlaceRefusal` is the refusal a built-in's
// site declares there, raised in place of the kind's [D72].
async function servedByKinds(value, kindNames, state, place, PlaceRefusal) {
  const walked = walkToKinds(value, kindNames);
  if (walked !== null) return walked;
  if (PlaceRefusal !== undefined) throw new PlaceRefusal(value);
  const refusalFacts = { ...place, actualType: typeKeyword(value), actualValue: value };
  if (kindNames.length > 1) {
    throw new VerbSlotNotOfKindsError({ ...refusalFacts, kinds: makeSet(kindNames.map(makeTagKeyword)) });
  }
  if (CODE_KIND_NAMES.has(kindNames[0])) throw new VerbCodeNotQuoteError(refusalFacts);
  return { served: await mintUnderTag(state, makeTagKeyword(kindNames[0]), value), passedTags: [] };
}

// The value under the tags from the innermost out, their constructors
// run again [D41]; an error passes as it is.
async function underTags(value, tags, state) {
  let wrapped = value;
  for (const tag of [...tags].reverse()) wrapped = isErrorValue(wrapped) ? wrapped : await mintUnderTag(state, tag, wrapped);
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

// A slot of code takes a verb as the quote that runs it with its
// defaults [D67], the slot's name mentioned where that name is the
// verb, so the slot holds code whatever the call handed it and `apply`
// runs it.
function asCodeOfSlot(slot, kindNames, value, scopeEnv) {
  if (!isVerb(value) || !kindNames.includes('quote')) return value;
  return quoteInEnv(quoteOfSource(slot.name), envSet(scopeEnv, slot.name, slotRecord(slot, value)));
}

// The refusal a built-in's site declares at one of `positions`: the one
// that names the address of the residence, `::map/at`, where the verbs
// of a name check a place differently, and otherwise the one that names
// the verb [D73]; undefined for a verb of steps.
function siteRefusalAt(signature, verb, positions) {
  const primitiveKey = primitiveKeyOfVerb(signature, verb);
  if (primitiveKey === null) return undefined;
  return placeRefusalOf(tagBindingKey(`${residenceOfVerb(verb)}/${signature.siteName}`), positions)
    ?? placeRefusalOf(signature.siteName, positions);
}

// The primitive a verb calls: a built-in's, the verb declared in the
// module of a noun [D72]; a `::builtin` step in any other verb is a step,
// so no head a user writes reaches a primitive past its declaration's
// [D73].
function primitiveKeyOfVerb(signature, verb) {
  return residenceOfVerb(verb) === null ? null : signature.primitiveKey;
}

// The scope of the body: the verb's own with each slot bound to the
// record of its value, and the values in the order of the slots, or the
// error a modifier or a constructor answered. The kinds of the head are
// read in the verb's scope.
async function bodyScopeOf(signature, verb, slotLambdas, state, scopeEnv, verbName) {
  const { slots, rest } = signature;
  const scopeState = withPipeValue(withEnv(state, scopeEnv), null);
  const takeModifier = async (slot, kindNames, modifierLambda, positions, place) => {
    const modifier = await modifierLambda(state.pipeValue);
    if (isErrorValue(modifier)) return modifier;
    const { served } = await servedByKinds(modifier, kindNames, scopeState, place, siteRefusalAt(signature, verb, positions));
    return asCodeOfSlot(slot, kindNames, served, scopeEnv);
  };
  let bodyEnv = scopeEnv;
  const slotValues = [];
  for (const [index, slot] of slots.entries()) {
    const { kindNames, defaultValue } = await kindNamesOfSlot(slot, scopeState);
    let value;
    if (index < slotLambdas.length) {
      value = await takeModifier(slot, kindNames, slotLambdas[index], slotPositions(index), { slot: keyword(slot.name) });
    }
    else if (slot.optional) value = defaultValue;
    else throw new VerbSlotMissingError({ verbName, slot: keyword(slot.name) });
    if (isErrorValue(value)) return { failed: value };
    slotValues.push(value);
    bodyEnv = envSet(bodyEnv, slot.name, slotRecord(slot, value));
  }
  if (rest !== null) {
    const { kindNames } = await kindNamesOfSlot(rest, scopeState);
    const gathered = [];
    for (const [restIndex, modifierLambda] of slotLambdas.slice(slots.length).entries()) {
      const value = await takeModifier(rest, kindNames, modifierLambda, [], { slot: keyword(rest.name), index: restIndex + 1 });
      if (isErrorValue(value)) return { failed: value };
      gathered.push(value);
    }
    slotValues.push(Object.freeze(gathered));
    bodyEnv = envSet(bodyEnv, rest.name, slotRecord(rest, Object.freeze(gathered)));
  }
  return { bodyEnv, slotValues };
}

// The answer under the kind the verb returns: as it is without
// `:returns`, of the declared kind with the passed tags left behind, or
// of the subject's own kind, minted by its constructor, a quote's among
// them, under the tags the walk passed, which the scope of the call
// reads, where the subject came from.
async function answerOfKind(answer, returns, served, passedTags, scopeState, state) {
  if (returns === null || isErrorValue(answer)) return answer;
  if (returns !== RETURNS_SUBJECT) return (await servedByKinds(answer, returns, scopeState, { slot: keyword('returns') })).served;
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

// A call with one modifier more than the verb's slots, none gathering the
// rest, reads its first modifier as the subject [D72].
export function takesFullApplication(verb, modifierCount) {
  const { slots, rest } = signatureOf(verb.payload);
  return rest === null && modifierCount === slots.length + 1;
}

export function isContract(verb) {
  return signatureOf(verb.payload).body === null;
}

// callVerb(verb, modifierLambdas, state, verbName) → the verb's answer
// against the subject of `state`, or against its first modifier, evaluated
// there, in a full application; `verbName` is the keyword the call reached
// it by, or null for a verb run as code.
export async function callVerb(verb, modifierLambdas, state, verbName) {
  if (!takesFullApplication(verb, modifierLambdas.length)) {
    return await callVerbOn(verb, state.pipeValue, modifierLambdas, state, verbName);
  }
  const subject = await modifierLambdas[0](state.pipeValue);
  if (isErrorValue(subject)) return subject;
  return await callVerbOn(verb, subject, modifierLambdas.slice(1), state, verbName);
}

// callVerbOn(verb, subject, slotLambdas, state, verbName) → the verb's
// answer against `subject`, its slots filled from `slotLambdas`, each
// evaluated against the value in the pipe of `state` [D43].
export async function callVerbOn(verb, subject, slotLambdas, state, verbName) {
  const signature = signatureOf(verb.payload);
  if (signature.body === null) {
    throw new VerbWithoutBodyError({ verbName, addresses: addressesOf(state.env, verbName?.name) });
  }
  if (signature.rest === null && slotLambdas.length > signature.slots.length) {
    throw new VerbModifiersBeyondSlotsError({ verbName, slotCount: signature.slots.length, actualCount: slotLambdas.length });
  }
  // A verb a codec assembled holds no scope and resolves where it runs.
  const scopeEnv = verbEnvRef(verb)?.env ?? state.env;
  const scopeState = withEnv(state, scopeEnv);
  const subjectKinds = signature.subjectKinds ?? residenceKindsOf(verb);
  const { served, passedTags } = subjectKinds === null
    ? { served: subject, passedTags: [] }
    : await servedByKinds(subject, subjectKinds, scopeState, { slot: keyword('subject') }, siteRefusalAt(signature, verb, SUBJECT_POSITIONS));
  if (isErrorValue(served)) return served;
  const { bodyEnv, slotValues, failed } = await bodyScopeOf(signature, verb, slotLambdas, state, scopeEnv, verbName);
  if (failed !== undefined) return failed;
  const primitiveKey = primitiveKeyOfVerb(signature, verb);
  const answer = primitiveKey === null
    ? (await evalAst(signature.body, nestState(state, served, bodyEnv))).pipeValue
    : await PRIMITIVE_REGISTRY.resolve(primitiveKey)(served, ...primitiveArgumentsOf(signature, slotValues, state));
  return await answerOfKind(answer, signature.returns, served, passedTags, scopeState, state);
}

// What a primitive takes for its slots: each value as the head checked
// it, a quote in a slot of code closed at the call into the code it runs
// [D4], [D73], and the rest as the vector of its values, closed alike
// [D77].
function primitiveArgumentsOf(signature, slotValues, state) {
  const takenBy = (slot, value) => (isQuote(value) && slot.kindNames?.includes('quote') ? codeOf(value, state) : value);
  const fixed = signature.slots.map((slot, index) => takenBy(slot, slotValues[index]));
  if (signature.rest === null) return fixed;
  return [...fixed, slotValues[signature.slots.length].map(value => takenBy(signature.rest, value))];
}

// A name without the effect marker refuses a verb whose body calls one.
function refuseLaunderedVerb(verb, lookupName) {
  const effectfulName = effectfulNameOfVerb(verb);
  if (effectfulName !== null && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCallError({ bindingName: lookupName, effectfulName });
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

// The refusals the check of a place raises where its site declares none,
// as the head raises them: a value of none of several kinds, code that is
// no quote, or the refusals of the one kind's constructor [D68], [D74].
function refusalsOfKinds(kindNames) {
  if (kindNames.length > 1) return [VerbSlotNotOfKindsError.name];
  if (CODE_KIND_NAMES.has(kindNames[0])) return [VerbCodeNotQuoteError.name];
  return throwSiteTagsRaisedBy(tagBindingKey(kindNames[0]));
}

// The refusals a built-in raises: at each place of its head, the subject,
// the slots in their order and the rest, the one its site declares there
// [D64], [D73], or those of the kinds the place checks [D72]; then the
// refusals of its site that guard no place [D74].
function refusalsOfBuiltin(signature, verb) {
  const places = [
    [SUBJECT_POSITIONS, signature.subjectKinds ?? residenceKindsOf(verb)],
    ...signature.slots.map((slot, index) => [slotPositions(index), slot.kindNames]),
    ...(signature.rest === null ? [] : [[[], signature.rest.kindNames]])
  ];
  const placeRefusals = places.flatMap(([positions, kindNames]) => {
    const SiteRefusal = siteRefusalAt(signature, verb, positions);
    return SiteRefusal === undefined ? refusalsOfKinds(kindNames) : [SiteRefusal.name];
  });
  const unplacedRefusals = [tagBindingKey(`${residenceOfVerb(verb)}/${signature.siteName}`), signature.siteName]
    .flatMap(throwSiteTagsRaisedBy)
    .filter(className => !isPlaceRefusal(className));
  return Object.freeze([...new Set([...placeRefusals, ...unplacedRefusals])].map(makeTagKeyword));
}

// refusalsOfVerb(verb) → the refusals a built-in lists, and none for a
// verb of steps, whose refusals are those its body meets.
export function refusalsOfVerb(verb) {
  const signature = signatureOf(verb.payload);
  return primitiveKeyOfVerb(signature, verb) === null ? Object.freeze([]) : refusalsOfBuiltin(signature, verb);
}

// slotLabelsOf(verb) → the slots of a verb as its head writes them,
// `:addend ::number` and `* :xs ::any` for the rest, which the tooling
// shows for a call's modifiers.
export function slotLabelsOf(verb) {
  const { slots, rest } = signatureOf(verb.payload);
  const labels = slots.map(slot => printQuoteSource(slot.source));
  return rest === null ? labels : [...labels, `* ${printQuoteSource(rest.source)}`];
}

// verbShownFor(env, name) → the verb a tool shows for a name: the one its
// binding holds, or for a contract the first verb it answers for.
export function verbShownFor(env, name) {
  const declared = bindingValueOf(env.get(name));
  if (!isContract(declared)) return declared;
  const [firstResidence] = residencesOf(env, name);
  return firstResidence === undefined ? declared : bindingValueOf(firstResidence[1]);
}

// The signature `spec` answers for a verb: its head as a `::spec~(…)`,
// its subject filled, the noun it resides on or any value, and a
// built-in's refusals as `:throws` [D72].
export function signatureSpecOf(verb) {
  const signature = signatureOf(verb.payload);
  const headSteps = verb.payload.slice(0, signature.headLength);
  const subjectSteps = signature.subjectKinds === null
    ? [declarationStep('subject', makeTagKeyword(residenceOfVerb(verb) ?? 'any'))]
    : [];
  const throwsSteps = primitiveKeyOfVerb(signature, verb) === null ? [] : [declarationStep('throws', refusalsOfBuiltin(signature, verb))];
  return makeTaggedInstance(SPEC_TAG, makeQuote([...subjectSteps, ...headSteps, ...throwsSteps]));
}
