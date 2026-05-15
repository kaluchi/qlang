import {
  keyword, isKeyword, isQMap, isQSet, isErrorValue,
  makeErrorValue, makeTagKeyword,
  TAG_BINDING_PREFIX
} from './types.mjs';
import { locationToQlangMap } from './ast-codec.mjs';

// Descriptor field-order: high-entropy first. `:qlang/kind`
// TagKeyword names the per-site identity (the same invariant
// every tagged-instance value-class carries — conduit, snapshot,
// qlang, json, user `::Foo[…]`); `:fault` carries the runtime
// step + input that triggered the throw; per-invocation context
// (`:actualValue` / `:actualType` / Comparability pair-fields)
// follows. Lower-entropy taxonomy (`:operand`, `:position`,
// `:expectedType`, `:origin`, `:kind`, `:message`) trails — those
// are derivable from the tag-binding's catalog declaration and
// reachable via `::Tag | docs / source` hypertext navigation, but
// stamped here too so programmatic projections work without a
// round-trip through axis-operands. Identity is surfaced through
// the `type` operand (`result !| type | eq(::Foo)`), which reads
// `:qlang/kind` off the descriptor.
const RUNTIME_FIELD_ORDER = [
  'qlang/kind', 'fault',
  'payloadValue', 'payloadType',
  'actualValue', 'actualType',
  'leftValue', 'leftType', 'rightValue', 'rightType',
  'index',
  'expectedType', 'operand', 'position',
  'origin', 'kind', 'message'
];

// Identifier-shaped descriptor fields carrying a `name`-like string
// from a JS throw site — the operand's own name, an argument-slot
// designation, a referenced conduit / namespace / parameter / etc.
// Across the JS→qlang boundary every such string lifts to a Keyword
// (or TagKeyword when the source string carries a `::` prefix) so
// the descriptor surface stays uniformly identifier-typed
// (printValue prints `:name` not `"name"`, `!| /operand` projection
// reads as a Keyword, downstream pattern-match sees one shape).
// Numeric positions, kept-as-String prose, and runtime non-string
// values pass through unchanged. `:expectedType` is already-keyword
// shape when the throw site uses the `operand-errors.mjs` factories,
// so no lift needed here.
const IDENTIFIER_FIELDS = new Set([
  'operand', 'position', 'name',
  'operandName', 'conduitName', 'namespaceName', 'namespace', 'paramName',
  'effectfulName', 'bindingName', 'axisName',
  'tag', 'exportName'
]);
function liftIdentifier(k, v) {
  if (!IDENTIFIER_FIELDS.has(k)) return v;
  if (typeof v !== 'string') return v;
  return v.startsWith(TAG_BINDING_PREFIX)
    ? makeTagKeyword(v.slice(TAG_BINDING_PREFIX.length))
    : keyword(v);
}

export function errorFromQlang(qlangError, fault) {
  const d = new Map();
  d.set('qlang/kind', makeTagKeyword(qlangError.fingerprint ?? qlangError.name));
  d.set('fault', fault);
  const ctx = qlangError.context ?? {};
  for (const k of RUNTIME_FIELD_ORDER) {
    if (k === 'qlang/kind' || k === 'fault') continue;
    if (k in ctx && ctx[k] !== undefined) d.set(k, liftIdentifier(k, ctx[k]));
  }
  for (const [k, v] of Object.entries(ctx)) {
    if (RUNTIME_FIELD_ORDER.includes(k)) continue;
    if (v === undefined) continue;
    d.set(k, liftIdentifier(k, v));
  }
  d.set('origin', keyword('qlang/eval'));
  d.set('kind', keyword(qlangError.kind));
  // No `:message` stamp — the structured per-site fields
  // (`:operand`, `:position`, `:expectedType`, `:actualType`, …)
  // carry every input the JS-side template would re-format, the
  // class identity TagKeyword on `:qlang/kind` carries the template
  // itself, and `::Tag | docs` resolves the canonical prose via
  // hypertext navigation. Stamping the redundant prose string
  // here would mean printValue's tag-head elision and a JSONL
  // round-trip disagree on descriptor shape.
  return makeErrorValue(d, {
    location: qlangError.location,
    originalError: qlangError
  });
}

export function errorFromParse(parseError) {
  // Field ordering — highest-information-density first. The eye lands
  // on `:source` + `:marker` (visual pinpoint: WHERE the failure is)
  // before consulting `:expected` / `:found` (WHAT the parser wanted
  // vs. saw). Numeric `:location`, `:uri`, and the `:origin` / `:kind`
  // taxonomy trail, since they are derivable / less-load-bearing for
  // a human reading the diagnostic.
  const d = new Map();
  d.set('qlang/kind', makeTagKeyword('ParseError'));
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
  d.set('origin', keyword('qlang/parse'));
  d.set('kind', keyword('parse-error'));
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
  d.set('qlang/kind', makeTagKeyword(jsError.name));
  d.set('origin', keyword('host'));
  d.set('kind', keyword('foreign-error'));
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
      m.set('qlang/kind', makeTagKeyword(current.name));
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
    m.set('qlang/kind', makeTagKeyword(v.name));
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
