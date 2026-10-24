# QSREQ · The requirements and what holds them

How the tree holds the rules the chapters state: the cases of the language,
the targets a repair aims at, the probes under a sentence and the anchors of
a text, the marks that tie an artifact to its rule, and the rigor a change of
the code is held to.

## cases

The conformance suite is the requirements of the language, held outside it.
A case is a line of `core/test/conformance/<chapter>/<section>.jsonl`,
`{"name":…,"query":…,"expect":…}`: a query the runner reads as text and the
print of the answer it must give, a value under `expect` and a failure the
query raises as the print of its error at rest under `raises` instead.
Every
file of the suite is a section of a chapter, the section whose rule its
cases show, and the name of a case says that rule in the words of the
language. A case names a record only while that record's change is in
transit over its section: the record opens the case,
`{"decision":"Dnn","name":…}`, the one record whose rule its query and its
answer show, and `node scripts/dissolve-records.mjs` takes it off every case
that names it when it dissolves [QSWRK#closeout]. The laws of the catalog
are the claims of its pages, which the language runs on itself, and a
requirement a law proves as well stays a case. The rule a case shows is
stated by its section, or by the record it names, and a rule neither states
is written into a record in transit over the section before a case shows
it.

The runner holds an answer by its print, the text `print` answers of it,
against the expectation as it is written, the layout of its lines aside,
and by the tie of the one order, the equality of the language, where a
print drops a part of its value, two values printing alike, as the probes
judge a print [QSREQ#probe]. A case holds what its query computes and no
text a host writes around an answer, the line of a raise, the page of a
refusal or the budget of an answer, and a case that expects a refusal under
`raises` tells it from the error at rest a catch answers under `expect`. A
case writes its answer as the print shows it, a set in its order, an error
at rest as `!{…}`, the facts of a refusal in the order it holds them and a
number as the printer writes it, and its expectation computes nothing, so a
literal written with a tag twice, which builds the value of one, is the
print of no answer. The fuzz of the laws and the benchmark over a task that
reads no data judge by the tie, and the benchmark judges the answer of a
task over data as JSON. The tie is the order the runner leans on where a
print drops a part, so the unit tests of the order hold its sign over a
ladder of values of every kind, which no tie judges.

The runner, `core/test/unit/QSREQ/cases.test.mjs`, refuses a file that is no
section of a chapter, a case that names a record and does not open with one
record in force, a target that names no record, two cases that hold one
query to two answers, a case that writes its answer under both `expect` and
`raises` or under neither, and a case whose name holds fewer than four
words, the words its hyphens part; `check:conventions` refuses a case whose record
overrides neither its section nor its chapter whole.

## target

A target is a case whose answer the tree does not give yet, marked
`"target": true`, beside the answer the tree gives today, `"now"`, an error
by its tag and any other value as its literal; it names the record in
transit that left it. The runner holds it to three verdicts: it answers its
goal, and fails until the stint that met it drops the mark; it answers its
present, and stays a target; it answers neither, and fails until a reader
tells a repair from a case that broke, and rewrites the present or the case.
A block of a document fenced as `qlang target` states an answer a repair
must produce, a block that writes none the answer of no failure, and
`check:probes` fails when the tree meets it, so the block is written again
as what holds.

A requirement is written on the side of design and met on the side of
implementation. A target is taken in hand where landing it changes no met
case and no record's text; otherwise a move of design with its record comes
first. A target lives in the stint that wrote it: the stint meets it, or
before it lands writes the record that left it again as an open one whose
question the target states, so no target outlives the closeout that lands
its branch. A branch that works targets, a worktree of a subagent among
them, starts from the head of the branch that wrote them, its suite green;
it changes the implementation, may add cases under its own record, and drops
the mark of each target it met, its query and answer as they were; it keeps
every case, record and gate as it found them. Master's copy of the diff,
`git show master:scripts/gate-diff.mjs` run with `--task Dnn`, compares the
branch with its merge base on master and lists every move it made on the
requirements and the gates, which the review reads first.

## probe

A probe is a fenced block of a document whose lines that begin with `>` are
queries typed into `qlang`, each read as the command line reads a query with
nothing piped, over its sources and from `::qlang`, and whose other lines
are what the tree answers; one that begins with `$` is a shell command. A
probe answers the sentence it stands under, a verdict, the things the
sentence names, or a quantity to the precision the sentence states, a sign
or a ratio to a tenth, so its answer changes when the sentence stops being
true and only then. It reads what the sentence names in a way that fails
when that is gone, and a shell probe answers alike wherever the probes are
run, `scripts/sensors/run-probes.mjs`.

`npm run check:probes` runs every probe of the open records, the records in
transit and the specification that reads the repository alone. A probe of a
section a record in transit overrides is the record's while it is in
transit: an answer the record's work changed waits for the closeout, which
writes it into the section, where the record holds a probe of the same query
with the new answer, and a probe of a chapter the record overrides whole
waits for the closeout that writes the chapter anew, the run listing it as
waiting, `scripts/probes-in-transit.mjs`; any other answer that changed
fails the run. A
shell probe that reads a machine, the sister project or the environment
keeps the date of its answer and is run by hand.

An anchor holds a sentence to a file as a probe holds it to a run: a path
the seed, the aim or a chapter names in backquotes is a file of the tree or
of the sister project, and words they quote in “…” beside a path stand in
that file. `check:conventions` holds the anchors, `scripts/anchors.mjs`, a section a record in transit overrides waiting for its
closeout [QSVOX#chapter].

## marks

An artifact names the rules it holds by a citation in a comment, a section
at the baseline, `[QSNAM#scope]`, and a record while its change is in
transit, `[Dnn]`: a module of code, a script and a workflow under
`.github/workflows/` in the comment at their head or above the block that
holds the rule, and a source of the catalog in the comment above its pages,
`The rules it holds: [QSDSP#residence]`. A file of the conformance suite
marks its section by its path, and a case the record in transit over that
section by its `decision` [QSREQ#cases]. A test file marks by its path the
section whose rule its tests hold, `<chapter>/<section>.test.mjs` under the
tests of its workspace, `core/test/unit/`, `cli/test/`,
`cli/test/integration/` for the tests that run the command line in a process
of its own, `lsp/test/`, `site/test/` and `vscode/test/`, or, where no
chapter states the rule, the record in force of a domain its tests hold,
`core/test/unit/D404.test.mjs`. A section holds one test file in each
folder, and a part that cannot run beside the rest, a module of Node it
mocks, a table it meets before the bootstrap seals it or a share of a run too long for one worker, runs in a file of its own,
`<section>.<part>.test.mjs`; a section a record in transit brings is one a
test file stands at [QSVOX#chapter].

A test file holds its tests at its head or in groups, `describe`, a group
holding two tests or more, a test written in a loop or a table counting as
many, in a file of two groups or more, so a group says a rule its tests
share within the section and a file of one group holds none. The title of a
test and of a group says its rule in the words of its section and cites
none, naming no binding its file imports from the code and no file of the
code but in backquotes, which hold the words of the language; no line of a
test file cites the section its path names; and a helper the tests of
several files share stands under `test/helpers/` of its workspace, a module
that marks its rule. The sister project names a record of qlang with the
repository, `(qlang Dnn)`; and a screen and a run of a set of the benchmark
name the record they measure in the name of their file, `screens/D395.txt`
and `sets/Y/runs/D395~cli~sonnet~1.json`.

A mark covers its block, from its comment to the next comment that holds
one, the first block reaching up to the head of the file, and a path its
whole file, so a search answers what governs a file and what a record left
behind: `node scripts/marks.mjs` answers the scope of a record or a
section, and `node scripts/dossier.mjs <section>` the dossier of a section,
its text, the records in transit over it, its cases, its test files, the
code its tests reach through their imports and the blocks its marks cover. A
mark is read from the comments of a file by the parser of its language
[QSREQ#rigor]: a citation written in backquotes is the example of a mark,
and one in a string of the code, a message of a script or a text a test
hands its code, names nothing, while a mark of the sister project stands
wherever its files write it.
An artifact that names nothing, a tracked `.mjs`, `.js`, `.peggy` or
`.qlang` outside `docs/` that no path marks or a workflow, is an orphan,
which `check:conventions` refuses and the desk counts; the files of a set of
the benchmark, the data its runs wrote and the generator its author wrote,
are no artifacts and carry no mark inside them. A regression is no kind of
its own: a defect met is a requirement the cases left unsaid, whose repair
brings a case under the record that repairs it, or a test where no case can
state it, at the section of its rule. A page of the catalog, the public
interface of the language, cites the sections and pages a reader follows, a
record only in the comment at the head of its source.

## rigor

A new public surface comes with its tests first. Each clause added to a
condition is held by a test that fails without it, cut on a copy to watch it
fail; a clause is cut in a copy its own runner alone writes, and a cut is
read by the name of the test that failed. A change to how a text is read is
run against the previous version over generated texts, each divergence
explained, and a form a script rewrites is read against the parse the old
grammar gave, each part whose role the rewrite changes found by reading the old parse part
by part and set by hand. A change to the scope a quote runs in or to the
reach of a bare name comes with tests of shadowing by a reader's verb and by
a later source's, and a design of scope is checked by a second model on
counterexamples before its record is written, and again when a review moves
it. A quick path in a shared helper is held against every caller and every
value each hands it, an error and a value under a tag among them. A fact
moved from a value onto a name is held on every road the value took, and a
refusal of the read of a name on every road the name is read by, each road a
caller of the lookup they share and held by a case; a clause copied from the
code beside it that no road reaches leaves. A line or a branch the coverage
of the gate finds no case reaching is read first as a question of the
design.

A printer decides a spelling by the kind of the value, never by a regex over
the text of a print, and a script reads a module of JavaScript by its
parser, acorn, never by a regex over its text, and the comments of a file by
the parser of its language through one reader, `scripts/comments.mjs`: a
module by acorn, a source of the catalog by the parser of the core, its docs
beside its comments, and the grammar by peggy, the code of its actions by
acorn, a file of a language the tree holds no parser of read by the form of
its comment line; a fact of a call is kept by the call and never by a value it
received; and what a rule takes from code is withheld by a refusal
of its own, never left to fall to another meaning of the name. A script that
moves cases between files writes every file after it has computed them all,
its folders made first.

The inner loop runs the tests of the topic; a commit runs `npm test`, and
`node scripts/benchmark.mjs check` where it reads a form of the language
anew; and the full gate runs once a series, before a push, or where only it
checks, the one run that boots the language while it runs [QSGAT#gate].
