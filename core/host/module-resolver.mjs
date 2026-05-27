// Module resolver — scans a library directory, evaluates .qlang
// modules in dependency order, and produces a catalog of namespace
// keyword → resolved-module entries ready to install into a session.
//
// Convention: filesystem path under the caller-supplied `libDir`
// maps to a namespace keyword. With `libDir = "lib/extras"`:
//   lib/extras/error.qlang         → :error
//   lib/extras/error/guards.qlang  → :error/guards
//
// The .qlang extension is stripped; slashes are namespace separators.
// Module source is pure qlang — BindStep declarations. The module's
// env delta (bindings not in the base env) is its export surface.
//
// Each catalog entry carries `{ exports, source, ast }` so the
// install side can stamp both the export Map under the namespace
// key AND the source-as-Quote under `qlang/ast/<ns>`, matching the
// shape `use(:ns)`'s locator pathway produces. The Quote stamp is
// what enables axis-operands (`:name | source` / `| docs` /
// `| examples`) to walk the loaded module's AST.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../src/parse.mjs';
import { evalAst } from '../src/eval.mjs';
import { makeState } from '../src/state.mjs';
import { langRuntime } from '../src/runtime/index.mjs';
import { makeQuote } from '../src/types.mjs';
import { moduleAstKey } from '../src/env-keys.mjs';


// discoverModules(libDir) → Map<namespaceName, filePath>
//
// Recursively scans libDir for .qlang files and builds a mapping
// from namespace name (e.g. "qlang/error") to absolute file path.
export function discoverModules(libDir) {
  const modules = new Map();
  const files = readdirSync(libDir, { recursive: true })
    .filter(f => f.endsWith('.qlang'))
    .map(f => f.split(/[\\/]/).join('/'));  // normalize separators

  for (const relPath of files) {
    const namespaceName = relPath.replace(/\.qlang$/, '');
    modules.set(namespaceName, join(libDir, relPath));
  }
  return modules;
}

// resolveModules(libDir, opts?) → Map<nsName, { exports, source, ast }>
//
// Discovers, evaluates, and returns a catalog of resolved-module
// entries. Each entry: namespace name → { exports, source, ast }.
//   - exports: Map of bindings added by the module (env delta).
//   - source:  raw .qlang source text.
//   - ast:     parsed AST root the eval pass walked.
// The `source` + `ast` pair lets `installModules` stamp the
// module's source-as-Quote under `qlang/ast/<ns>`, giving axis-
// operands the same discoverability path the locator-based
// `use(:ns)` already enables.
//
// opts.baseEnv — initial env for module evaluation (default: langRuntime())
// opts.dependencies — Map<namespaceName, string[]> for ordering
//                     (default: evaluate in discovery order)
export async function resolveModules(libDir, opts = {}) {
  const discovered = discoverModules(libDir);
  const resolverBaseEnv = opts.baseEnv ?? await langRuntime();
  const resolverCatalog = new Map();

  // Topological order if dependencies provided; otherwise discovery order.
  const resolveOrder = opts.dependencies
    ? topoSort(discovered, opts.dependencies)
    : [...discovered.keys()];

  for (const namespaceName of resolveOrder) {
    const modulePath = discovered.get(namespaceName);

    // Build eval env: base + every namespace already in the
    // catalog from an earlier iteration of this pass merged in.
    const moduleEvalEnv = new Map(resolverBaseEnv);
    for (const earlierEntry of resolverCatalog.values()) {
      for (const [bindKey, bindVal] of earlierEntry.exports) moduleEvalEnv.set(bindKey, bindVal);
    }

    const moduleSource = readFileSync(modulePath, 'utf8');
    const moduleAst = parse(moduleSource, { uri: namespaceName });
    const moduleInitialState = makeState(moduleEvalEnv, moduleEvalEnv);
    const moduleFinalState = await evalAst(moduleAst, moduleInitialState);

    // Export = env delta (bindings added by this module)
    const moduleExports = new Map();
    for (const [exportKey, exportVal] of moduleFinalState.env) {
      if (!moduleEvalEnv.has(exportKey)) {
        moduleExports.set(exportKey, exportVal);
      }
    }

    resolverCatalog.set(namespaceName, {
      exports: moduleExports,
      source:  moduleSource,
      ast:     moduleAst
    });
  }

  return resolverCatalog;
}

// installModules(session, catalog)
//
// Installs resolved module catalog into a session. For each
// namespace, binds two env keys:
//   - <nsName>          → the export Map (so `use(:nsName)` merges)
//   - qlang/ast/<nsName> → Quote(source, ast) so axis-operands
//                          (`:name | source` / `| docs` /
//                          `| examples`) walk the module AST.
// This matches the env shape `runtime/use-op.mjs::resolveNamespaceEnv`
// produces for locator-loaded modules — install-path and locator-
// path stay symmetric on the axis-operand discoverability surface.
export function installModules(session, catalog) {
  for (const [nsName, entry] of catalog) {
    session.bind(nsName, entry.exports);
    session.bind(moduleAstKey(nsName), makeQuote(entry.source, entry.ast));
  }
}

function topoSort(discovered, dependencies) {
  const visited = new Set();
  const result = [];

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const deps = dependencies.get(name) ?? [];
    for (const dep of deps) visit(dep);
    if (discovered.has(name)) result.push(name);
  }

  for (const name of discovered.keys()) visit(name);
  return result;
}
