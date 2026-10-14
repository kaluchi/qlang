# Qlang Audit

This document is the compass of the work on qlang, addressed to whoever
picks the project up next: most likely a model in a fresh session, with
this file, the repository and a maintainer who answers questions; it may
also be the maintainer alone, checking whether the work still points
where it should. It holds what no other text of the work holds: what the
language is for, what state would count as satisfactory, the principles
the code is held to, the scars the tree still shows against them, where
the work ends and by which route it gets there [D255]. A decision is its
record under `docs/decisions/`, a question no decision answers yet an
open record among them; the language is what its first page and its
chapters tell, `::qlang | doc`; and the chapters this document carried
on the core, on the hypertext and on how the project got here stand as
written in `docs/archive/the-audit-chapters.md`. It was first written in
September 2026, and each version since holds the text against the tree
the repairs of the one before left. This, the sixteenth, holds it
against commit `f0db2ec3`, its baseline: a scar the tree no longer shows
has left the document, what remains of a scar is stated as it stands,
the route starts from the baseline, and every probe answers as the tree
answered on the day this version was written.
`git log -- docs/qlang-audit.md` lists the versions, and the message of
the commit that wrote each tells why.

A draft of the session entrypoint, the computed context a session
starts from, lives in `docs/qlang-entrypoint.md`, ideas and no
decision; what the process took from it stands in the records, the
screen of the work a session runs first, `npm run desk` [D225], and
the sensors [D231]. This document treats the language and the work on
it; that one treats the environment the work happens in.

## How to read and maintain this document

Read the whole document once before touching the tree. It retells
nothing: the records carry the reasons of each decision and the pages of
the language carry the language, and what both rest on is here.

Four kinds of statement live here, and each has its own handle, the
means by which a later reader re-verifies it.

Evidence is a fact about the tree. Its handle is a probe or an anchor.
A probe is a fenced block whose lines beginning with `>` are queries
typed into `qlang` and whose other lines are what the tree answers; a
probe that begins with `$` is a shell command, which the runner of
probes runs when it reads the repository alone and leaves to be run by
hand, with the date of its answer written before the block, when it
reads a machine, the sister project or the environment. A probe answers
the sentence it stands under, so its answer changes when the sentence
stops being true and only then, and it reads what the sentence names in
a way that fails when that is gone; `npm run ci` runs every probe, and
the branch that changed an answer replaces the sentence with the new
fact and its new probe [D93]. A target, the answer a repair must
produce, is a conformance case that names its decision [D58]; a block
fenced as `qlang target` holds one whose answer no literal states yet.
An anchor names a file and a symbol; line numbers drift and are avoided.

A decision is a record of its own, `docs/decisions/Dnn.md`, cited here
by its number, a link to its file: what was decided, who decided it,
the source, what it rests on, and the alternatives set aside with the
reason [D31], [D58], [D155]. The maintainer's words stand in «…»,
quoted verbatim in the language they were written in with the time in
UTC and the prefix of the session, and words quoted from the tree stand
in “…” beside their anchor, so a script holds the first against the
transcripts and a grep the second against the tree. A record in force
says only what holds, a newer record pruning the part of an older one
it takes [D227], and the walk of each new baseline gives every record of
the language a case or a fate [D225]; the baseline moves at the
end of every shift that wrote records, before an outside audit and when
a branch lands on master [D227], and the code, the tests, the cases and
this document cite the records in force.

An inference is the model's reasoning from named facts. Where an
inference carries weight it is marked as the model's reading, so that
a reader knows it can be re-derived and where to look.

A question is what neither the tree nor the decisions answer: an open
record, its question with its probes, its source and its alternatives
with their cost, written again in place when a decision answers it
[D255]. `node scripts/requirements.mjs` lists the questions being
decided, and a scar cites the open record its repair waits on.

The weight of a statement is what rests on it. A sentence with a
source and with decisions resting on it is load-bearing and is the
first to re-verify when anything moves. A sentence with dependents and
no source is a hidden assumption, the most dangerous kind; it is
verified or turned into a question. A sentence with neither a source
nor dependents is noise and is deleted.

Some rules for whoever edits the document, each learnt at a cost:

- Doubt is resolved by a decision recorded with its source. It is
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
from sources it has never seen, has to collect and shape it
correctly, and cannot afford to learn a language first. qlang is the
pipeline language for that situation, and it carries one commitment
that ordinary query languages do not: it teaches its user from inside
itself. The catalog of words is written in qlang, every binding
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
data. The tool embeds the language and exposes its domain as words,
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
a query that shapes blind cannot be written. The last requirement was
learned from the attempt to write every schema and example into the
tool's help: the share of such a sheet that bears on the task at hand
falls toward nothing, because the shape a session needs is that of the
one answer it is about to shape, and that shape belongs to the
word it is about to call.

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
expressions, subject-first application, a literal as a subject, naming
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
against the baseline of the version at hand, commit `f0db2ec3` for this
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
and the description of a word are values of the language; each has
a literal that prints and reads back. What has no literal does not
reach the pipeline value.

A literal stands as a subject. Whatever the language holds has a
literal, a value, a kind, the address of a word, code, a page, an error
at rest, a path, and a literal stands at the head of a pipeline, where
the ordinary protocol asks it, `doc`, `explain`, `type`, `manifest`; a
construct with no literal of its own can only run, never be asked, and
is the first suspect when a reader misfires on it. So a step is a
command, a word and its objects, and a value is the subject or an
object, never a step the language runs by a verb nobody wrote [D248]:
«нас обычно спасает литеральноть и SVO .. массу вопросов через них
решили и выпутались из сложных противоречий..» (maintainer, 2026-10-11
23:02, session 22b934f8), and «когда кусок языка может встать в позицию
субьекта - то мы можем его колить обычным протоколом..» (2026-10-12
22:40, session d65e4c1d).

The language describes itself. The only description of a word is
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

## The scars

The rest of the audit walks the scars in the order in which their
repairs depend on each other. Each section states the problem, shows it
running, and names what its repair must achieve; the decisions that fix
the direction are cited by number. Every probe can be reproduced from a
shell with the `qlang` command or in its REPL, and on 14 October 2026
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
so that nothing of the runtime is exported for building words [D46].

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
values alone [D164]. In the sister project, on 13 October 2026:

```sh
$ grep -oE '^:any/[A-Za-z]+' cli/lib/jdt/graph.qlang | sort -u | wc -l
59
```

That is the `ioctl` of Unix, every new capability a new verb in one
shared space, where Plan 9 kept the verbs fixed and let the nouns grow;
a host's catalog should grow the same way.

What remains of the rule of collisions, who may join a verb and a kind,
whose the names without a prefix are and how one query shows every
definition of a name, the surface and the loading [D153], the reading
of a name [D221], the rule of the owner [D200] and the meeting of a
value and a word [D223] settled, is a question being decided [D269].
Namespaces too large to bind are the sister project's types, tens of
thousands of names, which it reaches by lookups it declares under
`::any`; serving them as tags is the question of mounting [D259].

### Errors named by their site

A refusal is named by the address of what refused: a subject of
another kind under the word, an input of none of its kinds under the
input, an input that breaks an invariant under the invariant, whose
name is the refusal, a primitive's refusal of an input's value or of an
element of it under the input, and a primitive's refusal of its run
under the word that ran it, which lists it among its names; a number is
whole where it equals its floor, `eq (floor)`, the law of every count
and of the digits of `round` [D46]. The facts an error carries are
definitions under the label of the refusal and under `::error`, held in
the order they are declared, the trail last, and a fact neither
declares is a defect of the runtime [D46], [D169], [D252]:

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(type) /actualType]
[::number/add/addend/NotNumberError ::string]

> [1 "x"] | sum !| get [~(type) /index]
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
> ::vec | doc | add 1 !| get /trail | map /subject | map ~(eq (::vec | doc))
[true]

> :any/g ~(add 1) | ::vec | doc | g !| get /trail | map /subject | map ~(eq (::vec | doc))
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
321
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\")" < /dev/null | grep '^|~|'
|~| raised, and no !| caught it
|~| The addend is a number; text that holds one is read by `toNumber`.
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\")" < /dev/null | grep -c ':read ~(!| get /trail/1/subject)'
1
$ node cli/src/bin.mjs "[$(seq -s ' ' 1 300)] | map ~(add \"x\") !| get /trail/1/subject | count" < /dev/null
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

### Self-description

Examples live on two planes, each in its role: the laws of the catalog,
the claims of its pages, which the language runs on itself, each named
for the claim it proves and paged with it [D123]; and the
conformance suite, the requirements of the language held outside it, so
a case holds a form the language does not read yet and stands through a
change that breaks its sources, each case opening with the record that
gates it [D254]. And a parse failure prints whole, every
token the parser could have read and the place it stopped as a span of
its start and its end, `::span[3 1 4 4 1 5]` [D249], where a failure of
a step prints as an alert [D7]:

```sh
$ node cli/src/bin.mjs '::a.b' < /dev/null 2>&1 | grep -c ':location ::span'
1
```

The repair must reduce catalog prose to what the facts do not say,
written in the language's own vocabulary, with no name of a file, a
symbol, a service or a section of another document in it. It must print
a parse failure economically, with the full value reachable by a
path rather than dumped. It must let a reader assemble from the
definitions under an address the description a question needs, in one
round trip [D168], [D169].

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
[D164], the audits of a clean outside reader of the tree, run by one
command [D277], and the reviews of the catalog, each kept as its writer wrote it beside the
fate of each finding, and the chapters this document left, as they were
written [D255]:

```sh
$ git ls-files --error-unmatch 'docs/*.md' | grep -v decisions | sed -E 's#^(docs/research/[^/]+)/.*#\1/#' | sort -u
docs/archive/the-audit-chapters.md
docs/qlang-audit.md
docs/qlang-entrypoint.md
docs/research/legend/
docs/research/outside-audit/
docs/research/reviews/
```

What remains of the scar is the editor's hand-written TextMate grammar,
a second spelling of the grammar beside the parser.

### The grammar

The fifth condition asks a grammar proportional to the language, its
comments handled in a few lines. `core/src/grammar.peggy` holds the
comment and doc forms nesting in each other and in quotes; the refusals
that name a habit of another language as productions with their
messages, `SpacingRefusal`, `TagDeclarationRefusal` and
`PathBeforeWord` among them; a line break that tells where a
declaration ends [D243], [D251]; and two counters its predicates raise
and give back, `docQuoteDepth` and `lookingAhead`. The repair is the
grammar of the finish, comments as whitespace in a few lines and one
pipeline production.

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
the requirements it left are the conformance cases that name it [D58],
each opening with it [D254]; it cites a record in force or one waiting
on its target [D225]. An
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
any payload; its declaration is its page and its kind, built from
`::kind` by commands, its payload, its fields, its invariants and its
constructor [D252]; a value under a tag obeys the tag's invariant, checked
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
[D16], [D252], while one rule of the core prints every literal.

One mechanism of word. A word is a function named under the
label of its subject, built from `::fn` by commands, its inputs with
their kinds and invariants, its answer, which `returns` names, its
refusals and its laws, and its doc its page, a story of what it takes,
answers and refuses, and the runtime executes the function [D179],
[D180], [D251]. A word of the core, a host's word and a word a
reader declares are called the same way, checked the same way,
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
parentheses inside a modifier, so parentheses mean one thing, a
pipeline as one word. A literal holds literals alone from its opening
sign to its closing pair, reading no name and no subject, and a shape
computed is the template of `get`, a literal of paths and quotes
[D279]. Every modifier holds a value read by its
own form; code is a quote, `~(…)`, `~add` for a single word, which
nothing but `apply` and an input whose kinds take a quote runs: a
quote written in a step reads the names of that step wherever its call
runs it, the call keeping where each of its objects came from, and code
held as data runs in a lane of its own, the words of the scope of its
step and its own names, no value that scope named reaching it [D278].
There is one
binding form, `:name value`, evaluated once at declaration and named as
a value, a name declared once in a scope; a verb is a function named
under the label of its subject, its inputs and its answer in its chain,
or a quote written alone, the function of no commands it is, and it runs
when its name is mentioned, as a built-in does [D5], [D251], [D253]. Comments are
whitespace; documentation is a doc literal in the binding's slot.

Maps and vectors are the only containers; JSON syntax is read,
normalized, and forgotten until the codec at the boundary writes it
back. A map's elements are its values and its keys are the shape that
travels with them; `entries` makes the keys data as the pairs `[key
value]`, and `toMap` builds a map back from them [D138], [D244], a
string naming a key wherever a key is taken [D139]:

```qlang
> {:auth {:port 3000} :db {:port 5432}} | entries | map ~(unionOf /1 (get {:name ~(get /0 | toString)})) | sort /port
[{:port 3000 :name "auth"} {:port 5432 :name "db"}]
```

One order ranks every value, so anything sorts, and the set is the
vector in that order without duplicates. A predicate answers a boolean
or fails at its part. An error carries the address of what refused,
its facts the definitions under that label in the order a reader needs
them, and the tag leads to its procedure; a nested evaluation that
fails yields its error as a value, which every word treats by one
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
> :count 5 | get [~(7 | count) ~([1 2] | count !| type) ~([1 2] | vec/count)]
[5 ::call/ValueMeetsWordError 2]
```

A declaration writes into its scope the record of its binding, so the
axes read the record [D5], each reading a name by its
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
in the catalog and run as its tests, the claims of its pages; the
conformance suite holds the requirements of the language outside it
[D254]. Every repair in this picture rebuilds an earlier
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
- Values: the set of values, null, boolean, number, string, pattern,
  keyword, tag name, vector, map and tagged value; tags with their schemas and
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
- The catalog, in qlang: words with declarations that are true
  because they are executed, the tag of every refusing site as a kind
  with its schema and its procedure, other tags with schemas, and the
  root doc. The implementations of the words are plain functions
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
are the tests of the words. The conformance cases, each a query and
the literal it must answer, are the requirements of the language, held
outside it, each opening with the record that gates it [D254]. The
round trip of printing
and parsing is a property test. Unit tests remain for what stays in
JavaScript, the parser, the printer, the loader and the evaluator's
seams, and for nothing that a query can state. The coverage threshold
applies to the core alone.

The consumers at the finish carry no language of their own. The
command line is a thin host: standard input lifted only when it
carries bytes, the default subject otherwise [D37], and read only for a
query that reads its subject, so a pipe left open never holds a query
that reads none [D37]; the answer written as its literal whatever the
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

The start is the tree of the baseline, commit `f0db2ec3`, and the finish
is the tree the previous chapter describes. Between them lie two
milestones, each a state of the language followed by a release [D29].
Under each the work is named in the order its parts rest on each other,
and the answers that show a milestone reached are the targets its
decisions leave in the conformance suite [D58]. The decisions whose
work began before the baseline met their targets, the last of them the
effect marker leaving the language [D2], and the step as a command and
the path as a value met theirs, the first work of the route [D248], and
the quote as data and the function built by commands met theirs
[D251], and the kind built by commands and the one spelling of the
roles of a word and a kind theirs [D252], [D253], and the closed
literal theirs [D279], and the lane of held code theirs [D278]; a target shows the rule of the record that left it and holds the
answer the tree gives today [D91], and every decision below writes its
targets before its work:

```sh
$ grep -rh '"target": *true' core/test/conformance | grep -vc '"now"'
0
```

### Milestone 4 · One spelling

Every fact has one spelling, and a kind owns what is said of its values.
It opens with the step as a command and the path as a value [D248]: a
path does nothing by itself, the word that takes it reads it, `get`
strictly, `query` softly, `has` asking, and a word that takes code taking
it as code, so the read of a path has one spelling where it had a step and
the record `::path{:path …}` inside a quote, and a value written as a
later step is refused; its cases stand in
`core/test/conformance/05-a-step-is-a-command.jsonl`. The function joins
it [D251]: a quote is data with no scope, a recipe reads what its call
hands it, and a word is a function named under a label, built from the
noun `::fn` by `on`, `takes`, `returns`, `throws`, `carries`, `holds`,
`proves` and `impl`, its cases in
`core/test/conformance/29-a-function-is-built-by-commands.jsonl`.
The keystone, the declaration of a kind, has landed [D252]: a kind is
built from the noun `::kind` by commands, `wraps` its payload, `reads`
a field of it, `tells` a page, `holds` an invariant, `throws` and
`carries` its refusals and their facts, `proves` its laws and `impl` its
constructor, so a field of a record is spelled where a reader relies on
it before the record is fetched, which is the third requirement of the
mission; its cases stand in
`core/test/conformance/30-a-kind-is-built-by-commands.jsonl`. And the
form that declared the roles of a word or a kind by name has left the
language [D253]:

```qlang
> :P |~~ A person. ~~| | ::P{:name 5}
::P{:name 5}

> :P |~~ A person. ~~| (::kind | reads :name |~~ The name. ~~| /name ::string) | ::P{:name 5} !| type
::P/name/NotStringError

> :P |~~ A person. ~~| | :P/construct ~(tag ::P) !| type
::bind/WrittenOutsideItsChainError
```

And a literal is closed [D279]: from its opening sign to its closing
pair it holds literals, so a group or a name inside one is refused and
a shape computed is the template of `get`, its paths read and its
quotes run against the subject; a literal whose first character would
continue a tag's name touches the tag by `#`; and a kind attaches its
tag by its commands and the check its host hands, building no other
value. Its cases stand in
`core/test/conformance/01-a-literal-is-a-value-of-its-kind.jsonl`:

```qlang
> {:first "Ann" :age 30} | get {:who /first :next ~(get /age | add 1)}
{:who "Ann" :next 31}

> "[(5 | add 1) 2]" | parse !| type
::quote/ParseError

> ::Width#5 | add 3
::Width#8
```

The schema is the kind's [D164], [D252]: what stands under a kind is
the nodes its chain lays under its address, each a name, its page and
its value, its payload, its fields, its pages, its refusals and their
facts, its invariants, its laws and its constructor, and under a word
those of its function [D251]. `::spec~(…)` and `::verb~(…)` have left the
language: a reader's verb is a name under the label of its subject,
`:number/inc ~(add 1)`, and a kind of the core a kind whose constructor
the host hands, `impl ::builtin{}` [D168]:

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
> 1 | add "x" !| get /actualType
::string
```

What remains on the schema is elision taking the tail of a schema
[D21]; what remains of the names is a host's, which the sister project's redesign moves
onto its kinds, and the questions of mounting [D259] and of the
collisions of a host's names [D269]. The function and the kind built by
commands leave second spellings the next branch deletes: the objects of
each command in a table of the runtime beside the words of the commands
[D272], the roles of a declaration the tools read from its form [D273],
two forms of a place read by their form [D274], and the refusal of
another noun's tag declared by hand in the builders [D275]; and the word
for what a command takes is chosen once [D276]. Beside both, the
editor's grammar is generated or reduced, and the
screen of the work, whose first version `npm run desk` prints [D225],
grows from the draft of the entrypoint document [D231].

Its answers are the targets of [D46], [D152], [D153], [D168], [D169],
[D185], [D248], [D251], [D252], [D253], [D278] and [D279] in the conformance suite,
every one met, the
step of a constructor apart from the kind of tagged values having
landed [D8]. Beside them: no
class of the JavaScript stands for a refusal; no contract of a word is
spelled outside the catalog; and the environment holds no key of the
runtime's own.

The model's reading of what in this milestone the language needs, and
what is the debt of its tree. The schema is the language's, since
without it the shape of an answer cannot be known before it is fetched,
and a host has nowhere to say what its records hold; it stands as the
commands of a kind [D252]. The rule of
collisions is the language's as soon as a host publishes a catalog of
its own, which the sister project does, and mounting is the language's
for a host whose names are too many to declare. A class of the
JavaScript for each refusal is the tree's debt alone, since a session
meets the tag and the facts.

### Milestone 5 · Front door

The measure can be taken as the mission states it. Its answers in the
conformance suite are the targets of [D2], [D7],
[D46], [D107], [D108], [D109], [D111], [D117], [D118], [D119], [D123],
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
laws prove [D123], [D212], each
definition a story a reader falls into, the word, its inputs, its
answer, its refusals, its laws and its recipe in that order [D179],
[D252]; enrichment happens once per session; a value shared across
kinds of record carries a tag of its own, as a field is read by the
chain of its kind [D50], [D252]; and
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

A question neither the tree nor the decisions answer is an open record,
its question, its alternatives and their cost, written again in place
when a decision answers it [D255]; `node scripts/requirements.mjs` lists
those being decided.

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
[D123]: decisions/D123.md
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
[D221]: decisions/D221.md
[D223]: decisions/D223.md
[D225]: decisions/D225.md
[D227]: decisions/D227.md
[D231]: decisions/D231.md
[D235]: decisions/D235.md
[D237]: decisions/D237.md
[D243]: decisions/D243.md
[D244]: decisions/D244.md
[D246]: decisions/D246.md
[D248]: decisions/D248.md
[D249]: decisions/D249.md
[D250]: decisions/D250.md
[D251]: decisions/D251.md
[D252]: decisions/D252.md
[D253]: decisions/D253.md
[D254]: decisions/D254.md
[D255]: decisions/D255.md
[D259]: decisions/D259.md
[D269]: decisions/D269.md
[D272]: decisions/D272.md
[D273]: decisions/D273.md
[D274]: decisions/D274.md
[D275]: decisions/D275.md
[D276]: decisions/D276.md
[D277]: decisions/D277.md
[D278]: decisions/D278.md
[D279]: decisions/D279.md
