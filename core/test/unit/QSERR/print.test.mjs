import { describe, it, expect } from 'vitest';
import { makeKeyword, isErrorValue, makeErrorValue, makeTag, makeTagged } from '../../../src/types.mjs';
import { makeSet, compareValues } from '../../../src/ordering.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { printAnswer, caretOf } from '../../../src/runtime/print.mjs';

it('reads back the literal of an error value raised and of a tag over each kind of payload', async () => {
  const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'something went wrong']]));
  const restoredError = await evalQuery(`${printValue(errorVal)} | raise`);
  expect(isErrorValue(restoredError)).toBe(true);
  expect(restoredError.tag.name).toBe('Oops');
  expect(restoredError.facts.get('message')).toBe('something went wrong');
  const hostBuilt = [
    makeTagged(makeTag('Box'), [1, 2, 3]),
    makeTagged(makeTag('Keys'), makeSet([makeKeyword('b'), makeKeyword('a')])),
    makeTagged(makeTag('User'), new Map([['name', 'alice']])),
    makeTagged(makeTag('Count'), 42)
  ];
  for (const value of hostBuilt) {
    expect(compareValues(await evalQuery(printValue(value)), value) === 0).toBe(true);
  }
});

describe('the print of a failure, its tag before the bang and its facts', () => {
  it('a failure that flew no step prints its facts alone, and its print raised starts its trace at the raise', async () => {
    const err = makeErrorValue(makeTag('Foo'), new Map([['category', makeKeyword('oops')]]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
    expect(isErrorValue(await evalQuery(printValue(err)))).toBe(false);
    expect(compareValues(await evalQuery(`${printValue(err)} | raise !| trace | map ~failed`), await evalQuery('[~(raise)]')) === 0).toBe(true);
  });

  it('an answer that is a failure prints under the line that says it was raised, an error at rest under none', async () => {
    const scope = await langRuntime();
    const failure = await evalQuery('"x" | add 1');
    expect(await printAnswer(failure, scope)).toBe(`|~| raised, and no !| caught it\n${printValue(failure)}`);
    const atRest = await evalQuery('"x" | add 1 !| it');
    expect(await printAnswer(atRest, scope)).toBe(printValue(atRest));
  });
});

describe('the caret under the line where the reading stopped', () => {
  const caretOfQuery = async query => caretOf(await evalQuery(query));
  const refusalAt = (source, span) => `::quote/ParseError!{:source ${JSON.stringify(source)} :location ::span[${span}]} | raise`;

  it('draws the line and a caret as wide as the span under its column', async () => {
    expect(await caretOfQuery('[mul(2) add(1)]')).toBe('|~| [mul(2) add(1)]\n|~|     ^~~');
  });

  it('draws one caret where the reading stopped at the end of the line', async () => {
    expect(await caretOfQuery('[1 2')).toBe('|~| [1 2\n|~|     ^');
    expect(await caretOfQuery(refusalAt('x', '1 1 2 1 1 2'))).toBe('|~| x\n|~|  ^');
  });

  it('draws the caret to the end of the line for a span that runs past it', async () => {
    expect(await caretOfQuery('[1 2 (3 | add 1)\n]')).toBe('|~| [1 2 (3 | add 1)\n|~| ^~~~~~~~~~~~~~~~');
    expect(await caretOfQuery(refusalAt('xyz', '1 1 2 1000000000 1 1000000000'))).toBe('|~| xyz\n|~|  ^~');
  });

  it('draws a line past the excerpt within an excerpt around the place, an ellipsis where it cuts, the caret under the place as far as the excerpt reaches', async () => {
    const [tail, under] = (await caretOfQuery(refusalAt('x'.repeat(400), '349 1 350 349 1 351'))).split('\n');
    expect(tail).toBe(`|~| …${'x'.repeat(300)}`);
    expect(under).toBe(`|~| ${' '.repeat(250)}^`);
    const [middle, beneath] = (await caretOfQuery(refusalAt('x'.repeat(1000), '499 1 500 499 1 501'))).split('\n');
    expect(middle).toBe(`|~| …${'x'.repeat(300)}…`);
    expect(beneath).toBe(`|~| ${' '.repeat(151)}^`);
    const [, wide] = (await caretOfQuery(refusalAt('x'.repeat(1000), '499 1 500 899 1 900'))).split('\n');
    expect(wide).toBe(`|~| ${' '.repeat(151)}^${'~'.repeat(149)}`);
  });

  it('draws none for a column before the line or past its end', async () => {
    for (const span of ['0 0 0 0 0 0', '0 1 -3 0 1 2', '2 1 3 2 1 3', '0 1 1000000000 0 1 1000000000']) {
      expect(await caretOfQuery(refusalAt('x', span)), span).toBe(null);
    }
  });

  it('draws none for a source that is no line', async () => {
    expect(await caretOfQuery(refusalAt('a\nb', '0 1 1 1 1 2'))).toBe(null);
  });

  it('draws none for a failure of another kind that holds the same facts, nor for a value, the error at rest of a refusal of a text among them', async () => {
    expect(await caretOfQuery('!{:source "x" :location ::span[0 1 1 1 1 2]} | raise')).toBe(null);
    expect(await caretOfQuery('[1 2]')).toBe(null);
    expect(await caretOfQuery('"[1 2" | parse !| it')).toBe(null);
  });

  it('draws none for a refusal of a text that holds no line or no span', async () => {
    expect(await caretOfQuery('::quote/ParseError!{:location ::span[0 1 1 1 1 2]} | raise')).toBe(null);
    expect(await caretOfQuery('::quote/ParseError!{:source "x" :location 5} | raise')).toBe(null);
  });
});
