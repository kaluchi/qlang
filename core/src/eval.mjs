// Top-level evaluator.
//
// Threads (pipeValue, env) state through pipeline steps. Dispatches
// on AST node `type` and delegates to the appropriate step or
// combinator evaluator.
//
// Architecture: every node-type evaluator is a small function
// (state, node) → state'. The dispatcher is a lookup table.

import { parse, ParseError } from './parse.mjs';
import {
  rootState, withPipeValue, withEnv, nestState, envSet, envGet, envHas
} from './state.mjs';
import { fork, forkWith } from './fork.mjs';
import { applyRule10 } from './rule10.mjs';
import {
  QlangError,
  QlangInvariantError,
  UnresolvedIdentifierError,
  UnresolvedAddressError,
  EffectLaunderingAtCallError,
  EffectLaunderingAtBindStepParseError,
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { nearestNames } from './nearest-names.mjs';
import { classifyEffect } from './effect.mjs';
import { declareSubjectError } from './operand-errors.mjs';
import {
  isVec, isQMap, isQSet, isKeyword, isFunctionValue, isErrorValue,
  typeKeyword, keyword, NULL, makeErrorValue, appendTrailNode,
  makeDoc, makeSet, isQuote,
  makeBinding, bindingValueOf, makeTaggedInstance, makeTagKeyword, isTagKeyword,
  isTaggedInstance, isValueClass, isVerb, verbEnvRef, quoteInEnv, envToRun,
  ERROR_TAG, BUILTIN_TAG, TAG_HEADER_SYMBOL, stampTagHeader, VALUE_CLASS_TAG
} from './types.mjs';
import { resolveBuiltinImpl } from './descriptor-ops.mjs';
import { tagBindingKey, canonicalTagName } from './env-keys.mjs';
import { isPlainCommentStep, moduleUriOf } from './walk.mjs';
import { quoteOfBody, quoteOfLiteral, astOfQuote } from './quote.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import { addressedVerb, addressesOf, subjectServedBy } from './runtime/nouns.mjs';
import { underPassedTags } from './runtime/dispatch.mjs';
import { applyVerb, callVerb, effectfulNameOfVerb, verbAsCode } from './runtime/verb.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import { parseDocSegments } from './doc-segments.mjs';
import {
  trailEntry, materializeTrail, combineTrailQuotes, materializePendingTrail
} from './eval-trail.mjs';

export { materializePendingTrail };

// ─── Dispatch-table invariants ─────────────────────────────────
//
// Both classes fire only when the evaluator hits an AST shape or
// combinator kind the dispatcher does not name — a parser change
// that lands a new AST.type without wiring `AST_NODE_EVALUATORS`,
// or a grammar change that introduces a new combinator token
// without wiring `COMBINATOR_EVALUATORS`. They extend
// `QlangInvariantError` so `evalNode`'s fault-conversion seam
// rethrows them (invariant violations bypass the lift-to-error-value
// path that user-facing errors ride).

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
// Map subject does not carry the requested key. Strict fail-first
// surfaces the typo / mismatched-shape on the projection itself; the
// lifted descriptor carries `:key` plus the `:fault` step/input so
// downstream `!| /key` reads the failed segment directly. null
// subject still deflects as null (see projectSegment).
const ProjectionKeyNotInMapError = declareShapeError('ProjectionKeyNotInMapError',
  ({ key }) => `/${key} — key not present in Map subject`,
  { operand: '::proj' });
// Vec or Set subject indexed past its bounds. Negative indices walk
// from the tail (`/-1` is last); only positions that resolve outside
// `[0, length)` trip this site. A set indexes as the vector it is, in
// the one order.
const ProjectionIndexOutOfBoundsError = declareShapeError('ProjectionIndexOutOfBoundsError',
  ({ key, length }) => `/${key} — index out of bounds for sequence of length ${length}`,
  { operand: '::proj' });
// Vec or Set subject projected by a non-numeric segment. Sequence
// indices are integer offsets; named keys belong to Map shape, so
// a `[…] | /name` query surfaces as a shape mismatch on the
// projection itself.
const ProjectionSequenceKeyNotIntegerError = declareShapeError('ProjectionSequenceKeyNotIntegerError',
  ({ key }) => `/${key} — non-integer segment cannot index a Vec or Set subject`,
  { operand: '::proj' });
// Value-class subjects (Doc / …) publish a fixed set of
// projectable fields through PROJECTABLE_BY_TYPE. A segment outside
// that set is treated as a typo and lifts to this error.
const ProjectionFieldNotOnValueClassError = declareShapeError('ProjectionFieldNotOnValueClassError',
  ({ key, valueClass, availableFields }) =>
    `/${key} — not a projectable field on ${valueClass}; available: ${availableFields.join(', ')}`,
  { operand: '::proj' });
const TaggedLitNotTagBindingError = declareShapeError('TaggedLitNotTagBindingError',
  ({ tag, actualType }) => `::${tag} — tag binding is ${actualType.name}, expected a Map descriptor`,
  { operand: '::tagged', expectedType: 'map' }
);
// `TagBindingHasNoConstructorError` — fired when `::tag<payload>`
// resolves the tag-binding but its `:impl` slot is empty
// (`undefined`) or carries a value that is neither a primitive
// Keyword nor a Quote-impl body. The payload the user supplied is
// stamped on the descriptor as `:payloadValue` / `:payloadType`
// (high-entropy first), the expected `:impl` shape is stamped
// as `:expectedType [:keyword :quote]`, and the actual `:impl`
// value lands as `:actualValue` / `:actualType` so the diagnostic
// reads as a single shape contract.
const TagBindingHasNoConstructorError = declareShapeError('TagBindingHasNoConstructorError',
  ({ tag, payloadType }) =>
    `::${tag} has no registered constructor — tag-binding's :impl is missing or wrong-shaped (cannot evaluate ::${tag}<${payloadType.name}> payload)`,
  { operand: '::tagged' });
// The combinator names its qlang kind — `distribute`, the same
// vocabulary `trailEntry` speaks — so the message and the catalog
// tag-binding's `:operand` read alike.
const DistributeSubjectNotSequenceError = declareSubjectError('DistributeSubjectNotSequenceError', 'distribute', ['vec', 'set', 'map']);
const ApplyToNonFunctionError      = declareShapeError('ApplyToNonFunctionError',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType.name}`,
  { operand: '::call', expectedType: 'function' }
);
// evalQuery(source, env?, callerState?) → Promise<final pipeValue>
//
// Convenience entry point: parse + evaluate. If env is omitted,
// uses langRuntime as the initial env; the initial pipeValue is
// `null` either way. A declaration of the query writes the record
// the axes read, so `:foo body | :foo | docs` answers its docs.
export async function evalQuery(source, env, callerState = null) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
  // Initial pipeValue is `null` — every pipeline brings its own
  // subject through an explicit head step (a literal, a captured
  // arg, the `env` identifier). The `env` identifier resolves
  // through env-lookup like any other name, so introspective
  // queries (`env | keys`, `env | /x`) read the env
  // Map without seeding pipeValue with it implicitly — keeping the
  // env out of `:fault.input` on every error descriptor.
  // `runExamples` evaluates each example Quote from inside a running
  // frame and hands that frame in as `callerState`, so an example that
  // runs its own binding's examples descends through the same depth
  // budget as any other re-entry. Every other caller opens a root.
  const initialState = callerState === null
    ? rootState(null, initialEnv)
    : nestState(callerState, null, initialEnv);
  const finalState = await evalBody(ast, initialState);
  return materializePendingTrail(finalState.pipeValue);
}

// evalAst(ast, state) → Promise<state'>
//
// Runs an AST as a body against a state the caller built, its head
// riding `|`, and returns the new state.
export async function evalAst(ast, state) {
  return await evalBody(ast, state);
}

// Lookup-table dispatcher: one entry per AST node type. Adding a
// new node type is one line here plus its evaluator function.
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
  LinePlainComment:  evalCommentStep,
  BlockPlainComment: evalCommentStep
};

async function evalNode(node, state) {
  const evaluator = AST_NODE_EVALUATORS[node.type];
  if (!evaluator) throw new UnknownAstNodeTypeError({ nodeType: node.type });

  try {
    return await evaluator(node, state);
  } catch (caughtError) {
    if (caughtError instanceof QlangError && !caughtError.location && node.location)
      caughtError.location = node.location;
    if (caughtError instanceof QlangInvariantError) throw caughtError;
    const faultStep = quoteOfBody(node);
    const faultInput = state.pipeValue;
    if (caughtError instanceof ParseError) {
      // A ParseError raised mid-eval — typically from `apply`
      // parsing a Quote source — lifts to a `::ParseError!{…}`
      // ErrorValue (same structured shape as a top-level parse
      // failure), with the originating step's faultStep / faultInput
      // stamped flat on the descriptor.
      const lifted = errorFromParse(caughtError);
      const enriched = new Map(lifted.descriptor);
      enriched.set('faultStep', faultStep);
      enriched.set('faultInput', faultInput);
      return withPipeValue(state, makeErrorValue(lifted.tag, enriched, {
        location: lifted.location,
        originalError: lifted.originalError
      }));
    }
    return withPipeValue(state,
      caughtError instanceof QlangError
        ? errorFromQlang(caughtError, faultStep, faultInput)
        : errorFromForeign(caughtError, node, faultStep, faultInput));
  }
}

// ─── Pipeline ───────────────────────────────────────────────────

// Plain comments are pipeline trivia: `evalPipeline` steps over
// them on both tracks, so a comment neither fires nor deflects and
// never lands on the trail — the materialized `:trail` Quote is a
// pure operand suffix that `apply` replays. The AST keeps every
// comment for the tools (the highlighter, the language server), and
// a quote keeps none; `evalCommentStep` stays wired for the
// direct-dispatch path of a lone comment query. The step-node reading
// itself lives in `walk.mjs::isPlainCommentStep` beside the rest of
// the AST-shape knowledge.

async function evalPipeline(node, state) {
  // Pipeline: { steps: [firstStep, { combinator, step }, ...] }
  //
  // The head rides `|` like every other step unless
  // `node.leadingCombinator` names another (`!|` / `*`), so
  // `~(| count)` and `~(count)` run alike, and a pipeline-suffix
  // shape (`~(* add 1)`, `~(!| /trail)`) replays through `apply`
  // with the combinator it was written with.
  //
  // A plain comment in head position hands the head to the first
  // operand step, exactly as with the comment absent: that step
  // applies through `node.leadingCombinator` when the pipeline
  // carries one, through its own combinator when the author wrote
  // one after the comment (`(|~ note ~| * add 1)` reads as
  // `(* add 1)`), and through `|` when its continuation unit
  // carries the grammar's absorbed marker (`combinator: null`).
  // Past the head, an absorbed follower rides the `|` the comment's
  // closer stands for.
  let current = state;
  let leadingCombinator = node.leadingCombinator;
  for (let i = 0; i < node.steps.length; i++) {
    const unit = node.steps[i];
    const stepNode = i === 0 ? unit : unit.step;
    if (isPlainCommentStep(stepNode)) continue;
    const combinator = leadingCombinator ?? (i === 0 ? null : unit.combinator) ?? '|';
    leadingCombinator = null;
    current = await applyCombinator(combinator, current, stepNode);
  }
  return current;
}

// Track dispatch lives here and only here. Each success-track
// combinator — `|`, `*` — deflects on an error pipeValue by
// stamping a `trailEntry` fragment — the upcoming step's source
// slice plus the combinator kind — onto the error's `_trailHead`
// and returning the error unchanged. The fail-track combinator `!|`
// does the dual: fires on errors via applyFailTrack, deflects on
// success values as identity pass-through. evalNode is a pure
// dispatcher over AST node types and performs no track dispatch
// of its own.
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

// applySuccessTrack(state, stepNode) — the `|` combinator. Fires
// `stepNode` when pipeValue is on the success-track; deflects on
// error by stamping `trailEntry(stepNode, 'pipe')` — the step plus
// its combinator kind — onto the trail linked list and returning the
// error unchanged. `!|` turns the fragments into the `:trail` quote
// that downstream consumers replay through `apply`.
async function applySuccessTrack(state, stepNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(stepNode, 'pipe')));
  }
  return await evalNode(stepNode, state);
}

// evalBody(node, state) → Promise<state'>
//
// Runs a body — a query, a group, a distribute body, a captured
// argument, a verb's body, an applied quote — so that its head
// rides `|` like every other step. A pipeline routes its own head; a
// lone step the parser collapsed rides `|` here, and a lone plain
// comment stays trivia.
function evalBody(node, state) {
  return node.type === 'Pipeline' || isPlainCommentStep(node)
    ? evalNode(node, state)
    : applySuccessTrack(state, node);
}

// The container beneath every tag stacked over a value, which distribute
// reaches as the walk hands a verb the value it serves [D34].
function containerBeneathTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

async function distribute(state, bodyNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(bodyNode, 'distribute')));
  }
  const subjectSeq = containerBeneathTags(state.pipeValue);
  if (!isVec(subjectSeq) && !isQMap(subjectSeq)) {
    const distributeErr = new DistributeSubjectNotSequenceError(state.pipeValue);
    distributeErr.location = bodyNode.location;
    return withPipeValue(state, errorFromQlang(distributeErr, quoteOfBody(bodyNode), state.pipeValue));
  }
  // The parentheses after `*` delimit its body the way a call's
  // parentheses delimit a captured argument, so the body's own head
  // takes the track: `[e 1] * (!| 0)` recovers the error element, and
  // `[e 1] * (count)` hands it on with its trail.
  const bodyPipeline = bodyNode.type === 'ParenGroup' ? bodyNode.pipeline : bodyNode;
  // A map's elements are its values, and the keys travel with them.
  if (isQMap(subjectSeq)) {
    const mapEntries = [...subjectSeq];
    const valueForks = await Promise.all(
      mapEntries.map(([, entryValue]) => forkWith(state, entryValue, inner => evalBody(bodyPipeline, inner)))
    );
    return withPipeValue(state, new Map(mapEntries.map(([entryKey], index) => [entryKey, valueForks[index].pipeValue])));
  }
  const forkResults = await Promise.all(
    subjectSeq.map(seqElement =>
      forkWith(state, seqElement, inner => evalBody(bodyPipeline, inner))
    )
  );
  const distributeResults = forkResults.map(forkedState => forkedState.pipeValue);
  // A set distributes into the set of its images [D16].
  return withPipeValue(state, isQSet(subjectSeq) ? makeSet(distributeResults) : distributeResults);
}

// applyFailTrack(state, stepNode) — `!|` combinator implementation.
//
// Fail-track application: fires `stepNode` only when `state.pipeValue`
// is an error value. On success values, it deflects as identity
// pass-through (state unchanged).
//
// On fire, the error wrapper is exposed to `stepNode` as its
// *materialized descriptor* — a fresh Map carrying every descriptor
// field plus `:trail` stamped from the combined Quote of
//   (1) the descriptor's existing `:trail` (a Quote or null by
//       makeErrorValue's invariant), plus
//   (2) the new deflected steps walked out of `_trailHead` linked list
//       (deflections that happened since the last materialization).
//
// The invariant that every error descriptor carries `:trail` as a
// Quote-value or null is enforced by `makeErrorValue` in types.mjs at
// mint time, which lets this hot-path read `:trail` without a
// defensive fallback.
//
// Trail continuity across re-lift: when an operand running under `!|`
// returns a Map and a later `| error` re-wraps it, the new error
// value's descriptor carries the `:trail` Quote the operand handed
// back. Subsequent deflections append to a fresh `_trailHead` linked
// list. The next `!|` combines both sources again — continuous
// accumulation. Dropping the accumulated suffix before re-lift stamps
// `:trail null` inside the fail-apply step (`!| union {:trail null}
// | error`); deflections past the re-lift grow a fresh suffix.
async function applyFailTrack(state, stepNode) {
  if (!isErrorValue(state.pipeValue)) return state;
  const errorVal = state.pipeValue;
  const existingTrail = errorVal.descriptor.get('trail');
  const newTrail = materializeTrail(errorVal);
  const combinedTrail = combineTrailQuotes(existingTrail, newTrail);
  // Materialize for fail-track exposure: descriptor data fields
  // ride flat on the Map, the error tag rides on the JS-header
  // `TAG_HEADER_SYMBOL` slot — `!| type` reads it directly, the
  // identity-overlay invariant stays uniform with the binding
  // record and the TaggedInstance. Identity intentionally does not
  // duplicate as a `:kind` Map field: any `:kind` slot the user
  // stamped on the source descriptor (e.g. `!{:kind :oops :…}`)
  // rides through verbatim as ordinary data, but the runtime
  // never mints a redundant `:kind <tag>` entry that would
  // shadow user content or print twice next to the literal
  // head.
  const materializedDescriptor = new Map();
  for (const [k, v] of errorVal.descriptor) {
    materializedDescriptor.set(k, v);
  }
  materializedDescriptor.set('trail', combinedTrail);
  stampTagHeader(materializedDescriptor, errorVal.tag);
  return await evalNode(stepNode, withPipeValue(state, materializedDescriptor));
}

// ─── Literal evaluators ─────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNullLit(_node, state)    { return withPipeValue(state, NULL); }
// keyword() forges a Keyword VALUE that lands as the next pipeValue.
// Map keys are plain strings; the Keyword value-class exists for
// type-level display distinction from String.
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }

async function evalVecLit(node, state) {
  // Each element is a sub-pipeline forked against the outer state.
  const elementForks = await Promise.all(
    node.elements.map(elem => fork(state, inner => evalNode(elem, inner)))
  );
  return withPipeValue(state, elementForks.map(forkedState => forkedState.pipeValue));
}

async function evalMapLit(node, state) {
  // Each value is a sub-pipeline forked against the outer state.
  // Keys are keyword AST nodes; we resolve them to interned keywords.
  const mapResult = new Map();
  for (const entry of node.entries) {
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    mapResult.set(entry.key.name, entryFork.pipeValue);
  }
  return withPipeValue(state, mapResult);
}

async function evalErrorLit(node, state) {
  // `:kind ::TagName` entry in the literal lifts to the error's
  // JS-header `tag` slot — the universal identity invariant for
  // every tagged value-class. Literals without `:kind` are of the
  // kind of errors, `::error` [D64], so `error.tag` is always
  // present without defensive checks at consumer sites. A non-
  // TagKeyword `:kind` value (`!{:kind :foo}`, `!{:kind "x"}`)
  // stays in the descriptor — the user explicitly chose to ride
  // identity through a non-tag value, the kind of errors
  // covers the surface identity.
  const errorDescriptor = new Map();
  let tag = ERROR_TAG;
  for (const entry of node.entries) {
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    const entryValue = entryFork.pipeValue;
    if (entry.key.name === 'kind' && isTagKeyword(entryValue)) {
      tag = entryValue;
      continue;
    }
    errorDescriptor.set(entry.key.name, entryValue);
  }
  return withPipeValue(state, makeErrorValue(tag, errorDescriptor, { location: node.location }));
}

function evalQuoteLit(node, state) {
  return withPipeValue(state, quoteOfLiteral(node));
}

function evalDocLit(node, state) {
  return withPipeValue(state, makeDoc(node.content));
}

// The elements run in the order they are written, and the set holds
// them in the one order [D16].
async function evalSetLit(node, state) {
  const setElements = [];
  for (const setElem of node.elements) {
    const elemFork = await fork(state, inner => evalNode(setElem, inner));
    setElements.push(elemFork.pipeValue);
  }
  return withPipeValue(state, makeSet(setElements));
}

// ─── TaggedLit / BareTypeKeyword ────────────────────────────────

// ::tag<payload> — tag-namespace constructor invocation. Eval the
// payload sub-expression in a fork (inheriting outer pipeValue),
// look up the tag binding under `::tag`, resolve its constructor,
// invoke against the payload-value. The result becomes the new
// pipeValue.
// mintTaggedInstance(tagName, payload, state) → tagged value
//
// Single mint site for any `::Tag<payload>` invocation: reads the
// tag binding from env, then dispatches by `:impl` slot (keyword
// handle → PRIMITIVE_REGISTRY, Quote → eval body + auto-wrap,
// identity-only → wrap the payload under the tag). Pure over env —
// the implicit-declaration env write lives in `ensureTagBinding`
// (called by `evalTaggedLit`) so a fork discards it with the rest of
// its inner env. Every caller routes through `ensureTagBinding` (or,
// for shape-preserving transforms, an already-`:impl`-bearing tag),
// so the binding is present by the time mint reads it. Called by
// `evalTaggedLit` for the literal-syntax path and by shape-preserving
// transforms (`filter` / `sort` / `distinct` / …) re-validating the
// post-transform payload through the same constructor — the
// «invariant re-run on transforms» contract for tags carrying `:impl`.
export async function mintTaggedInstance(tagName, payload, state, location = null) {
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
  // Identity-only binding (no `:impl`) — wrap the payload under the
  // tag. An ErrorValue payload keeps its descriptor so `::Foo(err)`
  // stays an error value under ::Foo; every other payload wraps
  // through `makeTaggedInstance`.
  if (implKey === undefined) {
    if (isErrorValue(payload)) {
      return makeErrorValue(makeTagKeyword(tagName), payload.descriptor, {
        location, originalError: payload.originalError
      });
    }
    return makeTaggedInstance(makeTagKeyword(tagName), payload);
  }
  throw new TagBindingHasNoConstructorError({
    tag: tagName,
    payloadValue: payload,
    payloadType: typeKeyword(payload),
    expectedType: Object.freeze([keyword('keyword'), keyword('quote')]),
  });
}

// ensureTagBinding(state, tagName) → state
//
// First use of `::Tag<payload>` auto-declares an identity-only tag
// binding. The write goes through `envSet` like every other binding,
// so it persists to later pipeline steps and is discarded with the
// inner env when the `::Tag<payload>` sits inside a fork (ParenGroup
// / Vec element / Map value). A tag already in env (catalog
// constructor, prior declaration, earlier auto-decl) passes through
// untouched.
function ensureTagBinding(state, tagName) {
  const typeKey = tagBindingKey(tagName);
  if (envHas(state.env, typeKey)) return state;
  const implicitBinding = new Map([['declarationOrigin', keyword('implicit')]]);
  const implicitRecord = makeBinding({ name: makeTagKeyword(tagName), value: implicitBinding });
  return withEnv(state, envSet(state.env, typeKey, implicitRecord));
}

async function evalTaggedLit(node, state) {
  // Declare the tag before evaluating the payload so a self-referential
  // payload (`::Tag(::Tag | spec)`) resolves the binding the literal is
  // introducing — the same lexical visibility a declared verb's body
  // has over its own name. A kind of the core written long,
  // `::qlang/vec[1 2]`, is the kind written short [D32].
  const tagName = canonicalTagName(node.tag);
  const declaredState = ensureTagBinding(state, tagName);
  const payloadFork = await fork(declaredState, inner => evalNode(node.payload, inner));
  const minted = await mintTaggedInstance(tagName, payloadFork.pipeValue, declaredState, node.location);
  return withPipeValue(declaredState, minted);
}


// ::tag — bare reference to a tag-namespace identifier. The
// reference value is the TagKeyword itself (identity-as-value) —
// symmetric to the value-namespace `:foo` keyword literal, which
// produces `keyword('foo')` without consulting env. Use-sites
// dispatch on env presence:
//
//   `::TypoTag[payload]`   → auto-declares an identity-only
//                            binding with `:declarationOrigin
//                            :implicit` (evalTaggedLit), mints
//                            a tagged instance; a lint reads the
//                            auto-decl off `::TypoTag | spec`.
//   `::TypoTag | source`   → SourceBindingNotFoundError
//   `::TypoTag | docs`     → DocsBindingNotFoundError
//   `::TypoTag | examples` → ExamplesBindingNotFoundError
//
// A catalog entry names no tag it raises: `:throws` is read back
// off the sites that record the binding as their `:operand`, so a
// tag reaches a Vec only when a class carries that name.
async function evalBareTypeKeyword(node, state) {
  return withPipeValue(state, makeTagKeyword(node.tag));
}

// ─── BindStep ───────────────────────────────────────────────────

// BindStep — the one binding form [D44]. Transparent for pipeValue
// (env-write only): it writes into the scope the record of the binding
// [D63], whose value is the body evaluated once, at declaration,
// against the current value, so `42 | :x / | add 1 | x` answers 42.
// A doc alone binds a Doc value, and under a tag name an empty tag
// binding. A verb written as the body resolves in the scope the
// declaration writes, so its body sees its own name [D67].
async function evalBindStep(node, state) {
  const name = node.key.type === 'BareTypeKeyword'
    ? tagBindingKey(node.key.tag)
    : node.key.name;
  const docs = node.docs ?? [];

  if (node.body === null) {
    // Tag-namespace doc-only BindStep (`::Tag |~~ docs ~~|`) forges
    // an empty tag-binding Map automatically — equivalent to
    // `::Tag ::builtin{}` body-form. The `::` prefix carries the
    // declaration semantic; the auto-forged Map stamps the
    // canonical `::builtin` identity on its JS-header slot, matching
    // every body-form declaration the catalog uses elsewhere.
    // Value-namespace doc-only BindStep (`:name |~~ docs ~~|`) binds
    // the joined prose as a Doc value.
    if (node.key.type === 'BareTypeKeyword') {
      const tagBinding = new Map();
      stampTagHeader(tagBinding, BUILTIN_TAG);
      return withEnv(state, envSet(state.env, name, declarationRecord(node, tagBinding)));
    }
    return withEnv(state, envSet(state.env, name, declarationRecord(node, makeDoc(docs.join('\n')))));
  }

  const value = (await evalNode(node.body, state)).pipeValue;
  if (isVerb(value)) refuseVerbLaunderedByName(name, value, node);
  const nextEnv = envSet(state.env, name, declarationRecord(node, value));
  // A tag literal that answers a verb is the verb literal, whose verb
  // this declaration made.
  if (isVerb(value) && node.body.type === 'TaggedLit') verbEnvRef(value).env = nextEnv;
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

// The record a declaration writes: its name, a keyword or a tag, the
// docs of its prefixes, the value, the quote of its step and the
// module its source came from [D63].
function declarationRecord(node, value) {
  return makeBinding({
    name: node.key.type === 'BareTypeKeyword' ? makeTagKeyword(node.key.tag) : keyword(node.key.name),
    docs: node.docs ?? [],
    value,
    source: quoteOfBody(node),
    module: keyword(moduleUriOf(node))
  });
}

// ─── Projection ─────────────────────────────────────────────────

// Projection walks a path of key segments, dispatching per-segment
// on the current subject's kind — Map does keyword-lookup, Vec does
// integer-index access with `Array.prototype.at`-style negative
// support, value-classes (Doc) expose a fixed projectable
// field-set. Every miss / mismatch lifts a fail-first error whose
// descriptor carries the failed segment under `:key` plus the
// `:fault` step/input that triggered the miss. The soft counterpart
// for "optionally read a field" is the `at` operand (Map miss →
// `null`); explicit fail-track handling stays available via the
// `!|` combinator.
const INTEGER_SEGMENT_RE = /^-?\d+$/;

async function evalProjection(node, state) {
  let projectionCurrent = state.pipeValue;
  for (const projKey of node.keys) {
    projectionCurrent = await projectSegment(projectionCurrent, projKey, state);
  }
  return withPipeValue(state, projectionCurrent);
}

// Registry of JS-layer value-classes that publish projectable surface.
// Each entry maps a VALUE_CLASS_TAG brand to a per-segment projector
// table. Doc publishes its fields here; the brand rides the Symbol, so
// a map carrying a `"type"` data key falls through to the map branch
// below instead of being read as a value-class. Only
// the named fields listed here are reachable through `/key`. A quote
// is a vector of steps and projects by index.
const PROJECTABLE_BY_TYPE = {
  doc: {
    content:  d => d.content,
    segments: (d, state) => parseDocSegments(d.content, state)
  }
};

function projectSegment(subject, projKey, state) {
  if (typeof subject === 'object' && subject !== null) {
    const valueClass = subject[VALUE_CLASS_TAG];
    const handlers = PROJECTABLE_BY_TYPE[valueClass];
    if (handlers) {
      if (!Object.hasOwn(handlers, projKey)) {
        throw new ProjectionFieldNotOnValueClassError({
          key: projKey,
          valueClass,
          availableFields: Object.keys(handlers)
        });
      }
      return handlers[projKey](subject, state);
    }
  }
  if (isQMap(subject)) {
    if (!subject.has(projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, actualValue: subject });
    return subject.get(projKey);
  }
  if (isVec(subject)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) {
      throw new ProjectionSequenceKeyNotIntegerError({ key: projKey, actualValue: subject });
    }
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? subject.length + segmentIndex : segmentIndex;
    if (resolvedIndex < 0 || resolvedIndex >= subject.length) {
      throw new ProjectionIndexOutOfBoundsError({ key: projKey, index: segmentIndex, length: subject.length, actualValue: subject });
    }
    return subject[resolvedIndex];
  }
  throw new ProjectionSubjectNotProjectableError({
    key: projKey,
    actualType: typeKeyword(subject),
    actualValue: subject
  });
}

// ─── Identifier lookup ─────────────────────────────────────────

// Binding-descriptor identity rides on the Map's JS-header
// `TAG_HEADER_SYMBOL` slot — a TagKeyword stamped by the
// `::builtin{…}` and binding-record factories, never a `:kind` Map
// field (which stays free for the value's own data). A `::builtin`
// descriptor's `:impl` slot carries the namespaced primitive key that
// PRIMITIVE_REGISTRY.resolve walks into the matching JS function
// value.

function isBuiltinDescriptor(descriptor) {
  return descriptor[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

async function evalOperandCall(node, state) {
  if (node.address !== undefined) return await callByAddress(node, state);
  const lookupName = node.name;
  const lookupEnv = state.env;

  if (!envHas(lookupEnv, lookupName)) {
    throw new UnresolvedIdentifierError({ identifierName: lookupName, nearest: nearestNames(lookupEnv, lookupName) });
  }

  // A name reads the value its record holds [D63], so `:x / | x` sees
  // the raw data: a verb runs [D67], a `::builtin` descriptor applies
  // its host code, a function value a host bound applies through
  // Rule 10, and any other value is itself.
  const resolved = bindingValueOf(envGet(lookupEnv, lookupName));
  if (isVerb(resolved)) {
    return await applyVerb(resolved, node.args.map(argNode => makeLambda(argNode, state)), state, lookupName);
  }
  if (isQMap(resolved) && isBuiltinDescriptor(resolved)) return await applyBuiltinDescriptor(resolved, node, state);

  const capturedArgsAst = node.args;

  if (isFunctionValue(resolved)) {
    // Effect-laundering safety net: a function value a host bound under
    // a name, through `session.bind` or `use`, is refused under a name
    // without the effect marker when it is effectful, since every
    // effectful invocation flows through an identifier lookup here.
    if (resolved.effectful && !classifyEffect(lookupName)) {
      throw new EffectLaunderingAtCallError({
        bindingName: lookupName,
        effectfulName: resolved.name
      });
    }
    // Build lambdas for each captured arg. Each lambda evaluates
    // the captured AST node against the input it is invoked with,
    // sharing the env of the original capture site. Lambdas run
    // their sub-pipeline one frame below the capture site, in a
    // fresh state whose pipeValue is the per-invocation input; env
    // writes inside the lambda are local to that call and do not
    // escape.
    const operandLambdas = capturedArgsAst.map(argNode => makeLambda(argNode, state));
    return await applyRule10(resolved, operandLambdas, state);
  }

  // A value takes no modifiers; its refusal names where a verb of the
  // name lives, one a declaration shadows among them [D62].
  if (capturedArgsAst.length > 0) {
    throw new ApplyToNonFunctionError({
      name: lookupName,
      actualType: typeKeyword(resolved),
      actualValue: resolved,
      addresses: addressesOf(lookupEnv, lookupName)
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
  return await applyBuiltinDescriptor(address.descriptor, node, state);
}

// applyBuiltinDescriptor(descriptor, node, state) → state'
//
// Dispatch core for built-in operands. Reads the callable through
// `resolveBuiltinImpl` — the `BUILTIN_IMPL_SLOT` stamp the bootstrap
// resolution pass in runtime/index.mjs left, or the descriptor's
// `:impl` handle keyword walked through the registry when a query
// assembled the descriptor from data — and delegates
// to applyRule10. Bare lookup fires the operand against the current
// pipeValue regardless of arity — non-nullary operands without
// captured args hit Rule 10's arity check and surface a per-site
// arityError. The introspection surface for "what does this operand
// do" is the axes on its address, `::vec/count | source` / `| docs` /
// `| examples`, not a bare-name shortcut into the descriptor Map.
// The call's docs and its step ride the lambdas array for `as`,
// whose record holds them.
async function applyBuiltinDescriptor(descriptor, node, state) {
  const resolvedImpl = resolveBuiltinImpl(descriptor);

  const builtinLambdas = node.args.map(argNode => makeLambda(argNode, state));
  builtinLambdas.docs = node.docs ?? [];
  builtinLambdas.step = node;
  const { served, passedTags } = subjectServedBy(descriptor, state.pipeValue);
  if (passedTags.length === 0) return await applyRule10(resolvedImpl, builtinLambdas, state);
  const servedState = await applyRule10(resolvedImpl, builtinLambdas, withPipeValue(state, served));
  return withPipeValue(servedState, await underPassedTags(servedState, resolvedImpl, passedTags, servedState.pipeValue));
}

// makeLambda(astNode, capturedState) → (input) → value
//
// Constructs a closure that evaluates `astNode` as a sub-pipeline
// against any given input, one frame below the state captured at
// construction time and in that state's env. Operand impls call
// lambdas to resolve captured args at the moment they need them.
//
// The `.astNode` property exposes the raw AST, and `.capturedState`
// the capture-site state, so `reduce` finds the operand or the verb a
// quote of one name holds [D56] and folds with it from the frame the
// lambda itself would run in.
//
// A quote written as the modifier carries the environment of the call
// [D43].
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

// codeOfModifier(modifierLambda, subject, refusalOf) → lambda
//
// The code a slot of kind code receives [D43]: its modifier, evaluated
// at the call against the subject, is a quote, and the lambda applies it
// to each input the operand hands it, in the environment the quote
// carries or, for a quote held as data, that of the call; a verb runs
// with its defaults [D67]. Any other value is refused with
// `refusalOf(value)`, the site's error, an error value as every value
// slot refuses one today [D13].
export async function codeOfModifier(modifierLambda, subject, refusalOf) {
  const code = await modifierLambda(subject);
  const callState = modifierLambda.capturedState;
  if (isVerb(code)) return verbAsCode(code, callState);
  if (!isQuote(code)) throw refusalOf(code);
  return makeLambda(astOfQuote(code), withEnv(callState, envToRun(code, callState.env)));
}

// resolveBinaryReducer(reducerLambda) → ((acc, item) → Promise<value>) | null
//
// Resolves the code of a reducer slot into the per-step combiner
// `reduce` folds with. The reducer is applied as `reducer(acc, element)`:
//   - a binary operand (`add` / `mul` / `union` / …) folds via its
//     bound form — accumulator as subject, element as the single
//     captured arg (`acc | add element`), through Rule 10;
//   - a verb, the code itself or one its quote names, folds the same
//     way, the element filling its first slot [D67].
// Returns null when the captured arg is not such a reference (an inline
// expression, a literal, or an unbound name), so `reduce` lifts its
// own per-site error.
export function resolveBinaryReducer(reducerLambda) {
  const callerState = reducerLambda.capturedState;
  if (reducerLambda.verb !== undefined) return verbFold(reducerLambda.verb, callerState, null);
  const astNode = reducerLambda.astNode;
  if (astNode.type !== 'OperandCall' || astNode.args.length !== 0) return null;
  const lookupName = astNode.name;
  if (!envHas(callerState.env, lookupName)) return null;
  const resolved = bindingValueOf(envGet(callerState.env, lookupName));
  if (isVerb(resolved)) return verbFold(resolved, callerState, keyword(lookupName));
  if (isQMap(resolved) && isBuiltinDescriptor(resolved)) {
    const reducerImpl = resolveBuiltinImpl(resolved);
    return async (acc, item) => {
      const reducerLambdas = [() => item];
      reducerLambdas.step = astNode;
      return (await applyRule10(reducerImpl, reducerLambdas, withPipeValue(callerState, acc))).pipeValue;
    };
  }
  return null;
}

function verbFold(verb, callerState, verbName) {
  return (acc, item) => callVerb(verb, [async () => item], withPipeValue(callerState, acc), verbName);
}

// ─── Comment (plain forms only — doc forms attach during
// parsing and never appear as standalone steps) ───────────────

function evalCommentStep(_node, state) {
  // Identity: state passes through unchanged. The comment node is
  // visible in the AST for reflection/source manipulation but has
  // no runtime effect.
  return state;
}

// ─── ParenGroup ─────────────────────────────────────────────────

async function evalParenGroup(node, state) {
  return await fork(state, inner => evalBody(node.pipeline, inner));
}
