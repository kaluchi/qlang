// How much of each file the window of a session holds. The transcript
// stores every read with the lines it returned and the lines the file
// had; a file whose length changed between reads starts its count
// again, and a compaction's summary empties the count, since the reads
// before it are gone from the window. Runs in a session on the
// maintainer's machine, since it reads the transcripts.
//
// Usage: node scripts/sensors/read-coverage.mjs [transcript]
// Without a transcript it reads the running session's.

import { recordsOf, sessionTranscript } from './transcripts.mjs';

const coverage = new Map();
for (const record of recordsOf(process.argv[2] ?? sessionTranscript())) {
  if (record.isCompactSummary) coverage.clear();
  const read = record.toolUseResult?.file;
  if (!read?.totalLines) continue;
  let seen = coverage.get(read.filePath);
  if (seen?.total !== read.totalLines) seen = { total: read.totalLines, lines: new Set() };
  for (let lineNumber = read.startLine; lineNumber < read.startLine + read.numLines; lineNumber++) seen.lines.add(lineNumber);
  coverage.set(read.filePath, seen);
}
for (const [path, { total, lines }] of coverage) {
  console.log(`${lines.size === total ? 'whole' : `${lines.size}/${total}`}\t${path}`);
}
