// The process the editor launches: the server starts over stdio and
// answers `initialize` with its capabilities, which a test of the
// features alone never reaches, since those import `features.mjs` and
// leave the server's own imports unread.

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const serverPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.mjs');

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
    } finally {
      serverProcess.kill();
    }
  }, 30_000);
});
