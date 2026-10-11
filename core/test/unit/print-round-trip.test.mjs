// Every value prints as a literal that reads back as itself [D30]: values
// built from a seeded walk over the literals of the language, scalars with
// their escapes, vectors, sets, maps, values under a tag, quotes and docs,
// each printed, parsed and applied, and held equal to itself by `eq`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';

const NUMBERS = ['0', '-0', '1', '-1.5', '0.1', '1e21', '1e-7', '5e-324', '1.7976931348623157e308', '-2.5e-3'];
const STRINGS = ['""', '"a b"', '"quote \\" inside"', '"back\\\\slash"', '"line\\nbreak"', '"tab\\t"', '"ünïcödé"', '"\\u0001"', '"~(not code)"', '"|~ c ~|"', '"::T"'];
const KEYWORDS = [':a', ':ab-c', ':_x', ':@e', ':"with space"', ':"1"', ':"a:b"', ':ns/name', ':ñ', ':true', ':null'];
const TAGS = ['::T', '::Box', '::a/b', '::number'];
const STEPS = ['count', '/k', 'map ~(mul 2)', 'filter ~(gt 1)', 'add 1 !| 0', ':x 1 | x', '{:a ~(b)}'];

// A walk of a linear congruential generator, the same values on every run.
function literalsOf(count, seed) {
  let state = seed;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const pick = items => items[Math.floor(random() * items.length)];
  const leaf = () => pick([NUMBERS, STRINGS, KEYWORDS, TAGS, ['true', 'false', 'null']].map(pool => () => pick(pool)))();
  const literal = depth => {
    if (depth === 0) return leaf();
    const parts = () => Array.from({ length: Math.floor(random() * 3) }, () => literal(depth - 1));
    return pick([
      leaf,
      () => `[${parts().join(' ')}]`,
      () => `#[${parts().join(' ')}]`,
      () => `{${parts().map(part => `${pick(KEYWORDS)} ${part}`).join(' ')}}`,
      () => `::T[${parts().join(' ')}]`,
      () => `::T(${literal(depth - 1)})`,
      () => `~(${pick(STEPS)})`,
      () => `|~~ prose ~(eq ${pick(NUMBERS)}) \`code\` ~~|`
    ])();
  };
  return Array.from({ length: count }, () => literal(2));
}

describe('the round trip of the print [D30]', () => {
  it('reads every value back from its print as itself', async () => {
    const failing = [];
    for (const source of literalsOf(150, 7)) {
      const held = await evalQuery(`${source} | :v / | print | parse | apply / | eq v`);
      if (held !== true) failing.push(source);
    }
    expect(failing).toEqual([]);
  });
});
