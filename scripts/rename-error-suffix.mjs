// One-shot migration: append `Error` suffix to every per-site error
// class declared in `core/src/operand-errors.mjs` factories or via
// direct `class Foo extends QlangError|QlangInvariantError|ArityError|
// EffectLaunderingError|Error` declarations, except those that
// already end in `Error`.
//
// Plus one rename-not-suffix:
//   TaggedLitImplNotResolvable → TypeBindingHasNoConstructorError
// (the class identity reframes from "the literal is malformed" to
// "the type-binding has no constructor", matching the actual fault).
//
// The mapping is built by scanning every declare*Error factory call
// site and every direct class declaration across `core/src/**/*.mjs`,
// then applied to every text file the codebase tracks tag references
// in: source, lib, tests, conformance, CLI, LSP, site, vscode,
// scripts, docs, the .claude review agent.
//
// Word-boundary `\b` plus a `(?!Error)` lookahead keep the rewrite
// idempotent — re-running the script on a tree that already carries
// the suffix is a no-op.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = process.cwd();

// ── Step 1: discover every error class name in core/src ─────────

const factoryRe = /declare(?:Subject|Shape|Element|Comparability|Arity|Modifier)Error\(\s*'([A-Z][A-Za-z0-9_]*)'/g;
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(Qlang[A-Za-z]*Error|ArityError|EffectLaunderingError|Error)\b/g;

const ABSTRACT_BASES = new Set([
  'QlangError', 'QlangTypeError', 'QlangInvariantError',
  'ArityError', 'EffectLaunderingError'
]);

const classNames = new Set();

function* walkMjs(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkMjs(p);
    else if (entry.endsWith('.mjs')) yield p;
  }
}

for (const file of walkMjs(join(repoRoot, 'core', 'src'))) {
  const content = readFileSync(file, 'utf8');
  for (const m of content.matchAll(factoryRe)) classNames.add(m[1]);
  for (const m of content.matchAll(directClassRe)) {
    if (!ABSTRACT_BASES.has(m[1])) classNames.add(m[1]);
  }
}

// ── Step 2: build rename mapping ────────────────────────────────

const RENAME = new Map();

// Special: `TaggedLitImplNotResolvable` reframes as a type-binding
// state error, not a literal-syntax error.
RENAME.set('TaggedLitImplNotResolvable', 'TypeBindingHasNoConstructorError');

for (const name of classNames) {
  if (RENAME.has(name)) continue;
  if (name.endsWith('Error')) continue;
  RENAME.set(name, name + 'Error');
}

console.log(`Discovered ${classNames.size} class names; renaming ${RENAME.size}.`);

// ── Step 3: walk target files and apply mapping ────────────────

const TARGET_GLOBS = [
  ['core', 'src'],
  ['core', 'lib'],
  ['core', 'test'],
  ['core', 'host'],
  ['core', 'scripts'],
  ['cli', 'src'],
  ['cli', 'test'],
  ['lsp', 'src'],
  ['lsp', 'test'],
  ['site', 'src'],
  ['site', 'test'],
  ['vscode', 'snippets'],
  ['vscode', 'syntaxes'],
  ['scripts'],
  ['docs'],
  ['.claude', 'agents']
];

const TARGET_EXT = /\.(mjs|js|qlang|jsonl|json|ts|astro|md|peggy)$/;

const SKIP_FILES = new Set([
  // The script itself — `RENAME.set('TaggedLitImplNotResolvable', …)`
  // would rewrite to `TypeBindingHasNoConstructorError` which is
  // OK, but `+ 'Error'` literal would also self-touch — avoid the
  // semantic ambiguity by leaving the script untouched.
  join(repoRoot, 'scripts', 'rename-error-suffix.mjs')
]);

function* walkTargets(rootSegments) {
  const root = join(repoRoot, ...rootSegments);
  let st;
  try { st = statSync(root); } catch { return; }
  if (!st.isDirectory()) return;
  yield* walkAny(root);
}

function* walkAny(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'gen' || entry === 'coverage' || entry === 'dist') continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkAny(p);
    else if (TARGET_EXT.test(entry)) yield p;
  }
}

const renameSites = [...RENAME.entries()];
let totalRewrites = 0;
let touchedFiles = 0;

for (const segments of TARGET_GLOBS) {
  for (const file of walkTargets(segments)) {
    if (SKIP_FILES.has(file)) continue;
    const before = readFileSync(file, 'utf8');
    let after = before;
    let fileRewrites = 0;
    for (const [oldName, newName] of renameSites) {
      // `\boldName\b(?!Error|<rest of newName tail>)` — the lookahead
      // protects against double-application: once a site already
      // ends in Error, re-running is a no-op. Special rename
      // (TaggedLitImplNotResolvable → TypeBindingHasNoConstructorError)
      // does not need the lookahead because the new name does not
      // contain the old as a prefix.
      const re = oldName.endsWith('Error') || newName === 'TypeBindingHasNoConstructorError'
        ? new RegExp(`\\b${oldName}\\b`, 'g')
        : new RegExp(`\\b${oldName}\\b(?!Error)`, 'g');
      const matches = after.match(re);
      if (matches) {
        fileRewrites += matches.length;
        after = after.replace(re, newName);
      }
    }
    if (after !== before) {
      writeFileSync(file, after);
      const rel = relative(repoRoot, file).split(sep).join('/');
      console.log(`  ${rel}: ${fileRewrites} rewrites`);
      totalRewrites += fileRewrites;
      touchedFiles += 1;
    }
  }
}

console.log(`\n${totalRewrites} rewrites across ${touchedFiles} files.`);
