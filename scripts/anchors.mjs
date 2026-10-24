// The anchors of the texts that hold the work [QSWRK#probe], [D430]: a path
// the seed, the aim or a chapter names in backquotes is a file of the tree or
// of the sister project, and words they quote in “…” beside a path stand in
// that file. A section of a chapter that a record in transit overrides waits
// for its closeout, where a home its record brings or renames is written, as
// its probes wait.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from './tree-reads.mjs';
import { recordsInTransit, sectionsOfChapter } from './reconciliation.mjs';

const ANCHOR_DOCUMENTS = ['CLAUDE.md', 'docs/journal/AIM.md'];
const SPEC_DIR = 'docs/spec';
const ANCHOR_PATH_RE = /`((?:core|cli|lsp|site|vscode|scripts|docs|\.claude|\.github)\/[\w./@~-]+\.(?:mjs|js|qlang|peggy|md|json|jsonl|yml|astro|txt))`/g;
const TREE_QUOTE_RE = /“([^”]+)”\s*\(`([^`]+)`/g;

// anchorTexts(repoRoot) → each `{ documentPath, text }`: the seed and the aim
// whole, and a chapter by the sections no record in transit overrides, none
// of it where one overrides the chapter whole.
export function anchorTexts(repoRoot) {
  const overridden = [...recordsInTransit(repoRoot).values()].flat();
  const chapterFiles = existsSync(join(repoRoot, SPEC_DIR)) ? readdirSync(join(repoRoot, SPEC_DIR)).filter(name => /^QS[A-Z]{3}-.+\.md$/.test(name)) : [];
  const chapters = chapterFiles.map(name => {
    const chapter = name.slice(0, 5);
    const kept = overridden.includes(chapter) ? []
      : [...sectionsOfChapter(readText(join(repoRoot, SPEC_DIR, name)))].filter(([section]) => !overridden.includes(`${chapter}#${section}`));
    return { documentPath: `${SPEC_DIR}/${name}`, text: kept.map(([, body]) => body).join('\n') };
  });
  const documents = ANCHOR_DOCUMENTS.filter(documentPath => existsSync(join(repoRoot, documentPath)));
  return [...documents.map(documentPath => ({ documentPath, text: readText(join(repoRoot, documentPath)) })), ...chapters];
}

// anchorsTheTreeLacks(repoRoot, sisterRoot) → each anchor that breaks,
// `{ file, anchor, problem }`; a path under a folder the tree lacks is the
// sister project's, checked where its checkout sits.
export function anchorsTheTreeLacks(repoRoot, sisterRoot = join(repoRoot, '..', 'eclipse-jdt-search')) {
  const rootOf = anchorPath => {
    const folder = anchorPath.split('/').slice(0, -1).join('/');
    if (existsSync(join(repoRoot, folder))) return repoRoot;
    return existsSync(sisterRoot) ? sisterRoot : null;
  };
  const violations = [];
  for (const { documentPath, text } of anchorTexts(repoRoot)) {
    for (const [, anchorPath] of text.matchAll(ANCHOR_PATH_RE)) {
      if (/\/(?:Dnn|En)\.md$/.test(anchorPath)) continue;
      const root = rootOf(anchorPath);
      if (root !== null && !existsSync(join(root, anchorPath))) {
        violations.push({ file: documentPath, anchor: anchorPath, problem: 'names a file the tree lacks' });
      }
    }
    for (const [, quoted, anchorPath] of text.replace(/\s+/g, ' ').matchAll(TREE_QUOTE_RE)) {
      const root = rootOf(anchorPath);
      if (root === null || !existsSync(join(root, anchorPath))) continue;
      const anchored = readText(join(root, anchorPath)).replace(/\s+/g, ' ');
      if (!anchored.includes(quoted.trim())) {
        violations.push({ file: documentPath, anchor: anchorPath, problem: `quotes “${quoted}”, which the file no longer holds` });
      }
    }
  }
  return violations;
}
