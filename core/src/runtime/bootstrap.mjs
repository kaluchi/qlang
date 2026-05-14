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

export class BootstrapRootMissingError extends Error {
  constructor() {
    super(`qlang bootstrap: '#qlang/core' must resolve to the catalog root module — add an entry to package.json#imports or the import map`);
    this.name = 'BootstrapRootMissingError';
    this.fingerprint = 'BootstrapRootMissingError';
    this.context = {};
  }
}

// platformLocator(namespaceName) → Promise<{ source } | null>
//
// Matches the `:qlang/locator` contract documented for `use`
// (see `core/src/runtime/use-op.mjs::resolveNamespaceEnv`). Used
// both as the bootstrap-time loader for `#qlang/core` and as the
// in-query locator that answers every `use(:ns)` from inside the
// catalog or from user code.
//
// Logical names mirror the namespace keyword 1:1 under the
// `#`-prefix convention: `:qlang/error/registry` →
// `#qlang/error/registry`, `:my/lib` → `#my/lib`. The runtime
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
