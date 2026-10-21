// The view of a value within a budget [QSPRN#elide]: each way a part gives way, and
// the `:read` of every elision applied to the value taken answering the part
// left out.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { elide, alertOf, alertWithin } from '../../src/elide.mjs';
import { printValue } from '../../src/print-value.mjs';
import { isErrorValue, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { compareValues } from '../../src/ordering.mjs';

// Long enough that the elision standing for it prints shorter than it.
const LONG = 'a long line of text to leave out for sure, which runs on long enough that its elision prints shorter';
const readBack = async (value, elision) => evalQuery(`${printValue(value)} | apply ${printValue(elision.get('read'))}`);
const continued = (query, elision) => evalQuery(`${query} ${printValue(elision.get('read')).slice(2, -1)}`);

// The elisions a view holds, the facts of a failure among it.
function elisionsOf(value, found = []) {
  if (isErrorValue(value)) for (const fact of value.facts.values()) elisionsOf(fact, found);
  else if (value instanceof Map && value[TAG_HEADER_SYMBOL]?.name === 'elision') found.push(value);
  else if (value instanceof Map) for (const part of value.values()) elisionsOf(part, found);
  else if (Array.isArray(value)) for (const part of value) elisionsOf(part, found);
  else if (value !== null && typeof value === 'object' && 'payload' in value) elisionsOf(value.payload, found);
  return found;
}

// Every elision of the views of the alert of a query counts the elements, the
// entries or the characters its read, continued from the query beneath `!|`,
// answers, the query run once for them all.
async function sizesHold(query, budgets) {
  const failing = await evalQuery(query);
  const elisions = budgets.flatMap(budget => elisionsOf(alertWithin(failing, budget)));
  expect(elisions.length).toBeGreaterThan(0);
  const reads = elisions.map(elision => printValue(elision.get('read')).slice(2, -1).replace(/^!\| /, ''));
  const counts = await evalQuery(`${query} !| get [${reads.map(read => `~(${read} | count)`).join(' ')}]`);
  expect(elisions.map((elision, at) => [reads[at], elision.get('size')])).toEqual(reads.map((read, at) => [read, counts[at]]));
}

describe('elide', () => {
  it('[QSPRN#elide] keeps the first element of the top, the part within it giving way', async () => {
    const value = await evalQuery(`["${LONG.repeat(3)}" "${LONG.repeat(3)}"]`);
    const view = elide(value, 200);
    expect(view.length).toBe(2);
    expect(await readBack(value, view[0])).toBe(value[0]);
    expect(view[1].get('size')).toBe(1);
  });

  it('[QSPRN#elide] gives a map way whole', async () => {
    const value = await evalQuery('{:m {:a "some text here" :b "more text there"} :n 1}');
    const elision = elide(value, 40).get('m');
    expect(elision.get('size')).toBe(2);
    expect(compareValues(await readBack(value, elision), value.get('m')) === 0).toBe(true);
  });

  it('[QSPRN#elide] keeps the tag of a map it gives way within, and reads through a tag over an atom', async () => {
    const tagged = await evalQuery(`:Box |~~ Box. ~~| | ::Box{:s "${LONG}" :n 1}`);
    expect(elide(tagged, 50)[TAG_HEADER_SYMBOL].name).toBe('Box');
    const wrapped = await evalQuery(`{:b ::Box"${LONG}" :n 1}`);
    expect(await readBack(wrapped, elide(wrapped, 50).get('b'))).toEqual(await evalQuery(`::Box"${LONG}"`));
  });

  it('[QSPRN#elide] gives way within a vector under a tag and a map beneath a stack of tags', async () => {
    const vector = await evalQuery(`:Row |~~ Row. ~~| | ::Row["${LONG}" 1]`);
    const vectorView = elide(vector, 50);
    expect(vectorView[TAG_HEADER_SYMBOL].name).toBe('Row');
    expect(await readBack(vector, vectorView[0])).toBe(LONG);
    const stacked = await evalQuery(`::Outer::Inner{:s "${LONG}" :n 1}`);
    const stackedView = elide(stacked, 60);
    expect(stackedView.tag.name).toBe('Outer');
    expect(await readBack(stacked, stackedView.payload.get('s'))).toBe(LONG);
  });

  it('[QSPRN#elide] reads a key with a space by a quoted path', async () => {
    const value = await evalQuery(`{:"a key" "${LONG}"}`);
    const elision = elide(value, 30).get('a key');
    expect(await readBack(value, elision)).toBe(LONG);
  });

  it('[QSPRN#elide] gives the largest part way first, the others staying once the print fits', async () => {
    const value = await evalQuery(`{:a "${'a'.repeat(100)}" :b "${'b'.repeat(300)}" :c "${'c'.repeat(120)}"}`);
    const view = elide(value, 400);
    expect(view.get('b')[TAG_HEADER_SYMBOL].name).toBe('elision');
    expect([view.get('a'), view.get('c')]).toEqual([value.get('a'), value.get('c')]);
  });
});

describe('alertWithin', () => {
  it('[QSHST#answer] gives an alert past its budget way to a shorter print within the budget', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}] | add 1`);
    expect(printValue(alertOf(failing)).length).toBeGreaterThan(300);
    expect(printValue(alertWithin(failing, 300)).length).toBeLessThanOrEqual(300);
  });

  it('[QSHST#answer] gives way within the trace of a failure past its budget, the trace kept a trace and the rest of its frames read beneath !|', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(printValue(alertOf(failing)).length).toBeGreaterThan(190);
    const trace = alertWithin(failing, 190).facts.get('trace');
    expect(trace[TAG_HEADER_SYMBOL].name).toBe('trace');
    expect(printValue(trace[trace.length - 1])).toBe('::elision{:size 1 :read ~(!| get /trace | drop 1)}');
  });

  it('[QSHST#answer] cuts an alert past a budget fact by fact, the failure keeping its tag and the names of its facts', async () => {
    const skipped = Array.from({ length: 12 }, (_, index) => `add ${index}`).join(' | ');
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope) | ${skipped}`);
    const view = alertWithin(failing, 60);
    expect([...view.facts.keys()]).toEqual([...failing.facts.keys()]);
    expect(printValue(view.facts.get('trace').get('read'))).toBe('~(!| get /trace)');
    expect(view.facts.get('trace').get('size')).toBe(failing.facts.get('trace').length);
  });

  it('[QSHST#answer] keeps the facts of a failure whose first fact is named as the rest of a map is', async () => {
    const forty = Array.from({ length: 40 }, (_, index) => index).join(' ');
    const failing = await evalQuery(`!{:"…" 1 :b "${'a'.repeat(134)}" :c [${forty}]} | raise`);
    const view = alertWithin(failing, 60);
    expect([...view.facts.keys()]).toEqual([...failing.facts.keys()]);
    expect([view.facts.get('…'), view.facts.get('b').get('size'), view.facts.get('c').get('size')]).toEqual([1, 134, 40]);
  });

  it('[QSHST#answer] counts what each read answers where the views of an alert cut a part again', async () => {
    await sizesHold(':number/inf ~(add 1 | inf) | 0 | inf', [150, 250, 2000]);
    await sizesHold(':vec/inf ~(append 1 | inf) | [] | inf', [2000]);
    await sizesHold('1000 | range | add 1', [150]);
    await sizesHold('40 | range | map ~(tag ::zeta) | toSet | add 1', [150]);
  });

  it('[QSHST#answer] keeps the first frames of a trace past the budget within an excerpt, each with its steps, and the rest read beneath !|', async () => {
    const failing = await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf');
    const trace = alertWithin(failing, 2000).facts.get('trace');
    const rest = trace[trace.length - 1];
    expect(trace[TAG_HEADER_SYMBOL].name).toBe('trace');
    expect(printValue(trace[0][1])).toBe('~(add 1 | inf)');
    expect(printValue(rest.get('read'))).toBe(`~(!| get /trace | drop ${trace.length - 1})`);
    expect(rest.get('size')).toBe(failing.facts.get('trace').length - (trace.length - 1));
    expect(printValue(trace).length).toBeLessThanOrEqual(300);
  });

  it('[QSHST#answer] cuts an alert that holds no trace past a budget, the refusal of a text among them', async () => {
    const refused = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}] x`);
    const view = alertWithin(refused, 80);
    expect(view.facts.has('trace')).toBe(false);
    expect([...view.facts.keys()]).toEqual([...refused.facts.keys()]);
    expect(view.facts.get('source').get('size')).toBe(refused.facts.get('source').length);
  });

  it('[QSHST#answer] keeps every frame of an alert within its budget', async () => {
    const failing = await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf');
    expect(alertWithin(failing, 100000).facts.get('trace').length).toBe(failing.facts.get('trace').length);
  });

  it('[QSHST#answer] answers an alert that fits its budget as the alert itself', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}] | filter ~(nope)`);
    expect(printValue(alertWithin(failing, 100000))).toBe(printValue(alertOf(failing)));
  });
});

// A failure a host prints is an alert [QSHST#answer]: the subject of the frame where
// the failure arose within an excerpt, a subject it only passed given way whole,
// an error at rest among its facts a value cut within its excerpt, a value
// shown once, and the read of every elision continuing the query beneath `!|`.
describe('alertOf', () => {
  const records = `[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}]`;

  it('[QSHST#answer] keeps the subject where the failure arose and gives a vector it passed way whole', async () => {
    const query = `${records} | filter ~(nope)`;
    const [arose, passed] = alertOf(await evalQuery(query)).facts.get('trace');
    expect(printValue(arose[0])).toBe('{:n 0}');
    expect(passed[0].get('size')).toBe(30);
    expect(compareValues(await continued(query, passed[0]), await evalQuery(records)) === 0).toBe(true);
  });

  it('[QSHST#answer] counts a text it passed by its characters, through the tags over it', async () => {
    const query = `"${'a'.repeat(100)}" | tag ::Box | within ~(add 1)`;
    const passed = alertOf(await evalQuery(query)).facts.get('trace')[1][0];
    expect(passed.get('size')).toBe(100);
  });

  it('[QSHST#answer] gives a subject way whole where its cut still passes the excerpt, an atom counted by its print', async () => {
    const name = 'k'.repeat(400);
    const query = `:${name} | add 1`;
    const elision = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    expect([elision.get('size'), printValue(elision.get('read'))]).toEqual([name.length + 1, '~(!| get /trace/0/0)']);
    expect(await continued(query, elision)).toEqual(await evalQuery(`:${name}`));
  });

  it('[QSHST#answer] counts a vector it passed by its elements, through the tags over it', async () => {
    const query = '300 | range | tag ::B | tag ::A | map ~(add "x")';
    const passed = alertOf(await evalQuery(query)).facts.get('trace')[1][0];
    expect(passed.get('size')).toBe(300);
  });

  it('[QSHST#answer] cuts a vector where the failure arose to its first elements, the rest read beneath !|', async () => {
    const many = `[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const query = `${many} | add 1`;
    const subject = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    const rest = subject[subject.length - 1];
    expect(compareValues(await continued(query, rest), (await evalQuery(many)).slice(subject.length - 1)) === 0).toBe(true);
  });

  it('[QSHST#answer] keeps the first entries of a wide map where the failure arose, the rest under :"…" read beneath !|', async () => {
    const wide = `{${Array.from({ length: 200 }, (_, index) => `:k${index} ${index}`).join(' ')}}`;
    const query = `${wide} | add 1`;
    const subject = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    const kept = subject.size - 1;
    const rest = subject.get('…');
    expect(printValue(rest.get('read'))).toBe(`~(!| get /trace/0/0 | drop ${kept})`);
    expect(rest.get('size')).toBe(200 - kept);
    expect((await continued(query, rest)).size).toBe(200 - kept);
  });

  it('[QSHST#answer] cuts a long string where the failure arose to its head', async () => {
    const text = LONG.repeat(10);
    const query = `"${text}" | add 1`;
    const elision = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    expect(text.startsWith(elision.get('head'))).toBe(true);
    expect(await continued(query, elision)).toBe(text);
  });

  it('[QSHST#answer] gives a map and a string it passed way whole, and keeps what prints shorter than its elision', async () => {
    const [, map] = alertOf(await evalQuery(`{:s "${LONG}" :t "${LONG}"} | (add 1)`)).facts.get('trace');
    expect(map[0].get('size')).toBe(2);
    const text = LONG.repeat(3);
    const [, string] = alertOf(await evalQuery(`"${text}" | (add 1)`)).facts.get('trace');
    expect(string[0].get('size')).toBe(text.length);
    const [, kept] = alertOf(await evalQuery('5 | (add "x")')).facts.get('trace');
    expect(kept[0]).toBe(5);
  });

  it('[QSHST#answer] measures the subject of a frame on the one line the frame prints on', async () => {
    const six = '6 | range | map ~(get {:id ~(it) :name "user" :tags ["a" "b"]})';
    const [arose] = alertOf(await evalQuery(`${six} | get /9`)).facts.get('trace');
    expect(compareValues(arose[0], await evalQuery(six)) === 0).toBe(true);
    const nested = '[{:a {:b 1}} {:a {:b 2}} {:a {:b "x"}}]';
    const [, passed] = alertOf(await evalQuery(`${nested} | map ~(get /a/b | add 1)`)).facts.get('trace');
    expect(compareValues(passed[0], await evalQuery(nested)) === 0).toBe(true);
  });

  it('[QSHST#answer] cuts an error at rest among its facts within its excerpt, its parts read beneath the fact', async () => {
    const query = `${records} | map (get /n)`;
    const alert = alertOf(await evalQuery(query));
    const inner = alert.facts.get('actualValue');
    expect(isErrorValue(inner)).toBe(false);
    const subject = inner.payload.get('trace')[0][0];
    const rest = subject[subject.length - 1];
    expect(printValue(rest.get('read'))).toBe(`~(!| get /actualValue/trace/0/0 | drop ${subject.length - 1})`);
    expect((await continued(query, rest)).length).toBe(30 - (subject.length - 1));
  });
});
