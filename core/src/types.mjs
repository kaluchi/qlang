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
export function isVec(v) { return Array.isArray(v); }
export function isQMap(v) { return v instanceof Map; }
export function isQSet(v) { return v instanceof Set; }

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

// ── conduit / snapshot predicates ─────────────────────────────

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

const EMPTY_TRAIL = Object.freeze([]);

export function makeErrorValue(descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (!descriptor.has('trail')) {
    finalDescriptor = new Map(descriptor);
    finalDescriptor.set('trail', EMPTY_TRAIL);
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
  const trail = [];
  let cur = errorValue._trailHead;
  while (cur) { trail.push(cur.entry); cur = cur.prev; }
  trail.reverse();
  return trail;
}

// ── describeType ──────────────────────────────────────────────

export function describeType(v) {
  if (isNull(v)) return 'Null';
  if (isBoolean(v)) return 'Boolean';
  if (isNumber(v)) return 'Number';
  if (isString(v)) return 'String';
  if (isKeyword(v)) return 'Keyword';
  if (isVec(v)) return 'Vec';
  if (isConduit(v)) return 'Conduit';
  if (isSnapshot(v)) return 'Snapshot';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'Function';
  return 'Unknown';
}
