import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { alertOf, alertWithin } from '../../../src/elide.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { isErrorValue, TAG_HEADER_SYMBOL } from '../../../src/types.mjs';
import { compareValues } from '../../../src/ordering.mjs';
import * as core from '../../../src/index.mjs';

const LONG = 'a long line of text to leave out for sure, which runs on long enough that its elision prints shorter';
const continued = (query, elision) => evalQuery(`${query} ${printValue(elision.get('read')).slice(2, -1)}`);

function elisionsOf(value, found = []) {
  if (isErrorValue(value)) for (const fact of value.facts.values()) elisionsOf(fact, found);
  else if (value instanceof Map && value[TAG_HEADER_SYMBOL]?.name === 'elision') found.push(value);
  else if (value instanceof Map) for (const part of value.values()) elisionsOf(part, found);
  else if (Array.isArray(value)) for (const part of value) elisionsOf(part, found);
  else if (value !== null && typeof value === 'object' && 'payload' in value) elisionsOf(value.payload, found);
  return found;
}

async function sizesHold(query, budgets) {
  const failing = await evalQuery(query);
  const elisions = budgets.flatMap(budget => elisionsOf(alertWithin(failing, budget, undefined, true)));
  expect(elisions.length).toBeGreaterThan(0);
  const reads = elisions.map(elision => printValue(elision.get('read')).slice(2, -1).replace(/^!\| /, ''));
  const counts = await evalQuery(`${query} !| get [${reads.map(read => `~(${read} | count)`).join(' ')}]`);
  expect(elisions.map((elision, at) => [reads[at], elision.get('size')])).toEqual(reads.map((read, at) => [read, counts[at]]));
}

describe('an alert cut within its budget', () => {
  it('gives an alert past its budget way to a shorter print within the budget', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}] | add 1`);
    expect(printValue(alertOf(failing, undefined, undefined, true)).length).toBeGreaterThan(300);
    expect(printValue(alertWithin(failing, 300, undefined, true)).length).toBeLessThanOrEqual(300);
  });

  it('gives way within the trace of a failure past its budget, the trace kept a trace and the rest of its frames read beneath !|', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(printValue(alertOf(failing, undefined, undefined, true)).length).toBeGreaterThan(190);
    const trace = alertWithin(failing, 190, undefined, true).facts.get('trace');
    expect(trace[TAG_HEADER_SYMBOL].name).toBe('trace');
    expect(printValue(trace[trace.length - 1])).toBe('::elision{:size 1 :read ~(!| trace | drop 1)}');
  });

  it('cuts an alert past a budget fact by fact, the failure keeping its tag and the names of its facts', async () => {
    const skipped = Array.from({ length: 12 }, (_, index) => `add ${index}`).join(' | ');
    const failing = await evalQuery(`[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}] | filter ~(nope) | ${skipped}`);
    const view = alertWithin(failing, 60, undefined, true);
    expect([...view.facts.keys()]).toEqual([...failing.facts.keys()]);
    expect(printValue(view.facts.get('trace').get('read'))).toBe('~(!| trace)');
    expect(view.facts.get('trace').get('size')).toBe(failing.facts.get('trace').length);
  });

  it('keeps the facts of a failure whose first fact is named as the rest of a map is', async () => {
    const forty = Array.from({ length: 40 }, (_, index) => index).join(' ');
    const failing = await evalQuery(`!{:"…" 1 :b "${'a'.repeat(134)}" :c [${forty}]} | raise`);
    const view = alertWithin(failing, 60, undefined, true);
    expect([...view.facts.keys()]).toEqual([...failing.facts.keys()]);
    expect([view.facts.get('…'), view.facts.get('b').get('size'), view.facts.get('c').get('size')]).toEqual([1, 134, 40]);
  });

  it('counts what each read answers where the views of an alert cut a part again', async () => {
    await sizesHold(':number/inf ~(add 1 | inf) | 0 | inf', [150, 250, 2000]);
    await sizesHold(':vec/inf ~(append 1 | inf) | [] | inf', [2000]);
    await sizesHold('1000 | range | add 1', [150]);
    await sizesHold('40 | range | map ~(tag ::zeta) | toSet | add 1', [150]);
  });

  it('keeps the first frames of a trace past the budget within an excerpt, each with its steps, and the rest read beneath !|', async () => {
    const failing = await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf');
    const trace = alertWithin(failing, 2000, undefined, true).facts.get('trace');
    const rest = trace[trace.length - 1];
    expect(trace[TAG_HEADER_SYMBOL].name).toBe('trace');
    expect(printValue(trace[0][1])).toBe('~(add 1 | inf)');
    expect(printValue(rest.get('read'))).toBe(`~(!| trace | drop ${trace.length - 1})`);
    expect(rest.get('size')).toBe(failing.facts.get('trace').length - (trace.length - 1));
    expect(printValue(trace).length).toBeLessThanOrEqual(300);
  });

  it('cuts an alert that holds no trace past a budget, the refusal of a text among them', async () => {
    const refused = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}] x`);
    const view = alertWithin(refused, 80, undefined, true);
    expect(view.facts.has('trace')).toBe(false);
    expect([...view.facts.keys()]).toEqual([...refused.facts.keys()]);
    expect(view.facts.get('source').get('size')).toBe(refused.facts.get('source').length);
  });

  it('keeps every frame of an alert within its budget', async () => {
    const failing = await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf');
    expect(alertWithin(failing, 100000, undefined, true).facts.get('trace').length).toBe(failing.facts.get('trace').length);
  });

  it('answers an alert that fits its budget as the alert itself', async () => {
    const failing = await evalQuery(`[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}] | filter ~(nope)`);
    expect(printValue(alertWithin(failing, 100000, undefined, true))).toBe(printValue(alertOf(failing, undefined, undefined, true)));
  });
});

describe('the facts of an error under the kind of errors alone, read by their keys', () => {
  it('reads a fact an alert leaves out by its key, the error no refusal closes', async () => {
    const text = LONG.repeat(10);
    const query = `{:note "${text}"} | raise`;
    const elision = alertOf(await evalQuery(query)).facts.get('note');
    expect(printValue(elision.get('read'))).toBe('~(!| get /note)');
    expect(await continued(query, elision)).toBe(text);
  });

  it('cuts such an alert past its budget fact by fact, its trace read by its key', async () => {
    const query = `{:a "${LONG}" :b "${LONG}" :c "${LONG}"} | raise | count`;
    const failing = await evalQuery(query);
    const view = alertWithin(failing, 250);
    expect(printValue(view).length).toBeLessThan(printValue(alertOf(failing)).length);
    expect(elisionsOf(view).map(elision => printValue(elision.get('read'))).every(read => read.startsWith('~(!| get /'))).toBe(true);
  });
});

describe('the subjects an alert prints, each within its excerpt', () => {
  const records = `[${Array.from({ length: 30 }, (_, index) => `{:n ${index}}`).join(' ')}]`;

  it('keeps the subject where the failure arose and gives a vector it passed way whole', async () => {
    const query = `${records} | filter ~(nope)`;
    const [arose, passed] = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace');
    expect(printValue(arose[0])).toBe('{:n 0}');
    expect(passed[0].get('size')).toBe(30);
    expect(compareValues(await continued(query, passed[0]), await evalQuery(records)) === 0).toBe(true);
  });

  it('counts a text it passed by its characters, through the tags over it', async () => {
    const query = `"${'a'.repeat(100)}" | tag ::Box | within ~(add 1)`;
    const passed = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[1][0];
    expect(passed.get('size')).toBe(100);
  });

  it('gives a subject way whole where its cut still passes the excerpt, an atom counted by its print', async () => {
    const name = 'k'.repeat(400);
    const query = `:${name} | add 1`;
    const elision = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[0][0];
    expect([elision.get('size'), printValue(elision.get('read'))]).toEqual([name.length + 1, '~(!| trace | get /0 | subject)']);
    expect(await continued(query, elision)).toEqual(await evalQuery(`:${name}`));
  });

  it('counts a vector it passed by its elements, through the tags over it', async () => {
    const query = '300 | range | tag ::B | tag ::A | map ~(add "x")';
    const passed = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[1][0];
    expect(passed.get('size')).toBe(300);
  });

  it('cuts a vector where the failure arose to its first elements, the rest read beneath !|', async () => {
    const many = `[${Array.from({ length: 60 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const query = `${many} | add 1`;
    const subject = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[0][0];
    const rest = subject[subject.length - 1];
    expect(compareValues(await continued(query, rest), (await evalQuery(many)).slice(subject.length - 1)) === 0).toBe(true);
  });

  it('keeps the first entries of a wide map where the failure arose, the rest under :"…" read beneath !|', async () => {
    const wide = `{${Array.from({ length: 200 }, (_, index) => `:k${index} ${index}`).join(' ')}}`;
    const query = `${wide} | add 1`;
    const subject = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[0][0];
    const kept = subject.size - 1;
    const rest = subject.get('…');
    expect(printValue(rest.get('read'))).toBe(`~(!| trace | get /0 | subject | drop ${kept})`);
    expect(rest.get('size')).toBe(200 - kept);
    expect((await continued(query, rest)).size).toBe(200 - kept);
  });

  it('cuts a long string where the failure arose to its head', async () => {
    const text = LONG.repeat(10);
    const query = `"${text}" | add 1`;
    const elision = alertOf(await evalQuery(query), undefined, undefined, true).facts.get('trace')[0][0];
    expect(text.startsWith(elision.get('head'))).toBe(true);
    expect(await continued(query, elision)).toBe(text);
  });

  it('gives a map and a string it passed way whole, and keeps what prints shorter than its elision', async () => {
    const [, map] = alertOf(await evalQuery(`{:s "${LONG}" :t "${LONG}"} | (add 1)`), undefined, undefined, true).facts.get('trace');
    expect(map[0].get('size')).toBe(2);
    const text = LONG.repeat(3);
    const [, string] = alertOf(await evalQuery(`"${text}" | (add 1)`), undefined, undefined, true).facts.get('trace');
    expect(string[0].get('size')).toBe(text.length);
    const [, kept] = alertOf(await evalQuery('5 | (add "x")'), undefined, undefined, true).facts.get('trace');
    expect(kept[0]).toBe(5);
  });

  it('measures the subject of a frame on the one line the frame prints on', async () => {
    const six = '6 | range | map ~(get {:id ~(it) :name "user" :tags ["a" "b"]})';
    const [arose] = alertOf(await evalQuery(`${six} | get /9`), undefined, undefined, true).facts.get('trace');
    expect(compareValues(arose[0], await evalQuery(six)) === 0).toBe(true);
    const nested = '[{:a {:b 1}} {:a {:b 2}} {:a {:b "x"}}]';
    const [, passed] = alertOf(await evalQuery(`${nested} | map ~(get /a/b | add 1)`), undefined, undefined, true).facts.get('trace');
    expect(compareValues(passed[0], await evalQuery(nested)) === 0).toBe(true);
  });

  it('cuts an error at rest among its facts within its excerpt, its parts read beneath the fact', async () => {
    const query = `${records} | map (get /n)`;
    const alert = alertOf(await evalQuery(query), undefined, undefined, true);
    const inner = alert.facts.get('actualValue');
    expect(isErrorValue(inner)).toBe(false);
    const subject = inner.payload.get('trace')[0][0];
    const rest = subject[subject.length - 1];
    expect(printValue(rest.get('read'))).toBe(`~(!| actualValue | trace | get /0 | subject | drop ${subject.length - 1})`);
    expect((await continued(query, rest)).length).toBe(30 - (subject.length - 1));
  });
});

describe('the answer a host prints for a failure', () => {
  it('answers a failure whose alert passes the budget as the refusal, its kind the tag of the failure and its head read beneath !|', async () => {
    const scope = await core.langRuntime();
    const failure = await core.evalQuery('3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise', scope);
    const shown = await core.boundAnswer(failure, scope);
    expect([shown.tag, shown.facts.get('actualTag')]).toEqual([core.makeTag('qlang/AnswerBeyondBudgetError'), core.makeTag('error')]);
    expect(core.printValue(shown)).toContain(':read ~(!| ');
    expect(core.printValue(shown).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
  });

  it('answers a failure as its alert within the budget', async () => {
    const scope = await core.langRuntime();
    const failure = await core.evalQuery(':number/inf ~(add 1 | inf) | 0 | inf', scope);
    const shown = await core.boundAnswer(failure, scope);
    expect(shown.tag).toEqual(failure.tag);
    expect(core.printValue(shown).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
    expect(core.printValue(failure).length).toBeGreaterThan(core.ANSWER_BUDGET);
  });
});
