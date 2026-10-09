import {
  keyword, isKeyword, isQMap, isQSet, isErrorValue,
  makeErrorValue, makeTagKeyword, typeKeyword
} from './types.mjs';
import { locationToQlangMap } from './walk.mjs';
import { declareInvariantError, recordRefusal } from './errors.mjs';
import { namesDeclaredUnder } from './runtime/nouns.mjs';

// The reading of text into code refuses on `::quote`, and an
// implementation of a host that fails in a call on `::call` [D64].
recordRefusal('quote/ParseError');
recordRefusal('call/HostFailureError');

// A refusal of the runtime that carries a fact neither its label nor the
// kind of errors declares: the source of the refusal and the catalog
// disagree, a defect of the runtime.
const BuiltinRefusalFactNotDeclaredError = declareInvariantError('builtin/RefusalFactNotDeclaredError',
  ({ address, fact }) => `${address.literal} carries ${fact.literal}, which neither its label nor ::error declares`);

const ERROR_KIND_NAME = 'error';

// factsInOrder(tag, facts, env) → the facts of a refusal of the runtime in
// the order of the definitions that describe them, each named as its fact
// [D172]: those under the refusal's label first, then those under
// `::error`, which every refusal shares, the path an error takes coming
// after them as the trail joins it [D85]. A fact neither declares is a
// defect of the runtime.
export function factsInOrder(tag, facts, env) {
  const ordered = new Map();
  for (const name of [...namesDeclaredUnder(env, tag.name), ...namesDeclaredUnder(env, ERROR_KIND_NAME)]) {
    if (facts.has(name) && !ordered.has(name)) ordered.set(name, facts.get(name));
  }
  for (const name of facts.keys()) {
    if (!ordered.has(name)) throw new BuiltinRefusalFactNotDeclaredError({ address: tag, fact: keyword(name) });
  }
  return ordered;
}

// The error a refusal of the runtime raised: the facts its site handed
// with the kind of the value refused, the value itself left out where it
// is the subject the first stop of the trail holds, so its presence says
// the site reached below the subject [D85], [D172].
export function errorFromQlang(qlangError, subject, env) {
  const tag = makeTagKeyword(qlangError.address);
  const facts = new Map();
  for (const [name, value] of Object.entries(qlangError.context)) {
    if (value === undefined || (name === 'actualValue' && value === subject)) continue;
    facts.set(name, value);
  }
  if (qlangError.context.actualValue !== undefined) facts.set('actualType', typeKeyword(qlangError.context.actualValue));
  return makeErrorValue(tag, factsInOrder(tag, facts, env), {
    location: qlangError.location,
    originalError: qlangError
  });
}

// The error of a text the parser refused: where it stopped and what it
// wanted there, in the order its label declares them.
export function errorFromParse(parseError, env) {
  const d = new Map();
  if (parseError.source != null && parseError.location) {
    const excerpt = excerptAroundLocation(parseError.source, parseError.location);
    d.set('source', excerpt.source);
    d.set('marker', excerpt.marker);
  }
  // A refusal the grammar names itself carries its sentence, which says
  // the fix, and a bracket left open its sentence beside its closers
  // [D125]; any other failure lists what the parser expected there.
  if (parseError.sentence) d.set('message', parseError.sentence);
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  else d.set('message', parseError.message);
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (parseError.location) d.set('location', locationToQlangMap(parseError.location));
  if (parseError.uri) d.set('uri', parseError.uri);
  const tag = makeTagKeyword('quote/ParseError');
  return makeErrorValue(tag, factsInOrder(tag, d, env), {
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
export function errorFromForeign(jsError, astNode) {
  const tag = makeTagKeyword('call/HostFailureError');
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
