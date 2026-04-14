import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';

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

  it('returns null for missing key', async () => {
    expect(await evalQuery('{:name "Alice"} | /age')).toBe(null);
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

describe('eval — let binding', () => {
  it('binds and forces a conduit', async () => {
    expect(await evalQuery('let(:double, mul(2)) | 10 | double')).toBe(20);
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
