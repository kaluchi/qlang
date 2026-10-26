// [QSERR#alert], [QSPRN#budget], [QSPRN#excerpt]

import { makeErrorValue, makeExcerpt, isMap, isVec } from './types.mjs';
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

// [QSERR#alert], [QSPRN#excerpt]
export async function alertOf(error, { keep, viewsOf }, printedOf) {
  const shown = [];
  for (const [name, fact] of error.facts) {
    if (sizeOf(fact, printedOf) <= ROOM_OF_A_FACT) {
      shown.push([name, fact]);
      continue;
    }
    if (keep !== null) shown.push([name, await keep(fact)]);
    for (const [view, value] of await viewsOf(fact)) {
      if (!isEmpty(value) && sizeOf(value, printedOf) <= ROOM_OF_A_FACT) shown.push([`${name}/${view}`, value]);
    }
  }
  const whole = shown.length === error.facts.size && shown.every(([name, fact]) => fact === error.facts.get(name));
  const alertOver = taken => makeErrorValue(error.tag, new Map(shown.slice(0, taken)), { told: whole && taken === shown.length ? null : makeExcerpt(shown.slice(0, taken)) });
  let taken = shown.length;
  while (taken > 0 && sizeOf(alertOver(taken), printedOf) > ROOM_OF_AN_ALERT) taken--;
  return alertOver(taken);
}
