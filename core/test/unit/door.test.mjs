// The doors of a host [QSHST#source]: the answer of a primitive a host hands beside
// its source, and the facts of a refusal it throws, are held to the kinds of
// the language at any depth by one walk, a value of no kind failing the call
// as `::call/HostFailureError` naming the verb and the path where it stands;
// the subject a host hands a cell and what the names of a scope it hands hold
// are held by the same walk, a value of no kind raised past the fail track as
// `::builtin/ForeignValueError`; the primitives of the core are never walked.

import { describe, it, expect, beforeAll } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/print-value.mjs';
import { toPlain } from '../../src/runtime/json.mjs';
import { compareValues } from '../../src/ordering.mjs';
import { declareRefusal, declareDefect } from '../../src/errors.mjs';
import { WITHHELD_KEY } from '../../src/scope-keys.mjs';
import {
  keyword, makeTag, makeTagged, makeErrorValue, makeBinding, typeOf, accountOfForeign, BuiltinForeignValueError, ERROR_TAG
} from '../../src/types.mjs';
import { valuesOfTheLanguage, valuesOfNoKind } from '../helpers/values-at-the-door.mjs';

// A host's verb that answers the value the test lays at the index its
// subject names, one that throws a refusal holding it, and a kind whose
// constructor the host hands.
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

// A vector whose element the test counts the reads of.
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

describe('the first door: the answer of a primitive a host hands beside its source [QSHST#source]', () => {
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
    // The door of a cell walks the subject it takes once, and the door of an
    // answer walks no value the call handed in.
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

describe('a primitive of the core runs within the function its host handed it with [QSHST#source]', () => {
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

describe('the second door: what a host hands where the core takes it [QSHST#source]', () => {
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

  it('prints a value a host hands under `::error` over a payload that is no map as the payload under its tag, the error literal writing a map alone [QSERR#rest]', async () => {
    expect(await evalQuery('held | print', await scopeHolding(makeTagged(ERROR_TAG, 5)))).toBe('::error#5');
  });

  it('leaves the keys of the runtime\'s own out of the walk of a scope', async () => {
    const scope = new Map(await langRuntime()).set(WITHHELD_KEY, new Set(['x']));
    expect(await evalQuery('1 | add 1', scope)).toBe(2);
  });
});

describe('a value of no kind the core meets where it reads a kind or writes a number [QSHST#source]', () => {
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
