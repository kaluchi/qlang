import {
  keyword, isKeyword, isQMap, isQSet, isErrorValue,
  makeErrorValue, makeTagKeyword, PARSE_ERROR_TAG
} from './types.mjs';
import { locationToQlangMap } from './walk.mjs';
import { recordThrowSiteSpec } from './errors.mjs';
import { isTagBindingName, stripTagBindingPrefix } from './env-keys.mjs';

// The reading of text into code refuses on `::quote`, and an
// implementation of a host that fails in a call on `::call` [D64].
recordThrowSiteSpec('ParseError', 'parseError', { operand: '::quote' });
recordThrowSiteSpec('ForeignFailureError', 'error', { operand: '::call' });

// Descriptor field-order: high-entropy first. The per-site
// identity (the same invariant every tagged-instance value-class
// carries — verb, binding record, qlang, json, user `::Foo[…]`)
// rides on the error value's JS-header `tag` slot, not on the
// descriptor Map. `:faultStep` (Quote of failing source slice)
// and `:faultInput` (pipeValue at step entry) carry the runtime
// fault frame as two flat fields — no wrapper Map; per-invocation
// context (`:actualType`, `:actualValue` when it differs from
// `:faultInput`, Comparability pair-fields, `:index`, dispatch-
// time `:operandName`) follows. Identity is
// surfaced through the `type` operand (`result !| type |
// eq ::Foo`), which reads `error.tag` straight off the JS
// header. Per-tag static facts — `:category`, `:operand`,
// `:position`, `:expectedType` — are properties of the throw
// site, recorded by the factory that builds the class and
// stamped onto the tag-binding at bootstrap, and are reachable
// through hypertext navigation via the `spec` axis: `result !|
// type | spec | /category` reads the broad-bucket; `result !|
// type | spec | /operand` reads the per-site origin.
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
// from a JS throw site — a referenced namespace / parameter /
// operand / axis / binding. The JS→qlang boundary lifts
// each such string to a Keyword, and the env key of a tag, `::Foo`,
// to the tag, so the descriptor surface stays uniformly
// identifier-typed: `printValue` prints `:name` rather than `"name"`,
// `!| /operandName` projection reads as a Keyword, downstream
// pattern-match against `eq :foo` or `eq ::Foo` works. Numeric and
// non-string slots pass through unchanged (`fieldName in
// IDENTIFIER_FIELDS` gate).
const IDENTIFIER_FIELDS = new Set([
  'name',
  'operandName', 'namespaceName', 'namespace', 'paramName',
  'effectfulName', 'bindingName',
  'tag', 'exportName'
]);
function liftIdentifier(k, v) {
  if (!IDENTIFIER_FIELDS.has(k)) return v;
  return isTagBindingName(v) ? makeTagKeyword(stripTagBindingPrefix(v)) : keyword(v);
}

export function errorFromQlang(qlangError, faultStep, faultInput) {
  const tag = makeTagKeyword(qlangError.name);
  const d = new Map();
  d.set('faultStep', faultStep);
  d.set('faultInput', faultInput);

  // Instance carries only the dynamic facts the JS context attached
  // (`:actualType`, comparability pair-types, `:index`, dispatch-time
  // `:operandName`, etc.). Per-tag static facts —
  // `:category`, `:operand`, `:position`, `:expectedType` — ride the
  // tag-binding, stamped there from the throw site, and reach the
  // reader through hypertext navigation: `result !| type | spec`
  // returns the stamped descriptor; `result !| type | source` walks
  // the BindStep source; `result !| type | docs` returns the
  // canonical prose the catalog authored.
  //
  // `:actualValue` ref-eq dedup against `:faultInput` — when the
  // throw site's per-instance `actualValue` is the very pipeValue
  // the step received (subject-shape errors on a partial application,
  // single-segment projection on a leaf subject), the redundant lift
  // is skipped. When the throw site drilled below `:faultInput`
  // (multi-segment projection, full-application captured-arg, element
  // iteration), `actualValue` is stamped — its presence is the
  // type-level signal «drill-down happened, look here».
  // Every QlangError carries a context bag — the root's constructor
  // defaults it to `{}` — and `evalNode` routes anything outside the
  // hierarchy to `errorFromForeign` instead, so the walk needs no
  // fallback.
  const ctx = qlangError.context;
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
    // are exclusively per-site shape extras (operand-, namespace-,
    // etc.) and never need the same gate.
    if (RUNTIME_FIELD_ORDER.includes(k)) continue;
    if (v === undefined) continue;
    d.set(k, liftIdentifier(k, v));
  }

  // No `:category` stamp — the broad-bucket taxonomy rides the
  // tag-binding, where the bootstrap put it from the throw site's
  // recorded spec; `result !| type | spec | /category` reads it
  // through the `spec` axis.
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
    d.set('source', excerpt.source);
    d.set('marker', excerpt.marker);
  }
  // A refusal the grammar names itself carries its sentence, which says
  // the fix; any other failure lists what the parser expected there.
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  else d.set('message', parseError.message);
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (parseError.location) d.set('location', locationToQlangMap(parseError.location));
  if (parseError.uri) d.set('uri', parseError.uri);
  return makeErrorValue(PARSE_ERROR_TAG, d, {
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
  return classKeyword();
}

// A peggy char-class reads as `:char-class`: the classes a reader would
// name stand under named rules of the grammar, whitespace among them
// [D81].
function classKeyword() {
  return keyword('char-class');
}

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

// A JavaScript error escaping an operand is a foreign failure: it
// carries a tag of the language and its class name as the field
// `:name` [D7], so a port of the runtime to another host changes a
// field and no identity a query matches.
const FOREIGN_FAILURE_TAG = makeTagKeyword('ForeignFailureError');

export function errorFromForeign(jsError, astNode, faultStep, faultInput) {
  const tag = FOREIGN_FAILURE_TAG;
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

  // Cause-chain entries are inert Map records that document the
  // JS-side cause provenance for a foreign throw site, each naming
  // its host class under `:name` as the failure itself does —
  // `error !| /causes * /name` reads them.
  if (jsError.cause instanceof Error) {
    const causes = [];
    let current = jsError.cause;
    while (current instanceof Error && causes.length < 8) {
      const m = new Map();
      m.set('name', current.name);
      m.set('message', current.message);
      causes.push(m);
      current = current.cause;
    }
    d.set('causes', causes);
  }

  d.set('operand', astNode?.text ?? null);
  d.set('faultStep', faultStep);
  d.set('faultInput', faultInput);

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
    // A coerced JS Error is a record of the cause chain's shape, its
    // host class under `:name` beside `:message` [D7].
    const m = new Map();
    m.set('name', v.name);
    m.set('message', v.message);
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
