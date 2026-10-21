// main, the command line run on the streams handed to it: each kind of
// invocation in its branch, the subject standard input lifts to, JSON as
// values and any other text as one string, the answer printed as the language
// prints it, a string as its text, `out` holding the channel, and standard
// input read only for a query that reads its subject [QSHST#answer], [QSHST#stdin].
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

  it('[QSHST#repl] --color=always wins over a non-TTY stream', () => {
    expect(resolveShouldColorize('always', pipeOut, {})).toBe(true);
  });

  it('[QSHST#repl] --color=never wins over a TTY stream', () => {
    expect(resolveShouldColorize('never', ttyOut, {})).toBe(false);
  });

  it('[QSHST#repl] FORCE_COLOR=1 forces paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '1' })).toBe(true);
  });

  it('[QSHST#repl] FORCE_COLOR=0 falls through to TTY check (not truthy as a flag)', () => {
    expect(resolveShouldColorize('auto', pipeOut, { FORCE_COLOR: '0' })).toBe(false);
    expect(resolveShouldColorize('auto', ttyOut, { FORCE_COLOR: '0' })).toBe(true);
  });

  it('[QSHST#repl] NO_COLOR=1 disables paint when --color=auto', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '1' })).toBe(false);
  });

  it('[QSHST#repl] NO_COLOR=empty falls through to TTY check', () => {
    expect(resolveShouldColorize('auto', ttyOut, { NO_COLOR: '' })).toBe(true);
  });

  it('[QSHST#repl] --color=auto with no env defers to TTY detection — TTY → true', () => {
    expect(resolveShouldColorize('auto', ttyOut, {})).toBe(true);
  });

  it('[QSHST#repl] --color=auto with no env defers to TTY detection — non-TTY → false', () => {
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
  it('[QSHST#answer] prints on --help the page of the command line as `::cli | doc` answers it, exit 0', async () => {
    const [help, page] = [captureStreams(), captureStreams()];
    const exitCode = await main(['--help'], help.stdinStream, help.stdoutStream, help.stderrStream, {});
    await main(['::cli | doc'], page.stdinStream, page.stdoutStream, page.stderrStream, {});
    expect([exitCode, help.stdoutText(), help.stderrText()]).toEqual([0, page.stdoutText(), '']);
    expect(help.stdoutText()).toContain('Usage:');
  });

  it('[QSHST#answer] returns exit 0 and writes the version line on --version', async () => {
    const s = captureStreams();
    const exitCode = await main(['--version'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/@kaluchi\/qlang-cli/);
    expect(s.stderrText()).toBe('');
  });

  it('[QSHST#answer] returns exit 2 and writes a usage hint on an empty argv slice', async () => {
    const s = captureStreams();
    const exitCode = await main([], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(2);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toMatch(/missing query/);
  });

  it('[QSHST#answer] dispatches `--repl` into the line-editor REPL and exits cleanly on `.exit`', async () => {
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
// which a shell may hand open with nothing piped [QSHST#stdin].
describe('main — standard input read for a query that reads its subject', () => {
  const openStdin = () => Object.assign(new Readable({ read() {} }), { isTTY: false });

  it('[QSHST#stdin] answers a query that reads no subject over a stdin that never ends', async () => {
    const s = captureStreams();
    const exitCode = await main(['1 | add 1'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });

  it('[QSHST#stdin] reads stdin when `in` is called by a query that reads no subject', async () => {
    const s = captureStreams('piped text');
    await main(['"x" | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('piped text\n');
  });

  it('[QSHST#stdin] lifts nothing for a query headed by `in`, called by its name or its address, which reads the text as it came', async () => {
    for (const query of ['in | count', 'any/in | count']) {
      const s = captureStreams('[1e400]');
      await main([query], s.stdinStream, s.stdoutStream, s.stderrStream, {});
      expect(s.stdoutText(), query).toBe('7\n');
    }
  });

  it('[QSHST#stdin] lifts the subject for a query headed by a step of the fail track, which runs on a failure alone', async () => {
    for (const query of ['!| in | count', '!| 5 | count']) {
      const s = captureStreams('[1,2,3]');
      await main([query], s.stdinStream, s.stdoutStream, s.stderrStream, {});
      expect(s.stdoutText(), query).toBe('3\n');
    }
  });

  it('[QSHST#stdin] lifts the subject for `in` called by its name where the query declared a verb of that name before it', async () => {
    const s = captureStreams('[1,2,3]');
    await main([':vec/in ~(count) | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('3\n');
  });

  it('[QSHST#stdin] reads stdin once for the subject and for `in`', async () => {
    const s = captureStreams('hello world');
    await main(['count | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('hello world\n');
  });

  it('[QSHST#stdin] refuses a query that does not parse without reading stdin', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
  });
});

// `--fail` gives a failure the code 1, written as without it, and a
// value the code 0 [QSHST#answer].
describe('main — the code a failure exits with under --fail', () => {
  it('[QSHST#answer] exits a failure with 1 and writes its alert on stdout', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '"x" | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toContain('::number/add/SubjectNotNumberError!{');
    expect(s.stderrText()).toBe('');
  });

  it('[QSHST#answer] exits a value with 0', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '1 | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });
});

describe('main — the subject standard input lifts to', () => {
  it('[QSHST#stdin] starts from the noun of the language, `::qlang`, when stdin carries no bytes', async () => {
    const s = captureStreams();
    const exitCode = await main(['eq ::qlang'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('true\n');
  });

  it('[QSHST#answer] feeds piped JSON as the initial pipeValue and writes a string answer as its text', async () => {
    const s = captureStreams('{"user": {"name": "alice"}}');
    const exitCode = await main(
      ['get /user/name'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('alice\n');
    expect(s.stderrText()).toBe('');
  });

  it('[QSHST#answer] prints a map read from JSON on stdin as its literal', async () => {
    const s = captureStreams('{"a": {"b": 1, "c": 2}}');
    const exitCode = await main(
      ['get /a'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{:b 1 :c 2}\n');
  });

  it('[QSHST#answer] prints a kind asked of a JSON subject, which JSON has no form for', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['type'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('::map\n');
  });

  it('[QSHST#answer] writes JSON text for a query that ends in `| json`', async () => {
    const s = captureStreams('{"a": [1, 2]}');
    await main(['get /a | json'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('[1,2]\n');
  });

  it('[QSHST#answer] prints the count of a JSON subject as its literal', async () => {
    const s = captureStreams('[1, 2, 3]');
    const exitCode = await main(
      ['count'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
  });

  it('[QSHST#stdin] reads stdin that is no JSON as one string', async () => {
    const s = captureStreams('plain text');
    const exitCode = await main(
      ['append " world"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('plain text world\n');
  });

  it('[QSHST#stdin] uses raw mode on --raw whatever stdin holds', async () => {
    // Standard input reads as JSON, and `--raw` reads it as a string [QSHST#stdin].
    const s = captureStreams('{"a":1}');
    const exitCode = await main(
      ['--raw', 'append " done"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{"a":1} done\n');
  });
});

describe('main — `out` holding the channel', () => {
  it('[QSHST#answer] writes what `out` writes and leaves the answer of the query unwritten', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count | print | out'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    // `out` writes `3`, and the answer, the string `print` made, is not written after it.
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });
});

describe('main — error paths', () => {
  it('[QSHST#answer] writes a query that does not parse as its failure on stdout, its caret drawn below it, with exit 0 as every answer', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    // The failure as the language prints it holds the line and the span of
    // the place, and the command line draws the caret under the line.
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stdoutText()).toContain(':source "[1 2"');
    expect(s.stdoutText()).toContain(':location ::span[4 1 5 4 1 5]');
    expect(s.stdoutText()).toContain('}\n|~| [1 2\n|~|     ^\n|~| The source does not read as qlang');
  });

  it('[QSHST#answer] writes a defect raised past the fail track on stderr as `qlang:` and its message, with the code 1', async () => {
    // A literal nested past the stack the parser reads it with raises a defect past the fail track.
    const s = captureStreams();
    const exitCode = await main(['['.repeat(20000) + ']'.repeat(20000)], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect([exitCode, s.stdoutText(), s.stderrText()]).toEqual([1, '', 'qlang: Maximum call stack size exceeded\n']);
  });

  it('[QSHST#stdin] answers a stdin magnitude outside the finite-double domain as parseJson refuses it, naming the path', async () => {
    // The answer is the refusal `parseJson` gives the text, its `:path` the path to the number [QSPRN#json].
    const s = captureStreams('{"big": 1e400, "n": 1}');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).toContain(':path /big');
  });

  it('[QSHST#stdin] hands the query a refusal of the lift as the failure it starts from, which its steps pass by and `!|` catches', async () => {
    const s = captureStreams('[1e400]');
    await main(['count !| get /trace/0/0'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('[1e400]\n');
  });

  it('[QSHST#stdin] answers a bare out-of-range magnitude with no path', async () => {
    const s = captureStreams('1e400');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).not.toMatch(/^ +:path /m);
  });

  it('[QSHST#answer] writes a failure on stdout as every answer, exit 0', async () => {
    // Without `--fail` a failure is an answer on the channel of every answer with exit 0, a nonzero exit kept for a defect and a call with no query [QSHST#answer].
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | add 1'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('number/add/SubjectNotNumberError');
    expect(s.stderrText()).toBe('');
  });

  it('[QSHST#answer] writes a failure with the prose of its refusal\'s page below it, as line comments', async () => {
    const s = captureStreams();
    await main(['{:a 1} | get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.length).toBeGreaterThan(1);
    expect(commentLines.every(line => line.length <= 72)).toBe(true);
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('[QSHST#answer] writes a failure on a JSON subject as its alert with the prose of its page', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['| get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toMatch(/^\|~\| raised, and no !\| caught it\n::path\/KeyNotInMapError!\{/);
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('[QSHST#answer] writes a query that does not parse under the line that says it was raised, as any failure', async () => {
    const s = captureStreams();
    await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('|~| raised, and no !| caught it');
  });

  it('[QSHST#answer] writes a failure whose refusal has no page as it is, under the line that says it was raised', async () => {
    const s = captureStreams();
    await main(['::Foo!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('::Foo!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });

  it('[QSHST#answer] writes a failure of the kind of errors, which no site refused, as it is, under the line that says it was raised', async () => {
    const s = captureStreams();
    await main(['!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });
});

describe('main — a query the shell turned into a path', () => {
  const UNDER_MSYS = { MSYSTEM: 'MINGW64' };
  const ROOT_OF_GIT = path => path === 'C:/Program Files/Git/usr/bin/msys-2.0.dll';

  it('[QSHST#shell] reads a query from the slash after the root of MSYS, which the shell wrote before it', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users | segments', UNDER_MSYS, ROOT_OF_GIT)).toBe('/data/users | segments');
  });

  it('[QSHST#shell] leaves a query a shell other than MSYS handed as it came', () => {
    expect(queryAsWritten('C:/Program Files/Git/data/users', {}, ROOT_OF_GIT)).toBe('C:/Program Files/Git/data/users');
  });

  it('[QSHST#shell] leaves a path with no runtime of MSYS on its way as it came', () => {
    expect(queryAsWritten('C:/data/users', UNDER_MSYS, () => false)).toBe('C:/data/users');
  });

  it('[QSHST#shell] leaves a query of the language, and no query where a REPL starts without one, as they came', () => {
    expect(queryAsWritten('/data/users', UNDER_MSYS, () => true)).toBe('/data/users');
    expect(queryAsWritten(null, UNDER_MSYS, () => true)).toBe(null);
  });

  it('[QSHST#shell] names the shell and the two ways around it when the query begins with a drive', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['C:/Program Files/Git/a'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).toMatch(/the shell turned a query that began with `\/` into a path/);
    expect(s.stderrText()).toContain("`qlang 'get /data/users'`");
    expect(s.stderrText()).toMatch(/MSYS_NO_PATHCONV=1/);
  });

  it('[QSHST#shell] adds nothing to the failure of a query of the language', async () => {
    const s = captureStreams('{"a": 1}');
    const exitCode = await main(['(1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stderrText()).not.toMatch(/the shell turned/);
  });});
