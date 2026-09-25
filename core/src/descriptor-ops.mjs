// Shared shape primitives for builtin descriptor Maps.
//
// A raw builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: a Map carrying the author's
// `:impl :qlang/prim/<name>` handle keyword alongside `:category`
// … `:subject` … `:captured [min max]` … `:effectful <boolean>`,
// with identity (`::builtin`) on the Map's JS-header
// `TAG_HEADER_SYMBOL` slot (stamped by the `::builtin{…}`
// constructor in `runtime/tagged.mjs`) and the resolved callable on
// the `BUILTIN_IMPL_SLOT` JS-header slot. The reader sites
// (`isBuiltinDescriptor` in `eval.mjs`, `runtime/use-op.mjs`
// snapshot-unwrap) probe the header — no `:kind` field on the
// raw env entry — and dispatch reads the callable through
// `resolveBuiltinImpl`, so every field the data plane exposes to
// `keys` / `/key` / `printValue` is a qlang value.
//
// `stampStructuralFacts(descriptor, fn, bindingName)` is the single mint-site
// that stamps the callable onto the slot and backfills
// `:captured` / `:effectful` from the resolved function plus the
// empty-fallback Vec for `:modifiers` / `:throws`. Both bootstrap
// surfaces — the langRuntime core-catalog pass in
// `runtime/index.mjs` and the `use`-locator namespace-resolution
// pass in `runtime/use-op.mjs` — go through here, so env entries
// carry the full runtime shape uniformly and the `spec` axis can
// return them without further projection.
//
// `resolveBuiltinImpl(descriptor)` is the dispatch-side reader:
// the stamped callable when bootstrap resolved it, otherwise the
// `:impl` handle keyword walked through `PRIMITIVE_REGISTRY` so a
// descriptor a query assembled from data dispatches like any
// catalog entry.


import {
  BUILTIN_TAG, TAG_HEADER_SYMBOL, isKeyword, typeKeyword, keyword, makeTagKeyword,
  stampBuiltinImpl, builtinImplOf
} from './types.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import {
  throwSiteSpecOf,
  throwSiteTagsRaisedBy,
  declareShapeError
} from './errors.mjs';
import { stripTagBindingPrefix, isTagBindingName } from './env-keys.mjs';

// A descriptor assembled inside a query (`::builtin{:impl
// :qlang/prim/count}`) reaches dispatch without the bootstrap
// stamp, so `resolveBuiltinImpl` walks its `:impl` handle through
// the registry. A handle of any other shape fires this site rather
// than handing `PRIMITIVE_REGISTRY.resolve` a nameless value.
const BuiltinImplNotPrimitiveKeyError = declareShapeError('BuiltinImplNotPrimitiveKeyError',
  ({ actualType }) =>
    `::builtin descriptor :impl must be a :qlang/prim/<name> handle keyword, got ${actualType.name}`,
  { operand: '::builtin', expectedType: 'keyword' }
);

// stampStructuralFacts(descriptor, fn) → descriptor (mutated in place)
//
// Mint-site shared between every site that resolves a `::builtin{
// :impl :qlang/prim/<name>}` descriptor against a JS function
// value: stamps the callable onto the `BUILTIN_IMPL_SLOT` slot,
// leaves the author's handle keyword on `:impl` for readers, stamps
// `:captured` / `:effectful` straight off the resolved function's
// meta, stamps the `:throws` Vec through `stampRaisedTags`, and
// backfills an empty `:modifiers` Vec when the catalog author
// omitted it. The descriptor Map is a freshly-built
// JS-layer construction-site value at this point (still inside
// the bootstrap fill loop, not yet observable via any other env
// key), so direct `.set` ceremony is the qlang-side equivalent
// of stamping a fresh value at the factory boundary.
export function stampStructuralFacts(descriptor, fn, bindingName) {
  stampBuiltinImpl(descriptor, fn);
  descriptor.set('captured', [...fn.meta.captured]);
  descriptor.set('effectful', fn.effectful);
  if (!descriptor.has('modifiers')) descriptor.set('modifiers', Object.freeze([]));
  stampRaisedTags(descriptor, bindingName);
  return descriptor;
}

// `:throws` is the reverse of the `:operand` each throw site
// records; the stamp reads it back off the registry. An operand
// always carries the field — `stampStructuralFacts` calls this for
// every one, so a consumer projects it unconditionally there — while
// a tag carries it only when something raises through it, which is
// the value-class constructors and nothing else.
export function stampRaisedTags(descriptor, bindingName, whenEmpty = 'stamp') {
  const raised = throwSiteTagsRaisedBy(bindingName).map(makeTagKeyword);
  if (raised.length === 0 && whenEmpty === 'omit') return descriptor;
  descriptor.set('throws', Object.freeze(raised));
  return descriptor;
}

// stampThrowSiteSpec(binding, envKey) → binding
//
// A per-site error's structural facts — `:category`, `:operand`,
// `:position`, `:expectedType` — are properties of the throw site,
// recorded there by the factory that builds the class. This stamps
// them onto the `::Tag` binding the catalog declares under the same
// name, so `result !| type | spec` reads one Map while the facts
// have one spelling. A tag with no throw site (`::ParseError`, the
// kinds of the core, the value-class constructors) keeps whatever body
// the catalog authored.
//
// Both stamp sites — the core-catalog pass in `runtime/index.mjs`
// and the namespace-resolution pass in `runtime/use-op.mjs` — hand
// every env entry here, so the shape check lives at this one mint.
// A `::Tag` whose body is a pure literal binds as a Snapshot rather
// than a descriptor Map, and a fact stamped onto the wrapper would
// ride alongside `:payload` where `spec` never reads it.
export function stampThrowSiteSpec(binding, envKey) {
  if (!isTagBindingName(envKey)) return binding;
  if (binding[TAG_HEADER_SYMBOL]?.name !== BUILTIN_TAG.name) return binding;
  const tagDescriptor = binding;
  stampRaisedTags(tagDescriptor, envKey, 'omit');
  const spec = throwSiteSpecOf(stripTagBindingPrefix(envKey));
  if (spec === undefined) return tagDescriptor;
  tagDescriptor.set('category', keyword(spec.category));
  tagDescriptor.set('operand', operandIdentifier(spec.operand));
  if (spec.position !== undefined) {
    tagDescriptor.set('position', typeof spec.position === 'number'
      ? spec.position
      : keyword(spec.position));
  }
  if (spec.expectedType !== undefined) {
    tagDescriptor.set('expectedType', Array.isArray(spec.expectedType)
      ? Object.freeze(spec.expectedType.map(keyword))
      : keyword(spec.expectedType));
  }
  return tagDescriptor;
}

// `:operand` spells a value-namespace operand as a Keyword (`:add`,
// `:@tap`) and a value-class constructor as a TagKeyword
// (`::conduit`), matching how each is written in source.
function operandIdentifier(operand) {
  return isTagBindingName(operand)
    ? makeTagKeyword(stripTagBindingPrefix(operand))
    : keyword(operand);
}

// resolveBuiltinImpl(descriptor) → function value
//
// Dispatch-side reader for a `::builtin` descriptor's callable. The
// bootstrap stamp answers for every catalog entry and every
// host-supplied impl the `use`-locator pass resolved; a descriptor a
// query assembled from data (`::builtin{:impl :qlang/prim/count} |
// as :c`) carries the handle keyword alone and walks the registry
// here, so a descriptor built as data dispatches like a catalog one.
export function resolveBuiltinImpl(descriptor) {
  const stampedImpl = builtinImplOf(descriptor);
  if (stampedImpl !== undefined) return stampedImpl;
  const implHandle = descriptor.get('impl');
  if (!isKeyword(implHandle)) {
    throw new BuiltinImplNotPrimitiveKeyError({
      actualType: typeKeyword(implHandle),
      actualValue: implHandle
    });
  }
  return PRIMITIVE_REGISTRY.resolve(implHandle.name);
}
