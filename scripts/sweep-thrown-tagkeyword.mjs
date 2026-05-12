// One-shot test migration: `expect(err.descriptor.get('thrown')).toEqual(keyword('Foo'))`
// → `…toEqual(makeTagKeyword('Foo'))`. After M4, error-value's
// `:thrown` field carries a TagKeyword reference (rather than a
// plain Keyword), so test assertions must align with the new shape.
// Also adds `makeTagKeyword` to the import from `../../src/types.mjs`
// when the file does not already import it.

import { readFileSync, writeFileSync } from 'node:fs';

function ensureImport(content, name) {
  const re = /import\s*\{([^}]+)\}\s*from\s*(['"])([^'"]*types\.mjs)\2/;
  const m = content.match(re);
  if (!m) return content;
  const items = m[1].split(',').map(s => s.trim()).filter(Boolean);
  if (items.includes(name)) return content;
  items.push(name);
  const newImport = `import { ${items.join(', ')} } from ${m[2]}${m[3]}${m[2]}`;
  return content.replace(re, newImport);
}

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const before = content;
  // Two surfaces project TagKeyword post-M4: the `:thrown` field of
  // an error-value's descriptor and the `!| /thrown` projection on
  // an error-value pipeValue. Both compared against `keyword('Foo')`
  // before need to compare against `makeTagKeyword('Foo')` now.
  // Limit pattern to those two contexts so unrelated `keyword(...)`
  // sites stay untouched.
  content = content.replace(
    /(\.get\('thrown'\)\)?\.toEqual\()keyword(\('[A-Z][A-Za-z0-9_]*'\))/g,
    '$1makeTagKeyword$2'
  );
  // For `!| /thrown` projections evalQuery'd against expected,
  // the immediate enclosing expect-line carries `keyword('CapName')`.
  // Detect via the `/thrown` substring on the same line OR within the
  // preceding line (multi-line `expect(...).toEqual(...)` form).
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const here = lines[i];
    if (!/\.toEqual\(keyword\('[A-Z][A-Za-z0-9_]*'\)\)/.test(here)) continue;
    const prev = lines[i - 1] || '';
    const here2 = here + ' ' + prev;
    if (!/\/thrown/.test(here2)) continue;
    lines[i] = here.replace(
      /(\.toEqual\()keyword(\('[A-Z][A-Za-z0-9_]*'\))/g,
      '$1makeTagKeyword$2'
    );
  }
  content = lines.join('\n');
  if (content !== before) {
    content = ensureImport(content, 'makeTagKeyword');
    writeFileSync(file, content);
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
