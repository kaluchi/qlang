// [QSQUO#step]

import { ROOT_KEY, QUERY_KEY, RECIPE_KEY, WITHHELD_KEY } from './scope-keys.mjs';
import {
  withPipeValue, withScope, withFlight, nestState, depthBelow, scopeSet, scopeWith, scopeHas, rootOf, markRootVerbScope, isRootVerbScope, queryTreeOf,
  withWritten, writtenIn, ownScopeOf, ownStateOf, NO_SUBJECT
} from './state.mjs';
import { declareRefusal, QlangError, QlangDefect, CallUnknownNameError, CallUnknownAddressError, BindNameDeclaredTwiceError } from './errors.mjs';
import { nearestNames, nearestTagNames, nearestVerbs } from './nearest-names.mjs';
import { readPath, partsOfTemplate, isMissedPart, MISSED } from './path-read.mjs';
import {
  isSet, isVec, isMap, isErrorValue, isQuote, isDoc, isPath, handedFor,
  tagOf, makeKeyword, makeErrorValue, makeDoc, makeQuote,
  makeBinding, bindingValueOf, makeTagged, makeTag, beneathTags,
  isFn, isKind, FN_TAG_NAME, KIND_TAG_NAME, isBinding, isTag, recipeOf, constructorOf, commandsOf, stampTagHeader, payloadBeneath, TAG_HEADER_SYMBOL,
  ERROR_TAG, TRACE_TAG, isExcerpt, isCell, isValueClass, tagsOver, TagsInCommon, pairRefused, builtinOf, addressNamedBy, wiringOf, isBuiltinDescriptor
} from './types.mjs';
import { makeSet, kindsExpected, compareValues } from './ordering.mjs';
import { originOf, repeatsDeclarationAt, declaresBefore } from './parsed-parts.mjs';
import {
  isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, isComputingStep, errorFieldsOf,
  commandStep, groupStep, declarationStep, namesAQuoteReads, computesWithin, heldAsALiteral, CallLiteralComputesError
} from './steps.mjs';
import { asPrinted } from './print-value.mjs';
import { errorFromQlang, errorFromForeign, factsInOrder } from './error-convert.mjs';
import {
  INVARIANT_TAG, LAW_TAG, addressesOf, bareNameReach, declaresALabel, isInvariant, isLaw, isVerb, isNodeOfAPart, kindOfAValueOf, nodeOf, refuseWithheld,
  returnsItsLabel, slotsOfAVerdict, invariantNamedByARule, refusalsAddressOf, CallValueWithheldError, isProgramRecord, markProgram
} from './nouns.mjs';
import { ANSWER_NAME, PAYLOAD_NAME, SUBJECT_NAME, SURPLUS_NAME, REPAIR_NAME, functionOfRecipe, chainOfKind, chainOfFn, inputsTakingCode, FnNameDeclaredTwiceError } from './chain.mjs';
import { inputsAsCode, combinesItsInput } from './primitives.mjs';
import {
  splitAddress, argsBeyondInputsAddress, subjectKindsRefusalAddress, elementsRefusalAddress, kindsRefusalAddress,
  notGivenAddress, notReadAddress, payloadRefusalName, subjectRefusalAddress, quotedRefusalAddress, quotedTwiceRefusalAddress,
  FN_CALL_ADDRESS, ANY_KIND_NAME
} from './address.mjs';
import { runPrimitive, heldAtTheDoor, isThenable, walkToKinds, subjectOfCall } from './dispatch.mjs';
import { answerOfStep, skipping, flightOfACall, flightOfThrow } from './eval-trace.mjs';

// [QSBLD#label]
const ConstructTagNamesAValueError = declareRefusal('construct/TagNamesAValueError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError = declareRefusal('call/ValueTakesNoModifiersError');
const FnRecipeMissingError = declareRefusal('fn/RecipeMissingError');
const BindWrittenOutsideItsChainError = declareRefusal('bind/WrittenOutsideItsChainError');

// [QSDSP#refusal]
const CallKindAnswersNoVerbError = declareRefusal('call/KindAnswersNoVerbError');

// [QSNAM#declare]
const BindSubjectNotGivenError = declareRefusal('bind/SubjectNotGivenError');
const BindChainAnswersNoWordError = declareRefusal('bind/ChainAnswersNoWordError');
const BindBodyQuotedError = declareRefusal('bind/BodyQuotedError');

// [QSPRN#print]
const BindPrintDeclaredError = declareRefusal('bind/PrintDeclaredError');
const PRINT_NAME = 'print';

// [QSNAM#value]
const CallValueAsALaterStepError = declareRefusal('call/ValueAsALaterStepError');

// [QSQUO#step], [QSNAM#declare], [QSERR#flow], [QSERR#trace]
export async function evalPipeline(steps, state, origin = originOf(steps)) {
  let current = state;
  const declared = [];
  let queried = false;
  for (const [index, step] of steps.entries()) {
    const at = { steps, index, origin };
    if (!queried && isBindStep(step)) {
      const answered = await evalStep(step, withPipeValue(current, NO_SUBJECT), at);
      if (isErrorValue(answered.pipeValue)) return withPipeValue(state, answerOfStep(answered.pipeValue, () => makeQuote(steps.slice(index)), NO_SUBJECT, current.scope, answered.flight));
      current = withPipeValue(answered, state.pipeValue);
      declared.push(makeTag(step.get('name').name));
      continue;
    }
    queried = true;
    current = isFailStep(step) ? await applyFailTrack(current, step.payload[0], at) : await applySuccessTrack(current, step, at);
  }
  return queried || declared.length === 0 ? current : withPipeValue(current, makeSet(declared));
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
  return caughtError instanceof QlangError ? errorFromQlang(caughtError, scope) : errorFromForeign(caughtError, scope);
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
  const atRest = await errorAtRestOf(raised, state);
  if (isErrorValue(atRest)) return withPipeValue(state, answerOfStep(atRest, () => makeQuote([step]), makeTagged(ERROR_TAG, new Map(raised.facts)), state.scope));
  const answered = await evalStep(step, withPipeValue(state, atRest), at);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => makeQuote([step]), atRest, state.scope, answered.flight));
}

// [QSERR#rest]
export async function errorAtRestOf(raised, state) {
  const errorOfKind = makeTagged(ERROR_TAG, new Map(raised.facts));
  if (raised.tag.name === ERROR_TAG.name) return errorOfKind;
  try {
    return await layTag(raised.tag.name, errorOfKind, state);
  } catch (caughtError) {
    return errorOfThrow(caughtError, errorOfKind, state.scope);
  }
}

// [QSNAM#scope], [QSNAM#declare]
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
    if (isComputingStep(element)) {
      values.push(element);
      continue;
    }
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

// [QSERR#flow], [QSPTH#template]
async function evalConstruct(construct, state) {
  const payload = (await evalStep(construct.get('payload'), state)).pipeValue;
  if (!isErrorValue(payload) && computesWithin(construct.get('payload'))) return withPipeValue(state, makeTagged(makeTag(construct.get('tag').name), payload));
  return withPipeValue(state, await layTag(construct.get('tag').name, payload, state));
}

// [QSBLD#fn], [QSSLF#doc], [QSERR#flow], [QSNAM#scope], [QSNAM#address], [QSQUO#held], [QSBLD#chain], [QSBLD#recipe], [QSNAM#declare], [QSNAM#reach], [QSPRN#print]
async function evalBind(bind, state, at) {
  const name = bind.get('name').name;
  const [nounName] = splitAddress(name);
  if (nounName !== null) refuseWithheld(state.scope, nounName, true);
  if (repeatsDeclarationAt(at.steps, at.index) || declaresWhatTheCallBinds(at.steps, state.scope, name)
    || (nounName !== null && (rootOf(state.scope).has(name) || laidByTheChainOfItsNoun(state.scope, name, nounName, at)))) {
    throw new BindNameDeclaredTwiceError({ name: makeKeyword(name) });
  }
  if (nounName !== null && !scopeHas(state.scope, nounName)) {
    throw new BindNounNotDeclaredError({ name: makeKeyword(name), noun: makeTag(nounName) });
  }
  if (nounName !== null && nounName !== ANY_KIND_NAME && splitAddress(name)[1] === PRINT_NAME) throw new BindPrintDeclaredError({ name: makeKeyword(name) });

  const docs = [];
  for (const written of bind.get('docs') ?? []) {
    const doc = (await evalStep(written, state)).pipeValue;
    if (isErrorValue(doc)) return withPipeValue(state, doc);
    docs.push(doc);
  }
  const program = bind.has('body') && !VALUES_WRITTEN.has(bind) && asksForASubject(bind.get('body'), state.scope);
  if (nounName !== null && bind.has('body') && isQuote(bind.get('body')) && asksForASubject(headOfCode(bind.get('body')), state.scope)) {
    throw new BindBodyQuotedError({ name: makeKeyword(name), found: bind.get('body') });
  }
  const body = !bind.has('body') ? null
    : program ? withPipeValue(state, filled(codeOfAStep(bind.get('body')), valuesAProgramCarries(name, state)))
      : VALUES_WRITTEN.has(bind) ? withPipeValue(state, VALUES_WRITTEN.get(bind)) : await evalStep(bind.get('body'), state);
  const answered = body !== null ? body.pipeValue : makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
  if (isErrorValue(answered)) return withFlight(withPipeValue(state, answered), body.flight);
  if (answered === NO_SUBJECT) throw new BindSubjectNotGivenError({ name: makeKeyword(name) });
  if (bind.has('body') && isChain(bind.get('body')) && !buildsAWord(answered, nounName)) throw new BindChainAnswersNoWordError({ name: makeKeyword(name), found: answered });
  if (nounName !== null && isFn(answered)) {
    refuseAnInputOfTheWiring(state.scope, nounName, answered);
    refuseAnInvariantNamedByARule(nounName, name, answered);
  }
  if (writesOutsideItsChain(state.scope, nounName, splitAddress(name)[1], answered)) {
    throw new BindWrittenOutsideItsChainError({ name: makeKeyword(name), noun: nounName === null ? undefined : makeTag(nounName) });
  }
  const origin = makeKeyword(at.origin);
  const record = makeBinding({ name: bind.get('name'), docs, value: answered, source: makeQuote([bind]), origin });
  if (program && nounName === null) markProgram(record);
  const declared = scopeSet(state.scope, name, record);
  if (!bind.has('body')) return withScope(state, declared);
  if (isKind(answered)) return withScope(state, nodesOfKind(answered, name, declared, origin));
  return withScope(state, nounName !== null && isFn(answered) ? nodesOfFunction(answered, name, declared, origin) : declared);
}

// [D500], [QSBLD#recipe]
function valuesAProgramCarries(name, state) {
  const values = valuesNamedIn(ownScopeOf(state));
  const ownName = splitAddress(name)[1];
  if (!values.has(ownName)) return values;
  const carried = new Map(values);
  carried.delete(ownName);
  return carried;
}

// [QSNAM#declare]
const isChain = body => isGroupStep(body) && body.payload.length > 1 && isTag(body.payload[0]);
const buildsAWord = (value, nounName) => isKind(value) || isFn(value) || isDoc(value) || isLaw(value) || isInvariant(value)
  || (nounName !== null && (isQuote(value) || isBuiltinDescriptor(value)));

// [QSNAM#scope]
function laidByTheChainOfItsNoun(scope, name, nounName, at) {
  const entry = scope.get(name);
  return isBinding(entry) && entry.get('source') === null && declaresBefore(at.steps, at.index, nounName);
}

// [QSBLD#recipe]
function refuseAnInputOfTheWiring(scope, nounName, fn) {
  const label = bindingValueOf(nodeOf(scope, nounName));
  if (!isKind(label)) return;
  const input = chainOfFn(fn).inputs.find(({ name }) => chainOfKind(label).wired.has(name.name));
  if (input !== undefined) throw new BindNameDeclaredTwiceError({ name: input.name });
}

// [QSBLD#fn]
function refuseAnInvariantNamedByARule(nounName, name, fn) {
  const ruled = invariantNamedByARule(fn, name, nounName);
  if (ruled !== null) throw new FnNameDeclaredTwiceError({ name: makeKeyword(ruled), found: commandsOf(fn) });
}

// [QSBLD#chain]
function writesOutsideItsChain(scope, nounName, lastName, value) {
  if (isInvariant(value)) return true;
  if (nounName === null) return false;
  return isVerb(scope, nounName) && (isPath(value) || isQuote(value) || lastName === ANSWER_NAME || lastName === SUBJECT_NAME);
}

// [QSBLD#fn], [QSERR#site]
function layerOf(scope, address, origin, { pages, refusalKinds }) {
  let under = scope;
  const lay = (lastName, page, value) => {
    const name = `${address}/${lastName}`;
    under = scopeSet(under, name, makeBinding({ name: makeKeyword(name), docs: [page], value, origin }));
  };
  return {
    lay,
    layKindsRefusal(refusal, pageOfThePart) {
      const page = pages.get(refusal) ?? pageOfThePart;
      lay(refusal, page, page);
    },
    layRest({ invariants, laws }) {
      for (const [name, page] of pages) if (!under.has(`${address}/${name}`)) lay(name, page, refusalKinds.get(name) ?? page);
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
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, roles);
  if (payload !== null) {
    lay(PAYLOAD_NAME, payload.page, payload.written ?? payload.page);
    if (payload.each) layKindsRefusal(payloadRefusalName(false), payload.page);
    if (payload.kinds !== null) layKindsRefusal(payloadRefusalName(payload.each), payload.page);
  }
  for (const { name, page, kinds, each, written } of fields) {
    lay(name.name, page, written ?? page);
    if (each) layKindsRefusal(kindsRefusalAddress(name.name), page);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), page);
  }
  for (const { name, page, written } of tells) lay(name, page, written ?? page);
  return layRest(roles);
}

// [QSNAM#address], [QSSLF#manifest]
function nodesOfFunction(fn, address, scope, origin) {
  const chain = chainOfFn(fn);
  const { subject, inputs, answer } = chain;
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, chain);
  if (subject !== null) lay(SUBJECT_NAME, subject.page, subject.written ?? subject.page);
  for (const { name, page, selector, kinds, each } of inputs) {
    lay(name.name, page, selector);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), page);
  }
  if (answer !== null) lay(ANSWER_NAME, answer.page, answer.written);
  return layRest(chain);
}

// [QSNAM#scope], [QSNAM#reach]
function declaresWhatTheCallBinds(steps, scope, name) {
  const recipe = scope.get(RECIPE_KEY);
  return recipe !== undefined && recipe.steps === steps && recipe.names.has(name);
}

async function evalCall(call, state, at) {
  const name = call.get('name').name;
  const modifierSteps = call.get('modifiers') ?? [];
  if (name.includes('/')) return withRepairOfPath(await callByAddress(call, name, modifierSteps, state, at), call, state.pipeValue, state.scope);
  return withRepairOfPath(await callByName(name, modifierSteps.map(step => modifierOf(step, state)), state, call, at), call, state.pipeValue, state.scope);
}

// [QSPTH#code], [QSPTH#verbs]
function repairOfPathSubject(path, call) {
  return makeQuote([commandStep('get', [path]), call]);
}

function repairOfRefusedPath(refused, call, subject) {
  const slot = slotRefusedIn(refused.facts);
  if (slot === null || slot === SUBJECT_NAME) return isPath(subject) ? repairOfPathSubject(subject, call) : null;
  const found = refused.facts.get(`${slot}/found`);
  const index = refused.facts.get(`${slot}/index`);
  const value = isPath(found) ? found : isVec(found) && Number.isInteger(index) ? found[index] : null;
  if (!isPath(value)) return null;
  const modifiers = call.get('modifiers') ?? [];
  const written = modifiers.findIndex(modifier => isPath(modifier)
    && modifier.segments.length === value.segments.length && modifier.segments.every((segment, at) => segment === value.segments[at]));
  if (written === -1) return null;
  return makeQuote([commandStep(call.get('name').name, modifiers.map((modifier, at) => (at === written ? groupStep([commandStep('get', [modifier])]) : modifier)))]);
}

function withRepairOfPath(state, call, subject, scope) {
  const refused = state.pipeValue;
  if (!isErrorValue(refused) || refused.facts.has('repair') || refused.facts.has('trace') || !wiresTheRepair(refused.tag, scope)) return state;
  const repair = repairOfRefusedPath(refused, call, subject);
  if (repair === null) return state;
  const facts = factsInOrder(refused.tag, new Map(refused.facts).set('repair', repair), scope);
  return withPipeValue(state, makeErrorValue(refused.tag, facts, { originalError: refused.originalError }));
}

// [QSERR#site]
function wiresTheRepair(tag, scope) {
  const kind = kindOfAValueOf(scope, tag.name);
  return kind !== null && chainOfKind(kind).wired.has(REPAIR_NAME);
}

const slotRefusedIn = facts => {
  for (const key of facts.keys()) if (key.endsWith(EXPECTED_OF_A_SLOT)) return key.slice(0, -EXPECTED_OF_A_SLOT.length);
  return null;
};

// [QSNAM#reach], [QSQUO#held], [QSDSP#residence], [QSNAM#value], [QSNAM#declare]
async function callByName(lookupName, modifiers, state, call, at) {
  refuseWithheld(state.scope, lookupName);
  if (state.pipeValue === NO_SUBJECT) return await nameWithNoSubject(lookupName, modifiers, state, at);
  const reach = bareNameReach(state.scope, lookupName, state.pipeValue);
  if (reach === null) {
    const addresses = addressesOf(state.scope, lookupName);
    if (addresses.length > 0) {
      const nearest = nearestVerbs(state.scope, addresses, state.pipeValue);
      const repair = isPath(state.pipeValue) ? repairOfPathSubject(state.pipeValue, call) : undefined;
      throw new CallKindAnswersNoVerbError({ name: makeKeyword(lookupName), addresses, nearest: nearest.length > 0 ? nearest : undefined, repair, found: state.pipeValue });
    }
    throw new CallUnknownNameError({ name: makeKeyword(lookupName), nearest: nearestNames(state.scope, lookupName), addresses });
  }
  if (reach.underKind) return await applyVerb(reach.record, modifiers, state);
  return await applyBinding(reach.record, lookupName, lookupName, modifiers, state, at);
}

// [QSNAM#declare], [QSNAM#reach]
async function nameWithNoSubject(lookupName, modifiers, state, at) {
  const entry = state.scope.get(lookupName);
  if (isBinding(entry)) return await applyBinding(entry, lookupName, lookupName, modifiers, state, at);
  const addresses = addressesOf(state.scope, lookupName);
  if (addresses.length === 0) throw new CallUnknownNameError({ name: makeKeyword(lookupName), nearest: nearestNames(state.scope, lookupName), addresses });
  throw new BindSubjectNotGivenError({ name: makeKeyword(lookupName) });
}

// [QSBLD#value]
async function partCalled(address, modifiers, state) {
  const [labelName, name] = splitAddress(address);
  const walked = walkToKinds(state.pipeValue, [labelName]);
  if (walked === null) return withPipeValue(state, refusalUnder(subjectRefusalAddress(address, labelName), slotsPoured(state.pipeValue, []), state.scope));
  const served = wiringOf(walked.served) === undefined ? await layTag(labelName, walked.served, state) : walked.served;
  if (isErrorValue(served)) return withPipeValue(state, served);
  return valueCalled(wiringOf(served).get(name), name, name, modifiers, state);
}

// [QSNAM#value]
async function applyBinding(entry, name, lastName, modifiers, state, at) {
  if (isProgramRecord(entry)) return await applyFunctionVerb(entry, functionOfRecipe(bindingValueOf(entry)), modifiers, state);
  const value = bindingValueOf(entry);
  if (modifiers.length === 0 && isALaterStep(at)) throw new CallValueAsALaterStepError({ name: makeKeyword(name), found: value, addresses: addressesOf(state.scope, lastName) });
  return valueCalled(value, name, lastName, modifiers, state);
}

const isALaterStep = at => at !== undefined && at.index > 0 && !isFailStep(at.steps[at.index]) && !isBindStep(at.steps[at.index - 1]);

// [QSNAM#value], [QSDSP#residence]
function valueCalled(value, name, lastName, modifiers, state) {
  if (modifiers.length > 0) throw new CallValueTakesNoModifiersError({ name: makeKeyword(name), found: value, addresses: addressesOf(state.scope, lastName) });
  return withPipeValue(state, value);
}

// [QSNAM#address], [QSNAM#value]
async function callByAddress(call, address, modifierSteps, state, at) {
  const record = nodeOf(state.scope, address);
  if (record === null) {
    throw new CallUnknownAddressError({ address: makeTag(address), nearest: nearestTagNames(state.scope, address) });
  }
  const modifiers = modifierSteps.map(step => modifierOf(step, state));
  if (isVerb(state.scope, address)) {
    if (state.pipeValue === NO_SUBJECT) throw new BindSubjectNotGivenError({ name: makeKeyword(address) });
    return await applyVerb(record, modifiers, state);
  }
  return await applyBinding(record, address, splitAddress(address)[1], modifiers, state, at);
}

// [QSBLD#fn], [QSERR#site]
function refusalUnder(tagName, facts, scope) {
  const tag = makeTag(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)), scope));
}

// [QSERR#site]
const EXPECTED_OF_A_SLOT = '/expected';
const SUBJECT_FOUND = `${SUBJECT_NAME}/found`;

function slotsPoured(subject, held, refused = {}) {
  const facts = { [SUBJECT_FOUND]: subject };
  for (const [name, value] of held) facts[`${name}/found`] = value;
  return Object.assign(facts, refused);
}

function slotRefused(name, { expected, found, index }) {
  const facts = { [`${name}${EXPECTED_OF_A_SLOT}`]: expected, [`${name}/found`]: found };
  if (index !== undefined) facts[`${name}/index`] = index;
  return facts;
}

function heldByItsKinds({ kinds, each }, value, refusalOf, asGiven = false) {
  if (!each) {
    if (kinds === null) return value;
    const reached = walkToKinds(value, kinds);
    if (reached === null) return refusalOf(false, { expected: kindsExpected(...kinds) });
    return asGiven ? value : reached.served;
  }
  const elements = walkToKinds(value, ['vec']);
  if (elements === null) return refusalOf(false, { expected: kindsExpected('vec') });
  if (kinds === null) return elements.served;
  const refused = refusedElementOf(elements.served, kinds);
  if (refused !== null) return refusalOf(true, { expected: kindsExpected(...kinds), index: refused.index });
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
async function invariantRefusal(invariants, address, value, state, scope, factsOf) {
  for (const { name, condition } of invariants) {
    const answer = (await evalPipeline(condition, nestState(state, value, scope))).pipeValue;
    if (isErrorValue(answer)) return answer;
    if (beneathTags(answer) !== true) return refusalUnder(`${address}/${name}`, factsOf(), scope);
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
  return partAtThePlace(state.pipeValue, { path, soft: false }, state.scope);
}

function partAtThePlace(subject, { path, soft }, scope) {
  try {
    const part = readPath(subject, path, soft);
    return part === MISSED ? null : part;
  } catch (refusal) {
    return errorFromQlang(refusal, scope);
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
  return name.includes('/') || declaresALabel(record) || isProgramRecord(record);
}

// [QSBLD#input]
const ARGS_NAME = makeKeyword('args');

// [QSBLD#recipe], [QSDSP#residence]
async function applyVerb(record, modifiers, state) {
  if (isNodeOfAPart(record, state.scope)) return partCalled(record.get('name').name, modifiers, state);
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
function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state, pour) {
  const others = kinds.filter(kind => kind !== labelName);
  if (walkToKinds(answer, others) !== null) return answer;
  const refused = () => refusalUnder(kindsRefusalAddress(address), pour(slotRefused(ANSWER_NAME, { expected: kindsExpected(...kinds), found: answer })), state.scope);
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

// [QSBLD#fn], [QSHST#source], [QSBLD#recipe], [QSNAM#reach]
async function applyFunctionVerb(record, fn, modifiers, state) {
  const address = record.get('name').name;
  const ofTheRoot = isQuote(recipeOf(fn)) ? rootOf(state.scope).get(address) === record : isRootVerbScope(state.scope);
  const flight = flightOfACall();
  const answer = await callFunction(fn, { address, labelName: splitAddress(address)[0], ofTheRoot }, modifiers, state, flight);
  return withFlight(withPipeValue(state, answer), flight);
}

export async function applyFunction(fn, subject, args, state) {
  const at = { address: FN_CALL_ADDRESS, labelName: null, ofTheRoot: !isQuote(recipeOf(fn)) && isRootVerbScope(state.scope) };
  const written = writtenBy(state);
  return await callFunction(fn, at, args.map(value => () => quotesFilledWithin(value, written)), withPipeValue(state, subject), state.flight);
}

export async function inputsOfFunction(fn, args, state) {
  const called = await inputsOfCall(chainOfFn(fn), FN_CALL_ADDRESS, args.map(value => () => value), state, callScopeOf(state, false), null);
  return isErrorValue(called) ? called : called.values;
}

async function callFunction(fn, { address, labelName, ofTheRoot }, modifiers, state, flight) {
  const chain = chainOfFn(fn);
  const recipe = recipeOf(fn);
  const steps = isQuote(recipe) ? recipe : null;
  const handed = steps === null ? handedWithin(recipe, fn, state.scope) : undefined;
  if (steps === null && handed === undefined) throw new FnRecipeMissingError({ found: fn, of: addressNamedBy(recipe) });
  let walked = subjectOfCall(chain, labelName, state.pipeValue);
  const subjectRefused = expected => slotsPoured(state.pipeValue, [], { [`${SUBJECT_NAME}${EXPECTED_OF_A_SLOT}`]: expected });
  if (walked === null && labelName === null) return refusalUnder(subjectKindsRefusalAddress(address), subjectRefused(kindsExpected(...chain.subject.kinds)), state.scope);
  if (walked === null) return refusalUnder(subjectRefusalAddress(address, labelName), subjectRefused(kindsServed(labelName, chain)), state.scope);
  if (handed !== undefined && handed.labelName !== labelName) {
    walked = subjectOfCall(chain, handed.labelName, state.pipeValue);
    if (walked === null) return refusalUnder(subjectRefusalAddress(address, handed.labelName), subjectRefused(kindsServed(handed.labelName, chain)), state.scope);
  }
  const scope = callScopeOf(state, ofTheRoot);
  const called = await inputsOfCall(chain, address, modifiers, state, scope, steps, flight, steps !== null && walked.byLabel ? wiringOf(walked.served) : undefined, handed === undefined ? undefined : inputsAsCode(handed.primitive));
  if (isErrorValue(called)) return called;
  const pour = refused => slotsPoured(state.pipeValue, chain.inputs.map(({ name }, at) => [name.name, called.given[at]]), refused);
  const ofTheCall = chain.invariants.filter(({ ofTheAnswer }) => !ofTheAnswer);
  const broken = ofTheCall.length === 0 ? null : await invariantRefusal(ofTheCall, address, state.pipeValue, called.state, called.recipeScope, () => pour({}));
  if (broken !== null) return broken;
  const laid = handed !== undefined && combinesItsInput(handed.primitive) ? tagsTheOperandsShare(chain, handed.labelName, state.pipeValue, called.given) : null;
  let answer;
  try {
    const running = steps === null
      ? runPrimitive(handed.primitive, walked.served, handedTo(handed.primitive, chain, called, state, flight), withFlight(called.state, flight), address)
      : (await evalPipeline(steps, nestState(called.state, state.pipeValue, called.recipeScope))).pipeValue;
    answer = isThenable(running) ? await running : running;
  } catch (thrown) {
    throw pouredInto(thrown, address, pour, state.scope);
  }
  if (isErrorValue(answer)) return failurePoured(answer, address, pour, state.scope);
  const kinds = chain.answer?.kinds ?? null;
  const broughtFrom = laid === null ? walked : { ...walked, passedTags: laid };
  const brought = kinds === null ? answer : await answerUnderItsLabel(answer, { address: `${address}/${ANSWER_NAME}`, kinds }, walked.byLabel ? labelName : null, broughtFrom, state, pour);
  if (isErrorValue(brought)) return brought;
  const ofTheAnswer = chain.invariants.filter(invariant => invariant.ofTheAnswer);
  if (ofTheAnswer.length === 0) return brought;
  const answered = scopeSet(called.recipeScope, ANSWER_NAME, makeBinding({ name: makeKeyword(ANSWER_NAME), value: brought }));
  return await invariantRefusal(ofTheAnswer, address, state.pipeValue, called.state, answered, () => pour({ [`${ANSWER_NAME}/found`]: brought })) ?? brought;
}

// [QSERR#site]
const kindsServed = (labelName, chain) => kindsExpected(labelName, ...(chain.subject?.kinds ?? []).filter(kind => kind !== ANY_KIND_NAME));

// [QSERR#site]
const isVerdictOfTheVerb = (tagName, address, scope) => tagName.startsWith(`${address}/`) && slotsOfAVerdict(kindOfAValueOf(scope, tagName)) !== undefined;

function pouredInto(thrown, address, pour, scope) {
  if (!(thrown instanceof QlangError) || thrown instanceof QlangDefect || thrown.address === undefined || !isVerdictOfTheVerb(thrown.address, address, scope)) return thrown;
  thrown.facts = { ...pour({}), ...thrown.facts };
  return thrown;
}

function failurePoured(failure, address, pour, scope) {
  if (!isVerdictOfTheVerb(failure.tag.name, address, scope)) return failure;
  const poured = Object.entries(pour({})).filter(([, value]) => value !== undefined);
  return makeErrorValue(failure.tag, factsInOrder(failure.tag, new Map([...poured, ...failure.facts]), scope), { originalError: failure.originalError, told: failure.told });
}

// [QSHST#source]
const HANDED_BY_ADDRESS = new WeakMap();

function handedWithin(descriptor, holder, scope) {
  const handed = handedFor(descriptor, holder);
  if (handed !== undefined) return handed;
  const address = addressNamedBy(descriptor);
  if (address === undefined) return undefined;
  const root = rootOf(scope);
  let readBack = HANDED_BY_ADDRESS.get(root);
  if (readBack === undefined) HANDED_BY_ADDRESS.set(root, readBack = new WeakMap());
  if (!readBack.has(holder)) readBack.set(holder, handedFor(builtinOf(bindingValueOf(root.get(address.name))), holder, sameByTheOrder));
  return readBack.get(holder);
}

const sameByTheOrder = (held, readBack) => compareValues(held, readBack) === 0;

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

// [QSHST#source], [QSQUO#held], [QSNAM#reach]
function handedTo(primitive, chain, { values, state: called }, state, flight) {
  const asCode = inputsAsCode(primitive);
  if (asCode === undefined) return values;
  const close = closerOf(called);
  const ofTheCall = code => (typeof code === 'function' ? Object.assign(code, { flight }) : code);
  return values.map((value, at) => {
    const { name, reading } = chain.inputs[at];
    if (asCode.within?.has(name.name)) return quotesClosedIn(value, close);
    if (asCode.folded?.has(name.name)) return ofTheCall(foldingCodeOf(value, close, called));
    if (!asCode.run?.has(name.name)) return value;
    if (asCode.template?.has(name.name) && value !== null && walkToKinds(value, ['quote', 'path']) === null && !isFn(value)) return ofTheCall(templateCodeOf(value, close, called));
    return reading.readsArgs ? value.map(element => codeOfArg(element, close, state)) : ofTheCall(codeOfArg(value, close, state));
  });
}

// [QSCOL#image]
function templateCodeOf(template, close, callState) {
  const closed = quotesClosedIn(template, close);
  return async subject => await readTemplate(subject, closed, false, null, callState);
}

// [QSPTH#get]
function readOne(subject, path, soft, fallback) {
  const read = readPath(subject, path, soft);
  return read === MISSED ? fallback : read;
}

// [QSPTH#template], [QSLIT#tag]
export async function readTemplate(subject, template, soft, fallback, state) {
  if (typeof template === 'function') return await template(subject);
  if (isPath(template)) return readOne(subject, template, soft, fallback);
  if (isValueClass(template, 'underTag')) {
    const payload = await readTemplate(subject, template.payload, soft, fallback, state);
    if (payload === template.payload) return template;
    return isErrorValue(payload) ? payload : await relaid(template, payload, state);
  }
  const parts = partsOfTemplate(template);
  if (parts === null) return template;
  const read = await readParts(subject, [...parts], soft, fallback, state);
  if (isErrorValue(read)) return read;
  return await relaid(template, isMap(template) ? new Map([...template.keys()].map((key, at) => [key, read[at]])) : read, state);
}

async function readParts(subject, templates, soft, fallback, state) {
  const parts = [];
  for (const template of templates) {
    const part = await readTemplate(subject, template, soft, fallback, state);
    if (isErrorValue(part)) return part;
    parts.push(part);
  }
  return parts;
}

// [QSPTH#write], [QSPTH#template]
export async function relaid(original, rebuilt, state) {
  if (isErrorValue(rebuilt)) return rebuilt;
  const tag = original[TAG_HEADER_SYMBOL];
  if (tag === undefined) return isVec(rebuilt) ? Object.freeze(rebuilt) : rebuilt;
  return await layTag(tag.name, rebuilt, state);
}

function closerOf(state, names) {
  const written = writtenBy(state, names);
  let lane;
  return quote => {
    const code = written(quote);
    lane ??= laneStateOf(state);
    return code === quote ? closeQuote(quote, lane) : closeWritten(code, lane);
  };
}

const WRITTEN_HEADS = new WeakMap();

function closeWritten(code, lane) {
  let byLane = WRITTEN_HEADS.get(code);
  if (byLane === undefined) WRITTEN_HEADS.set(code, byLane = new WeakMap());
  let opened = byLane.get(lane.scope);
  if (opened === undefined) {
    const declared = code.slice(0, code.findIndex(step => !VALUES_WRITTEN.has(step))).map(step => {
      return [step.get('name').name, makeBinding({ name: step.get('name'), docs: step.get('docs') ?? [], value: VALUES_WRITTEN.get(step), source: makeQuote([step]) })];
    });
    opened = { steps: makeQuote(code.slice(declared.length)), scope: scopeWith(lane.scope, declared) };
    byLane.set(lane.scope, opened);
  }
  return closeQuote(opened.steps, withScope(lane, opened.scope));
}

function quotesClosedIn(value, closeOf) {
  if (isQuote(value)) return closeOf(value);
  if (isComputingStep(value)) return closeOf(codeOfAStep(value));
  if (!holdsAQuote(value)) return value;
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, quotesClosedIn(value.payload, closeOf));
  const header = value[TAG_HEADER_SYMBOL];
  const closed = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, quotesClosedIn(part, closeOf)]))
    : value.map(part => quotesClosedIn(part, closeOf));
  if (header !== undefined) stampTagHeader(closed, header);
  return closed;
}

// [QSQUO#held], [QSNAM#reach]
function quotesWithin(value, into) {
  if (isQuote(value)) {
    into.add(value);
    return;
  }
  if (isComputingStep(value)) {
    into.add(codeOfAStep(value));
    return;
  }
  if (isValueClass(value, 'underTag')) return quotesWithin(value.payload, into);
  if (!holdsAQuote(value)) return;
  for (const part of partsOfTemplate(value)) quotesWithin(part, into);
}

function quotesFilledWithin(value, fill) {
  if (isQuote(value)) return fill(value);
  if (isComputingStep(value)) return fill(codeOfAStep(value));
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, quotesFilledWithin(value.payload, fill));
  if (!holdsAQuote(value)) return value;
  const header = value[TAG_HEADER_SYMBOL];
  const filledParts = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, quotesFilledWithin(part, fill)]))
    : value.map(part => quotesFilledWithin(part, fill));
  if (header !== undefined) stampTagHeader(filledParts, header);
  return isMap(filledParts) ? filledParts : Object.freeze(filledParts);
}

const VALUES_NAMED = new WeakMap();

function valuesNamedIn(scope) {
  let named = VALUES_NAMED.get(scope);
  if (named === undefined) {
    named = new Map(nodesAndLabelsOf(scope).values.map(name => [name, scope.get(name)]));
    VALUES_NAMED.set(scope, named);
  }
  return named;
}

const VALUES_WRITTEN = new WeakMap();

function declarationWritten(name, record) {
  const value = bindingValueOf(record);
  const step = declarationStep(name, record.get('docs'), value);
  VALUES_WRITTEN.set(step, value);
  return step;
}

const FILLED = new WeakMap();

function filled(quote, records) {
  let byRecords = FILLED.get(quote);
  if (byRecords === undefined) FILLED.set(quote, byRecords = new WeakMap());
  let code = byRecords.get(records);
  if (code === undefined) {
    const read = namesAQuoteReads(quote).filter(name => records.has(name));
    code = read.length === 0 ? quote : makeQuote([...read.map(name => declarationWritten(name, records.get(name))), ...quote]);
    byRecords.set(records, code);
  }
  return code;
}

function writtenBy(state, names) {
  let named;
  let withSelf;
  const given = names === undefined ? undefined : new Map([...names].map(([name, value]) => [name, makeBinding({ name: makeKeyword(name), value })]));
  const ofTheStep = () => named ??= given === undefined ? valuesNamedIn(ownScopeOf(state)) : new Map([...valuesNamedIn(ownScopeOf(state)), ...given]);
  const ofTheStepAndItsSubject = () => withSelf ??= ofTheStep().has(SELF_NAME) || state.pipeValue === NO_SUBJECT
    ? ofTheStep()
    : new Map([...ofTheStep(), [SELF_NAME, makeBinding({ name: makeKeyword(SELF_NAME), value: state.pipeValue })]]);
  return quote => {
    if (writtenIn(state, quote)) return filled(quote, namesAQuoteReads(quote).includes(SELF_NAME) ? ofTheStepAndItsSubject() : ofTheStep());
    return given === undefined ? quote : filled(quote, given);
  };
}

function laneStateOf(state) {
  return withScope(state, laneOf(ownScopeOf(state)));
}

const HOLDERS_OF_QUOTES = new WeakMap();

function holdsAQuote(value) {
  if (isQuote(value) || isComputingStep(value)) return true;
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

function codeOfArg(value, close, callState) {
  const code = walkToKinds(value, ['quote', 'path'])?.served ?? value;
  if (isQuote(code)) return close(code);
  return isPath(code) ? codeOfPath(code, callState) : value;
}

// [QSCOL#reduce]
function foldingCodeOf(value, close, called) {
  const code = codeOfArg(value, close, called);
  const onThePair = async (acc, element) => await code([acc, element]);
  if (!isQuote(value) || value.length !== 1 || !isCallStep(value[0]) || value[0].has('modifiers')) return onThePair;
  const call = value[0];
  const name = call.get('name').name;
  const lane = laneStateOf(called);
  const records = writtenIn(called, value) ? valuesNamedIn(ownScopeOf(called)) : new Map();
  const read = namesAQuoteReads(value).filter(readName => records.has(readName));
  const callerState = read.length === 0 ? lane : withScope(lane, scopeWith(lane.scope, read.map(readName => [readName, records.get(readName)])));
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

// [QSBLD#input]
function withTheTail(chain, modifiers, state) {
  const { arity } = chain;
  if (arity === null || arity === 0 || modifiers.length <= arity) return modifiers;
  const step = modifiers[arity - 1].step;
  if (!isCallStep(step) || step.has('modifiers') || namesAValue(step, state.scope)) return modifiers;
  const tail = commandStep(step.get('name').name, modifiers.slice(arity).map(modifier => modifier.step));
  return [...modifiers.slice(0, arity - 1), modifierOf(tail, state)];
}

// [D417], [QSBLD#input], [QSBLD#recipe], [QSNAM#reach], [QSNUM#combine]
async function inputsOfCall(chain, address, modifiersWritten, state, scope, recipeSteps, flight, parts, asCode) {
  const modifiers = withTheTail(chain, modifiersWritten, state);
  const values = [];
  const written = new Set();
  const writtenAt = [];
  const codeInputs = inputsTakingCode(chain, asCode);
  const inputAt = index => chain.inputs.find(({ reading }) => !reading.readsArgs && reading.index === index) ?? chain.inputs.find(({ reading }) => reading.readsArgs);
  for (const [index, modifier] of modifiers.entries()) {
    const input = inputAt(index);
    const takesCode = input !== undefined && codeInputs.has(input.name.name);
    if (!takesCode && modifier.holdsSteps === true) heldAsALiteral(modifier.step, CallLiteralComputesError, { index }, asPrinted);
    const handsCode = takesCode && modifier.code !== undefined;
    const computing = handsCode ? modifier.code : modifier(state.pipeValue, flight);
    const value = isThenable(computing) ? await computing : computing;
    if (isErrorValue(value)) return value;
    const refused = takesCode ? refusalOfWrittenCode(`${address}/${input.name.name}`, input, modifier, value, state, scope) : null;
    if (refused !== null) return refused;
    values.push(value);
    const ofTheStep = handsCode || modifier.written === true;
    writtenAt.push(ofTheStep);
    if (ofTheStep) quotesWithin(value, written);
  }
  const called = withWritten(state, written);
  if (recipeSteps !== null) handedToTheRecipe(values, writtenAt, called);
  let args = null;
  const argsValue = () => args ??= makeTagged(makeTag(address), values);
  if (chain.arity !== null && values.length > chain.arity) {
    return refusalUnder(argsBeyondInputsAddress(address), slotsPoured(state.pipeValue, inputsOfTheArgs(chain, values), { [`${SURPLUS_NAME}/found`]: Object.freeze(values.slice(chain.arity)) }), scope);
  }
  const named = recipeSteps !== null || chain.invariants.length > 0;
  const recipeScope = named ? withTheParts(scopeSet(scope, ARGS_NAME.name, makeBinding({ name: ARGS_NAME, value: argsValue() })), parts) : null;
  if (recipeSteps !== null) recipeScope.set(RECIPE_KEY, { steps: recipeSteps, names: new Set([ARGS_NAME.name, ...chain.inputs.map(({ name }) => name.name), ...(parts?.keys() ?? [])]) });
  const overArgs = () => nestState(called, argsValue(), scope);
  const inputValues = [];
  const given = [];
  const poured = [];
  for (const input of chain.inputs) {
    const { name } = input;
    const inputAddress = `${address}/${name.name}`;
    depthBelow(state);
    const reached = selectedValue(input.reading, values, overArgs);
    const read = isThenable(reached) ? await reached : reached;
    if (read === MISSED_ARG || (isErrorValue(read) && isMissedPart(read))) return refusalUnder(notGivenAddress(inputAddress), slotsPoured(state.pipeValue, poured), scope);
    if (isErrorValue(read)) return read;
    given.push(read);
    const refusalOf = (each, refused) => refusalUnder(refusalsUnder(inputAddress)(each), slotsPoured(state.pipeValue, poured, slotRefused(name.name, { ...refused, found: read })), scope);
    const held = heldByItsKinds(input, read, refusalOf, recipeSteps !== null || asCode?.given?.has(name.name) === true);
    if (isErrorValue(held)) return held;
    poured.push([name.name, read]);
    inputValues.push(held);
    if (named) recipeScope.set(name.name, makeBinding({ name, value: held }));
  }
  return { values: inputValues, given, recipeScope, state: called };
}

// [QSQUO#held]
function handedToTheRecipe(values, writtenAt, called) {
  const written = writtenBy(called);
  const named = valuesNamedIn(ownScopeOf(called));
  for (const [at, value] of values.entries()) {
    if (writtenAt[at]) {
      values[at] = quotesFilledWithin(value, written);
      continue;
    }
    const held = new Set();
    quotesWithin(value, held);
    for (const quote of held) {
      const read = namesAQuoteReads(quote).find(name => named.has(name));
      if (read !== undefined) throw new CallValueWithheldError({ name: makeKeyword(read) });
    }
  }
}

// [QSERR#site]
const inputsOfTheArgs = (chain, values) => chain.inputs
  .filter(({ reading }) => reading.oneArg && !reading.readsArgs && reading.index < values.length)
  .map(({ name, reading }) => [name.name, values[reading.index]]);

// [QSBLD#recipe]
function withTheParts(scope, parts) {
  if (parts !== undefined) for (const [name, part] of parts) scope.set(name, makeBinding({ name: makeKeyword(name), value: part }));
  return scope;
}

// [QSQUO#modifier]
function refusalOfWrittenCode(inputAddress, input, modifier, value, state, scope) {
  const facts = () => slotsPoured(state.pipeValue, [], { [`${input.name.name}/found`]: value });
  if (quotedTwice(value, state.scope)) return refusalUnder(quotedTwiceRefusalAddress(inputAddress), facts(), scope);
  if (writtenAsAQuote(modifier)) return refusalUnder(quotedRefusalAddress(inputAddress), facts(), scope);
  return null;
}

const isCodeValue = value => isQuote(value) || isFn(value) || isPath(value);

function quotedTwice(code, scope) {
  if (!isQuote(code)) return false;
  const steps = code.filter(step => !isBindStep(step));
  if (steps.length !== 1) return false;
  const [step] = steps;
  if (isQuote(step)) return true;
  if (!isCallStep(step) || step.has('modifiers')) return false;
  const name = step.get('name').name;
  return !name.includes('/') && holdsAValueOf(scope, name) && isCodeValue(bindingValueOf(scope.get(name)));
}

function writtenAsAQuote({ step }) {
  if (step === undefined) return false;
  if (isQuote(step) || quoteUnderTags(step)) return true;
  return isTemplate(step) && holdsAQuoteWritten(step);
}

const quoteUnderTags = step => isConstructStep(step) && (isQuote(step.get('payload')) || quoteUnderTags(step.get('payload')));

function holdsAQuoteWritten(literal) {
  for (const part of partsOfATemplate(literal)) {
    if (isQuote(part) || quoteUnderTags(part)) return true;
    if (!isComputingStep(part) && holdsAQuoteWritten(part)) return true;
  }
  return false;
}

// [QSPTH#template]
const BUILDS_A_VALUE_OF_CODE = new Set([FN_TAG_NAME, KIND_TAG_NAME]);

function partsOfATemplate(literal) {
  if (isConstructStep(literal)) return BUILDS_A_VALUE_OF_CODE.has(literal.get('tag').name) ? [] : [literal.get('payload')];
  const fields = errorFieldsOf(literal);
  if (fields !== null) return [...fields.values()];
  if (isVec(literal) || isSet(literal)) return isQuote(literal) || isDoc(literal) || isFn(literal) || isKind(literal) ? [] : literal;
  return isMap(literal) && !isCallStep(literal) && !isBindStep(literal) ? [...literal.values()] : [];
}

// [QSDSP#answer], [QSBLD#kind], [QSLIT#tag], [QSBLD#label], [QSERR#flow], [QSQUO#held]
export async function layTag(tagName, laidOver, state) {
  if (isErrorValue(laidOver)) return laidOver;
  const step = ownStateOf(state);
  refuseWithheld(step.scope, tagName, true);
  const [outermost] = tagsOver(laidOver);
  if (outermost !== tagName && walkToKinds(laidOver, [tagName]) !== null) return laidOver;
  const payload = outermost === tagName ? payloadBeneath(laidOver) : laidOver;
  const node = nodeOf(step.scope, tagName);
  const declared = bindingValueOf(node);
  const kind = kindOfAValueOf(step.scope, tagName);
  if (kind !== null) return await underKind(tagName, kind, payload, step, refusalsAddressOf(step.scope, tagName));
  if (isDoc(declared) || node === null || isVerb(step.scope, tagName) || isInvariant(declared)) return makeTagged(makeTag(tagName), payload);
  throw new ConstructTagNamesAValueError({ address: makeTag(tagName), found: declared });
}

// [QSBLD#value]
function payloadHeldByItsKinds({ kinds, each }, tagName, payload, scope) {
  const refusalOf = each => `${tagName}/${payloadRefusalName(each)}`;
  const ownKinds = each ? ['vec'] : kinds;
  if (ownKinds !== null && !ownKinds.includes(tagOf(payload).name) && !(ownKinds.includes(ERROR_TAG.name) && isExcerpt(payload))) {
    return refusalUnder(refusalOf(false), { expected: kindsExpected(...ownKinds), found: payload }, scope);
  }
  if (!each || kinds === null) return payload;
  const refused = refusedElementOf(payload, kinds);
  if (refused !== null) return refusalUnder(refusalOf(true), { expected: kindsExpected(...kinds), found: payload, index: refused.index }, scope);
  return Object.freeze(Array.from(payload, element => walkToKinds(element, kinds).served));
}

// [QSBLD#value], [QSLIT#tag], [QSHST#source], [QSERR#rest], [QSBLD#kind]
async function underKind(tagName, kind, written, state, refusedUnder = tagName) {
  const { payload: payloadRole, fields, invariants } = chainOfKind(kind);
  const ofAnError = holdsTheFactsOfAnError(payloadRole);
  const payload = ofAnError ? await withItsTraceLaid(written, state) : written;
  const held = payloadRole === null ? payload : payloadHeldByItsKinds(payloadRole, refusedUnder, payload, state.scope);
  if (isErrorValue(held)) return held;
  let scope;
  const opened = () => scope ??= callScopeOf(state, rootOf(state.scope).get(tagName) === nodeOf(state.scope, tagName));
  const facts = ofAnError ? factsOfAnError(held) : held;
  const ofFacts = ofAnError ? { told: isExcerpt(facts), slots: slotsOfAVerdict(kind) } : null;
  const parts = new Map();
  for (const field of fields) {
    const reading = fieldRead(refusedUnder, field, facts, state, opened, ofFacts);
    const part = isThenable(reading) ? await reading : reading;
    if (isErrorValue(part)) return part;
    parts.set(field.name.name, part);
  }
  const constructs = handedWithin(constructorOf(kind), kind, state.scope)?.primitive;
  const constructed = constructs === undefined ? held : await heldAtTheDoor(constructs, () => constructs(held), tagName, [held]);
  const labelled = constructs !== undefined && tagOf(constructed).name === tagName ? constructed : makeTagged(makeTag(tagName), constructs === undefined ? payload : constructed, fields.length === 0 ? undefined : parts);
  const refused = invariants.length === 0 ? null : await invariantRefusal(invariants, refusedUnder, constructed, state, scopeWith(opened(), [...parts].map(([name, part]) => [name, makeBinding({ name: makeKeyword(name), value: part })])), () => ({ found: payload }));
  return refused ?? labelled;
}

// [QSERR#rest]
const holdsTheFactsOfAnError = payloadRole => payloadRole?.kinds?.includes(ERROR_TAG.name) === true;

// [QSERR#trace]
async function withItsTraceLaid(payload, state) {
  if (!isMap(payload) || tagOf(payload).name !== ERROR_TAG.name || !isVec(payload.get('trace')) || tagOf(payload.get('trace')).name !== 'vec') return payload;
  return makeTagged(ERROR_TAG, await factsWithTheirTrace(payload, state));
}

const factsOfAnError = held => (tagsOver(held)[0] === ERROR_TAG.name && isExcerpt(beneathTags(held)) ? beneathTags(held) : held);

// [QSBLD#value], [QSERR#rest]
function fieldRead(tagName, field, payload, state, opened, ofFacts) {
  const slot = ofFacts?.slots?.get(field.name.name);
  if (slot !== undefined) return slotOfTheFacts(slot, field.name.name, payload, state);
  if (field.place !== null) return fieldHeld(tagName, field, payload, partAtThePlace(payload, field.place, state.scope), state, ofFacts);
  return answerOfPipeline(field.selector, nestState(state, payload, opened())).then(read => fieldHeld(tagName, field, payload, read, state, ofFacts));
}

// [QSERR#site]
async function slotOfTheFacts(address, name, facts, state) {
  const parts = new Map();
  for (const [key, fact] of facts) if (key.startsWith(`${name}/`)) parts.set(key.slice(name.length + 1), fact);
  return parts.size === 0 ? null : await layTag(address, parts, state);
}

function fieldHeld(tagName, field, payload, read, state, ofFacts) {
  const fieldAddress = `${tagName}/${field.name.name}`;
  if (ofFacts !== null && ((isErrorValue(read) && isMissedPart(read)) || read === null)) return null;
  if (ofFacts?.told && isCell(read)) return read;
  if (isErrorValue(read) && isMissedPart(read)) return refusalUnder(notGivenAddress(fieldAddress), { found: payload }, state.scope);
  if (isErrorValue(read)) return refusalOfAPartNotRead(fieldAddress, read, state);
  const refusalOf = (each, refused) => refusalUnder(refusalsUnder(fieldAddress)(each), { ...refused, found: read }, state.scope);
  const held = heldByItsKinds(field, read, refusalOf);
  return isErrorValue(held) ? held : read;
}

async function refusalOfAPartNotRead(fieldAddress, read, state) {
  const atRest = await errorAtRestOf(read, state);
  return isErrorValue(atRest) ? atRest : refusalUnder(notReadAddress(fieldAddress), { found: atRest }, state.scope);
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

// [QSQUO#held], [QSNAM#verb], [QSERR#trace], [QSQUO#modifier]
function modifierOf(step, state) {
  if (isQuote(step)) return Object.assign(writtenInTheStep(() => step), { step });
  if (isTemplate(step)) return Object.assign(writtenInTheStep(closeStep(step, state)), { step, holdsSteps: computesWithin(step) });
  const computing = Object.assign(closeStep(step, state), { step });
  if (restsAsCode(step, state.scope)) computing.code = codeOfAStep(step);
  return computing;
}

// [QSQUO#modifier]
const SELF_NAME = 'self';
const CODES_OF_STEPS = new WeakMap();

function codeOfAStep(step) {
  if (isGroupStep(step)) return step.payload;
  let code = CODES_OF_STEPS.get(step);
  if (code === undefined) CODES_OF_STEPS.set(step, code = makeQuote([step]));
  return code;
}

const headOfCode = steps => steps.find(step => !isBindStep(step));

function holdsAValueOf(scope, name) {
  const entry = scope.get(name);
  return isBinding(entry) && !isProgramRecord(entry);
}

function namesAValue(step, scope) {
  const name = step.get('name').name;
  return name.includes('/') ? !isVerb(scope, name) : holdsAValueOf(scope, name);
}

function restsAsCode(step, scope) {
  return isGroupStep(step) || (isCallStep(step) && !namesAValue(step, scope));
}

// [QSNAM#declare]
function asksForASubject(step, scope, declaredInside = new Map()) {
  if (isGroupStep(step)) {
    const declared = new Map(declaredInside);
    for (const held of step.payload) {
      if (!isBindStep(held)) break;
      declared.set(held.get('name').name, held.has('body') && asksForASubject(held.get('body'), scope, declared));
    }
    const head = headOfCode(step.payload);
    return isGroupStep(head) || asksForASubject(head, scope, declared);
  }
  if (!isCallStep(step)) return false;
  const name = step.get('name').name;
  return declaredInside.has(name) ? declaredInside.get(name) : !namesAValue(step, scope);
}

// [QSQUO#held]
const isTemplate = step => isConstructStep(step) || errorFieldsOf(step) !== null || isSet(step) || ((isVec(step) || isMap(step)) && step[TAG_HEADER_SYMBOL] === undefined);

const writtenInTheStep = code => Object.assign(code, { written: true });

// [QSPTH#code]
function codeOfPath(path, callState) {
  const step = () => makeQuote([commandStep('get', [path])]);
  return async subject => {
    try {
      return readPath(subject, path);
    } catch (refusal) {
      return answerOfStep(errorFromQlang(refusal, callState.scope), step, subject, callState.scope);
    }
  };
}

// [QSQUO#literal], [QSQUO#held]
export function codeOf(code, callState) {
  return closerOf(callState)(code);
}

// [QSPTH#template], [QSQUO#held], [QSNAM#scope]
export function templateClosedIn(template, callState, names = new Map()) {
  return quotesClosedIn(template, closerOf(callState, names));
}

const LANES = new WeakMap();

function laneOf(scope) {
  let lane = LANES.get(scope);
  if (lane !== undefined) return lane;
  const { scope: kept, values } = nodesAndLabelsOf(scope);
  lane = kept.set(WITHHELD_KEY, new Set([...(scope.get(WITHHELD_KEY) ?? []), ...values]));
  if (scope.has(QUERY_KEY)) lane.set(QUERY_KEY, scope.get(QUERY_KEY));
  if (isRootVerbScope(scope)) markRootVerbScope(lane);
  LANES.set(scope, lane);
  return lane;
}
