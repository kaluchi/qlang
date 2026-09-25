// Every message the maintainer typed, across the transcripts of the
// project, one JSON line each: session, time, text. Runs in a session on
// the maintainer's machine, since it reads the transcripts.
//
// Usage: node scripts/sensors/maintainer-messages.mjs

import { recordsOf, transcriptFiles, typedByMaintainer } from './transcripts.mjs';

for (const transcriptPath of transcriptFiles()) {
  const session = transcriptPath.split(/[\\/]/).pop().slice(0, 8);
  for (const record of recordsOf(transcriptPath)) {
    for (const text of typedByMaintainer(record)) {
      if (typeof text === 'string' && !text.startsWith('<') && text.trim()) {
        console.log(JSON.stringify({ session, at: record.timestamp, text }));
      }
    }
  }
}
