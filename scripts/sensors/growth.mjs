#!/usr/bin/env node
// The time the parser and the evaluator of the tree take over shapes of a
// text whose size or depth n doubles, each run in a process of its own bounded
// by a limit, the ratio of each step beside it, so a shape whose time more
// than doubles where n doubles grows past linear [QSVOX#folders]; and the
// most entries of the parser into one rule at one offset of a shape, which a
// parse in linear time keeps the same where n doubles [D404].
//
//   node scripts/sensors/growth.mjs [parse|eval|rereads] [words of a shape]

import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const repeat = (text, n) => text.repeat(n);
const declarations = (n, between) => Array.from({ length: n }, (_, i) => `:vec/f${i}${between}`);

// The shapes the parser reads, a text of each size.
const PARSE = {
  'groups nested, left open': n => repeat('(', n) + 'x ]',
  'groups nested, closed': n => repeat('(', n) + '1' + repeat(')', n),
  'tags with parentheses nested': n => repeat('::A(', n) + '1' + repeat(')', n),
  'tags with parentheses nested, left open': n => repeat('::A(', n) + 'x',
  'calls by habit nested, left open': n => repeat('f(', n) + 'x ]',
  'quotes nested, left open': n => repeat('~(', n) + 'x',
  'quotes of commands nested, left open': n => repeat('f ~(', n) + 'x',
  'quotes of commands nested, closed': n => repeat('f ~(', n) + 'x' + repeat(')', n),
  'quotes of templates nested, left open': n => repeat('get [~(', n) + 'x',
  'quotes of templates nested, closed': n => repeat('get [~(', n) + 'x' + repeat(')]', n),
  'recipes of verbs nested, left open': n => repeat(':vec/f (::fn | impl ~(', n) + 'x',
  'recipes of verbs nested, closed': n => repeat(':vec/f (::fn | impl ~(', n) + 'x' + repeat('))', n),
  'vectors nested, left open': n => repeat('[', n) + '1',
  'maps nested, left open': n => repeat('{:a ', n) + '1',
  'declarations nested, bodies on the next line': n => repeat(':vec/f\n  (', n) + '1' + repeat(')', n),
  'declarations with docs nested, left open': n => repeat(':vec/f |~~ d ~~| (', n) + 'get /a',
  'bare names with docs nested in their docs, closed': n => repeat(':x |~~ ~(', n) + '1' + repeat(') ~~| 1', n),
  'a run of declarations, bodies on the next line': n => declarations(n, '\n  ~(get /0)').join(' |\n') + ' | [1]',
  'line docs in the quotes of line docs': n => '|~~| ' + repeat('~(|~~| ', n) + 'x',
  'block docs in a line doc': n => '|~~| a ' + repeat('|~~ b ', n) + 'c',
  'block docs nested, left open': n => repeat('|~~ a ', n),
  'block docs in the quotes of block docs, closed': n => repeat('|~~ ~(', n) + 'x' + repeat(') ~~|', n),
  'block comments nested, left open': n => repeat('|~ a ', n),
  'block comments nested, closed': n => repeat('|~ a ', n) + 'x' + repeat(' ~|', n) + ' 1',
  'a long pipeline': n => repeat('add 1 | ', n) + 'add 1',
  'a long pipeline, left open': n => repeat('add 1 | ', n) + 'add (1',
  'a vector of many elements, left open': n => '[' + repeat('1 ', n),
  'a map of many entries, left open': n => '{' + Array.from({ length: n }, (_, i) => `:k${i} 1`).join(' ')
};

// The queries the evaluator runs, one of each size, its text read with it.
const EVAL = {
  'a long pipeline': n => '1' + repeat(' | add 1', n),
  'a failure passing a long pipeline': n => '"x" | add 1' + repeat(' | add 1', n) + ' !| tag',
  'groups nested': n => repeat('(', n) + '1' + repeat(' | add 1)', n),
  'quotes nested and applied': n => '5 | ' + repeat('apply ~(', n) + 'add 1' + repeat(')', n),
  'map over many elements': n => `${n} | range | map (add 1) | count`,
  'a failure in map at the last element': n => `${n} | range | map (if (eq ${n - 1}) raise it) !| tag`,
  'reduce over many elements': n => `${n} | range | reduce 0 add`,
  'sort of many elements': n => `${n} | range | map (mul -1) | sort | first`,
  'a run of declarations read at its end': n => 'apply ~(' + Array.from({ length: n }, (_, i) => `:a${i} ${i};`).join(' ') + ` a${n - 1})`,
  'a value nested, printed': n => repeat('[', n) + '1' + repeat(']', n) + ' | print | count',
  'a template of many parts': n => 'get [' + repeat('~(add 1) ', n) + '] | count',
  'a failure caught at each of many steps': n => '"x"' + repeat(' | add 1 !| "x"', n) + ' | count',
  'equality of values nested': n => `${repeat('[', n)}1${repeat(']', n)} | with {:v it} (eq v)`
};

// One run: the milliseconds of the median of up to five, the answer of a
// query that raised past the fail track a failure of the run.
async function runOne(kind, shape, n) {
  const core = await import(new URL('../../core/src/index.mjs', import.meta.url));
  const text = (kind === 'parse' ? PARSE : EVAL)[shape](n);
  const notebook = kind === 'eval' ? await core.createNotebook() : null;
  const times = [];
  const started = performance.now();
  do {
    const at = performance.now();
    if (kind === 'parse') {
      try { core.parseSource(text); } catch (refusal) { if (!(refusal instanceof core.SourceParseError)) throw refusal; }
    } else {
      const cell = await notebook.evalCell(text);
      if (cell.defect !== null) throw cell.defect;
    }
    times.push(performance.now() - at);
  } while (times.length < 5 && performance.now() - started < 3000);
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const LIMIT_MS = 15000;

// The parser of the tree built with the tracer of Peggy into a file of its
// own, and the most entries into one rule at one offset of each text, with
// the rule and the offset.
async function rereadsOf(texts) {
  const peggy = createRequire(import.meta.url)('peggy');
  const grammar = readFileSync(new URL('../../core/src/grammar.peggy', import.meta.url), 'utf8');
  const parser = peggy.generate(grammar, { output: 'source', format: 'es', trace: true, allowedStartRules: ['Query'] })
    .replaceAll("from '../src/", `from '${pathToFileURL(join(root, 'core/src'))}/`);
  const traced = join(tmpdir(), `qlang-grammar-traced-${process.pid}.mjs`);
  writeFileSync(traced, parser);
  const { parse } = await import(pathToFileURL(traced));
  unlinkSync(traced);
  return texts.map(text => {
    const entries = new Map();
    const tracer = {
      trace({ type, rule, location }) {
        if (type === 'rule.enter') entries.set(`${rule} at ${location.start.offset}`, (entries.get(`${rule} at ${location.start.offset}`) ?? 0) + 1);
      }
    };
    try { parse(text, { tracer, commentTrivia: new Map() }); } catch { /* a refusal and an overflow are answers */ }
    return [...entries].reduce((most, entry) => (entry[1] > most[1] ? entry : most), ['', 0]);
  });
}

if (process.argv[2] === 'rereads') {
  const words = process.argv.slice(3).join(' ');
  for (const shape of Object.keys(PARSE).filter(name => name.includes(words))) {
    const [atN, atTwice] = await rereadsOf([PARSE[shape](8), PARSE[shape](16)]);
    console.log(`rereads ${shape.padEnd(48)} 8:${atN[1]} 16:${atTwice[1]}${atTwice[1] > atN[1] ? ` ${atTwice[0]}` : ''}`);
  }
} else if (process.argv[2] === '--one') {
  const [kind, shape, n] = process.argv.slice(3);
  console.log((await runOne(kind, shape, Number(n))).toFixed(2));
} else {
  const kinds = ['parse', 'eval'].filter(kind => process.argv[2] === undefined || process.argv[2] === kind);
  const words = process.argv.slice(3).join(' ');
  for (const kind of kinds) {
    for (const shape of Object.keys(kind === 'parse' ? PARSE : EVAL).filter(name => name.includes(words))) {
      const row = [];
      let last = null;
      for (let n = 4; n <= 8192; n *= 2) {
        const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--one', kind, shape, String(n)], { cwd: root, encoding: 'utf8', timeout: LIMIT_MS });
        if (run.error || run.status !== 0) {
          row.push(`${n}:${run.error ? `>${LIMIT_MS / 1000}s` : (run.stderr.split('\n').find(line => /^\w*Error:/.test(line)) ?? 'failed').trim().slice(0, 40)}`);
          break;
        }
        const ms = Number(run.stdout.trim());
        row.push(`${n}:${ms.toFixed(1)}${last === null || last < 0.5 ? '' : `(x${(ms / last).toFixed(1)})`}`);
        last = ms;
        if (ms > 2000) break;
      }
      console.log(`${kind} ${shape.padEnd(48)} ${row.join(' ')}`);
    }
  }
}
