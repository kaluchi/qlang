// The evaluator: the state pair of value and scope threaded through the
// steps, each node a function `(node, state) → state`.

import { parse } from './parse.mjs';
import { ROOT_KEY, QUERY_KEY, CALL_BINDS_KEY, WITHHELD_KEY } from './env-keys.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, frameBelow, envSet, envHas, rootOf, markRootWordScope, isRootWordScope, queryTreeOf,
  withCall, originIn, ownScopeOf
} from './state.mjs';
import { declareRefusal, QlangError, QlangInvariantError, CallUnknownNameError, CallUnknownAddressError, BindNameDeclaredTwiceError, declareInvariantError } from './errors.mjs';
import { nearestNames, nearestTagNames, nearestWords } from './nearest-names.mjs';
import { readPath, partsOfTemplate, PathIndexOutOfBoundsError, PathKeyNotInMapError } from './path-read.mjs';
import {
  isQSet, isErrorValue, isQuote, isDoc, hostImplOf,
  typeKeyword, keyword, NULL, makeErrorValue,
  makeDoc, makeSet, makeRegex, makePath, isPath,
  makeBinding, bindingValueOf, makeTaggedInstance, makeTag, errorAtRest,
  isFn, isKind, recipeOf, makeQuote, isQMap, stampTagHeader, TAG_HEADER_SYMBOL,
  ERROR_TAG, isValueClass, isTag, kindsExpected
} from './types.mjs';
import { declaredNameOf, originOf, repeatsDeclarationInScope } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, docOfNode, slotDocsOf, astOfQuote, stepOfNode, tagCallStepOf, commandStep, groupStep } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse, factsInOrder } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  ANY_KIND_NAME, INVARIANT_TAG, LAW_TAG, addressesOf, answerOf, argsBeyondInputsAddress, bareNameReach, subjectKindsRefusalAddress, CONSTRUCT_NAME, declaresALabel, elementsRefusalAddress, isInvariant, isLabel, isMemberValue, isRecipe, isUnderLabel, isWord, kindsRefusalAddress, nodeOf, notGivenAddress, payloadRefusalName, refuseWithheld, residenceOnSubject, subjectRefusalAddress, CallValueWithheldError, kindsOfWalk
} from './runtime/nouns.mjs';
import { ANSWER_NAME, PAYLOAD_NAME, SUBJECT_NAME, functionOfRecipe, invariantsOf, kindOf, pageOfConstructor, pageOfKindsRefusal, signatureOf } from './runtime/signature.mjs';
import { inputsRunBy, inputsRunWithin } from './primitives.mjs';
import { splitAddress } from './address.mjs';
import {
  runPrimitive, keptAsSubject, mintUnderTag, walkToKinds, CallKindAnswersNoVerbError
} from './runtime/verb.mjs';
import {
  answerOfStep, answerOfPart, skipping, raisedBy, isRaisedBy
} from './eval-trail.mjs';

// A node or a combinator the tables below do not name is a defect of the
// evaluator, raised past the fail track.
const BuiltinUnknownAstNodeTypeError = declareInvariantError(
  'builtin/UnknownAstNodeTypeError',
  ({ nodeType }) => `unknown AST node type: ${nodeType}`);

// The tag of a name that holds data puts no value under it: a value goes
// under a label, a word, an invariant or a tag no node answers [QSBLD#label].
const ConstructTagNotKindError = declareRefusal('construct/TagNotKindError');
const CallValueMeetsWordError = declareRefusal('call/ValueMeetsWordError');
const BindNounNotDeclaredError = declareRefusal('bind/NounNotDeclaredError');
const CallValueTakesNoModifiersError = declareRefusal('call/ValueTakesNoModifiersError');
const FnRecipeMissingError = declareRefusal('fn/RecipeMissingError');
const BindWrittenOutsideItsChainError = declareRefusal('bind/WrittenOutsideItsChainError');

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
  RegexLit:          evalRegexLit,
  Path:              evalPath,
  Call:              evalCall,
  BindStep:          evalBindStep,
  ParenGroup:        evalParenGroup,
  Blank:             evalBlank,
};

// A blank source, comments among it, answers the value it is handed
// [QSSYN#comment].
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
    // frame [QSERR#trail].
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

// The tracks live in the combinators alone: `|` steps around an error, the
// step joining the skipped steps of its last frame [QSERR#trail], and `!|` fires
// on an error alone [QSSYN#combinator]; the parser writes no other combinator.
async function applyCombinator(kind, state, stepNode) {
  return kind === '!|' ? await applyFailTrack(state, stepNode) : await applySuccessTrack(state, stepNode);
}

// The fork rule: a nested pipeline or a group starts from the outer
// state and hands back its value alone, its declarations left behind, on
// the outer frame of the depth budget.
async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

// `|` runs the step on a value, an error it answers taking a frame there,
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

// `!|` alone catches a failure, its step running on the error at rest, the
// map of its facts, `:trail` among them, under `::error` and the tag of
// the site that refused laid through its label as a tagged literal lays
// it, so `!| type` reads the site and a verb of `::error` reaches every
// error [QSERR#rest], a value passing, a label's refusal answering for the
// catch [QSERR#catch], and a raise that writes the `:trail` it read resuming
// that path [QSERR#trail].
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
function evalRegexLit(node, state)   { return withPipeValue(state, makeRegex(node.pattern, node.flags)); }

// Each element and each value of a literal is a literal, read one after
// another in their order [QSQUO#modifier], none reading the scope or the
// subject [QSLIT#closed]; a failure lives in the pipe alone, so the first a part
// answers, a constructor's refusal of its payload, is the answer of the
// literal, the parts after it left unread [QSERR#flow].
async function evalVecLit(node, state) {
  return withPipeValue(state, await partValues(node.elements, state));
}

async function evalMapLit(node, state) {
  return withPipeValue(state, await entryValues(node.entries, state));
}

async function partValues(parts, state) {
  const values = [];
  for (const part of parts) {
    const answered = await partAnswer(part, state);
    if (isErrorValue(answered)) return answered;
    values.push(answered);
  }
  return values;
}

async function entryValues(entries, state) {
  const values = await partValues(entries.map(entry => entry.value), state);
  return isErrorValue(values) ? values : new Map(entries.map((entry, index) => [entry.key.name, values[index]]));
}

// An error literal is the literal of the kind of errors, as `#[…]` is the
// set's: `!{…}` is `::error{…}`, an error at rest, and `::Foo!{…}` is
// `::Foo::error{…}`, laid through the label of its tag as a tagged literal
// lays a payload, a refusal of the label answering for the literal; every
// entry is a fact, `:kind` among them, and `raise` raises the error
// [QSERR#rest].
async function evalErrorLit(node, state) {
  const facts = await entryValues(node.entries, state);
  if (isErrorValue(facts)) return withPipeValue(state, facts);
  const atRest = await mintTaggedInstance(ERROR_TAG.name, facts, state);
  return withPipeValue(state, node.tag === null ? atRest : await mintTaggedInstance(node.tag, atRest, state));
}

// The value a part of a literal answers: a refusal its constructor raised
// passes a frame at the part, and one handed on from a part inside it goes
// on as it is to the literal it fails [QSERR#trail].
async function partAnswer(partNode, state) {
  return answerOfPart((await evalNode(partNode, state)).pipeValue, partNode, state.pipeValue);
}

function evalQuoteLit(node, state) {
  return withPipeValue(state, quoteOfLiteral(node));
}

// A doc's quote takes the role the tags written before it give [QSSLF#doc],
// each laid over the quote through its label as a tagged literal lays a
// payload, so a tag whose label takes no quote refuses the doc,
// `|~~ see ::number~(~(x)) ~~|` as `::number~(~(x))` does [QSSLF#doc].
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
// them in the one order [QSORD#order].
async function evalSetLit(node, state) {
  const elements = await partValues(node.elements, state);
  return withPipeValue(state, isErrorValue(elements) ? elements : makeSet(elements));
}

// ─── TaggedLit / TagLit ────────────────────────────────

async function evalTaggedLit(node, state) {
  const tagName = node.tag;
  const payload = (await evalNode(node.payload, state)).pipeValue;
  if (isErrorValue(payload)) return withPipeValue(state, passedUntagged(payload, node, tagName));
  return withPipeValue(state, await mintTaggedInstance(tagName, payload, state));
}

// The error a tagged literal's payload answered, passed by the tag as an
// error passes every step, the tag's step joining the skipped steps of
// its last frame [QSERR#trail], and the literal's own raise where the payload
// raised it.
function passedUntagged(payloadError, node, tagName) {
  const passed = skipping(payloadError, tagCallStepOf(makeTag(tagName)));
  if (isRaisedBy(payloadError, node.payload)) raisedBy(passed, node);
  return passed;
}

// A tag name is a value of its own, read without the scope [QSLIT#kind].
async function evalTagLit(node, state) {
  return withPipeValue(state, makeTag(node.tag));
}

// ─── BindStep ───────────────────────────────────────────────────

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
async function evalBindStep(node, state) {
  const name = declaredNameOf(node);
  const [nounName] = splitAddress(name);
  if (nounName !== null) refuseWithheld(state.env, nounName, true);
  if (repeatsDeclarationInScope(node) || declaresWhatTheCallBinds(node, state.env, name) || (nounName !== null && rootOf(state.env).has(name))) {
    throw new BindNameDeclaredTwiceError({ name: keyword(name) });
  }
  if (nounName !== null && !envHas(state.env, nounName)) {
    throw new BindNounNotDeclaredError({ name: keyword(name), noun: makeTag(nounName) });
  }

  const answered = node.body === null
    ? makeDoc(slotDocsOf(node).flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]))
    : (await evalNode(node.body, state)).pipeValue;
  if (isErrorValue(answered)) return withPipeValue(state, answered);
  if (writesOutsideItsChain(state.env, nounName, splitAddress(name)[1], answered)) {
    throw new BindWrittenOutsideItsChainError({ name: keyword(name), noun: nounName === null ? undefined : makeTag(nounName) });
  }
  if (node.body === null) return withEnv(state, envSet(state.env, name, declarationRecord(node, answered)));
  const declared = envSet(state.env, name, declarationRecord(node, answered));
  const origin = keyword(originOf(node));
  if (isKind(answered)) return withEnv(state, nodesOfKind(answered, name, declared, origin));
  return withEnv(state, nounName !== null && isFn(answered) ? nodesOfFunction(answered, name, declared, origin) : declared);
}

// Whether a declaration writes by name a role the chain of a kind or of a
// function holds alone [QSBLD#chain].
function writesOutsideItsChain(env, nounName, lastName, value) {
  if (isInvariant(value)) return true;
  if (nounName === null) return false;
  if (isLabel(env, nounName)) return lastName === CONSTRUCT_NAME;
  return isWord(env, nounName) && (isPath(value) || isQuote(value) || lastName === ANSWER_NAME || lastName === SUBJECT_NAME);
}

// The nodes a chain lays under an address for `doc`, `manifest`, `laws`
// and the tools, each a name, its page and its value: the refusal of the
// kinds a role names under the page `throws` gives it or its own, and the
// pages, facts, invariants and laws of the chain last.
function layerOf(env, address, origin, pages) {
  let under = env;
  const lay = (lastName, page, value) => {
    const name = `${address}/${lastName}`;
    under = envSet(under, name, makeBinding({ name: keyword(name), docs: [page], value, origin }));
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
      for (const { name, page, condition } of invariants) lay(name, page, makeTaggedInstance(INVARIANT_TAG, condition));
      for (const { name, page, query } of laws) lay(name, page, makeTaggedInstance(LAW_TAG, query));
      return under;
    }
  };
}

// The nodes a kind lays under its address, each role of its chain with its
// page, which its values never read [QSBLD#kind].
function nodesOfKind(kind, address, env, origin) {
  const roles = kindOf(kind);
  const { payload, fields, tells } = roles;
  const { lay, layKindsRefusal, layRest } = layerOf(env, address, origin, roles.pages);
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
  if (recipeOf(kind) !== null) lay(CONSTRUCT_NAME, pageOfConstructor(address), recipeOf(kind));
  return layRest(roles);
}

// The nodes a function named under a label lays under its address, each
// role of its chain with its page, which its call never reads [QSBLD#fn].
function nodesOfFunction(fn, address, env, origin) {
  const signature = signatureOf(fn);
  const { subject, inputs, answer } = signature;
  const { lay, layKindsRefusal, layRest } = layerOf(env, address, origin, signature.pages);
  if (subject !== null) lay(SUBJECT_NAME, subject.page, subject.written ?? subject.page);
  for (const { name, page, place, kinds, each } of inputs) {
    lay(name.name, page, place);
    if (kinds !== null) layKindsRefusal((each ? elementsRefusalAddress : kindsRefusalAddress)(name.name), name, kinds, each);
  }
  if (answer !== null) lay(ANSWER_NAME, answer.page, answer.written);
  return layRest(signature);
}

// Whether a declaration among the steps of a word's body, the body itself
// or a step of its pipeline, names what its call bound in the body's
// scope, `args` or an input; a group of one step the parser leaves as the
// body is a scope of its own [QSNAM#scope].
function declaresWhatTheCallBinds(bindStep, env, name) {
  const binds = env.get(CALL_BINDS_KEY);
  return binds !== undefined && (bindStep === binds.body || (binds.body.type === 'Pipeline' && bindStep.parent === binds.body)) && binds.names.has(name);
}

// The record a declaration writes: its name, the docs of its slot, the value,
// the quote of its step and its origin [QSNAM#binding], [QSDSP#residence].
function declarationRecord(node, value) {
  return makeBinding({
    name: keyword(node.key.name),
    docs: slotDocsOf(node),
    value,
    source: quoteOfBody(node),
    origin: keyword(originOf(node))
  });
}

// ─── Path ─────────────────────────────────────────────────────────

// A path is a value that does nothing by itself; the word that takes it
// reads it [QSPTH#value].
function evalPath(node, state) {
  return withPipeValue(state, makePath(node.keys));
}

// ─── Identifier lookup ─────────────────────────────────────────

async function evalCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  return withReadOfPath(await callByName(node.name, node.args.map(argNode => modifierOf(argNode, state)), state, node), node, state.pipeValue, state.env);
}

// The read a step was likely meant for where a path stands in place of
// the value it names [QSPTH#value]: a word called on a path, `/tags | count`
// read as `get /tags | count`, and an input refusing the path a modifier
// wrote, `mul /qty` read as `mul (get /qty)`; a refusal the call itself
// answered, which no frame of a trail has passed yet, carries it.
function readOfPathSubject(path, node) {
  return makeQuote([commandStep('get', [path]), stepOfNode(node)]);
}

function readOfRefusedPath(refused, node, subject) {
  if (!refused.descriptor.has('actualValue')) return isPath(subject) ? readOfPathSubject(subject, node) : null;
  const value = refused.descriptor.get('actualValue');
  if (!isPath(value)) return null;
  const written = node.args.findIndex(argNode => argNode.type === 'Path'
    && argNode.keys.length === value.segments.length && argNode.keys.every((key, at) => String(key) === value.segments[at]));
  if (written === -1) return null;
  const step = stepOfNode(node);
  const modifiers = step.get('modifiers').map((modifier, at) => (at === written ? groupStep([commandStep('get', [modifier])]) : modifier));
  return makeQuote([commandStep(step.get('name').name, modifiers)]);
}

function withReadOfPath(state, node, subject, env) {
  const refused = state.pipeValue;
  if (!isErrorValue(refused) || refused.descriptor.has('read') || refused.descriptor.has('trail')) return state;
  const read = readOfRefusedPath(refused, node, subject);
  if (read === null) return state;
  const facts = factsInOrder(refused.tag, new Map(refused.descriptor).set('read', read), env);
  return withPipeValue(state, makeErrorValue(refused.tag, facts, { location: refused.location, originalError: refused.originalError }));
}

// A bare name calls what it reaches for the subject [QSDSP#walk],
// [QSDSP#residence]; a word the kind of the subject does not answer is refused
// with the addresses where the word lives [QSDSP#refusal], and a name that
// reaches nothing with the names near it. A value the scope binds and a word
// that serves the subject under one name meet, and the step is refused with
// the word's address, which calls the word, as another name reads the value
// [QSNAM#reach]; a value of the reader withheld from held code is refused
// under its name before a word or a value of the root answers for it
// [QSQUO#held].
async function callByName(lookupName, modifiers, state, node) {
  refuseWithheld(state.env, lookupName);
  const reach = bareNameReach(state.env, lookupName, state.pipeValue);
  if (reach === null) {
    const addresses = addressesOf(state.env, lookupName);
    if (addresses.length > 0) {
      const nearest = nearestWords(state.env, addresses, state.pipeValue);
      const read = isPath(state.pipeValue) ? readOfPathSubject(state.pipeValue, node) : undefined;
      throw new CallKindAnswersNoVerbError({ name: keyword(lookupName), addresses, nearest: nearest.length > 0 ? nearest : undefined, read, actualValue: state.pipeValue });
    }
    throw new CallUnknownNameError({
      name: keyword(lookupName), nearest: nearestNames(state.env, lookupName), addresses
    });
  }
  if (reach.underKind) return await applyWord(reach.record, modifiers, state);
  const word = residenceOnSubject(state.env, lookupName, state.pipeValue);
  if (word !== null && servesTheSubject(word, state.pipeValue)) {
    throw new CallValueMeetsWordError({ name: keyword(lookupName), addresses: makeSet([makeTag(word.get('name').name)]) });
  }
  return await applyBinding(reach.record, lookupName, lookupName, modifiers, state);
}

// Whether the word a walk reached serves the subject, as its call would
// [QSNAM#reach].
function servesTheSubject(record, subject) {
  const value = bindingValueOf(record);
  const fn = isFn(value) ? value : functionOfRecipe(value);
  return subjectOfCall(signatureOf(fn), splitAddress(record.get('name').name)[0], subject) !== null;
}

// A name reads the value its record holds, so `:x it | x` sees the raw
// data, a quote among it, which `apply` runs [QSNAM#value].
async function applyBinding(entry, name, lastName, modifiers, state) {
  const resolved = bindingValueOf(entry);

  // A value takes no modifiers; its refusal names the name as the step
  // wrote it and where a word of its last name lives, one a declaration
  // shadows among them [QSNAM#value], [QSDSP#walk].
  if (modifiers.length > 0) {
    throw new CallValueTakesNoModifiersError({
      name: keyword(name),
      actualValue: resolved,
      addresses: addressesOf(state.env, lastName)
    });
  }
  return withPipeValue(state, resolved);
}

// A name with a path reads what its address declared, past every bare
// name of the scope, a name under a label run and any other value
// itself, so a word a declaration shadows stays one address away [QSDSP#walk],
// [QSDSP#residence]:
// `[1 2 3] | vec/filter ~(gt 1)` calls the `filter` of vectors whatever
// the scope binds as `filter`.
async function callByAddress(node, state) {
  const record = nodeOf(state.env, node.name);
  if (record === null) {
    throw new CallUnknownAddressError({ address: makeTag(node.name), nearest: nearestTagNames(state.env, node.name) });
  }
  const modifiers = node.args.map(argNode => modifierOf(argNode, state));
  if (isMemberValue(bindingValueOf(record)) && isUnderLabel(state.env, node.name)) {
    return await applyWord(record, modifiers, state);
  }
  return await applyBinding(record, node.name, splitAddress(node.name)[1], modifiers, state);
}

// ─── A value held to its kinds ──────────────────────────────────

// A refusal named by the address of what refused [QSERR#site], [QSBLD#fn], its
// facts with the kind of the value refused in the order the catalog declares
// them [QSERR#site]; the value itself rides the facts where the trail does not
// hold it, an input or the args, and leaves them for the subject, which the
// trail's first frame holds [QSERR#site].
function refusalUnder(tagName, facts, env, refused = facts.actualValue) {
  const tag = makeTag(tagName);
  return makeErrorValue(tag, factsInOrder(tag, new Map(Object.entries(facts)).set('actualType', typeKeyword(refused)), env));
}

// The value an input, a payload or a field holds: the value of its kind the
// walk of its tags reaches, or, where it names the kinds of each element,
// the vector, or the set, of each element's, a quote and a doc, whose
// elements are steps and segments, as they are; a value of none of its kinds
// is refused, a value that is no vector where they are the kinds of each
// element is refused as of no `::vec`, and an element of none is refused
// with its index, each refusal named as the holder names the refusal of
// its kinds, or of each element's.
function heldByItsKinds({ kinds, each }, refusalOf, value, env) {
  if (!each) {
    if (kinds === null) return value;
    const reached = walkToKinds(value, kinds);
    return reached === null ? refusalUnder(refusalOf(false), { expected: kindsExpected(...kinds), actualValue: value }, env) : reached.served;
  }
  const elements = walkToKinds(value, ['vec']);
  if (elements === null) return refusalUnder(refusalOf(false), { expected: kindsExpected('vec'), actualValue: value }, env);
  if (kinds === null) return elements.served;
  const refused = refusedElementOf(elements.served, kinds);
  if (refused !== null) return refusalUnder(refusalOf(true), { index: refused.index, expected: kindsExpected(...kinds), actualValue: refused.element }, env);
  if (isQuote(elements.served) || isDoc(elements.served)) return elements.served;
  const served = Array.from(elements.served, element => walkToKinds(element, kinds).served);
  return isQSet(elements.served) ? makeSet(served) : Object.freeze(served);
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
    const answer = (await evalBody(astOfQuote(condition), nestState(state, value, scope))).pipeValue;
    if (isErrorValue(answer)) return answer;
    if (answer !== true) return refusalUnder(`${address}/${name}`, { actualValue: held }, scope);
  }
  return null;
}

// ─── The places of the args ─────────────────────────────────────

// The value an input reads from the args by its place: a place of one
// step, `/n` or `query /n default`, is the value there, read here as
// `get` and `query` read it, so the inputs of `query` itself read
// without calling it; any other place runs as code over the args, a frame
// below the call.
function placeRead({ ast, place, onePlace, strict, fallback }, values, overArgs) {
  if (!onePlace) return ast.type === 'Path' ? pathOfArgs(makePath(ast.keys), overArgs()) : answerOfBody(ast, overArgs());
  if (place < values.length) return values[place];
  if (strict) return MISSED_PLACE;
  return fallback === null ? null : answerOfBody(fallback, overArgs());
}

// A selector that is a path of more than one place reads it from the
// args as `get` does, a place the args do not hold the place the call
// left out [QSPTH#value].
function pathOfArgs(path, state) {
  try {
    return readPath(state.pipeValue, path);
  } catch (refusal) {
    return errorFromQlang(refusal, state.pipeValue, state.env);
  }
}

async function answerOfBody(ast, state) {
  return (await evalBody(ast, state)).pipeValue;
}

// A strict read of a place past the values of the args.
const MISSED_PLACE = Symbol('missedPlace');

// A strict read of a place the args do not hold.
const MISSED_PLACE_ADDRESSES = new Set([PathIndexOutOfBoundsError.prototype.address, PathKeyNotInMapError.prototype.address]);

function isMissedPlace(error) {
  return MISSED_PLACE_ADDRESSES.has(error.tag.name);
}

// ─── The scope a call opens ─────────────────────────────────────

// The scope a call opens, read once for the scope it is called in, which
// never changes once made.
const OPENED_SCOPES = [new WeakMap(), new WeakMap()];

function recipeScopeOf(state, ofTheRoot) {
  const opened = OPENED_SCOPES[ofTheRoot ? 1 : 0];
  let scope = opened.get(state.env);
  if (scope === undefined) opened.set(state.env, scope = scopeOpenedIn(state.env, ofTheRoot));
  return scope;
}

function scopeOpenedIn(env, ofTheRoot) {
  const scope = new Map([[ROOT_KEY, rootOf(env)], [QUERY_KEY, queryTreeOf(env)]]);
  if (ofTheRoot) markRootWordScope(scope);
  for (const [name, entry] of env) {
    if (typeof name !== 'string' || scope.has(name)) continue;
    if (isNodeOrLabel(name, entry)) scope.set(name, entry);
  }
  return scope;
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

// A word runs by its function [QSBLD#fn], a recipe written as the value of a
// name under a label the function of no commands it is [QSBLD#recipe].
async function applyWord(record, modifiers, state) {
  const value = bindingValueOf(record);
  return await applyFunctionWord(record, isFn(value) ? value : functionOfRecipe(value), modifiers, state);
}

// Whether an answer is waited on: anything with a `then`, so a host's
// promise of another realm and a thenable resolve as the core's own do.
const isThenable = value => typeof value?.then === 'function';

// The answer brought to the kinds `returns` names, a word that names `::any`
// bringing none [QSBLD#answer]: one that reaches another of the
// kinds is the value it reaches; one of the word's own label goes back under
// the tags the walk passed, as the subject's kind; one kind alone makes the
// value by its constructor and invariants, and so does a kind of the answer's
// own kind the walk passed by, a number past the finite doubles refused there
// as under `::number` alone; an answer of none of several kinds is refused
// under the answer's address.
function answerUnderItsLabel(answer, { address, kinds }, labelName, walked, state) {
  const others = kinds.filter(kind => kind !== labelName);
  const reached = others.length === 0 ? null : walkToKinds(answer, others);
  if (reached !== null) return reached.served;
  const refused = () => refusalUnder(kindsRefusalAddress(address), { expected: kindsExpected(...kinds), actualValue: answer }, state.env);
  if (kinds.includes(labelName)) {
    if (walkToKinds(answer, [labelName]) !== null) return keptAsSubject(answer, walked.served, walked.passedTags, state);
    const keeping = () => keptOfTheLabel(answer, labelName, walked, refused, state);
    return typeKeyword(walked.served).name === labelName ? answerMadeBy(labelName, keeping, refused) : keeping();
  }
  const constructing = kinds.length === 1 ? kinds[0] : kinds.find(kind => kind === typeKeyword(answer).name);
  return constructing === undefined ? refused() : answerMadeBy(constructing, () => mintUnderTag(state, makeTag(constructing), answer), refused);
}

// An answer kept as the subject's kind, refused where what is kept is no
// value of the label.
async function keptOfTheLabel(answer, labelName, walked, refused, state) {
  const kept = await keptAsSubject(answer, walked.served, walked.passedTags, state);
  return isErrorValue(kept) || walkToKinds(kept, [labelName]) !== null ? kept : refused();
}

// The answer a constructor makes, a payload the kind refuses for its kind
// refused as the answer is [QSBLD#answer].
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

// callMemberOn(record, subject, state) → the answer of the name under a
// label the record holds, run on the subject with no modifiers, the
// print a kind answers among them [QSPRN#print].
export async function callMemberOn(record, subject, state) {
  return (await applyWord(record, [], withPipeValue(state, subject))).pipeValue;
}

// answerKindsOf(env, record, subjectKinds) → the kinds of the answer a
// name under a label gives, for a tool: the subject's own where the
// answer's kind is the word's own label, the kinds `returns` names, or
// null for a word that answers any value [QSBLD#answer].
export function answerKindsOf(env, record, subjectKinds) {
  const address = record.get('name').name;
  const answerDefinition = answerOf(env, address);
  if (answerDefinition === null || answerDefinition.kinds.includes(ANY_KIND_NAME)) return null;
  return answerDefinition.kinds.includes(splitAddress(address)[0]) ? subjectKinds : answerDefinition.kinds;
}

// ─── Functions ──────────────────────────────────────────────────

// A word that is a function is called by its function alone [QSBLD#fn]: its
// subject served by its label or by the kinds `on` names, its inputs read
// from the args by their places and held to their kinds and invariants, its
// recipe run in the scope its call opens, a recipe written in steps of a
// word of the root's marked as the root's and a primitive keeping the mark
// of the scope it is called in, and its answer brought to the kinds
// `returns` names, every refusal named under the word's address.
async function applyFunctionWord(record, fn, modifiers, state) {
  const address = record.get('name').name;
  const ofTheRoot = isQuote(recipeOf(fn)) ? rootOf(state.env).get(address) === record : isRootWordScope(state.env);
  return withPipeValue(state, await callFunction(fn, { address, labelName: splitAddress(address)[0], ofTheRoot }, modifiers, state));
}

// applyFunction(fn, subject, args, state) → the answer of a function `apply`
// runs on a subject, the values of a vector its args, every refusal named
// under the call of a function, `fn/call`, since no word names it; a
// function with no recipe, a contract, runs nothing.
const FN_CALL_ADDRESS = 'fn/call';

export async function applyFunction(fn, subject, args, state) {
  const recipe = recipeOf(fn);
  if (!isRecipe(recipe)) throw new FnRecipeMissingError({ actualValue: fn });
  const at = { address: FN_CALL_ADDRESS, labelName: null, ofTheRoot: !isQuote(recipe) && isRootWordScope(state.env) };
  return await callFunction(fn, at, args.map(value => () => value), withPipeValue(state, subject));
}

// inputsOfFunction(fn, args, state) → the values the inputs of a function
// read from the values of a vector, as its call reads them, or the refusal
// its call would answer.
export async function inputsOfFunction(fn, args, state) {
  const called = await inputsOfCall(signatureOf(fn), FN_CALL_ADDRESS, args.map(value => () => value), state, recipeScopeOf(state, false), null);
  return isErrorValue(called) ? called : called.values;
}

async function callFunction(fn, { address, labelName, ofTheRoot }, modifiers, state) {
  const signature = signatureOf(fn);
  const recipe = recipeOf(fn);
  const walked = subjectOfCall(signature, labelName, state.pipeValue);
  if (walked === null && labelName === null) return refusalUnder(subjectKindsRefusalAddress(address), { expected: kindsExpected(...signature.subject.kinds) }, state.env, state.pipeValue);
  if (walked === null) return refusalUnder(subjectRefusalAddress(address, [labelName]), {}, state.env, state.pipeValue);
  const scope = recipeScopeOf(state, ofTheRoot);
  const body = isQuote(recipe) ? astOfQuote(recipe) : null;
  const called = await inputsOfCall(signature, address, modifiers, state, scope, body);
  if (isErrorValue(called)) return called;
  const running = body === null
    ? runPrimitive(hostImplOf(recipe), walked.served, walked.passedTags, handedTo(hostImplOf(recipe), signature, called, state), called.state)
    : (await evalBody(body, nestState(called.state, state.pipeValue, called.bodyEnv))).pipeValue;
  const answer = isThenable(running) ? await running : running;
  if (isErrorValue(answer)) return answer;
  const kinds = signature.answer?.kinds ?? null;
  const brought = kinds === null ? answer : await answerUnderItsLabel(answer, { address: `${address}/${ANSWER_NAME}`, kinds }, walked.byLabel ? labelName : null, walked, state);
  if (isErrorValue(brought)) return brought;
  return await invariantRefusal(invariantsOf(signature, ANSWER_NAME), address, brought, called.state, scope) ?? brought;
}

// The values a primitive is handed, its inputs in the order `takes` names
// them, each it runs as code closed at the call [QSQUO#literal] where the call
// keeps that the quote came from [QSQUO#held], a path read as `get` reads it
// [QSPTH#value], and every element so of one that holds the objects of the
// call whole; any other value as it is.
function handedTo(impl, signature, { values, origins }, state) {
  const run = inputsRunBy(impl);
  const within = inputsRunWithin(impl);
  if (run === undefined && within === undefined) return values;
  const originOf = quote => origins.get(quote);
  return values.map((value, at) => {
    const { name, selector } = signature.inputs[at];
    if (within?.has(name.name)) return quotesClosedIn(value, originOf);
    if (!run?.has(name.name)) return value;
    return selector.readsArgs ? value.map(element => codeOfObject(element, originOf, state)) : codeOfObject(value, originOf, state);
  });
}

// A template whose quotes are code closed at the call where each came
// from, the paths and the other values of it as they are, a set's
// elements kept in its order.
function quotesClosedIn(value, originOf) {
  if (isQuote(value)) return codeFrom(value, originOf(value));
  if (!holdsAQuote(value)) return value;
  if (isValueClass(value, 'taggedInstance')) return makeTaggedInstance(value.tag, quotesClosedIn(value.payload, originOf));
  const header = value[TAG_HEADER_SYMBOL];
  const closed = isQMap(value)
    ? new Map([...value].map(([key, part]) => [key, quotesClosedIn(part, originOf)]))
    : value.map(part => quotesClosedIn(part, originOf));
  if (header !== undefined) stampTagHeader(closed, header);
  return closed;
}

// The origin a call keeps of each quote an object holds, at any depth of a
// template or beneath a tag [QSQUO#held]: a quote written in the step is that
// step's, and any other the origin a call around keeps for it, the
// nearest, or else the object's, a value of the step.
function keepOrigins(origins, value, origin, state) {
  if (isQuote(value)) {
    origins.set(value, origin.written ? origin : originIn(state, value) ?? origin);
    return;
  }
  if (isValueClass(value, 'taggedInstance')) return keepOrigins(origins, value.payload, origin, state);
  if (!holdsAQuote(value)) return;
  for (const part of partsOfTemplate(value)) keepOrigins(origins, part, origin, state);
}

// Whether a value holds a quote at any depth of a template, read once for
// each value, which never changes, since every call walks its objects.
const HOLDERS_OF_QUOTES = new WeakMap();

function holdsAQuote(value) {
  if (isQuote(value)) return true;
  if (isValueClass(value, 'taggedInstance')) return !isQuote(value.payload) && holdsAQuote(value.payload);
  if (typeof value !== 'object' || value === null) return false;
  let holds = HOLDERS_OF_QUOTES.get(value);
  if (holds === undefined) {
    const parts = partsOfTemplate(value);
    holds = parts !== null && parts.some(holdsAQuote);
    HOLDERS_OF_QUOTES.set(value, holds);
  }
  return holds;
}

function codeOfObject(value, originOf, state) {
  if (isQuote(value)) return codeFrom(value, originOf(value));
  return isPath(value) ? codeOfPath(value, state) : value;
}

// The subject a function's call serves: for a word, the value of its label
// the walk of the subject's tags reaches, or of a kind `on` names beside
// it, the noun's own tag name for a word of the noun itself, since the walk
// of a tag name passes the noun it names and no other [QSDSP#tagname]; for a
// function `apply` runs, a value of the kinds `on` names, or the subject as
// it is; null where the walk reaches none.
function subjectOfCall(signature, labelName, subject) {
  const onKinds = signature.subject?.kinds ?? null;
  if (labelName === null) return onKinds === null ? { served: subject, passedTags: [] } : walkToKinds(subject, onKinds);
  const byLabel = walkToKinds(subject, [labelName]);
  if (byLabel !== null) return { ...byLabel, byLabel: true };
  const byKinds = onKinds === null ? null : walkToKinds(subject, onKinds);
  return byKinds !== null && isTag(byKinds.served) && ![...kindsOfWalk(byKinds.served)].includes(labelName) ? null : byKinds;
}

// The values of the inputs of a function's call, read from its args by
// their places, the values of its objects computed against the subject,
// and, for a recipe written in steps, the scope of its body, each input
// bound by its name and the args as `args`, names the steps of the body
// declare no second time [QSNAM#scope], and the state of the call's run, which
// keeps the origin of each quote its objects hold [QSQUO#held]: args of more
// values than the inputs read places are refused, an input the args leave
// out where its place reads one is refused, a value none of an input's
// kinds holds is refused, each refusal named under the address, and so is
// a value that breaks an invariant written under its input, which holds of
// the value as the args give it.
async function inputsOfCall(signature, address, modifiers, state, scope, body) {
  const values = [];
  const origins = new Map();
  for (const [place, modifier] of modifiers.entries()) {
    const computing = modifier(state.pipeValue);
    const value = isThenable(computing) ? await computing : computing;
    if (isErrorValue(value)) return refusalOfFailedObject(signature, address, place, value, scope);
    values.push(value);
    keepOrigins(origins, value, modifier.origin ?? heldIn(state), state);
  }
  const called = withCall(state, origins);
  let args = null;
  const argsValue = () => args ??= makeTaggedInstance(makeTag(address), values);
  if (signature.places !== null && values.length > signature.places) return refusalUnder(argsBeyondInputsAddress(address), { places: signature.places, actualValue: argsValue() }, scope);
  let bodyEnv = body === null ? null : envSet(scope, ARGS_NAME.name, makeBinding({ name: ARGS_NAME, value: argsValue() }))
    .set(CALL_BINDS_KEY, { body, names: new Set([ARGS_NAME.name, ...signature.inputs.map(({ name }) => name.name)]) });
  const overArgs = () => nestState(called, argsValue(), scope);
  const inputValues = [];
  for (const input of signature.inputs) {
    const { name, selector } = input;
    const inputAddress = `${address}/${name.name}`;
    frameBelow(state);
    const reading = placeRead(selector, values, overArgs);
    const read = isThenable(reading) ? await reading : reading;
    if (read === MISSED_PLACE || (isErrorValue(read) && isMissedPlace(read))) return refusalUnder(notGivenAddress(inputAddress), { actualValue: argsValue() }, scope);
    if (isErrorValue(read)) return read;
    const held = heldByItsKinds(input, refusalsUnder(inputAddress), read, scope);
    if (isErrorValue(held)) return held;
    const refused = await invariantRefusal(invariantsOf(signature, name.name), address, read, called, scope);
    if (refused !== null) return refused;
    inputValues.push(held);
    if (body !== null) bodyEnv = envSet(bodyEnv, name.name, makeBinding({ name, value: held }));
  }
  return { values: inputValues, origins, bodyEnv, state: called };
}

// An object of the call that answered an error where the input that reads
// its place, or the objects of the call whole, takes a quote: the step ran
// on the subject by mistake, `each (add 1)` for `each ~(add 1)`, and the
// input refuses it under its kinds with the error at rest as its value, an
// element of the objects whole naming its place and the value of an input
// of each element refused as no vector, as a value of the step is
// [QSBLD#input]; a name withheld from held code, which ran no step, and
// anywhere else the error is the answer [QSQUO#modifier].
function refusalOfFailedObject(signature, address, place, error, scope) {
  if (error.tag.name === CallValueWithheldError.prototype.address) return error;
  const reading = signature.inputs.find(({ selector }) => selector.place === place) ?? signature.inputs.find(({ selector }) => selector.readsArgs);
  if (!(reading?.kinds?.includes('quote') ?? false)) return error;
  const atRest = errorAtRest(error.tag, new Map(error.descriptor));
  const inputAddress = `${address}/${reading.name.name}`;
  if (reading.each && reading.selector.readsArgs) {
    return refusalUnder(elementsRefusalAddress(inputAddress), { index: place, expected: kindsExpected(...reading.kinds), actualValue: atRest }, scope);
  }
  const expected = reading.each ? kindsExpected('vec') : kindsExpected(...reading.kinds);
  return refusalUnder(kindsRefusalAddress(inputAddress), { expected, actualValue: atRest }, scope);
}

// ─── A value under a kind ───────────────────────────────────────

// mintTaggedInstance(tagName, payload, state) → the payload under the tag
// through its label [QSDSP#answer]: built by its kind [QSBLD#kind], laid over
// as it is where no kind answers the tag [QSLIT#tag], [QSBLD#label], never
// over an error [QSERR#flow], and never under the name of a value withheld
// from held code [QSQUO#held].
export async function mintTaggedInstance(tagName, payload, state) {
  refuseWithheld(state.env, tagName, true);
  const node = nodeOf(state.env, tagName);
  const declared = bindingValueOf(node);
  if (isKind(declared)) return await underKind(tagName, declared, payload, state);
  if (isDoc(declared)) return laidUnder(tagName, payload);
  if (node === null || isWord(state.env, tagName) || isInvariant(declared)) return makeTaggedInstance(makeTag(tagName), payload);
  throw new ConstructTagNotKindError({ tag: makeTag(tagName), actualValue: declared });
}

// A value under the tag of a label, a value of the label's own kind staying
// as it is.
function laidUnder(tagName, value) {
  return typeKeyword(value).name === tagName ? value : makeTaggedInstance(makeTag(tagName), value);
}

// A value under a kind [QSBLD#kind]: its payload held to its kinds, each field
// read and held, the check a host hands a kind of the core run, and the
// invariants of the value held, every refusal named under the label, the
// code of a place or a condition running in the scope a call opens; the
// constructor attaches the tag or refuses the payload [QSLIT#tag].
async function underKind(tagName, kind, payload, state) {
  const { payload: payloadRole, fields, invariants } = kindOf(kind);
  const held = payloadRole === null ? payload : heldByItsKinds(payloadRole, each => `${tagName}/${payloadRefusalName(each)}`, payload, state.env);
  if (isErrorValue(held)) return held;
  let scope;
  const opened = () => scope ??= recipeScopeOf(state, rootOf(state.env).get(tagName) === nodeOf(state.env, tagName));
  for (const field of fields) {
    const refused = await fieldRefusal(tagName, field, held, invariants, state, opened);
    if (refused !== null) return refused;
  }
  const check = recipeOf(kind);
  const checked = isRecipe(check) ? await hostImplOf(check)(held, state) : held;
  const labelled = laidUnder(tagName, checked);
  const ofTheValue = invariants.filter(({ field }) => field === null);
  return ofTheValue.length === 0 ? labelled : await invariantRefusal(ofTheValue, tagName, checked, state, opened(), labelled) ?? labelled;
}

// The refusal of a field of the payload: a place the payload leaves out, a
// value of none of its kinds, or one that breaks an invariant written under
// the field, which holds of the value as the payload gives it; the failure
// of a quote that reads it; or null.
async function fieldRefusal(tagName, field, payload, invariants, state, opened) {
  const fieldAddress = `${tagName}/${field.name.name}`;
  const read = isPath(field.place)
    ? pathOfArgs(field.place, withPipeValue(state, payload))
    : await answerOfBody(astOfQuote(field.place), nestState(state, payload, opened()));
  if (isErrorValue(read) && isMissedPlace(read)) return refusalUnder(notGivenAddress(fieldAddress), { actualValue: payload }, state.env);
  if (isErrorValue(read)) return read;
  const held = heldByItsKinds(field, refusalsUnder(fieldAddress), read, state.env);
  if (isErrorValue(held)) return held;
  const ofTheField = invariants.filter(({ field: under }) => under === field.name.name);
  return ofTheField.length === 0 ? null : await invariantRefusal(ofTheField, tagName, read, state, opened());
}

// ─── Code closed at a call ──────────────────────────────────────

// closeCode(astNode, capturedState, evaluate?) → (input) → value: code run
// against the input it is handed, one frame below and in its scope, a step on
// the success track as every step is, or by `evaluate` an arg of a step,
// which answers within the frame of its step [QSERR#trail]; it keeps its tree and
// its state, so `reduce` finds the verb a quote of one name holds
// [QSCOL#reduce].
function closeCode(astNode, capturedState, evaluate = evalBody) {
  const run = async (input) => {
    const subState = nestState(capturedState, input, capturedState.env);
    return (await evaluate(astNode, subState)).pipeValue;
  };
  run.astNode = astNode;
  run.capturedState = capturedState;
  return run;
}

// modifierOf(argNode, state) → the code of a modifier of a call, whose
// subject is never an error: a quote written there the data it is and a
// template or a tagged literal written there the code that builds it, each
// written in the step, which the call runs it in [QSQUO#held]; a literal of an
// atom its value one frame below the call; and any other modifier the code
// it is, whose value the call keeps as a value of the step. A modifier
// answers within the frame of its step, which holds it [QSERR#trail].
function modifierOf(argNode, state) {
  if (argNode.type === 'QuoteLit') return withOrigin(() => quoteOfLiteral(argNode), { step: state, written: true });
  if (WRITTEN_LITERALS.has(argNode.type)) return withOrigin(closeCode(argNode, state, evalNode), { step: state, written: true });
  if (ATOM_LITERALS.has(argNode.type)) return () => (frameBelow(state), AST_NODE_EVALUATORS[argNode.type](argNode, state).pipeValue);
  return closeCode(argNode, state, evalNode);
}

const ATOM_LITERALS = new Set(['NumberLit', 'StringLit', 'BooleanLit', 'NullLit', 'Keyword', 'RegexLit']);

// The literals a template is written as, a value under a tag among them,
// whose quotes are written in the step [QSQUO#held], [QSLIT#tag].
const WRITTEN_LITERALS = new Set(['VecLit', 'MapLit', 'SetLit', 'TaggedLit']);

function withOrigin(code, origin) {
  code.origin = origin;
  return code;
}

// The origin of a value of a step, whose code is held as data and runs in
// the lane of the step [QSQUO#held].
function heldIn(state) {
  return { step: state, written: false };
}

// codeOfPath(path, callState) → code that reads the path from each input
// it is handed, as `~(get /path)` reads it, a refusal its answer with the
// frame of that step at the input [QSERR#trail].
export function codeOfPath(path, callState) {
  const step = () => makeQuote([commandStep('get', [path])]);
  return async input => {
    try {
      return readPath(input, path);
    } catch (refusal) {
      return answerOfStep(errorFromQlang(refusal, input, callState.env), step, input);
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
function codeFrom(code, { step, written }) {
  return closeCode(astOfQuote(code), written ? step : withEnv(step, laneOf(ownScopeOf(step))));
}

// The lane held code runs in [QSQUO#held], a tree of its own: the root, the
// words, the nodes and the labels of the scope of its step, and each value
// that scope names withheld, so no word and no value of the root answers
// for it.
const LANES = new WeakMap();

function laneOf(env) {
  let lane = LANES.get(env);
  if (lane !== undefined) return lane;
  const withheld = new Set(env.get(WITHHELD_KEY));
  lane = new Map([[ROOT_KEY, rootOf(env)], [WITHHELD_KEY, withheld]]);
  for (const [name, entry] of env) {
    if (typeof name !== 'string') continue;
    if (isNodeOrLabel(name, entry)) lane.set(name, entry);
    else withheld.add(name);
  }
  LANES.set(env, lane);
  return lane;
}

// resolveBinaryReducer(reducer) → (acc, item) → value, or null: the word a
// reducer's quote names by one word, its name or its address, called as the
// pipe calls it, `acc | add item`, the word residing on the accumulator among
// them [QSDSP#residence], and a value of the scope under the name meeting the
// word there [QSCOL#reduce], [QSNAM#reach]; null for code of any other shape
// or a name of no word, which `reduce` runs on the pair of the value so far
// and the element [QSCOL#reduce]. A call the accumulator refuses answers the
// failure it raised, which the fold marks at the place of its element [QSERR#trail].
export function resolveBinaryReducer(reducer) {
  const callerState = reducer.capturedState;
  const astNode = soleStepOf(reducer.astNode);
  if (astNode?.type !== 'Call' || astNode.args.length !== 0) return null;
  const item = element => [async () => element];
  const calledOn = call => async (acc, element) => {
    try {
      return (await call(item(element), withPipeValue(callerState, acc))).pipeValue;
    } catch (caughtError) {
      return errorOfThrow(caughtError, astNode, acc, callerState.env);
    }
  };
  if (astNode.address !== undefined) {
    if (!isWord(callerState.env, astNode.name)) return null;
    const record = nodeOf(callerState.env, astNode.name);
    return calledOn((modifiers, state) => applyWord(record, modifiers, state));
  }
  if (addressesOf(callerState.env, astNode.name).length === 0) return null;
  return calledOn((modifiers, state) => callByName(astNode.name, modifiers, state, astNode));
}

// The one step of a pipeline a leading `|` opens is the step itself, as the
// steps of its quote are [QSQUO#literal].
function soleStepOf(node) {
  return node?.type === 'Pipeline' && node.steps.length === 1 && node.leadingCombinator === '|' ? node.steps[0] : node;
}

// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
