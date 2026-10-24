// The rules it holds: [QSGAT#gate].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A test that makes no assertion fails [QSGAT#gate].
    expect: { requireAssertions: true },
    include: ['test/**/*.test.mjs']
  }
});
