import { describe, it, expect } from 'vitest';
import { parseArgv } from '../../src/argv.mjs';
import { main } from '../../src/main.mjs';
import { renderCellOutcome, answerText } from '../../src/render.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import { captureStreams, makeCellEntry } from '../helpers/main-streams.mjs';

describe('the arguments of the command line', () => {
  it('returns a usageError cliInvocation for an empty argv slice', () => {
    const cliInvocation = parseArgv([]);
    expect(cliInvocation.kind).toBe('usageError');
    expect(cliInvocation.message).toMatch(/missing query/);
  });

  it('reads -h as the query of the page of the command line', () => {
    expect(parseArgv(['-h'])).toEqual({ kind: 'evalQuery', queryText: '::cli | doc', colorMode: 'auto', failureExitCode: 0 });
  });

  it('reads --help as -h, the flags before it holding', () => {
    expect(parseArgv(['--color=never', '--help'])).toEqual({ kind: 'evalQuery', queryText: '::cli | doc', colorMode: 'never', failureExitCode: 0 });
  });

  it('recognises -V as the short version flag', () => {
    expect(parseArgv(['-V'])).toEqual({ kind: 'version' });
  });

  it('recognises --version as the long version flag', () => {
    expect(parseArgv(['--version'])).toEqual({ kind: 'version' });
  });

  it('recognises -i as the short repl flag', () => {
    expect(parseArgv(['-i'])).toEqual({ kind: 'repl', initialQuery: null });
  });

  it('recognises --repl as the long repl flag', () => {
    expect(parseArgv(['--repl'])).toEqual({ kind: 'repl', initialQuery: null });
  });

  it('reads the first argument that is no flag as the query, standard input read by its default', () => {
    const cliInvocation = parseArgv(['[1 2 3] | count']);
    expect(cliInvocation).toEqual({
      kind: 'evalQuery',
      queryText: '[1 2 3] | count',
      colorMode: 'auto',
      failureExitCode: 0
    });
  });

  it('refuses an argument after the query, a flag written there among them, which nothing would read', () => {
    expect(parseArgv(['1 | add 2', '--fail'])).toEqual({
      kind: 'usageError',
      message: "qlang: '--fail' after the query is read by nothing: the flags stand before the query, which is one argument, `qlang [flags] '<query>'`\n"
    });
    expect(parseArgv(['-i', '1 | add 2', '2']).kind).toBe('usageError');
  });

  it('rejects --color with an unknown value as a usageError', () => {
    const result = parseArgv(['--color=rainbow', '42']);
    expect(result.kind).toBe('usageError');
    expect(result.message).toMatch(/--color expects auto \/ always \/ never/);
  });

  it('refuses a flag the command line takes not, a budget among them, which no flag sets', () => {
    expect(parseArgv(['--budget=4000', '42'])).toEqual({
      kind: 'usageError',
      message: 'qlang: --budget=4000 is no flag of the command line, which `qlang --help` lists\n'
    });
    expect(parseArgv(['-i', '--budget=500']).kind).toBe('usageError');
  });

  it('refuses --json, JSON read by `in | parseJson`', () => {
    expect(parseArgv(['--json', 'get /a']).message).toBe('qlang: --json is no flag of the command line, which `qlang --help` lists\n');
  });

  it('refuses --raw, a text read as it came by `in`', () => {
    expect(parseArgv(['--raw', 'count']).message).toBe('qlang: --raw is no flag of the command line, which `qlang --help` lists\n');
  });

  it('parses --fail as the code 1 a failure exits with', () => {
    expect(parseArgv(['--fail', 'count'])).toEqual({
      kind: 'evalQuery',
      queryText: 'count',
      colorMode: 'auto',
      failureExitCode: 1
    });
  });

  it('takes the query after -i as the first cell of the REPL', () => {
    expect(parseArgv(['-i', '::qlang | doc'])).toEqual({ kind: 'repl', initialQuery: '::qlang | doc' });
  });

  it('reads a flag after -i as a flag, the query after it as the first cell', () => {
    expect(parseArgv(['-i', '--color=never', '::qlang | doc'])).toEqual({ kind: 'repl', initialQuery: '::qlang | doc' });
  });

  it('reports a usageError when only a flag is supplied without a query', () => {
    const cliInvocation = parseArgv(['--fail']);
    expect(cliInvocation.kind).toBe('usageError');
    expect(cliInvocation.message).toMatch(/missing query/);
  });
});

describe('the page, the version, the REPL and a call with no query', () => {
  it('prints on --help the page of the command line as `::cli | doc` answers it, exit 0', async () => {
    const [help, page] = [captureStreams(), captureStreams()];
    const exitCode = await main(['--help'], help.stdinStream, help.stdoutStream, help.stderrStream, {});
    await main(['::cli | doc'], page.stdinStream, page.stdoutStream, page.stderrStream, {});
    expect([exitCode, help.stdoutText(), help.stderrText()]).toEqual([0, page.stdoutText(), '']);
    expect(help.stdoutText()).toContain('Usage:');
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

describe('the code a failure exits with under --fail', () => {
  it('exits a failure with 1 and writes its alert on stdout', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '"x" | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toContain('::number/add/SubjectNotNumberError!{');
    expect(s.stderrText()).toBe('');
  });

  it('exits a value with 0', async () => {
    const s = captureStreams();
    const exitCode = await main(['--fail', '1 | add 1'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });
});

describe('the answer written as the language prints it, whatever standard input held', () => {
  it('feeds piped JSON as the initial pipeValue and writes a string answer as its text', async () => {
    const s = captureStreams('{"user": {"name": "alice"}}');
    const exitCode = await main(
      ['get /user/name'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('alice\n');
    expect(s.stderrText()).toBe('');
  });

  it('prints a map read from JSON on stdin as its literal', async () => {
    const s = captureStreams('{"a": {"b": 1, "c": 2}}');
    const exitCode = await main(
      ['get /a'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{:b 1 :c 2}\n');
  });

  it('prints a kind asked of a JSON subject, which JSON has no form for', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['type'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('::map\n');
  });

  it('writes JSON text for a query that ends in `| json`', async () => {
    const s = captureStreams('{"a": [1, 2]}');
    await main(['get /a | json'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('[1,2]\n');
  });

  it('prints the count of a JSON subject as its literal', async () => {
    const s = captureStreams('[1, 2, 3]');
    const exitCode = await main(
      ['count'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
  });
});

it('writes what `out` writes and leaves the answer of the query unwritten', async () => {
  const s = captureStreams();
  const exitCode = await main(
    ['[1 2 3] | count | print | out'],
    s.stdinStream, s.stdoutStream, s.stderrStream, {}
  );
  expect(exitCode).toBe(0);
  expect(s.stdoutText()).toBe('3\n');
  expect(s.stderrText()).toBe('');
});

describe('a failure written on stdout and a defect on stderr', () => {
  it('writes a query that does not parse as its failure on stdout, its caret drawn below it, with exit 0 as every answer', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
    expect(s.stdoutText()).toContain(':source "[1 2"');
    expect(s.stdoutText()).toContain(':location ::span[4 1 5 4 1 5]');
    expect(s.stdoutText()).toContain('}\n|~| [1 2\n|~|     ^\n|~| The source does not read as qlang');
  });

  it('writes a defect raised past the fail track on stderr as `qlang:` and its message, with the code 1', async () => {
    const s = captureStreams();
    const exitCode = await main(['['.repeat(20000) + ']'.repeat(20000)], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect([exitCode, s.stdoutText(), s.stderrText()]).toEqual([1, '', 'qlang: Maximum call stack size exceeded\n']);
  });

  it('writes a failure on stdout as every answer, exit 0', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | add 1'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('number/add/SubjectNotNumberError');
    expect(s.stderrText()).toBe('');
  });

  it('writes a failure with the prose of its refusal\'s page below it, as line comments', async () => {
    const s = captureStreams();
    await main(['{:a 1} | get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.length).toBeGreaterThan(1);
    expect(commentLines.every(line => line.length <= 72)).toBe(true);
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('writes a failure on a JSON subject as its alert with the prose of its page', async () => {
    const s = captureStreams('{"a": 1}');
    await main(['| get /b'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toMatch(/^\|~\| raised, and no !\| caught it\n::path\/KeyNotInMapError!\{/);
    const commentLines = s.stdoutText().split('\n').filter(line => line.startsWith('|~| '));
    expect(commentLines.map(line => line.slice('|~| '.length)).join(' ')).toContain('a key that may be absent is read by `query`');
  });

  it('writes a query that does not parse under the line that says it was raised, as any failure', async () => {
    const s = captureStreams();
    await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('|~| raised, and no !| caught it');
  });

  it('writes a failure whose refusal has no page as it is, under the line that says it was raised', async () => {
    const s = captureStreams();
    await main(['::Foo!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('::Foo!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });

  it('writes a failure of the kind of errors, which no site refused, as it is, under the line that says it was raised', async () => {
    const s = captureStreams();
    await main(['!{:a 1} | raise'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toContain('!{');
    expect(s.stdoutText().split('\n').filter(line => line.startsWith('|~|'))).toEqual(['|~| raised, and no !| caught it']);
  });
});

const refusalOfAdd = () => evalQuery('"x" | add 1');

describe('a defect raised as the answer is written, and a failure written as every answer', () => {
  it('writes a defect raised past the fail track on stderr as `qlang:` and its message, with exit 1', async () => {
    const cellEntry = await makeCellEntry({ defect: new Error('the host broke') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: the host broke\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('writes a defect the printer raises on the answer on stderr as `qlang:` and its message, with exit 1', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: Infinity }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome).toEqual({ stdoutText: '', stderrText: 'qlang: the core met number Infinity, a value of no kind of the language\n', exitCode: 1 });
  });

  it('writes a failure on stdout as every answer, exit 0', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toContain('::number/add/SubjectNotNumberError!{');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('the code the caller asks a failure to exit with', () => {
  it('exits a failure with the code the caller asks for, written as without it', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toContain('::number/add/SubjectNotNumberError!{');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a failure the query left unwritten by `out` with that code too', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: true,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a value with 0 whatever code a failure takes', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: 'hello' }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('hello\n');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('the answer as the language prints it, and none after `out`', () => {
  it('prints a non-String composite as its literal', async () => {
    const result = new Map([['k', 1]]);
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('{:k 1}\n');
    expect(cliOutcome.exitCode).toBe(0);
  });

  it('writes no answer for a query that wrote by `out`, which holds the channel', async () => {
    const cliOutcome = await renderCellOutcome(
      await makeCellEntry({ result: 'hello' }),
      { didExplicitStdoutEffect: true, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

it('writes a string as its text where the caller asks for colour, which no colour paints as code', async () => {
  const cliOutcome = await renderCellOutcome(
    await makeCellEntry({ result: 'hello | world' }),
    { didExplicitStdoutEffect: false, shouldColorize: true }
  );
  expect(cliOutcome.stdoutText).toBe('hello | world\n');
});

describe('the text written for an answer', () => {
  it('prints a keyword, a set, a tag and a quote as their literals', async () => {
    expect(await answerText(await evalQuery('[:v #[2 1] ::vec ~(add 1) "s"]'), await langRuntime()))
      .toBe('[:v #[1 2] ::vec ~(add 1) "s"]');
  });

  it('writes a string as its text, so `| json` writes JSON text', async () => {
    expect(await answerText('hi', await langRuntime())).toBe('hi');
    expect(await answerText(await evalQuery('{:a [1 :k #[2]]} | json'), await langRuntime())).toBe('{"a":[1,"k",[2]]}');
  });

  it('writes a failure as its error at rest under the line that says it was raised, and `!| json` as JSON text', async () => {
    const scope = await langRuntime();
    expect(await answerText(await evalQuery('"x" | add 1'), scope)).toMatch(/^\|~\| raised, and no !\| caught it\n::number\/add\/SubjectNotNumberError!\{[\s\S]*\}$/);
    expect(JSON.parse(await answerText(await evalQuery('"x" | add 1 !| json'), scope)).$tag).toBe('number/add/SubjectNotNumberError');
  });
});

describe('an answer past the budget', () => {
  const past = '3000 | range | map ~(get {:id ~(it) :name "user"})';

  it('exits an answer past the budget as every failure exits, with the code the caller asks for', async () => {
    const scope = await langRuntime();
    const cellEntry = await makeCellEntry({ result: await evalQuery(past, scope), scope });
    expect((await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: false })).exitCode).toBe(0);
    const failing = await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: false, failureExitCode: 1 });
    expect([failing.exitCode, failing.stdoutText.includes('::qlang/AnswerBeyondBudgetError')]).toEqual([1, true]);
  });

  it('paints a string past the budget as the alert of its refusal, which is code', async () => {
    const cellEntry = await makeCellEntry({ result: 'x'.repeat(16001) });
    const painted = await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: true });
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(painted.stdoutText).toMatch(/\x1b\[/);
  });

  it('writes nothing and raises no refusal for a query that wrote by out, its code the one its answer exits with', async () => {
    const scope = await langRuntime();
    const cellEntry = await makeCellEntry({ result: await evalQuery(past, scope), scope });
    expect(await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: true, shouldColorize: false, failureExitCode: 1 })).toEqual({ stdoutText: '', stderrText: '', exitCode: 0 });
  });
});
