import { it, expect } from 'vitest';
import { parseSource } from '../../../src/parse.mjs';
import { isVerbBody } from '../../../src/chain.mjs';

it('reads whether the body of a declaration is the value of a verb as it is written: a quote, a `::builtin{}`, and a function built from `::fn` whatever recipe it holds', () => {
  const bodyOf = source => parseSource(source)[0].get('body');
  const bodies = [
    ':v/f add 1;', ':v/f (::fn | takes :x |~~ x ~~| /0 | impl ~(add x));', ':v/f ::fn[~() ~(add 1)];', ':v/f ::builtin{};',
    ':v/f (::fn | takes :x |~~ x ~~| /0);', ':v/f (::fn | (impl ~(add 1)));', ':v/f ::fn[~() null];', ':v/f (::kind | impl ~(1));', ':v/f 1;'
  ];
  expect(bodies.map(source => isVerbBody(bodyOf(source)))).toEqual([true, true, true, true, true, true, true, false, false]);
});
