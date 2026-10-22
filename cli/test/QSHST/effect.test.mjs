import { describe, it, expect } from 'vitest';
import { runRepl } from '../../src/repl.mjs';
import { runQuery } from '../../src/run.mjs';
import { captureIoContext } from '../helpers/captured-streams.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from '../helpers/error-assertions.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';

it('answers `in` in the REPL with the empty string, the prompt holding standard input', async () => {
  const replHarness = captureRepl('in | print | out\n.exit\n');
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  // `in` answers the empty string, whose literal `""` `print` makes and `out` writes on stdout.
  expect(stripAnsi(replHarness.stdoutText())).toMatch(/""/);
});

it('writes what `out` writes on the standard output the host hands, counting each write', async () => {
  const io = captureIoContext();
  let writesOfOut = 0;
  const cellEntry = await runQuery('"qlang" | out', { ...io, recordStdoutEffect: () => { writesOfOut += 1; } });
  expect(cellEntry.defect).toBeNull();
  expect(io.stdoutText()).toBe('qlang\n');
  expect(writesOfOut).toBe(1);
});

it('answers `in` with the text of standard input', async () => {
  const io = captureIoContext('hello\nworld');
  const cellEntry = await runQuery('in', io);
  expect(cellEntry.defect).toBeNull();
  expect(cellEntry.result).toBe('hello\nworld');
});

describe('out — the subject, written when it is a string', () => {
  it('writes the String subject to stdoutWrite with a trailing newline and is identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"hello" | out | append "!"', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('hello\n');
    expect(cellEntry.result).toBe('hello!');
  });

  it('refuses a subject that is no string as ::any/out/SubjectKindNotTakenError, writing nothing', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | out', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalRaised(cellEntry, 'any/out/SubjectKindNotTakenError', {
      actualType: { name: 'number' }
    });
  });
});

describe('out — the text the call gives, computed against the subject', () => {
  it('writes the text the call gives, computed against the subject, and answers the subject', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | out print', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('42\n');
    expect(cellEntry.result).toBe(42);
  });

  it('refuses a text of another kind by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | out (add 1)', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalByAddress(cellEntry, 'any/out/text/KindNotTakenError', {
      actualType: { name: 'number' }
    });
  });

  it('answers the error its text answers, as every modifier of a verb does', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"x" | out (prepend 42)', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalByAddress(cellEntry, 'string/prepend/prefix/KindNotTakenError', {
      actualType: { name: 'number' }
    });
  });
});

describe('err — the subject, written when it is a string', () => {
  it('writes to stderrWrite, leaves stdout untouched, identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"oops" | err', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stderrText()).toBe('oops\n');
    expect(io.stdoutText()).toBe('');
    expect(cellEntry.result).toBe('oops');
  });

  it('refuses a subject that is no string as ::any/err/SubjectKindNotTakenError', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | err', io);
    expectRefusalRaised(cellEntry, 'any/err/SubjectKindNotTakenError', {
      actualType: { name: 'vec' }
    });
  });
});

describe('err — the text the call gives, computed against the subject', () => {
  it('writes the text the call gives, computed against the subject, to stderr', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | err print', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stderrText()).toBe('[1 2 3]\n');
  });

  it('refuses a text of another kind on stderr by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | err (add 1)', io);
    expectRefusalByAddress(cellEntry, 'any/err/text/KindNotTakenError', {
      actualType: { name: 'number' }
    });
  });
});

describe('tap', () => {
  it('mirrors pipeValue onto stderr with the labelled prefix and is identity', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | tap :before-count | count', io);
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(3);
    expect(io.stderrText()).toBe('[tap before-count] [1 2 3]\n');
    expect(io.stdoutText()).toBe('');
  });

  it('refuses a label that is not a keyword by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | tap "oops"', io);
    expectRefusalByAddress(cellEntry, 'any/tap/label/KindNotTakenError', {
      actualType: { name: 'string' }
    });
  });

  it('writes its subject as an answer prints, the print a kind declares among it', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery(':Box |~~ B ~~| | :Box/print ~("box") | [::Box#1] | tap :x | count', io);
    expect(cellEntry.result).toBe(1);
    expect(io.stderrText()).toBe('[tap x] [box]\n');
  });

  it('writes the refusal in the place of a subject past the budget, its reads continuing from the subject, and goes on', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('3000 | range | map ~(get {:id ~(it) :name "user"}) | tap :big | count', io);
    expect(cellEntry.result).toBe(3000);
    expect(io.stderrText()).toMatch(/^\[tap big\] \|~\| raised, and no !\| caught it\n::qlang\/AnswerBeyondBudgetError!\{/);
    expect(io.stderrText()).toContain(':read ~(drop ');
  });
});
