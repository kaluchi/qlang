#!/usr/bin/env node
// scripts/gemini-show.mjs <PR> [--since <ISO_TIMESTAMP>]
//
// Prints the latest Gemini Code Assist activity on a GitHub PR:
// top-level review summaries (one body per submitted review) and
// inline file comments (one entry per `path:line` suggestion). Both
// surfaces are filtered to the `gemini-code-assist[bot]` author so
// human-side comments do not flood the output.
//
// Without `--since` the default window is the most recent review
// from Gemini and everything after — call from inside an
// iteration loop where each round prints what changed since the
// last trigger.
//
// Usage:
//   node scripts/gemini-show.mjs 15
//   node scripts/gemini-show.mjs 15 --since 2026-05-26T21:00:00Z

import { spawnSync } from 'node:child_process';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readGhJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`gh ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const prNumber = process.argv[2];
if (!prNumber || !/^\d+$/.test(prNumber)) {
  fail('Usage: node scripts/gemini-show.mjs <PR_NUMBER> [--since <ISO_TIMESTAMP>]');
}

let since = null;
const sinceIdx = process.argv.indexOf('--since');
if (sinceIdx !== -1) {
  since = process.argv[sinceIdx + 1];
  if (!since) fail('--since requires an ISO-8601 timestamp argument');
}

const repoSlug = readGhJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner;
const reviewsAll = readGhJson(['pr', 'view', prNumber, '--json', 'reviews']).reviews;
const inlineAll  = readGhJson(['api', `repos/${repoSlug}/pulls/${prNumber}/comments`]);

const geminiReviews = reviewsAll.filter(r =>
  r.author && r.author.login === 'gemini-code-assist'
);
if (since === null) {
  if (geminiReviews.length === 0) {
    console.log('(no Gemini reviews yet)');
    process.exit(0);
  }
  since = geminiReviews[geminiReviews.length - 1].submittedAt;
}

const reviewsSince = geminiReviews.filter(r => r.submittedAt >= since);
const inlineSince = inlineAll.filter(c =>
  c.user.login === 'gemini-code-assist[bot]' && c.created_at >= since
);

console.log(`# Gemini activity on PR #${prNumber} since ${since}`);
console.log(`# repo: ${repoSlug}`);
console.log();

console.log(`## Top-level reviews (${reviewsSince.length})`);
for (const review of reviewsSince) {
  console.log(`--- ${review.submittedAt} [${review.state}] ---`);
  console.log(review.body);
  console.log();
}

console.log(`## Inline comments (${inlineSince.length})`);
for (const comment of inlineSince) {
  console.log(`--- ${comment.path}:${comment.line ?? comment.original_line ?? '?'} ---`);
  console.log(comment.body);
  console.log();
}
