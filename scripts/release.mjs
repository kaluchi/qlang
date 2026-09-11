#!/usr/bin/env node

// Release — bumps every publishable workspace to <version>, points
// every internal dependency range at that version, rebuilds the
// parser and core catalog, runs every workspace's test suite and
// coverage thresholds, pushes master, and waits for CI to go green
// on the Release commit before tagging. The tag push triggers the
// Deploy workflow (npm publish + GitHub Release).
//
// Preflight rejects anything that would make the release opaque or
// hard to reproduce:
//   • must be on master
//   • working tree clean (no uncommitted edits, no untracked files)
//   • local master in sync with origin/master (no ahead, no behind)
//   • tag absent both locally and on the remote
//   • latest commit on origin/master has a successful CI run
//   • every publishable workspace version bump lands in a single
//     "Release X" commit
//   • after the Release commit is pushed, CI on that exact SHA must
//     go green before the tag is pushed
//
// Usage:
//   node scripts/release.mjs <version>
//
// Examples:
//   node scripts/release.mjs 0.3.0
//   node scripts/release.mjs 0.3.0-alpha

import { execSync } from 'node:child_process';
import {
  readWorkspaces,
  siblingDeclarations,
  writeWorkspaceManifest
} from './workspace-manifests.mjs';
import { lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Publishable workspaces — all bumped to the same release version.
// Keep in sync with .github/workflows/deploy.yml's publish matrix.
const PUBLISHED_WORKSPACES = [
  '@kaluchi/qlang-core',
  '@kaluchi/qlang-cli'
];

// CI workflow on master that must be green before and after the
// Release commit. Matches .github/workflows/ci.yml's `name:` field.
const CI_WORKFLOW = 'CI';

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', ...opts }).trim();
}

function fail(message) {
  console.error('\n✗ ' + message);
  process.exit(1);
}

// Resolve the CI run for a specific commit. GitHub Actions needs a
// few seconds to register a run after push; poll until the run is
// listed or give up with a specific error.
async function findCiRunForSha(sha) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const json = runCapture(
      `gh run list --workflow "${CI_WORKFLOW}" --branch master `
      + `--limit 20 --json databaseId,headSha,status,conclusion`);
    const candidate = JSON.parse(json).find(r => r.headSha === sha);
    if (candidate) return candidate;
    await sleep(2000);
  }
  fail(`"${CI_WORKFLOW}" did not register a run for ${sha.slice(0, 12)} `
       + 'within 60s — investigate on GitHub Actions');
}

// ── Parse args ──────────────────────────────────────────────

const version = process.argv[2];
const tag = `v${version}`;

if (!version || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <version>');
  console.error('  version must be semver (e.g. 0.3.0, 0.3.0-alpha)');
  process.exit(1);
}

// ── Preflight ───────────────────────────────────────────────

console.log(`\nRelease ${version}\n`);
console.log('Preflight:');

const branch = runCapture('git branch --show-current');
if (branch !== 'master') fail(`must be on master, got ${branch}`);

console.log('  • fetching origin…');
run('git fetch origin --prune --tags');

const porcelain = runCapture('git status --porcelain');
if (porcelain) fail('working tree is not clean:\n' + porcelain);

const ahead  = runCapture('git rev-list --count origin/master..HEAD');
const behind = runCapture('git rev-list --count HEAD..origin/master');
if (ahead !== '0' || behind !== '0') {
  fail(`local master is out of sync with origin/master `
       + `(${ahead} ahead, ${behind} behind) — push or pull first`);
}

const localTags  = runCapture('git tag -l ' + tag);
const remoteTags = runCapture(`git ls-remote --tags origin refs/tags/${tag}`);
if (localTags)  fail(`tag ${tag} already exists locally`);
if (remoteTags) fail(`tag ${tag} already exists on origin`);

const baseSha = runCapture('git rev-parse HEAD');
console.log(`  • checking ${CI_WORKFLOW} on ${baseSha.slice(0, 12)}…`);
const baseRun = await findCiRunForSha(baseSha);
if (baseRun.conclusion !== 'success') {
  fail(`${CI_WORKFLOW} on origin/master (${baseSha.slice(0, 12)}) is `
       + `${baseRun.status}/${baseRun.conclusion ?? '—'}; release `
       + 'requires a green master');
}

console.log(`  ✓ master clean, in sync, ${CI_WORKFLOW} green, `
            + `tag ${tag} free`);

// ── Version bump (every publishable workspace) ──────────────
//
// `--no-workspaces-update` keeps npm from installing between the
// bumps. A bumped sibling momentarily sits outside the range its
// dependents still declare, and an install landing in that window
// resolves the dependency against the registry instead of the
// folder — leaving a stale published copy nested inside the
// dependent workspace, shadowing the link for everything that runs
// from the repo afterwards. The single install below lands once the
// versions and the ranges agree.

console.log('\nVersion bumps:');
for (const ws of PUBLISHED_WORKSPACES) {
  console.log(`  • ${ws}`);
  run(`npm version ${version} --no-git-tag-version --allow-same-version `
      + `--no-workspaces-update -w ${ws}`);
}

const bumpDiff = runCapture('git status --porcelain');
if (!bumpDiff) {
  fail(`every workspace is already at ${version} — nothing to release`);
}

// ── Internal dependency ranges ──────────────────────────────
//
// npm workspaces link a sibling by name, so the range a manifest
// declares steers nothing inside the repo — and it rides out to the
// registry verbatim. A consumer installing the CLI resolves that
// range against npm, so it has to name the core this release was
// built and tested against.
//
// Every dependency map counts — a sibling named under
// `devDependencies` or `peerDependencies` reaches a consumer the
// same way — and `workspace-manifests.mjs` owns both that list and
// the range shape, so the rewrite here and the convention check
// enforce one rule.

console.log('\nInternal dependency ranges:');
const workspaces = readWorkspaces(REPO_ROOT);
const rewrittenManifests = new Set();
for (const declaration of siblingDeclarations(workspaces)) {
  if (declaration.declaredRange === declaration.expectedRange) continue;
  const { workspace, dependencyMap, depName, expectedRange } = declaration;
  workspace.manifest[dependencyMap][depName] = expectedRange;
  rewrittenManifests.add(workspace);
  console.log(`  • ${workspace.manifest.name} (${dependencyMap}) → `
              + `${depName} ${expectedRange}`);
}
for (const workspace of rewrittenManifests) {
  writeWorkspaceManifest(workspace);
}

// One install for the whole bump: it relinks every workspace under
// the ranges they carry and rewrites the lockfile `npm ci` reads on
// the release SHA.
run('npm install');

// ── Workspace links ─────────────────────────────────────────
//
// Every sibling a workspace declares must resolve to that sibling's
// folder in this repo. A published copy nested inside the workspace
// resolves ahead of the root link, so the suite below would test the
// release against a different core than the one being published —
// and everything run from the repo afterwards would keep reading
// that copy.

console.log('\nWorkspace links:');
const shadowed = new Set();
for (const { workspace, depName } of siblingDeclarations(workspaces)) {
  const nested = resolve(REPO_ROOT, workspace.dir, 'node_modules', depName);
  // `throwIfNoEntry: false` answers `undefined` for the ordinary
  // case of nothing being there, and lets a permission or symlink
  // error travel — a guard that cannot read the tree must say so
  // rather than report it clean.
  const nestedStat = lstatSync(nested, { throwIfNoEntry: false });
  if (nestedStat === undefined || nestedStat.isSymbolicLink()) continue;
  shadowed.add(`${workspace.dir}/node_modules/${depName}`);
}
if (shadowed.size > 0) {
  fail('a published copy shadows the workspace link:\n  '
       + [...shadowed].join('\n  ')
       + '\nthe install above left it in place — delete each folder, '
       + 'run `npm install` at the repo root, and re-run the release');
}
console.log('  ✓ every declared sibling resolves to its workspace folder');

// ── Build ───────────────────────────────────────────────────

console.log('\nBuild:');
run('npm run build');

// ── Test + coverage ─────────────────────────────────────────

console.log('\nTests (coverage on @kaluchi/qlang-core):');
run('npm run test:coverage -w @kaluchi/qlang-core');

console.log('\nTests (every workspace):');
run('npm test --workspaces --if-present');

// ── Commit + push master ────────────────────────────────────

console.log('\nCommit:');
run('git add -A');
run(`git commit -m "Release ${version}"`);

const releaseSha = runCapture('git rev-parse HEAD');
console.log(`  ✓ Release ${version} at ${releaseSha.slice(0, 12)}`);

console.log('\nPushing master…');
run('git push origin master');

// ── Wait for CI on the Release commit ───────────────────────

console.log(`\nWaiting for ${CI_WORKFLOW} on ${releaseSha.slice(0, 12)}…`);
const releaseRun = await findCiRunForSha(releaseSha);

try {
  run(`gh run watch ${releaseRun.databaseId} --exit-status`);
} catch {
  fail(`${CI_WORKFLOW} failed on Release ${version} `
       + `(${releaseSha.slice(0, 12)}) — fix forward on master, then `
       + 're-run the release script');
}
console.log(`  ✓ ${CI_WORKFLOW} green on ${releaseSha.slice(0, 12)}`);

// ── Tag + push tag (triggers Deploy) ────────────────────────

console.log(`\nTagging ${tag}…`);
run(`git tag ${tag}`);
run(`git push origin ${tag}`);

console.log(`\n✓ Released ${version}`);
console.log('  Deploy workflow will: test, npm publish every workspace');
console.log(`  in PUBLISHED_WORKSPACES, create the ${tag} GitHub Release.`);
