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
      'printValue/toPlain: function value reached render — function values must not surface in pipeValue. Wrap host operands in a descriptor Map carrying :kind ::builtin and :impl when binding through session.bind.',
      {}
    );
    this.name = 'FunctionValueLeakedToPrintError';
    this.fingerprint = 'FunctionValueLeakedToPrintError';
  }
}

export const NULL = null;

// ── primitive type predicates ──────────────────────────────────

export function isNull(v) { return v === null || v === undefined; }
export function isBoolean(v) { return typeof v === 'boolean'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isString(v) { return typeof v === 'string'; }
export function isKeyword(v) {
  return v !== null && typeof v === 'object' && v.type === 'keyword';
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
  return v !== null && typeof v === 'object' && v.type === 'function';
}

export function isErrorValue(v) {
  return v !== null && typeof v === 'object' && v.type === 'error';
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
  return Object.freeze({ type: 'keyword', name, literal: canonicalKeywordLiteral(name) });
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
  return Object.freeze({ type: 'tagKeyword', name: tag, literal: TAG_BINDING_PREFIX + tag });
}

export function isTagKeyword(v) {
  return v !== null && typeof v === 'object' && v.type === 'tagKeyword';
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

// A tagged-instance Map carries `:kind <TagKeyword>` plus a
// `:payload` slot holding whatever the constructor literal
// captured — a Vec (`::Tag[1 2 3]`), a Map (`::Tag{:k 1}`), a
// scalar wrapped via ParenGroup (`::Tag(42)`), a Quote, a Set,
// any pipeline value. Conduit / snapshot identity rides on the
// Map JS-header `TAG_HEADER_SYMBOL` slot, so they trip
// `isConduit` / `isSnapshot` upstream and never reach this
// predicate. Catalog tag-binding declarations carry their
// payload on `:impl` rather than `:payload`, so the
// `v.has('payload')` requirement already keeps them outside the
// generic tagged-instance render path.
export function isTaggedInstance(v) {
  if (!(v instanceof Map)) return false;
  if (isConduit(v) || isSnapshot(v)) return false;
  return v[TAG_HEADER_SYMBOL] !== undefined;
}

export function isQuote(v) {
  return v !== null && typeof v === 'object' && v.type === 'quote';
}

// Quote — frozen JS object carrying `.source` (the verbatim text
// between `~{` and `}`) and an optional `.ast` (lazily populated when
// the Quote is run through `eval` or projected via `/ast`). Lives
// on the JS layer with its discriminator on the JS object shape
// (`v.type === 'quote'`); a Map-key discriminator would expose
// runtime housekeeping at every projection of a Quote-valued
// pipeValue. The lazy `.ast` lets a Quote
// hold a pipeline-suffix fragment beginning with a combinator
// (`~{* inc | sort}`) — eager parse would reject the fragment in
// startRule=Query mode because the top-level rule expects a value
// expression; Pipeline accepts a leading combinator only inside the
// `~{…}` body context, which `apply(subject)` re-enters.
export function makeQuote(source, ast = null) {
  return Object.freeze({ type: 'quote', source, ast });
}

// Doc — frozen JS object carrying `.content` (the verbatim text
// between `|~~ ... ~~|` markers, or after `|~~|` up to newline).
// Same JS-layer discriminator pattern as Quote — `.type === 'doc'`
// keeps `:kind` housekeeping out of the user-visible Map
// surface. Doc value lands in pipeValue through DocLit literal in
// any Primary position; the attached-prefix path
// (DocAttachedSequence) is unrelated — there docs travel as
// `.docs` strings on the following operand-call AST node.
export function isDoc(v) {
  return v !== null && typeof v === 'object' && v.type === 'doc';
}

export function makeDoc(content) {
  return Object.freeze({ type: 'doc', content });
}

// ── tag-header symbol — Map identity slot ────────────────────
//
// Non-enumerable Symbol key under which a Map carries its
// identity TagKeyword. Mirrors `JSON_OBJECT_TAG` /
// `JSON_ARRAY_TAG` for plain JS Objects / Arrays: invisible to
// Map iteration (`for (const [k, v] of m)`), to `m.get('kind')`,
// to JSON serialization, and to the manifest enumeration
// surface — runtime predicates (`isConduit`, `isSnapshot`,
// `typeKeyword` Map branch) read the discriminator off the
// header in one property access without touching the data
// surface. Phase 3 will route `TaggedInstance` through the same
// slot; the catalog's `::builtin` descriptors stay on
// `:kind ::builtin` field shape until Phase 4 because their
// data plane already publishes `:kind` as part of the user-
// facing surface.

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
  m.set('params', Object.freeze([...params]));
  m.set('body', body);
  m.set('source', body.text);
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
// Single mint site for user-defined `::Tag<payload>` constructor
// invocations through the default branch of `evalTaggedLit`.
// Always-wrap strategy: the payload rides as-is under the
// `:payload` field — Map payloads no longer flat-merge into the
// instance (the Phase-2-pre bug that silently dropped a nested
// `::Inner[::Outer[X]]` identity by overwriting `:kind` on the
// outer instance's descriptor), Vec / Set / Quote / scalar
// payloads land under the same slot. Identity rides on the Map
// JS-header `TAG_HEADER_SYMBOL` slot.

export function makeTaggedInstance(tag, payload) {
  const m = new Map();
  m.set('payload', payload);
  stampTagHeader(m, tag);
  return m;
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
  return Object.freeze({
    type: 'error',
    tag,
    descriptor: finalDescriptor,
    location,
    originalError,
    _trailHead: null
  });
}

export function appendTrailNode(errorValue, trailEntry) {
  return Object.freeze({
    type: 'error',
    tag: errorValue.tag,
    descriptor: errorValue.descriptor,
    location: errorValue.location,
    originalError: errorValue.originalError,
    _trailHead: Object.freeze({
      entry: trailEntry,
      prev: errorValue._trailHead
    })
  });
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
  if (isJsonArray(v)) return 'JsonArray';
  if (isVec(v)) return 'Vec';
  if (isConduit(v)) return 'Conduit';
  if (isSnapshot(v)) return 'Snapshot';
  if (isQuote(v)) return 'Quote';
  if (isDoc(v)) return 'Doc';
  if (isTaggedInstance(v)) return 'TaggedInstance';
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
  if (isJsonArray(v)) return keyword('jsonArray');
  if (isVec(v)) return keyword('vec');
  if (isConduit(v)) return CONDUIT_TAG;
  if (isSnapshot(v)) return SNAPSHOT_TAG;
  if (isQuote(v)) return keyword('quote');
  if (isDoc(v)) return keyword('doc');
  if (isQMap(v)) {
    // Identity-on-JS-header takes precedence — TaggedInstance
    // stamps its user-defined TagKeyword on TAG_HEADER_SYMBOL
    // at construction (Conduit / Snapshot already exited above).
    // Maps without the header fall back to the legacy `:kind`
    // field — covers the catalog `::builtin{…}` descriptors
    // (Phase 4 still pending), the materialized error descriptor
    // exposed under `!|`, and user-built `{:kind ::Foo …}` Maps
    // that ride the tagged-instance render path through `:kind`
    // discriminator until Phase 4 unifies them under the header.
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag) return headerTag;
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
