# QSRVW · The reviews and the research

The readings of the work: a review of a diff, and the research clean
readers write, critiques, checks, audits and studies, each kept with the
session's reading beside it.

## review

A review holds a diff against the principles of the aim,
`docs/journal/AIM.md`, and the rules of the work: it reads whole every file
the diff touches, and its report gives a verdict, accepted or changes asked,
and its findings, each with its file and its line and the principle or the
rule it breaks. The report is kept as its writer wrote it, each finding with
the fate it met.

## research

A report of the research is named after the record that called for it and
numbered in the order the reports of that record ran, as the runs of the
benchmark are named after the record they measure: a review of the work a
record did, `docs/journal/research/reviews/D324~4.md`; a critique of an open
record, `docs/journal/research/design-check/D329~2.md`; a study of the prior
art of a question a record holds, by a reader the session starts who
searches the work outside the tree, each finding with its source,
`docs/journal/research/prior-art/D404~1.md`; an outside audit,
`docs/journal/research/outside-audit/D327~1.md`; and a check of the chapters
and a pentimento audit, whose readers write into the folder of the run,
`docs/journal/research/spec-check/D323~1/` and
`docs/journal/research/pentimento-audit/<Dnn>~<k>/`.

Every report opens with its head: what it is and the record that called for
it, the tree it read and the baseline that tree stood on, when it ran and
how, a path it names read as `git show <tree>:<path>`. The record holds each
run under `Runs.`, a line the script writes as it writes the report, why it
ran given by `--why`, or the session for a study it started. Beside each
report stands the session's reading, `D329~2~reading.md`, or the
`reading.md` of a run, every finding with its probe and its fate: a record
in transit, a target, an open record, a record that holds it already, or
none with the probe that sets it aside. `check:conventions` refuses a report
without its reading.

No run trims the reports a stint made, and the closeout cleans them
[QSWRK#closeout]: a report stays while its record is in force or a text in
force, a record in force or a seed, cites its folder and the name it shares
with its reading, `design-check/D329~2`, and any other document of the
research while such a text cites its path from the root of the journal, so a
citation of one document holds no other. The README of the research,
`docs/journal/research/README.md`, tells its folders, what calls each
report into being, how each is named and how long it stays.

## readers

A reader of the research is clean: a model started from an empty directory
of its own with no instruction file, memory or server, the tree's `qlang`
first on its path and the tools that read, which reads the tree and runs the
language with the history out of its reach. Every script of the research
starts its readers alike, `scripts/research-runs.mjs`, at the effort `max`
or the one its run names, which the effort of the session that starts it
does not reach. The readers of a run start at once; the head of a report
names the commands its reader ran by and its effort, and the reading of the
run reads its claims against them.

A run reads the tree at HEAD of the checkout it runs in, every change of
which a commit holds, best on master after a branch landed, and from a
worktree of that commit outside the repository, with its own install and
build, where another session works in the checkout. It refuses a call that
names no record in force, a tree with a change no commit holds and a second
run for one record on one tree, and a run whose checkout moved under its
readers writes no report and no line under `Runs.`.

A clean reader probes the bounds of each rule as it stands, its doubt a
question of the tree, and writes no sentence for a chapter from the tree's
answer, the side that yields being the question of the reading. A check goes
deeper each time, and one whose findings are precision alone is the one to
stop at.

## audits

A critique gives each open record named a clean critic of its own, `node
scripts/spec-check.mjs --records Dnn …`, who reads the record and the
records it cites and holds each of its roads against the chapters, the
cases, the catalog and the implementation, with findings of five kinds, a
counterexample, a cost, a conflict, a road and a hole, each with its probe.
A record that is not open is refused.

The check of the chapters holds the consistency of what the specification
says, its chapters among themselves and each with its cases, with the pages
of the catalog and with the implementation, `node scripts/spec-check.mjs
--for Dnn`, the chapters of the work a group of their own. A finding is of
one of seven kinds: a text that misstates a rule the written texts mean, or
leaves unstated a rule the cases and the pages hold; an implementation that
misses a rule a chapter and its cases state alike; a design, rules each
stated as it is meant that together answer as the language should not; a
conflict of two texts over one thing; a case that shows no rule of its
section, or a rule no case holds; and a pentimento and a drift
[QSVOX#pentimento]. A finding carries its probe, which `node
scripts/sensors/run-probes.mjs` runs again on its report.

The outside audit, `node scripts/outside-audit.mjs --for Dnn`, has one clean
reader read the tree at HEAD and run `qlang`, the history out of its reach.

The pentimento audit reads the whole tree, where a review reads a diff, a
critique a record and a check a group of chapters: its readers read the
texts that state what holds beyond the chapters for the earlier layer that
shows through them, `node scripts/pentimento-audit.mjs --for Dnn`. A finding
is of one of six kinds: a vestige, a name, a fact, a refusal, a path, a
module or a mechanism that a tree built for the mission from a clean sheet
would not hold, or would hold simpler or fewer; an archaism, a term of a
model the language left, read against the pages of the catalog; a shim,
newer code that reaches older code through a conversion, a wrapper, a second
table, a special case, a flag or an export kept for an older form; a
subordination, a part that depends on what should depend on it; and a
pentimento and a drift, the drift read both ways [QSVOX#pentimento]. Each
gives the layer it keeps, what a tree built for the mission from a clean
sheet would hold in its place, and a probe. The session's reading reads the
layer a finding keeps by `git log -S`, searches the maintainer's words on
its axis before a removal is weighed, and weighs the terms of a drift or an
archaism by their measures [QSLEX#term]. A repair that moves no rule is
taken in hand. A finding that moves a rule enters a record of its own, or an
open record that asks its very question; a repaired kind a regex finds is
held by `check:conventions`.
