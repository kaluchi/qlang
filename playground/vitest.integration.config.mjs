// The rules it holds: [QSGAT#gate].

import { defineConfig } from 'vitest/config';

// Integration test config — spawns the actual `playground/src/bin.mjs`
// process through `node:child_process`, exercising the wired-up
// `qplay` playground end-to-end (piped stdin, the `-i` REPL, exit
// codes). Lives in `test/integration/`
// and runs through its own npm script so the default
// `npm test -w @kaluchi/qlang-playground` keeps reporting unit failures
// without paying the spawn overhead.
//
// Coverage is intentionally NOT enforced here — v8 coverage runs
// in-process and does not capture child-process execution. The
// unit suite (`vitest.config.mjs`) keeps the 100/100/100/100 gate
// on the verbs / argv / render machinery.

export default defineConfig({
  test: {
    // A test that makes no assertion fails [QSGAT#gate].
    expect: { requireAssertions: true },
    include: ['test/integration/**/*.test.mjs'],
    testTimeout: 15000
  }
});
