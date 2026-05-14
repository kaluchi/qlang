import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      // `load-source-web.mjs` is the browser-side loader resolved
      // via the `default` condition of `#qlang/load-source` — Node
      // tests never import it (the `node` condition selects
      // `host/load-source-node.mjs`). Browser-bundle smoke tests
      // are out of scope for this workspace's coverage gate.
      exclude: ['src/load-source-web.mjs'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
