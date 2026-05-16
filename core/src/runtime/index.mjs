// Assemble the langRuntime — the initial environment Map every
// query starts with. Every runtime module lives in one of two
// places:
//
//   1. lib/qlang/ — the authored source catalog, split across:
//      - core.qlang: orchestrator, one `use([...])` call that
//        loads the families in order.
//      - operand/<family>.qlang (arith, vec, container, set-op,
//        map-op, string, predicate, control, format,
//        reflective): per-family operand BindSteps and the
//        per-site error tags they throw, declared inline.
//      - runtime-invariants.qlang: shared / cross-family
//        runtime tag-bindings (projection, combinator, parser,
//        AST codec, dispatch, registry, session, render).
//      - tag.qlang: value-class constructors (::conduit,
//        ::qlang, ::json).
//      Each operand BindStep binds an identifier to a descriptor
//      Map carrying `:kind :builtin` plus a
//      `:impl :qlang/prim/<name>` keyword that resolves
//      against `PRIMITIVE_REGISTRY` at dispatch time. Attached
//      doc-prefixes live on each module's `qlang/ast/<uri>`
//      Quote AST as the step's `.docs` Vec and are reachable
//      through axis-operands (`:name | docs`, `:name | examples`).
//
//   2. src/runtime/*.mjs — the JS-level primitive impls. Each
//      module binds its impls into PRIMITIVE_REGISTRY at import
//      time under namespaced :qlang/prim/<name> keys. The
//      dispatch wrappers in src/runtime/dispatch.mjs (valueOp,
//      higherOrderOp, nullaryOp, overloadedOp, stateOp,
//      stateOpVariadic, higherOrderOpVariadic) attach a tiny
//      meta object carrying only the `captured` range — the rest
//      of the metadata lives in the operand-family catalog files
//      and is addressed by descriptor-Map projection at
//      reify / manifest time.
//
// langRuntime() ties the two together by parsing core.qlang once
// (which threads through `use(...)` to load every family via the
// `:qlang/locator`-resolved sources), evaluating it against a
// seed env carrying just `:use` and the locator, and handing back
// a shallow copy of the resulting template on every call so callers
// can add their own bindings (BindStep, as, use) without mutating
// the template. The descriptor Maps inside the template are frozen
// and shared between copies — safe because qlang values are
// immutable at the language level.
//
// Importing this file is what wires the primitive registry: every
// runtime/*.mjs module listed in the import block runs its side-
// effect registry bindings at module-load time, so by the time
// langRuntime() parses the catalog, PRIMITIVE_REGISTRY already
// holds every :qlang/prim/* key that the descriptors reference.

// Side-effect imports — each runtime module binds its impls into
// PRIMITIVE_REGISTRY during module load. The imports themselves
// carry no named binding; the act of importing triggers the
// registration blocks at the tail of each file.
import './vec.mjs';
import './map.mjs';
import './set.mjs';
import './setops.mjs';
import './arith.mjs';
import './string.mjs';
import './format.mjs';
import './predicates.mjs';
import './control.mjs';
import './error.mjs';
import './keyword-op.mjs';
import './tagged.mjs';
import './bind-op.mjs';
import './use-op.mjs';
import './reify-op.mjs';
import './code-as-data.mjs';
import './axis.mjs';

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { makeState } from '../state.mjs';
import { isKeyword, makeQuote } from '../types.mjs';
import { moduleAstKey, RUNTIME_LOCATOR_KEY } from '../env-keys.mjs';
import { PRIMITIVE_REGISTRY, primKey } from '../primitives.mjs';
import { platformLocator, BootstrapRootMissingError } from './bootstrap.mjs';

// Cached template env — parsed and evaluated once on first call,
// then shallow-copied for every subsequent caller. Parsing
// core.qlang on every session construction would be wasteful;
// reusing the frozen descriptor Maps across sessions is safe
// because they are immutable.
let _templateEnvPromise = null;

// langRuntime() — returns a Promise<fresh env Map> seeded with the
// full built-in catalog. Each call returns a new top-level Map, so
// callers can write their own bindings (through def / as / use,
// or through session.bind at the host level) without affecting
// other sessions. The inner descriptor Maps are shared frozen
// values. Bootstrap is async because evalAst is async; the template
// is cached so the parse+eval happens once per process.
export async function langRuntime() {
  if (_templateEnvPromise === null) {
    _templateEnvPromise = buildLangRuntime(platformLocator);
  }
  const templateEnv = await _templateEnvPromise;
  return new Map(templateEnv);
}

// `buildLangRuntime(locator)` — extracted bootstrap so a test can
// drive it with a custom locator (e.g. a stub returning `null` to
// trigger `BootstrapRootMissingError`) without touching the cached
// module-level template. Production code reaches the runtime
// through `langRuntime()` which delegates here with the platform
// locator and memoises the result.

export async function buildLangRuntime(locator) {
  // Bootstrap seed: the only env entries `core.qlang` needs
  // before its own `use([...])` call pulls in the operand family
  // catalog and shared-runtime tag-bindings. `:use` is the operand
  // the root module invokes on every family namespace; `:qlang/
  // locator` is the platform-conditional source resolver `use`
  // threads through for every namespace lookup
  // (runtime-invariants, tag, operand/arith, operand/vec, …).
  const seedEnv = new Map();
  seedEnv.set('use', PRIMITIVE_REGISTRY.resolve(primKey('use')));
  seedEnv.set(RUNTIME_LOCATOR_KEY, locator);

  // Load the root catalog module — `:qlang/core` — through the
  // same locator everything else flows through. Browser-side
  // import map and Node-side `imports` field point this name
  // at the authored `core.qlang` file.
  const rootResult = await locator('qlang/core');
  if (rootResult === null) throw new BootstrapRootMissingError();
  const coreSource = rootResult.source;
  const coreAst = parse(coreSource, { uri: 'qlang/core' });
  const bootstrapState = makeState(null, seedEnv);
  const bootstrapResult = await evalAst(coreAst, bootstrapState);
  const templateEnv = bootstrapResult.env;

  // BindStep snapshot-binds every pure-literal descriptor (Map
  // literals are pure), so each entry in templateEnv lives
  // behind a snapshot wrapper. Unwrap once here so identifier
  // lookups dispatch through the descriptor directly without
  // paying the snapshot-projection cost on every call. Attached
  // doc-prefix strings stay on each catalog module's
  // `qlang/ast/<uri>` Quote AST — axis-operands `docs` /
  // `examples` walk the family Quote that declared the binding.
  // Reify therefore holds the structural metadata only; prose
  // lives at one address (the AST attached prefix), reachable
  // through `:name | docs`.
  for (const [name, value] of templateEnv) {
    if (value instanceof Map && value.get('kind') &&
        value.get('kind').name === 'snapshot') {
      templateEnv.set(name, value.get('payload'));
    }
  }

  // Resolve :impl keywords to function values for built-in
  // operands — the dispatch hot path reads the function from the
  // descriptor without a registry lookup per call. Tag bindings
  // keep their :impl as a keyword (`:qlang/type/<tag>`);
  // evalTaggedLit resolves it through PRIMITIVE_REGISTRY at
  // invocation. That keeps `reify(::tag)` output readable — a
  // keyword instead of a JS-source dump of an opaque constructor
  // function.
  //
  // Same pass backfills `:modifiers` and `:throws` empty Vecs on
  // any builtin descriptor that omitted them. Authors leave the
  // empty case off in the catalog (47 lines saved across the
  // family files); every consumer downstream — reify output, LSP
  // signature-help, `/throws` and `/modifiers` projections —
  // reads the field unconditionally because the env-side
  // descriptor always carries it after this pass.
  for (const [envKey, descriptor] of templateEnv) {
    if (!(descriptor instanceof Map)) continue;
    if (descriptor.get('kind')?.name !== 'builtin') continue;
    // Tag-binding declarations carry the same `:kind ::builtin`
    // shape but live under `::Tag` env-keys. Their `:impl` keyword
    // names a tag-namespace constructor (`qlang/type/<tag>`) that
    // `evalTaggedLit` resolves per call — keeping the keyword
    // readable in `reify(::Tag)` output. Skip resolving here so
    // tag-binding descriptors keep their author-form `:impl`.
    if (envKey.startsWith('::')) continue;
    const implKey = descriptor.get('impl');
    if (isKeyword(implKey)) {
      descriptor.set('impl', PRIMITIVE_REGISTRY.resolve(implKey.name));
    }
    if (!descriptor.has('modifiers')) descriptor.set('modifiers', Object.freeze([]));
    if (!descriptor.has('throws'))    descriptor.set('throws',    Object.freeze([]));
  }

  // Stamp the parsed root module as a Quote-value under the
  // canonical `qlang/ast/qlang/core` env key. The family modules
  // (operand/<family>, runtime-invariants, tag) stamp their own
  // `qlang/ast/<uri>` Quotes through the `use` operand's
  // resolveNamespaceEnv path. Axis-operands (`source`, `docs`,
  // `examples`) walk every module Quote in env to lift
  // declarative metadata directly out of the source AST. Source
  // ships alongside the lazy AST so `/source` returns the verbatim
  // text and `/ast` returns the pre-parsed AST-Map without a
  // re-parse round-trip. Store the raw JS AST inside the Quote —
  // axis-operands walk it directly via `node.type` / `node.steps`.
  // The /ast projection converts to AST-Map shape on demand for
  // user code that wants data-form navigation.
  templateEnv.set(moduleAstKey('qlang/core'), makeQuote(coreSource, coreAst));

  PRIMITIVE_REGISTRY.seal();

  return templateEnv;
}
