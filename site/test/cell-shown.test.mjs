// The rules it holds: [QSHST#tools], [QSERR#print], [QSHST#answer].

import { describe, it, expect, beforeAll } from 'vitest';
import { createSession } from '@kaluchi/qlang-core';
import { cellShown } from '../src/lib/cell-shown.js';

let session;
beforeAll(async () => {
  session = await createSession();
});

describe('cellShown', () => {
  it('shows an answer as the language prints it', async () => {
    expect(await cellShown(await session.evalCell('[1 2] | count'))).toEqual({ text: '2', failed: false });
  });

  it('shows a value of a kind with a print of its own by that print', async () => {
    expect((await cellShown(await session.evalCell(':Box |~~ B ~~| | :Box/print ~("box") | [::Box#1]'))).text).toBe('[box]');
  });

  it('shows a failure as its alert under the line that says it was raised', async () => {
    const shown = await cellShown(await session.evalCell('"x" | add 1'));
    expect(shown.failed).toBe(true);
    expect(shown.text).toMatch(/^\|~\| raised, and no !\| caught it\n::number\/add\/SubjectNotNumberError!\{/);
  });

  it('shows an answer past the budget as the refusal in its place', async () => {
    const shown = await cellShown(await session.evalCell('3000 | range | map ~(get {:id ~(it) :name "user"})'));
    expect(shown.failed).toBe(true);
    expect(shown.text).toContain('::qlang/AnswerBeyondBudgetError!{');
  });

  it('shows the caret under the place a parse stopped below its failure', async () => {
    const { text } = await cellShown(await session.evalCell('add ('));
    expect(text.split('\n').at(-1)).toMatch(/\^$/);
  });

  it('writes a defect raised as the cell ran as qlang: and its message', async () => {
    const shown = await cellShown(await session.evalCell('type', { initialPipeValue: function hello() {} }));
    expect(shown).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
  });

  it('writes a defect raised as its answer printed as qlang: and its message', async () => {
    expect(await cellShown({ result: Infinity, defect: null, scopeAfterCell: session.scope })).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
  });
});
