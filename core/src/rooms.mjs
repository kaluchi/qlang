// [QSERR#alert], [QSPRN#budget], [QSPRN#excerpt]

import { makeErrorValue, makeExcerpt, isMap, isVec, isValueClass, wiringOf, tagOf, canonicalKeywordLiteral } from './types.mjs';
import { printValue } from './print-value.mjs';

// [QSPRN#budget]
export const ANSWER_BUDGET = 16000;

// [QSERR#alert]
export const ROOM_OF_A_FACT = 300;
export const ROOM_OF_AN_ALERT = 2000;

// [QSTXT#string]
export const lengthOf = text => Array.from(text).length;

export const sizeOf = (value, printedOf) => lengthOf(printValue(value, 0, printedOf));

// [QSPRN#excerpt]
const isEmpty = value => (isMap(value) ? value.size === 0 : (isVec(value) || typeof value === 'string') && value.length === 0);

const isOpenTag = value => isValueClass(value, 'underTag') && wiringOf(value) === undefined;

function keyedPartsOf(value) {
  if (isMap(value)) return [...value];
  return isValueClass(value, 'underTag') && isMap(value.payload) ? [...value.payload] : [];
}

const PAYLOAD_NAME = 'payload';

const placeOf = (name, value) => ({ name, value, entries: [], parts: [] });

// [QSERR#alert], [QSPRN#excerpt]
export async function alertOf(error, { keep, viewsOf }, printedOf) {
  const facts = [...error.facts].map(([name, value]) => placeOf(name, value));
  const waiting = [...facts];
  let room = ROOM_OF_AN_ALERT;
  let rank = 0;
  while (waiting.length > 0 && room > 0) {
    const place = waiting.shift();
    const show = (name, value, size = sizeOf(value, printedOf)) => {
      place.entries.push({ name, value, rank: rank++ });
      room -= lengthOf(canonicalKeywordLiteral(name)) + size + 4;
    };
    const size = sizeOf(place.value, printedOf);
    if (size <= ROOM_OF_A_FACT) {
      show(place.name, place.value, size);
      continue;
    }
    if (keep !== null) show(place.name, await keep(place.value));
    for (const [view, answered] of await viewsOf(place.value)) {
      if (!isEmpty(answered) && sizeOf(answered, printedOf) <= ROOM_OF_A_FACT) show(`${place.name}/${view}`, answered);
    }
    let beneath = place.value;
    let under = place.name;
    while (isOpenTag(beneath)) {
      under = `${under}/${PAYLOAD_NAME}`;
      show(`${under}/tag`, tagOf(beneath.payload));
      beneath = beneath.payload;
    }
    for (const [key, part] of keyedPartsOf(beneath)) {
      const inner = placeOf(`${place.name}/${key}`, part);
      place.parts.push(inner);
      waiting.push(inner);
    }
  }
  const laid = [];
  const layOut = place => {
    laid.push(...place.entries);
    place.parts.forEach(layOut);
  };
  facts.forEach(layOut);
  const whole = laid.length === error.facts.size && laid.every(({ name, value }) => value === error.facts.get(name));
  const alertOver = shown => {
    const entries = shown.map(({ name, value }) => [name, value]);
    return makeErrorValue(error.tag, new Map(entries), { told: whole && shown.length === laid.length ? null : makeExcerpt(entries) });
  };
  let shown = laid;
  while (shown.length > 0 && sizeOf(alertOver(shown), printedOf) > ROOM_OF_AN_ALERT) {
    const last = Math.max(...shown.map(entry => entry.rank));
    shown = shown.filter(entry => entry.rank !== last);
  }
  return alertOver(shown);
}
