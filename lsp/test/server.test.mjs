// The process the editor launches: the server starts over stdio and
// answers `initialize` with its capabilities, which a test of the
// features alone never reaches, since those import `features.mjs` and
// leave the server's own imports unread, it reads each source of the
// language where the core's package exports it [QSHST#source], and it maps
// the role of a declaration to the kinds of the protocol [QSHST#tools].
// The rules it holds: [QSWRK#tooling], [QSHST#tools].

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver/node';

const lspDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(lspDir, 'src', 'server.mjs');

function framedMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

// The messages the server writes, one per frame, until the one that
// answers `id`; the process exiting first is the failure, its stderr
// the reason.
function answerOf(serverProcess, id) {
  return new Promise((resolve, reject) => {
    let pending = Buffer.alloc(0);
    let stderrText = '';
    serverProcess.stderr.on('data', chunk => { stderrText += chunk.toString('utf8'); });
    serverProcess.on('exit', code => reject(new Error(`the server exited with ${code}: ${stderrText}`)));
    serverProcess.stdout.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const headerEnd = pending.indexOf('\r\n\r\n');
        if (headerEnd < 0) return;
        const contentLength = Number(/Content-Length: (\d+)/i.exec(pending.subarray(0, headerEnd).toString('utf8'))[1]);
        const bodyStart = headerEnd + 4;
        if (pending.length < bodyStart + contentLength) return;
        const message = JSON.parse(pending.subarray(bodyStart, bodyStart + contentLength).toString('utf8'));
        pending = pending.subarray(bodyStart + contentLength);
        if (message.id === id) resolve(message);
      }
    });
  });
}

describe('the language server process', () => {
  it('starts over stdio and answers initialize with its capabilities', async () => {
    const serverProcess = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      const answer = answerOf(serverProcess, 1);
      serverProcess.stdin.write(framedMessage({
        jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} }
      }));
      const response = await answer;
      expect(response.result.capabilities.hoverProvider).toBe(true);
      expect(response.result.capabilities.signatureHelpProvider.triggerCharacters).toEqual([' ']);
    } finally {
      serverProcess.kill();
    }
  }, 30_000);

  it('names a declaration of a document by its role, a verb a function, a value a variable and a label a struct of the protocol [QSHST#tools]', async () => {
    const serverProcess = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      const initialized = answerOf(serverProcess, 1);
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } }));
      await initialized;
      const uri = 'file:///roles.qlang';
      const text = ':Box |~~ A box. ~~| | :Box/area ~(1) | :n 1 | n';
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'qlang', version: 1, text } } }));
      const symbols = answerOf(serverProcess, 2);
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 2, method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }));
      expect((await symbols).result.map(({ name, kind }) => [name, kind])).toEqual([['::Box', SymbolKind.Struct], ['Box/area', SymbolKind.Function], ['n', SymbolKind.Variable]]);
      const completions = answerOf(serverProcess, 3);
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 3, method: 'textDocument/completion', params: { textDocument: { uri }, position: { line: 0, character: text.length } } }));
      const kinds = new Map((await completions).result.map(({ label, kind }) => [label, kind]));
      expect(['area', 'n', '::Box'].map(label => kinds.get(label))).toEqual([CompletionItemKind.Function, CompletionItemKind.Variable, CompletionItemKind.Struct]);
    } finally {
      serverProcess.kill();
    }
  }, 30_000);

  it('answers goto-definition of a verb of the language with the file of its source the core\'s package exports, wherever the server stands', async () => {
    // A copy of the server outside the repository, which reaches the
    // packages it depends on and no workspace beside it.
    const outside = mkdtempSync(join(tmpdir(), 'qlang-lsp-'));
    cpSync(join(lspDir, 'src'), join(outside, 'src'), { recursive: true });
    symlinkSync(join(lspDir, '..', 'node_modules'), join(outside, 'node_modules'), 'junction');
    const serverProcess = spawn(process.execPath, [join(outside, 'src', 'server.mjs'), '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      const initialized = answerOf(serverProcess, 1);
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } }));
      await initialized;
      const uri = 'file:///probe.qlang';
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'qlang', version: 1, text: '[1 2] | vec/count' } } }));
      const definition = answerOf(serverProcess, 2);
      serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 2, method: 'textDocument/definition', params: { textDocument: { uri }, position: { line: 0, character: 10 } } }));
      const { uri: sourceUri } = (await definition).result;
      expect(sourceUri.startsWith(new URL('.', import.meta.resolve('@kaluchi/qlang-core/lib/qlang/vec.qlang')).href) && sourceUri.endsWith('.qlang')).toBe(true);
    } finally {
      if (serverProcess.exitCode === null) await new Promise(resolve => { serverProcess.once('exit', resolve); serverProcess.kill(); });
      rmSync(outside, { recursive: true, force: true, maxRetries: 5 });
    }
  }, 30_000);
});
