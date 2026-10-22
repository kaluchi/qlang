import { describe, it, expect, beforeAll } from 'vitest';
import { createSession, evalQuery } from '../../../src/session.mjs';
import { langRuntime } from '../../../src/runtime/index.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { toPlain, fromPlain } from '../../../src/runtime/json.mjs';
import { compareValues } from '../../../src/ordering.mjs';
import { declareRefusal, declareDefect } from '../../../src/errors.mjs';
import { WITHHELD_KEY } from '../../../src/scope-keys.mjs';
import { keyword, makeTag, makeErrorValue, makeBinding, typeOf, accountOfForeign, BuiltinForeignValueError, isErrorValue, isMap } from '../../../src/types.mjs';
import { valuesOfTheLanguage, valuesOfNoKind } from '../../helpers/values-at-the-door.mjs';
import { errorFromQlang, errorFromForeign } from '../../../src/error-convert.mjs';
import { TestsProbeTypeError } from '../../helpers/probe-refusal.mjs';

const ANSWERS = [];
const answering = value => ANSWERS.push(value) - 1;
const AnyRefuseRefusedError = declareRefusal('any/refuse/RefusedError');
const AnyBreakBrokenError = declareDefect('any/break/BrokenError', () => 'the host broke');
let session;
let lawful;

beforeAll(async () => {
  session = await createSession({ sources: [{
    uri: 'tests/door',
    source: [
      ':any/answer ::builtin{}',
      ':any/later ::builtin{}',
      ':any/twice ::builtin{}',
      ':any/same ::builtin{}',
      ':any/again (::any/answer | binding | get /value)',
      ':any/refuse (::fn | throws :RefusedError |~~ Refused. ~~| | impl ::builtin{})',
      ':any/refuseLater (::fn | throws :RefusedError |~~ Refused. ~~| | impl ::builtin{})',
      ':any/break ::builtin{}',
      ':Raw |~~ A raw. ~~| (::kind | impl ::builtin{})',
      ':Kept |~~ A kept. ~~| (::kind | impl ::builtin{})',
      ':Counted |~~ A counted. ~~| (::kind | impl ::builtin{})'
    ].join('\n'),
    primitives: {
      'any/answer': index => ANSWERS[index],
      'any/later': async index => ANSWERS[index],
      'any/twice': subject => [subject, subject],
      'any/same': subject => subject,
      'any/refuse': index => { throw new AnyRefuseRefusedError({ actualValue: ANSWERS[index] }); },
      'any/refuseLater': async index => { throw new AnyRefuseRefusedError({ actualValue: ANSWERS[index] }); },
      'any/break': index => { throw new AnyBreakBrokenError({ detail: ANSWERS[index] }); },
      'Raw/construct': payload => ({ raw: payload }),
      'Kept/construct': payload => payload,
      'Counted/construct': (...handed) => handed.length
    }
  }] });
  lawful = await valuesOfTheLanguage();
});

const answerOf = async (value, verb = 'answer') => (await session.evalCell(`${answering(value)} | ${verb}`)).result;
const refusalOf = async (value, verb = 'answer') => (await session.evalCell(`${answering(value)} | ${verb} !| get [~(type) /message]`)).result;
const doorRefusal = (address, path, account) =>
  [HOST_FAILURE, `the answer of ::${address} ${path === '' ? 'is' : `holds at ${path}`} ${account}, a value of no kind of the language`];

const HOST_FAILURE = makeTag('call/HostFailureError');

function counted(element) {
  const reads = { count: 0 };
  const vector = new Proxy([element], {
    get(target, key) {
      if (key === '0') reads.count += 1;
      return Reflect.get(target, key);
    }
  });
  return { vector, reads };
}

describe('the first door: the answer of a primitive a host hands beside its source', () => {
  it('passes each kind of value of the language back as it is', async () => {
    for (const value of lawful) expect(await answerOf(value)).toBe(value);
  });

  it('passes a failure the primitive answers, whose facts are values', async () => {
    const failure = makeErrorValue(makeTag('error'), new Map([['a', 1]]));
    expect((await answerOf(failure)).facts.get('a')).toBe(1);
    expect((await session.evalCell(`${answering(failure)} | answer !| get /a`)).result).toBe(1);
  });

  it('refuses each value of no kind as a failure of the host, naming the verb and the path where it stands', async () => {
    for (const [value, path, account] of valuesOfNoKind()) expect(await refusalOf(value), account).toEqual(doorRefusal('any/answer', path, account));
  });

  it('walks a container met twice in one answer once', async () => {
    const { vector, reads } = counted(1);
    const pair = [vector, vector];
    expect(await answerOf(pair)).toBe(pair);
    expect(reads.count).toBe(1);
  });

  it('walks the answer of every call again, so a container its host changed since is refused', async () => {
    const cached = [1, 2];
    const index = answering(cached);
    expect((await session.evalCell(`${index} | answer | count`)).result).toBe(2);
    cached.push(function leaked() {});
    expect((await session.evalCell(`${index} | answer !| get [~(type) /message]`)).result).toEqual(doorRefusal('any/answer', '/2', 'function leaked'));
    cached[2] = cached;
    expect((await session.evalCell(`${index} | answer !| get [~(type) /message]`)).result).toEqual(doorRefusal('any/answer', '/2', 'a vector that holds itself'));
  });

  it('passes back unwalked a value the call handed in', async () => {
    const { vector, reads } = counted(1);
    expect((await session.evalCell('same', { initialPipeValue: vector })).result).toBe(vector);
    expect(reads.count).toBe(1);
    expect((await session.evalCell('twice | count', { initialPipeValue: vector })).result).toBe(2);
    expect(reads.count).toBe(2);
  });

  it('holds a value nested past the depth the engine recurses to', async () => {
    let nested = [0];
    let deepest = [function deepest() {}];
    for (let depth = 0; depth < 20000; depth += 1) {
      nested = [nested];
      deepest = [deepest];
    }
    expect(await answerOf(nested)).toBe(nested);
    expect((await session.evalCell(`${answering(deepest)} | answer !| type`)).result).toEqual(HOST_FAILURE);
  });

  it('holds an answer a primitive waits on as it holds any', async () => {
    expect(await answerOf(5, 'later')).toBe(5);
    expect(await refusalOf({ a: 1 }, 'later')).toEqual(doorRefusal('any/later', '', 'object Object'));
  });

  it('holds the primitive a host hands under every name that runs it, a name that holds its ::builtin{} among them', async () => {
    expect(await answerOf(5, 'again')).toBe(5);
    expect(await refusalOf(function hello() {}, 'again')).toEqual(doorRefusal('any/again', '', 'function hello'));
  });

  it('holds the facts of a refusal a host\'s primitive throws as its answer, a fact left undefined none', async () => {
    expect((await session.evalCell(`${answering('late')} | refuse !| get [~(type) /actualValue]`)).result).toEqual([makeTag('any/refuse/RefusedError'), 'late']);
    expect((await session.evalCell(`${answering(undefined)} | refuse !| type`)).result).toEqual(makeTag('any/refuse/RefusedError'));
    expect(await refusalOf({ status: 404 }, 'refuse')).toEqual(doorRefusal('any/refuse', '/actualValue', 'object Object'));
    expect(await refusalOf({ status: 404 }, 'refuseLater')).toEqual(doorRefusal('any/refuseLater', '/actualValue', 'object Object'));
  });

  it('raises past the fail track a defect a host\'s primitive throws, whatever its facts hold', async () => {
    const cell = await session.evalCell(`${answering({ status: 404 })} | break !| 0`);
    expect([cell.result, cell.defect]).toEqual([null, expect.any(AnyBreakBrokenError)]);
  });

  it('holds the answer of the constructor a host hands a kind, which takes the payload alone and passes it back as it is', async () => {
    expect((await session.evalCell('::Raw[1] !| get [~(type) /message]')).result).toEqual(doorRefusal('Raw/construct', '', 'object Object'));
    expect((await session.evalCell('::Kept[1] | payload')).result).toEqual([1]);
    expect((await session.evalCell('::Counted[7] | payload')).result).toBe(1);
  });
});

describe('a primitive of the core runs within the function its host handed it with', () => {
  const overAdd = returns => `(::fn | takes :x |~~ An x. ~~| /0${returns} | impl (::number/add | binding | get /value | get /1))`;

  it('refuses a function of the reader made from a primitive of the core as one that holds no recipe it runs, whatever its returns names', async () => {
    for (const returns of ['', ' | returns |~~ A sum. ~~| ::number', ' | returns |~~ A sum. ~~| #[::number ::string]']) {
      expect((await session.evalCell(`1e308 | apply ${overAdd(returns)} [1e308] !| type`)).result).toEqual(makeTag('fn/RecipeMissingError'));
    }
  });

  it('brings an answer past the doubles under the kinds `returns` names, the function of a verb of the core and one written in steps alike', async () => {
    for (const fn of ['(::number/add | binding | get /value)', '(::fn | takes :x |~~ An x. ~~| /0 | returns |~~ A sum. ~~| ::number | impl ~(add x))']) {
      expect((await session.evalCell(`1e308 | apply ${fn} [1e308] !| type`)).result).toEqual(makeTag('number/NotFiniteError'));
    }
  });
});

describe('the second door: what a host hands where the core takes it', () => {
  const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: keyword('held'), value }));

  it('takes each kind of value of the language as the subject of a cell and as what a name of a scope holds', async () => {
    for (const value of lawful) {
      expect((await session.evalCell('it', { initialPipeValue: value })).result).toBe(value);
      expect(await evalQuery('held', await scopeHolding(value))).toBe(value);
      expect((await (await createSession({ scope: await scopeHolding(value) })).evalCell('held')).result).toBe(value);
    }
  });

  it('raises each value of no kind as the subject of a cell, naming it as JavaScript holds it', async () => {
    for (const [value, , account] of valuesOfNoKind()) {
      const cell = await session.evalCell('type', { initialPipeValue: value });
      expect([cell.result, cell.defect], account).toEqual([null, expect.any(BuiltinForeignValueError)]);
      expect(cell.defect.facts, account).toEqual({ actualValue: account });
      expect(cell.defect.message).toBe(`the core met ${account}, a value of no kind of the language`);
    }
  });

  it('raises each value of no kind a name of a scope holds, as a record or as it lies, where a query or a session takes the scope', async () => {
    for (const [value, , account] of valuesOfNoKind()) {
      for (const scope of [await scopeHolding(value), new Map(await langRuntime()).set('held', value)]) {
        await expect(evalQuery('1', scope), account).rejects.toMatchObject({ address: 'builtin/ForeignValueError', facts: { actualValue: account } });
        await expect(createSession({ scope }), account).rejects.toMatchObject({ address: 'builtin/ForeignValueError', facts: { actualValue: account } });
      }
    }
  });

  it('reads a value JavaScript leaves undefined as null wherever the language reads it', async () => {
    expect((await session.evalCell('get [~(type) ~(eq null) ~(print)]', { initialPipeValue: undefined })).result).toEqual([makeTag('null'), true, 'null']);
    expect((await session.evalCell('get [~(eq [1 null 3]) ~(print) ~(print | parse | open | eq [1 null 3])]', { initialPipeValue: [1, undefined, 3] })).result).toEqual([true, '[1 null 3]', true]);
  });

  it('leaves the keys of the runtime\'s own out of the walk of a scope', async () => {
    const scope = new Map(await langRuntime()).set(WITHHELD_KEY, new Set(['x']));
    expect(await evalQuery('1 | add 1', scope)).toBe(2);
  });
});

describe('a value of no kind the core meets where it reads a kind or writes a number', () => {
  it('raises an object of no kind of the core where its kind is read, and reads every number of JavaScript as a number', () => {
    for (const value of [function named() {}, { a: 1 }, new Date(0), 5n, Symbol('s')]) {
      expect(() => typeOf(value)).toThrow(BuiltinForeignValueError);
    }
    expect([Infinity, NaN, -0].map(typeOf)).toEqual([makeTag('number'), makeTag('number'), makeTag('number')]);
  });

  it('raises a number past the finite doubles where the printer and the codec of JSON write it, and ranks it in the one order', () => {
    for (const number of [Infinity, -Infinity, NaN]) {
      expect(() => printValue([number])).toThrow(BuiltinForeignValueError);
      expect(() => toPlain([number])).toThrow(BuiltinForeignValueError);
    }
    expect([compareValues(1, Infinity), compareValues(-Infinity, 1)]).toEqual([-1, -1]);
  });

  it('names a value as JavaScript holds it', () => {
    expect([function named() {}, [() => 0][0], 3n, Symbol('s'), Infinity, new Date(0), Object.create(null), undefined, null].map(accountOfForeign))
      .toEqual(['function named', 'function', 'bigint 3', 'symbol Symbol(s)', 'number Infinity', 'object Date', 'object null', 'undefined', 'null']);
  });
});

describe('a failure of JavaScript lifted to a failure of the host', () => {
  // [QSERR#site]
  it('lifts a JavaScript error to its account under the tag of the language', async () => {
    const jsErr = new Error('something went wrong');
    const errorVal = errorFromForeign(jsErr, await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    expect(errorVal.tag).toEqual(makeTag('call/HostFailureError'));
    expect([...errorVal.facts.keys()]).toEqual(['message']);
    expect(errorVal.facts.get('message')).toBe('something went wrong');
    expect(errorVal.originalError).toBe(jsErr);
  });

  it('leaves the stack, the class and the fields of the host error with the host', async () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const errorVal = errorFromForeign(new AppError(), await langRuntime());
    expect([...errorVal.facts.keys()]).toEqual(['message']);
    expect(errorVal.originalError.code).toBe('NOT_FOUND');
  });

  it('recounts the accounts of the failures beneath it, outermost first', async () => {
    const top = new Error('top error', { cause: new Error('intermediate', { cause: 'root cause' }) });
    const errorVal = errorFromForeign(top, await langRuntime());
    expect(errorVal.facts.get('causes')).toEqual(['intermediate', 'root cause']);
  });

  it('recounts eight failures beneath it at most', async () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    expect(errorFromForeign(current, await langRuntime()).facts.get('causes')).toHaveLength(8);
  });

  it('gives no causes where none stands beneath it', async () => {
    const scope = await langRuntime();
    expect(errorFromForeign(new Error('no cause'), scope).facts.has('causes')).toBe(false);
    expect(errorFromForeign(new Error('a null cause', { cause: null }), scope).facts.has('causes')).toBe(false);
  });

  it('takes a thrown value that is no error by its text', async () => {
    expect(errorFromForeign('a bare string', await langRuntime()).facts.get('message')).toBe('a bare string');
  });
});

it('leaves out a fact its site hands as undefined', async () => {
  const typeErr = new TestsProbeTypeError({ index: undefined, actualValue: null });
  const errorVal = errorFromQlang(typeErr, 42, await langRuntime());
  expect(errorVal.facts.has('index')).toBe(false);
  expect(errorVal.facts.get('actualValue')).toBe(null);
  expect(errorVal.facts.get('actualType')).toEqual(makeTag('null'));
});

describe('the answer of a primitive a host hands', () => {
  it('waits on a thenable a primitive answers and on a promise of another realm', async () => {
    const vm = await import('node:vm');
    const s = await createSession({
      sources: [{
        uri: 'tests/later',
        source: ':number/later ::builtin{}\n:number/elsewhere ::builtin{}',
        primitives: {
          'number/later': n => ({ then(resolve) { resolve(n + 1); } }),
          'number/elsewhere': vm.runInNewContext('(async (n) => n + 1)')
        }
      }]
    });
    expect((await s.evalCell('get [~(41 | later | add 1) ~(41 | elsewhere | add 1)]')).result).toEqual([43, 43]);
  });

  it('refuses a number past the finite doubles a host\'s primitive answers at the door, under several kinds as under one', async () => {
    const s = await createSession({
      sources: [{
        uri: 'tests/past',
        source: ':any/past (::fn | returns |~~ A number or null. ~~| #[::number ::null] | impl ::builtin{})\n:any/pastOne (::fn | returns |~~ A number. ~~| ::number | impl ::builtin{})',
        primitives: { 'any/past': () => Infinity, 'any/pastOne': () => Infinity }
      }]
    });
    expect((await s.evalCell('1 | past !| get [~(type) /message]')).result)
      .toEqual(await evalQuery('[::call/HostFailureError "the answer of ::any/past is number Infinity, a value of no kind of the language"]'));
    expect((await s.evalCell('1 | pastOne !| type')).result).toEqual(await evalQuery('::call/HostFailureError'));
  });
});

it('lifts an error of JavaScript and any other value a primitive throws to a failure of the host', async () => {
  const s = await createSession({
    sources: [{
      uri: 'tests/bomb',
      source: ':any/bomb ::builtin{}\n:any/hollow ::builtin{}',
      primitives: { 'any/bomb': () => { throw new Error('raw boom'); }, 'any/hollow': () => { throw undefined; } }
    }]
  });
  const entry = await s.evalCell('42 | bomb');
  expect(isErrorValue(entry.result)).toBe(true);
  expect(entry.result.tag.name).toBe('call/HostFailureError');
  expect([...entry.result.facts.keys()]).toEqual(['message', 'trace']);
  expect(entry.result.facts.get('message')).toBe('raw boom');
  expect((await s.evalCell('42 | hollow !| get [~(type) /message ~(trace | first | place)]')).result).toEqual(await evalQuery('[::call/HostFailureError "undefined" null]'));
});

it('a parsed document lifts into the same map a literal reads into', async () => {
  const lifted = fromPlain(JSON.parse('{"a": [1, 2]}'));
  const read = await evalQuery('{"a": [1, 2]}');
  const { compareValues } = await import('../../../src/ordering.mjs');
  expect(compareValues(lifted, read) === 0).toBe(true);
});

describe('the codec of JSON refuses a value of no kind of the language where it reads its kind', () => {
  it('refuses an object of JavaScript a host handed', () => {
    expect(() => toPlain(new Date())).toThrow(BuiltinForeignValueError);
  });

  it('names what it refused as JavaScript holds it, and no kind of it', () => {
    let refused;
    try { toPlain([Symbol('s')]); } catch (error) { refused = error; }
    expect(refused.facts).toEqual({ actualValue: 'symbol Symbol(s)' });
  });
});

describe('a value of JSON lifted into the language and back', () => {

  it('atoms pass through unchanged', async () => {
    expect(fromPlain(42)).toBe(42);
    expect(fromPlain('hi')).toBe('hi');
    expect(fromPlain(true)).toBe(true);
    expect(fromPlain(null)).toBe(null);
  });

  it('an array of JavaScript lifts into a vector element by element', async () => {
    const lifted = fromPlain([1, 'two', true]);
    expect(lifted).toEqual([1, 'two', true]);
  });

  it('an object of JavaScript lifts into a map keyed by its names', async () => {
    const lifted = fromPlain({ a: 1, b: 2 });
    expect(isMap(lifted)).toBe(true);
    expect(lifted.get('a')).toBe(1);
    expect(lifted.get('b')).toBe(2);
  });

  it('round-trips nested data of JSON into the language and back', async () => {
    const plain = { user: { name: 'alice', tags: ['admin', 'dev'] } };
    const roundtrip = toPlain(fromPlain(plain));
    expect(roundtrip).toEqual(plain);
  });
});

describe('a number past the doubles, refused by the printer and the codec of JSON', () => {
  // [QSLIT#number], [QSNUM#arithmetic]
  it('the printer refuses an infinity and a NaN as values of no kind', () => {
    for (const leaked of [Infinity, -Infinity, NaN]) {
      let thrown = null;
      try { printValue(leaked); } catch (caught) { thrown = caught; }
      expect(thrown).toBeInstanceOf(BuiltinForeignValueError);
      expect(thrown.name).toBe('ForeignValueError');
      expect(thrown.facts.actualValue).toBe(`number ${leaked}`);
    }
  });

  it('the codec of JSON refuses the values the printer refuses', () => {
    for (const leaked of [Infinity, -Infinity, NaN]) {
      expect(() => toPlain(leaked), String(leaked)).toThrow(BuiltinForeignValueError);
    }
  });
});

it('reads no kind of an object of JavaScript, a value of no kind of the language', () => {
  expect(() => typeOf({ type: 'alien' })).toThrow('the core met object Object, a value of no kind of the language');
});

it('the printer refuses a value of no kind of the language where it reads its kind', () => {
  expect(() => printValue(Symbol('x'))).toThrow('the core met symbol Symbol(x), a value of no kind of the language');
});

describe('a session takes what its host hands by the walk of the door', () => {
  const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: keyword('held'), value }));

  it('takes a value of each kind of the language as the subject of a cell and in the scope it starts from, as it is', async () => {
    const sessionInstance = await createSession();
    for (const value of await valuesOfTheLanguage()) {
      expect((await sessionInstance.evalCell('it', { initialPipeValue: value })).result).toBe(value);
      expect((await (await createSession({ scope: await scopeHolding(value), sources: [] })).evalCell('held')).result).toBe(value);
    }
  });

  it('answers a subject of no kind as the defect of its cell, raised past the fail track, and the cells after it run', async () => {
    const sessionInstance = await createSession();
    for (const [value, , account] of valuesOfNoKind()) {
      const cell = await sessionInstance.evalCell(':late 1 | type', { initialPipeValue: value });
      expect([cell.result, cell.defect, cell.defect.facts], account).toEqual([null, expect.any(BuiltinForeignValueError), { actualValue: account }]);
      expect(cell.scopeAfterCell.has('late')).toBe(false);
    }
    expect((await sessionInstance.evalCell('1 | add 1')).result).toBe(2);
  });

  it('refuses a scope whose name holds a value of no kind, before its sources declare the root', async () => {
    for (const [value, , account] of valuesOfNoKind()) {
      await expect(createSession({ scope: await scopeHolding(value), sources: [{ uri: 'tests/never', source: ':any/never ::builtin{}' }] }), account)
        .rejects.toMatchObject({ address: 'builtin/ForeignValueError', facts: { actualValue: account } });
    }
  });
});
