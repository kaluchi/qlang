// Every value prints as a literal that reads back as itself [D30]: values
// built from a seeded walk over the literals of the language, scalars with
// their escapes, vectors and maps in both their spellings, sets with a
// duplicate among them, values under a tag over every payload, a label
// the source declares among the tags, the constructors of `::qlang` and
// `::json`, quotes, a quote of a path alone among them [D248], docs,
// errors at rest inside a vector [D13], one with a stop on its trail among
// them, and functions and kinds built by their chains, pages over several
// lines, inputs, fields, invariants, refusals, facts and laws among them
// [D251], [D252], each printed, parsed and applied, and held equal to
// itself by `eq`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';

const NUMBERS = ['0', '-0', '1', '-1.5', '0.1', '1e10', '1e21', '1e-7', '5e-324', '1.7976931348623157e308', '-2.5e-3'];
const STRINGS = ['""', '"a b"', '"quote \\" inside"', '"back\\\\slash"', '"line\\nbreak"', '"tab\\t"', '"ünïcödé"', '"\\u0001"', '"~(not code)"', '"|~ c ~|"', '"::T"'];
const KEYWORDS = [':a', ':ab-c', ':_x', ':e', ':"with space"', ':"1"', ':"a:b"', ':ns/name', ':qlang/error/guards', ':ñ', ':данные', ':true', ':null', ':""', ':"$ref"'];
const JSON_KEYS = ['"k"', '"first name"', '"$ref"', '""'];
const TAGS = ['::T', '::Box', '::a/b', '::number', '::vec', '::qlang', '::json'];
const STEPS = ['count', 'get /k', 'map ~(mul 2)', 'filter ~(gt 1)', 'add 1 !| 0', ':x 1 | x', '{:a ~(b)}', '| count', '!| get /trail', '"text with spaces"', '42', '[1 2 3] | filter ~(gt 1)', ':n 3 | take n', ':x ::number | mul x 2'];
const PATHS = ['/k', '/a/0', '/"first name"/-1', '/:ns/k', '/"0"'];
const DOCS = ['|~~~~|', '|~~ prose ~(eq 1) `code` ~~|', '|~~ one line\n    and another ~~|'];

// The commands of a chain, each group written together, in the order the
// names they declare rest on.
const FN_COMMANDS = [
  ['on |~~ A number. ~~| ::number'],
  ['takes :by |~~ How much,\n    a number. ~~| /0 ::number', 'holds :by/TooBigError |~~ Below ten. ~~| ~(lt 10)'],
  ['takes :xs |~~ The values. ~~| ~(drop 1) [#[::number ::string]]'],
  ['takes :d |~~ A default. ~~| ~(query /2 3)'],
  ['returns |~~ The answer. ~~| #[::number ::string]'],
  ['throws :SubjectTooLargeError |~~ A subject\n    past a bound. ~~|', 'carries :SubjectTooLargeError/bound |~~ The bound. ~~| ::number'],
  ['proves :answers |~~ It answers. ~~| ~(5 | eq 5)']
];
const KIND_COMMANDS = [
  ['wraps |~~ The payload,\n    a map. ~~| ::map'],
  ['reads :w |~~ The width. ~~| /w ::number', 'holds :w/NotPositiveError |~~ Above\n    zero. ~~| ~(gt 0)'],
  ['reads :tags |~~ The tags. ~~| ~(query /tags []) [::string]'],
  ['tells :note |~~ A note. ~~|'],
  ['holds :TooWideError |~~ Narrow. ~~| ~(get /w | lt 100)'],
  ['throws :ShapeError |~~ A shape. ~~|', 'carries :ShapeError/why |~~ Why. ~~| ::string'],
  ['proves :holdsItself |~~ It holds. ~~| ~(true)']
];
const RECIPES = ['impl ~(it)', 'impl ~(get /w | add 1)'];

// A walk of a linear congruential generator, the same values on every run.
function literalsOf(count, seed) {
  let state = seed;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const pick = items => items[Math.floor(random() * items.length)];
  const leaf = () => pick([NUMBERS, STRINGS, KEYWORDS, TAGS, PATHS, DOCS, ['true', 'false', 'null']].map(pool => () => pick(pool)))();
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
      () => `::quote[${pick(PATHS)}]`,
      () => `[::error{:k ${literal(depth - 1)}}]`,
      () => `[::E::error{:k ${literal(depth - 1)}}]`,
      built,
      () => pick(['[::error{}]', '[::number/add/SubjectNotNumberError::error{:actualType ::string}]', '[("x" | add 1 !| it)]',
        '[::error{:k 1 :trail [{:step ~(count) :subject 1 :skipped ~()}]}]'])
    ])();
  };
  const chain = (noun, groups) => {
    const commands = groups.filter(() => random() < 0.5).flat();
    if (commands.length === 0 || random() < 0.5) commands.push(pick(RECIPES));
    return `(${noun}\n  | ${commands.join('\n  | ')})`;
  };
  const built = () => (random() < 0.5 ? chain('::fn', FN_COMMANDS) : chain('::kind', KIND_COMMANDS));
  const underALabel = () => `:L |~~ L. ~~| | ${literal(2).replaceAll('::T', '::L')}`;
  return Array.from({ length: count }, () => (random() < 0.25 ? underALabel() : literal(2)));
}

describe('the round trip of the print [D30]', () => {
  it('reads every value back from its print as itself', async () => {
    const failing = [];
    for (const source of literalsOf(300, 7)) {
      const held = await evalQuery(`${source} | :v it | print | parse | apply it | eq v`);
      if (held !== true) failing.push(source);
    }
    expect(failing).toEqual([]);
  });
});
