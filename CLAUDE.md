# qlang

Reference implementation of the qlang pipeline query language: a monorepo
of the language core and its tooling. This file is the table of contents a
session starts from: how to start, what to read for a topic, the commands,
and the chapters that state the rules [QSVOX#seed]. It restates no rule;
where it and a chapter part, the chapter wins and this file changes.

## Start

1. Read whole the chapter of the work, `docs/spec/QSWRK-the-work.md`: the
   session and the stint, the journal, the closeout and the
   reconciliation. Then Tier 1 below, the language itself. The texts speak
   in two voices, the cataphatic core read first and the apophatic texts,
   where the work is, after it [QSVOX#voices].
2. Land: `npm run desk`, the screen of the work; the aim,
   `docs/journal/AIM.md`, its mission, its satisfactory state and the
   principles a choice is weighed by; the records in transit and the open
   records, whole. `npm test` runs in the background while reading. The git
   snapshot the harness injects at the start of a session goes stale; the
   screen you run is the truth.
3. State in one paragraph where the work stands: the pain at hand, or the
   question under discussion.
4. A decision is written as a record when it is taken, on the branch of the
   stint [QSWRK#stint]; a closeout comes at the maintainer's word, or in a
   session that works on its own while he is away [QSWRK#closeout].

After a compaction the summary is a map and no source: reread Tier 1 whole
and the desk before the next claim about the language, the messages kept
after the summary the dialogue as it was written.

## Read in tiers

The tree is larger than a context window. Read in tiers, each file whole
with the file-reading tool: a read the tool cut at its token cap did not
read the file, and `node scripts/sensors/read-coverage.mjs` measures what a
session read. A large file is never `cat`-ed.

Tier 0, always: the chapter of the work, and, for each claim you are about
to rely on, its probe rerun with `qlang` in script mode.

Tier 1, every session, before any claim about the language is argued or a
chapter is touched: `core/src/grammar.peggy` for the syntax,
`core/src/eval.mjs` for the semantics, `core/src/dispatch.mjs` for the walk
of a value's tags and the run of a primitive, `core/src/types.mjs` for the
values, and `core/lib/qlang.qlang`, the topic of the language, with one
source of a noun such as `core/lib/qlang/number.qlang` for the form of the
catalog.

Tier 2, by topic, only the files the topic names:

- the reach of a name: `core/src/nouns.mjs`, `core/lib/qlang/any.qlang`
- names, scope, the root, notebooks: `docs/spec/QSNAM-names-and-scope.md`,
  `core/src/state.mjs`, `core/src/scope-keys.mjs`,
  `core/src/runtime/root.mjs`, `core/src/runtime/env.mjs`,
  `core/src/notebook.mjs`
- errors: `core/src/errors.mjs`, `core/src/error-convert.mjs`,
  `core/src/eval-trace.mjs`
- self-description: `core/src/runtime/axis.mjs`,
  `core/src/runtime/manifest.mjs`, `core/src/runtime/doc-primitives.mjs`,
  `core/lib/qlang/doc.qlang`, `core/lib/qlang/builtin.qlang`
- code as data: `core/src/steps.mjs`, `core/src/runtime/code.mjs`,
  `core/src/walk.mjs`
- printing and codecs: `core/src/print-value.mjs`,
  `core/src/runtime/print.mjs`, `core/src/runtime/json.mjs`
- the host boundary: `core/src/runtime/bootstrap.mjs`, `core/host/`,
  `cli/src/main.mjs`, `cli/src/stdin.mjs`, `cli/src/render.mjs`,
  `cli/src/cli-sources.mjs`, `cli/src/streams.mjs`
- a section and what holds it: `node scripts/dossier.mjs <section>`, its
  text, its cases, its tests and the code they reach [QSREQ#marks]
- the work: the chapter of its topic, below

Never wholesale: `core/test/`, `docs/journal/replaced/`,
`docs/journal/research/`, the memory directory. Open a record out of force
where a record in force cites it.

## Where the rules live

What holds is stated by topic in `docs/spec/`, a chapter per topic cited by
section, `[QSNAM#scope]`, listed in `docs/spec/README.md`. The chapters of
the work:

- [QSWRK] the work: the session and the stint, the journal of records, the
  closeout and the reconciliation;
- [QSVOX] the texts and their voices: where each text lives, their order,
  the two voices and the pentimento, the seed, and how a chapter is
  written;
- [QSLEX] the words and the names: a term of one sense, the grep, the names
  and the comments of the code;
- [QSREQ] the requirements and what holds them: the cases, the targets, the
  probes and the anchors, the marks, and the rigor a change of the code is
  held to;
- [QSMSR] the measures: the benchmark and the diff;
- [QSRVW] the reviews and the research: a review, the reports, the clean
  readers and the audits;
- [QSGAT] the repository and its gate: the workspaces, the imports of the
  core, the hosts, the gate and the release.

Only the maintainer's quoted words bind a session; a record the model
decided is a reading weighed on its merits [QSWRK#journal]. Before a
construct is proposed, the maintainer's words about it are searched, `node
scripts/sensors/maintainer-messages.mjs`.

## In the dialogue

A session's answer is findings with `file:line` and a probe, and the
questions the tree cannot answer; no retelling, no tables unless asked, no
next-step pitches. Verify before asserting: any claim about behaviour is run
with `qlang '…'` in script mode or in `qlang -i`; in Git Bash a query that
begins with `/` arrives as a path, which the command line reads back
[QSCLI#shell]. A long tool output is persisted with a short preview; filter
it instead of reading it back whole. Commit on request, push only on an
explicit invitation, never amend [QSWRK#stint].

## Commands

- `npm test`: every workspace's suite, the inner loop [QSREQ#rigor].
- `npm run ci`: the gate for anything meant to be pushed, judged by its real
  exit code, captured to a file, never through a pipe; while it runs, run
  nothing that boots the language [QSGAT#gate].
- `npm run desk`: the screen of the work [QSWRK#reconciliation].
- `npm run check:conventions`, `npm run check:probes`, `npm run
  check:fuzz`: the checks the gate runs, the head of
  `scripts/check-conventions.mjs` listing what it holds.
- `node scripts/benchmark.mjs`: the benchmark, its usage its head
  [QSMSR#benchmark].
- `node scripts/dissolve-records.mjs Dnn`: a record in transit dissolves
  into its sections at the closeout [QSWRK#closeout].
- `node scripts/outside-audit.mjs`, `node scripts/spec-check.mjs` and `node
  scripts/pentimento-audit.mjs`: the research a record calls for, each
  usage its head [QSRVW#audits].
- `npm run build`: the parser from `core/src/grammar.peggy`.
- `npm test -w @kaluchi/qlang-cli`: one workspace.
- `node scripts/release.mjs <version>`: a release, at the maintainer's word
  [QSGAT#release].

## Workspaces

The folder name is the suffix of the package name, the npm packages under
the `@kaluchi/` scope: `core/` the language core, pure JavaScript with no
dependency at runtime and no `node:*` import under `core/src/`; `cli/` the
Node command line and REPL; `lsp/` the language server; `site/` the Astro
site, private; `vscode/` the editor extension, unpublished
[QSGAT#workspaces].

## Sister project

`D:\git\eclipse-jdt-search` consumes qlang and breaks first when the public
surface changes. Its work is a record in force, [D38].

[D38]: docs/journal/D38.md
