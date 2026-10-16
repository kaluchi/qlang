// main orchestrator coverage. Every cliInvocation kind dispatches
// to its own branch; one test per branch, plus end-to-end flows
// that cover the script-mode auto-pipe contract (JSON in → the
// literal out, text in → the text out, `out` suppression, standard
// input read only for a query that reads its subject).
//
// Tests inject Readable / Writable stream stubs so the orchestrator
// runs without spawning a subprocess or touching `process.*`.

import { describe, it, expect } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { main, queryAsWritten, resolveShouldColorize } from '../src/main.mjs';

describe('resolveShouldColorize — explicit flag, env vars, TTY detection', () => {
  // Five-way precedence: --color=always > --color=never > FORCE_COLOR
  // > NO_COLOR > TTY autodetect. Each branch needs its own assertion
  // for the env-vars + auto-mode arms to land on full coverage.
  const ttyOut = { isTTY: true };
  const pipeOut = { isTTY: false };

  it('--color=always wins over a non-TTY stream', () => {
    expect(resolveShouldColorize('always', pipeOut, {})).toBe(true);
  });

  it('--color=never wins over a TTY stream', () => {
    expect(resolveShouldColorize('never', ttyOut, {})).toBe(false);
  });

  it('FORCE_COLOR=1 forces paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '1' })).toBe(true);
  });

  it('FORCE_COLOR=0 falls through to TTY check (not truthy as a flag)', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '0' })).toBe(false);
    expect(resolveShouldColorize('auto', ttyOut, { FORCE_COLOR: '0' })).toBe(true);
  });

  it('NO_COLOR=1 disables paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '1' })).toBe(false);
  });

  it('NO_COLOR=empty falls through to TTY check', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '' })).toBe(true);
  });

  it('--color=auto with no env defers to TTY detection — TTY → true', () => {
    expect(resolveShouldColorize('auto', ttyOut, {})).toBe(true);
  });

  it('--color=auto with no env defers to TTY detection — non-TTY → false', () => {
    expect(resolveShouldColorize('auto', pipeOut, {})).toBe(false);
  });
});

function captureStreams(stdinPayload = '') {
  const stdinStream = Readable.from([stdinPayload]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutStream = new Writable({
    write(chunk, _encoding, cb) { stdoutChunks.push(chunk.toString()); cb(); }
  });
  const stderrStream = new Writable({
    write(chunk, _encoding, cb) { stderrChunks.push(chunk.toString()); cb(); }
  });

  return {
    stdinStream, stdoutStream, stderrStream,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('main — flag dispatch', () => {
  it('returns exit 0 and writes the help banner on --help', async () => {
    const s = captureStreams();
    const exitCode = await main(['--help'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/Usage:/);
    expect(s.stderrText()).toBe('');
  });

  it('returns exit 0 and writes the version line on --version', async () => {
    const s = captureStreams();
    const exitCode = await main(['--version'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/@kaluchi\/qlang-cli/);
    expect(s.stderrText()).toBe('');
  });

  it('returns exit 2 and writes a usage hint on an empty argv slice', async () => {
    const s = captureStreams();
    const exitCode = await main([], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(2);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toMatch(/missing query/);
  });

  it('dispatches `--repl` into the line-editor REPL and exits cleanly on `.exit`', async () => {
    const s = captureStreams('.exit\n');
    const exitCode = await main(
      ['--repl'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/qlang.*>/);
  });
});

// A query that reads no subject runs without waiting on standard input,
// which a shell may hand open with nothing piped [QSHST#input].
describe('main — standard input read for a query that reads its subject', () => {
  const openStdin = () => Object.assign(new Readable({ read() {} }), { isTTY: false });

  it('answers a query that reads no subject over a stdin that never ends', async () => {
    const s = captureStreams();
    const exitCode = await main(['1 | add 1'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });

  it('reads stdin when `in` is called by a query that reads no subject', async () => {
    const s = captureStreams('piped text');
    await main(['"x" | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('piped text\n');
  });

  it('refuses a query that does not parse without reading stdin', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
  });
});

// `--fail` gives a failure the code 1, written as without it, and a
// value the code 0 [QSHST#answer].
describe('main — the code a failure exits with under --fail', () => {
  it('exits a failure with 1 and writes its alert on stdout', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '"x" | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toContain('::number/add/SubjectNotNumberError!{');
    expect(s.stderrText()).toBe('');
  });

  it('exits an input --json cannot read with 1, the refusal of parseJson its answer', async () => {
    const s = captureStreams('{"a":1');
    const exitCode = await main(['--fail', '--json', 'get /a'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toContain('::string/parseJson/TextNotJsonError!{');
  });

  it('exits a value with 0', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '1 | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });
});

describe('main — script mode auto-pipe', () => {
  it('starts from the default subject when stdin carries no bytes', async () => {
    const s = captureStreams();
    const exitCode = await main(['type'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('::tag\n');
  });

  it('feeds piped JSON as the initial pipeValue and writes a string answer as its text [QSHST#answer]', async () => {
    const s = captureStreams('{"user": {"name": "alice"}}');
    const exitCode = await main(
      ['get /user/name'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('alice\n');
    expect(s.stderrText()).toBe('');
  });

  it('prints a map read from a JSON input as its literal [QSHST#answer]', async () => {
    const s = captureStreams('{"a": {"b": 1, "c": 2}}');
    const exitCode = await main(
      ['get /a'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{:b 1 :c 2}\n');
  });

  it('prints a kind asked of a JSON input, which JSON has no form for [QSHST#answer]', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['type'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('::map\n');
  });

  it('writes JSON text for a query that ends in `| json` [QSHST#answer]', async () => {
    const s = captureStreams('{"a": [1, 2]}');
    await main(['get /a | json'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('[1,2]\n');
  });

  it('prints the count of a JSON input as its literal', async () => {
    const s = captureStreams('[1, 2, 3]');
    const exitCode = await main(
      ['count'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
  });

  it('reads stdin that is no JSON as one string', async () => {
    const s = captureStreams('plain text');
    const exitCode = await main(
      ['append " world"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('plain text world\n');
  });

  it('uses raw mode on --raw regardless of stdin shape', async () => {
    // The input reads as JSON, and `--raw` reads it as a string [QSHST#input].
    const s = captureStreams('{"a":1}');
    const exitCode = await main(
      ['--raw', 'append " done"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{"a":1} done\n');
  });

  it('answers --json over malformed stdin with the refusal of parseJson, on stdout with exit 0 [QSHST#answer]', async () => {
    const s = captureStreams('not-json');
    const exitCode = await main(
      ['--json', 'get /x'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    expect(s.stdoutText()).toContain('::string/parseJson/TextNotJsonError!{');
  });

  it('emits the query value on empty stdin via raw fallback', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });
});

describe('main — `out` suppression of auto-encoded stdout', () => {
  it('routes `out` emissions to stdout and skips the auto-encode', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count | print | out'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    // `out` wrote '3\n' during eval — no trailing duplicate from
    // the renderer.
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });

  it('feeds stdin into `in` alongside the auto-pipe so explicit queries still work', async () => {
    const s = captureStreams('hello world');
    const exitCode = await main(
      ['in | out'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('hello world\n');
  });
});

describe('main — error paths', () => {
  it('writes a query that does not parse as its failure on stdout, with exit 0 as every answer [QSHST#answer]', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    // The failure as the language prints it, `::quote/ParseError!{:expected …
    // :found … :source "[1 2" :marker "    ^" :location {…}}`.
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stdoutText()).toContain(':source "[1 2"');
    expect(s.stdoutText()).toContain(':marker');
  });

  it('answers a stdin magnitude outside the finite-double domain as parseJson refuses it, naming the path [QSHST#answer]', async () => {
    // `JSON.parse` reads `1e400` as an infinity, which the lift
    // refuses. Auto-mode keeps the refusal instead of re-labelling
    // the document as text, and the answer is the refusal `parseJson`
    // gives the text, its `:path` the keys that reach the number.
    const s = captureStreams('{"big": 1e400, "n": 1}');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).toContain(':path ["big"]');
  });

  it('answers a bare out-of-range magnitude with an empty path', async () => {
    const s = captureStreams('1e400');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).toContain(':path []');
  });

  it('answers the same refusal under an explicit --json input mode', async () => {
    const s = captureStreams('{"deep": [0, 1e400]}');
    const exitCode = await main(['--json', 'count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain(':path ["deep" 1]');
  });

  it('encodes a fail-track error value as data on stdout, exit 0', async () => {
    // A failure is an answer and travels on the channel of every answer
    // with exit 0 [QSHST#answer]; a nonzero exit is kept for what is no
    // answer, a defect of the runtime or a call with no query.
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | add 1'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('number/add/SubjectNotNumberError');
    expect(s.stderrText()).toBe('');
  });

  it('writes a failure with the prose of its refusal\'s page below it, as line comments [QSHST#answer]', async () => {
    const s = captureStreams();
    await main(['{:a 1} | get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.length).toBeGreaterThan(1);
    expect(commentLines.every(line => line.length <= 72)).toBe(true);
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('writes a failure on a JSON input as its alert with the prose of its page [QSHST#answer]', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['| get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toMatch(/^\|~\| raised, and no !\| caught it\n::path\/KeyNotInMapError!\{/);
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('writes a query that does not parse with the prose of its refusal\'s page below it, as any failure [QSHST#answer]', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('|~| raised, and no !| caught it');
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stdoutText()).toContain('|~| The source does not read as qlang');
  });

  it('writes a failure whose refusal has no page as it is, under the line that says it was raised [QSHST#answer], [QSERR#rest]', async () => {
    const s = captureStreams();
    await main(['::Foo!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('::Foo!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });

  it('writes a failure of the kind of errors, which no site refused, as it is, under the line that says it was raised [QSHST#answer], [QSERR#rest]', async () => {
    const s = captureStreams();
    await main(['!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });
});

describe('main — a query the shell turned into a path', () => {
  const UNDER_MSYS = { MSYSTEM: 'MINGW64' };
  const ROOT_OF_GIT = path => path === 'C:/Program Files/Git/usr/bin/msys-2.0.dll';

  it('reads a query from the slash after the root of MSYS, which the shell wrote before it [QSHST#shell]', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users | segments', UNDER_MSYS, ROOT_OF_GIT)).toBe('/data/users | segments');
  });

  it('leaves a query a shell other than MSYS handed as it came [QSHST#shell]', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users', {}, ROOT_OF_GIT)).toBe('C:/Program Files/Git/data/users');
  });

  it('leaves a path with no runtime of MSYS on its way as it came [QSHST#shell]', () => {
    expect(queryAsWritten('C:/data/users', UNDER_MSYS, () => false)).toBe('C:/data/users');
  });

  it('leaves a query of the language and the absent query of a REPL as they came [QSHST#shell]', () => {
    expect(queryAsWritten('/data/users', UNDER_MSYS, () => true)).toBe('/data/users');
    expect(queryAsWritten(null, UNDER_MSYS, () => true)).toBe(null);
  });

  it('names the shell and the two ways around it when the query begins with a drive', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['C:/Program Files/Git/a'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).toMatch(/the shell turned a query that began with `\/` into a path/);
    expect(s.stderrText()).toMatch(/MSYS_NO_PATHCONV=1/);
  });

  it('adds nothing to the failure of a query of the language', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['(1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).not.toMatch(/the shell turned/);
  });});
