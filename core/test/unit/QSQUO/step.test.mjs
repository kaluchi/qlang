import { describe, it, expect } from 'vitest';
import { evalPipeline } from '../../../src/eval.mjs';
import { callOf, isCallStep, isGroupStep, commandStep } from '../../../src/steps.mjs';
import { asPrinted } from '../../../src/print-value.mjs';
import { makeKeyword, makeQuote, makeTag } from '../../../src/types.mjs';
import { rootState } from '../../../src/state.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { tokenize } from '../../../src/highlight.mjs';
import { parseSource } from '../../../src/parse.mjs';
import { partOf, keepParts } from '../../../src/parsed-parts.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { rootVerbNames } from '../../helpers/root-verbs.mjs';
import { refusalOf, rootOf, kindOf } from '../../helpers/read-text.mjs';

it('runs the verb a call record names, a step no text wrote', async () => {
  const quote = makeQuote([callOf(new Map([['name', makeKeyword('count')]]), asPrinted)]);
  const state = rootState([1, 2, 3], await langRuntime());
  expect((await evalPipeline(quote, state)).pipeValue).toBe(3);
});

it('passes a throw of the parser that is no refusal of the text as it is, the overflow of the stack of a deep nest among it', async () => {
  let thrown = null;
  try { tokenize('['.repeat(20000) + ']'.repeat(20000), await rootVerbNames()); } catch (e) { thrown = e; }
  expect(thrown).toBeInstanceOf(RangeError);
});

describe('a rule of a step refused where the text writes it', () => {
  it('refuses a rule of a step its constructor holds at the part it names, with the rule\'s message', () => {
    const refused = refusalOf('5 | [1 2]');
    expect(refused.message).toBe('a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([4, 9]);
  });

  it('refuses the name of a declaration at its name and its body at its body', () => {
    const spanOf = refused => [refused.location.start.offset, refused.location.end.offset];
    expect(spanOf(refusalOf(':"a b" 5'))).toEqual([0, 6]);
    expect(spanOf(refusalOf(':x [y]'))).toEqual([3, 6]);
  });

  it('refuses a literal step that computes where it is read, before a fault later in its pipeline', () => {
    const refused = refusalOf('[x]e');
    expect(refused.message).toContain('write `get [~(x)]`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([0, 3]);
  });

  it('answers the first rule of the steps of a pipeline in the order written but the rules a step holds itself, a modifier\'s and a group\'s among them, when it is read', () => {
    for (const [source, column] of [
      ['1 | [2] !| /a', 5], ['5 | /b !| /a', 5], ['5 | 6 | count', 5], ['5 !| /a | 6', 6], ['f 1 [x]', 5],
      ['5 | 6 | f [x]', 11], ['5 | 6 | (7 | 8)', 14], ['5 | 6 | [x]', 9], ['5 | 6 | :true 1', 9]
    ]) {
      expect(refusalOf(source).location.start.column, source).toBe(column);
    }
  });

  it('refuses two texts that write one error literal by one message at one point, as the one step they are', () => {
    const [written, short] = [refusalOf('1 | ::number::error!{:k 1}'), refusalOf('1 | ::number!{:k 1}')];
    expect(written.message).toBe(short.message);
    expect(written.location.start).toEqual(short.location.start);
  });
});

describe('the source and its name on the root of the parts', () => {
  it('records source and uri on the root', () => {
    const root = rootOf('42', { uri: 'test.qlang' });
    expect(root.source).toBe('42');
    expect(root.uri).toBe('test.qlang');
  });

  it('defaults uri to "inline" when opts not given', () => {
    expect(rootOf('42').uri).toBe('inline');
  });
});

describe('the span of each part', () => {
  it('keeps the span of every step and modifier it read', () => {
    const spanOf = read => [read.span.start.offset, read.span.end.offset];
    const [call] = rootOf('add 2 3').parts;
    expect([spanOf(call), call.parts.map(spanOf)]).toEqual([[0, 7], [[4, 5], [6, 7]]]);
  });

  it('spans the text each part read', () => {
    const source = '[1 2] | filter ~(gt 0)';
    const root = rootOf(source);
    expect(source.substring(root.span.start.offset, root.span.end.offset)).toBe(source);
    expect(root.parts[1].parts.map(modifier => source.slice(modifier.span.start.offset, modifier.span.end.offset))).toEqual(['~(gt 0)']);
  });
});

describe('a throw of the parser that is no refusal, and the depth of a nest', () => {
  const thrownBy = source => { try { parseSource(source); } catch (e) { return e; } return null; };
  const nestOf = (depth, missing = 0) => '['.repeat(depth) + ']'.repeat(depth - missing);

  it('passes a throw of the parser or of a constructor of a step that is no refusal of the text as it is, the overflow of the stack of a deep nest among it', () => {
    expect(thrownBy(nestOf(20000))).toBeInstanceOf(RangeError);
    for (let depth = 1000; depth < 4000; depth += 50) expect(thrownBy(nestOf(depth)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short, a nest of a thousand to four thousand brackets among it', () => {
    for (let depth = 1000; depth <= 4000; depth += 100) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  }, 30000);

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short at the depth where the parser overflows', () => {
    let [read, overflown] = [1000, 20000];
    while (overflown - read > 1) {
      const depth = (read + overflown) >> 1;
      if (thrownBy(nestOf(depth)) === null) read = depth;
      else overflown = depth;
    }
    for (let depth = read - 8; depth <= read + 8; depth++) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('reads a nest of literals 2300 and 2500 deep, the parts of a literal read by a stack of their own', () => {
    for (const depth of [2300, 2500]) expect(parseSource(nestOf(depth)), String(depth)).toHaveLength(1);
  });
});

describe('the steps a quote holds, each a record or a literal', () => {
  it('takes literals, containers of steps, docs, quotes and error literals, each a step at the head', async () => {
    for (const element of [':k', '::T', '|~~ d ~~|', '~(x)', '::error{:k 1}', '[1]', '#[2]', '{:a 3}', '[1, 2]', '{"j": 4}', '/a/0']) {
      expect(await evalQuery(`[${element}] | tag ::quote | count`), element).toBe(1);
    }
  });

  it('refuses a container holding a value with no reading as code', async () => {
    for (const container of ['{:a ::Box[1]}', '#[::Box[1]]', '{"j": ::Box[1]}']) {
      expect(await evalQuery(`[${container}] | tag(::quote) !| tag`))
        .toEqual(await evalQuery('::quote/ElementNotStepError'));
    }
  });

  it('refuses an error literal holding a fact with no reading as code', async () => {
    expect(await evalQuery('{:a ::Box[1]} | tag ::error | get [~(it)] | tag ::quote !| get [~(tag) ~(index)]'))
      .toEqual(await evalQuery('[::quote/ElementNotStepError 0]'));
  });
});

describe('assembling steps by hand', () => {
  const refusal = source => evalQuery(`${source} !| tag`);
  const tagNamed = name => evalQuery(name);

  it('a step of the fail track stands in the quote itself and in no container', async () => {
    expect(await refusal('get [[~(~(f) | tag ::fail)]] | tag ::quote')).toEqual(await tagNamed('::quote/ElementNotStepError'));
  });

  it('a declaration stands in a pipeline and in no container or modifier', async () => {
    expect(await refusal('[[::bind{:name :x :body 1}]] | tag ::quote')).toEqual(await tagNamed('::quote/ElementNotStepError'));
    expect(await refusal('::call{:name :f :modifiers [::bind{:name :x :body 1}]}'))
      .toEqual(await tagNamed('::call/PayloadNotSchemaError'));
  });

  it('a value of another tag is no step', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload ::Box[1]} !| get [~(tag) ~(field)]'))
      .toEqual(await evalQuery('[::construct/PayloadNotSchemaError :payload]'));
  });

  it('an error at rest under the tag of its site is a value under a tag, which no text writes as a step', async () => {
    expect(await evalQuery('get [~("x" | add 1 !| payload | minus #[:trace] | tag ::number/add/SubjectNotNumberError)] | tag ::quote !| tag')).toEqual(await evalQuery('::quote/ElementNotStepError'));
    expect(await evalQuery('get {:tag ::number/add/SubjectNotNumberError :payload ~("x" | add 1 !| payload | minus #[:trace])} | tag ::construct | get [~(it)] | tag ::quote | toString'))
      .toBe('::number/add/SubjectNotNumberError!{:subject/expected #[::number] :subject/found "x"}');
  });

  it('a required field left out does not fit the schema', async () => {
    expect(await evalQuery('::call{:modifiers []} !| get [~(tag) ~(field) ~(found)]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError :name null]'));
  });

  it('an index, a tag name and calls and paths inside a container are steps', async () => {
    expect(await evalQuery('[[/items/0]] | tag ::quote | toString')).toBe('[/items/0]');
    expect(await evalQuery('[[::T]] | tag ::quote | toString')).toBe('[::T]');
    expect(await evalQuery('::bind{:name :point :body {:x 0}} | get [~(it)] | tag ::quote | toString')).toBe(':point {:x 0};');
    expect(await evalQuery('~(get [~(count) /a]) | filter ~(true) | toString')).toBe('get [~(count) /a]');
  });

  it('a literal that computes writes its template as the printer writes it, each part that computes as its quote', async () => {
    const messageOf = async query => await evalQuery(`${query} | get [~(it)] | tag ::quote !| message`);
    expect(await messageOf('[::call{:name :add :modifiers [1]}]')).toContain('write `get [~(add 1)]`');
    expect(await messageOf('#[::call{:name :x} 1]')).toContain('write `get #[1 ~(x)]`');
    expect(await messageOf('get [~(~(count) | tag ::group)]')).toContain('write `get [~(count)]`');
    expect(await evalQuery('get {:tag ::Foo :payload ~({:a ::call{:name :count}} | tag ::error)} | tag ::construct !| message')).toContain('write `get !{:a ~(count)} | tag ::Foo | raise`');
  });

  it('searches a literal for a part that computes on the road of its text as on the road of data, the segments of a doc computing nothing', async () => {
    for (const literal of ['[|~~ ::group~(x) ~~|]', '{:k |~~ ::fail~(x) ~~|}', '#[|~~ ::group~(x) ~~|]', '::Box[|~~ ::group~(x) ~~|]', '!{:k |~~ ::group~(x) ~~|}']) {
      expect(await evalQuery(`"${literal}" | parse | eq (first | get [~(it)] | tag ::quote)`), literal).toBe(true);
    }
  });

  it('holds a literal assembled from data to the rules of a step at any depth, its parts read by a stack of their own', async () => {
    expect(await evalQuery('6000 | range | reduce [] ~(get [/0]) | get [~(it)] | tag ::quote | count')).toBe(1);
  });

  it('each refusal of the constructors of the steps holds values whose print reads back, a payload of code refused as the map its record is built from', async () => {
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
      expect(await evalQuery(`${query} !| get [~(tag) ~(eq (print | parse | answer))]`), query).toEqual([makeTag(address), true]);
    }
    expect(await evalQuery('[::construct{:tag ::Box :payload ::call{:name :count}}] !| found | tag')).toEqual(makeTag('map'));
  });

  it('a call takes no field its record does not name, and a modifier that is a call takes no modifiers of its own', async () => {
    expect(await evalQuery('{:name :f :extra 1} | tag ::call !| get [~(tag) ~(field)]')).toEqual(await evalQuery('[::call/PayloadNotSchemaError :extra]'));
    expect(await evalQuery('{:name :f :modifiers [::call{:name :g :modifiers [1]}]} | tag ::call !| get [~(tag) ~(field)]'))
      .toEqual(await evalQuery('[::call/PayloadNotSchemaError :modifiers]'));
  });
});

describe('the steps of a tagged literal and of a tag', () => {
  it('a tagged literal is a `::construct` step over the step of its payload', async () => {
    expect(await evalQuery('~(::invariant~(mul 2)) | first | get [~(tag) /tag /payload]'))
      .toEqual(await evalQuery('[::construct ::invariant ~(mul 2)]'));
  });

  it('a tag alone is its name as a step', async () => {
    expect(await evalQuery('~(::Box) | first')).toEqual(makeTag('Box'));
  });
});

const valuesOf = parts => parts.map(read => read.value);

describe('the parts of a text', () => {
  it('holds a part for each step of a pipeline and each element of a vector', () => {
    const root = rootOf('[1 2 3] | count');
    expect(root.parts).toHaveLength(2);
    expect(root.parts[0].value).toEqual([1, 2, 3]);
    expect(valuesOf(root.parts[0].parts)).toEqual([1, 2, 3]);
    expect(isCallStep(root.parts[1].value)).toBe(true);
  });

  it('holds a part for each key and each value of a map, each entry of a key written again among them', () => {
    const keysAndValues = source => valuesOf(rootOf(source).parts[0].parts).map(value => value?.name ?? value);
    expect(keysAndValues('{:name "Alice" :age 30}')).toEqual(['name', 'Alice', 'age', 30]);
    expect(keysAndValues('{:a 1 :a 2}')).toEqual(['a', 1, 'a', 2]);
  });

  it('holds the name and the body of a declaration, and the modifiers of a call', () => {
    const [bind] = rootOf(':double mul 2;').parts;
    expect(kindOf(bind)).toBe('bind');
    expect(bind.parts.map(kindOf)).toEqual(['literal', 'call']);
    expect([bind.parts[0].value.name, bind.parts[1].value.get('name').name]).toEqual(['double', 'mul']);
    expect(valuesOf(bind.parts[1].parts)).toEqual([2]);
  });

  it('holds the steps of a group, its content the pipeline its parentheses hold', () => {
    const source = '(mul 2 | add 1)';
    const [group] = rootOf(source).parts;
    expect(isGroupStep(group.value)).toBe(true);
    expect(group.parts.map(kindOf)).toEqual(['call', 'call']);
    expect(source.slice(group.content.start.offset, group.content.end.offset)).toBe('mul 2 | add 1');
  });

  it('holds no part under an atom and no part for a call with no modifiers', () => {
    expect(rootOf('42').parts[0].parts).toEqual([]);
    expect(rootOf('count').parts[0].parts).toEqual([]);
  });

  it('keeps each part by the value it read, and none for a value no text wrote', () => {
    const quote = parseSource('[1 2] | count');
    expect(partOf(quote[1]).value).toBe(quote[1]);
    expect(partOf(quote[0]).parts).toHaveLength(2);
    expect(partOf(commandStep('count', []))).toBeUndefined();
  });

  it('keeps the steps of a group and of a step of the fail track by the part of the step', () => {
    const [group] = parseSource('(1 | add 1)');
    expect(partOf(group.payload)).toBe(partOf(group));
    const quote = parseSource('x !| a');
    expect(partOf(quote[1].payload)).toBe(partOf(quote[1]));
  });

  it('holds the parent of each part, the root holding none', () => {
    const root = rootOf('[1 2 3]');
    expect(root.parent).toBeNull();
    expect(root.parts[0].parent).toBe(root);
    expect(root.parts[0].parts[1].parent).toBe(root.parts[0]);
  });

  it('reads the parent of each part again from a part handed to it', () => {
    const root = rootOf('count');
    root.parts[0].parent = undefined;
    keepParts(root);
    expect(root.parts[0].parent).toBe(root);
  });
});
