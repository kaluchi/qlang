# QSWRK · The work

How a change moves through the work: a session and a stint, the journal
that carries a change from one closeout to the next, the closeout that
lands it, and the reconciliation that holds what a closeout leaves. The
chapters of the work state the rest by topic: the texts and their voices
[QSVOX], the words and the names [QSLEX], the requirements and what holds
them [QSREQ], the measures [QSMSR], the reviews and the research [QSRVW],
and the repository and its gate [QSGAT]. The order of the texts ranks the
process after the language and its tools [QSVOX#order]; a check of the
tooling holds a rule where its section names one, and the review and the
maintainer hold the rest.

## stint

The work moves in three units, each under a word of its own. A session is
one conversation of a model, the unit of its context, its transcript the
whole record of it. A stint is one branch, from the clean desk the last
closeout left to the next, as many sessions and days as its work takes. A
closeout ends a stint [QSWRK#closeout].

A session ends with no rite: a decision is written as a record when it is
taken, in the stint it is taken in [QSWRK#journal]. A stint is named after
its scars, the pains it takes in hand, and states in its description what
it shows when it lands. Code is committed on its branch, never on master.
Every text of the journal the stint writes lands on its branch, an open
record, a line of fate, the aim, a report of the research and its reading
among them, and master takes them with the merge. A subagent that works in
a worktree commits on a branch of its own, which its stint takes back.
Nothing in a stint switches the branch of the checkout, merges or writes to
master but its closeout. A push waits for the maintainer's invitation, and
a commit is never amended.

A stint starts from the full set of places where its cause shows, found by
search, and its first commits delete. The work of the model on the texts is
validation, the contradictions, the conflicts, the holes and the problems
of what is written, and a session that finds none reads further and runs
more of the probes. What confuses a session is settled where it is met. A
comment that justifies or leads away is fixed in the stint. A sentence of a
chapter the tree contradicts, or a requirement no case states, is written
with its probe as a record: a record in transit over its section where the
records choose the fix, a target where the chapter's rule stands and the
tree misses it [QSREQ#target], and an open record where neither answers it.
Each is weighed by the mission of the aim: whether it makes the first
attempt of a fresh session likelier and its reading lighter.

A home, a chapter, a section, a module or a test file, is made in the stint
whose work asks for it, with the record that needs it [QSVOX#chapter]. A
structure that does not fit what the tree holds is cut anew so: a chapter
grown past one topic parts into chapters of one topic each, and a module
that holds two things into two.

## journal

A decision is a record of its own, `docs/journal/Dnn.md`, numbered in the
order it was written, a discussion with its choice and its circumstances. A
citation of a record is a link of markdown to its file, `[Dnn]`.

A record is written in fields, each opening a line: `Domain.`, the part of
the work it governs, `Language.` a change of the language whose
requirements are cases, `Process.` a rule of the work, and any other domain
one its own tests hold; `Decided by.`, `The maintainer` or `The model`, the
maintainer whose words it quotes or the model which says what it answered,
and where a choice of the maintainer meets the mechanics the model worked
out around it, the line names the parts that are the model's; `Decision.`,
what holds; `Source.`, where it came from, the maintainer's words quoted in
«…» as they were written, in their language, with the time in UTC and the
prefix of the session, and words of the tree quoted in “…” beside their
anchor; `Set aside.`, the alternatives and why; `Requirements.`, the cases
it leaves; and `Runs.`, the reports of the research it called for, a line
each that the script writes as it writes the report [QSRVW#research].
`check:conventions` refuses a record from `D155` on that names its decider
otherwise, and `node scripts/sensors/check-quotes.mjs`, run on the
maintainer's machine, holds every quote of the maintainer against the
transcripts.

A statement of the work carries its handle: a fact of the tree a probe or
an anchor, a file and a symbol; a decision its record, or the section it
dissolved into; an inference the model's reading, marked as such where it
carries weight; and a question an open record. A sentence that others rest
on and no source holds is verified or turned into a question, and one with
neither a source nor dependents is let go. Doubt is resolved by a record
with its source. The maintainer's words are quoted as written, and a rule
is written as a rule, its date and its source in the line of its source. A
source outside the tree is read whole before a sentence rests on it. A
claim about the language in doubt is run; an intention in doubt is asked of
the maintainer, and the answer recorded in his words. A rule is said of
what it governs.

The insights the work meets about itself are collected as it goes into a
numbered record of the stint, each a rule a later session holds; at the
closeout each dissolves into the section of the chapter of the work it
governs. A record written before its code is read again after the last
commit of its stint. The source of a record is written in the past, and its
requirements name its cases, not a file of them. The prune of a decision
ends with a reading of every record in force against the tree, which finds
scars of the tree as well as of the text: where a record names a rule the
tree misses, the tree is repaired and the record stays.

Only the maintainer's quoted words bind a session. A record the model
decided is a reading the session weighs on its merits and replaces by a
record of its own when a better one turns up; a question goes to the
maintainer where his quoted words are at stake or the merits leave the
choice open, laid out with the alternatives and their cost. Before a
construct is proposed, the maintainer's words about it are searched, `node
scripts/sensors/maintainer-messages.mjs`, and a capability of the language,
a form of the grammar, the shape of a value or a verb is removed on the
maintainer's words about that very axis.

A question the tree and the records do not answer is an open record: its
first line names the question, and it holds `Domain.`, `Question.`, the
question with the reading of the tree and its probes, `Source.` and
`Alternatives.`, each with its cost. Once it is decided it is written again
in place, its `Question.` and `Alternatives.` giving way to `Decided by.`
and `Decision.`, the alternatives not taken becoming what it set aside. A
question of its own is a record of its own. `node scripts/requirements.mjs`
shows where every record stands, the records being decided, the open ones
and those carried out, replaced or held by the tests of their domain.

A record changes the rules of the specification while it is in transit: a
line that opens with `Overrides` names the sections it overrides,
`Overrides [QSPTH#has], [QSBLD#value]`, its later lines opening with `[QS`,
and within them it rules over the specification and the code, a case, a
test or a line of code its work touches citing the record in place of the
section. A record in force is true as a whole and speaks the words of the
tree. A newer record that takes a part of an older one writes that part out
of it in the same commit, found by a search of the records' words, the older
gaining `Pruned of what [the newer] took.` and the newer `Replaces in part
[the older]`, and the words a record quotes in its source stay as they were.
Records of one axis merge into the earliest of them, `node
scripts/merge-records.mjs <earliest> <later>…`, whose number stays the
address of the axis, described anew against the tree; each later one gains
the line `Merged into` the earliest, and a merge probes every sentence it
carries over.

A record out of force moves once to `docs/journal/replaced/`, under the
line of its fate, `Dissolved into`, `Merged into`, `Replaced by`, `Filed
under the principles by` or `Filed under the tooling by`, and under its
title the line `Left at` the commit whose tree its text was last true of,
every path it names reading as `git show <commit>:<path>`; `node
scripts/replaced-records.mjs` moves it and rewrites the links to it. A
record keeps its number for good. `check:conventions` holds the fates: each
names a record that exists, a part taken is named back by `Pruned of what`
and `Replaces in part` alone, a record replaced whole stands under
`replaced/` and one in force in the root, and every markdown link of a
document leads to a file the tree holds.

## closeout

The baseline is the last commit that landed a branch on master, a merge on
its first parent line, which the reconciliation reads from the history. A
closeout leaves master a clean desk, no record in transit in the tree of
its merge and no text in both voices [QSVOX#voices], where the next stint
starts.

A closeout comes at the maintainer's word, or in a session that works on
its own while he is away; no count of records and no end of a session asks
for one. An outside audit runs on a tree a closeout landed [QSRVW#audits].
The closeout is the last commit or the last commits of the branch, the
chapters written there alone [QSVOX#chapter]; the gate runs after it
[QSGAT#gate], and the branch lands.

At the closeout:

- Every record in transit that the maintainer and the tree accept dissolves
  into the sections it overrides: they are written anew in the present, and
  `node scripts/dissolve-records.mjs Dnn` takes the record off every case
  that names it, names its section in each citation of it where it
  overrides one and lists the citations for the author where it overrides
  several, writes its line `Dissolved into` and moves it out. Records in
  transit over one section dissolve in the order of their numbers. A record
  that overrides a section dissolves or is set aside with its change
  undone; an open record waits.
- Every record in force is held against the new tree, critically: one whose
  form the language has left is closed, one a newer record contradicts is
  closed, and an idea no choice settled is an open record. A record whose
  marked blocks the diff from its tree touched is read again against the
  new root and described anew or closed; one the diff left alone stands as
  it is.
- A document of the research leaves with what holds it [QSRVW#research],
  `node scripts/drop-documents.mjs` dropping the documents nothing in force
  holds and giving each series of the benchmark past its two latest to the
  history [QSMSR#benchmark]; a stint keeps every run it made until then.
- Every probe of the open records and of the chapters is run, and a section
  whose answer the work changed is written with the answer the record
  dissolving into it holds [QSREQ#probe].
- The structure is cut anew where the work of the stint asks, each home it
  brought written in its place.
- The branch lands on master and is deleted, with the worktrees of its
  cuts, and the merge holds no record in transit.

## reconciliation

The reconciliation of the tree with its baseline holds what a closeout
leaves, from one closeout to the next, `scripts/reconciliation.mjs`:
`check:conventions` fails on what it finds and `npm run desk` shows it. It
refuses:

- a record of the language the baseline's tree holds that no case names and
  no line of fate closes, unless it is open, and a record of a measurement
  the baseline's tree holds whose runs and screen the tree lacks;
- a citation of a section that neither the specification holds nor a
  record in transit brings [QSVOX#chapter];
- a section of a chapter written since the baseline that no record
  dissolved into since, and a section or a chapter gone that none names;
- a case of a chapter the baseline held, added, rewritten or taken away
  since, that no record in transit over its section claims, nor a record
  dissolved into the section since [QSREQ#cases];
- a document of the research the baseline holds that nothing in force
  holds, and a series of the benchmark past its two latest at the baseline;
- a seed that cites a record in transit [QSVOX#seed];
- a record in transit in the tree of the merge that landed it, or in the
  tree of master;
- a citation in the code and the tests of a record out of force or of one
  of the language no met case holds, a case that names a record out of
  force or being decided, and a citation in a seed of a record out of force
  or of the language with no case, an open record among those it may cite.
