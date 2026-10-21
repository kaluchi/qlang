import { describe, it, expect } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import { runRepl } from '../../src/repl.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';

// The command line draws the caret of a refused text below its alert, the
// line within an excerpt around the place, above the prose of the page.
describe('answerText — the caret of a refused text', () => {
  const refused = `[${Array.from({ length: 120 }, (_, index) => index + 1).join(' ')}] x`;

  it('writes the caret between the alert and the prose of the page', async () => {
    const text = await answerText(await evalQuery('[1 2'), await langRuntime(), 'The page.');
    expect(text).toMatch(/\}\n\|~\| \[1 2\n\|~\| {5}\^\n\|~\| The page\.$/);
  });

  it('draws the caret under the line of a refused text, the line within an excerpt where the alert left it out', async () => {
    const text = await answerText(await evalQuery(refused), await langRuntime());
    expect(text).toContain(':source ::elision{');
    expect(text).toMatch(/\n\|~\| …[\d ]*\] x\n\|~\| +\^$/);
  });
});

// A cell prints its answer whole, past the budget of every answer as well,
// and an error as its alert within it, without the prose of its page [QSCLI#repl].
describe('runRepl — the bound of an answer', () => {
  it('draws the caret below a refused text its alert left out, the line within an excerpt', async () => {
    const refused = `[${Array.from({ length: 120 }, (_, index) => index + 1).join(' ')}] x`;
    const replHarness = captureRepl(`${refused}\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain(':source ::elision{');
    expect(printed).toMatch(/\|~\| …[\d ]*\] x\n\|~\| +\^/);
  });
});
