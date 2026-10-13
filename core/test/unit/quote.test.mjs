// The quote as a vector of steps — what `quote.mjs` reads a tree into,
// which values it takes for steps, and what the constructors of the
// records and wrappers refuse when a hand assembly does not read back
// as itself.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { printQuoteSource, quoteOfSource } from '../../src/quote.mjs';
import { isQuote } from '../../src/types.mjs';

describe('the empty quote', () => {
  it('runs as the identity', async () => {
    expect(await evalQuery('5 | apply ~()')).toBe(5);
  });

  it('reads back from blank text', () => {
    expect([...quoteOfSource('  ')]).toEqual([]);
  });

  it('reads back from text that holds a comment alone', () => {
    expect([...quoteOfSource('|~ a note ~|')]).toEqual([]);
  });
});

describe('isStep — the invariant of a quote', () => {
  it('takes literals, containers of steps, docs, quotes and error literals, each a step at the head', async () => {
    for (const element of [':k', '::T', '|~~ d ~~|', '~(x)', '::error{:k 1}', '[1]', '#[2]', '{:a 3}', '[1, 2]', '{"j": 4}', '/a/0']) {
      expect(await evalQuery(`[${element}] | tag ::quote | count`), element).toBe(1);
    }
  });

  it('refuses a value after the head, which reads back as no step [D248]', async () => {
    expect(await evalQuery('[[1] [2]] | tag ::quote !| get [~(type) /printed]'))
      .toEqual(await evalQuery('[::quote/ReadBackDiffersError "[1] | [2]"]'));
  });

  it('refuses a container holding a value with no reading as code', async () => {
    for (const container of ['{:a ::Box[1]}', '#[::Box[1]]', '{"j": ::Box[1]}']) {
      expect(await evalQuery(`[${container}] | tag(::quote) !| type`))
        .toEqual(await evalQuery('::quote/ElementNotStepError'));
    }
  });
});

describe('assembling steps by hand', () => {
  const refusal = source => evalQuery(`${source} !| type`);
  const tagOf = name => evalQuery(name);

  it('a record assembled from its fields reads back as itself', async () => {
    expect(await evalQuery('{:name :filter :modifiers [~(gt 1)]} | tag ::call | get [~(it)] | tag ::quote | parse'))
      .toBe('filter ~(gt 1)');
  });

  it('a fail wrapper over several steps reads back as another step', async () => {
    expect(await refusal('~(a | b) | tag ::fail')).toEqual(await tagOf('::fail/ReadBackDiffersError'));
  });

  it('a wrapper stands in the quote itself and in no container', async () => {
    expect(await refusal('get [[~(~(f) | tag ::fail)]] | tag ::quote')).toEqual(await tagOf('::quote/ElementNotStepError'));
  });

  it('a declaration stands in a pipeline and in no container or argument head', async () => {
    expect(await refusal('[[::bind{:name :x :body 1}]] | tag ::quote')).toEqual(await tagOf('::quote/ElementNotStepError'));
    expect(await refusal('::call{:name :f :modifiers [::bind{:name :x :body 1}]}'))
      .toEqual(await tagOf('::call/PayloadNotSchemaError'));
  });

  it('the body of a declaration may be a command with its modifiers', async () => {
    expect(await evalQuery('::bind{:name :six :body ::call{:name :add :modifiers [1]}} | get [~(it)] | tag ::quote | parse'))
      .toBe(':six add 1');
  });

  it('a keyword or a tag name is the body of its declaration [D66]', async () => {
    expect(await evalQuery('::bind{:name :s :body :active} | get [~(it)] | tag ::quote | parse')).toBe(':s :active');
    expect(await evalQuery('::bind{:name :s :body ::vec} | get [~(it)] | tag ::quote | parse')).toBe(':s ::vec');
  });

  it('a scalar payload touches its tag by its sign, and reads back as itself [D279]', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload 42} | get [~(it)] | tag ::quote | parse')).toBe('::T#42');
  });

  it('a value of another tag is no step', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload ::Box[1]} !| get [~(type) /field]'))
      .toEqual(await evalQuery('[::construct/PayloadNotSchemaError :payload]'));
  });

  it('an error at rest of a tag is the step of the literal that spells it', async () => {
    // The tag an error literal writes before its bang is the tag of the
    // error at rest it spells, so an error of any tag stands in a quote
    // [D13].
    expect(await evalQuery('get [~("x" | add 1 !| it)] | tag ::quote | parse'))
      .toBe('::number/add/SubjectNotNumberError!{:actualType ::string :trail [{:step ~(add 1) :subject "x" :skipped ~()}]}');
  });

  it('a required field left out does not fit the schema', async () => {
    expect(await evalQuery('::call{:modifiers []} !| get [~(type) /field /actualType]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError :name ::null]'));
  });

  it('an index, a tag name and calls and paths inside a container are steps', async () => {
    expect(await evalQuery('[[/items/0]] | tag ::quote | parse')).toBe('[/items/0]');
    expect(await evalQuery('::bind{:name :point :body {:x 0}} | get [~(it)] | tag ::quote | parse')).toBe(':point {:x 0}');
    expect(await evalQuery('~(get [~(count) /a]) | filter ~(true) | parse')).toBe('get [~(count) /a]');
  });

  it('a payload that is no Map names no field', async () => {
    expect(await evalQuery('[1] | tag ::call !| get [~(type) /field]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError null]'));
  });
});

describe('printing steps read from text', () => {
  it('a doc in the slot of a declaration prints in its slot', async () => {
    expect(await evalQuery('~(:x |~~ note ~~| it) | parse')).toBe(':x |~~ note ~~| it');
  });

  it('a key that is no bare name prints quoted, a namespaced one behind a colon', async () => {
    expect(await evalQuery('~(get /"a b") | parse')).toBe('get /"a b"');
    expect(await evalQuery('~(get /:ns/name) | parse')).toBe('get /:ns/name');
  });

  it('a quote read from text keeps the tree it was read from', () => {
    const quote = quoteOfSource('add 1');
    expect(isQuote(quote)).toBe(true);
    expect(printQuoteSource(quote)).toBe('add 1');
  });
});
