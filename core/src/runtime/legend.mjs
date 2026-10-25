// [D326]

import { registerStateReader } from '../primitives.mjs';
import { printValue, LINE_WIDTH } from '../print-value.mjs';
import { kindOfAValueOf } from '../nouns.mjs';
import { chainOfKind } from '../chain.mjs';
import { isValueClass, isMap, isVec, isDoc, isQuote, isTag, wiringOf, tagOf, beneathTags, canonicalKeywordLiteral, TAG_HEADER_SYMBOL, ERROR_TAG } from '../types.mjs';
import { declaringRecordOf, pageOfRecord } from './axis.mjs';
import { printsOfKinds } from './print.mjs';

const COMMENT = '|~| ';
const ALIGNED_WITHIN = LINE_WIDTH / 2;

function legendOf(value, scope, printedOf) {
  const glossOfTheHead = glossOf(pageOf(scope, value), scope);
  const ofTheHead = glossOfTheHead === null ? null : joined(glossOfTheHead, 'doc');
  const kind = kindOfAValueOf(scope, tagOf(value).name);
  const wiring = wiringOf(value);
  const fields = kind === null || wiring === undefined ? [] : chainOfKind(kind).fields;
  const laid = fields.length > 0 && printedOf(value) === undefined ? payloadLaidOut(value) : null;
  const atPlaces = new Map(laid === null ? [] : fields.filter(({ place }) => place?.path.segments.length === 1).map(field => [field.place.path.segments[0], field]));
  if (atPlaces.size === 0) return linesOf([[printValue(value, 0, printedOf, true), ofTheHead]], fields, wiring, new Set(), scope, printedOf);
  const told = new Set();
  const lines = [[laid.open, ofTheHead]];
  for (const [key, part] of laid.parts) {
    const field = atPlaces.get(String(key));
    if (field !== undefined) told.add(field.name.name);
    const printed = printValue(part, 1, printedOf, true);
    lines.push([`  ${laid.keyed ? `${canonicalKeywordLiteral(key)} ${printed}` : printed}`, field === undefined ? null : joined(glossOf(field.page, scope), stepTo(field.name.name, part))]);
  }
  lines.push([laid.close, null]);
  return linesOf(lines, fields, wiring, told, scope, printedOf);
}

function payloadLaidOut(value) {
  const { literal } = value[TAG_HEADER_SYMBOL];
  if (isMap(value)) return { open: `${literal}{`, close: '}', parts: [...value], keyed: true };
  if (isVec(value)) return { open: `${literal}[`, close: ']', parts: [...value.entries()], keyed: false };
  const atRest = isValueClass(value, 'underTag') && value.payload[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name;
  return atRest ? { open: `${literal}!{`, close: '}', parts: [...value.payload], keyed: true } : null;
}

function linesOf(lines, fields, wiring, told, scope, printedOf) {
  for (const field of fields) {
    const part = wiring.get(field.name.name);
    if (told.has(field.name.name) || part === null) continue;
    const step = wiringOf(part) === undefined ? null : stepTo(field.name.name, part);
    lines.push([null, joined(`${field.name.name} ${printValue(part, 0, printedOf, true)}`, glossOf(field.page, scope), step)]);
  }
  const column = Math.max(...lines.map(([code]) => code?.length ?? 0).filter(length => length <= ALIGNED_WITHIN)) + 2;
  return lines.map(([code, comment]) => (code === null ? COMMENT + comment : comment === null ? code : `${code.padEnd(Math.max(column, code.length + 2))}${COMMENT}${comment}`)).join('\n');
}

const joined = (...said) => said.filter(piece => piece !== null).join(' · ');
const stepTo = (name, part) => (wiringOf(part) === undefined ? name : `${name} | legend`);
const pageOf = (scope, subject) => {
  const record = declaringRecordOf(scope, subject);
  return record === null ? null : pageOfRecord(record);
};

// [D326], [QSSLF#doc]
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

registerStateReader('any/legend', async (subject, state) => legendOf(subject, state.scope, await printsOfKinds(subject, state.scope, state)));
