// The colour of a terminal, the line of the REPL and an answer painted under
// `--color`, a layer over the core's `tokenize`: each kind of token in the
// escape of its colour, a token inside a quote in italics, and whitespace and
// the source past the parse written plain [QSHST#repl].
// The rules it holds: [QSWRK#tooling], [QSHST#repl].

import { describe, it, expect } from 'vitest';
import { highlightAnsi } from '../src/highlight-ansi.mjs';

const ANY_ANSI = /\x1b\[[0-9;]*m/;
const ANSI_RESET = '\x1b[0m';

const noVerbNames = new Set();

describe('highlightAnsi', () => {
  it('wraps a number, a boolean and null in the yellow escape pair', () => {
    expect(highlightAnsi('42', noVerbNames)).toBe('\x1b[33m42\x1b[0m');
    expect(highlightAnsi('true', noVerbNames)).toBe('\x1b[33mtrue\x1b[0m');
    expect(highlightAnsi('null', noVerbNames)).toBe('\x1b[33mnull\x1b[0m');
  });

  it('wraps a String literal in the green escape pair', () => {
    const out = highlightAnsi('"hi"', noVerbNames);
    expect(out).toBe('\x1b[32m"hi"\x1b[0m');
  });

  it('wraps a regex literal, its flags among it, in the bright-magenta escape pair', () => {
    const out = highlightAnsi('#"\\d+"i', noVerbNames);
    expect(out).toBe('\x1b[95m#"\\d+"i\x1b[0m');
  });

  it('paints a ~(…) Quote with green upright delimiters and italic body', () => {
    const out = highlightAnsi('~(:active)', noVerbNames);
    expect(out).toContain('\x1b[32m~(\x1b[0m');
    expect(out).toContain('\x1b[3;36m:active\x1b[0m');
    expect(out).toContain('\x1b[32m)\x1b[0m');
  });

  it('wraps a tag name in the bright-cyan tag escape', () => {
    const out = highlightAnsi('::Box', noVerbNames);
    expect(out).toBe('\x1b[96m::Box\x1b[0m');
  });

  it('wraps the ::tag head of a tagged literal and descends into the payload, every call a name where no names of verbs are handed', () => {
    const out = highlightAnsi('::Box~(mul x)', noVerbNames);
    expect(out).toContain('\x1b[96m::Box\x1b[0m');
    expect(out).toContain('\x1b[32m~(\x1b[0m');
    expect(out).toContain('\x1b[3;36mmul\x1b[0m');
    expect(out).toContain('\x1b[32m)\x1b[0m');
  });

  it('wraps a keyword and a path, which reads keys, in the cyan escape pair', () => {
    expect(highlightAnsi(':active', noVerbNames)).toBe('\x1b[36m:active\x1b[0m');
    expect(highlightAnsi('/a/b', noVerbNames)).toBe('\x1b[36m/a/b\x1b[0m');
  });

  it('wraps the call of a verb of the language in the bright-blue escape pair', () => {
    const verbNames = new Set(['count']);
    const out = highlightAnsi('count', verbNames);
    expect(out).toBe('\x1b[94mcount\x1b[0m');
  });

  it('wraps the name a declaration writes in the bold-bright-blue escape', () => {
    const out = highlightAnsi(':x 1', new Set());
    expect(out).toMatch('\x1b[1;94m:x\x1b[0m');
  });

  it('wraps a comment and the prose of a doc in the dim escape', () => {
    expect(highlightAnsi('|~| note |~|', noVerbNames)).toBe('\x1b[2m|~| note |~|\x1b[0m');
    expect(highlightAnsi('|~~ a doc ~~|', noVerbNames)).toBe('\x1b[2m|~~ a doc ~~|\x1b[0m');
  });

  it('emits whitespace verbatim with no escape sequence', () => {
    const out = highlightAnsi('[1 2]', new Set());
    expect(out).toBe('\x1b[93m[\x1b[0m\x1b[33m1\x1b[0m \x1b[33m2\x1b[0m\x1b[93m]\x1b[0m');
  });

  it('wraps `!{` / `}` error-literal brackets in bright red', () => {
    const out = highlightAnsi('!{}', new Set());
    expect(out).toBe('\x1b[91m!{\x1b[0m\x1b[91m}\x1b[0m');
  });

  it('wraps the `!|` fail-track combinator in bright red', () => {
    const out = highlightAnsi('1 !| get /k', new Set());
    expect(out).toMatch('\x1b[91m!|\x1b[0m');
  });

  it('wraps `#[` / `]` set brackets in bright green', () => {
    const out = highlightAnsi('#[:a]', new Set());
    expect(out).toMatch('\x1b[92m#[\x1b[0m');
    expect(out).toMatch('\x1b[92m]\x1b[0m');
  });

  it('keeps the braces of a map, the parentheses of a group and the pipe in the grey escape', () => {
    expect(highlightAnsi('{:a 1}', new Set())).toBe('\x1b[90m{\x1b[0m\x1b[36m:a\x1b[0m \x1b[33m1\x1b[0m\x1b[90m}\x1b[0m');
    expect(highlightAnsi('(1) | count', new Set())).toBe('\x1b[90m(\x1b[0m\x1b[33m1\x1b[0m\x1b[90m)\x1b[0m \x1b[90m|\x1b[0m \x1b[36mcount\x1b[0m');
  });

  it('always closes every escape with the reset sequence', () => {
    const out = highlightAnsi('[1 2 3] | count', new Set(['count']));
    const opens = out.match(/\x1b\[[0-9;]*m/g) ?? [];
    const resets = opens.filter((s) => s === ANSI_RESET);
    expect(opens.length).toBeGreaterThan(0);
    expect(resets.length * 2).toBe(opens.length);
  });

  it('paints a line cut short, as it is typed', () => {
    expect(highlightAnsi('(unclosed', noVerbNames)).toMatch(ANY_ANSI);
  });

  it('keeps the italics of whitespace inside a quote', () => {
    expect(highlightAnsi('~(add 1)', noVerbNames)).toContain('\x1b[3m \x1b[0m');
  });

  it('writes the source past where its parse stopped plain', () => {
    expect(highlightAnsi(')))', noVerbNames)).toBe(')))');
    expect(highlightAnsi('{:a 1 | zz) 5', noVerbNames)).toMatch(/\| zz\) 5$/);
  });
});
