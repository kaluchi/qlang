#!/usr/bin/env node
// Mechanise the subset of CLAUDE.md review rules that a grep pass
// can enforce. The qlang-review agent (`.claude/agents/qlang-
// review.md`) is the authoritative rule set — the checks here are
// a pre-commit safety net for the rules with low false-positive
// rate: they catch obvious violations so the human review can
// focus on the deep ones (lexicon entropy, concept completeness,
// half-measures).
//
// Checks:
//
//   (1) Forbidden temporal framing / placeholder markers.
//       `TODO`, `FIXME`, `HACK`, `legacy`, `deprecated`,
//       `currently`, `previously`, `for backward compatibility`,
//       `backwards compat`. Scanned in .mjs / .js source. The
//       common English words `now` / `was` / `old` / `new` live
//       in CLAUDE.md's forbidden list too but carry too many
//       legitimate uses (`new Map()` constructor, `was X still Y`
//       as part of a legitimate reference, etc.) for a cheap
//       grep — those stay under human review.
//
//   (2) Doc-drift between the core operand catalog and the
//       published operand docs. Every `:name {:qlang/kind :builtin
//       …}` entry in `core/lib/qlang/core.qlang` must appear as
//       an `### name` (or equivalent) section in
//       `docs/qlang-operands.md`. A new operand that lands without
//       its doc section is caught here before review.
//
// Exit 0 when both checks pass, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// ── (1) Forbidden temporal framing ─────────────────────────────

// Files and directory roots that are outside the review remit —
// generated code, vendored bundles, third-party modules, the doc
// tree (quotes CLAUDE.md rules verbatim and can name the forbidden
// words for pedagogy), and the ruleset files themselves.
const IGNORE_DIRS = new Set([
  'node_modules', '.git',
  'core/gen',
  'cli/coverage', 'core/coverage', 'lsp/coverage', 'site/coverage',
  'site/dist', 'site/public',
  'vscode'
]);
const IGNORE_FILES = new Set([
  'CLAUDE.md',
  '.claude/agents/qlang-review.md',
  'scripts/check-conventions.mjs'  // this file quotes the list
]);

const FORBIDDEN_PATTERNS = [
  { rule: 'TODO marker',                 regex: /\bTODO\b/ },
  { rule: 'FIXME marker',                regex: /\bFIXME\b/ },
  { rule: 'HACK marker',                 regex: /\bHACK\b/ },
  { rule: 'temporal: "legacy"',          regex: /\blegacy\b/i },
  { rule: 'temporal: "deprecated"',      regex: /\bdeprecated\b/i },
  { rule: 'temporal: "currently"',       regex: /\bcurrently\b/i },
  { rule: 'temporal: "previously"',      regex: /\bpreviously\b/i },
  { rule: 'temporal: "backward compat"', regex: /backwards?[ -]compat/i },
  { rule: 'temporal: "for backward compatibility"',
    regex: /for backward compatibility/i }
];

function* walkSourceTree(rootDir) {
  for (const entry of readdirSync(rootDir)) {
    const entryPath = join(rootDir, entry);
    const entryStat = statSync(entryPath);
    const relPath = relative(repoRoot, entryPath).split(sep).join('/');

    if (entryStat.isDirectory()) {
      if (IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry)) continue;
      yield* walkSourceTree(entryPath);
      continue;
    }
    if (IGNORE_FILES.has(relPath)) continue;
    // Scan source + docs prose (but the docs/ root is explicitly
    // allowlisted above so this only catches code / inline docs).
    if (!/\.(mjs|js|md|qlang)$/.test(entry)) continue;
    yield entryPath;
  }
}

function scanForbiddenWords() {
  const violations = [];
  for (const filePath of walkSourceTree(repoRoot)) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    // The docs/ tree names forbidden words for pedagogy — review
    // agent file is already allowlisted; the qlang-spec and
    // friends are allowed to quote them in code samples.
    if (relFile.startsWith('docs/')) continue;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const { rule, regex } of FORBIDDEN_PATTERNS) {
        if (regex.test(line)) {
          violations.push({
            file: relFile,
            line: lineIndex + 1,
            rule,
            snippet: line.trim().slice(0, 120)
          });
        }
      }
    }
  }
  return violations;
}

// ── (2) Operand catalog ↔ operand docs drift ───────────────────

function parseOperandCatalog(catalogText) {
  // Top-level entries in core.qlang look like `:name {:qlang/kind
  // :builtin …}` at column 0. Multi-word names (`sortWith`,
  // `firstNonZero`, …) and the `@`-prefix names all match.
  const entryRegex = /^:([@a-zA-Z][\w-]*) \{:qlang\/kind :builtin/gm;
  const names = [];
  let match;
  while ((match = entryRegex.exec(catalogText)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function catalogDocDrift() {
  const catalog = readFileSync(
    join(repoRoot, 'core/lib/qlang/core.qlang'), 'utf8');
  const docsBody = readFileSync(
    join(repoRoot, 'docs/qlang-operands.md'), 'utf8');

  const missing = [];
  for (const operandName of parseOperandCatalog(catalog)) {
    // The docs use `### name` or `#### name` section headers; the
    // simplest robust probe is to ensure the bare name appears in
    // the doc at all. Flags only operands that land in the catalog
    // but leave zero footprint in the published doc.
    if (!docsBody.includes(operandName)) {
      missing.push(operandName);
    }
  }
  return missing;
}

// ── Main ───────────────────────────────────────────────────────

const forbidden = scanForbiddenWords();
const driftMissing = catalogDocDrift();

if (forbidden.length === 0 && driftMissing.length === 0) {
  process.stdout.write('check:conventions — OK\n');
  process.exit(0);
}

if (forbidden.length > 0) {
  process.stdout.write(`\nForbidden framing / markers (${forbidden.length}):\n`);
  for (const v of forbidden) {
    process.stdout.write(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`);
  }
}
if (driftMissing.length > 0) {
  process.stdout.write(
    `\nOperand catalog ↔ docs drift (${driftMissing.length}):\n`);
  for (const name of driftMissing) {
    process.stdout.write(`  :${name} — present in core.qlang, missing from docs/qlang-operands.md\n`);
  }
}
process.exit(1);
