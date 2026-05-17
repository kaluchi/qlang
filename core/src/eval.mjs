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
  isVec, isQMap, isKeyword, isSnapshot, isFunctionValue, isErrorValue,
  typeKeyword, keyword, NULL, makeErrorValue, appendTrailNode,
  materializeTrail, makeQuote, makeDoc, makeJsonObject, makeJsonArray,
  isJsonObject, isJsonArray, isVecShape, isQuote,
  isJsonStoreable, makeConduit, makeSnapshot, makeTagKeyword
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

const ProjectionSubjectNotMapError = declareShapeError('ProjectionSubjectNotMapError',
  ({ key, actualType }) => `/${key} requires Map or Vec subject, got ${actualType.name}`);
// Map subject does not carry the requested key. Strict fail-first
// surfaces the typo / mismatched-shape on the projection itself; the
// lifted descriptor carries `:key` plus the `:fault` step/input so
// downstream `!| /key` reads the failed segment directly. null
// subject still deflects as null (see projectSegment).
const ProjectionKeyNotInMapError = declareShapeError('ProjectionKeyNotInMapError',
  ({ key }) => `/${key} — key not present in Map subject`);
// Vec subject indexed past its bounds. Negative indices walk from
// the tail (`/-1` is last); only positions that resolve outside
// `[0, length)` trip this site.
const ProjectionIndexOutOfBoundsError = declareShapeError('ProjectionIndexOutOfBoundsError',
  ({ key, length }) => `/${key} — index out of bounds for Vec subject of length ${length}`);
// Vec subject projected by a non-numeric segment. Vec indices are
// integer offsets; named keys belong to Map shape, so a `[…] | /name`
// query surfaces as a shape mismatch on the projection itself.
const ProjectionVecKeyNotIntegerError = declareShapeError('ProjectionVecKeyNotIntegerError',
  ({ key }) => `/${key} — non-integer segment cannot index a Vec subject`);
// Value-class subjects (Quote / Doc / …) publish a fixed set of
// projectable fields through PROJECTABLE_BY_TYPE. A segment outside
// that set is treated as a typo and lifts to this error.
const ProjectionFieldNotOnValueClassError = declareShapeError('ProjectionFieldNotOnValueClassError',
  ({ key, valueClass, availableFields }) =>
    `/${key} — not a projectable field on ${valueClass}; available: ${availableFields.join(', ')}`);
const TaggedLitTagNotFoundError = declareShapeError('TaggedLitTagNotFoundError',
  ({ tag }) => `::${tag} — tag binding not found in env`);
const TaggedLitNotTagBindingError = declareShapeError('TaggedLitNotTagBindingError',
  ({ tag, actualType }) => `::${tag} — tag binding is ${actualType.name}, expected a Map descriptor with :kind :tag`);
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
const DistributeSubjectNotVecError = declareSubjectError('DistributeSubjectNotVecError', '*', 'vec');
const MergeSubjectNotVecError      = declareSubjectError('MergeSubjectNotVecError',      '>>', 'vec');
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
    const faultMap = buildFaultMap(node, state.pipeValue);
    if (caughtError instanceof ParseError) {
      // A ParseError raised mid-eval — typically from `apply` / `eval`
      // parsing a Quote source — lifts to a `::ParseError!{…}`
      // ErrorValue (same structured shape as a top-level parse
      // failure), with the originating step's fault stamped.
      const lifted = errorFromParse(caughtError);
      const enriched = new Map(lifted.descriptor);
      enriched.set('fault', faultMap);
      return withPipeValue(state, { ...lifted, descriptor: enriched });
    }
    return withPipeValue(state,
      caughtError instanceof QlangError
        ? errorFromQlang(caughtError, faultMap)
        : errorFromForeign(caughtError, node, faultMap));
  }
}

// ─── :fault Map builder ─────────────────────────────────────────

function buildFaultMap(stepNode, pipeValue) {
  const m = new Map();
  m.set('step', makeQuote(stepNode.text));
  m.set('input', pipeValue);
  return Object.freeze(m);
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
  if (!isVecShape(state.pipeValue)) {
    const distributeErr = new DistributeSubjectNotVecError(state.pipeValue);
    distributeErr.location = bodyNode.location;
    return withPipeValue(state, errorFromQlang(distributeErr, buildFaultMap(bodyNode, state.pipeValue)));
  }
  const subjectVec = state.pipeValue;
  const forkResults = await Promise.all(
    [...subjectVec].map(vecElement =>
      forkWith(state, vecElement, inner => evalNode(bodyNode, inner))
    )
  );
  const distributeResults = forkResults.map(forkedState => forkedState.pipeValue);
  return withPipeValue(state, retagPerElement(distributeResults, subjectVec));
}

async function mergeFlat(state, nextNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(nextNode, 'merge')));
  }
  if (!isVecShape(state.pipeValue)) {
    const mergeErr = new MergeSubjectNotVecError(state.pipeValue);
    mergeErr.location = nextNode.location;
    return withPipeValue(state, errorFromQlang(mergeErr, buildFaultMap(nextNode, state.pipeValue)));
  }
  const sourceVec = state.pipeValue;
  const flattened = [];
  for (const flatItem of sourceVec) {
    if (isVecShape(flatItem)) flattened.push(...flatItem);
    else flattened.push(flatItem);
  }
  return await evalNode(nextNode, withPipeValue(state, retagPerElement(flattened, sourceVec)));
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
  const materializedDescriptor = new Map(errorVal.descriptor);
  materializedDescriptor.set('trail', combinedTrail);
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
  const errorDescriptor = new Map();
  for (const entry of node.entries) {
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    errorDescriptor.set(entry.key.name, entryFork.pipeValue);
  }
  return withPipeValue(state, makeErrorValue(errorDescriptor, { location: node.location }));
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
async function evalTaggedLit(node, state) {
  const payloadFork = await fork(state, inner => evalNode(node.payload, inner));
  const payloadValue = payloadFork.pipeValue;
  const typeKey = tagBindingKey(node.tag);
  if (!envHas(state.env, typeKey)) {
    throw new TaggedLitTagNotFoundError({ tag: node.tag });
  }
  let typeBinding = envGet(state.env, typeKey);
  if (isSnapshot(typeBinding)) typeBinding = typeBinding.get('payload');
  if (!isQMap(typeBinding)) {
    throw new TaggedLitNotTagBindingError({ tag: node.tag, actualType: typeKeyword(typeBinding), actualValue: typeBinding });
  }
  // :impl carries either a `:qlang/prim/<tag>` keyword (built-in
  // tag — resolved through PRIMITIVE_REGISTRY at every invocation so
  // `manifest(:tag)` keeps the readable keyword handle on the
  // descriptor) or a Quote-value (user-defined tag — payload
  // becomes pipeValue, the Quote body runs against the current env).
  const implKey = typeBinding.get('impl');
  if (isKeyword(implKey)) {
    const constructor = PRIMITIVE_REGISTRY.resolve(implKey.name);
    const value = await constructor(payloadValue, state);
    return withPipeValue(state, value);
  }
  if (isQuote(implKey)) {
    const bodyAst = implKey.ast ?? parse(implKey.source);
    const bodyState = makeState(payloadValue, state.env);
    const resultState = await evalNode(bodyAst, bodyState);
    return withPipeValue(state, resultState.pipeValue);
  }
  // Default constructor — fires when the tag-binding has no
  // explicit `:impl` slot. Branches by payload shape:
  //
  //   ErrorLit payload (already an ErrorValue) → re-stamp
  //     `:kind ::Tag` on the descriptor and keep the result on
  //     the fail-track. Prints back as `::Tag!{…}`.
  //
  //   Map payload → flat-merge into the instance descriptor:
  //     `:kind ::Tag` plus every entry of the payload Map at the
  //     top level. The Map is already structured as a named-field
  //     bundle, so no nesting under `:payload` is needed. Prints
  //     back as `::Tag{…fields…}`.
  //
  //   Other Primary payload (Vec / Set / Quote / Doc / scalar /
  //     Keyword / nested TaggedLit / …) → nest under `:payload`:
  //     `{:kind ::Tag :payload <value>}`. Prints back as
  //     `::Tag<bracketed-payload>` for bracket-prefixed values
  //     (Vec / Set / Quote / Doc) and `::Tag(<scalar>)` for the
  //     rest — every shape the grammar's `Primary` rule accepts
  //     as TaggedLit payload that is not itself a Map.
  if (implKey === undefined) {
    if (isErrorValue(payloadValue)) {
      const restamped = new Map(payloadValue.descriptor);
      restamped.set('kind', makeTagKeyword(node.tag));
      return withPipeValue(state, makeErrorValue(restamped, {
        location: node.location,
        originalError: payloadValue.originalError
      }));
    }
    const instance = new Map();
    instance.set('kind', makeTagKeyword(node.tag));
    if (isQMap(payloadValue)) {
      for (const [fieldKey, fieldVal] of payloadValue) {
        if (fieldKey === 'kind') continue;
        instance.set(fieldKey, fieldVal);
      }
    } else {
      instance.set('payload', payloadValue);
    }
    return withPipeValue(state, instance);
  }
  throw new TagBindingHasNoConstructorError({
    tag: node.tag,
    payloadValue: payloadValue,
    payloadType: typeKeyword(payloadValue),
    expectedType: Object.freeze([keyword('keyword'), keyword('quote')]),
    actualValue: implKey,
    actualType: typeKeyword(implKey)
  });
}

// ::tag — bare reference to a tag-namespace identifier. The
// reference value is the TagKeyword itself (identity-as-value) —
// symmetric to the value-namespace `:foo` keyword literal, which
// produces `keyword('foo')` without consulting env. Typos surface
// on use, not on literal construction:
//
//   `::TypoTag[payload]`  → TaggedLitTagNotFoundError (evalTaggedLit)
//   `::TypoTag | source`  → AxisBindingNotFoundError (axis-op)
//   `::TypoTag | docs`    → AxisBindingNotFoundError (axis-op)
//   `::TypoTag | examples` → AxisBindingNotFoundError (axis-op)
//
// Each use-site already probes env for its own purpose, so the
// literal stays env-agnostic. Catalog `:throws [::Foo ::Bar]` Vec
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
    // canonical `::builtin` shape identity under `:kind`, matching
    // every body-form declaration the catalog uses elsewhere.
    // Value-namespace doc-only BindStep (`:name |~~ docs ~~|`) wraps
    // the joined prose as a Doc-value snapshot.
    if (node.key.type === 'BareTypeKeyword') {
      const tagBinding = new Map();
      tagBinding.set('kind', makeTagKeyword('builtin'));
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
// Each entry maps a `.type` discriminator to a per-segment handler
// table; segments not in the table resolve to `null`, matching Map
// missing-key semantics. Lets a value-class declare its public
// projection surface in one place — the discriminator (Conduit /
// Snapshot / Quote / etc.) stays JS-side, only the named fields
// listed here are reachable through `/key`.
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
    const handlers = PROJECTABLE_BY_TYPE[subject.type];
    if (handlers) {
      if (!Object.hasOwn(handlers, projKey)) {
        throw new ProjectionFieldNotOnValueClassError({
          key: projKey,
          valueClass: subject.type,
          availableFields: Object.keys(handlers)
        });
      }
      return handlers[projKey](subject, state);
    }
  }
  if (isJsonObject(subject)) {
    if (!Object.hasOwn(subject, projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, subject });
    return subject[projKey];
  }
  if (isQMap(subject)) {
    if (!subject.has(projKey)) throw new ProjectionKeyNotInMapError({ key: projKey, subject });
    return subject.get(projKey);
  }
  if (isJsonArray(subject) || isVec(subject)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) {
      throw new ProjectionVecKeyNotIntegerError({ key: projKey, subject });
    }
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? subject.length + segmentIndex : segmentIndex;
    if (resolvedIndex < 0 || resolvedIndex >= subject.length) {
      throw new ProjectionIndexOutOfBoundsError({ key: projKey, index: segmentIndex, length: subject.length, subject });
    }
    return subject[resolvedIndex];
  }
  throw new ProjectionSubjectNotMapError({
    key: projKey,
    actualType: typeKeyword(subject),
    actualValue: subject
  });
}

// ─── Identifier lookup + Conduit dispatch ──────────────────────

// Interned keyword constants for binding-descriptor dispatch. The
// :kind discriminator decides which binding kind a resolved
// env value represents; :impl carries the namespaced primitive
// key that PRIMITIVE_REGISTRY.resolve walks into the matching JS
// function value. Conduit and snapshot descriptors carry their own
// payload field set documented in src/types.mjs.

function isBuiltinDescriptor(descriptor) {
  const kind = descriptor.get('kind');
  return kind && kind.name === 'builtin';
}
function isConduitDescriptor(descriptor) {
  const kind = descriptor.get('kind');
  return kind && kind.name === 'conduit';
}

async function evalOperandCall(node, state) {
  const lookupName = node.name;
  const lookupEnv = state.env;

  if (!envHas(lookupEnv, lookupName)) {
    throw new UnresolvedIdentifierError(lookupName);
  }

  let resolved = envGet(lookupEnv, lookupName);

  // Snapshot auto-unwrap — a Map with :kind :snapshot exposes
  // its wrapped :payload transparently to identifier lookup so
  // `as(:name) | name` sees the raw data. Unwrapping upstream of
  // applyBindingDescriptor keeps the :kind switch exhaustive
  // over {:builtin, :conduit}; the remaining non-Map branches handle
  // conduit-parameter proxies (isFunctionValue) and plain user values
  // (tail) — and preserves the "snapshot wrapping an effectful
  // function value" safety-net path documented in the effect-marker
  // section of qlang-spec.md.
  if (isSnapshot(resolved)) {
    resolved = resolved.get('payload');
  }

  // Binding-descriptor dispatch — one switch over `:kind`
  // routes the resolved Map to either the builtin or the conduit
  // dispatch core. Plain user Maps (bound via session.bind or
  // captured by value-level projection) carry no `:kind` and
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
    // identifier lookup at this point. Only conduit-parameter
    // proxies reach this branch — built-ins dispatch through
    // `applyBindingDescriptor` above. The check stays because a
    // conduit-parameter proxy may wrap an effectful captured-arg
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
// Single switch over :kind that routes a Map-shaped env
// binding to its dispatch core: :builtin rides through
// applyBuiltinDescriptor (resolve :impl → PRIMITIVE_REGISTRY,
// apply via Rule 10), :conduit rides through applyConduit (lexical
// envRef + parameter proxies + body fork). Returns null when the
// descriptor has no recognized :kind — the caller treats the
// null return as "this Map is user data, fall through to plain-
// value handling". Snapshot is handled upstream by the auto-unwrap
// step in evalOperandCall, so no :snapshot branch here.
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
// arity-error. The introspection surface for "what does this operand
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
// Builds conduit-parameter proxies (lazy nullary function values) from
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
  // (envRef.env), then layer conduit-parameter proxies on top. Each
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
    const paramProxy = makeConduitParameter(conduitLambdas[i], conduitParams[i]);
    bodyEnv = envSet(bodyEnv, conduitParams[i], paramProxy);
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
  // they have no lib/qlang/core.qlang entry.
  return makeFn(paramName, 1, async (state, paramLambdas) => {
    if (paramLambdas.length !== 0) {
      throw new ConduitParameterNoCapturedArgsError({
        paramName,
        actualCount: paramLambdas.length
      });
    }
    return withPipeValue(state, await capturedArgLambda(state.pipeValue));
  }, {
    category: 'conduit-parameter',
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
// fixed value — matching the conduit-parameter lazy-proxy contract for
// a value the caller has already resolved. Used by filter/every/any
// over Map to supply (key, value) to a 2-arity predicate per entry.
//
// Enforces the same effect-laundering invariant as applyConduit: an
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
    const paramProxy = makeConduitParameter(fixedArgLambda, conduitParams[pi]);
    bodyEnv = envSet(bodyEnv, conduitParams[pi], paramProxy);
  }

  const bodyState = makeState(pipeValue, bodyEnv);
  const finalBodyState = await evalNode(conduitBody, bodyState);
  return finalBodyState.pipeValue;
}

// Exposed params field key so higher-order operands can read a
// conduit's arity without re-interning the keyword. Pairs with
// resolveCapturedConduit / invokeConduitWithFixedArgs.
export const CONDUIT_PARAMS_FIELD = 'params';

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
