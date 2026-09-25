// The verb [D67]: a tag over a quote, `::verb~(:x ::number | add x)`,
// whose leading declarations are its signature, read from the quote's
// tree before anything runs [D53]. A declaration whose body is a tag
// name is a slot a call must fill; one whose body is a set of kinds takes
// a value of any of them and may be left out when `::null` is among
// them; one whose body is any other literal takes that literal when it
// is left out and a value of the literal's kind otherwise; `* :name
// kind` gathers the modifiers that remain. `:subject` and `:returns` are
// the roles: the kind the verb serves, and the kind it answers, `/` for
// its subject's own. A call fills the slots in order from its
// modifiers, each evaluated at the call against the subject [D43] and
// checked by its kind, and runs the rest of the quote, the body, in the
// scope of the verb with the slots bound. A verb without a body is a
// contract, which answers no call.

import { bindTypeConstructor } from '../primitives.mjs';
import { evalAst } from '../eval.mjs';
import { mintUnderTag } from './dispatch.mjs';
import { addressesOf } from './nouns.mjs';
import { envSet, nestState, withEnv, withPipeValue } from '../state.mjs';
import { astOfQuote, quoteOfBody, quoteOfSource } from '../quote.mjs';
import { isPlainCommentStep, isPureLiteralAst } from '../walk.mjs';
import { canonicalTagName } from '../env-keys.mjs';
import { classifyEffect } from '../effect.mjs';
import { findFirstEffectfulIdentifier } from '../effect-check.mjs';
import { EffectLaunderingAtCallError, declareArityError, declareShapeError } from '../errors.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import {
  isQuote, isVec, isQMap, isVerb, isErrorValue, isValueClass, keyword, makeTagKeyword, makeBinding,
  makeQuote, makeSet, makeTaggedInstance, makeVerb, quoteInEnv, typeKeyword, verbEnvRef, BIND_TAG, SPEC_TAG
} from '../types.mjs';

const nameOfVerb = verbName => verbName?.literal ?? 'the verb';

const VerbPayloadNotQuoteError = declareSubjectError('VerbPayloadNotQuoteError', '::verb', 'quote');
const VerbSlotNameNotKeywordError = declareShapeError('VerbSlotNameNotKeywordError',
  ({ slot }) => `::verb names a slot by a keyword, and its head declares ${slot.literal}`,
  { operand: '::verb' });
const VerbSlotBodyNotLiteralError = declareShapeError('VerbSlotBodyNotLiteralError',
  ({ slot }) => `::verb reads its head before it runs, and the declaration of ${slot.literal} computes; a slot is declared by a kind or a literal`,
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

// The leading declarations, a declaration after `*` the last of them.
function headLengthOf(units) {
  let headLength = 0;
  while (headLength < units.length) {
    const { combinator, step } = units[headLength];
    if (step.type !== 'BindStep' || (combinator !== '|' && combinator !== '*')) break;
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
    const name = declaration.key.name;
    if (ROLE_NAMES.has(name)) {
      if (name === 'subject') signature.subjectKinds = kindsOfRole(declaration);
      else signature.returns = kindsOfRole(declaration);
      continue;
    }
    if (declaration.body === null || !isPureLiteralAst(declaration.body)) {
      throw new VerbSlotBodyNotLiteralError({ slot: keyword(name) });
    }
    if (combinator === '*') signature.rest = slotOf(declaration);
    else signature.slots.push(slotOf(declaration));
  }
  signature.body = bodyOf(units.slice(headLength), quote);
  signature.effectfulName = signature.body === null ? null : findFirstEffectfulIdentifier(signature.body);
  return signature;
}

// `::verb~(…)` — the verb over a quote, whose head is read here, so a
// head that computes is refused where the verb is made. The scope of
// the verb is the one it is made in.
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
// role.
async function servedByKinds(value, kindNames, state, place) {
  const walked = walkToKinds(value, kindNames);
  if (walked !== null) return walked;
  const refusalFacts = { slot: keyword(place), actualType: typeKeyword(value), actualValue: value };
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

// The scope of the body: the verb's own with each slot bound to the
// record of its value, or the error a modifier or a constructor
// answered. The kinds of the head are read in the verb's scope.
async function bodyScopeOf(signature, modifierLambdas, state, scopeEnv, verbName) {
  const { slots, rest } = signature;
  if (rest === null && modifierLambdas.length > slots.length) {
    throw new VerbModifiersBeyondSlotsError({ verbName, slotCount: slots.length, actualCount: modifierLambdas.length });
  }
  const scopeState = withPipeValue(withEnv(state, scopeEnv), null);
  const takeModifier = async (slot, kindNames, modifierLambda) => {
    const modifier = await modifierLambda(state.pipeValue);
    if (isErrorValue(modifier)) return modifier;
    const { served } = await servedByKinds(modifier, kindNames, scopeState, slot.name);
    return asCodeOfSlot(slot, kindNames, served, scopeEnv);
  };
  let bodyEnv = scopeEnv;
  for (const [index, slot] of slots.entries()) {
    const { kindNames, defaultValue } = await kindNamesOfSlot(slot, scopeState);
    let value;
    if (index < modifierLambdas.length) value = await takeModifier(slot, kindNames, modifierLambdas[index]);
    else if (slot.optional) value = defaultValue;
    else throw new VerbSlotMissingError({ verbName, slot: keyword(slot.name) });
    if (isErrorValue(value)) return { failed: value };
    bodyEnv = envSet(bodyEnv, slot.name, slotRecord(slot, value));
  }
  if (rest !== null) {
    const { kindNames } = await kindNamesOfSlot(rest, scopeState);
    const gathered = [];
    for (const modifierLambda of modifierLambdas.slice(slots.length)) {
      const value = await takeModifier(rest, kindNames, modifierLambda);
      if (isErrorValue(value)) return { failed: value };
      gathered.push(value);
    }
    bodyEnv = envSet(bodyEnv, rest.name, slotRecord(rest, Object.freeze(gathered)));
  }
  return { bodyEnv };
}

// The answer under the kind the verb returns: as it is without
// `:returns`, of the declared kind with the passed tags left behind, or
// of the subject's own kind under the tags the walk passed, which the
// scope of the call reads, where the subject came from.
async function answerOfKind(answer, returns, served, passedTags, scopeState, state) {
  if (returns === null || isErrorValue(answer)) return answer;
  if (returns !== RETURNS_SUBJECT) return (await servedByKinds(answer, returns, scopeState, 'returns')).served;
  const kept = (await servedByKinds(answer, [typeKeyword(served).name], state, 'returns')).served;
  return await underTags(kept, passedTags, state);
}

// callVerb(verb, modifierLambdas, state, verbName) → the verb's answer
// against the subject of `state`; `verbName` is the keyword the call
// reached it by, or null for a verb run as code.
export async function callVerb(verb, modifierLambdas, state, verbName) {
  const signature = signatureOf(verb.payload);
  if (signature.body === null) {
    throw new VerbWithoutBodyError({ verbName, addresses: addressesOf(state.env, verbName?.name) });
  }
  // A verb a codec assembled holds no scope and resolves where it runs.
  const scopeEnv = verbEnvRef(verb)?.env ?? state.env;
  const scopeState = withEnv(state, scopeEnv);
  const { served, passedTags } = signature.subjectKinds === null
    ? { served: state.pipeValue, passedTags: [] }
    : await servedByKinds(state.pipeValue, signature.subjectKinds, scopeState, 'subject');
  if (isErrorValue(served)) return served;
  const { bodyEnv, failed } = await bodyScopeOf(signature, modifierLambdas, state, scopeEnv, verbName);
  if (failed !== undefined) return failed;
  const answer = (await evalAst(signature.body, nestState(state, served, bodyEnv))).pipeValue;
  return await answerOfKind(answer, signature.returns, served, passedTags, scopeState, state);
}

// A name bound to a verb runs it when mentioned [D44]; a name without
// the effect marker refuses a verb whose body calls one.
export async function applyVerb(verb, modifierLambdas, state, lookupName) {
  const effectfulName = effectfulNameOfVerb(verb);
  if (effectfulName !== null && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCallError({ bindingName: lookupName, effectfulName });
  }
  return withPipeValue(state, await callVerb(verb, modifierLambdas, state, keyword(lookupName)));
}

// A code slot takes a verb as a quote and runs it with its defaults
// against each input [D67].
export function verbAsCode(verb, capturedState) {
  const verbLambda = async input => await callVerb(verb, [], nestState(capturedState, input, capturedState.env), null);
  verbLambda.verb = verb;
  verbLambda.capturedState = capturedState;
  return verbLambda;
}

// ── the signature as a value ───────────────────────────────────

const SUBJECT_OF_ANY_STEP = makeTaggedInstance(BIND_TAG, new Map([['name', keyword('subject')], ['body', makeTagKeyword('any')]]));

// The signature `spec` answers for a verb: its head as a `::spec~(…)`,
// its subject filled.
export function signatureSpecOf(verb) {
  const signature = signatureOf(verb.payload);
  const headSteps = verb.payload.slice(0, signature.headLength);
  const steps = signature.subjectKinds === null ? [SUBJECT_OF_ANY_STEP, ...headSteps] : headSteps;
  return makeTaggedInstance(SPEC_TAG, makeQuote(steps));
}
