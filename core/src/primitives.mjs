// Primitive registry — bootstrap-time binding table between qlang-
// level Map-form binding descriptors (which carry :qlang/impl
// keyword at authoring time) and their JS-level executable impls.
//
// Every binding in langRuntime is a qlang Map with :qlang/kind
// :builtin and an :qlang/impl field. At authoring time in
// `core.qlang`, :qlang/impl holds a namespaced keyword like
// `:qlang/prim/mul` pointing into this registry. The bootstrap
// resolution pass in `runtime/index.mjs::langRuntime()` resolves
// each keyword through `PRIMITIVE_REGISTRY.resolve` into the
// matching JS function value and replaces the keyword on the
// descriptor with the function directly. After bootstrap,
// dispatch reads the function from :qlang/impl directly — the
// registry is a build-time bridge consulted only during the
// resolution pass.
//
// Lifecycle:
//   1. Each runtime/*.mjs module binds its impls at import time via
//      PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/<name>'), impl).
//   2. langRuntime() resolves every :qlang/impl keyword on the
//      template env descriptors to its function value, then calls
//      PRIMITIVE_REGISTRY.seal().
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
// a descriptor Map's :qlang/impl keyword points to a primitive that
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
// deterministic regardless of order. Runtime call-site usage is via
// its .bind / .resolve / .seal methods:
//
//     import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
//     export const add = valueOp('add', 2, (a, b) => a + b);
//     PRIMITIVE_REGISTRY.bind('qlang/prim/add', add);
//
// The first argument is a plain string — the `:qlang/prim/<name>`
// namespaced keyword's `.name`. The catalog file
// (`core/lib/qlang/operand/arith.qlang`) declares the same string
// under `:qlang/impl :qlang/prim/add` on the `:add` descriptor Map,
// completing the descriptor → registry → impl handoff
// `langRuntime`'s bootstrap pass resolves at construction time.
export const PRIMITIVE_REGISTRY = createPrimitiveRegistry();
