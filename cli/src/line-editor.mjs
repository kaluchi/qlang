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

  // Single-line redraw — buffer is invariantly one terminal line
  // (paste collapses embedded newlines to spaces, soft-newline
  // bindings are absent). Multi-line cursor positioning under
  // raw mode varies enough across terminal hosts (Windows
  // Terminal, conhost, PowerShell, GNOME, iTerm2, tmux) that the
  // simplest portable contract — one logical line, terminal
  // soft-wraps visually if it overflows the column width — wins
  // until a future commit revisits multi-line buffers with a
  // tested escape strategy that survives every host.
  function redrawCurrentLine() {
    stdoutWrite('\r' + ESC + '[2K');
    stdoutWrite(prompt);
    stdoutWrite(render(buffer));
    const trailingChars = buffer.length - cursor;
    if (trailingChars > 0) stdoutWrite(ESC + `[${trailingChars}D`);
  }

  function submitCurrentLine() {
    const lineText = buffer;
    pushHistoryEntry(lineText);
    buffer = '';
    cursor = 0;
    historyIndex = history.length;
    historyDraft = '';
    stdoutWrite('\r\n');
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
    if (byte === 0x0d || byte === 0x0a) {
      // Enter (CR or LF) — submit. The single-line buffer model
      // means there is no soft-newline keystroke; multi-line
      // composition lands in a follow-up commit when the editor
      // grows a multi-line redraw strategy that survives every
      // terminal host.
      submitCurrentLine();
      return;
    }
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
    redrawCurrentLine();
  }

  function closeOnEmptyBuffer() {
    if (buffer.length === 0) emitter.emit('close');
  }

  // Paste accumulator — once a chunk looks like the start of a
  // clipboard paste, every subsequent chunk that arrives within
  // a short idle window (50ms — far below human typing cadence,
  // far above IPC fragmentation latency) appends to the same
  // buffer. After the timer fires the accumulated content flushes
  // through `insertPasteAtCursor` as one paste. This catches
  // pastes that the terminal delivers across multiple data events
  // — what PowerShell and several other Windows hosts do for
  // multi-line clipboard content even with BPM enabled, and what
  // would otherwise leave half the content per-byte-processed
  // (where each `\r` from CRLF triggers a phantom submit).
  let pasteAccumBuffer = '';
  let pasteAccumTimer  = null;
  const PASTE_FLUSH_MS = 50;

  function flushPasteAccumulator() {
    const accumulated = pasteAccumBuffer;
    pasteAccumBuffer  = '';
    pasteAccumTimer   = null;
    insertPasteAtCursor(stripPasteMarkers(accumulated));
  }

  function startPasteAccumulator(chunkText) {
    pasteAccumBuffer = chunkText;
    pasteAccumTimer  = setTimeout(flushPasteAccumulator, PASTE_FLUSH_MS);
  }

  function continuePasteAccumulator(chunkText) {
    pasteAccumBuffer += chunkText;
    clearTimeout(pasteAccumTimer);
    pasteAccumTimer = setTimeout(flushPasteAccumulator, PASTE_FLUSH_MS);
  }

  function onData(chunk) {
    const chunkText = chunk.toString('utf8');

    // Continuation chunk while a paste is still flowing.
    if (pasteAccumBuffer.length > 0) {
      // A solitary CR (the user pressing Enter right after a
      // paste) closes the paste window deterministically — flush
      // the accumulated content into the buffer, then route the
      // CR through the normal submit path. Without this the
      // accumulator would swallow the Enter and only flush 50ms
      // later via the idle timer.
      if (chunkText === '\r' || chunkText === '\n') {
        clearTimeout(pasteAccumTimer);
        pasteAccumTimer = null;
        flushPasteAccumulator();
        submitCurrentLine();
        return;
      }
      continuePasteAccumulator(chunkText);
      return;
    }

    // First chunk that smells like the start of a paste.
    if (!pasteMode && pendingEscape.length === 0
        && chunkText.length > 1 && chunkText.includes('\n')) {
      startPasteAccumulator(chunkText);
      return;
    }

    for (const byte of chunk) handleByte(byte);
  }

  function insertPasteAtCursor(rawPasteText) {
    // The buffer is invariantly single-line. Collapse the paste's
    // newlines (CRLF or bare LF) into single spaces — qlang
    // ignores whitespace between tokens, so a pasted multi-line
    // JSON object parses identically when flattened. The result
    // is a long line that the terminal soft-wraps visually; the
    // user can append `| /key`, edit, and submit with Enter the
    // same way as any typed input.
    const collapsed = rawPasteText
      .split(/\r?\n/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join(' ');
    buffer = buffer.slice(0, cursor) + collapsed + buffer.slice(cursor);
    cursor += collapsed.length;
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
    if (pasteAccumTimer !== null) {
      clearTimeout(pasteAccumTimer);
      pasteAccumTimer = null;
    }
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
