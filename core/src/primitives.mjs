// The table from the handle of a primitive to its implementation: the
// `::builtin{:impl :qlang/prim/<name>}` step of a built-in verb names
// one [D72], and a kind's `::builtin{:impl :qlang/type/<name>}` its
// constructor; each runtime module binds its own as it loads, and the
// bootstrap seals the table.

import { declareInvariantError, declarePerSiteError } from './errors.mjs';

const PrimitiveKeyNotStringError = declareInvariantError(
  'PrimitiveKeyNotStringError',
  ({ actualType }) => `bind: primitive key must be a string, got ${actualType}`,
  { operand: '::qlang' }
);

const PrimitiveKeyAlreadyBoundError = declareInvariantError(
  'PrimitiveKeyAlreadyBoundError',
  ({ keyName }) => `bind: primitive key :${keyName} is already bound; ` +
    'duplicate binding indicates two runtime modules claim the same primitive name',
  { operand: '::qlang' }
);

const PrimitiveRegistrySealedError = declareInvariantError(
  'PrimitiveRegistrySealedError',
  ({ keyLabel }) => `bind: registry is sealed; cannot bind :${keyLabel} after bootstrap has completed`,
  { operand: '::qlang' }
);

// A handle that names no primitive, which a descriptor a query
// assembled can hold, answers on the fail track.
const PrimitiveKeyUnboundError = declarePerSiteError(
  'PrimitiveKeyUnboundError', 'primitiveUnbound',
  ({ keyLabel }) => `resolve: no primitive bound under :${keyLabel}`,
  { operand: '::builtin' }
);

// createPrimitiveRegistry() → a table of its own, for a test.
export function createPrimitiveRegistry() {
  const bindings = new Map();
  let sealed = false;

  return {
    bind(key, impl) {
      if (sealed) {
        throw new PrimitiveRegistrySealedError({ keyLabel: key });
      }
      if (typeof key !== 'string') {
        throw new PrimitiveKeyNotStringError({ actualType: typeof key });
      }
      if (bindings.has(key)) {
        throw new PrimitiveKeyAlreadyBoundError({ keyName: key });
      }
      bindings.set(key, impl);
      return key;
    },

    resolve(key) {
      if (!bindings.has(key)) {
        throw new PrimitiveKeyUnboundError({ keyLabel: key });
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

// The table every runtime module binds into.
export const PRIMITIVE_REGISTRY = createPrimitiveRegistry();

// The two namespaces of handles.
const PRIM_KEY_PREFIX = 'qlang/prim/';
export const TYPE_KEY_PREFIX = 'qlang/type/';

// bindPrim(name, impl) — binds the primitive of a verb under
// `qlang/prim/<name>`.
export function bindPrim(name, impl) {
  return PRIMITIVE_REGISTRY.bind(PRIM_KEY_PREFIX + name, impl);
}

// A primitive that reads the scope of its call takes the state of the
// call after its values [D79]; every other primitive is a plain function
// over the values its head checked [D72].
const STATE_READERS = new WeakSet();

export function bindStateReader(name, impl) {
  STATE_READERS.add(impl);
  return bindPrim(name, impl);
}

export function readsState(impl) {
  return STATE_READERS.has(impl);
}

// A primitive whose answer names the tags its subject stood beneath takes
// the tags the walk of its head passed, from the outside in, after its
// values [D34]: `raise` names its error by the outermost [D86].
const READERS_OF_PASSED_TAGS = new WeakSet();

export function bindReaderOfPassedTags(name, impl) {
  READERS_OF_PASSED_TAGS.add(impl);
  return bindPrim(name, impl);
}

export function readsPassedTags(impl) {
  return READERS_OF_PASSED_TAGS.has(impl);
}

// bindTypeConstructor(tagName, ctor) — binds the constructor of a kind
// under `qlang/type/<tag>`.
export function bindTypeConstructor(tagName, ctor) {
  return PRIMITIVE_REGISTRY.bind(TYPE_KEY_PREFIX + tagName, ctor);
}

// primKey(name) — the handle of a primitive, `qlang/prim/<name>`.
export function primKey(name) {
  return PRIM_KEY_PREFIX + name;
}
