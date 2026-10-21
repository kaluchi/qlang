import { describe, it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

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
