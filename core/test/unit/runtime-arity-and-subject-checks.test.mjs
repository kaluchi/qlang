// The refusals of a subject or an input of another kind at the sites the
// laws of the catalog leave out: the second input of `sub`, `mul` and
// `div`, `flat`, `min`, `max` and `sort` over an empty vector or a value
// that is none, `union`, `minus` and `inter` with and without their
// object, a modifier beyond the inputs of a word, and an input left
// without its object.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue } from '../../src/types.mjs';

describe('the second input of the arithmetic', () => {
  it('sub refuses a subtrahend that is no number', async () => {
    expect((await evalQuery('5 | sub "x" !| type')).name).toBe('number/sub/subtrahend/NotNumberError');
  });

  it('mul refuses a multiplier that is no number', async () => {
    expect((await evalQuery('5 | mul "x" !| type')).name).toBe('number/mul/multiplier/NotNumberError');
  });

  it('div refuses a divisor that is no number', async () => {
    expect((await evalQuery('5 | div "x" !| type')).name).toBe('number/div/divisor/NotNumberError');
  });
});

describe('flat over elements of several kinds', async () => {
  it('flat keeps an element that is no vector beside the vectors it opens', async () => {
    expect(await evalQuery('[1 [2 3] 4] | flat')).toEqual([1, 2, 3, 4]);
  });
});

describe('union, minus and inter without their object', async () => {
  it('union bare on a number reaches the contract, which refuses it', async () => {
    expect(await evalQuery('42 | union !| type | eq ::call/KindAnswersNoVerbError')).toBe(true);
  });

  it('union bare on a set folds its elements, the set being a vector', async () => {
    expect(await evalQuery('#[#[1] #[2]] | union | eq #[1 2]')).toBe(true);
  });

  it('minus bare on a number reaches the contract, which refuses it', async () => {
    expect(await evalQuery('42 | minus !| type | eq ::call/KindAnswersNoVerbError')).toBe(true);
  });

  it('inter bare on a number reaches the contract, which refuses it', async () => {
    expect(await evalQuery('42 | inter !| type | eq ::call/KindAnswersNoVerbError')).toBe(true);
  });
});

describe('union, minus and inter with their object', async () => {
  it('minus takes the keys off the map in the pipe', async () => {
    const result = await evalQuery('{:a 1 :b 2 :tmp 3} | minus #[:tmp]');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('tmp')).toBe(false);
  });

  it('inter keeps the keys of the map in the pipe the set names', async () => {
    const result = await evalQuery('{:a 1 :b 2 :c 3} | inter #[:a :b]');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(false);
  });

  it('union joins a map to the map in the pipe', async () => {
    const result = await evalQuery('{:a 1} | union {:b 2}');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });
});

describe('min and max over an empty vector', async () => {
  it('min over an empty vector answers null', async () => {
    expect(await evalQuery('[] | min')).toBeNull();
  });

  it('max over an empty vector answers null', async () => {
    expect(await evalQuery('[] | max')).toBeNull();
  });

  it('min over one element answers it', async () => {
    expect(await evalQuery('[42] | min')).toBe(42);
  });

  it('max over one element answers it', async () => {
    expect(await evalQuery('[42] | max')).toBe(42);
  });
});

describe('sort with a key over a value that is no vector', async () => {
  it('sort with a key refuses the subject', async () => {
    expect((await evalQuery('42 | sort /x !| type')).name).toBe('call/KindAnswersNoVerbError');
  });
});

describe('the objects a word takes', async () => {
  it('a word of no inputs refuses an object', async () => {
    expect((await evalQuery('[1 2 3] | count :foo !| type')).name).toBe('vec/count/ArgsBeyondInputsError');
  });

  it('filter without its predicate is refused', async () => {
    expect((await evalQuery('[1 2 3] | filter !| type')).name).toBe('vec/filter/predicate/NotGivenError');
  });
});

describe('count over a map', async () => {
  it('count answers the count of the entries', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | count')).toBe(3);
  });
});

describe('an input left without its object', async () => {
  it('add without its addend is refused', async () => {
    expect((await evalQuery('5 | add !| type')).name).toBe('number/add/addend/NotGivenError');
  });
});

describe('union, minus and inter over an empty vector', async () => {
  it('a fold of no values is refused by the word that folds, over a vector and over a set [QSERR#site]', async () => {
    for (const kind of ['vec', 'set']) {
      for (const verb of ['union', 'minus', 'inter']) {
        const empty = kind === 'vec' ? '[]' : '#[]';
        expect((await evalQuery(`${empty} | ${verb} !| type`)).name).toBe(`${kind}/${verb}/SubjectEmptyError`);
      }
    }
  });
});

describe('the subject of min and max', async () => {
  it('min and max on a value no kind of which answers them are refused with their addresses [QSDSP#residence]', async () => {
    for (const query of ['42 | min', '"hello" | max']) {
      const result = await evalQuery(query);
      expect(isErrorValue(result)).toBe(true);
      expect(result.originalError.name).toBe('KindAnswersNoVerbError');
    }
  });
});
