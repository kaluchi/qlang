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
  makeState, withPipeValue, envSet, envGet, envHas
} from './state.mjs';
import { fork, forkWith } from './fork.mjs';
import { applyRule10, makeFn } from './rule10.mjs';
import {
  QlangError,
  QlangInvariantError,
  UnresolvedIdentifierError,
  EffectLaunderingAtCallError,
  EffectLaunderingAtBindStepParseError
} from './errors.mjs';
import { findFirstEffectfulIdentifier } from './effect-check.mjs';
import { classifyEffect } from './effect.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from './operand-errors.mjs';
import {
  isVec, isQMap, isQSet, isKeyword, isConduit, isSnapshot, isFunctionValue, isErrorValue,
  typeKeyword, keyword, NULL, makeErrorValue, appendTrailNode,
  materializeTrail, makeQuote, makeDoc, makeJsonObject, makeJsonArray,
  isJsonObject, isJsonArray, isOrderedSequence, sequenceElements, isQuote,
  isJsonStoreable, makeConduit, makeSnapshot, makeTaggedInstance, makeTagKeyword, isTagKeyword,
  isTaggedInstance,
  ERROR_TAG, BUILTIN_TAG, TAG_HEADER_SYMBOL, stampTagHeader, VALUE_CLASS_TAG
} from './types.mjs';
import { moduleAstKey, tagBindingKey } from './env-keys.mjs';
import { isPureLiteralAst } from './walk.mjs';
import { astNodeToMap } from './ast-codec.mjs';
import { addStructurallyUnique } from './equality.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import { parseDocSegments } from './doc-segments.mjs';
import {
  trailEntry, combineTrailQuotes, materializePendingTrail
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

class UnknownAstNodeTypeError extends QlangInvariantError {
  constructor(nodeType) {
    super(`unknown AST node type: ${nodeType}`, { nodeType });
    this.name = 'UnknownAstNodeTypeError';
    this.fingerprint = 'UnknownAstNodeTypeError';
  }
}

class UnknownCombinatorKindError extends QlangInvariantError {
  constructor(kind) {
    super(`unknown combinator: ${kind}`, { kind });
    this.name = 'UnknownCombinatorKindError';
    this.fingerprint = 'UnknownCombinatorKindError';
  }
}

const ProjectionSubjectNotProjectableError = declareShapeError('ProjectionSubjectNotProjectableError',
  ({ key, actualType }) => `/${key} requires Map, Vec, or Set subject, got ${actualType.name}`);
// Map subject does not carry the requested key. Strict fail-first
// surfaces the typo / mismatched-shape on the projection itself; the
// lifted descriptor carries `:key` plus the `:fault` step/input so
// downstream `!| /key` reads the failed segment directly. null
// subject still deflects as null (see projectSegment).
const ProjectionKeyNotInMapError = declareShapeError('ProjectionKeyNotInMapError',
  ({ key }) => `/${key} — key not present in Map subject`);
// Vec or Set subject indexed past its bounds. Negative indices walk
// from the tail (`/-1` is last); only positions that resolve outside
// `[0, length)` trip this site. Set length is insertion-order
// cardinality per §Set in qlang-spec.md.
const ProjectionIndexOutOfBoundsError = declareShapeError('ProjectionIndexOutOfBoundsError',
  ({ key, length }) => `/${key} — index out of bounds for sequence of length ${length}`);
// Vec or Set subject projected by a non-numeric segment. Sequence
// indices are integer offsets; named keys belong to Map shape, so
// a `[…] | /name` query surfaces as a shape mismatch on the
// projection itself.
const ProjectionSequenceKeyNotIntegerError = declareShapeError('ProjectionSequenceKeyNotIntegerError',
  ({ key }) => `/${key} — non-integer segment cannot index a Vec or Set subject`);
// Value-class subjects (Quote / Doc / …) publish a fixed set of
// projectable fields through PROJECTABLE_BY_TYPE. A segment outside
// that set is treated as a typo and lifts to this error.
const ProjectionFieldNotOnValueClassError = declareShapeError('ProjectionFieldNotOnValueClassError',
  ({ key, valueClass, availableFields }) =>
    `/${key} — not a projectable field on ${valueClass}; available: ${availableFields.join(', ')}`);
const TaggedLitNotTagBindingError = declareShapeError('TaggedLitNotTagBindingError',
  ({ tag, actualType }) => `::${tag} — tag binding is ${actualType.name}, expected a Map descriptor`);
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
    `::${tag} has no registered constructor — tag-binding's :impl is missing or wrong-shaped (cannot evaluate ::${tag}<${payloadType.name}> payload)`);
const DistributeSubjectNotSequenceError = declareSubjectError('DistributeSubjectNotSequenceError', '*',  ['vec', 'set']);
const MergeSubjectNotSequenceError      = declareSubjectError('MergeSubjectNotSequenceError',      '>>', ['vec', 'set']);
const ApplyToNonFunctionError      = declareShapeError('ApplyToNonFunctionError',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType.name}`);
const ConduitArityMismatchError    = declareArityError('ConduitArityMismatchError',
  ({ conduitName, expectedArity, actualArity }) =>
    `conduit '${conduitName}' expects ${expectedArity} captured arguments, got ${actualArity}`);
const ConduitParameterNoCapturedArgsError = declareArityError('ConduitParameterNoCapturedArgsError',
  ({ paramName, actualCount }) =>
    `conduit parameter '${paramName}' takes no captured arguments, got ${actualCount}`);

// evalQuery(source, env?) → Promise<final pipeValue>
//
// Convenience entry point: parse + evaluate. If env is omitted,
// uses langRuntime as both initial env and pipeValue (per the
// model's reference bootstrap). The parsed AST is stamped into
// the env under `moduleAstKey('inline')` as a Quote so axis-
// operands (`source`, `docs`, `examples`) can resolve `BindStep`
// bindings declared inside the same query. With the inline-AST
// Quote stamped on env, `:foo body | :foo | docs` finds `foo`
// in the just-parsed AST without going through a `use(:ns)`
// module installation.
export async function evalQuery(source, env) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
  const envWithInlineAst = envSet(initialEnv, moduleAstKey('inline'), makeQuote(source, ast));
  // Initial pipeValue is `null` — every pipeline brings its own
  // subject through an explicit head step (a literal, a captured
  // arg, the `env` identifier). The `env` identifier resolves
  // through env-lookup like any other name, so introspective
  // queries (`env | keys`, `env | manifest | …`) read the env
  // Map without seeding pipeValue with it implicitly — keeping the
  // env out of `:fault.input` on every error descriptor.
  const initialState = makeState(null, envWithInlineAst);
  const finalState = await evalNode(ast, initialState);
  return materializePendingTrail(finalState.pipeValue);
}

// evalAst(ast, state) → Promise<state'>
//
// Dispatches on the AST node type and returns the new state.
// Public so callers can drive their own initial state.
export async function evalAst(ast, state) {
  return await evalNode(ast, state);
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
  JsonArrayLit:      evalJsonArrayLit,
  MapLit:            evalMapLit,
  JsonObjectLit:     evalJsonObjectLit,
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
  if (!evaluator) throw new UnknownAstNodeTypeError(node.type);

  try {
    return await evaluator(node, state);
  } catch (caughtError) {
    if (caughtError instanceof QlangError && !caughtError.location && node.location)
      caughtError.location = node.location;
    if (caughtError instanceof QlangInvariantError) throw caughtError;
    const faultStep = makeQuote(node.text);
    const faultInput = state.pipeValue;
    if (caughtError instanceof ParseError) {
      // A ParseError raised mid-eval — typically from `apply` / `eval`
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

async function evalPipeline(node, state) {
  // Pipeline: { steps: [firstStep, { combinator, step }, ...] }
  //
  // `node.leadingCombinator`, if present, names the combinator the
  // first step applies through against the inbound pipeValue
  // (`!|` / `|` / `*` / `>>`). Without it, the first step runs as
  // an identity-head — straight evalNode against state, no track
  // dispatch. Pipeline-suffix shapes (`~{| count | add(1)}`) round-
  // trip through `apply` exactly because the leading combinator
  // survives parse → eval.
  let current = state;
  for (let i = 0; i < node.steps.length; i++) {
    const step = node.steps[i];
    if (i === 0) {
      current = node.leadingCombinator
        ? await applyCombinator(node.leadingCombinator, current, step)
        : await evalNode(step, current);
    } else {
      current = await applyCombinator(step.combinator, current, step.step);
    }
  }
  return current;
}

// Track dispatch lives here and only here. Each success-track
// combinator — `|`, `*`, `>>` — deflects on an error pipeValue by
// appending the upcoming step's AST node to the error's trail and
// returning the error unchanged. The fail-track combinator `!|`
// does the dual: fires on errors via applyFailTrack, deflects on
// success values as identity pass-through. evalNode is a pure
// dispatcher over AST node types and performs no track dispatch
// of its own.
const COMBINATOR_EVALUATORS = {
  '|':  applySuccessTrack,
  '!|': applyFailTrack,
  '*':  distribute,
  '>>': mergeFlat
};

async function applyCombinator(kind, state, stepNode) {
  const evaluator = COMBINATOR_EVALUATORS[kind];
  if (!evaluator) {
    throw new UnknownCombinatorKindError(kind);
  }
  return await evaluator(state, stepNode);
}

// applySuccessTrack(state, stepNode) — the `|` combinator. Fires
// `stepNode` when pipeValue is on the success-track; deflects on
// error by appending a Map-form of `stepNode` to the trail linked
// list and returning the error unchanged. The Map form is produced
// by walk.mjs::astNodeToMap and carries the deflected step as a
// structurally-addressable qlang value (:name / :args / :location /
// :text) that downstream `!|` consumers can filter, project, or
// re-eval as ordinary data.
async function applySuccessTrack(state, stepNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(stepNode, 'pipe')));
  }
  return await evalNode(stepNode, state);
}

async function distribute(state, bodyNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(bodyNode, 'distribute')));
  }
  if (!isOrderedSequence(state.pipeValue)) {
    const distributeErr = new DistributeSubjectNotSequenceError(state.pipeValue);
    distributeErr.location = bodyNode.location;
    return withPipeValue(state, errorFromQlang(distributeErr, makeQuote(bodyNode.text), state.pipeValue));
  }
  const subjectSeq = state.pipeValue;
  const forkResults = await Promise.all(
    sequenceElements(subjectSeq).map(seqElement =>
      forkWith(state, seqElement, inner => evalNode(bodyNode, inner))
    )
  );
  const distributeResults = forkResults.map(forkedState => forkedState.pipeValue);
  return withPipeValue(state, retagPerElement(distributeResults, subjectSeq));
}

async function mergeFlat(state, nextNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(nextNode, 'merge')));
  }
  if (!isOrderedSequence(state.pipeValue)) {
    const mergeErr = new MergeSubjectNotSequenceError(state.pipeValue);
    mergeErr.location = nextNode.location;
    return withPipeValue(state, errorFromQlang(mergeErr, makeQuote(nextNode.text), state.pipeValue));
  }
  const sourceSeq = state.pipeValue;
  const flattened = [];
  for (const flatItem of sourceSeq) {
    if (isOrderedSequence(flatItem)) flattened.push(...flatItem);
    else flattened.push(flatItem);
  }
  return await evalNode(nextNode, withPipeValue(state, retagPerElement(flattened, sourceSeq)));
}

// Per-element transformer tagger: if the source was a JsonArray, the
// output keeps the JSON tag only when every element is JSON-storeable.
// A single qlang-only element (Map/Set/Vec/Conduit/Keyword/…) silently
// degrades the container to a qlang Vec — `| json` downstream then
// loud-fails on the qlang shape, surfacing the un-serialisable
// element at the conversion site.
function retagPerElement(items, source) {
  if (!isJsonArray(source)) return items;
  return items.every(isJsonStoreable) ? makeJsonArray(items) : items;
}

// applyFailTrack(state, stepNode) — `!|` combinator implementation.
//
// Fail-track application: fires `stepNode` only when `state.pipeValue`
// is an error value. On success values, it deflects as identity
// pass-through (state unchanged).
//
// On fire, the error wrapper is exposed to `stepNode` as its
// *materialized descriptor* — a fresh Map built by taking the
// descriptor and replacing `:trail` with the combined Vec of
//   (1) the descriptor's existing `:trail` (always present by
//       makeErrorValue's invariant), plus
//   (2) the new deflected steps walked out of `_trailHead` linked list
//       (deflections that happened since the last materialization).
//
// The invariant that every error descriptor carries `:trail` as a Vec
// is enforced by `makeErrorValue` in types.mjs at construction time,
// which lets this hot-path read `:trail` without a defensive fallback.
//
// Trail continuity across re-lift: when an operand running under `!|`
// returns a Map and a later `| error` re-wraps it, the new error
// value's descriptor carries the `:trail` Vec the operand handed back.
// Subsequent deflections append to a fresh `_trailHead` linked list.
// The next `!|` combines both sources again — continuous accumulation.
// Explicit truncation is available via `union({:trail []})` inside a
// fail-apply step, which overwrites the `:trail` field before re-lift.
async function applyFailTrack(state, stepNode) {
  if (!isErrorValue(state.pipeValue)) return state;
  const errorVal = state.pipeValue;
  const existingTrail = errorVal.descriptor.get('trail');
  const newTrail = materializeTrail(errorVal);
  const combinedTrail = combineTrailQuotes(existingTrail, newTrail);
  // Materialize for fail-track exposure: descriptor data fields
  // ride flat on the Map, the error tag rides on the JS-header
  // `TAG_HEADER_SYMBOL` slot — `!| type` reads it directly, the
  // identity-overlay invariant stays uniform with Conduit /
  // Snapshot / TaggedInstance. Identity intentionally does not
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

// JSON Object literal — string-keyed entries. Each value forks
// against the outer state so projection sub-pipelines see the
// surrounding pipeValue, identical to evalMapLit's contract.
async function evalJsonObjectLit(node, state) {
  const plain = {};
  for (const entry of node.entries) {
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    plain[entry.key.name] = entryFork.pipeValue;
  }
  return withPipeValue(state, makeJsonObject(plain));
}

// JSON Array literal — comma-separated elements. Per-element fork
// matches evalVecLit; the difference is the runtime tag.
async function evalJsonArrayLit(node, state) {
  const elementForks = await Promise.all(
    node.elements.map(elem => fork(state, inner => evalNode(elem, inner)))
  );
  return withPipeValue(state, makeJsonArray(elementForks.map(s => s.pipeValue)));
}

async function evalErrorLit(node, state) {
  // `:kind ::TagName` entry in the literal lifts to the error's
  // JS-header `tag` slot — the universal identity invariant for
  // every tagged value-class. Literals without `:kind` default
  // to `::Error` generic identity so `error.tag` is always
  // present without defensive checks at consumer sites. A non-
  // TagKeyword `:kind` value (`!{:kind :foo}`, `!{:kind "x"}`)
  // stays in the descriptor — the user explicitly chose to ride
  // identity through a non-tag value, the default `::Error`
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
  return withPipeValue(state, makeQuote(node.src));
}

function evalDocLit(node, state) {
  return withPipeValue(state, makeDoc(node.content));
}

async function evalSetLit(node, state) {
  const setResult = new Set();
  for (const setElem of node.elements) {
    const elemFork = await fork(state, inner => evalNode(setElem, inner));
    addStructurallyUnique(setResult, elemFork.pipeValue);
  }
  return withPipeValue(state, setResult);
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
  let typeBinding = envGet(state.env, typeKey);
  if (isSnapshot(typeBinding)) typeBinding = typeBinding.get('payload');
  if (!isQMap(typeBinding)) {
    throw new TaggedLitNotTagBindingError({ tag: tagName, actualType: typeKeyword(typeBinding), actualValue: typeBinding });
  }
  const implKey = typeBinding.get('impl');
  if (isKeyword(implKey)) {
    const constructor = PRIMITIVE_REGISTRY.resolve(implKey.name);
    return await constructor(payload, state);
  }
  if (isQuote(implKey)) {
    const bodyAst = implKey.ast ?? parse(implKey.source, { uri: `::${tagName}/impl` });
    const bodyState = makeState(payload, state.env);
    const resultState = await evalNode(bodyAst, bodyState);
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
  return makeState(state.pipeValue, envSet(state.env, typeKey, implicitBinding));
}

async function evalTaggedLit(node, state) {
  // Declare the tag before evaluating the payload so a self-referential
  // payload (`::Tag(::Tag | spec)`) resolves the binding the literal is
  // introducing — the same lexical visibility a named conduit's body
  // has over its own self-name.
  const declaredState = ensureTagBinding(state, node.tag);
  const payloadFork = await fork(declaredState, inner => evalNode(node.payload, inner));
  const minted = await mintTaggedInstance(node.tag, payloadFork.pipeValue, declaredState, node.location);
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
//                            a tagged instance; lint sweeps over
//                            `manifest(:tag)` flag the auto-decl.
//   `::TypoTag | source`   → AxisBindingNotFoundError (axis-op)
//   `::TypoTag | docs`     → AxisBindingNotFoundError (axis-op)
//   `::TypoTag | examples` → AxisBindingNotFoundError (axis-op)
//
// Catalog `:throws [::Foo ::Bar]` Vec
// constructions evaluate cleanly regardless of declaration order;
// `langRuntime`'s post-bootstrap `:throws` walker resolves
// every TagKeyword against the loaded tag-bindings at construction
// time so a structural typo still surfaces.
async function evalBareTypeKeyword(node, state) {
  return withPipeValue(state, makeTagKeyword(node.tag));
}

// ─── BindStep ───────────────────────────────────────────────────

// BindStep — declarative binding form. Transparent for pipeValue
// (env-write only). Three shapes, purity-routed for value bodies:
//
//   doc-only         (body absent, docs present)
//     → Doc-value snapshot materialized from the joined prefix.
//
//   pure-literal body (NumberLit / StringLit / VecLit / MapLit /
//   ... recursively, no OperandCall / Projection / Pipeline)
//     → eval'd at decl-time against pipeValue=null (the body does
//        not depend on pipeValue) and bound as a snapshot of the
//        resulting value. Catalog descriptor Maps live behind
//        this path so the langRuntime impl-resolution pass sees
//        a plain Map at each env entry.
//
//   impure body / parametric form
//     → captured AST in a Conduit (zero-arg or parametric) with
//        the lexical envRef tied for recursive references. Body
//        evaluates lazily at invocation against the caller's
//        pipeValue.
//
// Effect-laundering AST scan runs on impure body / parametric
// before installing — a non-@-prefixed name with an effectful
// body raises EffectLaunderingAtBindStepParseError.
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
    // Value-namespace doc-only BindStep (`:name |~~ docs ~~|`) wraps
    // the joined prose as a Doc-value snapshot.
    if (node.key.type === 'BareTypeKeyword') {
      const tagBinding = new Map();
      stampTagHeader(tagBinding, BUILTIN_TAG);
      const bound = makeSnapshot(tagBinding, {
        name, docs, location: node.location
      });
      return makeState(state.pipeValue, envSet(state.env, name, bound));
    }
    const bound = makeSnapshot(makeDoc(docs.join('\n')), {
      name, docs, location: node.location
    });
    return makeState(state.pipeValue, envSet(state.env, name, bound));
  }

  if (node.params === null && isPureLiteralAst(node.body)) {
    const innerState = await evalNode(node.body, makeState(null, state.env));
    const bound = makeSnapshot(innerState.pipeValue, {
      name, docs, location: node.location
    });
    return makeState(state.pipeValue, envSet(state.env, name, bound));
  }

  if (!classifyEffect(name)) {
    const offender = findFirstEffectfulIdentifier(node.body);
    if (offender !== null) {
      throw new EffectLaunderingAtBindStepParseError({
        bindingName: name,
        effectfulName: offender,
        location: node.body.location
      });
    }
  }
  const paramNames = node.params ? node.params.map(p => p.name) : [];
  const envRef = { env: null };
  const conduit = makeConduit(node.body, {
    name,
    params: paramNames,
    envRef,
    docs,
    location: node.body.location
  });
  const nextEnv = envSet(state.env, name, conduit);
  envRef.env = nextEnv;
  return makeState(state.pipeValue, nextEnv);
}

// ─── Projection ─────────────────────────────────────────────────

// Projection walks a path of key segments, dispatching per-segment
// on the current subject's kind — Map does keyword-lookup, Vec does
// integer-index access with `Array.prototype.at`-style negative
// support, value-classes (Quote, Doc) expose a fixed projectable
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
    // Snapshots are transparent value wrappers — unwrap during
    // projection so user code sees the raw captured value. The
    // wrapper itself is reachable only via `manifest` enumeration,
    // which walks env directly without going through projection.
    if (isSnapshot(projectionCurrent)) projectionCurrent = projectionCurrent.get('payload');
  }
  return withPipeValue(state, projectionCurrent);
}

// Registry of JS-layer value-classes that publish projectable surface.
// Each entry maps a VALUE_CLASS_TAG brand to a per-segment projector
// table; segments not in the table resolve to `null`, matching Map
// missing-key semantics. Quote and Doc publish their fields here; the
// brand rides the Symbol, so a JsonObject carrying a `"type"` data key
// falls through to the JsonObject branch below instead of being read
// as a value-class. Only the named fields listed here are reachable
// through `/key`.
const PROJECTABLE_BY_TYPE = {
  quote: {
    source: q => q.source,
    ast:    q => astNodeToMap(q.ast ?? lazyParseQuoteAst(q))
  },
  doc: {
    content:  d => d.content,
    segments: (d, state) => parseDocSegments(d.content, state.env)
  }
};

function lazyParseQuoteAst(q) {
  try {
    return parse(q.source, { uri: 'quote-ast' });
  } catch (_parseErr) {
    return NULL;
  }
}

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
  if (isJsonObject(subject)) {
    if (!Object.hasOwn(subject, projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, actualValue: subject });
    return subject[projKey];
  }
  if (isQMap(subject)) {
    if (!subject.has(projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, actualValue: subject });
    return subject.get(projKey);
  }
  if (isJsonArray(subject) || isVec(subject)) {
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
  if (isQSet(subject)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) {
      throw new ProjectionSequenceKeyNotIntegerError({ key: projKey, actualValue: subject });
    }
    const items = [...subject];
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? items.length + segmentIndex : segmentIndex;
    if (resolvedIndex < 0 || resolvedIndex >= items.length) {
      throw new ProjectionIndexOutOfBoundsError({ key: projKey, index: segmentIndex, length: items.length, actualValue: subject });
    }
    return items[resolvedIndex];
  }
  throw new ProjectionSubjectNotProjectableError({
    key: projKey,
    actualType: typeKeyword(subject),
    actualValue: subject
  });
}

// ─── Identifier lookup + Conduit dispatch ──────────────────────

// Binding-descriptor identity rides on the Map's JS-header
// `TAG_HEADER_SYMBOL` slot — a TagKeyword stamped by the
// `::builtin{…}` / conduit / snapshot factories, never a `:kind`
// Map field (which stays free for the value's own data). The two
// readers below probe the header: a `::builtin` descriptor's
// `:impl` slot carries the namespaced primitive key that
// PRIMITIVE_REGISTRY.resolve walks into the matching JS function
// value; conduit descriptors carry the payload field set documented
// in src/types.mjs.

function isBuiltinDescriptor(descriptor) {
  return descriptor[TAG_HEADER_SYMBOL]?.name === 'builtin';
}
// Conduit identity rides on the Map's JS-header
// `TAG_HEADER_SYMBOL` slot under the `CONDUIT_TAG` value —
// `isConduit` is the single discriminator.
const isConduitDescriptor = isConduit;

async function evalOperandCall(node, state) {
  const lookupName = node.name;
  const lookupEnv = state.env;

  if (!envHas(lookupEnv, lookupName)) {
    throw new UnresolvedIdentifierError(lookupName);
  }

  let resolved = envGet(lookupEnv, lookupName);

  // Snapshot auto-unwrap — a Map carrying the `snapshot` tag on its
  // JS-header slot exposes its wrapped :payload transparently to
  // identifier lookup so `as(:name) | name` sees the raw data.
  // Unwrapping upstream of applyBindingDescriptor keeps the
  // header-tag dispatch exhaustive over {builtin, conduit}; the
  // remaining non-Map branches handle
  // conduitParameter proxies (isFunctionValue) and plain user values
  // (tail) — and preserves the "snapshot wrapping an effectful
  // function value" safety-net path documented in the effect-marker
  // section of qlang-spec.md.
  if (isSnapshot(resolved)) {
    resolved = resolved.get('payload');
  }

  // Binding-descriptor dispatch — one read of the Map's JS-header
  // tag routes the resolved Map to either the builtin or the conduit
  // dispatch core. Plain user Maps (bound via session.bind or
  // captured by value-level projection) carry no header tag and
  // fall through as non-function values.
  if (isQMap(resolved)) {
    const dispatched = await applyBindingDescriptor(resolved, node, lookupName, state);
    if (dispatched !== null) return dispatched;
  }

  const capturedArgsAst = node.args; // null for bare ident, [] for f(), [...] for f(a,b)

  if (isFunctionValue(resolved)) {
    // Effect-laundering safety net: if the resolved function is
    // effectful but the lookup name we used is not @-prefixed, we
    // refuse the call. This catches every laundering path the
    // parse-time AST scan cannot see — installation via use,
    // capture via as, or rebinding via session.bind — because
    // every effectful invocation ultimately flows through an
    // identifier lookup at this point. Only conduitParameter
    // proxies reach this branch — built-ins dispatch through
    // `applyBindingDescriptor` above. The check stays because a
    // conduitParameter proxy may wrap an effectful captured-arg
    // lambda under a non-@-prefixed binding.
    if (resolved.effectful && !classifyEffect(lookupName)) {
      throw new EffectLaunderingAtCallError({
        bindingName: lookupName,
        effectfulName: resolved.name
      });
    }
    // Build lambdas for each captured arg. Each lambda evaluates
    // the captured AST node against the input it is invoked with,
    // sharing the env of the original capture site. Lambdas run
    // their sub-pipeline in a fresh state whose pipeValue is the
    // per-invocation input; env writes inside the lambda are
    // local to that call and do not escape.
    const capturedEnv = state.env;
    const operandLambdas = capturedArgsAst === null
      ? []
      : capturedArgsAst.map(argNode => makeLambda(argNode, capturedEnv));
    // Stash doc comments from the OperandCall node on the lambdas
    // array so the `as` operand can read them without changing
    // the fn(state, lambdas) dispatch signature.
    operandLambdas.docs = node.docs ?? [];
    operandLambdas.location = node.location;
    return await applyRule10(resolved, operandLambdas, state);
  }

  // Non-function value: replace pipeValue with it. Captured args
  // would be a type error since you cannot apply a non-function.
  if (capturedArgsAst !== null) {
    throw new ApplyToNonFunctionError({
      name: lookupName,
      actualType: typeKeyword(resolved),
      actualValue: resolved
    });
  }
  return withPipeValue(state, resolved);
}

// applyBindingDescriptor(descriptor, node, lookupName, state) → state' | null
//
// Single dispatch over the Map's JS-header tag that routes a
// Map-shaped env binding to its dispatch core: a `::builtin`
// descriptor rides through applyBuiltinDescriptor (resolve :impl →
// PRIMITIVE_REGISTRY, apply via Rule 10), a `::conduit` descriptor
// rides through applyConduit (lexical envRef + parameter proxies +
// body fork). Returns null when the Map carries no recognized
// header tag — the caller treats the null return as "this Map is
// user data, fall through to plain-value handling". Snapshot is
// handled upstream by the auto-unwrap step in evalOperandCall, so
// no snapshot branch here.
async function applyBindingDescriptor(descriptor, node, lookupName, state) {
  if (isBuiltinDescriptor(descriptor)) {
    return await applyBuiltinDescriptor(descriptor, node, state);
  }
  if (isConduitDescriptor(descriptor)) {
    return await applyConduit(descriptor, node, lookupName, state);
  }
  return null;
}

// applyBuiltinDescriptor(descriptor, node, state) → state'
//
// Dispatch core for built-in operands. Reads the resolved function
// value directly from the descriptor's :impl field (set by
// the bootstrap resolution pass in runtime/index.mjs) and delegates
// to applyRule10. Bare lookup fires the operand against the current
// pipeValue regardless of arity — non-nullary operands without
// captured args hit Rule 10's arity check and surface a per-site
// arityError. The introspection surface for "what does this operand
// do" is `:name | source` / `:name | docs` / `:name | examples`,
// not a bare-name shortcut into the descriptor Map.
async function applyBuiltinDescriptor(descriptor, node, state) {
  const resolvedImpl = descriptor.get('impl');

  const capturedArgsAst = node.args;
  const hasArgs = capturedArgsAst !== null;

  const capturedEnv = state.env;
  const builtinLambdas = hasArgs
    ? capturedArgsAst.map(argNode => makeLambda(argNode, capturedEnv))
    : [];
  builtinLambdas.docs = node.docs ?? [];
  builtinLambdas.location = node.location;
  return await applyRule10(resolvedImpl, builtinLambdas, state);
}

// applyConduit(conduit, node, lookupName, state) → state'
//
// Dispatches a conduit call — the "bonus fruit" in the Pac-man model.
// Builds conduitParameter proxies (lazy nullary function values) from
// captured-arg lambdas, constructs a bodyEnv from the lexical envRef
// anchor plus the params, forks the body, and ascends with only the
// final pipeValue. The entire operation is one atomic state
// transformation from the outer pipeline's perspective.
async function applyConduit(conduit, node, lookupName, state) {
  // Read the conduit's payload fields once. Every conduit is a
  // descriptor Map; field access goes through Map.get against
  // unnamespaced string keys.
  const conduitName       = conduit.get('name');
  const conduitParams     = conduit.get('params');
  const conduitBody       = conduit.get('body');
  const conduitEnvRef     = conduit.get('envRef');
  const conduitEffectful  = conduit.get('effectful');

  // Effect-laundering safety net (same invariant as intrinsic operands).
  if (conduitEffectful && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCallError({
      bindingName: lookupName,
      effectfulName: conduitName
    });
  }

  const capturedArgsAst = node.args;
  const expectedArity = conduitParams.length;

  // Build lambdas from captured args at the call site.
  const capturedEnv = state.env;
  const conduitLambdas = capturedArgsAst === null
    ? []
    : capturedArgsAst.map(argNode => makeLambda(argNode, capturedEnv));

  // Arity check: exact match required. No auto-curry — partial
  // application is achieved through zero-arity conduit aliases and parametric
  // forwarding patterns (fractal composition).
  if (conduitLambdas.length !== expectedArity) {
    throw new ConduitArityMismatchError({
      conduitName,
      expectedArity,
      actualArity: conduitLambdas.length
    });
  }

  // Build bodyEnv: start from the lexical scope anchor
  // (envRef.env), then layer conduitParameter proxies on top. Each
  // param proxy is a nullary function value that fires the
  // captured-arg lambda against whatever pipeValue the identifier
  // lookup sees at the moment — this is the lazy binding that
  // enables higher-order composition (params fire per-element
  // inside sortWith, per-iteration inside filter, etc.).
  //
  // Every conduit reachable at this point has its envRef holder
  // wired by the construction site (`evalBindStep` for in-query
  // declarations, deserializeSession for restored bindings); both
  // perform the tie-the-knot pattern so the body resolves through
  // the env captured at declaration time. Reading `.env` directly
  // — no `?? state.env` fallback — pins lexical scope: the body
  // resolves through the env captured by the construction-site
  // tie-the-knot, never through the caller's env at invocation.
  let bodyEnv = conduitEnvRef.env;
  for (let i = 0; i < conduitParams.length; i++) {
    const paramName = conduitParams[i].name;
    const paramProxy = makeConduitParameter(conduitLambdas[i], paramName);
    bodyEnv = envSet(bodyEnv, paramName, paramProxy);
  }

  // Fork body: inner sub-pipeline starts with the caller's pipeValue
  // and the lexical bodyEnv. Body's env writes (BindStep / `as`
  // declarations inside the body) are discarded on return — only the
  // final pipeValue escapes.
  const bodyState = makeState(state.pipeValue, bodyEnv);
  const finalBodyState = await evalNode(conduitBody, bodyState);
  return withPipeValue(state, finalBodyState.pipeValue);
}

// makeConduitParameter(capturedArgLambda, paramName) → function value
//
// Wraps a captured-arg lambda in a nullary function value (arity 1,
// zero captured args) that fires the lambda against the current
// pipeValue at each lookup site. This is the mechanism that enables
// higher-order conduit parameters: the lambda stays lazy, evaluated
// per-element inside sortWith, per-iteration inside filter, per-pair
// inside desc/asc — wherever the identifier lookup happens inside
// the conduit body.
function makeConduitParameter(capturedArgLambda, paramName) {
  // Conduit parameters are ephemeral — meta is inline because
  // they have no operand-family catalog entry.
  return makeFn(paramName, 1, async (state, paramLambdas) => {
    if (paramLambdas.length !== 0) {
      throw new ConduitParameterNoCapturedArgsError({
        paramName,
        actualCount: paramLambdas.length
      });
    }
    return withPipeValue(state, await capturedArgLambda(state.pipeValue));
  }, {
    category: 'conduitParameter',
    subject: 'any (current pipeValue at the lookup site)',
    modifiers: [],
    returns: 'any (the captured expression evaluated against pipeValue)',
    captured: [0, 0],
    docs: [`Conduit parameter '${paramName}': fires the captured expression against the current pipeValue.`],
    examples: [],
    throws: ['ConduitParameterNoCapturedArgsError']
  });
}

// makeLambda(astNode, env) → (input) → value
//
// Constructs a closure that evaluates `astNode` as a sub-pipeline
// against any given input, in the env captured at construction
// time. Operand impls call lambdas to resolve captured args at
// the moment they need them.
//
// The `.astNode` property exposes the raw AST for higher-order
// operands (like `filter` / `every` / `any` over Map) that need to
// inspect the captured expression's shape to dispatch by conduit
// arity without a test-application round-trip.
// The `.capturedEnv` property exposes the declaration-time env so
// higher-order operands can statically resolve a bare-identifier
// captured arg to its binding descriptor (filter/every/any over
// Map inspect the captured predicate's arity before dispatch).
function makeLambda(astNode, capturedLambdaEnv) {
  const lambda = async (lambdaInput) => {
    const subState = makeState(lambdaInput, capturedLambdaEnv);
    const evaluatedState = await evalNode(astNode, subState);
    return evaluatedState.pipeValue;
  };
  lambda.astNode = astNode;
  lambda.capturedEnv = capturedLambdaEnv;
  return lambda;
}

// resolveCapturedConduit(astNode, env) → { conduit, lookupName } | null
//
// If astNode is a bare OperandCall identifier (no captured args) that
// resolves in env to a conduit descriptor — directly or through a
// snapshot wrapper — returns the conduit and the binding name used at
// the lookup site. Otherwise returns null. Used by filter/every/any
// over Map to statically resolve a parametric conduit predicate and
// dispatch by its `:params` arity without a test-application round-trip.
export function resolveCapturedConduit(astNode, env) {
  if (!astNode || astNode.type !== 'OperandCall' || astNode.args !== null) return null;
  const lookupName = astNode.name;
  if (!envHas(env, lookupName)) return null;
  let resolved = envGet(env, lookupName);
  if (isSnapshot(resolved)) resolved = resolved.get('payload');
  if (!(resolved instanceof Map)) return null;
  if (!isConduitDescriptor(resolved)) return null;
  return { conduit: resolved, lookupName };
}

// invokeConduitWithFixedArgs(conduit, lookupName, fixedArgs, pipeValue)
//   → Promise<pipeValue>
//
// Applies a parametric conduit with caller-supplied captured values,
// bypassing the AST-args construction path. Each fixedArgs[i] becomes
// a nullary captured-arg lambda that ignores pipeValue and returns the
// fixed value — matching the conduitParameter lazy-proxy contract for
// a value the caller has already resolved. Used by filter/every/any
// over Map to supply (key, value) to a 2-arity predicate per entry.
//
// Enforces the same effectLaundering invariant as applyConduit: an
// effectful conduit cannot be invoked through a clean lookup name.
// Caller must guarantee fixedArgs.length === conduit's params.length —
// this invoker performs no arity check because the dispatching operand
// has already verified the arity.
export async function invokeConduitWithFixedArgs(conduit, lookupName, fixedArgs, pipeValue) {
  const conduitName      = conduit.get('name');
  const conduitParams    = conduit.get('params');
  const conduitBody      = conduit.get('body');
  const conduitEnvRef    = conduit.get('envRef');
  const conduitEffectful = conduit.get('effectful');

  if (conduitEffectful && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCallError({
      bindingName: lookupName,
      effectfulName: conduitName
    });
  }

  let bodyEnv = conduitEnvRef.env;
  for (let pi = 0; pi < conduitParams.length; pi++) {
    const fixedValue = fixedArgs[pi];
    const fixedArgLambda = async () => fixedValue;
    const paramName = conduitParams[pi].name;
    const paramProxy = makeConduitParameter(fixedArgLambda, paramName);
    bodyEnv = envSet(bodyEnv, paramName, paramProxy);
  }

  const bodyState = makeState(pipeValue, bodyEnv);
  const finalBodyState = await evalNode(conduitBody, bodyState);
  return finalBodyState.pipeValue;
}

// Exposed params field key so higher-order operands can read a
// conduit's arity without re-interning the keyword. Pairs with
// resolveCapturedConduit / invokeConduitWithFixedArgs.
export const CONDUIT_PARAMS_FIELD = 'params';

// resolveBinaryReducer(astNode, env) → ((acc, item) → Promise<value>) | null
//
// Resolves a bare reducer reference into the per-step combiner `reduce`
// folds with. The reducer is applied as `reducer(acc, element)`:
//   - a binary operand (`add` / `mul` / `union` / …) folds via its
//     bound form — accumulator as subject, element as the single
//     captured arg (`acc | add(element)`), through Rule 10;
//   - a 2-param conduit `[:acc :elem]` binds both through
//     invokeConduitWithFixedArgs.
// Returns null when the captured arg is not such a reference (an inline
// expression, a literal, a non-2-param conduit, or an unbound name),
// so `reduce` lifts its own per-site error.
export function resolveBinaryReducer(astNode, env) {
  if (astNode.type !== 'OperandCall' || astNode.args !== null) return null;
  const lookupName = astNode.name;
  if (!envHas(env, lookupName)) return null;
  let resolved = envGet(env, lookupName);
  if (isSnapshot(resolved)) resolved = resolved.get('payload');
  if (isConduitDescriptor(resolved)) {
    if (resolved.get(CONDUIT_PARAMS_FIELD).length !== 2) return null;
    return (acc, item) => invokeConduitWithFixedArgs(resolved, lookupName, [acc, item], item);
  }
  if (isQMap(resolved) && isBuiltinDescriptor(resolved)) {
    const impl = resolved.get('impl');
    return async (acc, item) => (await applyRule10(impl, [() => item], makeState(acc, env))).pipeValue;
  }
  return null;
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
  return await fork(state, inner => evalNode(node.pipeline, inner));
}
