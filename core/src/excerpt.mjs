// [QSPRN#excerpt], [QSERR#alert], [QSPRN#budget]

import { isMap, isVec, beneathTags, tagOf, makeErrorValue, makeExcerpt } from './types.mjs';
import { printValue } from './print-value.mjs';

// [QSPRN#budget]
export const ANSWER_BUDGET = 16000;

// [QSERR#alert]
export const ROOM_OF_A_FACT = 300;
export const ROOM_OF_AN_ALERT = 2000;

// [QSTXT#string]
export const lengthOf = text => Array.from(text).length;

const printedByNoKind = () => undefined;

export const sizeOf = (value, printedOf = printedByNoKind) => lengthOf(printValue(value, 0, printedOf));

// The parts an excerpt may show, the entries of a map and the elements of a
// vector under their indices, or null where it tells a value by the text of
// its print.
function partsOf(value, printedOf) {
  if (typeof value === 'string' || printedOf(value) !== undefined) return null;
  const beneath = beneathTags(value);
  if (isMap(beneath)) return [...beneath];
  return isVec(beneath) ? beneath.map((part, index) => [String(index), part]) : null;
}

const textOf = (value, printedOf) => (typeof value === 'string' ? value : printValue(value, 0, printedOf));

// [QSPRN#excerpt]
export function excerptWithin(value, room, printedOf = printedByNoKind) {
  const of = tagOf(value);
  const entries = partsOf(value, printedOf);
  if (entries === null) return excerptOfText(of, Array.from(textOf(value, printedOf)), room, printedOf);
  const fits = shown => sizeOf(makeExcerpt(of, entries.length, new Map(shown)), printedOf) <= room;
  const head = [];
  const tail = [];
  let low = 0;
  let high = entries.length - 1;
  let headOpen = true;
  let tailOpen = true;
  while ((headOpen || tailOpen) && low <= high) {
    if (headOpen) {
      head.push(entries[low]);
      if (fits([...head, ...tail])) low++;
      else {
        head.pop();
        headOpen = false;
      }
    }
    if (tailOpen && low <= high) {
      tail.unshift(entries[high]);
      if (fits([...head, ...tail])) high--;
      else {
        tail.shift();
        tailOpen = false;
      }
    }
  }
  return makeExcerpt(of, entries.length, new Map([...head, ...tail]));
}

// A text whole where it fits, and otherwise its first and its last
// characters, as many of each as the room holds, under their offsets.
function excerptOfText(of, characters, room, printedOf) {
  const excerptOf = shown => makeExcerpt(of, characters.length, shown);
  const whole = excerptOf(new Map([['0', characters.join('')]]));
  if (sizeOf(whole, printedOf) <= room) return whole;
  const ends = taken => excerptOf(new Map(taken === 0 ? [] : [['0', characters.slice(0, taken).join('')], [String(characters.length - taken), characters.slice(-taken).join('')]]));
  let low = 0;
  let high = Math.floor((characters.length - 1) / 2);
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (sizeOf(ends(middle), printedOf) <= room) low = middle;
    else high = middle - 1;
  }
  return ends(low);
}

// [QSERR#alert]
export function alertOf(error, printedOf = printedByNoKind) {
  const facts = new Map([...error.facts].map(([name, fact]) => [name, sizeOf(fact, printedOf) <= ROOM_OF_A_FACT ? fact : excerptWithin(fact, ROOM_OF_A_FACT, printedOf)]));
  let alert = makeErrorValue(error.tag, facts);
  while (facts.size > 0 && sizeOf(alert, printedOf) > ROOM_OF_AN_ALERT) {
    facts.delete([...facts.keys()].at(-1));
    alert = makeErrorValue(error.tag, facts);
  }
  return alert;
}
