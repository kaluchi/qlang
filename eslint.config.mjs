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
//     `node:*` modules ([QSGAT#workspaces]: the core ships to browser, Deno and
//     Bun bundles, and a Node import breaks every consumer that is
//     no Node). The tests, the streams, the playground and the
//     language server take `node:*`.
//
// Global ignores:
//   * node_modules — every workspace's own
//   * core/gen/**  — the generated parser
//   * site/dist/** — astro build output
//   * site/coverage/** — vitest coverage HTML artefacts
//   * vscode/**    — the editor's extension, outside this lint

import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'core/gen/**',
      'site/dist/**',
      'site/coverage/**',
      'site/public/**',    // esbuild browser bundle produced by bundle-qlang.mjs
      'scripts/benchmark/sets/**',  // the data and the generators clean authors wrote [QSMSR#benchmark]
      'vscode/**'
    ]
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Node globals the streams, the playground, the language server, the scripts and the tests use.
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
            'Move the Node-dependent code to core/host/, stdio/src/, playground/src/, or ' +
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
      'playground/src/line-editor.mjs',
      'playground/src/highlight-ansi.mjs',
      'playground/test/QSCLI/colour.test.mjs',
      'playground/test/QSCLI/line-editor.test.mjs',
      'playground/test/QSCLI/repl.test.mjs',
      'playground/test/helpers/scripted-repl.mjs'
    ],
    rules: {
      'no-control-regex': 'off'
    }
  }
];
