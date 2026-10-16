// The record that called for a run of the research holds it under `Runs.`,
// the journal and the worklog of the work: a line for each run, the report,
// what it is, the tree it read and the baseline that tree stood on, when it
// ran and why, below what the record says and above its links
// [QSWRK#journal], [QSWRK#review].

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOURNAL } from './decision-records.mjs';

// runLine({ report, kind, tree, baseline, date, from, to, why }) → the line
// of one run, `report` its path from the root of the repository.
export function runLine({ report, kind, tree, baseline, date, from, to, why = null }) {
  const on = baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\``;
  return `- \`${report}\`, ${kind}, on the tree \`${tree}\` ${on}, ${date}, ${from}–${to} UTC${why === null ? '' : `: ${why}`}.`;
}

// holdTheRun(repoRoot, record, line) → writes the line under `Runs.` of the
// record, opening the field where the record holds none.
export function holdTheRun(repoRoot, record, line) {
  const path = join(repoRoot, JOURNAL, `${record}.md`);
  const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  if (lines.includes(line)) return;
  const runsAt = lines.findIndex(text => text.startsWith('Runs.'));
  if (runsAt !== -1) {
    let end = runsAt + 1;
    while (end < lines.length && (lines[end].startsWith('- ') || lines[end].startsWith('  '))) end += 1;
    lines.splice(end, 0, line);
  } else {
    let linksAt = lines.length;
    while (linksAt > 0 && /^\[[^\]]+\]: /.test(lines[linksAt - 1])) linksAt -= 1;
    const at = linksAt < lines.length && lines[linksAt - 1] === '' ? linksAt - 1 : lines.length;
    lines.splice(at, 0, 'Runs. The reports of the research this record called for, each beside its reading:', line);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}
