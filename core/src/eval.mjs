// The evaluator: the records of the steps of a quote run by their tags, a
// quote read from text and one assembled from data alike, on the state pair
// of value and scope [QSQUO#step].

import { ROOT_KEY, QUERY_KEY, RECIPE_KEY, WITHHELD_KEY } from './scope-keys.mjs';
import {
  withPipeValue, withScope, nestState, depthBelow, scopeSet, scopeHas, rootOf, markRootVerbScope, isRootVerbScope, queryTreeOf,
  withCall, originIn, ownScopeOf
} from './state.mjs';
import { declareRefusal, QlangError, QlangInvariantError, CallUnknownNameError, CallUnknownAddressError, BindNameDeclaredTwiceError } from './errors.mjs';
import { nearestNames, nearestTagNames, nearestVerbs } from './nearest-names.mjs';
import { readPath, partsOfTemplate, isMissedPart } from './path-read.mjs';
import {
  isSet, isVec, isMap, isErrorValue, isQuote, isDoc, isPath, primitiveOf,
  typeOf, keyword, makeErrorValue, makeDoc, makeQuote,
  makeBinding, bindingValueOf, makeTagged, makeTag, errorAtRest, beneathTags,
  isFn, isKind, recipeOf, constructorOf, stampTagHeader, TAG_HEADER_SYMBOL,
  ERROR_TAG, TRACE_TAG, isValueClass
} from './types.mjs';
import { makeSet, kindsExpected } from './ordering.mjs';
import { partOf, originOf, repeatsDeclarationAt } from './walk.mjs';
import {
  isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, errorFieldsOf,
  tagCallStepOf, commandStep, groupStep
} from './steps.mjs';
import { errorFromQlang, errorFromForeign, factsInOrder } from './error-convert.mjs';
import {
  INVARIANT_TAG, LAW_TAG, addressesOf, bareNameReach, declaresALabel, isInvariant, isLabel, isVerbValue, isRecipe, isUnderLabel, isVerb, nodeOf, refuseWithheld, residenceOnSubject, returnsItsLabel, CallValueWithheldError
} from './nouns.mjs';
import { ANSWER_NAME, CONSTRUCT_NAME, PAYLOAD_NAME, SUBJECT_NAME, functionOfRecipe, invariantsOf, chainOfKind, pageOfConstructor, pageOfKindsRefusal, chainOfFn } from './chain.mjs';
import { inputsRunBy, inputsRunWithin, inputsFoldedBy } from './primitives.mjs';
import {
  splitAddress, argsBeyondInputsAddress, subjectKindsRefusalAddress, elementsRefusalAddress, kindsRefusalAddress,
  notGivenAddress, payloadRefusalName, subjectRefusalAddress
} from './address.mjs';
import { runPrimitive, heldAtTheDoor, isThenable, walkToKinds, subjectOfCall, servesTheSubject } from './dispatch.mjs';
import {
  answerOfStep, answerOfElement, skipping, raisedBy, isRaisedBy
} from './eval-trace.mjs';

// The tag of a name that holds data puts no value under it: a value goes
// under a label, a verb, an invariant or a tag no node answers [QSBLD#label].
const ConstructTagNotKindError = declareRefusal('construct/TagNotKindError');
const CallValueMeetsVerbError = declareRefusal('call/ValueMeetsVerbError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError = declareRefusal('call/ValueTakesNoModifiersError');
const FnRecipeMissingError = declareRefusal('fn/RecipeMissingError');
const BindWrittenOutsideItsChainError = declareRefusal('bind/WrittenOutsideItsChainError');

// A call of a name no kind of whose subject answers names what the reader
// needs: where the verbs of the name live [QSDSP#refusal].
const CallKindAnswersNoVerbError = declareRefusal('call/KindAnswersNoVerbError');

// evalPipeline(steps, state) → the state after the steps of a pipeline, its
// head riding `|` like every other step, which a query, a condition, a place,
// a recipe, a group and the code a verb runs all go through [QSQUO#step].
export async function evalPipeline(steps, state, origin = originOf(steps)) {
  let current = state;
  for (const [index, step] of steps.entries()) {
    const at = { steps, index, origin };
    current = isFailStep(step) ? await applyFailTrack(current, step.payload[0], at) : await applySuccessTrack(current, step, at);
  }
  return current;
}

// The state a step answers, its throw the failure the step raised; the step
// that ran it writes its frame [QSERR#trace].
async function evalStep(step, state, at) {
  try {
    return await evaluatorOf(step)(step, state, at);
  } catch (caughtError) {
    return withPipeValue(state, raisedBy(errorOfThrow(caughtError, step, state.pipeValue, state.scope), step));
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

// The failure a throw at a step raised against the subject it met, located
// at the step's span, a defect of the runtime riding past the fail track.
function errorOfThrow(caughtError, step, subject, scope) {
  if (caughtError instanceof QlangInvariantError) throw caughtError;
  const span = partOf(step)?.span ?? null;
  return caughtError instanceof QlangError ? errorFromQlang(caughtError, subject, scope, span) : errorFromForeign(caughtError, span, scope);
}

// factsWithTheirTrace(facts, state) → the facts with the `:trace` they write
// laid through the label of `::trace`, an empty one none [QSERR#trace].
export async function factsWithTheirTrace(facts, state) {
  if (!facts.has('trace')) return facts;
  const trace = await layTag(TRACE_TAG.name, facts.get('trace'), state);
  const laid = new Map(facts);
  if (trace.length > 0) laid.set('trace', trace);
  else laid.delete('trace');
  return laid;
}

// ─── The tracks ─────────────────────────────────────────────────

// The fork rule: a nested pipeline or a group starts from the outer
// state and hands back its value alone, its declarations left behind, at
// the evaluation depth of the outer state [QSNAM#scope], [QSNAM#verb].
async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

// `|` runs the step on a value, an error it answers taking a frame there,
// and an error in the pipe skips it, the step joining the skipped steps of
// its last frame [QSERR#trace].
async function applySuccessTrack(state, step, at) {
  if (isErrorValue(state.pipeValue)) return withPipeValue(state, skipping(state.pipeValue, step, state.scope));
  const answered = await evalStep(step, state, at);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => makeQuote([step]), state.pipeValue, state.scope));
}

// `!|` alone catches a failure, its step running on the error at rest, the
// map of its facts, `:trace` among them, under `::error` and the tag of
// the site that refused laid through its label as a tagged literal lays
// it, so `!| type` reads the site and a verb of `::error` reaches every
// error, a value passing, a label's refusal answering for the catch, and a
// raise that writes the `:trace` it read resuming it [QSERR#catch],
// [QSERR#rest], [QSERR#trace].
async function applyFailTrack(state, step, at) {
  if (!isErrorValue(state.pipeValue)) return state;
  const raised = state.pipeValue;
  const errorOfKind = makeTagged(ERROR_TAG, new Map(raised.facts));
  let atRest;
  try {
    atRest = raised.tag.name === ERROR_TAG.name ? errorOfKind : await layTag(raised.tag.name, errorOfKind, state);
  } catch (caughtError) {
    atRest = errorOfThrow(caughtError, step, errorOfKind, state.scope);
  }
  if (isErrorValue(atRest)) return withPipeValue(state, answerOfStep(atRest, () => makeQuote([step]), errorOfKind, state.scope));
  const answered = await evalStep(step, withPipeValue(state, atRest), at);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => makeQuote([step]), atRest, state.scope));
}

// A group runs its quote as a fork, a step of the quote that holds it
// [QSNAM#scope].
async function evalGroup(group, state, at) {
  return await fork(state, inner => evalPipeline(group.payload, inner, at?.origin ?? originOf(group.payload)));
}

// ─── Literals ───────────────────────────────────────────────────

// A literal that holds no part answers itself, a quote among them, the code
// it holds unrun.
function evalItself(step, state) {
  return withPipeValue(state, step);
}

// Each element and each value of a literal is a literal, read one after
// another in the order the literal holds them [QSQUO#modifier], none reading
// the scope or the subject [QSLIT#closed]; a failure lives in the pipe
// alone, so the first an element answers, a kind's refusal of its payload, is
// the answer of the literal, the elements after it left unread [QSERR#flow].
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
    const answered = await elementAnswer(element, state);
    if (isErrorValue(answered)) return answered;
    values.push(answered);
  }
  return values;
}

async function entryValues(map, state) {
  const values = await elementValues([...map.values()], state);
  return isErrorValue(values) ? values : new Map([...map.keys()].map((key, index) => [key, values[index]]));
}

// The value an element of a literal answers: a refusal the kind of its tag
// raised passes a frame at the element, and one handed on from an element
// inside it goes on as it is to the literal it fails [QSERR#trace].
async function elementAnswer(element, state) {
  return answerOfElement((await evalStep(element, state)).pipeValue, element, state.pipeValue, state.scope);
}

// An error literal is the literal of the kind of errors, as `#[…]` is the
// set's: `!{…}` is `::error{…}`, an error at rest, and `::Foo!{…}` is
// `::Foo::error{…}`, laid through the label of its tag as a tagged literal
// lays a payload, a refusal of the label answering for the literal; every
// entry is a fact, and `raise` raises the error [QSERR#rest].
async function evalErrorLiteral(step, state) {
  const facts = await entryValues(errorFieldsOf(step), state);
  if (isErrorValue(facts)) return withPipeValue(state, facts);
  const atRest = await layTag(ERROR_TAG.name, facts, state);
  return withPipeValue(state, isValueClass(step, 'underTag') ? await layTag(step.tag.name, atRest, state) : atRest);
}

// A doc's quote takes the role the tags written before it give, each laid
// over the quote through its label as a tagged literal lays a payload, so a
// tag whose label takes no quote refuses the doc,
// `|~~ see ::number~(~(x)) ~~|` as `::number~(~(x))` does [QSSLF#doc].
async function evalDoc(doc, state) {
  for (const segment of doc) {
    if (!isValueClass(segment, 'underTag')) continue;
    const tags = [];
    for (let over = segment; isValueClass(over, 'underTag'); over = over.payload) tags.push(over.tag);
    let laid = beneathTags(segment);
    for (const tag of tags.reverse()) {
      laid = await layTag(tag.name, laid, state);
      if (isErrorValue(laid)) return withPipeValue(state, laid);
    }
  }
  return withPipeValue(state, doc);
}

// A tagged literal lays its tag over its payload through the tag's label.
async function evalConstruct(construct, state) {
  const tagName = construct.get('tag').name;
  const payloadStep = construct.get('payload');
  const payload = (await evalStep(payloadStep, state)).pipeValue;
  if (isErrorValue(payload)) return withPipeValue(state, passedUntagged(payload, construct, payloadStep, tagName, state.scope));
  return withPipeValue(state, await layTag(tagName, payload, state));
}

// The error a tagged literal's payload answered, passed by the tag as an
// error passes every step, the tag's step joining the skipped steps of
// its last frame [QSERR#trace], and the literal's own raise where the payload
// raised it.
function passedUntagged(payloadError, construct, payloadStep, tagName, scope) {
  const passed = skipping(payloadError, tagCallStepOf(makeTag(tagName)), scope);
  if (isRaisedBy(payloadError, payloadStep)) raisedBy(passed, construct);
  return passed;
}

// ─── Declarations ───────────────────────────────────────────────

// The one binding form: the value passes on, and a fresh scope holds the
// record of the binding, whose value is the body evaluated once at declaration
// against the current value, `42 | :x it | add 1 | x` answering 42, a quote
// among them as the data it is [QSBLD#fn], a declaration of docs alone binding
// them as a page, and a body that fails answering the failure, which no name
// holds [QSERR#flow]; a name is declared once in its scope [QSNAM#scope], a
// node the root holds once at all and a name with a path under a noun declared
// before it [QSNAM#address], never a value withheld from held code
// [QSQUO#held]; what the chain of a kind or a function holds alone, declared
// by a name, is refused [QSBLD#chain].
async function evalBind(bind, state, at) {
  const name = bind.get('name').name;
  const [nounName] = splitAddress(name);
  if (nounName !== null) refuseWithheld(state.scope, nounName, true);
  if (repeatsDeclarationAt(at.steps, at.index) || declaresWhatTheCallBinds(at.steps, state.scope, name) || (nounName !== null && rootOf(state.scope).has(name))) {
    throw new BindNameDeclaredTwiceError({ name: keyword(name) });
  }
  if (nounName !== null && !scopeHas(state.scope, nounName)) {
    throw new BindNounNotDeclaredError({ name: keyword(name), noun: makeTag(nounName) });
  }

  const docs = bind.get('docs') ?? [];
  const answered = bind.has('body')
    ? (await evalStep(bind.get('body'), state)).pipeValue
    : makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
  if (isErrorValue(answered)) return withPipeValue(state, answered);
  if (writesOutsideItsChain(state.scope, nounName, splitAddress(name)[1], answered)) {
    throw new BindWrittenOutsideItsChainError({ name: keyword(name), noun: nounName === null ? undefined : makeTag(nounName) });
  }
  const origin = keyword(at.origin);
  const declared = scopeSet(state.scope, name, makeBinding({ name: bind.get('name'), docs, value: answered, source: makeQuote([bind]), origin }));
  if (!bind.has('body')) return withScope(state, declared);
  if (isKind(answered)) return withScope(state, nodesOfKind(answered, name, declared, origin));
  return withScope(state, nounName !== null && isFn(answered) ? nodesOfFunction(answered, name, declared, origin) : declared);
}

// Whether a declaration writes by name a role the chain of a kind or of a
// function holds alone [QSBLD#chain].
function writesOutsideItsChain(scope, nounName, lastName, value) {
  if (isInvariant(value)) return true;
  if (nounName === null) return false;
  if (isLabel(scope, nounName)) return lastName === CONSTRUCT_NAME;
  return isVerb(scope, nounName) && (isPath(value) || isQuote(value) || lastName === ANSWER_NAME || lastName === SUBJECT_NAME);
}

// The nodes a chain lays under an address for `doc`, `manifest`, `laws`
// and the tools, each a name, its page and its value: the refusal of the
// kinds a role names under the page `throws` gives it or its own, and the
// pages, facts, invariants and laws of the chain last.
function layerOf(scope, address, origin, pages) {
  let under = scope;
  const lay = (lastName, page, value) => {
    const name = `${address}/${lastName}`;
    under = scopeSet(under, name, makeBinding({ name: keyword(name), docs: [page], value, origin }));
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

// The nodes a kind lays under its address, each role of its chain with its
// page, which its values never read, and its constructor [QSBLD#label].
function nodesOfKind(kind, address, scope, origin) {
  const roles = chainOfKind(kind);
  const { payload, fields, tells } = roles;
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, roles.pages);
  if (payload !== null) {
    const holder = keyword(PAYLOAD_NAME);
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
  if (constructorOf(kind) !== null) lay(CONSTRUCT_NAME, pageOfConstructor(address), constructorOf(kind));
  return layRest(roles);
}

// The nodes a function named under a label lays under its address, each
// role of its chain with its page, which its call never reads [QSNAM#address].
function nodesOfFunction(fn, address, scope, origin) {
  const chain = chainOfFn(fn);
  const { subject, inputs, answer } = chain;
  const { lay, layKindsRefusal, layRest } = layerOf(scope, address, origin, chain.pages);
  if (subject !== null) lay(SUBJECT_NAME, subject.page, subject.written ?? subject.page);
  for (const { name, page, place, kinds, each } of inputs) {
    lay(name.name, page, place);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), name, kinds, each);
  }
  if (answer !== null) lay(ANSWER_NAME, answer.page, answer.written);
  return layRest(chain);
}

// Whether a declaration among the steps of the recipe of a verb names what
// its call bound in the scope the recipe runs in, `args` or an input; a
// group of the recipe is a scope of its own [QSNAM#scope].
function declaresWhatTheCallBinds(steps, scope, name) {
  const recipe = scope.get(RECIPE_KEY);
  return recipe !== undefined && recipe.steps === steps && recipe.names.has(name);
}

// ─── Calls ──────────────────────────────────────────────────────

async function evalCall(call, state) {
  const name = call.get('name').name;
  const modifierSteps = call.get('modifiers') ?? [];
  if (name.includes('/')) return await callByAddress(call, name, modifierSteps, state);
  return withRepairOfPath(await callByName(name, modifierSteps.map(step => modifierOf(step, state)), state, call), call, state.pipeValue, state.scope);
}

// The repair, the step a call was likely meant as where a path stands in
// the place of the value it names [QSPTH#code], [QSPTH#verbs]: a verb called on a path,
// `/tags | count` repaired as `get /tags | count`, and an input refusing the
// path a modifier wrote, `mul /qty` as `mul (get /qty)`; a refusal the call
// itself answered, which no frame of a trace has passed yet, carries it.
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
  return withPipeValue(state, makeErrorValue(refused.tag, facts, { location: refused.location, originalError: refused.originalError }));
}

// A bare name calls what it reaches for the subject; a name whose verbs no
// kind of the subject answers is refused with the addresses where its verbs
// live, and a name that reaches nothing with the names near it [QSNAM#reach]. A
// value the scope binds and a verb that serves the subject under one name
// meet, and the step is refused with the verb's address, which calls the
// verb, as another name reads the value; a value of the reader withheld from
// held code is refused under its name before a verb or a value of the root
// answers for it [QSQUO#held].
async function callByName(lookupName, modifiers, state, call) {
  refuseWithheld(state.scope, lookupName);
  const reach = bareNameReach(state.scope, lookupName, state.pipeValue);
  if (reach === null) {
    const addresses = addressesOf(state.scope, lookupName);
    if (addresses.length > 0) {
      const nearest = nearestVerbs(state.scope, addresses, state.pipeValue);
      const repair = isPath(state.pipeValue) ? repairOfPathSubject(state.pipeValue, call) : undefined;
      throw new CallKindAnswersNoVerbError({ name: keyword(lookupName), addresses, nearest: nearest.length > 0 ? nearest : undefined, repair, actualValue: state.pipeValue });
    }
    throw new CallUnknownNameError({
      name: keyword(lookupName), nearest: nearestNames(state.scope, lookupName), addresses
    });
  }
  if (reach.underKind) return await applyVerb(reach.record, modifiers, state);
  const verb = residenceOnSubject(state.scope, lookupName, state.pipeValue);
  if (verb !== null && servesTheSubject(verb, state.pipeValue)) {
    throw new CallValueMeetsVerbError({ name: keyword(lookupName), addresses: makeSet([makeTag(verb.get('name').name)]) });
  }
  return await applyBinding(reach.record, lookupName, lookupName, modifiers, state);
}

// A name reads the value its record holds, so `:x it | x` sees the raw
// data, a quote among it, which `apply` runs [QSNAM#value].
async function applyBinding(entry, name, lastName, modifiers, state) {
  const resolved = bindingValueOf(entry);

  // A value takes no modifiers; its refusal names the name as the step
  // wrote it and where a verb of its last name lives, one a declaration
  // shadows among them [QSNAM#value].
  if (modifiers.length > 0) {
    throw new CallValueTakesNoModifiersError({
      name: keyword(name),
      actualValue: resolved,
      addresses: addressesOf(state.scope, lastName)
    });
  }
  return withPipeValue(state, resolved);
}

// A name with a path reads what its address declared, past every bare
// name of the scope: a value that runs, named under a label, runs on the
// subject, a verb or the constructor a host hands, which no bare name
// reaches, and any other value is read itself, so a verb a declaration
// shadows stays one address away [QSNAM#address]: `[1 2 3] | vec/filter
// ~(gt 1)` calls the `filter` of vectors whatever the scope binds as
// `filter`.
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

// ─── A value held to its kinds ──────────────────────────────────

// A refusal named by the address of what refused [QSBLD#fn], its facts with
// the kind of the value refused in the order the catalog declares them; the
// value itself rides the facts where the trace does not hold it, an input or
// the args, and leaves them for the subject, which the trace's first frame
// holds [QSERR#site].
function refusalUnder(tagName, facts, scope, refused = facts.actualValue) {
  const tag = makeTag(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)).set('actualType', typeOf(refused)), scope));
}

// The value an input, a payload or a field holds: the value of its kind the
// walk of its tags reaches, or, where it names the kinds of each element,
// the vector, or the set, of each element's, a quote and a doc, whose
// elements are steps and segments, as they are; a value of none of its kinds
// is refused, a value that is no vector where they are the kinds of each
// element is refused as of no `::vec`, and an element of none is refused
// with its index, each refusal named as the holder names the refusal of
// its kinds, or of each element's.
function heldByItsKinds({ kinds, each }, refusalOf, value, scope) {
  if (!each) {
    if (kinds === null) return value;
    const reached = walkToKinds(value, kinds);
    return reached === null ? refusalUnder(refusalOf(false), { expected: kindsExpected(...kinds), actualValue: value }, scope) : reached.served;
  }
  const elements = walkToKinds(value, ['vec']);
  if (elements === null) return refusalUnder(refusalOf(false), { expected: kindsExpected('vec'), actualValue: value }, scope);
  if (kinds === null) return elements.served;
  const refused = refusedElementOf(elements.served, kinds);
  if (refused !== null) return refusalUnder(refusalOf(true), { index: refused.index, expected: kindsExpected(...kinds), actualValue: refused.element }, scope);
  if (isQuote(elements.served) || isDoc(elements.served)) return elements.served;
  const served = Array.from(elements.served, element => walkToKinds(element, kinds).served);
  return isSet(elements.served) ? makeSet(served) : Object.freeze(served);
}

// The names of the refusals of the kinds of an input or a field under its
// address, or of each of its elements'.
const refusalsUnder = address => each => (each ? elementsRefusalAddress : kindsRefusalAddress)(address);

// The first element the walk of whose tags reaches none of the kinds,
// with its index from zero, or null when every one does.
function refusedElementOf(elements, kinds) {
  const index = elements.findIndex(element => walkToKinds(element, kinds) === null);
  return index === -1 ? null : { index, element: elements[index] };
}

// The refusal of the first invariant written under an input or the answer
// whose condition the value does not answer true to, named under the
// address, the error a condition answered handed on as it is, or null; an
// invariant of a kind's value runs on the payload beneath the tag and its
// refusal holds the value under the tag [QSBLD#value].
async function invariantRefusal(invariants, address, value, state, scope, held = value) {
  for (const { name, condition } of invariants) {
    const answer = (await evalPipeline(condition, nestState(state, value, scope))).pipeValue;
    if (isErrorValue(answer)) return answer;
    if (beneathTags(answer) !== true) return refusalUnder(`${address}/${name}`, { actualValue: held }, scope);
  }
  return null;
}

// ─── The places of the args ─────────────────────────────────────

// The value an input reads from the args by its place: a place of one
// step, `/n` or `query /n default`, is the value there, read here as
// `get` and `query` read it, so the inputs of `query` itself read
// without calling it; any other place runs as code over the args, one
// deeper in the evaluation depth than the call [QSNAM#verb].
function placeRead({ path, place, index, onePlace, strict, fallback }, values, overArgs) {
  if (!onePlace) return path !== null ? pathOfArgs(path, overArgs()) : answerOfPipeline(place, overArgs());
  if (index < values.length) return values[index];
  if (strict) return MISSED_PLACE;
  return fallback === null ? null : answerOfPipeline([fallback], overArgs());
}

// A place that is a path other than one index, `/0/by` or `/-1`, reads it
// from the args as `get` does, a part the args do not hold one the call
// left out [QSBLD#input].
function pathOfArgs(path, state) {
  try {
    return readPath(state.pipeValue, path);
  } catch (refusal) {
    return errorFromQlang(refusal, state.pipeValue, state.scope);
  }
}

async function answerOfPipeline(steps, state) {
  return (await evalPipeline(steps, state)).pipeValue;
}

// A strict read of a place past the values of the args.
const MISSED_PLACE = Symbol('missedPlace');

// ─── The scope a call opens ─────────────────────────────────────

// The scope a call opens, read once for the scope it is called in, which
// never changes once made.
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

// The root, the nodes and the labels of a scope, which the scope a call opens
// and the lane of held code are each made from, and the names of the values a
// reader named there [QSNAM#owner], [QSQUO#held].
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

// Whether a name of a scope is a node, a name with a path, or a label, the
// names a recipe and code held as data read, any other a value a reader
// named [QSNAM#owner], [QSQUO#held].
function isNodeOrLabel(name, record) {
  return name.includes('/') || declaresALabel(record);
}

// ─── Names under a label ───────────────────────────────────────

// The name a recipe reads the args of its call by [QSBLD#input].
const ARGS_NAME = keyword('args');

// A verb runs by its function, a recipe written as the value of a name
// under a label the function of no commands it is [QSBLD#recipe].
async function applyVerb(record, modifiers, state) {
  const value = bindingValueOf(record);
  return await applyFunctionVerb(record, isFn(value) ? value : functionOfRecipe(value), modifiers, state);
}

// The value under the tags from the innermost out, each laid again through
// its kind [QSDSP#answer]; an error passes as it is, as it does under every
// tag [QSERR#flow].
async function underTags(value, tags, state) {
  let laid = value;
  for (const tag of [...tags].reverse()) laid = await layTag(tag.name, laid, state);
  return laid;
}

// The answer of the subject's own kind, made by its constructor, a set's, a
// tag's or a quote's among them, under the tags the walk passed
// [QSDSP#answer], [QSSLF#catalog], and at once where it is of the kind and the
// walk passed no tag.
function keptAsSubject(answer, served, passedTags, state) {
  const ownKind = typeOf(served).name;
  const reached = walkToKinds(answer, [ownKind]);
  if (reached !== null && passedTags.length === 0) return reached.served;
  return keptUnderTags(answer, reached, ownKind, passedTags, state);
}

async function keptUnderTags(answer, reached, ownKind, passedTags, state) {
  const kept = reached?.served ?? await layTag(ownKind, answer, state);
  return await underTags(kept, passedTags, state);
}

// The answer brought to the kinds `returns` names, a verb that names `::any`
// bringing none [QSBLD#answer]: one that reaches another of the
// kinds is the value it reaches; one of the verb's own label goes back under
// the tags the walk passed, as the subject's kind; one kind alone makes the
// value as a value is put under it, a number past the finite doubles refused
// under `::number`, and so does a kind of the answer's own kind the walk
// passed by; an answer of none of several kinds is refused under the
// answer's address.
function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state) {
  const others = kinds.filter(kind => kind !== labelName);
  const reached = others.length === 0 ? null : walkToKinds(answer, others);
  if (reached !== null) return reached.served;
  const refused = () => refusalUnder(kindsRefusalAddress(address), { expected: kindsExpected(...kinds), actualValue: answer }, state.scope);
  if (returnsItsLabel(kinds, labelName)) {
    if (walkToKinds(answer, [labelName]) !== null) return keptAsSubject(answer, walked.served, walked.passedTags, state);
    const keeping = () => keptOfTheLabel(answer, labelName, walked, refused, state);
    return typeOf(walked.served).name === labelName ? answerMadeBy(labelName, keeping, refused) : keeping();
  }
  const constructing = kinds.length === 1 ? kinds[0] : kinds.find(kind => kind === typeOf(answer).name);
  return constructing === undefined ? refused() : answerMadeBy(constructing, () => layTag(constructing, answer, state), refused);
}

// An answer kept as the subject's kind, refused where what is kept is no
// value of the label.
async function keptOfTheLabel(answer, labelName, walked, refused, state) {
  const kept = await keptAsSubject(answer, walked.served, walked.passedTags, state);
  return isErrorValue(kept) || walkToKinds(kept, [labelName]) !== null ? kept : refused();
}

// The answer a kind makes, a payload it refuses for its kind refused as
// the answer is [QSBLD#answer].
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

// callVerbOn(record, subject, state) → the answer of the verb the record
// holds, run on the subject with no modifiers, the print a kind answers
// among them [QSPRN#print].
export async function callVerbOn(record, subject, state) {
  return (await applyVerb(record, [], withPipeValue(state, subject))).pipeValue;
}

// ─── Functions ──────────────────────────────────────────────────

// A verb that is a function is called by its function alone [QSBLD#fn]: its
// subject served by its label or by the kinds `on` names, its inputs read
// from the args by their places and held to their kinds and invariants, its
// recipe run in the scope its call opens, a recipe written in steps of a
// verb of the root's marked as the root's and a primitive keeping the mark
// of the scope it is called in, and its answer brought to the kinds
// `returns` names, every refusal named under the verb's address.
async function applyFunctionVerb(record, fn, modifiers, state) {
  const address = record.get('name').name;
  const ofTheRoot = isQuote(recipeOf(fn)) ? rootOf(state.scope).get(address) === record : isRootVerbScope(state.scope);
  return withPipeValue(state, await callFunction(fn, { address, labelName: splitAddress(address)[0], ofTheRoot }, modifiers, state));
}

// applyFunction(fn, subject, args, state) → the answer of a function `apply`
// runs on a subject, the values of a vector its args, every refusal named
// under the call of a function, `fn/call`, since no verb names it; a
// function with no recipe, a contract, runs nothing.
const FN_CALL_ADDRESS = 'fn/call';

export async function applyFunction(fn, subject, args, state) {
  const recipe = recipeOf(fn);
  if (!isRecipe(recipe)) throw new FnRecipeMissingError({ actualValue: fn });
  const at = { address: FN_CALL_ADDRESS, labelName: null, ofTheRoot: !isQuote(recipe) && isRootVerbScope(state.scope) };
  return await callFunction(fn, at, args.map(value => () => value), withPipeValue(state, subject));
}

// inputsOfFunction(fn, args, state) → the values the inputs of a function
// read from the values of a vector, as its call reads them, or the refusal
// its call would answer.
export async function inputsOfFunction(fn, args, state) {
  const called = await inputsOfCall(chainOfFn(fn), FN_CALL_ADDRESS, args.map(value => () => value), state, callScopeOf(state, false), null);
  return isErrorValue(called) ? called : called.values;
}

async function callFunction(fn, { address, labelName, ofTheRoot }, modifiers, state) {
  const chain = chainOfFn(fn);
  const recipe = recipeOf(fn);
  const walked = subjectOfCall(chain, labelName, state.pipeValue);
  if (walked === null && labelName === null) return refusalUnder(subjectKindsRefusalAddress(address), { expected: kindsExpected(...chain.subject.kinds) }, state.scope, state.pipeValue);
  if (walked === null) return refusalUnder(subjectRefusalAddress(address, [labelName]), {}, state.scope, state.pipeValue);
  const scope = callScopeOf(state, ofTheRoot);
  const steps = isQuote(recipe) ? recipe : null;
  const called = await inputsOfCall(chain, address, modifiers, state, scope, steps);
  if (isErrorValue(called)) return called;
  const running = steps === null
    ? runPrimitive(recipe, walked.served, walked.passedTags, handedTo(primitiveOf(recipe), chain, called, state), called.state, address)
    : (await evalPipeline(steps, nestState(called.state, state.pipeValue, called.recipeScope))).pipeValue;
  const answer = isThenable(running) ? await running : running;
  if (isErrorValue(answer)) return answer;
  const kinds = chain.answer?.kinds ?? null;
  const brought = kinds === null ? answer : await answerUnderItsLabel(answer, { address: `${address}/${ANSWER_NAME}`, kinds }, walked.byLabel ? labelName : null, walked, state);
  if (isErrorValue(brought)) return brought;
  return await invariantRefusal(invariantsOf(chain, ANSWER_NAME), address, brought, called.state, scope) ?? brought;
}

// The values a primitive is handed, its inputs in the order `takes` names
// them, each it runs as code closed at the call where the call keeps that
// the quote came from, a path read as `get` reads it, and every element so
// of one that holds the args of the call whole, the reducer of a fold the
// code that folds; any other value as it is [QSHST#source].
function handedTo(primitive, chain, { values, origins }, state) {
  const run = inputsRunBy(primitive);
  const within = inputsRunWithin(primitive);
  const folded = inputsFoldedBy(primitive);
  if (run === undefined && within === undefined && folded === undefined) return values;
  const originOfQuote = quote => origins.get(quote);
  return values.map((value, at) => {
    const { name, reading } = chain.inputs[at];
    if (within?.has(name.name)) return quotesClosedIn(value, originOfQuote);
    if (folded?.has(name.name)) return foldingCodeOf(value, originOfQuote, state);
    if (!run?.has(name.name)) return value;
    return reading.readsArgs ? value.map(element => codeOfArg(element, originOfQuote, state)) : codeOfArg(value, originOfQuote, state);
  });
}

// A template whose quotes are code closed at the call where each came
// from, the paths and the other values of it as they are, a set's
// elements kept in its order.
function quotesClosedIn(value, originOfQuote) {
  if (isQuote(value)) return codeFrom(value, originOfQuote(value));
  if (!holdsAQuote(value)) return value;
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, quotesClosedIn(value.payload, originOfQuote));
  const header = value[TAG_HEADER_SYMBOL];
  const closed = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, quotesClosedIn(part, originOfQuote)]))
    : value.map(part => quotesClosedIn(part, originOfQuote));
  if (header !== undefined) stampTagHeader(closed, header);
  return closed;
}

// The origin a call keeps of each quote an arg holds, at any depth of a
// template or beneath a tag [QSQUO#held]: a quote written in the step is that
// step's, and any other the origin a call around keeps for it, the
// nearest, or else the arg's, a value of the step.
function keepOrigins(origins, value, origin, state) {
  if (isQuote(value)) {
    origins.set(value, origin.written ? origin : originIn(state, value) ?? origin);
    return;
  }
  if (isValueClass(value, 'underTag')) return keepOrigins(origins, value.payload, origin, state);
  if (!holdsAQuote(value)) return;
  for (const part of partsOfTemplate(value)) keepOrigins(origins, part, origin, state);
}

// Whether a value holds a quote at any depth of a template, read once for
// each value, which never changes, since every call walks its args.
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

// The code a fold is handed [QSCOL#reduce]: a quote of one step, a call
// with no modifiers that reaches a verb, calls it as the pipe calls it, the
// value so far its subject and the element its arg, in the scope the quote
// came from, a value of that scope under the name meeting the verb; any
// other code runs on the pair of the two.
function foldingCodeOf(value, originOfQuote, state) {
  const code = codeOfArg(value, originOfQuote, state);
  const onThePair = async (acc, element) => await code([acc, element]);
  if (value.length !== 1 || !isCallStep(value[0]) || value[0].has('modifiers')) return onThePair;
  const call = value[0];
  const name = call.get('name').name;
  const callerState = stateOfOrigin(originOfQuote(value));
  const calledOn = invoke => async (acc, element) => {
    try {
      return (await invoke([() => element], withPipeValue(callerState, acc))).pipeValue;
    } catch (caughtError) {
      return errorOfThrow(caughtError, call, acc, callerState.scope);
    }
  };
  if (name.includes('/')) {
    if (!isVerb(callerState.scope, name)) return onThePair;
    const record = nodeOf(callerState.scope, name);
    return calledOn((modifiers, at) => applyVerb(record, modifiers, at));
  }
  if (addressesOf(callerState.scope, name).length === 0) return onThePair;
  return calledOn((modifiers, at) => callByName(name, modifiers, at, call));
}

// The values of the inputs of a function's call, read from its args by
// their places, the values its modifiers computed against the subject,
// and, for a recipe written in steps, the scope it runs in, each input
// bound by its name and the args as `args`, names the steps of the recipe
// declare no second time, and the state of the call's run, which keeps the
// origin of each quote its args hold [QSBLD#input]: args of more values than the
// inputs read places are refused, an input the args leave out where its
// place reads one is refused, a value none of an input's kinds holds is
// refused, each refusal named under the address, and so is a value that
// breaks an invariant written under its input, which holds of the value as
// the args give it.
async function inputsOfCall(chain, address, modifiers, state, scope, recipeSteps) {
  const values = [];
  const origins = new Map();
  for (const [index, modifier] of modifiers.entries()) {
    const computing = modifier(state.pipeValue);
    const value = isThenable(computing) ? await computing : computing;
    if (isErrorValue(value)) return refusalOfFailedModifier(chain, address, index, value, scope);
    values.push(value);
    keepOrigins(origins, value, modifier.origin ?? heldIn(state), state);
  }
  const called = withCall(state, origins);
  let args = null;
  const argsValue = () => args ??= makeTagged(makeTag(address), values);
  if (chain.places !== null && values.length > chain.places) return refusalUnder(argsBeyondInputsAddress(address), { places: chain.places, actualValue: argsValue() }, scope);
  let recipeScope = recipeSteps === null ? null : scopeSet(scope, ARGS_NAME.name, makeBinding({ name: ARGS_NAME, value: argsValue() }))
    .set(RECIPE_KEY, { steps: recipeSteps, names: new Set([ARGS_NAME.name, ...chain.inputs.map(({ name }) => name.name)]) });
  const overArgs = () => nestState(called, argsValue(), scope);
  const inputValues = [];
  for (const input of chain.inputs) {
    const { name } = input;
    const inputAddress = `${address}/${name.name}`;
    depthBelow(state);
    const reached = placeRead(input.reading, values, overArgs);
    const read = isThenable(reached) ? await reached : reached;
    if (read === MISSED_PLACE || (isErrorValue(read) && isMissedPart(read))) return refusalUnder(notGivenAddress(inputAddress), { actualValue: argsValue() }, scope);
    if (isErrorValue(read)) return read;
    const held = heldByItsKinds(input, refusalsUnder(inputAddress), read, scope);
    if (isErrorValue(held)) return held;
    const refused = await invariantRefusal(invariantsOf(chain, name.name), address, read, called, scope);
    if (refused !== null) return refused;
    inputValues.push(held);
    if (recipeSteps !== null) recipeScope = scopeSet(recipeScope, name.name, makeBinding({ name, value: held }));
  }
  return { values: inputValues, origins, recipeScope, state: called };
}

// A modifier of the call that answered an error where the input that reads
// its index, or the args of the call whole, takes a quote: the step ran on
// the subject by mistake, `each (add 1)` for `each ~(add 1)`, and the input
// refuses it under its kinds with the error at rest as its value, an
// element of the args whole naming its index and the value of an input of
// each element refused as no vector, as a value of the step is; a name
// withheld from held code, which ran no step, and anywhere else the error
// is the answer [QSQUO#modifier].
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

// ─── A value under a kind ───────────────────────────────────────

// layTag(tagName, payload, state) → the payload under the tag
// through its label [QSDSP#answer]: built by its kind [QSBLD#kind], laid over
// as it is where no kind answers the tag [QSLIT#tag], [QSBLD#label], never
// over an error [QSERR#flow], and never under the name of a value withheld
// from held code [QSQUO#held].
export async function layTag(tagName, payload, state) {
  if (isErrorValue(payload)) return payload;
  refuseWithheld(state.scope, tagName, true);
  const node = nodeOf(state.scope, tagName);
  const declared = bindingValueOf(node);
  if (isKind(declared)) return await underKind(tagName, declared, payload, state);
  if (isDoc(declared) || node === null || isVerb(state.scope, tagName) || isInvariant(declared)) return makeTagged(makeTag(tagName), payload);
  throw new ConstructTagNotKindError({ tag: makeTag(tagName), actualValue: declared });
}

// A value under a kind [QSBLD#value]: its payload held to its kinds, each field
// read and held, the constructor a host hands its kind run, its answer held at
// the door, and the invariants of the value held, every refusal named under
// the label, the code of a place or a condition running in the scope a call
// opens; the kind lays its tag before the tags of the payload, a value its
// constructor makes of its kind standing as it is, or refuses the payload
// [QSLIT#tag], [QSHST#source].
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
  const constructs = primitiveOf(constructorOf(kind));
  const constructed = constructs === undefined ? held : await heldAtTheDoor(constructs, () => constructs(held), `${tagName}/construct`, [held]);
  const labelled = constructs !== undefined && typeOf(constructed).name === tagName ? constructed : makeTagged(makeTag(tagName), constructs === undefined ? payload : constructed);
  const ofTheValue = invariants.filter(({ field }) => field === null);
  return ofTheValue.length === 0 ? labelled : await invariantRefusal(ofTheValue, tagName, constructed, state, opened(), labelled) ?? labelled;
}

// The refusal of a field of the payload: a place the payload leaves out, a
// value of none of its kinds, or one that breaks an invariant written under
// the field, which holds of the value as the payload gives it; the failure
// of a quote that reads it; or null.
async function fieldRefusal(tagName, field, payload, invariants, state, opened) {
  const fieldAddress = `${tagName}/${field.name.name}`;
  const read = isPath(field.place)
    ? pathOfArgs(field.place, withPipeValue(state, payload))
    : await answerOfPipeline(field.place, nestState(state, payload, opened()));
  if (isErrorValue(read) && isMissedPart(read)) return refusalUnder(notGivenAddress(fieldAddress), { actualValue: payload }, state.scope);
  if (isErrorValue(read)) return read;
  const held = heldByItsKinds(field, refusalsUnder(fieldAddress), read, state.scope);
  if (isErrorValue(held)) return held;
  const ofTheField = invariants.filter(({ field: under }) => under === field.name.name);
  return ofTheField.length === 0 ? null : await invariantRefusal(ofTheField, tagName, read, state, opened());
}

// ─── Code closed at a call ──────────────────────────────────────

// The code of a step a call closes over, which keeps the scope it runs in,
// the evaluation depth of its call and the calls it runs within, with the
// origin of each quote they received, run against the subject it is handed
// one deeper, the frame of the step its own [QSNAM#scope], [QSNAM#verb],
// [QSQUO#held], [QSERR#trace].
function closeStep(step, state) {
  return async subject => (await evalStep(step, nestState(state, subject, state.scope))).pipeValue;
}

// The code of a quote a call closes over, which keeps the scope, the depth
// and the calls the code of a step keeps, run as that code is [QSNAM#scope], [QSNAM#verb].
function closeQuote(quote, state) {
  return async subject => (await evalPipeline(quote, nestState(state, subject, state.scope))).pipeValue;
}

// modifierOf(step, state) → the code of a modifier of a call, whose
// subject is never an error: a quote written there the data it is and a
// template or a tagged literal written there the code that builds it, each
// written in the step, which the call runs it in; and any other modifier the
// code it is, an atom answering itself, whose value the call keeps as a value
// of the step. A modifier answers within the frame of its step, which holds
// it [QSQUO#held], [QSNAM#verb], [QSERR#trace].
function modifierOf(step, state) {
  if (isQuote(step)) return withOrigin(() => step, { state, written: true });
  if (isTemplate(step)) return withOrigin(closeStep(step, state), { state, written: true });
  return closeStep(step, state);
}

// The literals a template is written as, a value under a tag among them,
// whose quotes are written in the step [QSQUO#held], [QSLIT#tag].
const isTemplate = step => isConstructStep(step) || isSet(step) || ((isVec(step) || isMap(step)) && step[TAG_HEADER_SYMBOL] === undefined);

function withOrigin(code, origin) {
  code.origin = origin;
  return code;
}

// The origin of a value of a step, whose code is held as data and runs in
// the lane of the step [QSQUO#held].
function heldIn(state) {
  return { state, written: false };
}

// codeOfPath(path, callState) → code that reads the path from each subject
// it is handed, as `~(get /path)` reads it, a refusal its answer with the
// frame of that step at the subject [QSPTH#code].
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

// codeOf(code, callState) → code closed at the call [QSQUO#literal] where a
// call around keeps that it came from, or else held as data in the lane of the
// call's own step [QSQUO#held].
export function codeOf(code, callState) {
  return codeFrom(code, originIn(callState, code) ?? heldIn(callState));
}

// The code of a quote closed where it came from: written in a step, in the
// scope of that step, and a value of a step, in the lane of the step's own
// scope [QSQUO#held].
function codeFrom(code, origin) {
  return closeQuote(code, stateOfOrigin(origin));
}

function stateOfOrigin({ state, written }) {
  return written ? state : withScope(state, laneOf(ownScopeOf(state)));
}

// The lane held code runs in [QSQUO#held], a tree of its own: the root, the
// verbs, the nodes and the labels of the scope of its step, and each value
// that scope names withheld, so no verb and no value of the root answers
// for it.
const LANES = new WeakMap();

function laneOf(scope) {
  let lane = LANES.get(scope);
  if (lane !== undefined) return lane;
  const { scope: kept, values } = nodesAndLabelsOf(scope);
  lane = kept.set(WITHHELD_KEY, new Set([...(scope.get(WITHHELD_KEY) ?? []), ...values]));
  LANES.set(scope, lane);
  return lane;
}
