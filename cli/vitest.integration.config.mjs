import { defineConfig } from 'vitest/config';

// Integration test config — spawns the actual `cli/src/bin.mjs`
// process through `node:child_process`, exercising the wired-up
// `qlang` / `ql` CLI end-to-end (lazy module loads, piped stdin,
// `-i` REPL bootstrap, exit codes). Lives in `test/integration/`
// and runs through its own npm script so the default
// `npm test -w @kaluchi/qlang-cli` keeps reporting unit failures
// without paying the spawn overhead.
//
// Coverage is intentionally NOT enforced here — v8 coverage runs
// in-process and does not capture child-process execution. The
// unit suite (`vitest.config.mjs`) keeps the 100/100/100/100 gate
// on the operand / argv / render machinery.

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.mjs'],
    testTimeout: 15000
  }
});
