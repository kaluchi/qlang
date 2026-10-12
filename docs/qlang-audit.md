# Qlang Audit

This document is addressed to whoever picks the project up next. Most
likely that is a model in a fresh session, with this file, the
repository, and a maintainer who answers questions; it may also be the
maintainer alone, checking whether the work still points where it
should. It records what the language is for, what state would count as
satisfactory, why the code falls short of it, what has been decided,
where the work ends, and by which route it gets there. It was first
written in September 2026, and each version since holds the text
against the tree the repairs of the one before left. This, the
eleventh, holds it against commit `2388dd8`, its baseline: a scar the
tree no longer shows has left the document, what remains of a scar is
stated as it stands, the route starts from the baseline, and every
probe answers as the tree answered on the day this version was
written. `git log -- docs/qlang-audit.md` lists the versions, and the
message of the commit that wrote each tells why.

A draft of the session entrypoint, the computed context a session
starts from, lives in `docs/qlang-entrypoint.md`, ideas and no
decision; what the process took from it stands in the records, the
screen of the work a session runs first, `npm run desk` [D226], and
the sensors [D231]. This document treats the language and the work on
it; that one treats the environment the work happens in.

## How to read and maintain this document

Read the whole document once before touching the tree. It is long
because it carries the reasons, and a reason that is not written down
gets re-derived, usually wrong, by the next session.

Four kinds of statement live here, and each has its own handle, the
means by which a later reader re-verifies it.

Evidence is a fact about the tree. Its handle is a probe or an anchor.
A probe is a fenced block whose lines beginning with `>` are queries
typed into `qlang` and whose other lines are what the tree answers; a
probe that begins with `$` is a shell command, which the runner of
probes runs when it reads the repository alone and leaves to be run by
hand, with the date of its answer written before the block, when it
reads a machine, the sister project or the environment. A probe answers
the sentence it stands under, a verdict, the things the sentence names,
or a quantity to the precision the sentence states, so its answer
changes when the sentence stops being true and only then; and it reads
what the sentence names in a way that fails when that is gone, so a
file that moved reads as a failure and never as a repair [D93]. A
target, the answer a repair must produce, is a
conformance case that names its decision [D58]; a block fenced as
`qlang target` holds one whose answer no literal states yet, and it
disagrees with the tree until the repair lands. An anchor names a file
and a symbol, `core/src/runtime/verb.mjs` and
`callVerb`; line numbers drift and are avoided. Evidence goes
stale, and the only defence is to run it: `npm run ci` and the checks
of every push run the probes, a probe whose answer changed means the
sentence around it is wrong and fails them, and the branch that changed
the answer replaces the sentence with the new fact and its new probe
[D93].

A decision is the discussion that ends in a choice between
alternatives. Decisions are numbered, `D1` to the last, and recorded
one to a file, `docs/decisions/Dnn.md` [D31], [D58]: what
was decided, who decided it, the source, what it rests on, and the
alternatives set aside with the reason. The source of
a decision the maintainer took is the maintainer's own words, quoted
verbatim in the language they were written in, slips of typing
included, an elision marked […], with the time in UTC as the transcript
records it and the prefix of the session whose transcript holds the
conversation around them. The maintainer's words stand in «…»
everywhere in this document, and words quoted from the tree stand in
“…” beside their anchor, so a script can hold the first against the
transcripts and a grep the second against the tree. The source of a
decision the model took says so, and says what request it answered.
This document cites a decision by its number, a link to its file. A
decision changes by a new record that names the one it replaces: an
old record replaced whole keeps its text and gains the line that names
its replacement, and one a new record takes a part of is pruned of that
part and names the record that took it, so a record in force says only
what holds, while git keeps every text a record had and the chain of
reasons survives as a graph of files [D227]. A
requirement a decision leaves is a conformance case that names the
decision, a target until the tree meets it, so whether a decision is
carried out is computed by running the cases.

A record is held against every new baseline, and a walk gives each
record of the language that no case names one fate: carried out in
another form, contradicted by a newer record, a principle this document
states, a rule of the tooling, an intention, which is a question of the
open chapter and no decision, set aside, or in force, its requirement
written as a case in the language as it stands [D225], [D226]. The form
a record wrote was the means of its baseline: the walk keeps the intent
and lets the form go. A new record prunes, in the same commit, each
part of an older one it takes, found by a search of the records' words,
and the lines that replace a record in part, which a walk prunes, only
fall. The baseline moves at the end of every shift that wrote records,
so the next starts at a clean desk, before an outside audit and when a
branch lands, a branch at a clean desk landing on master by a merge
commit made locally where no pull request is open [D230], and
`check:conventions` holds a ceiling of records since it; the code, the tests and the cases cite only the records in force,
and this document those in force or waiting on a target.

An inference is the model's reasoning from named facts. Where an
inference carries weight it is marked as the model's reading, so that
a reader knows it can be re-derived and where to look.

A question is what neither the tree nor the decisions answer. It is
posed in the chapter of open questions with the alternatives and their
cost, and it leaves that chapter when a decision answers it.

The weight of a statement is what rests on it. A sentence with a
source and with decisions resting on it is load-bearing and is the
first to re-verify when anything moves. A sentence with dependents and
no source is a hidden assumption, the most dangerous kind; it is
verified or turned into a question. A sentence with neither a source
nor dependents is noise and is deleted.

Some rules for whoever edits the document, each learnt at a cost:

- Doubt is resolved by a decision recorded here with its source. It is
  never turned into process items, checklists with statuses, closing
  conditions, or comments in code. The September sessions did that
  twice, and both times the maintainer had to strip the result out.
- A number that a command answers is not written into prose. It goes
  stale the week after, as the weight of `manifest` did. A probe prints
  it to the precision the sentence needs, a sign, a ratio to a tenth,
  or the list it counts, since a count that moves with every commit
  fails the checks of every branch while the sentence stays true [D93].
- The maintainer's words are quoted, never paraphrased. A paraphrase
  replaces the maintainer's intention with the model's reading of it,
  and the next session cannot tell the two apart.
- Only the maintainer's quoted words bind a session. A record names
  who decided it, `Decided by.`, and where it holds a choice the
  maintainer made beside the mechanics the model worked out around it,
  that line names the parts that are the model's; a
  record the model decided is weighed on its merits and replaced by a
  record of the session's own when a better reading turns up, without
  asking leave, and is never named to the maintainer as a rule the
  maintainer set. A question goes to the maintainer where the
  maintainer's quoted words are at stake or the merits leave the
  choice open [D155].
- A rule is written as a rule, not as the minutes of the conversation
  that produced it. The date and the source belong in the record's
  source line, not in the narrative.
- The transcripts of the sessions are the only lossless record of what
  was said, the `.jsonl` files of the Claude Code project directory; the
  summary of a compaction is the model's paraphrase, never a source.
  `scripts/sensors/maintainer-messages.mjs` lists the maintainer's words
  on any topic, and `scripts/sensors/check-quotes.mjs` checks every
  quote of a document against them.
- Before the first claim about the language, a session reads the
  sources the instruction file names in its first tier, whole; a read
  the tool cut at its token cap did not read the file, and
  `scripts/sensors/read-coverage.mjs` measures what a session has read.
- A source outside the tree is read whole before a sentence here rests
  on it: a search engine's digest and a fetching tool's summary are
  another model's retelling, and a sentence written from one once said
  of an article the opposite of what it says.
- Nothing here is condensed or deleted without the maintainer's word,
  except a sentence that the tree proves wrong, which is replaced by
  the fact and its probe.
- The scars hold what the tree shows as a problem against the baseline
  of the version. A sentence about what a repair removed leaves them,
  and the history of the project tells the repair: «если относительно
  текущего бейзлайна предложение выглядит уже неактуальным - то его не
  должно быть в скарах» (maintainer, 2026-09-25 16:52, session
  86982eb5).

## The mission

qlang exists for a model working under the pressure of a task in a
session that remembers nothing. Such a session meets JSON-shaped data
from sources it has never seen, has to collect and reshape it
correctly, and cannot afford to learn a language first. qlang is the
pipeline language for that situation, and it carries one commitment
that ordinary query languages do not: it teaches its user from inside
itself. The catalog of operands is written in qlang, every binding
carries its own prose and runnable examples, and an error leads to the
document that explains it. A model does not need a manual delivered in
advance; it needs a protocol for asking at the point of need.

The reason is the economy of such a session. Its context only grows:
whatever an answer adds is read again on every later round trip, so
the bill of a task grows with the square of its length, and the tokens
spent first, when the session knows least about what is relevant, are
the ones it pays for longest. Nothing can be unread. A shell with grep
serves that economy worst exactly where the work is. The questions that
matter about a code base or an API are about relations, who calls this,
what implements that, what breaks if it changes, and text search
answers them with matches that must be told apart by reading, which
rebuilds the graph inside the context, the most expensive place there
is.

qlang's place is inside a tool that already holds such a graph or such
data. The tool embeds the language and exposes its domain as operands,
and a session asks one question where it would have made many calls:
the query names the shape of the answer, so nothing arrives that was
not asked for and nothing needed is missing; the intermediate data
never enters the context; and what the tool can do is learned from the
tool at the point of need. This is the contract GraphQL gives a client,
precise fetching against a typed schema, kept on the client's side over
whatever a tool answers, with a pipe that computes and with the schema
as hypertext around keywords and tags.

The sister project, an Eclipse JDT search tool, is where the language
was born and is its key stakeholder. Its command line had grown a
command for every feature, a help text no session could afford, and
answers whose shape only another flag could change, and every excerpt
of that help kept in an instruction file went stale with the next
release. Three requirements came out of it and hold for every host.
Onboarding lives inside the tool and is obtained from it by a command,
because knowledge about a tool that has been copied out of it is a
liability. Nothing is delivered as a sheet: the caller controls the
shape and the detail of what it receives. And the shape of an answer
can be known before the answer is fetched, from the tool itself, since
a query that reshapes blind cannot be written. The last requirement was
learned from the attempt to write every schema and example into the
tool's help: the share of such a sheet that bears on the task at hand
falls toward nothing, because the shape a session needs is that of the
one answer it is about to reshape, and that shape belongs to the
operand it is about to call.

An answer is a presentation, data filtered for a question, never the
data a host holds. The sister project's first answers were formatted
text, which a model read well and no other command could take in, and
then JSON as the services handed it, which composed and flooded: «то
данные, а не представление .. представление это отфильтрованные как-то
данные» (maintainer, 2026-10-08 22:41, session 22b934f8). The interface
is at once the means of focus and the means of action, and the focus
is spent in two places. The arguments of a host's verb choose what the
host computes at all, since a workspace of the size of Eclipse's
cannot be produced whole and cut down afterwards; that price is paid
at the host. The pipeline cuts what arrived, a literal, to any depth.
A command has one output, a value under its tag, and the kinds of its
refusals; its input is the part of the question that moves into the
host, which is why the input asks for a description of its own and the
output for a legend [D162].

What a reader holds after a call is a printed value, however strange
it looks, and its explanation starts there. The tag on it is a label,
and the label leads to the payload's legend: what was received, what
each part means, and which verbs carry the value on, the fates open to
it, read progressively, each step a literal of the language: «легенда
она прежде всего от printValue -- а уже там в легенде подсказки и
рассказы как извлечь что-то б0льшее или часть из неё» (maintainer,
2026-10-08 23:30, session 22b934f8). The dark room of `::workflow |
status`, a build or a test run, is the pattern: the reader asks whether
it succeeded and, if not, what failed, and never meets the whole log.
A reader that met a tag in a printed value peeks into its label with
no value to annotate, and the peek is assembled in one round trip from
the definitions under the label's address; the legend of a value is a
task of its own, one of the two resting on what the other provides
[D168]. A tool that changes carries its legend inside itself, where it
cannot go stale behind the tool's back [D161], [D162]. The same holds for the
seed of a session, the instruction file, which is a table of contents
of what the repository does not hold and no summary of what it does
[D163].

The sister project's code is no measure of what the language needs. It
was written under the scars this document names, so a construct it never
uses may be one it could not use: «jdt живет на старом коде, с
разочарованиями от qlang , с непониманием.. с конфликтами имен и т.д. ..»
(maintainer, 2026-09-19 09:28, session ad12f85d). Nor does its use argue
for a construct: «что делает jdt - не так важно, это не повод для
оптимизаций . уже не раз говорилось» (maintainer, 2026-09-22 05:34,
session 0ea77851). Need is measured by tasks and by the pain a session
meets.

That gives the project a single measure of quality. A fresh session,
having read only what the language says about itself, writes a correct
query on the first attempt. Everything else in this document is a
consequence of taking that measure seriously: every construct is judged
by whether it makes that first attempt more likely, and every document
by whether it is something the language could have said about itself.
Round trips and the token bill of a whole task are how the measure is
counted.

The same contract serves the work on qlang itself. A session that
develops the language starts, like any session, from amnesia and a
seed text, and the maintainer spent more than half of each
collaboration re-establishing context by hand: «больше половины времени
у меня в общении с моделями уходит просто на то что бы их качественно
забустрапить первичным контекстом, я устал повторяться» (maintainer,
2026-09-23 03:09, session 86982eb5). A document read at the start is
data that goes stale, and a model asked to read it can claim it did.
The environment of the work is therefore a domain like any other: its
state is computed and delivered by a command, in the language's own
literal, under the language's own contract of progressive disclosure.
That design is the subject of `docs/qlang-entrypoint.md`; here it
matters because it makes the development of qlang the first real
consumer of qlang's front door, and gives the benchmark a domain with
real tasks.

## What a satisfactory state looks like

The project is in a satisfactory state when seven things hold at once.
When two of them conflict, the earlier in this list wins; the sixth
competes with none, and the seventh yields only to a branch that
introduces a model [D28].

First, every feature is an instance of one core concept. The core is
small: a state pair of value and environment, a step that maps one
state to the next, a handful of combinators, the fork rule for nested
expressions, subject-first application, a literal as a step, naming
with lexical scope, the error as a value with a trail, a tag that names
the kind of a value, and a catalog that describes itself. A construct
that needs another mechanism to be explained is not in the language;
it is a scar.

Second, self-description is complete. A session that reads only the
language's own first screen and then asks the language for what it
needs solves a benchmark of realistic JSON tasks at the first attempt,
within a token budget. No markdown document restates what the catalog
already says.

Third, every fact has one spelling. A fact is written where it is used
and derived everywhere else. There is no test whose job is to keep two
spellings of the same fact in agreement, because there are no two
spellings.

Fourth, the consumers run. There are several: the sister project, which
queries a code graph through qlang; the documentation site with its
playground; the language server; the editor extension; and the
entrypoint of the work on qlang itself. Each builds against the
workspace copy of the core, each reads what it needs from the catalog
rather than from prose typed by hand, and none carries a spelling of
the language of its own.

Fifth, the grammar is proportional to the language. Comments are
trivia; the grammar that handles them fits in a few lines.

Sixth, the goal itself is written down, lives in the repository, and
every session begins from it. This document is where it lives, and the
other conditions are reachable because this one holds.

Seventh, the revision as a whole deletes more than it adds. Measured
against the baseline of the version at hand, commit `2147bab` for this
one, the diff of the work ahead is negative in the core sources, in the
documents, and in the tests; the September 2026 master, commit
`f5e8ec8`, stays the origin the history measures from. The catalog
stands outside that count, since a language grows its catalog by the
commands a task asks for, each under the rule of the catalog [D22], and
by the pages that tell them, and so do this document and the
entrypoint document, which are the measure, not what is measured. A
growth of the core or of its tests is what the condition watches: it
comes from a crooked part of the language, an old scar, or a concept
that does not compose with the rest [D151]. A branch that
claims to remove noise and lands with a positive diff has moved noise,
not removed it.

## The principles we hold the code to

The scars in this audit were found by holding the tree against a short
set of principles, and the same principles judge every branch that
follows. They are stated once, here.

One model. Everything the language does is a step over the state pair
and a combinator between steps. A construction that needs another
mechanism to be explained does not enter.

Everything is a value. Code, documentation, an error, the environment,
and the description of an operand are values of the language; each has
a literal that prints and reads back. What has no literal does not
reach the pipeline value.

The language describes itself. The only description of an operand is
its declaration in the catalog. Documentation is read out of the
language, examples execute, an error leads to its document. Prose that
retells the catalog is either generated from it or deleted.

One fact, one spelling. A fact is recorded where it is used and derived
everywhere else. A test that guards the agreement of two spellings is a
symptom, not a safeguard.

Executable over narrated. A fact that a command can compute is
computed where it is shown and never copied into prose; Nelson called
the move transclusion, and it is the only cure for documents that
drift from the thing they describe. A requirement that a case can
state is a case that fails until it holds. What stays prose is what no
command computes: intentions, reasons, and the order of work.

Composition multiplies. A primitive enters if it expresses what was
inexpressible or shortens what exists. What can be written as the
composition of two existing constructs does not become a primitive.
The catalog grows by names, not by verbs: few verbs working over many
addressable nouns, tags, keys and namespaces, the way Plan 9 put every
resource behind the same handful of file operations.

Words carry paradigms. The vocabulary of the language and of its
documents is chosen for the habits it wakes in the reader, and the
reader is a model trained on every other language. A tag names a kind
because a class would wake inheritance and methods inside objects; a
step is a command because a function call wakes lambdas and a standard
library to complete. A word is kept only where the habit it wakes is
the right one.

Borrow concepts, not formats. The history of interfaces has solved
most of what qlang needs, and the lessons are taken: levels of help,
the procedure behind an alert, typed link relations, ownership of
names. Their formats are not taken, because a format drags its whole
history along; «воровать чужие форматы это тоже как бы тянуть за собой
все их проблемы недостатки и легаси» (maintainer, 2026-09-23 06:40,
session 86982eb5). Everything the language says is said in its own
literal. A foreign format appears only at the host boundary, where the
foreign tools live.

The order of concepts is the order of dependencies. A concept is
introduced before anything that rests on it, in the text and in the
implementation. When a later concept turns out to be more fundamental
than an earlier one, the earlier one is rebuilt on top of it.

The host boundary. The needs of a terminal, an IDE, an observability
backend, and byte-exact JSON live beyond the embedding boundary and do
not shape the semantics of the core.

The sign of the diff. There is no compatibility to preserve before the
first stable release. A change answers the question "what became
shorter"; a replacement is radical and lands in every consumer at once.
The sign by area, which the history answers, is read over a piece of
work against what it delivered: less code at the same behaviour is a
refactoring, less with a new feature the work to praise, as much with a
feature good work, and more with features asks what they are worth to
qlang [D208].

The hierarchy of texts. This audit and its principles come first, then
the catalog and the conformance cases, which are the reference of the
language [D128], then the tools, then the process. A lower text does not contradict a
higher one; when they conflict, the lower one changes. Process does not
introduce entities into the language.

Prose names the invariant, and the reason lives with the decision. A
comment in code states what holds, in one sentence. Why it holds, and
why the alternatives were set aside, is a decision and belongs in its
record. A comment that explains why a compromise is acceptable means
the decision is missing, and the compromise should be removed rather
than described. Doubt that has no home in a decision leaks into the
code as justification; giving it the home is what lets the code stay
clean.

Sources, not confidence. Every load-bearing sentence of a document
carries the handle by which it can be re-verified: a probe, an anchor,
the maintainer's words, or the inference it was drawn from. A model
cannot serialize its confidence honestly, but it can always name its
source, and the source is what tells the reader how far to trust the
sentence and how to check it.

## The core that stays

Holding the tree against those principles confirms the core rather than
shaking it. The evaluator threads a frozen pair of value and environment
through steps, and every step returns a fresh pair; the only bookkeeping
beyond the pair is a depth counter that stops runaway recursion. The `|`
combinator applies a step and deflects on an error, recording the
skipped step on the error's trail, and `!|` is the only combinator that
fires on an error, which `|` steps around [D51]; a step run on each
element is the word `map`, whose code is a quote, and the first error an
element answers is its answer [D116]. Parentheses, vectors, maps, sets, and error literals all obey one
fork rule: the inner pipeline starts from the outer state and returns
only its value, which is where every scoping rule of the page of the
pipeline comes from. A literal is a step that replaces the value, and the values it
builds fork against the outer value, which is what makes reshaping a
matter of writing the shape you want. Projection walks a path with
strict misses. Application is subject-first.

A literal reads by its spelling alone: a bare word is a name, a string
is quoted, a keyword carries its colon, and nothing is typed by its
appearance, the normalization of pasted JSON included. YAML 1.1 read
the country code of Norway, `NO`, as `false`, because it guessed the
type of a bare word; the Norway problem is the standard warning
against resolving untyped text by its look.

Naming is lexical: a binding sees itself and everything declared before
it, and recursion through the pipeline value is correct. An error at
rest is a value with a tag and a descriptor, its literal the bang,
`!{…}`, and raised by `raise` it is a failure, which lives in the pipe
alone and which `!|` alone catches, and a host prints a failure as its
error at rest under a line that says it was raised; its trail is the
path it flew, a stop at every step that raised it or handed it on, and
the steps its last stop skipped, applied to a fresh subject, replay them
[D13]. A
quote is code as a value, a doc is prose as a value, and a tag names the
kind of a value and is stamped on it without changing its shape. The
catalog is qlang source: every verb is a binding with its page and its
laws, the axes pass from a name to its projections, `doc` its page,
`source` its code and `binding` its record,
`manifest` enumerates what exists, and `runLaws` runs the laws
declared under the name any value reads as tests, each with the claim
its page states [D178].

Three of these are in the core for reasons the mechanisms do not show.
The fail track is there because a session that is learning a tool fails
often, and a failure is the moment when the relevant knowledge is
cheapest to deliver: the error travels as data so that whatever stands
after it, a step of the query, the host's renderer, a separate utility,
can enrich it with the document, the example and the names that were
near. A doc and a quote are values so that an answer can be a page, data
with prose and runnable snippets in one immutable value that still fits
the next step; a doc is markdown in essence, carrying quotes of qlang
the way a markdown page carries a snippet of any language. And a literal
is the format in which values travel between utilities as well as the
way they print, which is why everything, code included, reads back as
what it was.

The tag deserves a paragraph of its own, because the project avoided
the vocabulary of objects on purpose and the choice turns out to carry
weight [D20]. A tag is the name of an interpretation: it says how to read
the value it stands on. Many values carry one tag; a tag stacks over
any payload, a string or a number included, and the stack reads from
the outside in; and the tag taken as a value, `::Kind`, is the kind
itself standing as a subject, which is why `::number/add/SubjectNotNumberError |
doc` can ask the kind for its page. Behaviour is kept out of the
value: the verbs that apply to a kind live in the catalog and are
found through the tag. That separation is what lets a value cross a
process boundary intact. A PowerShell object serialized for remoting
arrives on the other side as a bag of properties without its methods,
because its behaviour lived in the object; a qlang literal read in
another process goes back through its tag's constructor, the invariant
is checked again, and the verbs are found again, because they never
travelled. The nearest relative is the tagged element of EDN, the data
notation of Clojure, where `#myapp/Person {…}` names the interpretation
of the next element and a reader registers a handler per tag; the
difference is that in Clojure the tag is an instruction to the reader
and the value's identity at run time is a class of the JVM, while in
qlang the tag is the identity at run time, which is what the document,
the dispatch and the anchor of hypertext all hang on. A tag is markup
over its payload: what its declaration describes is the data beneath
it, its parts and what each of them means, so the page a reader
reaches through the tag answers what the data is, and the tag itself
is no subject a reader needs to learn [D161].

All of that stays. Each item is an instance of exactly one concept, and
removing it would leave something inexpressible. The audit is about
what grew around it.

## Hypertext: the cockpit and the cord

The contract between a session and a tool that embeds qlang has a
name, progressive disclosure: an overview first, then zoom and filter,
then details on demand [D21]. Seen from the session it has four
clauses. The session controls the detail of an answer. An answer stays
within the budget the session asks for, by `elide` in the query or by
the host's flag, and prints whole when nobody asked [D120], an error as
an alert whose markers say what the host left out [D7], and a part
gives way only to a marker that prints shorter than it, so a budget
never lengthens an answer [D217]. When the
answer would have exceeded the budget, it says what was left out and
how much of it there is. And the session can read what was left out,
all of it or a part, through the same pipeline that produced the
answer. Work begins with one start
command that returns the base of the language under the same contract,
so reading the guide is already practice in the protocol.

The maintainer's own picture of it is a cockpit. «в самолете у боинга
есть бортовой компьютер и чеклисты всякие, кнопок.. и пилоты сморят в
один интерфейс […] интерфейс один, фактически железный и неизменяемый -
но тот кто перед ним сидит в состоянии понять каким должен быть
следующий шаг и что от него требуется» (maintainer, 2026-09-23 04:17,
session 86982eb5). And the reason for hypertext follows from it: «если
мы будем давать агенту читать всё что есть в кабине просто что б он
имел представление об этом, то никакого контекста на это не хватит»
(maintainer, 2026-09-23 04:35). The reliability of a cockpit does not
rest on the pilot's attention; it rests on an interface that knows what
normal is and measures for itself, so that judgement is spent only
where judgement is needed. Aviation and the terminals of the paper age
worked out the rules long ago, because output was expensive then as
tokens are now, and the rules carry over:

- The dark cockpit: when everything is normal the panel is silent, and
  an answer, a dashboard or an error shows what deviates and nothing
  else, as the Unix rule of silence says.
- One procedure per alert: VMS's `HELP/MESSAGE IDENT` and IBM's manuals
  of messages gave each identifier a page of what it means and what the
  user does; the tag of an error is the identifier, its facts are the
  descriptor, and the page behind the tag is the procedure.
- Levels: ISPF showed a short message, the long one a key away and the
  tutorial behind it, and the reader chooses how far to follow the cord.
- Every observation offers its next actions, as `git status` ends with
  the command that moves each file on.
- Every handle says what is behind it and how heavy it is, as `ls -l`
  shows a size before `cat`; a link whose weight is unknown is opened
  blind, which is how a session once pulled a page of sixty-five
  kilobytes to learn one count.
- Position, remainder and completeness are stated: an answer that left
  something out says how much, in the units the steps that read the
  rest count in.
- A fragment identifies itself, as a line printer repeated the job and
  the page on every sheet, so a piece of an answer that survives
  compaction says where it came from and how to get the rest.
- The cheap path is declared, and a cut the reader did not ask for is a
  surprise, so the budget is a request the reader makes and the marker
  of what it left out says how to read the rest [D120].
- Help comes from declared grammar: TOPS-20 answered `?` anywhere in a
  command with what was expected there, because every program declared
  its syntax to one parser. The declarations of the catalog are that
  grammar, and the help follows from them: after a value, the verbs
  that accept it; inside a command, the next part; after an unknown
  name, the nearest known ones.

The labour divides cleanly. The language computes the exact value of a
query, whatever its size, and leaves nothing out; a literal can always
evaluate to a sheet. Containing it is the host's act at the end of the
pipe. Values are immutable, and any part of a value can be replaced by
any other value, so the host replaces what does not fit with an elision
marker, a value under the `::elision` tag whose payload carries the size
of what it stands for and the query that reads it, and whatever else
helps [D21]. The elided answer is still a well-formed literal and still
fits the next utility. On 24 September 2026:

```qlang
> [{:fqn "a"} {:fqn "b"} ::elision{:size 808 :read ~(drop 2 | take 20)}]
[{:fqn "a"} {:fqn "b"} ::elision{:size 808 :read ~(drop 2 | take 20)}]
```

Enrichment is an act of the same kind. The host's renderer sees that a
value, or an error, carries tags the session has not met, and loads
their pages into the answer while the budget allows, first those of the
tags, then whatever their links lead to; the vocabulary of the value
drives it, links recognized rather than written, as Plan 9's plumber
recognized them, and once per session, as a game's codex opens an
entry the first time the player meets it.

A host learns what its reader wants by the reader's declaration rather
than by sniffing, as HTTP's `Accept`, `Range`, `If-None-Match` and
`Prefer` replaced the guess of `isatty`: the form, the piece, what the
reader already holds and the detail are the four parameters of the
contract, sniffing only a default. A model is a reader of its own kind,
and Claude Code already tells a command that a model is reading and in
which session, so a host can keep its enrichment once per session by
itself. On 23 September 2026:

```sh
$ env | grep -E '^CLAUDECODE|^CLAUDE_CODE_(ENTRYPOINT|SESSION_ID)'
CLAUDE_CODE_SESSION_ID=86982eb5-b2cf-436c-9285-96a0669d39e5
CLAUDECODE=1
CLAUDE_CODE_ENTRYPOINT=cli
```

What the language owes the host for all this is short. A tag goes over
any payload without a declaration and prints faithfully, and the
pipeline is the cursor: the part of an answer that was left out is the
same query with a tail, which works where every part of a value has a
size, an address and a slice, as a vector, a set, a map, a value under
a tag and an error do, and a string by its characters [D132] and its
lines:

```qlang
> [10 20 30 40 50] | drop 2 | take 2
[30 40]

> "hello world" | count
11

> "hello world" | drop 6
world

> "a\nb\nc\nd" | split "\n" | drop 1 | take 2 | join "\n"
b
c
```

A quote has all three, being the vector of its steps [D8], and a doc
answers its parts by its `segments`, the vector of its prose and its
quotes [D19]:

```qlang
> ~(add 1 | mul 2) | take 1
~(add 1)

> |~~ a ~(add 1) b ~~| | segments | count
3
```

The pageable shape is the vector, and a value that can overflow breaks
into one, as the quote and the doc have, and a string does through its
lines.

Next, every tag inside a value is an anchor that resolves to its page,
and a keyword is a value that names nothing [D221], so the keyword of a
field leads nowhere and one keyword means different things in
different records; a record that is to be enriched therefore carries a
tag, which documents its fields, and a value shared by several kinds of
record a tag of its own [D50]. The shape of an answer
is read the same way, before the answer is fetched: the result of a
word is the label its `answer` names, `:number/add/answer ::number`,
and the definitions under that label say what its values hold [D169],
[D180]. Last, everything prints as what it is, code included,
because an elided and enriched page travels on.

The pages themselves are values of the same kind. The names are a space
of addresses, and a verb passes from an address into one of its
projections: `doc` into its page, `source` into its code, `binding`
into its record [D5], [D119]. A keyword after
`doc` is an anchor within the page, a vector of keywords a path and a
set of them several pages at once. A page holds prose and quotes, and a
quote takes its role from the tags over it: under `::link` it names a
page and `open` reaches it, the jump from one page to another
[D108], [D121], [D175]; under `::snippet` it is a query a reader runs to
see what it shows [D122]; with none it is code the prose holds. The laws
that prove a name stand under it, each a definition of `::law~(…)` that
`runLaws` holds to answer true, its page the claim it proves [D123],
[D124]; `laws` answers each as the pair of its page and its
query, and `tutorial` a name's page and its laws, the pair a reader
learns the name from [D176], [D177]:

```qlang
> ::vec/take | tutorial | [(/0 | type) (/1 | keys | count | gt 0)]
[::doc true]
```

So the first page leads to every other in one query:

```qlang
> ::qlang | doc | links | map ~open | every ~(type | eq ::doc)
true

> ::qlang | doc #[:pipeline :errors] | count
2
```

## How the project got here

The core landed in three days in early April 2026, carried over from a
specification written inside the sister project, and the next ten days
added what the consumer asked for in that order: comments that behave
as steps, effect markers, control flow, the error as a value, named
pipelines, modules, a language server, the catalog and a command line.
The hypertext ideas, quote, doc, tags, the axes and executable examples,
arrived in May, a month after the grammar had frozen around comments,
the `as` operand and effect markers; September brought a numeric model,
a depth budget and a single declaration site for each error.

Neither the maintainer nor the model wanted the tree that resulted, and
its causes are what the process has to remove, not only their products.
The goal was never written down, so an experiment was judged by whether
it worked and was layered rather than closed. Process substituted for
design: review rules demanding prose in every comment and a class for
every throw site, a coverage threshold demanding a test for every
branch, each reasonable on a finished thing and damaging on a thing
still designed, since it turns a design decision into a rule the design
can no longer revisit. Features arrived in the order they were needed
rather than the order they rest on each other: the quote after named
pipelines had chosen how to pass arguments, the doc after comments had
become the way to attach prose, tags after JSON containers had become a
second type. And every fix added a guard rather than removing a cause,
a drift test for two spellings of a fact, a wrapper unwrapped at every
reader, a dynamic import for a cycle and a comment to explain the
import, each surgery treating the one before it.

The model that wrote the code, working under compaction and under those
rules, produced justification instead of deletion: a change it was
unsure of felt safer with a comment, so the doubt moved into the code
and stayed there; it repaired where it looked while the cause lived in
another file; and its report that it had read what it was told cannot
be checked from the report. The maintainer met every one of these: the
model «не раз меня обманывала говоря что выполнила бустрап, а сама
вместо этого и половины нужных файлов не прочитала», and without the
facts «та начинает гадать, или галюцинировать или превращается в
секретаря-писаря вместо напарника по интеллектуально работе»
(maintainer, 2026-09-23 03:09, session 86982eb5). The remedies are
structural: doubt goes into a decision recorded here, never into code;
a branch starts from the full set of places where a cause shows and
removes the cause; and what a session must have read, run or checked is
measured by the environment from the transcript and the tree, which
belongs to the entrypoint.

The repairs since have settled most of what grew around the core. Code
is the vector of its steps, every step a command. There is one binding
form, a name is declared once in a scope, and a verb is a name under the
label of its subject, a host's primitive or a quote, the parts of its
args names under its address with their laws, its args the values a call
gives under its tag, which read back as they print [D164], [D166],
[D167], [D168], [D173]. A name is read by its tag, and a keyword is data
that names nothing [D221]; a word of the root reads the nouns of the
root as the root holds them, and a kind a reader declared as the reader
wrote it, while what a word reads and runs as data, a page, a
law, code held as data, it reads in the tree of the query that called
it, as a word of the host does [D200]; a value takes any name, and a
step where it meets a word its subject answers is refused [D223], a fold
calling its word by its name or its address [D224], and a declaration
writes a name a step can call [D245]. Two values of a key
that file under one keyword meet in `groupBy` and `indexBy` and are
refused [D228], and an invariant holds of the values of a label, so one
a bare name declares is refused where it stands [D229]; the body of a
word runs in the scope its call opens with `args` and each part, and a
step of the body declares none of them again [D71]. A comment is
whitespace, and so is a line break wherever it stands, a combinator
joining two steps and whitespace a declaration as well [D243], and a
doc is the literal in the slot of the declaration it documents. A value turns into another
kind by a word of its own kind named for the kind it answers,
`"42" | toNumber`, `1 | toKeyword`, and nothing converts where no such
word is written [D244]. A pattern of text is a value of its own,
`#"\d+ms"`, written as the engine reads it, which the words of a string
read text by, `match`, `capture`, `scan`, `replace`, `split` and
`contains` [D246]. One order ranks every value, the set is the ordered vector
under its tag, every value has a kind, and every condition is a boolean.
A refusal is named by the address of the word that refused, its facts
definitions of the catalog [D46], and a name no word answers is met
with the names near it, by its spelling and by the links of the page of
the word it begins with, `addOf` with `sumOf` [D242], and a word the kind
of its subject lacks with the words its pages lead to that the subject
answers, `print` for the `toString` of a vector [D247]. The literal is the one lossless
format [D30], the catalog is the reference of the language [D128], and
its first page tells the language whole, in the order its parts rest on
each other, the argument model one rule [D185]; the forms a clean
session reached for and missed became the language's where they composed
with it [D132], [D133], [D138], [D140]. The benchmark measures the pages
a child lands on, those of the language and of the command line, on
sets of tasks a clean author writes and no one has read, each
measurement read beside the one before it [D26]. The command line
writes every answer on stdout with the code 0, a failure among them, a
query that does not parse and an input that does not read among those, a
defect of the runtime alone stopping the calls beside it [D7]. What
those repairs left is what the scars below describe.

## The scars

The rest of the audit walks the scars in the order in which their
repairs depend on each other. Each section states the problem, shows it
running, and names what its repair must achieve; the decisions that fix
the direction are cited by number. Every probe can be reproduced from a
shell with the `qlang` command or in its REPL, and on 12 October 2026
every probe of this chapter answered as its block records.

### Refusals a host builds from the runtime

A host declares its refusals by their addresses with `declareRefusal`,
imported through the `errors` subpath of the core
(`cli/src/streams.mjs`), and declares their facts under their
labels in its catalog [D46], so the declaration stays an interface of
the runtime a host builds on. The sister project imports none of them,
and carries two copies of `fromPlain` of its own, each named
`jsonToQlang` (`cli/lib/jdt/coverage.impl.mjs`,
`cli/lib/jdt/graph.impl.mjs`).

The repair must make the refusals of a host kinds its catalog declares,
so that nothing of the runtime is exported for building operands [D46].

### Names in one root

A source of the root is a cell whose declarations stand in the root as
a cell's stand in a session [D153]: what it declares bare is a name of
every reader's scope, and what it declares with a path a node under a
noun, so the verbs of the core, the command line's and the sister
project's live under the kinds of their subjects and none lands among a
client's own names [D72], [D80]. A kind a source declares bare reaches
every reader the same way, and the sister project's kinds, `JdtType`
and its kin, and its refusals stand bare in the root.

And names collide, which the maintainer has named as the one worry the
design never resolved: «стремительно растущий зоопарк операндов меня
все время беспокоил и конфликты имен .. последнее так и осталось
неразрешенным до сих пор» (maintainer, 2026-09-23 07:02, session
86982eb5). The rule is decided [D34], [D153], [D200], [D223],
and a host still publishes names without a prefix. The sister project's names would
meet the core's on `type` and on `source`, which it names `typeNamed`
and `sourceText` until it declares them under kinds of its own [D2],
and its graph alone declares under `::any` the words a query calls,
lookups by kind of element, accessors of the containing element,
enumerations by scope and the relations among them, and beside them the
helpers of `problems`, since a word under a topic serves the topic's
values alone [D166]. In the sister project, on 12 October 2026:

```sh
$ grep -oE '^:any/[A-Za-z]+' cli/lib/jdt/graph.qlang | sort -u | wc -l
59
```

That is the `ioctl` of Unix, every new capability a new verb in one
shared space, where Plan 9 kept the verbs fixed and let the nouns grow;
a host's catalog should grow the same way.

What remains of the rule of collisions are intentions, questions of
this document and no decisions [D226], the surface and the loading
[D153], the reading of a name [D221], the rule of the owner [D200] and
the meeting of a value and a word [D223] settled:

- A verb and a kind may be joined by whoever owns one of them, the
  orphan rule of Rust: a host may specialize a core verb on its own tags
  and declare its own verbs, but may not redefine a core verb on the
  core's kinds. So `source` on the sister project's node tags resolves
  by the subject, while its `type`, the reader of identity every error
  handler and sort relies on, moves into a field or a tag.
- Names without a prefix belong to the core, as EDN reserves its
  unprefixed tags; JavaScript learnt the cost when
  `Array.prototype.flatten` could not ship because a library had put
  another `flatten` there, and a shared space hosts write into freezes
  the core out of its own names.
- One query shows every definition of a name and which one wins, as
  `type -a` does in bash. Two queries show it: a subject reads the word
  a name reaches for it by `binding`, and the refusal of a subject no
  word of the name serves lists the addresses where its words live.

```qlang
> [1 2] | binding :count | /name
:vec/count

> 5 | binding :count !| /addresses
#[::map/count ::set/count ::string/count ::vec/count]
```

Namespaces too large to bind are the sister project's types, tens of
thousands of names, which it reaches by lookups it declares under
`::any`; serving them as tags is an intention, the question of mounting
in the chapter of open questions.

### Errors named by their site

A refusal is named by the address of what refused: a subject of
another kind under the word, a part that breaks an invariant under the
invariant, whose name is the refusal, a primitive's refusal of a part's
value or of an element of it under the part, and a primitive's refusal
of its run under the word that ran it, which lists it among its names;
a number is whole where it equals its floor, `eq (floor)`, the law of
every count and of the digits of `round` [D218]. The facts an error carries
are definitions under the label of the refusal and under `::error`, held
in the order they are declared, the trail last, and a fact neither
declares is a defect of the runtime [D46], [D166], [D169]:

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add "x" !| [type /actualType]
[::number/add/addend/NotNumberError ::string]

> [1 "x"] | sum !| [type /index]
[::vec/sum/ElementNotNumberError 1]

> 2.5 | round 0.5 !| type
::number/round/digits/NotIntegerError

> ::vec/sum | manifest
#[::vec/sum/ElementNotNumberError ::vec/sum/answer]

> "hello" | add 1 !| explain | page | content | contains "sumOf"
true
```

An error carries its whole input, and the path of an error carries the
subject of every level it left [D13], so the same failure one verb
deeper carries it twice:

```qlang
> ::vec | doc | add 1 !| /trail | map ~/subject | map ~(eq (::vec | doc))
[true]

> :any/g ~(add 1) | ::vec | doc | g !| /trail | map ~/subject | map ~(eq (::vec | doc))
[true true]
```

The host shows such an error as an alert, [D7], its tag and its
facts, the subject where it arose cut to an excerpt, and each subject
it passed an `::elision` whose `:read` continues the query beneath
`!|`, the error itself staying whole. Over the failing final queries
the runs of [D116] recorded on set T, the alerts print about a third of
what the errors printed whole, and the command line writes above an
alert the line that says it was raised [D13] and below it the prose of
its refusal's page as line comments, the repair a reader acts on
[D7]:

```sh
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\") !| print | count" < /dev/null
1336
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\")" < /dev/null | grep -v '^|~|' | wc -c
317
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\")" < /dev/null | grep '^|~|'
|~| raised, and no !| caught it
|~| The addend is a number; text that holds one is read by `toNumber`.
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\")" < /dev/null | grep -c ':read ~(!| /trail/1/subject)'
1
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\") !| /trail/1/subject | count" < /dev/null
300
```

And a refusal of the runtime is still a class of the JavaScript for
each address, which the runtime declares and a test holds against its
page [D46].

The repair must make the page behind each refusal a procedure: what the
refusal means in one sentence, which fact names the culprit, the usual
cause, how to recover with `!|` as a runnable example, and the refusals
it is often confused with, the text that refusals for one reason share
written once, which is the task that would ask for a hierarchy of tags.

### Self-description on two planes

Examples live on two planes, the conformance suite and the laws of the
catalog, with a runner for each; the catalog's own laws are the only
plane the language can reach, each named for the claim it proves and
paged with it [D123], [D124]. And a parse failure prints whole, every
token the parser could have read and the place it stopped, at its start
and at its end, where a failure of a step prints as an alert [D7]:

```sh
$ node cli/src/bin.mjs '::a.b' < /dev/null 2>&1 | grep -c ':offset'
2
```

The repair must reduce catalog prose to what the facts do not say,
written in the language's own vocabulary, with no name of a file, a
symbol, a service or a section of another document in it. It must make
examples live on one plane, and print a parse failure economically,
with the full value reachable by projection rather than dumped. It must
let a reader assemble from the definitions under an address the
description a question needs, in one round trip [D168], [D169].

### The documents that retold the catalog

The reference and the evaluation-model document restated the catalog,
their REPL pairs true because a runner executed them and their prose
false in places because nothing did, the argument for executable over
narrated in the project's own text; the reference was «это не
спецификация, а скорее референс, туториал» (maintainer, 2026-09-23
00:47, session 86982eb5). Both left the tree with their runner [D128],
and what they said that the catalog did not stands as laws of its names,
the concepts on the pages of `::qlang` in the order they rest on each
other; the embedding API is the page of the package, `core/README.md`.
The documents left are the measure, the decisions, the research of a
design whose work has begun, which its records absorb as the work lands
[D164], the audits of a clean outside reader of the tree and the
reviews of the catalog, each kept as its writer wrote it beside the
fate of each finding:

```sh
$ git ls-files --error-unmatch 'docs/*.md' | grep -v decisions | sed -E 's#^(docs/research/[^/]+)/.*#\1/#' | sort -u
docs/qlang-audit.md
docs/qlang-entrypoint.md
docs/research/legend/
docs/research/outside-audit/
docs/research/reviews/
```

What remains of the scar is the editor's hand-written TextMate grammar,
a second spelling of the grammar beside the parser.

### Host concerns inside the core

A raw-mode line editor and its tests are the largest single piece of
the command-line workspace, and the REPL it serves cannot save a
session, which is to save as the source of its declarations [D30]. The noun of a project's
`.qlang/` folder waits for the sources a project ships [D37]. The sister project
onboards its user with a guide written by hand, which reads from its
catalog the first sentence of the page of each word it shows first.

The effect marker left the language [D2]: no name begins with
`@`, and a word of a host is named as any word is, under the rule of
collisions [D200], [D223]. A host whose word reads an index or throws
dice marks the provenance of the value it returns with a tag, and a tag
can describe an effect as well, a write the host is to perform, which
an explicit step at the host boundary performs and nothing else, as the
lesson of YAML's `load` taught: a tag's constructor is pure, and reading
or constructing a literal performs nothing. The sister project names
its two words that would meet `::any/type` and `::any/source`, which the
root holds once, `typeNamed` and `sourceText`, until it declares them
under kinds of its own [D153], the walk of a subject's tags selecting
them [D34]. Whether an
effect deserves to become a value of its own, an action awaiting the
host the way a quote awaits `apply`, is a question for a later branch
that would have to show a task no plainer construct solves. The repair
must give the sister project a guide generated from the catalog.

### Code that explains itself

The code is more commentary than design. The ratio of comment lines to
code lines over the JavaScript of the core, the command line and the
language server, in the tree and then in the September master:

```sh
$ git ls-files --error-unmatch 'core/src/*.mjs' 'cli/src/*.mjs' 'lsp/src/*.mjs' | xargs cat | awk '/^[ \t]*\/\// {c++; next} /^[ \t]*$/ {next} {k++} END {printf "%.1f\n", c / k}'
0.3
$ git ls-tree -r --name-only f5e8ec8 | grep -E '^(core|cli|lsp)/src/.*\.mjs$' | sed 's#^#f5e8ec8:#' | xargs git show | awk '/^[ \t]*\/\// {c++; next} /^[ \t]*$/ {next} {k++} END {printf "%.1f\n", c / k}'
0.6
```

[D30] asks the ratio to fall, and it has begun to fall from the September
master.

No module of the core carries more comment than code:

```sh
$ git ls-files --error-unmatch 'core/src/*.mjs' | xargs awk 'FNR==1 && f {if (c>k) print f; c=0; k=0} {f=FILENAME} /^[ \t]*\/\//{c++; next} /^[ \t]*$/{next} {k++} END{if (c>k) print f}' | wc -l
0
```

The rest of the scar is an embedding surface that was never designed.
The package's entry point exports what the command line, the language
server, the site and the sister project read, and no name besides;
among them is still the Symbol slot of the headers, and the package
exposes a subpath for the declaration of a refusal, which is what hosts
build on:

```sh
$ node --input-type=module -e "const core = await import('./core/src/index.mjs'); console.log(Object.keys(core).filter(name => /SYMBOL|SLOT|PREFIX|KEY/.test(name)).join(' '))"
TAG_HEADER_SYMBOL
$ node -p "Object.keys(require('./core/package.json').exports).filter(path => /error/.test(path)).join(' ')"
./errors
```

The repair is a property of every branch [D30]. A branch leaves every
file it touches with comments that state what holds in one sentence,
moves every reason it finds in a comment into the record of the
decision it belongs to or deletes it with the compromise it excuses,
and replaces every false comment with nothing. A session saves as the
source of its declarations, since a source prints as it is written. The
embedding surface is designed with the argument model: a session, a
source as `{ uri, source, impls }`, the parser, the printer and the
JSON codec, and nothing of the runtime's internals; the unused session
surface goes, and the consumers read the catalog's declarations and the
parser's tree and keep no rule of their own. The ratio of comment lines
to code lines is measured on every branch against the baseline and
falls.

### A process that grows text

The review rules are written from the principles, each a principle and
the check that enforces it (`.claude/agents/qlang-review.md`), one of
them the distinct class at every throw site that [D46] replaces. The
coverage threshold of one hundred percent on every axis has
produced a test corpus heavier than the code it covers, and most of it
tests the mechanism rather than the language: almost every unit test
imports the internals it checks, so it dies with them, while the
conformance cases, each a query and the literal it must answer, state
what the language does and survive any rewrite of how. The drift tests
and the convention checks that hold a refusal's constant to its
address, a sibling's range to its version and a document's anchors to
the tree exist to guard duplicates.

The repair must replace the coverage number with a policy that keeps
the threshold for the language core and a no-number rule elsewhere;
must treat the
conformance cases as the requirements of the language and the unit
tests as scaffolding that goes with what it scaffolds; and must delete
each guard together with the duplicate it guards.

## Decisions

A decision is the discussion with its choice and its circumstances, and
each lives in a file of its own under `docs/decisions/`, true as a whole
while it is in force [D227];
a citation of its number in this document is a link to that file, and
the requirements it left are the conformance cases that name it [D58];
it cites a record in force or one waiting on its target [D225]. An
artifact names the decision it exists for, a mark covering the block it
stands on, so the scope of a record is every place that marks it; a
move of the baseline reads again the records whose blocks its diff
touched, records of one axis merge into the earliest of them, whose
number stays the address of the axis, and a case names the one record
whose rule it shows [D237].
How the records are sourced is the subject of the folder's
`README.md`.

## The finish

The finish is described twice, once as the language a session meets
and once as the tree a developer meets, because a branch has to be
checked against both: a repair can make the language right while
leaving the tree no smaller, and the seventh condition refuses that.

### The language a session meets

Seen together, the repairs describe one language, and three
unifications carry it.

One mechanism of value. A tag names the kind of a value and stands over
any payload; its declaration is its page, and the definitions under it
its constructor and its invariants [D168], [D169]; a value under a tag obeys the tag's invariant, checked
when the value is built and again after every transform whose
declaration keeps the tag, `within` editing under a tag and checking
once at the rewrap [D41]; every value comes apart into its atoms and a
shape and is built back from them [D42]. The set, the error, the quote,
the doc, a host's record and the elision marker are all this one thing:
`#[…]` spells the set, `!{…}` an error, `~(…)` code, `|~~ … ~~|` a doc
over its segments, and each keeps its own token in the editor while the
runtime holds one mechanism behind all four. Every value has a kind, and
a literal without a tag has one of the core's, which its brackets imply
[D32]; a kind carries the value's constructor, its order and its laws
[D16], [D169], while one rule of the core prints every literal.

One mechanism of operand. An operand is a name under the label of its
subject, the parts of its args names under its address with their
invariants, its answer the name `answer` under it, which names the
kinds it answers, and its doc its page, a story of what it answers, takes
and refuses, and the runtime executes the declaration [D164], [D169],
[D179], [D180]. A built-in, a host's operand and a
declared pipeline are called the same way, checked the same way,
documented the same way, and help for all of them, completion, the verbs
that accept a value, the next part, the refusal's wording, is derived
from the same record. A verb is found by walking the subject's tags from the outside
in, down to the core's kind [D34]; a host's verbs sit on the tags it
owns, and a verb and a kind are joined by whoever owns one of them. A
query reads, and what writes stays a command of its host whose result
the query reads [D39].

One format. The literal is how a value prints, how it reads back, how
it travels between utilities, how a session is saved, how an example
and a trail are written, and how a dashboard is delivered. JSON is the
lossy codec of the boundary and nothing else.

Around those three the language reads as follows. A pipeline carries
values, and a step is a command, a name and its modifiers as words, in
parentheses inside a modifier or a literal, so parentheses mean one
thing, a pipeline as one word. Every modifier holds a value read by its
own form; code is a quote, `~(…)`, `~add` for a single word, which
nothing but `apply` and a part whose invariant asks for a quote runs, and a
quote handed over sees the names of its author [D43]. There is one
binding form, `:name value`, evaluated once at declaration and named as
a value, a name declared once in a scope; a verb is a name under the
label of its subject whose value is a quote, the parts of its args and
its answer names under its address, and it runs when its name is
mentioned, as a built-in does [D5], [D164], [D169]. Comments are
whitespace; documentation is a doc literal in the binding's slot.

Maps and vectors are the only containers; JSON syntax is read,
normalized, and forgotten until the codec at the boundary writes it
back. A map's elements are its values and its keys are the shape that
travels with them; `entries` makes the keys data as the pairs `[key
value]`, and `toMap` builds a map back from them [D138], [D244], a
string naming a key wherever a key is taken [D139]:

```qlang
> {:auth {:port 3000} :db {:port 5432}} | entries | map ~(unionOf /1 {:name (/0 | toString)}) | sort ~(/port)
[{:port 3000 :name "auth"} {:port 5432 :name "db"}]
```

One order ranks every value, so anything sorts, and the set is the
vector in that order without duplicates. A predicate answers a boolean
or fails at its part. An error carries the address of what refused,
its facts the definitions under that label in the order a reader needs
them, and the tag leads to its procedure; a nested evaluation that
fails yields its error as a value, which every operand treats by one
rule.

A name is declared by its keyword, a name with a path a node under the
noun its path names, whose address its tag is, and a name under a label
resides on it, taking a subject the walk of its tags brings to the
label [D34], [D152], [D153], [D164]. The root is the scope a host's
sources declare as cells before a reader's first step, a source, a cell
and a query written alike. A name typed bare resolves
nearest first, the reader's declarations, then the verbs of its
subject, the root's names last, and a name with a path calls by address
[D34]; a tag in the subject position is dispatched to the noun
it names [D88]; a host sets up a query by its sources and the first
value of its pipe and nothing else [D37], [D153]. A value the reader
names takes any name, and a step that calls it on a subject a word of
the name answers is refused, the word called by its address there
[D223]:

```qlang
> :count 5 | [(7 | count) ([1 2] | count !| type) ([1 2] | vec/count)]
[5 ::call/ValueMeetsWordError 2]
```

A declaration writes into its scope the record of its binding, so the
axes are projections of the record [D5], each reading a name by its
tag, a label of the root from the root and any other name at its
nearest declaration, while a keyword is a value that names nothing,
`:limit | doc` the page of `::keyword` [D221]. Effect markers are
gone; a host that wants provenance visible tags the value, and an
effect described by a value is performed at the boundary and nowhere
else.

Fingerprints, terminal conveniences, the budget of an answer, its
elision and its enrichment belong to hosts; the language computes whole
values, every part of which has a size, an address and a slice, so what
a host left out is the same query with a tail. A record a host wants
explained carries a tag whose declaration documents its fields, and a
value shared across kinds a tag of its own [D50]. Code is the quote, a
vector of steps with an involution to and from its text, so a query
reads, transforms and assembles code without leaving the language.

The catalog is the documentation. A root doc is the first thing a
session reads: what the language is in a sentence, what a tag is in a
sentence, how to discover with `manifest`, `doc`, `source` and
`runLaws`, how to read an error, and a few seed pipelines that a grep
would not suggest. Every other question is answered at the point of
need, in views sized to a budget, the cheap view first. Examples live
in the catalog and run as its tests; the conformance suite keeps what a
quote cannot express. Every repair in this picture rebuilds an earlier
concept on the two that arrived last, quote and tag; that is why they
compose.

### The tree a developer meets

The core is a handful of modules, each of which knows one thing. The
names below are the model's reading of where the repairs lead, a map
for checking whether a branch converges, and the branches that build
them may name them otherwise.

- The grammar and `parse`: text to quote and quote to text, the
  involution. The grammar handles comments as whitespace in a few
  lines and has one pipeline production. The parser's tree, with
  positions and text, is a separate view for tools and never reaches a
  value.
- Values: the set of values, null, boolean, number, string, keyword,
  tag name, vector, map and tagged value; tags with their schemas and
  constructors; the one order; structural equality; the printer of the
  literal.
- The evaluator: the state pair, the fork, the combinators as
  attributes of steps, application by executing declarations, the law
  of nested errors, and one constructor of refusals.
- Names: the root, the scope a host's sources declare as cells, the
  core's, a host's and a repository's `.qlang/`; a name with a path as
  the address of a node under its noun; binding values with their
  origin; mounts for the namespaces too large to declare.
- The host interface: a session; a source as `{ uri, source, impls }`,
  the implementations plain functions over checked values; the parser, the
  printer and the JSON codec; the points where a host applies its
  budget, elision and enrichment.
- The catalog, in qlang: operands with declarations that are true
  because they are executed, the tag of every refusing site as a kind
  with its schema and its procedure, other tags with schemas, and the
  root doc. The implementations of the operands are plain functions
  beside it.
- The tool views: the walker of the parser's tree and the tokenizer
  for highlighting, derived from the grammar, for the language server,
  the site and the command line.

What leaves the tree, as the repairs land: a class of the JavaScript
for each refusal; the primitive registry with its sealing; the effect
marker and its checks; the character scanner of doc text; the
housekeeping keys of the environment; the error prose of the catalog
that restates the facts; the drift tests.

The documents at the finish are few. This audit and the entrypoint
document, which are the measure, and the records of the decisions; the
language says the rest of itself in its catalog, the concepts in the
order they rest on each other on the pages of `::qlang`.

The tests at the finish follow what they test. The catalog's examples
are the tests of the operands. The conformance cases, each a query and
the literal it must answer, are the requirements of the language, and
a case that confirms a decision names it. The round trip of printing
and parsing is a property test. Unit tests remain for what stays in
JavaScript, the parser, the printer, the loader and the evaluator's
seams, and for nothing that a query can state. The coverage threshold
applies to the core alone.

The consumers at the finish carry no language of their own. The
command line is a thin host: standard input lifted only when it
carries bytes, the default subject otherwise [D37], and read only for a
query that reads its subject, so a pipe left open never holds a query
that reads none [D215]; the answer written as its literal whatever the
input was, a string as its text, and converted by the query, `| json`
[D214]; the budget at the end of the pipe, and its renderings, `table`
among them, words of its own [D49]:

```sh
$ sleep 4 | timeout 2 node cli/src/bin.mjs '1 | add 1'
2
$ echo '{"name":"Ann"}' | node cli/src/bin.mjs 'type'
::map
```

The language server reads the declarations and the parser's tree and
nothing else. The editor's grammar is generated from the grammar's
tokens or reduced to what the language server cannot give. The site
renders the root doc and the catalog or is reduced to the playground.
The sister project builds on the workspace copy, generates its guide
from the catalog, tags its nodes, mounts its types and its workspaces
[D38], and speaks through about a dozen verbs on its own tags, its
writing commands staying commands [D39]. And the entrypoint of the work
on qlang is a consumer like the others, built on the language it helps
to build.

## The route

The start is the tree of the baseline, commit `2147bab`, and the finish
is the tree the previous chapter describes. Between them lie two
milestones, each a state of the language followed by a release [D29].
Under each the work is named in the order its parts rest on each other,
and the answers that show a milestone reached are the targets its
decisions leave in the conformance suite [D58]. The decisions whose
work has begun meet their targets, the last of them the effect marker
leaving the language [D2], so the suite carries no target unmet,
and every other decision below writes its targets before its work:

```sh
$ grep -rhoE '"target": *true' core/test/conformance | wc -l
0
```

### Milestone 4 · One spelling

Every fact has one spelling, and a kind owns what is said of its values.
The keystone is the declaration of a kind. A kind is a label, a name declared by its page, which
builds a value by the `construct` declared under it and checks it by
the laws declared under it, each named by its refusal [D168], [D169],
so a field of a record no law names is spelled nowhere a reader can
rely on before the record is fetched, which is the third requirement of
the mission:

```qlang
> :P |~~ A person. ~~| | ::P{:name 5}
::P{:name 5}

> :P |~~ A person. ~~| | :P/NameNotStringError ::holds~(/name | is ::string) | ::P{:name 5} !| type
::P/NameNotStringError
```

The schema is the label's [D164], [D166]: what stands under a kind is
the definitions under its address, each a name, its page and its value,
the value saying what the definition is, a word's code, a part's
selector, the label of a word's answer, a law under the name of its
refusal [D168], [D169]. `::spec~(…)` and `::verb~(…)` have left the
language: a reader's verb is a name under the label of its subject,
`:number/inc ~(add 1)`, and a kind of the core a label whose constructor
the host hands, `:number/construct ::builtin{}`:

```qlang
> [::spec ::verb] | map ~(doc !| type)
[::any/doc/UnknownNameError ::any/doc/UnknownNameError]
```

The refusals rest on the schema as well: a refusal is named by the
address of the word that refused, and its facts are definitions under
its label, values of the language [D46]:

```qlang
> 1 | add "x" !| entries | map ~first
[:actualType :actualValue :trail]
> 1 | add "x" !| /actualType
::string
```

What remains on the schema is elision taking the tail of a schema
[D21], a field being a definition under its label [D50]; what remains
of the names is a host's, which the sister project's redesign moves
onto its kinds, and the questions of mounting and of one query of every
definition of a name. Beside both, the examples come to live
on one plane, the editor's grammar is generated or reduced, and the
screen of the work, whose first version `npm run desk` prints [D226],
grows from the draft of the entrypoint document [D231].

Its answers are the targets of [D46], [D152], [D153], [D168] and [D169]
in the conformance suite, every one met, the step of a constructor apart
from the kind of tagged values having landed [D8]. Beside them: no
class of the JavaScript stands for a refusal; no operand contract is
spelled outside the catalog; and the environment holds no key of the
runtime's own.

The model's reading of what in this milestone the language needs, and
what is the debt of its tree. The schema is the language's, since
without it the shape of an answer cannot be known before it is fetched,
and a host has nowhere to say what its records hold. The rule of
collisions is the language's as soon as a host publishes a catalog of
its own, which the sister project does, and mounting is the language's
for a host whose names are too many to declare. A class of the
JavaScript for each refusal is the tree's debt alone, since a session
meets the tag and the facts.

### Milestone 5 · Front door

The measure can be taken as the mission states it. Its answers in the
conformance suite are the targets of [D2], [D7], [D46], [D107], [D108],
[D109], [D111], [D117], [D118], [D119], [D121], [D122], [D123], [D124],
[D125], [D129] and [D150]: the effect marker leaving the language,
and the first screen and the hypertext it opens, every one met. The
benchmark runs, each run recorded with the frictions it met, each
measurement on a set of tasks a clean author wrote, which measures once
and serves the work once its misses are read, its children running the
command line from the pages of the language and the command line [D26]. An error a host
prints is an alert, the subject where it arose an excerpt and each
subject it passed a marker [D7].

What remains of it: the catalog's prose is reduced to what the facts
do not say, every page telling what its name is for and the claims its
laws prove [D124], [D212], each
definition a story a reader falls into, the word, its answer, its
parts, its refusals and its laws in that order [D179]; enrichment
happens once per session; a value shared across kinds of record carries
a tag of its own, as a field is a definition under its label [D50]; and
the first screen, the pages
of the language and of the command line, told whole in the order
its parts rest on each other [D185], within the weight it had [D150],
is measured on a set of tasks no reader has seen [D26], [D131].

The largest part of the milestone is the sister project's. It builds
on the workspace copy, its suite passing against it, on a branch that
stands ahead of its remote since 29 September, and its redesign has not
begun: its nodes carry their kind as a tag, its verbs
move onto its tags and its noun [D34], the noun's own verbs
taking its name as their subject [D88], its types are mounted, its verbs
shrink to about a dozen, and its guide is generated from the catalog;
the effect marker leaves the language with them [D2], since
without it a host's names meet the core's in the root, which refuses a
second declaration of a name [D153]; its workspaces become nouns and its answers
name the workspace they came from [D38]; and a host's command is the
language's with its noun as the first value [D37].

The others stand beside the suite: one start command returns the root
doc; a renderer loads the pages of the tags an answer carries that the
session has not been shown, and withholds the ones it has; the
language has no effect marker and no effect flag.

After the fifth milestone the remaining surfaces follow: the site is
decided, rendering the root doc and the catalog or reduced to the
playground, and the coverage threshold applies to the language core
alone, with the other workspaces under a rule without a number.

### How a branch moves

A branch repairs one scar or one part of one and names the decisions it
implements. It starts from the full set of places where its cause
shows, found by search rather than by memory, and its first commits
delete; the cases that confirm it are written before its code, red, and
it ends when they are green and nothing else turned red. Its diff is
negative in the core sources, the documents and the tests it touches,
its catalog growing only by what the language gains [D151], or it
introduces a model and says what the next branch deletes because of
it, and the files it touches leave with comments that state what holds
in one sentence [D30]. A branch that works targets leaves the records,
the cases and the gates as it found them and drops only the mark of a
target it met [D59]. A design question that appears during a branch is
decided in this document before the branch goes on, since a decision
taken in code is a decision no one will find; what confuses a session
on the way is settled where it is met, fixed when the decisions already
choose the fix and otherwise recorded with its probe as a target, a
decision or a question [D89]. The sister project receives every
breaking change in the same move.

A session is one of three kinds. A design session talks, decides, and
updates this document. An implementation session takes one scar and
ends with its cases green. An audit session runs the probes and the
metrics, replaces every sentence the tree contradicts, and removes the
scars the tree no longer shows. Every session opens as the instruction
file says and closes by writing what was decided into this document and
its records, so that no decision survives only in a conversation.

The model's work on this document is validation. The maintainer said
so without ambiguity: «я не хочу КОДОГЕНЕРАТОРСТВО, Я НЕ ХОЧУ
АВТОДОПОЛЕНИЕ!! Я НЕ ХОЧУ САММАРИЗАЦИЮ!! МНЕ НУЖНА ВАЛИДАЦИЯ УЖЕ
НАПИСАННОГО! ПОИСКИ ПРОТИВОРЕЧИЙ! КОНФЛИКТОВ! ДЫР!! ПРОБЛЕМ!!!»
(maintainer, 2026-09-22 03:02, session 96f3df79). A session that finds
nothing to contradict has either not read the tree or not run the
probes.

When a claim about the language is in doubt, run it. When the intention
behind a construct is in doubt, ask the maintainer, and record the
answer here with its words; the repository records what was built, not
why.

## Open questions

What neither the tree nor the decisions answer, with the alternatives
and their cost.

The role of a definition read from the form of its value. An invariant
written `is ::k` serves its part to the body of the word as the value
of the kind beneath its tags, while one that computes the same truth
another way, or none, hands the part as it was given, as the body is
handed its subject; the place, the strictness and the default of a part
are read from its selector, `/n` or `at n d`; and the last names
`answer`, `subject` and `construct` are roles:

```qlang
> :any/m ~(x | type) | :any/m/x ~(/0) | :any/m/x/NotNumberError ::holds~(is ::number) | null | m ::Width(5)
::number

> :any/m ~(x | type) | :any/m/x ~(/0) | :any/m/x/NotNumberError ::holds~(is ::number | eq true) | null | m ::Width(5)
::Width

> :number/t ~(type) | ::Width(5) | t
::Width
```

The serving is what a host's primitive needs, the bare number it adds,
and it reaches the body of a reader's word as well. Handing that body
its parts as given, as its subject is handed, turns red the cases that
state the serving and the laws of `is` that ask each element of a part
and a set as a vector, and hands a part that reads the args whole the
args under the tag of the word, the model's measurement of 12 October
2026. All four outside audits name the second mechanism. The
alternatives: the role declared, a signature of a word in one
declaration that unfolds into the parts and invariants a word has, at
the cost of a form of the grammar and of the root's reading of it; a
role read from a form refused aloud where the form stops fitting it, a
cheaper repair of the traps that leaves the second mechanism; the
serving kept for a host's primitive alone, a move of the design whose
cases [D67] and [D167] name; or the forms as they stand. Open, the
layer of declarations.

A step that drops its subject. A step after `|` that reads nothing of
the value it is handed, a literal of no parts, a tag name, a quote, a
doc or a bare name that holds a value, replaces the value in silence,
and a reader who meant another step learns nothing from the answer; a
child of the benchmark put a vector under two tags so and met the
second tag alone (`scripts/benchmark/runs/R7.json`, friction F3):

```qlang
> [7 8] | ::Inner | ::Outer
::Outer
```

The maintainer put the idea of showing it, «можем какой-то
прокси-субьъект придумать скрытый.. если рантайм конечно в состоянии
вычислить тихую смену субъекта и для прокси субъекта будем печатать
новый субьъект с тривией что старый сменили и почему .. как с ошибками
неперехваченными», beside the pipeline changed «что б не поволять в нем
тихой смены субъекта - но там тоже могут быть косяки» (maintainer,
2026-10-12 16:16, session 014e5a04), and kept the first to ripen:
«давай просто запишем идею куда-то вариант 1 .. на будущее, пусть
полежит дозреет» (16:35). The model's reading: whether a step reads its
subject is read from the parser's tree, as `readsItsSubject` tells the
command line [D215], and whether a bare name holds a value from the
declarations its scope holds; a step after a declaration starts anew,
and a step followed by `!|` reads the outcome, as `false !| true` does,
so neither drops; a guard that passes or raises, its answer left for a
name read back, drops by design. Over the laws of the catalog, the cases
of the suite, the queries of the benchmark and the sources of the
sister project, the other drops show what such a step answers, the
model's measurement of 12 October 2026. The alternatives: the answer
printed as it is, with a line comment beneath it that names the step
and what it likely meant, as a host writes a line above a failure no
`!|` caught [D13], an answer that still reads back and a hint the
language server shows on the step, the maintainer's first variant and
the model's recommendation; a hidden value that stands for the new one
and remembers the old, which has no literal of its own; or a refusal of
the step in the language, under which `5 | false !| true` answers
`true` and the cases of [D8], [D125] and [D235] that pipe a quote, a
doc and a name of a quote change. Open, left to ripen.

Hierarchies of tags. The walk of a verb down the subject's tags [D34]
knows no hierarchy between tags. When a task
wants one, Clojure's multimethods show the form: a hierarchy of names
built as data with `derive`, separate from any value, rather than
inheritance. The cost is a second axis of resolution; the gain is that
a host can say that every kind of its nodes answers a verb once. One
level of it is decided: every walk ends at `::any`, whose words every
value answers, a host's among them [D153], [D169].

Mounting a namespace too large to declare. The sister project's types
are tens of thousands of names, which no source declares; the intention
is that a host serves them on demand, the way a file server was mounted
into a namespace of Plan 9: a tag no declaration names is asked of the
mounted namespaces in order, the first that knows it answers, and the
order of mounting and the rule of ownership settle any overlap. The core
would know nothing about Java, only how to ask a mounted namespace, and
a Java type would be a tag, written in Java's own spelling, copied from
a stack trace and pasted into a query, its source, its page, its record
and its relations read as any tag's:

```qlang target
> ::app.m8.web.servlet.gwt.orgstructure.functask.ConfirmFtNewEmpHandler | source
```

The slash is accepted inside a tag's name and the dot is not:

```qlang
> ::app/m8/web/Foo | type
::tag

> ::app.m8.web.Foo | type
::quote/ParseError!{ … :found "." … }
```

The dot is unused elsewhere in the grammar, so admitting it inside a
tag's name is local to the grammar, and a quoted form, `::"…"`, mirrors
the quoted keyword and covers what Java allows and an identifier does
not, the `$` of a nested class among them. A tag name is the address of
a name of the root [D153], so a mount is a noun whose names a host
answers on demand, and `manifest` lists them beside the declared nodes
[D61]. A member of a type is a record under the host's tag that points
at its type, `::JdtMethod{:of ::app.m8.Foo :sig "bar(int)"}`, and the
verbs the sister project declares under any value shrink to about a
dozen: the lookups become the tag literal, the accessors of the
containing element fields whose values are tags and therefore links, the
enumerations by scope one verb over any containing node, the relations
one verb beside a few named ones. A namespace is also what an agent
sees: a session, and a sub-agent inside it, is given the namespaces its
task needs, so focus comes from construction rather than from being
asked for. Open: whether a host needs it before the sister project's
redesign, how a host declares the noun it answers on demand, and the
exact record of a member.

The pressure for a second format. Clojure answered the slowness of
parsing its notation in browsers with Transit, the same model written
over JSON and MessagePack, and so kept two formats of one data. The
site's playground and any host that speaks HTTP will feel the same
pressure. The principle says the literal or plain JSON and nothing
between; the cost is paid in parsing speed at the boundary, and it has
not been measured.

Effects as emitted values. A write to the outside world becomes a
tagged value that a pipeline emits into a log flowing outward with the
pipeline value, and the host performs the log at the boundary; or a
quote tagged as a host effect, which the boundary applies, so that the
effect is the pipeline's result rather than a side channel; reads stay
ordinary host operands. It enters the route only with a task no plainer
construct solves, the sister project's plan-then-apply workflow being
the first candidate, and it amends the state pair.

Where a host's query runs. A host answers the language's calls one by
one over its own boundary today, so a query that fans out over a large
answer, the members of `java.lang.String` and the callers of each, pays
a round trip per element, and its elements now run in their order
[D84]. The
maintainer's direction is the other end: «само qlang выражение мы будем
отправлять через jdt в сам эклипс и пусть его процесс считает ... и
тогда не надо все эти ресты выставлять в апи, для выдергивания данных»
(maintainer, 2026-09-26 06:10, session 86982eb5). The query then runs
where the data lives and only its answer crosses the boundary; the cost
is a JavaScript engine inside the host's process, since the core is
JavaScript, and a session whose scope lives in two processes. The
alternative keeps the evaluator in the client and gives the host
operands that take a vector whole and bound their own calls.

A value that stands for a world [D21], [D41], [D96]. The maintainer
asked whether a host needs a value that wraps another, prints what it
wraps and keeps the behaviour of a long-lived thing across the steps of
a query: «можно ли (и нужно ли.. и вообще полезно ли) сделать такоую
proxy сущность для нужд хостов например.. которая оборачивает какое-то
значение, не имеет собственной printValue (своей формы) и печатает то
что заворачивает, но добавляет/меняет поведение .. по типу у нас есть
большое значение (состояние игры)  мы взаимоействуей им через посылку
команд | left | right | jump и так далее» (maintainer, 2026-09-28 06:09,
session d427ce7e), and then «в хостовой среде мы как бы просто не
печатаем ::host-тэг верхнего уровня ..  и его сущности могут печататься
компактно, а обратный резолв из печатной формы в хостовую (это
отвественность самого хоста) […] это я просто думаю как моделировать
эффекты и т.п. дела потом» (06:18). The tree holds most of it: a tag
over the state is the wrapper, a verb that returns its subject's kind
keeps it, the tag's constructor runs again after every such verb [D41],
and the `print` the kind answers is the screen [D96]. Two things it
lacks. A screen that drops what the world holds is no literal that
reads back, so it is either an elision [D21] or the view apart from the
literal that D96 set aside. And the line between a value and a
reference: a value reads back as itself, while a reference, a type of
the sister project or a world, reads back as the current state of what
it names, as a URL does; whether a tag says which of the two it is
stays open. The first real test is the schemas of the sister project's
entities, more complex than the kinds of the core.

The site as hypermedia [D19], [D88]. The maintainer pictures the site
as a browser that runs qlang: a module of a tutorial whose quotes, tags
and keywords are links, a click writing the snippet into the line of a
REPL and running it, so that the answer reads as the next page: «что б
квоты с примерами ~() или ещё какие-то тэги кейворды .. там сделать
кликабельными и когда нажимаешь на них - то в relp строку вставляется
этот снипет и исполняется .. но выглядит так как будто просто сменилась
или открылась ниже новая страница» and «вдруг у кого-то из читающих
потом щелкнет как это работает .. и что гипертекст возможнет не только
в вебе, но и в repl-е и просто в баше в аргументах» (maintainer,
2026-09-26 13:21, session 86982eb5). A link is then a query, the same
text typed in the REPL or passed on the command line gives the same
page, and the site is one renderer of it. The tree gives the segments
of a doc, its prose apart from its links and snippets, and a name to
reach a page by [D88], [D175]; the prose that heads a source is a plain
comment that no name reaches, a tag inside prose is no segment yet
[D19], and a keyword names nothing a click could open [D221].
The site waits for the syntax: «пока синтаксис не начнет мне самому
нравиться» (13:23), and «но сперва UIX в вебе и UIX в терминале нас
должен удовлетворять» (13:26).

How elision knows a kind [D21], [D34], [D46]. «просто рано или поздно все
равно надо будет придумать как разбрасывать через мультидиспатч логику
элизии .. что можно коллапсить а что нет .. что б как-то рекурсивно оно
могло пеуплотниться без риска того что итоговый результат получится
совсем неинформативным и сразу же потребует экспанда сделанных элизий»
(maintainer, 2026-09-23 23:53, session 86982eb5). The order of a schema
says what a reader needs first, and elision takes the tail. The
alternatives are the order alone, which says nothing of the values
inside a field; a verb of compaction on each kind, found through the
tags as every verb is and specialized by a host on its own; and a floor
under every kind, the head of its schema never elided, which keeps the
signal at the price of a budget sometimes exceeded.

A constructor that tags its own result [D8]. `tag` runs a tag's
constructor, so a constructor written as a quote that tags its own
result through `tag` recurses until the depth budget refuses it:

```qlang
> :P |~~ A person. ~~| | :P/construct ~(tag ::P) | ::P{:a 1} !| type
::call/EvaluationDepthExceededError
```

«c
рекурсией на конструкторе таг да не подумали.. можно и потом вернуться
или тебя самого может озарит как надо было правильно решать в процессе
другой работы» (maintainer, 2026-09-24 03:05, session 86982eb5). The
alternatives are a constructor that answers the payload it accepts while
the runtime puts the tag on, which needs no change and leaves the
self-tag a recursion like any other; `tag` inside a constructor of the
same tag stamping without running it again, which is a rule of dynamic
scope; and a refusal that names the self-tag at its second entry, which
is one more check on every constructor. The contracts are on the kinds
[D168], [D169], so it waits on a constructor that needs to tag its own
result.

The entrypoint. Where the modules of the work live, how the start
command measures the tree, the schema of the dashboard, how hooks call
it, how the state of what a session has been shown is kept, how sensed
items are computed, and how the maintainer's intent enters the task:
all of it is the draft `docs/qlang-entrypoint.md` holds, ideas and no
decision [D231], and the maintainer wants to explore it before any of it
is fixed.

A topic is a label [D166]. A page declared as a name is a label, a
topic among them, so a name under a topic resides on it and refuses any
other subject by its address:

```qlang
> :T |~~ A topic. ~~| | :T/h ~(type) | 5 | T/h !| type
::T/h/SubjectNotTError
```

The helpers of the sister project, `jdt/problemsVia` and its kin, are
called by their addresses on a string or a node, so under this rule
they move under `::any`, words of every value, or a topic is a page that
no value goes under and whose names run on any subject by their
address. The sister project took the first: its helpers are words of
any value, `::any/problemsVia` and its kin, and its suite passes
against the workspace copy. The maintainer reads it as a workaround:
«там перенос под any это простой - но немного кривой способ .. там оно
переписано так что осталось .. в старой функциональной парадигме, а не
от тэга .. в общем не SVO там до сих пор..» (maintainer, 2026-10-12
20:12, session 014e5a04). A helper takes a string or a node as its
object and runs as a function over it, where a word of S V O resides on
the tag of the node it serves [D34]; the helpers move onto those tags
when the sister project's nodes carry their kinds, which its redesign
brings. Open, with that redesign.

A helper of one word. [D153] let a word's helper live in the group of
its declaration, `:f (:h 2 | ::verb~(mul h))`, which closed over it;
since [D168] took `::verb~` out, a word is the quote it runs, and a
quote does not close over the group it was written in:

```qlang
> :any/g (:k 10 | ~(add k)) | 5 | g !| type
::call/UnknownNameError
```

So a helper, of one word or several, is a word under a noun its
readers see, as the sister project's are. The alternatives are a quote
that closes over the scope it was written in, as `::verb~` did, which
makes what a word's names mean depend on where it was declared and
costs a closure each quote carries; and the helper as a word, as it
stands, which costs a name on a noun for every helper.

The boot of the root, and a lazy one. The command line boots the whole
root in each process, its sources parsed and their declarations run.
On 11 October 2026, on the maintainer's machine, a run of `qlang '1'`
took 0.74 to 0.84 s, five runs each its own process: node's own start
0.08 s, the modules of the core 0.06 s, the boot of the root,
`langRuntime`, 0.63 s, and the session of the command line with the
query 0.02 s; within the boot the parse of the sources, half a million
characters, took 0.26 to 0.31 s and the run of their declarations the
rest. Every call a model makes pays it, a run of the benchmark a dozen
times.
The maintainer asked whether a lazy one pays: «потом уже переходи к
ленивой загрузке.. потому как непонятно как это скажется на
производительности и остальном.. или смысла нет там вообще.. т.к. есть
операнды которые работают над всей вселенной..» (maintainer, 2026-10-07
21:23, session 22b934f8). Words read the whole root: a bare name the walk
of its subject does not answer, `residencesOf` in
`core/src/runtime/nouns.mjs`; the words of
`::any`, which several sources declare, `namesUnderOf` there; `kinds`,
`kindNamesOf` there; and the names near a name a refusal offers,
`nearestNames` in `core/src/nearest-names.mjs`. So a query that fails,
the common query of a reader learning a tool, loads it all, and a
loader needs the names each source declares before it runs it. The
alternatives: the root booted whole, as it stands; the trees of the
sources kept beside them as JSON, which spares the parse, each checked
against a hash of its source, at the cost of an artifact the build
writes and the package carries, a site that boots in a browser parsing
still; and sources loaded by an index of their names, which costs the
loader and a rewrite of every reader of the whole root, and spares a
query that fails nothing.

[D2]: decisions/D2.md
[D5]: decisions/D5.md
[D7]: decisions/D7.md
[D8]: decisions/D8.md
[D13]: decisions/D13.md
[D16]: decisions/D16.md
[D19]: decisions/D19.md
[D20]: decisions/D20.md
[D21]: decisions/D21.md
[D22]: decisions/D22.md
[D26]: decisions/D26.md
[D28]: decisions/D28.md
[D29]: decisions/D29.md
[D30]: decisions/D30.md
[D31]: decisions/D31.md
[D32]: decisions/D32.md
[D34]: decisions/D34.md
[D37]: decisions/D37.md
[D38]: decisions/D38.md
[D39]: decisions/D39.md
[D41]: decisions/D41.md
[D42]: decisions/D42.md
[D43]: decisions/D43.md
[D46]: decisions/D46.md
[D49]: decisions/D49.md
[D50]: decisions/D50.md
[D51]: decisions/D51.md
[D58]: decisions/D58.md
[D59]: decisions/D59.md
[D61]: decisions/D61.md
[D67]: decisions/D67.md
[D71]: decisions/D71.md
[D72]: decisions/D72.md
[D80]: decisions/D80.md
[D84]: decisions/D84.md
[D88]: decisions/D88.md
[D89]: decisions/D89.md
[D93]: decisions/D93.md
[D96]: decisions/D96.md
[D107]: decisions/D107.md
[D108]: decisions/D108.md
[D109]: decisions/D109.md
[D111]: decisions/D111.md
[D116]: decisions/D116.md
[D117]: decisions/D117.md
[D118]: decisions/D118.md
[D119]: decisions/D119.md
[D120]: decisions/D120.md
[D121]: decisions/D121.md
[D122]: decisions/D122.md
[D123]: decisions/D123.md
[D124]: decisions/D124.md
[D125]: decisions/D125.md
[D128]: decisions/D128.md
[D129]: decisions/D129.md
[D131]: decisions/D131.md
[D132]: decisions/D132.md
[D133]: decisions/D133.md
[D138]: decisions/D138.md
[D139]: decisions/D139.md
[D140]: decisions/D140.md
[D150]: decisions/D150.md
[D151]: decisions/D151.md
[D152]: decisions/D152.md
[D153]: decisions/D153.md
[D155]: decisions/D155.md
[D161]: decisions/D161.md
[D162]: decisions/D162.md
[D163]: decisions/D163.md
[D164]: decisions/D164.md
[D166]: decisions/D166.md
[D167]: decisions/D167.md
[D168]: decisions/D168.md
[D169]: decisions/D169.md
[D173]: decisions/D173.md
[D175]: decisions/D175.md
[D176]: decisions/D176.md
[D177]: decisions/D177.md
[D178]: decisions/D178.md
[D179]: decisions/D179.md
[D180]: decisions/D180.md
[D185]: decisions/D185.md
[D200]: decisions/D200.md
[D208]: decisions/D208.md
[D212]: decisions/D212.md
[D214]: decisions/D214.md
[D215]: decisions/D215.md
[D217]: decisions/D217.md
[D218]: decisions/D218.md
[D221]: decisions/D221.md
[D223]: decisions/D223.md
[D224]: decisions/D224.md
[D225]: decisions/D225.md
[D226]: decisions/D226.md
[D227]: decisions/D227.md
[D228]: decisions/D228.md
[D229]: decisions/D229.md
[D230]: decisions/D230.md
[D231]: decisions/D231.md
[D235]: decisions/D235.md
[D237]: decisions/D237.md
[D242]: decisions/D242.md
[D243]: decisions/D243.md
[D244]: decisions/D244.md
[D245]: decisions/D245.md
[D246]: decisions/D246.md
[D247]: decisions/D247.md
