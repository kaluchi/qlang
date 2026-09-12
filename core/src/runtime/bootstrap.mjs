// Module locator for `langRuntime`.
//
// The runtime stays agnostic about where qlang source files come
// from. Logical names map to source text through the platform's
// standard module-resolution machinery:
//
//   * Node — `package.json` `imports` field. `#qlang/<ns>` keys map
//     to relative paths inside the calling package.
//   * Browser — `<script type="importmap">`. Same `#qlang/<ns>` keys
//     map to URLs the embedder serves the source from.
//
// The platform-conditional resolve+read lives behind the
// `#qlang/load-source` subpath: the `node` condition pulls in
// `host/load-source-node.mjs` (uses `createRequire` +
// `node:fs/promises`); the `default` condition pulls in
// `src/load-source-web.mjs` (uses `import.meta.resolve` + `fetch`).
// Bundlers pick exactly one path at build time, so `core/src/**`
// stays free of any `node:*` import.

import { loadSource } from '#qlang/load-source';
import { declareInvariantError } from '../errors.mjs';

export const BootstrapRootMissingError = declareInvariantError(
  'BootstrapRootMissingError',
  () => "qlang bootstrap: '#qlang/core' must resolve to the catalog root module — " +
    'add an entry to package.json#imports or the import map'
);

// The catalog root is one `use([…])` step, and `use` answers on the
// fail-track like any other operand: a family source the locator
// resolves but the parser refuses leaves the env without that
// family and hands the error value back as the root's pipeValue.
// `buildLangRuntime` reads the env alone, so without this reading a
// broken catalog file would seed every session with an env missing
// its operands and surface as `::UnresolvedIdentifierError` on the
// first `count` — a diagnostic naming the symptom three steps from
// the cause.
export const BootstrapCatalogNotLoadedError = declareInvariantError(
  'BootstrapCatalogNotLoadedError',
  ({ tagName }) => `qlang bootstrap: the catalog root answered ${tagName}; the operand ` +
    'families load through the sources the locator resolves for qlang/core and for each ' +
    'namespace it uses'
);

// platformLocator(namespaceName) → Promise<{ source } | null>
//
// Matches the `:qlang/locator` contract documented for `use`
// (see `core/src/runtime/use-op.mjs::resolveNamespaceEnv`). Used
// both as the bootstrap-time loader for `#qlang/core` and as the
// in-query locator that answers every `use(:ns)` from inside the
// catalog or from user code.
//
// Logical names mirror the namespace keyword 1:1 under the
// `#`-prefix convention: `:qlang/operand/arith` →
// `#qlang/operand/arith`, `:my/lib` → `#my/lib`. The runtime
// never inspects what's behind the prefix; the host's `imports`
// field / import map carries the only mapping table.
//
// Returns null when the platform reports the logical name is
// unmapped — `use` then surfaces `UseNamespaceNotFoundError`
// with the requested name. Other failure modes (file missing,
// fetch error, parse error inside the loaded source) propagate
// as per-site errors from the loader.

export async function platformLocator(namespaceName) {
  const source = await loadSource('#' + namespaceName);
  return source === null ? null : { source };
}
