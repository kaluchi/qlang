import { describe, it, expect } from 'vitest';
import { platformLocator, BuiltinBootstrapSourceMissingError } from '../../../src/runtime/bootstrap.mjs';
import { ParseError, parse } from '../../../src/parse.mjs';
import { buildLangRuntime } from '../../../src/runtime/index.mjs';
import { keyword, makeTag, makeTagged, makeQuote } from '../../../src/types.mjs';
import { createSession, evalQuery } from '../../../src/session.mjs';
import { runs } from '../../../src/primitives.mjs';
import * as core from '../../../src/index.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { declareRefusal } from '../../../src/errors.mjs';
import { originOf } from '../../../src/walk.mjs';
import { commandStep } from '../../../src/steps.mjs';
import { lines } from '../../helpers/box.mjs';

describe('the locator of the sources of the language', () => {
  it('returns null for an unmapped source', async () => {
    expect(await platformLocator('does/not/exist/anywhere')).toBeNull();
  });

  it('returns { source } for a source of the language', async () => {
    const result = await platformLocator('qlang');
    expect(typeof result.source).toBe('string');
    expect(result.source.length).toBeGreaterThan(100);
  });
});

describe('a source of the language no locator serves', () => {
  it('names the source it missed as its origin, and where a host maps it', () => {
    const err = new BuiltinBootstrapSourceMissingError({ origin: keyword('qlang/vec') });
    expect(err.name).toBe('BootstrapSourceMissingError');
    expect(err.message).toContain('#qlang/vec');
    expect(err.message).toContain('package.json#imports');
  });

  it('fires as the runtime is built where the locator serves no source, naming the first as its origin', async () => {
    const refused = await buildLangRuntime(async () => null).catch(error => error);
    expect(refused).toBeInstanceOf(BuiltinBootstrapSourceMissingError);
    expect(refused).toMatchObject({ name: 'BootstrapSourceMissingError', facts: { origin: keyword('qlang/builtin') } });
  });
});

it('a source of the language the parser refuses raises its parse error, which names the source', async () => {
  let thrown = null;
  try { await buildLangRuntime(async () => ({ source: ':unclosed (mul 2' })); } catch (caught) { thrown = caught; }
  expect(thrown).toBeInstanceOf(ParseError);
  expect(thrown.uri).toBe('qlang/builtin');
});

describe('the facts and the message of SourceLoadError', () => {
  // The class a loader raises for a source that does not read, built here by
  // hand, its facts the origin of the source, where it was looked for and the
  // host's account of the failure.

  it('carries the origin, the location and the cause, and names no platform', async () => {
    const { BuiltinSourceLoadError } = await import('../../../src/source-load-error.mjs');
    const cause = new Error('EACCES: permission denied');
    const err = new BuiltinSourceLoadError({ origin: keyword('qlang/vec'), sourceLocation: '/locked/vec.qlang', cause });
    expect(err.name).toBe('SourceLoadError');
    expect(err.message).toBe("failed to read qlang source 'qlang/vec' from /locked/vec.qlang — EACCES: permission denied");
    expect(err.facts).toEqual({ origin: keyword('qlang/vec'), sourceLocation: '/locked/vec.qlang', cause });
  });

  it('writes a cause that is no error as its text', async () => {
    const { BuiltinSourceLoadError } = await import('../../../src/source-load-error.mjs');
    const err = new BuiltinSourceLoadError({ origin: keyword('qlang/vec'), sourceLocation: '/x.qlang', cause: 'raw-string-cause' });
    expect(err.message).toBe("failed to read qlang source 'qlang/vec' from /x.qlang — raw-string-cause");
  });
});

describe('a host\'s verb written as the chain of its function', () => {
  it('runs the code inputs of a host\'s verb, a quote written in the step in the scope of the step', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared',
      source: [
        ':number/twice |~~ Runs the code twice. ~~| (::fn | takes :code |~~ The code. ~~| /0 #[::path ::quote] | impl ::builtin{})',
        '| :number/each |~~ Runs each code. ~~| (::fn | takes :codes |~~ The codes. ~~| ~(it) [#[::path ::quote]] | impl ::builtin{})'
      ].join('\n'),
      primitives: {
        'number/twice': runs(['code'], async (subject, code) => await code(await code(subject))),
        'number/each': runs(['codes'], async (subject, codes) => await Promise.all(codes.map(code => code(subject))))
      }
    }] });
    expect((await hosted.evalCell('5 | twice ~(add 1)')).result).toBe(7);
    expect((await hosted.evalCell(':k 10 | 5 | each ~(add k) ~(mul 2)')).result).toEqual([15, 10]);
  });

  it('hands a host\'s verb an input it runs as code, a path among it, and an input it does not run as it is', async () => {
    const hosted = await createSession({ sources: [{
      uri: 'test/declared-values',
      source: [
        ':any/both |~~ Runs the code on the subject for each of two. ~~| (::fn | takes :code |~~ The code. ~~| /0 #[::path ::quote] | impl ::builtin{})',
        '| :any/pair |~~ Pairs the subject with a value. ~~| (::fn | takes :value |~~ The value. ~~| /0 | impl ::builtin{})',
        '| :any/each |~~ Runs each code, and keeps each other value. ~~| (::fn | takes :items |~~ The codes and the values. ~~| ~(it) | impl ::builtin{})'
      ].join('\n'),
      primitives: {
        'any/both': runs(['code'], async (subject, code) => [await code(subject), await code(subject)]),
        'any/pair': (subject, value) => [subject, value],
        'any/each': runs(['items'], async (subject, items) => await Promise.all(items.map(item => (typeof item === 'function' ? item(subject) : item))))
      }
    }] });
    expect((await hosted.evalCell('{:x 3} | both /x')).result).toEqual([3, 3]);
    expect((await hosted.evalCell('5 | pair 3')).result).toEqual([5, 3]);
    expect((await hosted.evalCell('5 | each ~(add 1) 7')).result).toEqual([6, 7]);
  });
});

it('hands a word of a host the state of its call where it marks its primitive as a reader of it', async () => {
  const primitive = core.readingState((subject, state) => state.scope.has('k'));
  const session = await core.createSession({ sources: [{ uri: 'probe', source: ':any/where (::fn | returns |~~ W. ~~| ::boolean | impl ::builtin{})', primitives: { 'any/where': primitive } }] });
  expect((await session.evalCell('1 | where')).result).toBe(false);
  expect((await session.evalCell(':k 5 | 1 | where')).result).toBe(true);
});

it('lays the tag of a kind over the payload as it is until its host hands the constructor, and runs the constructor after', async () => {
  // `seen` is computed while the source is read, before its host hands the constructor.
  const hosted = await createSession({ sources: [{
    uri: 'test/hosted-kind',
    source: ':Hk\n  |~~ A kind its host builds. ~~|\n  ::kind[~() ::builtin{}]\n| :seen (::Hk#1 | payload)',
    primitives: { 'Hk/construct': payload => payload + 1 }
  }] });
  expect(printValue((await hosted.evalCell('seen')).result)).toBe('1');
  expect(printValue((await hosted.evalCell('::Hk#1 | payload')).result)).toBe('2');
});

// A session whose source declares two kinds and two verbs a host serves,
// the constructor of `::Gauge` doubling its payload and that of `::Dial`
// answering a value already under its kind.
const gaugeSession = () => createSession({
  sources: [{
    uri: 'probe/gauge',
    source: lines(
      ':Gauge |~~ A reading. ~~| (::kind | impl ::builtin{})',
      ':Gauge/over |~~ Whether the reading passes the test. ~~| (::fn | takes :test |~~ The test. ~~| /0 ::quote | impl ::builtin{})',
      ':Gauge/shifted |~~ The reading shifted. ~~| (::fn | takes :by |~~ The shift. ~~| /0 | impl ::builtin{})',
      ':Dial |~~ A reading of a dial. ~~| (::kind | impl ::builtin{})'
    ),
    primitives: {
      'Gauge/construct': payload => payload * 2,
      'Gauge/over': runs(['test'], async (reading, test) => test(reading)),
      'Gauge/shifted': (reading, by) => reading.payload + by,
      'Dial/construct': payload => makeTagged(makeTag('Dial'), payload + 1)
    }
  }]
});

describe('a host\'s primitive under a label', () => {
  it('builds the payload of its kind by the constructor its host hands, a value it answers under the kind taken as it is', async () => {
    const session = await gaugeSession();
    expect((await session.evalCell('::Gauge#5 | payload')).result).toBe(10);
    expect((await session.evalCell('::Dial#1 | payload')).result).toBe(2);
  });

  it('runs over the served value and the values of its inputs, a quote closed at the call where the input is run', async () => {
    const session = await gaugeSession();
    expect((await session.evalCell('::Gauge#5 | over ~(payload | gt 9)')).result).toBe(true);
    expect((await session.evalCell('::Gauge#5 | shifted 3')).result).toBe(13);
  });

  it('hands a primitive its inputs in the order its chain takes them, whatever their places', async () => {
    const session = await createSession({
      sources: [{
        uri: 'probe/pair',
        source: ':vec/pair2 (::fn | takes :b |~~ The second. ~~| /1 | takes :a |~~ The first. ~~| /0 | impl ::builtin{})',
        primitives: { 'vec/pair2': (subject, b, a) => [a, b] }
      }]
    });
    expect((await session.evalCell('[0] | pair2 1 2')).result).toEqual([1, 2]);
  });
});

it('a descriptor under ::builtin is a value under a tag', async () => {
  const { isTagged } = await import('../../../src/types.mjs');
  expect(isTagged(await evalQuery('::builtin{:a 1}'))).toBe(true);
  expect(isTagged(await evalQuery('{:kind ::builtin}'))).toBe(false);
});

describe('the sources a host hands', () => {
  // A source of the host declares a verb under the label of its subject, with
  // the primitive the host hands beside it.
  const HOST_SOURCES = [{
    uri: 'tests/host',
    source: [
      ':number/less |~~ The subject less the input. ~~| (::fn | takes :by |~~ How much less. ~~| /0 ::number | throws :by/KindNotTakenError |~~ The amount is a number. ~~| | impl ::builtin{})',
      ':any/fetch |~~ The text fetched. ~~| (::fn | returns |~~ The text. ~~| ::string | impl ::builtin{})',
      ':any/doubled ~(fetch | append fetch)'
    ].join('\n'),
    primitives: { 'number/less': (subject, by) => subject - by, 'any/fetch': () => 'fetched' }
  }];

  it('runs a host name through the primitive handed beside its source', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('7 | less "a" !| type')).result)
      .toEqual(makeTag('number/less/by/KindNotTakenError'));
  });

  it('runs a name of steps the source declares over the host\'s own', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('doubled')).result).toBe('fetchedfetched');
  });

  it('answers a host name as the function whose recipe is its descriptor, and refuses an answer of a kind it does not return', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::any/fetch | binding | get /value | get [~(type) ~(get /1 | type)]')).result).toEqual(await evalQuery('[::fn ::builtin]'));
    const misanswering = await createSession({ sources: [{ ...HOST_SOURCES[0], primitives: { ...HOST_SOURCES[0].primitives, 'any/fetch': () => 5 } }] });
    expect((await misanswering.evalCell('fetch !| type')).result).toEqual(makeTag('any/fetch/answer/KindNotTakenError'));
  });

  it('records the source a host name came from as its origin', async () => {
    const sessionInstance = await createSession({ sources: HOST_SOURCES });
    expect((await sessionInstance.evalCell('::number/less | binding | get /origin')).result).toEqual(keyword('tests/host'));
  });

  it('refuses a name that is a ::builtin{} the host hands nothing for, as the root is declared, naming the source and the name', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/bare', source: ':any/hello ::builtin{}' }] }))
      .rejects.toMatchObject({ name: 'PrimitiveNotHandedError', address: 'builtin/PrimitiveNotHandedError', facts: { origin: keyword('tests/bare'), name: keyword('any/hello') } });
  });

  it('takes no primitive for a name that holds a ::builtin{} another name took, which runs that name\'s where it holds that name\'s value, and refuses one handed for it, naming the name whose ::builtin{} it holds', async () => {
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

  it('refuses a primitive handed for a verb of steps', async () => {
    await expect(createSession({ sources: [{
      uri: 'tests/over', source: ':any/many ~(count)', primitives: { 'any/many': () => 0 }
    }] })).rejects.toMatchObject({ name: 'PrimitiveNamesNoBuiltinError', address: 'builtin/PrimitiveNamesNoBuiltinError' });
  });

  it('refuses a primitive handed for a name that is no ::builtin{} under a label, saying so', async () => {
    const refusal = (uri, name) => `qlang root: the source ${uri} is handed a primitive for :${name}, which it declares as no ::builtin{} under a label`;
    for (const [uri, source, name] of [['tests/bare', ':shout ::builtin{}', 'shout'], ['tests/map', ':x {} | :x/shout ::builtin{}', 'x/shout'], ['tests/stray', ':limit 10', 'limit']]) {
      const refused = await createSession({ sources: [{ uri, source, primitives: { [name]: text => text } }] }).catch(caught => caught);
      expect(refused).toMatchObject({ name: 'PrimitiveNamesNoBuiltinError', message: refusal(uri, name) });
      expect(refused.facts).toEqual({ origin: keyword(uri), name: keyword(name) });
    }
  });

  it('refuses a source that declares a name the root holds, bare or with a path, by one refusal naming the source as its origin', async () => {
    for (const source of [':vec |~~ again ~~|', ':vec/count ~(0)']) {
      await expect(createSession({ sources: [{ uri: 'tests/twice', source }] }))
        .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', facts: { origin: keyword('tests/twice'), tagName: '::bind/NameDeclaredTwiceError' } });
    }
  });

  it('declares a refusal of the host at its address again in every session of the process', async () => {
    declareRefusal('Probe/SessionProbeRefusalError');
    const sources = [{ uri: 'tests/refusal', source: ':Probe {} | :Probe/SessionProbeRefusalError |~~ SessionProbeRefusalError. ~~|' }];
    await createSession({ sources });
    expect((await (await createSession({ sources })).evalCell('::Probe | manifest | count')).result).toBe(1);
  });

  it('refuses a source whose run answers an error', async () => {
    await expect(createSession({ sources: [{ uri: 'tests/broken', source: ':a 1 | 1 | add "x" | :b 2' }] }))
      .rejects.toMatchObject({ name: 'RootSourceNotDeclaredError', message: expect.stringContaining('the source tests/broken is refused') });
  });
});

describe('a kind whose construct is a primitive of the host', () => {
  it('puts a payload under the tag through the constructor its host hands', async () => {
    const { createSession } = await import('../../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'tests/kind', source: ':myType |~~ myType. ~~| (::kind | impl ::builtin{})', primitives: { 'myType/construct': payload => payload * 2 } }]
    });
    expect((await sessionInstance.evalCell('::myType#4 | get [~(type) ~(payload)]')).result).toEqual([makeTag('myType'), 8]);
  });

  it('a kind a reader declares with a constructor no host hands lays its tag over a quote', async () => {
    const result = await evalQuery(':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | ::myType~(add 1) | type');
    expect(result).toEqual(makeTag('myType'));
  });
});

it('names the source of a quote by the name its reader gave it, `quote` for one no text wrote', () => {
  expect(originOf(parse('add 1', { uri: 'cell-3' }))).toBe('cell-3');
  expect(originOf(makeQuote([commandStep('count', [])]))).toBe('quote');
});
