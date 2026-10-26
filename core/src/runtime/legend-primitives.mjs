// [QSPRN#legend]

import { registerStateReader } from '../primitives.mjs';
import { printValue, underTagLiteral, LINE_WIDTH } from '../print-value.mjs';
import { kindOfAValueOf, kindsOfWalk, nodeOf, probesOfASlot, slotsOfAVerdict } from '../nouns.mjs';
import { chainOfKind, chainOfFn, functionOfRecipe, PAYLOAD_NAME } from '../chain.mjs';
import { isMap, isVec, isDoc, isQuote, isTag, isFn, isExcerpt, isCell, wiringOf, tagOf, beneathTags, payloadBeneath, bindingValueOf, canonicalKeywordLiteral, TAG_HEADER_SYMBOL, ERROR_TAG, EXCERPT_TAG, LEGEND_TAG } from '../types.mjs';
import { declaringRecordOf, pageOfRecord } from './axis.mjs';
import { printsOfKinds, verbOfAView } from './print.mjs';
import { FIRST_VIEW } from '../rooms.mjs';
import { ANY_KIND_NAME } from '../address.mjs';

const ALIGNED_WITHIN = LINE_WIDTH / 2;
const LEAST_COLUMN = 16;

function legendOf(value, scope, printedOfParts, head) {
  const ofTheHead = glossOf(pageOf(scope, value), scope);
  if (isTag(value)) return legendOfAKind(value, ofTheHead, scope, head);
  const kind = kindOfAValueOf(scope, tagOf(value).name);
  const wiring = wiringOf(value);
  const fields = kind === null || wiring === undefined ? [] : chainOfKind(kind).fields;
  const laid = fields.length > 0 ? payloadLaidOut(value) : null;
  const atPlaces = new Map(laid === null ? [] : fields.filter(({ place }) => place?.path.segments.length === 1).map(field => [field.place.path.segments[0], field]));
  const printedOf = part => (part === value ? undefined : printedOfParts(part));
  if (atPlaces.size === 0) return aligned([[head + printValue(value, 0, printedOf, true), ofTheHead]]);
  const lines = [[head + laid.open, ofTheHead]];
  const parts = new Map(laid.parts.map(([key, part]) => [String(key), part]));
  for (const [key, part] of laid.parts) {
    const field = atPlaces.get(String(key));
    const printed = printValue(part, 1, printedOf, true);
    const said = field !== undefined ? (laid.keyed ? glossOf(field.page, scope) : joined(glossOf(field.page, scope), field.name.name))
      : glossOfAKeyBeneath(String(key), parts, kind, atPlaces, scope);
    lines.push([`  ${laid.keyed ? `${canonicalKeywordLiteral(key)} ${printed}` : printed}`, said]);
  }
  lines.push([laid.close, null]);
  return aligned(lines);
}

// [QSPRN#legend]
function legendOfAKind(tag, ofTheHead, scope, written) {
  const kind = kindOfAValueOf(scope, tag.name);
  const { fields, reveals } = kind === null ? { fields: [], reveals: [] } : chainOfKind(kind);
  const head = aligned([[written + printValue(tag), ofTheHead]]);
  const views = reveals.map(name => viewOfAKind(scope, tag.name, name));
  return [head, ...fields.map(field => closed(joined(partOfAKind(field), glossOf(field.page, scope)))), ...views].join('\n');
}

// [QSPRN#legend], [QSPRN#excerpt]
const viewOfAKind = (scope, kindName, name) => closed(saidOfAView(scope, kindName, name));

function saidOfAView(scope, kindName, name) {
  const record = verbOfAView(scope, kindName, name);
  if (record === null) return name;
  const verb = bindingValueOf(record);
  const answer = chainOfFn(isFn(verb) ? verb : functionOfRecipe(verb)).answer;
  return joined(answer === null ? name : `${name} ${printValue(answer.written)}`, glossOf(answer?.page ?? pageOfRecord(record), scope));
}

// [QSPRN#legend], [QSERR#site]
function glossOfAKeyBeneath(key, parts, kind, atPlaces, scope) {
  const segments = key.split('/');
  if (!atPlaces.has(segments[0]) || segments.length === 1) return null;
  for (let cut = segments.length - 1; cut >= 1; cut--) {
    const kindNames = kindsShownAt(segments.slice(0, cut).join('/'), parts);
    if (kindNames !== null) return glossOfTheRest(segments.slice(cut), kindNames, scope);
  }
  return glossOfTheRest(segments, [], scope, kind);
}

// [QSPRN#legend]
function kindsShownAt(above, parts) {
  let beneath = null;
  for (let at = `${above}/${PAYLOAD_NAME}`; parts.has(`${at}/${FIRST_VIEW}`); at = `${at}/${PAYLOAD_NAME}`) beneath = parts.get(`${at}/${FIRST_VIEW}`);
  if (isTag(beneath)) return [beneath.name];
  const tagShown = parts.get(`${above}/${FIRST_VIEW}`);
  if (isTag(tagShown)) return [tagShown.name];
  return parts.has(above) && !isCell(parts.get(above)) ? [...kindsOfWalk(parts.get(above))] : null;
}

function glossOfTheRest(rest, kindNames, scope, ownKind = null) {
  const kind = ownKind ?? kindNames.map(kindName => kindOfAValueOf(scope, kindName)).find(found => found !== null) ?? null;
  const field = kind === null ? undefined : chainOfKind(kind).fields.find(({ name }) => name.name === rest[0]);
  if (field !== undefined && rest.length === 2 && slotsOfAVerdict(kind)?.has(rest[0])) {
    const probes = new Map(probesOfASlot(scope).map(({ name: probeName, page }) => [probeName.name, page]));
    return joined(glossOf(field.page, scope), glossOf(probes.get(rest[1]), scope));
  }
  if (field !== undefined && rest.length === 1) return glossOf(field.page, scope);
  if (rest.length !== 1) return null;
  const kindName = kindNames.find(name => nodeOf(scope, `${name}/${rest[0]}`) !== null);
  return kindName === undefined && verbOfAView(scope, ANY_KIND_NAME, rest[0]) === null ? null : saidOfAView(scope, kindName ?? ANY_KIND_NAME, rest[0]);
}

const readsItsOwnKey = (name, place) => place.path.segments.length === 1 && place.path.segments[0] === name.name;

const partOfAKind = ({ name, place, written }) => [name.name, place === null || readsItsOwnKey(name, place) ? null : printValue(place.path), written === null ? null : printValue(written)].filter(piece => piece !== null).join(' ');

function payloadLaidOut(value) {
  const { literal } = value[TAG_HEADER_SYMBOL];
  if (isMap(value)) return { open: `${literal}{`, close: '}', parts: [...value], keyed: true };
  if (isVec(value)) return { open: `${literal}[`, close: ']', parts: [...value.entries()], keyed: false };
  const beneath = value.payload;
  if (beneath?.[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name) return { open: `${literal}!{`, close: '}', parts: [...beneath], keyed: true };
  return isExcerpt(beneath) ? { open: `${literal}${EXCERPT_TAG.literal}{`, close: '}', parts: [...beneath], keyed: true } : null;
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
  return legendOf(told, state.scope, await printsOfKinds(told, state.scope, state), underTagLiteral(LEGEND_TAG.literal, told, ''));
});
