import { it, expect } from 'vitest';
import { declaredPagesOf, linksOf, wrongLinksOf } from '../../../core/test/helpers/catalog-pages.mjs';
import { runRepl } from '../../src/repl.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';
import { answerOf, names, stdioNames } from '../helpers/cli-notebook.mjs';

it('leads every link of the pages of the command line to the page of another name', async () => {
  expect(await wrongLinksOf(answerOf, await linksOf(answerOf, stdioNames), await declaredPagesOf(answerOf, names))).toEqual([]);
}, 120_000);

it('runs in the REPL a doc whose quote stands under the tag of a group as a cell, its answer on stdout and no defect', async () => {
  const replHarness = captureRepl('|~~ see ::group~(add 1) ~~| | segments | get /1\n["a" ::group~(x)] | tag ::doc | eq (print | parse | first)\n.exit\n');
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  expect(stripAnsi(replHarness.stdoutText())).toBe('qplay> ::group~(add 1)\nqplay> true\nqplay> ');
  expect(replHarness.stderrText()).toBe('');
});
