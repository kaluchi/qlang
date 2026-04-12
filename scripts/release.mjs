#!/usr/bin/env node

// Release — bumps version, builds, tests, tags, pushes.
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
const ROOT = resolve(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
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

// ── Version bump ────────────────────────────────────────────

console.log('Bumping package.json version...');
run(`npm version ${version} --no-git-tag-version --allow-same-version`);

// ── Build ───────────────────────────────────────────────────

console.log('\nBuilding grammar and core...');
run('npm run build');

// ── Test ────────────────────────────────────────────────────

console.log('\nRunning core tests with coverage...');
run('npm run test:coverage');

console.log('\nRunning LSP tests...');
run('npm test', { cwd: resolve(ROOT, 'lsp') });

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
