// [QSPRN#excerpt], [QSERR#alert], [QSPRN#budget]

import { makeErrorValue, makeExcerpt, makeQuote, partsOfFrame } from './types.mjs';
import { printValue, docText } from './print-value.mjs';

// [QSPRN#budget]
export const ANSWER_BUDGET = 16000;

// [QSERR#alert]
export const ROOM_OF_A_FACT = 300;
export const ROOM_OF_AN_ALERT = 2000;

// [QSTXT#string]
export const lengthOf = text => Array.from(text).length;

const printedByNoKind = () => undefined;

export const sizeOf = (value, printedOf = printedByNoKind) => lengthOf(printValue(value, 0, printedOf));

// [QSPRN#excerpt]
const countWhereLeftOut = (count, shown) => (shown < count ? [['count', count]] : []);

const LINE_BREAK = /\s*\n\s*/g;

const isSpace = character => character === ' ' || character === '\n' || character === '\t';

function endsAtWords(characters, kept) {
  const head = characters.slice(0, kept);
  const tail = characters.slice(characters.length - kept);
  const headCut = isSpace(characters[kept]) ? kept : head.findLastIndex(isSpace);
  const tailCut = isSpace(characters[characters.length - kept - 1]) ? 0 : tail.findIndex(isSpace) + 1;
  return [
    head.slice(0, headCut > kept / 2 ? headCut : kept).join('').trimEnd(),
    tail.slice(tailCut < kept / 2 ? tailCut : 0).join('').trimStart()
  ];
}

function endsWithin(characters, excerptOf, room, printedOf) {
  const endsOf = kept => [characters.slice(0, kept).join(''), characters.slice(characters.length - kept).join('')];
  let low = 0;
  let high = Math.floor((characters.length - 1) / 2);
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (sizeOf(excerptOf(...endsOf(middle)), printedOf) <= room) low = middle;
    else high = middle - 1;
  }
  return endsAtWords(characters, low);
}

function excerptOfCharacters(characters, facts, room, printedOf) {
  const excerptOf = (head, tail) => makeExcerpt([...facts, ['head', head], ['tail', tail]]);
  return excerptOf(...endsWithin(characters, excerptOf, room, printedOf));
}

const onOneLine = text => text.replace(LINE_BREAK, ' ');

const printedOnALine = (value, printedOf) => Array.from(onOneLine(printValue(value, 0, printedOf, true)));

const mostThatHolds = (low, high, holds) => {
  let most = low;
  let above = high;
  while (most < above) {
    const middle = (most + above + 1) >> 1;
    if (holds(middle)) most = middle;
    else above = middle - 1;
  }
  return most;
};

function takenFromTheEnds(parts, shownOf, room, printedOf) {
  const fits = (heads, tails) => sizeOf(shownOf(parts.slice(0, heads), parts.slice(parts.length - tails)), printedOf) <= room;
  const turns = mostThatHolds(0, parts.length, taken => fits(Math.ceil(taken / 2), Math.floor(taken / 2)));
  let heads = Math.ceil(turns / 2);
  let tails = Math.floor(turns / 2);
  if (turns % 2 === 0) tails = mostThatHolds(tails, parts.length - heads, taken => fits(heads, taken));
  else heads = mostThatHolds(heads, parts.length - tails, taken => fits(taken, tails));
  return { head: parts.slice(0, heads), tail: parts.slice(parts.length - tails) };
}

function excerptOfParts(value, parts, keptOf, room, printedOf) {
  const shownOf = (head, tail) => makeExcerpt([
    ...countWhereLeftOut(parts.length, head.length + tail.length),
    ...(head.length > 0 ? [['first', keptOf(head)]] : []),
    ...(tail.length > 0 ? [['last', keptOf(tail)]] : [])
  ]);
  const whole = makeExcerpt([['first', keptOf(parts)]]);
  if (sizeOf(whole, printedOf) <= room) return whole;
  const { head, tail } = takenFromTheEnds(parts, shownOf, room, printedOf);
  if (head.length > 0 && tail.length > 0) return shownOf(head, tail);
  return excerptOfCharacters(printedOnALine(value, printedOf), [['count', parts.length]], room, printedOf);
}

export const excerptOfElements = (elements, room, printedOf = printedByNoKind) => excerptOfParts(elements, [...elements], shown => Object.freeze([...shown]), room, printedOf);

export const excerptOfEntries = (map, room, printedOf = printedByNoKind) => excerptOfParts(map, [...map], shown => new Map(shown), room, printedOf);

export const excerptOfSteps = (quote, room, printedOf = printedByNoKind) => excerptOfParts(quote, [...quote], makeQuote, room, printedOf);

export function excerptOfText(text, room, printedOf = printedByNoKind) {
  const whole = makeExcerpt([['head', text]]);
  if (sizeOf(whole, printedOf) <= room) return whole;
  const characters = Array.from(text);
  return excerptOfCharacters(characters, [['characters', characters.length]], room, printedOf);
}

export function excerptOfProse(doc, room, printedOf = printedByNoKind) {
  const text = docText(doc);
  const prose = onOneLine(text);
  const whole = makeExcerpt([['head', prose]]);
  if (sizeOf(whole, printedOf) <= room) return whole;
  return excerptOfCharacters(Array.from(prose), [['characters', lengthOf(text)]], room, printedOf);
}

export const excerptOfPrint = (value, room, printedOf = printedByNoKind) => excerptOfText(printedOnALine(value, printedOf).join(''), room, printedOf);

export function excerptOfFrames(trace, room, printedOf = printedByNoKind) {
  const frames = trace.map(partsOfFrame);
  const failed = frames.map(({ unfinished }) => makeQuote([unfinished[0]]));
  const excerptOf = (taken, subject) => {
    const paths = frames.slice(0, taken).map(({ path }) => path).filter(path => path !== undefined && path !== null);
    return makeExcerpt([
      ...countWhereLeftOut(trace.length, taken), ['failed', Object.freeze(failed.slice(0, taken))],
      ...(paths.length > 0 ? [['paths', Object.freeze(paths)]] : []), ...(subject === undefined ? [] : [['subject', subject]])
    ]);
  };
  const stepsWithin = (within, subject) => {
    let taken = 0;
    while (taken < failed.length && sizeOf(excerptOf(taken + 1, subject), printedOf) <= within) taken++;
    return taken;
  };
  if (frames.length === 0) return excerptOf(0);
  const { subject } = frames[0];
  const besideTheWhole = stepsWithin(room, subject);
  if (besideTheWhole > 0) return excerptOf(besideTheWhole, subject);
  const taken = Math.max(stepsWithin(Math.floor(room / 2)), Math.min(1, stepsWithin(room)));
  const characters = printedOnALine(subject, printedOf);
  const [head, tail] = endsWithin(characters, (head, tail) => excerptOf(taken, `${head} … ${tail}`), room, printedOf);
  return head === '' ? excerptOf(taken) : excerptOf(taken, `${head} … ${tail}`);
}

// [QSERR#alert]
export async function alertOf(error, excerptOf, printedOf = printedByNoKind) {
  const facts = new Map();
  for (const [name, fact] of error.facts) facts.set(name, sizeOf(fact, printedOf) <= ROOM_OF_A_FACT ? fact : await excerptOf(fact));
  const alertOver = shown => {
    const whole = shown.size === error.facts.size && [...shown].every(([name, fact]) => fact === error.facts.get(name));
    return makeErrorValue(error.tag, shown, { told: whole ? null : makeExcerpt(shown) });
  };
  let alert = alertOver(facts);
  while (facts.size > 0 && sizeOf(alert, printedOf) > ROOM_OF_AN_ALERT) {
    facts.delete([...facts.keys()].at(-1));
    alert = alertOver(facts);
  }
  return alert;
}
