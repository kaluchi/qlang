import { keyword, makeErrorValue, makeTag, typeKeyword } from './types.mjs';
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
// after them as the trail joins it [D13]. A fact neither declares is a
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
// the site reached below the subject [D13], [D172].
export function errorFromQlang(qlangError, subject, env) {
  const tag = makeTag(qlangError.address);
  const facts = new Map();
  for (const [name, value] of Object.entries(qlangError.facts)) {
    if (value === undefined || (name === 'actualValue' && value === subject)) continue;
    facts.set(name, value);
  }
  if (qlangError.facts.actualValue !== undefined) facts.set('actualType', typeKeyword(qlangError.facts.actualValue));
  return makeErrorValue(tag, factsInOrder(tag, facts, env), {
    location: qlangError.location,
    originalError: qlangError
  });
}

// The error of a text the parser refused: where it stopped and what it
// wanted there, in the order its label declares them.
export function errorFromParse(parseError, env, uri = parseError.uri) {
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
  if (uri) d.set('uri', uri);
  const tag = makeTag('quote/ParseError');
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

// The failures beneath a host's failure that its facts recount.
const CAUSES_RECOUNTED = 8;

// A JavaScript error escaping an implementation is a failure of the
// host: a tag of the language and the facts every host can give, its
// account and the accounts of the failures beneath it, so a port of the
// runtime to another language changes no fact a query reads [D7],
// [D172]. The step that failed stands in the trail; the stack, the class
// and the fields of the error stay with the host in `originalError`, and
// a host that has facts to hand declares a refusal of its own.
export function errorFromForeign(jsError, node, env) {
  const tag = makeTag('call/HostFailureError');
  const facts = new Map([['message', accountOf(jsError)]]);
  const causes = [];
  for (let cause = jsError?.cause; cause != null && causes.length < CAUSES_RECOUNTED; cause = cause?.cause) {
    causes.push(accountOf(cause));
  }
  if (causes.length > 0) facts.set('causes', Object.freeze(causes));
  return makeErrorValue(tag, factsInOrder(tag, facts, env), {
    location: node?.location ?? null,
    originalError: jsError
  });
}

// What a thrown value says of itself: an error's message, and any other
// value as its text, since a host may throw what it likes.
function accountOf(thrown) {
  return thrown instanceof Error ? thrown.message : String(thrown);
}
