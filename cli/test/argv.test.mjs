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

  it('returns an evalQuery cliInvocation carrying the first positional argument', () => {
    const cliInvocation = parseArgv(['[1 2 3] | count']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '[1 2 3] | count'
    });
  });

  it('treats trailing argv elements as inert when the first positional is the query', () => {
    // Skeleton: only argv[0] participates as query. Later commits
    // extend the parser; this test pins the current contract so the
    // change point is explicit.
    const cliInvocation = parseArgv(['1 | add(2)', '--unused']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '1 | add(2)'
    });
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
