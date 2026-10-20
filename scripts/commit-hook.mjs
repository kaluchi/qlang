// The hook of the settings of the repository that runs `check:conventions`
// before a commit a session makes and refuses the commit with what it found,
// so a breach of a rule enters the dialogue where it is made [QSWRK#tooling].

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// makesACommit(command) → whether a command of the shell makes a commit,
// `git commit` with its options, after `git -C dir` among them, and not
// `git commit-tree`.
export const makesACommit = command => /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+commit(?![\w-])/.test(command);

// Run by the hook with `--run`: the call of the shell arrives on stdin, and
// a check that fails refuses it, its findings on stderr, by the code 2.
if (process.argv.includes('--run')) {
  const { tool_input: input } = JSON.parse(readFileSync(0, 'utf8'));
  if (makesACommit(input?.command ?? '')) {
    const checkout = join(dirname(fileURLToPath(import.meta.url)), '..');
    try {
      execFileSync(process.execPath, [join(checkout, 'scripts', 'check-conventions.mjs')], { cwd: checkout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (failed) {
      process.stderr.write(`check:conventions refused the commit:\n${failed.stdout ?? ''}${failed.stderr ?? ''}`);
      process.exit(2);
    }
  }
}
