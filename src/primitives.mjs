// Primitive registry — the canonical handoff point between qlang-
// level Map-form binding descriptors (which carry :qlang/impl
// keyword pointing to an entry here) and their JS-level executable
// impls.
//
// Under the Variant-B runtime model every binding in langRuntime is
// a qlang Map with :qlang/kind :builtin and an :qlang/impl field
// holding a namespaced keyword like :qlang/prim/mul. At operand-call-
// site dispatch the evaluator reads the :qlang/impl keyword from the
// resolved Map and asks this registry for the matching JS function
// value; the impl is invoked via Rule 10 exactly as today, but the
// registry is now the single place that connects "declarative
// descriptor in core.qlang" with "executable code in runtime/*.mjs".
//
// Lifecycle:
//   1. Each runtime/*.mjs module registers its impls at import time
//      via SHARED_REGISTRY.register(keyword('qlang/prim/<name>'), impl).
//   2. langRuntime() calls SHARED_REGISTRY.freeze() after parsing
//      core.qlang, locking the registry read-only for the lifetime
//      of the process.
//   3. evalOperandCall dispatches via
//      SHARED_REGISTRY.get(descriptor.get(keyword('qlang/impl'))).
//
// Layering: the module lives at src/ root rather than src/runtime/
// because both the core evaluator (src/eval.mjs, at dispatch time)
// and every runtime/*.mjs impl file (at module-load time) consume
// it; keeping it under runtime/ would force eval.mjs to import
// downward across the core/runtime layering boundary — the exact
// wart src/operand-errors.mjs sits at src/ root to avoid.
//
// Two isolation modes:
//   - createPrimitiveRegistry() — factory producing an isolated
//     instance. Test code uses this to avoid polluting the shared
//     registry between cases; embedders spawning isolated
//     notebook/sandbox evaluators can use it to restrict which
//     primitives a given context sees.
//   - SHARED_REGISTRY — the production singleton used by every
//     runtime/*.mjs at import time and by src/eval.mjs at dispatch
//     time. Consumers call its .register / .get / .freeze methods
//     directly; there is no top-level convenience wrapper because
//     the method-on-instance form already reads cleanly and the
//     extra indirection would only grow the surface and obscure
//     which registry instance is being mutated.

import { isKeyword } from './types.mjs';
import { QlangError, QlangInvariantError } from './errors.mjs';

// ── Per-site error classes ────────────────────────────────────
//
// Three invariant-class errors (registration-time bugs that should
// surface as loud crashes, never lift to error values) and one
// QlangError subclass (dispatch-time data error that lifts through
// evalNode's try/catch onto the fail-track).

class PrimitiveKeyNotKeywordError extends QlangInvariantError {
  constructor(actualType) {
    super(
      `registerPrimitive: key must be a keyword, got ${actualType}`,
      { site: 'PrimitiveKeyNotKeywordError', actualType }
    );
    this.name = 'PrimitiveKeyNotKeywordError';
    this.fingerprint = 'PrimitiveKeyNotKeywordError';
  }
}

class PrimitiveKeyAlreadyRegisteredError extends QlangInvariantError {
  constructor(keyName) {
    super(
      `registerPrimitive: key :${keyName} already bound; duplicate registration indicates two runtime modules claim the same primitive name`,
      { site: 'PrimitiveKeyAlreadyRegisteredError', keyName }
    );
    this.name = 'PrimitiveKeyAlreadyRegisteredError';
    this.fingerprint = 'PrimitiveKeyAlreadyRegisteredError';
  }
}

class PrimitiveRegistryFrozenError extends QlangInvariantError {
  constructor(keyLabel) {
    super(
      `registerPrimitive: registry is frozen; cannot register :${keyLabel} after bootstrap has completed`,
      { site: 'PrimitiveRegistryFrozenError', keyLabel }
    );
    this.name = 'PrimitiveRegistryFrozenError';
    this.fingerprint = 'PrimitiveRegistryFrozenError';
  }
}

// PrimitiveKeyNotRegisteredError — the one dispatch-time data error.
// Fires when a descriptor Map's :qlang/impl keyword points to a
// primitive nobody registered. Extends QlangError (not
// QlangInvariantError) so evalNode's try/catch converts it to an
// error value on the fail-track instead of crashing the evaluator.
// This gracefully handles hand-crafted descriptor Maps, stale
// serialized sessions, and mis-edited manifest entries.
class PrimitiveKeyNotRegisteredError extends QlangError {
  constructor(keyLabel) {
    super(
      `getPrimitive: no primitive registered under :${keyLabel}`,
      'primitive-not-registered'
    );
    this.name = 'PrimitiveKeyNotRegisteredError';
    this.fingerprint = 'PrimitiveKeyNotRegisteredError';
    this.context = { keyLabel };
  }
}

// Render a key as a human-readable label for error messages,
// tolerating the non-keyword case so the invariant throw site for
// PrimitiveKeyNotKeywordError can still produce a meaningful string.
function keyLabelFor(key) {
  if (isKeyword(key)) return key.name;
  return typeof key;
}

// ── Factory ───────────────────────────────────────────────────

// createPrimitiveRegistry() → registry instance
//
// Produces an isolated registry object with register / get / has /
// freeze methods plus isFrozen and size accessors. Used by tests that
// need a clean slate per case to avoid SHARED_REGISTRY pollution, and
// by embedders spawning sandboxed evaluation contexts that want to
// restrict which primitives are available.
//
// Production runtime code uses SHARED_REGISTRY plus the convenience
// functions below, not this factory directly.
export function createPrimitiveRegistry() {
  const entries = new Map();
  let frozen = false;

  return {
    register(key, impl) {
      if (frozen) {
        throw new PrimitiveRegistryFrozenError(keyLabelFor(key));
      }
      if (!isKeyword(key)) {
        throw new PrimitiveKeyNotKeywordError(typeof key);
      }
      if (entries.has(key)) {
        throw new PrimitiveKeyAlreadyRegisteredError(key.name);
      }
      entries.set(key, impl);
      return key;
    },

    get(key) {
      if (!entries.has(key)) {
        throw new PrimitiveKeyNotRegisteredError(keyLabelFor(key));
      }
      return entries.get(key);
    },

    has(key) {
      return entries.has(key);
    },

    freeze() {
      frozen = true;
    },

    get isFrozen() {
      return frozen;
    },

    get size() {
      return entries.size;
    }
  };
}

// ── Shared singleton ──────────────────────────────────────────

// SHARED_REGISTRY is the production registry populated by every
// runtime/*.mjs module at import time and frozen by langRuntime() on
// first bootstrap. Test code should NOT touch this directly — use
// createPrimitiveRegistry() for isolated instances so tests stay
// deterministic regardless of order. Runtime call-site usage is via
// its .register / .get / .freeze methods:
//
//     import { SHARED_REGISTRY } from '../primitives.mjs';
//     export const add = SHARED_REGISTRY.register(
//       keyword('qlang/prim/add'),
//       valueOp('add', 2, (a, b) => ...));
//
// The returned keyword IS the exported primitive handle; core.qlang's
// :qlang/impl field for :add points to that same keyword, completing
// the descriptor → registry → impl handoff at evalOperandCall time.
export const SHARED_REGISTRY = createPrimitiveRegistry();
