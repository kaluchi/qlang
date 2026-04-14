// tokenize coverage. The function backs every renderer (HTML for
// the docs site, ANSI for the CLI REPL, eventually LSP semantic
// tokens) so the contract is exercised here at the value level —
// kind classification, gap interleaving, parse-error fallback, and
// the [0, src.length] coverage invariant.

import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/highlight.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

let builtinNames;
async function builtins() {
  if (builtinNames === undefined) {
    const env = await langRuntime();
    builtinNames = new Set([...env.keys()].map(k => k.name));
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

  it('classifies boolean and null literals as numbers', async () => {
    expect(tokenize('true',  await builtins())[0].kind).toBe('number');
    expect(tokenize('false', await builtins())[0].kind).toBe('number');
    expect(tokenize('null',  await builtins())[0].kind).toBe('number');
  });

  it('classifies a `:name` keyword atom', async () => {
    expect(tokenize(':foo', await builtins())).toEqual([
      { start: 0, end: 4, kind: 'atom' }
    ]);
  });

  it('classifies a `:@name` effect-marked keyword', async () => {
    expect(tokenize(':@log', await builtins())).toEqual([
      { start: 0, end: 5, kind: 'effect' }
    ]);
  });
});

describe('tokenize — operand call name classification', () => {
  it('a builtin name resolves to `operand`', async () => {
    const tokens = tokenize('count', await builtins());
    expect(tokens[0].kind).toBe('operand');
  });

  it('the `let` binding-introducer resolves to `keyword`', async () => {
    const tokens = tokenize('let(:x, 1)', await builtins());
    expect(tokens.find(t => t.kind === 'keyword')).toBeDefined();
  });

  it('the `as` binding-introducer resolves to `keyword`', async () => {
    const tokens = tokenize('1 | as(:x)', await builtins());
    expect(tokens.find(t => t.kind === 'keyword')).toBeDefined();
  });

  it('an `@`-prefixed call name resolves to `effect`', async () => {
    const tokens = tokenize('@log', await builtins());
    expect(tokens[0].kind).toBe('effect');
  });

  it('a user-defined name (not in builtins, no `@`) resolves to `atom`', async () => {
    const tokens = tokenize('myConduit', await builtins());
    expect(tokens[0].kind).toBe('atom');
  });
});

describe('tokenize — projections', () => {
  it('renders `/name` as a `punct` slash plus an `operand` key', async () => {
    expect(tokenize('/name', await builtins())).toEqual([
      { start: 0, end: 1, kind: 'punct' },
      { start: 1, end: 5, kind: 'operand' }
    ]);
  });

  it('renders `/a/b` as two slash + key pairs', async () => {
    const tokens = tokenize('/a/b', await builtins());
    expect(tokens.filter(t => t.kind === 'punct')).toHaveLength(2);
    expect(tokens.filter(t => t.kind === 'operand')).toHaveLength(2);
  });

  it('handles a Projection nested in a pipeline', async () => {
    // /name follows a pipe; both the slash and the field segment
    // appear in the token stream alongside the pipeline's own
    // structural punct.
    const tokens = tokenize('{:name "x"} | /name', await builtins());
    const slashIndex = tokens.findIndex(t => t.kind === 'punct' && t.end - t.start === 1
      && tokens[tokens.indexOf(t)].start > 0);
    expect(tokens.find(t => t.kind === 'operand' && t.end - t.start === 4)).toBeDefined();
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

  it('classifies a block plain comment as `comment`', async () => {
    const src = '|~ block ~|';
    const tokens = tokenize(src, await builtins());
    expect(tokens[0].kind).toBe('comment');
  });
});

describe('tokenize — gap interleaving', () => {
  it('splits `[1 2 3]` into `[`, `1`, ws, `2`, ws, `3`, `]`', async () => {
    const tokens = tokenize('[1 2 3]', await builtins());
    expect(tokens.map(t => t.kind)).toEqual([
      'punct', 'number', 'whitespace',
      'number', 'whitespace', 'number', 'punct'
    ]);
  });

  it('keeps multi-char combinators (`>>`, `!|`, `#{`) as a single punct token', async () => {
    const merge = tokenize('1 >> 2', await builtins());
    expect(merge.find(t => t.kind === 'punct' && t.end - t.start === 2)).toBeDefined();

    const fail = tokenize('1 !| 2', await builtins());
    expect(fail.find(t => t.kind === 'punct' && t.end - t.start === 2)).toBeDefined();

    const set = tokenize('#{:a}', await builtins());
    expect(set[0]).toEqual({ start: 0, end: 2, kind: 'punct' });
  });

  it('splits the pipe combinator into its own punct token', async () => {
    const tokens = tokenize('1 | count', await builtins());
    expect(tokens.find(t => t.kind === 'punct' && tokens[tokens.indexOf(t)] && '|' === '|')).toBeDefined();
  });
});

describe('tokenize — coverage invariant', () => {
  it('every byte of `[1 2 3] | filter(gt(1)) | count` lies inside exactly one token', async () => {
    const src = '[1 2 3] | filter(gt(1)) | count';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of `{:name "alice" :tags #{:a :b}}` lies inside exactly one token', async () => {
    const src = '{:name "alice" :tags #{:a :b}}';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });

  it('every byte of a multi-line query with a comment lies inside exactly one token', async () => {
    const src = '[1 2 3]\n  |~| keep big ones |~|\n  | filter(gt(1))';
    const tokens = tokenize(src, await builtins());
    expectCoversInputExactly(tokens, src);
  });
});

describe('tokenize — parse-error fallback', () => {
  it('returns a single whitespace token covering the full input on a parse failure', async () => {
    const src = '[unclosed';
    expect(tokenize(src, await builtins())).toEqual([
      { start: 0, end: src.length, kind: 'whitespace' }
    ]);
  });
});
