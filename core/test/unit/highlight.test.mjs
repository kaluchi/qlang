// `tokenize` backs every painter of source, the site's, the command line's,
// the language server's and the editor's: each token named by what it writes
// in the language, one sense to a kind, the gaps between them their whitespace,
// their combinators and their punctuation, a source that does not parse
// painted up to where its parse stopped, and every character of the source
// covered once [D371].

import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/highlight.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { verbNames } from '../../src/nouns.mjs';

let verbNamesOfTheRoot;
async function rootVerbNames() {
  if (verbNamesOfTheRoot === undefined) verbNamesOfTheRoot = verbNames(await langRuntime());
  return verbNamesOfTheRoot;
}

function expectCoversInputExactly(tokens, src) {
  let cursor = 0;
  for (const tok of tokens) {
    expect(tok.start).toBe(cursor);
    expect(tok.end).toBeGreaterThan(tok.start);
    cursor = tok.end;
  }
  expect(cursor).toBe(src.length);
}

// Each token as the text it covers and its kind, a token inside a quote
// marked by its italics, the whitespace aside.
const painted = async src => tokenize(src, await rootVerbNames())
  .filter(token => token.kind !== 'whitespace')
  .map(token => [src.slice(token.start, token.end), token.italic ? `${token.kind} italic` : token.kind]);

describe('tokenize — empty and whitespace-only inputs', () => {
  it('returns the empty token stream for the empty source', async () => {
    expect(tokenize('', await rootVerbNames())).toEqual([]);
  });

  it('returns a single whitespace token for whitespace-only source', async () => {
    const tokens = tokenize('   ', await rootVerbNames());
    expect(tokens).toEqual([{ start: 0, end: 3, kind: 'whitespace' }]);
  });
});

describe('tokenize — a literal by the kind of its value', () => {
  it('paints a string with its quotes', async () => {
    expect(tokenize('"hello"', await rootVerbNames())).toEqual([
      { start: 0, end: 7, kind: 'string' }
    ]);
  });

  it('paints a number, a boolean and null each by its own kind', async () => {
    expect(await painted('[42 true false null]')).toEqual([
      ['[', 'vec'], ['42', 'number'], ['true', 'boolean'], ['false', 'boolean'], ['null', 'null'], [']', 'vec']
    ]);
  });

  it('paints a regex, its quote escape and its flags among it [QSTXT#regex]', async () => {
    const src = 'contains #"\\"\\d+"i';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens.at(-1)).toEqual({ start: 9, end: src.length, kind: 'regex' });
    expectCoversInputExactly(tokens, src);
  });

  it('paints a keyword, a key of a map and the key of a JSON map among them, as a keyword', async () => {
    expect(await painted(':foo')).toEqual([[':foo', 'keyword']]);
    expect(await painted('{:a 1}')).toEqual([['{', 'map'], [':a', 'keyword'], ['1', 'number'], ['}', 'map']]);
    expect(await painted('{"a": 1, "b": 2}')).toEqual([
      ['{', 'map'], ['"a"', 'keyword'], [':', 'punctuation'], ['1', 'number'], [',', 'punctuation'],
      ['"b"', 'keyword'], [':', 'punctuation'], ['2', 'number'], ['}', 'map']
    ]);
  });

  it('paints a tag name alone as a tag', async () => {
    expect(tokenize('::snapshot', await rootVerbNames())).toEqual([
      { start: 0, end: 10, kind: 'tag' }
    ]);
  });

  it('paints a path whole, its slashes, a quoted segment and an escaped quote among it', async () => {
    for (const src of ['/name', '/a/b/0', '/"a/b"', '/"a\\"b"', '/:a/b']) {
      expect(tokenize(src, await rootVerbNames()), src).toEqual([{ start: 0, end: src.length, kind: 'path' }]);
    }
    expect(await painted('{:name "x"} | get /name')).toContainEqual(['/name', 'path']);
  });
});

describe('tokenize — the head of a tag', () => {
  it('paints the tag a tagged literal writes at its head and descends into the payload', async () => {
    expect(await painted('::Box[~(x) ~(y)]')).toEqual([
      ['::Box', 'tag'], ['[', 'vec'], ['~(', 'quote'], ['x', 'name italic'], [')', 'quote'],
      ['~(', 'quote'], ['y', 'name italic'], [')', 'quote'], [']', 'vec']
    ]);
    expect(await painted('::Width#5')).toEqual([['::Width', 'tag'], ['#', 'punctuation'], ['5', 'number']]);
  });

  it('paints the tag an error literal writes before its bang, then its `!{` and `}`', async () => {
    const tokens = tokenize('::Oops!{:a 1}', await rootVerbNames());
    expect(tokens[0]).toEqual({ start: 0, end: 6, kind: 'tag' });
    expect(tokens[1]).toEqual({ start: 6, end: 8, kind: 'error' });
    expect(tokens.at(-1)).toEqual({ start: 12, end: 13, kind: 'error' });
  });

  it('paints `::error` written before a bang and each tag written before it as tags, the parts of the literal [QSERR#rest]', async () => {
    expect(tokenize('::error!{:k 1}', await rootVerbNames()).slice(0, 3)).toEqual([
      { start: 0, end: 7, kind: 'tag' }, { start: 7, end: 9, kind: 'error' }, { start: 9, end: 11, kind: 'keyword' }
    ]);
    expect(tokenize('::E::error!{:k 1}', await rootVerbNames()).slice(0, 3)).toEqual([
      { start: 0, end: 3, kind: 'tag' }, { start: 3, end: 10, kind: 'tag' }, { start: 10, end: 12, kind: 'error' }
    ]);
  });
});

describe('tokenize — a quote', () => {
  it('paints the `~(` and `)` of a quote upright and what it holds as the code it is, in italics', async () => {
    expect(tokenize('~(mul 2)', await rootVerbNames())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 5, kind: 'verb', italic: true },
      { start: 5, end: 6, kind: 'whitespace', italic: true },
      { start: 6, end: 7, kind: 'number', italic: true },
      { start: 7, end: 8, kind: 'quote' }
    ]);
  });

  it('paints the tilde of the short form as a quote', async () => {
    expect(tokenize('~add', await rootVerbNames())).toEqual([
      { start: 0, end: 1, kind: 'quote' },
      { start: 1, end: 4, kind: 'verb', italic: true }
    ]);
  });

  it('paints the empty quote as its `~(` and `)` alone', async () => {
    expect(tokenize('~()', await rootVerbNames())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 3, kind: 'quote' }
    ]);
  });

  it('paints the blank content of a quote as whitespace in italics', async () => {
    expect(tokenize('~( )', await rootVerbNames())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 3, kind: 'whitespace', italic: true },
      { start: 3, end: 4, kind: 'quote' }
    ]);
  });
});

describe('tokenize — the name of a call by what it reaches', () => {
  it('paints the name of a word of the root as a verb, a call by its address among them [D371]', async () => {
    expect(await painted('count')).toEqual([['count', 'verb']]);
    expect(await painted('[1] | vec/count')).toContainEqual(['vec/count', 'verb']);
    expect(await painted('[1] | vec/sort')).toContainEqual(['vec/sort', 'verb']);
  });

  it('paints any other name as a name, a call by an address no word of the root stands at among them, its last name one\'s [D371]', async () => {
    expect(await painted('myVerb')).toEqual([['myVerb', 'name']]);
    expect(await painted('Box/area')).toEqual([['Box/area', 'name']]);
    expect(await painted('[1] | string/sort')).toContainEqual(['string/sort', 'name']);
  });

  it('paints the name a declaration writes as a declaration', async () => {
    expect(await painted(':x 1 | x')).toEqual([[':x', 'declaration'], ['1', 'number'], ['|', 'punctuation'], ['x', 'name']]);
  });
});

describe('tokenize — comments and docs', () => {
  it('paints a comment to the end of its line as a comment', async () => {
    const src = '|~| short note |~|';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[0].kind).toBe('comment');
  });

  it('paints a doc as a doc, apart from a comment', async () => {
    const src = '|~~ a doc ~~| |~ a comment ~|';
    expect(await painted(src)).toEqual([['|~~ a doc ~~|', 'doc'], ['|~ a comment ~|', 'comment']]);
  });

  it('paints a block comment as a comment', async () => {
    const src = '|~ block ~|';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[0].kind).toBe('comment');
  });

  it('paints a block comment that nests another as one comment', async () => {
    const src = '|~ outer |~ inner ~| more ~|';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a block comment that holds a doc as one comment', async () => {
    const src = '|~ holds |~~ inner ~~| inline ~|';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a line-marker mention inside a block comment as one comment', async () => {
    const src = '|~ before |~| mention ~|';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });
});

describe('tokenize — the gaps between the parts', () => {
  it('paints the brackets of a vector, a set and a map each by its kind', async () => {
    expect(tokenize('[1 2 3]', await rootVerbNames()).map(t => t.kind)).toEqual([
      'vec', 'number', 'whitespace', 'number', 'whitespace', 'number', 'vec'
    ]);
    expect(await painted('#[:a]')).toEqual([['#[', 'set'], [':a', 'keyword'], [']', 'set']]);
    expect(await painted('{ }')).toEqual([['{', 'map'], ['}', 'map']]);
  });

  it('paints the `!{` and the `}` of an error literal as an error', async () => {
    const tokens = tokenize('!{:a 1}', await rootVerbNames());
    expect(tokens[0]).toEqual({ start: 0, end: 2, kind: 'error' });
    expect(tokens.at(-1)).toEqual({ start: 6, end: 7, kind: 'error' });
  });

  it('paints the combinator `!|` as the fail track, a pipe written before it a punctuation', async () => {
    expect(await painted('1 !| get /k')).toEqual([['1', 'number'], ['!|', 'fail'], ['get', 'verb'], ['/k', 'path']]);
    expect(await painted('"x" | add 1 | !| 0')).toContainEqual(['!|', 'fail']);
  });

  it('paints the pipe and the commas of a JSON literal as punctuation', async () => {
    expect(await painted('[1, 2] | count')).toEqual([['[', 'vec'], ['1', 'number'], [',', 'punctuation'], ['2', 'number'], [']', 'vec'], ['|', 'punctuation'], ['count', 'verb']]);
  });

  it('paints the parentheses of a group as a group, a modifier\'s and the first one touching its name among them', async () => {
    expect(await painted('take (count | sub 1)')).toEqual([
      ['take', 'verb'], ['(', 'group'], ['count', 'verb'], ['|', 'punctuation'], ['sub', 'verb'], ['1', 'number'], [')', 'group']
    ]);
    expect(await painted('filter(gt 1)')).toEqual([['filter', 'verb'], ['(', 'group'], ['gt', 'verb'], ['1', 'number'], [')', 'group']]);
  });

  it('paints no parenthesis where the steps of a body begun on a later line stand in a group the text writes none of [QSSYN#line]', async () => {
    expect(await painted('[1 2 3] | :vec/f\n  ~(get /1) | count')).toEqual([
      ['[', 'vec'], ['1', 'number'], ['2', 'number'], ['3', 'number'], [']', 'vec'], ['|', 'punctuation'], [':vec/f', 'declaration'],
      ['~(', 'quote'], ['get', 'verb italic'], ['/1', 'path italic'], [')', 'quote'], ['|', 'punctuation'], ['count', 'verb']
    ]);
  });
});

describe('tokenize — coverage invariant', () => {
  it('every byte of `[1 2 3] | filter ~(gt 1) | count` lies inside exactly one token', async () => {
    const src = '[1 2 3] | filter ~(gt 1) | count';
    const tokens = tokenize(src, await rootVerbNames());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of `{:name "alice" :tags #[:a :b]}` lies inside exactly one token', async () => {
    const src = '{:name "alice" :tags #[:a :b]}';
    const tokens = tokenize(src, await rootVerbNames());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of a multi-line query with a comment lies inside exactly one token', async () => {
    const src = '[1 2 3]\n  |~| keep big ones |~|\n  | filter ~(gt 1)';
    const tokens = tokenize(src, await rootVerbNames());
    expectCoversInputExactly(tokens, src);
  });

  it('leaves no token of no character between two quotes of a doc that touch', async () => {
    const src = '|~~ ~(a)~(b) ~~|';
    expectCoversInputExactly(tokenize(src, await rootVerbNames()), src);
  });
});

describe('tokenize — a source that does not parse', () => {
  it('paints a source cut short through the closers that complete it [QSSYN#refusal]', async () => {
    expect(tokenize('(unclosed', await rootVerbNames())).toEqual([
      { start: 0, end: 1, kind: 'group' },
      { start: 1, end: 9, kind: 'name' }
    ]);
  });

  it('paints a string cut short as far as it is written', async () => {
    expect(tokenize('"abc', await rootVerbNames())).toEqual([{ start: 0, end: 4, kind: 'string' }]);
  });

  it('paints a refused source up to the refusal, the rest unparsed', async () => {
    const src = '{:a 1 | zz) 5';
    const tokens = tokenize(src, await rootVerbNames());
    expect(tokens[1]).toEqual({ start: 1, end: 3, kind: 'keyword' });
    expect(tokens.at(-1)).toEqual({ start: src.indexOf('|'), end: src.length, kind: 'unparsed' });
  });

  it('passes a throw of the parser that is no refusal of the text as it is, the overflow of the stack of a deep nest among it [D367]', async () => {
    let thrown = null;
    try { tokenize('['.repeat(20000) + ']'.repeat(20000), await rootVerbNames()); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(RangeError);
  });

  it('leaves a source no prefix of which completes unparsed', async () => {
    expect(tokenize(')))', await rootVerbNames())).toEqual([{ start: 0, end: 3, kind: 'unparsed' }]);
    expect(tokenize('[[[[[1 )', await rootVerbNames())).toEqual([{ start: 0, end: 8, kind: 'unparsed' }]);
  });

  it('paints a source refused after a line doc whose `~(` reads as no code up to where its reading stopped [D367]', async () => {
    const src = '[|~~| x ~(a\n 1 2 , 3]';
    expect(tokenize(src, await rootVerbNames()).map(token => [src.slice(token.start, token.end), token.kind])).toEqual([
      ['[', 'vec'], ['|~~| x ~(a', 'doc'], ['\n ', 'whitespace'], ['1', 'number'], [' ', 'whitespace'], ['2', 'number'], [' ', 'whitespace'], [', 3]', 'unparsed']
    ]);
  });
});

describe('tokenize — the code a doc holds', () => {
  // Only the prose of a doc paints as a doc: its quotes and its spans between
  // backquotes paint as the code they are [D371].

  it('paints a quote of the prose as code', async () => {
    expect(await painted('|~~ see ~(add 1) ~~|')).toEqual([
      ['|~~ see ', 'doc'], ['~(', 'quote'], ['add', 'verb italic'], ['1', 'number italic'], [')', 'quote'], [' ~~|', 'doc']
    ]);
  });

  it('paints the tags written before a quote of the prose as tags', async () => {
    expect(await painted('|~~ see ::link~(::qlang | doc) b ~~|')).toEqual([
      ['|~~ see ', 'doc'], ['::link', 'tag'], ['~(', 'quote'], ['::qlang', 'tag italic'], ['|', 'punctuation italic'], ['doc', 'verb italic'], [')', 'quote'], [' b ~~|', 'doc']
    ]);
    expect(await painted('|~~| ::A::B~(1)')).toEqual([['|~~| ', 'doc'], ['::A::B', 'tag'], ['~(', 'quote'], ['1', 'number italic'], [')', 'quote']]);
  });

  it('paints a span between backquotes as the code it spells', async () => {
    expect(await painted('|~~ a `count` b ~~|')).toEqual([['|~~ a `', 'doc'], ['count', 'verb'], ['` b ~~|', 'doc']]);
  });

  it('closes a span at a run of as many backquotes as opened it, across the lines of a block doc', async () => {
    expect(await painted('|~~ a ``"x`y" | count`` b ~~|')).toContainEqual(['count', 'verb']);
    expect(await painted('|~~ a `` b ~~|')).toEqual([['|~~ a `` b ~~|', 'doc']]);
    expect(await painted('|~~ a `[1\n2] | count` b ~~|')).toEqual([
      ['|~~ a `', 'doc'], ['[', 'vec'], ['1', 'number'], ['2', 'number'], [']', 'vec'], ['|', 'punctuation'], ['count', 'verb'], ['` b ~~|', 'doc']
    ]);
  });

  it('closes a doc inside a quote of a doc at its own marker', async () => {
    const tokens = await painted('|~~ ~(|~~ a ~~| | count) after ~~|');
    expect(tokens.at(-1)).toEqual([' after ~~|', 'doc']);
    expect(tokens).toContainEqual(['count', 'verb italic']);
  });

  it('paints a doc whose quote stands under the tag of a group or of the fail track, in a literal or a doc, its quote as code [D367]', async () => {
    for (const src of ['|~~ see ::group~(add 1) ~~|', '[|~~ ::group~(add 1) ~~|]', 'f |~~ ::fail~(add 1) ~~|', '|~~ ~([|~~ ::group~(add 1) ~~|]) ~~|']) {
      expectCoversInputExactly(tokenize(src, await rootVerbNames()), src);
      expect(await painted(src), src).toContainEqual(['add', 'verb italic']);
    }
  });
});

describe('tokenize — the docs of a slot', () => {
  // The doc literals of a declaration's slot are parts the parser reads as it
  // reads every doc, each of prose painted as one doc [D371].

  it('a doc of prose between the key and the body is one doc', async () => {
    expect(await painted(':double |~~ Doubles the input. ~~| mul 2')).toEqual([
      [':double', 'declaration'], ['|~~ Doubles the input. ~~|', 'doc'], ['mul', 'verb'], ['2', 'number']
    ]);
  });

  it('each doc of a slot is a doc of its own', async () => {
    const tokens = await painted(':double |~~ One. ~~| |~~ Two. ~~| mul 2');
    expect(tokens.filter(([, kind]) => kind === 'doc').map(([text]) => text)).toEqual(['|~~ One. ~~|', '|~~ Two. ~~|']);
  });

  it('a declaration of docs alone, with no body, paints its doc to the end of the declaration', async () => {
    expect(await painted(':forward |~~ placeholder ~~|')).toEqual([[':forward', 'declaration'], ['|~~ placeholder ~~|', 'doc']]);
  });
});
