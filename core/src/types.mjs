import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { classifyEffect } from './effect.mjs';
import {
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { TAG_BINDING_PREFIX, canonicalTagName } from './env-keys.mjs';
import { quoteOfBody } from './quote.mjs';
import { compareValues } from './ordering.mjs';

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
    'session.bind carries no qlang literal.',
  { operand: '::qlang' }
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
    'impls map, where source cannot mint one',
  { operand: '::qlang' }
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
// The set is the vector in the one order without duplicates, under
// the `::set` tag [D16], so every operand that reads a vector reads a
// set: `isVec` holds for it, and this predicate tells it apart.
export function isQSet(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === SET_TAG_NAME;
}

// ── language value-class predicates ────────────────────────────

export function isFunctionValue(v) {
  return isValueClass(v, 'function');
}

export function isErrorValue(v) {
  return isValueClass(v, 'error');
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
// (`::conduit`, `::binding`, user-defined ::tag instances)
// uniformly.

export function makeTagKeyword(tag) {
  const name = canonicalTagName(tag);
  return Object.freeze(brandValueClass({ name, literal: TAG_BINDING_PREFIX + name }, 'tagKeyword'));
}

export function isTagKeyword(v) {
  return isValueClass(v, 'tagKeyword');
}

// Env-key namespaces live in `./env-keys.mjs`. The TagKeyword
// factory above stamps `TAG_BINDING_PREFIX + tag` onto every
// `::tag` literal, which is the only place value-class code needs
// the prefix; every other env-keys-aware consumer imports from
// `env-keys.mjs` directly.

// ── conduit / binding / quote predicates ──────────────────────
//
// Conduit identity rides on the Map's non-enumerable JS-header `tag`
// slot (a TagKeyword), stamped at construction below. The `:kind`
// Map field is reserved for the value's own data; user-built Maps
// that happen to carry `:kind ::Foo` flow through `isTaggedInstance`
// rather than colliding with the conduit render path.

export function isConduit(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === 'conduit';
}

// The record a declaration writes into its scope [D63]: the name, the
// docs of its doc-prefixes, the value, the quote of the declaring step
// and the module it came from, under the kind `::binding`. A binding
// with no declaration behind it, a value `use` or a host bound, holds
// no source.
export function isBinding(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === BINDING_TAG_NAME;
}

export function makeBinding({ name, docs = [], value, source = null, module = null }) {
  const record = new Map();
  record.set('name', name);
  record.set('docs', Object.freeze(docs.map(content => makeDoc(content))));
  record.set('value', value);
  record.set('source', source);
  record.set('module', module);
  stampTagHeader(record, BINDING_TAG);
  return record;
}

// What a name of the scope holds: the value of its record; a
// conduit's parameter, bound for the time of a call, and a key of
// the runtime's own as they lie.
export function bindingValueOf(entry) {
  return isBinding(entry) ? entry.get('value') : entry;
}

// TaggedInstance — value carrying a TagKeyword on its JS-header
// `TAG_HEADER_SYMBOL` slot. `makeTaggedInstance` mints two value
// shapes: Array / Map clones with the header stamped, or
// an opaque frozen `{type, tag, payload}` wrapper for non-
// extensible payloads (scalar, Keyword, Doc, Error, already-tagged
// composite, a quote and a set among them). A value under one of the
// two reserved tag names, `::conduit` or `::builtin`, is no tagged
// instance: `isConduit` and `isBuiltinDescriptor` answer for it, a
// conduit prints by its own path, and a descriptor prints as its bare
// map.
const RESERVED_HEADER_TAG_NAMES = new Set(['conduit', 'builtin']);
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

// Set — the vector in the one order without duplicates, under the
// `::set` tag [D16]. Its elements sort by `compareValues`, and an
// element the order ranks alike with the one before it leaves: the
// order ranks two values alike exactly when they are equal. Every set
// is minted here, `makeTaggedInstance` included.
export const SET_TAG_NAME = 'set';
export const BINDING_TAG_NAME = 'binding';

export function makeSet(elements) {
  const ordered = [...elements].sort(compareValues);
  const set = ordered.filter((element, index) => index === 0 || compareValues(ordered[index - 1], element) !== 0);
  stampTagHeader(set, SET_TAG);
  return Object.freeze(set);
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

// Doc — frozen object carrying `.content`, the text of a `|~~ … ~~|`
// or `|~~|` form with its line breaks read as one, whatever bytes the
// source wrote; a doc literal and the doc of a binding both mint it here.
export function isDoc(v) {
  return isValueClass(v, 'doc');
}

export function makeDoc(content) {
  return Object.freeze(brandValueClass({ content: content.replace(/\r\n?/g, '\n') }, 'doc'));
}

// ── tag-header symbol — Map identity slot ────────────────────
//
// Non-enumerable Symbol key under which a Map carries its
// identity TagKeyword: invisible to Map iteration (`for (const [k, v] of m)`), to `m.get('kind')`,
// to JSON serialization, and to the manifest enumeration
// surface. Every identity-bearing value-class — Conduit,
// binding record, TaggedInstance, catalog `::builtin` descriptor,
// materialized error — stamps the slot through `stampTagHeader`
// and reads it through `typeKeyword`'s header branch in one
// property access, leaving the data plane untouched.

export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  stampSlot(m, TAG_HEADER_SYMBOL, tag);
}

// ── JS-internal slots — the data plane stays qlang-only ───────
//
// Three structures ride a Map without a qlang literal behind them:
// a Conduit's body AST node, the lexical `envRef` holder its
// tie-the-knot mutates, and the resolved JS function value a catalog
// `::builtin` descriptor dispatches through. Each lands on a
// non-enumerable Symbol slot — the channel `TAG_HEADER_SYMBOL` uses
// too — so `keys`, `/key` projection, `printValue`, `toPlain`, and
// `toTaggedJSON` see a data plane of qlang values alone: `:name`,
// `:params`, `:source` (a Quote of the body), `:docs`, `:effectful`,
// plus the `:impl :qlang/prim/<name>` handle keyword the catalog
// author wrote.
//
// The accessors below are the only readers. A dispatch site that
// reaches for `descriptor.get('impl')` gets the author's handle
// keyword; `builtinImplOf` gets the callable.

export const CONDUIT_BODY_SLOT     = Symbol('qlang/conduitBody');
export const CONDUIT_ENV_REF_SLOT  = Symbol('qlang/conduitEnvRef');
export const BUILTIN_IMPL_SLOT     = Symbol('qlang/builtinImpl');

function stampSlot(target, slot, value) {
  Object.defineProperty(target, slot, {
    value, enumerable: false, configurable: false, writable: false
  });
}

// Body AST of a Conduit — `applyConduit` evaluates it, and
// `printConduit` reads the `:source` Quote the factory read off it.
export function conduitBodyAst(conduit) {
  return conduit[CONDUIT_BODY_SLOT];
}

// Lexical scope anchor of a Conduit. The holder object is shared
// with the construction site so the declaration-time env lands on
// `.env` after the binding itself is in place (tie-the-knot).
export function conduitEnvRef(conduit) {
  return conduit[CONDUIT_ENV_REF_SLOT];
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

export const BINDING_TAG     = makeTagKeyword(BINDING_TAG_NAME);
export const BUILTIN_TAG     = makeTagKeyword('builtin');
export const CONDUIT_TAG     = makeTagKeyword('conduit');
export const ERROR_TAG       = makeTagKeyword('error');
export const PARSE_ERROR_TAG = makeTagKeyword('ParseError');
export const QUOTE_TAG       = makeTagKeyword(QUOTE_TAG_NAME);
export const SET_TAG         = makeTagKeyword(SET_TAG_NAME);
export const TAG_BINDING_TAG = makeTagKeyword('tag');

// The kind of every value without a tag of its own, the one its
// literal implies [D32]; `type` answers it, and a tag name's kind is
// the tag `::tag` a tag binding's view carries.
export const CORE_KIND = Object.freeze({
  null:    makeTagKeyword('null'),
  boolean: makeTagKeyword('boolean'),
  number:  makeTagKeyword('number'),
  string:  makeTagKeyword('string'),
  keyword: makeTagKeyword('keyword'),
  tag:     TAG_BINDING_TAG,
  vec:     makeTagKeyword('vec'),
  map:     makeTagKeyword('map'),
  set:     SET_TAG,
  quote:   QUOTE_TAG,
  doc:     makeTagKeyword('doc')
});

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

export function makeConduit(body, { name, params = [], envRef = null, docs = [] } = {}) {
  const m = new Map();
  m.set('name', name);
  m.set('params', Object.freeze(params.map(paramName => keyword(paramName))));
  m.set('source', quoteOfBody(body));
  m.set('docs', Object.freeze([...docs]));
  m.set('effectful', classifyEffect(name));
  stampTagHeader(m, CONDUIT_TAG);
  stampSlot(m, CONDUIT_BODY_SLOT, body);
  stampSlot(m, CONDUIT_ENV_REF_SLOT, envRef);
  return m;
}

// ── tagged-instance factory ──────────────────────────────────
//
// Identity overlay on a payload value. The TagKeyword rides on
// the payload's JS-header `TAG_HEADER_SYMBOL` slot — Array and
// Map carry symbol-keyed non-enumerable properties natively,
// so the tag stays invisible to iteration, `m.get(…)`,
// `arr[idx]`, JSON serialization. Operands routed
// through `isVec` / `isQMap` predicates see the same
// shape they always see — `::Tag[1 2 3] | /1` indexes the
// underlying Array, `::Tag{:a 1} | keys` lists the underlying
// Map keys. `typeKeyword` reads the header first so identity comes
// through `result | type`. Reserved header tags
// (`::conduit`, `::builtin`) are matched against
// in `isTaggedInstance` so the dedicated render / dispatch
// paths for those value-classes stay disjoint from generic
// TaggedInstance.
//
// Payload shapes:
//
//   Untagged Vec / Map — clone and stamp header. The
//     clone keeps the payload's native shape so isVec /
//     isQMap and every shape-preserving operand work without
//     unwrap; under the code tag a vector mints as a quote, under
//     `::set` as a set. Flat-merging the Map payload's fields onto the
//     tagged Map (rather than nesting under `:payload`) makes
//     `tagged | keys` / `/field` / `vals` read identical to an
//     untagged Map literal. `:kind` fields stay as ordinary Map
//     data; identity rides on the JS-header alone, so a `:kind`
//     slot on user payload coexists with the instance's identity
//     without collision.
//
//   Scalar / Keyword / TagKeyword / Doc / Error / Conduit /
//     already-tagged composite, a quote, a set and a binding record
//     among them — wrap in a Map carrying the payload under `:payload` slot,
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
    if (tag.name === SET_TAG_NAME) return makeSet(payload);
    const arr = [...payload];
    stampTagHeader(arr, tag);
    return Object.freeze(arr);
  }
  if (payload instanceof Map
      && payload[TAG_HEADER_SYMBOL] === undefined) {
    const m = new Map(payload);
    stampTagHeader(m, tag);
    return m;
  }
  // Scalar / Keyword / TagKeyword / Doc / Error / Conduit /
  // already-tagged composite — wrap in an
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

// ── error value factory ───────────────────────────────────────
//
// Identity rides on the `tag` JS-header field (a TagKeyword) —
// every error value carries one, the kind of errors `::error` for
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
  { operand: '::error', expectedType: ['quote', 'null'] }
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
  // reserved-tag check rules out the conduit, which lives on the
  // same header but rides a dedicated render path (the `Conduit`
  // handler).
  if (isConduit(v)) return 'Conduit';
  if (isQuote(v)) return 'Quote';
  if (isQSet(v)) return 'Set';
  if (isTaggedInstance(v)) return 'TaggedInstance';
  if (isVec(v)) return 'Vec';
  if (isDoc(v)) return 'Doc';
  if (isQMap(v)) return 'Map';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'Function';
  return 'Unknown';
}

// typeKeyword(v) — the kind of a value [D32]: its outermost tag, or
// the kind of the core its literal implies.
export function typeKeyword(v) {
  if (isNull(v)) return CORE_KIND.null;
  if (isBoolean(v)) return CORE_KIND.boolean;
  if (isNumber(v)) return CORE_KIND.number;
  if (isString(v)) return CORE_KIND.string;
  if (isKeyword(v)) return CORE_KIND.keyword;
  if (isTagKeyword(v)) return CORE_KIND.tag;
  // Identity-on-JS-header takes precedence on every composite:
  // tagged Vec, tagged Map, the set, the quote and the binding
  // record — `result | type` returns the TagKeyword directly. The
  // conduit shares the same slot under its reserved tag name
  // (`::conduit`) and falls through this branch too; its identity
  // reads exactly the same way.
  if (v !== null && typeof v === 'object') {
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag !== undefined) return headerTag;
  }
  if (isVec(v)) return CORE_KIND.vec;
  if (isDoc(v)) return CORE_KIND.doc;
  if (isQMap(v)) return CORE_KIND.map;
  // Error values carry their tag identity on the JS-header `tag`
  // slot — opaque to descriptor projection. `typeKeyword` reads
  // it directly so `result !| type` returns the per-site
  // `::Tag` without consulting any Map field.
  if (isErrorValue(v)) return v.tag;
  if (isFunctionValue(v)) return FUNCTION_KIND;
  return UNKNOWN_KIND;
}

// What the runtime finds where no value of the language stands: a
// function value in flight, and a host's raw object.
const FUNCTION_KIND = makeTagKeyword('function');
const UNKNOWN_KIND  = makeTagKeyword('unknown');
