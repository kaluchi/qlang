// tokenize coverage. The function backs every renderer (HTML for
// the docs site, ANSI for the CLI REPL, eventually LSP semantic
// tokens) so the contract is exercised here at the value level —
// kind classification, gap interleaving, parseError fallback, and
// the [0, src.length] coverage invariant.

import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/highlight.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { verbNames } from '../../src/runtime/nouns.mjs';

let builtinNames;
async function builtins() {
  if (builtinNames === undefined) {
    const env = await langRuntime();
    builtinNames = verbNames(env);
  }
  return builtinNames;
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

describe('tokenize — empty and whitespace-only inputs', () => {
  it('returns the empty token stream for the empty source', async () => {
    expect(tokenize('', await builtins())).toEqual([]);
  });

  it('returns a single whitespace token for whitespace-only source', async () => {
    const tokens = tokenize('   ', await builtins());
    expect(tokens).toEqual([{ start: 0, end: 3, kind: 'whitespace' }]);
  });
});

describe('tokenize — atomic literal kinds', () => {
  it('classifies a String literal including the surrounding quotes', async () => {
    expect(tokenize('"hello"', await builtins())).toEqual([
      { start: 0, end: 7, kind: 'string' }
    ]);
  });

  it('classifies a Number literal', async () => {
    expect(tokenize('42', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'number' }
    ]);
  });

  it('classifies a ~(...) QuoteLit as quote delimiters plus italic-flagged sub-tokens', async () => {
    // `~(mul 2)` — `~(` and `)` are upright `quote`-kind delimiters
    // (green); the body sub-tokenises with the regular tokeniser
    // pipeline, every inner span carrying `italic: true` so the
    // renderer composes italic on top of each kind's colour.
    expect(tokenize('~(mul 2)', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 5, kind: 'word',    italic: true },
      { start: 5, end: 6, kind: 'whitespace', italic: true },
      { start: 6, end: 7, kind: 'number',     italic: true },
      { start: 7, end: 8, kind: 'quote' }
    ]);
  });

  it('paints the tilde of the short form as the quote delimiter', async () => {
    expect(tokenize('~add', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'quote' },
      { start: 1, end: 4, kind: 'word', italic: true }
    ]);
  });

  it('paints an empty Quote body as bare delimiters with no inner span', async () => {
    // `~()` — zero-length body, sub-tokeniser returns no spans,
    // only the two delimiter spans land in the output.
    expect(tokenize('~()', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 3, kind: 'quote' }
    ]);
  });

  it('paints a blank Quote body as a single italic-whitespace span', async () => {
    // `~( )` — the empty quote; its blank body reads as no pipeline,
    // so the body sub-tokeniser emits a single whitespace-kind span
    // covering the entire body and the renderer still paints it
    // uniformly italic.
    expect(tokenize('~( )', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 3, kind: 'whitespace', italic: true },
      { start: 3, end: 4, kind: 'quote' }
    ]);
  });

  it('classifies boolean and null literals as numbers', async () => {
    expect(tokenize('true',  await builtins())[0].kind).toBe('number');
    expect(tokenize('false', await builtins())[0].kind).toBe('number');
    expect(tokenize('null',  await builtins())[0].kind).toBe('number');
  });

  it('classifies a `:name` keyword atom', async () => {
    expect(tokenize(':foo', await builtins())).toEqual([
      { start: 0, end: 4, kind: 'name' }
    ]);
  });

  it('classifies a bare `::tag` TagLit as a single tag-kind span', async () => {
    expect(tokenize('::snapshot', await builtins())).toEqual([
      { start: 0, end: 10, kind: 'tag' }
    ]);
  });

  it('classifies the `::tag` head of a TaggedLit and descends into the payload', async () => {
    const tokens = tokenize('::Box[~(x) ~(y)]', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 5, kind: 'tag' });
    expect(tokens.some(t => t.kind === 'quote')).toBe(true);
    expect(tokens.some(t => t.kind === 'vec')).toBe(true);
  });

  it('paints the tag an error literal writes before its bang, then its `!{` and `}`', async () => {
    // `::Tag!{…}` is one literal, the error whose content carries the
    // tag [D86].
    const tokens = tokenize('::Oops!{:a 1}', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 6, kind: 'tag' });
    expect(tokens[1]).toEqual({ start: 6, end: 8, kind: 'err' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 12, end: 13, kind: 'err' });
  });
});

describe('tokenize — the kind of a call\'s name', () => {
  it('the name of a word of the language resolves to `word`', async () => {
    const tokens = tokenize('count', await builtins());
    expect(tokens[0].kind).toBe('word');
  });

  it('the `let` binding-introducer resolves to `keyword`', async () => {
    const tokens = tokenize(':x 1', await builtins());
    expect(tokens.find(t => t.kind === 'keyword')).toBeDefined();
  });

  it('a user-defined name (not in builtins) resolves to `atom`', async () => {
    const tokens = tokenize('myVerb', await builtins());
    expect(tokens[0].kind).toBe('name');
  });
});

describe('tokenize — projections', () => {
  it('renders `/name` as a `punct` slash plus a `word` key', async () => {
    expect(tokenize('/name', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 5, kind: 'word' }
    ]);
  });

  it('renders `/a/b` as two slash + key pairs', async () => {
    const tokens = tokenize('/a/b', await builtins());
    expect(tokens.filter(t => t.kind === 'punct')).toHaveLength(2);
    expect(tokens.filter(t => t.kind === 'word')).toHaveLength(2);
  });

  it('handles a Projection nested in a pipeline', async () => {
    // /name follows a pipe; both the slash and the field segment
    // appear in the token stream alongside the pipeline's own
    // structural punct.
    const tokens = tokenize('{:name "x"} | /name', await builtins());
    expect(tokens.find(t => t.kind === 'word' && t.end - t.start === 4)).toBeDefined();
  });

  it('keeps a quoted segment with an inner slash as one word token', async () => {
    // `/"a/b"` is a single projection segment `a/b`; the slash inside
    // the quotes must not split it into two word tokens.
    expect(tokenize('/"a/b"', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 6, kind: 'word' }
    ]);
  });

  it('keeps an escaped quote inside a quoted segment within the segment', async () => {
    // `/"a\"b"` — the escaped `"` stays inside the one segment, so the
    // word token spans the whole `"a\"b"` slice.
    expect(tokenize('/"a\\"b"', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 7, kind: 'word' }
    ]);
  });
});

describe('tokenize — comments', () => {
  // Plain comments parse as standalone PipeStep nodes and surface
  // through walkAst. Doc comments (|~~| and |~~ ~~|) attach as
  // metadata to the next binding's `:docs` field rather than
  // appearing as walkable children, so a renderer that wants to
  // colour doc-comment text would do a separate descent into
  // binding nodes — out of scope for the parity surface this
  // module ships, parking it for a future enhancement.

  it('classifies a line plain comment as `comment`', async () => {
    const src = '|~| short note |~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0].kind).toBe('comment');
  });

  it('paints a doc literal as `comment`', async () => {
    const src = '42 | |~~ a doc ~~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens.at(-1)).toEqual({ start: 5, end: src.length, kind: 'comment' });
  });

  it('classifies a block plain comment as `comment`', async () => {
    const src = '|~ block ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0].kind).toBe('comment');
  });

  it('paints a nested-pair plain block as a single `comment` span', async () => {
    const src = '|~ outer |~ inner ~| more ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a doc-pair-mentioning plain block as one `comment` span', async () => {
    const src = '|~ holds |~~ inner ~~| inline ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a line-marker mention inside plain block as one `comment` span', async () => {
    const src = '|~ before |~| mention ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });
});

describe('tokenize — gap interleaving', () => {
  it('splits `[1 2 3]` into bracketed number sequence with `vec` openers/closers', async () => {
    const tokens = tokenize('[1 2 3]', await builtins());
    expect(tokens.map(t => t.kind)).toEqual([
      'vec', 'number', 'whitespace',
      'number', 'whitespace', 'number', 'vec'
    ]);
  });

  it('labels the `!|` fail-track combinator with kind `err`', async () => {
    const fail = tokenize('1 !| /k', await builtins());
    expect(fail.find(t => t.kind === 'err' && t.end - t.start === 2)).toBeDefined();
  });

  it('labels the `#[` set opener and matching `]` with kind `set`', async () => {
    const tokens = tokenize('#[:a]', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 2, kind: 'set' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 4, end: 5, kind: 'set' });
  });

  it('labels `{:a 1}` map braces with kind `punct`', async () => {
    const tokens = tokenize('{:a 1}', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 1, kind: 'punct' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 5, end: 6, kind: 'punct' });
  });

  it('labels the `!{` opener and matching `}` of an error literal with kind `err`', async () => {
    const tokens = tokenize('!{:a 1}', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 2, kind: 'err' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 6, end: 7, kind: 'err' });
  });

  it('splits the pipe combinator into its own punct token', async () => {
    const tokens = tokenize('1 | count', await builtins());
    expect(tokens.find(t => t.kind === 'punct' && t.end - t.start === 1)).toBeDefined();
  });
});

describe('tokenize — coverage invariant', () => {
  it('every byte of `[1 2 3] | filter ~(gt 1) | count` lies inside exactly one token', async () => {
    const src = '[1 2 3] | filter ~(gt 1) | count';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of `{:name "alice" :tags #[:a :b]}` lies inside exactly one token', async () => {
    const src = '{:name "alice" :tags #[:a :b]}';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of a multi-line query with a comment lies inside exactly one token', async () => {
    const src = '[1 2 3]\n  |~| keep big ones |~|\n  | filter ~(gt 1)';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });
});

describe('tokenize — a source that does not parse', () => {
  it('paints a source cut short through the closers that complete it [D125]', async () => {
    expect(tokenize('[unclosed', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'vec' },
      { start: 1, end: 9, kind: 'name' }
    ]);
  });

  it('paints a string cut short as far as it is written', async () => {
    expect(tokenize('"abc', await builtins())).toEqual([{ start: 0, end: 4, kind: 'string' }]);
  });

  it('paints a refused source up to the refusal, the rest as whitespace', async () => {
    const src = '{:a 1 | zz) 5';
    const tokens = tokenize(src, await builtins());
    expect(tokens[1]).toEqual({ start: 1, end: 3, kind: 'name' });
    expect(tokens.at(-1)).toEqual({ start: src.indexOf('|'), end: src.length, kind: 'whitespace' });
  });

  it('leaves a source no prefix of which completes as whitespace', async () => {
    expect(tokenize(')))', await builtins())).toEqual([{ start: 0, end: 3, kind: 'whitespace' }]);
    expect(tokenize('[[[[[1 )', await builtins())).toEqual([{ start: 0, end: 8, kind: 'whitespace' }]);
  });
});

describe('tokenize — the code a doc holds', () => {
  // Only the prose of a doc paints as a comment: its quotes and its
  // spans in backticks paint as the code they are [D83].
  const paint = async src => tokenize(src, await builtins())
    .filter(token => token.kind !== 'whitespace')
    .map(token => [src.slice(token.start, token.end), token.kind]);

  it('paints a quote of the prose as code', async () => {
    expect(await paint('|~~ see ~(add 1) ~~|')).toEqual([
      ['|~~ see ', 'comment'], ['~(', 'quote'], ['add', 'word'], ['1', 'number'], [')', 'quote'], [' ~~|', 'comment']
    ]);
  });

  it('paints a span in backticks as the code it spells', async () => {
    expect(await paint('|~~ a `count` b ~~|')).toEqual([['|~~ a `', 'comment'], ['count', 'word'], ['` b ~~|', 'comment']]);
  });

  it('closes a doc inside a quote of a doc at its own marker', async () => {
    const painted = await paint('|~~ ~(|~~ a ~~| | count) after ~~|');
    expect(painted.at(-1)).toEqual([' after ~~|', 'comment']);
    expect(painted).toContainEqual(['count', 'word']);
  });
});

describe('tokenize — the docs of a slot', () => {
  // The doc literals of a declaration's slot are the DocLit nodes the
  // tree holds for every doc [D83], so each paints as one `comment`
  // span instead of `pushGapTokens` misclassifying the prose as punct.

  it('a doc of prose between the key and the body gets one comment span', async () => {
    const src = ':double |~~ Doubles the input. ~~| mul 2';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment');
    expect(commentSpan).toBeDefined();
    expect(src.slice(commentSpan.start, commentSpan.end))
      .toMatch(/^\|~~ Doubles the input\. ~~\|/);
  });

  it('each doc of a slot gets a comment span of its own', async () => {
    const src = ':double |~~ One. ~~| |~~ Two. ~~| mul 2';
    const tokens = tokenize(src, await builtins());
    const commentSpans = tokens.filter(t => t.kind === 'comment').map(t => src.slice(t.start, t.end));
    expect(commentSpans).toEqual(['|~~ One. ~~|', '|~~ Two. ~~|']);
  });

  it('a docs-only BindStep (no body) paints its doc to the BindStep end', async () => {
    const src = ':forward |~~ placeholder ~~|';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment');
    expect(commentSpan).toBeDefined();
    expect(src.slice(commentSpan.start, commentSpan.end))
      .toBe('|~~ placeholder ~~|');
  });
});
