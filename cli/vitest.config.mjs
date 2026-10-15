// The decisions it exists for: [QSWRK#tooling].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    // Integration tests live under `test/integration/` and run
    // through `vitest.integration.config.mjs` via a dedicated
    // `test:integration` script — they spawn child processes and
    // pay an order-of-magnitude longer wall-clock per case, so
    // the default `npm test` keeps fast-feedback semantics and
    // the coverage gate stays in-process.
    exclude: ['node_modules/**', 'test/integration/**'],
    // The first test of a file loads the full langRuntime bootstrap,
    // which under v8 coverage instrumentation outgrows the default 5s,
    // as in the core; 15s still catches a genuine hang.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      // bin.mjs is the Node-runtime adapter, the one file that
      // touches the process: it hands main.mjs the arguments, the
      // streams and the environment and exits with the code main
      // resolves. It carries no testable branch and would only
      // execute under subprocess invocation, which v8 coverage does
      // not capture from inside the test process. main.mjs holds
      // the orchestration logic and is exercised exhaustively.
      exclude: ['src/bin.mjs'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
