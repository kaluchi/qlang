import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      exclude: ['src/grammar.generated.mjs'],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99
      }
    }
  }
});
