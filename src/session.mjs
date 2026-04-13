// Session API — persistent (pipeValue, env) across multiple eval
// invocations. The basic abstraction for REPL, notebook cells, and
// any embedded use that needs sequential queries to share bindings.
//
// A session owns its env and grows it via `let` / `as` writes from
// each evaluated cell. Builtins from langRuntime() are seeded at
// construction. Cell history records every cell evaluated (source,
// AST, result, error, env-after-cell) so a notebook UI can render
// past cells and step-back navigation can revisit them.

import { parse } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { makeState } from './state.mjs';
import {
  keyword,
  isConduit,
  isSnapshot,
  isFunctionValue,
  makeConduit,
  makeSnapshot
} from './types.mjs';

// Variant-B descriptor field constants for serializeSession's
// Map.get-based reads. Interned at module load.
const KW_NAME    = keyword('name');
const KW_PARAMS  = keyword('params');
const KW_DOCS    = keyword('docs');
const KW_BODY    = keyword('qlang/body');
const KW_VALUE   = keyword('qlang/value');
const KW_ENVREF  = keyword('qlang/envRef');
import { toTaggedJSON, fromTaggedJSON } from './codec.mjs';
import { QlangError } from './errors.mjs';

const SESSION_SCHEMA_VERSION = 1;

// Per-site session deserialization errors.
class SessionPayloadInvalidError extends QlangError {
  constructor() {
    super('deserializeSession: invalid session payload', 'session-error');
    this.name = 'SessionPayloadInvalidError';
    this.fingerprint = 'SessionPayloadInvalidError';
  }
}
class SessionSchemaVersionMismatchError extends QlangError {
  constructor(actual, expected) {
    super(`deserializeSession: unsupported schemaVersion ${actual} (expected ${expected})`, 'session-error');
    this.name = 'SessionSchemaVersionMismatchError';
    this.fingerprint = 'SessionSchemaVersionMismatchError';
    this.context = { actual, expected };
  }
}
class SessionConduitSourceMissingError extends QlangError {
  constructor(bindingName) {
    super(`deserializeSession: conduit binding ${bindingName} has no source`, 'session-error');
    this.name = 'SessionConduitSourceMissingError';
    this.fingerprint = 'SessionConduitSourceMissingError';
    this.context = { bindingName };
  }
}
class SessionBindingKindUnknownError extends QlangError {
  constructor(kind) {
    super(`deserializeSession: unknown binding kind '${kind}'`, 'session-error');
    this.name = 'SessionBindingKindUnknownError';
    this.fingerprint = 'SessionBindingKindUnknownError';
    this.context = { kind };
  }
}

// createSession(opts?) → Session
//
// opts:
//   env     — initial env Map (defaults to a fresh langRuntime())
//   locator — async (namespaceName: string) => {source, impls?} | null
//             Called by `use(:ns)` when the namespace keyword is not
//             in env. May be sync or async. Enables lazy module loading
//             for host embeddings. Stored under :qlang/locator in env.
//
// Returns an object with:
//   evalCell(source, evalOpts?) — parse + evaluate; updates env,
//                                 appends an entry to cell history
//   cellHistory — array of executed cells (read-only inspection)
//   env — current env Map (read-only inspection)
//   bind(name, value) — install a binding directly into env (used
//                       by deserializeSession on restore)
//   takeSnapshot() — { env, cellHistoryLength } for cheap save/restore
//   restoreSnapshot(snap) — rewind env and cell history to a snapshot
export async function createSession(opts = {}) {
  let env = opts.env ?? await langRuntime();
  if (opts.locator) {
    env = new Map(env).set(keyword('qlang/locator'), opts.locator);
  }
  const cellHistory = [];

  const session = {
    async evalCell(source, evalOpts = {}) {
      const cellUri = evalOpts.uri ?? `cell-${cellHistory.length + 1}`;
      let cellAst = null;
      let cellResult = null;
      let cellError = null;
      try {
        cellAst = parse(source, { uri: cellUri });
        const cellInitialState = makeState(env, env);
        const cellFinalState = await evalAst(cellAst, cellInitialState);
        cellResult = cellFinalState.pipeValue;
        env = cellFinalState.env;
      } catch (evalCellErr) {
        cellError = evalCellErr;
      }
      const cellEntry = { source, uri: cellUri, ast: cellAst, result: cellResult, error: cellError, envAfterCell: env };
      cellHistory.push(cellEntry);
      return cellEntry;
    },

    bind(name, value) {
      env = new Map(env).set(keyword(name), value);
    },

    get cellHistory() { return cellHistory; },
    get env() { return env; },

    takeSnapshot() {
      return { env, cellHistoryLength: cellHistory.length };
    },

    restoreSnapshot(snap) {
      env = snap.env;
      cellHistory.length = snap.cellHistoryLength;
    }
  };

  return session;
}

// serializeSession(session) → JSON-serializable plain object
//
// Captures only user-defined bindings (those not in langRuntime),
// plus the source of every cell ever executed. Built-in function
// values are not serialized — `deserializeSession` reconstructs
// them by seeding a fresh langRuntime() on restore.
//
// User let bindings serialize as `{ kind: 'conduit', name, source, docs }`
// where `source` is the parser-captured `.text` of the body AST.
// User as bindings serialize as `{ kind: 'snapshot', name, value, docs }`
// where `value` is the captured payload encoded via toTaggedJSON.
export async function serializeSession(session) {
  const builtins = await langRuntime();
  const userBindings = [];
  for (const [k, v] of session.env) {
    if (builtins.has(k)) continue;
    if (isFunctionValue(v)) continue; // user-installed functions are not portable
    if (isConduit(v)) {
      const body = v.get(KW_BODY);
      userBindings.push({
        kind: 'conduit',
        name: v.get(KW_NAME),
        params: [...v.get(KW_PARAMS)],
        source: body?.text ?? null,
        docs: [...v.get(KW_DOCS)]
      });
    } else if (isSnapshot(v)) {
      userBindings.push({
        kind: 'snapshot',
        name: v.get(KW_NAME),
        value: toTaggedJSON(v.get(KW_VALUE)),
        docs: [...v.get(KW_DOCS)]
      });
    } else {
      // Raw value bound directly into env (rare, e.g. via session.bind).
      userBindings.push({
        kind: 'value',
        name: k.name,
        value: toTaggedJSON(v)
      });
    }
  }
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    bindings: userBindings,
    cells: session.cellHistory.map(h => ({ source: h.source, uri: h.uri }))
  };
}

// deserializeSession(json) → Session
//
// Rebuilds a session from a serialized payload. Conduits are parsed
// from their stored body source and re-installed via session.bind.
// Snapshots are decoded from tagged JSON and re-installed the same
// way. Cell history is restored without re-evaluation; the notebook
// layer can re-eval cells after open if it wants freshness.
export async function deserializeSession(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.bindings)) {
    throw new SessionPayloadInvalidError();
  }
  if (json.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new SessionSchemaVersionMismatchError(json.schemaVersion, SESSION_SCHEMA_VERSION);
  }
  const session = await createSession();
  for (const binding of json.bindings) {
    if (binding.kind === 'conduit') {
      if (!binding.source) {
        throw new SessionConduitSourceMissingError(binding.name);
      }
      const bodyAst = parse(binding.source, { uri: `restored-${binding.name}` });
      // Allocate the envRef holder up front so the second pass below
      // can mutate `.env` after every binding has landed in session.env.
      // The holder identity is shared between the conduit and the
      // second-pass walker — same tie-the-knot pattern letOperand uses
      // at original declaration time.
      const conduit = makeConduit(bodyAst, {
        name: binding.name,
        params: binding.params || [],
        envRef: { env: null },
        docs: binding.docs,
        location: bodyAst.location
      });
      session.bind(binding.name, conduit);
    } else if (binding.kind === 'snapshot') {
      const snap = makeSnapshot(fromTaggedJSON(binding.value), {
        name: binding.name,
        docs: binding.docs
      });
      session.bind(binding.name, snap);
    } else if (binding.kind === 'value') {
      session.bind(binding.name, fromTaggedJSON(binding.value));
    } else {
      throw new SessionBindingKindUnknownError(binding.kind);
    }
  }
  // Second pass — wire each restored conduit's envRef to the now-
  // complete session env so identifier lookup inside the conduit body
  // resolves through a lexical anchor (matching letOperand) rather
  // than falling back to the call-site `state.env` (which would give
  // dynamic scope and break shadowing-immune cross-conduit references
  // and recursive self-binding).
  for (const v of session.env.values()) {
    if (isConduit(v)) {
      v.get(KW_ENVREF).env = session.env;
    }
  }
  // Restore cell history without re-evaluating each cell. Restored
  // cells carry only the source and uri the user originally typed —
  // ast/result/error fields are null because we deliberately did
  // not re-fire any side effects. A notebook layer that wants the
  // original AST or result can call session.evalCell(cell.source)
  // again on its own terms.
  for (const cell of json.cells) {
    session.cellHistory.push({
      source: cell.source,
      uri: cell.uri,
      ast: null,
      result: null,
      error: null,
      envAfterCell: session.env
    });
  }
  return session;
}
