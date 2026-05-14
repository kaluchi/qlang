// Node qlang-source loader. Resolved via the package's `imports`
// field under `#qlang/load-source` when the host is Node.
//
// `createRequire(import.meta.url).resolve(name)` is the Node-native
// way to honour the calling package's `imports` field — it works in
// every test runner / loader / direct script run, where
// `import.meta.resolve` is shimmed away (vitest's vite-ssr
// transform drops it). `fs.readFile` then loads the resolved path
// directly; no `fetch(file://)` round-trip (undici does not
// implement that scheme as of Node 22 LTS).
//
// Contract: returns the source text on success, or `null` when the
// logical name has no entry in the calling package's `imports`
// field. Every other failure (file missing, read I/O error,
// permission) propagates as `SourceLoadError`.

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

export async function loadSource(logicalName) {
  let filePath;
  try {
    filePath = createRequire(import.meta.url).resolve(logicalName);
  } catch (cause) {
    if (cause?.code === 'ERR_PACKAGE_IMPORT_NOT_DEFINED' || cause?.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw cause;
  }
  try {
    return await readFile(filePath, 'utf8');
  } catch (cause) {
    throw new SourceLoadError({ logicalName, filePath, cause });
  }
}

export class SourceLoadError extends Error {
  constructor({ logicalName, filePath, cause }) {
    super(`failed to read qlang source '${logicalName}' from ${filePath} — ${cause?.message ?? cause}`);
    this.name = 'SourceLoadError';
    this.fingerprint = 'SourceLoadError';
    this.context = { logicalName, filePath, cause };
  }
}
