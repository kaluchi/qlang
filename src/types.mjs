// Value type predicates and shape helpers.
//
// The language has four value types — Scalar, Vec, Map, Set — plus
// function values, conduits, and snapshots. JavaScript representations:
//
//   Scalar     → number, string, boolean, null (for nil),
//                or an interned keyword object
//                ({ type: 'keyword', name: string })
//   Vec        → JS Array
//   Map        → JS Map (insertion-ordered, keys are interned
//                keyword objects)
//   Set        → JS Set
//   Function   → frozen object { type: 'function', name, arity,
//                fn, meta }  where `fn` is a state transformer
//                (state, lambdas) → state and `meta` carries the
//                operand's documentation/contract for `reify`
//   Conduit    → frozen object { type: 'conduit', name, params,
//                body, envRef, docs, location, effectful } for
//                `let`-bindings (parametric pipeline fragments with
//                0..N parameters and lexical scope via envRef
//                tie-the-knot); `docs` is a Vec<string> of
//                doc-comment contents attached at parse time
//   Snapshot   → frozen object { type: 'snapshot', name, value, docs }
//                for `as`-bindings; `docs` is a Vec<string> of
//                doc-comment contents attached at parse time. The
//                snapshot wraps the captured value so reify can
//                report :name and :docs by name. Identifier lookup
//                automatically unwraps snapshots before returning
//                them to the pipeline.

export const NIL = null;

// ── primitive type predicates ──────────────────────────────────

export function isNil(v) { return v === null || v === undefined; }
export function isBoolean(v) { return typeof v === 'boolean'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isString(v) { return typeof v === 'string'; }
export function isKeyword(v) {
  return v !== null && typeof v === 'object' && v.type === 'keyword';
}
export function isVec(v) { return Array.isArray(v); }
export function isQMap(v) { return v instanceof Map; }
export function isQSet(v) { return v instanceof Set; }

// ── language value-class predicates ────────────────────────────

export function isFunctionValue(v) {
  return v !== null && typeof v === 'object' && v.type === 'function';
}

export function isConduit(v) {
  return v !== null && typeof v === 'object' && v.type === 'conduit';
}

export function isSnapshot(v) {
  return v !== null && typeof v === 'object' && v.type === 'snapshot';
}

// ── truthiness ─────────────────────────────────────────────────
// nil and false are falsy; everything else is truthy (including
// 0, "", [], {}, #{}).
export function isTruthy(v) {
  return v !== null && v !== undefined && v !== false;
}

// ── keyword interning ──────────────────────────────────────────
// Two calls with the same name return the same object so JS Map
// identity works as a Map key.
const KEYWORD_INTERN = new Map();
export function keyword(name) {
  const cached = KEYWORD_INTERN.get(name);
  if (cached) return cached;
  const fresh = Object.freeze({ type: 'keyword', name });
  KEYWORD_INTERN.set(name, fresh);
  return fresh;
}

// ── conduit factory ────────────────────────────────────────────
// Single canonical place that constructs conduit objects. A conduit
// is a named pipeline fragment with 0..N parameters, lexical scope
// via envRef (tie-the-knot for recursive self-binding), and an AST
// body that evaluates in a fork at each call site. Zero-arity
// conduits are the degenerate case (no parameters).
//
// The `params` field is an array of parameter name strings (empty
// for zero-arity). The `envRef` field is a mutable reference holder
// `{ env: Map }` whose `.env` is set by the `let` operand impl immediately after
// the conduit is inserted into the env — the lexical scope anchor
// for fractal composition and library-safe scoping.
//
// The `docs` Vec carries doc-comment contents attached by the parser.
// The `location` field stores the source position of the originating
// conduit declaration. The `effectful` field classifies the binding name against
// the @-effect-marker convention (see src/effect.mjs).
import { classifyEffect } from './effect.mjs';

export function makeConduit(body, { name, params = [], envRef = null, docs = [], location = null } = {}) {
  return Object.freeze({
    type: 'conduit',
    name,
    params: Object.freeze([...params]),
    body,
    envRef,
    docs: Object.freeze(docs),
    location,
    effectful: classifyEffect(name)
  });
}


// ── snapshot factory ──────────────────────────────────────────
// Wraps a value captured by `as name`, carrying the binding name,
// any attached doc comments, and the source position of the
// originating snapshot declaration. Identifier lookup unwraps the snapshot before
// returning it to the pipeline, so user code sees the raw value;
// reify reads the wrapper directly.
export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  return Object.freeze({
    type: 'snapshot',
    name,
    value,
    docs: Object.freeze(docs),
    location,
    effectful: classifyEffect(name)
  });
}

// ── describeType — short labels used in error messages ─────────

export function describeType(v) {
  if (isNil(v)) return 'nil';
  if (isBoolean(v)) return 'boolean';
  if (isNumber(v)) return 'number';
  if (isString(v)) return 'string';
  if (isKeyword(v)) return 'keyword';
  if (isVec(v)) return 'Vec';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isFunctionValue(v)) return 'function';
  if (isConduit(v)) return 'conduit';
  if (isSnapshot(v)) return 'snapshot';
  return 'unknown';
}
