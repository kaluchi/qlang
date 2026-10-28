// The rules it holds: [QSGAT#gate].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A test that makes no assertion fails [QSGAT#gate].
    expect: { requireAssertions: true },
    include: ['test/**/*.test.mjs'],
    // The tests of integration under `test/integration/`, which run the
    // command line in processes of their own, run by
    // `vitest.integration.config.mjs`, the script `test:integration`.
    exclude: ['node_modules/**', 'test/integration/**'],
    // A value of the language compares by the tie of the one order [QSGAT#gate].
    setupFiles: ['../core/test/helpers/language-equality.mjs'],
    // A test and a hook wait twenty seconds, the boot of the root under
    // the coverage among them, as in the core.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      // The sources of the streams the playground installs are held by
      // its suite, the host their tests run them in [QSGAT#gate].
      include: ['src/**/*.mjs', '**/stdio/src/**/*.mjs'],
      allowExternal: true,
      // bin.mjs, the one file that touches the process, runs in a
      // process of its own, which the coverage of the tests does not
      // reach; main.mjs holds every branch [QSGAT#gate].
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
