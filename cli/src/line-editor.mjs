// Raw-mode terminal line editor with live syntax-highlighting and
// bracketed-paste support, plus a non-TTY fallback for pipes and
// scripted tests. Replaces `node:readline` inside the REPL — the
// only reason readline went out is that its line-buffered model
// cannot redraw the input as the user types.
//
// Two editor flavours, picked by `stdinStream.isTTY`:
//
//   TTY (interactive terminal):
//     * Raw mode keystroke capture; per-keystroke redraw of the
//       current line via the caller-supplied `render(buffer)` (the
//       REPL passes `(s) => highlightAnsi(s, builtinNames)` so
//       every byte is painted as it lands).
//     * Bracketed paste support — terminal-emitted `\x1b[200~ … \x1b[201~`
//       wrappers around a multi-line paste are detected, the
//       enclosed content (newlines and all) becomes one buffer,
//       and the editor auto-submits as a single `'line'` emission.
//       This is what makes a pasted JSON object land in the REPL
//       as one cell instead of N parse failures.
//     * Cursor: Left / Right / Home / End / Ctrl+A / Ctrl+E.
//     * Backspace / Delete-forward.
//     * Ctrl+C clears the line and re-prompts; Ctrl+D on an empty
//       line closes the editor.
//
//   Non-TTY (pipe, file, scripted test):
//     * Line-buffered chunk reader. No raw mode, no rendering, no
//       paste sequences — every `\n` boundary fires `'line'`.
//     * Tail content with no trailing newline still emits before
//       `'close'`.
//
// Both flavours share the same EventEmitter contract:
//   editor.start()           begin reading from the stream
//   editor.prompt()          (re)render the prompt
//   editor.close()           tear down listeners and disable raw
//                            mode + bracketed paste if applicable
//   editor.on('line', fn)    fired with the submitted line text
//                            (newlines preserved in pasted blocks)
//   editor.on('close', fn)   fired on EOF or Ctrl+D

import { EventEmitter } from 'node:events';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const ENABLE_BRACKETED_PASTE  = ESC + '[?2004h';
const DISABLE_BRACKETED_PASTE = ESC + '[?2004l';

export function createLineEditor(stdinStream, stdoutWrite, options) {
  if (stdinStream.isTTY === true) {
    return createTtyLineEditor(stdinStream, stdoutWrite, options);
  }
  return createPipedLineEditor(stdinStream, stdoutWrite, options);
}

// ── TTY raw-mode editor ────────────────────────────────────────

function createTtyLineEditor(stdinStream, stdoutWrite, { prompt, render }) {
  const emitter = new EventEmitter();

  let buffer = '';
  let cursor = 0;
  let pasteMode = false;
  let pasteBuffer = '';
  let pendingEscape = '';

  // History — in-memory ring of previously-submitted lines plus a
  // per-session "draft" slot that holds whatever the user was
  // typing before they pressed Up. Up walks back through the ring,
  // Down walks forward; reaching the bottom restores the draft.
  // Persistent file-backed history is a future enhancement.
  const history = [];
  let historyIndex = 0;        // points one past the last entry by default
  let historyDraft = '';

  // Visible width of the prompt — the ANSI colour escapes never
  // advance the cursor, only the printable bytes do. Computed once
  // because the prompt is constant for the editor's lifetime.
  const promptVisibleLength = prompt.replace(/\x1b\[[0-9;]*m/g, '').length;

  // How many display rows the previous render occupied. Used to
  // walk the cursor back up to row 0 of the buffer area before the
  // next clear-and-redraw, so a multi-line paste that later
  // shrinks (Backspace across an `\n`) does not leave orphaned
  // lines on screen.
  let lastRenderedRowCount = 1;

  function redrawCurrentLine() {
    // 1. Move terminal cursor up to row 0 of the prior render.
    if (lastRenderedRowCount > 1) {
      stdoutWrite(ESC + `[${lastRenderedRowCount - 1}A`);
    }
    // 2. Clear from cursor (now at start of row 0) to end of screen.
    stdoutWrite('\r' + ESC + '[J');
    // 3. Write prompt + highlighted buffer. Embedded `\n` inside
    //    the buffer becomes a real terminal line break — under
    //    raw mode a bare LF only advances the row, so we translate
    //    to CRLF first to also reset the column.
    stdoutWrite(prompt);
    stdoutWrite(render(buffer).replace(/(?<!\r)\n/g, '\r\n'));

    // 4. Reposition the cursor inside the just-written buffer.
    const allLines           = buffer.split('\n');
    const lastRowIndex       = allLines.length - 1;
    const beforeCursorLines  = buffer.slice(0, cursor).split('\n');
    const cursorRowIndex     = beforeCursorLines.length - 1;
    const cursorColumnInLine = beforeCursorLines[beforeCursorLines.length - 1].length;

    const rowsToWalkBack = lastRowIndex - cursorRowIndex;
    if (rowsToWalkBack > 0) stdoutWrite(ESC + `[${rowsToWalkBack}A`);
    stdoutWrite('\r');
    const targetColumn = (cursorRowIndex === 0 ? promptVisibleLength : 0) + cursorColumnInLine;
    if (targetColumn > 0) stdoutWrite(ESC + `[${targetColumn}C`);

    lastRenderedRowCount = lastRowIndex + 1;
  }

  function submitCurrentLine() {
    const lineText = buffer;
    // Cursor may be parked on any row of a multi-line buffer when
    // Enter fires. Walk it down to the buffer's last row before
    // emitting `\r\n`, otherwise the REPL's result line would
    // overprint the rows below the cursor.
    const beforeCursorLines = buffer.slice(0, cursor).split('\n');
    const cursorRowIndex    = beforeCursorLines.length - 1;
    const lastRowIndex      = buffer.split('\n').length - 1;
    const rowsToWalkDown    = lastRowIndex - cursorRowIndex;
    if (rowsToWalkDown > 0) stdoutWrite(ESC + `[${rowsToWalkDown}B`);
    stdoutWrite('\r\n');
    pushHistoryEntry(lineText);
    buffer = '';
    cursor = 0;
    historyIndex = history.length;
    historyDraft = '';
    lastRenderedRowCount = 1;
    emitter.emit('line', lineText);
  }

  function pushHistoryEntry(lineText) {
    if (lineText === '') return;
    if (history[history.length - 1] === lineText) return; // de-dup repeat
    history.push(lineText);
  }

  function recallHistoryPrev() {
    if (historyIndex === 0) return;            // already at oldest
    if (historyIndex === history.length) {
      historyDraft = buffer;                   // save in-progress text
    }
    historyIndex -= 1;
    buffer = history[historyIndex];
    cursor = buffer.length;
    redrawCurrentLine();
  }

  function recallHistoryNext() {
    if (historyIndex === history.length) return; // already at draft
    historyIndex += 1;
    buffer = historyIndex === history.length ? historyDraft : history[historyIndex];
    cursor = buffer.length;
    redrawCurrentLine();
  }

  function handleByte(byte) {
    if (pasteMode) {
      pasteBuffer += String.fromCharCode(byte);
      if (pasteBuffer.endsWith(BRACKETED_PASTE_END)) {
        const pastedContent = pasteBuffer.slice(0, -BRACKETED_PASTE_END.length);
        pasteMode = false;
        pasteBuffer = '';
        insertPasteAtCursor(pastedContent);
      }
      return;
    }

    if (pendingEscape.length > 0) {
      pendingEscape += String.fromCharCode(byte);
      tryConsumeEscapeSequence();
      return;
    }

    if (byte === 0x1b) { pendingEscape = ESC; return; }
    if (byte === 0x03) { interruptCurrentLine();   return; }   // Ctrl+C
    if (byte === 0x04) { closeOnEmptyBuffer();     return; }   // Ctrl+D
    if (byte === 0x0d || byte === 0x0a) { submitCurrentLine(); return; }
    if (byte === 0x08 || byte === 0x7f) { backspaceAtCursor();  return; }
    if (byte === 0x01) { moveCursorHome(); return; }            // Ctrl+A
    if (byte === 0x05) { moveCursorEnd();  return; }            // Ctrl+E

    if (byte >= 0x20) {
      insertCharAtCursor(String.fromCharCode(byte));
    }
  }

  function tryConsumeEscapeSequence() {
    if (pendingEscape === BRACKETED_PASTE_BEGIN) {
      pasteMode = true;
      pasteBuffer = '';
      pendingEscape = '';
      return;
    }
    if (pendingEscape.length === 2 && pendingEscape[1] !== '[') {
      // ESC followed by a non-CSI byte — drop the half-formed
      // sequence; the byte is treated as a no-op rather than
      // injected into the buffer mid-keystroke. Past this point
      // pendingEscape is guaranteed to start with `ESC[` because
      // the only growth path beyond length 2 is through this
      // branch's complement above.
      pendingEscape = '';
      return;
    }
    const tail = pendingEscape[pendingEscape.length - 1];
    if (!/[A-Za-z~]/.test(tail)) return; // still accumulating

    switch (pendingEscape) {
      case ESC + '[D': moveCursorLeft();    break;
      case ESC + '[C': moveCursorRight();   break;
      case ESC + '[H':
      case ESC + '[1~': moveCursorHome();   break;
      case ESC + '[F':
      case ESC + '[4~': moveCursorEnd();    break;
      case ESC + '[3~': deleteAtCursor();   break;
      case ESC + '[A': recallHistoryPrev(); break;
      case ESC + '[B': recallHistoryNext(); break;
    }
    pendingEscape = '';
  }

  function insertCharAtCursor(ch) {
    buffer = buffer.slice(0, cursor) + ch + buffer.slice(cursor);
    cursor += 1;
    redrawCurrentLine();
  }

  function backspaceAtCursor() {
    if (cursor === 0) return;
    buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor);
    cursor -= 1;
    redrawCurrentLine();
  }

  function deleteAtCursor() {
    if (cursor >= buffer.length) return;
    buffer = buffer.slice(0, cursor) + buffer.slice(cursor + 1);
    redrawCurrentLine();
  }

  function moveCursorLeft()  { if (cursor > 0)             { cursor -= 1; redrawCurrentLine(); } }
  function moveCursorRight() { if (cursor < buffer.length) { cursor += 1; redrawCurrentLine(); } }
  function moveCursorHome()  { cursor = 0;             redrawCurrentLine(); }
  function moveCursorEnd()   { cursor = buffer.length; redrawCurrentLine(); }

  function interruptCurrentLine() {
    buffer = '';
    cursor = 0;
    stdoutWrite('^C\r\n');
    lastRenderedRowCount = 1;
    redrawCurrentLine();
  }

  function closeOnEmptyBuffer() {
    if (buffer.length === 0) emitter.emit('close');
  }

  function onData(chunk) {
    // Paste fast-path: a multi-byte data event with embedded
    // newlines is almost certainly a clipboard paste, not fast
    // typing. Collapse the multi-line content into a single line
    // (whitespace between qlang tokens is semantically inert — a
    // pasted `{\n  "a": 1\n}` parses identically to `{ "a": 1 }`)
    // and INSERT it at the cursor instead of auto-submitting, so
    // the user can append `| /key` or fix a typo before pressing
    // Enter. The same single-line collapse means recalled
    // multi-line pastes redraw cleanly under the editor's
    // single-line cursor model.
    //
    // Catches both the well-behaved BPM case where the entire
    // paste arrives in one chunk AND the legacy case (older
    // Windows console hosts, PowerShell ISE, ssh sessions where
    // the `\x1b[?2004h` enable was stripped) where the terminal
    // sends paste bytes verbatim with no markers. Per-byte
    // typing arrives one byte per data event and never triggers
    // the heuristic. The slower per-byte state machine below
    // still backs up multi-chunk BPM pastes (rare on slow links).
    if (!pasteMode && pendingEscape.length === 0) {
      const chunkText = chunk.toString('utf8');
      // `\n` alone (not the carriage-return Enter sends in raw
      // mode) is the marker — a typed character followed by Enter
      // arrives as `'x\r'` and must continue per-byte editing.
      if (chunkText.length > 1 && chunkText.includes('\n')) {
        insertPasteAtCursor(stripPasteMarkers(chunkText));
        return;
      }
    }
    for (const byte of chunk) handleByte(byte);
  }

  function insertPasteAtCursor(rawPasteText) {
    // Normalise CRLF to LF and trim a trailing line-end the
    // clipboard tends to carry, but preserve the multi-line
    // structure so the user sees the pasted content laid out the
    // way it was on their clipboard. The redraw path knows how
    // to position the cursor across `\n` boundaries.
    const normalised = rawPasteText.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    buffer = buffer.slice(0, cursor) + normalised + buffer.slice(cursor);
    cursor += normalised.length;
    redrawCurrentLine();
  }

  function stripPasteMarkers(text) {
    return text.replace(BRACKETED_PASTE_BEGIN, '').replace(BRACKETED_PASTE_END, '');
  }

  emitter.start = function start() {
    stdinStream.setRawMode(true);
    stdoutWrite(ENABLE_BRACKETED_PASTE);
    stdinStream.on('data', onData);
    stdinStream.on('end',  () => emitter.emit('close'));
  };

  emitter.close = function close() {
    stdoutWrite(DISABLE_BRACKETED_PASTE);
    stdinStream.setRawMode(false);
    stdinStream.removeListener('data', onData);
  };

  emitter.prompt = redrawCurrentLine;
  return emitter;
}

// ── Non-TTY line-buffered fallback ─────────────────────────────

function createPipedLineEditor(stdinStream, stdoutWrite, { prompt }) {
  const emitter = new EventEmitter();
  let pendingChunk = '';

  function onData(chunk) {
    pendingChunk += chunk;
    let nlIndex;
    while ((nlIndex = pendingChunk.indexOf('\n')) !== -1) {
      const lineText = pendingChunk.slice(0, nlIndex);
      pendingChunk = pendingChunk.slice(nlIndex + 1);
      emitter.emit('line', lineText);
    }
  }

  function onEnd() {
    if (pendingChunk.length > 0) {
      emitter.emit('line', pendingChunk);
      pendingChunk = '';
    }
    emitter.emit('close');
  }

  emitter.start = function start() {
    stdinStream.setEncoding('utf8');
    stdinStream.on('data', onData);
    stdinStream.on('end',  onEnd);
  };

  emitter.close = function close() {
    stdinStream.removeListener('data', onData);
    stdinStream.removeListener('end',  onEnd);
  };

  emitter.prompt = function showPrompt() {
    stdoutWrite(prompt);
  };

  return emitter;
}
