import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { alertOf, ROOM_OF_A_FACT, ROOM_OF_AN_ALERT } from '../../../src/excerpt.mjs';

const isExcerpt = value => value instanceof Map && printValue(value).startsWith('::excerpt{');
const LONG = 'a long line of text to leave out for sure, which runs on long enough that a room of a fact holds it not';

describe('a host prints a failure as the concentrate of its facts', () => {
  it('prints each fact whole where its print holds the room of a fact', async () => {
    const failure = await evalQuery('"x" | add 1');
    const alert = alertOf(failure);
    expect([...alert.facts.keys()]).toEqual([...failure.facts.keys()]);
    expect([...alert.facts].every(([name, fact]) => fact === failure.facts.get(name))).toBe(true);
  });

  it('prints a fact past the room of a fact as its excerpt within that room', async () => {
    const alert = alertOf(await evalQuery('1 | add (3410 | range)'));
    const refused = alert.facts.get('actualValue');
    expect([isExcerpt(refused), refused.get('count'), printValue(refused).length <= ROOM_OF_A_FACT]).toEqual([true, 3410, true]);
    expect(isExcerpt(alert.facts.get('trace'))).toBe(false);
  });

  it('lays no excerpt beneath a fact, a trace past the room shown as the excerpt of its frames', async () => {
    const alert = alertOf(await evalQuery('10 | range | map ~(get {:name "Bo" :age 41 :email "bo@example.org" :city "Amsterdam" :tags ["a" "b"]}) | map ~(get /address/country)'));
    const trace = alert.facts.get('trace');
    expect([isExcerpt(trace), trace.get('of').name, trace.get('count')]).toEqual([true, 'trace', 2]);
    expect([...trace.get('parts').values()].every(frame => !printValue(frame).includes('::excerpt'))).toBe(true);
  });

  it('prints a string past the room by its first and its last characters', async () => {
    const text = Array.from({ length: 8 }, () => LONG).join(' ');
    const note = alertOf(await evalQuery(`!{:note ${JSON.stringify(text)}} | raise`)).facts.get('note');
    const shown = [...note.get('parts')];
    expect([note.get('of').name, note.get('count'), shown[0][0]]).toEqual(['string', text.length, '0']);
    expect(text.endsWith(shown[1][1])).toBe(true);
  });

  it('drops its last facts where the alert passes its room', async () => {
    const facts = Array.from({ length: 12 }, (_, at) => `:f${at} ${JSON.stringify(LONG.repeat(2).slice(0, 250))}`).join(' ');
    const alert = alertOf(await evalQuery(`!{${facts}} | raise`));
    const kept = [...alert.facts.keys()];
    expect(printValue(alert).length).toBeLessThanOrEqual(ROOM_OF_AN_ALERT);
    expect(kept).toEqual(Array.from({ length: kept.length }, (_, at) => `f${at}`));
    expect(kept.length).toBeLessThan(12);
  });
});

describe('the failure the concentrate tells', () => {
  it('holds its facts whole beneath !|', async () => {
    expect(await evalQuery('1 | add (3410 | range) !| actualValue | count')).toBe(3410);
  });

  it('reads back as an error at rest of its tag, each excerpt the excerpt it is', async () => {
    const alert = alertOf(await evalQuery('1 | add (3410 | range)'));
    expect(await evalQuery(`${printValue(alert)} | get [~(tag) ~(actualValue | tag) ~(actualValue | count)]`)).toEqual([alert.tag, await evalQuery('::excerpt'), 3410]);
  });
});
