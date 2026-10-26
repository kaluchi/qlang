// [QSPRN#legend]

import { registerStateReader } from '../primitives.mjs';
import { printValue, LINE_WIDTH } from '../print-value.mjs';
import { kindOfAValueOf, nodeOf } from '../nouns.mjs';
import { chainOfKind, chainOfFn, functionOfRecipe } from '../chain.mjs';
import { isValueClass, isMap, isVec, isDoc, isQuote, isTag, isFn, wiringOf, tagOf, beneathTags, payloadBeneath, bindingValueOf, canonicalKeywordLiteral, TAG_HEADER_SYMBOL, ERROR_TAG } from '../types.mjs';
import { declaringRecordOf, pageOfRecord } from './axis.mjs';
import { printsOfKinds } from './print.mjs';

const ALIGNED_WITHIN = LINE_WIDTH / 2;
const LEAST_COLUMN = 16;

function legendOf(value, scope, printedOf) {
  const ofTheHead = glossOf(pageOf(scope, value), scope);
  if (isTag(value)) return legendOfAKind(value, ofTheHead, scope);
  const kind = kindOfAValueOf(scope, tagOf(value).name);
  const wiring = wiringOf(value);
  const fields = kind === null || wiring === undefined ? [] : chainOfKind(kind).fields;
  const laid = fields.length > 0 && printedOf(value) === undefined ? payloadLaidOut(value) : null;
  const atPlaces = new Map(laid === null ? [] : fields.filter(({ place }) => place?.path.segments.length === 1).map(field => [field.place.path.segments[0], field]));
  if (atPlaces.size === 0) return aligned([[printValue(value, 0, printedOf, true), ofTheHead]]);
  const lines = [[laid.open, ofTheHead]];
  for (const [key, part] of laid.parts) {
    const field = atPlaces.get(String(key));
    const printed = printValue(part, 1, printedOf, true);
    const said = field === undefined ? null : laid.keyed ? glossOf(field.page, scope) : joined(glossOf(field.page, scope), field.name.name);
    lines.push([`  ${laid.keyed ? `${canonicalKeywordLiteral(key)} ${printed}` : printed}`, said]);
  }
  lines.push([laid.close, null]);
  return aligned(lines);
}

// [QSPRN#legend]
function legendOfAKind(tag, ofTheHead, scope) {
  const kind = kindOfAValueOf(scope, tag.name);
  const { fields, reveals } = kind === null ? { fields: [], reveals: [] } : chainOfKind(kind);
  const head = aligned([[printValue(tag), ofTheHead]]);
  const views = reveals.map(name => viewOfAKind(scope, `${tag.name}/${name}`, name));
  return [head, ...fields.map(field => closed(joined(partOfAKind(field), glossOf(field.page, scope)))), ...views].join('\n');
}

// [QSPRN#legend], [QSPRN#excerpt]
function viewOfAKind(scope, address, name) {
  const record = nodeOf(scope, address);
  if (record === null) return closed(name);
  const verb = bindingValueOf(record);
  const answer = chainOfFn(isFn(verb) ? verb : functionOfRecipe(verb)).answer;
  return closed(joined(answer === null ? name : `${name} ${printValue(answer.written)}`, glossOf(answer?.page ?? pageOfRecord(record), scope)));
}

const readsItsOwnKey = (name, place) => place.path.segments.length === 1 && place.path.segments[0] === name.name;

const partOfAKind = ({ name, place, written }) => [name.name, place === null || readsItsOwnKey(name, place) ? null : printValue(place.path), written === null ? null : printValue(written)].filter(piece => piece !== null).join(' ');

function payloadLaidOut(value) {
  const { literal } = value[TAG_HEADER_SYMBOL];
  if (isMap(value)) return { open: `${literal}{`, close: '}', parts: [...value], keyed: true };
  if (isVec(value)) return { open: `${literal}[`, close: ']', parts: [...value.entries()], keyed: false };
  const atRest = isValueClass(value, 'underTag') && value.payload[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name;
  return atRest ? { open: `${literal}!{`, close: '}', parts: [...value.payload], keyed: true } : null;
}

function aligned(lines) {
  const column = Math.max(LEAST_COLUMN, ...lines.map(([code]) => code.length).filter(length => length <= ALIGNED_WITHIN).map(length => length + 2));
  return lines.map(([code, comment]) => (comment === null ? code : `${code.padEnd(Math.max(column, code.length + 2))}${closed(comment)}`)).join('\n');
}

const closed = comment => `|~ ${comment} ~|`;

const joined = (...said) => said.filter(piece => piece !== null).join(' · ');
const pageOf = (scope, subject) => {
  const record = declaringRecordOf(scope, subject);
  return record === null ? null : pageOfRecord(record);
};

// [QSPRN#legend], [QSSLF#doc]
function glossOf(page, scope) {
  if (!isDoc(page)) return null;
  if (page.every(segment => typeof segment !== 'string' || segment.trim() === '')) return glossOf(pageLinkedFrom(page, scope), scope);
  let gloss = '';
  let quoted = false;
  for (const segment of page) {
    if (typeof segment !== 'string') {
      gloss += printValue(segment);
      continue;
    }
    for (let at = 0; at < segment.length; at++) {
      if (segment[at] === '`') quoted = !quoted;
      if (!quoted && endsAGloss(segment, at)) return oneLine(gloss + segment.slice(0, at));
    }
    gloss += segment;
  }
  return oneLine(gloss);
}

const endsAGloss = (text, at) => text[at] === ';' || ((text[at] === ':' || text[at] === '.') && (at + 1 === text.length || /\s/.test(text[at + 1])));
const oneLine = text => text.replace(/\s+/g, ' ').trim();

function pageLinkedFrom(page, scope) {
  const linked = beneathTags(page.find(segment => typeof segment !== 'string'));
  return isQuote(linked) && isTag(linked[0]) ? pageOf(scope, linked[0]) : null;
}

registerStateReader('legend/print', async (subject, state) => {
  const told = payloadBeneath(subject);
  return legendOf(told, state.scope, await printsOfKinds(told, state.scope, state));
});
