// The view of a value within a budget [D109]: each way a part gives way,
// and the `:read` of every marker applied to the value taken answering
// the part left out.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { elide, elideAnswer } from '../../src/elide.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { isErrorValue, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';

const LONG = 'a long line of text to leave out for sure';
const readBack = async (value, marker) => evalQuery(`${printValue(value)} | apply ${printValue(marker.get('read'))}`);

describe('elide [D109]', () => {
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
    const tagged = await evalQuery(`::Box {} | ::Box{:s "${LONG}" :n 1}`);
    expect(elide(tagged, 50)[TAG_HEADER_SYMBOL].name).toBe('Box');
    const wrapped = await evalQuery(`{:b ::Box("${LONG}") :n 1}`);
    expect(await readBack(wrapped, elide(wrapped, 50).get('b'))).toEqual(await evalQuery(`::Box("${LONG}")`));
  });

  it('gives way within a vector under a tag and a map beneath a stack of tags', async () => {
    const vector = await evalQuery(`::Row {} | ::Row["${LONG}" 1]`);
    const vectorView = elide(vector, 50);
    expect(vectorView[TAG_HEADER_SYMBOL].name).toBe('Row');
    expect(await readBack(vector, vectorView[0])).toBe(LONG);
    const stacked = await evalQuery(`::Outer::Inner{:s "${LONG}" :n 1}`);
    const stackedView = elide(stacked, 60);
    expect(stackedView.tag.name).toBe('Outer');
    expect(await readBack(stacked, stackedView.payload.get('s'))).toBe(LONG);
  });

  it('reads a key no projection spells by at', async () => {
    const value = await evalQuery(`{:"a key" "${LONG}"}`);
    const marker = elide(value, 30).get('a key');
    expect(await readBack(value, marker)).toBe(LONG);
  });
});

describe('elideAnswer [D109]', () => {
  it('gives the facts of a raised error way beneath !|, its trail a trail', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    const view = elideAnswer(failing, 300);
    expect(isErrorValue(view)).toBe(true);
    expect(view.tag).toBe(failing.tag);
    expect(printValue(view)).toContain(':read ~(!| /trail/');
  });

  it('elides a value that is no error as elide does', () => {
    const forty = Array.from({ length: 40 }, (_, index) => index + 1);
    expect(elideAnswer(forty, 80)).toEqual(elide(forty, 80));
  });
});
