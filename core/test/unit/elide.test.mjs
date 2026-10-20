// The view of a value within a budget [QSPRN#elide]: each way a part gives way, and
// the `:read` of every elision applied to the value taken answering the part
// left out.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { elide, alertOf, elideAnswer } from '../../src/elide.mjs';
import { printValue } from '../../src/print-value.mjs';
import { isErrorValue, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { compareValues } from '../../src/ordering.mjs';

// Long enough that the elision standing for it prints shorter than it.
const LONG = 'a long line of text to leave out for sure, which runs on long enough that its elision prints shorter';
const readBack = async (value, elision) => evalQuery(`${printValue(value)} | apply ${printValue(elision.get('read'))}`);

describe('elide [QSPRN#elide]', () => {
  it('answers a value whose print fits as it is', () => {
    const value = [1, 2];
    expect(elide(value, 100)).toBe(value);
  });

  it('keeps the first half of a vector and gives the rest way to an elision, which its read answers', async () => {
    const forty = Array.from({ length: 40 }, (_, index) => index + 1);
    const view = elide(forty, 80);
    const trailing = view[view.length - 1];
    expect(trailing.get('size')).toBe(40 - (view.length - 1));
    expect(compareValues(await readBack(forty, trailing), forty.slice(view.length - 1)) === 0).toBe(true);
  });

  it('keeps the top as it is where its first element and an elision of the rest print no shorter', () => {
    const ten = Array.from({ length: 10 }, (_, index) => index + 1);
    expect(elide(ten, 15)).toBe(ten);
  });

  it('keeps the first element of the top, the part within it giving way', async () => {
    const value = await evalQuery(`["${LONG.repeat(3)}" "${LONG.repeat(3)}"]`);
    const view = elide(value, 200);
    expect(view.length).toBe(2);
    expect(await readBack(value, view[0])).toBe(value[0]);
    expect(view[1].get('size')).toBe(1);
  });

  it('gives a string way whole with its head', async () => {
    const value = await evalQuery(`{:s "${LONG}" :n 1}`);
    const elision = elide(value, 50).get('s');
    expect(elision.get('size')).toBe(LONG.length);
    expect(LONG.startsWith(elision.get('head'))).toBe(true);
    expect(await readBack(value, elision)).toBe(LONG);
  });

  it('gives a map way whole', async () => {
    const value = await evalQuery('{:m {:a "some text here" :b "more text there"} :n 1}');
    const elision = elide(value, 40).get('m');
    expect(elision.get('size')).toBe(2);
    expect(compareValues(await readBack(value, elision), value.get('m')) === 0).toBe(true);
  });

  it('keeps the tag of a map it gives way within, and reads through a tag over an atom', async () => {
    const tagged = await evalQuery(`:Box |~~ Box. ~~| | ::Box{:s "${LONG}" :n 1}`);
    expect(elide(tagged, 50)[TAG_HEADER_SYMBOL].name).toBe('Box');
    const wrapped = await evalQuery(`{:b ::Box"${LONG}" :n 1}`);
    expect(await readBack(wrapped, elide(wrapped, 50).get('b'))).toEqual(await evalQuery(`::Box"${LONG}"`));
  });

  it('gives way within a vector under a tag and a map beneath a stack of tags', async () => {
    const vector = await evalQuery(`:Row |~~ Row. ~~| | ::Row["${LONG}" 1]`);
    const vectorView = elide(vector, 50);
    expect(vectorView[TAG_HEADER_SYMBOL].name).toBe('Row');
    expect(await readBack(vector, vectorView[0])).toBe(LONG);
    const stacked = await evalQuery(`::Outer::Inner{:s "${LONG}" :n 1}`);
    const stackedView = elide(stacked, 60);
    expect(stackedView.tag.name).toBe('Outer');
    expect(await readBack(stacked, stackedView.payload.get('s'))).toBe(LONG);
  });

  it('reads a key with a space by a quoted path', async () => {
    const value = await evalQuery(`{:"a key" "${LONG}"}`);
    const elision = elide(value, 30).get('a key');
    expect(await readBack(value, elision)).toBe(LONG);
  });

  it('gives the largest part way first, the others staying once the print fits', async () => {
    const value = await evalQuery(`{:a "${'a'.repeat(100)}" :b "${'b'.repeat(300)}" :c "${'c'.repeat(120)}"}`);
    const view = elide(value, 400);
    expect(view.get('b')[TAG_HEADER_SYMBOL].name).toBe('elision');
    expect([view.get('a'), view.get('c')]).toEqual([value.get('a'), value.get('c')]);
  });

  it('keeps a part whose elision prints no shorter than it, so a budget never lengthens a print [QSPRN#elide]', async () => {
    const value = await evalQuery('[[] {:n 1} "short"]');
    expect(elide(value, 3)).toBe(value);
    const failing = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(printValue(elideAnswer(failing, 200)).length).toBeLessThanOrEqual(printValue(elideAnswer(failing)).length);
  });
});

describe('elideAnswer [QSPRN#elide]', () => {
  it('gives the facts of a raised error way beneath !|, its trace a trace [QSHST#answer]', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    const view = elideAnswer(failing, 300);
    expect(isErrorValue(view)).toBe(true);
    expect(view.tag).toBe(failing.tag);
    expect(printValue(view)).toContain(':read ~(!| get /trace/');
  });

  it('keeps the steps and the place of every frame within a budget, its subject alone giving way [QSHST#answer]', async () => {
    const skipped = Array.from({ length: 12 }, (_, index) => `add ${index}`).join(' | ');
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope) | ${skipped}`);
    const trace = elideAnswer(failing, 60).facts.get('trace');
    expect(trace.map(([, steps, place = null]) => [printValue(steps), place === null ? null : printValue(place)]))
      .toEqual([['~(nope)', null], [`~(filter ~(nope) | ${skipped})`, '/0']]);
    expect(trace.map(([subject]) => printValue(subject).startsWith('::elision{'))).toEqual([false, true]);
  });

  it('elides a value that is no error as elide does', () => {
    const forty = Array.from({ length: 40 }, (_, index) => index + 1);
    expect(elideAnswer(forty, 80)).toEqual(elide(forty, 80));
  });

  it('answers a value whole and an error as its alert when no budget is asked for [QSHST#answer]', async () => {
    const forty = Array.from({ length: 40 }, (_, index) => index + 1);
    expect(elideAnswer(forty)).toBe(forty);
    const failing = await evalQuery(`[${forty.join(' ')}] | filter ~(nope)`);
    expect(printValue(elideAnswer(failing))).toBe(printValue(alertOf(failing)));
  });
});

// A failure a host prints is an alert [QSHST#answer]: the subject of the frame where
// the failure arose within an excerpt, a subject it only passed given way whole,
// an error at rest among its facts a value cut within its excerpt, a value
// shown once, and the read of every elision continuing the query beneath `!|`.
describe('alertOf [QSHST#answer]', () => {
  const records = `[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
  const continued = (query, elision) => evalQuery(`${query} ${printValue(elision.get('read')).slice(2, -1)}`);

  it('keeps the subject where the failure arose and gives a vector it passed way whole', async () => {
    const query = `${records} | filter ~(nope)`;
    const [arose, passed] = alertOf(await evalQuery(query)).facts.get('trace');
    expect(printValue(arose[0])).toBe('{:n 0}');
    expect(passed[0].get('size')).toBe(30);
    expect(compareValues(await continued(query, passed[0]), await evalQuery(records)) === 0).toBe(true);
  });

  it('counts a text it passed by its characters, through the tags over it', async () => {
    const query = `"${'a'.repeat(100)}" | tag ::Box | within ~(add 1)`;
    const passed = alertOf(await evalQuery(query)).facts.get('trace')[1][0];
    expect(passed.get('size')).toBe(100);
  });

  it('cuts a vector where the failure arose to its first elements, the rest read beneath !|', async () => {
    const many = `[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const query = `${many} | add 1`;
    const subject = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    const rest = subject[subject.length - 1];
    expect(compareValues(await continued(query, rest), (await evalQuery(many)).slice(subject.length - 1)) === 0).toBe(true);
  });

  it('gives a wide map where the failure arose way whole, so the excerpt holds, its read answering the map', async () => {
    const wide = `{${Array.from({ length: 200 }, (_, index) => `:k${index} ${index}`).join(' ')}}`;
    const query = `${wide} | add 1`;
    const subject = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    expect(subject.get('size')).toBe(200);
    expect(printValue(subject.get('read'))).toBe('~(!| get /trace/0/0)');
    expect(compareValues(await continued(query, subject), await evalQuery(wide)) === 0).toBe(true);
  });

  it('cuts a long string where the failure arose to its head', async () => {
    const text = LONG.repeat(10);
    const query = `"${text}" | add 1`;
    const elision = alertOf(await evalQuery(query)).facts.get('trace')[0][0];
    expect(text.startsWith(elision.get('head'))).toBe(true);
    expect(await continued(query, elision)).toBe(text);
  });

  it('gives a map and a string it passed way whole, and keeps what prints shorter than its elision', async () => {
    const [, map] = alertOf(await evalQuery(`{:s "${LONG}" :t "${LONG}"} | (add 1)`)).facts.get('trace');
    expect(map[0].get('size')).toBe(2);
    const text = LONG.repeat(3);
    const [, string] = alertOf(await evalQuery(`"${text}" | (add 1)`)).facts.get('trace');
    expect(string[0].get('size')).toBe(text.length);
    const [, kept] = alertOf(await evalQuery('5 | (add "x")')).facts.get('trace');
    expect(kept[0]).toBe(5);
  });

  it('measures the subject of a frame on the one line the frame prints on', async () => {
    const six = '6 | range | map ~(get {:id ~(it) :name "user" :tags ["a" "b"]})';
    const [arose] = alertOf(await evalQuery(`${six} | get /9`)).facts.get('trace');
    expect(compareValues(arose[0], await evalQuery(six)) === 0).toBe(true);
    const nested = '[{:a {:b 1}} {:a {:b 2}} {:a {:b "x"}}]';
    const [, passed] = alertOf(await evalQuery(`${nested} | map ~(get /a/b | add 1)`)).facts.get('trace');
    expect(compareValues(passed[0], await evalQuery(nested)) === 0).toBe(true);
  });

  it('cuts an error at rest among its facts within its excerpt, its parts read beneath the fact [QSHST#answer]', async () => {
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
