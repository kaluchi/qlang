// A primitive a host hands answers through the door of the runtime: an answer
// that is a promise or has a then is awaited, a number past the finite
// doubles is refused, and what the primitive throws that is no refusal is a
// failure of the host [QSHST#source].

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { isErrorValue } from '../../src/types.mjs';

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

  it('refuses a number past the finite doubles a host\'s primitive answers at the door, under several kinds as under one [QSHST#source]', async () => {
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

describe('what a primitive throws that is no refusal', () => {
  it('lifts an error of JavaScript and any other value a primitive throws to a failure of the host', async () => {
    // A host's primitive that throws an error of JavaScript, no QlangError, and one that throws undefined.
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
});
