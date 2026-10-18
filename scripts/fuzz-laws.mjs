// Runs every law of the root again with one or two of its literals changed
// to an edge value, a number, a string, a vector, a quote, a keyword or a
// tag, and fails on a variant whose answer is a host's failure, whose run
// throws past the fail track, or whose answer prints as a text that reads
// back as another value: node scripts/fuzz-laws.mjs [variants of each law] [seed].
// The rules it holds: [QSWRK#tooling].

import { evalQuery, printValue, langRuntime } from '../core/src/index.mjs';
import { ROOT_KEY } from '../core/src/env-keys.mjs';
import { deepEqual } from '../core/src/equality.mjs';
import { isErrorValue } from '../core/src/types.mjs';

const variantsOfEachLaw = Number(process.argv[2] ?? 10);
let seed = Number(process.argv[3] ?? 1);

// The same sequence for the same seed, so a run repeats.
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = items => items[Math.floor(random() * items.length)];

// The edge values a literal is changed to, by the regex that finds it.
const MUTATORS = [
  [/(?<![\w.:/"-])-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(?![\w.])/g,
    ['0', '-1', '1', '2', '-0.5', '1e308', '-1e308', '0.1', '1e-308', '9007199254740993', '1000000', '-0', '3.7']],
  [/"(?:[^"\\]|\\.)*"/g, ['""', '"é\u{1F600}"', '"a,b"', '" "', '"\\n"', '"42"', '"[1]"', '":k"']],
  [/\[(?:[^[\]"]|"(?:[^"\\]|\\.)*")*\]/g, ['[]', '[0]', '[1e308 -1e308]', '[[1] [2]]', '[null]', '["a" 1]', '[:a :b]', '#[]', '{}']],
  [/~\((?:[^()]|\([^()]*\))*\)/g, ['~()', '~(0)', '~(it)', '~(add 1)', '~(~(x))', '~(!| 0)', '~(gt 0)', '~(count)', '~(get /a)', '~(eq null)']],
  [/(?<![:\w])(:[a-z]\w*)(?![\w/])/g, [':zz', ':"a b"', ':a', ':n', ':0']],
  [/::[A-Za-z][\w/]*/g, ['::number', '::vec', '::map', '::string', '::error', '::Oops', '::any']],
];

function variantOf(law) {
  let variant = law;
  for (let times = 1 + Math.floor(random() * 2); times > 0; times--) {
    const [regex, edges] = pick(MUTATORS);
    const spots = [...variant.matchAll(regex)];
    if (spots.length === 0) continue;
    const spot = pick(spots);
    variant = variant.slice(0, spot.index) + pick(edges) + variant.slice(spot.index + spot[0].length);
  }
  return variant;
}

const scope = await langRuntime();
const counts = { variants: 0, values: 0, unparsed: 0 };

// What a variant breaks, or null; an answer that holds an elision stays
// out of the reading back, since its print writes a cut.
async function breakOf(text) {
  try {
    const answer = await evalQuery(text, scope);
    if (isErrorValue(answer)) {
      if (answer.tag.name === 'quote/ParseError') counts.unparsed++;
      return answer.tag.name === 'call/HostFailureError' ? `a host's failure: ${answer.descriptor.get('message')}` : null;
    }
    counts.values++;
    const printed = printValue(answer);
    if (printed.includes('::elision')) return null;
    return deepEqual(answer, await evalQuery(printed, scope)) ? null : `reads back as another value: ${printed.slice(0, 80)}`;
  } catch (thrown) {
    return `threw: ${String(thrown?.message ?? thrown).slice(0, 120)}`;
  }
}

// The query of every law under every name the root holds, the last step
// that compares its answer left off, so a variant answers the value the
// law reaches.
const laws = [];
for (const name of scope.get(ROOT_KEY).keys()) {
  const quotes = await evalQuery(`::${name} | laws | entries | map ~(get /1 | get /1 | print)`, scope);
  if (Array.isArray(quotes)) for (const quote of quotes) laws.push(quote.slice(2, -1).replace(/\s+\|\s+eq\s[^|]*$/, ''));
}

const breaks = new Map();
for (const law of laws) {
  for (let at = 0; at < variantsOfEachLaw; at++) {
    const text = variantOf(law);
    counts.variants++;
    const broken = await breakOf(text);
    if (broken !== null && !breaks.has(broken)) breaks.set(broken, text);
  }
}

console.log(`${laws.length} laws, ${counts.variants} variants, ${counts.values} answered a value, ${counts.unparsed} did not parse, ${breaks.size} broke`);
for (const [broken, text] of breaks) console.log(`${broken}\n  ${text}`);
if (breaks.size > 0) console.log('a law broke at the edges of its literals: a host failed, a run threw past the fail track, or a print read back as another value [QSWRK#tooling]');
process.exitCode = breaks.size === 0 ? 0 : 1;
