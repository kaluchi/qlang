import { it, expect } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import { runRepl } from '../../src/repl.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';

const refused = `[${Array.from({ length: 120 }, (_, index) => index + 1).join(' ')}] x`;

const sourceAndCaret = text => {
  const lines = text.split('\n');
  const at = lines.findIndex(line => line.startsWith('  :source "'));
  return [lines[at], lines[at + 1]];
};

it('writes the `:marker` of a refused text beneath its `:source` in the alert, the prose of the page below the alert', async () => {
  const text = await answerText(await evalQuery('[1 2'), await langRuntime(), 'The page.');
  expect(sourceAndCaret(text)).toEqual(['  :source "[1 2"', '  :marker "    ^"']);
  expect(text).toMatch(/\}\n\|~\| The page\.$/);
});

it('writes a refused text past the excerpt of an alert as its line cut around the point, the caret of its `:marker` under that point', async () => {
  const [source, caret] = sourceAndCaret(await answerText(await evalQuery(refused), await langRuntime()));
  expect([source.startsWith('  :source "…'), caret.indexOf('^')]).toEqual([true, source.lastIndexOf('x')]);
});

// [QSCLI#repl]
it('prints in the REPL a refused text past the excerpt of an alert as its line cut around the point, the caret of its `:marker` under that point', async () => {
  const replHarness = captureRepl(`${refused}\n.exit\n`);
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  const [source, caret] = sourceAndCaret(stripAnsi(replHarness.stdoutText()).replace(/\r/g, ''));
  expect([source.startsWith('  :source "…'), caret.indexOf('^')]).toEqual([true, source.lastIndexOf('x')]);
});
