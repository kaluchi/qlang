// The evaluator: the state pair of value and environment threaded through
// the steps, each node a function `(node, state) → state`.

import { parse } from './parse.mjs';
import { ROOT_KEY } from './env-keys.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, envSet, envHas, rootOf
} from './state.mjs';
import { fork, forkEach } from './fork.mjs';
import {
  QlangError,
  QlangInvariantError,
  CallUnknownNameError,
  CallUnknownAddressError,
  BindEffectMarkMissingError,
  BindNameDeclaredTwiceError,
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { nearestNames, nearestTagNames } from './nearest-names.mjs';
import { classifyEffect } from './effect.mjs';
import { findFirstEffectfulIdentifier } from './effect-check.mjs';
import { declareSubjectError } from './operand-errors.mjs';
import {
  isVec, isQMap, isErrorValue, isQuote, isDoc, isLabelValue, hostImplOf,
  typeKeyword, keyword, NULL, makeErrorValue, makeQuote,
  makeDoc, makeSet,
  makeBinding, bindingValueOf, makeTaggedInstance, makeTagKeyword, isTagKeyword,
  isTaggedInstance, isValueClass, isVerb, isSpec, verbEnvRef, quoteInEnv, quoteEnvRef, envToRun, addressOfVerb, declareVerbAt, makeVerb,
  BIND_TAG, ERROR_TAG, SPEC_TAG, TAG_HEADER_SYMBOL
} from './types.mjs';
import { declaredNameOf, originOf, repeatsDeclarationInScope } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, quoteOfSource, docOfNode, slotDocsOf, astOfQuote, stepOfNode, eachStepOf, tagCallStepOf } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  addressesOf, bareNameReach, isMemberValue, namesUnderOf, nodeOf, residencesOf, splitAddress, vocabularyWords
} from './runtime/nouns.mjs';
import {
  applyVerb, constructorOfSpec, effectfulNameOfVerb, namesItsSubject,
  runPrimitive, keptAsSubject, walkToKinds
} from './runtime/verb.mjs';
import {
  answerOfStep, answerOfWord, skipping, raisedBy, isRaisedBy, resumingItsTrail, resumesItsTrail
} from './eval-trail.mjs';

// A node or a combinator the tables below do not name is a defect of the
// evaluator, raised past the fail track.
const BuiltinUnknownAstNodeTypeError = declareInvariantError(
  'builtin/UnknownAstNodeTypeError',
  ({ nodeType }) => `unknown AST node type: ${nodeType}`,
  { operand: '::builtin' }
);

const BuiltinUnknownCombinatorKindError = declareInvariantError(
  'builtin/UnknownCombinatorKindError',
  ({ kind }) => `unknown combinator: ${kind}`,
  { operand: '::builtin' }
);

const ProjSubjectNotProjectableError = declareShapeError('proj/SubjectNotProjectableError',
  ({ key, actualType }) => `/${key} requires Map, Vec, or Set subject, got ${actualType.name}`,
  { operand: '::proj' });
const ProjKeyNotInMapError = declareShapeError('proj/KeyNotInMapError',
  ({ key }) => `/${key} — key not present in Map subject`,
  { operand: '::proj' });
const ProjIndexOutOfBoundsError = declareShapeError('proj/IndexOutOfBoundsError',
  ({ key, length }) => `/${key} — index out of bounds for sequence of length ${length}`,
  { operand: '::proj' });
const ProjIndexNotIntegerError = declareShapeError('proj/IndexNotIntegerError',
  ({ key }) => `/${key} — non-integer segment cannot index a Vec or Set subject`,
  { operand: '::proj' });
const ProjFieldNotInSignatureError = declareShapeError('proj/FieldNotInSignatureError',
  ({ key, valueClass, availableFields }) =>
    `/${key} — not a projectable field on ${valueClass}; available: ${availableFields.join(', ')}`,
  { operand: '::proj' });
// A tag whose node is no kind, a verb or a page, builds no value [D152].
const ConstructTagNotKindError = declareShapeError('construct/TagNotKindError',
  ({ tag, actualType }) => `::${tag} — its node holds ${actualType.name}, and only a kind, a ::spec, builds a value`,
  { operand: '::construct', expectedType: 'spec' }
);
// The combinator names its qlang kind, `distribute`, in the message
// and in the `:operand` its site records.
const EachSubjectNotContainerError = declareSubjectError('each/SubjectNotContainerError', 'distribute', ['vec', 'set', 'map']);
// A verb declared under a kind serves that kind, so its head names no
// subject of its own [D153].
const BindVerbSubjectUnderKindError = declareShapeError('bind/VerbSubjectUnderKindError',
  ({ name }) => `${name} is declared under a kind, its subject, and its head names a subject of its own`,
  { operand: '::bind' }
);
// A bare name the reader declares for a value takes no word of the
// vocabulary, the name of a verb or of a name under a label, so no step
// meets the reader's value where the subject's word was meant [D166].
const BindNameTakenByVocabularyError = declareShapeError('bind/NameTakenByVocabularyError',
  ({ name }) => `${name} is a word of the vocabulary, a verb or a name under a label; a value of the reader takes another name`,
  { operand: '::bind' }
);
const BindNounNotDeclaredError = declareShapeError('bind/NounNotDeclaredError',
  ({ name, noun }) => `${name} is declared under ${noun.literal}, which no declaration names`,
  { operand: '::bind' }
);
const CallValueTakesNoModifiersError      = declareShapeError('call/ValueTakesNoModifiersError',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType.name}`,
  { operand: '::call', expectedType: 'function' }
);
// evalQuery(source, env?, callerState?) → the value a query answers from
// null, in the runtime's environment unless `env` is given, one frame
// below `callerState` when a running query evaluates it, `runLaws`
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
  if (!evaluator) throw new BuiltinUnknownAstNodeTypeError({ nodeType: node.type });

  try {
    return await evaluator(node, state);
  } catch (caughtError) {
    if (caughtError instanceof QlangError && !caughtError.location && node.location)
      caughtError.location = node.location;
    if (caughtError instanceof QlangInvariantError) throw caughtError;
    // The error the node raised; the step that ran the node writes its
    // stop [D85].
    const raised = caughtError instanceof QlangError ? errorFromQlang(caughtError, state.pipeValue)
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
    throw new BuiltinUnknownCombinatorKindError({ kind });
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
    const distributeErr = new EachSubjectNotContainerError(state.pipeValue);
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
// through the constructor its kind declares [D152]: a primitive, a body of
// steps whose answer takes the tag unless it carries it, or none, which
// lays the tag on; a tag no node answers is a kind of the scope's own,
// identity. A value a verb returns under its subject's tag is minted here
// again [D41]; no constructor meets an error [D86].
export async function mintTaggedInstance(tagName, payload, state) {
  const declared = bindingValueOf(nodeOf(state.env, tagName));
  if (declared === null || declared === undefined) return makeTaggedInstance(makeTagKeyword(tagName), payload);
  if (isDoc(declared)) return await underPage(tagName, payload, state);
  if (!isSpec(declared)) {
    throw new ConstructTagNotKindError({ tag: tagName, actualType: typeKeyword(declared), actualValue: declared });
  }
  const { primitive, body } = constructorOfSpec(declared);
  if (primitive !== undefined) return await primitive(payload, state);
  if (body === undefined) return makeTaggedInstance(makeTagKeyword(tagName), payload);
  const constructorResult = (await evalBody(body, nestState(state, payload, state.env))).pipeValue;
  if (isErrorValue(constructorResult)) return constructorResult;
  if (isTaggedInstance(constructorResult) && constructorResult[TAG_HEADER_SYMBOL]?.name === tagName) return constructorResult;
  return makeTaggedInstance(makeTagKeyword(tagName), constructorResult);
}

// A label declared by its page lays its tag over a payload [D166]: the
// `construct` declared under it builds the payload first when there is
// one, and every law the page holds under `::holds` runs on the value
// under the label, a broken one refusing it under the label's address.
async function underPage(tagName, payload, state) {
  const constructRecord = nodeOf(state.env, `${tagName}/construct`);
  let built = payload;
  if (constructRecord !== null && isMemberValue(bindingValueOf(constructRecord))) {
    built = await constructedBy(bindingValueOf(constructRecord), payload, state);
    if (isErrorValue(built)) return built;
  }
  const labelled = built?.[TAG_HEADER_SYMBOL]?.name === tagName ? built : makeTaggedInstance(makeTagKeyword(tagName), built);
  return await refusalOfLaws(nodeOf(state.env, tagName), labelled, state, state.env, `${tagName}/HoldsNotMetError`) ?? labelled;
}

// The payload a label's `construct` builds: a quote run on the payload,
// or the primitive a host handed run over it and the state, as a kind's
// primitive constructor runs.
async function constructedBy(construct, payload, state) {
  if (isQuote(construct)) return (await evalBody(astOfQuote(construct), nestState(state, payload, scopeOfMember(construct, state)))).pipeValue;
  return await hostImplOf(construct)(payload, state);
}

// The refusal of the first law under `::holds` of a record's page the
// value does not answer true to, named under the address, or the error a
// law answered, handed on as it is; null when every law holds.
async function refusalOfLaws(record, value, state, scope, tagName) {
  for (const doc of record.get('docs')) {
    for (const segment of doc) {
      if (!isValueClass(segment, 'taggedInstance') || segment.tag.name !== 'holds') continue;
      const kinds = kindsAskedBy(astOfQuote(segment.payload));
      const answer = kinds !== null
        ? walkToKinds(value, kinds) !== null
        : (await evalBody(astOfQuote(segment.payload), nestState(state, value, scope))).pipeValue;
      if (isErrorValue(answer)) return answer;
      if (answer !== true) return refusalUnder(tagName, { holds: segment.payload, actualValue: value });
    }
  }
  return null;
}

// A refusal named by the address of what refused [D166], its facts and
// the kind of the value refused; the value itself rides the facts where
// the trail does not hold it, a part or an object, and leaves them for
// the subject, which the trail's first stop holds [D85].
function refusalUnder(tagName, facts, refused = facts.actualValue) {
  const descriptor = new Map(Object.entries(facts)).set('actualType', typeKeyword(refused));
  return makeErrorValue(makeTagKeyword(tagName), descriptor);
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
// answers 42; a doc alone binds a doc, a page. A verb or a quote written
// as the body resolves in the scope the declaration writes, so it sees
// its own name [D44], [D67]. A name is declared once in its scope [D71],
// and a node the root holds once at all, so a reader extends a noun of the
// root and replaces none of its nodes [D153]; a name with a path is
// declared under a noun declared before it.
async function evalBindStep(node, state) {
  const name = declaredNameOf(node);
  const [nounName] = splitAddress(name);
  if (repeatsDeclarationInScope(node) || (nounName !== null && rootOf(state.env).has(name))) {
    throw new BindNameDeclaredTwiceError({ name });
  }
  if (nounName !== null && !envHas(state.env, nounName)) {
    throw new BindNounNotDeclaredError({ name, noun: makeTagKeyword(nounName) });
  }

  if (node.body === null) {
    return withEnv(state, envSet(state.env, name, declarationRecord(node, makeDoc(slotDocsOf(node).flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc])))));
  }

  const answered = (await evalNode(node.body, state)).pipeValue;
  if (nounName === null && !isLabelValue(answered) && vocabularyWords(state.env).has(name)) {
    throw new BindNameTakenByVocabularyError({ name, addresses: addressesOf(state.env, name) });
  }
  if (isVerb(answered)) refuseLaunderedByName(name, effectfulNameOfVerb(answered), node);
  else if (nounName !== null && isQuote(answered)) refuseLaunderedByName(name, findFirstEffectfulIdentifier(astOfQuote(answered)), node);
  const writtenQuote = node.body.type === 'QuoteLit';
  const writtenVerb = isVerb(answered) && node.body.type === 'TaggedLit';
  // A declaration writes into no verb it was handed: one no declaration
  // named yet is succeeded by a verb of its own over the same code and
  // scope, and one declared before keeps its address.
  const value = writtenQuote ? quoteInEnv(answered, null)
    : isVerb(answered) && !writtenVerb && addressOfVerb(answered) === null ? makeVerb(answered.payload, { env: verbEnvRef(answered).env })
    : answered;
  if (isVerb(value) && addressOfVerb(value) === null) declareVerbFirst(value, name, nounName, state.env);
  const nextEnv = envSet(state.env, name, declarationRecord(node, value));
  if (writtenVerb) verbEnvRef(value).env = nextEnv;
  if (writtenQuote) quoteEnvRef(value).env = nextEnv;
  return withEnv(state, nextEnv);
}

// A verb takes the address of its first declaration and resides on the
// noun of that address when the noun is a kind, its head then naming no
// subject of its own [D72], [D153]; one under a noun that is no kind
// serves any value.
function declareVerbFirst(verb, name, nounName, env) {
  const underKind = nounName !== null && isLabelValue(bindingValueOf(nodeOf(env, nounName)));
  if (underKind && namesItsSubject(verb)) throw new BindVerbSubjectUnderKindError({ name });
  declareVerbAt(verb, name, underKind ? nounName : null);
}

// A name without the effect marker refuses a verb, or a quote under a
// label, whose body calls one, as it refuses such a body of its own.
function refuseLaunderedByName(name, effectfulName, node) {
  if (effectfulName === null || classifyEffect(name)) return;
  const laundering = new BindEffectMarkMissingError({ bindingName: name, effectfulName });
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
    throw new ProjFieldNotInSignatureError({
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
    if (!projected.has(projKey)) throw new ProjKeyNotInMapError({ key: projKey, actualValue: subject });
    return projected.get(projKey);
  }
  if (isVec(projected)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) {
      throw new ProjIndexNotIntegerError({ key: projKey, actualValue: subject });
    }
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? projected.length + segmentIndex : segmentIndex;
    if (resolvedIndex < 0 || resolvedIndex >= projected.length) {
      throw new ProjIndexOutOfBoundsError({ key: projKey, index: segmentIndex, length: projected.length, actualValue: subject });
    }
    return projected[resolvedIndex];
  }
  throw new ProjSubjectNotProjectableError({
    key: projKey,
    actualType: typeKeyword(subject),
    actualValue: subject
  });
}

// ─── Identifier lookup ─────────────────────────────────────────

async function evalOperandCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  return await callByName(node.name, node.args.map(argNode => makeLambda(argNode, state)), state);
}

// A bare name calls what it reaches for the subject [D62], [D153]; a
// name that reaches nothing is refused with the names near it and the
// addresses where verbs of it live.
async function callByName(lookupName, lambdas, state) {
  const reach = bareNameReach(state.env, lookupName, state.pipeValue);
  if (reach === null) {
    throw new CallUnknownNameError({
      identifierName: lookupName, nearest: nearestNames(state.env, lookupName), addresses: addressesOf(state.env, lookupName)
    });
  }
  if (reach.underKind && isMemberValue(bindingValueOf(reach.record))) return await applyMember(reach.record, lambdas, state);
  return reach.underKind
    ? await applyVerb(bindingValueOf(reach.record), lambdas, state, lookupName)
    : await applyBinding(reach.record, lookupName, lambdas, state);
}

// A name reads the value its record holds [D63], so `:x / | x` sees the
// raw data: a verb runs [D67], and any other value is itself.
async function applyBinding(entry, lookupName, lambdas, state) {
  const resolved = bindingValueOf(entry);
  if (isVerb(resolved)) return await applyVerb(resolved, lambdas, state, lookupName);

  // A value takes no modifiers; its refusal names where a verb of the
  // name lives, one a declaration shadows among them [D62].
  if (lambdas.length > 0) {
    throw new CallValueTakesNoModifiersError({
      name: lookupName,
      actualType: typeKeyword(resolved),
      actualValue: resolved,
      addresses: addressesOf(state.env, lookupName)
    });
  }
  return withPipeValue(state, resolved);
}

// A name with a path reads what its address declared, past every bare
// name of the scope, a verb run and any other value itself, so a verb a
// declaration shadows stays one address away [D62], [D153]:
// `[1 2 3] | vec/filter ~(gt 1)` calls the `filter` of vectors whatever
// the scope binds as `filter`.
async function callByAddress(node, state) {
  const record = nodeOf(state.env, node.name);
  if (record === null) {
    throw new CallUnknownAddressError({ address: makeTagKeyword(node.name), nearest: nearestTagNames(state.env, node.name) });
  }
  const lambdas = node.args.map(argNode => makeLambda(argNode, state));
  if (isMemberValue(bindingValueOf(record)) && isLabelValue(bindingValueOf(nodeOf(state.env, splitAddress(node.name)[0])))) {
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
// address; an answer the name's page marks `::keeps~()` goes back under
// the tags the walk passed [D166].
async function applyMember(record, lambdas, state) {
  const address = record.get('name').name;
  const member = bindingValueOf(record);
  const [labelName] = splitAddress(address);
  const walked = walkToKinds(state.pipeValue, [labelName]);
  if (walked === null) {
    const labelWord = labelName.slice(labelName.lastIndexOf('/') + 1);
    return withPipeValue(state, refusalUnder(`${address}/SubjectNot${labelWord[0].toUpperCase()}${labelWord.slice(1)}Error`, {}, state.pipeValue));
  }
  const scope = scopeOfMember(member, state);
  const read = await objectOf(address, partsOf(scope, address), lambdas, state, scope);
  if (isErrorValue(read)) return withPipeValue(state, read);
  const answer = isQuote(member)
    ? (await evalBody(astOfQuote(member), nestState(state, state.pipeValue, read.bodyEnv))).pipeValue
    : await runHostMember(member, walked, read, state);
  if (isErrorValue(answer)) return withPipeValue(state, answer);
  const given = hasPageRole(record, 'keeps') ? await keptAsSubject(answer, walked.served, walked.passedTags, state) : answer;
  return withPipeValue(state, await refusalOfLaws(record, given, state, scope, `${address}/HoldsNotMetError`) ?? given);
}

// answerKindsOf(record, subjectKinds) → the kinds of the answer a name
// under a label gives, for a tool: the subject's own where its page keeps
// them, the kinds the first law `isA` of its page asks for, or null
// [D166].
export function answerKindsOf(record, subjectKinds) {
  return hasPageRole(record, 'keeps') ? subjectKinds : lawKindsOf(record);
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

// The parts of a call's object: the quotes declared under the name's
// address, in their order.
function partsOf(scope, address) {
  return [...namesUnderOf(scope, address)].filter(([, partRecord]) => isQuote(bindingValueOf(partRecord)));
}

// The places the parts read, one past the greatest index a part reads
// strictly or softly, or null when a part reads the object whole or its
// tail and so takes any number of values.
function placesReadBy(parts) {
  let places = 0;
  for (const [, partRecord] of parts) {
    const index = placeReadBy(astOfQuote(bindingValueOf(partRecord)));
    if (!Number.isInteger(index)) return null;
    places = Math.max(places, index + 1);
  }
  return places;
}

// The index a part's first step reads, by a projection or by `at`, or
// no integer for a part that reads the object whole or its tail.
function placeReadBy(ast) {
  const head = ast.type === 'Pipeline' ? ast.steps[0] : ast;
  if (head.type === 'Projection') return head.keys.length === 1 ? Number(head.keys[0]) : NaN;
  return head.type === 'OperandCall' && head.name === 'at' && head.args[0]?.type === 'NumberLit' ? head.args[0].value : NaN;
}

// The object of a call, the values of its modifiers each computed against
// the subject under the name's address, and its parts read from it: an
// object with more values than the parts have places is refused under
// the name, a part the object does not hold under the part, and a part
// that breaks a law of its page under the part. Answers the values of
// the parts in their order and the scope of the body, where each part is
// bound by its name and the object as `object`.
async function objectOf(address, parts, lambdas, state, scope) {
  if (lambdas.length === 0 && parts.length === 0) return { values: [], bodyEnv: scope };
  const values = [];
  for (const lambda of lambdas) values.push(await lambda(state.pipeValue));
  const failed = values.findIndex(isErrorValue);
  if (failed !== -1) return refusalOfComputedCode(address, parts, failed, values[failed]);
  const object = makeTaggedInstance(makeTagKeyword(address), values);
  const places = placesReadBy(parts);
  if (places !== null && values.length > places) return refusalUnder(`${address}/ObjectBeyondPartsError`, { places, actualValue: object });
  let bodyEnv = envSet(scope, 'object', makeBinding({ name: keyword('object'), value: object }));
  const partValues = [];
  const taken = [];
  for (const [partName, partRecord] of parts) {
    const partAddress = `${address}/${partName}`;
    const part = await partOf(astOfQuote(bindingValueOf(partRecord)), values, nestState(state, object, scope));
    if (part === MISSED_PLACE || (isErrorValue(part) && isMissedPlace(part))) return refusalUnder(`${partAddress}/NotGivenError`, { actualValue: object });
    if (isErrorValue(part)) return part;
    const refused = await refusalOfLaws(partRecord, part, state, scope, `${partAddress}/HoldsNotMetError`);
    if (refused !== null) return refused;
    const kinds = lawKindsOf(partRecord);
    const handed = kinds === null ? part : walkToKinds(part, kinds).served;
    const rest = !Number.isInteger(placeReadBy(astOfQuote(bindingValueOf(partRecord))));
    partValues.push(handed);
    taken.push({ name: partName, rest, code: rest || (kinds?.includes('quote') ?? false) });
    bodyEnv = envSet(bodyEnv, partName, makeBinding({ name: keyword(partName), value: handed }));
  }
  return { values: partValues, taken, bodyEnv };
}

// A value the call computed that answered an error: where a part that
// takes code reads its place, the step ran on the subject by mistake,
// `filter /active` for `filter ~(/active)`, and the part refuses it with
// the error as its value; elsewhere the error is the answer [D67].
function refusalOfComputedCode(address, parts, place, error) {
  for (const [partName, partRecord] of parts) {
    if (placeReadBy(astOfQuote(bindingValueOf(partRecord))) !== place || !lawKindsOf(partRecord)?.includes('quote')) continue;
    return refusalUnder(`${address}/${partName}/HoldsNotMetError`, { holds: lawOf(partRecord), actualValue: error });
  }
  return error;
}

// The value a part's selector reads from the object: a place read `/n`
// or `at n default` is the value at the place, read here as `at` reads
// it, so the selectors of `at` itself read without calling it; any
// other selector runs as code over the object.
async function partOf(ast, values, state) {
  if (!readsOnePlace(ast)) return (await evalBody(ast, state)).pipeValue;
  const index = placeReadBy(ast);
  if (index < values.length) return values[index];
  if (ast.type === 'Projection') return MISSED_PLACE;
  return ast.args.length === 1 ? null : (await evalBody(ast.args[1], state)).pipeValue;
}

// A strict read of a place past the values of the object.
const MISSED_PLACE = Symbol('missedPlace');

// Whether a selector is one step that reads one place, `/n` or `at n`
// with a default or none.
function readsOnePlace(ast) {
  return ast.type !== 'Pipeline' && Number.isInteger(placeReadBy(ast)) && (ast.type === 'Projection' || ast.args.length <= 2);
}

// The kinds the first law `isA` of a part's page asks for, or null: the
// part is handed as the value of the kind the walk of its tags reaches,
// the tags it passed left behind, as a subject is served, and a part
// that asks for a quote takes code [D166].
function lawKindsOf(partRecord) {
  const law = lawOf(partRecord);
  return law === undefined ? null : kindsAskedBy(astOfQuote(law));
}

// The first law of a page, the quote of its first `::holds`.
function lawOf(record) {
  for (const doc of record.get('docs')) {
    for (const segment of doc) {
      if (isValueClass(segment, 'taggedInstance') && segment.tag.name === 'holds') return segment.payload;
    }
  }
  return undefined;
}

// The kinds a law of one step `isA ::k …` asks for, or null.
function kindsAskedBy(ast) {
  if (ast.type !== 'OperandCall' || ast.name !== 'isA') return null;
  return ast.args.every(arg => arg.type === 'BareTypeKeyword') ? ast.args.map(arg => arg.tag) : null;
}

// A strict read of a place the object does not hold.
function isMissedPlace(error) {
  return error.tag.name === 'proj/IndexOutOfBoundsError' || error.tag.name === 'proj/KeyNotInMapError';
}

// A primitive runs over the value the walk served and the values of the
// parts, a quote closed at the call [D4], as a verb's primitive runs.
async function runHostMember(member, walked, read, state) {
  const handed = read.values.map((value, index) => {
    const { name, rest, code } = read.taken[index];
    const takenBy = element => (!code ? element
      : isQuote(element) ? codeOf(element, state)
      : isVerb(element) ? codeOf(quoteOfVerb(element, name, state), state)
      : element);
    const served = rest ? walkToKinds(value, ['vec'])?.served : undefined;
    return isVec(served) ? served.map(takenBy) : takenBy(value);
  });
  return await runPrimitive(hostImplOf(member), walked.served, walked.passedTags, handed, state);
}

// A verb handed where code is taken is the quote that runs it, as a slot
// of code took it [D67].
function quoteOfVerb(verb, name, state) {
  const scope = envSet(state.env, name, makeBinding({ name: keyword(name), value: verb }));
  return quoteInEnv(quoteOfSource(name), scope);
}

// Whether a record's page holds a quote under the tag of a role.
function hasPageRole(record, role) {
  return record.get('docs').some(doc => doc.some(segment => isValueClass(segment, 'taggedInstance') && segment.tag.name === role));
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
  const reached = reach === null ? null : bindingValueOf(reach.record);
  const namesAVerb = reach === null ? residencesOf(callerState.env, lookupName).length > 0 : isVerb(reached) || (reach.underKind && isMemberValue(reached));
  if (!namesAVerb) return null;
  return async (acc, item) =>
    (await callByName(lookupName, [async () => item], withPipeValue(callerState, acc))).pipeValue;
}


// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
