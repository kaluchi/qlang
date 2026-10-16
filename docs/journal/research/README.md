# The research

What the work learns from outside readers, kept while something in force
needs it [QSWRK#documents]. Every report stands as its writer wrote it
beneath its head, what it is and the record that called for it, the tree
it read and the baseline that tree stood on, when it ran and how, and the
record holds the run under `Runs.`; beside the report stands the session's reading: every finding with its probe and its
fate, where the finding went, a record, a case, a change of the tree, or
nowhere with its reason [QSWRK#review]. `check:conventions` refuses a
report without its reading.

A folder for each kind of report, told by what calls a report into being:

- `design-check/`: a critique of an open record by a clean reader, which
  the record calls for, `node scripts/spec-check.mjs --records Dnn`. Named
  after the record and numbered in the order its critiques ran,
  `D329~2.md`, its reading `D329~2~reading.md`.
- `reviews/`: a review of the work a record did, by a clean reader, named
  so, `D324~3.md` with `D324~3~reading.md`; and a review of a branch
  against the aim and the rules of the work, which the branch calls for,
  `<date>-<branch>.md`, the fate of each finding below it.
- `spec-check/`: a check of the chapters by clean readers, which a record
  calls for and carries the fates of, `node scripts/spec-check.mjs --for
  Dnn`: a folder for each run named after the record, `D323~1/`, a report
  for each group of chapters and the reading `reading.md`.
- `outside-audit/`: an outside audit of the tree by a clean reader with no
  instructions, which the landing of a branch calls for,
  `node scripts/outside-audit.mjs`, `<date>-<tree>.md` with
  `<date>-<tree>-reading.md`.

A report named after a record stays while that record is in force or a
text in force cites it, and leaves with the record at the move of the
baseline; a report no record called for, a review of a branch or an
outside audit, stays while a text in force cites it, the records that
took its findings among them. `node scripts/drop-documents.mjs` drops the
rest at the move and prints the fates that say open, each to be carried
into an open record of its axis [QSWRK#baseline]. A report that left is
read in the history, at the commit the record that held it left at,
`git show <commit>:<path>`, and its probes run again on the tree its first
line names.

[QSWRK#baseline]: ../../spec/QSWRK-the-work.md#baseline
[QSWRK#documents]: ../../spec/QSWRK-the-work.md#documents
[QSWRK#review]: ../../spec/QSWRK-the-work.md#review
