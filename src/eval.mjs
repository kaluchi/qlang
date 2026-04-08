// Top-level evaluator.
//
// Threads (pipeValue, env) state through pipeline steps. Dispatches
// on AST node `type` and delegates to the appropriate step or
// combinator implementation.
//
// Architecture: every node-type handler is a small function
// (state, node) → state'. The dispatcher is a switch.

import { parse } from './parse.mjs';
import {
  makeState, withPipeValue, envSet, envGet, envHas
} from './state.mjs';
import { fork, forkWith } from './fork.mjs';
import { applyRule10 } from './rule10.mjs';
import {
  QlangError,
  QlangTypeError,
  UnresolvedIdentifierError,
  EffectLaunderingAtCall
} from './errors.mjs';
import { classifyEffect } from './effect.mjs';
import {
  declareSubjectError,
  declareShapeError
} from './runtime/operand-errors.mjs';
import {
  isVec, isQMap, isThunk, isSnapshot, isFunctionValue,
  describeType, keyword, makeThunk, makeSnapshot, NIL
} from './types.mjs';
import { langRuntime } from './runtime/index.mjs';

const ProjectionSubjectNotMap = declareShapeError('ProjectionSubjectNotMap',
  ({ key, actualType }) => `/${key} requires Map subject, got ${actualType}`);
const DistributeSubjectNotVec = declareSubjectError('DistributeSubjectNotVec', '*', 'Vec');
const MergeSubjectNotVec      = declareSubjectError('MergeSubjectNotVec',      '>>', 'Vec');
const ApplyToNonFunction      = declareShapeError('ApplyToNonFunction',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType}, not a function`);

// evalQuery(source, env?) → final pipeValue
//
// Convenience entry point: parse + evaluate. If env is omitted,
// uses langRuntime as both initial env and pipeValue (per the
// model's reference bootstrap).
export function evalQuery(source, env) {
  const initialEnv = env ?? langRuntime();
  const ast = parse(source);
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
// new node type is one line here plus its handler function.
const NODE_HANDLERS = {
  Pipeline:          evalPipeline,
  NumberLit:         evalNumberLit,
  StringLit:         evalStringLit,
  BooleanLit:        evalBooleanLit,
  NilLit:            evalNilLit,
  Keyword:           evalKeyword,
  VecLit:            evalVecLit,
  MapLit:            evalMapLit,
  SetLit:            evalSetLit,
  Projection:        evalProjection,
  OperandCall:       evalOperandCall,
  AsStep:            evalAsStep,
  LetStep:           evalLetStep,
  ParenGroup:        evalParenGroup,
  LinePlainComment:  evalCommentStep,
  BlockPlainComment: evalCommentStep
};

function evalNode(node, state) {
  const handler = NODE_HANDLERS[node.type];
  if (!handler) {
    throw new QlangTypeError(`unknown AST node type: ${node.type}`);
  }
  // Source-location enrichment: any QlangError that bubbles past
  // here without a location yet picks up the location of `node`.
  // Deeper frames (closer to the throw site) win because they set
  // .location first and the `!e.location` guard prevents overwrite.
  try {
    return handler(node, state);
  } catch (e) {
    if (e instanceof QlangError && !e.location && node.location) {
      e.location = node.location;
    }
    throw e;
  }
}

// ─── Pipeline ───────────────────────────────────────────────────

function evalPipeline(node, state) {
  // Pipeline: { steps: [firstStep, { combinator, step }, ...] }
  let current = state;
  for (let i = 0; i < node.steps.length; i++) {
    const step = node.steps[i];
    if (i === 0) {
      current = evalNode(step, current);
    } else {
      current = applyCombinator(step.combinator, current, step.step);
    }
  }
  return current;
}

const COMBINATOR_HANDLERS = {
  '|':  (state, stepNode) => evalNode(stepNode, state),
  '*':  distribute,
  '>>': mergeFlat
};

function applyCombinator(kind, state, stepNode) {
  const handler = COMBINATOR_HANDLERS[kind];
  if (!handler) {
    throw new QlangTypeError(`unknown combinator: ${kind}`);
  }
  return handler(state, stepNode);
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

  if (!envHas(env, name)) {
    throw new UnresolvedIdentifierError(name);
  }

  let resolved = envGet(env, name);

  // Force a thunk written by `let` if encountered as a value.
  if (isThunk(resolved)) {
    resolved = forceThunk(resolved, state);
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

// makeLambda(astNode, env) → (input) → value
//
// Constructs a closure that evaluates `astNode` as a sub-pipeline
// against any given input, in the env captured at construction
// time. Operand impls call lambdas to resolve captured args at
// the moment they need them.
function makeLambda(astNode, env) {
  return (input) => {
    const subState = makeState(input, env);
    return evalNode(astNode, subState).pipeValue;
  };
}

// forceThunk(thunk, state) → resolved value
//
// Dynamic scope: evaluate the thunk's expression against the
// current state, not the binding-site state. The effect-laundering
// safety net lives in evalOperandCall, not here, because the
// laundering only matters at the moment a function value is
// invoked under a clean name — and identifier lookup is the
// single chokepoint for every function invocation.
function forceThunk(thunk, state) {
  const finalInnerState = fork(state, inner => evalNode(thunk.expr, inner));
  return finalInnerState.pipeValue;
}

// ─── Step 4: as name ────────────────────────────────────────────

function evalAsStep(node, state) {
  const docs = node.docs || [];
  const snapshot = makeSnapshot(state.pipeValue, {
    name: node.name,
    docs,
    location: node.location ?? null
  });
  const nextEnv = envSet(state.env, node.name, snapshot);
  return makeState(state.pipeValue, nextEnv);
}

// ─── Step 5: let name = expr ────────────────────────────────────

function evalLetStep(node, state) {
  const docs = node.docs || [];
  const thunk = makeThunk(node.body, {
    name: node.name,
    docs,
    location: node.location ?? null
  });
  const nextEnv = envSet(state.env, node.name, thunk);
  return makeState(state.pipeValue, nextEnv);
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
