// One-shot migration: backtick `...` Quote literal → `~{...}` paired
// form, applied only inside single/double-quoted JS strings of the
// input file. Template literals, JS comments, and raw source outside
// quotes are left untouched.
//
// Strategy: tokenize the file into segments
//   - line comment        // ... \n
//   - block comment       /* ... */
//   - template literal    `...`           (with ${...} interpolation)
//   - single/double JS string '...' "..."  ← sweep target
//   - other source        (verbatim)
// The sweep regex /`([^`]*)`/g runs only on the content of the JS-string
// segments. Within a JS-string body, every backtick-pair is treated as
// a qlang Quote literal and rewritten to ~{...}.
//
// Usage: node scripts/sweep-quotes.mjs <file> [<file>...]

import { readFileSync, writeFileSync } from 'node:fs';

function sweepFile(src) {
  const N = src.length;
  let out = '';
  let i = 0;

  while (i < N) {
    const ch = src[i];

    if (ch === '/' && src[i + 1] === '/') {
      const eol = src.indexOf('\n', i);
      const end = eol === -1 ? N : eol;
      out += src.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close === -1 ? N : close + 2;
      out += src.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '`') {
      let j = i + 1;
      while (j < N) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1;
          j += 2;
          while (j < N && depth > 0) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            j++;
          }
          continue;
        }
        j++;
      }
      const end = j < N ? j + 1 : N;
      out += src.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let body = '';
      while (j < N) {
        if (src[j] === '\\') {
          body += src[j] + (j + 1 < N ? src[j + 1] : '');
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        if (src[j] === '\n') break;
        body += src[j];
        j++;
      }
      const swept = body.replace(/`([^`]*)`/g, '~{$1}');
      out += quote + swept + (j < N && src[j] === quote ? quote : '');
      i = j + 1;
      continue;
    }

    out += ch;
    i++;
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
