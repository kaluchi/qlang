// The hook that runs the conventions before a commit a session makes: which
// commands of the shell make a commit.
// The rules it holds: [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { makesACommit } from '../../../scripts/commit-hook.mjs';

describe('the commands that make a commit', () => {
  it('reads a commit with its options, after another command and after git -C', () => {
    expect(['git commit -m "x"', 'cd core && git commit -q -F msg.txt', 'git -C D:/git/qlang commit -m x', 'git -c user.name=a commit']
      .map(makesACommit)).toEqual([true, true, true, true]);
  });

  it('leaves the plumbing of a merge, a search of the log and a command of no commit', () => {
    expect(['git commit-tree abc -p master', 'git log --grep=commit', 'git status', 'npm run ci']
      .map(makesACommit)).toEqual([false, false, false, false]);
  });
});
