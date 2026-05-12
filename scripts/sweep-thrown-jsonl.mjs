// Migrate `:thrown :Foo` → `:thrown ::Foo` (BareTypeKeyword)
// in conformance JSONL expected values. After M4 the runtime
// stamps `:thrown` as a TagKeyword whose printValue surface is
// `::Foo`; the expected-source strings must align.

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/:thrown\s+:([A-Z][A-Za-z0-9_]*)/g, ':thrown ::$1');
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
