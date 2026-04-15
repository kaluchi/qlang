// Effectful I/O operand coverage. Each operand is tested through a
// real session evalCell with a captured ioContext, so the dispatch
// path, the per-site error sites, and the side-effect writers are
// all exercised together — the same shape the real bin executes.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectOperandErrorThrown } from './helpers/error-assertions.mjs';

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

describe('@in', () => {
  it('replaces pipeValue with the stdin payload as a String', async () => {
    const io = captureIoContext('hello\nworld');
    const cellEntry = await runQuery('@in', io);
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe('hello\nworld');
  });

  it('feeds an empty string when stdin is empty', async () => {
    const io = captureIoContext('');
    const cellEntry = await runQuery('@in', io);
    expect(cellEntry.result).toBe('');
  });
});

describe('@out — bare form (0 captured)', () => {
  it('writes the String subject to stdoutWrite with a trailing newline and is identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"hello" | @out | append("!")', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stdoutText()).toBe('hello\n');
    expect(cellEntry.result).toBe('hello!');
  });

  it('lifts OutSubjectNotString onto the fail-track when the subject is not a String', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | @out', io);
    expect(io.stdoutText()).toBe('');
    expectOperandErrorThrown(cellEntry, 'OutSubjectNotString', {
      operand: '@out',
      position: 'subject',
      expectedType: 'String',
      actualType: 'Number'
    });
  });
});

describe('@out — full-application form (1 captured)', () => {
  it('runs the renderer against pipeValue and writes its String result', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('42 | @out(pretty)', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stdoutText()).toBe('42\n');
    expect(cellEntry.result).toBe(42);
  });

  it('lifts OutRendererResultNotString when the renderer returns a non-String value', async () => {
    const io = captureIoContext();
    // `add(1)` against a String subject lifts an error inside the
    // renderer lambda — the renderer's resolved value is therefore
    // an error value, not a string. @out's renderer-result type
    // check fires.
    const cellEntry = await runQuery('"x" | @out(add(1))', io);
    expect(io.stdoutText()).toBe('');
    expectOperandErrorThrown(cellEntry, 'OutRendererResultNotString', {
      actualType: 'Error'
    });
  });
});

describe('@err — bare form', () => {
  it('writes to stderrWrite, leaves stdout untouched, identity on pipeValue', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"oops" | @err', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stderrText()).toBe('oops\n');
    expect(io.stdoutText()).toBe('');
    expect(cellEntry.result).toBe('oops');
  });

  it('lifts ErrSubjectNotString onto the fail-track when the subject is not a String', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | @err', io);
    expectOperandErrorThrown(cellEntry, 'ErrSubjectNotString', {
      operand: '@err',
      position: 'subject',
      expectedType: 'String',
      actualType: 'Vec'
    });
  });
});

describe('@err — full-application form', () => {
  it('runs the renderer and writes the result to stderr', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | @err(pretty)', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stderrText()).toBe('[1 2 3]\n');
  });

  it('lifts ErrRendererResultNotString when the renderer returns a non-String', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"x" | @err(add(1))', io);
    expectOperandErrorThrown(cellEntry, 'ErrRendererResultNotString', {
      actualType: 'Error'
    });
  });
});

describe('@tap', () => {
  it('mirrors pipeValue onto stderr with the labelled prefix and is identity', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | @tap(:before-count) | count', io);
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(3);
    expect(io.stderrText()).toBe('[tap before-count] [1 2 3]\n');
    expect(io.stdoutText()).toBe('');
  });

  it('lifts TapLabelNotKeyword onto the fail-track when the label is not a keyword', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('[1 2 3] | @tap("oops")', io);
    expectOperandErrorThrown(cellEntry, 'TapLabelNotKeyword', {
      operand: '@tap',
      position: 1,
      expectedType: 'Keyword',
      actualType: 'String'
    });
  });
});
