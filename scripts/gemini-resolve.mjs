#!/usr/bin/env node
// scripts/gemini-resolve.mjs <PR>
//
// Resolves every open review thread on a PR through the GraphQL
// `resolveReviewThread` mutation. Run before re-triggering Gemini
// — otherwise the next round's comments queue up under the
// previous round's open threads and the inline list grows
// unbounded across iterations.
//
// Prints each thread's first-comment path + body preview as it
// resolves so the operator sees what was just closed.
//
// Usage:
//   node scripts/gemini-resolve.mjs <PR_NUMBER>

import { spawnSync } from 'node:child_process';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function runGh(args, opts = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', ...opts });
  if (result.status !== 0) {
    fail(`gh ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

const prNumber = process.argv[2];
if (!prNumber || !/^\d+$/.test(prNumber)) {
  fail('Usage: node scripts/gemini-resolve.mjs <PR_NUMBER>');
}

const repoSlug = JSON.parse(runGh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
const [owner, name] = repoSlug.split('/');

const listQuery = `
  query($owner: String!, $name: String!, $pr: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes { path body }
            }
          }
        }
      }
    }
  }
`;

const listResult = JSON.parse(runGh([
  'api', 'graphql',
  '-f', `query=${listQuery}`,
  '-F', `owner=${owner}`,
  '-F', `name=${name}`,
  '-F', `pr=${prNumber}`
]));

const allThreads = listResult.data.repository.pullRequest.reviewThreads.nodes;
const unresolved = allThreads.filter(t => !t.isResolved);

if (unresolved.length === 0) {
  console.log(`No unresolved threads on PR #${prNumber}.`);
  process.exit(0);
}

console.log(`Resolving ${unresolved.length} thread(s) on PR #${prNumber}:`);

const mutation = `
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { id isResolved }
    }
  }
`;

let resolved = 0;
for (const thread of unresolved) {
  const firstComment = thread.comments.nodes[0] ?? {};
  const path = firstComment.path ?? '?';
  const preview = (firstComment.body ?? '').replace(/\s+/g, ' ').slice(0, 80);
  const mutResult = JSON.parse(runGh([
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-F', `threadId=${thread.id}`
  ]));
  const isNowResolved = mutResult.data.resolveReviewThread.thread.isResolved;
  if (isNowResolved) {
    resolved++;
    console.log(`  ✓ ${path}: ${preview}`);
  } else {
    console.log(`  ✗ ${path}: ${preview} (did not resolve)`);
  }
}

console.log(`Resolved ${resolved} of ${unresolved.length} thread(s).`);
process.exit(resolved === unresolved.length ? 0 : 1);
