// The rules it holds: [QSWRK#tooling].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    // The tests of integration under `test/integration/`, which run the
    // command line in processes of their own, run by
    // `vitest.integration.config.mjs`, the script `test:integration`.
    exclude: ['node_modules/**', 'test/integration/**'],
    // A test waits fifteen seconds, the boot of the root under the
    // coverage among them, as in the core.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      // bin.mjs, the one file that touches the process, runs in a
      // process of its own, which the coverage of the tests does not
      // reach; main.mjs holds every branch [QSWRK#tooling].
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
