// Web / default qlang-source loader. Resolved via the package's
// `imports` field under `#qlang/load-source` when the host is NOT
// Node — bundlers targeting browser / Deno / Bun / a service worker
// pick this entry through the `"default"` condition.
//
// Resolution flow: `import.meta.resolve(logicalName)` consults the
// document's import map (or the bundler's equivalent), returns a
// URL the platform can fetch. `fetch` retrieves the text. Vite
// leaves `import.meta.resolve` as-is for the browser bundle, so
// native runtime resolution handles bare `#qlang/<ns>` specifiers
// against the embedder-supplied import map.
//
// Contract: returns the source text on success, or `null` when the
// logical name has no entry in the import map. Every other failure
// (HTTP error, parse error inside the loaded source) propagates as
// `SourceLoadError`.

import { SourceLoadError } from './source-load-error.mjs';

export async function loadSource(logicalName) {
  let url;
  try {
    url = import.meta.resolve(logicalName);
  } catch {
    return null;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new SourceLoadError({
      host: 'web',
      logicalName,
      sourceLocation: url,
      status: res.status
    });
  }
  return res.text();
}
