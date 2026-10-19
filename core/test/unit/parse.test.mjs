// The parser reads a text into the records of its steps, each a literal or
// a record its constructor built, and the parts it read beside them [D367].
// The rules it holds: [QSSYN#step], [QSSYN#line].

import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { isCallStep, isBindStep, isGroupStep, isFailStep } from '../../src/steps.mjs';
import { docText } from '../../src/print-value.mjs';
import { isKeyword, isPath, isSet, isMap, isDoc } from '../../src/types.mjs';

const stepOf = source => parse(source)[0];
const rootOf = (source, opts) => partOf(parse(source, opts));

describe('parse — the literals of atoms', () => {
  it('parses an integer', () => {
    expect(stepOf('42')).toBe(42);
  });

  it('parses a negative integer', () => {
    expect(stepOf('-7')).toBe(-7);
  });

  it('parses a decimal number', () => {
    expect(stepOf('3.14')).toBe(3.14);
  });

  it('parses a string literal', () => {
    expect(stepOf('"hello"')).toBe('hello');
  });

  it('parses an empty string literal', () => {
    expect(stepOf('""')).toBe('');
  });

  it('parses an escaped string', () => {
    expect(stepOf('"line1\\nline2"')).toBe('line1\nline2');
  });

  it('parses JSON unicode escape \\uXXXX', () => {
    expect(stepOf('"\\u0041"')).toBe('A');
  });

  it('parses JSON unicode escape for non-ASCII', () => {
    expect(stepOf('"caf\\u00e9"')).toBe('café');
  });

  it('parses JSON unicode escape \\u0000 (null byte)', () => {
    expect(stepOf('"a\\u0000b"')).toBe('a\x00b');
  });

  it('parses \\b (backspace)', () => {
    expect(stepOf('"a\\bb"')).toBe('a\bb');
  });

  it('parses \\f (form feed)', () => {
    expect(stepOf('"a\\fb"')).toBe('a\fb');
  });

  it('parses \\/ (solidus)', () => {
    expect(stepOf('"a\\/b"')).toBe('a/b');
  });

  it('rejects invalid hex in \\u escape', () => {
    expect(() => parse('"\\u00GG"')).toThrow();
  });

  it('rejects incomplete \\u escape', () => {
    expect(() => parse('"\\u00"')).toThrow();
  });

  it('parses true', () => {
    expect(stepOf('true')).toBe(true);
  });

  it('parses false', () => {
    expect(stepOf('false')).toBe(false);
  });

  it('parses null', () => {
    expect(stepOf('null')).toBe(null);
  });

  it('parses a keyword', () => {
    const step = stepOf(':name');
    expect(isKeyword(step)).toBe(true);
    expect(step.name).toBe('name');
  });

  it('parses a keyword with hyphen', () => {
    expect(stepOf(':first-name').name).toBe('first-name');
  });
});

describe('parse — Vec literal', () => {
  it('parses an empty Vec', () => {
    expect(stepOf('[]')).toEqual([]);
  });

  it('parses a Vec of numbers', () => {
    expect(stepOf('[1 2 3]')).toEqual([1, 2, 3]);
  });

  it('parses a Vec with comma separators', () => {
    expect(stepOf('[1, 2, 3]')).toHaveLength(3);
  });

  it('parses a Vec of strings', () => {
    expect(stepOf('["a" "b"]')).toEqual(['a', 'b']);
  });

  it('parses a nested Vec', () => {
    const [first, second] = stepOf('[[:a] [:b]]');
    expect(first[0].name).toBe('a');
    expect(second[0].name).toBe('b');
  });

  it('parses a nested Vec whose inner vectors hold one element each', () => {
    expect(stepOf('[[1] [2]]')).toEqual([[1], [2]]);
  });
});

describe('parse — Map literal', () => {
  it('parses an empty Map', () => {
    const step = stepOf('{}');
    expect(isMap(step)).toBe(true);
    expect(step.size).toBe(0);
  });

  it('parses a single-entry Map', () => {
    expect([...stepOf('{:name "Alice"}').keys()]).toEqual(['name']);
  });

  it('parses a multi-entry Map', () => {
    expect([...stepOf('{:name "Alice" :age 30}').keys()]).toEqual(['name', 'age']);
  });

  it('parses a Map whose value is itself a Map', () => {
    expect(isMap(stepOf('{:point {:x 1 :y 2}}').get('point'))).toBe(true);
  });
});

describe('parse — Set literal', () => {
  it('parses an empty Set', () => {
    const step = stepOf('#[]');
    expect(isSet(step)).toBe(true);
    expect(step).toHaveLength(0);
  });

  it('parses a single-element Set', () => {
    expect(isKeyword(stepOf('#[:tag]')[0])).toBe(true);
  });

  it('parses a multi-element Set with commas', () => {
    expect(stepOf('#[:a :b :c]')).toHaveLength(3);
  });
});

describe('parse — Path', () => {
  it('parses a single key path', () => {
    const step = stepOf('/name');
    expect(isPath(step)).toBe(true);
    expect(step.segments).toEqual(['name']);
  });

  it('parses a nested path', () => {
    expect(stepOf('/team/lead/email').segments).toEqual(['team', 'lead', 'email']);
  });
});

describe('parse — Call', () => {
  it('parses a bare identifier', () => {
    const step = stepOf('count');
    expect(isCallStep(step)).toBe(true);
    expect(step.get('name').name).toBe('count');
    expect(step.has('modifiers')).toBe(false);
  });

  it('parses a name nothing declares as a call', () => {
    expect(stepOf('callers').get('name').name).toBe('callers');
  });

  it('parses an identifier with _ prefix', () => {
    expect(stepOf('_private').get('name').name).toBe('_private');
  });

  it('parses a call of one modifier', () => {
    const step = stepOf('add 2');
    expect(step.get('name').name).toBe('add');
    expect(step.get('modifiers')).toEqual([2]);
  });

  it('parses a multi-arg call', () => {
    const modifiers = stepOf('mulOf /price /qty').get('modifiers');
    expect(modifiers).toHaveLength(2);
    expect(modifiers.every(isPath)).toBe(true);
  });
});

describe('parse — declarations', () => {
  it('parses :name it as a declaration over the word it', () => {
    const step = stepOf(':roster it');
    expect(isBindStep(step)).toBe(true);
    expect(step.get('name').name).toBe('roster');
    expect(step.get('body').get('name').name).toBe('it');
  });

  it('parses :name body as a declaration', () => {
    const step = stepOf(':double mul 2');
    expect(step.get('name').name).toBe('double');
    expect(step.get('body').get('name').name).toBe('mul');
  });
});

describe('parse — the body of a definition begun on a later line [QSSYN#line]', () => {
  it('runs on through a command and a step of the fail track, and ends at a value after `|`', () => {
    const [definition, value] = parse(':any/f\n  count\n  !| 0\n| [1 2]');
    const body = definition.get('body');
    expect(isGroupStep(body)).toBe(true);
    expect([isCallStep(body.payload[0]), isFailStep(body.payload[1])]).toEqual([true, true]);
    expect(value).toEqual([1, 2]);
  });
});

describe('parse — Pipeline composition', () => {
  it('parses a two-step pipeline', () => {
    const quote = parse('[1 2 3] | count');
    expect(quote).toHaveLength(2);
    expect(quote[0]).toEqual([1, 2, 3]);
    expect(isCallStep(quote[1])).toBe(true);
  });

  it('parses a declaration of it inside a pipeline', () => {
    const quote = parse('foo | :snapshot it | bar');
    expect(quote).toHaveLength(3);
    expect(quote[1].get('name').name).toBe('snapshot');
  });

  it('parses :name body as a declaration inside a pipeline', () => {
    const quote = parse('items | :total count | total');
    expect(isBindStep(quote[1])).toBe(true);
    expect(quote[1].get('name').name).toBe('total');
  });
});

describe('parse — groups', () => {
  it('parses a parenthesized sub-pipeline', () => {
    const step = stepOf('([1 2] | map ~(add 1))');
    expect(isGroupStep(step)).toBe(true);
    expect(step.payload).toHaveLength(2);
  });

  it('parses a group as a step inside an outer pipeline', () => {
    expect(isGroupStep(parse('xs | (:elem it | get {:k /id :v ~(elem)})')[1])).toBe(true);
  });
});

describe('parse — comments and whitespace', () => {
  it('reads a line comment as whitespace and keeps it on the side', () => {
    const source = `|~| this is a comment
      | [1 2 3] | count`;
    expect(parse(source)[0]).toEqual([1, 2, 3]);
    expect(rootOf(source).comments.map(comment => [comment.type, comment.content]))
      .toEqual([['LinePlainComment', ' this is a comment']]);
  });

  it('handles multi-line pipelines', () => {
    expect(parse(`
      [1 2 3 4 5]
        | filter ~(gt 2)
        | count
    `)).toHaveLength(3);
  });

  it('reads a comment where a word would touch another as no pipe', () => {
    expect(isCallStep(stepOf('|~ note ~| count'))).toBe(true);
    expect(isFailStep(stepOf('(|~ note ~| !| 0)').payload[0])).toBe(true);
    expect(() => parse('[1] |~ note ~| count')).toThrow(ParseError);
    expect(isCallStep(parse('[1] | |~ note ~| count')[1])).toBe(true);
    expect(isBindStep(stepOf('|~ note ~| :x |~~| about x\n1'))).toBe(true);
  });

  it('reads a source of comments alone as the empty pipeline', () => {
    expect(parse('|~ only a note ~|')).toHaveLength(0);
    expect(rootOf('|~ only a note ~|').comments).toHaveLength(1);
  });
});

describe('parse — error handling', () => {
  it('rejects non-string input', () => {
    expect(() => parse(42)).toThrow(ParseError);
  });

  it('throws ParseError on syntax errors', () => {
    expect(() => parse('[1 2')).toThrow(ParseError);
  });

  it('refuses a leading combinator and an explicit combinator on the first step after a comment head', () => {
    expect(() => parse('(!| |~| note\n| count)')).toThrow(ParseError);
    expect(() => parse('!| |~ one ~| |~ two ~| | count')).toThrow(ParseError);
    expect(isFailStep(stepOf('!| |~ note ~| count'))).toBe(true);
  });

  it('attaches a location to ParseError', () => {
    try {
      parse('{:k}');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.location).toBeTruthy();
    }
  });

  // A refusal lists its continuations as literals and as parts of the
  // grammar named in the words of the language, no class of characters
  // among them [QSSYN#refusal].
  it('lists no class of characters among the continuations of a refusal [QSSYN#refusal]', () => {
    for (const source of ['"\\u12"', '#"a', '#"a")', '(|~~| a', '(|~~| ``a', '[|~~ a', '|~~ ~("[.']) {
      let refusal = null;
      try { parse(source); } catch (e) { refusal = e; }
      expect(refusal, source).toBeInstanceOf(ParseError);
      expect(refusal.expected.filter(alternative => alternative.type === 'class'), source).toEqual([]);
    }
  });

  const refusalOf = source => { try { parse(source); } catch (e) { return e; } return null; };

  it('names the prose of a doc beside the literals it may meet, so a source cut short in its quote names the bracket it left open [QSSYN#refusal]', () => {
    expect(refusalOf('|~~ mentions |').expected.map(alternative => alternative.text ?? alternative.description))
      .toEqual(expect.arrayContaining(['character of prose', '::', '~(', '`', '|~~|', '|~|', '|~~', '|~', '~|', '~~|']));
    expect(refusalOf('~(|~~ see ::vec~(').message).toBe('`~(` opened at line 1, column 16 is never closed; `)~~|)` completes the source');
  });

  it('says what could stand where the reading stopped as `:expected` names it, and what stood there [QSSYN#refusal]', () => {
    expect(refusalOf('"a" | :').message).toBe('Expected "\\"" or name but end-of-source found.');
    expect(refusalOf('"\\u12"').message).toBe('Expected hexadecimal digit but "\\"" found.');
    expect(refusalOf('#"a")').message).toBe('Expected end-of-source, flag of a regex or whitespace but ")" found.');
  });

  it('refuses a rule of a step its constructor holds at the part it names, with the rule\'s message [D367]', () => {
    const refused = refusalOf('5 | [1 2]');
    expect(refused.message).toBe('a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([4, 9]);
    expect(refusalOf('[::Box[x] 1]').message).toContain('write `get [::Box[~(x)] 1]`');
  });

  it('refuses the name of a declaration at its name and its body at its body [D367]', () => {
    const spanOf = refused => [refused.location.start.offset, refused.location.end.offset];
    expect(spanOf(refusalOf(':"a b" 5'))).toEqual([0, 6]);
    expect(spanOf(refusalOf(':x [y]'))).toEqual([3, 6]);
  });

  it('refuses a value after the head by the message of its kind [QSSYN#step]', () => {
    for (const [source, message] of [
      ['5 | /a', 'a path is a value, which the verb that takes it reads: write `get /a`'],
      ['5 | ::Box', 'a tag goes over the value in the pipe by `tag`: write `tag ::Box`'],
      ['5 | ~(x)', 'code runs on the value in the pipe by `apply`: write `apply ~(…)`'],
      ['5 | ::Box{:a 1}', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
      ['5 | #[1]', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
      ['5 | {:a 1}', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
      ['5 | 6', 'a step is a command: a value stands at the head, where it is the subject, or as what a verb takes']
    ]) expect(refusalOf(source).message, source).toBe(message);
  });

  it('refuses a literal step that computes where it is read, before a fault later in its pipeline [D367]', () => {
    const refused = refusalOf('[x]e');
    expect(refused.message).toContain('write `get [~(x)]`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([0, 3]);
  });

  it('writes the template of a literal that computes, each part that computes as its quote [QSLIT#closed]', () => {
    expect(refusalOf('[(count) 1]').message).toContain('write `get [~(count) 1]`');
    expect(refusalOf('[~(count) x]').message).toContain('write `get [~(count) ~(x)]`');
    expect(refusalOf('{:a x}').message).toContain('write `get {:a ~(x)}`');
    expect(refusalOf('#[x 1]').message).toContain('write `get #[~(x) 1]`');
    expect(refusalOf('::Box[(add 1 | mul 2)]').message).toContain('write `get ::Box[~(add 1 | mul 2)]`');
    expect(refusalOf('::Foo!{:a (count)}').message).toContain('write `get {:a ~(count)} | tag ::Foo | raise`');
  });

  it('reads a quote of a path alone in a doc as prose [D367]', () => {
    expect([...stepOf('|~~ see ~(/a) ~~|')]).toEqual([' see ~(/a) ']);
  });

  it('answers the first rule of the steps of a pipeline in the order written but the rules a step holds itself, a modifier\'s and a group\'s among them, when it is read [D367]', () => {
    for (const [source, column] of [
      ['1 | [2] !| /a', 5], ['5 | /b !| /a', 5], ['5 | 6 | count', 5], ['5 !| /a | 6', 6], ['f 1 [x]', 5],
      ['5 | 6 | f [x]', 11], ['5 | 6 | (7 | 8)', 14], ['5 | 6 | [x]', 9], ['5 | 6 | :true 1', 9]
    ]) {
      expect(refusalOf(source).location.start.column, source).toBe(column);
    }
  });

  it('refuses a literal whose part computes under a key a later entry writes again, as the text writes it [QSLIT#closed]', () => {
    for (const source of ['{:a x :a 1}', '!{:k x :k 1}', '{"a": x, "a": 1}', '::Box{:a x :a 1}']) expect(refusalOf(source)?.message, source).toMatch(/computes nothing/);
    expect(refusalOf('{:a x :a 1}').message).toContain('write `get {:a ~(x) :a 1}`');
    expect([...stepOf('|~~ a ~({:a x :a 1}) b ~~|')]).toEqual([' a ~({:a x :a 1}) b ']);
  });

  it('reads a tag written before an error literal of the kind of errors as the tag of its error [QSERR#rest]', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('["::E::error!{:k 1}" "::error::error!{}" "::A::B::error!{}"] | map ~parse | eq [~(::E!{:k 1}) ~(!{}) ~(::A::B!{})]')).toBe(true);
    expect(isBindStep(stepOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3}'))).toBe(true);
  });

  it('refuses two texts that write one error literal by one message at one place, as the one step they are [D367]', () => {
    const [written, short] = [refusalOf('1 | ::number::error!{:k 1}'), refusalOf('1 | ::number!{:k 1}')];
    expect(written.message).toBe(short.message);
    expect(written.location.start).toEqual(short.location.start);
  });

  it('reads the quote of a doc under the tag of a group or of the fail track as a segment that computes nothing, in a literal and as a modifier [D367]', () => {
    expect(isGroupStep(stepOf('|~~ see ::group~(add 1) ~~|')[1])).toBe(true);
    for (const source of ['[|~~ ::group~(add 1) ~~|]', 'f |~~ ::fail~(x) ~~|', '{:k |~~ ::group~(x) ~~|}', '::Box[|~~ ::group~(x) ~~|]', '!{:k |~~ ::group~(x) ~~|}', '|~~ ~([|~~ ::group~(x) ~~|]) ~~|']) {
      expect(refusalOf(source), source).toBeNull();
    }
  });

  it('reads a number written with a leading zero in the quote of a doc as prose, and refuses it outside one [D367]', () => {
    for (const source of ['|~~ a ~(f 01) ~~|', '|~~ a ~(f [x] 01) ~~|', '|~~| a ~(-01.5e3) b', '|~~ ::link~(00) ~~|']) expect(stepOf(source), source).toHaveLength(1);
    expect(refusalOf('f 01').message).toBe('a number is written without a leading zero: write `1`');
  });

  it('reads a `~(` of a line doc that reads as no code to the `)` that pairs it on its line, as prose [D367]', () => {
    expect([...stepOf('|~~|~(0 | ~())')]).toEqual(['~(0 | ~())']);
    expect(refusalOf('[|~~| ~(a,\n 1) 2\n]')).toBeInstanceOf(ParseError);
  });

  it('reads a `~(` of a block doc that reads as no code to the `)` that pairs it across its lines after a line doc whose `~(` pairs none on its line [D367]', () => {
    expect(stepOf('[|~~| a ~(b\n |~~ ~(a,\n ~(add 1)) ~~|]').map(doc => [...doc])).toEqual([[' a ~(b'], [' ~(a,\n ~(add 1)) ']]);
  });

  it('reads the span of a `~(` of a line doc no further than its line, through a doc or a comment nested in it [D367]', () => {
    for (const nested of ['|~~ b\n 1 2 ~~|', '|~ b\n 1 2 ~|']) expect(refusalOf(`[|~~| a ~(f ${nested}) c\n]`)?.location.start.line, nested).toBe(2);
  });

  it('reads a `~(` of a line doc after a span of its line read as prose as it reads it with no span before it [D367]', () => {
    for (const quote of ['~(f |~~ ~(( ~~|) d', '~(f |~ ~(( ~|) d']) {
      expect([...stepOf(`(|~~| ~(a,) ${quote}\n)`).payload[0]], quote).toEqual([` ~(a,) ${quote}`]);
      expect([...stepOf(`(|~~| ${quote}\n)`).payload[0]], quote).toEqual([` ${quote}`]);
    }
  });

  it('refuses a text after a line doc whose `~(` reads as no code where its reading stopped, the span naming no continuation of its own [D367]', () => {
    const refused = refusalOf('[|~~| x ~(a\n 1 2 , 3]');
    expect([refused.location.start.offset, refused.found]).toEqual([17, ',']);
    expect([...new Set(refusalOf('[|~~| x ~(a').expected.map(alternative => alternative.text ?? alternative.description))])
      .toEqual(['letters of a name', '/', 'whitespace', ')', 'character of prose', '::', '~(', '`', ',', ']']);
  });

  it('fails the try of the quote of a doc on a rule of a step and on a refusal the grammar does not pass over there, a refusal it passes over letting the quote read as code [D367]', () => {
    for (const text of [
      '| | f', '|f', '::Box f', '::Box |~~ d ~~|', 'f |~ c', 'f | ', 'f | !| | g', 'f | | g', 'f| g', 'f |g', 'f(a)(b)', 'f a, b', '5 f', '5\nf',
      '5 |~~ d ~~|', '/ne ""', '::T(1)', '::T([1])', '::T(add 1)', '(f a, b)', '~(/a)', '~(f a, b)', '~/a', '~[1]',
      '{:a 1 "b": 2}', '{"a": 1, :b 2}', '{:k f x}', '#"("', '#{1}', '[1[2]]', 'get /a?', 'get /', 'f 01', 'f [x]', ':x [y]', ':true 1', '5 | 6', '[x]',
      'f !| /a', 'f\n:x [y]', '::Box[x]', '!{:k x}', '::E!{:k x}'
    ]) {
      expect(refusalOf(text), text).toBeInstanceOf(ParseError);
      expect([...stepOf(`|~~ a ~(${text}) b ~~|`)], text).toEqual([` a ~(${text}) b `]);
      if (!text.includes('\n')) expect([...stepOf(`|~~| a ~(${text}) b`)], text).toEqual([` a ~(${text}) b`]);
    }
    for (const text of ['/ne :x 1', '::Box :x 1', '|~~ note ~~| :x 1', ':true :x 1']) {
      expect(refusalOf(text), text).toBeInstanceOf(ParseError);
      expect(stepOf(`|~~ a ~(${text}) b ~~|`), text).toHaveLength(3);
    }
  });

  it('attaches the opts.uri to ParseError', () => {
    try {
      parse('[1 2', { uri: 'cell-7' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.uri).toBe('cell-7');
    }
  });
});

describe('parse — a `~(` of a doc that reads as prose [D367]', () => {
  it('reads as code a quote that takes a value after a declaration or after `!|`', () => {
    for (const quote of ['~(:x 1 | 5)', '~(f !| 0)']) expect(stepOf(`|~~ a ${quote} b ~~|`), quote).toHaveLength(3);
  });
});

describe('parse — the source and its name on the root of the parts', () => {
  it('records source and uri on the root', () => {
    const root = rootOf('42', { uri: 'test.qlang' });
    expect(root.source).toBe('42');
    expect(root.uri).toBe('test.qlang');
  });

  it('defaults uri to "inline" when opts not given', () => {
    expect(rootOf('42').uri).toBe('inline');
  });
});

describe('parse — quoted keyword and path segments', () => {
  it('parses :"name" as a keyword whose name equals "name"', () => {
    expect(stepOf(':"name"').name).toBe('name');
  });

  it('parses :"foo bar" with embedded space', () => {
    expect(stepOf(':"foo bar"').name).toBe('foo bar');
  });

  it('parses :"" as the empty-string keyword', () => {
    expect(stepOf(':""').name).toBe('');
  });

  it('parses :"123" with leading digit', () => {
    expect(stepOf(':"123"').name).toBe('123');
  });

  it('parses :"$ref", a keyword of a name in quotes', () => {
    expect(stepOf(':"$ref"').name).toBe('$ref');
  });

  it('parses :"with\\nnewline" honoring escape sequences', () => {
    expect(stepOf(':"with\\nnewline"').name).toBe('with\nnewline');
  });

  it('reads :name and :"name" as one name', () => {
    expect(stepOf(':name').name).toBe(stepOf(':"name"').name);
  });

  it('parses /"foo bar" as a single-key path', () => {
    expect(stepOf('/"foo bar"').segments).toEqual(['foo bar']);
  });

  it('parses /"a.b"/"$ref"/"123" as a multi-segment path', () => {
    expect(stepOf('/"a.b"/"$ref"/"123"').segments).toEqual(['a.b', '$ref', '123']);
  });

  it('parses a mixed path /name/"weird key"/age', () => {
    expect(stepOf('/name/"weird key"/age').segments).toEqual(['name', 'weird key', 'age']);
  });

  it('parses a Map literal with quoted keys', () => {
    expect([...stepOf('{:"key one" 1 :"123" 2}').keys()]).toEqual(['key one', '123']);
  });
});

describe('parse — the span of each part', () => {
  it('keeps the span of every step and modifier it read', () => {
    const [call] = rootOf('add 2 3').parts;
    expect([call.span.start.offset, call.span.end.offset]).toEqual([0, 7]);
    expect([call.parts[0].span.start.offset, call.parts[0].span.end.offset]).toEqual([4, 5]);
  });

  it('spans the text each part read', () => {
    const source = '[1 2] | filter ~(gt 0)';
    const root = rootOf(source);
    expect(source.substring(root.span.start.offset, root.span.end.offset)).toBe(source);
    expect(root.parts[1].parts.map(modifier => source.slice(modifier.span.start.offset, modifier.span.end.offset))).toEqual(['~(gt 0)']);
  });

  it('keeps a part for each key and value of a map, as they are written', () => {
    const source = '{:a 1 :a 2}';
    expect(rootOf(source).parts[0].parts.map(read => source.slice(read.span.start.offset, read.span.end.offset))).toEqual([':a', '1', ':a', '2']);
  });
});

describe('parse — path with digit-led / hyphen-led bare segments', () => {
  it('parses `/0` as a single-segment path with key "0"', () => {
    expect(stepOf('/0').segments).toEqual(['0']);
  });

  it('parses `/-1` as a single-segment path with key "-1"', () => {
    expect(stepOf('/-1').segments).toEqual(['-1']);
  });

  it('parses `/items/0/name` as a three-segment mixed path', () => {
    expect(stepOf('/items/0/name').segments).toEqual(['items', '0', 'name']);
  });

  it('parses `/rows/-1/0` as a three-segment mixed path with negative index', () => {
    expect(stepOf('/rows/-1/0').segments).toEqual(['rows', '-1', '0']);
  });

  it('bare digit-led segments only appear inside paths, not as keyword literals', () => {
    // `:0` remains a parse error — keyword literals still require
    // IdentStart. JSON numeric keys reach qlang as keyword values via
    // parseJson / object-literal parsing, not via `:0` source syntax.
    expect(() => parse(':0')).toThrow(ParseError);
  });
});

describe('parse — a map literal takes whitespace around the colon of a string key', () => {
  it('accepts whitespace between string key and colon (strict-JSON compat)', () => {
    const step = stepOf('{ "name" : "alice" }');
    expect([...step.keys()]).toEqual(['name']);
    expect(step.get('name')).toBe('alice');
  });

  it('accepts whitespace around colon with digit-led string key', () => {
    expect(stepOf('{ "0" : [0, 1] }').get('0')).toEqual([0, 1]);
  });

  it('accepts newline between string key and colon', () => {
    expect(stepOf('{"name"\n:\n"alice"}').get('name')).toBe('alice');
  });

  it('keyword-form still requires at least one whitespace between key and value', () => {
    // `:name"alice"` with no space would be ambiguous; the keyword form
    // uses `__` (required whitespace). Verify the separation is still
    // enforced so we do not accidentally relax the keyword entry rule.
    expect(() => parse('{:name"alice"}')).toThrow(ParseError);
  });
});

describe('parse — Unicode identifiers (UAX #31 ID_Start / ID_Continue)', () => {
  it('parses a Cyrillic bare keyword', () => {
    expect(stepOf(':имя').name).toBe('имя');
  });

  it('parses a CJK bare keyword', () => {
    expect(stepOf(':元素').name).toBe('元素');
  });

  it('parses a Greek bare keyword', () => {
    expect(stepOf(':αβγ').name).toBe('αβγ');
  });

  it('parses a Cyrillic path segment', () => {
    expect(stepOf('/имя').segments).toEqual(['имя']);
  });

  it('parses a multi-segment Cyrillic path', () => {
    expect(stepOf('/пользователь/имя').segments).toEqual(['пользователь', 'имя']);
  });

  it('parses a mixed Cyrillic + ASCII path', () => {
    expect(stepOf('/user/имя').segments).toEqual(['user', 'имя']);
  });

  it('accepts digits and hyphens in Unicode identifiers (ID_Continue)', () => {
    expect(stepOf(':пользователь-42').name).toBe('пользователь-42');
  });

  it('parses the Cyrillic name of a call', () => {
    expect(stepOf('посчитать(1)').get('name').name).toBe('посчитать');
  });

  it('parses a keyword of Cyrillic names joined by a slash', () => {
    expect(stepOf(':проект/пользователь').name).toBe('проект/пользователь');
  });

  it('rejects a digit as the start of a name', () => {
    expect(() => parse(':1name')).toThrow(ParseError);
  });

  it('rejects a bracket or a punctuation mark as the start of a name (not in ID_Start)', () => {
    expect(() => parse(':<tag')).toThrow(ParseError);
    expect(() => parse(':{key')).toThrow(ParseError);
    expect(() => parse(':!sigil')).toThrow(ParseError);
  });

  it('accepts digits and hyphens mid-identifier (ID_Continue)', () => {
    expect(stepOf(':имя42').name).toBe('имя42');
    expect(stepOf(':item-01').name).toBe('item-01');
  });

  it('supplementary-plane characters (emoji) fall through to the quoted form', () => {
    // The bare form rejects the surrogate pair — peggy's `.` matches one
    // UTF-16 code unit, so 🙂 (2 code units) does not satisfy IdentStart.
    expect(() => parse(':🙂')).toThrow(ParseError);
    // The quoted form accepts it verbatim.
    expect(stepOf(':"🙂"').name).toBe('🙂');
  });
});

describe('parse.mjs — input guards and the location of a ParseError', () => {
  it('refuses undefined as a source, which is no string', () => {
    expect(() => parse(undefined)).toThrow(/string source/);
  });

  const thrownBy = source => { try { parse(source); } catch (e) { return e; } return null; };
  const nestOf = (depth, missing = 0) => '['.repeat(depth) + ']'.repeat(depth - missing);

  it('passes a throw of the parser or of a constructor of a step that is no refusal of the text as it is, the overflow of the stack of a deep nest among it [D367]', () => {
    expect(thrownBy(nestOf(20000))).toBeInstanceOf(RangeError);
    for (let depth = 1000; depth < 4000; depth += 50) expect(thrownBy(nestOf(depth)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short, a nest of a thousand to four thousand brackets among it [D367]', () => {
    for (let depth = 1000; depth <= 4000; depth += 25) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  }, 30000);

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short at the depth where the parser overflows [D367]', () => {
    let [read, overflown] = [1000, 20000];
    while (overflown - read > 1) {
      const depth = (read + overflown) >> 1;
      if (thrownBy(nestOf(depth)) === null) read = depth;
      else overflown = depth;
    }
    for (let depth = read - 8; depth <= read + 8; depth++) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('reads a nest of literals as deep as the parser itself reads, the parts of a literal walked by a stack of their own [D367]', () => {
    for (const depth of [2300, 2500]) expect(parse(nestOf(depth)), String(depth)).toHaveLength(1);
  });

  it('exposes ParseError with location', () => {
    try { parse('{:k}'); } catch (e) {
      expect(e.location).toBeTruthy();
    }
  });
});

describe('parse — the docs in the slot of a declaration, one doc each, and a comment between steps', () => {
  it('attaches one entry per doc comment, not concatenated', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const docsResult = await evalQuery(
      ':foo |~~| First.\n|~~| Second.\n|~~| Third.\n42 | env | get /foo | get /docs | map ~content'
    );
    expect(docsResult).toEqual([' First.', ' Second.', ' Third.']);
  });

  it('block doc preserves internal newlines as one entry', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const docsResult = await evalQuery(
      ':foo |~~ line one\nline two\nline three ~~| 42\n| env | get /foo | get /docs | map ~content'
    );
    expect(docsResult.length).toBe(1);
    expect(docsResult[0]).toContain('line one');
    expect(docsResult[0]).toContain('line two');
    expect(docsResult[0]).toContain('line three');
  });

  it('mixes line and block docs preserving order', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const docsResult = await evalQuery(
      ':foo |~~| line one\n|~~ block two ~~|\n|~~| line three\n42 | env | get /foo | get /docs | map ~content'
    );
    expect(docsResult.length).toBe(3);
    expect(docsResult[0]).toBe(' line one');
    expect(docsResult[1]).toContain('block two');
    expect(docsResult[2]).toBe(' line three');
  });

  it('shadowing redeclare overrides docs Vec', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const docsResult = await evalQuery(
      ':foo |~~| Old.\n1\n| (:foo |~~| Brand new.\n|~~| With extra remark.\n2\n| env | get /foo | get /docs | map ~content)'
    );
    expect(docsResult).toEqual([' Brand new.', ' With extra remark.']);
  });

  it('a comment is whitespace between the steps of a pipeline', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('[1 2 3] |~| inline annotation\n| count')).toBe(3);
    expect(await evalQuery('[1 2 3] |~ block annotation ~| | count')).toBe(3);
  });
});

// Recursive nesting of block-comments. The block-marker design picks
// distinct open / close forms (`|~`/`~|`, `|~~`/`~~|`) so the parser
// descends into a nested span without an escape mechanism — when
// content position sees the open of another comment, the whole pair
// (including its own balanced close) is consumed as opaque content
// of the outer body. Line markers (`|~|`, `|~~|`) collapse to their
// 3- / 4-char form inside a block; the marker has no addressable
// role there, so consuming only the marker bytes preserves the
// author's intent ("mention the spelling, not the semantics").
//
// The cases below pin: (1) every nested combination round-trips the
// outer `.content` as the verbatim source slice between delimiters;
// (2) bare close-of-other-form (`~~|` inside plain, `~|` inside
// doc) is accepted as content; (3) the container's own close still
// terminates the body; (4) every unbalanced/malformed nesting raises
// ParseError with a usable location.
describe('parse — block comment nesting', () => {
  const blockStep = (src) => rootOf(src).comments[0];

  describe('positive — content captured verbatim', () => {
    it('plain block nests plain block pair', () => {
      const step = blockStep('|~ outer |~ inner ~| more ~|\n| 42');
      expect(step.type).toBe('BlockPlainComment');
      expect(step.content).toBe(' outer |~ inner ~| more ');
    });

    it('plain block nests three deep', () => {
      const step = blockStep('|~ A |~ B |~ C ~| D ~| E ~|\n| 1');
      expect(step.type).toBe('BlockPlainComment');
      expect(step.content).toBe(' A |~ B |~ C ~| D ~| E ');
    });

    it('plain block adjacent nested pairs', () => {
      const step = blockStep('|~ |~ a ~| middle |~ b ~| ~|\n| 1');
      expect(step.content).toBe(' |~ a ~| middle |~ b ~| ');
    });

    it('plain block nests doc-pair as opaque content', () => {
      const step = blockStep('|~ wraps |~~ inner doc ~~| inside ~|\n| 1');
      expect(step.content).toBe(' wraps |~~ inner doc ~~| inside ');
    });

    it('plain block accepts bare ~~| (sibling close) as content', () => {
      const step = blockStep('|~ doc-close marker ~~| mentioned ~|\n| 1');
      expect(step.content).toBe(' doc-close marker ~~| mentioned ');
    });

    it('plain block collapses |~| line marker to 3-char content', () => {
      const step = blockStep('|~ holds a |~| line mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~| line mention here ');
    });

    it('plain block collapses |~~| line-doc marker to 4-char content', () => {
      const step = blockStep('|~ holds a |~~| line-doc mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~~| line-doc mention here ');
    });

    it('plain block preserves Quote span ~(…) verbatim with nested plain inside', () => {
      const step = blockStep('|~ wraps ~( inner |~ q ~| pipe ) closing ~|\n| 1');
      expect(step.content).toBe(' wraps ~( inner |~ q ~| pipe ) closing ');
    });

    it('plain block preserves Quote span enclosing bare ~|', () => {
      const step = blockStep('|~ keeps ~( literal ~| close ) afterward ~|\n| 1');
      expect(step.content).toBe(' keeps ~( literal ~| close ) afterward ');
    });

    it('plain block preserves newlines verbatim across deep nesting', () => {
      const src = '|~ A\n  |~ B\n    inner\n  ~|\nA-tail ~|\n| 1';
      const step = blockStep(src);
      expect(step.content).toBe(' A\n  |~ B\n    inner\n  ~|\nA-tail ');
    });

    it('plain block empty body', () => {
      expect(isDoc(stepOf('|~~|\n| count'))).toBe(true);
    });

    it('plain block with empty nested pair', () => {
      const step = blockStep('|~ before |~ ~| after ~|\n| 1');
      expect(step.content).toBe(' before |~ ~| after ');
    });

    it('doc block nests doc-pair as opaque content (attached docs)', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ outer |~~ inner ~~| more ~~| 42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' outer |~~ inner ~~| more ']);
    });

    it('doc block adjacent nested doc pairs', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ |~~ a ~~| middle |~~ b ~~| ~~| 42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' |~~ a ~~| middle |~~ b ~~| ']);
    });

    it('doc block nests plain pair as opaque content', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ holds |~ inner plain ~| inline ~~| 42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' holds |~ inner plain ~| inline ']);
    });

    it('doc block accepts bare ~| (sibling close) as content', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ plain-close marker ~| mentioned ~~| 42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' plain-close marker ~| mentioned ']);
    });

    it('doc block collapses |~| line marker to 3-char content', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ pair holds |~| line marker inline ~~| 42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' pair holds |~| line marker inline ']);
    });

    it('doc block collapses |~~| line-doc marker to 4-char content', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ pair holds |~~| line-doc marker inline ~~|\n42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' pair holds |~~| line-doc marker inline ']);
    });

    it('doc-attached block on a declaration keeps nested doc-pair verbatim', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const docs = await evalQuery(
        ':foo |~~ outer |~~ inner ~~| more ~~|\n42\n| env | get /foo | get /docs | map ~content'
      );
      expect(docs).toEqual([' outer |~~ inner ~~| more ']);
    });

    it('standalone doc captures nested doc-pair', async () => {
      const { evalQuery } = await import('../../src/session.mjs');
      const content = await evalQuery(
        '|~~ mentions |~~ inner pair ~~| inside ~~| | content'
      );
      expect(content).toBe(' mentions |~~ inner pair ~~| inside ');
    });

    it('outer close on the same line as inner-line-marker still terminates', () => {
      const step = blockStep('|~ holds |~| marker ~|\n| 1');
      expect(step.type).toBe('BlockPlainComment');
      expect(step.content).toBe(' holds |~| marker ');
    });

    it('outer close on the same line as nested closing ~~| still terminates', () => {
      const step = blockStep('|~ holds |~~ inner ~~| ~|\n| 1');
      expect(step.content).toBe(' holds |~~ inner ~~| ');
    });
  });

  describe('positive — a block comment that holds a doc marker and code', () => {
    it('reads the comment whole', () => {
      const src = [
        '|~ The refusals the guards of this source raise. Each is a tag',
        '   a doc names, `:FooError |~~ ~~|`, so the axes read it,',
        '   `::AssertionFailedError | doc`, `| source` and `| doc | laws`,',
        '   and `result !| type` reads the tag of a failure back. ~|',
        '| 42'
      ].join('\n');
      const step = blockStep(src);
      expect(step.type).toBe('BlockPlainComment');
      expect(step.content).toContain('|~~ ~~|');
      expect(step.content).toContain('::AssertionFailedError | doc');
    });
  });

  describe('negative — unbalanced or malformed nesting raises ParseError', () => {
    const expectParseFail = (src) => {
      let err = null;
      try { parse(src); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(ParseError);
      expect(err.location).toBeDefined();
      expect(err.location.start).toMatchObject({
        offset: expect.any(Number),
        line:   expect.any(Number),
        column: expect.any(Number)
      });
    };

    it('plain block with inner |~ that never closes — outer cannot find ~|', () => {
      expectParseFail('|~ outer |~ inner has no close more ~|\n| 1');
    });

    it('plain block with no closing ~| at all', () => {
      expectParseFail('|~ unterminated block\n| 1');
    });

    it('doc block with inner |~~ that never closes', () => {
      expectParseFail('|~~ outer |~~ inner-no-close more ~~|\n:foo 1\n| foo');
    });

    it('doc block with no closing ~~|', () => {
      expectParseFail('|~~ unterminated doc\n:foo 1\n| foo');
    });

    it('plain block whose inner nested plain swallows the outer close', () => {
      // `|~ A |~ B ~|` — outer takes inner pair, leaves nothing to close
      // outer.
      expectParseFail('|~ A |~ B ~|\n| 1');
    });

    it('doc block whose inner nested doc swallows the outer close', () => {
      expectParseFail('|~~ A |~~ B ~~|\n:foo 1\n| foo');
    });

    it('bare ~~| in pipeline position (no opening) is a parse error', () => {
      expectParseFail('42 | ~~|');
    });

    it('bare ~| in pipeline position (no opening) is a parse error', () => {
      expectParseFail('42 | ~|');
    });

    it('mismatched close — plain opened, doc-close attempted before plain-close', () => {
      // `|~ stuff ~~|` — `~~|` is two chars + sibling-accepted; outer plain
      // still needs `~|`. Parser consumes the bare `~~|` as content and then
      // fails when it cannot find the real plain close.
      expectParseFail('|~ stuff ~~|\n| 1');
    });
  });

  describe('round-trip — outer .content is the exact source slice between delimiters', () => {
    const cases = [
      '|~ a ~|',
      '|~ outer |~ inner ~| tail ~|',
      '|~ A |~ B |~ C ~| D ~| E ~|',
      '|~ wraps ~( inner |~ q ~| ) closing ~|',
      '|~ multi\n  line\n  with |~ nested ~| inside ~|',
      '|~~ outer |~~ inner ~~| more ~~|',
      '|~~ holds |~ plain ~| inline ~~|'
    ];

    it.each(cases)('reproduces .content from source slice — %s', (src) => {
      const content = src.startsWith('|~~') ? docText(stepOf(src + '\n| count')) : blockStep(src + '\n| count').content;
      const opener = src.startsWith('|~~') ? '|~~' : '|~';
      const closer = src.startsWith('|~~') ? '~~|' : '~|';
      expect(content).toBe(src.slice(opener.length, src.length - closer.length));
    });
  });
});
