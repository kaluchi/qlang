// Host-catalog binding helper for embedders.
//
// A host catalog is a `.qlang` source whose BindSteps declare host
// operands the same way `core/lib/qlang/operand/*.qlang` declares
// core builtins: each binding carries a `::builtin{:impl :qlang/host/prim/<name>
// :category … :subject … :returns … :modifiers … :throws …}` descriptor;
// the host supplies the actual JS impl by name; this helper marries
// the two so the resulting env entry is shaped identically to a
// core-catalog descriptor.
//
// Effect:
//   1. parse + eval the catalog against a base env (defaults to
//      `langRuntime()`).
//   2. for each `(name, jsImpl)` pair in `impls`, copy the catalog
//      descriptor, replace `:impl` with the JS function, fill
//      `:captured` / `:effectful` / default `:modifiers` / `:throws`
//      from the function's meta, stamp `::builtin` on the JS-header.
//   3. carry every per-site error tag (`::TagName ::builtin{...}`
//      BindSteps declared alongside the operands) through to the
//      session unchanged.
//   4. stamp the parsed catalog source as a Quote under
//      `qlang/ast/<uri>` so the axis-operands `:foo | source`,
//      `:foo | docs`, `:foo | examples`, `:foo | runExamples`
//      walk the host catalog the same way they walk core's.
//
// Embedders pass either a file path (Node) or a pre-loaded source
// string (any platform):
//
//   await bindCatalog(session, {
//     source: readFileSync('lib/qlang/io.qlang', 'utf8'),
//     uri: 'host/io',
//     impls: { '@in': inFn, '@out': outFn, ... }
//   });
//
// The pattern matches what `langRuntime()` does for the core
// catalog — host catalogs become first-class peers of the core
// catalog on the discoverability surface (`manifest`, `:foo | spec`).

import { parse } from '../src/parse.mjs';
import { evalAst } from '../src/eval.mjs';
import { makeState } from '../src/state.mjs';
import { langRuntime } from '../src/runtime/index.mjs';
import {
  makeQuote,
  BUILTIN_TAG,
  stampTagHeader,
  isSnapshot,
  isQMap,
  TAG_HEADER_SYMBOL,
} from '../src/types.mjs';
import { moduleAstKey } from '../src/env-keys.mjs';
import { stampStructuralFacts } from '../src/descriptor-ops.mjs';

// `evalBindStep` routes a pure-literal `::builtin{…}` TaggedLit
// body through `makeSnapshot`, so the env entry lands wrapped as
// `Snapshot{:payload <builtin Map>, …}`. Unwrap that wrapper here
// — `stampStructuralFacts` and the `manifest`/`spec` consumers
// expect a flat `::builtin`-tagged Map. Mirrors the same pass
// `runtime/use-op.mjs::resolveNamespaceEnv` runs on locator-loaded
// namespaces, and `runtime/index.mjs::buildLangRuntime` runs on
// the core catalog after bootstrap eval.
function unwrapSnapshotBuiltin(env) {
  for (const [envKey, value] of env) {
    if (!isSnapshot(value)) continue;
    const payload = value.get('payload');
    if (!isQMap(payload)) continue;
    if (payload[TAG_HEADER_SYMBOL]?.name === 'builtin') {
      env.set(envKey, payload);
    }
  }
}

async function loadAndEval(source, uri, baseEnvPromise) {
  const ast = parse(source, { uri });
  const baseEnv = await baseEnvPromise;
  const finalState = await evalAst(ast, makeState(null, baseEnv));
  unwrapSnapshotBuiltin(finalState.env);
  return { ast, env: finalState.env, baseKeys: new Set(baseEnv.keys()) };
}

export async function bindCatalog(session, { source, uri, impls, baseEnv = null }) {
  if (typeof source !== 'string') {
    throw new TypeError(`bindCatalog: source must be a string, got ${typeof source}`);
  }
  if (typeof uri !== 'string' || uri.length === 0) {
    throw new TypeError('bindCatalog: uri must be a non-empty string');
  }
  if (impls === null || typeof impls !== 'object') {
    throw new TypeError('bindCatalog: impls must be an object mapping operand name → function value');
  }

  const { ast, env: catalogEnv, baseKeys } = await loadAndEval(
    source, uri, baseEnv ? Promise.resolve(baseEnv) : langRuntime());

  for (const [name, impl] of Object.entries(impls)) {
    const template = catalogEnv.get(name);
    if (!template) {
      throw new Error(`bindCatalog: ${uri} has no BindStep for ${name}`);
    }
    const descriptor = new Map(template);
    stampStructuralFacts(descriptor, impl);
    stampTagHeader(descriptor, BUILTIN_TAG);
    session.bind(name, descriptor);
  }

  for (const [envKey, descriptor] of catalogEnv) {
    if (!envKey.startsWith('::')) continue;
    if (baseKeys.has(envKey)) continue;
    session.bind(envKey, descriptor);
  }

  session.bind(moduleAstKey(uri), makeQuote(source, ast));
}
