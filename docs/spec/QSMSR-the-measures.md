# QSMSR · The measures

How the work is measured: the first attempt of a fresh model on the tasks of
the benchmark, the measure of the mission, and the sign of the diff of a
stint read against what it delivered.

## benchmark

The mission's measure is the first attempt of a fresh model, which the
benchmark takes by its sets, `scripts/benchmark.mjs`. A child of the
benchmark is a clean model with no settings, memory or server, at one effort
no run changes; it runs the playground on the tasks of a set, handed one
first screen, the pages of the language and of the playground as
`[::qlang ::host] | map ~(get [~(it) ~(doc)])` prints them. A set is written
by a clean author who never sees the language: the data, the tasks and a
script that computes the answers. A set measures once: reading what its
children missed marks it seen, a set seen runs no more, and the next
measurement orders a new set. A sentence of the first page stays by what it
carries to a clean reader on tasks its author never saw.

A measurement belongs to a record in force, which says what it measures and
why, held by the runs and the screen named after it: it stays in force while
the tree holds one of them, and once the closeout gives the last of them to
the history with their series it leaves, replaced by the measurement after
it [QSWRK#closeout]. The numbers measured grow, and a second measurement
under a number states its reason. A run fixes its circumstances when it
runs: the screen the tree printed, the commit of a tree with no change
outside it, the model, the environment its child was started with, the date,
the set, every call of the playground and what the language answered, and
its score, each final query run by that tree against the author's answer. A
verdict sets the runs of a measurement beside the measurement before it, as
they fixed them.

Each task keeps a reference, the shortest query the tree answers it with,
`scripts/benchmark/tasks.mjs`. The references run in the gate as
`check:benchmark` and no child reads them: a reference proves its task
solvable and names the price the language asks, so a reference that shrinks
is a repair. The series of the benchmark are its sets with their runs and
its screens; a stint keeps every one it makes, and the closeout gives each
series past its two latest to the history.

## diff

The sign of a diff by area, the core sources, the catalog, the documents,
the tests and the tooling, is computed from the history, `node
scripts/measure.mjs --steps <from> <to>`, and read over a piece of work
against what it delivered: less code at the same behaviour is a refactoring,
less code with a feature the work to praise, about as much code with a
feature good work, and more code with features asks what they are worth to
qlang. Measured from the baseline, the core sources, the documents and the
tests are held to a diff that deletes more than it adds; the catalog grows
by the verbs a task asks for and the pages that tell them. The documents are
the texts that state what holds; the journal, which carries the change,
grows by every decision, its history above all, and stands outside the
count, apart from the documents of the steps and beneath the total of the
summary, held instead to the records it keeps in force, open or in transit,
which the desk shows. A commit message, a page and a record carry no count
the history answers.

```sh
$ node scripts/measure.mjs --steps 6ebe3da0 b9008a4d | tail -1
b9008a4d (17): +1704 −1968 | +279 −135 | +237 −78 | +1893 −1327 | +541 −831
```
