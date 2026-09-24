import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { classifyEffect } from './effect.mjs';
import {
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { TAG_BINDING_PREFIX } from './env-keys.mjs';
import { quoteOfBody } from './quote.mjs';

// Function values (`makeFn` output) are runtime-internal: a catalog
// descriptor carries its callable on the `BUILTIN_IMPL_SLOT`
// JS-header slot, and conduitParameter proxies live for the duration
// of a conduit body fork. They have no grammatical literal — the only
// candidate render form (`:qlang/prim/${name}`) parses back as a
// keyword value when read back. Surfacing a function value in
// pipeValue therefore violates printValue's round-trip theorem. The
// invariant fires at render time, so a host binding mounted through
// `session.bind` carrying a raw callable surfaces by name and routes
// through the locator's `impls` map instead.
export const FunctionValueLeakedToPrintError = declareInvariantError(
  'FunctionValueLeakedToPrintError',
  () => 'printValue/toPlain: function value reached render — function values must not ' +
    'surface in pipeValue. Install a host operand through a locator returning ' +
    "{ source, impls } so the namespace pass stamps the callable onto the descriptor's " +
    'BUILTIN_IMPL_SLOT (see cli/src/cli-locator.mjs); a raw callable handed to ' +
    'session.bind carries no qlang literal.'
);

// A qlang Number is a finite double (see `### number` in
// qlang-spec.md). Source cannot mint an infinity or a NaN — the
// parser refuses the literal and every arithmetic site lifts a
// numericDomain error — but a host can, through `session.bind` or
// through the `{ source, impls }` locator contract. Render and codec
// are where such a value becomes observable: `printValue` would
// answer `Infinity`, which no production reads back, and the JSON
// boundary would answer `null`. Each of those seams reads this
// guard, the same shape `FunctionValueLeakedToPrintError` gives the
// other value with no literal.
export const NumberNotFiniteLeakedToPrintError = declareInvariantError(
  'NumberNotFiniteLeakedToPrintError',
  ({ actualValue }) => `render: ${actualValue} is outside the finite-double domain a ` +
    "qlang Number lives in — a host installed it through session.bind or a locator's " +
    'impls map, where source cannot mint one'
);

// Reads the guard at every seam where a Number becomes observable.
export function finiteNumberOrLift(numberValue) {
  if (!Number.isFinite(numberValue)) throw new NumberNotFiniteLeakedToPrintError({ actualValue: String(numberValue) });
  return numberValue;
}

export const NULL = null;

// ── value-class brand ──────────────────────────────────────────
//
// Keyword / TagKeyword / Doc / Error / Function / the opaque
// TaggedInstance wrap are JS plain objects. Identity rides on a
// non-enumerable Symbol — the channel TAG_HEADER_SYMBOL uses too — so
// data carrying `{"type":"doc"}` cannot forge `isDoc`.
export const VALUE_CLASS_TAG = Symbol('qlang/valueClass');

export function brandValueClass(target, valueClass) {
  Object.defineProperty(target, VALUE_CLASS_TAG, {
    value: valueClass, enumerable: false, configurable: false, writable: false
  });
  return target;
}

export function isValueClass(v, valueClass) {
  return v !== null && typeof v === 'object' && v[VALUE_CLASS_TAG] === valueClass;
}

// ── primitive type predicates ──────────────────────────────────

export function isNull(v) { return v === null || v === undefined; }
export function isBoolean(v) { return typeof v === 'boolean'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isString(v) { return typeof v === 'string'; }
export function isKeyword(v) {
  return isValueClass(v, 'keyword');
}
export function isVec(v) {
  return Array.isArray(v);
}
export function isQMap(v) {
  return v instanceof Map;
}
export function isQSet(v) { return v instanceof Set; }

// Vec / Set — the ordered, indexable sequences `*` and the
// order-aware operands (first / take / sort / distinct / flat / …)
// dispatch over uniformly. A Set is the `distinct` of a Vec.
export function isOrderedSequence(v) {
  return isVec(v) || isQSet(v);
}

// Array view of an ordered sequence — the extractor companion to
// isOrderedSequence. A Vec yields itself (no copy); a Set
// is spread into an array in insertion order. Order-aware operands
// that need indexed access (first / last / at) or full materialisation
// (sort), and the `*` distribute fork, source their element
// array here.
export function sequenceElements(v) {
  return isVec(v) ? v : [...v];
}

// ── language value-class predicates ────────────────────────────

export function isFunctionValue(v) {
  return isValueClass(v, 'function');
}

export function isErrorValue(v) {
  return isValueClass(v, 'error');
}

// ── truthiness ─────────────────────────────────────────────────

export function isTruthy(v) {
  return v !== null && v !== undefined && v !== false;
}

// ── keyword value factory ─────────────────────────────────────
// Keyword objects are pipeline VALUES — for type-level display
// distinction from strings. Map keys are STRINGS; keyword objects
// never serve as Map keys. `.literal` carries the canonical qlang
// source form computed once via the grammar.

export function keyword(name) {
  return Object.freeze(brandValueClass({ name, literal: canonicalKeywordLiteral(name) }, 'keyword'));
}

// TagKeyword — `::tag` reference value. Tagged-instance Maps
// stamp `:kind` with a TagKeyword so the discriminator
// reads as "this is an instance of ::tag" — a tighter
// classification than the plain-keyword `:tag` symbol carries.
// `.name` mirrors the keyword shape so a single
// `kind.name === '<discriminator>'` check reads both Keyword
// (`:builtin`, `:tag` declarative kinds) and TagKeyword
// (`::conduit`, `::snapshot`, user-defined ::tag instances)
// uniformly.

export function makeTagKeyword(tag) {
  return Object.freeze(brandValueClass({ name: tag, literal: TAG_BINDING_PREFIX + tag }, 'tagKeyword'));
}

export function isTagKeyword(v) {
  return isValueClass(v, 'tagKeyword');
}

// Env-key namespaces live in `./env-keys.mjs`. The TagKeyword
// factory above stamps `TAG_BINDING_PREFIX + tag` onto every
// `::tag` literal, which is the only place value-class code needs
// the prefix; every other env-keys-aware consumer imports from
// `env-keys.mjs` directly.

// ── conduit / snapshot / quote predicates ─────────────────────
//
// Conduit and Snapshot identity rides on the Map's non-enumerable
// JS-header `tag` slot (a TagKeyword), stamped at construction
// through `defineConduitTag` / `defineSnapshotTag` below. The
// `:kind` Map field is reserved for the value's own data; user-
// built Maps that happen to carry `:kind ::Foo` flow through
// `isTaggedInstance` rather than colliding with the conduit /
// snapshot render paths.

export function isConduit(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === 'conduit';
}

export function isSnapshot(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === 'snapshot';
}

// TaggedInstance — value carrying a TagKeyword on its JS-header
// `TAG_HEADER_SYMBOL` slot. `makeTaggedInstance` mints two value
// shapes: Array / Set / Map clones with the header stamped, or
// an opaque frozen `{type, tag, payload}` wrapper for non-
// extensible payloads (scalar, Keyword, Doc, Error, already-tagged
// composite, a quote among them). Three reserved tag names own
// dedicated render / dispatch paths (`::conduit`, `::snapshot`,
// `::builtin`) and route through their own predicates
// (`isConduit`, `isSnapshot`, `isBuiltinDescriptor`).
const RESERVED_HEADER_TAG_NAMES = new Set(['conduit', 'snapshot', 'builtin']);
export function isTaggedInstance(v) {
  if (v === null || typeof v !== 'object') return false;
  const tag = v[TAG_HEADER_SYMBOL];
  if (tag === undefined) return false;
  return !RESERVED_HEADER_TAG_NAMES.has(tag.name);
}

export function isQuote(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === QUOTE_TAG_NAME;
}

// Quote — a vector of steps under the code tag `::quote`, so every
// container operand reads it as the tagged vector it is. A holder on
// the `QUOTE_AST_SLOT` carries the tree the quote runs through: the
// parser's own node for a quote read from text, filled on the first
// run for a quote assembled from data (see `quote.mjs::astOfQuote`).
// Every quote is minted here, `makeTaggedInstance` included, so the
// holder is always in place.
export const QUOTE_TAG_NAME = 'quote';
export const QUOTE_AST_SLOT = Symbol('qlang/quoteAst');

export function makeQuote(steps, ast = undefined) {
  const quote = [...steps];
  stampTagHeader(quote, QUOTE_TAG);
  stampSlot(quote, QUOTE_AST_SLOT, { ast });
  return Object.freeze(quote);
}

// The step an error literal leaves in a quote: an error value whose
// fields hold the steps that compute them, `:kind` and `:trail`
// among them, exactly as written, so it prints back as the literal it
// was read from. It never passes through `makeErrorValue`, whose
// invariant on `:trail` speaks of the error a step produces.
export function makeErrorLiteralStep(descriptor) {
  return Object.freeze(brandValueClass({
    tag: ERROR_TAG, descriptor, location: null, originalError: null, _trailHead: null
  }, 'error'));
}

// Doc — frozen JS object carrying `.content` (the verbatim text
// between `|~~ ... ~~|` markers, or after `|~~|` up to newline).
// The VALUE_CLASS_TAG Symbol brand keeps `:kind` housekeeping out of the user-visible
// Map surface. Doc value lands in pipeValue through DocLit literal in
// any Primary position; the attached-prefix path
// (DocAttachedSequence) is unrelated — there docs travel as
// `.docs` strings on the following operand-call AST node.
export function isDoc(v) {
  return isValueClass(v, 'doc');
}

export function makeDoc(content) {
  return Object.freeze(brandValueClass({ content }, 'doc'));
}

// ── tag-header symbol — Map identity slot ────────────────────
//
// Non-enumerable Symbol key under which a Map carries its
// identity TagKeyword: invisible to Map iteration (`for (const [k, v] of m)`), to `m.get('kind')`,
// to JSON serialization, and to the manifest enumeration
// surface. Every identity-bearing value-class — Conduit,
// Snapshot, TaggedInstance, catalog `::builtin` descriptor,
// materialized error — stamps the slot through `stampTagHeader`
// and reads it through `typeKeyword`'s header branch in one
// property access, leaving the data plane untouched.

export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  stampSlot(m, TAG_HEADER_SYMBOL, tag);
}

// ── JS-internal slots — the data plane stays qlang-only ───────
//
// Four structures ride a binding Map without a qlang literal
// behind them: a Conduit's body AST node, the lexical `envRef`
// holder its tie-the-knot mutates, the peggy declaration site,
// and the resolved JS function value a catalog `::builtin`
// descriptor dispatches through. Each lands on a non-enumerable
// Symbol slot — the channel `TAG_HEADER_SYMBOL` uses too — so `keys`, `/key` projection, `printValue`,
// `toPlain`, and `toTaggedJSON` see a data plane of qlang values
// alone: `:name`, `:params`, `:source` (a Quote of the body),
// `:docs`, `:effectful`, `:payload`, plus the
// `:impl :qlang/prim/<name>` handle keyword the catalog author
// wrote.
//
// The accessors below are the only readers. A dispatch site that
// reaches for `descriptor.get('impl')` gets the author's handle
// keyword; `builtinImplOf` gets the callable.

export const CONDUIT_BODY_SLOT     = Symbol('qlang/conduitBody');
export const CONDUIT_ENV_REF_SLOT  = Symbol('qlang/conduitEnvRef');
export const DECLARATION_SITE_SLOT = Symbol('qlang/declarationSite');
export const BUILTIN_IMPL_SLOT     = Symbol('qlang/builtinImpl');

function stampSlot(target, slot, value) {
  Object.defineProperty(target, slot, {
    value, enumerable: false, configurable: false, writable: false
  });
}

// Body AST of a Conduit — `applyConduit` evaluates it, `withName`
// re-mints from it, `printConduit` reads the `:source` Quote the
// factory read off it.
export function conduitBodyAst(conduit) {
  return conduit[CONDUIT_BODY_SLOT];
}

// Lexical scope anchor of a Conduit. The holder object is shared
// with the construction site so the declaration-time env lands on
// `.env` after the binding itself is in place (tie-the-knot).
export function conduitEnvRef(conduit) {
  return conduit[CONDUIT_ENV_REF_SLOT];
}

// peggy location of the BindStep / `as` call that declared the
// binding. `manifest`'s `describeBinding` lifts it into the
// qlang-Map form through `locationToQlangMap` for the `:location`
// field of the view-Map.
export function declarationSiteOf(binding) {
  // Env holds whatever a host installed through `session.bind`
  // alongside what source minted, so the read answers "no site" for
  // a value that carries no slots at all.
  return binding?.[DECLARATION_SITE_SLOT];
}

// Resolved function value of a catalog `::builtin` descriptor,
// stamped by `stampStructuralFacts` at bootstrap (and by the
// `use`-locator namespace pass for host-supplied impls).
export function builtinImplOf(descriptor) {
  return descriptor[BUILTIN_IMPL_SLOT];
}

export function stampBuiltinImpl(descriptor, fn) {
  stampSlot(descriptor, BUILTIN_IMPL_SLOT, fn);
}

// Pre-computed TagKeyword constants for runtime-internal
// identities — Map JS-header tags, error defaults, and the
// manifest view-Map discriminators. Each constant is the single
// source of truth for its tag; factories, printers, and
// manifest paths all reach for the shared instance instead of
// minting a fresh TagKeyword on every call. Listed alphabetically.

export const BUILTIN_TAG     = makeTagKeyword('builtin');
export const CONDUIT_TAG     = makeTagKeyword('conduit');
export const ERROR_TAG       = makeTagKeyword('Error');
export const PARSE_ERROR_TAG = makeTagKeyword('ParseError');
export const QUOTE_TAG       = makeTagKeyword(QUOTE_TAG_NAME);
export const SNAPSHOT_TAG    = makeTagKeyword('snapshot');
export const TAG_BINDING_TAG = makeTagKeyword('tag');
export const VALUE_TAG       = makeTagKeyword('value');

// The tags of a quote's steps [D47]: the records of what computes,
// and the wrappers a step takes on the fail track, under `*`, or in
// parentheses.
export const CALL_TAG   = makeTagKeyword('call');
export const PROJ_TAG   = makeTagKeyword('proj');
export const BIND_TAG   = makeTagKeyword('bind');
export const TAGGED_TAG = makeTagKeyword('tagged');
export const EACH_TAG   = makeTagKeyword('each');
export const FAIL_TAG   = makeTagKeyword('fail');
export const GROUP_TAG  = makeTagKeyword('group');

// ── conduit factory ───────────────────────────────────────────

export function makeConduit(body, { name, params = [], envRef = null, docs = [], location = null } = {}) {
  const m = new Map();
  m.set('name', name);
  m.set('params', Object.freeze(params.map(p => typeof p === 'string' ? keyword(p) : p)));
  m.set('source', quoteOfBody(body));
  m.set('docs', Object.freeze([...docs]));
  m.set('effectful', classifyEffect(name));
  stampTagHeader(m, CONDUIT_TAG);
  stampSlot(m, CONDUIT_BODY_SLOT, body);
  stampSlot(m, CONDUIT_ENV_REF_SLOT, envRef);
  stampSlot(m, DECLARATION_SITE_SLOT, location);
  return m;
}

// ── snapshot factory ──────────────────────────────────────────

export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  const m = new Map();
  m.set('name', name);
  m.set('payload', value);
  m.set('docs', Object.freeze([...docs]));
  m.set('effectful', classifyEffect(name));
  stampTagHeader(m, SNAPSHOT_TAG);
  stampSlot(m, DECLARATION_SITE_SLOT, location);
  return m;
}

// ── tagged-instance factory ──────────────────────────────────
//
// Identity overlay on a payload value. The TagKeyword rides on
// the payload's JS-header `TAG_HEADER_SYMBOL` slot — Array, Set,
// and Map carry symbol-keyed non-enumerable properties natively,
// so the tag stays invisible to iteration, `m.get(…)`,
// `arr[idx]`, `Set.has(…)`, JSON serialization. Operands routed
// through `isVec` / `isQSet` / `isQMap` predicates see the same
// shape they always see — `::Tag[1 2 3] | /1` indexes the
// underlying Array, `::Tag{:a 1} | keys` lists the underlying
// Map keys, `::Tag#[:a :b] | union #[:c]` merges the underlying
// Set. `typeKeyword` reads the header first so identity comes
// through `result | type`. Reserved header tags
// (`::conduit`, `::snapshot`, `::builtin`) are matched against
// in `isTaggedInstance` so the dedicated render / dispatch
// paths for those value-classes stay disjoint from generic
// TaggedInstance.
//
// Payload shapes:
//
//   Untagged Vec / Set / Map — clone and stamp header. The
//     clone keeps the payload's native shape so isVec / isQSet /
//     isQMap and every shape-preserving operand work without
//     unwrap. Flat-merging the Map payload's fields onto the
//     tagged Map (rather than nesting under `:payload`) makes
//     `tagged | keys` / `/field` / `vals` read identical to an
//     untagged Map literal. `:kind` fields stay as ordinary Map
//     data; identity rides on the JS-header alone, so a `:kind`
//     slot on user payload coexists with the instance's identity
//     without collision.
//
//   Scalar / Keyword / TagKeyword / Doc / Error / Conduit /
//     Snapshot / already-tagged composite, a quote among them —
//     wrap in a Map carrying the payload under `:payload` slot,
//     stamp the header on the wrapper. JS scalars cannot carry
//     symbol-keyed properties (they are immutable primitives);
//     frozen value-class objects (Doc / Error) refuse
//     `defineProperty` after freeze; nested tagged composites
//     already own the header slot and re-stamping would
//     overwrite the inner identity. The wrap branch covers all
//     three concerns uniformly. `tagged | payload` recovers
//     the wrapped value through the operand's dedicated branch.

export function makeTaggedInstance(tag, payload) {
  // Untagged composite — overlay header on a clone of the
  // payload, native shape preserved.
  if (Array.isArray(payload) && payload[TAG_HEADER_SYMBOL] === undefined) {
    if (tag.name === QUOTE_TAG_NAME) return makeQuote(payload);
    const arr = [...payload];
    stampTagHeader(arr, tag);
    return Object.freeze(arr);
  }
  if (payload instanceof Set
      && payload[TAG_HEADER_SYMBOL] === undefined) {
    const s = new Set(payload);
    stampTagHeader(s, tag);
    return s;
  }
  if (payload instanceof Map
      && payload[TAG_HEADER_SYMBOL] === undefined) {
    const m = new Map(payload);
    stampTagHeader(m, tag);
    return m;
  }
  // Scalar / Keyword / TagKeyword / Doc / Error / Conduit /
  // Snapshot / already-tagged composite — wrap in an
  // opaque frozen JS object with `tag` and `payload` fields.
  // The opaque shape keeps `/payload` projection out of reach
  // (the wrapper is not a Map, so projectSegment throws
  // `ProjectionSubjectNotProjectableError` on any `/key`);
  // `payload` operand is the dedicated extractor that returns
  // the wrapped value. TAG_HEADER_SYMBOL is stamped so the
  // uniform identity-read path (typeKeyword / isTaggedInstance)
  // works through the same channel composite shapes use.
  const wrap = brandValueClass({ tag, payload }, 'taggedInstance');
  stampTagHeader(wrap, tag);
  return Object.freeze(wrap);
}

// ── rename factory ────────────────────────────────────────────

export function withName(binding, newName) {
  if (isConduit(binding)) {
    // Pass the original body through — makeConduit re-stamps
    // source from body.text under the new name.
    return makeConduit(conduitBodyAst(binding), {
      name: newName,
      params: [...binding.get('params')],
      envRef: conduitEnvRef(binding),
      docs: [...binding.get('docs')],
      location: declarationSiteOf(binding)
    });
  }
  if (isSnapshot(binding)) {
    return makeSnapshot(binding.get('payload'), {
      name: newName,
      docs: [...binding.get('docs')],
      location: declarationSiteOf(binding)
    });
  }
  return binding;
}

// ── error value factory ───────────────────────────────────────
//
// Identity rides on the `tag` JS-header field (a TagKeyword) —
// every error value carries one, defaulting to `::Error` for
// user-created `!{}` literals that omit `:kind`. The descriptor
// Map is pure data: `:faultStep`, `:faultInput`, `:actualType`,
// dynamic per-site fields, and `:trail`. `:kind` never appears in
// the descriptor — the universal identity slot lives on the
// header so dataflow against the descriptor stays composable
// (`result !| / spec | union | error` round-trips without losing
// identity), and the `type` operand reads `error.tag` directly
// without descriptor projection.
//
// `:trail` carries either a Quote-value holding the deflected
// pipeline suffix — steps the user can splice back into a query — or
// `null` when no success-track combinator has deflected after the
// fault. Linked-list nodes hold `{combinator, node}` fragment
// records; `eval-trail.mjs::materializeTrail` turns them into the
// quote on demand inside applyFailTrack.

// `:trail` is runtime-owned: a Quote-value carrying the deflected
// pipeline suffix, or `null` before any deflection. A literal
// (`!{:trail [1 2]}`) or a re-lift (`!| union {:trail []} | error`)
// that stamps any other value under `:trail` fires this error at mint
// time, so `combineTrailQuotes` only ever joins quotes and the
// fail-track never carries a suffix that `apply` cannot replay.
// Dropping an accumulated suffix before re-lift stamps `:trail null`.
export const ErrorTrailNotQuoteError = declareShapeError(
  'ErrorTrailNotQuoteError',
  ({ actualType }) => `error descriptor :trail must be a Quote-value or null, got ${actualType.name}`,
  { expectedType: ['quote', 'null'] }
);

export function makeErrorValue(tag, descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (descriptor.has('trail')) {
    const trail = descriptor.get('trail');
    if (trail !== null && !isQuote(trail)) throw new ErrorTrailNotQuoteError({ actualType: typeKeyword(trail), actualValue: trail });
  } else {
    finalDescriptor = new Map(descriptor);
    finalDescriptor.set('trail', null);
  }
  return Object.freeze(brandValueClass({
    tag,
    descriptor: finalDescriptor,
    location,
    originalError,
    _trailHead: null
  }, 'error'));
}

// Host-facing convenience: build an ErrorValue from a descriptor
// Map that carries the per-site identity under its `:kind` slot.
// Hosts (jdt, future bridges) build descriptors keyword-by-keyword
// and naturally place the per-site `::TagKeyword` under `:kind`;
// this helper extracts it so callers do not repeat the same
// boilerplate at every throw site.
export function errorFromKindDescriptor(descriptor, opts = {}) {
  return makeErrorValue(descriptor.get('kind'), descriptor, opts);
}

export function appendTrailNode(errorValue, trailEntry) {
  return Object.freeze(brandValueClass({
    tag: errorValue.tag,
    descriptor: errorValue.descriptor,
    location: errorValue.location,
    originalError: errorValue.originalError,
    _trailHead: Object.freeze({
      entry: trailEntry,
      prev: errorValue._trailHead
    })
  }, 'error'));
}

// ── describeType ──────────────────────────────────────────────

export function describeType(v) {
  if (isNull(v)) return 'Null';
  if (isBoolean(v)) return 'Boolean';
  if (isNumber(v)) return 'Number';
  if (isString(v)) return 'String';
  if (isKeyword(v)) return 'Keyword';
  if (isTagKeyword(v)) return 'TagKeyword';
  // TaggedInstance reads the JS-header tag slot first; the
  // reserved-tag check rules out conduit / snapshot which live
  // on the same header but ride dedicated render paths
  // (`Conduit` / `Snapshot` handlers below).
  if (isConduit(v)) return 'Conduit';
  if (isSnapshot(v)) return 'Snapshot';
  if (isQuote(v)) return 'Quote';
  if (isTaggedInstance(v)) return 'TaggedInstance';
  if (isVec(v)) return 'Vec';
  if (isDoc(v)) return 'Doc';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'Function';
  return 'Unknown';
}

export function typeKeyword(v) {
  if (isNull(v)) return keyword('null');
  if (isBoolean(v)) return keyword('boolean');
  if (isNumber(v)) return keyword('number');
  if (isString(v)) return keyword('string');
  if (isKeyword(v)) return keyword('keyword');
  if (isTagKeyword(v)) return keyword('tagKeyword');
  // Identity-on-JS-header takes precedence on every composite:
  // tagged Vec, tagged Set, tagged Map — `result | type`
  // returns the user-stamped TagKeyword directly. Conduit /
  // Snapshot share the same slot under reserved tag names
  // (`::conduit` / `::snapshot`) and fall through this branch
  // too; their identity reads exactly the same way.
  if (v !== null && typeof v === 'object') {
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag !== undefined) return headerTag;
  }
  if (isVec(v)) return keyword('vec');
  if (isDoc(v)) return keyword('doc');
  if (isQMap(v)) return keyword('map');
  if (isQSet(v)) return keyword('set');
  // Error values carry their tag identity on the JS-header `tag`
  // slot — opaque to descriptor projection. `typeKeyword` reads
  // it directly so `result !| type` returns the per-site
  // `::Tag` without consulting any Map field.
  if (isErrorValue(v)) return v.tag;
  if (isFunctionValue(v)) return keyword('function');
  return keyword('unknown');
}
