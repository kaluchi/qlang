// Top-level evaluator.
//
// Threads (pipeValue, env) state through pipeline steps. Dispatches
// on AST node `type` and delegates to the appropriate step or
// combinator evaluator.
//
// Architecture: every node-type evaluator is a small function
// (state, node) → state'. The dispatcher is a lookup table.

import { parse } from './parse.mjs';
import {
  makeState, withPipeValue, envSet, envGet, envHas
} from './state.mjs';
import { fork, forkWith } from './fork.mjs';
import { applyRule10, makeFn } from './rule10.mjs';
import {
  QlangError,
  UnresolvedIdentifierError,
  EffectLaunderingAtCall
} from './errors.mjs';
import { classifyEffect } from './effect.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from './operand-errors.mjs';
import { QlangInvariantError } from './errors.mjs';

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
import {
  isVec, isQMap, isSnapshot, isFunctionValue, isErrorValue,
  describeType, keyword, NULL, makeErrorValue, appendTrailNode,
  materializeTrail
} from './types.mjs';
import { astNodeToMap } from './walk.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';

const ProjectionSubjectNotMap = declareShapeError('ProjectionSubjectNotMap',
  ({ key, actualType }) => `/${key} requires Map subject, got ${actualType}`);
const DistributeSubjectNotVec = declareSubjectError('DistributeSubjectNotVec', '*', 'Vec');
const MergeSubjectNotVec      = declareSubjectError('MergeSubjectNotVec',      '>>', 'Vec');
const ApplyToNonFunction      = declareShapeError('ApplyToNonFunction',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType}, not a function`);
const ConduitArityMismatch    = declareArityError('ConduitArityMismatch',
  ({ conduitName, expectedArity, actualArity }) =>
    `conduit '${conduitName}' expects ${expectedArity} captured arguments, got ${actualArity}`);
const ConduitParameterNoCapturedArgs = declareArityError('ConduitParameterNoCapturedArgs',
  ({ paramName, actualCount }) =>
    `conduit parameter '${paramName}' takes no captured arguments, got ${actualCount}`);

// evalQuery(source, env?) → Promise<final pipeValue>
//
// Convenience entry point: parse + evaluate. If env is omitted,
// uses langRuntime as both initial env and pipeValue (per the
// model's reference bootstrap).
export async function evalQuery(source, env) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
  const initialState = makeState(initialEnv, initialEnv);
  const finalState = await evalNode(ast, initialState);
  return finalState.pipeValue;
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
  MapLit:            evalMapLit,
  ErrorLit:          evalErrorLit,
  SetLit:            evalSetLit,
  Projection:        evalProjection,
  OperandCall:       evalOperandCall,
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
    return withPipeValue(state,
      caughtError instanceof QlangError ? errorFromQlang(caughtError) : errorFromForeign(caughtError, node));
  }
}

// ─── Pipeline ───────────────────────────────────────────────────

async function evalPipeline(node, state) {
  // Pipeline: { steps: [firstStep, { combinator, step }, ...] }
  //
  // If `node.leadingFail === true`, the first step is routed through
  // the `!|` combinator instead of a raw evalNode call. This is how
  // the leading-prefix form (`!| firstStep`) opts into fail-track
  // dispatch for the pipeline's first step — used typically inside
  // filter/when/if sub-pipelines where the per-element pipeValue may
  // or may not be an error.
  let current = state;
  for (let i = 0; i < node.steps.length; i++) {
    const step = node.steps[i];
    if (i === 0) {
      current = node.leadingFail
        ? await applyCombinator('!|', current, step)
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
    return withPipeValue(state, appendTrailNode(state.pipeValue, astNodeToMap(stepNode)));
  }
  return await evalNode(stepNode, state);
}

async function distribute(state, bodyNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, astNodeToMap(bodyNode)));
  }
  if (!isVec(state.pipeValue)) {
    throw new DistributeSubjectNotVec(describeType(state.pipeValue), state.pipeValue);
  }
  const forkResults = await Promise.all(
    state.pipeValue.map(vecElement =>
      forkWith(state, vecElement, inner => evalNode(bodyNode, inner))
    )
  );
  return withPipeValue(state, forkResults.map(forkedState => forkedState.pipeValue));
}

async function mergeFlat(state, nextNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, astNodeToMap(nextNode)));
  }
  if (!isVec(state.pipeValue)) {
    throw new MergeSubjectNotVec(describeType(state.pipeValue), state.pipeValue);
  }
  const flattened = [];
  for (const flatItem of state.pipeValue) {
    if (isVec(flatItem)) flattened.push(...flatItem);
    else flattened.push(flatItem);
  }
  return await evalNode(nextNode, withPipeValue(state, flattened));
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
  const combinedTrail = [
    ...errorVal.descriptor.get(keyword('trail')),
    ...materializeTrail(errorVal)
  ];
  const materializedDescriptor = new Map(errorVal.descriptor);
  materializedDescriptor.set(keyword('trail'), combinedTrail);
  return await evalNode(stepNode, withPipeValue(state, materializedDescriptor));
}

// ─── Step 1: Literals ───────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNullLit(_node, state)    { return withPipeValue(state, NULL); }
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }

async function evalVecLit(node, state) {
  // Each element is a sub-pipeline forked against the outer state.
  const elementForks = await Promise.all(
    node.elements.map(elem => fork(state, inner => evalNode(elem, inner)))
  );
  return withPipeValue(state, elementForks.map(forkedState => forkedState.pipeValue));
}

// foldEntryDocs — when a MapEntry carries a parser-attached docs
// prefix (from `|~~ ... ~~|` tokens preceding `:key value` inside a
// MapLit or ErrorLit), stamp the accumulated doc strings onto the
// entry's value Map under the `:docs` keyword. Non-Map values (a
// scalar, Vec, Set, or an already-wrapped error value) pass through
// unchanged — there is no target Map for the docs to land on, and
// silently dropping them matches the "docs attach to the binding
// descriptor, not to bare data" framing of the Variant-B manifest.
//
// The fold is destructive toward any pre-existing `:docs` field on
// the value Map: entry-level attachment always wins, because that's
// the spelling an author reaches for when the same entry is being
// documented, and respecting an inline `:docs [...]` would require
// the author to know both spellings produce the same result while
// the comment form exists entirely to spare them that knowledge.
function foldEntryDocs(entry, value) {
  if (!entry.docs || entry.docs.length === 0) return value;
  if (!isQMap(value)) return value;
  const withDocs = new Map(value);
  withDocs.set(keyword('docs'), Object.freeze([...entry.docs]));
  return withDocs;
}

async function evalMapLit(node, state) {
  // Each value is a sub-pipeline forked against the outer state.
  // Keys are keyword AST nodes; we resolve them to interned keywords.
  // Parser-attached entry.docs fold into the value Map as :docs when
  // the value is itself a Map — this is the mechanism that lets
  // manifest-style `|~~ ... ~~| :entry {...}` authoring land doc
  // strings on the resulting binding descriptor at eval time.
  const mapResult = new Map();
  for (const entry of node.entries) {
    const entryKey = keyword(entry.key.name);
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    mapResult.set(entryKey, foldEntryDocs(entry, entryFork.pipeValue));
  }
  return withPipeValue(state, mapResult);
}

async function evalErrorLit(node, state) {
  // Same entry evaluation as MapLit, but wraps in error value.
  // Doc-prefix fold applies symmetrically so the descriptor Map
  // inside the error carries :docs when the author attached them
  // — harmless for ordinary error literals, load-bearing when an
  // embedder programmatically constructs a descriptor-shaped error
  // and wants the docs surfaced through reify.
  const errorDescriptor = new Map();
  for (const entry of node.entries) {
    const entryKey = keyword(entry.key.name);
    const entryFork = await fork(state, inner => evalNode(entry.value, inner));
    errorDescriptor.set(entryKey, foldEntryDocs(entry, entryFork.pipeValue));
  }
  return withPipeValue(state, makeErrorValue(errorDescriptor, { location: node.location }));
}

async function evalSetLit(node, state) {
  const setResult = new Set();
  for (const setElem of node.elements) {
    const elemFork = await fork(state, inner => evalNode(setElem, inner));
    setResult.add(elemFork.pipeValue);
  }
  return withPipeValue(state, setResult);
}

// ─── Step 2: Projection ─────────────────────────────────────────

// Projection walks a path of key segments, dispatching per-segment
// on the current subject's kind — Map does keyword-lookup, Vec does
// integer-index access with `Array.prototype.at`-style negative
// support. Any subject outside {Map, Vec} at descent time raises
// ProjectionSubjectNotMap (the name predates Vec support; kept for
// stable per-site identity). A Vec subject with a non-integer
// segment resolves to `null` — symmetric with the missing-key case
// on a Map — so mixed-shape JSON paths like `/items/0/name` never
// throw on a legitimate "this slot holds null" reading.
const INTEGER_SEGMENT_RE = /^-?\d+$/;

async function evalProjection(node, state) {
  let projectionCurrent = state.pipeValue;
  for (const projKey of node.keys) {
    projectionCurrent = projectSegment(projectionCurrent, projKey);
    // Snapshots are transparent value wrappers — unwrap during
    // projection so user code sees the raw captured value. The
    // wrapper itself is reachable only via reify, which reads env
    // directly without going through projection.
    if (isSnapshot(projectionCurrent)) projectionCurrent = projectionCurrent.get(KW_VALUE_FIELD);
  }
  return withPipeValue(state, projectionCurrent);
}

function projectSegment(subject, projKey) {
  if (isQMap(subject)) {
    const subjectKey = keyword(projKey);
    return subject.has(subjectKey) ? subject.get(subjectKey) : NULL;
  }
  if (isVec(subject)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) return NULL;
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? subject.length + segmentIndex : segmentIndex;
    return (resolvedIndex >= 0 && resolvedIndex < subject.length) ? subject[resolvedIndex] : NULL;
  }
  throw new ProjectionSubjectNotMap({
    key: projKey,
    actualType: describeType(subject),
    actualValue: subject
  });
}

// ─── Step 3: Identifier lookup with optional captured args ──────

// Interned keyword constants for binding-descriptor dispatch. The
// :qlang/kind discriminator decides which binding kind a resolved
// env value represents; :qlang/impl carries the namespaced primitive
// key that PRIMITIVE_REGISTRY.resolve walks into the matching JS
// function value. Conduit and snapshot descriptors carry their own
// payload field set documented in src/types.mjs.
const KW_QLANG_KIND_DISPATCH = keyword('qlang/kind');
const KW_QLANG_IMPL_DISPATCH = keyword('qlang/impl');
const KW_BUILTIN_DISPATCH    = keyword('builtin');
const KW_CONDUIT_DISPATCH    = keyword('conduit');
const KW_NAME_FIELD          = keyword('name');
const KW_PARAMS_FIELD        = keyword('params');
const KW_BODY_FIELD          = keyword('qlang/body');
const KW_ENVREF_FIELD        = keyword('qlang/envRef');
const KW_VALUE_FIELD         = keyword('qlang/value');
const KW_EFFECTFUL_FIELD     = keyword('effectful');

async function evalOperandCall(node, state) {
  const lookupName = node.name;
  const lookupEnv = state.env;

  if (!envHas(lookupEnv, lookupName)) {
    throw new UnresolvedIdentifierError(lookupName);
  }

  let resolved = envGet(lookupEnv, lookupName);

  // Snapshot auto-unwrap — a Map with :qlang/kind :snapshot exposes
  // its wrapped :qlang/value transparently to identifier lookup so
  // `as(:name) | name` sees the raw data. The wrapper itself stays
  // reachable through `reify(:name)`, which reads env directly
  // without going through evalOperandCall. Running the unwrap
  // before the binding-descriptor dispatch collapses the old
  // four-branch layout (builtin / conduit / snapshot / function)
  // into three: applyBindingDescriptor for builtin + conduit,
  // isFunctionValue for conduit-parameter proxies, plain-value
  // tail for everything else — and preserves the "snapshot wrapping
  // an effectful function value" safety-net path documented in
  // the effect-marker section of qlang-spec.md.
  if (isSnapshot(resolved)) {
    resolved = resolved.get(KW_VALUE_FIELD);
  }

  // Variant-B binding-descriptor dispatch — one switch over
  // :qlang/kind routes to either the builtin or the conduit
  // dispatch core. Plain user Maps (bound via session.bind or
  // captured by value-level projection) carry no :qlang/kind and
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
    // identifier lookup at this point. Only conduit-parameters
    // reach this branch — built-ins dispatch through the Variant-B
    // descriptor path in applyBindingDescriptor above. The check
    // stays because a conduit-parameter proxy may wrap an effectful
    // captured-arg lambda under a non-@-prefixed binding.
    if (resolved.effectful && !classifyEffect(lookupName)) {
      throw new EffectLaunderingAtCall({
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
    // array so reflective binding operands (let, as) can access
    // them without changing the fn(state, lambdas) dispatch signature.
    operandLambdas.docs = node.docs || [];
    operandLambdas.location = node.location;
    return await applyRule10(resolved, operandLambdas, state);
  }

  // Non-function value: replace pipeValue with it. Captured args
  // would be a type error since you cannot apply a non-function.
  if (capturedArgsAst !== null) {
    throw new ApplyToNonFunction({
      name: lookupName,
      actualType: describeType(resolved),
      actualValue: resolved
    });
  }
  return withPipeValue(state, resolved);
}

// applyBindingDescriptor(descriptor, node, lookupName, state) → state' | null
//
// Single switch over :qlang/kind that routes a Map-shaped env
// binding to its dispatch core: :builtin rides through
// applyBuiltinDescriptor (resolve :qlang/impl → PRIMITIVE_REGISTRY,
// apply via Rule 10), :conduit rides through applyConduit (lexical
// envRef + parameter proxies + body fork). Returns null when the
// descriptor has no recognized :qlang/kind — the caller treats the
// null return as "this Map is user data, fall through to plain-
// value handling". Snapshot is handled upstream by the auto-unwrap
// step in evalOperandCall, so no :snapshot branch here.
async function applyBindingDescriptor(descriptor, node, lookupName, state) {
  const bindingKind = descriptor.get(KW_QLANG_KIND_DISPATCH);
  if (bindingKind === KW_BUILTIN_DISPATCH) {
    return await applyBuiltinDescriptor(descriptor, node, lookupName, state);
  }
  if (bindingKind === KW_CONDUIT_DISPATCH) {
    return await applyConduit(descriptor, node, lookupName, state);
  }
  return null;
}

// reifyBuiltinDescriptor(rawDescriptor, implFn, introspectionName)
//
// Builds a user-facing reify-shape descriptor from a raw env
// descriptor. Strips internal :qlang/kind and :qlang/impl, stamps
// :kind :builtin plus :captured and :effectful read from the
// resolved function value. Matches the shape intro.mjs::describeBinding
// produces for builtin descriptors — factored here to avoid a
// circular import (intro → eval → intro).
function reifyBuiltinDescriptor(rawDescriptor, implFn, introspectionName) {
  const reified = new Map();
  reified.set(keyword('kind'), keyword('builtin'));
  reified.set(keyword('name'), introspectionName);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    const fieldName = fieldKey.name;
    if (fieldName === 'qlang/kind' || fieldName === 'qlang/impl') continue;
    reified.set(fieldKey, fieldVal);
  }
  reified.set(keyword('captured'), [...implFn.meta.captured]);
  reified.set(keyword('effectful'), implFn.effectful);
  return reified;
}

// applyBuiltinDescriptor(descriptor, node, lookupName, state) → state'
//
// Dispatch core for built-in operands. Reads the resolved function
// value directly from the descriptor's :qlang/impl field (set by
// the bootstrap resolution pass in runtime/index.mjs) and delegates
// to applyRule10.
//
// Bare non-nullary lookup returns a reify-shaped descriptor as
// pipeValue — internal fields stripped, :captured and :effectful
// stamped from the impl. Nullary operands fire on bare lookup
// because their minCaptured is 0 and bare application IS their
// valid call shape.
async function applyBuiltinDescriptor(descriptor, node, lookupName, state) {
  const resolvedImpl = descriptor.get(KW_QLANG_IMPL_DISPATCH);

  const capturedArgsAst = node.args;
  const hasArgs = capturedArgsAst !== null;

  const minCaptured = resolvedImpl.meta.captured[0];
  if (!hasArgs && minCaptured > 0) {
    return withPipeValue(state, reifyBuiltinDescriptor(descriptor, resolvedImpl, lookupName));
  }

  const capturedEnv = state.env;
  const builtinLambdas = hasArgs
    ? capturedArgsAst.map(argNode => makeLambda(argNode, capturedEnv))
    : [];
  builtinLambdas.docs = node.docs || [];
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
  // Read the conduit's payload fields once. Under Variant-B every
  // conduit is a descriptor Map; field access goes through Map.get
  // against the interned KW_*_FIELD constants declared above.
  const conduitName       = conduit.get(KW_NAME_FIELD);
  const conduitParams     = conduit.get(KW_PARAMS_FIELD);
  const conduitBody       = conduit.get(KW_BODY_FIELD);
  const conduitEnvRef     = conduit.get(KW_ENVREF_FIELD);
  const conduitEffectful  = conduit.get(KW_EFFECTFUL_FIELD);

  // Effect-laundering safety net (same invariant as intrinsic operands).
  if (conduitEffectful && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCall({
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
    throw new ConduitArityMismatch({
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
  // wired by the construction site (letOperand for in-query
  // declarations, deserializeSession for restored bindings); both
  // perform the tie-the-knot pattern so the body resolves through
  // the env captured at declaration time. Reading `.env` directly
  // — no `?? state.env` fallback — is the explicit signal that
  // dynamic-scope drift is not a supported invocation path.
  let bodyEnv = conduitEnvRef.env;
  for (let i = 0; i < conduitParams.length; i++) {
    const paramProxy = makeConduitParameter(conduitLambdas[i], conduitParams[i]);
    bodyEnv = envSet(bodyEnv, conduitParams[i], paramProxy);
  }

  // Fork body: inner sub-pipeline starts with the caller's pipeValue
  // and the lexical bodyEnv. Body's env writes (let/as inside the
  // body) are discarded on return — only the final pipeValue escapes.
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
      throw new ConduitParameterNoCapturedArgs({
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
    docs: [`Conduit parameter '${paramName}': fires the captured expression against the current pipeValue.`],
    examples: [],
    throws: ['ConduitParameterNoCapturedArgs']
  });
}

// makeLambda(astNode, env) → (input) → value
//
// Constructs a closure that evaluates `astNode` as a sub-pipeline
// against any given input, in the env captured at construction
// time. Operand impls call lambdas to resolve captured args at
// the moment they need them.
//
// The `.astNode` property exposes the raw AST for reflective
// operands (like `let`) that need to store the body expression
// unevaluated for conduit construction and reify source rendering.
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
  if (isSnapshot(resolved)) resolved = resolved.get(KW_VALUE_FIELD);
  if (!(resolved instanceof Map)) return null;
  if (resolved.get(KW_QLANG_KIND_DISPATCH) !== KW_CONDUIT_DISPATCH) return null;
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
// this helper performs no arity check because the dispatching operand
// has already verified the arity.
export async function invokeConduitWithFixedArgs(conduit, lookupName, fixedArgs, pipeValue) {
  const conduitName      = conduit.get(KW_NAME_FIELD);
  const conduitParams    = conduit.get(KW_PARAMS_FIELD);
  const conduitBody      = conduit.get(KW_BODY_FIELD);
  const conduitEnvRef    = conduit.get(KW_ENVREF_FIELD);
  const conduitEffectful = conduit.get(KW_EFFECTFUL_FIELD);

  if (conduitEffectful && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCall({
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
export const KW_CONDUIT_PARAMS = KW_PARAMS_FIELD;

// ─── Step 6: comment (plain forms only — doc forms attach
// during parsing and never appear as standalone steps) ─────────

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
