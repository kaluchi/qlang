// Script to add "expect" fields to conformance error test cases.
// Evaluates each query, renders the error value as !{...} literal,
// verifies round-trip, and writes back.

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { evalQuery } from '../src/eval.mjs';
import { isErrorValue, keyword } from '../src/types.mjs';

const dir = 'test/conformance';
const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.jsonl'));
let updated = 0;

function renderQlangValue(v) {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (v && v.type === 'keyword') return ':' + v.name;
  if (v instanceof Map) {
    const entries = [];
    for (const [k, val] of v) {
      entries.push(':' + k.name + ' ' + renderQlangValue(val));
    }
    return '{' + entries.join(' ') + '}';
  }
  if (Array.isArray(v)) {
    return '[' + v.map(renderQlangValue).join(' ') + ']';
  }
  return String(v);
}

function renderErrorLiteral(errorValue) {
  const d = errorValue.descriptor;
  const parts = [];
  for (const [k, v] of d) {
    parts.push(':' + k.name + ' ' + renderQlangValue(v));
  }
  return '!{' + parts.join(' ') + '}';
}

for (const file of files) {
  const path = join(dir, file);
  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  let changed = false;
  const newLines = lines.map(line => {
    if (!line.trim() || line.trim().startsWith('//')) return line;
    let test;
    try { test = JSON.parse(line); } catch { return line; }
    if (!test.error || test.expect !== undefined) return line;

    let result;
    try { result = evalQuery(test.query); } catch(e) {
      console.log('SKIP (threw):', test.name, e.message.slice(0, 60));
      return line;
    }
    if (!isErrorValue(result)) {
      console.log('SKIP (not error):', test.name);
      return line;
    }

    const expectValue = renderErrorLiteral(result);

    // Verify round-trip
    try {
      const rt = evalQuery(expectValue);
      if (!isErrorValue(rt)) {
        console.log('SKIP (round-trip not error):', test.name);
        return line;
      }
    } catch(e) {
      console.log('SKIP (round-trip parse fail):', test.name, e.message.slice(0, 60));
      return line;
    }

    test.expect = expectValue;
    changed = true;
    updated++;
    return JSON.stringify(test);
  });

  if (changed) {
    writeFileSync(path, newLines.join('\n'));
    console.log(`Updated ${file}`);
  }
}
console.log(`\nTotal: ${updated} test cases updated`);
