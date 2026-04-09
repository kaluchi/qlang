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
//   env — initial env Map (defaults to a fresh langRuntime())
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
export function createSession(opts = {}) {
  let env = opts.env ?? langRuntime();
  const cellHistory = [];

  const session = {
    evalCell(source, evalOpts = {}) {
      const uri = evalOpts.uri ?? `cell-${cellHistory.length + 1}`;
      let ast = null;
      let result = null;
      let error = null;
      try {
        ast = parse(source, { uri });
        const initialState = makeState(env, env);
        const finalState = evalAst(ast, initialState);
        result = finalState.pipeValue;
        env = finalState.env;
      } catch (e) {
        error = e;
      }
      const entry = { source, uri, ast, result, error, envAfterCell: env };
      cellHistory.push(entry);
      return entry;
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
export function serializeSession(session) {
  const builtins = langRuntime();
  const userBindings = [];
  for (const [k, v] of session.env) {
    if (builtins.has(k)) continue;
    if (isFunctionValue(v)) continue; // user-installed functions are not portable
    if (isConduit(v)) {
      userBindings.push({
        kind: 'conduit',
        name: v.name,
        params: [...v.params],
        source: v.body?.text ?? null,
        docs: [...v.docs]
      });
    } else if (isSnapshot(v)) {
      userBindings.push({
        kind: 'snapshot',
        name: v.name,
        value: toTaggedJSON(v.value),
        docs: [...v.docs]
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
export function deserializeSession(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.bindings)) {
    throw new SessionPayloadInvalidError();
  }
  if (json.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new SessionSchemaVersionMismatchError(json.schemaVersion, SESSION_SCHEMA_VERSION);
  }
  const session = createSession();
  for (const binding of json.bindings) {
    if (binding.kind === 'conduit') {
      if (!binding.source) {
        throw new SessionConduitSourceMissingError(binding.name);
      }
      const bodyAst = parse(binding.source, { uri: `restored-${binding.name}` });
      const conduit = makeConduit(bodyAst, {
        name: binding.name,
        params: binding.params || [],
        docs: binding.docs
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
