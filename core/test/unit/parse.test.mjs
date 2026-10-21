// The parser reads a text into the records of its steps, each a literal or
// a record its constructor built, and the parts it read beside them [QSQUO#step].
// The rules it holds: [QSSYN#step], [QSSYN#line].

import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { isCallStep, isBindStep, isConstructStep, isGroupStep, isFailStep } from '../../src/steps.mjs';

const stepOf = source => parse(source)[0];
const rootOf = (source, opts) => partOf(parse(source, opts));
const refusalOf = source => { try { parse(source); } catch (e) { return e; } return null; };

describe('parse — the literals of atoms', () => {
  it('parses JSON unicode escape \\u0000 (null byte)', () => {
    expect(stepOf('"a\\u0000b"')).toBe('a\x00b');
  });

  it('rejects invalid hex in \\u escape', () => {
    const refused = refusalOf('"\\u00GG"');
    expect(refused).toBeInstanceOf(ParseError);
    expect([refused.found, refused.expected.map(alternative => alternative.description)]).toEqual(['G', ['hexadecimal digit']]);
  });
});

describe('parse — declarations', () => {
  it('parses :name it as a declaration over the word it', () => {
    const step = stepOf(':roster it');
    expect(isBindStep(step)).toBe(true);
    expect(step.get('name').name).toBe('roster');
    expect(step.get('body').get('name').name).toBe('it');
  });

  it('reads an error literal under a tag on the line after a page as the body of its declaration [QSSYN#line], [QSERR#rest]', () => {
    const body = stepOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3}').get('body');
    expect(isConstructStep(body)).toBe(true);
    expect([body.get('tag').name, [...body.get('payload').keys()]]).toEqual(['Late', ['by']]);
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
  it('parses a declaration of it inside a pipeline', () => {
    const quote = parse('foo | :snapshot it | bar');
    expect(quote).toHaveLength(3);
    expect(isBindStep(quote[1])).toBe(true);
    expect(quote[1].get('name').name).toBe('snapshot');
  });

  it('parses :name body as a declaration inside a pipeline', () => {
    const quote = parse('items | :total count | total');
    expect(isBindStep(quote[1])).toBe(true);
    expect(quote[1].get('name').name).toBe('total');
  });
});

describe('parse — comments and whitespace', () => {
  it('keeps a line comment on the side', () => {
    const source = `|~| this is a comment
      | [1 2 3] | count`;
    expect(rootOf(source).comments.map(comment => [comment.type, comment.content]))
      .toEqual([['LinePlainComment', ' this is a comment']]);
  });

  it('reads a comment where a word would touch another as no pipe', () => {
    expect(() => parse('[1] |~ note ~| count')).toThrow('steps are joined by `|`: write `a | b`');
  });

  it('reads a declaration after a comment on its line with its doc in its slot and its body on the next line', () => {
    const declaration = stepOf('|~ note ~| :x |~~| about x\n1');
    expect(isBindStep(declaration)).toBe(true);
    expect([declaration.get('docs').map(doc => [...doc]), declaration.get('body')]).toEqual([[[' about x']], 1]);
  });

  it('keeps the comment of a source of comments alone on the side', () => {
    expect(rootOf('|~ only a note ~|').comments).toHaveLength(1);
  });
});

describe('parse — error handling', () => {
  it('refuses a leading combinator and an explicit combinator on the first step after a comment head', () => {
    const habit = '`|` written after `!|` is the habit of a pipe before every step: write `a !| b`';
    expect(() => parse('(!| |~| note\n| count)')).toThrow(habit);
    expect(() => parse('!| |~ one ~| |~ two ~| | count')).toThrow(habit);
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

  it('refuses a rule of a step its constructor holds at the part it names, with the rule\'s message [QSQUO#step]', () => {
    const refused = refusalOf('5 | [1 2]');
    expect(refused.message).toBe('a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([4, 9]);
  });

  it('refuses the name of a declaration at its name and its body at its body [QSQUO#step]', () => {
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

  it('refuses a literal step that computes where it is read, before a fault later in its pipeline [QSQUO#step]', () => {
    const refused = refusalOf('[x]e');
    expect(refused.message).toContain('write `get [~(x)]`');
    expect([refused.location.start.offset, refused.location.end.offset]).toEqual([0, 3]);
  });

  it('writes the template of a literal that computes, each part that computes as its quote [QSLIT#closed]', () => {
    expect(refusalOf('[~(count) x]').message).toContain('write `get [~(count) ~(x)]`');
    expect(refusalOf('{:a x}').message).toContain('write `get {:a ~(x)}`');
    expect(refusalOf('#[x 1]').message).toContain('write `get #[~(x) 1]`');
    expect(refusalOf('::Box[(add 1 | mul 2)]').message).toContain('write `get ::Box[~(add 1 | mul 2)]`');
    expect(refusalOf('::Foo!{:a (count)}').message).toContain('write `get {:a ~(count)} | tag ::Foo | raise`');
  });

  it('reads a quote of a path alone in a doc as prose [QSSYN#doc]', () => {
    expect([...stepOf('|~~ see ~(/a) ~~|')]).toEqual([' see ~(/a) ']);
  });

  it('answers the first rule of the steps of a pipeline in the order written but the rules a step holds itself, a modifier\'s and a group\'s among them, when it is read [QSQUO#step]', () => {
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

  it('refuses two texts that write one error literal by one message at one place, as the one step they are [QSQUO#step]', () => {
    const [written, short] = [refusalOf('1 | ::number::error!{:k 1}'), refusalOf('1 | ::number!{:k 1}')];
    expect(written.message).toBe(short.message);
    expect(written.location.start).toEqual(short.location.start);
  });

  // A literal that holds a part that computes is refused, while a quote of a
  // doc that computes fails its try and reads as prose: where the quote of a
  // doc stands outside a literal, its segments tell which it was read as.
  it('reads the quote of a doc under the tag of a group or of the fail track as a segment that computes nothing, in a literal and as a modifier [QSSLF#doc]', () => {
    const readAs = doc => [...doc].map(segment => (typeof segment === 'string' ? segment : 'code'));
    expect(isGroupStep(stepOf('|~~ see ::group~(add 1) ~~|')[1])).toBe(true);
    for (const source of ['[|~~ ::group~(add 1) ~~|]', '{:k |~~ ::group~(x) ~~|}', '::Box[|~~ ::group~(x) ~~|]', '!{:k |~~ ::group~(x) ~~|}']) {
      expect(refusalOf(source), source).toBeNull();
    }
    expect(readAs(stepOf('f |~~ ::fail~(x) ~~|').get('modifiers')[0])).toEqual([' ', 'code', ' ']);
    expect(readAs(stepOf('|~~ ~([|~~ ::group~(x) ~~|]) ~~|'))).toEqual([' ', 'code', ' ']);
  });

  it('reads a number written with a leading zero in the quote of a doc as prose [QSSYN#doc]', () => {
    for (const source of ['|~~ a ~(f 01) ~~|', '|~~ a ~(f [x] 01) ~~|', '|~~| a ~(-01.5e3) b', '|~~ ::link~(00) ~~|']) expect(stepOf(source), source).toHaveLength(1);
  });

  it('reads a `~(` of a line doc that reads as no code to the `)` that pairs it on its line, as prose [QSSYN#doc]', () => {
    expect([...stepOf('|~~|~(0 | ~())')]).toEqual(['~(0 | ~())']);
    expect(refusalOf('[|~~| ~(a,\n 1) 2\n]')).toBeInstanceOf(ParseError);
  });

  it('reads a `~(` of a block doc that reads as no code to the `)` that pairs it across its lines after a line doc whose `~(` pairs none on its line [QSSYN#doc]', () => {
    expect(stepOf('[|~~| a ~(b\n |~~ ~(a,\n ~(add 1)) ~~|]').map(doc => [...doc])).toEqual([[' a ~(b'], [' ~(a,\n ~(add 1)) ']]);
  });

  it('reads the span of a `~(` of a line doc no further than its line, through a doc or a comment nested in it [QSSYN#doc]', () => {
    for (const nested of ['|~~ b\n 1 2 ~~|', '|~ b\n 1 2 ~|']) expect(refusalOf(`[|~~| a ~(f ${nested}) c\n]`)?.location.start.line, nested).toBe(2);
  });

  it('reads a `~(` of a line doc after a span of its line read as prose as it reads it with no span before it [QSSYN#doc]', () => {
    for (const quote of ['~(f |~~ ~(( ~~|) d', '~(f |~ ~(( ~|) d']) {
      expect([...stepOf(`(|~~| ~(a,) ${quote}\n)`).payload[0]], quote).toEqual([` ~(a,) ${quote}`]);
      expect([...stepOf(`(|~~| ${quote}\n)`).payload[0]], quote).toEqual([` ${quote}`]);
    }
  });

  it('refuses a text after a line doc whose `~(` reads as no code where its reading stopped, the span naming no continuation of its own [QSSYN#doc]', () => {
    const refused = refusalOf('[|~~| x ~(a\n 1 2 , 3]');
    expect([refused.location.start.offset, refused.found]).toEqual([17, ',']);
    expect([...new Set(refusalOf('[|~~| x ~(a').expected.map(alternative => alternative.text ?? alternative.description))])
      .toEqual(['letters of a name', '/', 'whitespace', ')', 'character of prose', '::', '~(', '`', ',', ']']);
  });

  it('fails the try of the quote of a doc on a rule of a step and on a refusal the grammar does not pass over there, a refusal it passes over letting the quote read as code [QSSYN#doc]', () => {
    for (const text of [
      '| | f', '|f', '::Box f', '::Box |~~ d ~~|', 'f |~ c', 'f | ', 'f | !| | g', 'f | | g', 'f| g', 'f |g', 'f(a)(b)', 'f a, b', '5 f', '5\nf',
      '5 |~~ d ~~|', '/ne ""', '::T(1)', '::T([1])', '::T(add 1)', '(f a, b)', '~(/a)', '~(f a, b)', '~/a', '~[1]',
      '{:a 1 "b": 2}', '{"a": 1, :b 2}', '{:k f x}', '#"("', '#{1}', '[1[2]]', 'get /a?', 'get /', 'f 01', 'f [x]', ':x [y]', ':true 1', '5 | 6', '[x]',
      'f !| /a', 'f\n:x [y]', '::Box[x]', '!{:k x}', '::E!{:k x}', '.a', 'get .a', '.', 'f; g'
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

describe('parse — a `~(` of a doc that reads as prose [QSSYN#doc]', () => {
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

describe('parse — the span of each part', () => {
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

describe('parse — a map literal takes whitespace around the colon of a string key', () => {
  it('accepts whitespace between a string key and its colon', () => {
    const step = stepOf('{ "name" : "alice" }');
    expect([...step.keys()]).toEqual(['name']);
    expect(step.get('name')).toBe('alice');
  });

  it('accepts a line break between a string key and its colon', () => {
    expect(stepOf('{"name"\n:\n"alice"}').get('name')).toBe('alice');
  });

  it('refuses a keyword key that touches its value', () => {
    const refused = refusalOf('{:name"alice"}');
    expect([refused instanceof ParseError, refused?.found]).toEqual([true, '"']);
  });
});

describe('parse — Unicode identifiers (UAX #31 ID_Start / ID_Continue)', () => {
  it('refuses a digit at the start of a bare keyword', () => {
    for (const source of [':0', ':1name']) expect(() => parse(source), source).toThrow(ParseError);
  });

  it('rejects a bracket or a punctuation mark as the start of a name (not in ID_Start)', () => {
    expect(() => parse(':<tag')).toThrow(ParseError);
    expect(() => parse(':{key')).toThrow(ParseError);
    expect(() => parse(':!mark')).toThrow(ParseError);
  });

  it('reads no letter past the first plane of Unicode as the start of a bare name, and its quoted form takes it', () => {
    // The parser reads a character a UTF-16 code unit, so U+10400, a letter of
    // ID_Start past the first plane, is two units and starts no bare name.
    expect(() => parse(':\u{10400}')).toThrow(ParseError);
    expect(stepOf(':"\u{10400}"').name).toBe('\u{10400}');
  });
});

describe('parse.mjs — input guards and the depth of a nest', () => {
  it('refuses a source that is no string, a number and undefined among them', () => {
    for (const source of [42, undefined]) {
      const refused = refusalOf(source);
      expect(refused, String(source)).toBeInstanceOf(ParseError);
      expect(refused.message, String(source)).toBe('parse() expects a string source');
    }
  });

  const thrownBy = source => { try { parse(source); } catch (e) { return e; } return null; };
  const nestOf = (depth, missing = 0) => '['.repeat(depth) + ']'.repeat(depth - missing);

  it('refuses a bare nest left open of groups, quotes and maps reading each depth once [QSSYN#refusal]', () => {
    for (const nest of ['('.repeat(64) + 'x ]', '~('.repeat(64) + 'x', '{:a '.repeat(64) + '1']) expect(refusalOf(nest), nest.slice(0, 8)).toBeInstanceOf(ParseError);
  });

  it.each([
    ['calls by habit nested, left open', 'f('.repeat(19) + 'x ]'],
    ['declarations with docs nested, left open', ':vec/f |~~ d ~~| ('.repeat(9) + 'get /a'],
    ['bare names with docs nested in their docs, closed', ':x |~~ ~('.repeat(18) + '1' + ') ~~| 1'.repeat(18)],
    ['quotes of commands nested, left open', 'f ~('.repeat(12) + 'x'],
    ['quotes of templates nested, left open', 'get [~('.repeat(11) + 'x'],
    ['tags with parentheses nested, left open', '::A('.repeat(1024) + 'x'],
    ['block docs nested, left open', '|~~ a '.repeat(20)],
    ['block comments nested, left open', '|~ a '.repeat(24)],
    ['line docs in the quotes of line docs', '|~~| ' + '~(|~~| '.repeat(13) + 'x'],
    ['a run of declarations joined by pipes, their bodies on the next line', Array.from({ length: 700 }, (_, at) => `:vec/f${at}\n  ~(get /0)`).join(' |\n') + ' | [1]']
  ])('reads %s within two seconds [D404]', (_, text) => {
    const started = Date.now();
    refusalOf(text);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('passes a throw of the parser or of a constructor of a step that is no refusal of the text as it is, the overflow of the stack of a deep nest among it [QSQUO#step]', () => {
    expect(thrownBy(nestOf(20000))).toBeInstanceOf(RangeError);
    for (let depth = 1000; depth < 4000; depth += 50) expect(thrownBy(nestOf(depth)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short, a nest of a thousand to four thousand brackets among it [QSQUO#step]', () => {
    for (let depth = 1000; depth <= 4000; depth += 100) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  }, 30000);

  it('passes a throw of the parser that is no refusal of the text as it is in the completion of a source cut short at the depth where the parser overflows [QSQUO#step]', () => {
    let [read, overflown] = [1000, 20000];
    while (overflown - read > 1) {
      const depth = (read + overflown) >> 1;
      if (thrownBy(nestOf(depth)) === null) read = depth;
      else overflown = depth;
    }
    for (let depth = read - 8; depth <= read + 8; depth++) expect(thrownBy(nestOf(depth, 1)), String(depth)).not.toBeInstanceOf(TypeError);
  });

  it('reads a nest of literals 2300 and 2500 deep, the parts of a literal walked by a stack of their own [QSQUO#step]', () => {
    for (const depth of [2300, 2500]) expect(parse(nestOf(depth)), String(depth)).toHaveLength(1);
  });
});

// The nesting of block comments. A block comment and a block doc open and
// close with forms of their own, `|~`/`~|` and `|~~`/`~~|`, so the parser
// descends into a nested pair with no escape: where the content of a block
// meets the opener of another, it reads the whole pair, its own closer
// among it, as content of the outer one. A line marker, `|~|` or `|~~|`,
// inside a block is read as its own characters and hides no closer on its
// line.
//
// The tests below pin: (1) a nested pair round-trips the outer `.content`
// as the source between the delimiters; (2) a bare `~~|` inside a block
// comment is content; (3) the closer of the container ends its body; (4) a
// block doc left open is refused naming where it opened, and a block comment
// left open is refused at its opener.
describe('parse — block comment nesting', () => {
  const blockStep = (src) => rootOf(src).comments[0];

  describe('positive — content captured verbatim', () => {
    it('a block comment holds adjacent nested pairs', () => {
      const step = blockStep('|~ |~ a ~| middle |~ b ~| ~|\n| 1');
      expect(step.content).toBe(' |~ a ~| middle |~ b ~| ');
    });

    it('a block comment holds a nested doc pair as its content', () => {
      const step = blockStep('|~ wraps |~~ inner doc ~~| inside ~|\n| 1');
      expect(step.content).toBe(' wraps |~~ inner doc ~~| inside ');
    });

    it('a block comment holds a bare ~~| as its content', () => {
      const step = blockStep('|~ doc-close marker ~~| mentioned ~|\n| 1');
      expect(step.content).toBe(' doc-close marker ~~| mentioned ');
    });

    it('a |~| inside a block comment hides no closer on its line', () => {
      const step = blockStep('|~ holds a |~| line mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~| line mention here ');
    });

    it('a |~~| inside a block comment hides no closer on its line', () => {
      const step = blockStep('|~ holds a |~~| line-doc mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~~| line-doc mention here ');
    });

    it('a block comment keeps a quote span that holds a bare ~|', () => {
      const step = blockStep('|~ keeps ~( literal ~| close ) afterward ~|\n| 1');
      expect(step.content).toBe(' keeps ~( literal ~| close ) afterward ');
    });

    it('a block comment holds an empty nested pair', () => {
      const step = blockStep('|~ before |~ ~| after ~|\n| 1');
      expect(step.content).toBe(' before |~ ~| after ');
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
    const neverClosedDoc = '`|~~` opened at line 1, column 1 is never closed; `~~|` completes the source';
    const expectRefusedAt = (src, offset, found) => {
      const refused = refusalOf(src);
      expect(refused, src).toBeInstanceOf(ParseError);
      expect([refused.location.start.offset, refused.found], src).toEqual([offset, found]);
    };

    it('a block comment with no closing ~| at all is refused at its opener', () => {
      expectRefusedAt('|~ unterminated block\n| 1', 0, '|');
    });

    it('a block doc with no closing ~~| names where it opened', () => {
      expect(refusalOf('|~~ unterminated doc\n:foo 1\n| foo').message).toBe(neverClosedDoc);
    });

    it('a block comment whose inner nested comment swallows the outer close is refused at its opener', () => {
      // The inner opener of `|~ A |~ B ~|` takes the one closer, and none is left for the outer.
      expectRefusedAt('|~ A |~ B ~|\n| 1', 0, '|');
    });

    it('a block doc whose inner nested doc swallows the outer close names where it opened', () => {
      expect(refusalOf('|~~ A |~~ B ~~|\n:foo 1\n| foo').message).toBe(neverClosedDoc);
    });

    it('bare ~~| in pipeline position (no opening) is a parse error', () => {
      expectRefusedAt('42 | ~~|', 6, '~');
    });

    it('bare ~| in pipeline position (no opening) is a parse error', () => {
      expectRefusedAt('42 | ~|', 6, '|');
    });

    it('a block comment that holds a bare ~~| and no ~| of its own is refused at its opener', () => {
      expectRefusedAt('|~ stuff ~~|\n| 1', 0, '|');
    });
  });

  describe('round-trip — outer .content is the exact source slice between delimiters', () => {
    const cases = [
      '|~ a ~|',
      '|~ outer |~ inner ~| tail ~|',
      '|~ A |~ B |~ C ~| D ~| E ~|',
      '|~ wraps ~( inner |~ q ~| ) closing ~|',
      '|~ multi\n  line\n  with |~ nested ~| inside ~|'
    ];

    it.each(cases)('reproduces .content from source slice — %s', (src) => {
      expect(blockStep(src + '\n| count').content).toBe(src.slice('|~'.length, src.length - '~|'.length));
    });
  });
});
