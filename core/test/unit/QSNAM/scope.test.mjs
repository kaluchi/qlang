import { describe, it, expect } from 'vitest';
import { createNotebook } from '../../../src/notebook.mjs';
import { scopeSet, scopeHas } from '../../../src/state.mjs';
import { parseSource } from '../../../src/parse.mjs';
import { forEachPart, visibleAt, repeatsDeclarationAt } from '../../../src/parsed-parts.mjs';
import { isBindStep } from '../../../src/steps.mjs';
import { rootOf } from '../../helpers/read-text.mjs';

it('a recipe declares none of the inputs its call binds whatever a reader or a later source names so, and shadows every other', async () => {
  const shop = { uri: 'shop', source: ':vec/sized (::fn | takes :n |~~ N. ~~| /0 | impl ~(:n 3 | n))\n:vec/scaled (::fn | takes :n |~~ N. ~~| /0 | impl ~(map ~(mul n)))\n:vec/padded ~(:n 3 | count | add n)' };
  const later = { uri: 'stock', source: ':n 9' };
  const notebook = await createNotebook({ sources: [shop, later] });
  const answers = ':n 7 | get [~([1] | sized 2 !| get [~(type) /name]) ~([1 2] | scaled 2) ~([1 2] | padded)]';
  expect((await notebook.evalCell(`${answers} | eq [[::bind/NameDeclaredTwiceError :n] [2 4] 5]`)).result).toBe(true);
  const reader = ':n 7 | :vec/twice ~(:n 2 | map ~(mul n)) | :vec/sum2 (::fn | takes :n |~~ N. ~~| /0 | impl ~(:n 2 | sum | add n))';
  expect((await notebook.evalCell(`${reader} | get [~([1 2] | twice) ~([1 2] | sum2 5 !| get [~(type) /name])] | eq [[2 4] [::bind/NameDeclaredTwiceError :n]]`)).result).toBe(true);
});

it('a cell opens a scope of its own, where a later cell declares a name again', async () => {
  const sessionInstance = await createNotebook();
  await sessionInstance.evalCell(':k 1');
  const cellEntry = await sessionInstance.evalCell(':k 2 | k');
  expect(cellEntry.result).toBe(2);
});

it('a declaration writes a new scope and leaves the one before it as it was', () => {
  const initial = new Map();
  const extended = scopeSet(initial, 'foo', 42);
  expect(initial.size).toBe(0);
  expect(extended.size).toBe(1);
  expect(extended.get('foo')).toBe(42);
  expect(scopeHas(extended, 'foo')).toBe(true);
  expect(scopeHas(extended, 'bar')).toBe(false);
});

describe('where a declaration is visible', () => {
  const declarationIn = source => {
    let found = null;
    forEachPart(rootOf(source), read => { if (isBindStep(read.value) && found === null) found = read; });
    return found;
  };

  it('sees a declaration inside a quote within the pipeline the quote holds, its end included', () => {
    const source = 'get [~(:x 1 | x) 5]';
    const declaration = declarationIn(source);
    expect(visibleAt(declaration, source.indexOf('| x') + 2)).toBe(true);
    expect(visibleAt(declaration, source.indexOf(')'))).toBe(true);
    expect(visibleAt(declaration, source.indexOf('5'))).toBe(false);
    expect(visibleAt(declaration, source.indexOf('~'))).toBe(false);
  });

  it('sees a declaration of the query everywhere after it', () => {
    const source = ':x 1 | (get [~(x)])';
    expect(visibleAt(declarationIn(source), source.lastIndexOf('x'))).toBe(true);
  });
});

it('holds a declaration that repeats a name an earlier step of its quote declared, on either track', () => {
  const quote = parseSource(':x 1 | :y 2 | :x 3 | x !| :y 4');
  expect([0, 1, 2, 3, 4].map(index => repeatsDeclarationAt(quote, index))).toEqual([false, false, true, false, true]);
});
