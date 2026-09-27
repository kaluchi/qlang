// The locator of the catalog: `#qlang/<name>` resolves through the
// `imports` field of `package.json` on Node and through the import map in
// a browser, read by the loader the condition of `#qlang/load-source`
// picks.

import { loadSource } from '#qlang/load-source';
import { declareInvariantError } from '../errors.mjs';

export const BootstrapRootMissingError = declareInvariantError(
  'BootstrapRootMissingError',
  () => "qlang bootstrap: '#qlang/core' must resolve to the catalog root module — " +
    'add an entry to package.json#imports or the import map',
  { operand: '::qlang' }
);

// A catalog root that answers an error left a module of the catalog
// unloaded.
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
