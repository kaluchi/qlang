import { makeKeyword, makeErrorValue, makeTag, tagOf } from './types.mjs';
import { declareDefect, recordRefusal } from './errors.mjs';
import { kindOfAValueOf } from './nouns.mjs';
import { chainOfKind } from './chain.mjs';
import { nameOfContinuation } from './parse.mjs';
import { printValue } from './print-value.mjs';
import { lengthOf, ROOM_OF_A_FACT } from './rooms.mjs';

// [QSERR#site]
recordRefusal('quote/ParseError');
recordRefusal('call/HostFailureError');

const BuiltinRefusalFactNotDeclaredError = declareDefect('builtin/RefusalFactNotDeclaredError',
  ({ address, fact }) => `${address.literal} carries ${fact.literal}, which the kind of its refusal does not wire`);

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
  const kind = kindOfAValueOf(scope, tag.name);
  if (kind === null) return facts;
  const ordered = new Map();
  for (const name of chainOfKind(kind).wired.keys()) if (facts.has(name)) ordered.set(name, facts.get(name));
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
  if (parseError.source != null && location !== undefined) {
    const { source, marker } = markedLineOf(parseError.source.split('\n')[location[1] - 1], location);
    d.set('source', source);
    d.set('marker', marker);
  }
  if (parseError.sentence) d.set('message', parseError.sentence);
  if (parseError.expected) d.set('expected', liftExpectedAlternatives(parseError.expected));
  else d.set('message', parseError.message);
  if (parseError.found !== undefined && parseError.found !== null) d.set('found', parseError.found);
  if (location !== undefined) d.set('location', location);
  if (uri) d.set('origin', makeKeyword(uri));
  const tag = makeTag('quote/ParseError');
  return makeErrorValue(tag, factsInOrder(tag, d, scope), { originalError: parseError });
}

// [QSSYN#refusal]
const MARKED_LINE_WITHIN = ROOM_OF_A_FACT - 3;

function markedLineOf(line, [, startLine, startColumn, , endLine, endColumn]) {
  const characters = Array.from(line);
  const reached = [0];
  for (const character of characters) reached.push(reached[reached.length - 1] + lengthOf(printValue(character)) - 2);
  const at = startColumn - 1;
  const end = endLine === startLine ? endColumn - 1 : characters.length;
  const [from, to] = windowAround(reached, at);
  const before = from > 0 ? '…' : '';
  const after = to < characters.length ? '…' : '';
  const lead = before.length + reached[at] - reached[from];
  const reach = Math.max(1, reached[Math.min(end, to)] - reached[at]);
  const width = before.length + reached[to] - reached[from] + after.length;
  return {
    source: `${before}${characters.slice(from, to).join('')}${after}`,
    marker: `${' '.repeat(lead)}^${'~'.repeat(reach - 1)}${' '.repeat(Math.max(0, width - lead - reach))}`
  };
}

function windowAround(reached, at) {
  const length = reached.length - 1;
  const widthOf = (from, to) => reached[to] - reached[from] + (from > 0 ? 1 : 0) + (to < length ? 1 : 0);
  let from = at;
  let to = at;
  while (from > 0 && reached[at] - reached[from - 1] <= MARKED_LINE_WITHIN / 2) from -= 1;
  while (to < length && widthOf(from, to + 1) <= MARKED_LINE_WITHIN) to += 1;
  while (from > 0 && widthOf(from - 1, to) <= MARKED_LINE_WITHIN) from -= 1;
  return [from, to];
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
