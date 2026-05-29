// tokenize coverage. The function backs every renderer (HTML for
// the docs site, ANSI for the CLI REPL, eventually LSP semantic
// tokens) so the contract is exercised here at the value level —
// kind classification, gap interleaving, parseError fallback, and
// the [0, src.length] coverage invariant.

import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/highlight.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

let builtinNames;
async function builtins() {
  if (builtinNames === undefined) {
    const env = await langRuntime();
    builtinNames = new Set([...env.keys()]);
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

  it('classifies a ~{...} QuoteLit as quote delimiters plus italic-flagged sub-tokens', async () => {
    // `~{mul(2)}` — `~{` and `}` are upright `quote`-kind delimiters
    // (green); the body sub-tokenises with the regular tokeniser
    // pipeline, every inner span carrying `italic: true` so the
    // renderer composes italic on top of each kind's colour.
    expect(tokenize('~{mul(2)}', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 5, kind: 'operand', italic: true },
      { start: 5, end: 6, kind: 'punct',   italic: true },
      { start: 6, end: 7, kind: 'number',  italic: true },
      { start: 7, end: 8, kind: 'punct',   italic: true },
      { start: 8, end: 9, kind: 'quote' }
    ]);
  });

  it('paints an empty Quote body as bare delimiters with no inner span', async () => {
    // `~{}` — zero-length body, sub-tokeniser returns no spans,
    // only the two delimiter spans land in the output.
    expect(tokenize('~{}', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 3, kind: 'quote' }
    ]);
  });

  it('paints an unparseable Quote body as a single italic-whitespace span', async () => {
    // `~{ , }` — lone comma at the body position is not valid qlang,
    // the body sub-tokeniser catches the parse error and emits a
    // single whitespace-kind span covering the entire body so the
    // renderer still paints it uniformly italic.
    expect(tokenize('~{ , }', await builtins())).toEqual([
      { start: 0, end: 2, kind: 'quote' },
      { start: 2, end: 5, kind: 'whitespace', italic: true },
      { start: 5, end: 6, kind: 'quote' }
    ]);
  });

  it('classifies boolean and null literals as numbers', async () => {
    expect(tokenize('true',  await builtins())[0].kind).toBe('number');
    expect(tokenize('false', await builtins())[0].kind).toBe('number');
    expect(tokenize('null',  await builtins())[0].kind).toBe('number');
  });

  it('classifies a ~{:name} keyword atom', async () => {
    expect(tokenize(':foo', await builtins())).toEqual([
      { start: 0, end: 4, kind: 'atom' }
    ]);
  });

  it('classifies a ~{:@name} effect-marked keyword', async () => {
    expect(tokenize(':@log', await builtins())).toEqual([
      { start: 0, end: 5, kind: 'effect' }
    ]);
  });

  it('classifies a bare ~{::tag} BareTypeKeyword as a single tag-kind span', async () => {
    expect(tokenize('::snapshot', await builtins())).toEqual([
      { start: 0, end: 10, kind: 'tag' }
    ]);
  });

  it('classifies the ~{::tag} head of a TaggedLit and descends into the payload', async () => {
    const tokens = tokenize('::conduit[~{x} ~{y}]', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 9, kind: 'tag' });
    expect(tokens.some(t => t.kind === 'quote')).toBe(true);
    expect(tokens.some(t => t.kind === 'vec')).toBe(true);
  });
});

describe('tokenize — operand call name classification', () => {
  it('a builtin name resolves to ~{operand}', async () => {
    const tokens = tokenize('count', await builtins());
    expect(tokens[0].kind).toBe('operand');
  });

  it('the ~{let} binding-introducer resolves to ~{keyword}', async () => {
    const tokens = tokenize(':x 1', await builtins());
    expect(tokens.find(t => t.kind === 'keyword')).toBeDefined();
  });

  it('the ~{as} binding-introducer resolves to ~{keyword}', async () => {
    const tokens = tokenize('1 | as(:x)', await builtins());
    expect(tokens.find(t => t.kind === 'keyword')).toBeDefined();
  });

  it('an ~{@}-prefixed call name resolves to ~{effect}', async () => {
    const tokens = tokenize('@log', await builtins());
    expect(tokens[0].kind).toBe('effect');
  });

  it('a user-defined name (not in builtins, no ~{@}) resolves to ~{atom}', async () => {
    const tokens = tokenize('myConduit', await builtins());
    expect(tokens[0].kind).toBe('atom');
  });
});

describe('tokenize — projections', () => {
  it('renders ~{/name} as a ~{punct} slash plus an ~{operand} key', async () => {
    expect(tokenize('/name', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 5, kind: 'operand' }
    ]);
  });

  it('renders ~{/a/b} as two slash + key pairs', async () => {
    const tokens = tokenize('/a/b', await builtins());
    expect(tokens.filter(t => t.kind === 'punct')).toHaveLength(2);
    expect(tokens.filter(t => t.kind === 'operand')).toHaveLength(2);
  });

  it('handles a Projection nested in a pipeline', async () => {
    // /name follows a pipe; both the slash and the field segment
    // appear in the token stream alongside the pipeline's own
    // structural punct.
    const tokens = tokenize('{:name "x"} | /name', await builtins());
    expect(tokens.find(t => t.kind === 'operand' && t.end - t.start === 4)).toBeDefined();
  });

  it('keeps a quoted segment with an inner slash as one operand token', async () => {
    // `/"a/b"` is a single projection segment `a/b`; the slash inside
    // the quotes must not split it into two operand tokens.
    expect(tokenize('/"a/b"', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 6, kind: 'operand' }
    ]);
  });

  it('keeps an escaped quote inside a quoted segment within the segment', async () => {
    // `/"a\"b"` — the escaped `"` stays inside the one segment, so the
    // operand token spans the whole `"a\"b"` slice.
    expect(tokenize('/"a\\"b"', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 7, kind: 'operand' }
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

  it('classifies a line plain comment as ~{comment}', async () => {
    const src = '|~| short note |~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0].kind).toBe('comment');
  });

  it('classifies a block plain comment as ~{comment}', async () => {
    const src = '|~ block ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0].kind).toBe('comment');
  });

  it('paints a nested-pair plain block as a single ~{comment} span', async () => {
    const src = '|~ outer |~ inner ~| more ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a doc-pair-mentioning plain block as one ~{comment} span', async () => {
    const src = '|~ holds |~~ inner ~~| inline ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });

  it('paints a line-marker mention inside plain block as one ~{comment} span', async () => {
    const src = '|~ before |~| mention ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: src.length, kind: 'comment' });
  });
});

describe('tokenize — gap interleaving', () => {
  it('splits ~{[1 2 3]} into bracketed number sequence with ~{vec} openers/closers', async () => {
    const tokens = tokenize('[1 2 3]', await builtins());
    expect(tokens.map(t => t.kind)).toEqual([
      'vec', 'number', 'whitespace',
      'number', 'whitespace', 'number', 'vec'
    ]);
  });

  it('keeps the ~{>>} merge combinator as a single ~{punct} token', async () => {
    const merge = tokenize('1 >> 2', await builtins());
    expect(merge.find(t => t.kind === 'punct' && t.end - t.start === 2)).toBeDefined();
  });

  it('labels the ~{!|} fail-track combinator with kind ~{err}', async () => {
    const fail = tokenize('1 !| /k', await builtins());
    expect(fail.find(t => t.kind === 'err' && t.end - t.start === 2)).toBeDefined();
  });

  it('labels the ~{#[] set opener and matching ~{}} with kind ~{set}', async () => {
    const tokens = tokenize('#[:a]', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 2, kind: 'set' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 4, end: 5, kind: 'set' });
  });

  it('labels ~{{:a 1}} map braces with kind ~{punct}', async () => {
    const tokens = tokenize('{:a 1}', await builtins());
    expect(tokens[0]).toEqual({ start: 0, end: 1, kind: 'punct' });
    expect(tokens[tokens.length - 1]).toEqual({ start: 5, end: 6, kind: 'punct' });
  });

  it('labels the ~{!{} opener and matching ~{}} of an error literal with kind ~{err}', async () => {
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
  it('every byte of ~{[1 2 3] | filter(gt(1)) | count} lies inside exactly one token', async () => {
    const src = '[1 2 3] | filter(gt(1)) | count';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of ~{{:name "alice" :tags #[:a :b]}} lies inside exactly one token', async () => {
    const src = '{:name "alice" :tags #[:a :b]}';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of a multi-line query with a comment lies inside exactly one token', async () => {
    const src = '[1 2 3]\n  |~| keep big ones |~|\n  | filter(gt(1))';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });
});

describe('tokenize — parseError fallback', () => {
  it('returns a single whitespace token covering the full input on a parse failure', async () => {
    const src = '[unclosed';
    expect(tokenize(src, await builtins())).toEqual([
      { start: 0, end: src.length, kind: 'whitespace' }
    ]);
  });
});

describe('tokenize — doc-prefix spans', () => {
  // Doc-comment delimiters (`|~~ … ~~|` / `|~~| …`) do not surface as
  // standalone AST nodes — DocAttachedSequence and the inline
  // BindStep doc-prefix production both fold doc-content into a
  // plain string Vec. The grammar stamps `docPrefixStart` on the
  // wrapping AST node so the highlighter paints one contiguous
  // `comment` span over the prefix region instead of letting
  // `pushGapTokens` byte-by-byte misclassify the prose as punct.

  it('inline BindStep doc-prefix gets one comment span between key and body', async () => {
    const src = ':double |~~ Doubles the input. ~~| mul(2)';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment');
    expect(commentSpan).toBeDefined();
    expect(src.slice(commentSpan.start, commentSpan.end))
      .toMatch(/^\|~~ Doubles the input\. ~~\|/);
  });

  it('external doc-prefix on a BindStep (DocAttachedSequence path) gets one comment span before the key', async () => {
    const src = '|~~ Note. ~~|\n:double mul(2)';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment');
    expect(commentSpan).toBeDefined();
    expect(commentSpan.start).toBe(0);
    expect(src.slice(commentSpan.start, commentSpan.end))
      .toMatch(/^\|~~ Note\. ~~\|/);
  });

  it('external doc-prefix on as(:name) (DocAttachedSequence path) gets one comment span before the call', async () => {
    const src = '42\n|~~ Captured. ~~|\nas(:answer)';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment'
                                    && src.slice(t.start, t.end).startsWith('|~~ Captured'));
    expect(commentSpan).toBeDefined();
  });

  it('docs-only BindStep (no body) extends the comment span to the BindStep end', async () => {
    // `:name |~~ docs ~~|` — no body. The inline doc-prefix region
    // ends at the BindStep's own end offset (the closing `~~|`)
    // rather than a non-existent body.start.
    const src = ':forward |~~ placeholder ~~|';
    const tokens = tokenize(src, await builtins());
    const commentSpan = tokens.find(t => t.kind === 'comment');
    expect(commentSpan).toBeDefined();
    expect(src.slice(commentSpan.start, commentSpan.end))
      .toBe('|~~ placeholder ~~|');
  });
});
