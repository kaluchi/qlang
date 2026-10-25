import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag, isErrorValue } from '../../../src/types.mjs';
import { QlangDefect, QlangError } from '../../../src/errors.mjs';

describe('the cells of a notebook', () => {
  it('evalCell returns an entry with its result and the scope after the cell', async () => {
    const sessionInstance = await createNotebook();
    const cellEntry = await sessionInstance.evalCell('42 | :n it');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.scopeAfterCell).toBe(sessionInstance.scope);
    expect(cellEntry.scopeAfterCell.has('n')).toBe(true);
  });

  it('answers the entry of a cell, its source, its name, its result, its defect and the scope after it', async () => {
    expect(Object.keys(await (await createNotebook()).evalCell('1'))).toEqual(['source', 'uri', 'result', 'defect', 'scopeAfterCell']);
  });

  it('evalCell seeds the cell pipeValue from evalOpts.initialPipeValue', async () => {
    const sessionInstance = await createNotebook();
    const seeded = new Map([['a', 1], ['b', 2]]);
    const cellEntry = await sessionInstance.evalCell('get /a', { initialPipeValue: seeded });
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(1);
  });

  it('evalCell keeps the verbs a cell declares for the cells after it', async () => {
    const sessionInstance = await createNotebook();
    await sessionInstance.evalCell(':any/double ~(mul 2)');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('evalCell keeps the names a cell declares for the cells after it', async () => {
    const sessionInstance = await createNotebook();
    await sessionInstance.evalCell('42 | :answer it');
    const cellEntry = await sessionInstance.evalCell('answer | mul 2');
    expect(cellEntry.result).toBe(84);
  });

  it('a notebook starts from the scope a host hands it, the record a cell wrote among it', async () => {
    const sessionInstance = await createNotebook();
    await sessionInstance.evalCell(':answer |~~ The answer. ~~| 42');
    const other = await createNotebook({ scope: sessionInstance.scope });
    expect(other.scope.get('answer')).toBe(sessionInstance.scope.get('answer'));
    expect((await other.evalCell('::answer | doc | content')).result).toBe('The answer.');
  });

  it('a notebook binds no name a host hands it: its names come by its sources alone', async () => {
    const sessionInstance = await createNotebook();
    expect(Object.keys(sessionInstance)).toEqual(['evalCell', 'scope']);
  });

  it('a cell handed no subject starts from null', async () => {
    expect((await (await createNotebook()).evalCell('tag')).result).toEqual(makeTag('null'));
  });

  it('answers a cell that does not parse by its failure, the cell no defect', async () => {
    const sessionInstance = await createNotebook();
    const cellEntry = await sessionInstance.evalCell('[1 2');
    expect([cellEntry.result.tag, cellEntry.defect]).toEqual([makeTag('quote/ParseError'), null]);
  });

  it('a parse failure names as its origin the source a host named, and a cell the notebook numbers names none', async () => {
    const sessionInstance = await createNotebook();
    const numbered = await sessionInstance.evalCell('[1 2');
    expect(numbered.uri).toBe('cell-1');
    expect([...numbered.result.facts.keys()]).toEqual(['source', 'marker', 'message', 'expected', 'location']);
    const named = await sessionInstance.evalCell('[1 2', { uri: 'shop.qlang' });
    expect([...named.result.facts.keys()]).toEqual(['source', 'marker', 'message', 'expected', 'location', 'origin']);
    expect(named.result.facts.get('origin')).toEqual(makeKeyword('shop.qlang'));
  });

  it('evalCell records the error on runtime failure', async () => {
    const sessionInstance = await createNotebook();
    const cellEntry = await sessionInstance.evalCell('42 | count');
    expect(cellEntry.defect).toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.originalError).toBeInstanceOf(QlangError);
    expect(cellEntry.result.originalError.name).toBe('KindAnswersNoVerbError');
  });

  it('evalCell uri defaults to cell-N', async () => {
    const sessionInstance = await createNotebook();
    expect((await sessionInstance.evalCell('1')).uri).toBe('cell-1');
    expect((await sessionInstance.evalCell('2', { uri: 'named' })).uri).toBe('named');
    expect((await sessionInstance.evalCell('3')).uri).toBe('cell-2');
  });
});

describe('a cell whose failure is no error value', () => {
  const collapsing = () => createNotebook({
    sources: [{
      uri: 'tests/collapse',
      source: ':any/collapse ::builtin{}',
      primitives: { 'any/collapse': () => { throw new QlangDefect('a defect of the host'); } }
    }]
  });

  it('answers a defect as the defect of its cell, with no result', async () => {
    const cellEntry = await (await collapsing()).evalCell('42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.defect).toBeInstanceOf(QlangDefect);
    expect(cellEntry.defect.name).toBe('QlangDefect');
  });

  it('raises the defect of the cell a query runs as to its caller', async () => {
    await expect(evalQuery('42 | collapse', (await collapsing()).scope)).rejects.toBeInstanceOf(QlangDefect);
  });
});

it('a query runs as one cell of a notebook over the scope it is handed, the root\'s where none is', async () => {
  const notebook = await createNotebook();
  await notebook.evalCell(':k 7');
  expect([await evalQuery('k', notebook.scope), (await evalQuery('k')).tag]).toEqual([7, makeTag('call/UnknownNameError')]);
});
