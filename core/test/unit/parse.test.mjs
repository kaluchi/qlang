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

  it('parses null', () => {
    const ast = parse('null');
    expect(ast.type).toBe('NullLit');
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

describe('parse — let and as as operand calls', () => {
  it('parses as(:name) as an OperandCall', () => {
    const ast = parse('as(:roster)');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('as');
    expect(ast.args).toHaveLength(1);
    expect(ast.args[0].type).toBe('Keyword');
    expect(ast.args[0].name).toBe('roster');
  });

  it('parses let(:name, body) as an OperandCall', () => {
    const ast = parse('let(:double, mul(2))');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('let');
    expect(ast.args).toHaveLength(2);
    expect(ast.args[0].type).toBe('Keyword');
    expect(ast.args[1].type).toBe('OperandCall');
  });

  it('let and as are no longer reserved words', () => {
    // They parse as ordinary identifiers / OperandCall names.
    const letAst = parse('let');
    expect(letAst.type).toBe('OperandCall');
    expect(letAst.name).toBe('let');

    const asAst = parse('as');
    expect(asAst.type).toBe('OperandCall');
    expect(asAst.name).toBe('as');
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

  it('parses as(:name) inside a pipeline', () => {
    const ast = parse('foo | as(:snapshot) | bar');
    expect(ast.steps).toHaveLength(3);
    expect(ast.steps[1].step.type).toBe('OperandCall');
    expect(ast.steps[1].step.name).toBe('as');
  });

  it('parses let(:name, body) inside a pipeline', () => {
    const ast = parse('items | let(:total, count) | total');
    expect(ast.steps).toHaveLength(3);
    expect(ast.steps[1].step.type).toBe('OperandCall');
    expect(ast.steps[1].step.name).toBe('let');
  });
});

describe('parse — ParenGroup', () => {
  it('parses a parenthesized sub-pipeline', () => {
    const ast = parse('([1 2] * add(1))');
    expect(ast.type).toBe('ParenGroup');
    expect(ast.pipeline.type).toBe('Pipeline');
  });

  it('parses paren group as a step inside an outer pipeline', () => {
    const ast = parse('xs * (as(:elem) | {:k /id :v elem})');
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

describe('parse — quoted keyword and projection segments', () => {
  it('parses :"name" as a Keyword whose name equals "name"', () => {
    const ast = parse(':"name"');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('name');
  });

  it('parses :"foo bar" with embedded space', () => {
    const ast = parse(':"foo bar"');
    expect(ast.name).toBe('foo bar');
  });

  it('parses :"" as the empty-string keyword', () => {
    const ast = parse(':""');
    expect(ast.name).toBe('');
  });

  it('parses :"123" with leading digit', () => {
    const ast = parse(':"123"');
    expect(ast.name).toBe('123');
  });

  it('parses :"$ref" with sigil prefix', () => {
    const ast = parse(':"$ref"');
    expect(ast.name).toBe('$ref');
  });

  it('parses :"with\\nnewline" honoring escape sequences', () => {
    const ast = parse(':"with\\nnewline"');
    expect(ast.name).toBe('with\nnewline');
  });

  it('produces the same AST .name for :name and :"name"', () => {
    expect(parse(':name').name).toBe(parse(':"name"').name);
  });

  it('parses /"foo bar" as a single-key Projection', () => {
    const ast = parse('/"foo bar"');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['foo bar']);
  });

  it('parses /"a.b"/"$ref"/"123" as a multi-segment Projection', () => {
    const ast = parse('/"a.b"/"$ref"/"123"');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['a.b', '$ref', '123']);
  });

  it('parses a mixed projection /name/"weird key"/age', () => {
    const ast = parse('/name/"weird key"/age');
    expect(ast.keys).toEqual(['name', 'weird key', 'age']);
  });

  it('parses a Map literal with quoted keys', () => {
    const ast = parse('{:"key one" 1 :"123" 2}');
    expect(ast.type).toBe('MapLit');
    expect(ast.entries.map(e => e.key.name)).toEqual(['key one', '123']);
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

describe('parse — projection with digit-led / hyphen-led bare segments', () => {
  it('parses `/0` as a single-segment projection with key "0"', () => {
    const ast = parse('/0');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['0']);
  });

  it('parses `/-1` as a single-segment projection with key "-1"', () => {
    const ast = parse('/-1');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['-1']);
  });

  it('parses `/items/0/name` as a three-segment mixed path', () => {
    const ast = parse('/items/0/name');
    expect(ast.keys).toEqual(['items', '0', 'name']);
  });

  it('parses `/rows/-1/0` as a three-segment mixed path with negative index', () => {
    const ast = parse('/rows/-1/0');
    expect(ast.keys).toEqual(['rows', '-1', '0']);
  });

  it('bare digit-led segments only appear inside projections, not as keyword literals', () => {
    // `:0` remains a parse error — keyword literals still require
    // IdentStart. JSON numeric keys reach qlang as keyword values via
    // parseJson / object-literal parsing, not via `:0` source syntax.
    expect(() => parse(':0')).toThrow(ParseError);
  });
});

describe('parse — MapLit whitespace tolerance around string-key `:`', () => {
  it('accepts whitespace between string key and colon (strict-JSON compat)', () => {
    const ast = parse('{ "name" : "alice" }');
    expect(ast.type).toBe('MapLit');
    expect(ast.entries).toHaveLength(1);
    expect(ast.entries[0].key.name).toBe('name');
    expect(ast.entries[0].value.value).toBe('alice');
  });

  it('accepts whitespace around colon with digit-led string key', () => {
    const ast = parse('{ "0" : [0, 1] }');
    expect(ast.entries[0].key.name).toBe('0');
    expect(ast.entries[0].value.type).toBe('VecLit');
  });

  it('accepts newline between string key and colon', () => {
    const ast = parse('{"name"\n:\n"alice"}');
    expect(ast.entries[0].key.name).toBe('name');
    expect(ast.entries[0].value.value).toBe('alice');
  });

  it('keyword-form still requires at least one whitespace between key and value', () => {
    // `:name"alice"` with no space would be ambiguous; the keyword form
    // uses `__` (required whitespace). Verify the separation is still
    // enforced so we do not accidentally relax the keyword entry rule.
    expect(() => parse('{:name"alice"}')).toThrow(ParseError);
  });
});

describe('parse — Unicode identifiers (UAX #31 ID_Start / ID_Continue)', () => {
  it('parses a Cyrillic bare keyword', () => {
    const ast = parse(':имя');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('имя');
  });

  it('parses a CJK bare keyword', () => {
    const ast = parse(':元素');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('元素');
  });

  it('parses a Greek bare keyword', () => {
    const ast = parse(':αβγ');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('αβγ');
  });

  it('parses a Cyrillic projection segment', () => {
    const ast = parse('/имя');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['имя']);
  });

  it('parses a multi-segment Cyrillic projection', () => {
    const ast = parse('/пользователь/имя');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['пользователь', 'имя']);
  });

  it('parses a mixed Cyrillic + ASCII projection', () => {
    const ast = parse('/user/имя');
    expect(ast.type).toBe('Projection');
    expect(ast.keys).toEqual(['user', 'имя']);
  });

  it('accepts digits and hyphens in Unicode identifiers (ID_Continue)', () => {
    const ast = parse(':пользователь-42');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('пользователь-42');
  });

  it('parses a Cyrillic operand-call identifier', () => {
    const ast = parse('посчитать(1)');
    expect(ast.type).toBe('OperandCall');
    expect(ast.name).toBe('посчитать');
  });

  it('parses a namespaced keyword with Cyrillic segments', () => {
    const ast = parse(':проект/пользователь');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('проект/пользователь');
  });

  it('rejects a digit as identifier start (leading-digit rule still holds)', () => {
    expect(() => parse(':1name')).toThrow(ParseError);
  });

  it('rejects bracket / punctuation as identifier start (not in ID_Start)', () => {
    expect(() => parse(':<tag')).toThrow(ParseError);
    expect(() => parse(':{key')).toThrow(ParseError);
    expect(() => parse(':!sigil')).toThrow(ParseError);
  });

  it('accepts digits and hyphens mid-identifier (ID_Continue)', () => {
    expect(parse(':имя42').name).toBe('имя42');
    expect(parse(':item-01').name).toBe('item-01');
  });

  it('supplementary-plane characters (emoji) fall through to the quoted form', () => {
    // The bare form rejects the surrogate pair — peggy's `.` matches one
    // UTF-16 code unit, so 🙂 (2 code units) does not satisfy IdentStart.
    expect(() => parse(':🙂')).toThrow(ParseError);
    // The quoted form accepts it verbatim.
    const ast = parse(':"🙂"');
    expect(ast.type).toBe('Keyword');
    expect(ast.name).toBe('🙂');
  });
});
