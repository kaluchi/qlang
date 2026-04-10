// Error-to-value conversion for evalNode's catch block.
//
// Two converters: errorFromQlang for qlang's own errors (known
// shape, minimal coercion), errorFromForeign for host errors
// (unknown shape, best-effort extraction).

import { keyword, isKeyword, isQMap, isQSet, isErrorValue, makeErrorValue } from './types.mjs';

// errorFromQlang(qlangError, astNode) → error value
//
// Context fields from per-site error classes are scalars and
// strings — no deep coercion needed.
export function errorFromQlang(qlangError, astNode) {
  const d = new Map();
  d.set(keyword('origin'), keyword('qlang/eval'));
  d.set(keyword('kind'), keyword(qlangError.kind));
  d.set(keyword('thrown'), keyword(qlangError.fingerprint ?? qlangError.name));
  d.set(keyword('message'), qlangError.message);

  if (qlangError.context) {
    for (const [k, v] of Object.entries(qlangError.context)) {
      if (k === 'actualValue' || k === 'site') continue;
      d.set(keyword(k), v ?? null);
    }
  }

  return makeErrorValue(d, {
    location: qlangError.location,
    originalError: qlangError
  });
}

// errorFromParse(parseError) → error value
//
// Wraps a ParseError into an error value so parse failures
// flow through the pipeline like any other error.
export function errorFromParse(parseError) {
  const d = new Map();
  d.set(keyword('origin'), keyword('qlang/parse'));
  d.set(keyword('kind'), keyword('parse-error'));
  d.set(keyword('thrown'), keyword('ParseError'));
  d.set(keyword('message'), parseError.message);
  if (parseError.location) d.set(keyword('location'), locationToMap(parseError.location));
  if (parseError.uri) d.set(keyword('uri'), parseError.uri);
  return makeErrorValue(d, {
    location: parseError.location,
    originalError: parseError
  });
}

// Convert a peggy/qlang source location {start, end} to a qlang Map
// so it round-trips through !{} literals.
function locationToMap(loc) {
  const posToMap = (pos) => {
    const m = new Map();
    m.set(keyword('offset'), pos.offset);
    m.set(keyword('line'), pos.line);
    m.set(keyword('column'), pos.column);
    return m;
  };
  const m = new Map();
  if (loc.start) m.set(keyword('start'), posToMap(loc.start));
  if (loc.end) m.set(keyword('end'), posToMap(loc.end));
  return m;
}

// errorFromForeign(jsError, astNode) → error value
//
// Best-effort extraction from any JS Error. Host errors have
// unknown shape — defensive coercion is intentional here.
const WELL_KNOWN_PROPS = [
  'message', 'name', 'stack', 'code', 'errno',
  'status', 'statusCode', 'statusText'
];

export function errorFromForeign(jsError, astNode) {
  const d = new Map();
  d.set(keyword('origin'), keyword('host'));
  d.set(keyword('kind'), keyword('foreign-error'));
  d.set(keyword('thrown'), keyword(jsError.name));
  d.set(keyword('message'), jsError.message);

  for (const prop of WELL_KNOWN_PROPS) {
    if (prop in jsError && jsError[prop] !== undefined && !d.has(keyword(prop)))
      d.set(keyword(prop), coerce(jsError[prop]));
  }
  for (const [k, v] of Object.entries(jsError)) {
    if (!d.has(keyword(k)))
      d.set(keyword(k), coerce(v));
  }

  if (jsError.cause instanceof Error) {
    const causes = [];
    let current = jsError.cause;
    while (current instanceof Error && causes.length < 8) {
      const m = new Map();
      m.set(keyword('message'), current.message);
      m.set(keyword('thrown'), keyword(current.name));
      causes.push(m);
      current = current.cause;
    }
    d.set(keyword('causes'), causes);
  }

  d.set(keyword('operand'), astNode?.text ?? null);

  return makeErrorValue(d, {
    location: astNode?.location ?? null,
    originalError: jsError
  });
}

// coerce(v) — convert JS value to qlang value for foreign error
// descriptor fields. Scalars pass through; objects become Maps;
// arrays become Vecs. Depth-limited for safety.
function coerce(v, depth = 0) {
  if (depth > 4) return String(v);
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  if (isKeyword(v) || isQMap(v) || isQSet(v) || isErrorValue(v)) return v;
  if (Array.isArray(v)) return v.map(el => coerce(el, depth + 1));
  if (v instanceof Error) {
    const m = new Map();
    m.set(keyword('message'), v.message);
    m.set(keyword('thrown'), keyword(v.name));
    return m;
  }
  if (t === 'object') {
    const m = new Map();
    for (const [k, val] of Object.entries(v))
      m.set(keyword(k), coerce(val, depth + 1));
    return m;
  }
  return String(v);
}
