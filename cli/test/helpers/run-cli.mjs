// The command line run in a process of its own, `bin.mjs` handed its
// arguments and its standard input, its code and the text of its streams read
// back [QSCLI#answer].

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const binPath = resolve(here, '..', '..', 'src', 'bin.mjs');

// runCli(args, opts?) — spawn `node cli/src/bin.mjs <args…>`,
// optionally pipe `opts.stdin` into the child, capture stdout /
// stderr / exitCode. Resolves once the child exits. The child writes
// without colour, whatever a terminal or a harness forces through
// `FORCE_COLOR`, which the command line reads before `NO_COLOR`.
export function runCli(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
    if (opts.stdin !== undefined) child.stdin.write(opts.stdin);
    child.stdin.end();
  });
}
