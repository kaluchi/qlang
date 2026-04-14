// highlight-ansi coverage. The renderer is a thin paint over core's
// tokenize — every branch is the ANSI lookup or the whitespace
// pass-through, so the tests confirm token kinds → escape codes
// mapping plus the no-escape behaviour of whitespace.

import { describe, it, expect } from 'vitest';
import { highlightAnsi } from '../src/highlight-ansi.mjs';

const ANY_ANSI = /\x1b\[[0-9;]*m/;
const ANSI_RESET = '\x1b[0m';

const noBuiltins = new Set();

describe('highlightAnsi', () => {
  it('wraps a number literal in the yellow escape pair', () => {
    const out = highlightAnsi('42', noBuiltins);
    expect(out).toBe('\x1b[33m42\x1b[0m');
  });

  it('wraps a String literal in the green escape pair', () => {
    const out = highlightAnsi('"hi"', noBuiltins);
    expect(out).toBe('\x1b[32m"hi"\x1b[0m');
  });

  it('wraps a `:keyword` atom in the cyan escape pair', () => {
    const out = highlightAnsi(':active', noBuiltins);
    expect(out).toBe('\x1b[36m:active\x1b[0m');
  });

  it('wraps an `@`-prefixed call in the magenta effect escape', () => {
    const out = highlightAnsi('@log', noBuiltins);
    expect(out).toBe('\x1b[35m@log\x1b[0m');
  });

  it('wraps a builtin operand call in the blue escape pair', () => {
    const builtins = new Set(['count']);
    const out = highlightAnsi('count', builtins);
    expect(out).toBe('\x1b[34mcount\x1b[0m');
  });

  it('wraps `let` in the bold-blue keyword escape', () => {
    const out = highlightAnsi('let(:x, 1)', new Set());
    expect(out).toMatch('\x1b[1;34mlet\x1b[0m');
  });

  it('wraps a comment in the dim escape', () => {
    const out = highlightAnsi('|~| note |~|', noBuiltins);
    expect(out).toBe('\x1b[2m|~| note |~|\x1b[0m');
  });

  it('emits whitespace verbatim with no escape sequence', () => {
    const out = highlightAnsi('[1 2]', new Set());
    // Spaces inside the Vec literal must appear as-is — bracketing
    // escapes for the numbers and the brackets, no escape around
    // the whitespace token between elements.
    expect(out).toBe('\x1b[90m[\x1b[0m\x1b[33m1\x1b[0m \x1b[33m2\x1b[0m\x1b[90m]\x1b[0m');
  });

  it('always closes every escape with the reset sequence', () => {
    const out = highlightAnsi('[1 2 3] | count', new Set(['count']));
    const opens = out.match(/\x1b\[[0-9;]*m/g) ?? [];
    const resets = opens.filter((s) => s === ANSI_RESET);
    // Half of all escape tokens are resets — every coloured span
    // is opener + reset.
    expect(resets.length * 2).toBe(opens.length);
  });

  it('passes parse-error input through without escape sequences', () => {
    const out = highlightAnsi('[unclosed', noBuiltins);
    expect(out).toBe('[unclosed');
    expect(out).not.toMatch(ANY_ANSI);
  });
});
