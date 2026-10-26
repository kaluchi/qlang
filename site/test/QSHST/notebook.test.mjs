
import { it, expect, beforeAll } from 'vitest';
import { createNotebook } from '@kaluchi/qlang-core';
import { cellShown } from '../../src/lib/cell-shown.js';

let notebook;
beforeAll(async () => {
  notebook = await createNotebook();
});

it('shows an answer as the language prints it', async () => {
  expect(await cellShown(await notebook.evalCell('[1 2] | count'))).toEqual({ text: '2', failed: false });
});

it('shows a value of a kind with a print of its own by that print', async () => {
  expect((await cellShown(await notebook.evalCell(':Box |~~ B ~~| | :Box/print ~("box") | [::Box#1]'))).text).toBe('[box]');
});

it('shows a failure as its alert under the line that says it was raised', async () => {
  const shown = await cellShown(await notebook.evalCell('"x" | add 1'));
  expect(shown.failed).toBe(true);
  expect(shown.text).toMatch(/^\|~\| raised, and no !\| caught it\n::number\/add\/SubjectNotNumberError!\{/);
});

it('shows the refusal instead of an answer past the budget', async () => {
  const shown = await cellShown(await notebook.evalCell('3000 | range | map ~(get {:id ~(it) :name "user"})'));
  expect(shown.failed).toBe(true);
  expect(shown.text).toContain('::qlang/AnswerBeyondBudgetError::excerpt{');
});

it('shows the failure of a cell that does not parse with the `:marker` beneath its `:source`, nothing drawn below it', async () => {
  const { text } = await cellShown(await notebook.evalCell('add ('));
  expect(text).toContain('  :source "add ("\n  :marker "     ^"\n');
  expect(text.split('\n').at(-1)).toBe('}');
});

it('writes a defect raised as the cell ran as qlang: and its message', async () => {
  const shown = await cellShown(await notebook.evalCell('tag', { initialPipeValue: function hello() {} }));
  expect(shown).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
});

it('writes a defect raised as its answer printed as qlang: and its message', async () => {
  expect(await cellShown({ result: Infinity, defect: null, scopeAfterCell: notebook.scope })).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
});
