// The quote as a vector of steps: the values `steps.mjs` takes for steps,
// and what the constructors of the records refuse where a hand assembly
// breaks a rule of a step [D367].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { printQuoteSource } from '../../src/print-value.mjs';
import { isQuote, makeTag } from '../../src/types.mjs';

describe('the empty quote', () => {
  it('runs as the identity', async () => {
    expect(await evalQuery('5 | apply ~()')).toBe(5);
  });

  it('reads back from blank text', () => {
    expect([...parse('  ')]).toEqual([]);
  });

  it('reads back from text that holds a comment alone', () => {
    expect([...parse('|~ a note ~|')]).toEqual([]);
  });
});

describe('the steps a quote holds, each a record or a literal [D367]', () => {
  it('takes literals, containers of steps, docs, quotes and error literals, each a step at the head', async () => {
    for (const element of [':k', '::T', '|~~ d ~~|', '~(x)', '::error{:k 1}', '[1]', '#[2]', '{:a 3}', '[1, 2]', '{"j": 4}', '/a/0']) {
      expect(await evalQuery(`[${element}] | tag ::quote | count`), element).toBe(1);
    }
  });

  it('refuses a value after the head, which is no command [D367]', async () => {
    expect(await evalQuery('[[1] [2]] | tag ::quote !| get [~(type) /index]'))
      .toEqual(await evalQuery('[::quote/StepNotCommandError 1]'));
  });

  it('refuses a container holding a value with no reading as code', async () => {
    for (const container of ['{:a ::Box[1]}', '#[::Box[1]]', '{"j": ::Box[1]}']) {
      expect(await evalQuery(`[${container}] | tag(::quote) !| type`))
        .toEqual(await evalQuery('::quote/ElementNotStepError'));
    }
  });

  it('refuses an error literal holding a fact with no reading as code [D367]', async () => {
    expect(await evalQuery('{:a ::Box[1]} | tag ::error | get [~(it)] | tag ::quote !| get [~(type) /index]'))
      .toEqual(await evalQuery('[::quote/ElementNotStepError 0]'));
  });
});

describe('assembling steps by hand', () => {
  const refusal = source => evalQuery(`${source} !| type`);
  const tagOf = name => evalQuery(name);

  it('a record assembled from its fields writes the text of its step', async () => {
    expect(await evalQuery('{:name :filter :modifiers [~(gt 1)]} | tag ::call | get [~(it)] | tag ::quote | toString'))
      .toBe('filter ~(gt 1)');
  });

  it('a step of the fail track over several steps is refused [D367]', async () => {
    expect(await refusal('~(a | b) | tag ::fail')).toEqual(await tagOf('::fail/PayloadNotOneStepError'));
  });

  it('a step of the fail track stands in the quote itself and in no container', async () => {
    expect(await refusal('get [[~(~(f) | tag ::fail)]] | tag ::quote')).toEqual(await tagOf('::quote/ElementNotStepError'));
  });

  it('a declaration stands in a pipeline and in no container or modifier', async () => {
    expect(await refusal('[[::bind{:name :x :body 1}]] | tag ::quote')).toEqual(await tagOf('::quote/ElementNotStepError'));
    expect(await refusal('::call{:name :f :modifiers [::bind{:name :x :body 1}]}'))
      .toEqual(await tagOf('::call/PayloadNotSchemaError'));
  });

  it('the body of a declaration may be a command with its modifiers', async () => {
    expect(await evalQuery('::bind{:name :six :body ::call{:name :add :modifiers [1]}} | get [~(it)] | tag ::quote | toString'))
      .toBe(':six add 1');
  });

  it('a keyword or a tag name is the body of its declaration [QSSYN#line]', async () => {
    expect(await evalQuery('::bind{:name :s :body :active} | get [~(it)] | tag ::quote | toString')).toBe(':s :active');
    expect(await evalQuery('::bind{:name :s :body ::vec} | get [~(it)] | tag ::quote | toString')).toBe(':s ::vec');
  });

  it('a number payload touches its tag by `#` [QSLIT#tag]', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload 42} | get [~(it)] | tag ::quote | toString')).toBe('::T#42');
  });

  it('a value of another tag is no step', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload ::Box[1]} !| get [~(type) /field]'))
      .toEqual(await evalQuery('[::construct/PayloadNotSchemaError :payload]'));
  });

  it('an error at rest of a tag is the step of the literal that spells it', async () => {
    // The tag an error literal writes before its bang is the tag of the
    // error at rest it spells, so an error of any tag stands in a quote
    // [QSQUO#step].
    expect(await evalQuery('get [~("x" | add 1 !| minus #[:trace])] | tag ::quote | toString'))
      .toBe('::number/add/SubjectNotNumberError!{:actualType ::string}');
  });

  it('a required field left out does not fit the schema', async () => {
    expect(await evalQuery('::call{:modifiers []} !| get [~(type) /field /actualType]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError :name ::null]'));
  });

  it('an index, a tag name and calls and paths inside a container are steps', async () => {
    expect(await evalQuery('[[/items/0]] | tag ::quote | toString')).toBe('[/items/0]');
    expect(await evalQuery('::bind{:name :point :body {:x 0}} | get [~(it)] | tag ::quote | toString')).toBe(':point {:x 0}');
    expect(await evalQuery('~(get [~(count) /a]) | filter ~(true) | toString')).toBe('get [~(count) /a]');
  });

  it('a payload that is no map is refused by the role of its holder [D367]', async () => {
    expect(await evalQuery('[1] | tag ::call !| get [~(type) /expected]'))
      .toEqual(await evalQuery('[::call/PayloadKindNotTakenError #[::map]]'));
  });

  it('a literal that computes writes its template as the printer writes it, each part that computes as its quote [D367]', async () => {
    const messageOf = async query => await evalQuery(`${query} | get [~(it)] | tag ::quote !| get /message`);
    expect(await messageOf('[::call{:name :add :modifiers [1]}]')).toContain('write `get [~(add 1)]`');
    expect(await messageOf('#[::call{:name :x} 1]')).toContain('write `get #[1 ~(x)]`');
    expect(await messageOf('get [~(~(count) | tag ::group)]')).toContain('write `get [~(count)]`');
    expect(await messageOf('{:a ::call{:name :count}} | tag ::error | tag ::Foo')).toContain('write `get {:a ~(count)} | tag ::Foo | raise`');
  });

  it('searches a literal for a part that computes on the road of its text as on the road of data, the segments of a doc computing nothing [D367]', async () => {
    for (const literal of ['[|~~ ::group~(x) ~~|]', '{:k |~~ ::fail~(x) ~~|}', '#[|~~ ::group~(x) ~~|]', '::Box[|~~ ::group~(x) ~~|]', '!{:k |~~ ::group~(x) ~~|}']) {
      expect(await evalQuery(`"${literal}" | parse | :q it | first | get [~(it)] | tag ::quote | eq q`), literal).toBe(true);
    }
  });

  it('holds a literal assembled from data to the rules of a step at any depth, its parts walked by a stack of their own [D367]', async () => {
    expect(await evalQuery('6000 | range | reduce [] ~(get [/0]) | get [~(it)] | tag ::quote | count')).toBe(1);
  });

  it('a value after the head assembled from data is refused by the message of its kind [D367]', async () => {
    expect(await evalQuery('[5 ::Box] | tag ::quote !| get /message')).toBe('a tag goes over the value in the pipe by `tag`: write `tag ::Box`');
    expect(await evalQuery('[5 ~(x)] | tag ::quote !| get /message')).toBe('code runs on the value in the pipe by `apply`: write `apply ~(…)`');
  });

  it('each refusal of the constructors of the steps holds values whose print reads back, a payload of code refused as the map its record is built from [QSLIT#closed], [D367]', async () => {
    const refusals = [
      ['1 | tag ::quote', 'quote/PayloadKindNotTakenError'], ['[{:a ::Box[1]}] | tag ::quote', 'quote/ElementNotStepError'],
      ['[[1] [2]] | tag ::quote', 'quote/StepNotCommandError'], ['[[::call{:name :count}]] | tag ::quote', 'quote/LiteralComputesError'],
      ['[1] | tag ::call', 'call/PayloadKindNotTakenError'], ['{:name :f :extra 1} | tag ::call', 'call/PayloadNotSchemaError'],
      ['{:name :"a b"} | tag ::call', 'call/NameNotCallableError'], ['{:name :take :modifiers [[::call{:name :x}]]} | tag ::call', 'call/LiteralComputesError'],
      ['[1] | tag ::bind', 'bind/PayloadKindNotTakenError'], ['{:name :x} | tag ::bind', 'bind/PayloadNotSchemaError'],
      ['{:name :true :body 1} | tag ::bind', 'bind/NameNotCallableError'], ['{:name :x :body [::call{:name :y}]} | tag ::bind', 'bind/LiteralComputesError'],
      ['[1] | tag ::construct', 'construct/PayloadKindNotTakenError'], ['{:tag :Box :payload [1]} | tag ::construct', 'construct/PayloadNotSchemaError'],
      ['get {:tag ::Box :payload ~(~(x) | first)} | tag ::construct', 'construct/LiteralComputesError'],
      ['[::construct{:tag ::Box :payload ::call{:name :count}}]', 'construct/LiteralComputesError'],
      ['1 | tag ::fail', 'fail/PayloadKindNotTakenError'], ['~(a | b) | tag ::fail', 'fail/PayloadNotOneStepError'],
      ['[/a] | tag ::quote | tag ::fail', 'fail/StepNotCommandError'], ['1 | tag ::group', 'group/PayloadKindNotTakenError'],
      ['~() | tag ::group', 'group/PayloadEmptyError']
    ];
    for (const [query, address] of refusals) {
      expect(await evalQuery(`${query} !| get [~(type) ~(:e it | print | parse | open | eq e)]`), query).toEqual([makeTag(address), true]);
    }
    expect(await evalQuery('[::construct{:tag ::Box :payload ::call{:name :count}}] !| get /actualValue | type')).toEqual(makeTag('map'));
  });

  it('a call takes no field its record does not name, and a modifier that is a call takes no modifiers of its own [D367]', async () => {
    expect(await evalQuery('{:name :f :extra 1} | tag ::call !| get [~(type) /field]')).toEqual(await evalQuery('[::call/PayloadNotSchemaError :extra]'));
    expect(await evalQuery('{:name :f :modifiers [::call{:name :g :modifiers [1]}]} | tag ::call !| get [~(type) /field]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError :modifiers]'));
  });
});

describe('printing steps read from text', () => {
  it('a doc in the slot of a declaration prints in its slot', async () => {
    expect(await evalQuery('~(:x |~~ note ~~| it) | toString')).toBe(':x |~~ note ~~| it');
  });

  it('a key that is no bare name prints quoted, a keyword of names joined by a slash behind a colon', async () => {
    expect(await evalQuery('~(get /"a b") | toString')).toBe('get /"a b"');
    expect(await evalQuery('~(get /:ns/name) | toString')).toBe('get /:ns/name');
  });

  it('a quote read from text writes the text of its steps', () => {
    const quote = parse('add 1');
    expect(isQuote(quote)).toBe(true);
    expect(printQuoteSource(quote)).toBe('add 1');
  });
});
