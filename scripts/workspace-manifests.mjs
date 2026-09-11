// The manifest surface the release rewrite and the convention check
// share: which workspaces the repo declares, every place one of them
// names a sibling, and the range that naming must carry.
//
// npm workspaces link a sibling by name, so a range on one steers
// nothing inside the repo and reaches the registry verbatim. There a
// consumer resolves it for real, which is why the range has to name
// the sibling's own version — and why every dependency map counts,
// not `dependencies` alone.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Every map npm resolves against the registry. A sibling named in
// any of them travels to a consumer the same way.
export const DEPENDENCY_MAPS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
];

// The range a sibling declaration must carry. The caret keeps the
// pair inside one minor line, which is what lets npm dedupe the
// sibling against a consumer's own `^X.Y.0` into a single instance —
// `TAG_HEADER_SYMBOL` is a per-instance Symbol, so a second copy of
// the core leaves every tag check answering about the wrong one.
export function siblingRange(siblingVersion) {
  return `^${siblingVersion}`;
}

export function readWorkspaces(repoRoot) {
  const rootManifest = JSON.parse(
    readFileSync(join(repoRoot, 'package.json'), 'utf8'));

  return rootManifest.workspaces.map((dir) => {
    const path = join(repoRoot, dir, 'package.json');
    const text = readFileSync(path, 'utf8');
    return { dir, path, text, manifest: JSON.parse(text) };
  });
}

// Yields one entry per place a workspace names a sibling workspace,
// carrying the range it declares and the version that sibling is at.
export function* siblingDeclarations(workspaces) {
  const versionByName = new Map(
    workspaces.map(({ manifest }) => [manifest.name, manifest.version]));

  for (const workspace of workspaces) {
    for (const dependencyMap of DEPENDENCY_MAPS) {
      const declared = workspace.manifest[dependencyMap];
      if (declared === undefined) continue;

      for (const [depName, declaredRange] of Object.entries(declared)) {
        const siblingVersion = versionByName.get(depName);
        if (siblingVersion === undefined) continue;
        yield {
          workspace,
          dependencyMap,
          depName,
          declaredRange,
          expectedRange: siblingRange(siblingVersion)
        };
      }
    }
  }
}

// Rewrites a workspace manifest in the layout it already carries:
// npm's two-space JSON, the file's own line endings, trailing
// newline.
export function writeWorkspaceManifest(workspace) {
  const eol = workspace.text.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(workspace.path,
    JSON.stringify(workspace.manifest, null, 2).split('\n').join(eol) + eol);
}
