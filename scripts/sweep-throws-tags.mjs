// One-shot migration: `:throws [:Tag ...]` Vec-of-keywords →
// `:throws [::Tag ...]` Vec-of-BareTypeKeyword. Named-error
// references in catalog descriptors gain navigable hypertext
// identity — each `::Tag` resolves to its type-binding through
// the same axis-operands as any other type-namespace identifier.
//
// Usage: node scripts/sweep-throws-tags.mjs <file> [<file>...]
//
// Strategy: regex match within a `:throws [...]` Vec. Each
// element starts with `:` and a capitalized identifier letter.
// Rewrite to `::` prefix. Multi-line Vec content handled by
// matching until the closing `]`.

import { readFileSync, writeFileSync } from 'node:fs';

function sweepFile(source) {
  // Locate every `:throws [` occurrence, find the matching `]`,
  // and rewrite `:CapIdent` → `::CapIdent` inside.
  let out = '';
  let i = 0;
  const N = source.length;
  while (i < N) {
    const idx = source.indexOf(':throws', i);
    if (idx < 0) { out += source.slice(i); break; }
    // Walk to opening `[`.
    let j = idx + ':throws'.length;
    while (j < N && /\s/.test(source[j])) j++;
    if (source[j] !== '[') {
      out += source.slice(i, j);
      i = j;
      continue;
    }
    // Find matching `]`.
    let depth = 1;
    let k = j + 1;
    while (k < N && depth > 0) {
      if (source[k] === '[') depth++;
      else if (source[k] === ']') depth--;
      if (depth === 0) break;
      k++;
    }
    if (k >= N) { out += source.slice(i); break; }
    // Body is source[j+1..k] (exclusive of `]`).
    const before = source.slice(i, j + 1);  // includes `:throws [`
    const body = source.slice(j + 1, k);
    const tail = ']';
    // Rewrite `:CapIdent` → `::CapIdent`, but NOT `::CapIdent`
    // (already converted) and NOT `:lowercase`.
    const newBody = body.replace(/(?<!:):([A-Z][A-Za-z0-9_]*)/g, '::$1');
    out += before + newBody + tail;
    i = k + 1;
  }
  return out;
}

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = sweepFile(before);
  if (before !== after) {
    writeFileSync(file, after);
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
