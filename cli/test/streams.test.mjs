// The coverage of the effectful verbs of the streams. Each is tested
// through a real session evalCell with a captured ioContext, so the dispatch
// path, the per-site error sites, and the side-effect writers are
// all exercised together — as the real bin runs them.
// The rules it holds: [QSHST#effect].

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from './helpers/error-assertions.mjs';

function captureIoContext(stdinPayload = '') {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    stdinReader: () => Promise.resolve(stdinPayload),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('in', () => {
  it('replaces pipeValue with the stdin payload as a String', async () => {
    const io = captureIoContext('hello\nworld');
    const cellEntry = await runQuery('in', io);
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe('hello\nworld');
  });

  it('feeds an empty string when stdin is empty', async () => {
    const io = captureIoContext('');
    const cellEntry = await runQuery('in', io);
    expect(cellEntry.result).toBe('');
  });
});

describe('out — the subject, written when it is a string', () => {
  it('writes the String subject to stdoutWrite with a trailing newline and is identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"hello" | out | append "!"', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('hello\n');
    expect(cellEntry.result).toBe('hello!');
  });

  it('refuses a subject that is no string as ::any/out/SubjectNotStringError, writing nothing', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | out', io);
    expect(io.stdoutText()).toBe('');
    expectRefusalRaised(cellEntry, 'any/out/SubjectNotStringError', {
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

  it('refuses a subject that is no string as ::any/err/SubjectNotStringError', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | err', io);
    expectRefusalRaised(cellEntry, 'any/err/SubjectNotStringError', {
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
});
