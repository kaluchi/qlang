import { keyword, makeErrorValue, makeTag, makeTagged, typeOf, ERROR_TAG } from './types.mjs';
import { declareDefect, recordRefusal } from './errors.mjs';
import { namesDeclaredUnder } from './nouns.mjs';
import { nameOfContinuation } from './parse.mjs';

// The reading of text into code refuses on `::quote`, and a primitive that
// fails in a call on `::call` [QSERR#site].
recordRefusal('quote/ParseError');
recordRefusal('call/HostFailureError');

// A refusal of the runtime that carries a fact neither its label nor the
// kind of errors declares: the source of the refusal and the catalog
// disagree, a defect of the runtime.
const BuiltinRefusalFactNotDeclaredError = declareDefect('builtin/RefusalFactNotDeclaredError',
  ({ address, fact }) => `${address.literal} carries ${fact.literal}, which neither its label nor ::error declares`);

const SPAN_TAG = makeTag('span');

// spanOfLocation(loc, source) → the stretch of the source a location names
// as a span, the offset from zero, the line and the column from one of its
// start and of the point after its end, each counted in code points as a
// string counts, `::span[0 1 1 1 1 2]` [QSPRN#span], or null for none.
export function spanOfLocation(loc, source) {
  if (!loc) return null;
  const point = ({ offset, line, column }) => {
    const lineStart = offset - (column - 1);
    return [codePointsIn(source, 0, offset), line, codePointsIn(source, lineStart, offset) + 1];
  };
  return makeTagged(SPAN_TAG, [...point(loc.start), ...point(loc.end)]);
}

// The code points of the source between two offsets of its UTF-16 text.
const codePointsIn = (source, from, to) => Array.from(source.slice(from, to)).length;

// factsInOrder(tag, facts, scope) → the facts of a refusal of the runtime in
// the order of the definitions that describe them, each named as its fact
// [QSERR#site]: those under the refusal's label first, then those under
// `::error`, which every refusal shares, the trace an error leaves coming
// after them as it joins them. A fact neither declares is a
// defect of the runtime.
export function factsInOrder(tag, facts, scope) {
  const ordered = new Map();
  for (const name of [...namesDeclaredUnder(scope, tag.name), ...namesDeclaredUnder(scope, ERROR_TAG.name)]) {
    if (facts.has(name) && !ordered.has(name)) ordered.set(name, facts.get(name));
  }
  for (const name of facts.keys()) {
    if (!ordered.has(name)) throw new BuiltinRefusalFactNotDeclaredError({ address: tag, fact: keyword(name) });
  }
  return ordered;
}

// The error a refusal of the runtime raised at the span of its step, or at
// none: the facts its site handed with the kind of the value refused, and a
// refusal of the subject its step was served the kind of that subject alone,
// which the first frame holds [QSERR#site].
export function errorFromQlang(qlangError, subject, scope, location = null) {
  const tag = makeTag(qlangError.address);
  const facts = new Map(Object.entries(qlangError.facts).filter(([, value]) => value !== undefined));
  const ofTheSubject = qlangError.refusesTheSubject === true && subject !== undefined;
  if (ofTheSubject) facts.delete('actualValue');
  if (ofTheSubject || facts.has('actualValue')) facts.set('actualType', typeOf(ofTheSubject ? subject : facts.get('actualValue')));
  return makeErrorValue(tag, factsInOrder(tag, facts, scope), { location, originalError: qlangError });
}

// The error of a text the parser refused: the line where it stopped, what it
// wanted there, the span of the place and where the text came from, in the
// order its label declares [QSSYN#refusal].
export function errorFromParse(parseError, scope, uri = parseError.uri) {
  const d = new Map();
  if (parseError.source != null && parseError.location) d.set('source', parseError.source.split('\n')[parseError.location.start.line - 1]);
  // A refusal the grammar names itself carries its sentence, which says
  // the fix, and a bracket left open its sentence beside its closers
  // [QSSYN#refusal]; any other failure lists what the parser expected there.
  if (parseError.sentence) d.set('message', parseError.sentence);
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  else d.set('message', parseError.message);
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (parseError.location) d.set('location', spanOfLocation(parseError.location, parseError.source));
  if (uri) d.set('origin', keyword(uri));
  const tag = makeTag('quote/ParseError');
  return makeErrorValue(tag, factsInOrder(tag, d, scope), {
    location: parseError.location,
    originalError: parseError
  });
}

// The continuations a parse failure lists, each once: a literal as its text,
// the end, any character and a named part of the grammar as keywords [QSSYN#refusal].
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
  return alt.type === 'literal' ? alt.text : keyword(nameOfContinuation(alt));
}

// The failures beneath a host's failure that its facts recount.
const CAUSES_RECOUNTED = 8;

// A JavaScript error escaping a primitive is a failure of the host: a tag of
// the language, its account and the accounts of the failures beneath it
// [QSERR#site], at the span of the step that ran it. The step that failed
// stands in the trace; the stack, the class and the fields of the error stay
// with the host in `originalError`, and a host that has facts to hand
// declares a refusal of its own.
export function errorFromForeign(jsError, location, scope) {
  const tag = makeTag('call/HostFailureError');
  const facts = new Map([['message', accountOf(jsError)]]);
  const causes = [];
  for (let cause = jsError?.cause; cause != null && causes.length < CAUSES_RECOUNTED; cause = cause?.cause) {
    causes.push(accountOf(cause));
  }
  if (causes.length > 0) facts.set('causes', Object.freeze(causes));
  return makeErrorValue(tag, factsInOrder(tag, facts, scope), {
    location,
    originalError: jsError
  });
}

// What a thrown value says of itself: an error's message, and any other
// value as its text, since a host may throw what it likes.
function accountOf(thrown) {
  return thrown instanceof Error ? thrown.message : String(thrown);
}
