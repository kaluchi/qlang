// The rules it holds: [QSWRK#tooling].

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    // A value of the language compares by the tie of the one order [QSWRK#tooling].
    setupFiles: ['../core/test/helpers/language-equality.mjs']
  }
});
