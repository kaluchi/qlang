import { keyword, isKeyword, isQMap, isQSet, isErrorValue, makeErrorValue } from './types.mjs';

export function errorFromQlang(qlangError, fault) {
  const d = new Map();
  d.set('origin', keyword('qlang/eval'));
  d.set('kind', keyword(qlangError.kind));
  d.set('thrown', keyword(qlangError.fingerprint ?? qlangError.name));
  d.set('message', qlangError.message);

  if (qlangError.context) {
    for (const [k, v] of Object.entries(qlangError.context)) {
      d.set(k, v ?? null);
    }
  }

  d.set('fault', fault);

  return makeErrorValue(d, {
    location: qlangError.location,
    originalError: qlangError
  });
}

export function errorFromParse(parseError) {
  const d = new Map();
  d.set('origin', keyword('qlang/parse'));
  d.set('kind', keyword('parse-error'));
  d.set('thrown', keyword('ParseError'));
  d.set('message', parseError.message);
  if (parseError.location) d.set('location', locationToMap(parseError.location));
  if (parseError.uri) d.set('uri', parseError.uri);
  return makeErrorValue(d, {
    location: parseError.location,
    originalError: parseError
  });
}

function locationToMap(loc) {
  const posToMap = (pos) => {
    const m = new Map();
    m.set('offset', pos.offset);
    m.set('line', pos.line);
    m.set('column', pos.column);
    return m;
  };
  const m = new Map();
  if (loc.start) m.set('start', posToMap(loc.start));
  if (loc.end) m.set('end', posToMap(loc.end));
  return m;
}

const WELL_KNOWN_PROPS = [
  'message', 'name', 'stack', 'code', 'errno',
  'status', 'statusCode', 'statusText'
];

export function errorFromForeign(jsError, astNode, fault) {
  const d = new Map();
  d.set('origin', keyword('host'));
  d.set('kind', keyword('foreign-error'));
  d.set('thrown', keyword(jsError.name));
  d.set('message', jsError.message);

  for (const prop of WELL_KNOWN_PROPS) {
    if (prop in jsError && jsError[prop] !== undefined && !d.has(prop))
      d.set(prop, coerce(jsError[prop]));
  }
  for (const [k, v] of Object.entries(jsError)) {
    if (!d.has(k))
      d.set(k, coerce(v));
  }

  if (jsError.cause instanceof Error) {
    const causes = [];
    let current = jsError.cause;
    while (current instanceof Error && causes.length < 8) {
      const m = new Map();
      m.set('message', current.message);
      m.set('thrown', keyword(current.name));
      causes.push(m);
      current = current.cause;
    }
    d.set('causes', causes);
  }

  d.set('operand', astNode?.text ?? null);
  d.set('fault', fault);

  return makeErrorValue(d, {
    location: astNode?.location ?? null,
    originalError: jsError
  });
}

function coerce(v, depth = 0) {
  if (depth > 4) return String(v);
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  if (isKeyword(v) || isQMap(v) || isQSet(v) || isErrorValue(v)) return v;
  if (Array.isArray(v)) return v.map(el => coerce(el, depth + 1));
  if (v instanceof Error) {
    const m = new Map();
    m.set('message', v.message);
    m.set('thrown', keyword(v.name));
    return m;
  }
  if (t === 'object') {
    const m = new Map();
    for (const [k, val] of Object.entries(v))
      m.set(k, coerce(val, depth + 1));
    return m;
  }
  return String(v);
}
