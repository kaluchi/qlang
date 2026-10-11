// Every value prints as a literal that reads back as itself [D30]: values
// built from a seeded walk over the literals of the language, scalars with
// their escapes, vectors and maps in both their spellings, sets with a
// duplicate among them, values under a tag over every payload, a label
// the source declares among the tags, the constructors of `::qlang` and
// `::json`, quotes, docs and errors at rest inside a vector [D210], one with
// a stop on its trail among them, each printed, parsed and applied, and
// held equal to itself by `eq`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';

const NUMBERS = ['0', '-0', '1', '-1.5', '0.1', '1e10', '1e21', '1e-7', '5e-324', '1.7976931348623157e308', '-2.5e-3'];
const STRINGS = ['""', '"a b"', '"quote \\" inside"', '"back\\\\slash"', '"line\\nbreak"', '"tab\\t"', '"ünïcödé"', '"\\u0001"', '"~(not code)"', '"|~ c ~|"', '"::T"'];
const KEYWORDS = [':a', ':ab-c', ':_x', ':@e', ':"with space"', ':"1"', ':"a:b"', ':ns/name', ':qlang/error/guards', ':ñ', ':данные', ':true', ':null', ':""', ':"$ref"'];
const JSON_KEYS = ['"k"', '"first name"', '"$ref"', '""'];
const TAGS = ['::T', '::Box', '::a/b', '::number', '::vec', '::qlang', '::json'];
const STEPS = ['count', '/k', 'map ~(mul 2)', 'filter ~(gt 1)', 'add 1 !| 0', ':x 1 | x', '{:a ~(b)}', '| count', '!| /trail', '"text with spaces"', '42', '[1 2 3] | filter ~(gt 1)', ':n 3 | take n', ':x ::number | mul x 2'];
const DOCS = ['|~~~~|', '|~~ prose ~(eq 1) `code` ~~|', '|~~ one line\n    and another ~~|'];

// A walk of a linear congruential generator, the same values on every run.
function literalsOf(count, seed) {
  let state = seed;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const pick = items => items[Math.floor(random() * items.length)];
  const leaf = () => pick([NUMBERS, STRINGS, KEYWORDS, TAGS, DOCS, ['true', 'false', 'null']].map(pool => () => pick(pool)))();
  const literal = depth => {
    if (depth === 0) return leaf();
    const parts = () => Array.from({ length: Math.floor(random() * 3) }, () => literal(depth - 1));
    const entries = () => parts().map(part => `${pick(KEYWORDS)} ${part}`).join(' ');
    return pick([
      leaf,
      () => `[${parts().join(' ')}]`,
      () => `[${parts().join(', ')}]`,
      () => `#[${parts().join(' ')}]`,
      () => { const part = literal(depth - 1); return `#[${part} ${part}]`; },
      () => `{${entries()}}`,
      () => `{${parts().map(part => `${pick(JSON_KEYS)}: ${part}`).join(', ')}}`,
      () => `::T[${parts().join(' ')}]`,
      () => `::T{${entries()}}`,
      () => `::T#[${parts().join(' ')}]`,
      () => `::T(${literal(depth - 1)})`,
      () => `::T~(${pick(STEPS)})`,
      () => `::T${pick([...STRINGS, ...KEYWORDS, ...TAGS, ...DOCS])}`,
      () => `${pick(['::qlang', '::json'])}{${entries()}}`,
      () => `~(${pick(STEPS)})`,
      () => `[::error{:k ${literal(depth - 1)}}]`,
      () => `[::E::error{:k ${literal(depth - 1)}}]`,
      () => pick(['[::error{}]', '[::number/add/SubjectNotNumberError::error{:actualType ::string}]', '[("x" | add 1 !| /)]',
        '[::error{:k 1 :trail [{:step ~(count) :subject 1 :skipped ~()}]}]'])
    ])();
  };
  const underALabel = () => `:L |~~ L. ~~| | ${literal(2).replaceAll('::T', '::L')}`;
  return Array.from({ length: count }, () => (random() < 0.25 ? underALabel() : literal(2)));
}

describe('the round trip of the print [D30]', () => {
  it('reads every value back from its print as itself', async () => {
    const failing = [];
    for (const source of literalsOf(300, 7)) {
      const held = await evalQuery(`${source} | :v / | print | parse | apply / | eq v`);
      if (held !== true) failing.push(source);
    }
    expect(failing).toEqual([]);
  });
});
