import { describe, it, expect } from 'vitest';
import { parseArgv } from '../../src/argv.mjs';
import { tokenize } from '@kaluchi/qlang-core/highlight';
import { highlightAnsi } from '../../src/highlight-ansi.mjs';
import { resolveShouldColorize } from '../../src/main.mjs';
import { renderCellOutcome } from '../../src/render.mjs';
import { evalQuery } from '@kaluchi/qlang-core';
import { runRepl } from '../../src/repl.mjs';
import { makeCellEntry } from '../helpers/main-streams.mjs';
import { captureRepl } from '../helpers/scripted-repl.mjs';

describe('the flag --color', () => {
  it('parses --color=always as the explicit always-paint mode', () => {
    expect(parseArgv(['--color=always', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      colorMode: 'always',
      failureExitCode: 0
    });
  });

  it('parses --color=never as the explicit never-paint mode', () => {
    expect(parseArgv(['--color=never', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      colorMode: 'never',
      failureExitCode: 0
    });
  });
});

const ESCAPE = /\x1b\[[0-9;]*m/g;
const RESET = '\x1b[0m';
const VERBS = new Set(['filter', 'count', 'gt']);
const EVERY_KIND = ':x |~~ d ~~| [null true 1 "s" #"r" :k /a ::T !{} #[1] {:a 1}]; filter (gt 1) !| count | (x) |~| c';

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

describe('the layer of colour over the tokens', () => {
  it('writes every character of the source in its order, each escape closed by the reset', () => {
    const out = highlightAnsi(EVERY_KIND, VERBS);
    expect(out.replace(ESCAPE, '')).toBe(EVERY_KIND);
    const escapes = out.match(ESCAPE);
    expect(escapes.filter(escape => escape === RESET).length * 2).toBe(escapes.length);
  });

  it('paints each kind of the core\'s tokens in an escape of its own and the whitespace between them plain', () => {
    const tokens = paintedTokens(EVERY_KIND, VERBS);
    expect(new Set(tokens.map(token => token.kind)).size).toBeGreaterThan(20);
    for (const token of tokens) expect(token.painted === undefined, token.kind).toBe(token.kind === 'whitespace' && !token.italic);
  });

  it('paints a call of a verb the root holds apart from a name it does not', () => {
    const [verb] = paintedTokens('count', VERBS);
    const [name] = paintedTokens('count', new Set());
    expect([verb.kind, name.kind]).toEqual(['verb', 'name']);
    expect(verb.painted).not.toBe(name.painted);
  });

  it('lays every token inside a quote in italics, its whitespace among it, and the brackets of the quote upright', () => {
    const tokens = paintedTokens('~(add 1)', VERBS);
    for (const token of tokens) expect(/^\x1b\[3[;m]/.test(token.painted ?? ''), JSON.stringify(token)).toBe(token.italic === true);
    expect(tokens.filter(token => token.italic).map(token => token.kind)).toEqual(['name', 'whitespace', 'number']);
  });

  it('paints a line cut short, as it is typed', () => {
    expect(highlightAnsi('(unclosed', VERBS)).toMatch(ESCAPE);
  });

  it('writes the source past where its parse stopped plain', () => {
    expect(highlightAnsi(')))', VERBS)).toBe(')))');
    expect(highlightAnsi('{:a 1 | zz) 5', VERBS)).toMatch(/\| zz\) 5$/);
  });
});

describe('whether the command line paints: the flag, FORCE_COLOR, NO_COLOR and a terminal', () => {
  const ttyOut = { isTTY: true };
  const pipeOut = { isTTY: false };

  it('--color=always wins over a non-TTY stream', () => {
    expect(resolveShouldColorize('always', pipeOut, {})).toBe(true);
  });

  it('--color=never wins over a TTY stream', () => {
    expect(resolveShouldColorize('never', ttyOut, {})).toBe(false);
  });

  it('FORCE_COLOR=1 forces paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '1' })).toBe(true);
  });

  it('FORCE_COLOR set to the empty text forces paint, as it holds anything but 0', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '' })).toBe(true);
  });

  it('FORCE_COLOR=0 falls through to TTY check (not truthy as a flag)', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '0' })).toBe(false);
    expect(resolveShouldColorize('auto', ttyOut, { FORCE_COLOR: '0' })).toBe(true);
  });

  it('NO_COLOR=1 disables paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '1' })).toBe(false);
  });

  it('NO_COLOR=empty falls through to TTY check', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '' })).toBe(true);
  });

  it('--color=auto with no env defers to TTY detection — TTY → true', () => {
    expect(resolveShouldColorize('auto', ttyOut, {})).toBe(true);
  });

  it('--color=auto with no env defers to TTY detection — non-TTY → false', () => {
    expect(resolveShouldColorize('auto', pipeOut, {})).toBe(false);
  });
});

describe('the answer painted where the caller asks for colour', () => {
  it('paints the literal of an answer in ANSI where the caller asks for colour', async () => {
    const cliOutcome = await renderCellOutcome(
      await makeCellEntry({ result: new Map([['k', 1]]) }),
      { heldTheChannel: false, shouldColorize: true }
    );
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    expect(cliOutcome.stdoutText.replace(/\x1b\[[0-9;]*m/g, '')).toContain('{:k 1}');
  });

  it('paints a call an answer holds as a word of the root, a fact a refusal wires among them', async () => {
    const cellEntry = await makeCellEntry({ result: await evalQuery('~(count !| trace)') });
    const { stdoutText } = await renderCellOutcome(cellEntry, { heldTheChannel: false, shouldColorize: true });
    expect([stdoutText.includes('\x1b[3;94mcount'), stdoutText.includes('\x1b[3;94mtrace')]).toEqual([true, true]);
  });

  it('paints the failure of a query that does not parse in ANSI on stdout, exit 0', async () => {
    const cellEntry = await makeCellEntry({ result: await evalQuery('[1 2') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      heldTheChannel: false,
      shouldColorize: true
    });
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('the REPL painting its prompt, its line and its answers', () => {
  it('paints the printed result with ANSI escape sequences', async () => {
    const replHarness = captureRepl('[1 2 3]\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stdoutText()).toMatch(/\x1b\[33m/);
  });

  it('paints the prompt, the name of the language bright white and its angle bold cyan', async () => {
    const replHarness = captureRepl('.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stdoutText()).toMatch(/\x1b\[1;97mqplay/);
    expect(replHarness.stdoutText()).toMatch(/\x1b\[1;36m>/);
  });

  it('paints the line as it is typed', async () => {
    const ttyStdin = new (await import('node:stream')).PassThrough();
    ttyStdin.isTTY = true;
    ttyStdin.setRawMode = () => {};

    const stdoutChunks = [];
    const replPromise = runRepl(ttyStdin, (text) => stdoutChunks.push(text), () => {}, { terminal: ttyStdin });
    ttyStdin.write(Buffer.from('42'));
    ttyStdin.write(Buffer.from([0x03]));
    await new Promise((resolveTick) => setImmediate(resolveTick));
    ttyStdin.write(Buffer.from([0x04]));
    await replPromise;

    expect(stdoutChunks.join('')).toMatch(/\x1b\[33m42/);
  });
});
