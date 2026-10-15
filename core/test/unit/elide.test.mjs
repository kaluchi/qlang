// The view of a value within a budget [QSPRN#elide]: each way a part gives
// way, and the `:read` of every marker applied to the value taken answering
// the part left out.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { elide, alertOf, elideAnswer } from '../../src/elide.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { isErrorValue, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';

// Long enough that the marker standing for it prints shorter than it.
const LONG = 'a long line of text to leave out for sure, which runs on long enough that its marker prints shorter';
const readBack = async (value, marker) => evalQuery(`${printValue(value)} | apply ${printValue(marker.get('read'))}`);

describe('elide [QSPRN#elide]', () => {
  it('answers a value whose print fits as it is', () => {
    const value = [1, 2];
    expect(elide(value, 100)).toBe(value);
  });

  it('keeps the first half of a vector and marks the rest, which its read answers', async () => {
    const forty = Array.from({ length: 40 }, (_, index) => index + 1);
    const view = elide(forty, 80);
    const trailing = view[view.length - 1];
    expect(trailing.get('size')).toBe(40 - (view.length - 1));
    expect(deepEqual(await readBack(forty, trailing), forty.slice(view.length - 1))).toBe(true);
  });

  it('gives the top way whole when half a vector no longer fits', () => {
    const view = elide(Array.from({ length: 20 }, (_, index) => index), 20);
    expect(view[TAG_HEADER_SYMBOL].name).toBe('elision');
    expect(view.get('size')).toBe(20);
  });

  it('gives a string way whole with its head', async () => {
    const value = await evalQuery(`{:s "${LONG}" :n 1}`);
    const marker = elide(value, 50).get('s');
    expect(marker.get('size')).toBe(LONG.length);
    expect(LONG.startsWith(marker.get('head'))).toBe(true);
    expect(await readBack(value, marker)).toBe(LONG);
  });

  it('gives a map way whole', async () => {
    const value = await evalQuery('{:m {:a "some text here" :b "more text there"} :n 1}');
    const marker = elide(value, 40).get('m');
    expect(marker.get('size')).toBe(2);
    expect(deepEqual(await readBack(value, marker), value.get('m'))).toBe(true);
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
    const marker = elide(value, 30).get('a key');
    expect(await readBack(value, marker)).toBe(LONG);
  });

  it('gives the largest part way first, the others staying once the print fits', async () => {
    const value = await evalQuery(`{:a "${'a'.repeat(100)}" :b "${'b'.repeat(300)}" :c "${'c'.repeat(120)}"}`);
    const view = elide(value, 400);
    expect(view.get('b')[TAG_HEADER_SYMBOL].name).toBe('elision');
    expect([view.get('a'), view.get('c')]).toEqual([value.get('a'), value.get('c')]);
  });

  it('keeps a part whose marker prints no shorter than it, so a budget never lengthens a print [QSPRN#elide]', async () => {
    const value = await evalQuery('[[] {:n 1} "short"]');
    expect(elide(value, 3)).toBe(value);
    const failing = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(printValue(elideAnswer(failing, 200)).length).toBeLessThanOrEqual(printValue(elideAnswer(failing)).length);
  });
});

describe('elideAnswer [QSPRN#elide]', () => {
  it('gives the facts of a raised error way beneath !|, its trail a trail', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    const view = elideAnswer(failing, 300);
    expect(isErrorValue(view)).toBe(true);
    expect(view.tag).toBe(failing.tag);
    expect(printValue(view)).toContain(':read ~(!| get /trail/');
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

// A failure a host prints is an alert [QSHST#answer]: the subject where the
// failure arose within an excerpt, a subject it only passed given way whole,
// an error at rest among its facts a value cut within its excerpt
// [QSERR#rest], a value shown once, and the read of every marker continuing
// the query beneath `!|`.
describe('alertOf [QSHST#answer]', () => {
  const records = `[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
  const continued = (query, marker) => evalQuery(`${query} ${printValue(marker.get('read')).slice(2, -1)}`);

  it('keeps the subject where the failure arose and gives a vector it passed way whole', async () => {
    const query = `${records} | filter ~(nope)`;
    const [arose, passed] = alertOf(await evalQuery(query)).descriptor.get('trail');
    expect(printValue(arose.get('subject'))).toBe('{:n 0}');
    expect(passed.get('subject').get('size')).toBe(30);
    expect(deepEqual(await continued(query, passed.get('subject')), await evalQuery(records))).toBe(true);
  });

  it('cuts a vector where the failure arose to its first elements, the rest read beneath !|', async () => {
    const many = `[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const query = `${many} | add 1`;
    const subject = alertOf(await evalQuery(query)).descriptor.get('trail')[0].get('subject');
    const rest = subject[subject.length - 1];
    expect(deepEqual(await continued(query, rest), (await evalQuery(many)).slice(subject.length - 1))).toBe(true);
  });

  it('cuts a long string where the failure arose to its head', async () => {
    const text = LONG.repeat(10);
    const query = `"${text}" | add 1`;
    const marker = alertOf(await evalQuery(query)).descriptor.get('trail')[0].get('subject');
    expect(text.startsWith(marker.get('head'))).toBe(true);
    expect(await continued(query, marker)).toBe(text);
  });

  it('gives a map and a string it passed way whole, and keeps what prints shorter than its marker', async () => {
    const [, map] = alertOf(await evalQuery(`{:s "${LONG}" :t "${LONG}"} | (add 1)`)).descriptor.get('trail');
    expect(map.get('subject').get('size')).toBe(2);
    const text = LONG.repeat(3);
    const [, string] = alertOf(await evalQuery(`"${text}" | (add 1)`)).descriptor.get('trail');
    expect(string.get('subject').get('size')).toBe(text.length);
    const [, kept] = alertOf(await evalQuery('5 | (add "x")')).descriptor.get('trail');
    expect(kept.get('subject')).toBe(5);
  });

  it('cuts an error at rest among its facts within its excerpt, its parts read beneath the fact [QSERR#rest]', async () => {
    const query = `${records} | map (get /n)`;
    const alert = alertOf(await evalQuery(query));
    const inner = alert.descriptor.get('actualValue');
    expect(isErrorValue(inner)).toBe(false);
    const marker = inner.payload.get('trail');
    expect(printValue(marker.get('read'))).toBe('~(!| get /actualValue/trail)');
    expect((await continued(query, marker)).length).toBe(2);
  });
});
