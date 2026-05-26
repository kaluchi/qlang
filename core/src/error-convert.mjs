import {
  keyword, isKeyword, isQMap, isQSet, isErrorValue,
  makeErrorValue, makeTagKeyword
} from './types.mjs';
import { locationToQlangMap } from './ast-codec.mjs';

// Descriptor field-order: high-entropy first. The per-site
// identity (the same invariant every tagged-instance value-class
// carries — conduit, snapshot, qlang, json, user `::Foo[…]`)
// rides on the error value's JS-header `tag` slot, not on the
// descriptor Map. `:faultStep` (Quote of failing source slice)
// and `:faultInput` (pipeValue at step entry) carry the runtime
// fault frame as two flat fields — no wrapper Map; per-invocation
// context (`:actualType`, `:actualValue` when it differs from
// `:faultInput`, Comparability pair-fields, `:index`, dispatch-
// time `:operandName` / `:conduitName`) follows. Identity is
// surfaced through the `type` operand (`result !| type |
// eq(::Foo)`), which reads `error.tag` straight off the JS
// header. Per-tag static facts — `:category`, `:operand`,
// `:position`, `:expectedType` — live on the tag-binding's
// catalog body (`::TagName ::builtin{:category … :operand …
// :position … :expectedType …}`) and are reachable through
// hypertext navigation via the `spec` axis: `result !| type |
// spec | /category` reads the broad-bucket; `result !| type |
// spec | /operand` reads the per-site origin.
//
// `:actualValue` lift rule: stamped only when the throw site
// drilled below `:faultInput` (multi-segment projection,
// full-application captured-arg resolution, element-iteration).
// Reader sees the presence-as-signal: absent → fault landed at
// the top of the step's `:faultInput`; present → drill-down,
// look at `:actualValue` for the offending sub-value. The dedup
// runs ref-equality against `:faultInput` inside the lift loop
// below — no per-site code needs to know.
const RUNTIME_FIELD_ORDER = [
  'faultStep', 'faultInput',
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

export function errorFromQlang(qlangError, faultStep, faultInput) {
  const tag = makeTagKeyword(qlangError.fingerprint ?? qlangError.name);
  const d = new Map();
  d.set('faultStep', faultStep);
  d.set('faultInput', faultInput);

  // Instance carries only the dynamic facts the JS context attached
  // (`:actualType`, comparability pair-types, `:index`, dispatch-time
  // `:operandName` / `:conduitName`, etc.). Per-tag static facts —
  // `:category`, `:operand`, `:position`, `:expectedType` — live on
  // the tag-binding's catalog body (`::TagName ::builtin{:category …
  // :operand … :position … :expectedType …}`) and reach the reader
  // through hypertext navigation: `result !| type | spec` returns
  // the catalog body directly; `result !| type | source` walks the
  // BindStep source; `result !| type | docs` returns the canonical
  // prose.
  //
  // `:actualValue` ref-eq dedup against `:faultInput` — when the
  // throw site's per-instance `actualValue` is the very pipeValue
  // the step received (subject-shape errors on a partial application,
  // single-segment projection on a leaf subject), the redundant lift
  // is skipped. When the throw site drilled below `:faultInput`
  // (multi-segment projection, full-application captured-arg, element
  // iteration), `actualValue` is stamped — its presence is the
  // type-level signal «drill-down happened, look here».
  const ctx = qlangError.context ?? {};
  const liftedFromOrder = new Set();
  for (const k of RUNTIME_FIELD_ORDER) {
    if (k === 'faultStep' || k === 'faultInput') continue;
    if (!(k in ctx) || ctx[k] === undefined) continue;
    if (k === 'actualValue' && ctx[k] === faultInput) continue;
    d.set(k, liftIdentifier(k, ctx[k]));
    liftedFromOrder.add(k);
  }
  for (const [k, v] of Object.entries(ctx)) {
    if (liftedFromOrder.has(k)) continue;
    // 'actualValue' is in RUNTIME_FIELD_ORDER, so the ref-eq dedup
    // against `faultInput` runs in the loop above; tail-loop fields
    // are exclusively per-site shape extras (operand-, conduit-,
    // namespace-, etc.) and never need the same gate.
    if (RUNTIME_FIELD_ORDER.includes(k)) continue;
    if (v === undefined) continue;
    d.set(k, liftIdentifier(k, v));
  }

  // No `:category` stamp — the broad-bucket taxonomy lives on the
  // tag-binding's catalog body (`::TagName ::builtin{:category
  // :typeError …}`); `result !| type | spec | /category` reads
  // it through the `spec` axis.
  //
  // No `:message` stamp — the structured per-site fields
  // (`:actualType`, `:leftType`, …) carry every input the JS-side
  // template would re-format, the tag identity TagKeyword on the
  // error's JS-header carries the template itself, and `::Tag |
  // docs` resolves the canonical prose via hypertext navigation.
  return makeErrorValue(tag, d, {
    location: qlangError.location,
    originalError: qlangError
  });
}

export function errorFromParse(parseError) {
  // Field ordering — highest-information-density first. The eye lands
  // on `:source` + `:marker` (visual pinpoint: WHERE the failure is)
  // before consulting `:expected` / `:found` (WHAT the parser wanted
  // vs. saw). Numeric `:location` and `:uri` trail since they are
  // derivable / less-load-bearing for a human reading the diagnostic.
  // The `::ParseError` tag identity rides on the error's JS-header
  // `tag` slot.
  const d = new Map();
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
  return makeErrorValue(makeTagKeyword('ParseError'), d, {
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

export function errorFromForeign(jsError, astNode, faultStep, faultInput) {
  const tag = makeTagKeyword(jsError.name);
  const d = new Map();
  d.set('message', jsError.message);

  for (const prop of WELL_KNOWN_PROPS) {
    if (prop in jsError && jsError[prop] !== undefined && !d.has(prop))
      d.set(prop, coerce(jsError[prop]));
  }
  for (const [k, v] of Object.entries(jsError)) {
    if (!d.has(k))
      d.set(k, coerce(v));
  }

  // Cause-chain entries are inert Map records (not error values
  // themselves) — they document the JS-side cause provenance for
  // a foreign throw site. The `:kind` field here is a domain-level
  // discriminator, not the identity-slot invariant Phase 1 lifts
  // off error values: a plain Map carries whatever fields its
  // builder chooses, and `:kind <TagKeyword>` keeps the record
  // structurally addressable through `error !| /causes * /kind`.
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
  if (faultStep !== undefined) d.set('faultStep', faultStep);
  if (faultInput !== undefined) d.set('faultInput', faultInput);

  return makeErrorValue(tag, d, {
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
    // Mirror the cause-chain shape: a coerced JS Error is a Map
    // record (not an error value) carrying the originating JS-side
    // name on `:kind` plus `:message`. `:kind` here is a domain-
    // level discriminator — Phase 1's identity-on-JS-header
    // invariant covers error values, not the plain Maps they
    // shelter.
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
