// The quote as a vector of steps — what `quote.mjs` reads a tree into,
// which values it takes for steps, and how it prints the steps a text
// could not have produced, assembled by hand from records and wrappers.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isStep, printQuoteSource, quoteOfSource } from '../../src/quote.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { isQuote } from '../../src/types.mjs';

describe('the empty quote', () => {
  it('runs as the identity', async () => {
    expect(await evalQuery('5 | apply(~{})')).toBe(5);
  });

  it('reads back from blank text', () => {
    expect([...quoteOfSource('  ')]).toEqual([]);
  });
});

describe('isStep — the invariant of a quote', () => {
  it('takes literals, containers of steps, docs, quotes and error literals', async () => {
    const assembled = await evalQuery(
      '[:k ::T |~~ d ~~| ~{x} !{:k 1} [1] #[2] {:a 3} [1, 2] {"j": 4}] | tag(::quote) | count');
    expect(assembled).toBe(10);
  });

  it('refuses a container holding a value with no reading as code', async () => {
    for (const container of ['{:a ::Box[1]}', '#[::Box[1]]', '{"j": ::Box[1]}']) {
      expect(await evalQuery(`[${container}] | tag(::quote) !| type`))
        .toEqual(await evalQuery('::QuoteElementNotStepError'));
    }
  });

  it('refuses a function value', () => {
    expect(isStep(makeFn('host', 1, async state => state, { captured: [0, 0] }))).toBe(false);
  });
});

describe('printing steps assembled by hand', () => {
  const printed = source => evalQuery(`${source} | tag(::quote) | parse`);

  it('a fail wrapper over several steps takes parentheses', async () => {
    expect(await printed('[~{a | b} | tag(::fail)]')).toBe('!| (a | b)');
  });

  it('a wrapper inside a container prints as its group', async () => {
    expect(await printed('[[~{f} | tag(::each)]]')).toBe('[(* f)]');
  });

  it('a declaration inside a container or at the head of an argument takes parentheses', async () => {
    expect(await printed('[[::bind{:name :x :body 1}]]')).toBe('[(:x 1)]');
    expect(await printed('[::call{:name :f :args [[::bind{:name :x :body 1}] | tag(::quote)]}]'))
      .toBe('f((:x 1))');
  });

  it('a keyword body takes parentheses', async () => {
    expect(await printed('[::bind{:name :s :body :active}]')).toBe(':s (:active)');
  });

  it('a payload that opens with a name, a digit or a slash takes parentheses', async () => {
    expect(await printed('[::tagged{:tag ::T :payload 42}]')).toBe('::T(42)');
  });

  it('a value of another tag prints as its literal', async () => {
    expect(await printed('[::tagged{:tag ::T :payload ::Box[1]}]')).toBe('::T::Box[1]');
  });

  it('an error value of another tag writes its tag as :kind', async () => {
    const text = await printed('["x" | add(1)]');
    expect(text.startsWith('!{:kind ::AddLeftNotNumberError :faultStep ~{add(1)}')).toBe(true);
  });
});

describe('printing steps read from text', () => {
  it('a documented as keeps its doc in front', async () => {
    expect(await evalQuery('~{|~~ note ~~| as(:x)} | parse')).toBe('|~~ note ~~| as(:x)');
  });

  it('a key that is no bare name prints quoted, a namespaced one behind a colon', async () => {
    expect(await evalQuery('~{/"a b"} | parse')).toBe('/"a b"');
    expect(await evalQuery('~{/:ns/name} | parse')).toBe('/:ns/name');
  });

  it('a quote read from text keeps the tree it was read from', () => {
    const quote = quoteOfSource('add(1)');
    expect(isQuote(quote)).toBe(true);
    expect(printQuoteSource(quote)).toBe('add(1)');
  });
});
