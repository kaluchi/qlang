// Per-binding stall detector. For every value-namespace binding in
// `manifest`, spawns a child node process that runs
// `:NAME | runExamples` under a 10-second budget; prints the names
// whose run did not finish in time (the rest get a one-line "ok"
// with timing). Use when `runExamples` catalog-self-test takes
// longer than expected — isolates which binding's doc-prefix carries
// a Quote whose evaluation diverges (recursion, super-slow eval,
// fail-track storm, …).

import { spawn } from 'node:child_process';
import { evalQuery } from '../core/src/eval.mjs';

const RUN_EXAMPLES_BUDGET_MS = 10_000;

const probedBindingNames = await evalQuery('manifest * /name');
console.log(`Probing ${probedBindingNames.length} bindings, ${RUN_EXAMPLES_BUDGET_MS / 1000}s budget each…\n`);

function probeBinding(bindingName) {
  return new Promise(resolve => {
    const probeStartMs = Date.now();
    const childProcess = spawn(process.execPath, [
      '-e',
      `import('./core/src/eval.mjs').then(({evalQuery}) =>
         evalQuery(':"${bindingName}" | runExamples | count').then(n =>
           process.stdout.write(String(n))));`
    ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });

    let childStdoutText = '';
    childProcess.stdout.on('data', chunk => { childStdoutText += chunk.toString(); });

    const stallTimer = setTimeout(() => {
      childProcess.kill('SIGKILL');
      resolve({ bindingName, status: 'STALL', elapsedMs: Date.now() - probeStartMs });
    }, RUN_EXAMPLES_BUDGET_MS);

    childProcess.on('exit', exitCode => {
      clearTimeout(stallTimer);
      resolve({
        bindingName,
        status: exitCode === 0 ? 'ok' : 'EXIT-' + exitCode,
        exampleCount: parseInt(childStdoutText, 10),
        elapsedMs: Date.now() - probeStartMs
      });
    });
  });
}

const stalledBindingNames = [];
for (const bindingName of probedBindingNames) {
  const probeOutcome = await probeBinding(bindingName);
  if (probeOutcome.status === 'STALL') stalledBindingNames.push(probeOutcome.bindingName);
  const statusLabel = probeOutcome.status === 'STALL'
    ? 'STALL'
    : (probeOutcome.status === 'ok' ? 'ok  ' : probeOutcome.status);
  console.log(`  ${statusLabel}  ${bindingName.padEnd(22)} ${probeOutcome.elapsedMs}ms ${probeOutcome.exampleCount ?? ''}`);
}

console.log();
if (stalledBindingNames.length === 0) console.log('No stalls.');
else console.log(`Stalled (${stalledBindingNames.length}): ${stalledBindingNames.join(', ')}`);
