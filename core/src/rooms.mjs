// [QSERR#alert], [QSPRN#budget], [QSPRN#excerpt]

import { makeErrorValue, makeExcerpt, isMap, isVec, isValueClass, wiringOf, tagOf, canonicalKeywordLiteral } from './types.mjs';
import { printValue } from './print-value.mjs';
import { PAYLOAD_NAME } from './chain.mjs';

// [QSPRN#budget]
export const ANSWER_BUDGET = 16000;

// [QSERR#alert]
export const ROOM_OF_A_FACT = 300;
export const ROOM_OF_AN_ALERT = 2000;

// [QSTXT#string]
export const lengthOf = text => Array.from(text).length;

export const sizeOf = (value, printedOf) => lengthOf(printValue(value, 0, printedOf));

// [QSPRN#excerpt], [QSPRN#legend]
export const FIRST_VIEW = 'tag';

// [QSPRN#excerpt]
const isEmpty = value => (isMap(value) ? value.size === 0 : (isVec(value) || typeof value === 'string') && value.length === 0);

const isOpenTag = value => isValueClass(value, 'underTag') && wiringOf(value) === undefined;

function keyedPartsOf(value) {
  if (isMap(value)) return [...value];
  return isValueClass(value, 'underTag') && isMap(value.payload) ? [...value.payload] : [];
}

const factWaiting = (name, value) => ({ name, value, entries: [], parts: [] });

// [QSERR#alert], [QSPRN#excerpt]
export async function alertOf(error, { keep, viewsOf }, printedOf) {
  const facts = [...error.facts].map(([name, value]) => factWaiting(name, value));
  const waiting = [...facts];
  let room = ROOM_OF_AN_ALERT;
  let rank = 0;
  while (waiting.length > 0 && room > 0) {
    const fact = waiting.shift();
    const show = (name, value, size = sizeOf(value, printedOf)) => {
      fact.entries.push({ name, value, rank: rank++ });
      room -= lengthOf(canonicalKeywordLiteral(name)) + size + 4;
    };
    const size = sizeOf(fact.value, printedOf);
    if (size <= ROOM_OF_A_FACT) {
      show(fact.name, fact.value, size);
      continue;
    }
    if (keep !== null) show(fact.name, await keep(fact.value));
    for (const [view, answered] of await viewsOf(fact.value)) {
      if (!isEmpty(answered) && sizeOf(answered, printedOf) <= ROOM_OF_A_FACT) show(`${fact.name}/${view}`, answered);
    }
    let beneath = fact.value;
    let under = fact.name;
    while (isOpenTag(beneath)) {
      under = `${under}/${PAYLOAD_NAME}`;
      show(`${under}/${FIRST_VIEW}`, tagOf(beneath.payload));
      beneath = beneath.payload;
    }
    for (const [key, part] of keyedPartsOf(beneath)) {
      const inner = factWaiting(`${fact.name}/${key}`, part);
      fact.parts.push(inner);
      waiting.push(inner);
    }
  }
  const laid = [];
  const layOut = fact => {
    laid.push(...fact.entries);
    fact.parts.forEach(layOut);
  };
  facts.forEach(layOut);
  const whole = laid.length === error.facts.size && laid.every(({ name, value }) => value === error.facts.get(name));
  const alertOver = shown => {
    const entries = shown.map(({ name, value }) => [name, value]);
    return makeErrorValue(error.tag, new Map(entries), { told: whole && shown.length === laid.length ? null : makeExcerpt(entries) });
  };
  let shown = laid;
  for (const dropped of [...laid].sort((left, right) => right.rank - left.rank)) {
    if (sizeOf(alertOver(shown), printedOf) <= ROOM_OF_AN_ALERT) break;
    shown = shown.filter(entry => entry !== dropped);
  }
  return alertOver(shown);
}
