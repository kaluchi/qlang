// One-shot migration: `::assertion[~{a} ~{b}]` → `~{a | eq(b)}`.
//
// Each assertion segment in a Doc-content becomes a single Quote-as-test
// whose truthiness drives pass / fail. runExamples / examples axis
// switch to extracting every Quote in the doc string — no
// `:qlang/kind :assertion` privilege — so the doc-content canon
// collapses to `:Prose` / `:Quote` only.
//
// Usage: node scripts/sweep-assertions.mjs <file> [<file>...]

import { readFileSync, writeFileSync } from 'node:fs';

function findQuoteEnd(s, start) {
  if (s[start] !== '~' || s[start + 1] !== '{') return -1;
  let i = start + 2;
  let depth = 1;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length) i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '~' && s[i + 1] === '{') { depth++; i += 2; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

function transformAssertions(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.slice(i, i + 12) === '::assertion[') {
      let p = i + 12;
      while (p < src.length && /\s/.test(src[p])) p++;
      if (src[p] === '~' && src[p + 1] === '{') {
        const firstEnd = findQuoteEnd(src, p);
        if (firstEnd !== -1) {
          const firstSrc = src.slice(p + 2, firstEnd - 1);
          let q = firstEnd;
          while (q < src.length && /\s/.test(src[q])) q++;
          if (src[q] === '~' && src[q + 1] === '{') {
            const secondEnd = findQuoteEnd(src, q);
            if (secondEnd !== -1) {
              const secondSrc = src.slice(q + 2, secondEnd - 1);
              let r = secondEnd;
              while (r < src.length && /\s/.test(src[r])) r++;
              if (src[r] === ']') {
                out += '~{' + firstSrc + ' | eq(' + secondSrc + ')}';
                i = r + 1;
                continue;
              }
            }
          }
        }
      }
    }
    out += src[i];
    i++;
  }
  return out;
}

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = transformAssertions(before);
  if (before !== after) {
    writeFileSync(file, after);
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
