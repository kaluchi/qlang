// The rules it holds: [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('eval — literals', () => {
  it('evaluates a number literal', async () => {
    expect(await evalQuery('42')).toBe(42);
  });

  it('evaluates a negative number', async () => {
    expect(await evalQuery('-7')).toBe(-7);
  });

  it('evaluates a string literal', async () => {
    expect(await evalQuery('"hello"')).toBe('hello');
  });

  it('evaluates true', async () => {
    expect(await evalQuery('true')).toBe(true);
  });

  it('evaluates false', async () => {
    expect(await evalQuery('false')).toBe(false);
  });

  it('evaluates null', async () => {
    expect(await evalQuery('null')).toBe(null);
  });

  it('evaluates a keyword', async () => {
    expect(await evalQuery(':name')).toEqual(keyword('name'));
  });

  it('evaluates a Vec literal', async () => {
    expect(await evalQuery('[1 2 3]')).toEqual([1, 2, 3]);
  });

  it('evaluates an empty Vec', async () => {
    expect(await evalQuery('[]')).toEqual([]);
  });
});

describe('eval — pipeline arithmetic', () => {
  it('100 | mul 2 → 200', async () => {
    expect(await evalQuery('100 | mul 2')).toBe(200);
  });

  it('10 | sub 3 → 7', async () => {
    expect(await evalQuery('10 | sub 3')).toBe(7);
  });

  it('10 | add 5 → 15', async () => {
    expect(await evalQuery('10 | add 5')).toBe(15);
  });

  it('10 | div 2 → 5', async () => {
    expect(await evalQuery('10 | div 2')).toBe(5);
  });

  it('chained arithmetic', async () => {
    expect(await evalQuery('10 | add 5 | mul 2')).toBe(30);
  });
});

describe('eval — Vec reducers', () => {
  it('count', async () => {
    expect(await evalQuery('[1 2 3 4 5] | count')).toBe(5);
  });

  it('sum', async () => {
    expect(await evalQuery('[1 2 3 4 5] | sum')).toBe(15);
  });

  it('first', async () => {
    expect(await evalQuery('[10 20 30] | first')).toBe(10);
  });

  it('last', async () => {
    expect(await evalQuery('[10 20 30] | last')).toBe(30);
  });

  it('min', async () => {
    expect(await evalQuery('[3 1 4 1 5] | min')).toBe(1);
  });

  it('max', async () => {
    expect(await evalQuery('[3 1 4 1 5] | max')).toBe(5);
  });
});

describe('eval — filter', () => {
  it('filter with gt predicate', async () => {
    expect(await evalQuery('[1 2 3 4 5] | filter ~(gt 2)')).toEqual([3, 4, 5]);
  });

  it('filter then count (the canonical model example)', async () => {
    expect(await evalQuery('[1 2 3 4 5] | filter ~(gt 3) | count')).toBe(2);
  });
});

describe('eval — Map and path', () => {
  it('projects a Map field', async () => {
    expect(await evalQuery('{:name "Alice" :age 30} | get /name')).toBe('Alice');
  });

  it('a strict path: a missing key raises PathKeyNotInMapError', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const result = await evalQuery('{:name "Alice"} | get /age');
    expect(isErrorValue(result)).toBe(true);
    expect(result.tag.name).toBe('path/KeyNotInMapError');
    expect(result.descriptor.get('key').name).toBe('age');
  });

  it('reads a nested path', async () => {
    expect(await evalQuery('{:point {:x 5 :y 7}} | get /point/x')).toBe(5);
  });
});

describe('eval — a verb that combines two fields of one record', () => {
  it('mulOf multiplies two fields of one record', async () => {
    expect(await evalQuery('{:price 100 :qty 3} | mulOf /price /qty')).toBe(300);
  });
});

describe('eval — a declaration of it', () => {
  it('names the value in the pipe and reads it back', async () => {
    expect(await evalQuery('[1 2 3] | :nums it | nums | count')).toBe(3);
  });

  it('names the values of several stages', async () => {
    expect(await evalQuery(`
      [85 92 47 78 68 95 52]
        | :allScores it
        | filter ~(gte 70)
        | :passingScores it
        | get [~(allScores | count), ~(passingScores | count)]
    `)).toEqual([7, 4]);
  });
});

describe('eval — BindStep declaration', () => {
  it('binds and runs a verb', async () => {
    expect(await evalQuery(':any/double ~(mul 2) | 10 | double')).toBe(20);
  });
});

describe('eval — env', () => {
  it('env returns a Map', async () => {
    const envResult = await evalQuery('env');
    expect(envResult).toBeInstanceOf(Map);
  });

  it('env holds no verb of the core', async () => {
    expect(await evalQuery('env | has :count')).toBe(false);
  });
});

describe('eval.mjs unknown node type', () => {
  it('throws on unknown AST node', async () => {
    const fakeNode = { type: 'BogusNode' };
    const runtimeEnv = await langRuntime();
    const state = rootState(null, runtimeEnv);
    await expect(evalAst(fakeNode, state)).rejects.toThrow(/unknown AST node type/);
  });
});

describe('quoted keywords — eval-level identity and Map interop', () => {
  it(':"name" interns to the same keyword :name', async () => {
    expect(await evalQuery(':"name" | eq :name')).toBe(true);
  });

  it('Map literal with a quoted-key entry is read by get /"key"', async () => {
    expect(await evalQuery('{:"weird key" 42} | get /"weird key"')).toBe(42);
  });

  it('Map literal with a quoted key is queryable via has(:"weird key")', async () => {
    expect(await evalQuery('{:"weird key" 1} | has :"weird key"')).toBe(true);
  });

  it('the empty-string keyword survives a Map round-trip', async () => {
    expect(await evalQuery('{:"" "empty key value"} | get /""')).toBe('empty key value');
  });

  it('digit-leading keys are reachable through a quoted path', async () => {
    expect(await evalQuery('{:"123" "digit"} | get /"123"')).toBe('digit');
  });

  it('keys returns interned keywords regardless of declaration form', async () => {
    // The set returned by keys contains keywords; verify the bare and
    // quoted forms produce equivalent keyword identity downstream.
    expect(await evalQuery('{:foo 1} | keys | has :"foo"')).toBe(true);
    expect(await evalQuery('{:"foo" 1} | keys | has :foo')).toBe(true);
  });

  it('json emits arbitrary JSON object keys via quoted Map keys', async () => {
    const jsonOutput = await evalQuery('{:"foo bar" 1 :"$ref" "x"} | json');
    expect(jsonOutput).toContain('"foo bar"');
    expect(jsonOutput).toContain('"$ref"');
  });
});

describe('apply runs a quote held in a name', async () => {
  // A quote held in a name runs by `apply` on the subject it is given
  // [QSQUO#apply].
  it('a quote read from text runs through apply against a new subject', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession();
    const cellEntry = await session.evalCell(':snippet ~(add 1) | 41 | apply snippet');
    expect(cellEntry.result).toBe(42);
  });
});

describe('the answer of a verb of the host', async () => {
  it('waits on an answer that has a then, a thenable and a promise of another realm', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const vm = await import('node:vm');
    const s = await createSession({
      sources: [{
        uri: 'tests/later',
        source: ':number/later ::builtin{}\n:number/elsewhere ::builtin{}',
        impls: {
          'number/later': n => ({ then(resolve) { resolve(n + 1); } }),
          'number/elsewhere': vm.runInNewContext('(async (n) => n + 1)')
        }
      }]
    });
    expect((await s.evalCell('get [~(41 | later | add 1) ~(41 | elsewhere | add 1)]')).result).toEqual([43, 43]);
  });

  it('refuses a number past the finite doubles under several labels as under ::number alone', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const s = await createSession({
      sources: [{
        uri: 'tests/past',
        source: ':any/past (::fn | returns |~~ A number or null. ~~| #[::number ::null] | impl ::builtin{})',
        impls: { 'any/past': () => Infinity }
      }]
    });
    expect((await s.evalCell('1 | past !| type | eq ::number/NotFiniteError')).result).toBe(true);
  });
});

describe('eval.mjs — errorFromForeign arm (non-QlangError thrown inside evalNode)', async () => {
  it('wraps a plain JS Error from a verb as a foreign error value', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const { isErrorValue } = await import('../../src/types.mjs');
    // A host verb whose implementation throws a raw Error, no QlangError.
    const s = await createSession({
      sources: [{
        uri: 'tests/bomb',
        source: ':any/bomb ::builtin{}',
        impls: { 'any/bomb': () => { throw new Error('raw boom'); } }
      }]
    });
    const entry = await s.evalCell('42 | bomb');
    expect(isErrorValue(entry.result)).toBe(true);
    expect(entry.result.tag.name).toBe('call/HostFailureError');
    expect([...entry.result.descriptor.keys()]).toEqual(['message', 'trace']);
    expect(entry.result.descriptor.get('message')).toBe('raw boom');
  });
});

describe('eval.mjs — a Call node built by hand', async () => {
  it('runs the verb it names, its location null', async () => {
    const ast = { type: 'Call', name: 'count', args: [], location: null };
    const runtimeEnv = await langRuntime();
    const state = rootState([1, 2, 3], runtimeEnv);
    const evalResult = await evalAst(ast, state);
    const result = evalResult.pipeValue;
    expect(result).toBe(3);
  });
});
