// The evaluator: the state pair of value and environment threaded through
// the steps, each node a function `(node, state) → state`.

import { parse, ParseError } from './parse.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, envSet, envGet, envHas
} from './state.mjs';
import { fork, forkEach } from './fork.mjs';
import { applyRule10 } from './rule10.mjs';
import {
  QlangError,
  QlangInvariantError,
  UnresolvedIdentifierError,
  UnresolvedAddressError,
  EffectLaunderingAtCallError,
  EffectLaunderingAtBindStepParseError,
  BindNameDeclaredTwiceError,
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { nearestNames } from './nearest-names.mjs';
import { classifyEffect } from './effect.mjs';
import { declareSubjectError } from './operand-errors.mjs';
import {
  isVec, isQMap, isKeyword, isFunctionValue, isErrorValue,
  typeKeyword, keyword, NULL, makeErrorValue, makeQuote,
  makeDoc, makeSet, isQuote,
  makeBinding, bindingValueOf, makeTaggedInstance, makeTagKeyword, isTagKeyword,
  isTaggedInstance, isValueClass, isVerb, verbEnvRef, quoteInEnv, quoteEnvRef, envToRun,
  BIND_TAG, ERROR_TAG, BUILTIN_TAG, SPEC_TAG, TAG_HEADER_SYMBOL, stampTagHeader
} from './types.mjs';
import { resolveBuiltinImpl } from './descriptor-ops.mjs';
import { tagBindingKey, canonicalTagName } from './env-keys.mjs';
import { declaredNameOf, moduleUriOf, repeatsDeclarationInScope } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, docOfNode, slotDocsOf, astOfQuote, stepOfNode, eachStepOf, tagCallStepOf } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  addressedVerb, addressesOf, isNounMember, isProviderBinding, residenceOnSubject, residencesOf
} from './runtime/nouns.mjs';
import {
  applyVerb, applyVerbOn, effectfulNameOfVerb, isContract, takesFullApplication
} from './runtime/verb.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import {
  answerOfStep, answerOfWord, skipping, raisedBy, isRaisedBy, resumingItsTrail, resumesItsTrail
} from './eval-trail.mjs';

// A node or a combinator the tables below do not name is a defect of the
// evaluator, raised past the fail track.
const UnknownAstNodeTypeError = declareInvariantError(
  'UnknownAstNodeTypeError',
  ({ nodeType }) => `unknown AST node type: ${nodeType}`,
  { operand: '::qlang' }
);

const UnknownCombinatorKindError = declareInvariantError(
  'UnknownCombinatorKindError',
  ({ kind }) => `unknown combinator: ${kind}`,
  { operand: '::qlang' }
);

const ProjectionSubjectNotProjectableError = declareShapeError('ProjectionSubjectNotProjectableError',
  ({ key, actualType }) => `/${key} requires Map, Vec, or Set subject, got ${actualType.name}`,
  { operand: '::proj' });
const ProjectionKeyNotInMapError = declareShapeError('ProjectionKeyNotInMapError',
  ({ key }) => `/${key} — key not present in Map subject`,
  { operand: '::proj' });
const ProjectionIndexOutOfBoundsError = declareShapeError('ProjectionIndexOutOfBoundsError',
  ({ key, length }) => `/${key} — index out of bounds for sequence of length ${length}`,
  { operand: '::proj' });
const ProjectionSequenceKeyNotIntegerError = declareShapeError('ProjectionSequenceKeyNotIntegerError',
  ({ key }) => `/${key} — non-integer segment cannot index a Vec or Set subject`,
  { operand: '::proj' });
const ProjectionFieldNotOnValueClassError = declareShapeError('ProjectionFieldNotOnValueClassError',
  ({ key, valueClass, availableFields }) =>
    `/${key} — not a projectable field on ${valueClass}; available: ${availableFields.join(', ')}`,
  { operand: '::proj' });
const TaggedLitNotTagBindingError = declareShapeError('TaggedLitNotTagBindingError',
  ({ tag, actualType }) => `::${tag} — tag binding is ${actualType.name}, expected a Map descriptor`,
  { operand: '::tagged', expectedType: 'map' }
);
// A tag binding whose `:impl` is neither a primitive's handle nor a quote
// constructs nothing.
const TagBindingHasNoConstructorError = declareShapeError('TagBindingHasNoConstructorError',
  ({ tag, payloadType }) =>
    `::${tag} has no registered constructor — tag-binding's :impl is missing or wrong-shaped (cannot evaluate ::${tag}<${payloadType.name}> payload)`,
  { operand: '::tagged' });
// The combinator names its qlang kind, `distribute`, so the message
// and the catalog tag-binding's `:operand` read alike.
const DistributeSubjectNotSequenceError = declareSubjectError('DistributeSubjectNotSequenceError', 'distribute', ['vec', 'set', 'map']);
const ApplyToNonFunctionError      = declareShapeError('ApplyToNonFunctionError',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType.name}`,
  { operand: '::call', expectedType: 'function' }
);
// evalQuery(source, env?, callerState?) → the value a query answers from
// null, in the runtime's environment unless `env` is given, one frame
// below `callerState` when a running query evaluates it, `runExamples`
// among them, so the depth budget counts it.
export async function evalQuery(source, env, callerState = null) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
  const initialState = callerState === null
    ? rootState(null, initialEnv)
    : nestState(callerState, null, initialEnv);
  const finalState = await evalBody(ast, initialState);
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
  if (!evaluator) throw new UnknownAstNodeTypeError({ nodeType: node.type });

  try {
    return await evaluator(node, state);
  } catch (caughtError) {
    if (caughtError instanceof QlangError && !caughtError.location && node.location)
      caughtError.location = node.location;
    if (caughtError instanceof QlangInvariantError) throw caughtError;
    // The error the node raised, a `::ParseError` among them when a
    // step reads text as code mid-evaluation; the step that ran the node
    // writes its stop [D85].
    const raised = caughtError instanceof ParseError ? errorFromParse(caughtError)
      : caughtError instanceof QlangError ? errorFromQlang(caughtError, state.pipeValue)
      : errorFromForeign(caughtError, node);
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
    throw new UnknownCombinatorKindError({ kind });
  }
  return await evaluator(state, stepNode);
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
    const distributeErr = new DistributeSubjectNotSequenceError(state.pipeValue);
    distributeErr.location = bodyNode.location;
    const refused = errorFromQlang(distributeErr, state.pipeValue);
    return withPipeValue(state, answerOfStep(refused, () => makeQuote([eachStepOf(bodyNode)]), state.pipeValue));
  }
  // The parentheses after `*` delimit its body, whose head takes the
  // track, so `[e 1] * (!| 0)` recovers an error element; the first error
  // the body answers answers the distribute, the elements after it left
  // unrun [D103]. A map's elements are its values.
  const bodyPipeline = bodyNode.type === 'ParenGroup' ? bodyNode.pipeline : bodyNode;
  if (isQMap(subjectSeq)) {
    const mapEntries = [...subjectSeq];
    const entryAnswers = await forkEach(state, mapEntries.map(([, entryValue]) => entryValue), inner => evalBody(bodyPipeline, inner));
    if (isErrorValue(entryAnswers)) return withPipeValue(state, failedInside(entryAnswers, bodyNode, state.pipeValue));
    return withPipeValue(state, new Map(mapEntries.map(([entryKey], index) => [entryKey, entryAnswers[index]])));
  }
  const distributeResults = await forkEach(state, subjectSeq, inner => evalBody(bodyPipeline, inner));
  if (isErrorValue(distributeResults)) return withPipeValue(state, failedInside(distributeResults, bodyNode, state.pipeValue));
  // A set distributes into the vector of its images, one per element in
  // the one order [D116].
  return withPipeValue(state, distributeResults);
}

// The error an element of a distribute answered, which answers the
// distribute with a stop of its own after the stops inside [D85].
function failedInside(elementError, bodyNode, subject) {
  return answerOfStep(elementError, () => makeQuote([eachStepOf(bodyNode)]), subject);
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
  return withPipeValue(answered, answerOfStep(answered.pipeValue, () => quoteOfBody(stepNode), opened));
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
// `::Foo!{…}`, which the literal declares as a tagged literal does [D86],
// else a tag name under `:kind`, else the kind of errors [D64]; a `:kind`
// of another value stays a field.
async function evalErrorLit(node, state) {
  const declaredState = node.tag === null ? state : ensureTagBinding(state, canonicalTagName(node.tag));
  const errorDescriptor = new Map();
  let tag = ERROR_TAG;
  for (const entry of node.entries) {
    const entryValue = await wordAnswer(entry.value, declaredState);
    if (entry.key.name === 'kind' && isTagKeyword(entryValue)) {
      tag = entryValue;
      continue;
    }
    errorDescriptor.set(entry.key.name, entryValue);
  }
  if (node.tag !== null) tag = makeTagKeyword(node.tag);
  // A literal that writes its `:trail` resumes that path [D85].
  const minted = makeErrorValue(tag, errorDescriptor, { location: node.location });
  return withPipeValue(declaredState, errorDescriptor.has('trail') ? resumingItsTrail(minted) : minted);
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
// through the constructor its binding names: a primitive, a quote whose
// answer takes the tag unless it carries it, or none, which lays the tag
// on. A value a verb returns under its subject's tag is minted here
// again [D41]; no constructor meets an error [D86].
export async function mintTaggedInstance(tagName, payload, state) {
  const typeKey = tagBindingKey(tagName);
  const typeBinding = bindingValueOf(envGet(state.env, typeKey));
  if (!isQMap(typeBinding)) {
    throw new TaggedLitNotTagBindingError({ tag: tagName, actualType: typeKeyword(typeBinding), actualValue: typeBinding });
  }
  const implKey = typeBinding.get('impl');
  if (isKeyword(implKey)) {
    const constructor = PRIMITIVE_REGISTRY.resolve(implKey.name);
    return await constructor(payload, state);
  }
  if (isQuote(implKey)) {
    const bodyAst = astOfQuote(implKey);
    const bodyState = nestState(state, payload, state.env);
    const resultState = await evalBody(bodyAst, bodyState);
    const constructorResult = resultState.pipeValue;
    if (isErrorValue(constructorResult)) return constructorResult;
    const tagKw = makeTagKeyword(tagName);
    if (isTaggedInstance(constructorResult)
        && constructorResult[TAG_HEADER_SYMBOL]?.name === tagName) {
      return constructorResult;
    }
    return makeTaggedInstance(tagKw, constructorResult);
  }
  if (implKey === undefined) return makeTaggedInstance(makeTagKeyword(tagName), payload);
  throw new TagBindingHasNoConstructorError({
    tag: tagName,
    payloadValue: payload,
    payloadType: typeKeyword(payload),
    expectedType: Object.freeze([keyword('keyword'), keyword('quote')]),
  });
}

// The first literal of a tag the scope does not know declares it without
// a constructor, in the scope of its step.
function ensureTagBinding(state, tagName) {
  const typeKey = tagBindingKey(tagName);
  if (envHas(state.env, typeKey)) return state;
  const implicitBinding = new Map([['declarationOrigin', keyword('implicit')]]);
  const implicitRecord = makeBinding({ name: makeTagKeyword(tagName), value: implicitBinding });
  return withEnv(state, envSet(state.env, typeKey, implicitRecord));
}

// The tag is declared before its payload runs, so the payload sees it,
// and a kind of the core written long, `::qlang/vec[1 2]`, is the kind
// written short [D32].
async function evalTaggedLit(node, state) {
  const tagName = canonicalTagName(node.tag);
  const declaredState = ensureTagBinding(state, tagName);
  const payload = (await fork(declaredState, inner => evalNode(node.payload, inner))).pipeValue;
  if (isErrorValue(payload)) return withPipeValue(declaredState, passedUntagged(payload, node, tagName));
  return withPipeValue(declaredState, await mintTaggedInstance(tagName, payload, declaredState));
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
// answers 42. A doc alone binds a doc, and under a tag name the empty
// descriptor `::builtin{}`. A verb or a quote written as the body resolves
// in the scope the declaration writes, so it sees its own name [D44],
// [D67].
async function evalBindStep(node, state) {
  const name = declaredNameOf(node);
  if (repeatsDeclarationInScope(node)) throw new BindNameDeclaredTwiceError({ name });

  if (node.body === null) {
    if (node.key.type === 'BareTypeKeyword') {
      const tagBinding = new Map();
      stampTagHeader(tagBinding, BUILTIN_TAG);
      return withEnv(state, envSet(state.env, name, declarationRecord(node, tagBinding)));
    }
    return withEnv(state, envSet(state.env, name, declarationRecord(node, makeDoc(slotDocsOf(node).flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc])))));
  }

  const answered = (await evalNode(node.body, state)).pipeValue;
  if (isVerb(answered)) refuseVerbLaunderedByName(name, answered, node);
  const writtenQuote = node.body.type === 'QuoteLit';
  const value = writtenQuote ? quoteInEnv(answered, null) : answered;
  const nextEnv = envSet(state.env, name, declarationRecord(node, value));
  if (isVerb(value) && node.body.type === 'TaggedLit') verbEnvRef(value).env = nextEnv;
  if (writtenQuote) quoteEnvRef(value).env = nextEnv;
  return withEnv(state, nextEnv);
}

// A name without the effect marker refuses a verb whose body calls one,
// as it refuses such a body of its own.
function refuseVerbLaunderedByName(name, verb, node) {
  const effectfulName = effectfulNameOfVerb(verb);
  if (effectfulName === null || classifyEffect(name)) return;
  const laundering = new EffectLaunderingAtBindStepParseError({ bindingName: name, effectfulName });
  laundering.location = node.body.location;
  throw laundering;
}

// The keyword or the tag a declaration names.
function declaredKeywordOf(node) {
  return node.key.type === 'BareTypeKeyword' ? makeTagKeyword(node.key.tag) : keyword(node.key.name);
}

// The record a declaration writes: its name, a keyword or a tag, the
// docs of its slot, the value, the quote of its step and the module its
// source came from [D63].
function declarationRecord(node, value) {
  return makeBinding({
    name: declaredKeywordOf(node),
    docs: slotDocsOf(node),
    value,
    source: quoteOfBody(node),
    module: keyword(moduleUriOf(node))
  });
}

// ─── Projection ─────────────────────────────────────────────────

// A projection walks its path segment by segment: a map by key, a vector,
// a quote and a doc among them, by an index counted from the end when
// negative, and a signature by the names it declares; a miss is a refusal
// that names its `:key`, where `at` answers null.
const INTEGER_SEGMENT_RE = /^-?\d+$/;

function evalProjection(node, state) {
  let projectionCurrent = state.pipeValue;
  for (const projKey of node.keys) projectionCurrent = projectSegment(projectionCurrent, projKey);
  return withPipeValue(state, projectionCurrent);
}

// A signature is read by the names it declares: `/throws` of a
// built-in's, `/subject`, or a slot's kind [D72].
function projectSignature(signatureSpec, projKey) {
  const declarations = signatureSpec.payload.filter(step => typeKeyword(step).name === BIND_TAG.name);
  const declared = declarations.find(step => step.get('name').name === projKey);
  if (declared === undefined) {
    throw new ProjectionFieldNotOnValueClassError({
      key: projKey,
      valueClass: SPEC_TAG.name,
      availableFields: declarations.map(step => step.get('name').name)
    });
  }
  return declared.get('body');
}

// A projection reads the map or the vector beneath the tags stacked over
// its subject, so the facts of an opened error read by name [D97].
function projectSegment(subject, projKey) {
  if (isValueClass(subject, 'taggedInstance') && subject.tag.name === SPEC_TAG.name) {
    return projectSignature(subject, projKey);
  }
  const projected = containerBeneathTags(subject);
  if (isQMap(projected)) {
    if (!projected.has(projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, actualValue: subject });
    return projected.get(projKey);
  }
  if (isVec(projected)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) {
      throw new ProjectionSequenceKeyNotIntegerError({ key: projKey, actualValue: subject });
    }
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? projected.length + segmentIndex : segmentIndex;
    if (resolvedIndex < 0 || resolvedIndex >= projected.length) {
      throw new ProjectionIndexOutOfBoundsError({ key: projKey, index: segmentIndex, length: projected.length, actualValue: subject });
    }
    return projected[resolvedIndex];
  }
  throw new ProjectionSubjectNotProjectableError({
    key: projKey,
    actualType: typeKeyword(subject),
    actualValue: subject
  });
}

// ─── Identifier lookup ─────────────────────────────────────────

function isBuiltinDescriptor(descriptor) {
  return descriptor[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

async function evalOperandCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  return await callByName(node.name, node.args.map(argNode => makeLambda(argNode, state)), state);
}

// A bare name resolves nearest first [D62]: the declaration of the scope,
// then the verb that resides on the subject, found by the walk of its
// tags [D72], then the core's binding of the name; a member of a noun is
// read through its noun and is no name a query calls [D117].
async function callByName(lookupName, lambdas, state) {
  const lookupEnv = state.env;
  const entry = isNounMember(lookupEnv, lookupName) ? undefined : envGet(lookupEnv, lookupName);
  if (entry !== undefined && !isProviderBinding(lookupEnv, lookupName)) {
    return await applyBinding(entry, lookupName, lambdas, state);
  }
  const residence = residenceOnSubject(lookupEnv, lookupName, state.pipeValue);
  if (residence !== null) return await callResidence(bindingValueOf(residence), lookupName, lambdas, state);
  if (entry !== undefined) return await applyBinding(entry, lookupName, lambdas, state);
  throw new UnresolvedIdentifierError({ identifierName: lookupName, nearest: nearestNames(lookupEnv, lookupName) });
}

// A call with one modifier more than the slots of its verb reads the
// subject from its first modifier, and the verb of a name several kinds
// answer is found again from that subject [D72]; a call reaching a
// contract does so when a verb it answers for takes its modifiers so.
async function callResidence(verb, lookupName, lambdas, state) {
  const fullApplication = isContract(verb)
    ? residencesOf(state.env, lookupName).some(([, record]) => takesFullApplication(bindingValueOf(record), lambdas.length))
    : takesFullApplication(verb, lambdas.length);
  if (!fullApplication) return await applyVerb(verb, lambdas, state, lookupName);
  const subject = await lambdas[0](state.pipeValue);
  if (isErrorValue(subject)) return withPipeValue(state, subject);
  const residence = residenceOnSubject(state.env, lookupName, subject);
  const found = residence === null ? verb : bindingValueOf(residence);
  return await applyVerbOn(found, subject, lambdas.slice(1), state, lookupName);
}

// A name reads the value its record holds [D63], so `:x / | x` sees the
// raw data: a verb runs [D67], a `::builtin` descriptor, the loader's,
// applies its primitive, a function value, the seed of `use` among
// them, applies through Rule 10, and any other value is itself.
async function applyBinding(entry, lookupName, lambdas, state) {
  const resolved = bindingValueOf(entry);
  if (isVerb(resolved)) return await applyVerb(resolved, lambdas, state, lookupName);
  if (isQMap(resolved) && isBuiltinDescriptor(resolved)) return await applyBuiltinDescriptor(resolved, lambdas, state);

  if (isFunctionValue(resolved)) {
    // An effectful function value answers only under a name that carries
    // the effect marker [D69].
    if (resolved.effectful && !classifyEffect(lookupName)) {
      throw new EffectLaunderingAtCallError({
        bindingName: lookupName,
        effectfulName: resolved.name
      });
    }
    return await applyRule10(resolved, lambdas, state);
  }

  // A value takes no modifiers; its refusal names where a verb of the
  // name lives, one a declaration shadows among them [D62].
  if (lambdas.length > 0) {
    throw new ApplyToNonFunctionError({
      name: lookupName,
      actualType: typeKeyword(resolved),
      actualValue: resolved,
      addresses: addressesOf(state.env, lookupName)
    });
  }
  return withPipeValue(state, resolved);
}

// A name with a path calls the verb its address names, from the root
// and past every binding of the scope, so a verb a declaration shadows
// stays one address away [D62]: `[1 2 3] | vec/filter ~(gt 1)` calls
// the `filter` of vectors whatever the scope binds as `filter`.
async function callByAddress(node, state) {
  const addressName = canonicalTagName(node.name);
  const address = addressedVerb(state.env, addressName);
  if (address === null) throw new UnresolvedAddressError({ address: makeTagKeyword(addressName) });
  const lambdas = node.args.map(argNode => makeLambda(argNode, state));
  if (isVerb(address.descriptor)) return await applyVerb(address.descriptor, lambdas, state, address.verbName);
  return await applyBuiltinDescriptor(address.descriptor, lambdas, state);
}

// A descriptor, the loader's or one a query assembled, applies its
// primitive under Rule 10, which refuses more modifiers than it takes
// [D79].
async function applyBuiltinDescriptor(descriptor, builtinLambdas, state) {
  return await applyRule10(resolveBuiltinImpl(descriptor), builtinLambdas, state);
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

// codeOf(code, callState) → lambda: a quote a slot of code holds, closed
// at the call [D4], run against each input its operand hands it in the
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
  if (!envHas(callerState.env, lookupName)) return null;
  const resolved = bindingValueOf(envGet(callerState.env, lookupName));
  if (!isVerb(resolved)) return null;
  return async (acc, item) =>
    (await callByName(lookupName, [async () => item], withPipeValue(callerState, acc))).pipeValue;
}


// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
