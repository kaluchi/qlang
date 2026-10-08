// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { keyword, makeTagKeyword, isErrorValue } from '../../src/types.mjs';
import { QlangInvariantError, declareShapeError } from '../../src/errors.mjs';

describe('createSession lifecycle', () => {
  it('creates a session seeded with langRuntime builtins', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.env).toBeInstanceOf(Map);
    expect((await sessionInstance.evalCell('[1 2 3] | filter ~(gt 1) | count')).result).toBe(2);
  });

  it('evalCell returns an entry with its result', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.error).toBeNull();
  });

  it('evalCell seeds the cell pipeValue from evalOpts.initialPipeValue', async () => {
    // The CLI script mode uses this hook to deliver parsed stdin
    // as the implicit subject — `qlang '/key'` then acts as a
    // pure filter without needing `@in | parseJson | …` ceremony.
    const sessionInstance = await createSession();
    const seeded = new Map([['a', 1], ['b', 2]]);
    const cellEntry = await sessionInstance.evalCell('/a', { initialPipeValue: seeded });
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(1);
  });

  it('evalCell omitting initialPipeValue falls back to env as the seed', async () => {
    // Historical behaviour — a query that starts with a value
    // producer (`42`, `[1 2]`, `@in`) overrides the seed anyway,
    // so a cell that does not reference pipeValue acts as before.
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(42);
  });

  it('evalCell persists BindStep bindings across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':double ::verb~(mul 2)');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('evalCell persists freezes across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | :answer /');
    const cellEntry = await sessionInstance.evalCell('answer | mul 2');
    expect(cellEntry.result).toBe(84);
  });

  it('a cell opens a scope of its own, where a later cell declares a name again [D44]', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':k 1');
    const cellEntry = await sessionInstance.evalCell(':k 2 | k');
    expect(cellEntry.result).toBe(2);
  });

  it('evalCell records the error on parse failure', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('[1 2');
    expect(cellEntry.error).not.toBeNull();
    expect(cellEntry.error.name).toBe('ParseError');
  });

  it('evalCell records the error on runtime failure', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42 | count');
    // Runtime errors are error values (5th type).
    // evalCell succeeds; result is an error value, entry.error is null.
    expect(cellEntry.error).toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.originalError.name).toBe('KindAnswersNoVerbError');
  });

  it('evalCell uri defaults to cell-N', async () => {
    const sessionInstance = await createSession();
    expect((await sessionInstance.evalCell('1')).uri).toBe('cell-1');
    expect((await sessionInstance.evalCell('2', { uri: 'named' })).uri).toBe('named');
    expect((await sessionInstance.evalCell('3')).uri).toBe('cell-2');
  });

  it('evalCell uri respects evalOpts.uri', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('1', { uri: 'notebook.qlang#cell-foo' });
    expect(cellEntry.uri).toBe('notebook.qlang#cell-foo');
  });

  it('bind installs a raw value into env', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    expect((await sessionInstance.evalCell('answer')).result).toBe(42);
  });
});

describe('the sources a host hands [D153]', () => {
  // A source of the host declares a verb under the noun of its subject,
  // with the implementation the host hands beside it [D80].
  const HOST_SOURCES = [{
    uri: 'tests/host',
    source: [
      ':number/less ::verb~(:by ::number | ::builtin{})',
      ':any/@fetch ::verb~(:returns ::string | ::builtin{})',
      ':any/@doubled ::verb~(@fetch | append @fetch)'
    ].join('\n'),
    impls: { 'number/less': (subject, by) => subject - by, 'any/@fetch': () => 'fetched' }
  }];

  it('runs a host verb through the implementation handed beside its source', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('7 | less "a" !| type')).result)
      .toEqual(makeTagKeyword('number/PayloadNotNumberError'));
  });

  it('runs a verb of steps the source declares over the host\'s own', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('@doubled')).result).toBe('fetchedfetched');
  });

  it('answers the head of a host verb as its signature', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::any/@fetch | spec | [type /returns]')).result)
      .toEqual([makeTagKeyword('spec'), makeTagKeyword('string')]);
  });

  it('records the source a host verb came from as its origin', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::number/less | binding | /origin')).result).toEqual(keyword('tests/host'));
  });

  it('runs a host verb whose builtin step names no primitive by the implementation handed for it', async () => {
    const sessionInstance = await createSession({ sources: [{
      uri: 'tests/handed',
      source: ':any/twice ::verb~(:by ::number | ::builtin{})',
      impls: { 'any/twice': (subject, by) => subject * by }
    }] });
    expect((await sessionInstance.evalCell('3 | twice 2')).result).toBe(6);
    expect((await sessionInstance.evalCell('3 | twice "x" !| type')).result).toEqual(makeTagKeyword('number/PayloadNotNumberError'));
  });

  it('calls a verb a source declares under no noun by its name, last of all', async () => {
    const { verbShownFor } = await import('../../src/runtime/verb.mjs');
    const sessionInstance = await createSession({ sources: [{
      uri: 'tests/bare',
      source: ':shout ::verb~(:subject ::string | ::builtin{})',
      impls: { shout: text => text.toUpperCase() }
    }] });
    expect((await sessionInstance.evalCell('"hi" | shout')).result).toBe('HI');
    expect((await sessionInstance.evalCell('5 | shout !| type')).result)
      .toEqual(makeTagKeyword('verb/SlotNotOfKindsError'));
    expect(verbShownFor(sessionInstance.env, 'shout')).toBe((await sessionInstance.evalCell(':shout | binding | /value')).result);
  });

  it('refuses a verb ending in ::builtin{} the host hands nothing for, as the root is declared', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/bare', source: ':any/hello ::verb~(::builtin{})' }] }))
      .rejects.toMatchObject({ name: 'ImplementationNotHandedError', context: { name: 'any/hello' } });
  });

  it('refuses an implementation handed for a verb of steps', async () => {
    await expect(createSession({ sources: [{
      uri: 'tests/over', source: ':any/many ::verb~(count)', impls: { 'any/many': () => 0 }
    }] })).rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
  });

  it('refuses an implementation handed for a name the source declares as no verb', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/stray', source: ':limit 10', impls: { limit: () => 1 } }] }))
      .rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
  });

  it('refuses a source that declares a name the root holds, bare or with a path, by one refusal', async () => {
    for (const source of [':vec |~~ again ~~|', ':vec/count ::verb~(0)']) {
      await expect(createSession({ sources: [{ uri: 'tests/twice', source }] }))
        .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', context: { tagName: '::bind/NameDeclaredTwiceError' } });
    }
  });

  it('refuses a source that declares a refusal of the root under another address', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/moved', source: ':Lib/AddLeftNotNumberError ::spec~()' }] }))
      .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError' });
    expect((await (await createSession()).evalCell('"a" | add 1 !| type')).result)
      .toEqual(makeTagKeyword('number/AddLeftNotNumberError'));
  });

  it('declares a refusal of the host at its address again in every session of the process', async () => {
    declareShapeError('SessionProbeRefusalError', () => 'a refusal of the host', { operand: '::Probe' });
    const sources = [{ uri: 'tests/refusal', source: ':Probe {} | :Probe/SessionProbeRefusalError ::spec~()' }];
    await createSession({ sources });
    expect((await (await createSession({ sources })).evalCell('::Probe | manifest | count')).result).toBe(1);
  });

  it('refuses a source whose run answers an error', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/broken', source: ':a 1 | 1 | add "x" | :b 2' }] }))
      .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError' });
  });
});

describe('a cell whose failure is no error value', () => {
  it('leaves an invariant failure on the error channel with no result value', async () => {
    // `evalAst` converts every failure into an ErrorValue except
    // QlangInvariantError, which travels as a host-level throw. The
    // cell records it on the error channel; only a ParseError also
    // lands a structured value on the result channel.
    const sessionInstance = await createSession({
      sources: [{
        uri: 'tests/collapse',
        source: ':any/collapse ::verb~(::builtin{})',
        impls: { 'any/collapse': () => { throw new QlangInvariantError('a defect of the host'); } }
      }]
    });

    const cellEntry = await sessionInstance.evalCell('42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.error).toBeInstanceOf(QlangInvariantError);
    expect(cellEntry.error.name).toBe('QlangInvariantError');
  });
});
