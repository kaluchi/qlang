// The colour of a terminal, the line of the REPL and an answer painted under
// `--color`, a layer over the core's `tokenize`: each kind of token in the
// escape of its colour, a token inside a quote in italics, and whitespace and
// the source past the parse written plain [QSHST#repl].
// The rules it holds: [QSWRK#tooling], [QSHST#repl].

import { describe, it, expect } from 'vitest';
import { tokenize } from '@kaluchi/qlang-core/highlight';
import { highlightAnsi } from '../src/highlight-ansi.mjs';

const ESCAPE = /\x1b\[[0-9;]*m/g;
const RESET = '\x1b[0m';
const VERBS = new Set(['filter', 'count', 'gt']);
// A source that writes every kind of token but the source past a parse.
const EVERY_KIND = ':x |~~ d ~~| [null true 1 "s" #"r" :k /a ::T !{} #[1] {:a 1}] | filter ~(gt 1) !| count | (x) |~| c';

// The painted text of each token of a source, in their order.
function paintedTokens(source, verbNames) {
  let rest = highlightAnsi(source, verbNames);
  return tokenize(source, verbNames).map(token => {
    const text = source.slice(token.start, token.end);
    const painted = /^\x1b\[[0-9;]*m/.exec(rest)?.[0];
    const whole = painted === undefined ? text : `${painted}${text}${RESET}`;
    expect(rest.startsWith(whole), `${token.kind} ${JSON.stringify(text)}`).toBe(true);
    rest = rest.slice(whole.length);
    return { ...token, painted };
  });
}

describe('highlightAnsi', () => {
  it('[QSHST#repl] writes every character of the source in its order, each escape closed by the reset', () => {
    const out = highlightAnsi(EVERY_KIND, VERBS);
    expect(out.replace(ESCAPE, '')).toBe(EVERY_KIND);
    const escapes = out.match(ESCAPE);
    expect(escapes.filter(escape => escape === RESET).length * 2).toBe(escapes.length);
  });

  it('[QSHST#repl] paints each kind of the core\'s tokens in an escape of its own and the whitespace between them plain', () => {
    const tokens = paintedTokens(EVERY_KIND, VERBS);
    expect(new Set(tokens.map(token => token.kind)).size).toBeGreaterThan(20);
    for (const token of tokens) expect(token.painted === undefined, token.kind).toBe(token.kind === 'whitespace' && !token.italic);
  });

  it('[QSHST#repl] paints a call of a verb the root holds apart from a name it does not', () => {
    const [verb] = paintedTokens('count', VERBS);
    const [name] = paintedTokens('count', new Set());
    expect([verb.kind, name.kind]).toEqual(['verb', 'name']);
    expect(verb.painted).not.toBe(name.painted);
  });

  it('[QSHST#repl] lays every token inside a quote in italics, its whitespace among it, and the brackets of the quote upright', () => {
    const tokens = paintedTokens('~(add 1)', VERBS);
    for (const token of tokens) expect(/^\x1b\[3[;m]/.test(token.painted ?? ''), JSON.stringify(token)).toBe(token.italic === true);
    expect(tokens.filter(token => token.italic).map(token => token.kind)).toEqual(['name', 'whitespace', 'number']);
  });

  it('[QSHST#repl] paints a line cut short, as it is typed', () => {
    expect(highlightAnsi('(unclosed', VERBS)).toMatch(ESCAPE);
  });

  it('[QSHST#repl] writes the source past where its parse stopped plain', () => {
    expect(highlightAnsi(')))', VERBS)).toBe(')))');
    expect(highlightAnsi('{:a 1 | zz) 5', VERBS)).toMatch(/\| zz\) 5$/);
  });
});
