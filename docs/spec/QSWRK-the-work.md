# QSWRK · The work

How the work on the language moves: the texts it keeps and where each
lives, how a change is decided, carried and settled, how a branch lands,
and how the tree is measured and checked. This chapter states the
process, which the order of the texts [QSAIM#texts] ranks after the
language and its tools; the checks of the tooling hold the rules for which a
section names a check, and the review and the maintainer hold the rest.

## journal

A decision is a record of its own, `docs/journal/Dnn.md`, numbered in
the order it was written, a discussion with its choice and its
circumstances. A citation of a record is a link of markdown to its
file, `[Dnn]`, so an editor or a browser opens it at a click and the
chain of reasons is a graph of files.

A record is written in fields, each opening a line: `Domain.`, the part
of the work it governs, `Language.` a change of the language whose
requirements are cases, `Process.` a rule of the work, and any other
domain one its own tests hold; `Decided by.`, `The maintainer` or
`The model`, the maintainer whose words it quotes or the model which
says what it answered, and where a choice of the maintainer meets the
mechanics the model worked out around it, the line names the parts that
are the model's; `Decision.`, what holds; `Source.`, where it came from,
the maintainer's words quoted in «…» as they were written, in their
language, with the time in UTC and the prefix of the session, and words
of the tree quoted in “…” beside their anchor; `Set aside.`, the
alternatives and why; `Requirements.`, the cases it leaves.
`check:conventions` refuses a record from `D155` on that names its
decider otherwise,
and `node scripts/sensors/check-quotes.mjs`, run on the maintainer's
machine, holds every quote of the maintainer against the transcripts.

A statement of the work carries its handle: a fact of the tree a probe
or an anchor, a file and a symbol; a decision its record, or the section
it dissolved into; an inference the model's reading, marked as such where
it carries weight; and a question an open record. A sentence that others
rest on and no source holds is verified or turned into a question, and
one with neither a source nor dependents is let go. Doubt is resolved by
a record with its source, and by no item of a process, list of statuses
or comment in code. The maintainer's words are quoted as written, and a
rule is written as a rule, its date and its source in the line of its
source. A source outside the tree is read whole before a sentence rests
on it. A claim about the language in doubt is run; an intention in doubt
is asked of the maintainer, and the answer recorded with his words. A
rule is said of what it governs.

The insights the work meets about itself are collected as it goes into a
numbered record of the shift, each a rule a later session holds, written
when the work that showed it lands; at the move of the baseline each
dissolves into the section of this chapter it governs. A record written
before its code is read again after the last commit of its branch. A
record goes stale in its tenses before its rules: its source is history,
written in the past, and its requirements name its cases, not a file of
them. The prune of a decision ends with a walk of every record in force
against the tree, not with a search of its own words, and a walk of the
records finds scars of the tree as well as of the text: where a record
names a rule the tree misses, the tree is repaired and the record stays.
A merge of records probes every sentence it carries over, and a merged
record keeps the lines of the parts it took from older ones, the fate of
each older one naming it.

Only the maintainer's quoted words bind a session. A record the model
decided is a reading the session weighs on its merits and replaces by
a record of its own when a better one turns up; a question goes to the
maintainer where his quoted words are at stake or the merits leave the
choice open, laid out with the alternatives and their cost. Before a
construct is proposed, the maintainer's words about it are searched,
`node scripts/sensors/maintainer-messages.mjs`, since the project may
have had it and left it, and a capability of the language, a form of
the grammar, the shape of a value or a word is removed on the
maintainer's words about that very axis.

A question the tree and the records do not answer is an open record:
its first line names the question, and it holds `Domain.`, `Question.`,
the question with the reading of the tree and its probes, `Source.` and
`Alternatives.`, each with its cost. Once it is decided it is written
again in place, its `Question.` and `Alternatives.` giving way to
`Decided by.` and `Decision.`, the alternatives not taken becoming what
it set aside. `node scripts/requirements.mjs` shows where every record
stands: the records being decided, the open ones and those of the
language no case names, and those carried out, replaced, held by the
tests of their domain and the rules of the work.

A record changes the rules of the specification while it is in transit:
a line that opens with `Overrides` names the sections it overrides,
`Overrides [QSPTH#has], [QSBLD#value]`, its later lines opening with
`[QS`, and within them it rules over the specification and the code, a
case, a test or a line of code its work touches citing the record in
place of the section. A record in force is true as a whole and speaks
the words of the tree; a newer record that takes a part of an older one
writes that part out of it in the same commit, found by a search of the
records' words, the older gaining `Pruned of what [the newer] took.` and
the newer `Replaces in part [the older]`, and the words a record quotes
in its source stay as they were. Records of one axis merge into the
earliest of them, `node scripts/merge-records.mjs <earliest> <later>…`,
whose number stays the address of the axis, described anew against the
tree; each later one gains the line `Merged into` the earliest. A record
out of force moves once to `docs/journal/replaced/`, under the line of
its fate, `Dissolved into`, `Merged into`, `Replaced by` or `Filed
under the principles by`, and under its
title the line `Left at` the commit whose tree its text was last true
of, every path it names reading as `git show <commit>:<path>`;
`node scripts/replaced-records.mjs` moves it and rewrites the links to
it. A record keeps its number for good. `check:conventions` holds the
fates: each names a record that exists, a part taken is named back, the
lines `Replaced in part by` are no more than the baseline held, a record
replaced whole stands under `replaced/` and one in force in the root,
and every markdown link of a document leads to a file the tree holds.

## spec

The specification, `docs/spec/`, states what holds at the baseline, by
topic, a chapter for each, its code a word of five letters,
`QSNAM-names-and-scope.md`, its sections the headings `## scope`, cited
by the code and the heading, `[QSNAM#scope]`. A chapter states the rule
of each section in the present, as what holds, the form a reader
writes and the refusal that teaches it; it shows its rules by probes;
and `docs/spec/README.md` lists the chapters in the order the concepts
rest on each other, the aim first. The code, the tests and the cases cite
the section whose rule they hold, and a sentence of a chapter the tree
proves wrong is replaced by the fact and its probe. `check:conventions` refuses a citation of a
section its chapter lacks, and in a chapter a citation of a record, the
history of a form and a sentence that says what the text leaves out,
and in a chapter of the language a word or a path of the journal.

## cases

The conformance suite is the requirements of the language, held outside
it. A case is a line of `core/test/conformance/<chapter>/<section>.jsonl`,
`{"name":…,"query":…,"expect":…}`: a query the runner reads as text and
the literal it must answer, a value or a raised error,
`!{…} | raise`, so a case holds a form the language does not read yet
and stands through a change that breaks the language's own sources. Its
name says the rule it shows in the words of the language, and the file
it stands in is the section whose rule it shows. A case a record in
transit claims opens with the record, `{"decision":"Dnn","name":…}`,
the one record whose rule its query and its answer show. The laws of the
catalog are the claims of its pages, which the language runs on itself,
and a requirement a law proves as well stays a case. The rules a case
holds are read from the record it names, and a rule no record states is
written into the record it belongs to before a case names it there. The
runner compares values, so a case writes a set in the order its print
shows.

The runner, `core/test/unit/conformance.test.mjs`, refuses a file of a
chapter that is no section of it, a case whose first key names no record
in force, a target that names no record, and two cases that hold one
query to two answers; `check:conventions` refuses a case whose record
overrides no section of its chapter.

## target

A target is a case whose answer the tree does not give yet, marked
`"target": true`, beside the answer the tree gives today, `"now"`, an
error by its tag and any other value as its literal; it names the record
in transit that left it. The runner holds it to three verdicts: it
answers its goal, and the branch that met it drops the mark; it answers
its present, and stays a target; it answers neither, and fails until a
reader tells a repair from a case that broke, and rewrites the present
or the case. A block of a document fenced as `qlang target` states an
answer a repair must produce, and `check:probes` fails when the tree
meets it, so the block is written again as what holds.

A requirement is written on the side of design and met on the side of
implementation. A target is taken in hand where landing it changes no
met case and no record's text; otherwise a move of design with its
record comes first. A branch that works targets starts from master with
its suite green; it changes the implementation, may add cases under its
own record, and drops the mark of each target it met, its query and
answer as they were; it keeps every case, record and gate as it found
them. Master's copy of the diff, `git show master:scripts/gate-diff.mjs`
run with `--task Dnn`, compares the branch with its merge base on master
and lists every such move: a target added or a case added under another
record; a change to the specification, `scripts/`, a `package.json`,
`.github/`, `CLAUDE.md`, `.claude/`, or the comparator of the runner and
its judge; a record added, rewritten, moved or
taken away, but for a line of fate appended; the targets met outside the
task; and the lines of the implementation that spell a target they met.
The review reads them first.

## marks

An artifact names what it exists for by a citation, `[Dnn]` or
`[QSNAM#scope]`: a module of code and a script in their head or above
the block that carries it, a test file in its head, a workflow under
`.github/workflows/`, a case in its `decision` while it is in transit, a
source of the catalog in the comment above its pages, `The decisions it
exists for: [QSDSP#residence]`; the sister project names a record of
qlang with the repository, `(qlang Dnn)`; and the data of a measurement
in the name of its file, `screens/D167.txt`. A mark covers its block,
from its comment to the next comment that holds one, the first block
reaching up to the head of the file, so a search answers what governs a
file and what a record left behind: `node scripts/marks.mjs` answers the
scope of a record, `--touched` the records whose marked blocks a diff
touched and `--reread Dnn` what to read again. An artifact that names
nothing, a tracked `.mjs`, `.js`, `.peggy` or `.qlang` outside `docs/`
or a workflow, is an orphan, which `check:conventions` refuses and the
desk counts. A page of the catalog, the public interface of the
language, cites the sections and pages a reader follows, a record only
in the comment at the head of its source.

## baseline

The baseline is the last commit that landed a branch on master, a merge
on its first parent line, which the walk reads from the history; its move
is the clean desk: however a shift left the work, the next starts in
order. It moves when a branch lands, at the end of every shift that wrote
records and before an outside audit, and no more than twenty records
stand written since it.

At the move:

- Every record in transit that the maintainer and the tree accept
  dissolves into the sections it overrides: they are written anew in
  the present, and `node scripts/dissolve-records.mjs Dnn` takes the
  record off the cases it claimed, names its section in each citation of
  it where it overrides one and lists the citations for the author where
  it overrides several, writes its line `Dissolved into` and moves it
  out. It refuses a record that overrides nothing and one that claims a
  case outside the chapters. Records in transit over one section
  dissolve in the order of their numbers. A record that overrides a
  section dissolves or is set aside with its change undone; an open
  record waits.
- Every record in force is held against the new tree, critically: one
  whose form the language has left is closed, one a newer record
  contradicts is closed, and an idea no choice settled is an open
  record. A record whose marked blocks the diff from its tree touched is
  read again against the new root and described anew or closed; one the
  diff left alone stands as it is.
- A document of the research stays while a record in force or a text
  that cites, `CLAUDE.md` and the READMEs of the workspaces, names it, the
  README of its folder a ledger that holds none;
  `node scripts/drop-documents.mjs` drops the rest, each with its part of
  the ledger of its folder, the findings it left open carried into the
  ledger under its name and the commit. A review is a unit, any other
  research its folder, and the outside audits a series that stays.
- Every probe of the open records and of the chapters is run, and every
  sentence the tree proves wrong is replaced by the fact and its probe.
- The branch lands on master and is deleted, with the worktrees of its
  cuts, and the merge holds no record in transit.

`check:conventions` holds the walk: a record of the language the
baseline's tree holds that no case names and no line of fate closes,
unless it is open; a citation of a section its chapter lacks; a case of
a chapter the baseline held, added, rewritten or taken away since, that
no record in transit over its section claims, the case naming it or,
taken away, named in its text, nor a record dissolved into the section
since the baseline, which claims it until the merge that lands it, a
chapter the baseline did not hold waiting for the next move; a document of the research the baseline
holds that nothing citing names; more than twenty records since the
baseline; a record in transit in the tree of the merge that landed it;
a citation in the code and the tests of a record that no met
case holds, a case that names a record being decided, and a citation in
a document that cites of a record out of force or of the language with
no case, an open record among those it may cite. `npm run
desk` shows the walk at the start of a shift.

## branch

A branch is a shift: it takes the scars of its shift, is named after
them, states in its description what it shows when it lands, and lands
on master at the move of the baseline by a merge commit, made locally
where no pull request is open. Code is committed on a branch, and a
change to documents alone lands on master directly. A push waits for the
maintainer's invitation, a commit is never amended, and the branch is
deleted after the merge, locally and on the remote.

A new public surface comes with its tests first. Each clause added to a
condition is held by a test that fails without it, cut on a copy to
watch it fail. A change to how inputs are read is run against the
previous version over generated inputs, each divergence explained; a
change to the scope a quote runs in or to the reach of a bare name comes
with tests of shadowing by a reader's word and by a later source's; and
a quick path in a shared helper is held against every caller and every
input each hands it, an error and a value under a tag among them. The
inner loop runs the tests of the topic; a commit `npm test`; and the
full gate runs once a series, before a push, or where only it checks,
the one run that boots the language while it runs; `node
scripts/benchmark.mjs check` runs before a commit that reads a form of
the language anew.

A form a script rewrites is read against the parse the old grammar gave,
each part whose role the rewrite changes found by walking the old parse
and set by hand. A line or a branch the coverage of the gate finds no
case reaching is read first as a question of the design. A design of
scope is checked by a second model on counterexamples before its record
is written, and again when a review moves it. A fact moved from a value
onto a name is held on every road the value took, and a refusal of the
read of a name on every road the name is read by, each road a caller of
the lookup they share and held by a case; a clause copied from the code
beside it that no road reaches leaves rather than a case inventing a
road. A clause is cut in a copy its own runner alone writes, and a cut is
read by the name of the test that failed, never by a count. A script that
moves cases between files writes every file after it has computed them
all, its folders made first.

A branch starts from the full set of places where its cause shows, found
by search rather than by memory, and its first commits delete. The work
of the model on the texts is validation, the contradictions, the
conflicts, the holes and the problems of what is written, and a session
that finds none has read too little of the tree or run too few of its
probes. What confuses a session during the work, a sentence the tree
contradicts, a comment that justifies or leads away, a requirement no
case states, is settled where it is met:
fixed in the branch where the records already choose the fix, and
otherwise recorded with its probe, as a target where a record chose and
the tree misses it, as a record where it asks for a choice, and as an
open record where neither answers it. Each is weighed by the mission:
whether it makes the first attempt of a fresh session likelier and its
reading lighter.

## code

The code names each thing as the language names it: a tag is a tag,
`makeTag`, `isTag`, `TagLit`, a step a step, a modifier a modifier. A
comment states what holds, in one sentence, and cites the section or
the record it holds; the reason of a rule lives with its record. Every
branch leaves the files it touches so: it moves a reason it finds in a
comment into its record or deletes it with the compromise it excuses,
and deletes a false comment. The ratio of comment lines to code lines
over the core, the command line and the language server falls,
measured on every branch against the baseline. A printer decides a
spelling by the kind of the value, never by a pattern over the text of a
print; a fact of a call is kept by the call and never by a value it
received; and what a rule takes from code is withheld by a refusal of its
own, never left to fall to another meaning of the name.

## diff

The sign of a diff by area, the core sources, the catalog, the
documents, the tests and the tooling, is computed from the history,
`node scripts/measure.mjs --steps <from> <to>`, and read over a piece of
work
against what it delivered: less code at the same behaviour is a
refactoring, less code with a feature the work to praise, about as much
code with a feature good work, and more code with features asks what
they are worth to qlang. Measured from the baseline, the core sources,
the documents and the tests are held to a diff that deletes more than it
adds, where a growth signals a crooked part, an old scar or a concept
that does not compose; the catalog grows by the words a task asks for
and the pages that tell them. A commit message, a page and a record carry
no count the history answers.

## probe

A probe is a fenced block of a document whose lines that begin with `>`
are queries typed into `qlang` and whose other lines are what the tree
answers; one that begins with `$` is a shell command. A probe answers
the sentence it stands under, a verdict, the things the sentence names,
or a quantity to the precision the sentence states, a sign or a ratio to
a tenth, so its answer changes when the sentence stops being true and
only then. It reads what the sentence names in a way that fails when
that is gone: the runner runs a shell probe with a pipeline that fails
where any command fails, and a probe that lists files by `git ls-files`
lists them with `--error-unmatch`. `npm run check:probes` runs every probe of
the open records and the specification that reads the repository alone, and the branch that
changed an answer rewrites the sentence with its probe. A probe that
reads a machine, the sister project or the environment, one that names
`jdt`, `scripts/sensors`, `env` or a variable of the shell, keeps the
date of its answer and is run by hand.

`check:conventions` holds the anchors of `CLAUDE.md`, the chapter of the
aim and this chapter: a path they name in backticks is a file of the tree
or of the sister project, and words they quote in “…” beside a path stand
in that file.

## documents

`docs/` holds two folders. The specification, `docs/spec/`, holds the
chapters, the aim first. The journal, `docs/journal/`, holds the records
in force at its root, those out of force under `replaced/`, and the
research under `research/`, the reviews and the outside audits, each
folder with a README that is its ledger. The screen of the work,
`npm run desk`, and the sensors under `scripts/sensors/`, which read the
transcripts, the history and the files, compute what a session starts
from.

The language says the rest of itself in its catalog: what a reference or
a tutorial would retell are the laws of its pages and the concepts on
the pages of `::qlang`, and the embedding interface is the page of the
package, `core/README.md`. The instruction file of the repository,
`CLAUDE.md`, is the table of contents a session starts from: how the
project is built, how the work moves, the resources outside the tree and
pointers into it, while the model computes from the tree what the tree
holds.

The texts of the work speak in two voices. The apophatic ones carry the
change against the baseline: first the dialogue of a session, which a
pain of the tree calls and where every doubt, choice and reason of the
model is said, its transcript the whole record of it and the summary of
a compaction the model's paraphrase of it; then the journal, the records
with their circumstances and what they set aside, the research, the
reviews and the outside audits; the memory between sessions; and the
history of the commits. The cataphatic ones state what holds, in the
present: the chapters of the specification, the pages of the catalog,
the cases and the comments of the code, each the rule, the form a reader
writes and the refusal that teaches it, a negation that is the condition
of a rule among them. A session lands on the apophatic texts, the
dialogue, the screen of the work and the records in transit and open,
where its work is, and reads the cataphatic ones by topic at the point
of need. What it writes into a cataphatic text states what holds; a
doubt or a reason it meets is said in the dialogue, or written as a
record where it asks for a choice.

The apophatic texts are where the work lives. While a branch works, they
reach into the cataphatic ones, a record in transit ruling over the
sections it overrides, the cases it claims, the code that cites it and
the targets it left; at the merge into master the tension relaxes: every
record in transit dissolves into its sections or is set aside with its
change undone, and master holds no record in transit, its open records
waiting in the journal.

## catalog

A word enters the catalog when it expresses what was inexpressible over
the values the language has, or shortens what every host would
otherwise write; a domain's words belong to its host. Every host counts
a host with no shell around its queries, the site's playground among
them, so the core carries the working set a shell would supply: the JSON
codec both ways, text as lines, `split` and `join`, trimming, replacing,
case and search; a host keeps its domain, its input and output and its
renderings. One sequence serves them all, the vector, a string reading
in pieces by `split`, `lines`, `count`, `take` and `drop`.

A declaration in a source of the catalog writes its name on a line of
its own, each doc of its slot on the lines after it indented by two, a
doc of one line on one line and a doc of several lines closing on a line
of its own, and its value on the line after them; a keyword value stays
on the line of its doc.

## measure

The mission's measure is the first attempt of a fresh model. A child of
the benchmark, `claude -p` from a directory of its own with no settings,
memory or server, runs the command line on the tasks of a set, handed
the pages of the language and of the command line as the language prints
them, `[::qlang ::cli] | map ~(get [~(it) ~(doc)])`. A set is written by
a clean author who never sees the language: the inputs, the tasks and a
script that computes the answers. A set measures once: reading what its
children missed, `misses` or `frictions`, marks it seen, and the next
measurement orders a new set. A sentence of the first page stays by
what it carries to a clean reader on tasks its author never saw.

A measurement belongs to a record in force, which says what it measures
and why, and carries its number, `run --decision Dnn`, its runs named
`D<n>~cli~<model>~<k>`, a screen measured again under its number
carrying its hash in the name; the numbers measured grow, `run` refusing a
number below the last one measured, and a second measurement under a
number states its reason. A run fixes its circumstances when it runs:
the screen the tree printed, saved under the number with its hash, the
commit of a tree with no change outside it, the model, the date, the
set, every call of the command line and what the language answered, and
its score, each final query run by that tree against the author's
answer; `verdict` reads the scores the runs of a set fixed. The
references of `scripts/benchmark/tasks.mjs`, the shortest query the tree
answers each task with, run in the gate as `check:benchmark`, the
default of `scripts/benchmark.mjs`, which holds as well `prompt`,
`screen`, `report`, `author`, `run`, `grade`, `verdict`, `misses` and
`frictions`; the sets live under `scripts/benchmark/sets/` with their
runs.

## review

A review holds a diff against the principles of the aim [QSAIM#principles]
and the rules of the work: it reads whole every file the diff touches, and
its report gives a verdict, accepted or changes asked, and its findings,
each with its file and its line and the principle or the rule it breaks.
The report is kept as its writer wrote it, each finding with the fate it
met, under `docs/journal/research/reviews/` while something in force
cites it. A clean reader of the specification knows no earlier form, so
it probes the bounds of each rule as it stands and its doubt comes out
as a question of the tree, while a reader of the records is handed the
words the language left, so that its probes look for them. Rounds of
clean readers go deeper each time, the first finding sentences the tree
contradicts and the next sentences wider or narrower than the tree and
refusals left unnamed, and a round whose findings are precision alone is
the one to stop at.

`node scripts/outside-audit.mjs` runs the outside audit: a clean Opus,
started from an empty directory of its own with no instruction file,
memory or server, reads the tree at HEAD, runs `qlang` and answers
`docs/journal/research/outside-audit/prompt.txt`, and its report lands as
`docs/journal/research/outside-audit/<date>-<tree>.md`; it runs on a tree every
change of which a commit holds, once for a tree and a day. The session
writes its reading beside the report and the fate of each finding in the
README there. `scripts/gemini-review.mjs`, `scripts/gemini-show.mjs` and
`scripts/gemini-resolve.mjs` drive Gemini Code Assist on a pull request,
a signal the maintainer calls for: a finding that names a real defect is applied,
and a fallback or a defensive check it proposes is refused with a
sentence in the commit.

## tooling

The language and its tooling are npm workspaces of one repository, each
folder the suffix of its package: `core` the language and `cli` the
command line and its REPL, published under the `@kaluchi/` scope, `lsp`
the language server, `site` the site, private, and `vscode` the editor's
extension, `qlang-vscode`; `npm install` at the root links them. The
core is pure JavaScript with no dependency at runtime and no `node:*`
import under `core/src/`, since it ships to a browser, to Deno and to
Bun; its catalog under `core/lib/qlang/` is read at runtime as
`#qlang/<name>` through the `imports` of its `package.json`, the loader
of each platform chosen by the condition of `#qlang/load-source`; the
parser is built from `core/src/grammar.peggy` by `npm run build`; and a
workspace depends on a sibling by the range `^x.y.z` of the sibling's
version. The core exports its root, `core/src/index.mjs`, beside
`./session`, `./errors` and `./highlight` and the sources of its
catalog.

The hosts beside the core: `cli/src/bin.mjs` is the one file of the
command line that touches `process`, handing the arguments, the streams
and the environment to `main.mjs` and exiting with the code `main`
resolves, so every branch worth covering lives where a test reaches it;
the REPL paints what it prints by `cli/src/highlight-ansi.mjs`, a layer
of colour over the core's `tokenize`. The language server runs over
stdio and answers `initialize` with its capabilities; the editor's
extension, `vscode/src/extension.js`, unpublished, launches the server
of the checkout. The site is built by
Astro, `site/astro.config.mjs`, its examples split into prompts, answers
and comments by `site/src/lib/format-example.js` and painted by
`site/src/lib/qlang-highlight.js` from what the core's parser reads.

`npm run ci` is the gate of what is pushed, judged by its exit code: the
build, eslint, `check:conventions`, `check:probes`, `check:fuzz`,
`check:benchmark`, every suite, the thresholds of coverage, the
integration of the command line and the build of the site, in that
order, the one run that boots the language while it runs; the checks of
GitHub, `.github/workflows/ci.yml`, run its steps but `check:fuzz` and
`check:benchmark` on every push to master and every pull request. The
thresholds of coverage, pinned in the `vitest.config.mjs` of `core` and
`cli`, hold the sources under the `src/` of both at a hundred on every
axis, the browser's loader and `cli/src/bin.mjs` aside. `scripts/fuzz-laws.mjs`
runs every law of the root again with its literals changed to edge
values, failing on a host's failure, a throw past the fail track, or a
print that reads back as another value. `check:conventions` holds,
beside the walk, the fates and the anchors, the words that tell when a
text changed, legacy, deprecated, currently, previously and backward
compatibility, and the markers TODO, FIXME and HACK, in the sources
outside `docs/`, `vscode/` and the instructions; a count in markdown
prose that a command answers; the ranges of the siblings; and every
refusal declared by its address.

`node scripts/release.mjs <version>` runs a release end to end from a
clean master in step with its remote whose checks on GitHub are green:
a preflight, the bump, the ranges, the parser, the coverage of the core
and the tests, the commit, the push, the wait for the checks, the tag
and its push; the tag runs `.github/workflows/deploy.yml`, which
publishes the core and the command line through the trusted publishing
of npm, so the name of that file bears weight; the commit of a release
lands on master directly. A release happens at the maintainer's word,
and between releases the sister project consumes the copy of the
workspace.
