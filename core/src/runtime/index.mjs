// Assemble the langRuntime — the initial environment Map every
// query starts with. Every runtime module lives in one of two
// places:
//
//   1. lib/qlang/ — the authored source catalog, split across:
//      - core.qlang: orchestrator, one `use [...]` call that
//        loads the families in order.
//      - operand/<family>.qlang (arith, vec, container, setOp,
//        mapOp, string, predicate, control, format,
//        reflective): per-family operand BindSteps and the
//        per-site error tags they throw, declared inline.
//      - runtime-invariants.qlang: shared / cross-family
//        runtime tag-bindings (projection, combinator, parser,
//        AST codec, dispatch, registry, session, render).
//      - tag.qlang: value-class constructors (::conduit,
//        ::quote, ::builtin).
//      Each operand BindStep writes the record of a binding [D63]
//      whose value is a descriptor Map stamped with `::builtin`
//      identity on its JS-header slot plus a `:impl
//      :qlang/prim/<name>` keyword that resolves against
//      `PRIMITIVE_REGISTRY` at dispatch time. The record holds the
//      attached doc-prefixes and the quote of the step, which the
//      axis-operands project (`::vec/count | docs`, `| examples`).
//
//   2. src/runtime/*.mjs — the JS-level primitive impls. Each
//      module binds its impls into PRIMITIVE_REGISTRY at import
//      time under namespaced :qlang/prim/<name> keys. The
//      dispatch wrappers in src/runtime/dispatch.mjs (valueOp,
//      higherOrderOp, nullaryOp, overloadedOp, stateOp,
//      stateOpVariadic, higherOrderOpVariadic) attach a tiny
//      meta object carrying only the `captured` range — the rest
//      of the metadata lives in the operand-family catalog files
//      and is addressed by descriptor-Map projection, or by the
//      axis-operands over the binding's record.
//
// langRuntime() ties the two together by parsing core.qlang once
// (which threads through `use …` to load every family via the
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
import './setops.mjs';
import './arith.mjs';
import './string.mjs';
import './format.mjs';
import './predicates.mjs';
import './control.mjs';
import './error.mjs';
import './keyword-op.mjs';
import './tagged.mjs';
import './quote-steps.mjs';
import './bind-op.mjs';
import './use-op.mjs';
import './manifest-op.mjs';
import './codeAsData.mjs';
import './axis.mjs';

// The stamp pass below reads every per-site error's throw-site spec
// out of the registry, so each module that declares one has to be
// loaded before the pass runs. The operand impls above cover the
// runtime's own sites; the two host-boundary seams — value ↔ tagged
// JSON, session envelope — declare theirs outside this folder, and
// the `::Tag` bindings the catalog carries for them are the same
// bindings whether a host reached the runtime through the package
// entry or through the `./runtime` subpath.
import '../codec.mjs';
import '../session.mjs';

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import {
  keyword, isErrorValue, bindingValueOf, BUILTIN_TAG, stampTagHeader, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { RUNTIME_LOCATOR_KEY, tagBindingKey, isTagBindingName } from '../env-keys.mjs';
import { PRIMITIVE_REGISTRY, primKey, TYPE_KEY_PREFIX } from '../primitives.mjs';
import { stampStructuralFacts, stampThrowSiteSpec } from '../descriptor-ops.mjs';
import {
  platformLocator, BootstrapRootMissingError, BootstrapCatalogNotLoadedError
} from './bootstrap.mjs';

// Per-locator template env cache — `buildLangRuntime` parses the
// root catalog module and resolves every operand family once per
// distinct locator function. Each subsequent `langRuntime()` call
// against the same locator hands back a shallow copy of the cached
// template; inner descriptor Maps are frozen and shared across
// copies, so caller-side bindings (BindStep, as, use, session.bind)
// land in the top-level Map without leaking into other sessions.
const _templateEnvByLocator = new WeakMap();

// langRuntime({ locator? }) — returns a Promise<fresh env Map>
// seeded with the full built-in catalog. The catalog source comes
// from `opts.locator` — a `(namespaceName: string) → Promise<{
// source } | null>` function. Without an explicit locator the
// runtime falls back to `platformLocator`, which reads `.qlang`
// files through `package.json#imports` (Node `createRequire` +
// `fs.readFile`, browser `import.meta.resolve` + `fetch`).
// Embedders without an import map (browser bundles, Deno servers
// with restricted permissions, …) pass their own locator —
// typically one that closes over an in-process Map of catalog
// sources. The bundled browser entry point at
// `site/scripts/bundle-qlang.mjs` is the reference example: it
// ships `qlang.js` with an `inlineCatalogLocator` named export,
// and consumers call `langRuntime({ locator: inlineCatalogLocator })`.
//
// Bootstrap is async because `evalAst` is async; the template is
// cached per locator so the parse+eval happens once per locator
// per process.
export async function langRuntime(opts = {}) {
  const locator = opts.locator ?? platformLocator;
  let templatePromise = _templateEnvByLocator.get(locator);
  if (!templatePromise) {
    templatePromise = buildLangRuntime(locator);
    _templateEnvByLocator.set(locator, templatePromise);
  }
  const templateEnv = await templatePromise;
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
  // before its own `use [...]` call pulls in the operand family
  // catalog and shared-runtime tag-bindings. `:use` is the operand
  // the root module invokes on every family namespace; `:qlang/
  // locator` is the platform-conditional source resolver `use`
  // threads through for every namespace lookup
  // (runtime-invariants, tag, operand/arith, operand/vec, …).
  const seedEnv = new Map();
  seedEnv.set('use', PRIMITIVE_REGISTRY.resolve(primKey('use')));
  seedEnv.set(RUNTIME_LOCATOR_KEY, locator);
  // Chicken-and-egg: `::builtin{…}` is the constructor shape every
  // catalog descriptor body rides on, including `::builtin`'s own
  // declaration in runtime-invariants.qlang. Seed the env with a
  // minimal `::builtin` tag-binding pointing at the registered
  // `qlang/type/builtin` constructor so the first `::builtin{…}`
  // TaggedLit in the catalog finds an `:impl` to dispatch on. The
  // runtime-invariants module then redeclares `::builtin` formally
  // (through the same constructor) and its record lands in env under
  // the same key — same shape, same `:impl`, shadow without
  // observable drift.
  const seedBuiltinDescriptor = new Map();
  seedBuiltinDescriptor.set('impl', keyword(TYPE_KEY_PREFIX + 'builtin'));
  stampTagHeader(seedBuiltinDescriptor, BUILTIN_TAG);
  seedEnv.set(tagBindingKey('builtin'), seedBuiltinDescriptor);

  // Load the root catalog module — `:qlang/core` — through the
  // same locator everything else flows through. Browser-side
  // import map and Node-side `imports` field point this name
  // at the authored `core.qlang` file.
  const rootResult = await locator('qlang/core');
  if (rootResult === null) throw new BootstrapRootMissingError();
  const coreSource = rootResult.source;
  const coreAst = parse(coreSource, { uri: 'qlang/core' });
  const bootstrapState = rootState(null, seedEnv);
  const bootstrapResult = await evalAst(coreAst, bootstrapState);
  if (isErrorValue(bootstrapResult.pipeValue)) {
    throw new BootstrapCatalogNotLoadedError({
      tagName: bootstrapResult.pipeValue.tag.literal
    });
  }
  const templateEnv = bootstrapResult.env;

  // Resolve :impl keywords to function values for built-in
  // operands — the dispatch hot path reads the function from the
  // descriptor without a registry lookup per call. Tag bindings
  // keep their :impl as a keyword (`:qlang/type/<tag>`);
  // evalTaggedLit resolves it through PRIMITIVE_REGISTRY at
  // every invocation, so `::Tag | spec` surfaces the readable
  // `:qlang/type/<tag>` keyword handle the catalog declared.
  //
  // `stampStructuralFacts` is the single mint-site backfill —
  // swaps `:impl` for the callable, stamps `:captured` /
  // `:effectful` straight off the resolved function's meta, reads
  // `:throws` back off the sites that name the binding, and forges
  // an empty `:modifiers` Vec when the catalog author omitted it. Every consumer downstream — `manifest`
  // output, LSP signature-help, `/throws` and `/modifiers`
  // projections — reads the field unconditionally because the
  // env-side descriptor always carries it after this pass.
  for (const [envKey, entry] of templateEnv) {
    const descriptor = bindingValueOf(entry);
    if (!(descriptor instanceof Map)) continue;
    if (descriptor[TAG_HEADER_SYMBOL]?.name !== 'builtin') continue;
    // Tag-binding declarations carry the same builtin JS-header
    // tag but live under `::Tag` env-keys. Their `:impl` keyword
    // names a tag-namespace constructor (`qlang/type/<tag>`) that
    // `evalTaggedLit` resolves per call — keeping the keyword
    // readable in `::Tag | spec` output, so the author-form
    // `:impl` stays. What lands there is the throw-site spec: the
    // `:category` / `:operand` / `:position` / `:expectedType` the
    // per-site factory recorded when it built the class.
    if (isTagBindingName(envKey)) {
      stampThrowSiteSpec(descriptor, envKey);
      continue;
    }
    // Every non-`::` builtin descriptor in the catalog carries
    // `:impl :qlang/prim/<name>` by contract — catalog-test
    // `lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY`
    // pins the invariant, and a missing handle would surface as
    // a PrimitiveKeyUnboundError at first dispatch. The straight
    // `stampStructuralFacts` call here trusts the contract; a
    // descriptor authored without `:impl` cannot reach env.
    const implKey = descriptor.get('impl');
    stampStructuralFacts(descriptor, PRIMITIVE_REGISTRY.resolve(implKey.name), envKey);
  }

  PRIMITIVE_REGISTRY.seal();

  return templateEnv;
}
