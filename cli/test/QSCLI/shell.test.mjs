import { describe, it, expect } from 'vitest';
import { main, queryAsWritten } from '../../src/main.mjs';
import { captureStreams } from '../helpers/main-streams.mjs';

describe('main — a query the shell turned into a path', () => {
  const UNDER_MSYS = { MSYSTEM: 'MINGW64' };
  const ROOT_OF_GIT = path => path === 'C:/Program Files/Git/usr/bin/msys-2.0.dll';

  it('reads a query from the slash after the root of MSYS, which the shell wrote before it', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users | segments', UNDER_MSYS, ROOT_OF_GIT)).toBe('/data/users | segments');
  });

  it('leaves a query a shell other than MSYS handed as it came', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users', {}, ROOT_OF_GIT)).toBe('C:/Program Files/Git/data/users');
  });

  it('leaves a path with no runtime of MSYS on its way as it came', () => {
    expect(queryAsWritten('C:/data/users', UNDER_MSYS, () => false)).toBe('C:/data/users');
  });

  it('leaves a query of the language, and no query where a REPL starts without one, as they came', () => {
    expect(queryAsWritten('/data/users', UNDER_MSYS, () => true)).toBe('/data/users');
    expect(queryAsWritten(null, UNDER_MSYS, () => true)).toBe(null);
  });

  it('names the shell and the two ways around it when the query begins with a drive', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['C:/Program Files/Git/a'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).toMatch(/the shell turned a query that began with `\/` into a path/);
    expect(s.stderrText()).toContain("`qlang 'get /data/users'`");
    expect(s.stderrText()).toMatch(/MSYS_NO_PATHCONV=1/);
  });

  it('adds nothing to the failure of a query of the language', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['(1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).not.toMatch(/the shell turned/);
  });});
