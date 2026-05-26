import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';
import { makeState } from '../../src/state.mjs';
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
  it('100 | mul(2) → 200', async () => {
    expect(await evalQuery('100 | mul(2)')).toBe(200);
  });

  it('10 | sub(3) → 7', async () => {
    expect(await evalQuery('10 | sub(3)')).toBe(7);
  });

  it('10 | add(5) → 15', async () => {
    expect(await evalQuery('10 | add(5)')).toBe(15);
  });

  it('10 | div(2) → 5', async () => {
    expect(await evalQuery('10 | div(2)')).toBe(5);
  });

  it('chained arithmetic', async () => {
    expect(await evalQuery('10 | add(5) | mul(2)')).toBe(30);
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
    expect(await evalQuery('[1 2 3 4 5] | filter(gt(2))')).toEqual([3, 4, 5]);
  });

  it('filter then count (the canonical model example)', async () => {
    expect(await evalQuery('[1 2 3 4 5] | filter(gt(3)) | count')).toBe(2);
  });
});

describe('eval — distribute', () => {
  it('[1 2 3] * add(1) → [2 3 4]', async () => {
    expect(await evalQuery('[1 2 3] * add(1)')).toEqual([2, 3, 4]);
  });

  it('[1 2 3] * mul(10) → [10 20 30]', async () => {
    expect(await evalQuery('[1 2 3] * mul(10)')).toEqual([10, 20, 30]);
  });
});

describe('eval — Map and projection', () => {
  it('projects a Map field', async () => {
    expect(await evalQuery('{:name "Alice" :age 30} | /name')).toBe('Alice');
  });

  it('strict-projection: missing key raises ProjectionKeyNotInMapError', async () => {
    const { isErrorValue } = await import('../../src/types.mjs');
    const result = await evalQuery('{:name "Alice"} | /age');
    expect(isErrorValue(result)).toBe(true);
    expect(result.tag.name).toBe('ProjectionKeyNotInMapError');
    expect(result.descriptor.get('key')).toBe('age');
  });

  it('chains nested projection', async () => {
    expect(await evalQuery('{:point {:x 5 :y 7}} | /point/x')).toBe(5);
  });
});

describe('eval — full application of mul', () => {
  it('mul(/price, /qty) full form', async () => {
    expect(await evalQuery('{:price 100 :qty 3} | mul(/price, /qty)')).toBe(300);
  });
});

describe('eval — as binding', () => {
  it('captures and references via as', async () => {
    expect(await evalQuery('[1 2 3] | as(:nums) | nums | count')).toBe(3);
  });

  it('multi-stage as bindings', async () => {
    expect(await evalQuery(`
      [85 92 47 78 68 95 52]
        | as(:allScores)
        | filter(gte(70))
        | as(:passingScores)
        | [allScores | count, passingScores | count]
    `)).toEqual([7, 4]);
  });
});

describe('eval — BindStep declaration', () => {
  it('binds and forces a conduit', async () => {
    expect(await evalQuery(':double mul(2) | 10 | double')).toBe(20);
  });
});

describe('eval — env operand', () => {
  it('env returns a Map', async () => {
    const envResult = await evalQuery('env');
    expect(envResult).toBeInstanceOf(Map);
  });

  it('env | has(:count) → true', async () => {
    expect(await evalQuery('env | has(:count)')).toBe(true);
  });
});

describe('eval — use', () => {
  it('use installs constants from a Map', async () => {
    expect(await evalQuery('{:taxRate 0.07} | use | taxRate')).toBe(0.07);
  });
});

describe('eval.mjs unknown node type', () => {
  it('throws on unknown AST node', async () => {
    const fakeNode = { type: 'BogusNode' };
    const runtimeEnv = await langRuntime();
    const state = makeState(null, runtimeEnv);
    await expect(evalAst(fakeNode, state)).rejects.toThrow(/unknown AST node type/);
  });
});

describe('eval.mjs unknown combinator', () => {
  it('throws on a hand-built unknown combinator', async () => {
    const ast = {
      type: 'Pipeline',
      steps: [
        { type: 'NumberLit', value: 1 },
        { combinator: '?', step: { type: 'NumberLit', value: 2 } }
      ]
    };
    const runtimeEnv = await langRuntime();
    const state = makeState(null, runtimeEnv);
    await expect(evalAst(ast, state)).rejects.toThrow(/unknown combinator/);
  });
});

describe('quoted keywords — eval-level identity and Map interop', () => {
  it(':"name" interns to the same keyword as :name', async () => {
    expect(await evalQuery(':"name" | eq(:name)')).toBe(true);
  });

  it('Map literal with a quoted-key entry is queryable via /"key"', async () => {
    expect(await evalQuery('{:"weird key" 42} | /"weird key"')).toBe(42);
  });

  it('Map literal with a quoted key is queryable via has(:"weird key")', async () => {
    expect(await evalQuery('{:"weird key" 1} | has(:"weird key")')).toBe(true);
  });

  it('the empty-string keyword survives a Map round-trip', async () => {
    expect(await evalQuery('{:"" "empty key value"} | /""')).toBe('empty key value');
  });

  it('digit-leading keys are reachable through quoted projection', async () => {
    expect(await evalQuery('{:"123" "digit"} | /"123"')).toBe('digit');
  });

  it('keys returns interned keywords regardless of declaration form', async () => {
    // The set returned by keys contains keywords; verify the bare and
    // quoted forms produce equivalent keyword identity downstream.
    expect(await evalQuery('{:foo 1} | keys | has(:"foo")')).toBe(true);
    expect(await evalQuery('{:"foo" 1} | keys | has(:foo)')).toBe(true);
  });

  it('json operand emits arbitrary JSON object keys via quoted Map keys', async () => {
    const jsonOutput = await evalQuery('{:"foo bar" 1 :"$ref" "x"} | json');
    expect(jsonOutput).toContain('"foo bar"');
    expect(jsonOutput).toContain('"$ref"');
  });
});

describe('apply — pre-parsed Quote skips the lazy re-parse', async () => {
  // `apply` reads its body AST through `astFromQuoteLike`, which
  // short-circuits when the Quote already has a `.ast` cached. The
  // runtime stamps cached-ast Quotes under `qlang/ast/<ns>` whenever
  // `use(:ns)` loads a module — build one through that path and run
  // `apply` against a fresh subject to exercise the `.ast` truthy
  // branch.
  it('use-loaded module Quote (cached .ast) runs through apply against a new subject', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async () => ({ source: 'add(1)' })
    });
    const cellEntry = await session.evalCell(
      'use(:demo/snippet) | env | /"qlang/ast/demo/snippet" | apply(41)'
    );
    expect(cellEntry.result).toBe(42);
  });
});

describe('eval.mjs — errorFromForeign arm (non-QlangError thrown inside evalNode)', async () => {
  it('wraps a plain JS Error from an operand as a foreign error value', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const { makeFn } = await import('../../src/rule10.mjs');
    const { isErrorValue } = await import('../../src/types.mjs');
    // Create a function value that throws a raw Error (not QlangError)
    const bombFn = makeFn('bomb', 1, () => { throw new Error('raw boom'); }, { captured: [0, 0] });
    const s = await createSession();
    s.bind('bomb', bombFn);
    const entry = await s.evalCell('42 | bomb');
    expect(isErrorValue(entry.result)).toBe(true);
    expect(entry.result.tag.name).toBe('Error');
    expect(entry.result.descriptor.has('category')).toBe(false);
  });
});

describe('eval.mjs — OperandCall node.docs missing (synthetic AST)', async () => {
  it('lambdas.docs falls back to [] when node has no .docs field', async () => {
    // Synthetic OperandCall without .docs — hits the `node.docs || []` false arm
    const ast = { type: 'OperandCall', name: 'count', args: null, location: null };
    const runtimeEnv = await langRuntime();
    const state = makeState([1, 2, 3], runtimeEnv);
    const evalResult = await evalAst(ast, state);
    const result = evalResult.pipeValue;
    expect(result).toBe(3);
  });
});
