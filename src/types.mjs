// Value type predicates and shape helpers.
//
// The language has four value types — Scalar, Vec, Map, Set — plus
// function values, thunks, and snapshots. JavaScript representations:
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
//   Thunk      → frozen object { type: 'thunk', name, expr, docs }
//                for `let`-bindings; `docs` is a Vec<string> of
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

export function isThunk(v) {
  return v !== null && typeof v === 'object' && v.type === 'thunk';
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

// ── thunk factory ──────────────────────────────────────────────
// Single canonical place that constructs `let`-thunk objects.
// Used by eval.mjs::evalLetStep. The `docs` Vec carries doc-comment
// contents attached by the parser (one entry per doc-comment token,
// in declaration order). The `location` field stores the source
// position of the originating LetStep so tooling and reify can
// answer "where was this binding declared".
export function makeThunk(expr, { name, docs = [], location = null } = {}) {
  return Object.freeze({
    type: 'thunk',
    name,
    expr,
    docs: Object.freeze(docs),
    location
  });
}

// ── snapshot factory ──────────────────────────────────────────
// Wraps a value captured by `as name`, carrying the binding name,
// any attached doc comments, and the source position of the
// originating AsStep. Identifier lookup unwraps the snapshot before
// returning it to the pipeline, so user code sees the raw value;
// reify reads the wrapper directly.
export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  return Object.freeze({
    type: 'snapshot',
    name,
    value,
    docs: Object.freeze(docs),
    location
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
  if (isThunk(v)) return 'thunk';
  if (isSnapshot(v)) return 'snapshot';
  return 'unknown';
}
