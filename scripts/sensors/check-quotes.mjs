// Holds every «…» quote of the documents against the messages the
// maintainer typed, in every transcript of the project. A quote matches
// up to whitespace; an elision is written […] and each fragment around
// it is looked up alone. Fenced blocks are code and are skipped. Runs in
// a session on the maintainer's machine, since it reads the transcripts.
//
// Usage: node scripts/sensors/check-quotes.mjs [document ...]
// Without documents it reads the audit, the entrypoint and the records
// of docs/decisions.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { recordsOf, repoRoot, transcriptFiles, typedByMaintainer } from './transcripts.mjs';

const squash = text => text.replace(/\s+/g, ' ').trim();
const decisionsDir = join(repoRoot, 'docs', 'decisions');
const documents = process.argv.length > 2 ? process.argv.slice(2) : [
  join(repoRoot, 'docs', 'qlang-audit.md'),
  join(repoRoot, 'docs', 'qlang-entrypoint.md'),
  ...readdirSync(decisionsDir).filter(name => name.endsWith('.md')).map(name => join(decisionsDir, name)),
];

const messages = [];
for (const transcriptPath of transcriptFiles()) {
  const session = transcriptPath.split(/[\\/]/).pop().slice(0, 8);
  for (const record of recordsOf(transcriptPath)) {
    for (const text of typedByMaintainer(record)) {
      if (typeof text === 'string' && !text.startsWith('<')) {
        messages.push({ session, at: record.timestamp.slice(0, 16), text: squash(text) });
      }
    }
  }
}

for (const documentPath of documents) {
  const shownPath = relative(repoRoot, documentPath).split(/[\\/]/).join('/');
  const prose = readFileSync(documentPath, 'utf8')
    .replace(/^```[\s\S]*?^```/gm, fenced => fenced.replace(/[^\n]/g, ' '));
  for (const quoted of prose.matchAll(/«([^»]+)»/g)) {
    const fragments = squash(quoted[1]).split(/\s*\[…\]\s*/).filter(Boolean);
    const found = messages.find(message => fragments.every(fragment => message.text.includes(fragment)));
    const lineNumber = prose.slice(0, quoted.index).split('\n').length;
    console.log(found
      ? `ok    ${shownPath}:${lineNumber}  ${found.session} ${found.at}`
      : `miss  ${shownPath}:${lineNumber}  «${squash(quoted[1]).slice(0, 80)}»`);
  }
}
