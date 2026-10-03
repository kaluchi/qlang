# qlang

Reference implementation of the qlang pipeline language: a monorepo of
the language core plus its tooling. This file is the seed every
session receives. It says how to start, what the tooling enforces, and
how work moves. It says nothing about the design of the language: that
lives in `docs/qlang-audit.md`, and where the two disagree, the audit
wins and this file is what changes.

## Start here, every session

1. Read `docs/qlang-audit.md` in full, its chapter on reading first.
   It carries the mission, the satisfactory state, the principles, the
   scars, the finish, and the route of milestones. Each numbered
   decision is a file under `docs/decisions/`, opened where the audit
   cites it, and `node scripts/requirements.mjs` lists the
   requirements every decision left and which the tree meets.
   `docs/qlang-entrypoint.md` designs the computed context a session
   starts from. Its sensors live in `scripts/sensors/`: the probes run
   wherever the checkout is, and the readers of the transcripts in a
   session on the maintainer's machine.
2. `git status && git log --oneline -3`, then `npm test` at the repo
   root, in the background while reading. The git snapshot the
   harness injects at the start of a session goes stale; the status
   you run is the truth.
3. State in one paragraph where the work stands: the scar at hand, or
   the question under discussion.
4. Before the session ends, write every decision taken as a file
   under `docs/decisions/`, with the requirements it leaves as target
   cases of the conformance suite. A decision that survives only in a
   conversation is lost.

## Bootstrap recipe

The tree is larger than a context window; the September 2026 session
that wrote the audit overflowed by reading it whole. Read in tiers and
stay under a third of the context before reasoning starts.

Tier 0, always: the audit, and, for each claim you are about to rely
on, the probe the audit cites rerun with `qlang` in script mode.

Tier 1, every session, whole, before any claim about the language is
argued or the audit is touched: `core/src/grammar.peggy` for the syntax,
`core/src/eval.mjs` for the semantics, `core/src/runtime/verb.mjs`
for application, `core/src/types.mjs` for the values, and
`core/lib/qlang/core.qlang` with one module of a noun such as
`core/lib/qlang/number.qlang` for the shape of the catalog.
Read source with the file-reading tool, whole; the persistence limit
below applies to shell output, so a large file is never `cat`-ed.

Tier 2, by topic, only the files the topic names:

- arguments and dispatch: `core/src/runtime/nouns.mjs` for the walk
  from a subject's tags to the verb a name calls,
  `core/lib/qlang/any.qlang` for the contracts several kinds answer,
  and `core/src/runtime/use.mjs` for `use`, the verb that writes
  the scope
- names, scope, modules, sessions: `core/src/state.mjs`,
  `core/src/fork.mjs`, `core/src/env-keys.mjs`,
  `core/src/runtime/use.mjs`, `core/src/runtime/env.mjs`,
  `core/src/session.mjs`
- errors: `core/src/errors.mjs`, `core/src/operand-errors.mjs`,
  `core/src/error-convert.mjs`, `core/src/eval-trail.mjs`
- self-description: `core/src/runtime/axis.mjs`,
  `core/src/runtime/manifest.mjs`, `core/src/runtime/doc.mjs`,
  `core/lib/qlang/doc.qlang`,
  `core/lib/qlang/builtin.qlang`
- code as data: `core/src/quote.mjs`,
  `core/src/runtime/code.mjs`, `core/src/walk.mjs`
- printing and codecs: `core/src/runtime/print-value.mjs`,
  `core/src/runtime/print.mjs`, `core/src/runtime/format.mjs`
- host boundary: `core/src/effect.mjs`, `core/src/effect-check.mjs`,
  `core/src/runtime/bootstrap.mjs`, `core/host/`, `cli/src/main.mjs`,
  `cli/src/script-mode.mjs`, `cli/src/cli-locator.mjs`
- tests: `core/test/unit/conformance.test.mjs` for the runner, then
  only the conformance or unit file of the topic

Never wholesale: `core/test/`, the records under `docs/decisions/`,
`.claude/agents/qlang-review.md`, the memory directory. Open a record
where the audit cites it.

The audit is the maintainer's memory between sessions. A session
validates it against the code: a wrong sentence is replaced by the
fact with its probe, a hole becomes a question in the chapter of open
questions with the alternatives and their cost, and nothing
is deleted or condensed without the maintainer's word. A session's
answer is findings with `file:line` and a probe, and the questions the
tree cannot answer; no retelling, no tables unless asked, no next-step
pitches, no talk of commits or pull requests.

Verify before asserting. Any claim about behaviour is run with
`qlang '…'` in script mode or in `qlang -i`; in Git Bash prefix the
call with `MSYS_NO_PATHCONV=1` when the query begins with `/`. A tool
output above thirty kilobytes is persisted with a short preview;
filter it instead of reading it back whole.

## Workspaces

The folder name is the suffix of the npm package name under the
`@kaluchi/` scope. `core/` is the language core: pure JavaScript, no
runtime dependencies, and no `node:*` import anywhere under
`core/src/`, because the core ships to browser, Deno, and Bun; the
catalog under `core/lib/qlang/` loads at runtime through
`package.json#imports`. `cli/` is the Node command line and REPL.
`lsp/` is the language server. `site/` is the Astro site, private.
`vscode/` is the editor extension, published to the Marketplace. `npm
install` at the root links the workspaces; the Node floor is the
`engines.node` field of each workspace.

## Commands

- `npm test`: every workspace's suite. Use it in the inner loop.
- `npm run ci`: the gate for anything meant to be pushed. Build,
  eslint, `check:conventions`, `check:probes`, `check:benchmark`, every
  suite, coverage thresholds, CLI integration, site build, in that
  order. Judge it by its real exit code, captured to a file, never
  through a pipe.
- `node scripts/benchmark.mjs prompt | screen | report`: the prompt of a
  run of a fresh model, the hash of the first screen it reads, and the
  runs recorded side by side [D104].
- `node scripts/benchmark.mjs author | run | grade | misses | frictions |
  predict`: a set of tasks a clean author writes, clean children that
  solve it blind or with the command line under a saved screen, the
  grade by the tree, and the reading of the misses, which marks the set
  seen [D142]. The usage is the header of the script.
- `npm run test:coverage`: the coverage thresholds on the core.
- `npm run build`: regenerate the parser from `core/src/grammar.peggy`.
- `npm test -w @kaluchi/qlang-cli`: one workspace.

## What the tooling enforces

`npm run check:conventions` fails on temporal lexicon in sources and
documents (legacy, deprecated, currently, previously, backward
compatibility, and the TODO, FIXME, and HACK markers), on a digit
followed by a noun in markdown prose when a grep or a run already
answers the count, on an internal dependency range other than the
sibling's `^x.y.z`, on error-class suffixes, on a decision named in a page of the
catalog, which a reader of the language cannot follow, and on a path
the audit, the entrypoint document or this file names that the tree
lacks or on words they quote from the tree that their file no longer
holds. The audit deletes the suffix check together with the classes
of errors it guards. `npm run check:probes` runs every probe of the audit and the
entrypoint document, the shell ones that read the repository alone
included, and fails on one whose answer changed, which the branch that
changed it answers by rewriting the sentence with its probe [D93]; a
target case records the answer the tree gives today, so the suite
tells a repair from a broken case [D91].

Coverage thresholds of one hundred on every axis are pinned in the
`vitest.config.mjs` of `core/` and `cli/`; the audit keeps a threshold
for the language core alone.

`.claude/agents/qlang-review.md` is the ruleset the review subagent
applies, each rule a principle of the audit and the check that enforces
it; where a rule and the audit disagree, the audit wins.

## Change workflow

- Branch off master and name the branch after the scar it repairs.
  Never commit code on master; a change to documents alone lands
  without a branch.
- A branch repairs one scar or one part of one, states in its
  description what it shows when it lands, and reports the sign of
  its diff by area: core sources, catalog, documents, tests.
- A branch that works targets, a subagent's in its own worktree
  among them, starts from a green baseline, leaves the decision
  records, the conformance cases and the gates as it found them, and
  drops only the mark of a target it met (`docs/decisions/D59.md`).
  Review it with the baseline's copy of `node scripts/gate-diff.mjs
  --task Dnn`.
- Tests first for any new public surface. `npm run ci` green before a
  push.
- Commit on request. Push only on an explicit invitation. Never amend.
  Ask which merge strategy to use before merging. Delete the branch
  after the merge, locally and on the remote.
- Write the decisions as files under `docs/decisions/` in the same
  session as the work, hold their quotes against the transcripts with
  `node scripts/sensors/check-quotes.mjs`, and remove a scar the tree
  no longer shows.

## Release

`node scripts/release.mjs <version>` runs the release end to end:
preflight, version bump, sibling ranges rewritten to `^x.y.z`, parser
rebuild, tests and coverage, the release commit, push, wait for CI,
tag, push the tag. The tag push runs `.github/workflows/deploy.yml`,
which publishes through npm trusted publishing: the file name
`deploy.yml` is load-bearing, and no npm token takes part. Releases
happen at milestones; between them the sister project consumes the
workspace copy.

## External review

`scripts/gemini-review.mjs`, `scripts/gemini-show.mjs`, and
`scripts/gemini-resolve.mjs` drive Gemini Code Assist on a pull
request; the first review runs on its own when the request opens, and
the trigger script is for later rounds. The audit treats the reviewer
as a signal at milestones rather than a gate: apply a finding that
names a real defect, and reject a proposed fallback or defensive check
with a sentence in the commit body.

## Sister project

`D:\git\eclipse-jdt-search` consumes qlang and breaks first when the
public surface shifts. Its state and its place in the plan are in the
audit.
