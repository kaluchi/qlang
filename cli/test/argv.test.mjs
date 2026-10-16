// argv-parser branch coverage. parseArgv has four shapes; one test
// per shape, plus the long/short flag aliases so every comparison
// branch fires.

import { describe, it, expect } from 'vitest';
import { parseArgv, HELP_TEXT, VERSION_LINE } from '../src/argv.mjs';

describe('parseArgv', () => {
  it('returns a usageError cliInvocation for an empty argv slice', () => {
    const cliInvocation = parseArgv([]);
    expect(cliInvocation.kind).toBe('usageError');
    expect(cliInvocation.message).toMatch(/missing query/);
  });

  it('recognises -h as the short help flag', () => {
    expect(parseArgv(['-h'])).toEqual({ kind: 'help' });
  });

  it('recognises --help as the long help flag', () => {
    expect(parseArgv(['--help'])).toEqual({ kind: 'help' });
  });

  it('recognises -V as the short version flag', () => {
    expect(parseArgv(['-V'])).toEqual({ kind: 'version' });
  });

  it('recognises --version as the long version flag', () => {
    expect(parseArgv(['--version'])).toEqual({ kind: 'version' });
  });

  it('recognises -i as the short repl flag', () => {
    expect(parseArgv(['-i'])).toEqual({ kind: 'repl', budget: null, initialQuery: null });
  });

  it('recognises --repl as the long repl flag', () => {
    expect(parseArgv(['--repl'])).toEqual({ kind: 'repl', budget: null, initialQuery: null });
  });

  it('returns an evalQuery cliInvocation carrying the first positional argument and auto inputFormat', () => {
    const cliInvocation = parseArgv(['[1 2 3] | count']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '[1 2 3] | count',
      inputFormat: 'auto',
      colorMode: 'auto',
      budget: null,
      failureExitCode: 0
    });
  });

  it('refuses an argument after the query, a flag written there among them, which nothing would read [QSHST#answer]', () => {
    expect(parseArgv(['1 | add 2', '--budget=10'])).toEqual({
      kind: 'usageError',
      message: "qlang: '--budget=10' after the query is read by nothing: the flags stand before the query, which is one argument, `qlang [flags] '<query>'`\n"
    });
    expect(parseArgv(['-i', '1 | add 2', '2']).kind).toBe('usageError');
  });

  it('parses --json as the JSON input mode preceding the query', () => {
    expect(parseArgv(['--json', '/key'])).toEqual({
      kind: 'evalQuery',
      queryText: '/key',
      inputFormat: 'json',
      colorMode: 'auto',
      budget: null,
      failureExitCode: 0
    });
  });

  it('parses --raw, stdin read as one string, before the query', () => {
    expect(parseArgv(['--raw', 'append " world"'])).toEqual({
      kind: 'evalQuery',
      queryText: 'append " world"',
      inputFormat: 'raw',
      colorMode: 'auto',
      budget: null,
      failureExitCode: 0
    });
  });

  it('parses --color=always as the explicit always-paint mode', () => {
    expect(parseArgv(['--color=always', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'always',
      budget: null,
      failureExitCode: 0
    });
  });

  it('parses --color=never as the explicit never-paint mode', () => {
    expect(parseArgv(['--color=never', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'never',
      budget: null,
      failureExitCode: 0
    });
  });

  it('rejects --color with an unknown value as a usageError', () => {
    const result = parseArgv(['--color=rainbow', '42']);
    expect(result.kind).toBe('usageError');
    expect(result.message).toMatch(/--color expects auto \/ always \/ never/);
  });

  it('parses --budget=N as the characters every answer prints within [QSHST#answer]', () => {
    expect(parseArgv(['--budget=4000', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'auto',
      budget: 4000,
      failureExitCode: 0
    });
    expect(parseArgv(['--budget=500', '-i'])).toEqual({ kind: 'repl', budget: 500, initialQuery: null });
  });

  it('parses --fail as the code 1 a failure exits with, 0 without it [QSHST#answer]', () => {
    expect(parseArgv(['--fail', '--raw', 'count'])).toEqual({
      kind: 'evalQuery',
      queryText: 'count',
      inputFormat: 'raw',
      colorMode: 'auto',
      budget: null,
      failureExitCode: 1
    });
    expect(parseArgv(['count']).failureExitCode).toBe(0);
  });

  it('rejects a --budget that is no positive count as a usageError', () => {
    const result = parseArgv(['--budget=0', '42']);
    expect(result.kind).toBe('usageError');
    expect(result.message).toMatch(/--budget expects a positive count of characters, got '0'/);
  });

  it('takes the query after -i as the first cell of the REPL [QSHST#answer]', () => {
    expect(parseArgv(['-i', '::qlang | doc'])).toEqual({ kind: 'repl', budget: null, initialQuery: '::qlang | doc' });
  });

  it('reads a flag after -i as a flag, the query after it as the first cell', () => {
    expect(parseArgv(['-i', '--budget=500', '::qlang | doc'])).toEqual({ kind: 'repl', budget: 500, initialQuery: '::qlang | doc' });
  });

  it('reports a usageError when only an input-mode flag is supplied without a query', () => {
    const cliInvocation = parseArgv(['--json']);
    expect(cliInvocation.kind).toBe('usageError');
    expect(cliInvocation.message).toMatch(/missing query/);
  });
});

describe('HELP_TEXT and VERSION_LINE constants', () => {
  it('HELP_TEXT mentions the qlang name and the usage form', () => {
    expect(HELP_TEXT).toMatch(/qlang/);
    expect(HELP_TEXT).toMatch(/Usage:/);
  });

  it('VERSION_LINE names the @kaluchi/qlang-cli package', () => {
    expect(VERSION_LINE).toMatch(/@kaluchi\/qlang-cli/);
  });

  it('tells an input --json takes that does not parse as the refusal it answers, exit 0 as every answer [QSHST#answer]', () => {
    const jsonMode = HELP_TEXT.slice(HELP_TEXT.indexOf('--json  '), HELP_TEXT.indexOf('--raw  '));
    expect(jsonMode).toContain('::string/parseJson/TextNotJsonError');
    expect(jsonMode).toContain('exit 0 as every answer');
  });

  it('tells the code every answer exits with and the one --fail gives a failure [QSHST#answer]', () => {
    const exitCodes = HELP_TEXT.slice(HELP_TEXT.indexOf('Exit code:'), HELP_TEXT.indexOf('Examples:'));
    expect(exitCodes).toContain('0 for every answer, a failure among them');
    expect(exitCodes).toContain('--fail      1 where the answer is a failure');
    expect(HELP_TEXT).toContain('[--budget=N] [--fail] <query>');
  });
});
