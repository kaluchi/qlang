import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';

describe('eval — literals', () => {
  it('evaluates a number literal', () => {
    expect(evalQuery('42')).toBe(42);
  });

  it('evaluates a negative number', () => {
    expect(evalQuery('-7')).toBe(-7);
  });

  it('evaluates a string literal', () => {
    expect(evalQuery('"hello"')).toBe('hello');
  });

  it('evaluates true', () => {
    expect(evalQuery('true')).toBe(true);
  });

  it('evaluates false', () => {
    expect(evalQuery('false')).toBe(false);
  });

  it('evaluates null', () => {
    expect(evalQuery('null')).toBe(null);
  });

  it('evaluates a keyword', () => {
    expect(evalQuery(':name')).toEqual(keyword('name'));
  });

  it('evaluates a Vec literal', () => {
    expect(evalQuery('[1 2 3]')).toEqual([1, 2, 3]);
  });

  it('evaluates an empty Vec', () => {
    expect(evalQuery('[]')).toEqual([]);
  });
});

describe('eval — pipeline arithmetic', () => {
  it('100 | mul(2) → 200', () => {
    expect(evalQuery('100 | mul(2)')).toBe(200);
  });

  it('10 | sub(3) → 7', () => {
    expect(evalQuery('10 | sub(3)')).toBe(7);
  });

  it('10 | add(5) → 15', () => {
    expect(evalQuery('10 | add(5)')).toBe(15);
  });

  it('10 | div(2) → 5', () => {
    expect(evalQuery('10 | div(2)')).toBe(5);
  });

  it('chained arithmetic', () => {
    expect(evalQuery('10 | add(5) | mul(2)')).toBe(30);
  });
});

describe('eval — Vec reducers', () => {
  it('count', () => {
    expect(evalQuery('[1 2 3 4 5] | count')).toBe(5);
  });

  it('sum', () => {
    expect(evalQuery('[1 2 3 4 5] | sum')).toBe(15);
  });

  it('first', () => {
    expect(evalQuery('[10 20 30] | first')).toBe(10);
  });

  it('last', () => {
    expect(evalQuery('[10 20 30] | last')).toBe(30);
  });

  it('min', () => {
    expect(evalQuery('[3 1 4 1 5] | min')).toBe(1);
  });

  it('max', () => {
    expect(evalQuery('[3 1 4 1 5] | max')).toBe(5);
  });
});

describe('eval — filter', () => {
  it('filter with gt predicate', () => {
    expect(evalQuery('[1 2 3 4 5] | filter(gt(2))')).toEqual([3, 4, 5]);
  });

  it('filter then count (the canonical model example)', () => {
    expect(evalQuery('[1 2 3 4 5] | filter(gt(3)) | count')).toBe(2);
  });
});

describe('eval — distribute', () => {
  it('[1 2 3] * add(1) → [2 3 4]', () => {
    expect(evalQuery('[1 2 3] * add(1)')).toEqual([2, 3, 4]);
  });

  it('[1 2 3] * mul(10) → [10 20 30]', () => {
    expect(evalQuery('[1 2 3] * mul(10)')).toEqual([10, 20, 30]);
  });
});

describe('eval — Map and projection', () => {
  it('projects a Map field', () => {
    expect(evalQuery('{:name "Alice" :age 30} | /name')).toBe('Alice');
  });

  it('returns null for missing key', () => {
    expect(evalQuery('{:name "Alice"} | /age')).toBe(null);
  });

  it('chains nested projection', () => {
    expect(evalQuery('{:point {:x 5 :y 7}} | /point/x')).toBe(5);
  });
});

describe('eval — full application of mul', () => {
  it('mul(/price, /qty) full form', () => {
    expect(evalQuery('{:price 100 :qty 3} | mul(/price, /qty)')).toBe(300);
  });
});

describe('eval — as binding', () => {
  it('captures and references via as', () => {
    expect(evalQuery('[1 2 3] | as(:nums) | nums | count')).toBe(3);
  });

  it('multi-stage as bindings', () => {
    expect(evalQuery(`
      [85 92 47 78 68 95 52]
        | as(:allScores)
        | filter(gte(70))
        | as(:passingScores)
        | [allScores | count, passingScores | count]
    `)).toEqual([7, 4]);
  });
});

describe('eval — let binding', () => {
  it('binds and forces a conduit', () => {
    expect(evalQuery('let(:double, mul(2)) | 10 | double')).toBe(20);
  });
});

describe('eval — env operand', () => {
  it('env returns a Map', () => {
    const result = evalQuery('env');
    expect(result).toBeInstanceOf(Map);
  });

  it('env | has(:count) → true', () => {
    expect(evalQuery('env | has(:count)')).toBe(true);
  });
});

describe('eval — use', () => {
  it('use installs constants from a Map', () => {
    expect(evalQuery('{:taxRate 0.07} | use | taxRate')).toBe(0.07);
  });
});
