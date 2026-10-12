// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { keyword, makeTag, isErrorValue } from '../../src/types.mjs';
import { QlangInvariantError, declareRefusal } from '../../src/errors.mjs';

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
    // pure filter without needing `in | parseJson | …` ceremony.
    const sessionInstance = await createSession();
    const seeded = new Map([['a', 1], ['b', 2]]);
    const cellEntry = await sessionInstance.evalCell('/a', { initialPipeValue: seeded });
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(1);
  });

  it('evalCell omitting initialPipeValue falls back to env as the seed', async () => {
    // Historical behaviour — a query that starts with a value
    // producer (`42`, `[1 2]`, `in`) overrides the seed anyway,
    // so a cell that does not reference pipeValue acts as before.
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(42);
  });

  it('evalCell persists BindStep bindings across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':any/double ~(mul 2)');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('evalCell persists freezes across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | :answer /');
    const cellEntry = await sessionInstance.evalCell('answer | mul 2');
    expect(cellEntry.result).toBe(84);
  });

  it('a cell opens a scope of its own, where a later cell declares a name again [D5]', async () => {
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

  it('a parse failure names the source a host named, and a cell the session numbers names none', async () => {
    const sessionInstance = await createSession();
    const numbered = await sessionInstance.evalCell('[1 2');
    expect(numbered.uri).toBe('cell-1');
    expect(numbered.result.descriptor.has('uri')).toBe(false);
    const named = await sessionInstance.evalCell('[1 2', { uri: 'shop.qlang' });
    expect(named.result.descriptor.get('uri')).toBe('shop.qlang');
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

  it('bind installs a record a host hands as the record it is', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':answer |~~ The answer. ~~| 42');
    const record = sessionInstance.env.get('answer');
    const other = await createSession();
    other.bind('answer', record);
    expect(other.env.get('answer')).toBe(record);
    expect((await other.evalCell('::answer | doc | content')).result).toBe(' The answer. ');
  });
});

describe('the sources a host hands [D153]', () => {
  // A source of the host declares a name under the label of its subject,
  // with the implementation the host hands beside it [D80], [D164].
  const HOST_SOURCES = [{
    uri: 'tests/host',
    source: [
      ':number/less |~~ The subject less the part. ~~| ::builtin{}',
      ':number/less/by |~~ How much less. ~~| ~(/0)',
      ':number/less/by/NotNumberError |~~ The amount is a number. ~~| ::holds~(is ::number)',
      ':any/fetch |~~ The text fetched. ~~| ::builtin{}',
      ':any/fetch/text |~~ The text. ~~| ::string',
      ':any/doubled ~(fetch | append fetch)'
    ].join('\n'),
    impls: { 'number/less': (subject, by) => subject - by, 'any/fetch': () => 'fetched' }
  }];

  it('runs a host name through the implementation handed beside its source', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('7 | less "a" !| type')).result)
      .toEqual(makeTag('number/less/by/NotNumberError'));
  });

  it('runs a name of steps the source declares over the host\'s own', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('doubled')).result).toBe('fetchedfetched');
  });

  it('answers a host name as its descriptor, whose answer is a definition of its label', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::any/fetch | binding | /value | type')).result).toEqual(makeTag('builtin'));
    expect((await sessionInstance.evalCell('fetch | type')).result).toEqual(makeTag('string'));
  });

  it('records the source a host name came from as its origin', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::number/less | binding | /origin')).result).toEqual(keyword('tests/host'));
  });

  it('runs a host name whose descriptor names no primitive by the implementation handed for it', async () => {
    const sessionInstance = await createSession({ sources: [{
      uri: 'tests/handed',
      source: ':any/twice ::builtin{} | :any/twice/by |~~ The factor. ~~| ~(/0) | :any/twice/by/NotNumberError ::holds~(is ::number)',
      impls: { 'any/twice': (subject, by) => subject * by }
    }] });
    expect((await sessionInstance.evalCell('3 | twice 2')).result).toBe(6);
    expect((await sessionInstance.evalCell('3 | twice "x" !| type')).result).toEqual(makeTag('any/twice/by/NotNumberError'));
  });

  it('takes a ::builtin{} in a verb a host declares as a step, and refuses an implementation handed for it [D34]', async () => {
    await expect(createSession({ sources: [{
      uri: 'tests/bare', source: ':any/shout ~(::builtin{})', impls: { shout: text => text.toUpperCase() }
    }] })).rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
  });

  it('refuses a name that is a ::builtin{} the host hands nothing for, as the root is declared', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/bare', source: ':any/hello ::builtin{}' }] }))
      .rejects.toMatchObject({ name: 'ImplementationNotHandedError', facts: { name: 'any/hello' } });
  });

  it('refuses an implementation handed for a verb of steps', async () => {
    await expect(createSession({ sources: [{
      uri: 'tests/over', source: ':any/many ~(count)', impls: { 'any/many': () => 0 }
    }] })).rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
  });

  it('refuses an implementation handed for a name that is no ::builtin{} under a label', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/bare', source: ':shout ::builtin{}', impls: { shout: text => text } }] }))
      .rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
    await expect(createSession({ sources: [{ uri: 'tests/map', source: ':x {} | :x/shout ::builtin{}', impls: { 'x/shout': text => text } }] }))
      .rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
    await expect(createSession({ sources: [{ uri: 'tests/stray', source: ':limit 10', impls: { limit: () => 1 } }] }))
      .rejects.toMatchObject({ name: 'ImplementationNamesNoBuiltinError' });
  });

  it('refuses a source that declares a name the root holds, bare or with a path, by one refusal', async () => {
    for (const source of [':vec |~~ again ~~|', ':vec/count ~(0)']) {
      await expect(createSession({ sources: [{ uri: 'tests/twice', source }] }))
        .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', facts: { tagName: '::bind/NameDeclaredTwiceError' } });
    }
  });

  it('refuses a source that declares a refusal of the root under another address', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/moved', source: ':Lib/AddLeftNotNumberError |~~ AddLeftNotNumberError. ~~|' }] }))
      .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError' });
    expect((await (await createSession()).evalCell('"a" | add 1 !| type')).result)
      .toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

  it('declares a refusal of the host at its address again in every session of the process', async () => {
    declareRefusal('Probe/SessionProbeRefusalError');
    const sources = [{ uri: 'tests/refusal', source: ':Probe {} | :Probe/SessionProbeRefusalError |~~ SessionProbeRefusalError. ~~|' }];
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
        source: ':any/collapse ::builtin{}',
        impls: { 'any/collapse': () => { throw new QlangInvariantError('a defect of the host'); } }
      }]
    });

    const cellEntry = await sessionInstance.evalCell('42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.error).toBeInstanceOf(QlangInvariantError);
    expect(cellEntry.error.name).toBe('QlangInvariantError');
  });
});
