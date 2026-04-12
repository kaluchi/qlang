// Value type predicates and shape helpers.
//
// The language has five value types — Scalar, Vec, Map, Set, Error — plus
// function values (conduit-parameter proxies, ephemeral and per-call),
// conduits, and snapshots. JavaScript representations:
//
//   Scalar     → number, string, boolean, null,
//                or an interned keyword object
//                ({ type: 'keyword', name: string })
//   Vec        → JS Array
//   Map        → JS Map (insertion-ordered, keys are interned
//                keyword objects)
//   Set        → JS Set
//   Function   → frozen object { type: 'function', name, arity,
//                fn, meta } where `fn` is a state transformer
//                (state, lambdas) → state and `meta` carries the
//                operand's `captured` range. Under Variant-B these
//                appear only as conduit-parameter proxies inside
//                a conduit body's evaluation; the named binding
//                catalog uses descriptor Maps instead.
//   Conduit    → JS Map descriptor with :qlang/kind :conduit,
//                :name, :params, :qlang/body (parsed AST),
//                :qlang/envRef (mutable lexical anchor for
//                tie-the-knot recursion), :docs, :location,
//                :effectful. Constructed by `let` operand and by
//                `deserializeSession`. Identifier lookup dispatches
//                conduits as parametric pipeline fragments.
//   Snapshot   → JS Map descriptor with :qlang/kind :snapshot,
//                :name, :qlang/value (the wrapped value), :docs,
//                :location, :effectful. Constructed by `as` operand.
//                Identifier lookup and `/key` projection auto-unwrap
//                the :qlang/value so user code sees the raw value;
//                reify reads the wrapper Map directly.
//   Error      → frozen object { type: 'error', descriptor, ... }
//                where `descriptor` is a Map carrying the user-
//                visible failure shape. The fifth qlang value type;
//                rides the fail-track via the :trail invariant.

export const NULL = null;

// ── primitive type predicates ──────────────────────────────────

export function isNull(v) { return v === null || v === undefined; }
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

export function isErrorValue(v) {
  return v !== null && typeof v === 'object' && v.type === 'error';
}

// ── truthiness ─────────────────────────────────────────────────
// null and false are falsy; everything else is truthy (including
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

// ── conduit / snapshot descriptor predicates ───────────────────
//
// Conduit and snapshot are Variant-B descriptor Maps carrying a
// `:qlang/kind` discriminator (`:conduit` or `:snapshot`). The
// builtin catalog uses the same shape under `:qlang/kind :builtin`,
// so a single Map family covers every named binding kind in env.
// Interning the discriminator keywords once at module load lets
// every predicate / dispatch site read them via native Map.get
// without re-walking `keyword(...)` per call.
const KW_QLANG_KIND = keyword('qlang/kind');
const KW_CONDUIT    = keyword('conduit');
const KW_SNAPSHOT   = keyword('snapshot');

export function isConduit(v) {
  return v instanceof Map && v.get(KW_QLANG_KIND) === KW_CONDUIT;
}

export function isSnapshot(v) {
  return v instanceof Map && v.get(KW_QLANG_KIND) === KW_SNAPSHOT;
}

// ── conduit / snapshot field keywords ──────────────────────────
//
// Variant-B descriptor field set, interned once. The unnamespaced
// keys (`:name`, `:params`, `:docs`, `:location`, `:effectful`) are
// the same names a user reads via `reify` projection — descriptor
// shape is the user-visible shape, no internal renaming. The
// namespaced keys (`:qlang/body`, `:qlang/envRef`, `:qlang/value`)
// carry runtime-internal payload that user code does not address
// directly: `:qlang/body` holds the parsed AST node, `:qlang/envRef`
// holds the JS-side mutable lexical anchor for tie-the-knot
// recursion, `:qlang/value` holds a snapshot's wrapped value behind
// the auto-unwrap performed by identifier lookup and projection.
const KW_NAME      = keyword('name');
const KW_PARAMS    = keyword('params');
const KW_DOCS      = keyword('docs');
const KW_LOCATION  = keyword('location');
const KW_EFFECTFUL = keyword('effectful');
const KW_BODY      = keyword('qlang/body');
const KW_ENVREF    = keyword('qlang/envRef');
const KW_VALUE     = keyword('qlang/value');

// ── conduit factory ────────────────────────────────────────────
// Single canonical place that constructs conduit descriptor Maps.
// A conduit is a named pipeline fragment with 0..N parameters,
// lexical scope via :qlang/envRef (tie-the-knot for recursive
// self-binding), and an AST body under :qlang/body that evaluates
// in a fork at each call site. Zero-arity conduits are the
// degenerate case (no parameters).
//
// :params is a Vec of parameter name strings (empty for zero-arity).
// :qlang/envRef is a mutable JS-side holder `{ env: Map }` whose
//   .env is set by letOperand or deserializeSession after the
//   conduit lands in env — the lexical scope anchor for fractal
//   composition and library-safe scoping.
// :docs is a Vec of doc-comment contents attached by the parser.
// :location stores the source position of the originating let call.
// :effectful is the precomputed @-prefix classification of the
//   binding name (see src/effect.mjs).
//
// The result is a frozen-by-convention Map: nothing in the runtime
// mutates a constructed conduit at the language level, and any host
// that does is in violation of the immutability contract.
import { classifyEffect } from './effect.mjs';

export function makeConduit(body, { name, params = [], envRef = null, docs = [], location = null } = {}) {
  const m = new Map();
  m.set(KW_QLANG_KIND, KW_CONDUIT);
  m.set(KW_NAME, name);
  m.set(KW_PARAMS, Object.freeze([...params]));
  m.set(KW_BODY, body);
  m.set(KW_ENVREF, envRef);
  m.set(KW_DOCS, Object.freeze([...docs]));
  m.set(KW_LOCATION, location);
  m.set(KW_EFFECTFUL, classifyEffect(name));
  return m;
}

// ── snapshot factory ──────────────────────────────────────────
// Wraps a value captured by `as name` into a Variant-B snapshot
// descriptor Map carrying :qlang/kind :snapshot. The wrapped value
// lives under :qlang/value behind the auto-unwrap performed by
// identifier lookup and projection — user code that reads the
// snapshot by name sees the raw value; reify reads the descriptor
// Map directly to expose :name, :docs, :location.
export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  const m = new Map();
  m.set(KW_QLANG_KIND, KW_SNAPSHOT);
  m.set(KW_NAME, name);
  m.set(KW_VALUE, value);
  m.set(KW_DOCS, Object.freeze([...docs]));
  m.set(KW_LOCATION, location);
  m.set(KW_EFFECTFUL, classifyEffect(name));
  return m;
}

// ── rename factory ───────────────────────────────────────────
// Produces a new conduit or snapshot with a different binding name,
// preserving every payload field and recomputing :effectful from
// the new name. Used by rename-refactoring tooling to re-derive the
// effect-marker classification after an identifier rename.
export function withName(binding, newName) {
  if (isConduit(binding)) {
    return makeConduit(binding.get(KW_BODY), {
      name: newName,
      params: [...binding.get(KW_PARAMS)],
      envRef: binding.get(KW_ENVREF),
      docs: [...binding.get(KW_DOCS)],
      location: binding.get(KW_LOCATION)
    });
  }
  if (isSnapshot(binding)) {
    return makeSnapshot(binding.get(KW_VALUE), {
      name: newName,
      docs: [...binding.get(KW_DOCS)],
      location: binding.get(KW_LOCATION)
    });
  }
  return binding;
}

// ── error value factory ───────────────────────────────────────
// Wraps a descriptor Map into an opaque error value — the 5th
// qlang value type. Error values ride the fail-track: the `|`, `*`,
// and `>>` combinators deflect them (appending to the trail), while
// the `!|` combinator fires its step against the materialized
// descriptor Map.
//
// INVARIANT: every error value's descriptor carries `:trail` as a
// Vec. This constructor enforces the invariant — if the caller did
// not put `:trail` into the descriptor, we add an empty Vec. Hot-path
// readers in `eval.mjs::applyFailTrack` rely on this and never
// defend against a missing `:trail` field.
//
// The `_trailHead` field is an internal linked list of deflected AST
// nodes accumulated since the last materialization. It is combined
// with the descriptor's `:trail` Vec at each `!|` entry point to
// produce the full trail for the step to observe.
//
// The `originalError` field preserves the original JS Error (if any)
// for host-boundary re-throwing. Not visible from qlang.

// Interned once to avoid per-construction allocation of the trail
// key and the empty-trail Vec inserted when the caller omits
// :trail. The empty Vec is shared across freshly-constructed errors
// — safe because it is frozen and qlang values are immutable at the
// language level.
const TRAIL_KEY = keyword('trail');
const EMPTY_TRAIL = Object.freeze([]);

export function makeErrorValue(descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (!descriptor.has(TRAIL_KEY)) {
    finalDescriptor = new Map(descriptor);
    finalDescriptor.set(TRAIL_KEY, EMPTY_TRAIL);
  }
  return Object.freeze({
    type: 'error',
    descriptor: finalDescriptor,
    location,
    originalError,
    _trailHead: null
  });
}

// appendTrailNode(errorValue, trailEntry) → new frozen error value
// with `trailEntry` prepended to the linked list that materializes
// into the descriptor's :trail Vec under a `!|` fire. The caller
// supplies `trailEntry` as an already-qlang-shaped value — typically
// the Map produced by `astNodeToMap` on the deflected step AST node,
// which makes the trail entry a structurally-addressable AST-Map
// with :name / :args / :location / :text fields a downstream
// consumer can filter, project, or re-eval as ordinary qlang data.
//
// Storing the entry verbatim keeps this module ignorant of AST shape
// (walk.mjs owns `astNodeToMap`, types.mjs stays a pure value-class
// module). Any qlang value is acceptable as an entry; the
// materialize-time reader hands it back without inspection.
export function appendTrailNode(errorValue, trailEntry) {
  return Object.freeze({
    type: 'error',
    descriptor: errorValue.descriptor,
    location: errorValue.location,
    originalError: errorValue.originalError,
    _trailHead: Object.freeze({
      entry: trailEntry,
      prev: errorValue._trailHead
    })
  });
}

// materializeTrail(errorValue) → Vec of trail entries in chronological
// order (first deflected → last deflected). Each entry is whatever
// the caller of appendTrailNode handed in — under the current eval.mjs
// callsites that is an AST-Map produced by `astNodeToMap`, so the
// returned Vec carries full structural information about each
// deflected step (kind, name, args, location, source text).
export function materializeTrail(errorValue) {
  const trail = [];
  let cur = errorValue._trailHead;
  while (cur) { trail.push(cur.entry); cur = cur.prev; }
  trail.reverse();
  return trail;
}

// ── describeType — short labels used in error messages ─────────
//
// isConduit / isSnapshot run BEFORE isQMap because under Variant-B
// every conduit and snapshot IS a JS Map carrying a `:qlang/kind`
// discriminator. Without the early check the more specific labels
// would be shadowed by the generic `'Map'` and downstream error
// messages would lose the binding-kind hint.

export function describeType(v) {
  if (isNull(v)) return 'null';
  if (isBoolean(v)) return 'boolean';
  if (isNumber(v)) return 'number';
  if (isString(v)) return 'string';
  if (isKeyword(v)) return 'keyword';
  if (isVec(v)) return 'Vec';
  if (isConduit(v)) return 'conduit';
  if (isSnapshot(v)) return 'snapshot';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'function';
  return 'unknown';
}
