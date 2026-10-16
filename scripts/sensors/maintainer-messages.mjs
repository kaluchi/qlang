// Every message the maintainer typed, across the transcripts of the
// project, one JSON line each: session, time, text, and on the standard
// error the directories read and how many transcripts each gave [D336].
// Runs in a session on the maintainer's machine, since it reads the
// transcripts.
//
// Usage: node scripts/sensors/maintainer-messages.mjs
// The decisions it exists for: [QSWRK#journal], [QSWRK#documents].

import { recordsOf, transcriptCoverage, transcriptFiles, typedByMaintainer } from './transcripts.mjs';

process.stderr.write(`${transcriptCoverage()}\n`);

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
