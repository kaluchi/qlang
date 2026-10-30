import { it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

it('starts the REPL by -i, prompts, and closes with the code 0 on .exit', async () => {
  const { exitCode, stderr } = await runCli(['-i'], { stdin: '.exit\n' });
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
    stdin: ':any/double mul 2\n21 | double\n.exit\n'
  });
  expect(exitCode).toBe(0);
  expect(stdout).toMatch(/42/);
});

it('lists the commands of the REPL on .help and stays open', async () => {
  const { stdout, exitCode } = await runCli(['-i'], {
    stdin: '.help\n.exit\n'
  });
  expect(exitCode).toBe(0);
  expect(stdout).toMatch(/Meta commands/);
  expect(stdout).toMatch(/\.exit/);
});
