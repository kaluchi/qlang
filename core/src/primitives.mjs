// Primitive registry — bootstrap-time binding table between qlang-
// level Map-form binding descriptors (which carry :impl
// keyword at authoring time) and their JS-level executable impls.
//
// Every binding in langRuntime is a qlang Map with :kind
// :builtin and an :impl field. At authoring time in
// `core.qlang`, :impl holds a namespaced keyword like
// `:qlang/prim/mul` pointing into this registry. The bootstrap
// resolution pass in `runtime/index.mjs::langRuntime()` resolves
// each keyword through `PRIMITIVE_REGISTRY.resolve` into the
// matching JS function value and replaces the keyword on the
// descriptor with the function directly. After bootstrap,
// dispatch reads the function from :impl directly — the
// registry is a build-time bridge consulted only during the
// resolution pass.
//
// Two parallel namespaces ride through the registry:
//
//   `qlang/prim/<name>` — value-namespace operands (`add`, `count`,
//     `filter`, `reify`, …). Resolved once at bootstrap; the
//     descriptor's `:impl` keyword is replaced with the
//     resulting JS function value.
//
//   `qlang/type/<tag>` — tag-namespace constructors (`::conduit`,
//     `::qlang`, `::json`). The keyword stays a keyword on the
//     descriptor; `evalTaggedLit` resolves it through the registry
//     at every invocation so `reify(::tag)` keeps the readable
//     `:impl :qlang/type/<tag>` handle on the descriptor.
//
// Lifecycle:
//   1. Each runtime/*.mjs module binds its impls at import time
//      via `bindPrim(name, impl)` (value-namespace) or
//      `bindTypeConstructor(tagName, ctor)` (tag-namespace).
//   2. langRuntime() resolves every :impl `qlang/prim/*`
//      keyword on the template env descriptors to its function
//      value, then calls `PRIMITIVE_REGISTRY.seal()`.
//
// Verb vocabulary: the registry uses **bind** for the write site
// (matching qlang's `let` binding-into-env verb), **resolve** for
// the read site (matching identifier resolution through env lookup),
// and **seal** for the one-way transition from open-for-writes to
// closed-for-writes (chosen over "freeze" because the registry is
// never unfrozen; sealing is permanent and directional, whereas
// freezing in JS conventionally implies a shallow immutability that
// does not match the semantics here). The key itself is just
// **key** — a namespaced keyword in the :qlang/prim/* family — and
// when we need a short noun for "the thing that identifies a primitive
// in its descriptor Map" we say "impl key" to differentiate from Map
// entry keys and other keyword uses.
//
// Layering: the module lives at src/ root because both the core
// evaluator (src/eval.mjs, at dispatch time) and every
// runtime/*.mjs impl file (at module-load time) consume it. The
// src/ root sits upstream of both layers, so imports flow inward
// — the same arrangement that src/operand-errors.mjs uses for
// the per-site error factories.
//
// Two isolation modes:
//   - createPrimitiveRegistry() — factory producing an isolated
//     registry instance. Test code binds against isolated instances
//     to avoid polluting the shared registry between cases;
//     embedders spawning sandboxed evaluation contexts can bind
//     primitives into a restricted registry instance to narrow
//     which primitives a given context sees.
//   - PRIMITIVE_REGISTRY — the production singleton bound by every
//     runtime/*.mjs at import time and sealed by langRuntime() once
//     bootstrap completes. Consumers call its .bind / .resolve / .seal
//     methods directly; there is no top-level convenience wrapper,
//     because the method-on-instance form already reads cleanly and
//     the extra indirection would only obscure which registry
//     instance is being mutated.

import { QlangError, QlangInvariantError } from './errors.mjs';

// ── Per-site error classes ────────────────────────────────────
//
// Three invariant-class errors (bind-time bugs that should surface
// as loud crashes, never lift to error values) and one QlangError
// subclass (dispatch-time data error that lifts through evalNode's
// try/catch onto the fail-track).

class PrimitiveKeyNotStringError extends QlangInvariantError {
  constructor(actualType) {
    super(
      `bind: primitive key must be a string, got ${actualType}`,
      { actualType }
    );
    this.name = 'PrimitiveKeyNotStringError';
    this.fingerprint = 'PrimitiveKeyNotStringError';
  }
}

class PrimitiveKeyAlreadyBoundError extends QlangInvariantError {
  constructor(keyName) {
    super(
      `bind: primitive key :${keyName} is already bound; duplicate binding indicates two runtime modules claim the same primitive name`,
      { keyName }
    );
    this.name = 'PrimitiveKeyAlreadyBoundError';
    this.fingerprint = 'PrimitiveKeyAlreadyBoundError';
  }
}

class PrimitiveRegistrySealedError extends QlangInvariantError {
  constructor(keyLabel) {
    super(
      `bind: registry is sealed; cannot bind :${keyLabel} after bootstrap has completed`,
      { keyLabel }
    );
    this.name = 'PrimitiveRegistrySealedError';
    this.fingerprint = 'PrimitiveRegistrySealedError';
  }
}

// PrimitiveKeyUnboundError — the one dispatch-time data error. Fires when
// a descriptor Map's :impl keyword points to a primitive that
// was never bound. Extends QlangError so evalNode's try/catch
// converts it to an error value on the fail-track. This gracefully
// handles hand-crafted descriptor Maps, stale serialized sessions,
// and mis-edited manifest entries.
class PrimitiveKeyUnboundError extends QlangError {
  constructor(keyLabel) {
    super(
      `resolve: no primitive bound under :${keyLabel}`,
      'primitive-unbound'
    );
    this.name = 'PrimitiveKeyUnboundError';
    this.fingerprint = 'PrimitiveKeyUnboundError';
    this.context = { keyLabel };
  }
}


// ── Factory ───────────────────────────────────────────────────

// createPrimitiveRegistry() → registry instance
//
// Produces an isolated registry instance with bind / resolve / has /
// seal methods plus isSealed and size accessors. Used by tests that
// need a clean slate per case to avoid PRIMITIVE_REGISTRY pollution,
// and by embedders spawning sandboxed evaluation contexts that want
// to restrict which primitives are available.
//
// Production runtime code uses PRIMITIVE_REGISTRY (the module-level
// singleton) directly; this factory exists for the test and
// embedder isolation paths described above.
export function createPrimitiveRegistry() {
  const bindings = new Map();
  let sealed = false;

  return {
    bind(key, impl) {
      if (sealed) {
        throw new PrimitiveRegistrySealedError(key);
      }
      if (typeof key !== 'string') {
        throw new PrimitiveKeyNotStringError(typeof key);
      }
      if (bindings.has(key)) {
        throw new PrimitiveKeyAlreadyBoundError(key);
      }
      bindings.set(key, impl);
      return key;
    },

    resolve(key) {
      if (!bindings.has(key)) {
        throw new PrimitiveKeyUnboundError(key);
      }
      return bindings.get(key);
    },

    has(key) {
      return bindings.has(key);
    },

    seal() {
      sealed = true;
    },

    get isSealed() {
      return sealed;
    },

    get size() {
      return bindings.size;
    }
  };
}

// ── Shared singleton ──────────────────────────────────────────

// PRIMITIVE_REGISTRY is the production registry bound by every
// runtime/*.mjs module at import time and sealed by langRuntime() on
// first bootstrap. Test code should NOT touch this directly — use
// createPrimitiveRegistry() for isolated instances so tests stay
// deterministic regardless of order. Runtime call-site usage rides
// through `bindPrim` / `bindTypeConstructor` so the namespace prefix
// stays a single-source-of-truth string here:
//
//     import { bindPrim } from '../primitives.mjs';
//     export const add = valueOp('add', 2, (a, b) => a + b);
//     bindPrim('add', add);
//
// The catalog file (`core/lib/qlang/operand/arith.qlang`) declares
// the same name under `:impl :qlang/prim/add` on the `:add`
// descriptor Map, completing the descriptor → registry → impl
// handoff `langRuntime`'s bootstrap pass resolves at construction
// time.
export const PRIMITIVE_REGISTRY = createPrimitiveRegistry();

// ── Namespace prefixes for impl-key minting ───────────────────
//
// `PRIM_KEY_PREFIX` and `TYPE_KEY_PREFIX` are the single-source
// strings for the two impl-key namespaces. Every consumer that
// composes or pattern-matches a `qlang/prim/…` or `qlang/type/…`
// key imports these constants instead of typing the literal — a
// future rename (e.g. `qlang/prim/` → `qlang/op/`) touches one
// line here, not seventeen runtime files.

export const PRIM_KEY_PREFIX = 'qlang/prim/';
export const TYPE_KEY_PREFIX = 'qlang/type/';

// bindPrim(name, impl) — bind a value-namespace operand under the
// `qlang/prim/<name>` key. The boilerplate seam every runtime/*.mjs
// flows through at module-load time.
export function bindPrim(name, impl) {
  return PRIMITIVE_REGISTRY.bind(PRIM_KEY_PREFIX + name, impl);
}

// bindTypeConstructor(tagName, ctor) — bind a tag-namespace
// constructor under the `qlang/type/<tag>` key. Pairs with the
// `:impl :qlang/type/<tag>` slot the catalog tag-binding
// declares.
export function bindTypeConstructor(tagName, ctor) {
  return PRIMITIVE_REGISTRY.bind(TYPE_KEY_PREFIX + tagName, ctor);
}

// primKey(name) — mint a `qlang/prim/<name>` plain-string key
// without binding. Used by `runtime/index.mjs` to resolve the
// bootstrap `use` operand against the seed env and by `format.mjs`
// to project a resolved FunctionValue back to its catalog-handle
// keyword.
export function primKey(name) {
  return PRIM_KEY_PREFIX + name;
}
