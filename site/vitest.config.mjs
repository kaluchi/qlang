// The rules it holds: [QSWRK#tooling].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A test that makes no assertion fails [D401].
    expect: { requireAssertions: true },
    include: ['test/**/*.test.mjs']
  }
});
