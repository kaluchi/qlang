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
   cites it; one under `docs/decisions/replaced/` is history, and its
   paths read in the tree its line `Left at` names [D282]. What holds at
   the baseline is stated by topic in `docs/spec/`, a chapter per topic
   cited by section, `[QSNAM#scope]`, its cases under
   `core/test/conformance/QSNAM/`; a decision is the change in transit,
   which dissolves into the chapters at the move of the baseline [D283],
   and a topic no chapter holds yet keeps its rules in the records in
   force. `node scripts/requirements.mjs` lists the requirements every
   decision left and which the tree meets.
   `docs/qlang-entrypoint.md` is a draft of the computed context a
   session starts from, ideas and no decision [D231]. The sensors live
   in `scripts/sensors/`: the probes run wherever the checkout is, and
   the readers of the transcripts in a session on the maintainer's
   machine.
2. `npm run desk`, the screen of the work: the branch against master,
   the walk of the audit's baseline, the targets open, the stashes and
   the sister project's branch [D237]. Then `npm test` at the repo root,
   in the background while reading. The git snapshot the harness
   injects at the start of a session goes stale; the screen you run is
   the truth.
3. State in one paragraph where the work stands: the scar at hand, or
   the question under discussion.
4. Before the session ends, write every decision taken as a file
   under `docs/decisions/`, with the requirements it leaves as target
   cases of the conformance suite. A decision that survives only in a
   conversation is lost. Then walk the baseline: every record no case
   names gets its fate, the audit moves to the tree the session leaves,
   and the next shift starts at a clean desk [D225].

After a compaction the summary is a map and no source: reread Tier 1
whole, and the conversation from its transcript,
`node scripts/sensors/transcript-tail.mjs`, before the next claim about
the language.

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
`core/lib/qlang.qlang`, the topic of the language, its first page and
chapters, with one source of a noun such as
`core/lib/qlang/number.qlang` for the shape of the catalog.
Read source with the file-reading tool, whole; the persistence limit
below applies to shell output, so a large file is never `cat`-ed.

Tier 2, by topic, only the files the topic names:

- arguments and dispatch: `core/src/runtime/nouns.mjs` for the walk
  from a subject's tags to the verb a name calls, and
  `core/lib/qlang/any.qlang` for the words every value answers
- names, scope, the root, sessions: `docs/spec/QSNAM-names-and-scope.md`
  first, then `core/src/state.mjs`,
  `core/src/env-keys.mjs`,
  `core/src/runtime/root.mjs`, `core/src/runtime/env.mjs`,
  `core/src/session.mjs`
- errors: `core/src/errors.mjs`, `core/src/error-convert.mjs`,
  `core/src/eval-trail.mjs`
- self-description: `core/src/runtime/axis.mjs`,
  `core/src/runtime/manifest.mjs`, `core/src/runtime/doc.mjs`,
  `core/lib/qlang/doc.qlang`,
  `core/lib/qlang/builtin.qlang`
- code as data: `core/src/quote.mjs`,
  `core/src/runtime/code.mjs`, `core/src/walk.mjs`
- printing and codecs: `core/src/runtime/print-value.mjs`,
  `core/src/runtime/print.mjs`, `core/src/runtime/format.mjs`
- host boundary: `core/src/runtime/bootstrap.mjs`, `core/host/`,
  `cli/src/main.mjs`, `cli/src/script-mode.mjs`,
  `cli/src/cli-sources.mjs`, `cli/src/streams.mjs`
- tests: `core/test/unit/conformance.test.mjs` for the runner, then
  only the conformance or unit file of the topic

Never wholesale: `core/test/`, the records under `docs/decisions/`,
`.claude/agents/qlang-review.md`, the memory directory. Open a record
where the audit cites it.

The audit is the maintainer's memory between sessions. A session
validates it against the code: a wrong sentence is replaced by the
fact with its probe, a hole becomes a question in the chapter of open
questions with the alternatives and their cost, and nothing
is deleted or condensed without the maintainer's word. Only the
maintainer's quoted words bind: a record whose `Decided by.` or
`Source.` line names the model is a reading the session weighs on its
merits and replaces when it finds a better one, never a rule to put to
the maintainer nor a question of leave [D155]. A session's
answer is findings with `file:line` and a probe, and the questions the
tree cannot answer; no retelling, no tables unless asked, no next-step
pitches, no talk of commits or pull requests.

Verify before asserting. Any claim about behaviour is run with
`qlang '…'` in script mode or in `qlang -i`; in Git Bash a query that
begins with `/` arrives as a path, which the command line reads back
[D144]. A long tool output is persisted with a short preview; filter it
instead of reading it back whole.

## Workspaces

The folder name is the suffix of the package name, the npm packages
under the `@kaluchi/` scope. `core/` is the language core: pure JavaScript, no
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
  eslint, `check:conventions`, `check:probes`, `check:fuzz`,
  `check:benchmark`, every suite, coverage thresholds, CLI integration,
  site build, in that order. Judge it by its real exit code, captured
  to a file, never through a pipe.
- `node scripts/benchmark.mjs prompt | screen | report`: the prompt of a
  run of a fresh model, the hash of the first screen it reads, and the
  runs recorded side by side [D26].
- `node scripts/benchmark.mjs author | run | grade | misses | frictions`:
  a set of tasks a clean author writes, clean children that solve it
  with the command line under a saved screen, the pages of the language
  and the command line, the grade by the tree, and the reading of
  the misses, which marks the set seen [D26]. The usage is the header
  of the script.
- `npm run check:fuzz -- [variants of each law] [seed]`: every law of the
  root run again with its literals changed to edge values; a variant
  that makes a host fail, throws past the fail track or prints as a text
  that reads back as another value fails it. The gate runs it with its
  defaults; other counts and seeds after a change to a primitive, the
  evaluator, the printer or the grammar.
- `npm run test:coverage`: the coverage thresholds on the core.
- `node scripts/dissolve-records.mjs Dnn`: at the move of the baseline,
  a record in transit dissolves into the sections it overrides, once
  they are written anew [D283].
- `npm run build`: regenerate the parser from `core/src/grammar.peggy`.
- `npm test -w @kaluchi/qlang-cli`: one workspace.

## What the tooling enforces

`npm run check:conventions` fails on temporal lexicon in sources and
documents (legacy, deprecated, currently, previously, backward
compatibility, and the TODO, FIXME, and HACK markers), on a digit
followed by a noun in markdown prose when a grep or a run already
answers the count, on an internal dependency range other than the
sibling's `^x.y.z`, on a refusal not declared by its address as a
literal or held by a constant the address does not name
(`VecToMapElementNotPairError` for `vec/toMap/ElementNotPairError`) [D46],
on a decision named in a page of the catalog, which a reader of the
language cannot follow, on a record that names no decider [D155], and
on a path the audit, the entrypoint document or this file names that
the tree lacks or on words they quote from the tree that their file no
longer holds, and on the walk of a baseline: a record of the language
the audit's baseline holds that no case and no line of its fate does,
more than twenty records since the baseline, a document of the research
the baseline holds that nothing in force cites, which
`node scripts/drop-documents.mjs` drops [D282], a citation of a section of
the specification its chapter lacks, a case of a chapter changed since
the baseline that no record in transit over its section claims [D283],
and a citation of a record not in force, which the code, the tests and the cases never make and the
documents make only of one waiting on its target [D225]. `npm run check:probes` runs every probe of the audit and the
entrypoint document, the shell ones that read the repository alone
included, and fails on one whose answer changed, which the branch that
changed it answers by rewriting the sentence with its probe [D93]; a
target case records the answer the tree gives today, so the suite
tells a repair from a broken case [D91].

Coverage thresholds are pinned in the `vitest.config.mjs` of `core/`
and `cli/`; the audit keeps a threshold for the language core alone.

`.claude/agents/qlang-review.md` is the ruleset the review subagent
applies, each rule a principle of the audit and the check that enforces
it; where a rule and the audit disagree, the audit wins.

## Change workflow

- A branch is a shift: it takes the scars of its shift, is named after
  them, and lands on master at every move of the baseline by a merge
  commit, made locally with no question asked where no pull request is
  open, so master is the clean desk [D227]. Never
  commit code on master; a change to documents alone lands without a
  branch. A branch states in its description what it shows when it
  lands. The sign of its diff by
  area, which `node scripts/measure.mjs` computes from the history, is
  read against what it delivered, and no commit message carries a count
  the history answers [D208].
- A branch that works targets, a subagent's in its own worktree
  among them, starts from a green baseline, leaves the decision
  records, the conformance cases and the gates as it found them, and
  drops only the mark of a target it met (`docs/decisions/D59.md`).
  Review it with the baseline's copy of `node scripts/gate-diff.mjs
  --task Dnn`.
- Tests first for any new public surface. `npm run ci` green before a
  push.
- Commit on request. Push only on an explicit invitation. Never amend.
  Delete the branch after the merge, locally and on the remote.
- Write the decisions as files under `docs/decisions/` in the same
  session as the work, prune in the same commit the part of an older
  record a new one takes, found by a search of the records' words, so a
  record in force says only what holds [D227], hold their quotes against
  the transcripts with `node scripts/sensors/check-quotes.mjs`, and
  remove a scar the tree no longer shows.
- Before a construct is proposed, search the maintainer's words about
  it, `node scripts/sensors/maintainer-messages.mjs`: the project may
  have had it and left it. A capability of the language, a form of the
  grammar, the shape of a value or a word, is removed only on the
  maintainer's words about that very axis.
- A target is taken in hand only where landing it changes no met case
  and no record's text; otherwise a move of design with its record
  comes first [D59].
- Each clause added to a condition is held by a test that fails without
  it, cut on a copy to watch it fail. A change to how inputs are read is
  run against the previous version over generated inputs, each
  divergence explained. A change to the scope a quote runs in or to the
  reach of a bare name comes with tests of shadowing by a reader's word
  and by a later source's, and a quick path in a shared helper is held
  against every caller and every input each hands it, an error and a
  value under a tag among them.
- In the inner loop run the tests of the topic; before a commit
  `npm test`, and `node scripts/benchmark.mjs check` where the change
  reads a form of the language anew; the full gate once a series,
  before a push, or where only it checks. While the gate runs, run
  nothing that boots the language, no probe, no sensor and no child of
  the benchmark, since a second boot starves the coverage run.
- A review's report is kept as its writer wrote it, each finding with
  the fate it met, while a record in force cites it [D282].

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

`node scripts/outside-audit.mjs` runs the outside audit [D277]: a clean
Opus reads the tree at HEAD from an empty directory, with no CLAUDE.md,
no memory and no MCP server, and its report lands in
`docs/research/outside-audit/` under its date and tree; the session
writes its reading beside it and the fate of each finding in the README
there.

## Sister project

`D:\git\eclipse-jdt-search` consumes qlang and breaks first when the
public surface shifts. Its state and its place in the plan are in the
audit.
