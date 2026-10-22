import { it, expect } from 'vitest';
import { Worker } from 'node:worker_threads';

const millisecondsOfARead = text => new Promise((resolve, reject) => {
  const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
      import(workerData.parser).then(({ parse }) => {
        const started = Date.now();
        try { parse(workerData.text); } catch {}
        parentPort.postMessage(Date.now() - started);
      });`, { eval: true, workerData: { text, parser: new URL('../../src/parse.mjs', import.meta.url).href } });
  const stop = setTimeout(() => worker.terminate().then(() => resolve(Infinity)), 10000);
  worker.once('message', elapsed => { clearTimeout(stop); worker.terminate().then(() => resolve(elapsed)); });
  worker.once('error', failure => { clearTimeout(stop); reject(failure); });
});

it.each([
  ['calls by habit nested, left open', 'f('.repeat(19) + 'x ]'],
  ['declarations with docs nested, left open', ':vec/f |~~ d ~~| ('.repeat(9) + 'get /a'],
  ['bare names with docs nested in their docs, closed', ':x |~~ ~('.repeat(18) + '1' + ') ~~| 1'.repeat(18)],
  ['quotes of commands nested, left open', 'f ~('.repeat(12) + 'x'],
  ['quotes of templates nested, left open', 'get [~('.repeat(11) + 'x'],
  ['tags with parentheses nested, left open', '::A('.repeat(1024) + 'x'],
  ['block docs nested, left open', '|~~ a '.repeat(20)],
  ['block comments nested, left open', '|~ a '.repeat(24)],
  ['line docs in the quotes of line docs', '|~~| ' + '~(|~~| '.repeat(13) + 'x'],
  ['a run of declarations joined by pipes, their bodies on the next line', Array.from({ length: 700 }, (_, at) => `:vec/f${at}\n  ~(get /0)`).join(' |\n') + ' | [1]']
])('reads %s within two seconds, a time linear in its size', async (_, text) => {
  expect(await millisecondsOfARead(text)).toBeLessThan(2000);
});
