// [QSQUO#step]

import { ROOT_KEY, QUERY_KEY, RECIPE_KEY, WITHHELD_KEY } from './scope-keys.mjs';
import {
  withPipeValue, withScope, withFlight, nestState, depthBelow, scopeSet, scopeHas, rootOf, markRootVerbScope, isRootVerbScope, queryTreeOf,
  withCall, originIn, ownScopeOf
} from './state.mjs';
import { declareRefusal, refusingTheSubject, QlangError, QlangDefect, CallUnknownNameError, CallUnknownAddressError, BindNameDeclaredTwiceError } from './errors.mjs';
import { nearestNames, nearestTagNames, nearestVerbs } from './nearest-names.mjs';
import { readPath, partsOfTemplate, isMissedPart } from './path-read.mjs';
import {
  isSet, isVec, isMap, isErrorValue, isQuote, isDoc, isPath, handedFor,
  tagOf, makeKeyword, makeErrorValue, makeDoc, makeQuote,
  makeBinding, bindingValueOf, makeTagged, makeTag, errorAtRest, beneathTags,
  isFn, isKind, recipeOf, constructorOf, stampTagHeader, TAG_HEADER_SYMBOL,
  ERROR_TAG, TRACE_TAG, isValueClass, tagsOver, TagsInCommon, pairRefused
} from './types.mjs';
import { makeSet, kindsExpected } from './ordering.mjs';
import { originOf, repeatsDeclarationAt } from './parsed-parts.mjs';
import {
  isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, errorFieldsOf,
  commandStep, groupStep
} from './steps.mjs';
import { errorFromQlang, errorFromForeign, factsInOrder } from './error-convert.mjs';
import {
  INVARIANT_TAG, LAW_TAG, addressesOf, bareNameReach, declaresALabel, isInvariant, isVerbValue, isUnderLabel, isVerb, nodeOf, refuseWithheld, residenceOnSubject, returnsItsLabel, CallValueWithheldError
} from './nouns.mjs';
import { ANSWER_NAME, PAYLOAD_NAME, SUBJECT_NAME, functionOfRecipe, invariantsOf, chainOfKind, pageOfKindsRefusal, chainOfFn } from './chain.mjs';
import { inputsAsCode, combinesItsInput } from './primitives.mjs';
import {
  splitAddress, argsBeyondInputsAddress, subjectKindsRefusalAddress, elementsRefusalAddress, kindsRefusalAddress,
  notGivenAddress, payloadRefusalName, subjectRefusalAddress, FN_CALL_ADDRESS
} from './address.mjs';
import { runPrimitive, heldAtTheDoor, isThenable, walkToKinds, subjectOfCall, servesTheSubject } from './dispatch.mjs';
import { answerOfStep, skipping, flightOfACall, flightOfThrow } from './eval-trace.mjs';

// [QSBLD#label]
const ConstructTagNamesAValueError = declareRefusal('construct/TagNamesAValueError');
const CallValueMeetsVerbError = declareRefusal('call/ValueMeetsVerbError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError = declareRefusal('call/ValueTakesNoModifiersError');
const FnRecipeMissingError = declareRefusal('fn/RecipeMissingError');
const BindWrittenOutsideItsChainError = declareRefusal('bind/WrittenOutsideItsChainError');

// [QSDSP#refusal]
const CallKindAnswersNoVerbError = declareRefusal('call/KindAnswersNoVerbError');

// [QSQUO#step]
export async function evalPipeline(steps, state, origin = originOf(steps)) {
  let current = state;
  for (const [index, step] of steps.entries()) {
    const at = { steps, index, origin };
    current = isFailStep(step) ? await applyFailTrack(current, step.payload[0], at) : await applySuccessTrack(current, step, at);
  }
  return current;
}

// [QSERR#trace]
async function evalStep(step, state, at) {
  try {
    return await evaluatorOf(step)(step, state, at);
  } catch (caughtError) {
    return withFlight(withPipeValue(state, errorOfThrow(caughtError, state.pipeValue, state.scope)), flightOfThrow(caughtError));
  }
}

function evaluatorOf(step) {
  if (isCallStep(step)) return evalCall;
  if (isBindStep(step)) return evalBind;
  if (isConstructStep(step)) return evalConstruct;
  if (isGroupStep(step)) return evalGroup;
  if (errorFieldsOf(step) !== null) return evalErrorLiteral;
  if (isDoc(step)) return evalDoc;
  if (isQuote(step)) return evalItself;
  if (isSet(step)) return evalSet;
  if (isVec(step)) return evalVec;
  return isMap(step) ? evalMap : evalItself;
}

function errorOfThrow(caughtError, subject, scope) {
  if (caughtError instanceof QlangDefect) throw caughtError;
  return caughtError instanceof QlangError ? errorFromQlang(caughtError, subject, scope) : errorFromForeign(caughtError, scope);
}

export async function factsWithTheirTrace(facts, state) {
  if (!facts.has('trace')) return facts;
  const trace = await layTag(TRACE_TAG.name, facts.get('trace'), state);
  const laid = new Map(facts);
  if (trace.length > 0) laid.set('trace', trace);
  else laid.delete('trace');
  return laid;
}

// [QSNAM#scope], [QSNAM#verb]
async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

// [QSERR#trace]
async function applySuccessTrack(state, step, at) {
  if (isErrorValue(state.pipeValue)) return withPipeValue(state, skipping(state.pipeValue, step, state.scope));
  const answered = await evalStep(step, state, at);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => makeQuote([step]), state.pipeValue, state.scope, answered.flight));
}

// [QSERR#catch], [QSERR#rest], [QSERR#trace]
async function applyFailTrack(state, step, at) {
  if (!isErrorValue(state.pipeValue)) return state;
  const raised = state.pipeValue;
  const errorOfKind = makeTagged(ERROR_TAG, new Map(raised.facts));
  let atRest;
  try {
    atRest = raised.tag.name === ERROR_TAG.name ? errorOfKind : await layTag(raised.tag.name, errorOfKind, state);
  } catch (caughtError) {
    atRest = errorOfThrow(caughtError, errorOfKind, state.scope);
  }
  if (isErrorValue(atRest)) return withPipeValue(state, answerOfStep(atRest, () => makeQuote([step]), errorOfKind, state.scope));
  const answered = await evalStep(step, withPipeValue(state, atRest), at);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => makeQuote([step]), atRest, state.scope, answered.flight));
}

// [QSNAM#scope]
async function evalGroup(group, state, at) {
  return await fork(state, inner => evalPipeline(group.payload, inner, at?.origin ?? originOf(group.payload)));
}

function evalItself(step, state) {
  return withPipeValue(state, step);
}

// [QSQUO#modifier], [QSLIT#closed], [QSERR#flow]
async function evalVec(vec, state) {
  return withPipeValue(state, await elementValues(vec, state));
}

async function evalMap(map, state) {
  return withPipeValue(state, await entryValues(map, state));
}

async function evalSet(set, state) {
  const elements = await elementValues(set, state);
  return withPipeValue(state, isErrorValue(elements) ? elements : makeSet(elements));
}

async function elementValues(elements, state) {
  const values = [];
  for (const element of elements) {
    const answered = (await evalStep(element, state)).pipeValue;
    if (isErrorValue(answered)) return answered;
    values.push(answered);
  }
  return values;
}

async function entryValues(map, state) {
  const values = await elementValues([...map.values()], state);
  return isErrorValue(values) ? values : new Map([...map.keys()].map((key, index) => [key, values[index]]));
}

// [QSERR#rest]
async function evalErrorLiteral(step, state) {
  const facts = await entryValues(errorFieldsOf(step), state);
  if (isErrorValue(facts)) return withPipeValue(state, facts);
  return withPipeValue(state, await layTag(ERROR_TAG.name, facts, state));
}

// [QSSLF#doc]
async function evalDoc(doc, state) {
  const segments = [];
  for (const segment of doc) {
    const tags = [];
    let laid = segment;
    for (; isValueClass(laid, 'underTag'); laid = laid.payload) tags.unshift(laid.tag);
    for (const tag of tags) {
      laid = await layTag(tag.name, laid, state);
      if (isErrorValue(laid)) return withPipeValue(state, laid);
    }
    segments.push(laid);
  }
  return withPipeValue(state, makeDoc(segments));
}

// [QSERR#flow]
async function evalConstruct(construct, state) {
  const payload = (await evalStep(construct.get('payload'), state)).pipeValue;
  return withPipeValue(state, await layTag(construct.get('tag').name, payload, state));
}

// [QSBLD#fn], [QSSLF#doc], [QSERR#flow], [QSNAM#scope], [QSNAM#address], [QSQUO#held], [QSBLD#chain]
async function evalBind(bind, state, at) {
  const name = bind.get('name').name;
  const [nounName] = splitAddress(name);
  if (nounName !== null) refuseWithheld(state.scope, nounName, true);
  if (repeatsDeclarationAt(at.steps, at.index) || declaresWhatTheCallBinds(at.steps, state.scope, name) || (nounName !== null && rootOf(state.scope).has(name))) {
    throw new BindNameDeclaredTwiceError({ name: makeKeyword(name) });
  }
  if (nounName !== null && !scopeHas(state.scope, nounName)) {
    throw new BindNounNotDeclaredError({ name: makeKeyword(name), noun: makeTag(nounName) });
  }

  const docs = [];
  for (const written of bind.get('docs') ?? []) {
    const doc = (await evalStep(written, state)).pipeValue;
    if (isErrorValue(doc)) return withPipeValue(state, doc);
    docs.push(doc);
  }
  const body = bind.has('body') ? await evalStep(bind.get('body'), state) : null;
  const answered = body !== null ? body.pipeValue : makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
  if (isErrorValue(answered)) return withFlight(withPipeValue(state, answered), body.flight);
  if (writesOutsideItsChain(state.scope, nounName, splitAddress(name)[1], answered)) {
    throw new BindWrittenOutsideItsChainError({ name: makeKeyword(name), noun: nounName === null ? undefined : makeTag(nounName) });
  }
  const origin = makeKeyword(at.origin);
  const declared = scopeSet(state.scope, name, makeBinding({ name: bind.get('name'), docs, value: answered, source: makeQuote([bind]), origin }));
  if (!bind.has('body')) return withScope(state, declared);
  if (isKind(answered)) return withScope(state, nodesOfKind(answered, name, declared, origin));
  return withScope(state, nounName !== null && isFn(answered) ? nodesOfFunction(answered, name, declared, origin) : declared);
}

// [QSBLD#chain]
function writesOutsideItsChain(scope, nounName, lastName, value) {
  if (isInvariant(value)) return true;
  if (nounName === null) return false;
  return isVerb(scope, nounName) && (isPath(value) || isQuote(value) || lastName === ANSWER_NAME || lastName === SUBJECT_NAME);
}

function layerOf(scope, address, origin, pages) {
  let under = scope;
  const lay = (lastName, page, value) => {
    const name = `${address}/${lastName}`;
    under = scopeSet(under, name, makeBinding({ name: makeKeyword(name), docs: page === null ? [] : [page], value, origin }));
  };
  return {
    lay,
    layKindsRefusal(refusal, holder, kinds, each) {
      const page = pages.get(refusal) ?? pageOfKindsRefusal(holder, kinds, each);
      lay(refusal, page, page);
    },
    layRest({ facts, invariants, laws }) {
      for (const [name, page] of pages) if (!under.has(`${address}/${name}`)) lay(name, page, page);
      for (const { name, page, written } of facts) lay(name, page, written ?? page);
      for (const { name, page, condition } of invariants) lay(name, page, makeTagged(INVARIANT_TAG, condition));
      for (const { name, page, query } of laws) lay(name, page, makeTagged(LAW_TAG, query));
      return under;
    }
  };
}

// [QSBLD#label]
function nodesOfKind(kind, address, scope, origin) {
  const roles = chainOfKind(kind);
  const { payload, fields, tells } = roles;
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, roles.pages);
  if (payload !== null) {
    const holder = makeKeyword(PAYLOAD_NAME);
    lay(PAYLOAD_NAME, payload.page, payload.written ?? payload.page);
    if (payload.each) layKindsRefusal(payloadRefusalName(false), holder, ['vec'], false);
    if (payload.kinds !== null) layKindsRefusal(payloadRefusalName(payload.each), holder, payload.kinds, payload.each);
  }
  for (const { name, page, kinds, each, written } of fields) {
    lay(name.name, page, written ?? page);
    if (each) layKindsRefusal(kindsRefusalAddress(name.name), name, ['vec'], false);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), name, kinds, each);
  }
  for (const { name, page, written } of tells) lay(name, page, written ?? page);
  return layRest(roles);
}

// [QSNAM#address], [QSSLF#manifest]
function nodesOfFunction(fn, address, scope, origin) {
  const chain = chainOfFn(fn);
  const { subject, inputs, answer } = chain;
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, chain.pages);
  const standsUnder = role => [...chain.invariants.map(({ name }) => name), ...chain.pages.keys()].some(name => name.startsWith(`${role}/`));
  if (subject !== null) lay(SUBJECT_NAME, subject.page, subject.written ?? subject.page);
  else if (standsUnder(SUBJECT_NAME)) lay(SUBJECT_NAME, null, null);
  for (const { name, page, selector, kinds, each } of inputs) {
    lay(name.name, page, selector);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), name, kinds, each);
  }
  if (answer !== null) lay(ANSWER_NAME, answer.page, answer.written);
  else if (standsUnder(ANSWER_NAME)) lay(ANSWER_NAME, null, null);
  return layRest(chain);
}

// [QSNAM#scope]
function declaresWhatTheCallBinds(steps, scope, name) {
  const recipe = scope.get(RECIPE_KEY);
  return recipe !== undefined && recipe.steps === steps && recipe.names.has(name);
}

async function evalCall(call, state) {
  const name = call.get('name').name;
  const modifierSteps = call.get('modifiers') ?? [];
  if (name.includes('/')) return await callByAddress(call, name, modifierSteps, state);
  return withRepairOfPath(await callByName(name, modifierSteps.map(step => modifierOf(step, state)), state, call), call, state.pipeValue, state.scope);
}

// [QSPTH#code], [QSPTH#verbs]
function repairOfPathSubject(path, call) {
  return makeQuote([commandStep('get', [path]), call]);
}

function repairOfRefusedPath(refused, call, subject) {
  if (!refused.facts.has('actualValue')) return isPath(subject) ? repairOfPathSubject(subject, call) : null;
  const value = refused.facts.get('actualValue');
  if (!isPath(value)) return null;
  const modifiers = call.get('modifiers') ?? [];
  const written = modifiers.findIndex(modifier => isPath(modifier)
    && modifier.segments.length === value.segments.length && modifier.segments.every((segment, at) => segment === value.segments[at]));
  if (written === -1) return null;
  return makeQuote([commandStep(call.get('name').name, modifiers.map((modifier, at) => (at === written ? groupStep([commandStep('get', [modifier])]) : modifier)))]);
}

function withRepairOfPath(state, call, subject, scope) {
  const refused = state.pipeValue;
  if (!isErrorValue(refused) || refused.facts.has('repair') || refused.facts.has('trace')) return state;
  const repair = repairOfRefusedPath(refused, call, subject);
  if (repair === null) return state;
  const facts = factsInOrder(refused.tag, new Map(refused.facts).set('repair', repair), scope);
  return withPipeValue(state, makeErrorValue(refused.tag, facts, { originalError: refused.originalError }));
}

// [QSNAM#reach], [QSQUO#held]
async function callByName(lookupName, modifiers, state, call) {
  refuseWithheld(state.scope, lookupName);
  const reach = bareNameReach(state.scope, lookupName, state.pipeValue);
  if (reach === null) {
    const addresses = addressesOf(state.scope, lookupName);
    if (addresses.length > 0) {
      const nearest = nearestVerbs(state.scope, addresses, state.pipeValue);
      const repair = isPath(state.pipeValue) ? repairOfPathSubject(state.pipeValue, call) : undefined;
      throw refusingTheSubject(new CallKindAnswersNoVerbError({ name: makeKeyword(lookupName), addresses, nearest: nearest.length > 0 ? nearest : undefined, repair, actualValue: state.pipeValue }));
    }
    throw new CallUnknownNameError({
      name: makeKeyword(lookupName), nearest: nearestNames(state.scope, lookupName), addresses
    });
  }
  if (reach.underKind) return await applyVerb(reach.record, modifiers, state);
  const verb = residenceOnSubject(state.scope, lookupName, state.pipeValue);
  if (verb !== null && servesTheSubject(verb, state.pipeValue)) {
    throw new CallValueMeetsVerbError({ name: makeKeyword(lookupName), addresses: makeSet([makeTag(verb.get('name').name)]) });
  }
  return await applyBinding(reach.record, lookupName, lookupName, modifiers, state);
}

// [QSNAM#value]
async function applyBinding(entry, name, lastName, modifiers, state) {
  const resolved = bindingValueOf(entry);

  if (modifiers.length > 0) {
    throw new CallValueTakesNoModifiersError({
      name: makeKeyword(name),
      actualValue: resolved,
      addresses: addressesOf(state.scope, lastName)
    });
  }
  return withPipeValue(state, resolved);
}

// [QSNAM#address]
async function callByAddress(call, address, modifierSteps, state) {
  const record = nodeOf(state.scope, address);
  if (record === null) {
    throw new CallUnknownAddressError({ address: makeTag(address), nearest: nearestTagNames(state.scope, address) });
  }
  const modifiers = modifierSteps.map(step => modifierOf(step, state));
  if (isVerbValue(bindingValueOf(record)) && isUnderLabel(state.scope, address)) {
    return await applyVerb(record, modifiers, state);
  }
  return await applyBinding(record, address, splitAddress(address)[1], modifiers, state);
}

// [QSBLD#fn], [QSERR#site]
function refusalUnder(tagName, facts, scope, refused = facts.actualValue) {
  const tag = makeTag(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)).set('actualTag', tagOf(refused)), scope));
}

function heldByItsKinds({ kinds, each }, refusalOf, value, scope, asGiven = false) {
  if (!each) {
    if (kinds === null) return value;
    const reached = walkToKinds(value, kinds);
    if (reached === null) return refusalUnder(refusalOf(false), { expected: kindsExpected(...kinds), actualValue: value }, scope);
    return asGiven ? value : reached.served;
  }
  const elements = walkToKinds(value, ['vec']);
  if (elements === null) return refusalUnder(refusalOf(false), { expected: kindsExpected('vec'), actualValue: value }, scope);
  if (kinds === null) return elements.served;
  const refused = refusedElementOf(elements.served, kinds);
  if (refused !== null) return refusalUnder(refusalOf(true), { index: refused.index, expected: kindsExpected(...kinds), actualValue: refused.element }, scope);
  if (isQuote(elements.served) || isDoc(elements.served)) return elements.served;
  const served = asGiven ? [...elements.served] : Array.from(elements.served, element => walkToKinds(element, kinds).served);
  return isSet(elements.served) ? makeSet(served) : Object.freeze(served);
}

const refusalsUnder = address => each => (each ? elementsRefusalAddress : kindsRefusalAddress)(address);

function refusedElementOf(elements, kinds) {
  const index = elements.findIndex(element => walkToKinds(element, kinds) === null);
  return index === -1 ? null : { index, element: elements[index] };
}

// [QSBLD#value]
async function invariantRefusal(invariants, address, value, state, scope, held = value, facts = { actualValue: held }) {
  for (const { name, condition } of invariants) {
    const answer = (await evalPipeline(condition, nestState(state, value, scope))).pipeValue;
    if (isErrorValue(answer)) return answer;
    if (beneathTags(answer) !== true) return refusalUnder(`${address}/${name}`, facts, scope, held);
  }
  return null;
}

// [QSBLD#input], [QSNAM#verb]
function selectedValue({ path, selector, index, oneArg, strict, fallback, readsArgs }, values, overArgs) {
  if (readsArgs) return overArgs().pipeValue;
  if (!oneArg) return path !== null ? pathOfArgs(path, overArgs()) : answerOfPipeline(selector, overArgs());
  if (index < values.length) return values[index];
  if (strict) return MISSED_ARG;
  return fallback === null ? null : answerOfPipeline([fallback], overArgs());
}

// [QSBLD#input], [QSPTH#get]
function pathOfArgs(path, state) {
  try {
    return readPath(state.pipeValue, path);
  } catch (refusal) {
    return errorFromQlang(refusal, undefined, state.scope);
  }
}

async function answerOfPipeline(steps, state) {
  return (await evalPipeline(steps, state)).pipeValue;
}

const MISSED_ARG = Symbol('missedArg');

const OPENED_SCOPES = [new WeakMap(), new WeakMap()];

function callScopeOf(state, ofTheRoot) {
  const opened = OPENED_SCOPES[ofTheRoot ? 1 : 0];
  let callScope = opened.get(state.scope);
  if (callScope === undefined) opened.set(state.scope, callScope = scopeOpenedIn(state.scope, ofTheRoot));
  return callScope;
}

function scopeOpenedIn(scope, ofTheRoot) {
  const { scope: kept } = nodesAndLabelsOf(scope);
  kept.set(QUERY_KEY, queryTreeOf(scope));
  return ofTheRoot ? markRootVerbScope(kept) : kept;
}

// [QSNAM#owner], [QSQUO#held]
function nodesAndLabelsOf(scope) {
  const kept = new Map([[ROOT_KEY, rootOf(scope)]]);
  const values = [];
  for (const [name, entry] of scope) {
    if (typeof name !== 'string') continue;
    if (isNodeOrLabel(name, entry)) kept.set(name, entry);
    else values.push(name);
  }
  return { scope: kept, values };
}

function isNodeOrLabel(name, record) {
  return name.includes('/') || declaresALabel(record);
}

// [QSBLD#input]
const ARGS_NAME = makeKeyword('args');

// [QSBLD#recipe]
async function applyVerb(record, modifiers, state) {
  const value = bindingValueOf(record);
  return await applyFunctionVerb(record, isFn(value) ? value : functionOfRecipe(value), modifiers, state);
}

// [QSDSP#answer], [QSERR#flow]
async function underTags(value, tags, state) {
  let laid = value;
  for (const tag of [...tags].reverse()) laid = await layTag(tag.name, laid, state);
  return laid;
}

// [QSCOL#sequence], [QSCOL#algebra]
export async function underSharedTags(answer, tagNames, state) {
  return await underTags(await layTag(tagOf(answer).name, answer, state), tagNames.map(makeTag), state);
}

// [QSDSP#answer], [QSSLF#catalog], [QSBLD#answer]
function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = tagOf(served).name;
  const reached = walkToKinds(answer, [ownKind]);
  if (reached !== null && passedTags.length === 0) return answer;
  return keptUnderTags(answer, reached, ownKind, passedTags, state);
}

async function keptUnderTags(answer, reached, ownKind, passedTags, state) {
  const kept = reached?.served ?? await layTag(ownKind, answer, state);
  return await underTags(kept, passedTags, state);
}

// [QSBLD#answer]
function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state) {
  const others = kinds.filter(kind => kind !== labelName);
  if (walkToKinds(answer, others) !== null) return answer;
  const refused =() => refusalUnder(kindsRefusalAddress(address), { expected: kindsExpected(...kinds), actualValue: answer }, state.scope);
  if (returnsItsLabel(kinds, labelName)) {
    if (walkToKinds(answer, [labelName]) !== null) return keptAsSubject(answer, walked.served, walked.passedTags, state);
    const keeping = () => keptOfTheLabel(answer, labelName, walked, refused, state);
    return tagOf(walked.served).name === labelName ? answerMadeBy(labelName, keeping, refused) : keeping();
  }
  const constructing = kinds.length === 1 ? kinds[0] : kinds.find(kind => kind === tagOf(answer).name);
  return constructing === undefined ? refused() : answerMadeBy(constructing, () => layTag(constructing, answer, state), refused);
}

async function keptOfTheLabel(answer, labelName, walked, refused, state) {
  const kept = await keptAsSubject(answer, walked.served, walked.passedTags, state);
  return isErrorValue(kept) || walkToKinds(kept, [labelName]) !== null ? kept : refused();
}

async function answerMadeBy(kindName, make, refused) {
  const payloadRefusal = `${kindName}/${payloadRefusalName(false)}`;
  let made;
  try {
    made = await make();
  } catch (caughtError) {
    if (caughtError instanceof QlangError && caughtError.address === payloadRefusal) return refused();
    throw caughtError;
  }
  return isErrorValue(made) && made.tag.name === payloadRefusal ? refused() : made;
}

// [QSPRN#print]
export async function callVerbOn(record, subject, state) {
  return (await applyVerb(record, [], withPipeValue(state, subject))).pipeValue;
}

// [QSBLD#fn], [QSHST#source]
async function applyFunctionVerb(record, fn, modifiers, state) {
  const address = record.get('name').name;
  const ofTheRoot = isQuote(recipeOf(fn)) ? rootOf(state.scope).get(address) === record : isRootVerbScope(state.scope);
  const flight = flightOfACall();
  const answer = await callFunction(fn, { address, labelName: splitAddress(address)[0], ofTheRoot }, modifiers, state, flight);
  return withFlight(withPipeValue(state, answer), flight);
}

export async function applyFunction(fn, subject, args, state) {
  const at = { address: FN_CALL_ADDRESS, labelName: null, ofTheRoot: !isQuote(recipeOf(fn)) && isRootVerbScope(state.scope) };
  return await callFunction(fn, at, args.map(value => () => value), withPipeValue(state, subject), state.flight);
}

export async function inputsOfFunction(fn, args, state) {
  const called = await inputsOfCall(chainOfFn(fn), FN_CALL_ADDRESS, args.map(value => () => value), state, callScopeOf(state, false), null);
  return isErrorValue(called) ? called : called.values;
}

async function callFunction(fn, { address, labelName, ofTheRoot }, modifiers, state, flight) {
  const chain = chainOfFn(fn);
  const recipe = recipeOf(fn);
  const steps = isQuote(recipe) ? recipe : null;
  const handed = steps === null ? handedFor(recipe, fn) : undefined;
  if (steps === null && handed === undefined) throw new FnRecipeMissingError({ actualValue: fn });
  let walked = subjectOfCall(chain, labelName, state.pipeValue);
  if (walked === null && labelName === null) return refusalUnder(subjectKindsRefusalAddress(address), { expected: kindsExpected(...chain.subject.kinds) }, state.scope, state.pipeValue);
  if (walked === null) return refusalUnder(subjectRefusalAddress(address, labelName), {}, state.scope, state.pipeValue);
  if (handed !== undefined && handed.labelName !== labelName) {
    walked = subjectOfCall(chain, handed.labelName, state.pipeValue);
    if (walked === null) return refusalUnder(subjectRefusalAddress(address, handed.labelName), {}, state.scope, state.pipeValue);
  }
  const scope = callScopeOf(state, ofTheRoot);
  const refusedSubject = await invariantRefusal(invariantsOf(chain, SUBJECT_NAME), address, walked.served, state, scope, state.pipeValue, {});
  if (refusedSubject !== null) return refusedSubject;
  const called = await inputsOfCall(chain, address, modifiers, state, scope, steps, flight);
  if (isErrorValue(called)) return called;
  const laid = handed !== undefined && combinesItsInput(handed.primitive) ? tagsTheOperandsShare(chain, handed.labelName, state.pipeValue, called.given) : null;
  const running = steps === null
    ? runPrimitive(handed.primitive, walked.served, walked.passedTags, handedTo(handed.primitive, chain, called, state, flight), withFlight(called.state, flight), address)
    : (await evalPipeline(steps, nestState(called.state, state.pipeValue, called.recipeScope))).pipeValue;
  const answer = isThenable(running) ? await running : running;
  if (isErrorValue(answer)) return answer;
  const kinds = chain.answer?.kinds ?? null;
  const broughtFrom = laid === null ? walked : { ...walked, passedTags: laid };
  const brought = kinds === null ? answer : await answerUnderItsLabel(answer, { address: `${address}/${ANSWER_NAME}`, kinds }, walked.byLabel ? labelName : null, broughtFrom, state);
  if (isErrorValue(brought)) return brought;
  return await invariantRefusal(invariantsOf(chain, ANSWER_NAME), address, brought, called.state, scope) ?? brought;
}

// [QSDSP#answer]
function tagsTheOperandsShare(chain, labelName, subject, given) {
  const tally = new TagsInCommon();
  tally.meet(subject);
  for (const [at, { each }] of chain.inputs.entries()) {
    for (const value of each ? walkToKinds(given[at], ['vec']).served : [given[at]]) {
      if (walkToKinds(value, [labelName]) === null) continue;
      const met = tally.meet(value);
      if (met !== null) throw pairRefused(met, value);
    }
  }
  return tagsOver(subject).length === 0 ? tally.tags.map(makeTag) : null;
}

// [QSHST#source]
function handedTo(primitive, chain, { values, origins }, state, flight) {
  const asCode = inputsAsCode(primitive);
  if (asCode === undefined) return values;
  const originOfQuote = quote => origins.get(quote);
  const ofTheCall = code => (typeof code === 'function' ? Object.assign(code, { flight }) : code);
  return values.map((value, at) => {
    const { name, reading } = chain.inputs[at];
    if (asCode.within?.has(name.name)) return quotesClosedIn(value, quote => stateOfOrigin(originOfQuote(quote)));
    if (asCode.folded?.has(name.name)) return ofTheCall(foldingCodeOf(value, originOfQuote, state));
    if (!asCode.run?.has(name.name)) return value;
    return reading.readsArgs ? value.map(element => codeOfArg(element, originOfQuote, state)) : ofTheCall(codeOfArg(value, originOfQuote, state));
  });
}

function quotesClosedIn(value, stateOfQuote) {
  if (isQuote(value)) return closeQuote(value, stateOfQuote(value));
  if (!holdsAQuote(value)) return value;
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, quotesClosedIn(value.payload, stateOfQuote));
  const header = value[TAG_HEADER_SYMBOL];
  const closed = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, quotesClosedIn(part, stateOfQuote)]))
    : value.map(part => quotesClosedIn(part, stateOfQuote));
  if (header !== undefined) stampTagHeader(closed, header);
  return closed;
}

// [QSQUO#held]
function keepOrigins(origins, value, origin, state) {
  if (isQuote(value)) {
    origins.set(value, origin.written ? origin : originIn(state, value) ?? origin);
    return;
  }
  if (isValueClass(value, 'underTag')) return keepOrigins(origins, value.payload, origin, state);
  if (!holdsAQuote(value)) return;
  for (const part of partsOfTemplate(value)) keepOrigins(origins, part, origin, state);
}

const HOLDERS_OF_QUOTES = new WeakMap();

function holdsAQuote(value) {
  if (isQuote(value)) return true;
  if (isValueClass(value, 'underTag')) return !isQuote(value.payload) && holdsAQuote(value.payload);
  if (typeof value !== 'object' || value === null) return false;
  let holds = HOLDERS_OF_QUOTES.get(value);
  if (holds === undefined) {
    const parts = partsOfTemplate(value);
    holds = parts !== null && parts.some(holdsAQuote);
    HOLDERS_OF_QUOTES.set(value, holds);
  }
  return holds;
}

function codeOfArg(value, originOfQuote, state) {
  if (isQuote(value)) return codeFrom(value, originOfQuote(value));
  return isPath(value) ? codeOfPath(value, state) : value;
}

// [QSCOL#reduce]
function foldingCodeOf(value, originOfQuote, state) {
  const code = codeOfArg(value, originOfQuote, state);
  const onThePair = async (acc, element) => await code([acc, element]);
  if (value.length !== 1 || !isCallStep(value[0]) || value[0].has('modifiers')) return onThePair;
  const call = value[0];
  const name = call.get('name').name;
  const callerState = stateOfOrigin(originOfQuote(value));
  const calledOn = invoke => async (acc, element) => {
    let answered;
    try {
      answered = await invoke([() => element], withPipeValue(callerState, acc));
    } catch (caughtError) {
      answered = withFlight(withPipeValue(callerState, errorOfThrow(caughtError, acc, callerState.scope)), flightOfThrow(caughtError));
    }
    return answerOfStep(answered.pipeValue, () => makeQuote([call]), acc, callerState.scope, answered.flight);
  };
  if (name.includes('/')) {
    if (!isVerb(callerState.scope, name)) return onThePair;
    const record = nodeOf(callerState.scope, name);
    return calledOn((modifiers, at) => applyVerb(record, modifiers, at));
  }
  if (addressesOf(callerState.scope, name).length === 0) return onThePair;
  return calledOn((modifiers, at) => callByName(name, modifiers, at, call));
}

// [D417], [QSBLD#input]
async function inputsOfCall(chain, address, modifiers, state, scope, recipeSteps, flight) {
  const values = [];
  const origins = new Map();
  for (const [index, modifier] of modifiers.entries()) {
    const computing = modifier(state.pipeValue, flight);
    const value = isThenable(computing) ? await computing : computing;
    if (isErrorValue(value)) return refusalOfFailedModifier(chain, address, index, value, scope);
    values.push(value);
    keepOrigins(origins, value, modifier.origin ?? heldIn(state), state);
  }
  const called = withCall(state, origins);
  let args = null;
  const argsValue = () => args ??= makeTagged(makeTag(address), values);
  if (chain.arity !== null && values.length > chain.arity) return refusalUnder(argsBeyondInputsAddress(address), { arity: chain.arity, actualValue: argsValue() }, scope);
  const recipeScope = recipeSteps === null ? null : scopeSet(scope, ARGS_NAME.name, makeBinding({ name: ARGS_NAME, value: argsValue() }))
    .set(RECIPE_KEY, { steps: recipeSteps, names: new Set([ARGS_NAME.name, ...chain.inputs.map(({ name }) => name.name)]) });
  const overArgs = () => nestState(called, argsValue(), scope);
  const inputValues = [];
  const given = [];
  for (const input of chain.inputs) {
    const { name } = input;
    const inputAddress = `${address}/${name.name}`;
    depthBelow(state);
    const reached = selectedValue(input.reading, values, overArgs);
    const read = isThenable(reached) ? await reached : reached;
    if (read === MISSED_ARG || (isErrorValue(read) && isMissedPart(read))) return refusalUnder(notGivenAddress(inputAddress), { actualValue: argsValue() }, scope);
    if (isErrorValue(read)) return read;
    given.push(read);
    const held = heldByItsKinds(input, refusalsUnder(inputAddress), read, scope, recipeSteps !== null);
    if (isErrorValue(held)) return held;
    const refused = await invariantRefusal(invariantsOf(chain, name.name), address, read, called, scope);
    if (refused !== null) return refused;
    inputValues.push(held);
    if (recipeSteps !== null) recipeScope.set(name.name, makeBinding({ name, value: held }));
  }
  return { values: inputValues, given, origins, recipeScope, state: called };
}

// [QSQUO#modifier]
function refusalOfFailedModifier(chain, address, index, error, scope) {
  if (error.tag.name === CallValueWithheldError.prototype.address) return error;
  const input = chain.inputs.find(({ reading }) => reading.index === index) ?? chain.inputs.find(({ reading }) => reading.readsArgs);
  if (!(input?.kinds?.includes('quote') ?? false)) return error;
  const atRest = errorAtRest(error.tag, new Map(error.facts));
  const inputAddress = `${address}/${input.name.name}`;
  if (input.each && input.reading.readsArgs) {
    return refusalUnder(elementsRefusalAddress(inputAddress), { index, expected: kindsExpected(...input.kinds), actualValue: atRest }, scope);
  }
  const expected = input.each ? kindsExpected('vec') : kindsExpected(...input.kinds);
  return refusalUnder(kindsRefusalAddress(inputAddress), { expected, actualValue: atRest }, scope);
}

// [QSDSP#answer], [QSBLD#kind], [QSLIT#tag], [QSBLD#label], [QSERR#flow], [QSQUO#held]
export async function layTag(tagName, payload, state) {
  if (isErrorValue(payload)) return payload;
  refuseWithheld(state.scope, tagName, true);
  const node = nodeOf(state.scope, tagName);
  const declared = bindingValueOf(node);
  if (isKind(declared)) return await underKind(tagName, declared, payload, state);
  if (isDoc(declared) || node === null || isVerb(state.scope, tagName) || isInvariant(declared)) return makeTagged(makeTag(tagName), payload);
  throw new ConstructTagNamesAValueError({ tag: makeTag(tagName), actualValue: declared });
}

// [QSBLD#value], [QSLIT#tag], [QSHST#source]
async function underKind(tagName, kind, payload, state) {
  const { payload: payloadRole, fields, invariants } = chainOfKind(kind);
  const held = payloadRole === null ? payload : heldByItsKinds(payloadRole, each => `${tagName}/${payloadRefusalName(each)}`, payload, state.scope);
  if (isErrorValue(held)) return held;
  let scope;
  const opened = () => scope ??= callScopeOf(state, rootOf(state.scope).get(tagName) === nodeOf(state.scope, tagName));
  for (const field of fields) {
    const refused = await fieldRefusal(tagName, field, held, invariants, state, opened);
    if (refused !== null) return refused;
  }
  const constructs = handedFor(constructorOf(kind), kind)?.primitive;
  const constructed = constructs === undefined ? held : await heldAtTheDoor(constructs, () => constructs(held), tagName, [held]);
  const labelled = constructs !== undefined && tagOf(constructed).name === tagName ? constructed : makeTagged(makeTag(tagName), constructs === undefined ? payload : constructed);
  const ofTheValue = invariants.filter(({ field }) => field === null);
  return ofTheValue.length === 0 ? labelled : await invariantRefusal(ofTheValue, tagName, constructed, state, opened(), labelled) ?? labelled;
}

async function fieldRefusal(tagName, field, payload, invariants, state, opened) {
  const fieldAddress = `${tagName}/${field.name.name}`;
  const read = isPath(field.selector)
    ? pathOfArgs(field.selector, withPipeValue(state, payload))
    : await answerOfPipeline(field.selector, nestState(state, payload, opened()));
  if (isErrorValue(read) && isMissedPart(read)) return refusalUnder(notGivenAddress(fieldAddress), { actualValue: payload }, state.scope);
  if (isErrorValue(read)) return read;
  const held = heldByItsKinds(field, refusalsUnder(fieldAddress), read, state.scope);
  if (isErrorValue(held)) return held;
  const ofTheField = invariants.filter(({ field: under }) => under === field.name.name);
  return ofTheField.length === 0 ? null : await invariantRefusal(ofTheField, tagName, read, state, opened());
}

// [QSNAM#scope], [QSNAM#verb], [QSQUO#held], [QSERR#trace]
const closeStep = (step, state) => async (subject, flight) => {
  const answered = await evalStep(step, nestState(state, subject, state.scope));
  if (answered.flight?.path) flight.path = answered.flight.path;
  return answered.pipeValue;
};

// [QSNAM#scope], [QSNAM#verb]
function closeQuote(quote, state) {
  return async subject => (await evalPipeline(quote, nestState(state, subject, state.scope))).pipeValue;
}

// [QSQUO#held], [QSNAM#verb], [QSERR#trace]
function modifierOf(step, state) {
  if (isQuote(step)) return withOrigin(() => step, { state, written: true });
  if (isTemplate(step)) return withOrigin(closeStep(step, state), { state, written: true });
  return closeStep(step, state);
}

// [QSQUO#held]
const isTemplate = step => isConstructStep(step) || errorFieldsOf(step) !== null || isSet(step) || ((isVec(step) || isMap(step)) && step[TAG_HEADER_SYMBOL] === undefined);

function withOrigin(code, origin) {
  code.origin = origin;
  return code;
}

function heldIn(state) {
  return { state, written: false };
}

// [QSPTH#code]
function codeOfPath(path, callState) {
  const step = () => makeQuote([commandStep('get', [path])]);
  return async subject => {
    try {
      return readPath(subject, path);
    } catch (refusal) {
      return answerOfStep(errorFromQlang(refusal, subject, callState.scope), step, subject, callState.scope);
    }
  };
}

// [QSQUO#literal], [QSQUO#held]
export function codeOf(code, callState) {
  return codeFrom(code, originIn(callState, code) ?? heldIn(callState));
}

// [QSPTH#template], [QSQUO#held], [QSNAM#scope]
export function templateClosedIn(template, callState, names = new Map()) {
  return quotesClosedIn(template, quote => {
    const state = stateOfOrigin(originIn(callState, quote));
    return withScope(state, scopeNaming(state.scope, names));
  });
}

function scopeNaming(scope, names) {
  let named = scope;
  for (const [name, value] of names) named = scopeSet(named, name, makeBinding({ name: makeKeyword(name), value }));
  return named;
}

// [QSQUO#held]
function codeFrom(code, origin) {
  return closeQuote(code, stateOfOrigin(origin));
}

function stateOfOrigin({ state, written }) {
  return written ? state : withScope(state, laneOf(ownScopeOf(state)));
}

const LANES = new WeakMap();

function laneOf(scope) {
  let lane = LANES.get(scope);
  if (lane !== undefined) return lane;
  const { scope: kept, values } = nodesAndLabelsOf(scope);
  lane = kept.set(WITHHELD_KEY, new Set([...(scope.get(WITHHELD_KEY) ?? []), ...values]));
  LANES.set(scope, lane);
  return lane;
}
