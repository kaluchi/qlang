import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { classifyEffect } from './effect.mjs';
import { QlangInvariantError } from './errors.mjs';
import { TAG_BINDING_PREFIX } from './env-keys.mjs';

// Conduit body must carry a `.text` source slice — every production
// path (parser-built AST, ::conduit constructor parsing a Quote,
// deserializeSession parsing stored source) hands an AST node with
// `.text` populated. The slice underwrites printValue's round-trip
// invariant: `parse(printValue(conduit))` must yield an equivalent
// conduit, which means the printed form needs literal source.
// Mint refuses a `.text`-less body up front so the violation
// surfaces at construction, where the offending caller is on the
// stack.
export class ConduitBodyMissingSourceError extends QlangInvariantError {
  constructor() {
    super(
      'makeConduit: body has no .text — conduit body must carry a source slice so printValue round-trips through parse',
      {}
    );
    this.name = 'ConduitBodyMissingSourceError';
    this.fingerprint = 'ConduitBodyMissingSourceError';
  }
}

// Function values (`makeFn` output) are runtime-internal: they live on
// `:impl` of builtin descriptor Maps and as conduitParameter proxies
// reachable through the manifest descriptor's `:category :conduitParameter`
// field when a conduit body's env enumerates. They
// have no grammatical literal — the only candidate render form
// (`:qlang/prim/${name}`) parses back as a keyword value on the next
// `eval`. Surfacing a function value in pipeValue therefore violates
// printValue's round-trip theorem. The invariant fires at render-time
// so the leak surface (typically a descriptor Map walked by `env |
// /count`, or a host binding mounted through `session.bind` carrying
// a raw function) surfaces by name and routes through the descriptor-
// Map ceremony.
export class FunctionValueLeakedToPrintError extends QlangInvariantError {
  constructor() {
    super(
      'printValue/toPlain: function value reached render — function values must not surface in pipeValue. Wrap host operands in a descriptor Map carrying :impl with identity stamped on the JS-header (stampTagHeader(map, BUILTIN_TAG)) before binding through session.bind — see bindHostBuiltin in cli/src/host-builtin.mjs.',
      {}
    );
    this.name = 'FunctionValueLeakedToPrintError';
    this.fingerprint = 'FunctionValueLeakedToPrintError';
  }
}

export const NULL = null;

// ── value-class brand ──────────────────────────────────────────
//
// Keyword / TagKeyword / Quote / Doc / Error / Function / the opaque
// TaggedInstance wrap are JS plain objects sharing JsonObject's
// shape, where `"type"` is ordinary JSON data. Identity rides on a
// non-enumerable Symbol — the channel JSON_OBJECT_TAG / JSON_ARRAY_TAG
// / TAG_HEADER_SYMBOL already use — so a JSON document carrying
// `{"type":"quote"}` cannot forge `isQuote`.
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
  return Array.isArray(v) && v[JSON_ARRAY_TAG] !== true;
}
export function isQMap(v) {
  return v instanceof Map;
}
export function isQSet(v) { return v instanceof Set; }

// JSON Object / JSON Array — runtime-type-distinct from qlang Map /
// Vec. Built via makeJsonObject / makeJsonArray, stamped with a
// non-enumerable Symbol so JSON.stringify and Object.keys see them
// as ordinary plain objects / arrays (the JSON-bridge invariant —
// they are JSON). qlang-side identification through the predicates
// below.

export const JSON_OBJECT_TAG = Symbol('qlang/jsonObject');
export const JSON_ARRAY_TAG  = Symbol('qlang/jsonArray');

export function isJsonObject(v) {
  return v !== null
    && typeof v === 'object'
    && !Array.isArray(v)
    && !(v instanceof Map)
    && !(v instanceof Set)
    && v[JSON_OBJECT_TAG] === true;
}

export function isJsonArray(v) {
  return Array.isArray(v) && v[JSON_ARRAY_TAG] === true;
}

// Shape-level predicates — for container-shape-preserving operands
// (filter, sort, take, distinct, union, …). A JsonArray subject
// passes through the same operand path as a Vec subject and the
// result re-wraps as JsonArray; same symmetry for JsonObject↔Map.
// JS-side iteration / .length / spread work uniformly across both
// halves of the shape, so operand bodies stay shape-agnostic.

export function isVecShape(v) {
  return isVec(v) || isJsonArray(v);
}

export function isMapShape(v) {
  return isQMap(v) || isJsonObject(v);
}

// Iterate a Map-shape subject as [key, value] pairs.
export function mapShapeEntries(v) {
  if (isJsonObject(v)) return Object.entries(v);
  return v;
}

export function mapShapeSize(v) {
  if (isJsonObject(v)) return Object.keys(v).length;
  return v.size;
}

export function mapShapeGet(v, k) {
  return isJsonObject(v) ? v[k] : v.get(k);
}

export function mapShapeHas(v, k) {
  if (isJsonObject(v)) return Object.prototype.hasOwnProperty.call(v, k);
  return v.has(k);
}

// Re-wrap operand output to match the source's tag.
export function vecLikeOf(items, source) {
  return isJsonArray(source) ? makeJsonArray(items) : items;
}

// Per-element transformers (`*`, `>>`) preserve a JsonArray subject's
// tag only when every produced element is itself JSON-storeable —
// scalar Null/Boolean/Number/String or a JSON-shape Object/Array.
// A qlang-only element (Keyword, Map, Set, Vec, Conduit, …) silently
// degrades the container to a qlang Vec, so a downstream `| json`
// catches the type mismatch loudly and surfaces the un-serialisable
// element at the conversion site.
export function isJsonStoreable(v) {
  return v === null
    || typeof v === 'boolean'
    || typeof v === 'number'
    || typeof v === 'string'
    || isJsonObject(v)
    || isJsonArray(v);
}

export function mapLikeOf(entries, source) {
  if (isJsonObject(source)) {
    const obj = {};
    for (const [k, v] of entries) obj[k] = v;
    return makeJsonObject(obj);
  }
  return new Map(entries);
}

export function makeJsonObject(plainObj) {
  const obj = { ...plainObj };
  Object.defineProperty(obj, JSON_OBJECT_TAG, {
    value: true, enumerable: false, configurable: false, writable: false
  });
  return Object.freeze(obj);
}

export function makeJsonArray(items) {
  const arr = [...items];
  Object.defineProperty(arr, JSON_ARRAY_TAG, {
    value: true, enumerable: false, configurable: false, writable: false
  });
  return Object.freeze(arr);
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
// extensible payloads (scalar, Keyword, Quote, Doc, Error,
// already-tagged composite). Three reserved tag names own
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
  return isValueClass(v, 'quote');
}

// Quote — frozen JS object carrying `.source` (the verbatim text
// between `~{` and `}`) and an optional `.ast` (lazily populated when
// the Quote is run through `eval` or projected via `/ast`). Lives
// on the JS layer with its discriminator on the JS object shape
// (`v.type === 'quote'`); a Map-key discriminator would expose
// runtime housekeeping at every projection of a Quote-valued
// pipeValue (the discriminator rides the VALUE_CLASS_TAG Symbol so a
// JSON document carrying `{"type":"quote"}` never reads as a Quote).
// The lazy `.ast` lets a Quote
// hold a pipeline-suffix fragment beginning with a combinator
// (`~{* inc | sort}`) — eager parse would reject the fragment in
// startRule=Query mode because the top-level rule expects a value
// expression; Pipeline accepts a leading combinator only inside the
// `~{…}` body context, which `apply(subject)` re-enters.
export function makeQuote(source, ast = null) {
  return Object.freeze(brandValueClass({ source, ast }, 'quote'));
}

// Doc — frozen JS object carrying `.content` (the verbatim text
// between `|~~ ... ~~|` markers, or after `|~~|` up to newline).
// Same JS-layer discriminator pattern as Quote — the VALUE_CLASS_TAG
// Symbol brand keeps `:kind` housekeeping out of the user-visible
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
// identity TagKeyword. Mirrors `JSON_OBJECT_TAG` /
// `JSON_ARRAY_TAG` for plain JS Objects / Arrays: invisible to
// Map iteration (`for (const [k, v] of m)`), to `m.get('kind')`,
// to JSON serialization, and to the manifest enumeration
// surface. Every identity-bearing value-class — Conduit,
// Snapshot, TaggedInstance, catalog `::builtin` descriptor,
// materialized error — stamps the slot through `stampTagHeader`
// and reads it through `typeKeyword`'s header branch in one
// property access, leaving the data plane untouched.

export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  Object.defineProperty(m, TAG_HEADER_SYMBOL, {
    value: tag, enumerable: false, configurable: false, writable: false
  });
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
export const SNAPSHOT_TAG    = makeTagKeyword('snapshot');
export const TAG_BINDING_TAG = makeTagKeyword('tag');
export const VALUE_TAG       = makeTagKeyword('value');

// ── conduit factory ───────────────────────────────────────────

export function makeConduit(body, { name, params = [], envRef = null, docs = [], location = null } = {}) {
  if (body == null || typeof body.text !== 'string') {
    throw new ConduitBodyMissingSourceError();
  }
  const m = new Map();
  m.set('name', name);
  m.set('params', Object.freeze(params.map(p => typeof p === 'string' ? keyword(p) : p)));
  m.set('body', body);
  m.set('source', makeQuote(body.text, body));
  m.set('envRef', envRef);
  m.set('docs', Object.freeze([...docs]));
  m.set('location', location);
  m.set('effectful', classifyEffect(name));
  stampTagHeader(m, CONDUIT_TAG);
  return m;
}

// ── snapshot factory ──────────────────────────────────────────

export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  const m = new Map();
  m.set('name', name);
  m.set('payload', value);
  m.set('docs', Object.freeze([...docs]));
  m.set('location', location);
  m.set('effectful', classifyEffect(name));
  stampTagHeader(m, SNAPSHOT_TAG);
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
// Map keys, `::Tag#[:a :b] | union(#[:c])` merges the underlying
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
//   Scalar / Keyword / TagKeyword / Quote / Doc / Error /
//     Conduit / Snapshot / already-tagged composite — wrap in a
//     Map carrying the payload under `:payload` slot, stamp the
//     header on the wrapper. JS scalars cannot carry symbol-
//     keyed properties (they are immutable primitives); frozen
//     value-class objects (Quote / Doc / Error) refuse
//     `defineProperty` after freeze; nested tagged composites
//     already own the header slot and re-stamping would
//     overwrite the inner identity. The wrap branch covers all
//     three concerns uniformly. `tagged | payload` recovers
//     the wrapped value through the operand's dedicated branch.

export function makeTaggedInstance(tag, payload) {
  // Untagged composite — overlay header on a clone of the
  // payload, native shape preserved. For JsonArray payloads the
  // JSON_ARRAY_TAG sentinel is restamped manually on the clone
  // before freezing (calling `makeJsonArray` then `stampTagHeader`
  // is a no-go — `makeJsonArray` freezes its result, so the header
  // stamp would hit a non-extensible object). Both Symbol slots
  // coexist on the same Array; downstream predicates read each
  // independently.
  if (Array.isArray(payload) && payload[TAG_HEADER_SYMBOL] === undefined) {
    const arr = [...payload];
    if (isJsonArray(payload)) {
      Object.defineProperty(arr, JSON_ARRAY_TAG, {
        value: true, enumerable: false, configurable: false, writable: false
      });
    }
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
  // Scalar / Keyword / TagKeyword / Quote / Doc / Error /
  // Conduit / Snapshot / already-tagged composite — wrap in an
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
    return makeConduit(binding.get('body'), {
      name: newName,
      params: [...binding.get('params')],
      envRef: binding.get('envRef'),
      docs: [...binding.get('docs')],
      location: binding.get('location')
    });
  }
  if (isSnapshot(binding)) {
    return makeSnapshot(binding.get('payload'), {
      name: newName,
      docs: [...binding.get('docs')],
      location: binding.get('location')
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
// `:trail` carries either a Quote-value holding the joined
// pipeline-suffix source — copy-pasteable code the user can splice
// back into a query — or `null` when no success-track combinator
// has deflected after the fault. Linked-list nodes hold
// `{combinator, text}` fragment records; materializeTrail joins
// them via COMBINATOR_SYNTAX into the Quote source on demand
// inside applyFailTrack.

export const COMBINATOR_SYNTAX = Object.freeze({
  pipe:       '|',
  distribute: '*',
  merge:      '>>'
});

export function makeErrorValue(tag, descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (!descriptor.has('trail')) {
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

export function materializeTrail(errorValue) {
  if (errorValue._trailHead === null) return null;
  const fragments = [];
  let cur = errorValue._trailHead;
  while (cur) { fragments.push(cur.entry); cur = cur.prev; }
  fragments.reverse();
  const source = fragments
    .map(f => `${COMBINATOR_SYNTAX[f.combinator]} ${f.text}`)
    .join(' ');
  return makeQuote(source);
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
  if (isTaggedInstance(v)) return 'TaggedInstance';
  if (isJsonArray(v)) return 'JsonArray';
  if (isVec(v)) return 'Vec';
  if (isQuote(v)) return 'Quote';
  if (isDoc(v)) return 'Doc';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'Function';
  if (isJsonObject(v)) return 'JsonObject';
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
  if (isJsonArray(v)) return keyword('jsonArray');
  if (isVec(v)) return keyword('vec');
  if (isQuote(v)) return keyword('quote');
  if (isDoc(v)) return keyword('doc');
  if (isQMap(v)) {
    // `:kind` field fallback — covers manifest view-Maps
    // (`:kind ::builtin` enum bucket) and user-built `{:kind
    // ::Foo …}` Maps that ride the descriptor surface without
    // stamping the header.
    const mapKind = v.get('kind');
    if (isTagKeyword(mapKind)) return mapKind;
    return keyword('map');
  }
  if (isQSet(v)) return keyword('set');
  // Error values carry their tag identity on the JS-header `tag`
  // slot — opaque to descriptor projection. `typeKeyword` reads
  // it directly so `result !| type` returns the per-site
  // `::Tag` without consulting any Map field.
  if (isErrorValue(v)) return v.tag;
  if (isFunctionValue(v)) return keyword('function');
  if (isJsonObject(v)) return keyword('jsonObject');
  return keyword('unknown');
}
