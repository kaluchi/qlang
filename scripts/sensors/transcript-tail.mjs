// The dialogue of a session after a moment: both sides' text and the
// messages queued while the model worked, leaving out side chains and
// the summaries of compaction, which the model wrote. Without indices it
// lists `index time role length head`; with `i j` it prints entries i to
// j whole. After a compaction it restores, word for word, the
// conversation the summary retold. Runs in a session on the
// maintainer's machine, since it reads the transcripts.
//
// Usage: node scripts/sensors/transcript-tail.mjs <isoAfter> [i j] [--session <uuid>]

import { recordsOf, sessionTranscript } from './transcripts.mjs';

const sessionAt = process.argv.indexOf('--session');
const positional = process.argv.slice(2).filter((argument, index, all) => argument !== '--session' && all[index - 1] !== '--session');
const [isoAfter, from, to] = positional;
const transcriptPath = sessionTranscript(sessionAt < 0 ? undefined : process.argv[sessionAt + 1]);

const entries = [];
for (const record of recordsOf(transcriptPath)) {
  if (!record.timestamp || record.timestamp <= isoAfter || record.isSidechain || record.isCompactSummary) continue;
  if (record.type === 'queue-operation' && record.operation === 'enqueue' && typeof record.content === 'string') {
    entries.push({ time: record.timestamp, role: 'queued', text: record.content });
    continue;
  }
  const message = record.message;
  if (!message || (message.role !== 'user' && message.role !== 'assistant')) continue;
  const parts = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content ?? [];
  for (const part of parts) {
    if (part.type === 'text' && part.text.trim()) entries.push({ time: record.timestamp, role: message.role, text: part.text });
  }
}
if (from === undefined) {
  entries.forEach((entry, index) => console.log(index, entry.time.slice(5, 16), entry.role, entry.text.length,
    entry.text.replace(/\s+/g, ' ').slice(0, 110)));
} else {
  for (let index = Number(from); index <= Number(to); index += 1) {
    console.log(`--- ${index} ${entries[index].time} ${entries[index].role}\n${entries[index].text}`);
  }
}
