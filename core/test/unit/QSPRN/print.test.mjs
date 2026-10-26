import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { makeBinding, makeKeyword, makeTag, makeTagged, makeErrorValue } from '../../../src/types.mjs';
import { compareValues } from '../../../src/ordering.mjs';

it('prints every part of a kind of the root by the print a host source declares under its label, bare or under a tag', async () => {
  const notebook = await core.createNotebook({ sources: [{ uri: 'probe', source: ':number/print ~("h")' }] });
  expect((await notebook.evalCell('[::Box#5 7 "s"] | print')).result).toBe('[h h "s"]');
});

const NUMBERS = ['0', '-0', '1', '-1.5', '0.1', '1e10', '1e21', '1e-7', '5e-324', '1.7976931348623157e308', '-2.5e-3'];
const STRINGS = ['""', '"a b"', '"quote \\" inside"', '"back\\\\slash"', '"line\\nbreak"', '"tab\\t"', '"ünïcödé"', '"\\u0001"', '"~(not code)"', '"|~ c ~|"', '"::T"'];
const KEYWORDS = [':a', ':ab-c', ':_x', ':e', ':"with space"', ':"1"', ':"a:b"', ':ns/name', ':qlang/error/guards', ':ñ', ':данные', ':true', ':null', ':""', ':"$ref"'];
const JSON_KEYS = ['"k"', '"first name"', '"$ref"', '""'];
const TAGS = ['::T', '::Box', '::a/b', '::number', '::vec', '::qlang', '::json'];
const STEPS = ['count', 'get /k', 'map ~(mul 2)', 'filter ~(gt 1)', 'add 1 !| 0', ':x 1 | x', '{:a ~(b)}', '| count', '!| get /trace', '"text with spaces"', '42', '[1 2 3] | filter ~(gt 1)', ':n 3 | take n', ':x ::number | mul x 2'];
const PATHS = ['/k', '/a/0', '/"first name"/-1', '/:ns/k', '/"0"'];
const DOCS = ['|~~~~|', '|~~ prose ~(eq 1) `code` ~~|', '|~~ one line\n    and another ~~|'];

const FN_COMMANDS = [
  ['on |~~ A number. ~~| ::number'],
  ['takes :by |~~ How much,\n    a number. ~~| /0 ::number', 'holds :ByTooBigError |~~ Below ten. ~~| ~(by | lt 10)'],
  ['takes :xs |~~ The values. ~~| ~(drop 1) [#[::number ::string]]'],
  ['takes :d |~~ A default. ~~| ~(query /2 3)'],
  ['returns |~~ The answer. ~~| #[::number ::string]'],
  ['throws :SubjectTooLargeError |~~ A subject\n    past a bound. ~~| ~(wires :bound |~~ The bound. ~~| ::number)'],
  ['proves :answers |~~ It answers. ~~| ~(5 | eq 5)']
];
const KIND_COMMANDS = [
  ['accepts |~~ The payload,\n    a map. ~~| ::map'],
  ['wires :w |~~ The width. ~~| /w ::number', 'holds :WNotPositiveError |~~ Above\n    zero. ~~| ~(w | gt 0)'],
  ['wires :tags |~~ The tags. ~~| ~(query /tags []) [::string]'],
  ['tells :note |~~ A note. ~~|'],
  ['holds :TooWideError |~~ Narrow. ~~| ~(get /w | lt 100)'],
  ['throws :ShapeError |~~ A shape. ~~| ~(wires :why |~~ Why. ~~| ::string)'],
  ['proves :holdsItself |~~ It holds. ~~| ~(true)']
];
const FN_RECIPES = ['impl ~(it)', 'impl ~(get /w | add 1)'];
const KIND_CONSTRUCTORS = ['impl ::builtin{}'];

const written = text => ({ text, computed: false });
const computed = text => ({ text, computed: true });

const answering = part => `~(${!part.computed && part.text.startsWith('/') ? `::path#${part.text}` : part.text})`;

function container(open, parts, separator, close) {
  if (!parts.some(part => part.computed)) return written(`${open}${parts.map(part => part.text).join(separator)}${close}`);
  return computed(`get ${open}${parts.map(answering).join(separator)}${close}`);
}

function entriesOf(open, entries, separator) {
  if (!entries.some(([, part]) => part.computed)) return written(`${open}${entries.map(([key, part]) => `${key} ${part.text}`).join(separator)}}`);
  return computed(`get ${open}${entries.map(([key, part]) => `${key} ${answering(part)}`).join(separator)}}`);
}

function underTag(tag, part) {
  if (part.computed) return computed(`${part.text} | tag ${tag}`);
  return written(/^[\w/-]/.test(part.text) ? `${tag}#${part.text}` : `${tag}${part.text}`);
}

const tagged = (tag, part) => (part.computed ? computed(`${part.text} | tag ${tag}`) : written(`${tag}${part.text}`));

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
      () => { const tag = pick(['::shape', '::json']); return tagged(tag, entriesOf('{', entries(), ' ')); },
      () => written(`~(${pick(STEPS)})`),
      () => written(`::quote[${pick(PATHS)}]`),
      () => errorOf([]),
      () => errorOf(['::E']),
      built,
      () => pick([written('[::error{}]'), written('[::number/add/SubjectNotNumberError::error{:actualTag ::string}]'),
        computed('get [~("x" | add 1 !| it)]'), written('[::error{:k 1 :trace [{:failed ~(count) :subject 1 :skipped ~()}]}]')])
    ])();
  };
  const chain = (noun, groups, endings) => {
    const commands = groups.filter(() => random() < 0.5).flat();
    if (commands.length === 0 || random() < 0.5) commands.push(pick(endings));
    return computed(`(${noun}\n  | ${commands.join('\n  | ')})`);
  };
  const built = () => (random() < 0.5 ? chain('::fn', FN_COMMANDS, FN_RECIPES) : chain('::kind', KIND_COMMANDS, KIND_CONSTRUCTORS));
  const underALabel = () => `:L |~~ L. ~~| | ${literal(2).text.replaceAll('::T', '::L')}`;
  return Array.from({ length: count }, () => (random() < 0.25 ? underALabel() : literal(2).text));
}

it('reads every value back from its print as itself', async () => {
  const failing = [];
  for (const source of literalsOf(300, 7)) {
    const held = await evalQuery(`${source} | :v it | print | parse | open | eq v`);
    if (held !== true) failing.push(source);
  }
  expect(failing).toEqual([]);
});

describe('a binding record and a vector under a tag', () => {
  it('renders a binding record as the tagged Map it is', () => {
    const record = makeBinding({ name: makeKeyword('nums'), value: [1, 2, 3] });
    expect(printValue(record)).toBe(
      '::binding{\n  :name :nums\n  :docs []\n  :value [1 2 3]\n  :source null\n  :origin null\n}');
  });

  it('renders a vector under a tag as ::Tag[payload…]', () => {
    const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
    expect(printValue(tagged)).toBe('::Box[42 "inner"]');
  });

  it('renders a tag over an empty vector as ::Tag[]', () => {
    const tagged = makeTagged(makeTag('Marker'), []);
    expect(printValue(tagged)).toBe('::Marker[]');
  });
});

describe('the print declared under a kind', () => {
  const BADGE_SOURCE = [
    ':badge |~~ A badge. ~~|',
    ':badge/print',
    '  |~~ A badge as its name. ~~|',
    '  ~(get /name)'
  ].join('\n');

  async function badgeSession() {
    return await createNotebook({ sources: [{ uri: 'badge', source: BADGE_SOURCE }] });
  }

  it('takes the print of a part from the kind of that part', async () => {
    const notebook = await badgeSession();
    const printed = await notebook.evalCell('[::badge{:name "ok"} {:k ::badge{:name "no"}} 1] | print');
    expect(printed.result).toBe('[\n  ok\n  {\n    :k no\n  }\n  1\n]');
  });

  it('takes the print of a kind for a part inside an error at rest, under a tag of its own or none', async () => {
    const notebook = await badgeSession();
    expect((await notebook.evalCell('[::error{:k ::badge{:name "in"}}] | print')).result).toBe('[\n  !{\n    :k in\n  }\n]');
    expect((await notebook.evalCell('[::Box::error{:k ::badge{:name "in"}}] | print')).result).toBe('[\n  ::Box!{\n    :k in\n  }\n]');
  });

  it('prints what a kind answers that is no string as the value it is', async () => {
    const notebook = await badgeSession();
    const printed = await notebook.evalCell('get [~(5 | tag ::badge)] | print');
    expect(printed.result).toContain('::path/SubjectHasNoPartsError!{');
  });
});

it('prints the records of the names a query declares as a literal that reads back as them', async () => {
  expect(await evalQuery(':f ~(add 1) | :v 5 | :T |~~ A kind. ~~| | env | :e it | print | parse | open | eq e')).toBe(true);
});

describe('printing steps read from text', () => {
  it('a doc in the slot of a declaration prints in its slot', async () => {
    expect(await evalQuery('~(:x |~~ note ~~| it) | toString')).toBe(':x |~~ note ~~| it');
  });

  it('a key that is no bare name prints quoted, a keyword of names joined by a slash behind a colon', async () => {
    expect(await evalQuery('~(get /"a b") | toString')).toBe('get /"a b"');
    expect(await evalQuery('~(get /:ns/name) | toString')).toBe('get /:ns/name');
  });
});

describe('the printer writes the literal of a value', () => {
  it('prints undefined as null, and a fraction and a negative number as their literals', () => {
    expect(printValue(undefined)).toBe('null');
    expect(printValue(3.14)).toBe('3.14');
    expect(printValue(-1)).toBe('-1');
  });

  it('prints a keyword of names joined by a slash bare', () => {
    expect(printValue(makeKeyword('qlang/error'))).toBe(':qlang/error');
  });

  it('prints the empty vector', () => {
    expect(printValue([])).toBe('[]');
  });

  it('prints a failure of one fact on one line, its tag before the bang', () => {
    expect(printValue(makeErrorValue(makeTag('Test'), new Map([['index', 1]])))).toBe('::Test!{:index 1}');
  });

  it('prints a failure of three facts a fact a line', () => {
    const err = makeErrorValue(makeTag('Test'), new Map([
      ['actualTag', makeTag('number')],
      ['message', 'boom'],
      ['index', 1]
    ]));
    expect(printValue(err)).toBe('::Test!{\n  :actualTag ::number\n  :message "boom"\n  :index 1\n}');
  });
});

describe('the print of a value reads back as the value', () => {
  async function readsBack(source) {
    const original = await evalQuery(source);
    const printed = printValue(original);
    expect(compareValues(original, await evalQuery(printed)) === 0, `${source} → ${printed}`).toBe(true);
  }

  it('a keyword written in quotes, and one of names joined by a slash, reads back from its print', async () => {
    for (const source of [':"1"', ':"foo bar"', ':"$ref"', ':""', ':"123"', ':qlang/error']) await readsBack(source);
  });

  it('a vector of a number, a string, a keyword, a boolean and null reads back from its print', async () => {
    await readsBack('[1 "two" :three true null]');
  });

  it('a vector of keywords written in quotes reads back from its print', async () => {
    await readsBack('[:"$ref" :"foo bar" :normal]');
  });

  it('a set of keywords reads back from its print', async () => {
    await readsBack('#[:a :b :c]');
  });

  it('a set of keywords written in quotes reads back from its print', async () => {
    await readsBack('#[:"$ref" :normal]');
  });

  it('a map of keys written in quotes reads back from its print', async () => {
    await readsBack('{:"$ref" 1 :"foo bar" 2}');
  });

  it('a map of keyword values, one of names joined by a slash, reads back from its print', async () => {
    await readsBack('{:kind :typeError :origin :qlang/eval}');
  });

  it('a map within a map within a map reads back from its print', async () => {
    await readsBack('{:a {:b {:c 42}}}');
  });

  it('an error at rest with a :kind fact reads back from its print', async () => {
    await readsBack('!{:kind ::Foo :message "boom"}');
  });

  it('an error at rest whose trace is a quote reads back from its print', async () => {
    await readsBack('!{:message "boom" :trace ~(count)}');
  });

  it('a map of vectors of maps of sets reads back from its print', async () => {
    await readsBack('{:data [{:id 1 :tags #[:a :b]} {:id 2 :tags #[:c]}]}');
  });
});

it('prints a tag name as `::name`', async () => {
  const { printValue } = await import('../../../src/print-value.mjs');
  expect(printValue(makeTag('foo'))).toBe('::foo');
});
