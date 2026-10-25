import { makeKeyword, makeErrorValue, makeTag, tagOf, ERROR_TAG } from './types.mjs';
import { declareDefect, recordRefusal } from './errors.mjs';
import { namesDeclaredUnder } from './nouns.mjs';
import { nameOfContinuation } from './parse.mjs';

// [QSERR#site]
recordRefusal('quote/ParseError');
recordRefusal('call/HostFailureError');

const BuiltinRefusalFactNotDeclaredError = declareDefect('builtin/RefusalFactNotDeclaredError',
  ({ address, fact }) => `${address.literal} carries ${fact.literal}, which neither its label nor ::error declares`);

// [QSPRN#span]
export function spanOfLocation(loc, source) {
  const point = ({ offset, line, column }) => {
    const lineStart = offset - (column - 1);
    return [codePointsIn(source, 0, offset), line, codePointsIn(source, lineStart, offset) + 1];
  };
  return Object.freeze([...point(loc.start), ...point(loc.end)]);
}

const codePointsIn = (source, from, to) => Array.from(source.slice(from, to)).length;

// [QSERR#site]
export function factsInOrder(tag, facts, scope) {
  const ordered = new Map();
  for (const name of [...namesDeclaredUnder(scope, tag.name), ...namesDeclaredUnder(scope, ERROR_TAG.name)]) {
    if (facts.has(name) && !ordered.has(name)) ordered.set(name, facts.get(name));
  }
  for (const name of facts.keys()) {
    if (!ordered.has(name)) throw new BuiltinRefusalFactNotDeclaredError({ address: tag, fact: makeKeyword(name) });
  }
  return ordered;
}

export function errorFromQlang(qlangError, subject, scope) {
  const tag = makeTag(qlangError.address);
  const facts = new Map(Object.entries(qlangError.facts).filter(([, value]) => value !== undefined));
  if (facts.has('actualValue')) facts.set('actualTag', tagOf(facts.get('actualValue')));
  if (qlangError.refusesTheSubject === true && subject !== undefined) facts.delete('actualValue');
  return makeErrorValue(tag, factsInOrder(tag, facts, scope), { originalError: qlangError });
}

// [QSSYN#refusal], [QSPRN#span]
export function errorFromParse(parseError, scope, location, uri = parseError.uri) {
  const d = new Map();
  if (parseError.source != null && parseError.location) d.set('source', parseError.source.split('\n')[parseError.location.start.line - 1]);
  if (parseError.sentence) d.set('message', parseError.sentence);
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  else d.set('message', parseError.message);
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (location !== undefined) d.set('location', location);
  if (uri) d.set('origin', makeKeyword(uri));
  const tag = makeTag('quote/ParseError');
  return makeErrorValue(tag, factsInOrder(tag, d, scope), { originalError: parseError });
}

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
  return alt.type === 'literal' ? alt.text : makeKeyword(nameOfContinuation(alt));
}

const CAUSES_RECOUNTED = 8;

// [QSERR#site]
export function errorFromForeign(jsError, scope) {
  const tag = makeTag('call/HostFailureError');
  const facts = new Map([['message', accountOf(jsError)]]);
  const causes = [];
  for (let cause = jsError?.cause; cause != null && causes.length < CAUSES_RECOUNTED; cause = cause?.cause) {
    causes.push(accountOf(cause));
  }
  if (causes.length > 0) facts.set('causes', Object.freeze(causes));
  return makeErrorValue(tag, factsInOrder(tag, facts, scope), { originalError: jsError });
}

function accountOf(thrown) {
  return thrown instanceof Error ? thrown.message : String(thrown);
}
