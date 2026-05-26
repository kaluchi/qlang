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
  deps. Ships `core/src/`, `core/host/`, `core/lib/`, `core/gen/`. The
  catalog source files (`core/lib/qlang/*.qlang`) load at runtime via
  the platform's `import.meta.resolve` / `package.json#imports`
  mechanism; no pre-bake step.
- `cli/` → `@kaluchi/qlang-cli`. Node CLI, REPL, module loader, session
  persistence. Depends on `@kaluchi/qlang-core` via workspace link.
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
- **Operand catalog**: authored metadata — `:throws`, `:category`,
  `:subject`, `:modifiers`, `:returns` — lives in the per-family
  catalog files under `core/lib/qlang/operand/<family>.qlang`
  (plus shared tag-bindings in `core/lib/qlang/runtime-invariants.qlang`
  and value-class constructors in `core/lib/qlang/tag.qlang`).
  `core/lib/qlang/core.qlang` orchestrates them via a single
  `use([:qlang/runtime-invariants :qlang/tag :qlang/operand/arith
  …])` call. The JS side registers executable impls via
  `PRIMITIVE_REGISTRY.bind('qlang/prim/<name>', …)` at module-load
  time. Map keys are plain strings throughout; keyword objects
  exist as pipeline VALUES carrying `.literal` for display.
  `langRuntime()` resolves `:impl` handles on the template
  env once (replacing each `:qlang/prim/<name>` keyword with its
  bound JS function value), then seals the registry. Authored
  prose and example
  `~{…}` Quote segments live on each `BindStep`'s attached
  doc-prefix in its `qlang/ast/<uri>` module Quote and are
  reachable through `:name | docs` and `:name | examples`.
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
    missing, axis-operand surface incomplete for a new value-class, etc.).
13. Structural coherence — no code dumps. Every file in `core/src/`,
    `core/test/`, `docs/` must have a derivable one-sentence grouping
    principle.

## Commands

- `npm test` — every workspace's test suite via `npm test --workspaces
  --if-present`. Faster than `ci`; use during inner-loop iteration.
- `npm run ci` — the gate for any commit-ready change. Runs build +
  eslint + `check:conventions` + every workspace's tests + coverage
  thresholds + cli integration + site build, in order. Anything you
  intend to push must come out of this command green. `npm test`
  alone misses lint, conventions, coverage threshold violations,
  integration, and site build — every one of those has blocked CI
  on push in this repo.
- `npm run test:coverage` — verify the 100/100/100/100 thresholds on
  the core workspace.
- `npm run build` — rebuild the generated parser
  (`core/scripts/build-grammar.mjs`). The catalog source files
  (`core/lib/qlang/*.qlang`) load directly at runtime through
  `package.json#imports` + `import.meta.resolve`; no pre-bake step.
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
5. `npm run ci` green end-to-end before push. No exceptions.
6. Push requires an explicit user invitation — commit on request is
   fine, push is a separate action.
7. Squash-merge, delete the branch both locally and on the remote.

## PR review with Gemini Code Assist

A GitHub App named `gemini-code-assist[bot]` reviews PRs against
`master`. CI is configured to trigger on `pull_request: master`, not
on push to feature branches — so a PR must exist before either CI
or Gemini can run.

Three node scripts under `scripts/` automate the loop end to end
— call them with the PR number, no `MSYS_NO_PATHCONV` / GraphQL
ceremony in the user-facing flow:

```bash
# 1. Trigger Gemini Code Assist on PR #N. A 👀 reaction on the
#    comment is the Gemini-side ACK.
node scripts/gemini-review.mjs <N>

# 2. Print every Gemini comment added since the last review.
#    Pass --since <ISO_TIMESTAMP> to scope to a specific window.
node scripts/gemini-show.mjs <N>
node scripts/gemini-show.mjs <N> --since 2026-05-26T21:00:00Z

# 3. Resolve every open review thread on PR #N. Run after applying
#    fixes so the next round's comments do not queue under the
#    previous round's open threads.
node scripts/gemini-resolve.mjs <N>
```

The iteration loop, end to end:

1. **Trigger a review** via `scripts/gemini-review.mjs <N>`. The
   script posts `/gemini review` through `gh pr comment
   --body-file -` reading the body off stdin — the slash-prefixed
   payload bypasses any argument-side path translation Git Bash
   would otherwise perform on Windows.

2. **Read the review** via `scripts/gemini-show.mjs <N>` (top-level
   summary + inline file comments in one pass, filtered to the
   `gemini-code-assist[bot]` author).

3. **Apply or reject each comment with a test-first cadence.**
   For every comment that lands a real bug or DRY violation:
   - Write a regression test that fails on `master`'s behaviour
     before the fix (`vitest run` once to confirm red).
   - Apply the fix in the runtime / catalog / docs.
   - `vitest run` again to confirm green.
   - `npm run ci` green end-to-end before push.

   For comments that misread the code (false positives — happens
   roughly once per round), document the rejection in the commit
   message body and resolve the thread anyway.

4. **Resolve every thread before re-triggering** via
   `scripts/gemini-resolve.mjs <N>`. Threads stay open by default;
   Gemini will not re-surface the same issue, but leaving them
   open buries the next round's comments under the inline list.

5. **Push, wait for CI, re-trigger Gemini.** Each round catches
   distinct issues — keep iterating until the round comes back
   with zero high/medium findings (low/style comments are a
   judgement call).

### Catch-all smoke tests over the catalog

When Gemini surfaces an issue that fits a *pattern* affecting many
sites — e.g., a `declareShapeError` message-builder destructures
`{ key }` and one throw site forgot to pass it — write the
per-site fix AND a catch-all smoke test that would have caught
every same-shape regression on the first affected case. Pattern:

- Walk every existing conformance / unit case for the affected
  contract.
- Run each query, inspect the runtime-observable surface (here,
  `originalError.message` for the missing-`undefined` interpolation
  family), assert the failure mode absent.

`core/test/unit/error-message-completeness.test.mjs` is the
example: 1192 conformance cases auto-checked for «message contains
literal `undefined`». Every future missing-throw-site-param across
all 186 error classes would surface there on the first conformance
case that exercises it — without writing per-class regressions.

### Audit own diffs for DRY violations before each push

The same DRY trap keeps catching me on this repo: when a
value-class redesign moves one site to a new equality / shape
primitive, every consumer must reuse the same helper in the same
commit. Mint-site and query-site must share semantics. The audit
checklist on any value-class change:

- For Set/Map equality changes: `has`, `at`, `/key` projection,
  `eq`/`deepEqual`, `union`/`inter`/`minus`, `distinct`,
  `groupBy`, `indexBy`, codec round-trip.
- For key-shape changes (e.g., JsonObject string keys vs qlang Map
  keyword keys): `keys`, `vals`, `entries` (if added), codec
  envelope shapes.

Never copy-paste the equality logic inline — extract or reuse the
helper. The inline copy is the signal you're walking back into the
dual-implementation trap.
