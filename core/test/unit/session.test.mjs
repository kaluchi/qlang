// Tests for session.mjs — REPL/notebook session lifecycle: a session
// keeps the scope its cells write, a host puts its names into it by its
// sources alone, and the scope and the subject a host hands are taken by
// the walk of the door [QSNAM#root], [QSHST#source].

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { keyword, makeBinding, makeTag, isErrorValue, BuiltinForeignValueError } from '../../src/types.mjs';
import { QlangDefect, QlangError, declareRefusal } from '../../src/errors.mjs';
import { valuesOfTheLanguage, valuesOfNoKind } from '../helpers/values-at-the-door.mjs';

describe('createSession lifecycle', () => {
  it('[QSNAM#root] creates a session seeded with the scope of the root', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.scope).toBeInstanceOf(Map);
    expect((await sessionInstance.evalCell('[1 2 3] | filter ~(gt 1) | count')).result).toBe(2);
  });

  it('[QSHST#source] evalCell returns an entry with its result and the scope after the cell', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42 | :n it');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.scopeAfterCell).toBe(sessionInstance.scope);
    expect(cellEntry.scopeAfterCell.has('n')).toBe(true);
  });

  it('[QSHST#source] answers the entry of a cell, its source, its name, its result, its defect and the scope after it', async () => {
    expect(Object.keys(await (await createSession()).evalCell('1'))).toEqual(['source', 'uri', 'result', 'defect', 'scopeAfterCell']);
  });

  it('[QSHST#source] evalCell seeds the cell pipeValue from evalOpts.initialPipeValue', async () => {
    const sessionInstance = await createSession();
    const seeded = new Map([['a', 1], ['b', 2]]);
    const cellEntry = await sessionInstance.evalCell('get /a', { initialPipeValue: seeded });
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(1);
  });

  it('[QSHST#source] evalCell keeps the verbs a cell declares for the cells after it', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':any/double ~(mul 2)');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('[QSHST#source] evalCell keeps the names a cell declares for the cells after it', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | :answer it');
    const cellEntry = await sessionInstance.evalCell('answer | mul 2');
    expect(cellEntry.result).toBe(84);
  });

  it('[QSNAM#scope] a cell opens a scope of its own, where a later cell declares a name again', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':k 1');
    const cellEntry = await sessionInstance.evalCell(':k 2 | k');
    expect(cellEntry.result).toBe(2);
  });

  it('[QSHST#source] a session starts from the scope a host hands it, the record a cell wrote among it', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':answer |~~ The answer. ~~| 42');
    const other = await createSession({ scope: sessionInstance.scope });
    expect(other.scope.get('answer')).toBe(sessionInstance.scope.get('answer'));
    expect((await other.evalCell('::answer | doc | content')).result).toBe(' The answer. ');
  });

  it('[QSHST#source] a session binds no name a host hands it: its names come by its sources alone', async () => {
    const sessionInstance = await createSession();
    expect(Object.keys(sessionInstance)).toEqual(['evalCell', 'scope']);
  });

  it('[QSHST#source] a cell handed no subject starts from null', async () => {
    expect((await (await createSession()).evalCell('type')).result).toEqual(makeTag('null'));
  });

  it('[QSHST#source] answers a cell that does not parse by its failure, the cell no defect', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('[1 2');
    expect([cellEntry.result.tag, cellEntry.defect]).toEqual([makeTag('quote/ParseError'), null]);
  });

  it('[QSHST#source] a parse failure names as its origin the source a host named, and a cell the session numbers names none', async () => {
    const sessionInstance = await createSession();
    const numbered = await sessionInstance.evalCell('[1 2');
    expect(numbered.uri).toBe('cell-1');
    expect([...numbered.result.facts.keys()]).toEqual(['source', 'message', 'expected', 'location']);
    const named = await sessionInstance.evalCell('[1 2', { uri: 'shop.qlang' });
    expect([...named.result.facts.keys()]).toEqual(['source', 'message', 'expected', 'location', 'origin']);
    expect(named.result.facts.get('origin')).toEqual(keyword('shop.qlang'));
  });

  it('[QSHST#source] evalCell records the error on runtime failure', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42 | count');
    // A failure of the run is the answer of its cell, which holds no defect and keeps the refusal it was raised as.
    expect(cellEntry.defect).toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.originalError).toBeInstanceOf(QlangError);
    expect(cellEntry.result.originalError.name).toBe('KindAnswersNoVerbError');
  });

  it('[QSHST#source] evalCell uri defaults to cell-N', async () => {
    const sessionInstance = await createSession();
    expect((await sessionInstance.evalCell('1')).uri).toBe('cell-1');
    expect((await sessionInstance.evalCell('2', { uri: 'named' })).uri).toBe('named');
    expect((await sessionInstance.evalCell('3')).uri).toBe('cell-2');
  });
});

describe('the sources a host hands', () => {
  // A source of the host declares a verb under the label of its subject, with
  // the primitive the host hands beside it [QSHST#source].
  const HOST_SOURCES = [{
    uri: 'tests/host',
    source: [
      ':number/less |~~ The subject less the input. ~~| (::fn | takes :by |~~ How much less. ~~| /0 ::number | throws :by/KindNotTakenError |~~ The amount is a number. ~~| | impl ::builtin{})',
      ':any/fetch |~~ The text fetched. ~~| (::fn | returns |~~ The text. ~~| ::string | impl ::builtin{})',
      ':any/doubled ~(fetch | append fetch)'
    ].join('\n'),
    primitives: { 'number/less': (subject, by) => subject - by, 'any/fetch': () => 'fetched' }
  }];

  it('[QSHST#source] runs a host name through the primitive handed beside its source', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('7 | less "a" !| type')).result)
      .toEqual(makeTag('number/less/by/KindNotTakenError'));
  });

  it('[QSHST#source] runs a name of steps the source declares over the host\'s own', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('doubled')).result).toBe('fetchedfetched');
  });

  it('[QSHST#source] answers a host name as the function whose recipe is its descriptor, and refuses an answer of a kind it does not return', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::any/fetch | binding | get /value | get [~(type) ~(get /1 | type)]')).result).toEqual(await evalQuery('[::fn ::builtin]'));
    const misanswering = await createSession({ sources: [{ ...HOST_SOURCES[0], primitives: { ...HOST_SOURCES[0].primitives, 'any/fetch': () => 5 } }] });
    expect((await misanswering.evalCell('fetch !| type')).result).toEqual(makeTag('any/fetch/answer/KindNotTakenError'));
  });

  it('[QSHST#source] records the source a host name came from as its origin', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::number/less | binding | get /origin')).result).toEqual(keyword('tests/host'));
  });

  it('[QSHST#source] refuses a name that is a ::builtin{} the host hands nothing for, as the root is declared, naming the source and the name', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/bare', source: ':any/hello ::builtin{}' }] }))
      .rejects.toMatchObject({ name: 'PrimitiveNotHandedError', address: 'builtin/PrimitiveNotHandedError', facts: { origin: keyword('tests/bare'), name: keyword('any/hello') } });
  });

  it('[QSHST#source] takes no primitive for a name that holds a ::builtin{} another name took, which runs that name\'s where it holds that name\'s value, and refuses one handed for it, naming the name whose ::builtin{} it holds', async () => {
    const aliasing = primitives => createSession({ sources: [{
      uri: 'tests/alias',
      source: ':any/plus (::number/add | binding | get /value)\n:any/greet ::builtin{}\n:any/hail (::any/greet | binding | get /value)',
      primitives
    }] });
    expect((await (await aliasing({ 'any/greet': () => 'hi' })).evalCell('get [~(5 | plus 1) ~(hail)]')).result).toEqual([6, 'hi']);
    for (const [name, sharedWith] of [['any/plus', 'number/add'], ['any/hail', 'any/greet']]) {
      await expect(aliasing({ 'any/greet': () => 'hi', [name]: () => 0 })).rejects.toMatchObject({
        name: 'PrimitiveNamesNoBuiltinError',
        facts: { origin: keyword('tests/alias'), name: keyword(name), sharedWith: keyword(sharedWith) },
        message: `qlang root: the source tests/alias is handed a primitive for :${name}, whose ::builtin{} is another name's, :${sharedWith}, which took it first`
      });
    }
    expect((await (await createSession()).evalCell('1 | add 2')).result).toBe(3);
  });

  it('[QSHST#source] refuses a primitive handed for a verb of steps', async () => {
    await expect(createSession({ sources: [{
      uri: 'tests/over', source: ':any/many ~(count)', primitives: { 'any/many': () => 0 }
    }] })).rejects.toMatchObject({ name: 'PrimitiveNamesNoBuiltinError', address: 'builtin/PrimitiveNamesNoBuiltinError' });
  });

  it('[QSHST#source] refuses a primitive handed for a name that is no ::builtin{} under a label, saying so', async () => {
    const refusal = (uri, name) => `qlang root: the source ${uri} is handed a primitive for :${name}, which it declares as no ::builtin{} under a label`;
    for (const [uri, source, name] of [['tests/bare', ':shout ::builtin{}', 'shout'], ['tests/map', ':x {} | :x/shout ::builtin{}', 'x/shout'], ['tests/stray', ':limit 10', 'limit']]) {
      const refused = await createSession({ sources: [{ uri, source, primitives: { [name]: text => text } }] }).catch(caught => caught);
      expect(refused).toMatchObject({ name: 'PrimitiveNamesNoBuiltinError', message: refusal(uri, name) });
      expect(refused.facts).toEqual({ origin: keyword(uri), name: keyword(name) });
    }
  });

  it('[QSHST#source] refuses a source that declares a name the root holds, bare or with a path, by one refusal naming the source as its origin', async () => {
    for (const source of [':vec |~~ again ~~|', ':vec/count ~(0)']) {
      await expect(createSession({ sources: [{ uri: 'tests/twice', source }] }))
        .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', facts: { origin: keyword('tests/twice'), tagName: '::bind/NameDeclaredTwiceError' } });
    }
  });

  it('[QSHST#source] declares a refusal of the host at its address again in every session of the process', async () => {
    declareRefusal('Probe/SessionProbeRefusalError');
    const sources = [{ uri: 'tests/refusal', source: ':Probe {} | :Probe/SessionProbeRefusalError |~~ SessionProbeRefusalError. ~~|' }];
    await createSession({ sources });
    expect((await (await createSession({ sources })).evalCell('::Probe | manifest | count')).result).toBe(1);
  });

  it('[QSHST#source] refuses a source whose run answers an error', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/broken', source: ':a 1 | 1 | add "x" | :b 2' }] }))
      .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', message: expect.stringContaining('the source tests/broken is refused') });
  });
});

describe('a session takes what its host hands by the walk of the door', () => {
  const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: keyword('held'), value }));

  it('[QSHST#source] takes a value of each kind of the language as the subject of a cell and in the scope it starts from, as it is', async () => {
    const sessionInstance = await createSession();
    for (const value of await valuesOfTheLanguage()) {
      expect((await sessionInstance.evalCell('it', { initialPipeValue: value })).result).toBe(value);
      expect((await (await createSession({ scope: await scopeHolding(value), sources: [] })).evalCell('held')).result).toBe(value);
    }
  });

  it('[QSHST#source] answers a subject of no kind as the defect of its cell, raised past the fail track, and the cells after it run', async () => {
    const sessionInstance = await createSession();
    for (const [value, , account] of valuesOfNoKind()) {
      const cell = await sessionInstance.evalCell(':late 1 | type', { initialPipeValue: value });
      expect([cell.result, cell.defect, cell.defect.facts], account).toEqual([null, expect.any(BuiltinForeignValueError), { actualValue: account }]);
      expect(cell.scopeAfterCell.has('late')).toBe(false);
    }
    expect((await sessionInstance.evalCell('1 | add 1')).result).toBe(2);
  });

  it('[QSHST#source] refuses a scope whose name holds a value of no kind, before its sources declare the root', async () => {
    for (const [value, , account] of valuesOfNoKind()) {
      await expect(createSession({ scope: await scopeHolding(value), sources: [{ uri: 'tests/never', source: ':any/never ::builtin{}' }] }), account)
        .rejects.toMatchObject({ address: 'builtin/ForeignValueError', facts: { actualValue: account } });
    }
  });
});

describe('a cell whose failure is no error value', () => {
  // A defect of the host, raised past the fail track, is what a cell answers
  // with no result, and what a query raises to its caller [QSHST#source].
  const collapsing = () => createSession({
    sources: [{
      uri: 'tests/collapse',
      source: ':any/collapse ::builtin{}',
      primitives: { 'any/collapse': () => { throw new QlangDefect('a defect of the host'); } }
    }]
  });

  it('[QSHST#source] answers a defect as the defect of its cell, with no result', async () => {
    const cellEntry = await (await collapsing()).evalCell('42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.defect).toBeInstanceOf(QlangDefect);
    expect(cellEntry.defect.name).toBe('QlangDefect');
  });

  it('[QSHST#source] raises the defect of the cell a query runs as to its caller', async () => {
    await expect(evalQuery('42 | collapse', (await collapsing()).scope)).rejects.toBeInstanceOf(QlangDefect);
  });
});

describe('a query runs as one cell of a session', () => {
  it('[QSHST#source] runs over the scope it is handed, the root\'s where none is', async () => {
    const session = await createSession();
    await session.evalCell(':k 7');
    expect([await evalQuery('k', session.scope), (await evalQuery('k')).tag]).toEqual([7, makeTag('call/UnknownNameError')]);
  });
});
