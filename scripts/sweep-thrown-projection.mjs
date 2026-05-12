// JSONL fixtures with `!| /thrown` or `| /thrown` projections return
// the `:thrown` field of an error-value. After M4 that field carries
// a TagKeyword whose printValue surface is `::Foo`. Expected values
// in test entries must match the new shape — sweep `:CapitalIdent`
// → `::CapitalIdent` only when the query is a /thrown projection.

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const lines = before.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    const q = entry.query;
    const e = entry.expect;
    if (typeof q !== 'string' || typeof e !== 'string') continue;
    if (!/\/thrown\s*$/.test(q)) continue;
    const newExpect = e.replace(/^:([A-Z][A-Za-z0-9_]*)$/, '::$1');
    if (newExpect !== e) {
      entry.expect = newExpect;
      lines[i] = JSON.stringify(entry);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(file, lines.join('\n'));
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
