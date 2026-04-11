// Primitive registry — the canonical binding table between qlang-
// level Map-form binding descriptors (which carry :qlang/impl
// keyword pointing to an entry here) and their JS-level executable
// impls.
//
// Under the Variant-B runtime model every binding in langRuntime is
// a qlang Map with :qlang/kind :builtin and an :qlang/impl field
// holding a namespaced keyword like :qlang/prim/mul. At operand-call-
// site dispatch the evaluator reads the :qlang/impl keyword from the
// resolved Map and asks this registry to resolve it into the matching
// JS function value; the impl is invoked via Rule 10 exactly as
// today, but the registry is now the single place that connects
// "declarative descriptor in core.qlang" with "executable code in
// runtime/*.mjs".
//
// Lifecycle:
//   1. Each runtime/*.mjs module binds its impls at import time via
//      PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/<name>'), impl).
//   2. langRuntime() calls PRIMITIVE_REGISTRY.seal() after parsing
//      core.qlang, closing the registry against further binding for
//      the lifetime of the process.
//   3. evalOperandCall dispatches via
//      PRIMITIVE_REGISTRY.resolve(descriptor.get(keyword('qlang/impl'))).
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
// Layering: the module lives at src/ root rather than src/runtime/
// because both the core evaluator (src/eval.mjs, at dispatch time)
// and every runtime/*.mjs impl file (at module-load time) consume
// it; keeping it under runtime/ would force eval.mjs to import
// downward across the core/runtime layering boundary — the exact
// wart src/operand-errors.mjs sits at src/ root to avoid.
//
// Two isolation modes:
//   - createPrimitiveRegistry() — factory producing an isolated
//     registry instance. Test code binds against isolated instances
//     to avoid polluting the shared registry between cases;
//     embedders spawning sandboxed evaluation contexts can bind
//     primitives into a restricted registry instance instead of the
//     shared one to narrow which primitives a given context sees.
//   - PRIMITIVE_REGISTRY — the production singleton bound by every
//     runtime/*.mjs at import time and sealed by langRuntime() once
//     bootstrap completes. Consumers call its .bind / .resolve / .seal
//     methods directly; there is no top-level convenience wrapper,
//     because the method-on-instance form already reads cleanly and
//     the extra indirection would only obscure which registry
//     instance is being mutated.

import { isKeyword } from './types.mjs';
import { QlangError, QlangInvariantError } from './errors.mjs';

// ── Per-site error classes ────────────────────────────────────
//
// Three invariant-class errors (bind-time bugs that should surface
// as loud crashes, never lift to error values) and one QlangError
// subclass (dispatch-time data error that lifts through evalNode's
// try/catch onto the fail-track).

class PrimitiveKeyNotKeyword extends QlangInvariantError {
  constructor(actualType) {
    super(
      `bind: primitive key must be a keyword, got ${actualType}`,
      { site: 'PrimitiveKeyNotKeyword', actualType }
    );
    this.name = 'PrimitiveKeyNotKeyword';
    this.fingerprint = 'PrimitiveKeyNotKeyword';
  }
}

class PrimitiveKeyAlreadyBound extends QlangInvariantError {
  constructor(keyName) {
    super(
      `bind: primitive key :${keyName} is already bound; duplicate binding indicates two runtime modules claim the same primitive name`,
      { site: 'PrimitiveKeyAlreadyBound', keyName }
    );
    this.name = 'PrimitiveKeyAlreadyBound';
    this.fingerprint = 'PrimitiveKeyAlreadyBound';
  }
}

class PrimitiveRegistrySealed extends QlangInvariantError {
  constructor(keyLabel) {
    super(
      `bind: registry is sealed; cannot bind :${keyLabel} after bootstrap has completed`,
      { site: 'PrimitiveRegistrySealed', keyLabel }
    );
    this.name = 'PrimitiveRegistrySealed';
    this.fingerprint = 'PrimitiveRegistrySealed';
  }
}

// PrimitiveKeyUnbound — the one dispatch-time data error. Fires when
// a descriptor Map's :qlang/impl keyword points to a primitive that
// was never bound. Extends QlangError (not QlangInvariantError) so
// evalNode's try/catch converts it to an error value on the fail-
// track instead of crashing the evaluator. This gracefully handles
// hand-crafted descriptor Maps, stale serialized sessions, and mis-
// edited manifest entries.
class PrimitiveKeyUnbound extends QlangError {
  constructor(keyLabel) {
    super(
      `resolve: no primitive bound under :${keyLabel}`,
      'primitive-unbound'
    );
    this.name = 'PrimitiveKeyUnbound';
    this.fingerprint = 'PrimitiveKeyUnbound';
    this.context = { keyLabel };
  }
}

// Render a key as a human-readable label for error messages,
// tolerating the non-keyword case so the invariant throw site for
// PrimitiveKeyNotKeyword can still produce a meaningful string.
function keyLabelFor(key) {
  if (isKeyword(key)) return key.name;
  return typeof key;
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
// singleton) directly, not this factory.
export function createPrimitiveRegistry() {
  const bindings = new Map();
  let sealed = false;

  return {
    bind(key, impl) {
      if (sealed) {
        throw new PrimitiveRegistrySealed(keyLabelFor(key));
      }
      if (!isKeyword(key)) {
        throw new PrimitiveKeyNotKeyword(typeof key);
      }
      if (bindings.has(key)) {
        throw new PrimitiveKeyAlreadyBound(key.name);
      }
      bindings.set(key, impl);
      return key;
    },

    resolve(key) {
      if (!bindings.has(key)) {
        throw new PrimitiveKeyUnbound(keyLabelFor(key));
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
//     export const add = PRIMITIVE_REGISTRY.bind(
//       keyword('qlang/prim/add'),
//       valueOp('add', 2, (a, b) => ...));
//
// The returned keyword IS the exported primitive handle; core.qlang's
// :qlang/impl field for :add points to that same keyword, completing
// the descriptor → registry → impl handoff at evalOperandCall time.
export const PRIMITIVE_REGISTRY = createPrimitiveRegistry();
