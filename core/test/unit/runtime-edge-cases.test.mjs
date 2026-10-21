// The branches of the forms of values, of the reading of a parse failure and
// of the printer that the laws of the catalog leave out, a `describe` for each.

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { compareValues } from '../../src/ordering.mjs';
import {
  formOf,
  typeOf,
  keyword,
  makeTag,
  makeBinding,
  makeErrorValue
} from '../../src/types.mjs';
import { printValue } from '../../src/print-value.mjs';

describe('a binding record, a vector under a tag and a descriptor are values under a tag', async () => {
  it('formOf reads a binding record as a value under a tag, underTag', async () => {
    const record = makeBinding({ name: keyword('x'), value: 42 });
    expect(formOf(record)).toBe('underTag');
  });

  it('formOf answers "underTag" for a vector under a tag', async () => {
    const { makeTagged, makeTag } = await import('../../src/types.mjs');
    const tagged = makeTagged(makeTag('Box'), [42]);
    expect(formOf(tagged)).toBe('underTag');
  });

  it('toPlain writes a vector under a tag as its tag beside its payload', async () => {
    const { makeTagged, makeTag } = await import('../../src/types.mjs');
    const { toPlain } = await import('../../src/runtime/json.mjs');
    const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
    const plainTagged = toPlain(tagged);
    expect(plainTagged.$tag).toBe('Box');
    expect(plainTagged.payload).toEqual([42, 'inner']);
  });

  it('isTagged takes a descriptor under ::builtin as the value under a tag it is', async () => {
    const { isTagged } = await import('../../src/types.mjs');
    expect(isTagged(await evalQuery('::builtin{:a 1}'))).toBe(true);
    expect(isTagged(await evalQuery('{:kind ::builtin}'))).toBe(false);
  });
});

describe('typeOf refuses a value of no kind', () => {
  it('typeOf refuses an object of JavaScript, a value of no kind of the language [QSHST#source]', () => {
    expect(() => typeOf({ type: 'alien' })).toThrow('the core met object Object, a value of no kind of the language');
  });
});

describe('a source a host hands that is no string [QSHST#source]', () => {
  it('is refused by the parser with its message alone, naming no origin and no place', async () => {
    const { result } = await (await createSession()).evalCell(42);
    const refusal = makeErrorValue(makeTag('quote/ParseError'), new Map([['message', 'parse() expects a string source']]));
    expect(compareValues(result, refusal)).toBe(0);
  });
});

describe('the printer writes the literal of a value', () => {
  it('prints undefined as null, and a fraction and a negative number as their literals', () => {
    expect(printValue(undefined)).toBe('null');
    expect(printValue(3.14)).toBe('3.14');
    expect(printValue(-1)).toBe('-1');
  });

  it('prints a keyword of names joined by a slash bare', () => {
    expect(printValue(keyword('qlang/error'))).toBe(':qlang/error');
  });

  it('prints the empty vector', () => {
    expect(printValue([])).toBe('[]');
  });

  it('prints a failure of one fact on one line, its tag before the bang', () => {
    expect(printValue(makeErrorValue(makeTag('Test'), new Map([['index', 1]])))).toBe('::Test!{:index 1}');
  });

  it('prints a failure of three facts a fact a line', () => {
    const err = makeErrorValue(makeTag('Test'), new Map([
      ['actualType', makeTag('number')],
      ['message', 'boom'],
      ['index', 1]
    ]));
    expect(printValue(err)).toBe('::Test!{\n  :actualType ::number\n  :message "boom"\n  :index 1\n}');
  });

  it('refuses a value of no kind of the language where it reads its kind [QSHST#source]', () => {
    expect(() => printValue(Symbol('x'))).toThrow('the core met symbol Symbol(x), a value of no kind of the language');
  });
});

describe('the print of a value reads back as the value', () => {
  async function readsBack(source) {
    const original = await evalQuery(source);
    const printed = printValue(original);
    expect(compareValues(original, await evalQuery(printed)) === 0, `${source} → ${printed}`).toBe(true);
  }

  it('a keyword written in quotes, and one of names joined by a slash, reads back from its print', async () => {
    for (const source of [':"1"', ':"foo bar"', ':"$ref"', ':""', ':"123"', ':qlang/error']) await readsBack(source);
  });

  it('a vector of a number, a string, a keyword, a boolean and null reads back from its print', async () => {
    await readsBack('[1 "two" :three true null]');
  });

  it('a vector of keywords written in quotes reads back from its print', async () => {
    await readsBack('[:"$ref" :"foo bar" :normal]');
  });

  it('a set of keywords reads back from its print', async () => {
    await readsBack('#[:a :b :c]');
  });

  it('a set of keywords written in quotes reads back from its print', async () => {
    await readsBack('#[:"$ref" :normal]');
  });

  it('a map of keys written in quotes reads back from its print', async () => {
    await readsBack('{:"$ref" 1 :"foo bar" 2}');
  });

  it('a map of keyword values, one of names joined by a slash, reads back from its print', async () => {
    await readsBack('{:kind :typeError :origin :qlang/eval}');
  });

  it('a map within a map within a map reads back from its print', async () => {
    await readsBack('{:a {:b {:c 42}}}');
  });

  it('an error at rest with a :kind fact reads back from its print', async () => {
    await readsBack('!{:kind ::Foo :message "boom"}');
  });

  it('an error at rest whose trace is a quote reads back from its print', async () => {
    await readsBack('!{:message "boom" :trace ~(count)}');
  });

  it('a map of vectors of maps of sets reads back from its print', async () => {
    await readsBack('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}');
  });
});
