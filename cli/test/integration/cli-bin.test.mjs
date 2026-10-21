// The command line run as a process of its own, `cli/src/bin.mjs`: what it
// writes to standard output and standard error and the code it exits with,
// for a query, its flags and its piped input, and in the REPL
// [QSHST#answer], [QSHST#stdin], [QSHST#repl].

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(here, '..', '..', 'src', 'bin.mjs');

// runCli(args, opts?) — spawn `node cli/src/bin.mjs <args…>`,
// optionally pipe `opts.stdin` into the child, capture stdout /
// stderr / exitCode. Resolves once the child exits. The child writes
// without colour, whatever a terminal or a harness forces through
// `FORCE_COLOR`, which the command line reads before `NO_COLOR`.
function runCli(args, opts = {}) {
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

describe('CLI: --help', () => {
  it('prints the page of the command line and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\|~~ The command line runs a query/);
    expect(stdout).toMatch(/Usage:/);
  });
});

describe('CLI: --version', () => {
  it('prints version line and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/qlang-cli/);
  });
});

describe('CLI: script mode — query argument', () => {
  it('evaluates `42 | mul 2` and writes `84`', async () => {
    const { stdout, exitCode } = await runCli(['42 | mul 2'], { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('84');
  });

  it('evaluates `[1 2 3] | count` and writes `3`', async () => {
    const { stdout, exitCode } = await runCli(['[1 2 3] | count'], { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('3');
  });

  it('writes a query that does not parse as its failure on stdout, with exit code 0 [QSHST#answer]', async () => {
    const { stdout, stderr, exitCode } = await runCli(['[1 2'], { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('::quote/ParseError!{');
    expect(stderr).toBe('');
  });

  it('exits a failure with 1 under --fail, written on stdout as without it [QSHST#answer]', async () => {
    const { stdout, stderr, exitCode } = await runCli(['--fail', '"x" | add 1'], { stdin: '' });
    expect(exitCode).toBe(1);
    expect(stdout).toContain('::number/add/SubjectNotNumberError!{');
    expect(stderr).toBe('');
  });

  it('errors on usage failure with exit code 2', async () => {
    const { exitCode, stderr } = await runCli([]);
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/missing query/);
  });

  it('the axes read a declaration of the query in script mode', async () => {
    const { stdout, exitCode } = await runCli(
      [':foo |~~ note ~~| | ::foo | doc | content'],
      { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('note');
  });
});

describe('CLI: piped stdin — the readings of stdin', () => {
  it('reads piped JSON as values, which `get /name` reads', async () => {
    const { stdout, exitCode } = await runCli(['get /name'], {
      stdin: '{"name": "alice", "age": 30}'
    });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('alice');
  });

  it('--raw reads standard input as a string', async () => {
    const { stdout, exitCode } = await runCli(['--raw', 'append " world"'], {
      stdin: 'hello'
    });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('hello world');
  });
});

describe('CLI: the REPL (`-i`) loads its modules, runs its cells and closes on `.exit`', () => {
  // `.exit\n` sent at once closes the child after the REPL boots.
  it('starts up, prints prompt, accepts .exit, returns code 0', async () => {
    const { exitCode, stderr } = await runCli(['-i'], { stdin: '.exit\n' });
    // A syntax error inside repl.mjs would surface on stderr and
    // produce a non-zero exit code BEFORE the prompt is drawn.
    expect(stderr).not.toMatch(/SyntaxError|ReferenceError/);
    expect(exitCode).toBe(0);
  });

  it('evaluates a query in REPL mode and prints the result', async () => {
    const { stdout, exitCode } = await runCli(['-i'], {
      stdin: '42 | mul 2\n.exit\n'
    });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/84/);
  });

  it('REPL keeps the verbs a cell declares for the cells after it', async () => {
    const { stdout, exitCode } = await runCli(['-i'], {
      stdin: ':any/double ~(mul 2)\n21 | double\n.exit\n'
    });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/42/);
  });

  it('REPL .help command prints meta-commands and stays open', async () => {
    const { stdout, exitCode } = await runCli(['-i'], {
      stdin: '.help\n.exit\n'
    });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Meta commands/);
    expect(stdout).toMatch(/\.exit/);
  });
});
