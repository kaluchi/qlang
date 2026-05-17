import {
  keyword, isKeyword, isQMap, isQSet, isErrorValue,
  makeErrorValue, makeTagKeyword
} from './types.mjs';
import { TAG_BINDING_PREFIX } from './env-keys.mjs';
import { locationToQlangMap } from './ast-codec.mjs';

// Descriptor field-order: high-entropy first. `:kind` TagKeyword
// names the per-site identity (the same invariant every
// tagged-instance value-class carries — conduit, snapshot, qlang,
// json, user `::Foo[…]`); `:fault` carries the runtime step +
// input that triggered the throw; per-invocation context
// (`:actualValue` / `:actualType` / Comparability pair-fields,
// `:index`, dispatch-time `:operandName` / `:conduitName`)
// follows. Identity is surfaced through the `type` operand
// (`result !| type | eq(::Foo)`), which reads `:kind` off the
// descriptor. Per-tag static facts — `:category`, `:operand`,
// `:position`, `:expectedType` — live on the tag-binding's catalog
// body (`::TagName ::builtin{:category … :operand … :position …
// :expectedType …}`) and are reachable through hypertext
// navigation via the `spec` axis: `result !| type | spec |
// /category` reads the broad-bucket; `result !| type | spec |
// /operand` reads the per-site origin.
const RUNTIME_FIELD_ORDER = [
  'kind', 'fault',
  'payloadValue', 'payloadType',
  'actualValue', 'actualType',
  'leftValue', 'leftType', 'rightValue', 'rightType',
  'index',
  'expectedType', 'operand', 'position',
  'message'
];

// Identifier-shaped descriptor fields carrying a `name`-like string
// from a JS throw site — a referenced conduit / namespace /
// parameter / operand / axis / binding. The JS→qlang boundary lifts
// each such string to a Keyword so the descriptor surface stays
// uniformly identifier-typed: `printValue` prints `:name` rather
// than `"name"`, `!| /operandName` projection reads as a Keyword,
// downstream pattern-match against `eq(:foo)` works. Numeric and
// non-string slots pass through unchanged (`fieldName in
// IDENTIFIER_FIELDS` gate).
const IDENTIFIER_FIELDS = new Set([
  'name',
  'operandName', 'conduitName', 'namespaceName', 'namespace', 'paramName',
  'effectfulName', 'bindingName', 'axisName',
  'tag', 'exportName'
]);
function liftIdentifier(k, v) {
  if (!IDENTIFIER_FIELDS.has(k)) return v;
  return keyword(v);
}

export function errorFromQlang(qlangError, fault, _env) {
  const d = new Map();
  const tagName = qlangError.fingerprint ?? qlangError.name;
  d.set('kind', makeTagKeyword(tagName));
  d.set('fault', fault);

  // Instance carries only the dynamic facts the JS context attached
  // (`:actualValue` / `:actualType`, comparability pair-types,
  // `:index`, dispatch-time `:operandName` / `:conduitName`, etc.).
  // Per-tag static facts — `:category`, `:operand`, `:position`,
  // `:expectedType` — live on the tag-binding's catalog body
  // (`::TagName ::builtin{:category … :operand … :position …
  // :expectedType …}`) and reach the reader through hypertext
  // navigation: `result !| type | spec` returns the catalog body
  // directly; `result !| type | source` walks the BindStep source;
  // `result !| type | docs` returns the canonical prose.
  const ctx = qlangError.context ?? {};
  for (const k of RUNTIME_FIELD_ORDER) {
    if (k === 'kind' || k === 'fault') continue;
    if (k in ctx && ctx[k] !== undefined) d.set(k, liftIdentifier(k, ctx[k]));
  }
  for (const [k, v] of Object.entries(ctx)) {
    if (RUNTIME_FIELD_ORDER.includes(k)) continue;
    if (v === undefined) continue;
    d.set(k, liftIdentifier(k, v));
  }

  // No `:category` stamp — the broad-bucket taxonomy lives on the
  // tag-binding's catalog body (`::TagName ::builtin{:category
  // :type-error …}`); `result !| type | spec | /category` reads
  // it through the `spec` axis.
  //
  // No `:message` stamp — the structured per-site fields
  // (`:actualType`, `:leftType`, …) carry every input the JS-side
  // template would re-format, the tag identity TagKeyword on
  // `:kind` carries the template itself, and `::Tag | docs`
  // resolves the canonical prose via hypertext navigation.
  return makeErrorValue(d, {
    location: qlangError.location,
    originalError: qlangError
  });
}

export function errorFromParse(parseError) {
  // Field ordering — highest-information-density first. The eye lands
  // on `:source` + `:marker` (visual pinpoint: WHERE the failure is)
  // before consulting `:expected` / `:found` (WHAT the parser wanted
  // vs. saw). Numeric `:location`, `:uri`, and the `:kind`
  // taxonomy trail, since they are derivable / less-load-bearing for
  // a human reading the diagnostic.
  const d = new Map();
  d.set('kind', makeTagKeyword('ParseError'));
  if (parseError.source != null && parseError.location) {
    const excerpt = excerptAroundLocation(parseError.source, parseError.location);
    if (excerpt !== null) {
      d.set('source', excerpt.source);
      d.set('marker', excerpt.marker);
    }
  }
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (parseError.location) d.set('location', locationToQlangMap(parseError.location));
  if (parseError.uri) d.set('uri', parseError.uri);
  // No `:message` stamp — `:source` + `:marker` + `:expected` +
  // `:found` carry the diagnostic data structurally; the human-
  // readable prose is reachable through `::ParseError | docs`
  // hypertext navigation.
  return makeErrorValue(d, {
    location: parseError.location,
    originalError: parseError
  });
}

// Peggy `expected` is a Vec of {type, ...} alternatives with
// heavy duplication (the same literal is reachable through several
// productions). Deduplicate by canonical shape and lower each
// element to its qlang surface form: a String for `literal`, a
// Keyword for the named char-class / `end-of-input`.
function liftExpectedAlternatives(expected) {
  const seen = new Set();
  const out = [];
  for (const alt of expected) {
    const lifted = liftExpectedAlternative(alt);
    const sigKey = typeof lifted === 'string' ? `s:${lifted}` : `k:${lifted.name}`;
    if (seen.has(sigKey)) continue;
    seen.add(sigKey);
    out.push(lifted);
  }
  return Object.freeze(out);
}

function liftExpectedAlternative(alt) {
  if (alt.type === 'literal') return alt.text;
  if (alt.type === 'end') return keyword('end-of-input');
  if (alt.type === 'any') return keyword('any-character');
  if (alt.type === 'other') return keyword(alt.description);
  return classKeyword(alt);
}

// Map a peggy char-class to a named keyword when the class shape
// is a well-known one (whitespace, digits, etc.); fall back to a
// `:char-class` keyword for ad-hoc classes so the Vec stays
// uniformly keyword-typed. Inverted char-classes from the grammar
// (`[^…]`) match greedily as content and stay out of peggy's
// `expected` set, so no `non-X` keyword path is wired here.
function classKeyword(cls) {
  const sig = cls.parts.map(p => Array.isArray(p) ? `${p[0]}-${p[1]}` : p).join('');
  return keyword(NAMED_CLASS_SIGS[sig] ?? 'char-class');
}

const NAMED_CLASS_SIGS = {
  ' \t\n\r':                 'whitespace',
  '\t\n\r ':                 'whitespace',
  '0-9':                     'digit',
  'a-zA-Z':                  'letter',
  'a-zA-Z0-9':               'alphanumeric',
  'a-zA-Z_':                 'identifier-start',
  'a-zA-Z0-9_':              'identifier-continue',
  'a-zA-Z0-9_-':             'identifier-continue'
};

// Build the source line + caret marker pair. Stamped as two
// top-level descriptor entries `:source` / `:marker` — both
// 7-character keys, so `printMapLike`'s shared prefix lines the
// strings up column-for-column and the caret sits exactly under
// the offending char. The marker is trailing-space-padded to the
// source length so both strings end at the same column (visual
// rectangle, no ragged right edge). Canonical numeric position
// lives in `:location.start`; this pair carries only the visual.
function excerptAroundLocation(source, location) {
  const lineNumber = location.start.line;
  const line = source.split('\n')[lineNumber - 1];
  const startCol = location.start.column;
  // Peggy always emits `end.line === start.line` for qlang grammar
  // failures — the failure span is always within one source line —
  // so the marker width is `end.column - start.column` clamped to
  // at least 1 so a zero-width position (end-of-input failure)
  // still produces a single caret.
  const markerWidth = Math.max(1, location.end.column - startCol);
  const lead = ' '.repeat(Math.max(0, startCol - 1));
  const caret = '^' + '~'.repeat(Math.max(0, markerWidth - 1));
  const tail = ' '.repeat(Math.max(0, line.length - lead.length - caret.length));
  return { source: line, marker: lead + caret + tail };
}

const WELL_KNOWN_PROPS = [
  'message', 'name', 'stack', 'code', 'errno',
  'status', 'statusCode', 'statusText'
];

export function errorFromForeign(jsError, astNode, fault) {
  const d = new Map();
  d.set('kind', makeTagKeyword(jsError.name));
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
      m.set('kind', makeTagKeyword(current.name));
      m.set('message', current.message);
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
    m.set('kind', makeTagKeyword(v.name));
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
