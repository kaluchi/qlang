# qlang

Reference implementation of the qlang pipeline language: a monorepo of
the language core plus its tooling. This file is the seed every
session receives. It says how to start, what the tooling enforces, and
how work moves. It says nothing about the design of the language: that
lives in the specification, `docs/spec/`, the aim first, and where the
two disagree, the specification wins and this file is what changes.

## Start here, every session

The texts of the work speak in two voices [QSWRK#documents]. The
cataphatic ones state what holds, in the present: the chapters of
`docs/spec/`, the pages of the catalog, the cases and the comments of the
code. The apophatic ones carry the change against the baseline: the
dialogue of the session first, then the journal, `docs/journal/`, its
records and its research, the memory and the history of the commits. A
session reads the cataphatic core first, so its picture of the language
is built from what holds, then lands on the apophatic texts, where its
work is; a doubt or a reason it meets is said in the dialogue, or
written as a record where it asks for a choice, and never into a chapter,
a page or a comment.

1. Read whole the aim, `docs/spec/QSAIM-the-aim.md`: the mission, the
   satisfactory state, the principles and the order of the texts; and
   the chapter of the work, `docs/spec/QSWRK-the-work.md`, read whole
   before the first change: the records, the cases, the baseline, the
   branch and the measures. Then Tier 1 below, the language itself.
   What holds is stated by topic in `docs/spec/`, a chapter per topic
   cited by section, `[QSNAM#scope]`, its cases under
   `core/test/conformance/QSNAM/`; a decision is the change in transit,
   a file under `docs/journal/`, which dissolves into the chapters at
   the move of the baseline [QSWRK#spec]. One under
   `docs/journal/replaced/` is history, and its paths read in the tree its
   line `Left at` names [QSWRK#journal].
2. Land: `npm run desk`, the screen of the work: the branch against
   master, the walk of the baseline, the targets open, the records being
   decided, the stashes and the sister project's branch
   [QSWRK#baseline]; then the records in transit and the open records,
   whole, and the maintainer's message. `npm test` at the repo root runs
   in the background while reading. The git snapshot the harness
   injects at the start of a session goes stale; the screen you run is
   the truth. The sensors live in `scripts/sensors/`: the probes run
   wherever the checkout is, and the readers of the transcripts in a
   session on the maintainer's machine.
3. State in one paragraph where the work stands: the pain at hand, or
   the question under discussion.
4. Before the session ends, write every decision taken as a file under
   `docs/journal/`, a change of the language with the cases it leaves,
   met or targets. A decision that survives only in a conversation is
   lost. Then move the baseline: the records in transit dissolve into
   their sections, every record of the language no case names gets its
   fate while an open record waits, the probes of the open records and
   the chapters run, and the branch lands on master by a merge that
   holds no record in transit, so the next shift starts at a clean desk
   [QSWRK#baseline].

After a compaction the summary is a map and no source: reread Tier 1
whole, the conversation from its transcript,
`node scripts/sensors/transcript-tail.mjs`, and the desk, before the next
claim about the language; the next work comes from the pain the
dialogue holds and the records the desk shows, and the findings at hand
are weighed by them.

## Bootstrap recipe

The tree is larger than a context window. Read in tiers and stay under
a third of the context before reasoning starts.

Tier 0, always: the aim and the chapter of the work, and, for each
claim you are about to rely on, its probe rerun with `qlang` in script
mode.

Tier 1, every session, whole, before any claim about the language is
argued or a chapter is touched: `core/src/grammar.peggy` for the syntax,
`core/src/eval.mjs` for the semantics, `core/src/runtime/verb.mjs`
for application, `core/src/types.mjs` for the values, and
`core/lib/qlang.qlang`, the topic of the language, its first page and
chapters, with one source of a noun such as
`core/lib/qlang/number.qlang` for the shape of the catalog.
Read source with the file-reading tool, whole; a read the tool cut at
its token cap did not read the file, and
`node scripts/sensors/read-coverage.mjs` measures what a session read.
The persistence limit below applies to shell output, so a large file is
never `cat`-ed.

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

Never wholesale: `core/test/`, `docs/journal/replaced/`,
`docs/journal/research/`, the memory directory. Open a record out of
force where a record in force cites it.

A session validates the texts against the tree: a wrong sentence of a
chapter is replaced by the fact with its probe, and a hole becomes an
open record with the alternatives and their cost. Only the
maintainer's quoted words bind: a record whose `Decided by.` or
`Source.` line names the model is a reading the session weighs on its
merits and replaces when it finds a better one, never a rule to put to
the maintainer nor a question of leave [QSWRK#journal]. A session's
answer is findings with `file:line` and a probe, and the questions the
tree cannot answer; no retelling, no tables unless asked, no next-step
pitches, no talk of commits or pull requests.

Verify before asserting. Any claim about behaviour is run with
`qlang '…'` in script mode or in `qlang -i`; in Git Bash a query that
begins with `/` arrives as a path, which the command line reads back
[QSHST#shell]. A long tool output is persisted with a short preview; filter it
instead of reading it back whole.

## Workspaces

The folder name is the suffix of the package name, the npm packages
under the `@kaluchi/` scope. `core/` is the language core: pure JavaScript, no
runtime dependencies, and no `node:*` import anywhere under
`core/src/`, because the core ships to browser, Deno, and Bun; the
catalog under `core/lib/qlang/` loads at runtime through
`package.json#imports`. `cli/` is the Node command line and REPL.
`lsp/` is the language server. `site/` is the Astro site, private.
`vscode/` is the editor extension, unpublished, which runs the
language server of the checkout; npm carries the core and the command
line, and the Eclipse Marketplace the artifacts of the sister project. `npm
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
  runs recorded side by side [QSWRK#measure].
- `node scripts/benchmark.mjs author | run | grade | misses | frictions`:
  a set of tasks a clean author writes, clean children that solve it
  with the command line under a saved screen, the pages of the language
  and the command line, the grade by the tree, and the reading of
  the misses, which marks the set seen [QSWRK#measure]. The usage is the header
  of the script.
- `npm run check:fuzz -- [variants of each law] [seed]`: every law of the
  root run again with its literals changed to edge values; a variant
  that makes a host fail, throws past the fail track or prints as a text
  that reads back as another value fails it. The gate runs it with its
  defaults; other counts and seeds after a change to a primitive, the
  evaluator, the printer or the grammar.
- `npm run test:coverage`: the coverage thresholds on the core and the
  command line.
- `node scripts/dissolve-records.mjs Dnn`: at the move of the baseline,
  a record in transit dissolves into the sections it overrides, once
  they are written anew [QSWRK#baseline].
- `npm run build`: regenerate the parser from `core/src/grammar.peggy`.
- `npm test -w @kaluchi/qlang-cli`: one workspace.

## What the tooling enforces

`npm run check:conventions` fails on temporal lexicon in the sources
outside `docs/` (legacy, deprecated, currently, previously, backward
compatibility, and the TODO, FIXME, and HACK markers), on a digit
followed by a noun in markdown prose when a grep or a run already
answers the count, on an internal dependency range other than the
sibling's `^x.y.z`, on a refusal not declared by its address as a
literal or held by a constant the address does not name
(`VecToMapElementNotPairError` for `vec/toMap/ElementNotPairError`) [QSERR#site],
on a decision named in a page of the catalog, which a reader of the
language cannot follow, on a record that names no decider [QSWRK#journal], and
on a path this file, the chapter of the aim or the chapter of the work
names that the tree lacks or on words they quote from the tree that
their file no longer holds, on a date of the history in a text that
states what holds, on a series of the benchmark or of the outside audits
past its two latest, and on the walk of a baseline: a record of the
language the baseline holds that no case and no line of its fate does,
a record in transit in the merge that landed a branch,
more than twenty records since the baseline, a document of the research
the baseline holds that nothing in force cites, which
`node scripts/drop-documents.mjs` drops [QSWRK#baseline], a citation of a section of
the specification its chapter lacks, a case of a chapter changed since
the baseline that no record in transit over its section claims, a
chapter that cites a record, speaks of the journal or tells a history
[QSWRK#spec],
and a citation of a record not in force, which the code, the tests and the cases never make and the
documents make only of one waiting on its target [QSWRK#baseline]. `npm run check:probes` runs every probe of the open records and the
specification, the shell ones that read the repository alone included, and fails on one whose answer changed, which the branch that
changed it answers by rewriting the sentence with its probe [QSWRK#probe]; a
target case records the answer the tree gives today, so the suite
tells a repair from a broken case [QSWRK#target].

Coverage thresholds are pinned in the `vitest.config.mjs` of `core/`
and `cli/`; which thresholds the work keeps is an open record [D296].

A review holds a diff against the principles of the aim and the rules
of the work, a verdict and its findings each with its file and its line
[QSWRK#review].

## Change workflow

- A branch is a shift: it takes the pains of its shift, is named after
  them, and lands on master at every move of the baseline by a merge
  commit, made locally with no question asked where no pull request is
  open, so master is the clean desk [QSWRK#branch]. Never
  commit code on master; a change to documents alone lands without a
  branch. A branch states in its description what it shows when it
  lands. The sign of its diff by
  area, which `node scripts/measure.mjs` computes from the history, is
  read against what it delivered, and no commit message carries a count
  the history answers [QSWRK#diff].
- A branch that works targets, a subagent's in its own worktree
  among them, starts from a green master, leaves the decision
  records, the conformance cases and the gates as it found them, adding
  cases under its own record alone, and drops only the mark of a target
  it met [QSWRK#target]. Review it with master's copy of
  `node scripts/gate-diff.mjs --task Dnn`.
- Tests first for any new public surface. `npm run ci` green before a
  push.
- Commit on request. Push only on an explicit invitation. Never amend.
  Delete the branch after the merge, locally and on the remote.
- Write the decisions as files under `docs/journal/` in the same
  session as the work, prune in the same commit the part of an older
  record a new one takes, found by a search of the records' words, so a
  record in force says only what holds [QSWRK#journal], hold their quotes against
  the transcripts with `node scripts/sensors/check-quotes.mjs`, and
  write an open record the tree answers again as decided or closed.
- Before a construct is proposed, search the maintainer's words about
  it, `node scripts/sensors/maintainer-messages.mjs`: the project may
  have had it and left it. A capability of the language, a form of the
  grammar, the shape of a value or a word, is removed only on the
  maintainer's words about that very axis.
- A target is taken in hand only where landing it changes no met case
  and no record's text; otherwise a move of design with its record
  comes first [QSWRK#target].
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
  the fate it met, while something in force cites it [QSWRK#review].

## Release

`node scripts/release.mjs <version>` runs the release end to end:
preflight, version bump, sibling ranges rewritten to `^x.y.z`, parser
rebuild, tests and coverage, the release commit, push, wait for CI,
tag, push the tag. The tag push runs `.github/workflows/deploy.yml`,
which publishes through npm trusted publishing: the file name
`deploy.yml` is load-bearing, and no npm token takes part. A release
happens at the maintainer's word; between releases the sister project
consumes the workspace copy.

## Outside audit

`node scripts/outside-audit.mjs` runs the outside audit [QSWRK#review]: a clean
Opus reads the tree at HEAD from an empty directory, with no CLAUDE.md,
no memory and no MCP server, and its report lands in
`docs/journal/research/outside-audit/` under its date and tree; the session
writes its reading beside it and the fate of each finding in the README
there.

## Sister project

`D:\git\eclipse-jdt-search` consumes qlang and breaks first when the
public surface shifts. Its work is a record in force, [D38].
