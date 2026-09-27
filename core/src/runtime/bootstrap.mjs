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
    'add an entry to package.json#imports or the import map',
  { operand: '::qlang' }
);

// A catalog root that answers an error left a module of the catalog
// unloaded, which would otherwise show as an unresolved name at the first
// call.
export const BootstrapCatalogNotLoadedError = declareInvariantError(
  'BootstrapCatalogNotLoadedError',
  ({ tagName }) => `qlang bootstrap: the catalog root answered ${tagName}; the modules ` +
    'of the catalog load through the sources the locator resolves for qlang/core and for ' +
    'each namespace it uses',
  { operand: '::qlang' }
);

// platformLocator(namespaceName) → Promise<{ source } | null>: the
// source of `:qlang/number` read from `#qlang/number` through the
// `imports` field or the import map, null for a name neither maps, which
// `use` refuses with `UseNamespaceNotFoundError`.
export async function platformLocator(namespaceName) {
  const source = await loadSource('#' + namespaceName);
  return source === null ? null : { source };
}
