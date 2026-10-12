// The evaluator: the state pair of value and scope threaded through the
// steps, each node a function `(node, state) → state`.

import { parse } from './parse.mjs';
import { ROOT_KEY } from './env-keys.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, frameBelow, envSet, envHas, rootOf, asScopeOf
} from './state.mjs';
import { declareRefusal, QlangError, QlangInvariantError, CallUnknownNameError, CallUnknownAddressError, BindEffectMarkMissingError, BindNameDeclaredTwiceError, declareInvariantError } from './errors.mjs';
import { nearestKeys, nearestNames, nearestTagNames } from './nearest-names.mjs';
import { classifyEffect } from './effect.mjs';
import { findFirstEffectfulIdentifier } from './effect-check.mjs';
import {
  isVec, isQMap, isQSet, isErrorValue, isQuote, isDoc, hostImplOf,
  typeKeyword, keyword, NULL, makeErrorValue,
  makeDoc, makeSet,
  makeBinding, bindingValueOf, isBinding, makeTaggedInstance, makeTag, isTag, errorAtRest,
  isValueClass, quoteInEnv, quoteEnvRef, envToRun,
  ERROR_TAG
} from './types.mjs';
import { declaredNameOf, originOf, repeatsDeclarationInScope } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, docOfNode, slotDocsOf, astOfQuote, stepOfNode, tagCallStepOf } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse, factsInOrder } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  addressesOf, answerOf, answerRefusalAddress, argsBeyondPartsAddress, bareNameReach, CONSTRUCT_NAME, holdsAPage, isInvariant, isMemberValue, isUnderLabel, isWord, invariantsUnder, nodeOf, notGivenAddress, onceForRoot, partsOfName, pathNamesOf, placesReadBy, readsTheReaderUnder, residenceOnSubject, rootScopeOf, readsParts, segmentIndex, selectorOf, subjectOf, subjectRefusalAddress
} from './runtime/nouns.mjs';
import { splitAddress } from './address.mjs';
import {
  runPrimitive, keptAsSubject, mintUnderTag, walkToKinds, CallKindAnswersNoVerbError
} from './runtime/verb.mjs';
import {
  answerOfStep, answerOfWord, skipping, raisedBy, isRaisedBy
} from './eval-trail.mjs';

// A node or a combinator the tables below do not name is a defect of the
// evaluator, raised past the fail track.
const BuiltinUnknownAstNodeTypeError = declareInvariantError(
  'builtin/UnknownAstNodeTypeError',
  ({ nodeType }) => `unknown AST node type: ${nodeType}`);

const ProjSubjectNotProjectableError = declareRefusal('proj/SubjectNotProjectableError');
const ProjKeyNotInMapError = declareRefusal('proj/KeyNotInMapError');
const ProjIndexOutOfBoundsError = declareRefusal('proj/IndexOutOfBoundsError');
const ProjIndexNotIntegerError = declareRefusal('proj/IndexNotIntegerError');
// The tag of a name that holds data puts no value under it: a value goes
// under a label, a word, an invariant or a tag no node answers [D173].
const ConstructTagNotKindError = declareRefusal('construct/TagNotKindError');
const CallValueMeetsWordError = declareRefusal('call/ValueMeetsWordError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError = declareRefusal('call/ValueTakesNoModifiersError');

// evalQuery(source, env?) → the value a query answers from null, in the
// scope of the runtime unless `env` is given.
export async function evalQuery(source, env) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr, initialEnv);
  }
  const finalState = await evalBody(ast, rootState(null, initialEnv));
  return finalState.pipeValue;
}

// evalAst(ast, state) → Promise<state'>
//
// Runs an AST as a body against a state the caller built, its head
// riding `|`, and returns the new state.
export async function evalAst(ast, state) {
  return await evalBody(ast, state);
}

const AST_NODE_EVALUATORS = {
  Pipeline:          evalPipeline,
  NumberLit:         evalNumberLit,
  StringLit:         evalStringLit,
  BooleanLit:        evalBooleanLit,
  NullLit:           evalNullLit,
  Keyword:           evalKeyword,
  VecLit:            evalVecLit,
  MapLit:            evalMapLit,
  ErrorLit:          evalErrorLit,
  SetLit:            evalSetLit,
  QuoteLit:          evalQuoteLit,
  DocLit:            evalDocLit,
  TaggedLit:         evalTaggedLit,
  TagLit:   evalTagLit,
  Projection:        evalProjection,
  Call:              evalCall,
  BindStep:          evalBindStep,
  ParenGroup:        evalParenGroup,
  Blank:             evalBlank,
};

// A blank source, comments among it, answers the value it is handed
// [D81].
function evalBlank(_node, state) {
  return state;
}

async function evalNode(node, state) {
  const evaluator = AST_NODE_EVALUATORS[node.type];
  if (!evaluator) throw new BuiltinUnknownAstNodeTypeError({ nodeType: node.type });

  try {
    return await evaluator(node, state);
  } catch (caughtError) {
    // The error the node raised; the step that ran the node writes its
    // stop [D85].
    return withPipeValue(state, raisedBy(errorOfThrow(caughtError, node, state.pipeValue, state.env), node));
  }
}

// The failure a throw at a node raised against the subject it met, a
// defect of the runtime riding past the fail track.
function errorOfThrow(caughtError, node, subject, env) {
  if (caughtError instanceof QlangError && !caughtError.location && node.location) caughtError.location = node.location;
  if (caughtError instanceof QlangInvariantError) throw caughtError;
  return caughtError instanceof QlangError ? errorFromQlang(caughtError, subject, env) : errorFromForeign(caughtError, node, env);
}

// ─── Pipeline ───────────────────────────────────────────────────

// The head of a pipeline rides `|` unless it is written after `!|`, so
// `~(!| 0)` replays through `apply` as it was written.
async function evalPipeline(node, state) {
  let current = await applyCombinator(node.leadingCombinator ?? '|', state, node.steps[0]);
  for (const unit of node.steps.slice(1)) current = await applyCombinator(unit.combinator, current, unit.step);
  return current;
}

// The tracks live in the combinators alone: `|` steps around an error,
// the step joining the skipped steps of its last stop [D85], and `!|`
// fires on an error alone [D51]; the parser writes no other combinator.
async function applyCombinator(kind, state, stepNode) {
  return kind === '!|' ? await applyFailTrack(state, stepNode) : await applySuccessTrack(state, stepNode);
}

// The fork rule: a nested pipeline, a group or a word of a literal, starts
// from the outer state and hands back its value alone, its declarations
// left behind, on the outer frame of the depth budget.
async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

// `|` runs the step on a value, an error it answers taking a stop there,
// and an error in the pipe skips it.
async function applySuccessTrack(state, stepNode) {
  if (isErrorValue(state.pipeValue)) return withPipeValue(state, skipping(state.pipeValue, stepOfNode(stepNode)));
  const answered = await evalNode(stepNode, state);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => quoteOfBody(stepNode), state.pipeValue));
}

// A body, a query, a group, a verb's body or an applied quote among them,
// whose head rides `|` like every other step.
function evalBody(node, state) {
  return node.type === 'Pipeline' ? evalNode(node, state) : applySuccessTrack(state, node);
}

// The container beneath every tag stacked over a value, which a
// projection reads as the walk hands a verb the value it serves [D34].
function containerBeneathTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

// `!|` alone catches a failure, its step running on the error at rest, the
// map of its facts, `:trail` among them, under `::error` and the tag of
// the site that refused laid through its label as a tagged literal lays
// it, so `!| type` reads the site and a verb of `::error` reaches every
// error [D97], [D206], [D210], a value passing, a label's refusal
// answering for the catch, and a raise that writes the `:trail` it read
// resuming that path [D85].
async function applyFailTrack(state, stepNode) {
  if (!isErrorValue(state.pipeValue)) return state;
  const raised = state.pipeValue;
  const errorOfKind = makeTaggedInstance(ERROR_TAG, new Map(raised.descriptor));
  let opened;
  try {
    opened = raised.tag === ERROR_TAG ? errorOfKind : await mintTaggedInstance(raised.tag.name, errorOfKind, state);
  } catch (caughtError) {
    opened = errorOfThrow(caughtError, stepNode, errorOfKind, state.env);
  }
  if (isErrorValue(opened)) return withPipeValue(state, answerOfStep(opened, () => quoteOfBody(stepNode), errorOfKind));
  const answered = await evalNode(stepNode, withPipeValue(state, opened));
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => quoteOfBody(stepNode), opened));
}

// ─── Literal evaluators ─────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNullLit(_node, state)    { return withPipeValue(state, NULL); }
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }

// Each element and each value of a literal is a word forked against the
// subject, one after another in their order [D84]; a failure lives in the
// pipe alone, so the first a word answers is the answer of the literal,
// the words after it left unrun [D210].
async function evalVecLit(node, state) {
  return withPipeValue(state, await wordValues(node.elements, state));
}

async function evalMapLit(node, state) {
  return withPipeValue(state, await entryValues(node.entries, state));
}

async function wordValues(words, state) {
  const values = [];
  for (const word of words) {
    const answered = await wordAnswer(word, state);
    if (isErrorValue(answered)) return answered;
    values.push(answered);
  }
  return values;
}

async function entryValues(entries, state) {
  const values = await wordValues(entries.map(entry => entry.value), state);
  return isErrorValue(values) ? values : new Map(entries.map((entry, index) => [entry.key.name, values[index]]));
}

// An error literal is the literal of the kind of errors, as `#[…]` is the
// set's: `!{…}` is `::error{…}`, an error at rest, and `::Foo!{…}` is
// `::Foo::error{…}`, laid through the label of its tag as a tagged literal
// lays a payload, a refusal of the label answering for the literal; every
// entry is a fact, `:kind` among them [D190], and `raise` raises the error
// [D211].
async function evalErrorLit(node, state) {
  const facts = await entryValues(node.entries, state);
  if (isErrorValue(facts)) return withPipeValue(state, facts);
  const atRest = await mintTaggedInstance(ERROR_TAG.name, facts, state);
  return withPipeValue(state, node.tag === null ? atRest : await mintTaggedInstance(node.tag, atRest, state));
}

// The value a word of a literal answers, forked against the subject: a
// failure the word raised passes a stop at the word, and one handed on
// from inside it goes on as it is to the literal it fails [D85], [D210].
async function wordAnswer(wordNode, state) {
  const answered = await fork(state, inner => evalNode(wordNode, inner));
  return answerOfWord(answered.pipeValue, wordNode, state.pipeValue);
}

function evalQuoteLit(node, state) {
  return withPipeValue(state, quoteOfLiteral(node));
}

// A doc's quote takes the role the tags written before it give [D108],
// each laid over the quote through its label as a tagged literal lays a
// payload, so a tag whose label takes no quote refuses the doc,
// `|~~ see ::number~(~(x)) ~~|` as `::number~(~(x))` does [D206].
async function evalDocLit(node, state) {
  for (const part of node.segments) {
    if (part.type !== 'DocTaggedQuote') continue;
    let laid = quoteOfLiteral(part.quote);
    for (const tagName of [...part.tags].reverse()) {
      laid = await mintTaggedInstance(tagName, laid, state);
      if (isErrorValue(laid)) return withPipeValue(state, laid);
    }
  }
  return withPipeValue(state, docOfNode(node));
}

// The elements run in the order they are written, and the set holds
// them in the one order [D16].
async function evalSetLit(node, state) {
  const elements = await wordValues(node.elements, state);
  return withPipeValue(state, isErrorValue(elements) ? elements : makeSet(elements));
}

// ─── TaggedLit / TagLit ────────────────────────────────

// mintTaggedInstance(tagName, payload, state) → the payload under the tag
// through its label [D168], a value a verb returns under its subject's
// tag among them [D41]; a tag no node answers, the tag of a word over the
// args of a call of it, which the call checks as it reads them, and the
// tag of an invariant over the facts a reader raises again lay
// themselves over the payload as they are [D42], [D173], and no
// constructor meets an error [D86].
export async function mintTaggedInstance(tagName, payload, state) {
  const declared = bindingValueOf(nodeOf(state.env, tagName));
  if (declared === null || isWord(state.env, tagName) || isInvariant(declared)) return makeTaggedInstance(makeTag(tagName), payload);
  if (!isDoc(declared)) {
    throw new ConstructTagNotKindError({ tag: makeTag(tagName), actualValue: declared });
  }
  return await underPage(tagName, payload, state);
}

// A label declared by its page lays its tag over a payload [D166]: the
// `construct` declared under it builds the payload first when there is
// one, a value of the label's own kind, as the constructor of a kind of
// the core answers, staying as it is, and every invariant declared under
// it runs on the value under the label, a broken one refusing it under
// the invariant's name [D169].
async function underPage(tagName, payload, state) {
  const constructRecord = nodeOf(state.env, `${tagName}/${CONSTRUCT_NAME}`);
  let built = payload;
  if (constructRecord !== null && isMemberValue(bindingValueOf(constructRecord))) {
    built = await constructedBy(bindingValueOf(constructRecord), payload, state);
    if (isErrorValue(built)) return built;
  }
  const labelled = typeKeyword(built).name === tagName ? built : makeTaggedInstance(makeTag(tagName), built);
  return await refusalOfInvariants(tagName, labelled, state, state.env) ?? labelled;
}

// The payload a label's `construct` builds: a quote run on the payload,
// or the primitive a host handed run over it and the state, as a kind's
// primitive constructor runs.
async function constructedBy(construct, payload, state) {
  if (isQuote(construct)) return (await evalBody(astOfQuote(construct), nestState(state, payload, scopeOfMember(construct, state)))).pipeValue;
  return await hostImplOf(construct)(payload, state);
}

// The refusal of the first invariant declared under an address the value
// does not answer true to, named by the invariant [D169], the index from
// zero of the element an invariant of each element refuses among its
// facts, or the error an invariant answered, handed on as it is; null
// when every invariant holds.
async function refusalOfInvariants(address, value, state, scope) {
  return await refusalOf(invariantsUnder(scope, address), value, state, scope);
}

// Answered at once while the invariants ask for kinds, and as a promise
// from the first that runs a query.
function refusalOf(invariants, value, state, scope, from = 0) {
  for (let at = from; at < invariants.length; at++) {
    const { address: invariantAddress, kinds, elementKinds } = invariants[at];
    const elements = elementKinds === null ? null : walkToKinds(value, ['vec']);
    if (elements !== null) {
      const refused = refusedElementOf(elements.served, elementKinds);
      if (refused === null) continue;
      return refusalUnder(invariantAddress, { index: refused.index, actualValue: refused.element }, scope);
    }
    if (kinds === null) return refusalOfQuery(invariants, at, value, state, scope);
    if (walkToKinds(value, kinds) === null) return refusalUnder(invariantAddress, { actualValue: value }, scope);
  }
  return null;
}

async function refusalOfQuery(invariants, at, value, state, scope) {
  const { address: invariantAddress, query } = invariants[at];
  const answer = (await evalBody(astOfQuote(query), nestState(state, value, scope))).pipeValue;
  if (isErrorValue(answer)) return answer;
  if (answer !== true) return refusalUnder(invariantAddress, { actualValue: value }, scope);
  return await refusalOf(invariants, value, state, scope, at + 1);
}

// A refusal named by the address of what refused [D166], its facts with
// the kind of the value refused in the order the catalog declares them
// [D172]; the value itself rides the facts where the trail does not hold
// it, a part or the args, and leaves them for the subject, which the
// trail's first stop holds [D85].
function refusalUnder(tagName, facts, env, refused = facts.actualValue) {
  const tag = makeTag(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)).set('actualType', typeKeyword(refused)), env));
}

async function evalTaggedLit(node, state) {
  const tagName = node.tag;
  const payload = (await fork(state, inner => evalNode(node.payload, inner))).pipeValue;
  if (isErrorValue(payload)) return withPipeValue(state, passedUntagged(payload, node, tagName));
  return withPipeValue(state, await mintTaggedInstance(tagName, payload, state));
}

// The error a tagged literal's payload answered, passed by the tag as an
// error passes every step, the tag's step joining the skipped steps of
// its last stop [D86], and the literal's own raise where the payload
// raised it.
function passedUntagged(payloadError, node, tagName) {
  const passed = skipping(payloadError, tagCallStepOf(makeTag(tagName)));
  if (isRaisedBy(payloadError, node.payload)) raisedBy(passed, node);
  return passed;
}

// A tag name is a value of its own, read without the scope [D20].
async function evalTagLit(node, state) {
  return withPipeValue(state, makeTag(node.tag));
}

// ─── BindStep ───────────────────────────────────────────────────

// The one binding form [D44]: the value passes on, and a fresh scope holds
// the record of the binding [D63], whose value is the body evaluated once
// at declaration against the current value, `42 | :x / | add 1 | x`
// answering 42, a declaration of docs alone binding them as a page, and a
// quote written as the body resolving in the scope the declaration
// writes, its own name among it [D44], and a body that fails answering the
// failure, which no name holds [D210]; a name is declared once in its
// scope [D71], a node the root holds once at all [D153], and a name with a
// path under a noun declared before it.
async function evalBindStep(node, state) {
  const name = declaredNameOf(node);
  const [nounName] = splitAddress(name);
  if (repeatsDeclarationInScope(node) || (nounName !== null && rootOf(state.env).has(name))) {
    throw new BindNameDeclaredTwiceError({ name: keyword(name) });
  }
  if (nounName !== null && !envHas(state.env, nounName)) {
    throw new BindNounNotDeclaredError({ name: keyword(name), noun: makeTag(nounName) });
  }

  if (node.body === null) {
    return withEnv(state, envSet(state.env, name, declarationRecord(node, makeDoc(slotDocsOf(node).flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc])))));
  }

  const answered = (await evalNode(node.body, state)).pipeValue;
  if (isErrorValue(answered)) return withPipeValue(state, answered);
  if (isQuote(answered) && isUnderLabel(state.env, name)) {
    refuseLaunderedByName(name, findFirstEffectfulIdentifier(astOfQuote(answered)), node);
  } else if (isQuote(answered) && nounName !== null && readsParts(state.env, nounName)) {
    refuseLaunderedByName(nounName, findFirstEffectfulIdentifier(astOfQuote(answered)), node);
  }
  const writtenQuote = node.body.type === 'QuoteLit';
  const value = writtenQuote ? quoteInEnv(answered, null) : answered;
  const nextEnv = envSet(state.env, name, declarationRecord(node, value));
  if (writtenQuote) quoteEnvRef(value).env = nextEnv;
  return withEnv(state, nextEnv);
}

// A name without the effect marker refuses a quote under a label whose
// body calls one; a part whose selector calls one is refused by the name
// it is a part of, which runs it at each call [D167].
function refuseLaunderedByName(name, effectfulName, node) {
  if (effectfulName === null || classifyEffect(name)) return;
  const laundering = new BindEffectMarkMissingError({ name: keyword(name), calls: keyword(effectfulName) });
  laundering.location = node.body.location;
  throw laundering;
}

// The record a declaration writes: its name, the docs of its slot, the
// value, the quote of its step and its origin [D63], [D153].
function declarationRecord(node, value) {
  return makeBinding({
    name: keyword(node.key.name),
    docs: slotDocsOf(node),
    value,
    source: quoteOfBody(node),
    origin: keyword(originOf(node))
  });
}

// ─── Projection ─────────────────────────────────────────────────

// A projection walks its path segment by segment: a map by key, a vector,
// a quote and a doc among them, by an index counted from the end when
// negative; a miss is a refusal that names its `:key`, where `at`
// answers null.
function evalProjection(node, state) {
  let projectionCurrent = state.pipeValue;
  for (const projKey of node.keys) projectionCurrent = projectSegment(projectionCurrent, projKey);
  return withPipeValue(state, projectionCurrent);
}

// A projection reads the map or the vector beneath the tags stacked over
// its subject, so the facts of an opened error read by name [D97].
function projectSegment(subject, projKey) {
  const projected = containerBeneathTags(subject);
  if (isQMap(projected)) {
    if (!projected.has(projKey)) throw new ProjKeyNotInMapError({ key: keyword(projKey), nearest: nearestKeys(projected, projKey), actualValue: subject });
    return projected.get(projKey);
  }
  if (isVec(projected)) {
    const index = segmentIndex(projKey);
    if (Number.isNaN(index)) {
      throw new ProjIndexNotIntegerError({ key: keyword(projKey), actualValue: subject });
    }
    const resolvedIndex = index < 0 ? projected.length + index : index;
    if (resolvedIndex < 0 || resolvedIndex >= projected.length) {
      throw new ProjIndexOutOfBoundsError({ index, length: projected.length, actualValue: subject });
    }
    return projected[resolvedIndex];
  }
  throw new ProjSubjectNotProjectableError({
    key: Number.isNaN(segmentIndex(projKey)) ? keyword(projKey) : segmentIndex(projKey),
    actualValue: subject
  });
}

// ─── Identifier lookup ─────────────────────────────────────────

async function evalCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  return await callByName(node.name, node.args.map(argNode => modifierOf(argNode, state)), state);
}

// A bare name calls what it reaches for the subject [D62], [D153]; a
// word the kind of the subject does not answer is refused with the
// addresses where the word lives [D169], and a name that reaches nothing
// with the names near it. A value the scope binds and a word the subject
// answers under one name meet, and the step is refused with the word's
// address, which calls the word, as another name reads the value [D223].
async function callByName(lookupName, lambdas, state) {
  const reach = bareNameReach(state.env, lookupName, state.pipeValue);
  if (reach === null) {
    const addresses = addressesOf(state.env, lookupName);
    if (addresses.length > 0) {
      throw new CallKindAnswersNoVerbError({ name: keyword(lookupName), addresses, actualValue: state.pipeValue });
    }
    throw new CallUnknownNameError({
      name: keyword(lookupName), nearest: nearestNames(state.env, lookupName), addresses
    });
  }
  if (reach.underKind) return await applyMember(reach.record, lambdas, state);
  const word = residenceOnSubject(state.env, lookupName, state.pipeValue);
  if (word !== null) throw new CallValueMeetsWordError({ name: keyword(lookupName), addresses: makeSet([makeTag(word.get('name').name)]) });
  return await applyBinding(reach.record, lookupName, lambdas, state);
}

// A name reads the value its record holds [D63], so `:x / | x` sees the
// raw data, a quote among it, which `apply` runs [D44].
async function applyBinding(entry, lookupName, lambdas, state) {
  const resolved = bindingValueOf(entry);

  // A value takes no modifiers; its refusal names where a word of the
  // name lives, one a declaration shadows among them [D62].
  if (lambdas.length > 0) {
    throw new CallValueTakesNoModifiersError({
      name: keyword(lookupName),
      actualValue: resolved,
      addresses: addressesOf(state.env, lookupName)
    });
  }
  return withPipeValue(state, resolved);
}

// A name with a path reads what its address declared, past every bare
// name of the scope, a name under a label run and any other value
// itself, so a word a declaration shadows stays one address away [D62],
// [D153]:
// `[1 2 3] | vec/filter ~(gt 1)` calls the `filter` of vectors whatever
// the scope binds as `filter`.
async function callByAddress(node, state) {
  const record = nodeOf(state.env, node.name);
  if (record === null) {
    throw new CallUnknownAddressError({ address: makeTag(node.name), nearest: nearestTagNames(state.env, node.name) });
  }
  const lambdas = node.args.map(argNode => modifierOf(argNode, state));
  if (isMemberValue(bindingValueOf(record)) && isUnderLabel(state.env, node.name)) {
    return await applyMember(record, lambdas, state);
  }
  return await applyBinding(record, splitAddress(node.name)[1], lambdas, state);
}

// ─── Names under a label ───────────────────────────────────────

// A name under a label runs on a value of the label [D164], a quote in the
// scope it carries [D44], [D200] over the root as it stands and the
// descriptor of a primitive by the implementation its host handed, a
// subject the walk of whose tags reaches no value of the label refused
// under the name's address, and its answer brought to the label its
// definition names [D169].
async function applyMember(record, lambdas, state) {
  const address = record.get('name').name;
  const member = bindingValueOf(record);
  const [labelName] = splitAddress(address);
  const walked = subjectServed(state.env, address, labelName, state.pipeValue);
  if (walked === null) return withPipeValue(state, refusalUnder(subjectRefusalAddress(address, labelName), {}, state.env, state.pipeValue));
  const scope = scopeOfMember(member, state);
  const definition = definitionOf(scope, address);
  const called = await argsOf(definition, lambdas, state, scope, isQuote(member));
  if (isErrorValue(called)) return withPipeValue(state, called);
  const running = isQuote(member)
    ? (await evalBody(astOfQuote(member), nestState(state, state.pipeValue, called.bodyEnv))).pipeValue
    : runHostMember(member, walked, called, state);
  const answer = isThenable(running) ? await running : running;
  if (isErrorValue(answer)) return withPipeValue(state, answer);
  const bringing = definition.answer === null ? answer : answerUnderItsLabel(answer, definition.answer, labelName, walked, state);
  const brought = isThenable(bringing) ? await bringing : bringing;
  if (isErrorValue(brought)) return withPipeValue(state, brought);
  const refusing = definition.answer === null ? null : refusalOf(definition.answerInvariants, brought, state, scope);
  const refused = isThenable(refusing) ? await refusing : refusing;
  return withPipeValue(state, refused ?? brought);
}

// Whether an answer is waited on: anything with a `then`, so a host's
// promise of another realm and a thenable resolve as the core's own do.
const isThenable = value => typeof value?.then === 'function';

// The definition of the word at an address as a call reads it, its parts
// in the order of their places with their selectors and invariants, the
// tag and the invariants of its args and its answer with its invariants
// [D179], read once for the root where the scope declares no name under
// the address, or reads the root alone under the word's noun [D202],
// [D222].
function definitionOf(scope, address) {
  return readsTheReaderUnder(scope, splitAddress(address)[0]) && declaresUnder(scope, address) ? definitionIn(scope, address) : onceForRoot(ROOT_DEFINITIONS, scope, address, rootDefinitionIn);
}

const rootDefinitionIn = (scope, address) => definitionIn(rootScopeOf(scope), address);

const ROOT_DEFINITIONS = new WeakMap();

// The first invariant of a part that asks for kinds, `is` of the value or
// of each element, or undefined: the part is handed as the value of the
// kind the walk of its tags reaches, and a part that asks for a quote
// takes code [D166], [D167], [D169].
function kindInvariantIn(invariants) {
  return invariants.find(invariant => invariant.kinds !== null || invariant.elementKinds !== null);
}

function definitionIn(scope, address) {
  const declaredParts = partsOfName(scope, address);
  const parts = declaredParts.map(([name, partRecord]) => {
    const partAddress = partRecord.get('name').name;
    const selector = selectorOf(partRecord);
    const invariants = invariantsUnder(scope, partAddress);
    return { name: keyword(name), address: partAddress, selector, invariants, kindInvariant: kindInvariantIn(invariants) };
  });
  const answer = answerOf(scope, address);
  return {
    address, parts, places: placesReadBy(declaredParts), argsTag: makeTag(address),
    argsInvariants: invariantsUnder(scope, address),
    taken: parts.map(({ selector, kindInvariant }) => ({ readsArgs: selector.readsArgs, code: selector.readsArgs || (kindInvariant?.kinds?.includes('quote') ?? false) })),
    answer, answerInvariants: answer === null ? [] : invariantsUnder(scope, answer.address)
  };
}

// Whether a scope declares a name under an address, a part, an invariant
// or an answer.
function declaresUnder(scope, address) {
  const names = pathNamesOf(scope);
  if (names.length === 0) return false;
  const prefix = `${address}/`;
  return names.some(name => name.startsWith(prefix));
}

// The subject a word serves: the value of its label the walk of the
// subject's tags reaches, or, for a word of a noun itself, whose
// `subject` names `::tag`, the tag name the call was made on [D88].
function subjectServed(env, address, labelName, subject) {
  const walked = walkToKinds(subject, [labelName]);
  if (walked !== null || !isTag(subject)) return walked;
  return subjectOf(env, address)?.includes(TAG_KIND) ? { served: subject, passedTags: [] } : null;
}

const TAG_KIND = 'tag';

// The answer brought to the label its definition names [D169]: any value
// reaches `::any`; one that reaches another of the labels is the value it
// reaches; one of the word's own label goes back under the tags the walk
// passed, as the subject's kind; one label alone makes the value by its
// constructor and invariants, and so does a label of the answer's own kind
// the walk passed by, a number past the finite doubles refused there as
// under `::number` alone; an answer of none of several labels is refused
// under the answer's address.
function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state) {
  if (kinds.includes(ANY_KIND)) return answer;
  const others = kinds.filter(kind => kind !== labelName);
  const reached = others.length === 0 ? null : walkToKinds(answer, others);
  if (reached !== null) return reached.served;
  if (kinds.includes(labelName)) return keptAsSubject(answer, walked.served, walked.passedTags, state);
  const constructing = kinds.length === 1 ? kinds[0] : kinds.find(kind => kind === typeKeyword(answer).name);
  if (constructing !== undefined) return mintUnderTag(state, makeTag(constructing), answer);
  return refusalUnder(answerRefusalAddress(address, kinds), { actualValue: answer }, state.env);
}

const ANY_KIND = 'any';

// callMemberOn(record, subject, state) → the answer of the name under a
// label the record holds, run on the subject with no modifiers, the
// print a kind answers among them [D96].
export async function callMemberOn(record, subject, state) {
  return (await applyMember(record, [], withPipeValue(state, subject))).pipeValue;
}

// answerKindsOf(env, record, subjectKinds) → the kinds of the answer a
// name under a label gives, for a tool: the subject's own where the
// answer's label is the word's own, the labels its definition names, or
// null for a word that answers any value [D169].
export function answerKindsOf(env, record, subjectKinds) {
  const address = record.get('name').name;
  const answerDefinition = answerOf(env, address);
  if (answerDefinition === null || answerDefinition.kinds.includes(ANY_KIND)) return null;
  return answerDefinition.kinds.includes(splitAddress(address)[0]) ? subjectKinds : answerDefinition.kinds;
}

// The scope a name under a label runs in: a quote's own, over the tree of
// names as it stands at the call, the root and every name with a path the
// steps before the call declared and every label the reader declared, so
// the names under a label see each other whatever their order and a value
// of a kind the reader declared finds its page, while no bare value of the
// reader reaches in [D222]; a primitive reads the call's.
function scopeOfMember(member, state) {
  if (!isQuote(member)) return state.env;
  const carried = envToRun(member, state.env);
  const scope = asScopeOf(carried, new Map(carried));
  scope.set(ROOT_KEY, rootOf(state.env));
  for (const [name, entry] of state.env) {
    if (typeof name !== 'string' || scope.has(name)) continue;
    if (name.includes('/') || (isBinding(entry) && holdsAPage(entry))) scope.set(name, entry);
  }
  return scope;
}

// The values of the parts of a call in their order, read from its args,
// the values of its modifiers computed against the subject, and for a
// word of the language the scope of its body, each part bound by its name
// and the args as `args`; args with more values than the parts have
// places are refused under the name, and what breaks an invariant, args
// or a part, under the invariant, a part the args do not hold under the
// part [D169], [D173].
async function argsOf(definition, lambdas, state, scope, bindsNames) {
  const values = [];
  for (const [place, lambda] of lambdas.entries()) {
    const computing = lambda(state.pipeValue);
    const value = isThenable(computing) ? await computing : computing;
    if (isErrorValue(value)) return refusalOfComputedCode(definition.parts, place, value, scope);
    values.push(value);
  }
  let args = null;
  const argsValue = () => args ??= makeTaggedInstance(definition.argsTag, values);
  if (definition.places !== null && values.length > definition.places) return refusalUnder(argsBeyondPartsAddress(definition.address), { places: definition.places, actualValue: argsValue() }, scope);
  const argsRefused = definition.argsInvariants.length === 0 ? null : await refusalOf(definition.argsInvariants, argsValue(), state, scope);
  if (argsRefused !== null) return argsRefused;
  let bodyEnv = bindsNames ? envSet(scope, 'args', makeBinding({ name: ARGS_NAME, value: argsValue() })) : null;
  const overArgs = () => nestState(state, argsValue(), scope);
  const partValues = [];
  for (const { name, address: partAddress, selector, invariants, kindInvariant } of definition.parts) {
    frameBelow(state);
    const reading = partOf(selector, values, overArgs);
    const part = isThenable(reading) ? await reading : reading;
    if (part === MISSED_PLACE || (isErrorValue(part) && isMissedPlace(part))) return refusalUnder(notGivenAddress(partAddress), { actualValue: argsValue() }, scope);
    if (isErrorValue(part)) return part;
    const refusing = refusalOf(invariants, part, state, scope);
    const refused = isThenable(refusing) ? await refusing : refusing;
    if (refused !== null) return refused;
    const handed = servedByInvariant(kindInvariant, part);
    partValues.push(handed);
    if (bindsNames) bodyEnv = envSet(bodyEnv, name.name, makeBinding({ name, value: handed }));
  }
  return { values: partValues, taken: definition.taken, bodyEnv };
}

const ARGS_NAME = keyword('args');

// A value the call computed that answered an error where a part that
// asks for code reads, by an invariant `is` of a quote or, for the part
// that reads the args whole, `every ~(is …)` of one: the step ran on the
// subject by mistake, `filter /active` for `filter ~(/active)`, and the
// part's invariant refuses it with the error at rest as its value, the
// part that reads the args naming the place, from zero; anywhere else the
// error is the answer [D67], [D167], [D169], [D210].
function refusalOfComputedCode(parts, place, error, scope) {
  const reading = parts.find(({ selector }) => selector.place === place) ?? parts.find(({ selector }) => selector.readsArgs);
  if (reading === undefined) return error;
  const { kindInvariant: invariant, selector: { readsArgs } } = reading;
  const asked = invariant === undefined ? null : readsArgs ? invariant.elementKinds : invariant.kinds;
  if (asked === null || !asked.includes('quote')) return error;
  const atRest = errorAtRest(error.tag, new Map(error.descriptor));
  return refusalUnder(invariant.address, readsArgs ? { index: place, actualValue: atRest } : { actualValue: atRest }, scope);
}

// The value a part's selector reads from the args: a selector of one
// step that reads a place, `/n` or `at n default`, is the value at the
// place, read here as `at` reads it, so the parts of `at` itself read
// without calling it; any other selector runs as code over the args, a
// frame below the call.
function partOf({ ast, place, onePlace, strict, fallback }, values, overArgs) {
  if (!onePlace) return answerOfBody(ast, overArgs());
  if (place < values.length) return values[place];
  if (strict) return MISSED_PLACE;
  return fallback === null ? null : answerOfBody(fallback, overArgs());
}

async function answerOfBody(ast, state) {
  return (await evalBody(ast, state)).pipeValue;
}

// A strict read of a place past the values of the args.
const MISSED_PLACE = Symbol('missedPlace');

// A part handed as its invariant of kinds asks: for `is` the value of the kind
// the walk of its tags reaches, for `every ~(is …)` the vector, or the
// set, of each element's, the tags passed left behind, as a subject is
// served; a quote and a doc, whose elements are steps and segments, and
// a part with no such invariant as they are [D166], [D167].
function servedByInvariant(invariant, part) {
  if (invariant === undefined) return part;
  if (invariant.kinds !== null) return walkToKinds(part, invariant.kinds).served;
  const ownKind = walkToKinds(part, ['set', 'quote', 'doc']);
  if (ownKind !== null && !isQSet(ownKind.served)) return ownKind.served;
  const elements = ownKind ?? walkToKinds(part, ['vec']);
  if (elements === null) return part;
  const served = Array.from(elements.served, element => walkToKinds(element, invariant.elementKinds).served);
  return isQSet(elements.served) ? makeSet(served) : Object.freeze(served);
}

// The first element the walk of whose tags reaches none of the kinds,
// with its index from zero, or null when every one does.
function refusedElementOf(elements, kinds) {
  const index = elements.findIndex(element => walkToKinds(element, kinds) === null);
  return index === -1 ? null : { index, element: elements[index] };
}

// A strict read of a place the args do not hold.
function isMissedPlace(error) {
  return error.tag.name === 'proj/IndexOutOfBoundsError' || error.tag.name === 'proj/KeyNotInMapError';
}

// A primitive runs over the value the walk served and the values of the
// parts, a quote closed at the call into code [D4] where the part takes
// code, each element so for the part that reads the args whole
// [D167].
function runHostMember(member, walked, called, state) {
  const handed = called.values.map((value, index) => {
    const { readsArgs, code } = called.taken[index];
    const takenBy = element => (code && isQuote(element) ? codeOf(element, state) : element);
    const served = readsArgs ? walkToKinds(value, ['vec'])?.served : undefined;
    return isVec(served) ? served.map(takenBy) : takenBy(value);
  });
  return runPrimitive(hostImplOf(member), walked.served, walked.passedTags, handed, state);
}

// makeLambda(astNode, capturedState) → (input) → value: code run against
// the input it is handed, one frame below and in its scope, a step on the
// success track as every step is; it keeps its tree and its state, so
// `reduce` finds the verb a quote of one name holds [D56].
function makeLambda(astNode, capturedState) {
  const lambda = async (lambdaInput) => {
    const subState = nestState(capturedState, lambdaInput, capturedState.env);
    return (await evalBody(astNode, subState)).pipeValue;
  };
  lambda.astNode = astNode;
  lambda.capturedState = capturedState;
  return lambda;
}

// modifierOf(argNode, state) → the lambda of a modifier of a call, whose
// subject is never an error: a quote written there carrying the scope of
// the call [D43], a literal of a scalar its value one frame below the
// call, and any other modifier the code it is.
function modifierOf(argNode, state) {
  if (argNode.type === 'QuoteLit') return async () => quoteInEnv(quoteOfLiteral(argNode), state.env);
  if (SCALAR_LITERALS.has(argNode.type)) return () => (frameBelow(state), AST_NODE_EVALUATORS[argNode.type](argNode, state).pipeValue);
  return makeLambda(argNode, state);
}

const SCALAR_LITERALS = new Set(['NumberLit', 'StringLit', 'BooleanLit', 'NullLit', 'Keyword']);

// codeOf(code, callState) → lambda: a quote a part of code holds, closed
// at the call [D4], run against each input its verb hands it in the scope
// the quote carries, or that of the call for a quote held as data [D43].
export function codeOf(code, callState) {
  return makeLambda(astOfQuote(code), withEnv(callState, envToRun(code, callState.env)));
}

// resolveBinaryReducer(reducerLambda) → (acc, item) → value, or null: the
// word a reducer's quote names by one word, its name or its address,
// called as the pipe calls it, `acc | add item`, the word residing on the
// accumulator among them [D72], and a value of the scope under the name
// meeting the word there [D223], [D224]; null for code of any other shape
// or a name of no word, which `reduce` refuses.
export function resolveBinaryReducer(reducerLambda) {
  const callerState = reducerLambda.capturedState;
  const astNode = reducerLambda.astNode;
  if (astNode.type !== 'Call' || astNode.args.length !== 0) return null;
  const item = element => [async () => element];
  if (astNode.address !== undefined) {
    if (!isWord(callerState.env, astNode.name)) return null;
    const record = nodeOf(callerState.env, astNode.name);
    return async (acc, element) => (await applyMember(record, item(element), withPipeValue(callerState, acc))).pipeValue;
  }
  if (addressesOf(callerState.env, astNode.name).length === 0) return null;
  return async (acc, element) =>
    (await callByName(astNode.name, item(element), withPipeValue(callerState, acc))).pipeValue;
}

// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
