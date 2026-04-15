import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.mjs'],
      // bin.mjs is the Node-runtime adapter — a two-line shebang
      // that calls into main.mjs and forwards the exit code to
      // process.exit. It carries no testable branch and would only
      // execute under subprocess invocation, which v8 coverage does
      // not capture from inside the test process. main.mjs holds
      // the orchestration logic and is exercised exhaustively.
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
