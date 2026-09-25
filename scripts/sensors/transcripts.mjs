// Where the transcripts of this project live and how their records
// read. Claude Code keeps one `.jsonl` file per session under its
// configuration directory, `$CLAUDE_CONFIG_DIR` or `~/.claude`, in
// `projects/` and the working directory with every character but a
// letter or a digit written `-`; `QLANG_TRANSCRIPTS` names another
// directory. The transcripts live on the maintainer's machine alone, so
// every sensor that reads them runs in a session there and nowhere else.

import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const repoRoot = join(import.meta.dirname, '..', '..');

export function transcriptsDir() {
  if (process.env.QLANG_TRANSCRIPTS) return process.env.QLANG_TRANSCRIPTS;
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  return join(configDir, 'projects', repoRoot.replace(/[^A-Za-z0-9]/g, '-'));
}

// The transcript of a session, the running one when none is named.
export function sessionTranscript(sessionId = process.env.CLAUDE_CODE_SESSION_ID) {
  if (sessionId === undefined) throw new Error('no session named, and CLAUDE_CODE_SESSION_ID is unset outside a session');
  return join(transcriptsDir(), `${sessionId}.jsonl`);
}

export function transcriptFiles() {
  return readdirSync(transcriptsDir()).filter(name => name.endsWith('.jsonl')).sort().map(name => join(transcriptsDir(), name));
}

// A line that is no record, a torn last line of a running session among
// them, reads as none.
export function* recordsOf(transcriptPath) {
  for (const line of readFileSync(transcriptPath, 'utf8').split(/\r?\n/)) {
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    yield record;
  }
}

// What the maintainer typed: a record of kind `user` that is no summary
// of a compaction, or a message queued while the model worked.
export function* typedByMaintainer(record) {
  if (record.type === 'queue-operation' && record.operation === 'enqueue') yield record.content;
  if (record.type !== 'user' || record.isCompactSummary) return;
  const content = record.message?.content;
  if (typeof content === 'string') yield content;
  else for (const part of content ?? []) if (part.type === 'text') yield part.text;
}
