#!/usr/bin/env node

// Release — bumps the @kaluchi/qlang-core version, rebuilds the
// parser and core catalog, runs every workspace's test suite, tags,
// and pushes. Triggers the Deploy workflow via the pushed tag.
//
// Usage:
//   node scripts/release.mjs <version>
//
// Examples:
//   node scripts/release.mjs 0.1.0
//   node scripts/release.mjs 0.2.0-alpha

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CORE_ROOT = resolve(REPO_ROOT, 'core');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', ...opts }).trim();
}

// ── Parse args ──────────────────────────────────────────────

const version = process.argv[2];
const tag = `v${version}`;

if (!version || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <version>');
  console.error('  version must be semver (e.g. 0.2.0, 0.1.0-alpha)');
  process.exit(1);
}

// ── Preflight ───────────────────────────────────────────────

console.log(`\nRelease ${version}\n`);

const branch = runCapture('git branch --show-current');
if (branch !== 'master') {
  console.error(`Error: must be on master (currently on ${branch})`);
  process.exit(1);
}

const status = runCapture('git status --porcelain');
if (status) {
  console.error('Error: working tree is not clean\n' + status);
  process.exit(1);
}

const tags = runCapture('git tag -l');
if (tags.split('\n').includes(tag)) {
  console.error(`Error: tag ${tag} already exists`);
  process.exit(1);
}

// ── Version bump (core workspace only) ──────────────────────

console.log('Bumping @kaluchi/qlang-core version...');
run(`npm version ${version} --no-git-tag-version --allow-same-version -w @kaluchi/qlang-core`);

// ── Build ───────────────────────────────────────────────────

console.log('\nBuilding grammar and core...');
run('npm run build');

// ── Test ────────────────────────────────────────────────────

console.log('\nRunning core tests with coverage...');
run('npm run test:coverage');

console.log('\nRunning LSP and site tests...');
run('npm test --workspaces --if-present');

// ── Commit + Tag + Push ─────────────────────────────────────

console.log('\nCommitting version bump...');
run('git add -A');
run(`git commit -m "Release ${version}"`);

console.log(`\nTagging ${tag}...`);
run(`git tag ${tag}`);

console.log('\nPushing...');
run(`git push origin master ${tag}`);

console.log(`\n✓ Released ${version}`);
console.log('  CI will: test, npm publish, create GitHub Release.');
