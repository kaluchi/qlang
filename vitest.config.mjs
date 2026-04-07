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
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95
      }
    }
  }
});
