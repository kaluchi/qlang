import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { elide } from '../../../src/elide.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { TAG_HEADER_SYMBOL } from '../../../src/types.mjs';
import { compareValues } from '../../../src/ordering.mjs';

// Long enough that the elision standing for it prints shorter than it.
const LONG = 'a long line of text to leave out for sure, which runs on long enough that its elision prints shorter';
const readBack = async (value, elision) => evalQuery(`${printValue(value)} | apply ${printValue(elision.get('read'))}`);

describe('elide', () => {
  it('keeps the first element of the top, the part within it giving way', async () => {
    const value = await evalQuery(`["${LONG.repeat(3)}" "${LONG.repeat(3)}"]`);
    const view = elide(value, 200);
    expect(view.length).toBe(2);
    expect(await readBack(value, view[0])).toBe(value[0]);
    expect(view[1].get('size')).toBe(1);
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
});
