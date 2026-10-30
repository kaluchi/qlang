// The rules it holds: [QSGAT#gate].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A test that makes no assertion fails [QSGAT#gate].
    expect: { requireAssertions: true },
    include: ['test/**/*.test.mjs'],
    // A value of the language compares by the tie of the one order [QSGAT#gate].
    setupFiles: ['test/helpers/language-equality.mjs'],
    // A test and a hook wait twenty seconds, the boot of the root under
    // the coverage among them.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
