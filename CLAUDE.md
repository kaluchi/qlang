# qlang

Reference implementation of the qlang pipeline query language. Monorepo
of the language core plus tooling workspaces.

## Environment check (run at every conversation start)

1. `git status && git log --oneline -1` — branch state and HEAD commit
2. `npm test` at the repo root — every workspace must be green before
   starting new work. Document any pre-existing red tests explicitly.

## Workspaces

Folder name maps to the suffix of the npm package name; the npm scope
is always `@kaluchi/`. Single rule, applied uniformly:

- `core/` → `@kaluchi/qlang-core`. Language core. Pure JS, zero runtime
  deps. Ships `core/src/`, `core/host/`, `core/gen/` (and bundles
  `core/lib/qlang/core.qlang` via the build step).
- `cli/` → `@kaluchi/qlang-cli`. Node CLI, REPL, module loader, session
  persistence. Depends on `@kaluchi/qlang-core` via workspace link.
  *(Lands in a follow-up commit.)*
- `lsp/` → `@kaluchi/qlang-lsp`. Language server. Node-only.
- `site/` → `@kaluchi/qlang-site`. Astro documentation site. Private,
  not published to npm — Pages workflow ships `site/dist`.
- `vscode/` → `qlang-vscode`. VS Code Marketplace package, not
  npm-published.

`npm install` at the repo root uses npm workspaces (Node 18+) to
cross-link every package; no manual `npm link` is needed during
development.

## Hard invariants

- **`core/src/**` browser-ready**: zero `node:*` imports. The core
  ships to browser, Deno, and Bun bundles; a stray Node import breaks
  every non-Node consumer. Test files (`core/test/`), the CLI workspace,
  and the LSP server (`lsp/src/server.mjs`) may use `node:*` freely.
- **Coverage 100/100/100/100** (lines / branches / functions /
  statements). Every workspace's `vitest.config.mjs` pins the threshold.
  A change that dips below is blocker-grade.
- **Variant-B catalog**: operand metadata — `:docs`, `:examples`,
  `:throws`, `:category`, `:subject`, `:modifiers`, `:returns` — lives
  only in `core/lib/qlang/core.qlang`. The JS side registers executable
  impls via `PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/<name>'), …)`
  at module-load time and carries only `{ captured }` meta through
  `makeFn`. `langRuntime()` resolves `:qlang/impl :qlang/prim/<name>`
  handles on the template env once, then seals the registry.
- **Per-site error classes**: one throw site, one class. Built via the
  factories in `core/src/operand-errors.mjs` (`declareSubjectError`,
  `declareModifierError`, `declareElementError`,
  `declareComparabilityError`, `declareShapeError`,
  `declareArityError`). Each class sets `name` and `fingerprint` via
  the `brand()` helper and carries a structured `context` object.
- **No defensive noise, no temporal framing, no half-measures.** See
  the review rules for the exhaustive list.

## Review rules — authoritative source

`.claude/agents/qlang-review.md` contains the full ruleset the review
subagent enforces on every diff. The main agent follows the same rules
it reviews against. Read it before landing any non-trivial change. Key
chapters the main agent keeps in mind at every commit:

1. High-entropy qlang-specific lexicon. Generic programming vocabulary
   (`helper`, `process`, `data`, `handler`, `node`, `context`) is
   rejected whenever a qlang term (`pipeValue`, `env`, `fork`, `deflect`,
   `materialize`, `OperandCall`, `Projection`, `conduit`, `snapshot`)
   names the same concept more precisely.
2. Forbidden temporal framing: `now`, `currently`, `previously`, `was`,
   `legacy`, `deprecated`, `old`, `new` (as a state comparator),
   `for backward compatibility`, `TODO`, `FIXME`, `HACK`.
3. Per-site error classes through `core/src/operand-errors.mjs`
   factories.
4. No defensive code protecting scenarios that cannot occur under the
   calling convention.
5. No half-measures. If the name promises X, the body delivers X.
6. Structured fields over string conventions. No `name.startsWith('@')`
   outside `core/src/effect.mjs` (which owns `EFFECT_MARKER_PREFIX`).
7. Single source of truth for every domain constant.
8. Spec / internals / operands documentation stays aligned with the
   code (the `docs/` directory is project-wide and shared between
   `core/`, `lsp/`, and `site/`).
9. Test discipline — per-site class name AND `instanceof QlangTypeError`
   AND structured `context` fields, all three.
10. Browser-readiness of `core/src/**`.
11. Retroactive fixing of pre-existing violations in any file touched by
    a diff.
12. Conceptual completeness — flag organic next steps (sibling operands
    missing, `reify` field not surfaced by `manifest`, etc.).
13. Structural coherence — no code dumps. Every file in `core/src/`,
    `core/test/`, `docs/` must have a derivable one-sentence grouping
    principle.

## Commands

- `npm test` — every workspace's test suite via `npm test --workspaces
  --if-present`.
- `npm run test:coverage` — verify the 100/100/100/100 thresholds on
  the core workspace.
- `npm run build` — rebuild the generated parser
  (`core/scripts/build-grammar.mjs`) and the packaged core catalog
  (`core/scripts/build-core.mjs`).
- `npm test -w @kaluchi/qlang-cli` — single workspace.
- `npm run build && npm test` — full rebuild plus verification.

## Change workflow

1. Branch off master as `feature/<short-name>`. Never commit directly
   to master.
2. Test-first for any new public surface — vitest case describing the
   contract before the impl lands.
3. Spec / internals / operands docs update alongside the code in the
   same commit.
4. Self-review against `.claude/agents/qlang-review.md` before opening
   the PR.
5. Squash-merge, delete the branch both locally and on the remote.
