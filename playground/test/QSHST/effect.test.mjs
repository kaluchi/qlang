import { describe, it, expect } from 'vitest';
import { runRepl } from '../../src/repl.mjs';
import { runQuery } from '../../src/run.mjs';
import { captureIoContext } from '../helpers/captured-streams.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from '../helpers/cli-error-assertions.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';

it('answers `in` in the REPL with the empty string, the prompt holding standard input', async () => {
  const replHarness = captureRepl('::stdio | in | print | stdio/out\n.exit\n');
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  expect(stripAnsi(replHarness.stdoutText())).toMatch(/""/);
});

it('writes what `out` writes on the standard output the host hands, counting each write', async () => {
  const io = captureIoContext();
  let writesOfOut = 0;
  const cellEntry = await runQuery('"qlang" | stdio/out', { ...io, recordStdoutEffect: () => { writesOfOut += 1; } });
  expect(cellEntry.defect).toBeNull();
  expect(io.stdoutText()).toBe('qlang\n');
  expect(writesOfOut).toBe(1);
});

it('answers `in` with the text of standard input', async () => {
  const io = captureIoContext('hello\nworld');
  const cellEntry = await runQuery('::stdio | in', io);
  expect(cellEntry.defect).toBeNull();
  expect(cellEntry.result).toBe('hello\nworld');
});

describe('out — the subject, written when it is a string', () => {
  it('writes the String subject to stdoutWrite with a trailing newline and is identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"hello" | stdio/out | append "!"', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('hello\n');
    expect(cellEntry.result).toBe('hello!');
  });

  it('refuses a subject that is no string as ::stdio/out/SubjectKindNotTakenError, writing nothing', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | stdio/out', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalRaised(cellEntry, 'stdio/out/SubjectKindNotTakenError', {
      'subject/found': 42
    });
  });
});

describe('out — the text the call gives, computed against the subject', () => {
  it('writes the text the call gives, computed against the subject, and answers the subject', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | stdio/out print', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('42\n');
    expect(cellEntry.result).toBe(42);
  });

  it('refuses a text of another kind by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | stdio/out (add 1)', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalByAddress(cellEntry, 'stdio/out/TextKindNotTakenError', {
      'text/found': 43
    });
  });

  it('answers the error its text answers, as every modifier of a verb does', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"x" | stdio/out (prepend 42)', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalByAddress(cellEntry, 'string/prepend/PrefixKindNotTakenError', {
      'prefix/found': 42
    });
  });
});

describe('err — the subject, written when it is a string', () => {
  it('writes to stderrWrite, leaves stdout untouched, identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"oops" | stdio/err', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stderrText()).toBe('oops\n');
    expect(io.stdoutText()).toBe('');
    expect(cellEntry.result).toBe('oops');
  });

  it('refuses a subject that is no string as ::stdio/err/SubjectKindNotTakenError', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | stdio/err', io);
    expectRefusalRaised(cellEntry, 'stdio/err/SubjectKindNotTakenError', {
      'subject/found': [1, 2, 3]
    });
  });
});

describe('err — the text the call gives, computed against the subject', () => {
  it('writes the text the call gives, computed against the subject, to stderr', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | stdio/err print', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stderrText()).toBe('[1 2 3]\n');
  });

  it('refuses a text of another kind on stderr by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | stdio/err (add 1)', io);
    expectRefusalByAddress(cellEntry, 'stdio/err/TextKindNotTakenError', {
      'text/found': 43
    });
  });
});

describe('stdio/tap', () => {
  it('mirrors pipeValue onto stderr with the labelled prefix and is identity', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | stdio/tap :before-count | count', io);
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(3);
    expect(io.stderrText()).toBe('[tap before-count] [1 2 3]\n');
    expect(io.stdoutText()).toBe('');
  });

  it('refuses a label that is not a keyword by the law of its input', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | stdio/tap "oops"', io);
    expectRefusalByAddress(cellEntry, 'stdio/tap/LabelKindNotTakenError', {
      'label/found': 'oops'
    });
  });

  it('writes the refusal instead of a subject past the budget, the subject kept in a cell beside its tag and the views of its kind, and goes on', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('3000 | range | map ~(get {:id ~(it) :name "user"}) | stdio/tap :big | count', io);
    expect(cellEntry.result).toBe(3000);
    expect(io.stderrText()).toMatch(/^\[tap big\] \|~\| raised, and no !\| caught it\n::qlang\/AnswerBeyondBudgetError::excerpt\{/);
    expect(io.stderrText()).toMatch(/\n {2}:answer ::cell"[0-9a-f]{12}"\n {2}:answer\/tag ::vec\n {2}:answer\/count 3000\n/);
    const [cell] = io.stderrText().match(/::cell"[0-9a-f]{12}"/);
    expect((await runQuery(`${cell} | answer | count`, captureIoContext())).result).toBe(3000);
  });
});
