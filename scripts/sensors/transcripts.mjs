// Where the transcripts of this project live and how their records
// read. Claude Code keeps one `.jsonl` file per session under its
// configuration directory, `$CLAUDE_CONFIG_DIR` or `~/.claude`, in
// `projects/` and the working directory with every character but a
// letter or a digit written `-`. The transcripts live on the maintainer's
// machine alone, so every sensor that reads them runs in a session there
// and nowhere else.
// The decisions it exists for: [QSWRK#documents].

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';

export const repoRoot = join(import.meta.dirname, '..', '..');

// The directories that hold the transcripts of the project: those
// `QLANG_TRANSCRIPTS` names, written as a list of paths is, or else the
// configuration directory a session runs under, every configuration
// directory beside it and `~/.claude`, so a sensor reads every session
// the machine keeps, whichever configuration ran it [QSWRK#documents].
export function transcriptDirs() {
  if (process.env.QLANG_TRANSCRIPTS) return process.env.QLANG_TRANSCRIPTS.split(delimiter).filter(dir => dir !== '' && existsSync(dir));
  const home = join(homedir(), '.claude');
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? home;
  const beside = process.env.CLAUDE_CONFIG_DIR === undefined ? [] : readdirSync(dirname(configDir), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => join(dirname(configDir), entry.name));
  const project = repoRoot.replace(/[^A-Za-z0-9]/g, '-');
  return [...new Set([configDir, ...beside, home].map(dir => join(dir, 'projects', project)))].filter(existsSync);
}

// The transcript of a session, the running one when none is named, in the
// directory that holds it, or in the first where none does.
export function sessionTranscript(sessionId = process.env.CLAUDE_CODE_SESSION_ID) {
  if (sessionId === undefined) throw new Error('no session named, and CLAUDE_CODE_SESSION_ID is unset outside a session');
  const paths = transcriptDirs().map(dir => join(dir, `${sessionId}.jsonl`));
  return paths.find(existsSync) ?? paths[0];
}

export function transcriptFiles() {
  return transcriptDirs().flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.jsonl')).map(name => join(dir, name)))
    .sort((left, right) => basename(left).localeCompare(basename(right)));
}

// How many transcripts each directory gave, so a search that read a part
// of the sessions says which part [QSWRK#documents].
export function transcriptCoverage() {
  const counts = transcriptDirs().map(dir => `${dir} ${readdirSync(dir).filter(name => name.endsWith('.jsonl')).length}`);
  return `transcripts read: ${counts.length === 0 ? 'none, no directory holds one' : counts.join(' · ')}`;
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
// of a compaction and none the harness wrote, the echo of a local command
// or a report a subagent handed back, or a message queued while the model
// worked.
export function* typedByMaintainer(record) {
  if (record.type === 'queue-operation' && record.operation === 'enqueue') yield typedAfterPaste(record.content);
  if (record.type !== 'user' || record.isCompactSummary || record.isMeta) return;
  const content = record.message?.content;
  if (typeof content === 'string') yield typedAfterPaste(content);
  else for (const part of content ?? []) if (part.type === 'text') yield typedAfterPaste(part.text);
}

// The words a message holds after the pastes that open it, which the
// maintainer handed and did not type.
const LEADING_PASTES = /^\s*(?:<pasted_content id="[^"]*">[\s\S]*?<\/pasted_content id="[^"]*">\s*)+/;
const typedAfterPaste = text => (typeof text === 'string' ? text.replace(LEADING_PASTES, '') : text);
