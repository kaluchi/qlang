// The line editor of a terminal and the one of a pipe, which one factory
// makes, run here through streams that hand them bytes and keep what they
// write.

import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { createLineEditor } from '../src/line-editor.mjs';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const SUBMIT = '\r';   // plain Enter (CR), which submits
const NEWLINE = '\n';  // Ctrl+Enter or Ctrl+J, which breaks the line at the cursor

function captureWrites() {
  const chunks = [];
  return {
    write: (text) => chunks.push(text),
    text:  () => chunks.join('')
  };
}

function captureLines(editor) {
  const lines = [];
  let closed = false;
  editor.on('line',  (text) => lines.push(text));
  editor.on('close', () => { closed = true; });
  return { lines, isClosed: () => closed };
}

// ── Non-TTY (piped) editor ─────────────────────────────────────

function makePipedSetup() {
  const stdinStream = new PassThrough();
  stdinStream.isTTY = false;
  const out = captureWrites();
  const editor = createLineEditor(stdinStream, out.write, {
    prompt: 'qlang> ',
    render: (s) => s
  });
  return { stdinStream, editor, out, capture: captureLines(editor) };
}

describe('createLineEditor — non-TTY (piped) mode', () => {
  it('emits one `line` per `\\n`-terminated chunk', async () => {
    const { stdinStream, editor, capture } = makePipedSetup();
    editor.start();
    stdinStream.write('first line\nsecond line\n');
    stdinStream.end();
    await new Promise((r) => setImmediate(r));
    expect(capture.lines).toEqual(['first line', 'second line']);
    expect(capture.isClosed()).toBe(true);
  });

  it('flushes a trailing chunk with no terminating newline before close', async () => {
    const { stdinStream, editor, capture } = makePipedSetup();
    editor.start();
    stdinStream.write('no newline');
    stdinStream.end();
    await new Promise((r) => setImmediate(r));
    expect(capture.lines).toEqual(['no newline']);
  });

  it('writes the prompt on demand', () => {
    const { editor, out } = makePipedSetup();
    editor.prompt();
    expect(out.text()).toBe('qlang> ');
  });

  it('shows a submitted line after the prompt and emits it', () => {
    const { editor, out, capture } = makePipedSetup();
    editor.submit('1 | add 1');
    expect(out.text()).toBe('qlang> 1 | add 1\n');
    expect(capture.lines).toEqual(['1 | add 1']);
  });

  it('removes its data listener on close', () => {
    const { stdinStream, editor } = makePipedSetup();
    editor.start();
    expect(stdinStream.listenerCount('data')).toBe(1);
    editor.close();
    expect(stdinStream.listenerCount('data')).toBe(0);
  });
});

// ── TTY raw-mode editor ────────────────────────────────────────

function makeTtySetup(options = {}) {
  const stdinStream = new PassThrough();
  stdinStream.isTTY = true;
  const rawModeCalls = [];
  stdinStream.setRawMode = (flag) => { rawModeCalls.push(flag); };
  const out = captureWrites();
  const editor = createLineEditor(stdinStream, out.write, {
    prompt: '> ',
    render: (s) => s,
    columns: options.columns
  });
  return { stdinStream, editor, out, rawModeCalls, capture: captureLines(editor) };
}

function feed(stdinStream, ...chunks) {
  for (const c of chunks) {
    stdinStream.write(typeof c === 'string' ? Buffer.from(c) : c);
  }
}

describe('createLineEditor — TTY printable input', () => {
  it('inserts each printable byte and emits the buffer on Enter', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', SUBMIT);
    expect(capture.lines).toEqual(['abc']);
  });

  it('redraws the prompt + buffer after every keystroke', () => {
    const { stdinStream, editor, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'hi');
    // Each character typed repaints the line with its prompt.
    expect((out.text().match(/> /g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('createLineEditor — TTY Enter / Ctrl+Enter semantics', () => {
  it('Ctrl+Enter (LF) inserts a soft newline at the cursor without submitting', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second', SUBMIT);
    expect(capture.lines).toEqual(['first\nsecond']);
  });

  it('Alt+Enter (ESC + CR) submits the buffer as one cell', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second', ESC + '\r');
    expect(capture.lines).toEqual(['first\nsecond']);
  });

  it('Alt+Enter (ESC + LF variant) submits the buffer as one cell', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', ESC + '\n');
    expect(capture.lines).toEqual(['a']);
  });

  it('Enter (CR) submits even after several soft newlines', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b', NEWLINE, 'c', SUBMIT);
    expect(capture.lines).toEqual(['a\nb\nc']);
  });
});

describe('createLineEditor — TTY editing keys', () => {
  it('Backspace removes the char before the cursor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x7f]), SUBMIT);
    expect(capture.lines).toEqual(['ab']);
  });

  it('Backspace at column 0 leaves the buffer untouched', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, Buffer.from([0x7f]), 'x', SUBMIT);
    expect(capture.lines).toEqual(['x']);
  });

  it('Backspace across a soft newline collapses the two rows', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b', Buffer.from([0x7f]), Buffer.from([0x7f]), SUBMIT);
    // The first backspace removes `b` and the second the line break.
    expect(capture.lines).toEqual(['a']);
  });

  it('Left + Backspace removes a char from the middle', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[D', Buffer.from([0x7f]), SUBMIT);
    expect(capture.lines).toEqual(['ac']);
  });

  it('Left past start is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', Buffer.from([0x01]),    // 'a', cursor → 0
                      ESC + '[D', ESC + '[D',       // Left at start
                      SUBMIT);
    expect(capture.lines).toEqual(['a']);
  });

  it('Right past end is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', ESC + '[C', ESC + '[C', SUBMIT);
    expect(capture.lines).toEqual(['a']);
  });

  it('Right inside the buffer advances the cursor one step', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x01]),    // 'abc', cursor → 0
                      ESC + '[C', ESC + '[C',         // cursor → 2
                      'X',                            // 'abXc'
                      SUBMIT);
    expect(capture.lines).toEqual(['abXc']);
  });

  it('Home (Ctrl+A) jumps to start, End (Ctrl+E) jumps back', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x01]), 'X', Buffer.from([0x05]), 'Y', SUBMIT);
    expect(capture.lines).toEqual(['XabcY']);
  });

  it('Home and End via CSI sequences (\\x1b[H, \\x1b[F) work too', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[H', 'X', ESC + '[F', 'Y', SUBMIT);
    expect(capture.lines).toEqual(['XabcY']);
  });

  it('Delete-forward (\\x1b[3~) removes the char under the cursor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[D', ESC + '[D', ESC + '[3~', SUBMIT);
    expect(capture.lines).toEqual(['ac']);
  });

  it('Delete-forward at end of buffer is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[3~', SUBMIT);
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY control bytes', () => {
  it('Ctrl+C clears the current buffer and reprompts', () => {
    const { stdinStream, editor, capture, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x03]), 'xyz', SUBMIT);
    expect(capture.lines).toEqual(['xyz']);
    expect(out.text()).toMatch(/\^C/);
  });

  it('Ctrl+C clears a multi-line buffer and reprompts', () => {
    const { stdinStream, editor, capture, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b', Buffer.from([0x03]), 'x', SUBMIT);
    expect(capture.lines).toEqual(['x']);
    expect(out.text()).toMatch(/\^C/);
  });

  it('Ctrl+C walks the cursor down to the block bottom before printing ^C', () => {
    // With the cursor on the first of two lines, Ctrl+C walks it down one
    // row, `\x1b[1B`, and prints ^C below the buffer.
    const { stdinStream, editor, capture, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b',
                      Buffer.from([0x01]),   // Ctrl+A → cursor to row 0
                      Buffer.from([0x03]),   // Ctrl+C
                      'z', SUBMIT);
    expect(capture.lines).toEqual(['z']);
    expect(out.text()).toMatch(/\x1b\[1B/);
  });

  it('Ctrl+D on an empty buffer closes the editor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, Buffer.from([0x04]));
    expect(capture.isClosed()).toBe(true);
  });

  it('Ctrl+C resets the history navigation index to the latest entry', () => {
    // After Ctrl+C cancels the recalled `one`, the next Up recalls the
    // latest entry, `two`, as after a submit.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'one', SUBMIT,
      'two', SUBMIT,
      ESC + '[A',                  // recall 'two'
      ESC + '[A',                  // recall 'one'
      Buffer.from([0x03]),          // Ctrl+C
      ESC + '[A',                  // Up recalls the latest, 'two'
      SUBMIT);
    expect(capture.lines).toEqual(['one', 'two', 'two']);
  });

  it('Ctrl+C clears per-entry history drafts', () => {
    // The edit `BX` of the recalled `B` is gone after Ctrl+C, and a walk
    // back recalls the stored `B`.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',              // recall 'B', edit to 'BX'
      Buffer.from([0x03]),           // Ctrl+C clears the drafts
      ESC + '[A', SUBMIT);          // Up recalls the stored 'B'
    expect(capture.lines).toEqual(['A', 'B', 'B']);
  });

  it('Ctrl+D with a non-empty buffer is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x04]), SUBMIT);
    expect(capture.isClosed()).toBe(false);
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY escape sequence handling', () => {
  it('drops a half-formed `ESC + non-[` sequence without injecting bytes', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, 'Z', 'a', SUBMIT);
    expect(capture.lines).toEqual(['a']);
  });

  it('ignores unknown CSI sequences without error', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC + '[Z', 'k', SUBMIT);
    expect(capture.lines).toEqual(['k']);
  });
});

describe('createLineEditor — TTY history navigation', () => {
  it('a submitted line is shown, emitted and recalled by Up', () => {
    const { stdinStream, editor, out, capture } = makeTtySetup();
    editor.start();
    editor.submit('first');
    expect(out.text()).toContain('> first\r\n');
    feed(stdinStream, ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['first', 'first']);
  });

  it('Up walks back through submitted cells', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', SUBMIT, 'second', SUBMIT, ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['first', 'second', 'second']);
  });

  it('Up twice walks two entries back', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', SUBMIT, 'second', SUBMIT, ESC + '[A', ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['first', 'second', 'first']);
  });

  it('Up at the oldest entry parks the cursor at the start of the buffer', () => {
    // The first Up recalls `only` with the cursor at its end, and the
    // second, with no older entry, moves the cursor home, where `Z` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'only', SUBMIT, ESC + '[A', ESC + '[A', 'Z', SUBMIT);
    expect(capture.lines).toEqual(['only', 'Zonly']);
  });

  it('Up + Down returns to the in-progress draft', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'history', SUBMIT, 'draft', ESC + '[A', ESC + '[B', SUBMIT);
    expect(capture.lines).toEqual(['history', 'draft']);
  });

  it('Down inside history walks forward to the next stored entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', SUBMIT, 'second', SUBMIT,
                      ESC + '[A', ESC + '[A',  // back to 'first'
                      ESC + '[B',                // forward to 'second'
                      SUBMIT);
    expect(capture.lines).toEqual(['first', 'second', 'second']);
  });

  it('Down at the draft bottom parks the cursor at the end of the buffer', () => {
    // With no history and the cursor home in `x`, Down moves it to the end,
    // where `Y` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'x', Buffer.from([0x01]), ESC + '[B', 'Y', SUBMIT);
    expect(capture.lines).toEqual(['xY']);
  });

  it('preserves edits made inside a recalled cell across further Up/Down', () => {
    // The `X` appended to the recalled `three` survives a walk back to
    // `two` and forward again.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'one', SUBMIT,
      'two', SUBMIT,
      'three', SUBMIT,
      ESC + '[A',                 // recall 'three'
      'X',                         // edited to 'threeX'
      ESC + '[A',                 // walk to 'two' — saves drafts[2]='threeX'
      ESC + '[B',                 // back to drafts[2]
      SUBMIT);
    expect(capture.lines).toEqual(['one', 'two', 'three', 'threeX']);
  });

  it('clears per-entry drafts on submit so the next recall sees the stored entry', () => {
    // After `B` is recalled and edited to `BX` and another cell is
    // submitted, a walk back recalls the stored `B`.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',            // recall 'B', edit to 'BX'
      ESC + '[A',                 // walk to 'A' — drafts[1]='BX'
      SUBMIT,                      // emit 'A'; drafts cleared on submit
      ESC + '[A',                 // recall 'A' (latest history entry)
      ESC + '[A',                 // recall the stored 'B'
      SUBMIT);
    expect(capture.lines).toEqual(['A', 'B', 'A', 'B']);
  });

  it('does not store empty submissions in history', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, SUBMIT, 'real', SUBMIT, ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['', 'real', 'real']);
  });

  it('does not store consecutive duplicates', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'same', SUBMIT, 'same', SUBMIT, ESC + '[A', ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['same', 'same', 'same']);
  });

  it('recalls a multi-line submission with its internal newlines intact', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b', SUBMIT,   // submit 'a\nb'
                      ESC + '[A', SUBMIT);         // recall + submit
    expect(capture.lines).toEqual(['a\nb', 'a\nb']);
  });
});

describe('createLineEditor — TTY multi-line arrow navigation', () => {
  // In a buffer of several lines Up and Down move the cursor across its
  // lines, walk the history from the edge line in their direction, and with
  // no entry that way move the cursor home or to the end.

  it('Up from a lower logical row steps the cursor onto the row above', () => {
    // From the end of `second`, column 6, Up lands at the end of `first`,
    // the column held to its length, where `X` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('Down from an upper logical row steps the cursor onto the row below', () => {
    // From column 0 of `first` Down lands at column 0 of `second`, where
    // `Y` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      Buffer.from([0x01]),  // Ctrl+A → cursor=0, logical row 0
                      ESC + '[B',
                      'Y', SUBMIT);
    expect(capture.lines).toEqual(['first\nYsecond']);
  });

  it('Up on the first logical row of a multi-line buffer recalls the previous history entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'prev', SUBMIT,
                      'a', NEWLINE, 'b',
                      Buffer.from([0x01]),  // Ctrl+A → cursor=0
                      ESC + '[A',
                      SUBMIT);
    expect(capture.lines).toEqual(['prev', 'prev']);
  });

  it('Down on the last logical row of a multi-line buffer recalls the next history entry', () => {
    // Up twice from the draft `first\nsecond` recalls `one`, and Down from
    // it restores the draft whole.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one', SUBMIT,
                      'first', NEWLINE, 'second',
                      ESC + '[A',          // intra-buffer: cursor → end of 'first'
                      ESC + '[A',          // first row + history available → recall 'one'
                      ESC + '[B',          // last row + next history → restore the multi-line draft
                      SUBMIT);
    expect(capture.lines).toEqual(['one', 'first\nsecond']);
  });

  it('keeps a sticky desired column across short intermediate rows', () => {
    // From column 5 of `CCCCC` the first Up lands at the end of `B` and the
    // second at column 5 of `AAAAA`, where `X` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'AAAAA', NEWLINE, 'B', NEWLINE, 'CCCCC',
                      ESC + '[A', ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['AAAAAX\nB\nCCCCC']);
  });

  it('resets the sticky desired column on any horizontal motion', () => {
    // Left and Right after the first Up bring the cursor back to the end of
    // `B` and reset the column, so the next Up lands at column 1 of
    // `AAAAA`, where `X` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'AAAAA', NEWLINE, 'B', NEWLINE, 'CCCCC',
                      ESC + '[A',             // cursor → end of 'B', desiredColumn=5
                      ESC + '[D', ESC + '[C', // Left+Right → resets desiredColumn
                      ESC + '[A',             // Up with local column=1
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['AXAAAA\nB\nCCCCC']);
  });
});

describe('createLineEditor — TTY paste fast-path', () => {
  // A paste lands at the cursor with its line breaks and waits for a submit
  // [D204].

  it('inserts a multi-line chunk into the buffer without auto-submitting', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | /a');
    expect(capture.lines).toEqual([]);
  });

  it('preserves newlines through paste + submit', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | /a', SUBMIT);
    expect(capture.lines).toEqual(['{\n  "a": 1\n} | /a']);
  });

  it('gathers a paste the host hands over in several chunks into one paste [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\r\ntw', 'o\r', '\nthree', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo\nthree']);
  });

  it('ends the gathering at a chunk of one character, Enter handed over alone submitting [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\r\ntw', 'o', '\r', '\nthree', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo', '\nthree']);
  });

  it('ends the gathering at a key spelled by an escape, an arrow moving the cursor [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwXo']);
  });

  it('ends the gathering at Alt+Enter, which submits the paste [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '\r');
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('gathers a paste after the Escape key, which does nothing [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, 'one\r\ntwo', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('reads an escape sequence split after its escape as one key [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC, '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['abXc']);
  });

  it('reads an escape sequence split after its bracket as one key [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[', '1~', 'X', SUBMIT);
    expect(capture.lines).toEqual(['Xabc']);
  });

  it('reads a bracketed paste whose begin marker is split after its escape [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, '[200~one\r\ntwo', BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('reads a chunk that begins with an escape as keys, a line feed in it among them [D204]', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '[Dx\ny', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwx\nyo']);
  });

  it('reads a bracketed paste up to its end marker, a pause past the window inside it [D204]', async () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, BRACKETED_PASTE_BEGIN + 'one\r\ntwo');
    await new Promise((resolve) => setTimeout(resolve, 80));
    feed(stdinStream, 'three\r', '\nfour' + BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['one\ntwothree\nfour']);
  });

  it('strips a trailing newline that the clipboard end-of-block tends to carry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo\n', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('lets the user append further text to a pasted block before submit', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n}', ' | /a', SUBMIT);
    expect(capture.lines).toEqual(['{\n  "a": 1\n} | /a']);
  });

  it('strips BPM markers from a single-chunk wrapped paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, BRACKETED_PASTE_BEGIN + 'a\nb' + BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['a\nb']);
  });

  it('does not trigger the heuristic for fast-typing without newlines', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', SUBMIT);
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY bracketed paste (multi-chunk state machine)', () => {
  // A bracketed paste whose markers and body arrive in chunks of their own
  // is read up to its end marker and lands as one paste.

  it('inserts single-line paste content when markers arrive in separate data events', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
         BRACKETED_PASTE_BEGIN,
         'paste body',
         BRACKETED_PASTE_END,
         SUBMIT);
    expect(capture.lines).toEqual(['paste body']);
  });

  it('appends bracketed-paste content after any pre-paste keystrokes', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'pre-',
         BRACKETED_PASTE_BEGIN,
         'pasted',
         BRACKETED_PASTE_END,
         SUBMIT);
    expect(capture.lines).toEqual(['pre-pasted']);
  });

  it('preserves multi-line content delivered through the BPM state machine', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
         BRACKETED_PASTE_BEGIN,
         'a\nb\nc',
         BRACKETED_PASTE_END,
         SUBMIT);
    expect(capture.lines).toEqual(['a\nb\nc']);
  });
});

describe('createLineEditor — TTY UTF-8 input', () => {
  // The editor decodes the bytes of a terminal as UTF-8, so a character of
  // several bytes, Cyrillic, CJK or an emoji, arrives whole.

  it('inserts a Cyrillic string from a single chunk', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'Привет', SUBMIT);
    expect(capture.lines).toEqual(['Привет']);
  });

  it('reassembles a Cyrillic code point split across two chunks', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    // The two bytes of `П`, 0xD0 and 0x9F, arrive in chunks of their own,
    // and the decoder holds the first until the second.
    const bytes = Buffer.from('П', 'utf8');
    feed(stdinStream, bytes.subarray(0, 1), bytes.subarray(1, 2), SUBMIT);
    expect(capture.lines).toEqual(['П']);
  });

  it('preserves a multi-byte emoji through the insert path', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', SUBMIT);
    expect(capture.lines).toEqual(['🎉']);
  });

  it('preserves Unicode content inside a multi-line paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "имя": "Аня"\n}', SUBMIT);
    expect(capture.lines).toEqual(['{\n  "имя": "Аня"\n}']);
  });
});

describe('createLineEditor — TTY surrogate-pair editing', () => {
  // A character beyond the basic plane, an emoji, is two code units, and
  // every edit steps over the pair as one character.

  it('inserting a surrogate-pair character advances the cursor by both code units', () => {
    // After `🎉` the cursor stands at offset 2, so `X` lands after the
    // emoji.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'X', SUBMIT);
    expect(capture.lines).toEqual(['🎉X']);
  });

  it('backspace removes a surrogate-pair character as one unit', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', Buffer.from([0x7f]), 'A', SUBMIT);
    expect(capture.lines).toEqual(['A']);
  });

  it('delete-forward removes a surrogate-pair character as one unit', () => {
    // From the start of `🎉B` a forward delete leaves `B`.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'B',
                      Buffer.from([0x01]),  // Ctrl+A → cursor=0
                      ESC + '[3~',           // delete-forward
                      SUBMIT);
    expect(capture.lines).toEqual(['B']);
  });

  it('Left arrow skips a surrogate-pair character in one step', () => {
    // Two Lefts from the end of `🎉X` land before the emoji, where `A`
    // goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'X',
                      ESC + '[D', ESC + '[D',
                      'A', SUBMIT);
    expect(capture.lines).toEqual(['A🎉X']);
  });

  it('Right arrow skips a surrogate-pair character in one step', () => {
    // One Right from the start of `🎉X` lands after the emoji, where `A`
    // goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'X',
                      Buffer.from([0x01]),
                      ESC + '[C',
                      'A', SUBMIT);
    expect(capture.lines).toEqual(['🎉AX']);
  });

  it('Up snaps the cursor to a character boundary when the desired column lands mid-surrogate-pair', () => {
    // Up from column 1 of `X` aims inside the pair of `🎉` and lands at
    // column 0, where `Z` goes.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', NEWLINE, 'X',
                      ESC + '[A',
                      'Z', SUBMIT);
    expect(capture.lines).toEqual(['Z🎉\nX']);
  });

  it('round-trips a chain of surrogate-pair characters through repeated backspace without leaving orphans', () => {
    // Three emojis and three backspaces leave an empty buffer.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉🎊🎈',
                      Buffer.from([0x7f]),
                      Buffer.from([0x7f]),
                      Buffer.from([0x7f]),
                      SUBMIT);
    expect(capture.lines).toEqual(['']);
  });
});

describe('createLineEditor — TTY multi-line redraw', () => {
  // The cursor crosses line breaks and the submitted buffer holds the
  // edits, the repaint walking up and back and the submit walking down from
  // a line above the last.

  it('walks Left across a newline, inserts a char in the first row, then submits', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    // Seven Lefts from the end of `first\nsecond` cross the line break, `X`
    // lands at the end of `first`, and the submit fires from the first
    // line.
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[D', ESC + '[D', ESC + '[D', ESC + '[D',
                      ESC + '[D', ESC + '[D', ESC + '[D',
                      'X',
                      SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('accounts for soft-wrap when the logical line overflows a narrow column width', () => {
    // Behind the prompt `> ` a line of ten characters in ten columns wraps
    // onto a second row, and the next repaint walks up to its first row.
    const { stdinStream, editor, capture, out } = makeTtySetup({ columns: 10 });
    editor.start();
    feed(stdinStream, 'abcdefghij', 'K', SUBMIT);
    expect(capture.lines).toEqual(['abcdefghijK']);
    // The repaint walked the cursor up.
    expect(out.text()).toMatch(/\x1b\[\d+A/);
  });
});

describe('createLineEditor — TTY lifecycle', () => {
  it('toggles raw mode on start and clears on close', () => {
    const { editor, rawModeCalls } = makeTtySetup();
    editor.start();
    expect(rawModeCalls).toEqual([true]);
    editor.close();
    expect(rawModeCalls).toEqual([true, false]);
  });

  it('wraps every redraw in synchronized-output and hide/show-cursor escapes', () => {
    // Each repaint opens a block of synchronized output and hides the
    // cursor, and closes both before the next key.
    const { stdinStream, editor, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a');
    expect(out.text()).toContain(ESC + '[?2026h');
    expect(out.text()).toContain(ESC + '[?2026l');
    expect(out.text()).toContain(ESC + '[?25l');
    expect(out.text()).toContain(ESC + '[?25h');
  });

  it('restores the cursor on close so an interrupted teardown does not leave the terminal hidden', () => {
    const { editor, out } = makeTtySetup();
    editor.start();
    editor.close();
    expect(out.text()).toContain(ESC + '[?25h');
  });

  it('writes the bracketed-paste enable + disable escapes around start/close', () => {
    const { editor, out } = makeTtySetup();
    editor.start();
    expect(out.text()).toContain(ESC + '[?2004h');
    editor.close();
    expect(out.text()).toContain(ESC + '[?2004l');
  });

  it('emits `close` when the underlying stream ends', async () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    stdinStream.end();
    await new Promise((r) => setImmediate(r));
    expect(capture.isClosed()).toBe(true);
  });

  it('removes its data listener on close', () => {
    const { stdinStream, editor } = makeTtySetup();
    editor.start();
    expect(stdinStream.listenerCount('data')).toBe(1);
    editor.close();
    expect(stdinStream.listenerCount('data')).toBe(0);
  });

  it('clears a pending paste-accumulator timer on close so the flush does not fire post-shutdown', () => {
    const { stdinStream, editor } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a\nb');
    editor.close();
    expect(stdinStream.listenerCount('data')).toBe(0);
  });
});

describe('createLineEditor — TTY edits at the buffer edges', () => {
  it('backspaces the only character in the buffer', () => {
    // At offset 1 one code unit stands behind the cursor, and the backspace
    // takes it.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', Buffer.from([0x7f]), 'b', SUBMIT);
    expect(capture.lines).toEqual(['b']);
  });

  it('deletes the last character of the buffer', () => {
    // A forward delete on the last character, with no code unit after it,
    // takes one.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'ab', ESC + '[D', ESC + '[3~', SUBMIT);
    expect(capture.lines).toEqual(['a']);
  });

  it('keeps the sticky column across consecutive Up moves', () => {
    // The first Up records the column and the second travels on it.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'aaa', NEWLINE, 'bb', NEWLINE, 'c',
                      ESC + '[A',   // → line 'bb', column 1 recorded
                      ESC + '[A',   // → line 'aaa', same column
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['aXaa\nbb\nc']);
  });

  it('ignores a control byte it binds no editing move to', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', Buffer.from([0x02]), 'b', SUBMIT);
    expect(capture.lines).toEqual(['ab']);
  });

  it('travels back down on the column recorded by the Up moves', () => {
    // Down travels on the column the Up moves recorded.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'aaa', NEWLINE, 'bb', NEWLINE, 'c',
                      ESC + '[A', ESC + '[A',   // → line 'aaa', column 1 recorded
                      ESC + '[B',               // → line 'bb', same column
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['aaa\nbXb\nc']);
  });
});
