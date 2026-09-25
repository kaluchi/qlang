// Session API — persistent (pipeValue, env) across multiple eval
// invocations. The basic abstraction for REPL, notebook cells, and
// any embedded use that needs sequential queries to share bindings.
//
// A session owns its env and grows it via BindStep declarations,
// each writing the record of a binding [D63].
// Builtins from langRuntime() are seeded at construction. Cell
// history records every cell evaluated (source, AST, result,
// error, env-after-cell) so a notebook UI can render past cells
// and step-back navigation can revisit them.

import { parse, ParseError } from './parse.mjs';
import { evalAst, materializePendingTrail } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { scopeBindingsOf } from './runtime/nouns.mjs';
import { rootState } from './state.mjs';
import {
  isBinding,
  isFunctionValue,
  isVerb,
  keyword,
  makeBinding,
  makeTagKeyword,
  makeVerb
} from './types.mjs';
import { RUNTIME_LOCATOR_KEY, isRuntimeKey, isTagBindingName, stripTagBindingPrefix } from './env-keys.mjs';

import { toTaggedJSON, fromTaggedJSON } from './codec.mjs';
import { errorFromParse } from './error-convert.mjs';
import { declarePerSiteError } from './errors.mjs';

const SESSION_SCHEMA_VERSION = 3;

// Per-site session deserialization errors.
const SessionPayloadInvalidError = declarePerSiteError(
  'SessionPayloadInvalidError', 'sessionError',
  () => 'deserializeSession: invalid session payload',
  { operand: '::qlang' }
);
const SessionSchemaVersionMismatchError = declarePerSiteError(
  'SessionSchemaVersionMismatchError', 'sessionError',
  ({ actual, expected }) => `deserializeSession: unsupported schemaVersion ${actual} (expected ${expected})`,
  { operand: '::qlang' }
);

// createSession(opts?) → Session
//
// opts:
//   env     — initial env Map (defaults to a fresh langRuntime())
//   locator — async (namespaceName: string) => {source, impls?} | null
//             Called by `use :ns` when the namespace keyword is not
//             in env. May be sync or async. Enables lazy module loading
//             for host embeddings. Stored under :qlang/locator in env.
//
// Returns an object with:
//   evalCell(source, evalOpts?) — parse + evaluate; updates env,
//                                 appends an entry to cell history.
//                                 `evalOpts.initialPipeValue` seeds
//                                 the cell's pipeValue slot before
//                                 the first step runs — the CLI
//                                 script mode uses this to auto-
//                                 deliver parsed stdin as the
//                                 implicit subject of the query,
//                                 so `qlang '/path'` acts as a
//                                 filter without ceremony. When
//                                 absent, pipeValue starts at
//                                 `null`; the cell's first step
//                                 must provide a head value (a
//                                 literal, an identifier reference
//                                 like `env`, a BindStep
//                                 declaration, or a captured arg).
//                                 Operands that need a typed
//                                 subject fail fast on `null` with
//                                 a clear subject-type error — no
//                                 implicit env leak.
//   cellHistory — array of executed cells (read-only inspection)
//   env — current env Map (read-only inspection)
//   bind(name, value) — install a binding directly into env (used
//                       by deserializeSession on restore)
//   takeSnapshot() — { env, cellHistoryLength } for cheap save/restore
//   restoreSnapshot(snap) — rewind env and cell history to a snapshot
export async function createSession(opts = {}) {
  let env = opts.env ?? await langRuntime();
  if (opts.locator) {
    env = new Map(env).set(RUNTIME_LOCATOR_KEY, opts.locator);
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
        const cellSeedPipeValue = 'initialPipeValue' in evalOpts
          ? evalOpts.initialPipeValue
          : null;
        const cellInitialState = rootState(cellSeedPipeValue, env);
        const cellFinalState = await evalAst(cellAst, cellInitialState);
        // Flush any pending `_trailHead` linked-list into the
        // descriptor's `:trail` field so the cell's result reflects
        // the full deflection chain (`|` / `*` deflections
        // never auto-materialise; only `!|` does mid-pipeline). The
        // script-mode renderer and the REPL both read the descriptor
        // through printValue, which would otherwise elide
        // `:trail null` and hide every deflected step.
        cellResult = materializePendingTrail(cellFinalState.pipeValue);
        env = cellFinalState.env;
      } catch (evalCellErr) {
        // Parse failures land BOTH as a first-class ErrorValue on
        // the result channel AND keep a host-level marker on the
        // error channel. The ErrorValue carries the structured
        // `::ParseError!{:expected :found :excerpt …}` descriptor
        // so `printValue` / projection consumers read the failure
        // through the same path as any other error; the host-error
        // marker lets `script-mode` distinguish a syntactic-failure
        // exit (non-zero) from a runtime fail-track value that
        // travels with exit 0 by spec.
        if (evalCellErr instanceof ParseError) {
          cellResult = errorFromParse(evalCellErr);
        }
        cellError = evalCellErr;
      }
      const cellEntry = { source, uri: cellUri, ast: cellAst, result: cellResult, error: cellError, envAfterCell: env };
      cellHistory.push(cellEntry);
      return cellEntry;
    },

    // A host binds a value as a binding without a doc [D63], a record
    // as the binding it is, and a key of the runtime's own as it lies.
    bind(name, value) {
      env = new Map(env).set(name, isRuntimeKey(name) || isBinding(value)
        ? value
        : makeBinding({ name: bindingNameKeyword(name), value }));
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

// The name of a binding a host writes under an env key: a keyword,
// or a tag for a key of the tag namespace.
function bindingNameKeyword(name) {
  return isTagBindingName(name) ? makeTagKeyword(stripTagBindingPrefix(name)) : keyword(name);
}

// serializeSession(session) → JSON-serializable plain object
//
// Captures the bindings the session wrote, the records its scope holds
// [D61], [D63], a shadow of a built-in name among them, plus the source
// of every cell ever executed. Built-in function
// values are not serialized — `deserializeSession` reconstructs
// them by seeding a fresh langRuntime() on restore. A binding
// serializes as `{ name, value, docs }`, its value encoded via
// toTaggedJSON, a verb as its quote under its tag.
export async function serializeSession(session) {
  const userBindings = [];
  for (const [name, record] of scopeBindingsOf(session.env)) {
    const value = record.get('value');
    if (isFunctionValue(value)) continue; // user-installed functions are not portable
    userBindings.push({ name, value: toTaggedJSON(value), docs: record.get('docs').map(doc => doc.content) });
  }
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    bindings: userBindings,
    cells: session.cellHistory.map(h => ({ source: h.source, uri: h.uri }))
  };
}

// deserializeSession(json) → Session
//
// Rebuilds a session from a serialized payload: every value is decoded
// from tagged JSON and re-installed via session.bind as the record of
// its binding with its docs, a verb resolving its names in the restored
// session as its declaration made it resolve them in the session it
// came from, so a cell that shadows a name after the restore leaves its
// body alone. Cell history is restored without re-evaluation; the
// notebook layer can re-eval cells after open if it wants freshness.
export async function deserializeSession(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.bindings)) {
    throw new SessionPayloadInvalidError();
  }
  if (json.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new SessionSchemaVersionMismatchError({
      actual: json.schemaVersion, expected: SESSION_SCHEMA_VERSION
    });
  }
  const session = await createSession();
  const restoredScope = { env: null };
  for (const binding of json.bindings) {
    const value = fromTaggedJSON(binding.value);
    session.bind(binding.name, makeBinding({
      name: bindingNameKeyword(binding.name), docs: binding.docs,
      value: isVerb(value) ? makeVerb(value.payload, restoredScope) : value
    }));
  }
  restoredScope.env = session.env;
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
