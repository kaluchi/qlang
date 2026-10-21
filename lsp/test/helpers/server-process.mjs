// The language server run over stdio in a process of its own, a message
// framed by its length and the answer to it [QSLSP#server].

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function framedMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

// The messages the server writes, one per frame, until the one that
// answers `id`; the process exiting first is the failure, its stderr
// the reason.
export function answerOf(serverProcess, id) {
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

export const lspDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const serverPath = join(lspDir, 'src', 'server.mjs');
