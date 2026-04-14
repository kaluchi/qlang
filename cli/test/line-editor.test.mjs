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

  it('removes its data listener on close', () => {
    const { stdinStream, editor } = makePipedSetup();
    editor.start();
    expect(stdinStream.listenerCount('data')).toBe(1);
    editor.close();
    expect(stdinStream.listenerCount('data')).toBe(0);
  });
});

// ── TTY raw-mode editor ────────────────────────────────────────

function makeTtySetup() {
  const stdinStream = new PassThrough();
  stdinStream.isTTY = true;
  const rawModeCalls = [];
  stdinStream.setRawMode = (flag) => { rawModeCalls.push(flag); };
  const out = captureWrites();
  const editor = createLineEditor(stdinStream, out.write, {
    prompt: '> ',
    render: (s) => s
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
    feed(stdinStream, 'abc', '\r');
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

describe('createLineEditor — TTY editing keys', () => {
  it('Backspace removes the char before the cursor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x7f]), '\r');
    expect(capture.lines).toEqual(['ab']);
  });

  it('Backspace at column 0 leaves the buffer untouched', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, Buffer.from([0x7f]), 'x', '\r');
    expect(capture.lines).toEqual(['x']);
  });

  it('Left + Backspace removes a char from the middle', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[D', Buffer.from([0x7f]), '\r');
    // 'abc' → cursor at 3; ESC[D → cursor at 2; backspace removes
    // 'b' → 'ac'; Enter submits.
    expect(capture.lines).toEqual(['ac']);
  });

  it('Right past end is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', ESC + '[C', ESC + '[C', '\r');
    expect(capture.lines).toEqual(['a']);
  });

  it('Right inside the buffer advances the cursor one step', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x01]),    // 'abc', cursor → 0
                      ESC + '[C', ESC + '[C',         // cursor → 2
                      'X',                            // 'abXc'
                      '\r');
    expect(capture.lines).toEqual(['abXc']);
  });

  it('Home (Ctrl+A) jumps to start, End (Ctrl+E) jumps back', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x01]), 'X', Buffer.from([0x05]), 'Y', '\r');
    // Ctrl+A → cursor 0; insert 'X' → 'Xabc'; Ctrl+E → cursor end;
    // insert 'Y' → 'XabcY'.
    expect(capture.lines).toEqual(['XabcY']);
  });

  it('Home and End via CSI sequences (\\x1b[H, \\x1b[F) work too', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[H', 'X', ESC + '[F', 'Y', '\r');
    expect(capture.lines).toEqual(['XabcY']);
  });

  it('Delete-forward (\\x1b[3~) removes the char under the cursor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[D', ESC + '[D', ESC + '[3~', '\r');
    // 'abc', cursor → 1, delete forward → 'ac'.
    expect(capture.lines).toEqual(['ac']);
  });

  it('Delete-forward at end of buffer is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[3~', '\r');
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY control bytes', () => {
  it('Ctrl+C clears the current buffer and reprompts', () => {
    const { stdinStream, editor, capture, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x03]), 'xyz', '\r');
    // After Ctrl+C the buffer is empty; subsequent 'xyz' starts
    // a fresh line, and Enter submits 'xyz'.
    expect(capture.lines).toEqual(['xyz']);
    expect(out.text()).toMatch(/\^C/);
  });

  it('Ctrl+D on an empty buffer closes the editor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, Buffer.from([0x04]));
    expect(capture.isClosed()).toBe(true);
  });

  it('Ctrl+D with a non-empty buffer is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', Buffer.from([0x04]), '\r');
    expect(capture.isClosed()).toBe(false);
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY escape sequence handling', () => {
  it('drops a half-formed `ESC + non-[` sequence without injecting bytes', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    // ESC followed by 'Z' is not a recognised CSI prefix; the
    // editor abandons the partial sequence and the next 'a' lands
    // as a normal printable.
    feed(stdinStream, ESC, 'Z', 'a', '\r');
    expect(capture.lines).toEqual(['a']);
  });

  it('ignores unknown CSI sequences without error', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC + '[Z', 'k', '\r');  // Z = unbound CSI
    expect(capture.lines).toEqual(['k']);
  });
});

describe('createLineEditor — TTY history navigation', () => {
  it('Up walks back through submitted lines', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first\r', 'second\r', ESC + '[A', '\r');
    // After two submissions, the third Enter submits whatever is
    // in the buffer — Up restored 'second', so that's what fires.
    expect(capture.lines).toEqual(['first', 'second', 'second']);
  });

  it('Up twice walks two entries back', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first\r', 'second\r', ESC + '[A', ESC + '[A', '\r');
    expect(capture.lines).toEqual(['first', 'second', 'first']);
  });

  it('Up at oldest entry is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'only\r', ESC + '[A', ESC + '[A', '\r');
    expect(capture.lines).toEqual(['only', 'only']);
  });

  it('Up + Down returns to the in-progress draft', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'history\r', 'draft', ESC + '[A', ESC + '[B', '\r');
    // After 'history' is submitted, user types 'draft' — Up
    // recalls 'history' (saves 'draft'), Down restores 'draft'.
    expect(capture.lines).toEqual(['history', 'draft']);
  });

  it('Down inside history walks forward to the next stored entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first\r', 'second\r',
                      ESC + '[A', ESC + '[A',  // back to 'first'
                      ESC + '[B',                // forward to 'second'
                      '\r');
    expect(capture.lines).toEqual(['first', 'second', 'second']);
  });

  it('Down at the bottom (current draft) is a no-op', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'x', ESC + '[B', ESC + '[B', '\r');
    expect(capture.lines).toEqual(['x']);
  });

  it('does not store empty submissions in history', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '\r', 'real\r', ESC + '[A', '\r');
    // Empty Enter contributes nothing to history; Up after 'real'
    // recalls 'real' (the only entry).
    expect(capture.lines).toEqual(['', 'real', 'real']);
  });

  it('does not store consecutive duplicates', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'same\r', 'same\r', ESC + '[A', ESC + '[A', '\r');
    // Two 'same' submissions collapse to one history entry; two
    // Ups still land on 'same' (no second entry behind it).
    expect(capture.lines).toEqual(['same', 'same', 'same']);
  });
});

describe('createLineEditor — TTY paste fast-path', () => {
  // Multi-line clipboard content collapses to a single space-
  // separated line — qlang does not care about whitespace between
  // tokens, so a pasted JSON object parses identically when
  // flattened. The single-line buffer survives every terminal
  // host's redraw quirks where multi-line cursor positioning
  // would otherwise diverge.

  it('inserts a collapsed multi-line chunk into the buffer without auto-submitting', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | /a');
    expect(capture.lines).toEqual([]);
  });

  it('collapses internal newlines into single spaces and submits the flat line on Enter', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | /a', '\r');
    expect(capture.lines).toEqual(['{ "a": 1 } | /a']);
  });

  it('drops trailing-newline whitespace from a clipboard end-of-block', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo\n', '\r');
    expect(capture.lines).toEqual(['one two']);
  });

  it('lets the user append further text to a pasted block before Enter', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n}', ' | /a', '\r');
    expect(capture.lines).toEqual(['{ "a": 1 } | /a']);
  });

  it('strips BPM markers from a single-chunk wrapped paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, BRACKETED_PASTE_BEGIN + 'a\nb' + BRACKETED_PASTE_END, '\r');
    expect(capture.lines).toEqual(['a b']);
  });

  it('does not trigger the heuristic for fast-typing without newlines', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', '\r');
    expect(capture.lines).toEqual(['abc']);
  });
});

describe('createLineEditor — TTY bracketed paste (multi-chunk state machine)', () => {
  // When BPM markers and the paste body arrive in SEPARATE data
  // events (slow link, partial flush) the chunk-level fast-path
  // does not engage and the per-byte state machine handles the
  // accumulation. The end of the paste runs the same
  // `insertPasteAtCursor` helper that collapses internal newlines.

  it('inserts single-line paste content when markers arrive in separate data events', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
         BRACKETED_PASTE_BEGIN,
         'paste body',
         BRACKETED_PASTE_END,
         '\r');
    expect(capture.lines).toEqual(['paste body']);
  });

  it('appends bracketed-paste content after any pre-paste keystrokes', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'pre-',
         BRACKETED_PASTE_BEGIN,
         'pasted',
         BRACKETED_PASTE_END,
         '\r');
    expect(capture.lines).toEqual(['pre-pasted']);
  });

  it('collapses multi-line content delivered through the BPM state machine', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
         BRACKETED_PASTE_BEGIN,
         'a\nb\nc',
         BRACKETED_PASTE_END,
         '\r');
    expect(capture.lines).toEqual(['a b c']);
  });
});

describe('createLineEditor — TTY lifecycle', () => {
  it('toggles raw mode on start and clears on close', () => {
    const { stdinStream, editor, rawModeCalls } = makeTtySetup();
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
    // Send a chunk that opens the paste window — accumulator
    // timer is now pending.
    feed(stdinStream, 'a\nb');
    editor.close();
    // No assertion on output — the test passes if the timer
    // does not crash by firing against a torn-down editor.
    expect(stdinStream.listenerCount('data')).toBe(0);
  });
});
