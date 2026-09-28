// argv-parser branch coverage. parseArgv has four shapes; one test
// per shape, plus the long/short flag aliases so every comparison
// branch fires.

import { describe, it, expect } from 'vitest';
import { parseArgv, HELP_TEXT, VERSION_LINE, ANSWER_BUDGET } from '../src/argv.mjs';

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
    expect(parseArgv(['-i'])).toEqual({ kind: 'repl', budget: ANSWER_BUDGET });
  });

  it('recognises --repl as the long repl flag', () => {
    expect(parseArgv(['--repl'])).toEqual({ kind: 'repl', budget: ANSWER_BUDGET });
  });

  it('returns an evalQuery cliInvocation carrying the first positional argument and auto inputFormat', () => {
    const cliInvocation = parseArgv(['[1 2 3] | count']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '[1 2 3] | count',
      inputFormat: 'auto',
      colorMode: 'auto',
      budget: ANSWER_BUDGET
    });
  });

  it('treats trailing argv elements as inert when the first positional is the query', () => {
    const cliInvocation = parseArgv(['1 | add 2', '--unused']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '1 | add 2',
      inputFormat: 'auto',
      colorMode: 'auto',
      budget: ANSWER_BUDGET
    });
  });

  it('parses --json as the JSON input mode preceding the query', () => {
    expect(parseArgv(['--json', '/key'])).toEqual({
      kind: 'evalQuery',
      queryText: '/key',
      inputFormat: 'json',
      colorMode: 'auto',
      budget: ANSWER_BUDGET
    });
  });

  it('parses --raw as the raw-String input mode preceding the query', () => {
    expect(parseArgv(['--raw', 'append " world"'])).toEqual({
      kind: 'evalQuery',
      queryText: 'append " world"',
      inputFormat: 'raw',
      colorMode: 'auto',
      budget: ANSWER_BUDGET
    });
  });

  it('parses --color=always as the explicit always-paint mode', () => {
    expect(parseArgv(['--color=always', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'always',
      budget: ANSWER_BUDGET
    });
  });

  it('parses --color=never as the explicit never-paint mode', () => {
    expect(parseArgv(['--color=never', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'never',
      budget: ANSWER_BUDGET
    });
  });

  it('rejects --color with an unknown value as a usageError', () => {
    const result = parseArgv(['--color=rainbow', '42']);
    expect(result.kind).toBe('usageError');
    expect(result.message).toMatch(/--color expects auto \/ always \/ never/);
  });

  it('parses --full as the lifted budget of the answer [D109]', () => {
    expect(parseArgv(['--full', '42'])).toEqual({
      kind: 'evalQuery',
      queryText: '42',
      inputFormat: 'auto',
      colorMode: 'auto',
      budget: null
    });
    expect(parseArgv(['--full', '-i'])).toEqual({ kind: 'repl', budget: null });
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
});
