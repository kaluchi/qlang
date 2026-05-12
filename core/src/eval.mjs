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
  EffectLaunderingAtCall,
  EffectLaunderingAtDefParse
} from './errors.mjs';
import { findFirstEffectfulIdentifier } from './effect-check.mjs';
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
  isVec, isQMap, isKeyword, isSnapshot, isFunctionValue, isErrorValue,
  typeKeyword, keyword, NULL, makeErrorValue, appendTrailNode,
  materializeTrail, makeQuote, makeDoc, makeJsonObject, makeJsonArray,
  isJsonObject, isJsonArray, isVecShape, isQuote,
  isJsonStoreable, makeConduit, makeSnapshot
} from './types.mjs';
import { astNodeToMap } from './walk.mjs';
import { errorFromQlang, errorFromForeign, errorFromParse } from './error-convert.mjs';
import { langRuntime } from './runtime/index.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import { parseDocSegments } from './doc-segments.mjs';

// Trail-fragment record stamped onto the linked-list head at every
// success-track combinator deflect site. `combinator` is one of the
// COMBINATOR_SYNTAX keys ('pipe' / 'distribute' / 'merge');
// `text` is the deflected step's source slice. materializeTrail
// joins fragments through COMBINATOR_SYNTAX into a single
// Quote-source carrying the pipeline-suffix as copy-pasteable code.
function trailEntry(stepNode, combinatorKind) {
  return Object.freeze({
    combinator: combinatorKind,
    text: stepNode.text
  });
}

const ProjectionSubjectNotMap = declareShapeError('ProjectionSubjectNotMap',
  ({ key, actualType }) => `/${key} requires Map subject, got ${actualType.name}`);
const TaggedLitTagNotFound = declareShapeError('TaggedLitTagNotFound',
  ({ tag }) => `::${tag} — type binding not found in env`);
const TaggedLitNotType = declareShapeError('TaggedLitNotType',
  ({ tag, actualType }) => `::${tag} — type binding is ${actualType.name}, expected a Map descriptor with :qlang/kind :type`);
const TaggedLitImplNotResolvable = declareShapeError('TaggedLitImplNotResolvable',
  ({ tag, actualType }) => `::${tag} — :qlang/impl is ${actualType.name}, expected a Keyword (built-in handle) or a Quote (qlang body)`);
const DistributeSubjectNotVec = declareSubjectError('DistributeSubjectNotVec', '*', 'Vec');
const MergeSubjectNotVec      = declareSubjectError('MergeSubjectNotVec',      '>>', 'Vec');
const ApplyToNonFunction      = declareShapeError('ApplyToNonFunction',
  ({ name, actualType }) => `cannot apply arguments to ${name}: resolves to ${actualType.name}, not a function`);
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
// model's reference bootstrap). The parsed AST is stamped into the
// env under `qlang/ast/inline` as a Quote so axis-operands
// (`source`, `docs`, `examples`) can find inline `def`-step
// bindings — without this, `def(:foo, …) | :foo | docs` would
// raise AxisBindingNotFound because `foo` lives in the just-parsed
// AST, not in any module Quote installed by use(:ns).
export async function evalQuery(source, env) {
  const initialEnv = env ?? await langRuntime();
  let ast;
  try {
    ast = parse(source);
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
  const envWithInlineAst = envSet(initialEnv, 'qlang/ast/inline', makeQuote(source, ast));
  const initialState = makeState(envWithInlineAst, envWithInlineAst);
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
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(stepNode, 'pipe')));
  }
  return await evalNode(stepNode, state);
}

async function distribute(state, bodyNode) {
  if (isErrorValue(state.pipeValue)) {
    return withPipeValue(state, appendTrailNode(state.pipeValue, trailEntry(bodyNode, 'distribute')));
  }
  if (!isVecShape(state.pipeValue)) {
    const distributeErr = new DistributeSubjectNotVec(state.pipeValue);
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
    const mergeErr = new MergeSubjectNotVec(state.pipeValue);
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
// degrades the container to a qlang Vec — `| json` downstream will
// then loud-fail on the qlang shape rather than silently emit a
// JsonArray of un-serialisable values.
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

// combineTrailQuotes(existing, fresh) — both arguments are either a
// Quote-value (carrying a pipeline-suffix source string) or null.
// Concatenates their `.source` strings with a single space when both
// present so the joined fragment remains a syntactically valid
// pipeline-suffix; when only one side carries a Quote, it passes
// through unchanged. null + null → null.
function combineTrailQuotes(existing, fresh) {
  if (existing === null) return fresh;
  if (fresh === null)    return existing;
  return makeQuote(existing.source + ' ' + fresh.source);
}

// ─── Step 1: Literals ───────────────────────────────────────────

function evalNumberLit(node, state)  { return withPipeValue(state, node.value); }
function evalStringLit(node, state)  { return withPipeValue(state, node.value); }
function evalBooleanLit(node, state) { return withPipeValue(state, node.value); }
function evalNullLit(_node, state)    { return withPipeValue(state, NULL); }
function evalKeyword(node, state)    { return withPipeValue(state, keyword(node.name)); }
// keyword() here creates a keyword VALUE for the pipeline — not a Map key.

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

// ::tag<payload> — type-namespace constructor invocation. Eval the
// payload sub-expression in a fork (inheriting outer pipeValue),
// look up the type binding under `::tag`, resolve its constructor,
// invoke against the payload-value. The result becomes the new
// pipeValue.
async function evalTaggedLit(node, state) {
  const payloadFork = await fork(state, inner => evalNode(node.payload, inner));
  const payloadValue = payloadFork.pipeValue;
  const typeKey = '::' + node.tag;
  if (!envHas(state.env, typeKey)) {
    throw new TaggedLitTagNotFound({ tag: node.tag });
  }
  let typeBinding = envGet(state.env, typeKey);
  if (isSnapshot(typeBinding)) typeBinding = typeBinding.get('qlang/value');
  if (!isQMap(typeBinding)) {
    throw new TaggedLitNotType({ tag: node.tag, actualType: typeKeyword(typeBinding), actualValue: typeBinding });
  }
  // :qlang/impl carries either a `:qlang/prim/<tag>` keyword (built-in
  // type — resolved through PRIMITIVE_REGISTRY at every invocation so
  // reify(::tag) keeps the readable handle, not a JS-source dump) or
  // a Quote-value (user-defined type — payload becomes pipeValue, the
  // Quote body runs against the current env).
  const implKey = typeBinding.get('qlang/impl');
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
  throw new TaggedLitImplNotResolvable({ tag: node.tag, actualType: typeKeyword(implKey), actualValue: implKey });
}

// ::tag — bare reference to the type binding. Returns the
// descriptor Map directly so axis-operands like `::tag | spec` /
// `::tag | docs` can project off it.
async function evalBareTypeKeyword(node, state) {
  const typeKey = '::' + node.tag;
  if (!envHas(state.env, typeKey)) {
    throw new TaggedLitTagNotFound({ tag: node.tag });
  }
  let typeBinding = envGet(state.env, typeKey);
  if (isSnapshot(typeBinding)) typeBinding = typeBinding.get('qlang/value');
  return withPipeValue(state, typeBinding);
}

// BindStep — declarative binding form. Transparent for pipeValue
// (env-write only). Body AST is captured verbatim — never eval'd
// at decl-time — and bound under the key either as a Conduit
// (body present, lazy invocation against future pipeValue) or as
// a Doc-value snapshot (only docs present, materialized from the
// prefix). Identifier-lookup later sees the bound value and
// dispatches according to its kind.
//
// Effect-laundering AST scan runs at decl-time on the body: a
// non-@-prefixed name with an effectful body raises the
// EffectLaunderingAtDefParse invariant before any binding gets
// installed.
async function evalBindStep(node, state) {
  const name = node.key.type === 'BareTypeKeyword'
    ? '::' + node.key.tag
    : node.key.name;

  if (node.body === null) {
    // doc-only form — bind Doc-value materialized from the prefix.
    const bound = makeSnapshot(makeDoc(node.docs.join('\n')), {
      name, docs: node.docs, location: node.location
    });
    return makeState(state.pipeValue, envSet(state.env, name, bound));
  }

  // Body present — captured into a Conduit. Pure literal bodies
  // produce a constant value at invocation (body's eval ignores
  // pipeValue, replaces with the literal). pipeValue-aware bodies
  // (OperandCall, Projection, Pipeline) operate on the invocation-
  // site pipeValue. No purity-routing at this layer — the body's
  // AST shape decides invocation behaviour.
  if (!classifyEffect(name)) {
    const offender = findFirstEffectfulIdentifier(node.body);
    if (offender !== null) {
      throw new EffectLaunderingAtDefParse({
        defName: name,
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
    docs: node.docs || [],
    location: node.body.location
  });
  const nextEnv = envSet(state.env, name, conduit);
  envRef.env = nextEnv;
  return makeState(state.pipeValue, nextEnv);
}

async function evalSetLit(node, state) {
  const setResult = new Set();
  const kwNames = new Set();
  for (const setElem of node.elements) {
    const elemFork = await fork(state, inner => evalNode(setElem, inner));
    const val = elemFork.pipeValue;
    if (isKeyword(val)) {
      if (kwNames.has(val.name)) continue;
      kwNames.add(val.name);
    }
    setResult.add(val);
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
    projectionCurrent = await projectSegment(projectionCurrent, projKey, state);
    // Snapshots are transparent value wrappers — unwrap during
    // projection so user code sees the raw captured value. The
    // wrapper itself is reachable only via reify, which reads env
    // directly without going through projection.
    if (isSnapshot(projectionCurrent)) projectionCurrent = projectionCurrent.get('qlang/value');
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
  if (subject !== null && typeof subject === 'object') {
    const handlers = PROJECTABLE_BY_TYPE[subject.type];
    if (handlers) {
      const handler = handlers[projKey];
      return handler ? handler(subject, state) : NULL;
    }
  }
  if (isJsonObject(subject)) {
    return Object.hasOwn(subject, projKey) ? subject[projKey] : NULL;
  }
  if (isQMap(subject)) {
    return subject.has(projKey) ? subject.get(projKey) : NULL;
  }
  if (isJsonArray(subject) || isVec(subject)) {
    if (!INTEGER_SEGMENT_RE.test(projKey)) return NULL;
    const segmentIndex = parseInt(projKey, 10);
    const resolvedIndex = segmentIndex < 0 ? subject.length + segmentIndex : segmentIndex;
    return (resolvedIndex >= 0 && resolvedIndex < subject.length) ? subject[resolvedIndex] : NULL;
  }
  throw new ProjectionSubjectNotMap({
    key: projKey,
    actualType: typeKeyword(subject),
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

function isBuiltinDescriptor(m) {
  const v = m.get('qlang/kind');
  return v && v.name === 'builtin';
}
function isConduitDescriptor(m) {
  const v = m.get('qlang/kind');
  return v && v.name === 'conduit';
}

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
  // without going through evalOperandCall. Unwrapping upstream of
  // applyBindingDescriptor keeps the :qlang/kind switch exhaustive
  // over {:builtin, :conduit}; the remaining non-Map branches handle
  // conduit-parameter proxies (isFunctionValue) and plain user values
  // (tail) — and preserves the "snapshot wrapping an effectful
  // function value" safety-net path documented in the effect-marker
  // section of qlang-spec.md.
  if (isSnapshot(resolved)) {
    resolved = resolved.get('qlang/value');
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
      actualType: typeKeyword(resolved),
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
  if (isBuiltinDescriptor(descriptor)) {
    return await applyBuiltinDescriptor(descriptor, node, lookupName, state);
  }
  if (isConduitDescriptor(descriptor)) {
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
  reified.set('kind', keyword('builtin'));
  reified.set('name', introspectionName);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    if (fieldKey === 'qlang/kind' || fieldKey === 'qlang/impl') continue;
    reified.set(fieldKey, fieldVal);
  }
  reified.set('captured', [...implFn.meta.captured]);
  reified.set('effectful', implFn.effectful);
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
  const resolvedImpl = descriptor.get('qlang/impl');

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
  const conduitName       = conduit.get('name');
  const conduitParams     = conduit.get('params');
  const conduitBody       = conduit.get('qlang/body');
  const conduitEnvRef     = conduit.get('qlang/envRef');
  const conduitEffectful  = conduit.get('effectful');

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
  // wired by the construction site (defOperand for in-query
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
  // and the lexical bodyEnv. Body's env writes (def/as inside the
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
  if (isSnapshot(resolved)) resolved = resolved.get('qlang/value');
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
// this helper performs no arity check because the dispatching operand
// has already verified the arity.
export async function invokeConduitWithFixedArgs(conduit, lookupName, fixedArgs, pipeValue) {
  const conduitName      = conduit.get('name');
  const conduitParams    = conduit.get('params');
  const conduitBody      = conduit.get('qlang/body');
  const conduitEnvRef    = conduit.get('qlang/envRef');
  const conduitEffectful = conduit.get('effectful');

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
export const CONDUIT_PARAMS_FIELD = 'params';

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
