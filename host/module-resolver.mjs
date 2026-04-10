// Module resolver — scans a library directory, evaluates .qlang
// modules in dependency order, and produces a catalog of namespace
// keyword → module env Map pairs ready to install into a session.
//
// Convention: filesystem path maps to namespace keyword.
//   lib/qlang/error.qlang          → :qlang/error
//   lib/qlang/error/guards.qlang   → :qlang/error/guards
//
// The .qlang extension is stripped; slashes are namespace separators.
// Module source is pure qlang — let declarations only. The module's
// env delta (bindings not in the base env) is its export surface.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../src/parse.mjs';
import { evalAst } from '../src/eval.mjs';
import { makeState } from '../src/state.mjs';
import { langRuntime } from '../src/runtime/index.mjs';
import { keyword } from '../src/types.mjs';

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

// resolveModules(libDir, opts?) → Map<keyword, Map>
//
// Discovers, evaluates, and returns a catalog of module envs.
// Each entry: namespace keyword → module export env (Map).
//
// opts.baseEnv — initial env for module evaluation (default: langRuntime())
// opts.dependencies — Map<namespaceName, string[]> for ordering
//                     (default: evaluate in discovery order)
export function resolveModules(libDir, opts = {}) {
  const discovered = discoverModules(libDir);
  const baseEnv = opts.baseEnv ?? langRuntime();
  const catalog = new Map();

  // Topological order if dependencies provided; otherwise discovery order.
  const order = opts.dependencies
    ? topoSort(discovered, opts.dependencies)
    : [...discovered.keys()];

  for (const namespaceName of order) {
    const filePath = discovered.get(namespaceName);

    // Build eval env: base + all previously resolved modules merged
    let evalEnv = new Map(baseEnv);
    for (const [nsKw, moduleEnv] of catalog) {
      for (const [k, v] of moduleEnv) evalEnv.set(k, v);
    }

    const source = readFileSync(filePath, 'utf8');
    const ast = parse(source, { uri: namespaceName });
    const initialState = makeState(evalEnv, evalEnv);
    const finalState = evalAst(ast, initialState);

    // Export = env delta (bindings added by this module)
    const moduleExports = new Map();
    for (const [k, v] of finalState.env) {
      if (!evalEnv.has(k)) {
        moduleExports.set(k, v);
      }
    }

    catalog.set(keyword(namespaceName), moduleExports);
  }

  return catalog;
}

// installModules(session, catalog)
//
// Installs resolved module catalog into a session. Each module env
// is bound under its namespace keyword so `use(:qlang/error)` works.
export function installModules(session, catalog) {
  for (const [nsKeyword, moduleEnv] of catalog) {
    session.bind(nsKeyword.name, moduleEnv);
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
