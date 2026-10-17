// The loader of a source that `#qlang/load-source` picks by its condition
// `default`, which answers a name, `#qlang/number`, with the text it fetches
// from the URL the platform resolves the name to, with null where the name
// resolves to no URL, and raises `::builtin/SourceLoadError` with the HTTP
// `:status` of a response that fails.
// The rules it holds: [QSWRK#tooling].

import { BuiltinSourceLoadError } from './source-load-error.mjs';

/* global fetch */
export async function loadSource(logicalName) {
  let url;
  try {
    url = import.meta.resolve(logicalName);
  } catch {
    return null;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new BuiltinSourceLoadError({
      host: 'web',
      logicalName,
      sourceLocation: url,
      status: res.status
    });
  }
  return res.text();
}
