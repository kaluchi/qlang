// The line editor of the REPL, `start`ing, `prompt`ing, `submit`ting a
// line as if typed and `close`ing, which emits 'line' with each cell and
// 'close' at the end of the input or at Ctrl+D: in a terminal it reads
// keys in raw mode and repaints the buffer through `render`, its lines
// and wrapped rows among it, Enter or Alt+Enter submitting, Ctrl+Enter or
// Ctrl+J breaking a line, a paste, bracketed or a chunk longer than one
// character whose first line break is not its last, landing whole at
// the cursor, the arrows, Home, End, Ctrl+A and Ctrl+E moving across the
// lines, Up and Down at the first and the last line walking the history,
// Backspace and Delete erasing, Ctrl+C clearing and Ctrl+D on an empty
// buffer closing; over a pipe each line of the input is a cell.

import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const ENABLE_BRACKETED_PASTE  = ESC + '[?2004h';
const DISABLE_BRACKETED_PASTE = ESC + '[?2004l';
const HIDE_CURSOR             = ESC + '[?25l';
const SHOW_CURSOR             = ESC + '[?25h';
// Synchronized output, which a terminal that knows it presents as one
// frame and any other drops as an unknown sequence.
const BEGIN_SYNC              = ESC + '[?2026h';
const END_SYNC                = ESC + '[?2026l';

export function createLineEditor(stdinStream, stdoutWrite, options) {
  if (stdinStream.isTTY === true) {
    return createTtyLineEditor(stdinStream, stdoutWrite, options);
  }
  return createPipedLineEditor(stdinStream, stdoutWrite, options);
}

// ── The editor of a terminal ──────────────────────────────────

function createTtyLineEditor(stdinStream, stdoutWrite, { prompt, render, columns }) {
  const emitter = new EventEmitter();

  let buffer = '';
  let cursor = 0;
  let pasteMode = false;
  let pasteBuffer = '';
  let pendingEscape = '';

  // A decoder that holds a code point split across chunks until its last
  // byte arrives.
  const utf8Decoder = new StringDecoder('utf8');

  // The cells submitted, and a draft for each place of the history, the
  // last the line begun before any recall, which a walk away saves and a
  // walk back reads, cleared at a submit.
  const history = [];
  let historyIndex = 0;
  const historyDrafts = new Map();

  // The column a run of Up and Down across the lines aims at, which an
  // edit, a move along the line and a walk of the history reset.
  let desiredColumn = null;

  // The width of the prompt on screen, its colour escapes taking none.
  const promptVisibleLength = prompt.replace(/\x1b\[[0-9;]*m/g, '').length;

  // The rows the last repaint took, wrapped rows among them, and the row
  // it left the cursor on, counted from the first.
  let lastVisualRows = 0;
  let lastCursorRow  = 0;

  const getColumns = () => {
    const c = typeof columns === 'function' ? columns() : columns;
    return Number.isFinite(c) && c > 0 ? c : Infinity;
  };

  // The rows a line takes from its first column at a width, one at least
  // for an empty line.
  function visualRowsForLine(colStart, contentLen, width) {
    if (!Number.isFinite(width)) return 1;
    return Math.max(1, Math.ceil((colStart + contentLen) / width));
  }

  // The rows a buffer takes, its lines wrapped at the width.
  function countVisualRows(logicalLines, width) {
    let total = 0;
    for (let i = 0; i < logicalLines.length; i += 1) {
      const colStart = (i === 0) ? promptVisibleLength : 0;
      total += visualRowsForLine(colStart, logicalLines[i].length, width);
    }
    return total;
  }

  // The row and the column of the cursor's offset in the wrapped layout.
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

  // The paint of the last repaint, read again while the text stays.
  let paintedText = null;
  let painted = '';

  function paintOf(text) {
    if (text !== paintedText) {
      painted = render(text).replace(/(?<!\r)\n/g, '\r\n');
      paintedText = text;
    }
    return painted;
  }

  function redrawCurrentLine() {
    const width = getColumns();

    // The paint is computed before the frame opens and goes out in one
    // write inside a synchronized frame with the cursor hidden, each line
    // ending in CRLF, since raw mode moves the row alone at `\n`.
    const paintedBuffer = paintOf(buffer);
    const logicalLines  = buffer.split('\n');
    const totalRows     = countVisualRows(logicalLines, width);
    const cursorVisual  = locateCursorVisual(width);
    const rowsUp        = (totalRows - 1) - cursorVisual.row;

    let frame = BEGIN_SYNC + HIDE_CURSOR;
    // 1. The cursor walks up to the first row of the last repaint.
    if (lastCursorRow > 0) frame += ESC + `[${lastCursorRow}A`;
    // 2. Column 0, and everything below it cleared, wrapped rows among it.
    frame += '\r' + ESC + '[J';
    // 3. The prompt and the painted buffer.
    frame += prompt + paintedBuffer;
    // 4. Walk the hardware cursor to the visual position of `cursor`.
    if (rowsUp > 0) frame += ESC + `[${rowsUp}A`;
    frame += '\r';
    if (cursorVisual.col > 0) frame += ESC + `[${cursorVisual.col}C`;
    frame += SHOW_CURSOR + END_SYNC;
    stdoutWrite(frame);

    lastVisualRows = totalRows;
    lastCursorRow  = cursorVisual.row;
  }

  function submitCurrentLine() {
    const lineText = buffer;

    // The cursor walks to the last row of the block before the line ends,
    // so the answer prints below it.
    const rowsDown = (lastVisualRows - 1) - lastCursorRow;
    if (rowsDown > 0) stdoutWrite(ESC + `[${rowsDown}B`);
    stdoutWrite('\r\n');

    pushHistoryEntry(lineText);
    buffer = '';
    cursor = 0;
    historyIndex = history.length;
    historyDrafts.clear();
    desiredColumn = null;
    lastVisualRows = 0;
    lastCursorRow  = 0;
    emitter.emit('line', lineText);
  }

  function pushHistoryEntry(lineText) {
    if (lineText === '') return;
    if (history[history.length - 1] === lineText) return;
    history.push(lineText);
  }

  // The recall of the history, reached once a step its way is in range,
  // saves the draft of the place it leaves and loads the next place's, the
  // draft of the last place seeded when the walk leaves it.
  function recallHistoryPrev() {
    historyDrafts.set(historyIndex, buffer);
    historyIndex -= 1;
    buffer = bufferForHistoryIndex(historyIndex);
    cursor = buffer.length;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function recallHistoryNext() {
    historyDrafts.set(historyIndex, buffer);
    historyIndex += 1;
    buffer = bufferForHistoryIndex(historyIndex);
    cursor = buffer.length;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function bufferForHistoryIndex(i) {
    return historyDrafts.has(i) ? historyDrafts.get(i) : history[i];
  }

  // Up and Down cross the lines of the buffer, at its first or last line
  // walk the history, and with no entry that way go to Home or End, a
  // run of them keeping the column it aims at.

  function getLogicalCursorPosition() {
    const before = buffer.slice(0, cursor);
    const beforeLines = before.split('\n');
    return {
      lineIndex: beforeLines.length - 1,
      columnInLine: beforeLines[beforeLines.length - 1].length
    };
  }

  function setCursorAtLogicalPosition(lineIndex, columnInLine) {
    const lines = buffer.split('\n');
    let offset = 0;
    for (let i = 0; i < lineIndex; i += 1) {
      offset += lines[i].length + 1; // +1 for the `\n` separator
    }
    let column = Math.min(columnInLine, lines[lineIndex].length);
    // A column aimed from a line of other characters lands at the start
    // of a surrogate pair, never between its halves.
    if (column > 0 && column < lines[lineIndex].length) {
      const before = lines[lineIndex].charCodeAt(column - 1);
      const after  = lines[lineIndex].charCodeAt(column);
      if (before >= 0xd800 && before <= 0xdbff &&
          after  >= 0xdc00 && after  <= 0xdfff) {
        column -= 1;
      }
    }
    cursor = offset + column;
  }

  // The code units of the character before or at an offset, two for a
  // surrogate pair, so the cursor steps over a character whole.
  function codeUnitsForCharBefore(s, i) {
    if (i >= 2) {
      const lo = s.charCodeAt(i - 1);
      const hi = s.charCodeAt(i - 2);
      if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) return 2;
    }
    return 1;
  }
  function codeUnitsForCharAt(s, i) {
    if (i + 1 < s.length) {
      const hi = s.charCodeAt(i);
      const lo = s.charCodeAt(i + 1);
      if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) return 2;
    }
    return 1;
  }

  function arrowUp() {
    const { lineIndex, columnInLine } = getLogicalCursorPosition();
    if (lineIndex > 0) {
      if (desiredColumn === null) desiredColumn = columnInLine;
      setCursorAtLogicalPosition(lineIndex - 1, desiredColumn);
      redrawCurrentLine();
      return;
    }
    if (historyIndex > 0) {
      recallHistoryPrev();
      return;
    }
    cursor = 0;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function arrowDown() {
    const { lineIndex, columnInLine } = getLogicalCursorPosition();
    const totalLines = buffer.split('\n').length;
    if (lineIndex < totalLines - 1) {
      if (desiredColumn === null) desiredColumn = columnInLine;
      setCursorAtLogicalPosition(lineIndex + 1, desiredColumn);
      redrawCurrentLine();
      return;
    }
    if (historyIndex < history.length) {
      recallHistoryNext();
      return;
    }
    cursor = buffer.length;
    desiredColumn = null;
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

    // A control code and a byte of an escape are one code unit below
    // 0x80, read by `codePointAt(0)`, and any other character is inserted.
    const code = ch.codePointAt(0);
    if (code === 0x1b) { pendingEscape = ESC; return; }
    if (code === 0x03) { interruptCurrentLine();   return; }   // Ctrl+C
    if (code === 0x04) { closeOnEmptyBuffer();     return; }   // Ctrl+D
    if (code === 0x0d) { submitCurrentLine();      return; }   // Enter (CR) submits
    if (code === 0x0a) { insertNewlineAtCursor();  return; }   // Ctrl+Enter / Ctrl+J — soft newline
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
      // Alt+Enter, ESC then CR or LF, submits.
      pendingEscape = '';
      submitCurrentLine();
      return;
    }
    if (pendingEscape.length === 2 && pendingEscape[1] !== '[') {
      // ESC before anything but `[` drops the sequence, so a pending
      // escape past this point begins with `ESC[`.
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
      case ESC + '[A': arrowUp();   break;
      case ESC + '[B': arrowDown(); break;
    }
    pendingEscape = '';
  }

  function insertCharAtCursor(ch) {
    // The cursor advances by the code units of the character inserted.
    buffer = buffer.slice(0, cursor) + ch + buffer.slice(cursor);
    cursor += ch.length;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function insertNewlineAtCursor() {
    buffer = buffer.slice(0, cursor) + '\n' + buffer.slice(cursor);
    cursor += 1;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function backspaceAtCursor() {
    if (cursor === 0) return;
    const width = codeUnitsForCharBefore(buffer, cursor);
    buffer = buffer.slice(0, cursor - width) + buffer.slice(cursor);
    cursor -= width;
    desiredColumn = null;
    redrawCurrentLine();
  }

  function deleteAtCursor() {
    if (cursor >= buffer.length) return;
    const width = codeUnitsForCharAt(buffer, cursor);
    buffer = buffer.slice(0, cursor) + buffer.slice(cursor + width);
    desiredColumn = null;
    redrawCurrentLine();
  }

  function moveCursorLeft() {
    if (cursor === 0) return;
    cursor -= codeUnitsForCharBefore(buffer, cursor);
    desiredColumn = null;
    redrawCurrentLine();
  }
  function moveCursorRight() {
    if (cursor >= buffer.length) return;
    cursor += codeUnitsForCharAt(buffer, cursor);
    desiredColumn = null;
    redrawCurrentLine();
  }
  function moveCursorHome()  { cursor = 0;             desiredColumn = null; redrawCurrentLine(); }
  function moveCursorEnd()   { cursor = buffer.length; desiredColumn = null; redrawCurrentLine(); }

  function interruptCurrentLine() {
    // ^C prints on a line below the block, and the prompt starts empty.
    const rowsDown = (lastVisualRows - 1) - lastCursorRow;
    if (rowsDown > 0) stdoutWrite(ESC + `[${rowsDown}B`);
    stdoutWrite('\r\n^C\r\n');
    buffer = '';
    cursor = 0;
    historyIndex = history.length;
    historyDrafts.clear();
    desiredColumn = null;
    lastVisualRows = 0;
    lastCursorRow  = 0;
    redrawCurrentLine();
  }

  function closeOnEmptyBuffer() {
    if (buffer.length === 0) emitter.emit('close');
  }

  // A paste a host hands over in several chunks gathers here, each chunk
  // of a paste arriving within the window after the last joining it, and
  // lands at the cursor as one paste [D204].
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
    // The text of the chunk, a code point split across chunks completed by the next.
    const chunkText = utf8Decoder.write(chunk);
    if (chunkText.length === 0) return;

    // A key, a chunk of one character or one that begins with an escape, a
    // line break handed over alone among them, ends the gathering and is
    // read as the key it is, and any other chunk joins the paste.
    if (pasteAccumBuffer.length > 0) {
      if (chunkText.length > 1 && chunkText[0] !== ESC) {
        continuePasteAccumulator(chunkText);
        return;
      }
      clearTimeout(pasteAccumTimer);
      pasteAccumTimer = null;
      flushPasteAccumulator();
    }

    // An escape pending alone before a chunk of several characters that
    // does not begin with `[` is the Escape key, which does nothing.
    if (pendingEscape === ESC && chunkText.length > 1 && chunkText[0] !== '[') pendingEscape = '';

    // A chunk longer than one character whose first line break is not its
    // last character starts the gathering, unless a bracketed paste or an
    // escape sequence is under way, and a typed line ending in a line
    // break is keys.
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
    // A paste lands with its CRLF read as LF and its trailing blank lines
    // dropped, its lines as the clipboard held them.
    const normalised = rawPasteText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+$/, '');
    buffer = buffer.slice(0, cursor) + normalised + buffer.slice(cursor);
    cursor += normalised.length;
    desiredColumn = null;
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
    stdoutWrite(SHOW_CURSOR);
    stdoutWrite(DISABLE_BRACKETED_PASTE);
    stdinStream.setRawMode(false);
    stdinStream.removeListener('data', onData);
  };

  emitter.prompt = redrawCurrentLine;
  // A line the caller submits as if typed: shown after the prompt, kept
  // in the history, and emitted as a line.
  emitter.submit = function submit(lineText) {
    stdoutWrite(prompt + render(lineText).replace(/(?<!\r)\n/g, '\r\n') + '\r\n');
    pushHistoryEntry(lineText);
    historyIndex = history.length;
    emitter.emit('line', lineText);
  };
  return emitter;
}

// ── The editor of a pipe ──────────────────────────────────────

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

  emitter.submit = function submit(lineText) {
    stdoutWrite(prompt + lineText + '\n');
    emitter.emit('line', lineText);
  };

  return emitter;
}
