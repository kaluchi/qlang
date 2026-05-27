// line-editor coverage. Two flavours of the editor (TTY raw mode
// vs piped line-buffered) sit behind one factory; both code paths
// run end-to-end through PassThrough stream stubs that emit byte
// buffers and capture stdout writes.

import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { createLineEditor } from '../src/line-editor.mjs';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const SUBMIT = '\r';   // plain Enter (CR) — the submit keystroke (PowerShell parity)
const NEWLINE = '\n';  // Ctrl+Enter / Ctrl+J — soft newline at cursor

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
  it('emits one ~{line} per ~{\\n}-terminated chunk', async () => {
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
    // After each redraw the prompt appears anew. Two characters →
    // at least two prompt occurrences in the captured output.
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
    // 'a\nb' → backspace removes 'b'; second backspace removes `\n`.
    expect(capture.lines).toEqual(['a']);
  });

  it('Left + Backspace removes a char from the middle', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[D', Buffer.from([0x7f]), SUBMIT);
    expect(capture.lines).toEqual(['ac']);
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
    // Cursor parked on row 0 of a two-row buffer — the interrupt
    // path must `\x1b[1B` walk down one row so ^C lands below the
    // pasted content, not on top of it.
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
    // After recalling 'one' the user cancels with Ctrl+C. The next
    // Up must walk back to the latest entry ('two'), not resume
    // from the recalled 'one' position — symmetry with submit.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'one', SUBMIT,
      'two', SUBMIT,
      ESC + '[A',                  // recall 'two'
      ESC + '[A',                  // recall 'one'
      Buffer.from([0x03]),          // Ctrl+C
      ESC + '[A',                  // Up must hit latest ('two'), not 'one'
      SUBMIT);
    expect(capture.lines).toEqual(['one', 'two', 'two']);
  });

  it('Ctrl+C clears per-entry history drafts', () => {
    // Edits made inside a recalled cell must NOT survive Ctrl+C.
    // Without the clear, a subsequent walk to index 1 would see
    // the stale 'BX' draft instead of the stored 'B'.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',              // recall 'B', edit to 'BX'
      Buffer.from([0x03]),           // Ctrl+C — drafts must clear
      ESC + '[A', SUBMIT);          // Up recalls 'B' from history, not 'BX'
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
  it('drops a half-formed ~{ESC + non-[} sequence without injecting bytes', () => {
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
    // First Up recalls 'only' (cursor lands at end). Second Up has
    // no history.prev — the fallback is Home (cursor → 0), so a
    // trailing 'Z' lands at position 0.
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
    // Empty history, single-line buffer 'x'. Ctrl+A parks cursor=0.
    // Down has no history.next — fallback is End (cursor → length),
    // so a trailing 'Y' lands after 'x'.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'x', Buffer.from([0x01]), ESC + '[B', 'Y', SUBMIT);
    expect(capture.lines).toEqual(['xY']);
  });

  it('preserves edits made inside a recalled cell across further Up/Down', () => {
    // Per-entry drafts: appending 'X' to recalled 'three' must
    // survive walking back to 'two' and forward again.
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
    // After 'B' is recalled, edited to 'BX', and a different cell
    // gets submitted, walking back to index 1 must find the stored
    // 'B' — not a stale draft.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',            // recall 'B', edit to 'BX'
      ESC + '[A',                 // walk to 'A' — drafts[1]='BX'
      SUBMIT,                      // emit 'A'; drafts cleared on submit
      ESC + '[A',                 // recall 'A' (latest history entry)
      ESC + '[A',                 // recall 'B' from history, not 'BX' from a stale draft
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
  // Inside a multi-line buffer Up/Down move the cursor across
  // logical rows. History recall fires only when the cursor is
  // already on the edge row in the direction of motion. Without
  // history available in that direction the keys fall back to
  // Home / End — never silent no-ops.

  it('Up from a lower logical row steps the cursor onto the row above', () => {
    // buffer = 'first\nsecond', cursor at end. Up clamps column 6
    // to 'first'.length=5 → cursor parks at end of 'first', so a
    // trailing 'X' lands inside 'firstX\nsecond'.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('Down from an upper logical row steps the cursor onto the row below', () => {
    // Ctrl+A parks cursor at column 0 of 'first'. Down lands at
    // column 0 of 'second'; 'Y' inserts at the start of row 1.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      Buffer.from([0x01]),  // Ctrl+A → cursor=0, logical row 0
                      ESC + '[B',
                      'Y', SUBMIT);
    expect(capture.lines).toEqual(['first\nYsecond']);
  });

  it('Up on the first logical row of a multi-line buffer recalls the previous history entry', () => {
    // Multi-line draft, cursor parked at column 0 of row 0 via
    // Ctrl+A. Up sees no row above → history recall.
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
    // Build 'first\nsecond' as the bottom draft; Up Up walks
    // through the multi-line then recalls 'one'. Down from the
    // single-line recalled buffer restores the multi-line draft
    // intact.
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
    // buffer = 'AAAAA\nB\nCCCCC', cursor at end (column 5). First
    // Up clamps to 'B'.length=1 but remembers desiredColumn=5.
    // Second Up lands at column 5 of 'AAAAA' (its end), so 'X'
    // inserts AFTER 'AAAAA'. Without sticky the column would have
    // collapsed to 1 and 'X' would land after the first 'A'.
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'AAAAA', NEWLINE, 'B', NEWLINE, 'CCCCC',
                      ESC + '[A', ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['AAAAAX\nB\nCCCCC']);
  });

  it('resets the sticky desired column on any horizontal motion', () => {
    // After the first Up desiredColumn=5. Left+Right returns the
    // cursor to the same byte offset but resets stickiness; the
    // next Up uses the local column (1), so 'X' lands at position
    // 1 of 'AAAAA' — not at its end.
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
  // The heuristic INSERTS the paste at the cursor (preserving the
  // newline structure so the user sees the whole pasted block on
  // screen) and waits for an explicit submit. This lets the user
  // append `| /key` after a JSON paste before evaluating.

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
  // When BPM markers and the paste body arrive in SEPARATE data
  // events the chunk-level fast-path does not engage and the
  // per-byte state machine handles the accumulation. The end of
  // the paste runs the same `insertPasteAtCursor` helper.

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
  // Raw-mode stdin delivers bytes, not code points. The editor
  // decodes through a `StringDecoder` so multi-byte code points
  // (Cyrillic, CJK, emoji) survive intact — byte-at-a-time
  // dispatch would treat each UTF-8 continuation byte as a
  // separate Latin-1 character and submit mojibake.

  it('inserts a Cyrillic string from a single chunk', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'Привет', SUBMIT);
    expect(capture.lines).toEqual(['Привет']);
  });

  it('reassembles a Cyrillic code point split across two chunks', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    // "П" is 0xD0 0x9F. Split the two bytes into two separate
    // data events — the decoder buffers the first byte, emits
    // the full character on the second.
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

describe('createLineEditor — TTY multi-line redraw', () => {
  // Drives the cursor across `\n` boundaries and asserts the
  // submitted buffer matches the intended edits — exercises the
  // redraw-time walk-up-then-walk-down-and-right path plus the
  // submit-time walk-down path used when the cursor is parked on
  // a row other than the last.

  it('walks Left across a newline, inserts a char in the first row, then submits', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    // Build 'first\nsecond', then walk left 7 chars (past `\n`),
    // insert 'X' inside 'first' at position 5, then submit.
    // Cursor parked on the first row when submit fires.
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[D', ESC + '[D', ESC + '[D', ESC + '[D',
                      ESC + '[D', ESC + '[D', ESC + '[D',
                      'X',
                      SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('accounts for soft-wrap when the logical line overflows a narrow column width', () => {
    // Width 10, prompt '> ' → col 0 of first line starts at col 2,
    // so 'abcdefghij' (10 chars) wraps visually onto a second row.
    // Redraw must walk up the correct number of rows on the next
    // keystroke; if the count were off the second keystroke's
    // redraw would leak visible bytes from the prior render.
    const { stdinStream, editor, capture, out } = makeTtySetup({ columns: 10 });
    editor.start();
    feed(stdinStream, 'abcdefghij', 'K', SUBMIT);
    expect(capture.lines).toEqual(['abcdefghijK']);
    // Sanity: the multi-row clear sequence (cursor-up) was emitted.
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

  it('writes the bracketed-paste enable + disable escapes around start/close', () => {
    const { editor, out } = makeTtySetup();
    editor.start();
    expect(out.text()).toContain(ESC + '[?2004h');
    editor.close();
    expect(out.text()).toContain(ESC + '[?2004l');
  });

  it('emits ~{close} when the underlying stream ends', async () => {
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
