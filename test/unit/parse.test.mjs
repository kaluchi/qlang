import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parse.mjs';

describe('parse — scalar literals', () => {
  it('parses an integer', () => {
    const ast = parse('42');
    expect(ast).toEqual({ type: 'NumberLit', value: 42 });
  });

  it('parses a negative integer', () => {
    const ast = parse('-7');
    expect(ast).toEqual({ type: 'NumberLit', value: -7 });
  });

  it('parses a decimal number', () => {
    const ast = parse('3.14');
    expect(ast).toEqual({ type: 'NumberLit', value: 3.14 });
  });

  it('parses a string literal', () => {
    const ast = parse('"hello"');
    expect(ast).toEqual({ type: 'StringLit', value: 'hello' });
  });

  it('parses an empty string literal', () => {
    const ast = parse('""');
    expect(ast).toEqual({ type: 'StringLit', value: '' });
  });

  it('parses an escaped string', () => {
    const ast = parse('"line1\\nline2"');
    expect(ast).toEqual({ type: 'StringLit', value: 'line1\nline2' });
  });

  it('parses true', () => {
    expect(parse('true')).toEqual({ type: 'BooleanLit', value: true });
  });

  it('parses false', () => {
    expect(parse('false')).toEqual({ type: 'BooleanLit', value: false });
  });

  it('parses nil', () => {
    expect(parse('nil')).toEqual({ type: 'NilLit' });
  });

  it('parses a keyword', () => {
    expect(parse(':name')).toEqual({ type: 'Keyword', name: 'name' });
  });

  it('parses a keyword with hyphen', () => {
    expect(parse(':first-name')).toEqual({ type: 'Keyword', name: 'first-name' });
  });
});

describe('parse — Vec literal', () => {
  it('parses an empty Vec', () => {
    expect(parse('[]')).toEqual({ type: 'VecLit', elements: [] });
  });

  it('parses a Vec of numbers', () => {
    const ast = parse('[1 2 3]');
    expect(ast.type).toBe('VecLit');
    expect(ast.elements.map(e => e.value)).toEqual([1, 2, 3]);
  });

  it('parses a Vec with comma separators', () => {
    const ast = parse('[1, 2, 3]');
    expect(ast.elements).toHaveLength(3);
  });

  it('parses a Vec of strings', () => {
    const ast = parse('["a" "b"]');
    expect(ast.elements.map(e => e.value)).toEqual(['a', 'b']);
  });

  it('parses a nested Vec', () => {
    const ast = parse('[[1] [2]]');
    expect(ast.elements[0].type).toBe('VecLit');
    expect(ast.elements[1].type).toBe('VecLit');
  });
});

describe('parse — Map literal', () => {
  it('parses an empty Map', () => {
    expect(parse('{}')).toEqual({ type: 'MapLit', entries: [] });
  });

  it('parses a single-entry Map', () => {
    const ast = parse('{:name "Alice"}');
    expect(ast.type).toBe('MapLit');
    expect(ast.entries).toHaveLength(1);
    expect(ast.entries[0].key.name).toBe('name');
  });

  it('parses a multi-entry Map', () => {
    const ast = parse('{:name "Alice" :age 30}');
    expect(ast.entries).toHaveLength(2);
    expect(ast.entries.map(e => e.key.name)).toEqual(['name', 'age']);
  });

  it('parses a Map with comma separators', () => {
    const ast = parse('{:a 1, :b 2}');
    expect(ast.entries).toHaveLength(2);
  });

  it('parses a Map whose value is itself a Map', () => {
    const ast = parse('{:point {:x 1 :y 2}}');
    expect(ast.entries[0].value.type).toBe('MapLit');
  });
});

describe('parse — Set literal', () => {
  it('parses an empty Set', () => {
    expect(parse('#{}')).toEqual({ type: 'SetLit', elements: [] });
  });

  it('parses a single-element Set', () => {
    const ast = parse('#{:tag}');
    expect(ast.elements[0].type).toBe('Keyword');
  });

  it('parses a multi-element Set with commas', () => {
    const ast = parse('#{:a, :b, :c}');
    expect(ast.elements).toHaveLength(3);
  });
});

describe('parse — Projection', () => {
  it('parses a single key projection', () => {
    expect(parse('/name')).toEqual({ type: 'Projection', keys: ['name'] });
  });

  it('parses a nested projection', () => {
    expect(parse('/team/lead/email'))
      .toEqual({ type: 'Projection', keys: ['team', 'lead', 'email'] });
  });
});

describe('parse — OperandCall', () => {
  it('parses a bare identifier', () => {
    expect(parse('count')).toEqual({ type: 'OperandCall', name: 'count', args: null });
  });

  it('parses an identifier with @ prefix', () => {
    expect(parse('@callers')).toEqual({ type: 'OperandCall', name: '@callers', args: null });
  });

  it('parses an identifier with _ prefix', () => {
    expect(parse('_private')).toEqual({ type: 'OperandCall', name: '_private', args: null });
  });

  it('parses a single-arg call', () => {
    const ast = parse('add(2)');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('add');
    expect(ast.args).toHaveLength(1);
    expect(ast.args[0].value).toBe(2);
  });

  it('parses a multi-arg call', () => {
    const ast = parse('mul(/price, /qty)');
    expect(ast.args).toHaveLength(2);
    expect(ast.args[0].type).toBe('Projection');
    expect(ast.args[1].type).toBe('Projection');
  });

  it('parses a zero-arg call form', () => {
    const ast = parse('count()');
    expect(ast.args).toEqual([]);
  });
});

describe('parse — AsStep, LetStep', () => {
  it('parses an as binding', () => {
    expect(parse('as roster')).toEqual({ type: 'AsStep', name: 'roster', docs: [] });
  });

  it('parses a let binding', () => {
    const ast = parse('let double = mul(2)');
    expect(ast.type).toBe('LetStep');
    expect(ast.name).toBe('double');
    expect(ast.body.type).toBe('OperandCall');
    expect(ast.docs).toEqual([]);
  });

  it('parses use as an ordinary identifier (no grammar keyword)', () => {
    expect(parse('use')).toEqual({ type: 'OperandCall', name: 'use', args: null });
  });
});

describe('parse — Pipeline composition', () => {
  it('parses a two-step pipeline', () => {
    const ast = parse('[1 2 3] | count');
    expect(ast.type).toBe('Pipeline');
    expect(ast.steps).toHaveLength(2);
    expect(ast.steps[0].type).toBe('VecLit');
    expect(ast.steps[1].combinator).toBe('|');
    expect(ast.steps[1].step.type).toBe('OperandCall');
  });

  it('parses a pipeline with distribute', () => {
    const ast = parse('[1 2 3] * add(1)');
    expect(ast.steps).toHaveLength(2);
    expect(ast.steps[1].combinator).toBe('*');
  });

  it('parses a pipeline with merge', () => {
    const ast = parse('[[1 2] [3 4]] >> count');
    expect(ast.steps[1].combinator).toBe('>>');
  });

  it('parses an as step inside a pipeline', () => {
    const ast = parse('foo | as snapshot | bar');
    expect(ast.steps).toHaveLength(3);
    expect(ast.steps[1].step.type).toBe('AsStep');
  });

  it('parses a let step inside a pipeline', () => {
    const ast = parse('items | let total = count | total');
    expect(ast.steps).toHaveLength(3);
    expect(ast.steps[1].step.type).toBe('LetStep');
  });
});

describe('parse — ParenGroup', () => {
  it('parses a parenthesized sub-pipeline', () => {
    const ast = parse('([1 2] * add(1))');
    expect(ast.type).toBe('ParenGroup');
    expect(ast.pipeline.type).toBe('Pipeline');
  });

  it('parses paren group as a step inside an outer pipeline', () => {
    const ast = parse('xs * (as elem | {:k /id :v elem})');
    expect(ast.steps).toHaveLength(2);
    expect(ast.steps[1].step.type).toBe('ParenGroup');
  });
});

describe('parse — comments and whitespace', () => {
  it('parses inline pipeline line comment as identity step', () => {
    const ast = parse(`|~| this is a comment
      | [1 2 3] | count`);
    expect(ast.type).toBe('Pipeline');
    expect(ast.steps[0].type).toBe('LinePlainComment');
    expect(ast.steps[0].content).toBe(' this is a comment');
  });

  it('handles multi-line pipelines', () => {
    const ast = parse(`
      [1 2 3 4 5]
        | filter(gt(2))
        | count
    `);
    expect(ast.type).toBe('Pipeline');
    expect(ast.steps).toHaveLength(3);
  });
});

describe('parse — error handling', () => {
  it('rejects non-string input', () => {
    expect(() => parse(42)).toThrow(ParseError);
  });

  it('throws ParseError on syntax errors', () => {
    expect(() => parse('[1 2')).toThrow(ParseError);
  });

  it('attaches a location to ParseError', () => {
    try {
      parse('{:k}');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.location).toBeTruthy();
    }
  });
});
