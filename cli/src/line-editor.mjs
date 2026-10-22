import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';

const ESC = '\x1b';
const BRACKETED_PASTE_BEGIN = ESC + '[200~';
const BRACKETED_PASTE_END   = ESC + '[201~';
const ENABLE_BRACKETED_PASTE  = ESC + '[?2004h';
const DISABLE_BRACKETED_PASTE = ESC + '[?2004l';
const HIDE_CURSOR             = ESC + '[?25l';
const SHOW_CURSOR             = ESC + '[?25h';
const BEGIN_SYNC              = ESC + '[?2026h';
const END_SYNC                = ESC + '[?2026l';

export function createLineEditor(stdinStream, stdoutWrite, options) {
  if (stdinStream.isTTY === true) {
    return createTtyLineEditor(stdinStream, stdoutWrite, options);
  }
  return createPipedLineEditor(stdinStream, stdoutWrite, options);
}

function createTtyLineEditor(stdinStream, stdoutWrite, { prompt, render, columns }) {
  const emitter = new EventEmitter();

  let buffer = '';
  let cursor = 0;
  let pasteMode = false;
  let pasteBuffer = '';
  let pendingEscape = '';

  const utf8Decoder = new StringDecoder('utf8');

  const history = [];
  let historyIndex = 0;
  const historyDrafts = new Map();

  let desiredColumn = null;

  const promptVisibleLength = prompt.replace(/\x1b\[[0-9;]*m/g, '').length;

  let lastVisualRows = 0;
  let lastCursorRow  = 0;

  const getColumns = () => {
    const c = typeof columns === 'function' ? columns() : columns;
    return Number.isFinite(c) && c > 0 ? c : Infinity;
  };

  function visualRowsForLine(colStart, contentLen, width) {
    if (!Number.isFinite(width)) return 1;
    return Math.max(1, Math.ceil((colStart + contentLen) / width));
  }

  function countVisualRows(logicalLines, width) {
    let total = 0;
    for (let i = 0; i < logicalLines.length; i += 1) {
      const colStart = (i === 0) ? promptVisibleLength : 0;
      total += visualRowsForLine(colStart, logicalLines[i].length, width);
    }
    return total;
  }

  function locateCursorVisual(width) {
    const before = buffer.slice(0, cursor);
    const beforeLines = before.split('\n');
    const cursorLogicalRow = beforeLines.length - 1;
    const cursorLogicalCol = beforeLines[cursorLogicalRow].length;

    let visualRowsBefore = 0;
    for (let i = 0; i < cursorLogicalRow; i += 1) {
      const colStart = (i === 0) ? promptVisibleLength : 0;
      visualRowsBefore += visualRowsForLine(colStart, beforeLines[i].length, width);
    }

    const colStart = (cursorLogicalRow === 0) ? promptVisibleLength : 0;
    const total    = colStart + cursorLogicalCol;
    const rowInLine = Number.isFinite(width) ? Math.floor(total / width) : 0;
    const colInRow  = Number.isFinite(width) ? (total % width)           : total;

    return {
      row: visualRowsBefore + rowInLine,
      col: colInRow
    };
  }

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

    const paintedBuffer = paintOf(buffer);
    const logicalLines  = buffer.split('\n');
    const totalRows     = countVisualRows(logicalLines, width);
    const cursorVisual  = locateCursorVisual(width);
    const rowsUp        = (totalRows - 1) - cursorVisual.row;

    let frame = BEGIN_SYNC + HIDE_CURSOR;
    if (lastCursorRow > 0) frame += ESC + `[${lastCursorRow}A`;
    frame += '\r' + ESC + '[J';
    frame += prompt + paintedBuffer;
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
      offset += lines[i].length + 1;
    }
    let column = Math.min(columnInLine, lines[lineIndex].length);
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
      if (ch === ESC) { pendingEscape = ESC; return; }
      pendingEscape += ch;
      tryConsumeEscapeSequence();
      return;
    }

    const code = ch.codePointAt(0);
    if (code === 0x1b) { pendingEscape = ESC; return; }
    if (code === 0x03) { interruptCurrentLine();   return; }
    if (code === 0x04) { closeOnEmptyBuffer();     return; }
    if (code === 0x0d) { submitCurrentLine();      return; }
    if (code === 0x0a) { insertNewlineAtCursor();  return; }
    if (code === 0x08 || code === 0x7f) { backspaceAtCursor();  return; }
    if (code === 0x01) { moveCursorHome(); return; }
    if (code === 0x05) { moveCursorEnd();  return; }

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
      pendingEscape = '';
      submitCurrentLine();
      return;
    }
    if (pendingEscape[1] !== '[') {
      pendingEscape = '';
      return;
    }
    const tail = pendingEscape[pendingEscape.length - 1];
    if (!/[A-Za-z~]/.test(tail)) return;

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

  // [QSCLI#line-editor]
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
    const chunkText = utf8Decoder.write(chunk);
    if (chunkText.length === 0) return;

    const typedAlone = [...chunkText].length === 1;
    const keys = typedAlone || chunkText[0] === ESC;

    if (pasteAccumBuffer.length > 0) {
      if (!keys) {
        continuePasteAccumulator(chunkText);
        return;
      }
      clearTimeout(pasteAccumTimer);
      pasteAccumTimer = null;
      flushPasteAccumulator();
    }

    if (pendingEscape === ESC && !typedAlone && chunkText[0] !== '[') pendingEscape = '';

    if (!keys && !pasteMode && pendingEscape.length === 0) {
      const firstNewline = chunkText.indexOf('\n');
      if (firstNewline !== -1 && firstNewline !== chunkText.length - 1) {
        startPasteAccumulator(chunkText);
        return;
      }
    }

    for (const ch of chunkText) handleChar(ch);
  }

  function insertPasteAtCursor(rawPasteText) {
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
    return text.replaceAll(BRACKETED_PASTE_BEGIN, '').replaceAll(BRACKETED_PASTE_END, '');
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
  emitter.submit = function submit(lineText) {
    stdoutWrite(prompt + render(lineText).replace(/(?<!\r)\n/g, '\r\n') + '\r\n');
    pushHistoryEntry(lineText);
    historyIndex = history.length;
    emitter.emit('line', lineText);
  };
  return emitter;
}

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
