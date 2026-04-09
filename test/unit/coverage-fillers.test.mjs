// Targeted tests for coverage gaps in pre-existing modules that
// the rest of the suite does not exercise: arithmetic right-operand
// type checks, format.toPlain fallback for non-Map/Vec/Set values,
// vec.flat non-Vec elements, equality.deepEqual rejection branches,
// describeType for snapshots, dispatch invariant errors for variadic
// operand registration without meta.captured, and intro.sourceOfAst
// branches reachable through synthesized conduits.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { deepEqual } from '../../src/equality.mjs';
import {
  describeType,
  makeSnapshot,
  makeConduit,
  keyword
} from '../../src/types.mjs';
import {
  stateOpVariadic,
  higherOrderOpVariadic
} from '../../src/runtime/dispatch.mjs';
import { QlangInvariantError } from '../../src/errors.mjs';
import { createSession } from '../../src/session.mjs';
import { walkAst } from '../../src/walk.mjs';

describe('arith right-operand type checks', () => {
  it('sub with non-numeric right operand throws', () => {
    expect(() => evalQuery('5 | sub("x")')).toThrow();
  });

  it('mul with non-numeric right operand throws', () => {
    expect(() => evalQuery('5 | mul("x")')).toThrow();
  });

  it('div with non-numeric right operand throws', () => {
    expect(() => evalQuery('5 | div("x")')).toThrow();
  });
});

describe('format toPlain fallback for unknown value classes', () => {
  it('json on a function value falls back to String() rendering', () => {
    // Function values are not numbers/strings/booleans/keywords/Vec/
    // Map/Set, so toPlain reaches the trailing `return String(v)`
    // branch. Output is opaque but the operand must not throw.
    const out = evalQuery('env | /count | json');
    expect(typeof out).toBe('string');
  });
});

describe('vec.flat non-Vec elements', () => {
  it('flat preserves non-Vec elements alongside Vec elements', () => {
    expect(evalQuery('[1 [2 3] 4] | flat')).toEqual([1, 2, 3, 4]);
  });
});

describe('equality.deepEqual rejection branches', () => {
  it('returns false when only one side is null', () => {
    expect(deepEqual(null, 5)).toBe(false);
    expect(deepEqual(5, null)).toBe(false);
  });

  it('returns false when types differ', () => {
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('returns false when one side is array and the other is not', () => {
    expect(deepEqual([1, 2], 'x')).toBe(false);
  });

  it('returns false when arrays have different length', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false when one side is Set and the other is not', () => {
    expect(deepEqual(new Set([1]), [1])).toBe(false);
  });

  it('returns false when Sets have different size', () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
  });
});

describe('describeType for conduit and snapshot', () => {
  it('describeType returns "snapshot" for a snapshot value', () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(describeType(snap)).toBe('snapshot');
  });

  it('describeType returns "conduit" for a conduit value', () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1 }, { name: 'x' });
    expect(describeType(conduit)).toBe('conduit');
  });
});

describe('dispatch variadic registration invariants', () => {
  it('stateOpVariadic without meta throws QlangInvariantError', () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s)).toThrow(QlangInvariantError);
  });

  it('stateOpVariadic without meta.captured throws QlangInvariantError', () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s, {})).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic without meta throws QlangInvariantError', () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic without meta.captured throws QlangInvariantError', () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv, {})).toThrow(QlangInvariantError);
  });
});

describe('intro.sourceOfAst branches reachable via synthesized conduits', () => {
  // Reify on a conduit whose body is a synthesized AST (no .text from
  // parser) forces nodeSource to fall back to sourceOfAst. We sweep
  // every Primary node type to make sure each branch is exercised.
  function reifySynth(synthBody) {
    const s = createSession();
    s.bind('synth', makeConduit(synthBody, { name: 'synth' }));
    return s.evalCell('reify(:synth) | /source').result;
  }

  it('renders a NumberLit', () => {
    expect(reifySynth({ type: 'NumberLit', value: 42 })).toBe('42');
  });

  it('renders a StringLit', () => {
    expect(reifySynth({ type: 'StringLit', value: 'hi' })).toBe('"hi"');
  });

  it('renders a BooleanLit', () => {
    expect(reifySynth({ type: 'BooleanLit', value: true })).toBe('true');
    expect(reifySynth({ type: 'BooleanLit', value: false })).toBe('false');
  });

  it('renders a NilLit', () => {
    expect(reifySynth({ type: 'NilLit' })).toBe('nil');
  });

  it('renders a Keyword', () => {
    expect(reifySynth({ type: 'Keyword', name: 'foo' })).toBe(':foo');
  });

  it('renders a Projection with a single key', () => {
    expect(reifySynth({ type: 'Projection', keys: ['name'] })).toBe('/name');
  });

  it('renders a Projection with nested keys', () => {
    expect(reifySynth({ type: 'Projection', keys: ['a', 'b', 'c'] })).toBe('/a/b/c');
  });

  it('renders a bare-form OperandCall (args null)', () => {
    expect(reifySynth({ type: 'OperandCall', name: 'count', args: null })).toBe('count');
  });

  it('renders an OperandCall with args', () => {
    expect(reifySynth({
      type: 'OperandCall',
      name: 'add',
      args: [
        { type: 'NumberLit', value: 2 },
        { type: 'NumberLit', value: 3 }
      ]
    })).toBe('add(2, 3)');
  });

  it('renders a ParenGroup wrapping a Pipeline', () => {
    const synth = {
      type: 'ParenGroup',
      pipeline: {
        type: 'Pipeline',
        steps: [
          { type: 'NumberLit', value: 1 },
          { combinator: '|', step: { type: 'OperandCall', name: 'count', args: null } }
        ]
      }
    };
    expect(reifySynth(synth)).toContain('1');
    expect(reifySynth(synth)).toContain('count');
  });

  it('renders a VecLit', () => {
    expect(reifySynth({
      type: 'VecLit',
      elements: [
        { type: 'NumberLit', value: 1 },
        { type: 'NumberLit', value: 2 }
      ]
    })).toBe('[1 2]');
  });

  it('renders a SetLit', () => {
    expect(reifySynth({
      type: 'SetLit',
      elements: [
        { type: 'NumberLit', value: 1 }
      ]
    })).toContain('#{');
  });

  it('renders a MapLit through MapEntry node delegation', () => {
    expect(reifySynth({
      type: 'MapLit',
      entries: [
        {
          type: 'MapEntry',
          key: { type: 'Keyword', name: 'a' },
          value: { type: 'NumberLit', value: 1 }
        }
      ]
    })).toContain(':a 1');
  });

  it('renders a MapLit with a quoted-keyword key in valid qlang form', () => {
    expect(reifySynth({
      type: 'MapLit',
      entries: [
        {
          type: 'MapEntry',
          key: { type: 'Keyword', name: 'foo bar' },
          value: { type: 'NumberLit', value: 42 }
        }
      ]
    })).toContain(':"foo bar" 42');
  });

  it('renders a Keyword with embedded space in quoted form', () => {
    expect(reifySynth({ type: 'Keyword', name: 'with space' })).toBe(':"with space"');
  });

  it('renders a Keyword with leading digit in quoted form', () => {
    expect(reifySynth({ type: 'Keyword', name: '123' })).toBe(':"123"');
  });

  it('renders an empty Keyword name in quoted form', () => {
    expect(reifySynth({ type: 'Keyword', name: '' })).toBe(':""');
  });

  it('renders a reserved-word Keyword name in quoted form', () => {
    // true/false/nil are still reserved; let/as are no longer reserved.
    expect(reifySynth({ type: 'Keyword', name: 'true' })).toBe(':"true"');
    expect(reifySynth({ type: 'Keyword', name: 'let' })).toBe(':let');
  });

  it('renders a Projection with quoted segments where needed', () => {
    expect(reifySynth({
      type: 'Projection',
      keys: ['outer', 'inner key', '$ref']
    })).toBe('/outer/"inner key"/"$ref"');
  });

  it('renders a Projection with all bare segments without quoting', () => {
    expect(reifySynth({
      type: 'Projection',
      keys: ['a', 'b', 'c']
    })).toBe('/a/b/c');
  });

  it('falls back to a node-type marker for unknown types', () => {
    expect(reifySynth({ type: 'WeirdNode' })).toBe('<WeirdNode>');
  });

  it('renders nil node as null source', () => {
    expect(reifySynth(null)).toBeNull();
  });
});

describe('sourceOfAst structural-inverse property over Primary subtree', () => {
  // For every parseable qlang source string in the fixture set, the
  // round-trip parse → strip(.text) → reify(:syn)/source → parse must
  // yield a structurally-equivalent AST. This is the contract that
  // makes sourceOfAst the inverse of parse: any future Primary node
  // type added to the grammar must extend sourceOfAst until this
  // property holds for it.
  //
  // We strip the parser-captured .text on every node so nodeSource
  // falls through to sourceOfAst (the fallback path). Without the
  // strip nodeSource would short-circuit on .text and skip the
  // structural renderer entirely.

  const META_FIELDS = new Set([
    'location', 'text', 'id', 'parent',
    'source', 'uri', 'parseId', 'parsedAt', 'schemaVersion'
  ]);

  function structurally(node) {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) return node.map(structurally);
    if (typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (META_FIELDS.has(k)) continue;
      out[k] = structurally(v);
    }
    return out;
  }

  function roundTripThroughSourceOfAst(source) {
    const original = parse(source);
    walkAst(original, (n) => { delete n.text; });
    const session = createSession();
    session.bind('syn', makeConduit(original, { name: 'syn' }));
    const rendered = session.evalCell('reify(:syn) | /source').result;
    return { rendered, reparsed: parse(rendered) };
  }

  const FIXTURES = [
    '42',
    '-7',
    '3.14',
    '"hello"',
    '""',
    'true',
    'false',
    'nil',
    ':foo',
    ':"foo bar"',
    ':"123"',
    ':"$ref"',
    ':""',
    '/name',
    '/a/b/c',
    '/"foo bar"',
    '/"a.b"/"$ref"/"123"',
    '/outer/"inner key"/age',
    '[1 2 3]',
    '[]',
    '#{1 2 3}',
    '#{}',
    '{:a 1}',
    '{}',
    '{:"foo bar" 1 :"$ref" 2}',
    '{:outer {:"inner key" 7}}',
    'count',
    '@callers',
    '_private',
    'add(2, 3)',
    'mul(/price, /qty)',
    'count()',
    '(mul(2) | add(1))'
  ];

  for (const source of FIXTURES) {
    it(`round-trips ${source}`, () => {
      const { reparsed } = roundTripThroughSourceOfAst(source);
      const original = parse(source);
      expect(structurally(reparsed)).toEqual(structurally(original));
    });
  }
});

describe('setops bare-form non-Vec subject errors', () => {
  it('union bare on non-Vec/non-Set throws UnionBareSubjectNotVec', () => {
    expect(() => evalQuery('42 | union')).toThrow();
  });

  it('union bare on a Set (which is also non-Array) throws', () => {
    expect(() => evalQuery('#{:a} | union')).toThrow();
  });

  it('minus bare on non-Vec throws MinusBareSubjectNotVec', () => {
    expect(() => evalQuery('42 | minus')).toThrow();
  });

  it('inter bare on non-Vec throws InterBareSubjectNotVec', () => {
    expect(() => evalQuery('42 | inter')).toThrow();
  });
});

describe('setops full form (two captured args)', () => {
  it('minus full form computes left minus right via two captured pipelines', () => {
    const result = evalQuery('nil | minus({:a 1 :b 2 :tmp 3}, #{:tmp})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
    expect(result.has(keyword('tmp'))).toBe(false);
  });

  it('inter full form computes left inter right via two captured pipelines', () => {
    const result = evalQuery('nil | inter({:a 1 :b 2 :c 3}, #{:a :b})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
    expect(result.has(keyword('c'))).toBe(false);
  });

  it('union full form computes left union right via two captured pipelines', () => {
    const result = evalQuery('nil | union({:a 1}, {:b 2})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
  });
});

describe('vec.min and vec.max on empty Vec', () => {
  it('min on empty Vec returns nil', () => {
    expect(evalQuery('[] | min')).toBeNull();
  });

  it('max on empty Vec returns nil', () => {
    expect(evalQuery('[] | max')).toBeNull();
  });

  it('min on singleton Vec returns the only element', () => {
    expect(evalQuery('[42] | min')).toBe(42);
  });

  it('max on singleton Vec returns the only element', () => {
    expect(evalQuery('[42] | max')).toBe(42);
  });
});

describe('vec.sort with key on non-Vec subject', () => {
  it('sort with key throws SortByKeySubjectNotVec', () => {
    expect(() => evalQuery('42 | sort(/x)')).toThrow();
  });
});

describe('higherOrderOp / nullaryOp arity errors', () => {
  it('nullaryOp called with captured args throws', () => {
    expect(() => evalQuery('[1 2 3] | count(:foo)')).toThrow();
  });

  it('higherOrderOp filter called with zero captured args throws', () => {
    expect(() => evalQuery('[1 2 3] | filter')).toThrow();
  });
});

describe('format.toPlain non-keyword Map keys', () => {
  it('json on a Map with string (non-keyword) keys uses String(k) fallback', () => {
    // Inject a Map whose keys are plain strings, not interned keywords.
    // Construct via session.bind so we bypass the parser's
    // keyword-only Map literal syntax.
    const s = createSession();
    const map = new Map();
    map.set('rawKey', 'rawValue');
    s.bind('rawMap', map);
    const out = s.evalCell('rawMap | json').result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawKey');
    expect(out).toContain('rawValue');
  });

  it('table on a Vec of Maps with non-keyword keys still renders', () => {
    const s = createSession();
    const row = new Map();
    row.set('rawCol', 'rawCell');
    s.bind('rows', [row]);
    const out = s.evalCell('rows | table').result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawCol');
    expect(out).toContain('rawCell');
  });
});

describe('intro.describeValueType for unknown types via bind', () => {
  it('reify on a Symbol-bound value returns :unknown for the :type field', () => {
    const s = createSession();
    s.bind('weird', Symbol('weird'));
    const result = s.evalCell('reify(:weird) | /type').result;
    expect(result).toEqual(keyword('unknown'));
  });
});

describe('deepEqual Set vs non-Set non-Array', () => {
  it('returns false when first is Set and second is plain object', () => {
    expect(deepEqual(new Set([1]), {})).toBe(false);
  });

  it('returns false when same-size Sets contain different elements', () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });
});

describe('count and friends on a Map subject', () => {
  it('count on a Map returns its size', () => {
    expect(evalQuery('{:a 1 :b 2 :c 3} | count')).toBe(3);
  });
});

describe('valueOp arity overflow', () => {
  it('add with zero captured args throws ArityError', () => {
    expect(() => evalQuery('5 | add')).toThrow();
  });
});

describe('setops bare-form empty Vec', () => {
  it('minus bare on empty Vec throws MinusBareEmpty', () => {
    expect(() => evalQuery('[] | minus')).toThrow();
  });

  it('inter bare on empty Vec throws InterBareEmpty', () => {
    expect(() => evalQuery('[] | inter')).toThrow();
  });

  it('union bare on empty Vec throws UnionBareEmpty', () => {
    expect(() => evalQuery('[] | union')).toThrow();
  });
});

describe('conduit effect-laundering at call site', () => {
  it('conduit with @-name called via clean alias triggers EffectLaunderingAtCall', () => {
    const s = createSession();
    // Declare an @-prefixed conduit, then shadow it under a clean name
    // via use, triggering the runtime safety net in applyConduit.
    s.evalCell('let(:@effFn, count)');
    s.evalCell('{:clean (env | /@effFn)} | use');
    const cell = s.evalCell('[1 2 3] | clean');
    expect(cell.error).not.toBeNull();
    expect(cell.error.name).toBe('EffectLaunderingAtCall');
  });
});

describe('conduit-parameter arity error', () => {
  it('calling a conduit parameter with captured args throws ConduitParameterNoCapturedArgs', () => {
    // Inside the body, `n` is a conduit-parameter proxy (nullary
    // function value). Calling it with captured args (n(42)) should
    // raise ConduitParameterNoCapturedArgs with structured context.
    let thrown;
    try { evalQuery('let(:f, [:n], n(42)) | 0 | f(5)'); } catch (e) { thrown = e; }
    expect(thrown).toBeDefined();
    expect(thrown.name).toBe('ConduitParameterNoCapturedArgs');
    expect(thrown.context.paramName).toBe('n');
    expect(thrown.context.actualCount).toBe(1);
  });
});

describe('runExamples on non-string example entry', () => {
  it('returns ok=false for non-string entries in examples Vec', () => {
    const s = createSession();
    // Build a descriptor with a non-string example entry to exercise
    // the `typeof example !== string` branch in runExamples.
    s.evalCell('{:kind :builtin :examples [42]} | use');
    const result = s.evalCell('{:kind :builtin :examples [42]} | runExamples | first | /ok').result;
    expect(result).toBe(false);
  });
});

describe('reify on a snapshot bound directly via session.bind', () => {
  it('reify(:name) returns a snapshot descriptor with :type and :value', () => {
    const s = createSession();
    s.bind('snap', makeSnapshot(42, { name: 'snap' }));
    const result = s.evalCell('reify(:snap)').result;
    expect(result.get(keyword('kind'))).toEqual(keyword('snapshot'));
    expect(result.get(keyword('value'))).toBe(42);
    expect(result.get(keyword('type'))).toEqual(keyword('number'));
  });
});
