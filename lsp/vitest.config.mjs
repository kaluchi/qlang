// The decisions it exists for: [D239].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs']
  }
});
