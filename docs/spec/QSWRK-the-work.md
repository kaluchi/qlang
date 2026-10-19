# QSWRK · The work

How the work on the language moves: the texts it keeps and where each
lives, how a change is decided, carried and settled, how a branch lands,
and how the tree is measured and checked. This chapter states the
process, which the order of the texts [QSWRK#documents] ranks after the
language and its tools; the checks of the tooling hold the rules for which a
section names a check, and the review and the maintainer hold the rest.

## journal

A decision is a record of its own, `docs/journal/Dnn.md`, numbered in
the order it was written, a discussion with its choice and its
circumstances. A citation of a record is a link of markdown to its file,
`[Dnn]`.

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
alternatives and why; `Requirements.`, the cases it leaves; and
`Runs.`, the reports of the research it called for, a line each that the
script writes as it writes the report [QSWRK#review], the journal and the
worklog of the work.
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
a record with its source. The maintainer's words are quoted as written, and a
rule is written as a rule, its date and its source in the line of its
source. A source outside the tree is read whole before a sentence rests
on it. A claim about the language in doubt is run; an intention in doubt
is asked of the maintainer, and the answer recorded in the maintainer's words. A
rule is said of what it governs.

The insights the work meets about itself are collected as it goes into a
numbered record of the shift, each a rule a later session holds, written
when the work that showed it lands; at the move of the baseline each
dissolves into the section of this chapter it governs. A record written
before its code is read again after the last commit of its branch. The
source of a record is written in the past, and its requirements name its
cases, not a file of them. The prune of a decision ends with a walk of every record in force
against the tree, and a walk of the
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
`node scripts/sensors/maintainer-messages.mjs`, and a capability of the language, a form of
the grammar, the shape of a value or a verb is removed on the
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
its fate, `Dissolved into`, `Merged into`, `Replaced by`, `Filed
under the principles by` or `Filed under the tooling by`, and under its
title the line `Left at` the commit whose tree its text was last true
of, every path it names reading as `git show <commit>:<path>`;
`node scripts/replaced-records.mjs` moves it and rewrites the links to
it. A record keeps its number for good. `check:conventions` holds the
fates: each names a record that exists, a part taken is named back by
`Pruned of what` and `Replaces in part` alone, a record
replaced whole stands under `replaced/` and one in force in the root,
and every markdown link of a document leads to a file the tree holds.

## spec

The specification, `docs/spec/`, states what holds at the baseline, by
topic, a chapter for each, its code a word of five letters,
`QSNAM-names-and-scope.md`, its sections the headings `## scope`, cited
by the code and the heading, `[QSNAM#scope]`. A chapter states the rule
of each section in the present, as what holds, the form a reader
writes and the refusal that teaches it; a chapter of the language shows
its rules by probes where a run shows them, and this chapter by the checks
a section names where a check holds its rule;
and `docs/spec/README.md` lists the chapters in the order the concepts
rest on each other. The code, the tests and the cases cite the section
whose rule they hold. A chapter is written at the move of the baseline
alone, in the last commits of a branch, where the records in transit
dissolve into its sections; before that the change lives in the dialogue
and the records, and a sentence of a chapter the tree contradicts is
written with its probe as a record: a record in transit over its section
where the records choose the fix, a target where the chapter's rule
stands and the tree misses it, an open record where neither answers.
`check:conventions` refuses a citation of a section its chapter lacks, a
section written since the baseline that no record dissolved into, and in
a chapter a citation of a record, the history of a form and a sentence
that says what the text leaves out, and in a chapter of the language a
word or a path of the journal.

## cases

The conformance suite is the requirements of the language, held outside
it. A case is a line of `core/test/conformance/<chapter>/<section>.jsonl`,
`{"name":…,"query":…,"expect":…}`: a query the runner reads as text and
the literal it must answer, a value or a raised error,
`!{…} | raise`. Every file of the suite is a section of a chapter, the
section whose rule its cases show, and the name of a case says that rule
in the words of the language. A case names a record only while that
record's change is in transit over its section: the record opens the
case, `{"decision":"Dnn","name":…}`, the one record whose rule its query
and its answer show, and `node scripts/dissolve-records.mjs` takes it
off every case that names it when it dissolves [QSWRK#baseline]. The
laws of the catalog are the claims of its pages, which the language runs
on itself, and a requirement a law proves as well stays a case. The rule
a case shows is stated by its section, or by the record it names, and a
rule neither states is written into a record in transit over the section
before a case shows it. The runner compares values, so a case writes a
set in the order its print shows.

The runner, `core/test/unit/conformance.test.mjs`, refuses a file that
is no section of a chapter, a case that names a record and does not open
with one record in force, a target that names no record, two cases that
hold one query to two answers, and a case whose name holds fewer than
four words, the words its hyphens part; `check:conventions` refuses a case
whose record overrides neither its section nor its chapter whole.

## target

A target is a case whose answer the tree does not give yet, marked
`"target": true`, beside the answer the tree gives today, `"now"`, an
error by its tag and any other value as its literal; it names the record
in transit that left it. The runner holds it to three verdicts: it
answers its goal, and fails until the branch that met it drops the mark;
it answers its present, and stays a target; it answers neither, and fails
until a reader tells a repair from a case that broke, and rewrites the
present or the case. A block of a document fenced as `qlang target`
states an answer a repair must produce, a block that writes none the
answer of no failure, and `check:probes` fails when the tree meets it,
so the block is written again as what holds.

A requirement is written on the side of design and met on the side of
implementation. A target is taken in hand where landing it changes no
met case and no record's text; otherwise a move of design with its
record comes first. A target lives in the branch that wrote it: the
branch meets it, or before it lands writes the record that left it again
as an open one whose question the target states, so no target outlives
the move that lands its branch. A branch that works targets, a worktree
of a subagent among them, starts from the head of the branch that wrote
them, its suite green; it changes the implementation, may add cases under
its own record, and drops the mark of each target it met, its query and
answer as they were; it keeps every case, record and gate as it found
them. Master's copy of the diff, `git show master:scripts/gate-diff.mjs`
run with `--task Dnn`, compares the branch with its merge base on master
and lists every such move: a target added, a case added under another
record, and a case taken away, rewritten, marked as a target or moved to
other records; a change to the specification, `scripts/`, a `package.json`,
`.github/`, `CLAUDE.md`, `.claude/`, the configurations of vitest and
eslint, or the comparator of the runner and its judge; a record added, rewritten, moved or
taken away, but for a line of fate appended, and the guide of the
records; the targets met outside the task; and the lines of the
implementation that spell a target they met.
The review reads them first.

## marks

An artifact names the rules it holds by a citation in a comment, a
section at the baseline, `[QSNAM#scope]`, and a record while its change
is in transit, `[Dnn]`: a module of code, a script, a test file and a
workflow under `.github/workflows/` in the comment at their head or above
the block that holds the rule, and a source of the catalog in the comment
above its pages, `The rules it holds: [QSDSP#residence]`. A file of the
conformance suite marks its section by its path, and a case the record in
transit over that section by its `decision` [QSWRK#cases]; the sister
project names a record of qlang with the repository, `(qlang Dnn)`; and a
screen and a run of a set of the benchmark name the record they measure
in the name of their file, `screens/D270.txt` and
`sets/V/runs/D270~cli~sonnet~1.json`. A mark covers its block,
from its comment to the next comment that holds one, the first block
reaching up to the head of the file, so a search answers what governs a
file and what a record left behind: `node scripts/marks.mjs` answers the
scope of a record or a section, `--touched` the records whose marked
blocks a diff touched and `--reread Dnn` what to read again. An artifact
that names nothing, a tracked `.mjs`, `.js`, `.peggy` or `.qlang` outside
`docs/` or a workflow, is an orphan, which `check:conventions` refuses and
the desk counts; the files of a set of the benchmark, the data its runs
wrote and the generator its author wrote, are no artifacts and carry no
mark inside them. A page of the catalog, the public interface of the
language, cites the sections and pages a reader follows, a record only
in the comment at the head of its source.

## baseline

The baseline is the last commit that landed a branch on master, a merge
on its first parent line, which the walk reads from the history; its move
leaves master a clean desk, no record in transit in the tree of its
merge and no text in both voices [QSWRK#documents], where the next shift
starts. It moves when a branch lands, before an outside audit among
them; the records a change of the journal alone writes, which lands
without a branch, wait for the next branch, and no more than twenty
records stand written since it. The move is the last commit or the last commits
of the branch, the chapters written there alone; the gate runs after it,
and the branch lands.

At the move:

- Every record in transit that the maintainer and the tree accept
  dissolves into the sections it overrides: they are written anew in
  the present, and `node scripts/dissolve-records.mjs Dnn` takes the
  record off every case that names it, names its section in each
  citation of it where it overrides one and lists the citations for the
  author where it overrides several, writes its line `Dissolved into` and
  moves it out. It refuses a record that overrides nothing. Records in
  transit over one section dissolve in the order of their numbers. A
  record that overrides a section dissolves or is set aside with its
  change undone; an open record waits.
- Every record in force is held against the new tree, critically: one
  whose form the language has left is closed, one a newer record
  contradicts is closed, and an idea no choice settled is an open
  record. A record whose marked blocks the diff from its tree touched is
  read again against the new root and described anew or closed; one the
  diff left alone stands as it is.
- A report of the research named after a record stays while that record
  is in force or a text in force, a record in force or a seed, cites its
  folder and the name it shares with its reading, `design-check/D329~2`,
  and any other document of the research while such a text cites its
  path from the root of the journal, so a citation of one document holds
  no other. A document leaves with what holds it, the fates of the
  findings of a report standing with the report and the README of its
  folder saying what the folder holds; `node scripts/drop-documents.mjs`
  drops the documents of the research nothing in force holds, printing
  the fates that say open, each carried into an open record of its axis,
  and gives the members of each series of the benchmark, its sets with
  their runs and its screens, past its two latest to the history,
  refusing a document or a member something in force holds. A branch
  keeps every run it made until then, one leaving earlier only when the
  session drops it by its path.
- Every probe of the open records and of the chapters is run, and a
  section whose answer the work changed is written with the answer the
  record dissolving into it holds.
- The branch lands on master and is deleted, with the worktrees of its
  cuts, and the merge holds no record in transit.

`check:conventions` holds the walk: a record of the language the
baseline's tree holds that no case names and no line of fate closes,
unless it is open; a citation of a section its chapter lacks; a section
of a chapter written since the baseline that no record dissolved into
since, and a section or a chapter gone that none names; a case of
a chapter the baseline held, added, rewritten or taken away since, that
no record in transit over its section claims, the case naming it or,
taken away, named in its text, nor a record dissolved into the section
since the baseline, which claims it until the merge that lands it, a
chapter the baseline did not hold waiting for the next move; a document
of the research the baseline holds that nothing in force holds; a series
of the benchmark past its two latest at the baseline; a seed that cites
a record in transit; more than twenty records since the baseline; a
record in transit in the tree of the merge that landed it; a citation in
the code and the tests of a record out of force or of one of the
language no met case holds, a case that names a record out of force or
being decided, and a citation in a seed of a record out of force or of
the language with no case, an open record among those it may cite.
`npm run desk` shows the walk at the start of a shift, and the reach of
the records in transit [QSWRK#documents].

## branch

A branch is a shift: it takes the scars of its shift, is named after
them, states in its description what it shows when it lands, and lands
on master by a merge commit after the move of the baseline, its last
commits, made locally where no pull request is open. Code is committed
on a branch, a chapter is written at the move of one, and a change to
the journal alone lands on master directly. A push waits for the
maintainer's invitation, a commit is never amended, and the branch is
deleted after the merge, locally and on the remote.

A new public surface comes with its tests first. Each clause added to a
condition is held by a test that fails without it, cut on a copy to
watch it fail. A change to how a text is read is run against the
previous version over generated texts, each divergence explained; a
change to the scope a quote runs in or to the reach of a bare name comes
with tests of shadowing by a reader's verb and by a later source's; and
a quick path in a shared helper is held against every caller and every
value each hands it, an error and a value under a tag among them. The
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
beside it that no road reaches leaves. A clause is cut in a copy its own
runner alone writes, and a cut is read by the name of the test that
failed. A script that
moves cases between files writes every file after it has computed them
all, its folders made first.

A branch starts from the full set of places where its cause shows, found
by search, and its first commits delete. The work
of the model on the texts is validation, the contradictions, the
conflicts, the holes and the problems of what is written, and a session
that finds none reads further and runs more of the probes. What confuses a session during the work is settled where it is
met: a comment that justifies or leads away is fixed in the branch, and
a sentence of a chapter the tree contradicts or a requirement no case
states is written with its probe as a record, a record in transit over
its section where the records choose the fix, a target where the
chapter's rule stands and the tree misses it, and an open record where
neither answers it, while the chapter waits for the move. Each is
weighed by the mission of the aim: whether it makes the first attempt of
a fresh session likelier and its reading lighter.

## code

The code names each thing as the language names it: a tag is a tag,
`makeTag`, `isTag`, `TagLit`, a step a step, a modifier a modifier. A
comment states what holds, in one sentence, and cites the section or
the record it holds; the reason of a rule lives with its record. Every
branch leaves the files it touches so: it moves a reason it finds in a
comment into its record or deletes it with the compromise it excuses,
and deletes a false comment. The ratio of comment lines to code lines
over the core, the command line and the language server falls on every
branch, which `node scripts/measure.mjs` measures against the baseline. A printer decides a
spelling by the kind of the value, never by a regex over the text of a
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
adds; the catalog grows by the verbs a task asks for
and the pages that tell them. A commit message, a page and a record carry
no count the history answers.

## probe

A probe is a fenced block of a document whose lines that begin with `>`
are queries typed into `qlang`, each read as the command line reads a
query with nothing piped, over its sources and from `::qlang`, and whose other lines are what the
tree answers; one that begins with `$` is a shell command. A probe answers
the sentence it stands under, a verdict, the things the sentence names,
or a quantity to the precision the sentence states, a sign or a ratio to
a tenth, so its answer changes when the sentence stops being true and
only then. It reads what the sentence names in a way that fails when
that is gone: the runner runs a shell probe with a pipeline that fails
where any command fails, and a probe that lists files by `git ls-files`
lists them with `--error-unmatch`. `npm run check:probes` runs every probe of
the open records, the records in transit and the specification that reads
the repository alone. A probe of a section a record in transit overrides
is the record's while it is in transit: an answer the record's work
changed waits for the move, which writes it into the section, where the
record holds a probe of the same query with the new answer, and any other
answer that changed fails the run. A shell probe that
reads a machine, the sister project or the environment, one that names
`jdt`, `scripts/sensors` or a variable of the shell or begins with
`env`, keeps the date of its answer and is run by hand.

`check:conventions` holds the anchors of `CLAUDE.md`, the aim and this
chapter: a path they name in backticks is a file of the tree
or of the sister project, and words they quote in “…” beside a path stand
in that file.

## documents

`docs/` holds two folders. The specification, `docs/spec/`, holds the
chapters. The journal, `docs/journal/`, holds the aim,
`docs/journal/AIM.md`, the yardstick a choice is weighed by, the records
in force at its root, those out of force under `replaced/`, and the
research under `research/`, the reviews, the critiques of the records,
the outside audits, the checks of the chapters and the pentimento
audits, each folder with a README that says what it holds. The screen of
the work, `npm run desk`, and the sensors under `scripts/sensors/`, which
read the transcripts, the history and the files, compute what a session
starts from. The sensors that read the transcripts read every
configuration directory of the machine that keeps a transcript of the
project, the one a session runs under, each beside it and `~/.claude`, or
the directories `QLANG_TRANSCRIPTS` names, and say how many transcripts
each gave, so a search of the maintainer's words that read a part of them
says which part; his words are what he typed, the answer and the note he
wrote to a question a session put to him among them, and an option he
chose of those a session offered stays the session's words.

The language says the rest of itself in its catalog: what a reference or
a tutorial would retell are the laws of its pages and the concepts on
the pages of `::qlang`, and the embedding interface is the page of the
package, `core/README.md`. The instruction file of the repository,
`CLAUDE.md`, is the table of contents a session starts from: how the
project is built, how the work moves, the resources outside the tree and
pointers into it, while the model computes from the tree what the tree
holds.

The texts that state what holds rank in one order: the specification,
the catalog and the cases, the reference of the language [QSWRK#spec],
then the code that implements it, then the tools, then the process. A
lower text holds to a higher one, and where they part, the lower one
changes, the parting written as a record until it does; the process
brings no entity into the language.

The texts of the work speak in two voices, parted by what a reader
decides against the tree a text stands in. A cataphatic text holds only
sentences a reader decides against that tree, by a probe, a case, a
check or a reading of the tree, a refusal and a negation that is the
condition of a rule among them, and names no moment and no reader, so it
reads the same to a session that saw none of its history: the chapters
of the specification, the pages of the catalog, the cases and the
comments of the code, and the seeds a session and a reader start from,
`CLAUDE.md` and the READMEs of the workspaces. A section keeps what its
rule does for its reader, a consequence a reading of the tree decides, as
that calls run side by side never stop each other; why the rule changed,
what it was and what it set aside leave with its record at the move. An
apophatic text carries the change against the baseline, what no reader
decides against the tree, a reason, an intention, a doubt, an alternative
and what holds of another tree, and is read from its origo, the here and
now it speaks from: the dialogue of a session from its session, where
every doubt, choice and reason of the model is said, its transcript the
whole record of it and the summary of a compaction the model's
paraphrase of it; a quote of the maintainer from its time and its
session; a report of the research from its head; a record out of force
from the commit it left at; a commit from its parent; a record in force
from the baseline, which every move holds it against, with no mark of
the commit that wrote it, and one written since from the tree of its
branch; the memory between sessions from the session that wrote it; and
the aim from the tree it is read in. A commit a record names, the tree of
a run under `Runs.` and a path read as `git show <commit>:<path>`, is the
origo of what the record cites, and stays. A record holds both voices:
what a reader decides once its work is done, its rule and its cases, and
what no reader decides, its source, its circumstances and what it set
aside. A session reads the cataphatic core first, the chapter of the work
and the texts of the language `CLAUDE.md` names, so its picture of the
language is built from what holds, then lands on the apophatic texts,
the dialogue, the screen of the work, the aim and the records in transit
and open, where its work is, and reads the rest of the cataphatic texts
by topic at the point of need. What it writes into a cataphatic text
states what holds; a doubt or a reason it meets is said in the dialogue,
or written as a record where it asks for a choice.

A sentence of a cataphatic text that no reader decides against its tree
is a pentimento, the earlier layer that shows through the paint, the
Italian for repentance: a history, the justification of a change, a
contrast with what the tree does not hold, a word to a reader. A dialogue
answers its own beginning at every turn, and a session writes such a turn
into a file it touches as one more turn of the dialogue, answering a past
the reader of the file never sees. A script holds the line where a script
can, since a prohibition is forgotten where a check is not:
`check:conventions` refuses, beside the words that point to a moment or a
record, a comment, a doc of the catalog or a sentence of the prose that
names a token the branch took out of the code, the catalog and the cases
since the baseline, a name with a lowercase letter and a capital, a digit
or an underscore inside it, or an address under `::`, and a term the
language retired written there, in the name of a case or in the title of
a test, naming the term to write and the record that retired it, a
section a record in transit overrides waiting for its move as its probes
wait [QSWRK#probe]. The readers of the check of the chapters read for a
pentimento the chapters, and the pages and the comments of the code they
read beside them, and for a drift, one thing named by two words across
the texts that state what holds, the seeds among them, where a reader
would take the two for two things; the readers of the pentimento audit
read for both the texts that state what holds beyond the chapters, a
drift both ways, one word over two things as well [QSWRK#review].

A term of the language and of the texts that state what holds strikes
one sense, by the principle of the aim, and is weighed in those texts
before it is chosen, kept or split: the vocabulary is distilled at each
run of the pentimento audit by the measures
`node scripts/sensors/vocabulary.mjs` computes over them, the
selectivity of a term, the share of its matches that stand in the files
naming its anchor, the tag, the section or the refusal of its one sense,
a match away from the anchor another sense; the consistency of a
concept, one concept under one term and one image, the words that name it
in the files naming its anchor, a second word there a drift, and the
share of the files writing one term of a group that write its partner, a
term from another image chosen again with the group; and the prior of a
new term where the two leave a choice, the files of a corpus of other
projects, the `node_modules` of the checkout, that write it, a word rare
in the project and known outside it in the right pair the best. A term
found in several senses is split into anchor terms, one a sense, each
with its own anchor; a concept under rival words keeps one; and a group
of another image is chosen again as a whole. A record that retires a term
writes it into the lexicon of retired terms, `scripts/retired-words.mjs`,
in the commit that retires it, a regex of the one sense it had, the
term written in its place and the record. The lexicon holds the terms of
the project, each of one sense and high in entropy: a generic word of
other projects, which a search finds in a heap of senses, stays out of
it, its uses held by the readers of the pentimento audit, but for a
generic word the texts that state what holds write in no sense at all,
which it refuses whole; the journal and
the research, which carry the change, keep the words they quote.

The apophatic texts are where the work lives. While a branch works, a
record in transit reaches into the cataphatic texts, each section it
overrides, each case it claims, each line of code that cites it and each
target it left speaking in both voices, the tension of the work, while
the text of a chapter waits; `npm run desk` shows the reach, the records
in transit, the sections they override, the cases they claim and the
lines of code that cite them. A seed, read first by every session, cites
the sections a record in transit overrides and never the record, and
states what those sections hold, its words for the voices the two voices
and the pentimento, the criterion and the origo left to this chapter. At
the move, the last commits of the branch, the tension relaxes: every
record in transit parts, what a reader decides against the new tree
written into its sections, or is set aside with its change undone, and
leaves with its origo, so the merge that lands a branch holds no text in
both voices, and the journal on master keeps the open records and the
aim, what the next change draws on.

## catalog

A verb enters the catalog when it expresses what was inexpressible over
the values the language has, or shortens what every host would
otherwise write; the verbs and the nouns of a domain belong to its host.
The core carries
the working set a shell would supply to every host, one with no shell
around its queries among them, the site's playground: the JSON codec
both ways, text as lines, `split` and `join`, trimming, replacing, case
and search; a host keeps its domain, its streams and its
renderings. One sequence serves them all, the vector, a string reading
in pieces by `split`, `lines`, `count`, `take` and `drop`.

A name a reader trained on other languages reaches for enters beside the
verb that answers what the habit expects, as `distinct` stands beside
`toSet`, `flatten` beside `flat`, `merge` beside `union` and `size` and
`length` beside `count`: a function under the same label whose recipe
calls the verb, its page naming the verb, so the fact keeps one spelling
and the name is another road to it. Where the habit expects another
answer or another call, the name is a verb of its own, as `concat` is, or
none, since a name that answers otherwise than the habit expects fails in
silence.

A declaration in a source of the catalog writes its name on a line of
its own, each doc of its slot on the lines after it indented by two, a
doc of one line on one line and a doc of several lines closing on a line
of its own, and its value on the line after them.

## measure

The mission's measure is the first attempt of a fresh model, which the
benchmark takes by its sets. A child of the benchmark, `claude -p` from
a directory of its own with no settings, memory or server, runs the
command line on the tasks of a set, handed one first screen, the pages
of the language and of the command line as
`[::qlang ::cli] | map ~(get [~(it) ~(doc)])` prints them, which
`firstScreen` of `scripts/benchmark/screens.mjs` answers trimmed. A set
is written by a clean author who never sees the language: the data, the
tasks and a script that computes the answers. A set measures once:
reading what its children missed, `misses` or `frictions`, marks it
seen, `run` refuses a set seen, and the next measurement orders a new
set. A sentence of the first page stays by what it carries to a clean
reader on tasks its author never saw.

A measurement belongs to a record in force, which says what it measures
and why, and carries its number, `run --decision Dnn`, its runs named
after it, `D<n>~cli~<model>~<k>`, a run on another screen than the one
saved under its number carrying the hash of that screen beside the
number; the numbers measured grow, `run` refusing a number below the
last one measured, and a second measurement under a number states its
reason. A run fixes its circumstances when it runs: the screen the tree
printed, saved under the number with its hash, the hash `screen` prints,
the commit of a tree with no change outside it, the model, the date, the
set, every call of the command line and what the language answered, and
its score, each final query run by that tree against the author's
answer; `verdict` sets the runs of a measurement beside the measurement
before it, or the one it names, as they fixed them.
`scripts/benchmark/tasks.mjs` keeps each task with its question, the
data it reads where it reads any, its answer and its reference, the
shortest query the tree answers it with; the references run in the gate
as `check:benchmark`, the default of `scripts/benchmark.mjs`, and no
child reads them: a reference proves its task solvable and names the
price the language asks, so a reference that shrinks is a repair. The
script holds `check`, `screen`, `author`, `run`, `verdict`, `grade`,
`misses` and `frictions`, and the series of the benchmark are its sets,
under `scripts/benchmark/sets/` with their runs, and its screens, a
branch keeping every one it makes and the move of the baseline giving
each series past its two latest to the history [QSWRK#baseline].

## review

A review holds a diff against the principles of the aim,
`docs/journal/AIM.md`, and the rules of the work: it reads whole every
file the diff touches, and its report gives a verdict, accepted or
changes asked, and its findings, each with its file and its line and the
principle or the rule it breaks. The report is kept as its writer wrote
it, each finding with the fate it met.

A report of the research is named after the record that called for it and
numbered in the order the reports of that record ran, as the runs of the
benchmark are named after the record they measure: a review of the work
a record did, `docs/journal/research/reviews/D324~4.md`; a critique of an
open record, `docs/journal/research/design-check/D329~2.md`; an outside
audit, `docs/journal/research/outside-audit/D327~1.md`; and a check of
the chapters and a pentimento audit, whose readers write into the folder
of the run, `docs/journal/research/spec-check/D323~1/` and
`docs/journal/research/pentimento-audit/<Dnn>~<k>/`. One table,
`RESEARCH_FOLDERS` of `scripts/decision-records.mjs`, names each folder
of the research and the form of what it holds, a report or a run, and
the walk and the conventions build their regexes from it. Every report
opens with its head, what it is and the record that called for it, the
tree it read and the baseline that tree stood on, when it ran and how, a
path it names read as `git show <tree>:<path>`; the record holds each run
under `Runs.`, a line the script writes as it writes the report, why it
ran given by `--why`; and beside each report stands the session's
reading, `D329~2~reading.md`, or the `reading.md` of a run, every finding
with its probe and its fate, a record in transit, a target, an open
record, a record that holds it already, or none with the probe that sets
it aside. No run trims the reports a branch made, and the move of the
baseline cleans them [QSWRK#baseline]. The README of the research,
`docs/journal/research/README.md`, tells its folders, what calls each
report into being, how each is named and how long it stays.

The scripts of the research start their readers alike, through
`scripts/research-runs.mjs`, which holds the start of a clean reader,
the refusals of a run, its number, the head of a report, the line under
`Runs.` and the packing of what a run reads into groups of about one
weight. A reader is a clean Opus, `claude -p --model opus` started from
an empty directory of its own with `--restricted` and
`--strict-mcp-config`, with no instruction file, memory or server, the
tree's `qlang` first on its path and its tools Read, Grep, Glob and Bash,
Bash for `qlang`, `grep` and `git ls-files`, or for `qlang` alone in the
outside audit, and no other git command; the readers of a run start at
once, and each answers the prompt of its kind in Russian. A run reads
the tree at HEAD of the checkout it runs in, every change of which a
commit holds, best on master after a branch landed, and from a worktree
of that commit outside the repository, with its own install and build,
where another session works in the checkout. It refuses a call that
names no record in force, a tree with a change no commit holds and a
second run for one record on one tree, and a run whose checkout moved
under its readers writes no report and no line under `Runs.`.

`node scripts/spec-check.mjs --records Dnn …` gives each open record named
a clean critic of its own, who bootstraps from the chapters, the first
pages and the aim, reads the record and the records it cites, and holds
each of its roads against the chapters, the cases, the catalog and the
implementation, answering `scripts/design-check-prompt.txt` with findings
of five kinds, a counterexample, a cost, a conflict, a road and a hole,
each with its probe; a record that is not open is refused, a critique
reading a question still open.

The check of the chapters holds the consistency of what the
specification says: its chapters among themselves, and each with its
cases, with the pages of the catalog and with the implementation.
`node scripts/spec-check.mjs --for Dnn` runs it for the record in force
that calls for it and carries its fates, by clean readers each answering
`scripts/spec-check-prompt.txt` for a group of chapters in the order of
the index, the chapter of the work a group of its own: a reader
bootstraps from every chapter and the first pages of the language, and
then reads its sections against their cases, the code that cites them,
the pages of the verbs and the kinds they name and the command line. A
finding is of one of seven kinds: a text that misstates a rule the
written texts mean, or leaves unstated a rule the cases and the pages
hold; an implementation that misses a rule a chapter and its cases state
alike; a design, rules each stated as it is meant that together answer
as the language should not; a conflict of two texts over one thing; a
case that shows no rule of its section, or a rule no case holds; and a
pentimento and a drift [QSWRK#documents]. It carries its probe, which
`node scripts/sensors/run-probes.mjs` runs again on its report; a
reader writes no sentence for a chapter from the tree's answer, the side
that yields being the question of the reading. A clean reader probes the
bounds of each rule as it stands, its doubt a question of the tree, and a
reader of the records looks for the words the language left; a check
goes deeper each time, and one whose findings are precision alone is the
one to stop at.

`node scripts/outside-audit.mjs --for Dnn` runs the outside audit the
record in force calls for: one clean reader reads the tree at HEAD and
runs `qlang`, the history out of its reach, and answers
`scripts/outside-audit-prompt.txt`. The session writes its reading beside
the report, every finding checked by a probe with its fate.

The pentimento audit reads the whole tree, where a review reads a diff, a
critique a record and a check a group of chapters: its readers read the
texts that state what holds beyond the chapters for the earlier layer
that shows through them [QSWRK#documents].
`node scripts/pentimento-audit.mjs --for Dnn` runs it for the record in
force that calls for it and carries its fates, six readers at once unless
`--groups` names another count, and `--dry` prints its groups and the
cycles of the imports of the core, the strongly connected components
`scripts/core-imports.mjs` computes, and starts no reader. The script builds the
groups from the texts the walk of the baseline cites, in units taken in
the order the texts rank, from the topic of the language to the seeds,
each source of the catalog a unit with the modules of `core/src` that
register most of their addresses under its noun, the first noun a module
registers under where two tie, packs them into groups of
about one weight, and writes into each prompt its group, the cycles and
the first line of every open record, whose content counts as known, a
finding an open record holds reported only where it adds to that record,
naming it. A reader bootstraps from every chapter, the first pages and
the aim, then reads its group, the names of the cases and the titles of
the tests by grep and the rest whole, reports what it meets in a chapter
it read as well, and answers `scripts/pentimento-audit-prompt.txt` with
at most twenty-five findings, the weightiest first, each of one of six
kinds: a vestige, a name, a fact, a refusal, a path, a module or a
mechanism that a tree built for the mission from a clean sheet would not
hold, or would hold simpler or fewer; an archaism, a term of a model the
language left, read against the pages of the catalog; a shim, newer code
that reaches older code through a conversion, a wrapper, a second table,
a special case, a flag or an export kept for an older form; a
subordination, a part that depends on what should depend on it; and a
pentimento and a drift [QSWRK#documents], the drift read both ways. Each
gives the layer it keeps, what a tree built for the mission from a clean
sheet would hold in its place and a probe the tree answered. The reports
of a run stand in its folder, each named after the units of its group,
and the session's reading beside them, `reading.md`, reads the layer a
finding keeps by `git log -S`, searches the maintainer's words on its
axis before a removal is weighed, and weighs the terms of a drift or an
archaism by `node scripts/sensors/vocabulary.mjs` [QSWRK#documents]. A
repair that moves no rule is taken in hand, and a finding that moves a
rule enters the open record of its axis or a record of its own; a
repaired kind a regex finds is held by `check:conventions`, and an
archaism of one sense a record retires enters the lexicon of retired
terms. A later tree may be read again, deeper, as the chapters are, to
the run whose findings are precision alone.

## tooling

The language and its tooling are npm workspaces of one repository, each
folder the suffix of its package: `core` the language and `cli` the
command line and its REPL, published under the `@kaluchi/` scope, `lsp`
the language server, `site` the site, private, and `vscode` the editor's
extension, `qlang-vscode`; `npm install` at the root links them. The
core is pure JavaScript with no dependency at runtime and no `node:*`
import under `core/src/`, and it runs in a browser, in Deno and in
Bun; its catalog under `core/lib/qlang/` is read at runtime as
`#qlang/<name>`, and the topic of the language, `core/lib/qlang.qlang`,
as `#qlang`, through the `imports` of its `package.json`, the loader
of each platform chosen by the condition of `#qlang/load-source`; the
parser is built from `core/src/grammar.peggy` by `npm run build`; and a
workspace depends on a sibling by the range `^x.y.z` of the sibling's
version. The core exports its root, `core/src/index.mjs`, beside
`./errors`, `./highlight`, the light door that loads the parser and its
walks and no runtime, and the sources of its catalog, each function of
the package at one door. The modules of `core/src` import in the order of
the concepts, from the bottom: the letters of a name, the address, the
keys of the scope and the declaration of a refusal; the values, their one
order and their equality; the records of the steps and the rules their
constructors hold, `core/src/steps.mjs`, which registers nothing and
imports no parser; the parser and the walks of its tree; the reading of a
path and the nearness of two names; the printer of the core's forms; the parts of a doc; the state of a
query, the table of primitives, the resolution of names and the chain;
the walk of a value's tags and the run of a primitive,
`core/src/dispatch.mjs`; the evaluator; in `core/src/runtime/` the words,
which register their primitives as they load and `package.json#sideEffects`
keeps, and the root that boots them; and above them the session and the
root of the package. No module of the core imports a module that imports
it, the parser and the loaders among its imports, and none outside
`runtime/` imports one inside it but the session and the root of the
package, which `core/test/unit/imports.test.mjs` holds by the strong
components `scripts/core-imports.mjs` computes. Each module is named for
what it holds and its head says so: the codec of JSON in
`core/src/runtime/json.mjs`, which exports no print; the words a sequence
answers across its kinds in `core/src/runtime/sequence.mjs`; the
constructors of the kinds of the core's values in
`core/src/runtime/constructors.mjs`, but those of `::fn`, `::kind` and the
steps of code, each beside the other words of its kind; the shape of a
value, its leaves and their marks in `core/src/runtime/shape.mjs`, and the
verbs of a path in `core/src/runtime/path.mjs`; and in the command line
the reading and the lift of standard input in `cli/src/stdin.mjs` and what
it writes for an answer, with the code it exits with, in
`cli/src/render.mjs`. A script of the work takes `evalQuery` and
`createSession` from the root of the package.

The hosts beside the core: `cli/src/bin.mjs` is the one file of the
command line that touches `process`, handing the arguments, the streams
and the environment to `main.mjs` and exiting with the code `main`
resolves, every branch of the command line living where a test reaches
it; the REPL paints what it prints by `cli/src/highlight-ansi.mjs`, a layer
of colour over the core's `tokenize`. The language server runs over
stdio and answers `initialize` with its capabilities; the editor's
extension, `vscode/src/extension.js`, unpublished, launches the server
of the checkout. The site is built by
Astro, `site/astro.config.mjs`, its examples split into prompts, answers
and comments by `site/src/lib/format-example.js` and painted by
`site/src/lib/qlang-highlight.js` from what the core's parser reads, and
`.github/workflows/pages.yml` builds it and publishes it to GitHub Pages
on every push to master.

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
outside `docs/`, `vscode/` and the instructions, the grammar, the pages of
the site and the workflows among them; a month of the
history in a chapter, a seed, a page of the catalog, a case and the
code; a count in markdown prose that
a command answers; the ranges of the siblings; every refusal declared by
its address; a report of the research without the session's reading
beside it [QSWRK#review]; a comment, a doc of the catalog and a sentence
of the prose that name a token the branch took out [QSWRK#documents];
and the form of a record from `D155` on, its `Domain.`, its decider and
the fields of an open record.

`node scripts/release.mjs <version>` runs a release end to end from a
clean master in step with its remote whose checks on GitHub are green:
a preflight, the bump, the ranges, the parser, the coverage of the core
and the tests, the commit, the push, the wait for the checks, the tag
and its push; the tag runs `.github/workflows/deploy.yml`, which
publishes the core and the command line through the trusted publishing
of npm, whose publisher names that file; the commit of a release
lands on master directly. A release happens at the maintainer's word,
and between releases the sister project consumes the copy of the
workspace.
