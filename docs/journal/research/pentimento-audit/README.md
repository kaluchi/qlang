# The pentimento audit

The runs of the pentimento audit [QSWRK#review]: clean readers, started at
once by `node scripts/pentimento-audit.mjs --for Dnn`, read the texts that
state what holds beyond the chapters, each a group of the tree, for the
earlier layer that shows through them, and answer
`scripts/pentimento-audit-prompt.txt` with findings of six kinds: a
vestige, an archaism, a shim, a subordination, a pentimento and a drift
[QSWRK#review]. `--dry` prints the groups and the cycles of the imports
of `core/src` and starts no reader.

A run is a folder named after the record that called for it and carries
its fates, numbered in the order its runs ran, `Dnn~1/`: a report for
each group, named after the units it holds, each beneath its head, and the
session's reading, `reading.md`, every finding with its probe, run again by
`node scripts/sensors/run-probes.mjs`, and its fate. The record holds the
run under `Runs.`; the run stays while that record is in force and leaves
with it at the move of the baseline [QSWRK#baseline].

[QSWRK#baseline]: ../../../spec/QSWRK-the-work.md#baseline
[QSWRK#documents]: ../../../spec/QSWRK-the-work.md#documents
[QSWRK#review]: ../../../spec/QSWRK-the-work.md#review
