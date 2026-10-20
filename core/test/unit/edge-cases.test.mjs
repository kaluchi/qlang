// The refusals and the rare branches of the runtime's modules that the
// laws of the catalog and the conformance cases leave out, a `describe`
// for each module: the values, the one order, the arithmetic, vectors,
// maps, the algebra of containers, text, `source` and the verbs of
// control.
// The rules it holds: [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import {
  keyword,
  formOf,
  isKeyword,
  isMap,
  isSet,
  isVec,
  makeTag,
  typeOf
} from '../../src/types.mjs';
import { makeSet } from '../../src/ordering.mjs';
import { expectErrorThrown } from '../helpers/error-assertions.mjs';

describe('types.mjs', () => {
  it('typeOf refuses a value the language holds no kind for, a symbol of a host, past the fail track [QSHST#source]', () => {
    expect(() => typeOf(Symbol('host'))).toThrow('the core met symbol Symbol(host), a value of no kind of the language');
  });

  it('interns keywords', () => {
    expect(keyword('foo')).toEqual(keyword('foo'));
    expect(keyword('foo')).not.toEqual(keyword('bar'));
  });

  it('formOf names the form of every value', () => {
    expect(formOf(null)).toBe('null');
    expect(formOf(undefined)).toBe('null');
    expect(formOf(true)).toBe('boolean');
    expect(formOf(42)).toBe('number');
    expect(formOf('s')).toBe('string');
    expect(formOf(keyword('k'))).toBe('keyword');
    expect(formOf([])).toBe('vec');
    expect(formOf(new Map())).toBe('map');
    expect(formOf(makeSet([]))).toBe('set');
    expect(formOf(makeTag('T'))).toBe('tag');
  });

  it('value-class predicates', () => {
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isMap(new Map())).toBe(true);
    expect(isSet(makeSet([]))).toBe(true);
    expect(isSet([])).toBe(false);
    expect(isVec([])).toBe(true);
  });
});

describe('runtime/predicates.mjs ordering type errors', () => {
  it('each comparison refuses a pair of two kinds', async () => {
    await expectErrorThrown('"a" | gt 5', 'call/KindsMismatchedError');
    await expectErrorThrown('null | lt 5', 'call/KindsMismatchedError');
    await expectErrorThrown('[1] | gte {}', 'call/KindsMismatchedError');
    await expectErrorThrown('true | lte 1', 'call/KindsMismatchedError');
  });
});

describe('runtime/arith.mjs error paths', () => {
  it('add rejects non-numeric subject', async () => {
    await expectErrorThrown('"x" | add 1', 'number/add/SubjectNotNumberError');
  });
  it('add rejects non-numeric modifier', async () => {
    await expectErrorThrown('1 | add "x"', 'number/add/addend/KindNotTakenError');
  });
  it('sub rejects non-numeric subject', async () => {
    await expectErrorThrown('"x" | sub 1', 'number/sub/SubjectNotNumberError');
  });
  it('mul rejects non-numeric subject', async () => {
    await expectErrorThrown('"x" | mul 1', 'number/mul/SubjectNotNumberError');
  });
  it('div rejects non-numeric subject', async () => {
    await expectErrorThrown('"x" | div 1', 'number/div/SubjectNotNumberError');
  });
});

describe('runtime/sequence.mjs error paths', () => {
  it('count rejects non-Vec', async () => {
    await expectErrorThrown('42 | count', 'call/KindAnswersNoVerbError');
  });
  it('first rejects non-Vec', async () => {
    await expectErrorThrown('42 | first', 'call/KindAnswersNoVerbError');
  });
  it('sum rejects non-Vec', async () => {
    await expectErrorThrown('42 | sum', 'call/KindAnswersNoVerbError');
  });
  it('filter rejects non-Vec', async () => {
    await expectErrorThrown('42 | filter ~(gt 1)', 'call/KindAnswersNoVerbError');
  });
  it('take rejects non-numeric n', async () => {
    await expectErrorThrown('[1 2 3] | take "x"', 'vec/take/count/KindNotTakenError');
  });
  it('drop rejects non-numeric n', async () => {
    await expectErrorThrown('[1 2 3] | drop "x"', 'vec/drop/count/KindNotTakenError');
  });
  it('sort with key', async () => {
    expect(await evalQuery('[{:n 3} {:n 1} {:n 2}] | sort /n'))
      .toEqual([new Map([['n', 1]]), new Map([['n', 2]]), new Map([['n', 3]])]);
  });
});

describe('runtime/map.mjs error paths', () => {
  it('keys rejects non-Map', async () => {
    await expectErrorThrown('42 | keys', 'map/keys/SubjectNotMapError');
  });
  it('vals rejects non-Map', async () => {
    await expectErrorThrown('42 | vals', 'map/vals/SubjectNotMapError');
  });
  it('has rejects non-Map/non-Set subject', async () => {
    await expectErrorThrown('42 | has :foo', 'call/KindAnswersNoVerbError');
  });
  it('has on a map takes a key as get takes one [QSPTH#has]', async () => {
    await expectErrorThrown('{:k 1} | has [42]', 'map/has/key/KindNotTakenError');
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', async () => {
    await expectErrorThrown('#[:a] | union {:b 1}', 'set/union/other/KindNotTakenError');
  });
  it('minus of Map by another Map (key-based)', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | minus {:b 99 :d 5}');
    expect(evalResult).toEqual(new Map([['a', 1], ['c', 3]]));
  });
  it('inter of Map by another Map', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | inter {:b 99 :d 5}');
    expect(evalResult).toEqual(new Map([['b', 2]]));
  });
  it('minus of Set by Map errors', async () => {
    await expectErrorThrown('#[:a] | minus {:a 1}', 'set/minus/other/KindNotTakenError');
  });
  it('inter of Set by Map errors', async () => {
    await expectErrorThrown('#[:a] | inter {:a 1}', 'set/inter/other/KindNotTakenError');
  });
});

describe('eq by the tie of the one order', () => {
  it('eq of Maps with same content', async () => {
    expect(await evalQuery('{:a 1 :b 2} | eq {:a 1 :b 2}')).toBe(true);
  });
  it('eq of Maps with different content', async () => {
    expect(await evalQuery('{:a 1} | eq {:a 2}')).toBe(false);
  });
  it('eq of Sets', async () => {
    expect(await evalQuery('#[:a :b] | eq #[:b :a]')).toBe(true);
  });
  it('eq of mismatched types', async () => {
    expect(await evalQuery('42 | eq "42"')).toBe(false);
  });
  it('eq with null', async () => {
    expect(await evalQuery('null | eq null')).toBe(true);
  });
  it('eq nested', async () => {
    expect(await evalQuery('[{:a 1}] | eq [{:a 1}]')).toBe(true);
  });
});

describe('runtime/string.mjs and runtime/sequence.mjs split and join error sites', () => {
  it('split on non-string subject is refused by the address of split', async () => {
    await expectErrorThrown('42 | split ","', 'string/split/SubjectNotStringError');
  });

  it('split with non-string separator is refused under its input', async () => {
    await expectErrorThrown('"abc" | split 42', 'string/split/separator/KindNotTakenError');
  });

  it('join on non-Vec subject is refused by the address of join', async () => {
    await expectErrorThrown('42 | join ","', 'vec/join/SubjectNotVecError');
  });

  it('join with non-string separator is refused under its input', async () => {
    await expectErrorThrown('["a" "b"] | join 42', 'vec/join/separator/KindNotTakenError');
  });

  it('every split/join site has an address of its own', async () => {
    const queries = [
      '42 | split ","',
      '"abc" | split 42',
      '42 | join ","',
      '["a" 42] | join ","',
      '["a" "b"] | join 42'
    ];
    const names = new Set();
    for (const q of queries) names.add((await evalQuery(q)).tag.name);
    expect(names.size).toBe(queries.length);
  });
});

describe('runtime/string.mjs lines', () => {
  it('a newline ends a line, and a carriage return before it belongs to the ending', async () => {
    expect(await evalQuery('"a\\r\\n\\r\\nb" | lines')).toEqual(['a', '', 'b']);
  });

  it('a final newline closes the last line, and a lone one closes an empty line', async () => {
    expect(await evalQuery('"a\\n" | lines')).toEqual(['a']);
    expect(await evalQuery('"a\\n\\n" | lines')).toEqual(['a', '']);
    expect(await evalQuery('"\\n" | lines')).toEqual(['']);
  });

  it('the empty text has no lines, and a carriage return with no newline stays in its line', async () => {
    expect(await evalQuery('"" | lines')).toEqual([]);
    expect(await evalQuery('"a\\r" | lines')).toEqual(['a\r']);
  });

  it('lines on non-string subject is refused by the address of lines', async () => {
    await expectErrorThrown('42 | lines', 'string/lines/SubjectNotStringError');
  });
});

describe('source on a verb, a declaration of it and a tag', () => {
  // `source` reads a name by its tag, the quote of the declaration written
  // under its address, which `toString` writes as its text, and a keyword by
  // its kind [QSSLF#axis].

  it('source on the address of a verb returns the whole declaration', async () => {
    const source = await evalQuery(':any/double ~(mul 2) | ::any/double | source | toString');
    expect(source).toBe(':any/double ~(mul 2)');
  });

  it('source on a declaration of it answers the declaration', async () => {
    const source = await evalQuery('42 | :snap it | ::snap | source | toString');
    expect(source).toBe(':snap it');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  it('if runs the then branch when its condition holds', async () => {
    expect(await evalQuery('75 | if (gte 60) ~("pass") ~("fail")')).toBe('pass');
  });

  it('if runs the else branch when its condition fails', async () => {
    expect(await evalQuery('5 | if (gte 60) ~("pass") ~("fail")')).toBe('fail');
  });

  it('if refuses a null condition', async () => {
    expect(await evalQuery('{:no "data"} | if null ~("yes") ~("no") !| type')).toEqual(makeTag('any/if/condition/KindNotTakenError'));
  });

  it('if runs the else branch when its condition is the literal `false`', async () => {
    expect(await evalQuery('0 | if false ~("yes") ~("no")')).toBe('no');
  });

  it('if computes its condition against the subject, `eq 0` failing on five', async () => {
    expect(await evalQuery('5 | if (eq 0) ~("zero") ~("non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', async () => {
    // The condition holds, so the else branch, `div 0`, a division by zero
    // the divisor refuses, never runs.
    expect(await evalQuery('10 | if (gt 0) ~("positive") ~(div 0)')).toBe('positive');
  });

  it('if runs the chosen branch against the subject', async () => {
    expect(await evalQuery('{:active true :salary 100} | if (get /active) ~(get /salary | mul 11 | div 10) /salary')).toBe(110);
  });

  it('if can be nested for multi-way dispatch', async () => {
    expect(await evalQuery('75 | if (gte 90) ~("A") ~(if (gte 70) ~("B") ~("C"))')).toBe('B');
  });

  it('coalesce leaves the alternatives after the first value unrun [QSCND#coalesce]', async () => {
    // A verb of the host counts its runs: the walk ends at `/a`, a value,
    // and reaches the verb where `/b` fails.
    let runs = 0;
    const counting = await createSession({
      sources: [{
        uri: 'tests/counted',
        source: ':any/counted ::builtin{}',
        primitives: { 'any/counted': subject => { runs++; return subject; } }
      }]
    });
    expect((await counting.evalCell('{:a 1} | coalesce /a ~(counted)')).result).toBe(1);
    expect(runs).toBe(0);
    await counting.evalCell('{:a 1} | coalesce /b ~(counted)');
    expect(runs).toBe(1);
  });
});

