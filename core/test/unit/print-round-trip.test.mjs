// Every value prints as a literal that reads back as itself [QSWRK#code]: values
// built from a seeded walk over the literals of the language, atoms with their
// escapes, vectors and maps in both their spellings, sets with a duplicate
// among them, values under a tag over every payload, a label the source
// declares among the tags, the constructors of `::qlang` and `::json`, quotes,
// a quote of a path alone among them [QSPTH#value], docs, errors at rest
// inside a vector [QSERR#rest], one with a stop on its trail among them, and
// functions and kinds built by their chains, pages over several lines, inputs,
// fields, invariants, refusals, facts and laws among them [QSBLD#fn],
// [QSBLD#kind], each printed, parsed and applied, and held equal to itself by
// `eq`. A part computed goes into a container by the template of `get`, each
// part of it a quote that answers it, and under a tag by `tag`, since a
// literal computes nothing [QSLIT#tag].

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
const FN_RECIPES = ['impl ~(it)', 'impl ~(get /w | add 1)'];
const KIND_RECIPES = ['impl ::builtin{}'];

// A part is the text that builds it and whether that text computes.
const written = text => ({ text, computed: false });
const computed = text => ({ text, computed: true });

// The quote that answers a part in a template of `get`, a path under its
// kind, since `get` reads a path its template holds.
const answering = part => `~(${!part.computed && part.text.startsWith('/') ? `::path#${part.text}` : part.text})`;

// A container of parts: its literal, or the template of `get` where a
// part computes.
function container(open, parts, separator, close) {
  if (!parts.some(part => part.computed)) return written(`${open}${parts.map(part => part.text).join(separator)}${close}`);
  return computed(`get ${open}${parts.map(answering).join(separator)}${close}`);
}

function entriesOf(open, entries, separator) {
  if (!entries.some(([, part]) => part.computed)) return written(`${open}${entries.map(([key, part]) => `${key} ${part.text}`).join(separator)}}`);
  return computed(`get ${open}${entries.map(([key, part]) => `${key} ${answering(part)}`).join(separator)}}`);
}

// A part under a tag: its literal, the payload touching the tag by its own
// sign or by `#`, or the part computed and put under the tag by `tag`.
function underTag(tag, part) {
  if (part.computed) return computed(`${part.text} | tag ${tag}`);
  return written(/^[\w/-]/.test(part.text) ? `${tag}#${part.text}` : `${tag}${part.text}`);
}

const tagged = (tag, part) => (part.computed ? computed(`${part.text} | tag ${tag}`) : written(`${tag}${part.text}`));

// A walk of a linear congruential generator, the same values on every run.
function literalsOf(count, seed) {
  let state = seed;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const pick = items => items[Math.floor(random() * items.length)];
  const leaf = () => written(pick([NUMBERS, STRINGS, KEYWORDS, TAGS, PATHS, DOCS, ['true', 'false', 'null']].map(pool => () => pick(pool)))());
  const literal = depth => {
    if (depth === 0) return leaf();
    const parts = () => Array.from({ length: Math.floor(random() * 3) }, () => literal(depth - 1));
    const entries = () => parts().map(part => [pick(KEYWORDS), part]);
    const errorOf = tags => {
      const fact = literal(depth - 1);
      const error = fact.computed ? computed(`get {:k ${answering(fact)}} | tag ::error${tags.map(tag => ` | tag ${tag}`).join('')}`) : written(`${tags.join('')}::error{:k ${fact.text}}`);
      return container('[', [error], ' ', ']');
    };
    return pick([
      leaf,
      () => container('[', parts(), ' ', ']'),
      () => container('[', parts(), ', ', ']'),
      () => container('#[', parts(), ' ', ']'),
      () => { const part = literal(depth - 1); return container('#[', [part, part], ' ', ']'); },
      () => entriesOf('{', entries(), ' '),
      () => entriesOf('{', parts().map(part => [`${pick(JSON_KEYS)}:`, part]), ', '),
      () => tagged('::T', container('[', parts(), ' ', ']')),
      () => tagged('::T', entriesOf('{', entries(), ' ')),
      () => tagged('::T', container('#[', parts(), ' ', ']')),
      () => underTag('::T', literal(depth - 1)),
      () => written(`::T~(${pick(STEPS)})`),
      () => written(`::T${pick([...STRINGS, ...KEYWORDS, ...TAGS, ...DOCS])}`),
      () => { const tag = pick(['::qlang', '::json']); return tagged(tag, entriesOf('{', entries(), ' ')); },
      () => written(`~(${pick(STEPS)})`),
      () => written(`::quote[${pick(PATHS)}]`),
      () => errorOf([]),
      () => errorOf(['::E']),
      built,
      () => pick([written('[::error{}]'), written('[::number/add/SubjectNotNumberError::error{:actualType ::string}]'),
        computed('get [~("x" | add 1 !| it)]'), written('[::error{:k 1 :trail [{:step ~(count) :subject 1 :skipped ~()}]}]')])
    ])();
  };
  const chain = (noun, groups, recipes) => {
    const commands = groups.filter(() => random() < 0.5).flat();
    if (commands.length === 0 || random() < 0.5) commands.push(pick(recipes));
    return computed(`(${noun}\n  | ${commands.join('\n  | ')})`);
  };
  const built = () => (random() < 0.5 ? chain('::fn', FN_COMMANDS, FN_RECIPES) : chain('::kind', KIND_COMMANDS, KIND_RECIPES));
  const underALabel = () => `:L |~~ L. ~~| | ${literal(2).text.replaceAll('::T', '::L')}`;
  return Array.from({ length: count }, () => (random() < 0.25 ? underALabel() : literal(2).text));
}

describe('the round trip of the print [QSWRK#code]', () => {
  it('reads every value back from its print as itself', async () => {
    const failing = [];
    for (const source of literalsOf(300, 7)) {
      const held = await evalQuery(`${source} | :v it | print | parse | apply it | eq v`);
      if (held !== true) failing.push(source);
    }
    expect(failing).toEqual([]);
  });
});
