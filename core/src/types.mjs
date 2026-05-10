import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { classifyEffect } from './effect.mjs';

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

export function isQuote(v) {
  return v !== null && typeof v === 'object' && v.type === 'quote';
}

// Quote — frozen JS object carrying `.source` (the verbatim text
// between backticks) and an optional `.ast` (lazily populated when
// the Quote is run through `eval` or projected via `/ast`). Lives
// on the JS layer rather than as a Map with `:qlang/kind :quote`
// so the discriminator stays out of pipeValue projection — Quote
// lands in pipeValue directly through the backtick literal, so
// keeping the discriminator in a Map-key would expose runtime
// housekeeping at the user surface. The lazy `.ast` lets a Quote
// hold a pipeline-suffix fragment beginning with a combinator
// (`* inc | sort`) — eager parse would reject the fragment because
// Pipeline head must be a RawStep, not a combinator.
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
  const m = new Map();
  m.set('qlang/kind', keyword('conduit'));
  m.set('name', name);
  m.set('params', Object.freeze([...params]));
  m.set('qlang/body', body);
  m.set('qlang/envRef', envRef);
  m.set('docs', Object.freeze([...docs]));
  m.set('location', location);
  m.set('effectful', classifyEffect(name));
  return m;
}

// ── snapshot factory ──────────────────────────────────────────

export function makeSnapshot(value, { name, docs = [], location = null } = {}) {
  const m = new Map();
  m.set('qlang/kind', keyword('snapshot'));
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
  if (isJsonArray(v)) return 'JsonArray';
  if (isVec(v)) return 'Vec';
  if (isConduit(v)) return 'Conduit';
  if (isSnapshot(v)) return 'Snapshot';
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
  if (isJsonArray(v)) return keyword('json-array');
  if (isVec(v)) return keyword('vec');
  if (isConduit(v)) return keyword('conduit');
  if (isSnapshot(v)) return keyword('snapshot');
  if (isQuote(v)) return keyword('quote');
  if (isDoc(v)) return keyword('doc');
  if (isQMap(v)) return keyword('map');
  if (isQSet(v)) return keyword('set');
  if (isErrorValue(v)) return keyword('error');
  if (isFunctionValue(v)) return keyword('function');
  if (isJsonObject(v)) return keyword('json-object');
  return keyword('unknown');
}
