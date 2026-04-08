import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parse.mjs';

describe('parse — scalar literals', () => {
  it('parses an integer', () => {
    const ast = parse('42');
    expect(ast.type).toBe('NumberLit');
    expect(ast.value).toBe(42);
  });

  it('parses a negative integer', () => {
    const ast = parse('-7');
    expect(ast.type).toBe('NumberLit');
    expect(ast.value).toBe(-7);
  });

  it('parses a decimal number', () => {
    const ast = parse('3.14');
    expect(ast.type).toBe('NumberLit');
    expect(ast.value).toBe(3.14);
  });

  it('parses a string literal', () => {
    const ast = parse('"hello"');
    expect(ast.type).toBe('StringLit');
    expect(ast.value).toBe('hello');
  });

  it('parses an empty string literal', () => {
    const ast = parse('""');
    expect(ast.type).toBe('StringLit');
    expect(ast.value).toBe('');
  });

  it('parses an escaped string', () => {
    const ast = parse('"line1\\nline2"');
    expect(ast.type).toBe('StringLit');
    expect(ast.value).toBe('line1\nline2');
  });

  it('parses true', () => {
    const ast = parse('true');
    expect(ast.type).toBe('BooleanLit');
    expect(ast.value).toBe(true);
  });

  it('parses false', () => {
    const ast = parse('false');
    expect(ast.type).toBe('BooleanLit');
    expect(ast.value).toBe(false);
  });

  it('parses nil', () => {
    const ast = parse('nil');
    expect(ast.type).toBe('NilLit');
  });

  it('parses a keyword', () => {
    const ast = parse(':name');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('name');
  });

  it('parses a keyword with hyphen', () => {
    const ast = parse(':first-name');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('first-name');
  });
});

describe('parse — Vec literal', () => {
  it('parses an empty Vec', () => {
    const ast = parse('[]');
    expect(ast.type).toBe('VecLit');
    expect(ast.elements).toEqual([]);
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
    const ast = parse('{}');
    expect(ast.type).toBe('MapLit');
    expect(ast.entries).toEqual([]);
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
    const ast = parse('#{}');
    expect(ast.type).toBe('SetLit');
    expect(ast.elements).toEqual([]);
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
    const ast = parse('/name');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['name']);
  });

  it('parses a nested projection', () => {
    const ast = parse('/team/lead/email');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['team', 'lead', 'email']);
  });
});

describe('parse — OperandCall', () => {
  it('parses a bare identifier', () => {
    const ast = parse('count');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('count');
    expect(ast.args).toBeNull();
  });

  it('parses an identifier with @ prefix', () => {
    const ast = parse('@callers');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('@callers');
    expect(ast.args).toBeNull();
  });

  it('parses an identifier with _ prefix', () => {
    const ast = parse('_private');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('_private');
    expect(ast.args).toBeNull();
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
    const ast = parse('as roster');
    expect(ast.type).toBe('AsStep');
    expect(ast.name).toBe('roster');
    expect(ast.docs).toEqual([]);
  });

  it('parses a let binding', () => {
    const ast = parse('let double = mul(2)');
    expect(ast.type).toBe('LetStep');
    expect(ast.name).toBe('double');
    expect(ast.body.type).toBe('OperandCall');
    expect(ast.docs).toEqual([]);
  });

  it('parses use as an ordinary identifier (no grammar keyword)', () => {
    const ast = parse('use');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('use');
    expect(ast.args).toBeNull();
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

  it('attaches the opts.uri to ParseError', () => {
    try {
      parse('[1 2', { uri: 'cell-7' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.uri).toBe('cell-7');
    }
  });
});

describe('parse — source-mapping metadata on AST root', () => {
  it('records source, uri, parseId, parsedAt, schemaVersion on the root', () => {
    const ast = parse('42', { uri: 'test.qlang' });
    expect(ast.source).toBe('42');
    expect(ast.uri).toBe('test.qlang');
    expect(typeof ast.parseId).toBe('number');
    expect(typeof ast.parsedAt).toBe('number');
    expect(ast.schemaVersion).toBe(1);
  });

  it('defaults uri to "inline" when opts not given', () => {
    const ast = parse('42');
    expect(ast.uri).toBe('inline');
  });

  it('parseId monotonically increases across calls', () => {
    const a = parse('1');
    const b = parse('2');
    expect(b.parseId).toBeGreaterThan(a.parseId);
  });
});

describe('parse — per-node location and text', () => {
  it('every produced node carries .location with start/end offsets', () => {
    const ast = parse('add(2, 3)');
    expect(ast.location.start.offset).toBe(0);
    expect(ast.location.end.offset).toBe(9);
    expect(ast.args[0].location.start.offset).toBe(4);
    expect(ast.args[0].location.end.offset).toBe(5);
  });

  it('every produced node carries .text with the matched substring', () => {
    const ast = parse('add(2, 3)');
    expect(ast.text).toBe('add(2, 3)');
    expect(ast.args[0].text).toBe('2');
    expect(ast.args[1].text).toBe('3');
  });

  it('text matches source.substring(location.start.offset, location.end.offset)', () => {
    const source = '[1 2] | filter(gt(0))';
    const ast = parse(source);
    expect(source.substring(ast.location.start.offset, ast.location.end.offset))
      .toBe(ast.text);
  });
});
