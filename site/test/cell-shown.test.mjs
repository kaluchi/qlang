// The rules it holds: [D365].

import { describe, it, expect, beforeAll } from 'vitest';
import { createSession } from '@kaluchi/qlang-core';
import { cellShown } from '../src/lib/cell-shown.js';

let session;
beforeAll(async () => {
  session = await createSession();
});

describe('cellShown', () => {
  it('shows an answer as the language prints it', async () => {
    expect(cellShown(await session.evalCell('[1 2] | count'))).toEqual({ text: '2', failed: false });
  });

  it('shows a failure as failed', async () => {
    const shown = cellShown(await session.evalCell('"x" | add 1'));
    expect(shown.failed).toBe(true);
    expect(shown.text).toContain('::number/add/SubjectNotNumberError');
  });

  it('shows the caret under the place a parse stopped below its failure', async () => {
    const { text } = cellShown(await session.evalCell('add ('));
    expect(text.split('\n').at(-1)).toMatch(/\^$/);
  });

  it('writes a defect raised as the cell ran as qlang: and its message', async () => {
    const shown = cellShown(await session.evalCell('type', { initialPipeValue: function hello() {} }));
    expect(shown).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
  });

  it('writes a defect raised as its answer printed as qlang: and its message', () => {
    expect(cellShown({ result: Infinity, defect: null })).toEqual({ text: expect.stringMatching(/^qlang: /), failed: true });
  });
});
