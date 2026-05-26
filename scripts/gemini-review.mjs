#!/usr/bin/env node
// scripts/gemini-review.mjs <PR>
//
// Posts a `/gemini review` comment on a GitHub PR to trigger the
// Gemini Code Assist bot review. Uses `gh pr comment --body-file -`
// reading from stdin so the slash-prefixed body bypasses any
// argument-side path translation (Git Bash on Windows rewrites
// `--body "/gemini review"` as `C:/Program Files/Git/gemini review`
// — the stdin path sidesteps it entirely without an env-var dance).
//
// Usage:
//   node scripts/gemini-review.mjs <PR_NUMBER>
//
// Exit codes: 0 on success, 1 on argument error, propagates gh's
// exit code on transport failure.

import { spawnSync } from 'node:child_process';

const prNumber = process.argv[2];
if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error('Usage: node scripts/gemini-review.mjs <PR_NUMBER>');
  process.exit(1);
}

const ghResult = spawnSync(
  'gh',
  ['pr', 'comment', prNumber, '--body-file', '-'],
  { input: '/gemini review\n', encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }
);

if (ghResult.error) {
  console.error(`gh spawn failed: ${ghResult.error.message}`);
  process.exit(1);
}
process.exit(ghResult.status ?? 0);
