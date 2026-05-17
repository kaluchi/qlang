// `SourceLoadError` — shared base for both qlang-source loaders
// (`host/load-source-node.mjs` and `src/load-source-web.mjs`).
// Conditional `#qlang/load-source` resolves to exactly one loader
// per host (Node picks the createRequire+fs path, browsers / Deno
// / Bun pick the import.meta.resolve+fetch path), so only one
// throw site fires per process. The tag identity stays single
// regardless of the host the runtime ships into — Sentry groups
// every failure under the same fingerprint, and consumers
// disambiguate by reading `:context.host` (`'node'` vs `'web'`).

export class SourceLoadError extends Error {
  constructor({ host, logicalName, sourceLocation, cause, status }) {
    const tail = cause
      ? cause.message ?? String(cause)
      : (status !== undefined ? `HTTP ${status}` : '');
    super(`failed to read qlang source '${logicalName}' from ${sourceLocation}${tail ? ` — ${tail}` : ''}`);
    this.name = 'SourceLoadError';
    this.fingerprint = 'SourceLoadError';
    this.context = { host, logicalName, sourceLocation, cause, status };
  }
}
