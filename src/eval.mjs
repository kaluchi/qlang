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
} from './runtime/operand-errors.mjs';
import { QlangInvariantError } from './errors.mjs';

class UnknownAstNodeTypeError extends QlangInvariantError {
  constructor(nodeType) {
    super(`unknown AST node type: ${nodeType}`, { site: 'UnknownAstNodeTypeError', nodeType });
    this.name = 'UnknownAstNodeTypeError';
    this.fingerprint = 'UnknownAstNodeTypeError';
  }
}

class UnknownCombinatorKindError extends QlangInvariantError {
  constructor(kind) {
    super(`unknown combinator: ${kind}`, { site: 'UnknownCombinatorKindError', kind });
    this.name = 'UnknownCombinatorKindError';
    this.fingerprint = 'UnknownCombinatorKindError';
  }
}
import {
  isVec, isQMap, isConduit, isSnapshot, isFunctionValue, isErrorValue,
  describeType, keyword, NIL, makeErrorValue, appendTrailNode,
  materializeTrail
} from './types.mjs';
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

// evalQuery(source, env?) → final pipeValue
//
// Convenience entry point: parse + evaluate. If env is omitted,
// uses langRuntime as both initial env and pipeValue (per the
// model's reference bootstrap).
export function evalQuery(source, env) {
  const initialEnv = env ?? langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    return errorFromParse(e);
  }
  const initialState = makeState(initialEnv, initialEnv);
  const finalState = evalNode(ast, initialState);
  return finalState.pipeValue;
}

// evalAst(ast, state) → state'
//
// Dispatches on the AST node type and returns the new state.
// Public so callers can drive their own initial state.
export function evalAst(ast, state) {
  return evalNode(ast, state);
}

// Lookup-table dispatcher: one entry per AST node type. Adding a
// new node type is one line here plus its evaluator function.
const AST_NODE_EVALUATORS = {
  Pipeline:          evalPipeline,
  NumberLit:         evalNumberLit,
  StringLit:         evalStringLit,
  BooleanLit:        evalBooleanLit,
  NilLit:            evalNilLit,
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

// Error propagation: nodes that are entered (children decide
// individually) vs nodes that are skipped (error passes through).
// OperandCall is neither — it checks errorAware inside its evaluator.
// Comments are silent: skipped with no trail entry (routed through the
// else block via PROPAGATION_SILENT, not the enter block).
const PROPAGATION_ENTER = new Set(['Pipeline', 'ParenGroup']);
const PROPAGATION_SILENT = new Set(['LinePlainComment', 'BlockPlainComment']);

function evalNode(node, state) {
  const evaluator = AST_NODE_EVALUATORS[node.type];
  if (!evaluator) throw new UnknownAstNodeTypeError(node.type);

  if (isErrorValue(state.pipeValue) && node.type !== 'OperandCall') {
    if (PROPAGATION_ENTER.has(node.type)) {
      // Pipeline, ParenGroup — enter, children decide
    } else {
      // Everything else — skip with trail (unless silent comment)
      return PROPAGATION_SILENT.has(node.type)
        ? state
        : withPipeValue(state, appendTrailNode(state.pipeValue, node));
    }
  }

  try {
    return evaluator(node, state);
  } catch (e) {
    if (e instanceof QlangError && !e.location && node.location)
      e.location = node.location;
    if (e instanceof QlangInvariantError) throw e;
    return withPipeValue(state,
      e instanceof QlangError ? errorFromQlang(e, node) : errorFromForeign(e, node));
  }
}

// ─── Pipeline ───────────────────────────────────────────────────

function evalPipeline(node, state) {
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
        ? applyCombinator('!|', current, step)
        : evalNode(step, current);
    } else {
      current = applyCombinator(step.combinator, current, step.step);
    }
  }
  return current;
}

const COMBINATOR_EVALUATORS = {
  '|':  (state, stepNode) => evalNode(stepNode, state),
  '!|': applyFailTrack,
  '*':  distribute,
  '>>': mergeFlat
};

function applyCombinator(kind, state, stepNode) {
  const evaluator = COMBINATOR_EVALUATORS[kind];
  if (!evaluator) {
    throw new UnknownCombinatorKindError(kind);
  }
  return evaluator(state, stepNode);
}

function distribute(state, bodyNode) {
  if (!isVec(state.pipeValue)) {
    throw new DistributeSubjectNotVec(describeType(state.pipeValue), state.pipeValue);
  }
  const collected = state.pipeValue.map(item =>
    forkWith(state, item, inner => evalNode(bodyNode, inner)).pipeValue
  );
  return withPipeValue(state, collected);
}

function mergeFlat(state, nextNode) {
  if (!isVec(state.pipeValue)) {
    throw new MergeSubjectNotVec(describeType(state.pipeValue), state.pipeValue);
  }
  const flattened = [];
  for (const item of state.pipeValue) {
    if (isVec(item)) flattened.push(...item);
    else flattened.push(item);
  }
  return evalNode(nextNode, withPipeValue(state, flattened));
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
function applyFailTrack(state, stepNode) {
  if (!isErrorValue(state.pipeValue)) return state;
  const err = state.pipeValue;
  const combinedTrail = [
    ...err.descriptor.get(keyword('trail')),
    ...materializeTrail(err)
  ];
  const materializedDescriptor = new Map(err.descriptor);
  materializedDescriptor.set(keyword('trail'), combinedTrail);
  return evalNode(stepNode, withPipeValue(state, materializedDescriptor));
}

// ─── Step 1: Literals ───────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNilLit(_node, state)    { return withPipeValue(state, NIL); }
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }

function evalVecLit(node, state) {
  // Each element is a sub-pipeline forked against the outer state.
  const collected = node.elements.map(elem =>
    fork(state, inner => evalNode(elem, inner)).pipeValue
  );
  return withPipeValue(state, collected);
}

function evalMapLit(node, state) {
  // Each value is a sub-pipeline forked against the outer state.
  // Keys are keyword AST nodes; we resolve them to interned keywords.
  const result = new Map();
  for (const entry of node.entries) {
    const key = keyword(entry.key.name);
    const value = fork(state, inner => evalNode(entry.value, inner)).pipeValue;
    result.set(key, value);
  }
  return withPipeValue(state, result);
}

function evalErrorLit(node, state) {
  // Same entry evaluation as MapLit, but wraps in error value.
  const descriptor = new Map();
  for (const entry of node.entries) {
    const key = keyword(entry.key.name);
    const value = fork(state, inner => evalNode(entry.value, inner)).pipeValue;
    descriptor.set(key, value);
  }
  return withPipeValue(state, makeErrorValue(descriptor, { location: node.location }));
}

function evalSetLit(node, state) {
  const result = new Set();
  for (const elem of node.elements) {
    const value = fork(state, inner => evalNode(elem, inner)).pipeValue;
    result.add(value);
  }
  return withPipeValue(state, result);
}

// ─── Step 2: Projection ─────────────────────────────────────────

function evalProjection(node, state) {
  let current = state.pipeValue;
  for (const key of node.keys) {
    if (!isQMap(current)) {
      throw new ProjectionSubjectNotMap({
        key,
        actualType: describeType(current),
        actualValue: current
      });
    }
    current = current.has(keyword(key)) ? current.get(keyword(key)) : NIL;
    // Snapshots are transparent value wrappers — unwrap during
    // projection so user code sees the raw captured value. The
    // wrapper itself is reachable only via reify, which reads env
    // directly without going through projection.
    if (isSnapshot(current)) current = current.value;
  }
  return withPipeValue(state, current);
}

// ─── Step 3: Identifier lookup with optional captured args ──────

function evalOperandCall(node, state) {
  const name = node.name;
  const env = state.env;

  // Error propagation: if pipeValue is an error, check whether the
  // resolved binding is error-aware. If not, skip (propagate with
  // trail). Resolve just enough to check the flag — don't force
  // conduits or trigger side effects.
  if (isErrorValue(state.pipeValue)) {
    const resolved = envHas(env, name) ? envGet(env, name) : null;
    const aware = (resolved && isFunctionValue(resolved) && resolved.errorAware)
               || isConduit(resolved);  // conduits are transparent — their body decides
    if (!aware) {
      return withPipeValue(state, appendTrailNode(state.pipeValue, node));
    }
    // Fall through — error-aware operand or conduit receives the error value
  }

  if (!envHas(env, name)) {
    throw new UnresolvedIdentifierError(name);
  }

  let resolved = envGet(env, name);

  // Apply a conduit (parametric or zero-arity pipeline fragment).
  // Conduits carry an AST body, an optional param list, and a
  // lexical envRef for fractal composition.
  if (isConduit(resolved)) {
    return applyConduit(resolved, node, name, state);
  }

  // Unwrap a snapshot written by `as` so user code sees the raw
  // captured value. The wrapper carries name + docs metadata for
  // reify but is transparent to ordinary pipeline operations.
  if (isSnapshot(resolved)) {
    resolved = resolved.value;
  }

  const capturedArgsAst = node.args; // null for bare ident, [] for f(), [...] for f(a,b)

  if (isFunctionValue(resolved)) {
    // Effect-laundering safety net: if the resolved function is
    // effectful but the lookup name we used is not @-prefixed, we
    // refuse the call. This catches every laundering path the
    // parse-time AST scan cannot see — installation via use,
    // capture via as, or rebinding via session.bind — because
    // every effectful invocation ultimately flows through an
    // identifier lookup at this point. The check reads precomputed
    // boolean fields (.effectful on the function value, classifyEffect
    // on the lookup name) so the runtime hot path performs no
    // substring inspection beyond the single classifyEffect call.
    if (resolved.effectful && !classifyEffect(name)) {
      throw new EffectLaunderingAtCall({
        bindingName: name,
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
    const lambdas = capturedArgsAst === null
      ? []
      : capturedArgsAst.map(arg => makeLambda(arg, capturedEnv));
    // Stash doc comments from the OperandCall node on the lambdas
    // array so reflective binding operands (let, as) can access
    // them without changing the fn(state, lambdas) dispatch signature.
    lambdas.docs = node.docs || [];
    lambdas.location = node.location ?? null;
    return applyRule10(resolved, lambdas, state);
  }

  // Non-function value: replace pipeValue with it. Captured args
  // would be a type error since you cannot apply a non-function.
  if (capturedArgsAst !== null) {
    throw new ApplyToNonFunction({
      name,
      actualType: describeType(resolved),
      actualValue: resolved
    });
  }
  return withPipeValue(state, resolved);
}

// applyConduit(conduit, node, lookupName, state) → state'
//
// Dispatches a conduit call — the "bonus fruit" in the Pac-man model.
// Builds conduit-parameter proxies (lazy nullary function values) from
// captured-arg lambdas, constructs a bodyEnv from the lexical envRef
// anchor plus the params, forks the body, and ascends with only the
// final pipeValue. The entire operation is one atomic state
// transformation from the outer pipeline's perspective.
function applyConduit(conduit, node, lookupName, state) {
  // Effect-laundering safety net (same invariant as intrinsic operands).
  if (conduit.effectful && !classifyEffect(lookupName)) {
    throw new EffectLaunderingAtCall({
      bindingName: lookupName,
      effectfulName: conduit.name
    });
  }

  const capturedArgsAst = node.args;
  const expectedArity = conduit.params.length;

  // Build lambdas from captured args at the call site.
  const capturedEnv = state.env;
  const lambdas = capturedArgsAst === null
    ? []
    : capturedArgsAst.map(arg => makeLambda(arg, capturedEnv));

  // Arity check: exact match required. No auto-curry — partial
  // application is achieved through zero-arity conduit aliases and parametric
  // forwarding patterns (fractal composition).
  if (lambdas.length !== expectedArity) {
    throw new ConduitArityMismatch({
      conduitName: conduit.name,
      expectedArity,
      actualArity: lambdas.length
    });
  }

  // Build bodyEnv: start from the lexical scope anchor (envRef.env),
  // then layer conduit-parameter proxies on top. Each param proxy is
  // a nullary function value that fires the captured-arg lambda
  // against whatever pipeValue the identifier lookup sees at the
  // moment — this is the lazy binding that enables higher-order
  // composition (params fire per-element inside sortWith, per-
  // iteration inside filter, etc.).
  //
  // Fallback to state.env when envRef is absent (e.g. deserialized
  // conduits that haven't been wired to an envRef yet).
  let bodyEnv = conduit.envRef?.env ?? state.env;
  for (let i = 0; i < conduit.params.length; i++) {
    const paramProxy = makeConduitParameter(lambdas[i], conduit.params[i]);
    bodyEnv = envSet(bodyEnv, conduit.params[i], paramProxy);
  }

  // Fork body: inner sub-pipeline starts with the caller's pipeValue
  // and the lexical bodyEnv. Body's env writes (let/as inside the
  // body) are discarded on return — only the final pipeValue escapes.
  const bodyState = makeState(state.pipeValue, bodyEnv);
  const finalBodyState = evalNode(conduit.body, bodyState);
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
  // they have no manifest.qlang entry.
  return makeFn(paramName, 1, (state, lambdas) => {
    if (lambdas.length !== 0) {
      throw new ConduitParameterNoCapturedArgs({
        paramName,
        actualCount: lambdas.length
      });
    }
    return withPipeValue(state, capturedArgLambda(state.pipeValue));
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
function makeLambda(astNode, env) {
  const lambda = (input) => {
    const subState = makeState(input, env);
    return evalNode(astNode, subState).pipeValue;
  };
  lambda.astNode = astNode;
  return lambda;
}

// ─── Step 6: comment (plain forms only — doc forms attach
// during parsing and never appear as standalone steps) ─────────

function evalCommentStep(_node, state) {
  // Identity: state passes through unchanged. The comment node is
  // visible in the AST for reflection/source manipulation but has
  // no runtime effect.
  return state;
}

// ─── ParenGroup ─────────────────────────────────────────────────

function evalParenGroup(node, state) {
  return fork(state, inner => evalNode(node.pipeline, inner));
}
