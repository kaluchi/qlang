// ESLint flat config for the qlang monorepo.
//
// Scope: correctness-only. No stylistic rules (semicolons, quotes,
// trailing commas, line length). Author formatting is preserved —
// qlang source frequently uses hand-aligned columns inside comment
// tables and deliberately wide signatures. Prettier is intentionally
// absent; this config refuses to fight it.
//
// Enforces:
//   * `eslint:recommended` — unused vars, unreachable code, empty
//     blocks, duplicate imports, etc.
//   * `no-var` / `prefer-const` — mutation and scope clarity.
//   * `eqeqeq` — no implicit coercion from `==` / `!=`.
//   * `no-restricted-imports` — `core/src/**` must not reach for
//     `node:*` modules (CLAUDE.md hard invariant: the core ships
//     to browser, Deno, Bun bundles; a stray Node import breaks
//     every non-Node consumer). Test files, cli, and the lsp
//     server are free to `node:*` as before.
//
// Global ignores:
//   * node_modules — every workspace's own
//   * core/gen/**  — generated parser + compiled core catalog
//   * site/dist/** — astro build output
//   * site/coverage/** — vitest coverage HTML artefacts
//   * vscode/**    — vendored extension, not under our lint remit
//   * core/test/fixtures/** — deliberately malformed sample input

import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'core/gen/**',
      'site/dist/**',
      'site/coverage/**',
      'site/public/**',    // esbuild browser bundle produced by bundle-qlang.mjs
      'vscode/**'
    ]
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Node globals used by cli / lsp / scripts / tests.
        process:     'readonly',
        console:     'readonly',
        Buffer:      'readonly',
        setTimeout:  'readonly',
        clearTimeout:'readonly',
        setImmediate:'readonly',
        queueMicrotask: 'readonly',
        URL:         'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly'
      }
    },
    rules: {
      'no-var':       'error',
      'prefer-const': 'error',
      'eqeqeq':       ['error', 'always', { null: 'ignore' }],
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  },

  // core/src/** — browser-ready hard invariant.
  {
    files: ['core/src/**/*.mjs'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['node:*'],
          message:
            'core/src/** must stay browser-ready — no `node:*` imports. ' +
            'Move the Node-dependent code to core/host/, cli/src/, or ' +
            'lsp/src/, where the import is allowed.'
        }]
      }]
    }
  },

  // ANSI escape handling is the point of these files — the
  // `\x1b[…m` literal is the highlight renderer / editor redraw
  // target, not a stray control char in user input. Narrow the
  // disable to the files that own the contract so an accidental
  // control char in unrelated code still surfaces.
  {
    files: [
      'cli/src/line-editor.mjs',
      'cli/src/highlight-ansi.mjs',
      'cli/test/highlight-ansi.test.mjs',
      'cli/test/line-editor.test.mjs',
      'cli/test/repl.test.mjs'
    ],
    rules: {
      'no-control-regex': 'off'
    }
  }
];
