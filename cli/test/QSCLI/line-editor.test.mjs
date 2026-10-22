import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { createLineEditor } from '../../src/line-editor.mjs';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const SUBMIT = '\r';
const NEWLINE = '\n';

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

describe('a piped input, read a line at a time', () => {
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

describe('a printable key', () => {
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
    expect((out.text().match(/> /g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Enter, Ctrl+Enter and Alt+Enter', () => {
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

describe('Backspace, Delete and the keys that move the cursor', () => {
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
    feed(stdinStream, 'a', Buffer.from([0x01]),
                      ESC + '[D', ESC + '[D',
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
    feed(stdinStream, 'abc', Buffer.from([0x01]),
                      ESC + '[C', ESC + '[C',
                      'X',
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

describe('Ctrl+C and Ctrl+D', () => {
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
    const { stdinStream, editor, capture, out } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', NEWLINE, 'b',
                      Buffer.from([0x01]),
                      Buffer.from([0x03]),
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
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'one', SUBMIT,
      'two', SUBMIT,
      ESC + '[A',
      ESC + '[A',
      Buffer.from([0x03]),
      ESC + '[A',
      SUBMIT);
    expect(capture.lines).toEqual(['one', 'two', 'two']);
  });

  it('Ctrl+C clears per-entry history drafts', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',
      Buffer.from([0x03]),
      ESC + '[A', SUBMIT);
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

describe('an escape that opens no key', () => {
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

describe('the cells submitted before', () => {
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
                      ESC + '[A', ESC + '[A',
                      ESC + '[B',
                      SUBMIT);
    expect(capture.lines).toEqual(['first', 'second', 'second']);
  });

  it('Down at the draft bottom parks the cursor at the end of the buffer', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'x', Buffer.from([0x01]), ESC + '[B', 'Y', SUBMIT);
    expect(capture.lines).toEqual(['xY']);
  });

  it('preserves edits made inside a recalled cell across further Up/Down', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'one', SUBMIT,
      'two', SUBMIT,
      'three', SUBMIT,
      ESC + '[A',
      'X',
      ESC + '[A',
      ESC + '[B',
      SUBMIT);
    expect(capture.lines).toEqual(['one', 'two', 'three', 'threeX']);
  });

  it('clears per-entry drafts on submit so the next recall sees the stored entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream,
      'A', SUBMIT, 'B', SUBMIT,
      ESC + '[A', 'X',
      ESC + '[A',
      SUBMIT,
      ESC + '[A',
      ESC + '[A',
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
    feed(stdinStream, 'a', NEWLINE, 'b', SUBMIT,
                      ESC + '[A', SUBMIT);
    expect(capture.lines).toEqual(['a\nb', 'a\nb']);
  });
});

describe('Up and Down between the rows of a cell of several lines', () => {

  it('Up from a lower logical row steps the cursor onto the row above', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('Down from an upper logical row steps the cursor onto the row below', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      Buffer.from([0x01]),
                      ESC + '[B',
                      'Y', SUBMIT);
    expect(capture.lines).toEqual(['first\nYsecond']);
  });

  it('Up on the first logical row of a multi-line buffer recalls the previous history entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'prev', SUBMIT,
                      'a', NEWLINE, 'b',
                      Buffer.from([0x01]),
                      ESC + '[A',
                      SUBMIT);
    expect(capture.lines).toEqual(['prev', 'prev']);
  });

  it('Down on the last logical row of a multi-line buffer recalls the next history entry', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one', SUBMIT,
                      'first', NEWLINE, 'second',
                      ESC + '[A',
                      ESC + '[A',
                      ESC + '[B',
                      SUBMIT);
    expect(capture.lines).toEqual(['one', 'first\nsecond']);
  });

  it('keeps a sticky desired column across short intermediate rows', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'AAAAA', NEWLINE, 'B', NEWLINE, 'CCCCC',
                      ESC + '[A', ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['AAAAAX\nB\nCCCCC']);
  });

  it('resets the sticky desired column on any horizontal motion', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'AAAAA', NEWLINE, 'B', NEWLINE, 'CCCCC',
                      ESC + '[A',
                      ESC + '[D', ESC + '[C',
                      ESC + '[A',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['AXAAAA\nB\nCCCCC']);
  });
});

describe('a paste gathered from its chunks', () => {

  it('inserts a multi-line chunk into the buffer without auto-submitting', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | get /a');
    expect(capture.lines).toEqual([]);
  });

  it('preserves newlines through paste + submit', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '{\n  "a": 1\n} | get /a', SUBMIT);
    expect(capture.lines).toEqual(['{\n  "a": 1\n} | get /a']);
  });

  it('gathers a paste the terminal hands over in several chunks into one paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\r\ntw', 'o\r', '\nthree', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo\nthree']);
  });

  it('ends the gathering at a chunk of one character, Enter handed over alone submitting', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\r\ntw', 'o', '\r', '\nthree', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo', '\nthree']);
  });

  it('ends the gathering at a key spelled by an escape, an arrow moving the cursor', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwXo']);
  });

  it('ends the gathering at Alt+Enter, which submits the paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '\r');
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('gathers a paste after the Escape key, which does nothing', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, 'one\r\ntwo', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('takes every bracket marker out of a gathered paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'p\r\nq' + BRACKETED_PASTE_END, 'r\r\ns' + BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['p\nqr\ns']);
  });

  it('takes every begin marker out of a gathered paste', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'p\r\nq' + BRACKETED_PASTE_BEGIN + 'r', 's' + BRACKETED_PASTE_BEGIN + 't', SUBMIT);
    expect(capture.lines).toEqual(['p\nqrst']);
  });

  it('ends the gathering at a character beyond the basic plane typed alone', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\r\ntwo\r\n', '\u{1F600}', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo\u{1F600}']);
  });

  it('reads Alt with an arrow, an escape before the arrow\'s, as the arrow', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + ESC + '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['abXc']);
  });

  it('reads a bracketed paste after an escape in the same chunk', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC + BRACKETED_PASTE_BEGIN + 'one\r\ntwo' + BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('reads a key spelled by an escape after the Escape key', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC, ESC + '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['abXc']);
  });

  it('reads a bracketed paste after the Escape key', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, BRACKETED_PASTE_BEGIN + 'one\r\ntwo' + BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('reads text whose one line feed ends it key by key', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc' + NEWLINE, 'd', SUBMIT);
    expect(capture.lines).toEqual(['abc\nd']);
  });

  it('reads a character beyond the basic plane typed alone as one key, Alt with it doing nothing', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, '\u{1F600}', 'x', SUBMIT);
    expect(capture.lines).toEqual(['x']);
  });

  it('reads a character beyond the basic plane as it reads a letter over every delivery of up to three chunks', () => {
    const EMOJI = '\u{1F600}';
    const LETTER = 'é';
    const CHUNKS = [ESC, '[D', ESC + '[D', 'a', 'one\r\ntwo', 'x' + NEWLINE, SUBMIT, NEWLINE,
      BRACKETED_PASTE_BEGIN, BRACKETED_PASTE_END, ESC + SUBMIT, EMOJI, ESC + EMOJI];
    const linesOf = (chunks) => {
      const { stdinStream, editor, capture } = makeTtySetup();
      editor.start();
      feed(stdinStream, ...chunks, SUBMIT);
      editor.close();
      return JSON.stringify(capture.lines);
    };
    for (const first of CHUNKS) for (const second of CHUNKS) for (const third of CHUNKS) {
      const chunks = [first, second, third];
      if (!chunks.some(chunk => chunk.includes(EMOJI))) continue;
      const withLetter = linesOf(chunks.map(chunk => chunk.split(EMOJI).join(LETTER)));
      expect(linesOf(chunks)).toBe(withLetter.split(LETTER).join(EMOJI));
    }
  });

  it('drops an escape before a character beyond the basic plane, the keys after it typed', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC + '\u{1F600}', '1', '2', SUBMIT);
    expect(capture.lines).toEqual(['12']);
  });

  it('reads an escape sequence split after its escape as one key', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC, '[D', 'X', SUBMIT);
    expect(capture.lines).toEqual(['abXc']);
  });

  it('reads an escape sequence split after its bracket as one key', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'abc', ESC + '[', '1~', 'X', SUBMIT);
    expect(capture.lines).toEqual(['Xabc']);
  });

  it('reads a bracketed paste whose begin marker is split after its escape', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, ESC, '[200~one\r\ntwo', BRACKETED_PASTE_END, SUBMIT);
    expect(capture.lines).toEqual(['one\ntwo']);
  });

  it('reads a chunk that begins with an escape as keys, a line feed in it among them', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'one\ntwo', ESC + '[Dx\ny', SUBMIT);
    expect(capture.lines).toEqual(['one\ntwx\nyo']);
  });

  it('reads a bracketed paste up to its end marker, a pause past the window inside it', async () => {
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
    feed(stdinStream, '{\n  "a": 1\n}', ' | get /a', SUBMIT);
    expect(capture.lines).toEqual(['{\n  "a": 1\n} | get /a']);
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

describe('a bracketed paste read to its end marker', () => {

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

describe('a character of several bytes', () => {

  it('inserts a Cyrillic string from a single chunk', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'Привет', SUBMIT);
    expect(capture.lines).toEqual(['Привет']);
  });

  it('reassembles a Cyrillic code point split across two chunks', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
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

describe('a character beyond the basic plane, moved and erased as one', () => {

  it('inserting a surrogate-pair character advances the cursor by both code units', () => {
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
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'B',
                      Buffer.from([0x01]),
                      ESC + '[3~',
                      SUBMIT);
    expect(capture.lines).toEqual(['B']);
  });

  it('Left arrow skips a surrogate-pair character in one step', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'X',
                      ESC + '[D', ESC + '[D',
                      'A', SUBMIT);
    expect(capture.lines).toEqual(['A🎉X']);
  });

  it('Right arrow skips a surrogate-pair character in one step', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', 'X',
                      Buffer.from([0x01]),
                      ESC + '[C',
                      'A', SUBMIT);
    expect(capture.lines).toEqual(['🎉AX']);
  });

  it('Up snaps the cursor to a character boundary when the desired column lands mid-surrogate-pair', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, '🎉', NEWLINE, 'X',
                      ESC + '[A',
                      'Z', SUBMIT);
    expect(capture.lines).toEqual(['Z🎉\nX']);
  });

  it('round-trips a chain of surrogate-pair characters through repeated backspace without leaving orphans', () => {
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

describe('the redraw of a cell of several rows', () => {

  it('walks Left across a newline, inserts a char in the first row, then submits', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'first', NEWLINE, 'second',
                      ESC + '[D', ESC + '[D', ESC + '[D', ESC + '[D',
                      ESC + '[D', ESC + '[D', ESC + '[D',
                      'X',
                      SUBMIT);
    expect(capture.lines).toEqual(['firstX\nsecond']);
  });

  it('accounts for soft-wrap when the logical line overflows a narrow column width', () => {
    const { stdinStream, editor, capture, out } = makeTtySetup({ columns: 10 });
    editor.start();
    feed(stdinStream, 'abcdefghij', 'K', SUBMIT);
    expect(capture.lines).toEqual(['abcdefghijK']);
    expect(out.text()).toMatch(/\x1b\[\d+A/);
  });
});

describe('the start and the close of the editor', () => {
  it('toggles raw mode on start and clears on close', () => {
    const { editor, rawModeCalls } = makeTtySetup();
    editor.start();
    expect(rawModeCalls).toEqual([true]);
    editor.close();
    expect(rawModeCalls).toEqual([true, false]);
  });

  it('wraps every redraw in synchronized-output and hide/show-cursor escapes', () => {
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

describe('the edges of the cell', () => {
  it('backspaces the only character in the buffer', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'a', Buffer.from([0x7f]), 'b', SUBMIT);
    expect(capture.lines).toEqual(['b']);
  });

  it('deletes the last character of the buffer', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'ab', ESC + '[D', ESC + '[3~', SUBMIT);
    expect(capture.lines).toEqual(['a']);
  });

  it('keeps the sticky column across consecutive Up moves', () => {
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'aaa', NEWLINE, 'bb', NEWLINE, 'c',
                      ESC + '[A',
                      ESC + '[A',
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
    const { stdinStream, editor, capture } = makeTtySetup();
    editor.start();
    feed(stdinStream, 'aaa', NEWLINE, 'bb', NEWLINE, 'c',
                      ESC + '[A', ESC + '[A',
                      ESC + '[B',
                      'X', SUBMIT);
    expect(capture.lines).toEqual(['aaa\nbXb\nc']);
  });
});
