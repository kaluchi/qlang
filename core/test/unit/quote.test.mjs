// The quote as a vector of steps — what `quote.mjs` reads a tree into,
// which values it takes for steps, and what the constructors of the
// records and wrappers refuse when a hand assembly does not read back
// as itself.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isStep, printQuoteSource, quoteOfSource } from '../../src/quote.mjs';
import { makeFn } from '../../src/rule10.mjs';
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
  it('takes literals, containers of steps, docs, quotes and error literals', async () => {
    const assembled = await evalQuery(
      '[:k ::T |~~ d ~~| ~(x) !{:k 1} [1] #[2] {:a 3} [1, 2] {"j": 4}] | tag ::quote | count');
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

describe('assembling steps by hand', () => {
  const refusal = source => evalQuery(`${source} !| type`);
  const tagOf = name => evalQuery(name);

  it('a record assembled from its fields reads back as itself', async () => {
    expect(await evalQuery('{:name :filter :args [~(gt 1)]} | tag ::call | [/] | tag ::quote | parse'))
      .toBe('filter ~(gt 1)');
  });

  it('a fail wrapper over several steps reads back as another step', async () => {
    expect(await refusal('~(a | b) | tag ::fail')).toEqual(await tagOf('::FailReadBackDiffersError'));
  });

  it('a wrapper stands in the quote itself and in no container', async () => {
    expect(await refusal('[[(~(f) | tag ::each)]] | tag ::quote')).toEqual(await tagOf('::QuoteElementNotStepError'));
  });

  it('a declaration stands in a pipeline and in no container or argument head', async () => {
    expect(await refusal('[[::bind{:name :x :body 1}]] | tag ::quote')).toEqual(await tagOf('::QuoteElementNotStepError'));
    expect(await refusal('::call{:name :f :args [::bind{:name :x :body 1}]}'))
      .toEqual(await tagOf('::CallPayloadNotSchemaError'));
  });

  it('the body of a declaration may be a command with its modifiers', async () => {
    expect(await evalQuery('::bind{:name :six :body ::call{:name :add :args [1]}} | [/] | tag ::quote | parse'))
      .toBe(':six add 1');
  });

  it('a keyword body reads back as a keyword of its own', async () => {
    expect(await refusal('::bind{:name :s :body :active}')).toEqual(await tagOf('::BindReadBackDiffersError'));
  });

  it('a payload that opens with a digit reads back into the tag name', async () => {
    expect(await evalQuery('::tagged{:tag ::T :payload 42} !| /printed')).toBe('::T42');
  });

  it('a value of another tag is no step', async () => {
    expect(await evalQuery('::tagged{:tag ::T :payload ::Box[1]} !| [type /field]'))
      .toEqual(await evalQuery('[::TaggedPayloadNotSchemaError :payload]'));
  });

  it('an error under another tag is no step', async () => {
    expect(await refusal('[("x" | add 1)] | tag ::quote')).toEqual(await tagOf('::QuoteElementNotStepError'));
  });

  it('a required field left out does not fit the schema', async () => {
    expect(await evalQuery('::call{:args []} !| [type /field /actualType]'))
      .toEqual(await evalQuery('[::CallPayloadNotSchemaError :name ::null]'));
  });

  it('an index, a tag name and calls and projections inside a container are steps', async () => {
    expect(await evalQuery('::proj{:path [:items 0]} | [/] | tag ::quote | parse')).toBe('/items/0');
    expect(await evalQuery('::bind{:name ::Point :body {:x 0}} | [/] | tag ::quote | parse')).toBe('::Point {:x 0}');
    expect(await evalQuery('~([count /a]) | filter ~(true) | parse')).toBe('[count /a]');
  });

  it('a documented as stands in a pipeline and in no container', async () => {
    expect(await refusal('[[(~(|~~ note ~~| as :x) | first)]] | tag ::quote'))
      .toEqual(await tagOf('::QuoteElementNotStepError'));
  });

  it('a payload that is no Map names no field', async () => {
    expect(await evalQuery('[1] | tag ::proj !| [type /field]'))
      .toEqual(await evalQuery('[::ProjPayloadNotSchemaError null]'));
  });
});

describe('printing steps read from text', () => {
  it('a documented as keeps its doc in front', async () => {
    expect(await evalQuery('~(|~~ note ~~| as :x) | parse')).toBe('|~~ note ~~| as :x');
  });

  it('a key that is no bare name prints quoted, a namespaced one behind a colon', async () => {
    expect(await evalQuery('~(/"a b") | parse')).toBe('/"a b"');
    expect(await evalQuery('~(/:ns/name) | parse')).toBe('/:ns/name');
  });

  it('a quote read from text keeps the tree it was read from', () => {
    const quote = quoteOfSource('add 1');
    expect(isQuote(quote)).toBe(true);
    expect(printQuoteSource(quote)).toBe('add 1');
  });
});
