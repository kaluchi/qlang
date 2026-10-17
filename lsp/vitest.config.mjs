// The rules it holds: [QSWRK#tooling].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs']
  }
});
