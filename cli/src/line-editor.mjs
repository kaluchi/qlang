// Raw-mode terminal line editor with live syntax-highlighting,
// bracketed-paste support, and multi-line buffer rendering, plus a
// non-TTY fallback for pipes and scripted tests. Replaces
// `node:readline` inside the REPL — the only reason readline went
// out is that its line-buffered model cannot redraw the input as
// the user types.
//
// Two editor flavours, picked by `stdinStream.isTTY`:
//
//   TTY (interactive terminal):
//     * Raw mode keystroke capture; per-keystroke redraw of the
//       current buffer via the caller-supplied `render(buffer)` —
//       the REPL passes `(s) => highlightAnsi(s, builtinNames)` so
//       every byte is painted as it lands, including inside a
//       multi-line buffer.
//     * Multi-line redraw: `\n` in the buffer is a real line break
//       on screen. The editor tracks how many visual rows the last
//       render occupied (accounting for the terminal's soft-wrap
//       at column width, not only the count of logical `\n`), then
//       walks the cursor up that many rows and clears to end of
//       screen before re-rendering. Long lines that wrap across
//       terminal columns collapse back correctly when the buffer
//       shrinks.
//     * Bracketed paste — terminal-emitted `\x1b[200~ … \x1b[201~`
//       wrappers around a multi-line paste are detected and the
//       enclosed content (newlines and all) is inserted at the
//       cursor with its structure preserved; the user can edit,
//       append a projection like `| /key`, then submit.
//     * Chunk-level paste heuristic for hosts that strip BPM
//       markers (PowerShell, ssh without BPM negotiation): any
//       data event longer than one byte and containing `\n` is
//       treated as a paste and routed through the same insert
//       path. A solitary LF that arrives with the paste closes
//       the accumulator window deterministically rather than
//       being mistaken for a submit.
//     * Enter (CR 0x0d) inserts a soft newline — multi-line cell
//       composition is the default case, matching a notebook-style
//       editor.
//     * Ctrl+Enter / Ctrl+J / Alt+Enter submit the current buffer
//       as one cell. Ctrl+Enter emits LF (0x0a) in every modern
//       terminal that distinguishes it from plain Enter; Ctrl+J
//       emits the same LF, so the two are one binding. Alt+Enter
//       arrives as `ESC + CR` and is handled in the escape path.
//     * Cursor: Left / Right / Home / End / Ctrl+A / Ctrl+E walk
//       across the multi-line layout, stepping across embedded
//       `\n` the same way any GUI editor handles line breaks.
//     * Backspace / Delete-forward.
//     * Ctrl+C clears the buffer and re-prompts; Ctrl+D on an
//       empty buffer closes the editor.
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
//   editor.on('line', fn)    fired with the submitted buffer text
//                            (newlines preserved across soft-
//                            newline and paste)
//   editor.on('close', fn)   fired on EOF or Ctrl+D

import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';

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

function createTtyLineEditor(stdinStream, stdoutWrite, { prompt, render, columns }) {
  const emitter = new EventEmitter();

  let buffer = '';
  let cursor = 0;
  let pasteMode = false;
  let pasteBuffer = '';
  let pendingEscape = '';

  // Incremental UTF-8 decoder — chunk boundaries can split a
  // multi-byte code point (two-byte Cyrillic, three-byte CJK,
  // four-byte emoji). The decoder buffers a partial tail across
  // writes so the per-character dispatcher never sees half a
  // code point.
  const utf8Decoder = new StringDecoder('utf8');

  // History ring of submitted cells plus a per-session draft slot
  // holding whatever the user was typing before they pressed Up.
  // Up walks back; Down walks forward; reaching the bottom restores
  // the draft. Recalled entries keep their internal newlines — the
  // multi-line redraw lays them out as they were submitted.
  const history = [];
  let historyIndex = 0;
  let historyDraft = '';

  // Visible width of the prompt — ANSI colour escapes never advance
  // the cursor, only the printable bytes do. Computed once.
  const promptVisibleLength = prompt.replace(/\x1b\[[0-9;]*m/g, '').length;

  // Visual layout state from the last redraw. `lastVisualRows` is
  // the total number of terminal rows the previous render occupied
  // (including soft-wrap rows from overlong content). `lastCursorRow`
  // is where the hardware cursor was parked at the end of that
  // redraw, measured from row 0 of the block. The next redraw walks
  // `lastCursorRow` rows UP to reach row 0 before clearing.
  let lastVisualRows = 0;
  let lastCursorRow  = 0;

  const getColumns = () => {
    const c = typeof columns === 'function' ? columns() : columns;
    return Number.isFinite(c) && c > 0 ? c : Infinity;
  };

  // Visual row count for a single logical line given its starting
  // column (prompt for row 0, 0 otherwise) and the terminal width.
  // `Math.max(1, ...)` keeps empty logical lines visible — an empty
  // line still takes one screen row that the clear step must erase.
  function visualRowsForLine(colStart, contentLen, width) {
    if (!Number.isFinite(width)) return 1;
    return Math.max(1, Math.ceil((colStart + contentLen) / width));
  }

  // Count visual rows for the buffer slice split on `\n`. Rows for
  // each logical line account for soft-wrap at `width`.
  function countVisualRows(logicalLines, width) {
    let total = 0;
    for (let i = 0; i < logicalLines.length; i += 1) {
      const colStart = (i === 0) ? promptVisibleLength : 0;
      total += visualRowsForLine(colStart, logicalLines[i].length, width);
    }
    return total;
  }

  // Resolve the `cursor` byte offset to (visual row, visual column)
  // inside the wrapped layout.
  function locateCursorVisual(width) {
    const before = buffer.slice(0, cursor);
    const beforeLines = before.split('\n');
    const cursorLogicalRow = beforeLines.length - 1;
    const cursorLogicalCol = beforeLines[cursorLogicalRow].length;

    // Rows occupied by logical lines strictly before the cursor's
    // logical row.
    let visualRowsBefore = 0;
    for (let i = 0; i < cursorLogicalRow; i += 1) {
      const colStart = (i === 0) ? promptVisibleLength : 0;
      visualRowsBefore += visualRowsForLine(colStart, beforeLines[i].length, width);
      // `beforeLines[i]` for i < cursorLogicalRow equals the
      // full i-th logical line (cursor lies beyond those lines).
    }

    // Position within the cursor's own logical line.
    const colStart = (cursorLogicalRow === 0) ? promptVisibleLength : 0;
    const total    = colStart + cursorLogicalCol;
    const rowInLine = Number.isFinite(width) ? Math.floor(total / width) : 0;
    const colInRow  = Number.isFinite(width) ? (total % width)           : total;

    return {
      row: visualRowsBefore + rowInLine,
      col: colInRow
    };
  }

  function redrawCurrentLine() {
    const width = getColumns();

    // 1. Walk the terminal cursor up to row 0 of the prior render.
    if (lastCursorRow > 0) {
      stdoutWrite(ESC + `[${lastCursorRow}A`);
    }
    // 2. Return to column 0 and clear everything from here down —
    //    wipes the prior render in one go, including any soft-wrap
    //    rows that a shrinking buffer would otherwise leak.
    stdoutWrite('\r' + ESC + '[J');

    // 3. Write prompt + highlighted buffer. In raw mode a bare `\n`
    //    only advances the row; translate to CRLF so column 0 is
    //    reset at each line break.
    stdoutWrite(prompt);
    stdoutWrite(render(buffer).replace(/(?<!\r)\n/g, '\r\n'));

    // 4. Figure out where the hardware cursor landed and walk it
    //    to the visual position that corresponds to `cursor`.
    const logicalLines  = buffer.split('\n');
    const totalRows     = countVisualRows(logicalLines, width);
    const cursorVisual  = locateCursorVisual(width);
    const rowsUp        = (totalRows - 1) - cursorVisual.row;

    if (rowsUp > 0) stdoutWrite(ESC + `[${rowsUp}A`);
    stdoutWrite('\r');
    if (cursorVisual.col > 0) stdoutWrite(ESC + `[${cursorVisual.col}C`);

    lastVisualRows = totalRows;
    lastCursorRow  = cursorVisual.row;
  }

  function submitCurrentLine() {
    const lineText = buffer;

    // Walk the hardware cursor from its current row to the last
    // row of the block before emitting `\r\n`, otherwise the REPL's
    // result line would overprint the rows below.
    const rowsDown = (lastVisualRows - 1) - lastCursorRow;
    if (rowsDown > 0) stdoutWrite(ESC + `[${rowsDown}B`);
    stdoutWrite('\r\n');

    pushHistoryEntry(lineText);
    buffer = '';
    cursor = 0;
    historyIndex = history.length;
    historyDraft = '';
    lastVisualRows = 0;
    lastCursorRow  = 0;
    emitter.emit('line', lineText);
  }

  function pushHistoryEntry(lineText) {
    if (lineText === '') return;
    if (history[history.length - 1] === lineText) return;
    history.push(lineText);
  }

  function recallHistoryPrev() {
    if (historyIndex === 0) return;
    if (historyIndex === history.length) {
      historyDraft = buffer;
    }
    historyIndex -= 1;
    buffer = history[historyIndex];
    cursor = buffer.length;
    redrawCurrentLine();
  }

  function recallHistoryNext() {
    if (historyIndex === history.length) return;
    historyIndex += 1;
    buffer = historyIndex === history.length ? historyDraft : history[historyIndex];
    cursor = buffer.length;
    redrawCurrentLine();
  }

  function handleChar(ch) {
    if (pasteMode) {
      pasteBuffer += ch;
      if (pasteBuffer.endsWith(BRACKETED_PASTE_END)) {
        const pastedContent = pasteBuffer.slice(0, -BRACKETED_PASTE_END.length);
        pasteMode = false;
        pasteBuffer = '';
        insertPasteAtCursor(pastedContent);
      }
      return;
    }

    if (pendingEscape.length > 0) {
      pendingEscape += ch;
      tryConsumeEscapeSequence();
      return;
    }

    // Control codes and CSI markers are all in the ASCII single-
    // byte range; `ch` for a control unit is always a single-code-
    // point string, and `codePointAt(0)` is the canonical way to
    // dispatch on it. For multi-byte Unicode characters (Cyrillic,
    // CJK, emoji) `ch` arrives as one code point with value
    // >= 0x80 and falls through to the insert path.
    const code = ch.codePointAt(0);
    if (code === 0x1b) { pendingEscape = ESC; return; }
    if (code === 0x03) { interruptCurrentLine();   return; }   // Ctrl+C
    if (code === 0x04) { closeOnEmptyBuffer();     return; }   // Ctrl+D
    if (code === 0x0d) { insertNewlineAtCursor();  return; }   // Enter (CR) — soft newline
    if (code === 0x0a) { submitCurrentLine();      return; }   // Ctrl+Enter / Ctrl+J — submit
    if (code === 0x08 || code === 0x7f) { backspaceAtCursor();  return; }
    if (code === 0x01) { moveCursorHome(); return; }            // Ctrl+A
    if (code === 0x05) { moveCursorEnd();  return; }            // Ctrl+E

    if (code >= 0x20) {
      insertCharAtCursor(ch);
    }
  }

  function tryConsumeEscapeSequence() {
    if (pendingEscape === BRACKETED_PASTE_BEGIN) {
      pasteMode = true;
      pasteBuffer = '';
      pendingEscape = '';
      return;
    }
    if (pendingEscape === ESC + '\r' || pendingEscape === ESC + '\n') {
      // Alt+Enter — treat as an explicit submit. Some terminals
      // send ESC+CR, others ESC+LF; accept both so the binding
      // works uniformly as a submit on hosts where Ctrl+Enter is
      // intercepted.
      pendingEscape = '';
      submitCurrentLine();
      return;
    }
    if (pendingEscape.length === 2 && pendingEscape[1] !== '[') {
      // ESC followed by a non-CSI byte — drop the half-formed
      // sequence. Past this point pendingEscape is guaranteed to
      // start with `ESC[` because the only growth path beyond
      // length 2 is through this branch's complement above.
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

  function insertNewlineAtCursor() {
    buffer = buffer.slice(0, cursor) + '\n' + buffer.slice(cursor);
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
    // Walk to the last row of the block, print ^C on its own line,
    // then reset the buffer and redraw a fresh empty prompt.
    const rowsDown = (lastVisualRows - 1) - lastCursorRow;
    if (rowsDown > 0) stdoutWrite(ESC + `[${rowsDown}B`);
    stdoutWrite('\r\n^C\r\n');
    buffer = '';
    cursor = 0;
    lastVisualRows = 0;
    lastCursorRow  = 0;
    redrawCurrentLine();
  }

  function closeOnEmptyBuffer() {
    if (buffer.length === 0) emitter.emit('close');
  }

  // Paste accumulator — once a chunk looks like the start of a
  // clipboard paste, every subsequent chunk that arrives within a
  // short idle window appends to the same buffer. After the timer
  // fires the accumulated content flushes through
  // `insertPasteAtCursor` as one paste. This catches pastes that
  // the terminal delivers across multiple data events — what
  // PowerShell and several other Windows hosts do for multi-line
  // clipboard content even with BPM enabled, and what would
  // otherwise leave half the content per-byte-processed (where
  // each `\n` from the paste body would trigger a phantom submit).
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
    // Decode incrementally — a code point split across chunk
    // boundaries is buffered in the decoder and emitted on the
    // next write. `chunkText` is a complete prefix string.
    const chunkText = utf8Decoder.write(chunk);
    if (chunkText.length === 0) return;

    // A solitary keystroke that arrives while the accumulator is
    // open closes the paste window deterministically: flush the
    // accumulated content, then let the keystroke itself route
    // through the per-byte dispatcher. That way a Ctrl+Enter
    // right after a paste submits, a Ctrl+C cancels, a letter
    // keeps building the buffer — no special-cased branch per
    // keystroke.
    if (pasteAccumBuffer.length > 0) {
      if (chunkText.length === 1) {
        clearTimeout(pasteAccumTimer);
        pasteAccumTimer = null;
        flushPasteAccumulator();
      } else {
        continuePasteAccumulator(chunkText);
        return;
      }
    }

    // First chunk that smells like the start of a paste — multi-
    // byte data event with an embedded `\n` that is NOT at the
    // final position. A typed buffer followed by Ctrl+Enter
    // arrives as `'…\n'` where the only `\n` is the last byte,
    // which must route through per-byte submit and not be mistaken
    // for a paste body.
    if (!pasteMode && pendingEscape.length === 0 && chunkText.length > 1) {
      const firstNewline = chunkText.indexOf('\n');
      if (firstNewline !== -1 && firstNewline !== chunkText.length - 1) {
        startPasteAccumulator(chunkText);
        return;
      }
    }

    for (const ch of chunkText) handleChar(ch);
  }

  function insertPasteAtCursor(rawPasteText) {
    // Normalise CRLF → LF and trim trailing blank lines from the
    // paste, but preserve the internal structure so the user sees
    // the pasted block laid out the way it was on the clipboard.
    // The multi-line redraw path positions the cursor across `\n`
    // boundaries correctly.
    const normalised = rawPasteText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+$/, '');
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
