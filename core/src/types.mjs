import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { classifyEffect } from './effect.mjs';
import { QlangInvariantError } from './errors.mjs';

// Conduit body must carry a `.text` source slice — every production
// path (parser-built AST, ::conduit constructor parsing a Quote,
// deserializeSession parsing stored source) hands an AST node with
// `.text` populated. The slice underwrites printValue's round-trip
// invariant: `parse(printValue(conduit))` must yield an equivalent
// conduit, which means the printed form needs literal source. A
// body without `.text` would force render to emit a non-parseable
// placeholder, breaking the round-trip theorem; mint refuses up
// front so the violation surfaces at construction, not at print.
export class ConduitBodyMissingSource extends QlangInvariantError {
  constructor() {
    super(
      'makeConduit: body has no .text — conduit body must carry a source slice so printValue round-trips through parse',
      {}
    );
    this.name = 'ConduitBodyMissingSource';
    this.fingerprint = 'ConduitBodyMissingSource';
  }
}

// Function values (`makeFn` output) are runtime-internal: they live on
// `:qlang/impl` of builtin descriptor Maps and as conduit-parameter
// proxies behind reify's :category :conduit-parameter projection. They
// have no grammatical literal — the only candidate render form
// (`:qlang/prim/${name}`) parses as a keyword and eval'ing it yields a
// keyword value, not the original function. Surfacing a function value
// in pipeValue therefore violates printValue's round-trip theorem. The
// invariant fires at render-time so the leak surface (typically a
// descriptor Map walked by `env | /count`, or a host binding mounted
// through `session.bind` with a raw function instead of a descriptor)
// gets named and migrated to the descriptor-Map ceremony.
export class FunctionValueLeakedToPrint extends QlangInvariantError {
  constructor() {
    super(
      'printValue/toPlain: function value reached render — function values must not surface in pipeValue. Wrap host operands in a descriptor Map carrying :qlang/kind :builtin and :qlang/impl, instead of binding the raw function via session.bind.',
      {}
    );
    this.name = 'FunctionValueLeakedToPrint';
    this.fingerprint = 'FunctionValueLeakedToPrint';
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

export const JSON_OBJECT_TAG = Symbol('qlang/json-object');
export const JSON_ARRAY_TAG  = Symbol('qlang/json-array');

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
// catches the type mismatch loudly instead of silently emitting a
// JSON Array of un-serialisable values.
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

// TagKeyword — `::tag` reference value. Distinct from a plain
// `:tag` keyword: tagged-instance Maps stamp `:qlang/kind` with a
// TagKeyword so the discriminator carries "this is an instance
// of ::tag" rather than the looser "kind is the symbol :tag".
// `.name` mirrors the keyword shape so existing
// `kind.name === 'assertion'` checks read both Keyword and
// TagKeyword uniformly.

export function makeTagKeyword(tag) {
  return Object.freeze({ type: 'tagKeyword', name: tag, literal: '::' + tag });
}

export function isTagKeyword(v) {
  return v !== null && typeof v === 'object' && v.type === 'tagKeyword';
}

// ── env-key namespaces ────────────────────────────────────────
//
// Two reserved prefixes carve out housekeeping namespaces inside the
// env Map so identifier resolution and reflective listings can route
// past them in a single substring-free predicate. Both predicates
// live here as the single source of truth for the prefix character
// sequence — every consumer (`bindingNameOf` for axis-operands,
// `manifest` filtering, `langRuntime` module-AST stamping, LSP
// completion list, axis-walker) imports the constants instead of
// re-typing the literal.
//
// `TYPE_BINDING_PREFIX` — `::Tag` identifiers carrying a type-binding
// declaration (`::conduit`, `::AddLeftNotNumber`). Lookup distinguishes
// type-namespace identifiers from value-namespace `:foo` keys without
// scanning the binding shape.
//
// `MODULE_AST_PREFIX` — `qlang/ast/<uri>` env keys carry a Quote-value
// holding the module's source plus the parsed AST. Axis-operands walk
// every Quote under this prefix to find a binding's originating
// `BindStep`. The prefix is filtered from `manifest` output and from
// LSP completion candidates because module-AST entries are storage,
// not user-facing bindings.

export const TYPE_BINDING_PREFIX = '::';
export const MODULE_AST_PREFIX = 'qlang/ast/';

export function isTypeBindingName(name) {
  return typeof name === 'string' && name.startsWith(TYPE_BINDING_PREFIX);
}

export function isModuleAstKey(name) {
  return typeof name === 'string' && name.startsWith(MODULE_AST_PREFIX);
}

export function moduleAstKey(uri) {
  return MODULE_AST_PREFIX + uri;
}

// ── conduit / snapshot / quote predicates ─────────────────────

export function isConduit(v) {
  if (!(v instanceof Map)) return false;
  const kind = v.get('qlang/kind');
  return kind && kind.name === 'conduit';
}

export function isSnapshot(v) {
  if (!(v instanceof Map)) return false;
  const kind = v.get('qlang/kind');
  return kind && kind.name === 'snapshot';
}

// A tagged-instance Map carries `:qlang/kind <tag>` plus a
// `:qlang/payload` Vec of the original constructor arguments. Any
// `::tag` constructor that wants printValue / inline rendering
// to round-trip back to the literal form stamps both fields.
// The conduit/snapshot/type discriminators are excluded because
// they own dedicated render paths (def-form, as-form, type-binding)
// rather than the generic `::<tag>[<payload>]` shape.
const RESERVED_TAGGED_KINDS = new Set(['conduit', 'snapshot', 'type']);
export function isTaggedInstance(v) {
  if (!(v instanceof Map)) return false;
  const kind = v.get('qlang/kind');
  if (!kind || RESERVED_TAGGED_KINDS.has(kind.name)) return false;
  const payload = v.get('qlang/payload');
  return Array.isArray(payload);
}

export function isQuote(v) {
  return v !== null && typeof v === 'object' && v.type === 'quote';
}

// Quote — frozen JS object carrying `.source` (the verbatim text
// between `~{` and `}`) and an optional `.ast` (lazily populated when
// the Quote is run through `eval` or projected via `/ast`). Lives
// on the JS layer rather than as a Map with `:qlang/kind :quote`
// so the discriminator stays out of pipeValue projection — Quote
// lands in pipeValue directly through the `~{…}` literal, so
// keeping the discriminator in a Map-key would expose runtime
// housekeeping at the user surface. The lazy `.ast` lets a Quote
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
// keeps `:qlang/kind` housekeeping out of the user-visible Map
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

// ── conduit factory ───────────────────────────────────────────

export function makeConduit(body, { name, params = [], envRef = null, docs = [], location = null } = {}) {
  if (body == null || typeof body.text !== 'string') {
    throw new ConduitBodyMissingSource();
  }
  const m = new Map();
  m.set('qlang/kind', makeTagKeyword('conduit'));
  m.set('name', name);
  m.set('params', Object.freeze([...params]));
  m.set('qlang/body', body);
  m.set('qlang/source', body.text);
  m.set('qlang/envRef', envRef);
  m.set('docs', Object.freeze([...docs]));
  m.set('location', location);
  m.set('effectful', classifyEffect(name));
  return m;
}

// ── snapshot factory ──────────────────────────────────────────

export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  const m = new Map();
  m.set('qlang/kind', makeTagKeyword('snapshot'));
  m.set('name', name);
  m.set('qlang/value', value);
  m.set('docs', Object.freeze([...docs]));
  m.set('location', location);
  m.set('effectful', classifyEffect(name));
  return m;
}

// ── rename factory ────────────────────────────────────────────

export function withName(binding, newName) {
  if (isConduit(binding)) {
    // Pass the original body through — makeConduit re-stamps
    // qlang/source from body.text under the new name.
    return makeConduit(binding.get('qlang/body'), {
      name: newName,
      params: [...binding.get('params')],
      envRef: binding.get('qlang/envRef'),
      docs: [...binding.get('docs')],
      location: binding.get('location')
    });
  }
  if (isSnapshot(binding)) {
    return makeSnapshot(binding.get('qlang/value'), {
      name: newName,
      docs: [...binding.get('docs')],
      location: binding.get('location')
    });
  }
  return binding;
}

// ── error value factory ───────────────────────────────────────
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

export function makeErrorValue(descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (!descriptor.has('trail')) {
    finalDescriptor = new Map(descriptor);
    finalDescriptor.set('trail', null);
  }
  return Object.freeze({
    type: 'error',
    descriptor: finalDescriptor,
    location,
    originalError,
    _trailHead: null
  });
}

export function appendTrailNode(errorValue, trailEntry) {
  return Object.freeze({
    type: 'error',
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
  if (isTagKeyword(v)) return keyword('tag-keyword');
  if (isJsonArray(v)) return keyword('json-array');
  if (isVec(v)) return keyword('vec');
  if (isConduit(v)) return makeTagKeyword('conduit');
  if (isSnapshot(v)) return makeTagKeyword('snapshot');
  if (isQuote(v)) return keyword('quote');
  if (isDoc(v)) return keyword('doc');
  if (isTaggedInstance(v)) return makeTagKeyword(v.get('qlang/kind').name);
  if (isQMap(v)) return keyword('map');
  if (isQSet(v)) return keyword('set');
  if (isErrorValue(v)) return keyword('error');
  if (isFunctionValue(v)) return keyword('function');
  if (isJsonObject(v)) return keyword('json-object');
  return keyword('unknown');
}
