import { describe, it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

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

  it('writes a query that does not parse as its failure on stdout, with exit code 0', async () => {
    const { stdout, stderr, exitCode } = await runCli(['[1 2'], { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('::quote/ParseError!{');
    expect(stderr).toBe('');
  });

  it('exits a failure with 1 under --fail, written on stdout as without it', async () => {
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
});
