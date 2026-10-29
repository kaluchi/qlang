// The rules it holds: [QSGAT#gate].

import { defineConfig } from 'vitest/config';

// The integration tests spawn `playground/src/bin.mjs` as a process,
// `qplay` end to end, its piped stdin, the `-i` REPL and its exit codes,
// under `test/integration/` and their own npm script; coverage counts the
// unit suite of `vitest.config.mjs`, since a process spawned is measured
// by none.

export default defineConfig({
  test: {
    // A test that makes no assertion fails [QSGAT#gate].
    expect: { requireAssertions: true },
    include: ['test/integration/**/*.test.mjs'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
