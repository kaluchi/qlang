// The evaluator: the state pair of value and environment threaded through
// the steps, each node a function `(node, state) → state`.

import { parse } from './parse.mjs';
import { ROOT_KEY } from './env-keys.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, envSet, envHas, rootOf
} from './state.mjs';
import { fork, forkEach } from './fork.mjs';
import { declareRefusal, QlangError, QlangInvariantError, CallUnknownNameError, CallUnknownAddressError, BindEffectMarkMissingError, BindNameDeclaredTwiceError, declareInvariantError } from './errors.mjs';
import { nearestNames, nearestTagNames } from './nearest-names.mjs';
import { classifyEffect } from './effect.mjs';
import { findFirstEffectfulIdentifier } from './effect-check.mjs';
import {
  isVec, isQMap, isQSet, isErrorValue, isQuote, isDoc, hostImplOf,
  typeKeyword, keyword, NULL, makeErrorValue, makeQuote,
  makeDoc, makeSet,
  makeBinding, bindingValueOf, makeTaggedInstance, makeTagKeyword, isTagKeyword,
  isValueClass, quoteInEnv, quoteEnvRef, envToRun,
  ERROR_TAG
} from './types.mjs';
import { declaredNameOf, originOf, repeatsDeclarationInScope } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, docOfNode, slotDocsOf, astOfQuote, stepOfNode, eachStepOf, tagCallStepOf } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse, factsInOrder } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  addressesOf, answerOf, bareNameReach, isInvariant, isMemberValue, isUnderLabel, isWord, invariantsUnder, nodeOf, partsOfName, readsParts, residencesOf, segmentIndex, selectorOf, vocabularyWords
} from './runtime/nouns.mjs';
import { splitAddress } from './address.mjs';
import {
  runPrimitive, keptAsSubject, mintUnderTag, walkToKinds, CallKindAnswersNoVerbError
} from './runtime/verb.mjs';
import {
  answerOfStep, answerOfWord, skipping, raisedBy, isRaisedBy, resumingItsTrail, resumesItsTrail
} from './eval-trail.mjs';

// A node or a combinator the tables below do not name is a defect of the
// evaluator, raised past the fail track.
const BuiltinUnknownAstNodeTypeError = declareInvariantError(
  'builtin/UnknownAstNodeTypeError',
  ({ nodeType }) => `unknown AST node type: ${nodeType}`);

const BuiltinUnknownCombinatorKindError = declareInvariantError(
  'builtin/UnknownCombinatorKindError',
  ({ kind }) => `unknown combinator: ${kind}`);

const ProjSubjectNotProjectableError = declareRefusal('proj/SubjectNotProjectableError');
const ProjKeyNotInMapError = declareRefusal('proj/KeyNotInMapError');
const ProjIndexOutOfBoundsError = declareRefusal('proj/IndexOutOfBoundsError');
const ProjIndexNotIntegerError = declareRefusal('proj/IndexNotIntegerError');
// The tag of a name that holds data puts no value under it: a value goes
// under a label, a word, an invariant or a tag no node answers [D173].
const ConstructTagNotKindError = declareRefusal('construct/TagNotKindError');
const EachSubjectNotContainerError = declareRefusal('each/SubjectNotContainerError');
// A bare name the reader declares for a value takes no word of the
// vocabulary, the name of a verb or of a name under a label, so no step
// meets the reader's value where the subject's word was meant [D166].
const BindNameTakenByVocabularyError = declareRefusal('bind/NameTakenByVocabularyError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError      = declareRefusal('call/ValueTakesNoModifiersError');
// evalQuery(source, env?) → the value a query answers from null, in the
// runtime's environment unless `env` is given.
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
  BareTypeKeyword:   evalBareTypeKeyword,
  Projection:        evalProjection,
  OperandCall:       evalOperandCall,
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
    if (caughtError instanceof QlangError && !caughtError.location && node.location)
      caughtError.location = node.location;
    if (caughtError instanceof QlangInvariantError) throw caughtError;
    // The error the node raised; the step that ran the node writes its
    // stop [D85].
    const raised = caughtError instanceof QlangError ? errorFromQlang(caughtError, state.pipeValue, state.env)
      : errorFromForeign(caughtError, node, state.env);
    return withPipeValue(state, raisedBy(raised, node));
  }
}

// ─── Pipeline ───────────────────────────────────────────────────

// The head of a pipeline rides `|` unless it is written after `!|` or
// `*`, so `~(* add 1)` replays through `apply` as it was written.
async function evalPipeline(node, state) {
  let current = await applyCombinator(node.leadingCombinator ?? '|', state, node.steps[0]);
  for (const unit of node.steps.slice(1)) current = await applyCombinator(unit.combinator, current, unit.step);
  return current;
}

// The tracks live in the combinators alone: `|` and `*` step around an
// error, the step joining the skipped steps of its last stop [D85], and
// `!|` fires on an error alone [D51].
const COMBINATOR_EVALUATORS = {
  '|':  applySuccessTrack,
  '!|': applyFailTrack,
  '*':  distribute
};

async function applyCombinator(kind, state, stepNode) {
  const evaluator = COMBINATOR_EVALUATORS[kind];
  if (!evaluator) {
    throw new BuiltinUnknownCombinatorKindError({ kind });
  }
  return await evaluator(state, stepNode);
}

// `|` runs the step on a value, an error it answers taking a stop there,
// and an error in the pipe skips it.
async function applySuccessTrack(state, stepNode) {
  if (isErrorValue(state.pipeValue)) return withPipeValue(state, skipping(state.pipeValue, stepOfNode(stepNode)));
  const answered = await evalNode(stepNode, state);
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => quoteOfBody(stepNode), state.pipeValue, state.env));
}

// A body, a query, a group, a verb's body or an applied quote among them,
// whose head rides `|` like every other step.
function evalBody(node, state) {
  return node.type === 'Pipeline' ? evalNode(node, state) : applySuccessTrack(state, node);
}

// The container beneath every tag stacked over a value, which distribute
// reaches as the walk hands a verb the value it serves [D34].
function containerBeneathTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

async function distribute(state, bodyNode) {
  if (isErrorValue(state.pipeValue)) return withPipeValue(state, skipping(state.pipeValue, eachStepOf(bodyNode)));
  const subjectSeq = containerBeneathTags(state.pipeValue);
  if (!isVec(subjectSeq) && !isQMap(subjectSeq)) {
    const distributeErr = new EachSubjectNotContainerError({ actualValue: state.pipeValue });
    distributeErr.location = bodyNode.location;
    const refused = errorFromQlang(distributeErr, state.pipeValue, state.env);
    return withPipeValue(state, answerOfStep(refused, () => makeQuote([eachStepOf(bodyNode)]), state.pipeValue, state.env));
  }
  // The parentheses after `*` delimit its body, whose head takes the
  // track, so `[e 1] * (!| 0)` recovers an error element; the first error
  // the body answers answers the distribute, the elements after it left
  // unrun [D103]. A map's elements are its values.
  const bodyPipeline = bodyNode.type === 'ParenGroup' ? bodyNode.pipeline : bodyNode;
  if (isQMap(subjectSeq)) {
    const mapEntries = [...subjectSeq];
    const entryAnswers = await forkEach(state, mapEntries.map(([, entryValue]) => entryValue), inner => evalBody(bodyPipeline, inner));
    if (isErrorValue(entryAnswers)) return withPipeValue(state, failedInside(entryAnswers, bodyNode, state));
    return withPipeValue(state, new Map(mapEntries.map(([entryKey], index) => [entryKey, entryAnswers[index]])));
  }
  const distributeResults = await forkEach(state, subjectSeq, inner => evalBody(bodyPipeline, inner));
  if (isErrorValue(distributeResults)) return withPipeValue(state, failedInside(distributeResults, bodyNode, state));
  // A set distributes into the vector of its images, one per element in
  // the one order [D116].
  return withPipeValue(state, distributeResults);
}

// The error an element of a distribute answered, which answers the
// distribute with a stop of its own after the stops inside [D85].
function failedInside(elementError, bodyNode, state) {
  return answerOfStep(elementError, () => makeQuote([eachStepOf(bodyNode)]), state.pipeValue, state.env);
}

// `!|` runs the step on a raised error alone, opened to the error
// itself: the map of its facts, `:trail` among them, under `::error`,
// with the tag of the site that refused stacked over it, so `!| type`
// reads the site and a verb of `::error` reaches every error [D97]; a
// value passes. A raise that writes the `:trail` it read resumes that
// path [D85].
async function applyFailTrack(state, stepNode) {
  if (!isErrorValue(state.pipeValue)) return state;
  const raised = state.pipeValue;
  const errorOfKind = makeTaggedInstance(ERROR_TAG, new Map(raised.descriptor));
  const opened = raised.tag === ERROR_TAG ? errorOfKind : makeTaggedInstance(raised.tag, errorOfKind);
  const answered = await evalNode(stepNode, withPipeValue(state, opened));
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => quoteOfBody(stepNode), opened, state.env));
}

// ─── Literal evaluators ─────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNullLit(_node, state)    { return withPipeValue(state, NULL); }
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }

// Each element and each value of a literal is a word forked against the
// subject, one after another in their order [D84].
async function evalVecLit(node, state) {
  const elementValues = [];
  for (const elem of node.elements) elementValues.push(await wordAnswer(elem, state));
  return withPipeValue(state, elementValues);
}

async function evalMapLit(node, state) {
  const mapResult = new Map();
  for (const entry of node.entries) mapResult.set(entry.key.name, await wordAnswer(entry.value, state));
  return withPipeValue(state, mapResult);
}

// The tag of an error literal is the one written before its bang,
// `::Foo!{…}` [D86], else a tag name under `:kind`, else the kind of
// errors [D64]; a `:kind` of another value stays a field.
async function evalErrorLit(node, state) {
  const errorDescriptor = new Map();
  let tag = ERROR_TAG;
  for (const entry of node.entries) {
    const entryValue = await wordAnswer(entry.value, state);
    if (entry.key.name === 'kind' && isTagKeyword(entryValue)) {
      tag = entryValue;
      continue;
    }
    errorDescriptor.set(entry.key.name, entryValue);
  }
  if (node.tag !== null) tag = makeTagKeyword(node.tag);
  // A literal that writes its `:trail` resumes that path [D85].
  const minted = makeErrorValue(tag, errorDescriptor, { location: node.location });
  return withPipeValue(state, errorDescriptor.has('trail') ? resumingItsTrail(minted) : minted);
}

// The value a word of a literal answers, forked against the subject:
// an error the word raised passes a stop at the word, and any other
// waits in the container as it is [D85].
async function wordAnswer(wordNode, state) {
  const answered = await fork(state, inner => evalNode(wordNode, inner));
  return answerOfWord(answered.pipeValue, wordNode, state.pipeValue);
}

function evalQuoteLit(node, state) {
  return withPipeValue(state, quoteOfLiteral(node));
}

function evalDocLit(node, state) {
  return withPipeValue(state, docOfNode(node));
}

// The elements run in the order they are written, and the set holds
// them in the one order [D16].
async function evalSetLit(node, state) {
  const setElements = [];
  for (const setElem of node.elements) setElements.push(await wordAnswer(setElem, state));
  return withPipeValue(state, makeSet(setElements));
}

// ─── TaggedLit / BareTypeKeyword ────────────────────────────────

// mintTaggedInstance(tagName, payload, state) → the payload under the tag
// through its label [D168]; a tag no node answers is a kind of the
// scope's own, identity, the tag of a word lays itself over the args of a
// call of it, which the call checks as it reads them, so the args a call
// prints read back, and the tag of an invariant, the kind of the error it
// refuses with, over the facts a reader raises again [D42], [D173]. A
// value a verb returns under its subject's tag is minted here again
// [D41]; no constructor meets an error [D86].
export async function mintTaggedInstance(tagName, payload, state) {
  const declared = bindingValueOf(nodeOf(state.env, tagName));
  if (declared === null || isWord(state.env, tagName) || isInvariant(declared)) return makeTaggedInstance(makeTagKeyword(tagName), payload);
  if (!isDoc(declared)) {
    throw new ConstructTagNotKindError({ tag: makeTagKeyword(tagName), actualValue: declared });
  }
  return await underPage(tagName, payload, state);
}

// A label declared by its page lays its tag over a payload [D166]: the
// `construct` declared under it builds the payload first when there is
// one, a value of the label's own kind, as the constructor of a kind of
// the core answers, staying as it is, and every law declared under it
// runs on the value under the label, a broken one refusing it under the
// law's name [D169].
async function underPage(tagName, payload, state) {
  const constructRecord = nodeOf(state.env, `${tagName}/construct`);
  let built = payload;
  if (constructRecord !== null && isMemberValue(bindingValueOf(constructRecord))) {
    built = await constructedBy(bindingValueOf(constructRecord), payload, state);
    if (isErrorValue(built)) return built;
  }
  const labelled = typeKeyword(built).name === tagName ? built : makeTaggedInstance(makeTagKeyword(tagName), built);
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
// does not answer true to, named by the invariant [D169], or the error an
// invariant answered, handed on as it is; null when every invariant
// holds. An invariant of each element names the index of the element it
// refuses, from zero.
async function refusalOfInvariants(address, value, state, scope) {
  for (const { address: invariantAddress, query, kinds, elementKinds } of invariantsOf(scope, address)) {
    const elements = elementKinds === null ? null : walkToKinds(value, ['vec']);
    if (elements !== null) {
      const refused = refusedElementOf(elements.served, elementKinds);
      if (refused === null) continue;
      return refusalUnder(invariantAddress, { index: refused.index, actualValue: refused.element }, scope);
    }
    const answer = kinds !== null
      ? walkToKinds(value, kinds) !== null
      : (await evalBody(astOfQuote(query), nestState(state, value, scope))).pipeValue;
    if (isErrorValue(answer)) return answer;
    if (answer !== true) return refusalUnder(invariantAddress, { actualValue: value }, scope);
  }
  return null;
}

// The invariants declared under an address, each with the kinds it asks
// for when it is one step `is`, of the value or of each element, read
// once per invariant.
const KINDS_OF_INVARIANT = new WeakMap();

function invariantsOf(env, address) {
  return invariantsUnder(env, address).map(([invariantAddress, query]) => {
    let asked = KINDS_OF_INVARIANT.get(query);
    if (asked === undefined) {
      const ast = astOfQuote(query);
      asked = { kinds: kindsAskedBy(ast), elementKinds: elementKindsAskedBy(ast) };
      KINDS_OF_INVARIANT.set(query, asked);
    }
    return { address: invariantAddress, query, ...asked };
  });
}

// A refusal named by the address of what refused [D166], its facts with
// the kind of the value refused in the order the catalog declares them
// [D172]; the value itself rides the facts where the trail does not hold
// it, a part or the args, and leaves them for the subject, which the
// trail's first stop holds [D85].
function refusalUnder(tagName, facts, env, refused = facts.actualValue) {
  const tag = makeTagKeyword(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)).set('actualType', typeKeyword(refused)), env));
}

async function evalTaggedLit(node, state) {
  const tagName = node.tag;
  const payload = (await fork(state, inner => evalNode(node.payload, inner))).pipeValue;
  if (isErrorValue(payload)) return withPipeValue(state, passedUntagged(payload, node, tagName));
  return withPipeValue(state, await mintTaggedInstance(tagName, payload, state));
}

// A tagged literal is its payload piped into `tag`, and a tag laid over
// an error answers the error, so the step of the tag joins the skipped
// steps of its last stop [D86]. An error the payload raised is the
// literal's own raise, and one that resumes its trail makes the literal
// resume it [D85].
function passedUntagged(payloadError, node, tagName) {
  const passed = skipping(payloadError, tagCallStepOf(makeTagKeyword(tagName)));
  if (isRaisedBy(payloadError, node.payload)) raisedBy(passed, node);
  if (resumesItsTrail(payloadError)) resumingItsTrail(passed);
  return passed;
}

// A tag name is a value of its own, read without the scope [D20].
async function evalBareTypeKeyword(node, state) {
  return withPipeValue(state, makeTagKeyword(node.tag));
}

// ─── BindStep ───────────────────────────────────────────────────

// The one binding form [D44]: the value passes on, and the scope takes the
// record of the binding [D63], whose value is the body evaluated once, at
// declaration, against the current value, so `42 | :x / | add 1 | x`
// answers 42; a doc alone binds a doc, a page. A quote written as the
// body resolves in the scope the declaration writes, so it sees its own
// name [D44]. A name is declared once in its scope [D71],
// and a node the root holds once at all, so a reader extends a noun of the
// root and replaces none of its nodes [D153]; a name with a path is
// declared under a noun declared before it.
async function evalBindStep(node, state) {
  const name = declaredNameOf(node);
  const [nounName] = splitAddress(name);
  if (repeatsDeclarationInScope(node) || (nounName !== null && rootOf(state.env).has(name))) {
    throw new BindNameDeclaredTwiceError({ name: keyword(name) });
  }
  if (nounName !== null && !envHas(state.env, nounName)) {
    throw new BindNounNotDeclaredError({ name: keyword(name), noun: makeTagKeyword(nounName) });
  }

  if (node.body === null) {
    return withEnv(state, envSet(state.env, name, declarationRecord(node, makeDoc(slotDocsOf(node).flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc])))));
  }

  const answered = (await evalNode(node.body, state)).pipeValue;
  if (nounName === null && !isDoc(answered) && vocabularyWords(state.env).has(name)) {
    throw new BindNameTakenByVocabularyError({ name: keyword(name), addresses: addressesOf(state.env, name) });
  }
  const partName = nounName === null ? null : splitAddress(name)[1];
  if (isQuote(answered) && partName !== null && isQuoteUnderLabel(state.env, nounName) && vocabularyWords(state.env).has(partName)) {
    throw new BindNameTakenByVocabularyError({ name: keyword(partName), addresses: addressesOf(state.env, partName) });
  }
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

// Whether a node is a quote under a label, whose parts are bound by name
// in its body, so a part takes no word of the vocabulary, as a bare name
// does not [D166].
function isQuoteUnderLabel(env, nounName) {
  return isQuote(bindingValueOf(nodeOf(env, nounName))) && isUnderLabel(env, nounName);
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
    if (!projected.has(projKey)) throw new ProjKeyNotInMapError({ key: keyword(projKey), actualValue: subject });
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

async function evalOperandCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  return await callByName(node.name, node.args.map(argNode => makeLambda(argNode, state)), state);
}

// A bare name calls what it reaches for the subject [D62], [D153]; a
// word the kind of the subject does not answer is refused with the
// addresses where the word lives [D169], and a name that reaches nothing
// with the names near it.
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
    throw new CallUnknownAddressError({ address: makeTagKeyword(node.name), nearest: nearestTagNames(state.env, node.name) });
  }
  const lambdas = node.args.map(argNode => makeLambda(argNode, state));
  if (isMemberValue(bindingValueOf(record)) && isUnderLabel(state.env, node.name)) {
    return await applyMember(record, lambdas, state);
  }
  return await applyBinding(record, splitAddress(node.name)[1], lambdas, state);
}

// ─── Names under a label ───────────────────────────────────────

// A name under a label runs on a value of the label [D164]: a quote in the
// scope of its declaration over the root as it stands, so the names under
// one label see each other whatever their order, and the descriptor of a
// primitive by the implementation its host handed. A subject the walk of
// whose tags reaches no value of the label is refused under the name's
// address, and the answer is brought to the label its definition names
// [D169].
async function applyMember(record, lambdas, state) {
  const address = record.get('name').name;
  const member = bindingValueOf(record);
  const [labelName] = splitAddress(address);
  const walked = walkToKinds(state.pipeValue, [labelName]);
  if (walked === null) {
    const [, labelWord] = splitAddress(labelName);
    return withPipeValue(state, refusalUnder(`${address}/SubjectNot${labelWord[0].toUpperCase()}${labelWord.slice(1)}Error`, {}, state.env, state.pipeValue));
  }
  const scope = scopeOfMember(member, state);
  const called = await argsOf(address, partsOfName(scope, address), lambdas, state, scope, isQuote(member));
  if (isErrorValue(called)) return withPipeValue(state, called);
  const answer = isQuote(member)
    ? (await evalBody(astOfQuote(member), nestState(state, state.pipeValue, called.bodyEnv))).pipeValue
    : await runHostMember(member, walked, called, state);
  if (isErrorValue(answer)) return withPipeValue(state, answer);
  const answerDefinition = answerOf(scope, address);
  const brought = answerDefinition === null ? answer : await answerUnderItsLabel(answer, answerDefinition, labelName, walked, state);
  if (isErrorValue(brought)) return withPipeValue(state, brought);
  const refused = answerDefinition === null ? null : await refusalOfInvariants(answerDefinition.address, brought, state, scope);
  return withPipeValue(state, refused ?? brought);
}

// The answer brought to the label its definition names [D169]: any value
// reaches `::any`; one that reaches another of the labels is the value it
// reaches; one of the word's own label goes back under the tags the walk
// passed, as the subject's kind; one label alone makes the value by its
// constructor and laws; an answer of none of several labels is refused
// under the answer's address.
async function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state) {
  if (kinds.includes(ANY_KIND)) return answer;
  const others = kinds.filter(kind => kind !== labelName);
  const reached = others.length === 0 ? null : walkToKinds(answer, others);
  if (reached !== null) return reached.served;
  if (kinds.includes(labelName)) return await keptAsSubject(answer, walked.served, walked.passedTags, state);
  if (kinds.length === 1) return await mintUnderTag(state, makeTagKeyword(kinds[0]), answer);
  return refusalUnder(`${address}/Not${kinds.map(capitalOf).join('Or')}Error`, { actualValue: answer }, state.env);
}

const ANY_KIND = 'any';
const capitalOf = kind => { const [, word] = splitAddress(kind); return word[0].toUpperCase() + word.slice(1); };

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
// steps before the call declared, so the names under a label see each
// other whatever their order and no bare name of the reader reaches in;
// a primitive reads the call's.
function scopeOfMember(member, state) {
  if (!isQuote(member)) return state.env;
  const scope = new Map(envToRun(member, state.env));
  scope.set(ROOT_KEY, rootOf(state.env));
  for (const [name, entry] of state.env) {
    if (typeof name === 'string' && name.includes('/') && !scope.has(name)) scope.set(name, entry);
  }
  return scope;
}

// The places the parts read, one past the greatest a part reads strictly
// or softly, or null when a part reads no place, the args whole, a
// place from its end or anything else, and so takes any number of
// values.
function placesReadBy(parts) {
  let places = 0;
  for (const [, partRecord] of parts) {
    const { place } = selectorOf(partRecord);
    if (!Number.isInteger(place)) return null;
    places = Math.max(places, place + 1);
  }
  return places;
}

// The args of a call, the values of its modifiers each computed against
// the subject under the name's address, and its parts read from them:
// args with more values than the parts have places are refused under the
// name, args that break a law declared under the name under the law, a
// part the args do not hold under the part, and a part that breaks a law
// declared under it under the law [D169], [D173]. Answers the values of
// the parts in their order and, for a word of the language, the scope of
// its body, where each part is bound by its name and the args as `args`;
// a host's word reads the values alone.
async function argsOf(address, parts, lambdas, state, scope, bindsNames) {
  const values = [];
  for (const [place, lambda] of lambdas.entries()) {
    const value = await lambda(state.pipeValue);
    if (isErrorValue(value)) return refusalOfComputedCode(parts, place, value, scope);
    values.push(value);
  }
  const args = makeTaggedInstance(makeTagKeyword(address), values);
  const places = placesReadBy(parts);
  if (places !== null && values.length > places) return refusalUnder(`${address}/ArgsBeyondPartsError`, { places, actualValue: args }, scope);
  const argsRefused = await refusalOfInvariants(address, args, state, scope);
  if (argsRefused !== null) return argsRefused;
  let bodyEnv = bindsNames ? envSet(scope, 'args', makeBinding({ name: keyword('args'), value: args })) : null;
  const partValues = [];
  const taken = [];
  for (const [partName, partRecord] of parts) {
    const partAddress = partRecord.get('name').name;
    const selector = selectorOf(partRecord);
    const part = await partOf(selector, values, nestState(state, args, scope));
    if (part === MISSED_PLACE || (isErrorValue(part) && isMissedPlace(part))) return refusalUnder(`${partAddress}/NotGivenError`, { actualValue: args }, scope);
    if (isErrorValue(part)) return part;
    const refused = await refusalOfInvariants(partAddress, part, state, scope);
    if (refused !== null) return refused;
    const kindInvariant = kindInvariantOf(scope, partAddress);
    const handed = servedByInvariant(kindInvariant, part);
    partValues.push(handed);
    taken.push({ readsArgs: selector.readsArgs, code: selector.readsArgs || (kindInvariant?.kinds?.includes('quote') ?? false) });
    if (bindsNames) bodyEnv = envSet(bodyEnv, partName, makeBinding({ name: keyword(partName), value: handed }));
  }
  return { values: partValues, taken, bodyEnv };
}

// A value the call computed that answered an error where a part that
// asks for code reads, by a law `is` of a quote or, for the part that
// reads the args whole, `every ~(is …)` of one: the step ran on the
// subject by mistake, `filter /active` for `filter ~(/active)`, and the
// part's law refuses it with the error as its value, the part that reads
// the args naming the place, from zero; anywhere else the error is the
// answer [D67], [D167], [D169].
function refusalOfComputedCode(parts, place, error, scope) {
  const reading = parts.find(([, partRecord]) => selectorOf(partRecord).place === place)
    ?? parts.find(([, partRecord]) => selectorOf(partRecord).readsArgs);
  if (reading === undefined) return error;
  const [, partRecord] = reading;
  const invariant = kindInvariantOf(scope, partRecord.get('name').name);
  const { readsArgs } = selectorOf(partRecord);
  const asked = invariant === undefined ? null : readsArgs ? invariant.elementKinds : invariant.kinds;
  if (asked === null || !asked.includes('quote')) return error;
  return refusalUnder(invariant.address, readsArgs ? { index: place, actualValue: error } : { actualValue: error }, scope);
}

// The value a part's selector reads from the args: a selector of one
// step that reads a place, `/n` or `at n default`, is the value at the
// place, read here as `at` reads it, so the parts of `at` itself read
// without calling it; any other selector runs as code over the args.
async function partOf({ ast, place, onePlace, strict, fallback }, values, state) {
  if (!onePlace) return (await evalBody(ast, state)).pipeValue;
  if (place < values.length) return values[place];
  if (strict) return MISSED_PLACE;
  return fallback === null ? null : (await evalBody(fallback, state)).pipeValue;
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

// The first invariant declared under an address that asks for kinds, `is`
// of the value or of each element, or undefined: a part is handed as the
// value of the kind the walk of its tags reaches, and a part that asks
// for a quote takes code [D166], [D167], [D169].
function kindInvariantOf(env, address) {
  return invariantsOf(env, address).find(invariant => invariant.kinds !== null || invariant.elementKinds !== null);
}

// The kinds an invariant of one step `is ::k …` asks for, or null.
function kindsAskedBy(ast) {
  if (ast.type !== 'OperandCall' || ast.name !== 'is') return null;
  return ast.args.every(arg => arg.type === 'BareTypeKeyword') ? ast.args.map(arg => arg.tag) : null;
}

// The kinds an invariant `every ~(is ::k …)` asks of each element, or null.
function elementKindsAskedBy(ast) {
  const asksEach = ast.type === 'OperandCall' && ast.name === 'every' && ast.args.length === 1 && ast.args[0].type === 'QuoteLit';
  return asksEach ? kindsAskedBy(ast.args[0].pipeline) : null;
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
async function runHostMember(member, walked, called, state) {
  const handed = called.values.map((value, index) => {
    const { readsArgs, code } = called.taken[index];
    const takenBy = element => (code && isQuote(element) ? codeOf(element, state) : element);
    const served = readsArgs ? walkToKinds(value, ['vec'])?.served : undefined;
    return isVec(served) ? served.map(takenBy) : takenBy(value);
  });
  return await runPrimitive(hostImplOf(member), walked.served, walked.passedTags, handed, state);
}

// makeLambda(astNode, capturedState) → (input) → value: a modifier run
// against the input it is handed, one frame below the call and in its
// scope, a quote written there carrying the scope of the call [D43]; it
// keeps its tree and its state, so `reduce` finds the verb a quote of one
// name holds [D56].
function makeLambda(astNode, capturedState) {
  const lambda = astNode.type === 'QuoteLit'
    ? async () => quoteInEnv(quoteOfLiteral(astNode), capturedState.env)
    : async (lambdaInput) => {
      const subState = nestState(capturedState, lambdaInput, capturedState.env);
      const evaluatedState = await evalBody(astNode, subState);
      return evaluatedState.pipeValue;
    };
  lambda.astNode = astNode;
  lambda.capturedState = capturedState;
  return lambda;
}

// codeOf(code, callState) → lambda: a quote a part of code holds, closed
// at the call [D4], run against each input its verb hands it in the
// environment the quote carries, or that of the call for a quote held as
// data [D43]. The lambda keeps the tree it runs, so `reduce` finds the
// name its quote holds [D56].
export function codeOf(code, callState) {
  return makeLambda(astOfQuote(code), withEnv(callState, envToRun(code, callState.env)));
}

// resolveBinaryReducer(reducerLambda) → (acc, item) → value, or null: the
// verb a reducer's quote names by one word, called as the pipe calls it,
// `acc | add item`, the verb residing on the accumulator among them [D72];
// null for code of any other shape, which `reduce` refuses.
export function resolveBinaryReducer(reducerLambda) {
  const callerState = reducerLambda.capturedState;
  const astNode = reducerLambda.astNode;
  if (astNode.type !== 'OperandCall' || astNode.args.length !== 0) return null;
  const lookupName = astNode.name;
  const reach = bareNameReach(callerState.env, lookupName);
  const namesAWord = reach === null ? residencesOf(callerState.env, lookupName).length > 0 : reach.underKind;
  if (!namesAWord) return null;
  return async (acc, item) =>
    (await callByName(lookupName, [async () => item], withPipeValue(callerState, acc))).pipeValue;
}


// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
