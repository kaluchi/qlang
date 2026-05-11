// Per-binding stall detector. Spawns a child node process for each
// manifest binding, runs `reify(:NAME) | runExamples` with a 10-sec
// budget, and prints the names that did not finish (the rest get a
// one-line "ok" with timing). Helps isolate which docstring contains
// a Quote whose evaluation diverges (recursion, super-slow eval,
// fail-track storm, ...).

import { spawn } from 'node:child_process';
import { evalQuery } from '../core/src/eval.mjs';

const TIMEOUT_MS = 10_000;

const names = await evalQuery('manifest * /name');
console.log(`Probing ${names.length} bindings, ${TIMEOUT_MS / 1000}s budget each…\n`);

function probe(name) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [
      '-e',
      `import('./core/src/eval.mjs').then(({evalQuery}) =>
         evalQuery('reify(:${name}) | runExamples | count').then(n =>
           process.stdout.write(String(n))));`
    ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ name, status: 'STALL', elapsed: Date.now() - t0 });
    }, TIMEOUT_MS);

    child.on('exit', code => {
      clearTimeout(killTimer);
      resolve({
        name,
        status: code === 0 ? 'ok' : 'EXIT-' + code,
        count: parseInt(out, 10),
        elapsed: Date.now() - t0
      });
    });
  });
}

const stalls = [];
for (const name of names) {
  const r = await probe(name);
  if (r.status === 'STALL') stalls.push(r.name);
  const tag = r.status === 'STALL' ? 'STALL' : (r.status === 'ok' ? 'ok  ' : r.status);
  console.log(`  ${tag}  ${name.padEnd(22)} ${r.elapsed}ms ${r.count ?? ''}`);
}

console.log();
if (stalls.length === 0) console.log('No stalls.');
else console.log(`Stalled (${stalls.length}): ${stalls.join(', ')}`);
