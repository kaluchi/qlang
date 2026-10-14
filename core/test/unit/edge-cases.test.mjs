// The refusals and the rare branches of the runtime's modules that the
// laws of the catalog and the conformance cases leave out, a `describe`
// for each module: the values, the one order, the arithmetic, vectors,
// maps, the algebra of containers, text, `source` and the words of
// control.
// The decisions it exists for: [D239].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import {
  keyword,
  formOf,
  isKeyword,
  isQMap,
  isQSet,
  isVec,
  makeSet,
  makeTag,
  typeKeyword
} from '../../src/types.mjs';
import { catchOriginalError, expectErrorThrown } from '../helpers/error-assertions.mjs';

describe('types.mjs', () => {
  it('typeKeyword reads a value the language holds no literal for, a symbol of a host, as unknown', () => {
    expect(typeKeyword(Symbol('host'))).toEqual(makeTag('unknown'));
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
    expect(formOf(Symbol('weird'))).toBe('unknown');
  });

  it('value-class predicates', () => {
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(makeSet([]))).toBe(true);
    expect(isQSet([])).toBe(false);
    expect(isVec([])).toBe(true);
  });
});

describe('runtime/predicates.mjs ordering type errors', () => {
  it('gt rejects heterogeneous comparison by the law of its part', async () => {
    await expectErrorThrown('"a" | gt 5', 'string/gt/value/NotStringError');
  });
  it('lt rejects non-comparable subject', async () => {
    await expectErrorThrown('null | lt 5', 'call/KindAnswersNoVerbError');
  });
});

describe('runtime/arith.mjs error paths', () => {
  it('add rejects non-numeric subject', async () => {
    await expectErrorThrown('"x" | add 1', 'number/add/SubjectNotNumberError');
  });
  it('add rejects non-numeric modifier', async () => {
    await expectErrorThrown('1 | add "x"', 'number/add/addend/NotNumberError');
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

describe('runtime/vec.mjs error paths', () => {
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
    await expectErrorThrown('[1 2 3] | take "x"', 'vec/take/count/NotNumberError');
  });
  it('drop rejects non-numeric n', async () => {
    await expectErrorThrown('[1 2 3] | drop "x"', 'vec/drop/count/NotNumberError');
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
  it('has on a map takes a key as get takes one [D284]', async () => {
    await expectErrorThrown('{:k 1} | has [42]', 'map/has/key/NotKeywordOrNumberOrPathOrStringError');
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', async () => {
    await expectErrorThrown('#[:a] | union {:b 1}', 'set/union/other/NotNullOrSetError');
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
    await expectErrorThrown('#[:a] | minus {:a 1}', 'set/minus/other/NotNullOrSetError');
  });
  it('inter of Set by Map errors', async () => {
    await expectErrorThrown('#[:a] | inter {:a 1}', 'set/inter/other/NotNullOrSetError');
  });
});

describe('runtime/predicates.mjs deepEqual', () => {
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

describe('runtime/string.mjs split and join error sites', () => {
  it('split on non-string subject is refused by the address of split', async () => {
    await expectErrorThrown('42 | split ","', 'string/split/SubjectNotStringError');
  });

  it('split with non-string separator is refused by its part', async () => {
    await expectErrorThrown('"abc" | split 42', 'string/split/separator/NotRegexOrStringError');
  });

  it('join on non-Vec subject is refused by the address of join', async () => {
    await expectErrorThrown('42 | join ","', 'vec/join/SubjectNotVecError');
  });

  it('join with an element of neither kind → ElementNotStringOrKeywordError', async () => {
    const caughtErr = await catchOriginalError('["a" 42 "c"] | join ","');
    expect(caughtErr.address).toBe('vec/join/ElementNotStringOrKeywordError');
    expect(caughtErr.facts.index).toBe(1);
  });

  it('join with non-string separator is refused by its part', async () => {
    await expectErrorThrown('["a" "b"] | join 42', 'vec/join/separator/NotKeywordOrStringError');
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

describe('source on a word, a declaration of it and a tag', () => {
  // `::name | source` returns the quote of the declaring BindStep,
  // which `parse` prints as its text. Same axis covers a name (Keyword
  // subject) and a node of the tree (tag subject).

  it('source on the address of a word returns the whole declaration', async () => {
    const source = await evalQuery(':any/double ~(mul 2) | ::any/double | source | parse');
    expect(source).toBe(':any/double ~(mul 2)');
  });

  it('source on a declaration of it answers the declaration', async () => {
    const source = await evalQuery('42 | :snap it | ::snap | source | parse');
    expect(source).toBe(':snap it');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  it('if with cond truthy runs the then branch', async () => {
    expect(await evalQuery('75 | if (gte 60) ~("pass") ~("fail")')).toBe('pass');
  });

  it('if with cond falsy runs the else branch', async () => {
    expect(await evalQuery('5 | if (gte 60) ~("pass") ~("fail")')).toBe('fail');
  });

  it('if refuses a null condition', async () => {
    expect(await evalQuery('{:no "data"} | if null ~("yes") ~("no") !| type')).toEqual(makeTag('any/if/condition/NotBooleanError'));
  });

  it('if treats false literal as falsy', async () => {
    expect(await evalQuery('0 | if false ~("yes") ~("no")')).toBe('no');
  });

  it('if treats 0 as truthy', async () => {
    expect(await evalQuery('5 | if (eq 0) ~("zero") ~("non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', async () => {
    // The else branch contains div(0), which would break the law of the
    // divisor if evaluated. The cond is truthy so the else branch is skipped.
    expect(await evalQuery('10 | if (gt 0) ~("positive") ~(div 0)')).toBe('positive');
  });

  it('if branches re-project from pipeValue, not from cond result', async () => {
    expect(await evalQuery('{:active true :salary 100} | if (get /active) ~(get /salary | mul 11 | div 10) /salary')).toBe(110);
  });

  it('if can be nested for multi-way dispatch', async () => {
    expect(await evalQuery('75 | if (gte 90) ~("A") ~(if (gte 70) ~("B") ~("C"))')).toBe('B');
  });

  it('coalesce returns first non-null alternative', async () => {
    expect(await evalQuery('{:firstName "Alice"} | coalesce /preferredName /firstName ~("Anon")')).toBe('Alice');
  });

  it('coalesce returns null when all alternatives are null', async () => {
    expect(await evalQuery('{} | coalesce /a /b /c')).toBe(null);
  });

  it('coalesce treats 0 as non-null', async () => {
    expect(await evalQuery('{:zero 0} | coalesce /missing /zero ~("default")')).toBe(0);
  });

  it('coalesce treats false as non-null', async () => {
    expect(await evalQuery('{:flag false} | coalesce /missing /flag ~(true)')).toBe(false);
  });

  it('coalesce treats empty string as non-null', async () => {
    expect(await evalQuery('{:s ""} | coalesce /missing /s ~("default")')).toBe('');
  });

  it('coalesce short-circuits after first non-null (does not evaluate later alts)', async () => {
    // div(0) would raise; coalesce never reaches it because /a is non-null
    expect(await evalQuery('{:a 1} | coalesce /a ~(div 0)')).toBe(1);
  });

  it('coalesce keeps false as a value', async () => {
    expect(await evalQuery('{:a false :b 2} | coalesce /a /b')).toBe(false);
  });

  it('if and coalesce compose for guarded defaulting', async () => {
    expect(await evalQuery('{:role :admin :name "Bob"} | if (get /role | eq :admin) ~(coalesce /displayName /name ~("???")) ~("guest")')).toBe('Bob');
  });

  // The refusal of a bare coalesce is pinned by
  // `fail-track.test.mjs`; the control-flow block tests what the word
  // does.
  it('coalesce answers its subject first when its alternatives are values', async () => {
    expect(await evalQuery('null | coalesce 30')).toBe(30);
  });

});

