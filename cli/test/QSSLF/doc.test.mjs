import { describe, it, expect } from 'vitest';
import { declaredPagesOf, linksOf, proseQuotesOf, quoteInProse, wrongLinksOf } from '../../../core/test/helpers/catalog-pages.mjs';
import { runRepl } from '../../src/repl.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';
import { answerOf, names, cliNames } from '../helpers/cli-notebook.mjs';

describe('the catalog of the command line', () => {
  it('leads every link of its pages to the page of another name', async () => {
    expect(await wrongLinksOf(answerOf, await linksOf(answerOf, cliNames), await declaredPagesOf(answerOf, names))).toEqual([]);
  }, 120_000);

  it('holds no quote of a page in its prose', async () => {
    expect(await proseQuotesOf(answerOf, cliNames)).toEqual([]);
  }, 60_000);

  it('tells a link whose quote does not parse, which falls to the prose', async () => {
    const proseOf = async doc => answerOf(`${doc} | segments | filter ~(tag | eq ::string) | join ""`);
    expect(quoteInProse(await proseOf('|~~ shows a value on stderr ::link~(::any/tap | ) ~~|'))).toBe(true);
    expect(quoteInProse(await proseOf('|~~ shows a value on stderr ::link~(::any/tap | doc) ~~|'))).toBe(false);
  });
});

it('runs in the REPL a doc whose quote stands under the tag of a group as a cell, its answer on stdout and no defect', async () => {
  const replHarness = captureRepl('|~~ see ::group~(add 1) ~~| | segments | get /1\n["a" ::group~(x)] | tag ::doc | eq (print | parse | first)\n.exit\n');
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  expect(stripAnsi(replHarness.stdoutText())).toBe('qlang> ::group~(add 1)\nqlang> true\nqlang> ');
  expect(replHarness.stderrText()).toBe('');
});
