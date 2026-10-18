// The loader of a source that `#qlang/load-source` picks by its condition
// `default`, which answers the uri of a source, `qlang/number`, with the text
// it fetches from the URL the platform resolves `#qlang/number` to, with null
// where the name resolves to no URL, and raises `::builtin/SourceLoadError`
// with the status of a response that fails as its cause [QSHST#source].
// The rules it holds: [QSWRK#tooling].

import { keyword } from './types.mjs';
import { BuiltinSourceLoadError } from './source-load-error.mjs';

/* global fetch */
export async function loadSource(uri) {
  let url;
  try {
    url = import.meta.resolve(`#${uri}`);
  } catch {
    return null;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new BuiltinSourceLoadError({ origin: keyword(uri), sourceLocation: url, cause: new Error(`HTTP ${res.status}`) });
  }
  return res.text();
}
