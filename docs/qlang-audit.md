# Qlang Audit

This document is addressed to whoever picks the project up next. Most
likely that is a model in a fresh session, with this file, the
repository, and a maintainer who answers questions; it may also be the
maintainer alone, checking whether the work still points where it
should. It records what the language is for, what state would count as
satisfactory, why the code falls short of it, what has been decided,
where the work ends, and by which route it gets there. The first
version was written in September 2026 and frozen in commit `05eb884`.
The second rewrote it after a day of holding it against the whole
tree, the reference, the sister project and a long conversation with
the maintainer, drove the repairs that landed as the pull requests
from #42 to #52, and is frozen in commit `32db75c`. The third held the
text against the tree those repairs left, drove the first milestone
through the pull requests from #54 to #65, and is frozen in commit
`4f529c5`. The fourth weighed again the decisions not yet carried out,
drove the second milestone and part of the third through the pull
requests from #66 to #104, and is frozen in commit `bba9606`. The fifth
drove the third and fourth milestones and most of the front door
through the pull requests from #105 to #138, and is frozen in commit
`7319613`, the baseline of this sixth version. This version holds the
text against that tree: a scar the tree no longer shows has left the
document, what remains of a scar is stated as it stands, the route
starts from the baseline, and every probe answers as the tree answered
on the day this version was written. `git diff 7319613 --
docs/qlang-audit.md` shows what changed, and the message of the commit
that wrote this version tells why.

The design of the session entrypoint, the computed context a session
starts from, lives in `docs/qlang-entrypoint.md`. This document treats
the language and the work on it; that one treats the environment the
work happens in.

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
one to a file, `docs/decisions/Dnn.md`, written once [D31], [D58]: what
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
decision changes by a new record that names the one it replaces; the
old record stays as it was written, with one line that names the record
replacing it, so the chain of reasons survives as a graph of files. A
requirement a decision leaves is a conformance case that names the
decision, a target until the tree meets it, so whether a decision is
carried out is computed by running the cases.

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
- A rule is written as a rule, not as the minutes of the conversation
  that produced it. The date and the source belong in the record's
  source line, not in the narrative.
- The transcripts of the sessions are the only lossless record of what
  was said. They are the `.jsonl` files of the Claude Code project
  directory. A message the maintainer sends is a record whose `type` is
  `user`; a message sent while the model works is a record whose `type`
  is `queue-operation` and whose `operation` is `enqueue`, with the
  text in `content`; the summary of a compaction is a `user` record
  too, written by the model, so a quote found only there is the model's
  paraphrase. `scripts/sensors/maintainer-messages.mjs` lists the
  maintainer's words on any topic, and `scripts/sensors/check-quotes.mjs`
  checks every quote of a document against them. When a record's quote is not
  enough, the transcript around it is.
- Before the first claim about the language, a session reads the
  sources the instruction file names in its first tier, whole. The
  file-reading tool cuts a read at its token cap, and the transcript
  stores every read with the lines it returned and the lines the file
  has, marking a cut read with `truncatedByTokenCap`; a read that
  stopped there did not read the file, and
  `scripts/sensors/read-coverage.mjs` measures what a session has read.
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
against the baseline of the version at hand, commit `7319613` for this
one, the diff of the work ahead is negative in the core sources, in the
catalog, in the documents, and in the tests; the September 2026 master,
commit `f5e8ec8`, stays the origin the history measures from. This document and the entrypoint document stand outside
that count: they are the measure, not what is measured. A branch that
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
skipped step on the error's trail; `*` forks a step over each element
and answers the first error an element answers [D103]; `!|` is the
only combinator that fires on an error, and `|` and `*` step around it
[D51]. Parentheses, vectors, maps, sets, and error literals all obey one
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
it, and recursion through the pipeline value is correct. The error is a
value with a tag and a descriptor; its trail is the path it took, a stop
at every step that raised it or handed it on, and the steps its last
stop skipped, applied to a fresh subject, replay them [D85]. A
quote is code as a value, a doc is prose as a value, and a tag names the
kind of a value and is stamped on it without changing its shape. The
catalog is qlang source: every verb is a binding with its page and its
laws, the axes pass from a name to its projections, `doc` its page,
`spec` its declaration, `source` its code and `binding` its record,
`manifest` enumerates what exists, and `runLaws` runs the laws of a
page as tests, each with the claim it proves. The self-test over the
whole catalog runs in under a second.

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
itself standing as a subject, which is why `::AddLeftNotNumberError |
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
the dispatch and the anchor of hypertext all hang on.

All of that stays. Each item is an instance of exactly one concept, and
removing it would leave something inexpressible. The audit is about
what grew around it.

## Hypertext: the cockpit and the cord

The contract between a session and a tool that embeds qlang has a
name, progressive disclosure: an overview first, then zoom and filter,
then details on demand [D21]. Seen from the session it has four
clauses. The session controls the detail of an answer. An answer stays
within the budget the session asks for, by `elide` in the query or by
the host's flag, and prints whole when nobody asked [D120]. When the
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

- The dark cockpit. When everything is normal the panel is silent, and
  only what needs action lights up. An answer, a dashboard, an error
  shows what deviates and nothing else. The Unix rule of silence says
  the same: a program with nothing surprising to say says nothing.
- One procedure per alert. Every message of VMS was one line,
  `%FACILITY-S-IDENT, text`, and `HELP/MESSAGE IDENT` opened a page with
  fixed sections, what it means and what the user does; IBM's manuals
  of messages and codes gave each identifier an explanation, the
  system's action and the programmer's response. The tag of an error
  is the identifier, the descriptor carries the facts, and the
  document behind the tag is the procedure.
- Levels. ISPF on the mainframe showed a short message in the corner of
  the screen; one key showed the long message, the same key again the
  tutorial. The cord from an alert to its depth has levels, and the
  reader chooses how far to follow it.
- Every observation offers its next actions. IBM's console messages
  that required a decision listed the replies they accepted; `git
  status` ends with the command that would move each file on. An
  answer names the queries that continue it.
- Every handle says what is behind it and how heavy it is. A menu line
  of Gopher began with a character naming the type of what it led to;
  `ls -l` shows a size before `cat`. Pirolli and Card called the
  property information scent. A link whose weight is unknown is opened
  blind, which is how a session once pulled a page of sixty-five
  kilobytes to learn one count.
- Position, remainder, and completeness are stated. A pager prints how
  far through the text it is; a report prints its total rows; batch
  processing carried control totals so that a lost record could be
  detected. An answer that left something out says how many it left
  out, in the units the steps that read the rest count in.
- A fragment identifies itself. Line printers repeated the job, the
  date and the page on every sheet so that a torn-off page stayed
  legible. A piece of an answer that survives compaction says where it
  came from and how to get the rest.
- The cheap path is declared. `head` prints ten lines, `ls` does not
  recurse without a flag, and a job card declared its limit of printed
  lines together with what to do when the limit was reached. A cut the
  reader did not ask for is a surprise, so the budget is a request the
  reader makes, and the marker of what it left out says how to read the
  rest [D120].
- Help comes from declared grammar. TOPS-20 answered `?` at any point
  of a command with what was expected there, completed a word on
  escape and printed guide words in parentheses, `COPY (FROM)`; every
  program got that for free from one system parser to which it
  declared its syntax. DCL prompted for a missing parameter by name;
  Cisco's `?` lists the valid continuations with a line each. All of
  them could help only because the syntax was declared to the system.
  The operand declarations of qlang, once the runtime executes them,
  are that declared grammar, and the help follows from them: after a
  value, the verbs that accept it; inside a command, the name and kind
  of the next slot; after an unknown name, the nearest known ones.

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
value, or an error, carries tags and keywords the session has not met,
and loads their documents into the answer while the budget allows:
first the documents of the tags in the literal, then whatever the
keywords and quotes inside those documents lead to. The vocabulary of
the value drives it, and nothing is authored per operand. Plan 9's
plumber worked the same way: it recognized a file and line, a manual
reference, an address in any text and routed it to its handler, so
links were recognized rather than written. The games that carry a
codex, an encyclopedia whose entries open the first time the player
meets a concept, do exactly what enrichment once per session means.

A host learns what its reader wants through negotiation. The terminal
age did it by sniffing: a program asked `isatty` whether a human read
its output and chose colour, columns and buffering, and the guess was
wrong often enough that every tool grew `--color=always`, `NO_COLOR`,
`FORCE_COLOR` and a way to fake a terminal. HTTP made the reader
declare instead: `Accept` for the form, `Range` for a piece,
`If-None-Match` for what the reader already holds, `Prefer:
return=minimal` for the detail. Those are the four parameters of our
contract, and the host takes them declared, with sniffing only as a
default. A model is a new kind of reader, neither a terminal, for
which colour codes are wasted tokens, nor a parser, since it reads
prose; Claude Code already tells a command that a model is reading and
which session it is, through `CLAUDECODE` and `CLAUDE_CODE_SESSION_ID`
in the environment, so a host can keep its enrichment once per
session by itself. On 23 September 2026:

```sh
$ env | grep -E '^CLAUDECODE|^CLAUDE_CODE_(ENTRYPOINT|SESSION_ID)'
CLAUDE_CODE_SESSION_ID=86982eb5-b2cf-436c-9285-96a0669d39e5
CLAUDECODE=1
CLAUDE_CODE_ENTRYPOINT=cli
```

What the language owes the host for all this is short. A tag goes over
any payload without a declaration and prints faithfully; that holds.
The pipeline is the cursor: a query is a pure path to its data, so the
part of an answer that was left out is the same query with a tail, and
no session is needed to read in pieces.

```qlang
> [10 20 30 40 50] | drop 2 | take 2
[30 40]
```

That works only where every part of a value has, inside the pipe, a
size, an address and a slice. A vector, a set, a map, a value under a
tag and an error on the fail track have them. A string has none of the
three except by way of its lines, and strings are what overflows in
the sister project, source text and rendered cards:

```qlang
> "hello world" | count
::VerbWithoutBodyError!{ :verbName :count :addresses #[::map/count ::set/count ::vec/count] … }

> "a\nb\nc\nd" | split "\n" | drop 1 | take 2 | join "\n"
b
c
```

A quote has all three, being the vector of its steps [D53], and a doc
answers its parts by its `segments`, the vector of its prose and its
quotes [D19], [D95]:

```qlang
> ~(add 1 | mul 2) | take 1
~(add 1)

> |~~ a ~(add 1) b ~~| | segments | count
3
```

The pageable shape is the vector, and a value that can overflow has to
break into one, as the quote and the doc have, and a string does
through its lines.

Next, every tag and keyword inside a value is an anchor that resolves to
its document. A tag is one. A keyword resolves only as the name of a
binding, so the keyword of a field and the keyword that is one of an
enumeration lead nowhere, and one keyword means different things in
different records: `:modifiers` on a node of the sister project's graph
and `:modifiers` on an operand's descriptor. A record that is to be
enriched therefore carries a tag, where the sister project's nodes carry
their kind as a string field, and the meaning of its fields is
documented by its tag, a value shared by several kinds of record by its
own [D50]. The shape of an answer is read the same way, before the
answer is fetched: the operand's declaration names the tag or the type
of its result, the tag's declaration names the fields, and `spec` and
`doc` on the operand answer for one operand what a schema sheet would
answer for all. The result of a verb is the kind its `:returns`
declares, a declared verb's and a built-in's alike [D67]; the fields are
declared with the tag, and the element shape of a container is spelled
as the container's literal around the kind, `[::Method]` for a vector of
methods. Last, everything prints as what it is, code included, because
an elided and enriched page travels on.

The pages themselves are values of the same kind. The names are a space
of addresses, and a verb passes from an address into one of its
projections: `doc` into its page, `spec` into its declaration, `source`
into its code, `binding` into its record [D5], [D119]. A keyword after
`doc` is an anchor within the page, a vector of keywords a path and a
set of them several pages at once. A page holds prose and quotes, and a
quote takes its role from the tags over it: with none it is a law, which
`runLaws` holds to answer true, the sentence ending in a colon above it
the claim it proves [D123], [D124]; under `::link` it names a page and
`open` reaches it [D108], [D121]; under `::snippet` it is a query a
reader runs to see what it shows [D122]. So the first page leads to
every other in one query:

```qlang
> ::qlang | doc | links * open | every ~(type | eq ::doc)
true

> ::qlang | doc #[:pipeline :errors] | count
2
```

## How the project got here

The core landed in three days in early April 2026, carried over from a
specification written inside the sister project. The following ten
days added, in the order the consumer asked for them, comments that
behave as pipeline steps, effect markers on names, control flow, the
error as a value, named pipelines with parameters, a module system, a
language server, the catalog, and a command line. In the middle of May
the hypertext ideas arrived: quote, doc, tags, the axis operands, and
executable examples. They are the most fundamental concepts in the
language, and they arrived a month after the grammar had frozen around
comments, around the `as` operand, and around effect markers. Late May
went to hardening under an external code reviewer; the summer fell
silent; September brought a numeric model, an evaluation depth budget,
and a single declaration site for each error.

Neither the maintainer nor the model wanted the tree that resulted, so
the causes are worth naming, because the process that follows has to
remove them and not only their products.

The goal was never written down. Without a stated measure, each
experiment was judged by whether it worked, not by whether it
multiplied what existed; experiments were not closed, they were
layered.

Process substituted for design. The review rules demanded high-entropy
prose in every comment and a distinct class for every throw site; the
coverage threshold demanded a test for every branch; an observability
fingerprint demanded stable class names. Each of those is a reasonable
constraint on a finished thing and a damaging one on a thing still
being designed, because each turns a design decision into a rule the
design can no longer revisit.

Features arrived in the order they were needed rather than in the order
they depend on each other. The quote arrived after named pipelines had
already chosen how to pass arguments; the doc arrived after comments had
already become the way to attach prose; tags arrived after JSON
containers had become a second type.

Every fix added a guard rather than removing a cause. A drift test
protects two spellings of a fact instead of one of them being deleted;
a snapshot wrapper is unwrapped at every place the environment is read
instead of not existing; a dynamic import breaks a module cycle instead
of the cycle being cut.

And the model that wrote the code, working under context compaction
and under those rules, produced justification instead of deletion. The
mechanism is worth stating in the model's own terms, since the next
session will be a model too. A change the model is unsure of feels
safer with a comment that explains it, so the doubt moves into the
code and stays there; the tree carries thousands of lines of such
comments, some of them now false. The model sees a few files, the
cause lives in another, and so it repairs where it looks, which is how
one wrapper came to be unwrapped at eight separate places.
Rules that reward addition are obeyed by adding. And a model's report
that it has read what it was told to read cannot be checked from the
report: it can skim, read a file that the tool cut in half, and still
say it read it. The maintainer met every one of these: the model «не
раз меня обманывала говоря что выполнила бустрап, а сама вместо этого и
половины нужных файлов не прочитала», and without the facts «та
начинает гадать, или галюцинировать или превращается в
секретаря-писаря вместо напарника по интеллектуально работе»
(maintainer, 2026-09-23 03:09, session 86982eb5). The remedies are
structural. Doubt goes into a decision recorded here, never into code.
A branch starts from the full set of places where a cause shows and
removes the cause. And what a session must have read, run or checked
is measured by the environment from the transcript and the tree, the
way a cockpit checklist closes a sensed item by itself; that belongs
to the entrypoint.

Three chains show the pattern concretely. Comments became pipeline
steps; then they absorbed the combinators around them; then the
grammar needed a marker for the absorbed combinator, two variants of
the pipeline production, a side channel carrying the position of a doc
comment, a special case for the `as` operand, and tests for the scope
of attached docs. JSON containers became a second type; then a branch
was needed to preserve their shape through transforms; then tag
constructors had to be re-invoked after each transform; then a dynamic
import was needed to break the module cycle that created; then a
comment was needed to explain the import. Error identity lived in a map
field; then it moved to a hidden header; then the surviving uses of the
field were catalogued; then two drift tests and an injection script
were written to keep the catalog and the classes in agreement. Each
surgery treats the one before it.

In the last week of September the second version of this document
drove a series of repairs, each a branch read by the external reviewer
as a pull request and merged whole with its commits. Code became the
vector of its steps, which the language takes apart and assembles with
its own verbs, and `apply` came to take its subject first. Every step
became a command, the verb literal was chosen, and every text of the
repository and of the sister project was rewritten by machine into the
command form. One order came to rank every value and the comparators
left; JSON syntax came to read into the one map and the one vector; a
map's elements became its values; the set became the ordered vector
under its tag; every value received a kind; every condition was held
to a boolean; the terminal views moved to the command line, which
starts from a noun; the fields kept for an observability backend left
the errors; and a failure of the host came to carry a tag of the
language.

The third version drove the first milestone, and the catalog came to be
written by nouns. The core is the noun `::qlang`, whose page is the root
doc; a verb lives on the kind its subject names, is addressed through
it, `::vec/count`, and is found by walking the subject's tags; a
keyword names a binding of its scope, `env` answers the session's own
names, and a declaration writes the record of its binding into its
scope, which the axes read; a refusal lives on the place it guards, and
errors are of the kind `::error`. Beside them `within` came to edit
under a tag, a name that does not resolve to name its nearest
neighbours, and a text to read as its lines.

The fourth version drove the second milestone. An operand became a
verb, a quote under `::verb` whose leading declarations are its
signature, and the runtime came to execute the head of every verb of
the core and of every host before its body or its primitive runs, a
host handing the primitives of its verbs beside their source. A
declaration came to name the value its body answers once, `as` left,
and a name came to be declared once in a scope; a comment became
whitespace and a doc the literal in the slot of the declaration it
documents; every value came to come apart into its atoms and back. The
third milestone began: the trail of an error became the path it took,
an error the envelope on top of its value, an argument came to hand an
error on while a container keeps it, the forks of a sequence to run in
its order, and a tag in the subject position to dispatch to the noun
it names.

The fifth version drove the rest of the third milestone, the fourth and
most of the front door. The explanation of a value became a value of
its own kind, the page above what it explains, and an error the site
refused with a value of the kind of errors; `*` came to answer its
first failure and a set the vector of its images. The catalog came to
be told as a hypertext rooted at `::qlang`, the concepts of the
language members of that noun, every kind's page saying why it is
there; a name came to answer one page, read within by anchors, a link
to open a page, a snippet to show a query, a law to prove the claim
captioned above it, and a guessed name to lead to the names it was
near. The command line came to print an answer whole unless asked for
a budget, whose markers read what they left out, and to start its REPL
from a query. The loader became a verb of any value, the function
values, the dispatch wrapper and the descriptor applied as an operand
leaving with it; a parse error came to name the bracket a source left
open; and the catalog came to be laid out by the module of each kind,
whole, the kernel's refusals under the places they guard. What those
repairs left is what the scars below describe.

## The scars

The rest of the audit walks the scars in the order in which their
repairs depend on each other. Each section states the problem, shows it
running, and names what its repair must achieve; the decisions that fix
the direction are cited by number. Every probe can be reproduced from a
shell with the `qlang` command or in its REPL, and on 28 September 2026
every probe of this chapter answered as its block records.

### Refusals a host builds from the runtime

A host builds its refusals from the per-site error factories, imported
through the `operand-errors` and `errors` subpaths of the core
(`cli/src/io-operands.mjs`), so the factories stay an interface of the
runtime a host builds on. The sister project no longer imports them,
and carries its own copy of `fromPlain`, named `jsonToQlang`
(`cli/lib/jdt/coverage.impl.mjs`).

The repair must make the refusals of a host kinds its catalog declares,
so that nothing of the runtime is exported for building operands [D46].

### Modules that dissolve into their clients

A declaration writes the record of its binding into its scope [D63],
and a module has neither a record nor a value. `use` runs it and merges
into the client's scope the difference between the environment before
and after its steps, so a module exists at the moment of the merge and
dissolves in it: a helper written for the module's own definitions
lands in the client's scope beside the operands meant for the client,
and a module that loads another passes that module's names on as its
own. The language offers an underscore convention to which it attaches
nothing. The sister project's graph catalog uses no such convention and
is loaded whole into every session, so the helpers behind `@problems`
stand in its client's `env` beside `@problems` itself. In the sister
project:

```sh
$ node cli/bin/jdt q 'env | keys | inter #[:@problems :@problemsVia :@problemsForNodeVia :problemsInRangeOf]'
#[:@problems :@problemsForNodeVia :@problemsVia :problemsInRangeOf]
```

Every kind a module declares reaches the scope of its clients the same
way, so a head whose slots name kinds of their own [D60] multiplies what
a client's `env` shows until a module's surface is its own.

The verbs of the core live in the module of their noun, and the loader's
`use` among the verbs of any value [D72], [D113]. The command line's verbs live on its noun, `::qlang/cli`
[D92], and a host whose prefix is its own has no noun yet: the module
of that host lands its verbs in its client's scope beside the client's
own names, where the manifest answers nouns [D80]. In the sister
project:

```sh
$ node cli/bin/jdt q 'env | has :@type'
true
```

What the merge leaves behind is the runtime's housekeeping in the
environment: the export map of every namespace under a prefix of its
own, and the host's locator, a raw JavaScript function, under another,
which every reader of the environment filters. The prefix of the
runtime's own namespace of tags reaches what `env` answers, since a
kind the scope declares is keyed by it:

```qlang
> ::Width |~~ How many characters a line holds. ~~| | env | keys
#[:"::Width"]
```

And names collide, which the maintainer has named as the one worry the
design never resolved: «стремительно растущий зоопарк операндов меня
все время беспокоил и конфликты имен .. последнее так и осталось
неразрешенным до сих пор» (maintainer, 2026-09-23 07:02, session
86982eb5). The rule is decided [D23], [D34], [D62], and a host still
publishes names without a prefix. The sister project's names meet the
core's on `type` and on `source`, kept apart by the effect marker alone,
and its graph alone declares sixty operands, among them six lookups by
kind of element, four accessors of the containing element, four
enumerations by scope, some fifteen relations and four private helpers
of `@problems`. In the sister project:

```sh
$ grep -oE '^:@[A-Za-z]+' cli/lib/jdt/graph.qlang | sort -u | wc -l
60
```

That is the `ioctl` of Unix: every new capability a new verb in one
shared space. Plan 9 answered the same growth by keeping the verbs
fixed, the handful of operations of its file protocol, and letting the
nouns grow, every resource a path in a per-process namespace; a host's
catalog should grow the same way.

The repair must let a module decide its own surface without a keyword,
a module that ends in a map exporting that map alone and a module of
declarations exporting its declarations, so that helpers stay lexically
visible to the operands that use them and out of the client's scope
[D63]. It must keep what a module answers under its name in one loader,
from a tag to its provider to its declaration [D36], so that the
housekeeping keys leave the environment for values of their own. It
must write the catalog by its nouns, so a noun's verbs are read where
they are written [D62], [D67]. And it must hold the rest of the rule of
collisions:

- A verb and a kind may be joined by whoever owns one of them. This is
  the orphan rule of Rust and the rule against type piracy in Julia: a
  host may specialize a core verb on its own tags and may declare its
  own verbs, but may not redefine a core verb on the core's kinds. The
  rule separates the sister project's two collisions: `source` on its
  own node tags is allowed and resolves by the subject, while
  redefining `type`, the reader of identity every error handler and
  sort relies on, is not, and the node's kind moves into a field or a
  tag.
- Extensions are switched on lexically. Ruby's global reopening of
  classes broke libraries against each other until refinements made a
  patch active only where `using` names it; `use` is lexical, and a
  module's verbs for foreign tags are active in the query that uses the
  module and nowhere else.
- Names without a prefix belong to the core. EDN reserves its
  unprefixed tags for built-ins and requires every user tag to carry a
  prefix the user owns, a domain or a mark; CBOR's registry gives its
  short tag numbers only through a standard. JavaScript learnt the
  cost of the alternative when `Array.prototype.flatten` could not ship
  because an old library had already put a different `flatten` there,
  and the method became `flat`: a shared space of verbs that hosts can
  write into freezes the core out of its own names.
- One query shows every definition of a name and which one wins, as
  `type -a` does in bash.

Namespaces that are too large to bind become mounted [D24]. The sister
project's types are tens of thousands of names; they cannot live as
bindings in an environment map. A host serves a namespace lazily, the
way a file server was mounted into a namespace of Plan 9: a tag that no
binding knows is asked of the mounted namespaces in order, and the
first that knows it answers, with the order of mounting and the rule of
ownership settling any overlap. The core knows nothing about Java; it knows how to ask a
mounted namespace. With that, a Java type is a tag, written in Java's
own spelling so that the name has one spelling, copied from a stack
trace and pasted into a query:

```qlang target
> ::app.m8.web.servlet.gwt.orgstructure.functask.ConfirmFtNewEmpHandler | source
```

answers the type's source text, and `docs`, `spec` and the type's
relations work on it as they work on any tag of the catalog. The slash
is accepted inside a tag's name and the dot is not:

```qlang
> ::app/m8/web/Foo | type
::tag

> ::app.m8.web.Foo | type
::ParseError!{ … :found "." … }
```

The dot is unused elsewhere in the grammar, and after `::` it is
unambiguous, so admitting it inside a tag's name is a local change; a
quoted form, `::"…"`, like the quoted keyword, covers the characters
Java allows and an identifier does not, the `$` of a nested class
among them. A member of a type is no kind of value and is no tag: it
is a record under the host's tag that points at its type,
`::JdtMethod{:of ::app.m8.Foo :sig "bar(int)"}`, a value that prints,
reads back and resolves. And the sister project's sixty verbs shrink to
about a dozen: the lookups become the tag literal, the accessors of the
containing element become fields whose values are tags and therefore
links, the enumerations by scope become one verb over any containing
node, the relations become one verb with a map of options plus a few
named ones where the name carries meaning, and the helpers stop being
exported.

A namespace is also what an agent sees. Plan 9 gave every process its
own namespace and so decided what a program could reach by what was
mounted for it; a session, and a sub-agent inside it, is given the
namespaces its task needs, and focus comes from construction rather
than from being asked for.

### Errors named by their site

Every throw site in the runtime declares its own error class, and the
class name is a function of the facts the site records:
`AddLeftNotNumberError` is the operand `add`, position 1, expected type
number, and nothing else. There are more such classes than there are
operands, and the catalog carries a page for every one of them, so the
prose about errors outweighs the prose about the operands themselves.
The facts ride the declaration's `spec`, and the page says what they do
not, the procedure, what the place takes and how a reader writes it:

```qlang
> "hello" | add 1 !| type | spec
::builtin{:category :typeError :operand :add :position 1 :expectedType :number}

> "hello" | add 1 !| type | doc | content
 `add` adds numbers: a vector adds element by element, `* add 1`, …
```

The facts still spell the vocabulary of the runtime, `:operand`, a
position counted from one and a type as a keyword where a kind is a
tag.

Keeping the class names and the catalog in agreement requires a registry
of throw-site specifications, a stamping pass at bootstrap that runs
twice because there are two bootstrap paths, a test that checks six axes
of agreement, and two tables in the error
converter that spell the descriptor's field order and which fields are
identifiers.

The alerts themselves are lit, where the cockpit wants them dark. An
error carries its whole input, so one failing step over a large value
prints the value:

```qlang
> ::vec | spec | add 1 !| /trail * /subject * eq (::vec | spec)
[true]
```

The path of an error carries the subject of every level it left
[D85], so the same failure one verb deeper prints the value twice:

```qlang
> :g ::verb~(add 1) | ::vec | spec | g !| /trail * /subject * eq (::vec | spec)
[true true]
```

A slot of a verb that meets an error hands it on unchanged, as the law
of nested errors asks [D13], [D68], the namespace `use` computes at the
call among them, since the loader is a verb [D113]:

```qlang
> use (!{:k 1}) !| type
::error

> 1 | add (!{:k 1}) !| type
::error
```

The ring of atoms [D42] stays open at one example of the catalog: an
error literal whose trail is no vector of stops is a step that `raise`,
the one verb that builds an error from its fields, refuses to build,
since the error a step produces carries its path there [D82], [D85].

```qlang
> ~(!{:kind :oops :trail 5}) * (!| raise !| type)
[::ErrorTrailNotVecError]
```

The library of error-handling pipelines, retry and recover and assert
and their kin, left the package: after `!|` each of its verbs is a line
of the core, and the pages of `::error` and `raise` hold those lines as
examples [D102].

The repair must keep error identity per site and declare it once [D7],
[D46]: each site's tag is a kind declared in the catalog beside its
operand, whose schema owns the site's fields in the order a reader needs
them and whose document is the site's procedure; the throw site passes
the facts, and the tag's constructor checks them. A refusal names the
place it guards, and the place lists its refusals [D64], so the runtime
that checks a slot [D45] finds the refusal of that slot among those its
verb lists, by the position the refusal declares:

```qlang
> ::number/add | spec | /throws
[::AddLeftNotNumberError ::AddRightNotNumberError ::AddResultNotFiniteError]

> ::AddRightNotNumberError | spec | /position
2
```

It must hold one law for an error inside a nested evaluation, derived
from the fork rule [D13]: the error of a fork is its value, handed to
whatever ran the fork; the elements of a container keep it, the
elements and entries of a literal and the results of a distribute; an
argument of a step hands it on unchanged, whatever the kind of its slot,
and a key hands it to the operand that runs it [D87], so a selector
aborts on a failing predicate, a sort on a key that misses its field,
and an arithmetic step stops nesting one error inside another; and an
operand whose alternatives are pipeline slots, `coalesce` and its kin,
runs them in order and treats an error result as no value, which is
that operand's documented contract, so the misspelled field that becomes
the fallback is the price of asking for a fallback, paid where it was
asked.

It must make the document behind each tag a procedure. The page of a
site says, in this order, what the refusal means in one sentence, which
field of the descriptor names the culprit, the usual cause, how to
recover with `!|` as a runnable example, and the refusals it is often
confused with; the text that sites refusing for one reason share is
written once, which is the task that would ask for a hierarchy of tags.
It must print an error the way the cockpit shows an alert: the tag, the
facts of the site in the order of its schema, a short excerpt of the
input, and the rest one projection away, the tail being what elision
takes first.

### Self-description at full size

The full view is the default one, where the terminals of the paper age
made the cheap path the default and the full view a flag: the
declaration of a kind answers its verbs beside every refusal they raise.

```qlang
> ::vec | spec | keys
#[:impl :throws :verbs]
```

The pages of the refusals of the kernel speak the language's words:
the page of an unknown node of the tree says it is “a defect of the
runtime, and no failure of the query” (`core/lib/qlang/builtin.qlang`).
The names of some refusals still carry the runtime's,
`::PayloadSubjectNotTaggedInstanceError` and
`::EffectLaunderingAtBindStepParseError` among them, which the tags of
the sites as kinds rename [D46].

Examples live on two planes: the conformance suite and the laws of the
catalog, with a runner for each.
The catalog's own laws run in under a second and are the only plane the
language can reach, and most of them still stand under no caption of
the claim they prove [D124].

The repair must give the language views sized to a budget, the cheap
view the default [D27]. It must reduce catalog prose to what the facts
do not say, written in the language's own vocabulary, with no name of a
file, a symbol, a service or a section of another document in it. It
must make examples live on one plane, and print errors and parse
failures economically, with the full value reachable by projection
rather than dumped.

### The documents that retold the catalog

The reference and the evaluation-model document held more than half as
many lines as the code of the core and restated the catalog, their
REPL pairs true because a runner executed them and their prose and
tables false in places, because nothing did: a missing key answering
`null`, a built-in without arguments answering its descriptor, a
grammar with no quote, tag, doc or binding in it. The executable half
was true and the narrated half false, inside one document, which is
the argument for the principle of executable over narrated in the
project's own text. The reference was a tutorial rather than a
specification, as the maintainer put it: «это не спецификация, а скорее
референс, туториал» (maintainer, 2026-09-23 00:47, session 86982eb5).

Both left the tree with their runner [D128]. What they said that the
catalog did not stands as laws of its pages: the lexicon of each
literal on the page of its kind, and on the pages of `::qlang`, in the
order the concepts rest on each other, the layout of lines and
comments, the fork rule and the scopes, application and the slots of
code, the effect marker, the recursion of a verb and its budget, and
the path of an error across a raise. The embedding API is the page of
the package, `core/README.md`. The documents left are the measure and
the decisions:

```sh
$ git ls-files --error-unmatch 'docs/*.md' | grep -v decisions
docs/qlang-audit.md
docs/qlang-entrypoint.md
```

What remains of the scar is the editor's hand-written TextMate grammar,
a second spelling of the grammar beside the parser.

### Host concerns inside the core

Effect markers are a naming convention: an identifier that begins with
`@` is effectful, a verb whose body mentions an effectful name must be
declared under a name that carries the marker, and the evaluator checks
this at declaration and at call [D69]. The core has no effectful operand of
its own; every one belongs to a host. The flag rides on every node of
the parser's tree that names something, and the guarantee it offers is
incomplete, because an effect handed as code runs under a
clean name:

```qlang
> :run ::verb~(:code ::quote | apply code) | "leak" | run ~(@out)
leak
```

A raw-mode line editor and its tests are the largest single piece of
the command-line workspace, and the REPL it serves cannot save a
session, which is to save as the source of its declarations [D30]. The noun of a project's
`.qlang/` folder waits for the modules [D37]. The sister project's query
command reimplements the parse-error descriptor by hand
(`cli/src/commands/query.mjs`, `parseErrorToValue`), and it onboards its
user with a static guide.

The repair must remove the effect marker from the language rather than
relocate it [D2]: a naming convention would keep every `@`-name a
different name from its plain twin, so that reading its documentation
means remembering the sigil, and the core has no consumer of purity,
since it neither reorders nor caches nor optimizes by it. A host whose
operand reads an index or throws dice marks the provenance of the value
it returns with a tag, which the language already has, so provenance
moves from the source name onto the value. A tag can describe an
effect as well, a write the host is to perform, and there the lesson
of YAML applies: PyYAML's `load` executed code while reading, because a
tag like `!!python/object/apply` called a constructor with a side
effect, and a family of vulnerabilities followed until `safe_load`
became the norm. A tag's constructor is pure; reading or constructing a
literal performs nothing; an effect described by a value is performed
by an explicit step at the host boundary and by nothing else.

A host's operands are then named as the core's are, under the rule of
collisions [D23], and the marker leaves with the host's verbs moving
onto its tags: without it the sister project's `@type` and `@source`
become `type` and `source`, and a module's names in a client's scope
win over the core's there [D62]. Selecting an operand by the tag of its
subject is the walk of its tags [D34]. Whether an effect deserves to
become a value of its own, an action awaiting the host the way a quote
awaits `apply`, is a question for a later branch that would have to
show a task no plainer construct solves. The repair must also give the
sister project a guide generated from the catalog.

### Code that explains itself

The code is more commentary than design. The ratio of comment lines to
code lines over the JavaScript of the core, the command line and the
language server, in the tree and then in the September master:

```sh
$ git ls-files --error-unmatch 'core/src/*.mjs' 'cli/src/*.mjs' 'lsp/src/*.mjs' | xargs cat | awk '/^[ \t]*\/\// {c++; next} /^[ \t]*$/ {next} {k++} END {printf "%.1f\n", c / k}'
0.4
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

The rest of the scar is duplication the other sections name only in
part:

- Two codecs for one value, and no third. The literal and its parser
  carry every value, which one query hands another over a pipe as
  `print | @out` and `@in | parse | open`; the lossy JSON of the
  boundary is `toPlain` and `fromPlain` in
  `core/src/runtime/format.mjs`. The tagged JSON and the session
  envelope left the package:

  ```sh
  $ node --input-type=module -e "const core = await import('./core/src/index.mjs'); console.log(Object.keys(core).filter(name => /TaggedJSON|serialize/i.test(name)).length)"
  0
  ```
- One loader of modules: `use` through a locator
  (`core/src/runtime/use.mjs`, `resolveNamespaceEnv`), which the
  bootstrap of the catalog calls too; the resolver of module directories
  that tests alone used has left the package. It computes a module's
  surface as a delta of the environment.
- An embedding surface that was never designed. The package's entry
  point re-exports the runtime's internals by name, the Symbol slots of
  the headers and the prefixes of the environment's housekeeping keys
  among them, and the package exposes subpaths for the error
  factories, which is what hosts build on:

  ```sh
  $ node --input-type=module -e "const core = await import('./core/src/index.mjs'); console.log(Object.keys(core).filter(name => /SYMBOL|SLOT|PREFIX|KEY/.test(name)).join(' '))"
  EFFECT_MARKER_PREFIX MODULE_NAMESPACE_PREFIX RUNTIME_LOCATOR_KEY TAG_BINDING_PREFIX TAG_HEADER_SYMBOL
  $ node -p "Object.keys(require('./core/package.json').exports).filter(path => /error/.test(path)).join(' ')"
  ./errors ./operand-errors
  ```

The repair is a property of every branch [D30]. A branch leaves every
file it touches with comments that state what holds in one sentence,
moves every reason it finds in a comment into the record of the
decision it belongs to or deletes it with the compromise it excuses,
and replaces every false comment with nothing. The literal becomes the
one lossless format: a descriptor prints with its tag like every other
tagged value, tagged JSON and the session envelope go, a session saves
as the source of its
declarations, since a module prints as it is written, and JSON remains
the lossy codec of the boundary. One loader remains, the catalog being
a module loaded like any other. The embedding surface is designed with
the argument model: a session, a module as `{ source, impls }`, the
parser, the printer and the JSON codec, and nothing of the runtime's
internals. The unused session surface goes. The consumers read the
catalog's declarations and the parser's tree and keep no rule of their
own. The ratio of comment lines to code lines is measured on every
branch against the baseline and falls.

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
and three of the five convention checks exist to guard duplicates.

The repair must replace the coverage number with a policy that keeps
the threshold for the language core and a no-number rule elsewhere;
must treat the
conformance cases as the requirements of the language and the unit
tests as scaffolding that goes with what it scaffolds; and must delete
each guard together with the duplicate it guards.

## Decisions

A decision is the discussion with its choice and its circumstances, and
each lives in a file of its own under `docs/decisions/`, written once;
a citation of its number in this document is a link to that file, and
the requirements it left are the conformance cases that name it [D58].
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
any payload; its declaration is its schema or its constructor and its
document [D6]; a value under a tag obeys the tag's invariant, checked
when the value is built and again after every transform whose
declaration keeps the tag, `within` editing under a tag and checking
once at the rewrap [D41]; every value comes apart into its atoms and a
shape and is built back from them [D42]. The set, the error, the quote,
the doc, a host's record and the elision marker are all this one thing:
`#[…]` spells the set, `!{…}` an error, `~(…)` code, `|~~ … ~~|` a doc
over its segments, and each keeps its own token in the editor while the
runtime holds one mechanism behind all four. Every value has a kind, and
a literal without a tag has one of the core's, which its brackets imply
[D32]; a kind carries the value's constructor, its JSON form, its order
and its laws, while one rule of the core prints every literal [D33].

One mechanism of operand. An operand is a declaration of its subject,
its slots with their kinds, its result and its doc, and the runtime
executes the declaration. A built-in, a host's operand and a declared
pipeline are called the same way, checked the same way, documented the
same way, and help for all of them, completion, the verbs that accept a
value, the next slot, the refusal's wording, is derived from the same
record. A verb is found by walking the subject's tags from the outside
in, down to the core's kind [D34]; a host's verbs sit on the tags it
owns, and a verb and a kind are joined by whoever owns one of them. A
query reads, and what writes stays a command of its host whose result
the query reads [D39].

One format. The literal is how a value prints, how it reads back, how
it travels between utilities, how a session is saved, how an example
and a trail are written, and how a dashboard is delivered. JSON is the
lossy codec of the boundary and nothing else.

Around those three the language reads as follows. A pipeline carries
values; code is a quote, written as such wherever it is passed. A step
is a command, a name and its modifiers as words, bare where the pipeline
delimits it, up to the end of its line, and in parentheses inside a
modifier or a literal, so parentheses mean one thing, a pipeline as one
word. A parameter holds a value, and so does every modifier, read by its
own form: code is a quote, `~(…)`, shortened to `~add` for a single
word, and nothing but `apply` runs it; an operand that runs code
declares a slot of kind code and applies what it receives, and a quote
handed over sees the names of its author [D43]. There is one binding
form, `:name value`: its body is evaluated once at declaration against
the current value and named as a value, a quote included, and a verb is
a binding whose value is a verb, a quote under `::verb` whose leading
declarations are its slots [D44], [D67]. A name is declared once in a scope. The
pipe is linear continuation and the binding is a branch to the side. A
verb runs when its name is mentioned, as a built-in does, so `apply` is
only for a quote held as a value, from a name, a parameter, `parse`, a
trail or a literal, and code moved into a declaration answers as it did
inline. A command without modifiers is the bare name and has no second
spelling. Comments are whitespace; documentation is a doc literal in the
binding's slot.

Maps and vectors are the only containers; JSON syntax is read,
normalized, and forgotten until the codec at the boundary writes it
back. A map's elements are its values and its keys are the shape that
travels with them, so one rule serves the record and the dictionary.
One order ranks every value, so anything sorts, and the set is the
vector in that order without duplicates. A predicate answers a boolean
or fails at its slot. An error carries the tag of its site, a kind
declared once whose schema puts the facts a reader needs first, and the
tag leads to the site's procedure. A nested evaluation that fails yields
its error as a value, and every operand treats that value by one rule.

A namespace is a subtree of names with the provider that answers for it,
a large one mounted and served on demand [D36]. A name typed bare
resolves nearest first, the declarations of its scope, then the verbs
of its subject, the core's names last, and a name with a path calls by
address without a search [D62]; a tag in the subject position is
dispatched to the noun it names, after the verbs of tag names, and each
step resolves by its own subject [D88], while values carry their
qualified tags [D35]; an axis with a name reads the member its subject
holds under it, the slot of a verb or the verb a noun holds [D88]; a
host sets up a query by the first value of its
pipe and nothing else [D37]. `use` brings a library's pipelines into
the user's names, and the environment the user sees holds only those.
A declaration writes into its scope the record of its binding, with its
name, its documentation, its source, the module it came from and its
value, so the axes are projections of the record [D63], and a verb a
declaration shadows stays one address away [D62]. A module is a
pipeline its provider runs once, and its value is what it exposes
[D63]. Effect markers are gone; a host that wants provenance visible
tags the value, and an effect described by a value is performed at the
boundary and nowhere else.

Fingerprints and terminal conveniences belong to hosts. So do the budget
of an answer, the elision of what exceeds it, and the enrichment of an
answer with the documents its tags and keywords lead to; the language
computes whole values, and every part of a value, a string, a quote and
a doc included, has a size, an address and a slice, so what a host left
out is the same query with a tail. A record that a host wants explained
carries a tag whose declaration documents its fields, and a value shared
across kinds carries a tag of its own, which documents it once [D50].
Code is a value, the quote, a vector of steps made of the language's
values with an involution to and from its text, so a query reads,
counts, transforms, and assembles code without leaving the language.

The catalog is the documentation. A root doc is the first thing a
session reads: what the language is in a sentence, what a tag is in a
sentence, how to discover with `manifest`, `doc`, `doc | laws`, and
`spec`, how to read an error, and a few seed pipelines that a grep
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
- Modules: one loader, from a tag to its provider to its declaration;
  namespaces as subtrees answered by providers, the core, the hosts and
  a repository's `.qlang/`; binding values with their origin; `use` for
  a library's pipelines.
- The host interface: a session; a module as `{ source, impls }`, the
  implementations plain functions over checked values; the parser, the
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

What leaves the tree, as the repairs land: the classes of errors with
their factories, the
registry of throw sites, the stamping passes and the converter's
tables; the primitive registry with its sealing; the effect marker and its checks; the character
scanner of doc text; the housekeeping keys of the environment; the error prose of the catalog that
restates the facts; the drift tests.

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
carries bytes, the default subject otherwise [D37], the budget and the
rendering at the end of the pipe, no `table`, no `template`. The
language server reads the declarations and the parser's tree and
nothing else. The editor's
grammar is generated from the grammar's tokens or reduced to what the
language server cannot give. The site renders the root doc and the
catalog or is reduced to the playground. The sister project builds on
the workspace copy, generates its guide from the catalog, tags its
nodes, mounts its types and its workspaces [D38], and speaks through
about a dozen verbs on its own tags, its writing commands staying
commands [D39]. And
the entrypoint of the work on qlang is a consumer like the others,
built on the language it helps to build.

## The route

The start is the tree of the baseline, commit `7319613`, and the finish
is the tree the previous chapter describes. What the earlier versions
drove has landed: the catalog written by nouns, a verb found by walking
the subject's tags and a refusal on the place it guards [D34],
[D61]–[D64]; the syntax and the mechanism of an operand, the command
form, the quote as the vector of its steps and the one binding form
[D4], [D5], [D43], [D44], [D57], [D60], [D65]–[D67]; the one order, the
containers, the kinds, the trail of an error and the law of nested
errors [D13], [D85]–[D87], [D97]–[D101], [D103], [D116]; the doc read as
its segments and the print of a value [D19], [D94]–[D96]; the loader a
verb, every refusal under its place and every kind whole in its module
[D112]–[D114]; and the front door's hypertext, its budget and its parse
errors [D107]–[D111], [D117]–[D125]. Between the baseline and the finish
lie the milestones below, each a state of the language followed by a
release [D29]. Under each the work is named in an order that
illustrates and binds nobody, and the answers that show a milestone
reached are the targets its decisions left in the conformance suite,
which answer otherwise until the work lands [D58].

### Milestone 4 · One spelling

Every fact has one spelling. What remains of it: the contracts
moving onto the kinds, a tag's declaration being its schema or its
constructor [D6], [D33]; the tags of the refusing sites as kinds with
their schemas and procedures, where the JavaScript classes of errors,
their factories, the registry of throw sites and the drift tests leave
[D7], [D46]; one loader that runs a module once, a pipeline whose value
is what it exposes, so helpers stay in their module [D63], with mounted
namespaces, each a subtree answered by its provider [D24], [D36], and
the rest of the rule of collisions, a verb and a kind joined only by
whoever owns one of them [D23]; the examples on one plane, and the
editor's grammar generated or reduced; and the
entrypoint of the work in its first version, the command that measures
the tree and prints the state of the work as a dark cockpit, whose
design is the entrypoint document's.

Its answers are the targets [D6], [D33] and [D46] leave in the
conformance suite when they are decided, the step of a constructor
apart from the kind of tagged values having landed [D115]. Beside them:
no factory-declared error class remains; no operand contract is spelled
outside the catalog; one query shows
every definition of a name and which one wins; a module's value is its
surface, so the sister project's helpers leave its client's `env`; and
the environment holds no key of the runtime's own.

### Milestone 5 · Front door

The measure can be taken as the mission states it. What remains of it:
a view takes its options beyond a few positional modifiers as one map
whose keys it declares [D40]; the catalog's prose is reduced to what
the facts do not say, every page telling what its name is for and the
claims its laws prove [D110], [D124]; errors print as alerts;
enrichment happens once per session; fields are documented by their
records' tags and shared values by their own [D50]; the sister
project's nodes carry their kind as a tag, its verbs move onto its tags
and its noun [D34], [D62], the noun's own verbs taking its name as
their subject [D88], its types are mounted, its verbs shrink to about a
dozen, and its guide is generated from the catalog [D24]; the effect
marker leaves the language with them [D2], since without it a host's
names meet the core's in a client's scope, where a module's names win
[D62]; the sister project's workspaces become nouns and its answers
name the workspace they came from [D38]; a host's command is the
language's with its noun as the first value [D37]; and the benchmark
runs [D26], each run recorded with the frictions it met and the first
screen written against them [D104], [D105], [D106].

Its answers in the conformance suite are the targets of [D7], [D107],
[D108], [D109], [D111], [D117], [D118], [D119], [D121], [D122], [D123],
[D124], [D125], [D127] and [D129]: the first screen and the
hypertext it opens, every one met. The others stand beside the suite: one
start command returns the root doc within four kilobytes; `:trail`
prints the same way on an error value and on its materialized
descriptor, where the error literal hides an empty trail and the
descriptor shows it; a renderer loads the documents of the tags and
keywords an answer carries that the session has not been shown, and
withholds the ones it has; the language has no effect marker and no
effect flag.

After the fifth milestone the remaining surfaces follow: the site is
decided, rendering the root doc and the catalog or reduced to the
playground, and the coverage threshold applies to the language core
alone, with the other workspaces under a rule without a number.

### How a branch moves

A branch repairs one scar or one part of one and names the decisions it
implements. It starts from the full set of places where its cause
shows, found by search rather than by memory, and its first commits
delete. The cases that confirm it are written before its code, red, and
the branch ends when they are green and nothing else turned red. Its
diff is negative in every area it touches, core sources, catalog,
documents, tests, or the branch introduces a model and says in its
description what the next branch deletes because of it. The files it
touches leave with comments that state what holds in one sentence
[D30]. A branch that works targets, a session's or a subagent's in a
worktree of its own, starts from a baseline whose suite is green and
carries its targets; it leaves the records, the cases and the gates as
it found them and drops only the mark of a target it met, and the
baseline's copy of `node scripts/gate-diff.mjs --task Dnn` names for
the review every move it made on them [D59]. A design question that appears during a branch is decided in
this document on master before the branch goes on; an implementation
session decides nothing silently, since a decision taken in code is a
decision no one will find. What confuses a session on the way is
settled where it is met, fixed when the decisions already choose the
fix and otherwise recorded with its probe as a target, a decision or a
question [D89]. The sister project receives every breaking change in
the same move.

A session is one of three kinds. A design session talks, decides, and
updates this document; it reads this document, the sources the
instruction file names in its first tier, and the file under dispute.
An implementation session takes one scar, reads this document and the
files it touches, runs the tests, and ends with its cases green. An
audit session runs the probes and the metrics, checks each scar against
the tree, replaces every sentence the tree contradicts, and removes the
scars the tree no longer shows. Every session opens from the
entrypoint's computed state, or, until it exists, by reading this
document, running `git status` and the tests, and stating in one
paragraph where the work stands; it closes by writing into this
document what was decided, so that no decision survives only in a
conversation.

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

Hierarchies of tags. The walk of a verb down the subject's tags [D34]
knows no hierarchy between tags. When a task
wants one, Clojure's multimethods show the form: a hierarchy of names
built as data with `derive`, separate from any value, rather than
inheritance. The cost is a second axis of resolution; the gain is that
a host can say that every kind of its nodes answers a verb once. One
level of it is decided: the walk passes the `any` of the provider whose
path a tag names before `::qlang/any`, where a contract several of the
provider's kinds answer lives [D67].

The spelling and the mechanics of mounting [D24]. Admitting the dot
inside a tag's name is local to the grammar; the quoted form `::"…"`
mirrors the quoted keyword. A tag name is an address from the root of
the tree of names [D62], so a mount is a subtree whose provider the one
loader asks for a tag no binding knows [D36], and `manifest` lists the
mounted namespaces beside the other nouns [D61]. Open: how a module
declares that it serves a namespace, and the exact record of a member.

What a module of declarations answers [D35], [D63]. D63 has a module
answer the Map of what it exposes, `env` as its last step exposing
every name it declared, and sets aside a value taken from the scope
when the module ends in a declaration. Written out on the catalog, the
rule gives each of its two dozen modules of declarations the tail
`| env`, which after a tag declared without a body needs a pipe of its
own, since `env` on the next line reads as the tag's body; and a module
run in a scope of its own needs the kernel's `use`, `env` and
`::builtin` as a provider under a key of the runtime until the catalog
documents them. The maintainer read both as a sign of a step taken too
early: «странно это смотрится | env  .. как и 'qlang/kernel'»
(maintainer, 2026-09-25 15:37, session 86982eb5). The other reading is
D35's: a module runs from its provider's noun in the subject position,
its declarations hand the noun on, and a module of declarations
answers its noun, whose namespace holds what it declared, so a tail
serves only a module that exposes a part of its names, `env | minus
#[:helper]`, or data. The tail costs a ceremony on every module of
declarations; the noun costs a noun for every provider, the core's
modules and the sister project's among them, and the loader of the
fourth milestone that keeps their namespaces. A third reading is the
maintainer's: «в целом выходит что между модулем и спекой может и
разницы особой нету .. это соглашение про имена ..  а такое навеное тэг
может проверять в конструкторе..» (maintainer, 2026-09-25 18:52,
session 86982eb5). A module is a pipeline of declarations, prose alone
among them, «там какой ::qlang/vocabulary ::qlang/tutorial», whose doc's
keywords name its own bindings [D62]; read as data, as a quote of
declarations is [D53], it answers its declarations, which needs neither
the tail nor the noun, and a tag over it names the convention its names
follow and checks it in its constructor [D6]. A module that computes
while it loads [D63] answers the spec its pipeline builds.

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
answer, `@members * @callers` on `java.lang.String`, pays a round trip
per element, and its elements now run in their order [D84]. The
maintainer's direction is the other end: «само qlang выражение мы будем
отправлять через jdt в сам эклипс и пусть его процесс считает ... и
тогда не надо все эти ресты выставлять в апи, для выдергивания данных»
(maintainer, 2026-09-26 06:10, session 86982eb5). The query then runs
where the data lives and only its answer crosses the boundary; the cost
is a JavaScript engine inside the host's process, since the core is
JavaScript, and a session whose scope lives in two processes. The
alternative keeps the evaluator in the client and gives the host
operands that take a vector whole and bound their own calls.

The test for null. Whether `eq null | not` earns an operand of its own
is a question the benchmark answers under the rule of the catalog
[D22].

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
of a doc, its prose apart from its runnable quotes, and a name to reach
a page by [D88]; the prose of a module is a plain comment that no name
reaches, and a tag or a keyword inside prose is no segment yet [D19].
The site waits for the syntax: «пока синтаксис не начнет мне самому
нравиться» (13:23). A tutorial that serves is also how the documents
that retell the catalog leave: «и если интерактивный туториал
действительно станет хорош, то тогда все эти референсы и прочие md
файлы наконец можно будет удалить за ненадобностью», and «но сперва UIX
в вебе и UIX в терминале нас должен удовлетворять» (13:26). The
documents left before such a tutorial, by the maintainer's later word,
their facts moved into laws of the catalog's pages [D128].

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

A constructor that tags its own result [D53]. `tag` runs a tag's
constructor, so a constructor written as a quote that tags its own
result through `tag` recurses until the depth budget refuses it. «c
рекурсией на конструкторе таг да не подумали.. можно и потом вернуться
или тебя самого может озарит как надо было правильно решать в процессе
другой работы» (maintainer, 2026-09-24 03:05, session 86982eb5). The
alternatives are a constructor that answers the payload it accepts while
the runtime puts the tag on, which needs no change and leaves the
self-tag a recursion like any other; `tag` inside a constructor of the
same tag stamping without running it again, which is a rule of dynamic
scope; and a refusal that names the self-tag at its second entry, which
is one more check on every constructor. It returns where the contracts
move onto the kinds [D6], [D33].

A literal that holds an error a word answers [D87], [D103]. `*` answers
its first failure, and a literal still keeps one, so
`[1 ("x" | add 1)] | count` answers `2`, and a failure inside a map a
step builds reaches the answer as data:

```qlang
> [1 ("x" | add 1)] | count
2
```

The alternatives are a literal that answers the first word that fails,
which refuses the step of an error literal inside a quote, since a
quote read as its steps holds that step as the error it spells [D86],
and the ring of atoms builds a quote from the vector of its steps
[D42], so it waits on what such a step is as data; the step of an error
literal read as the error unraised, `::error{…}`, which lets a literal
fail and a quote be built from its steps at the price of what `first`
answers on a quote today; and the literal as it is, whose failure
reaches the command line, which refuses it under JSON [D103].

The entrypoint. Where the modules of the work live, how the start
command measures the tree, the schema of the dashboard, how hooks call
it, how the state of what a session has been shown is kept, how sensed
items are computed, and how the maintainer's intent enters the task:
all of it is the subject of `docs/qlang-entrypoint.md`, and the
maintainer wants to explore it before it is fixed.

[D1]: decisions/D1.md
[D2]: decisions/D2.md
[D3]: decisions/D3.md
[D4]: decisions/D4.md
[D5]: decisions/D5.md
[D6]: decisions/D6.md
[D7]: decisions/D7.md
[D8]: decisions/D8.md
[D9]: decisions/D9.md
[D10]: decisions/D10.md
[D11]: decisions/D11.md
[D12]: decisions/D12.md
[D13]: decisions/D13.md
[D14]: decisions/D14.md
[D15]: decisions/D15.md
[D16]: decisions/D16.md
[D18]: decisions/D18.md
[D19]: decisions/D19.md
[D20]: decisions/D20.md
[D21]: decisions/D21.md
[D22]: decisions/D22.md
[D23]: decisions/D23.md
[D24]: decisions/D24.md
[D26]: decisions/D26.md
[D27]: decisions/D27.md
[D28]: decisions/D28.md
[D29]: decisions/D29.md
[D30]: decisions/D30.md
[D31]: decisions/D31.md
[D32]: decisions/D32.md
[D33]: decisions/D33.md
[D34]: decisions/D34.md
[D35]: decisions/D35.md
[D36]: decisions/D36.md
[D37]: decisions/D37.md
[D38]: decisions/D38.md
[D39]: decisions/D39.md
[D40]: decisions/D40.md
[D41]: decisions/D41.md
[D42]: decisions/D42.md
[D43]: decisions/D43.md
[D44]: decisions/D44.md
[D45]: decisions/D45.md
[D46]: decisions/D46.md
[D47]: decisions/D47.md
[D48]: decisions/D48.md
[D50]: decisions/D50.md
[D51]: decisions/D51.md
[D53]: decisions/D53.md
[D55]: decisions/D55.md
[D56]: decisions/D56.md
[D57]: decisions/D57.md
[D58]: decisions/D58.md
[D59]: decisions/D59.md
[D60]: decisions/D60.md
[D61]: decisions/D61.md
[D62]: decisions/D62.md
[D63]: decisions/D63.md
[D64]: decisions/D64.md
[D65]: decisions/D65.md
[D66]: decisions/D66.md
[D67]: decisions/D67.md
[D68]: decisions/D68.md
[D69]: decisions/D69.md
[D70]: decisions/D70.md
[D72]: decisions/D72.md
[D73]: decisions/D73.md
[D74]: decisions/D74.md
[D75]: decisions/D75.md
[D76]: decisions/D76.md
[D77]: decisions/D77.md
[D78]: decisions/D78.md
[D79]: decisions/D79.md
[D80]: decisions/D80.md
[D81]: decisions/D81.md
[D82]: decisions/D82.md
[D83]: decisions/D83.md
[D84]: decisions/D84.md
[D85]: decisions/D85.md
[D86]: decisions/D86.md
[D87]: decisions/D87.md
[D88]: decisions/D88.md
[D89]: decisions/D89.md
[D92]: decisions/D92.md
[D93]: decisions/D93.md
[D94]: decisions/D94.md
[D95]: decisions/D95.md
[D96]: decisions/D96.md
[D97]: decisions/D97.md
[D98]: decisions/D98.md
[D99]: decisions/D99.md
[D100]: decisions/D100.md
[D101]: decisions/D101.md
[D102]: decisions/D102.md
[D103]: decisions/D103.md
[D104]: decisions/D104.md
[D105]: decisions/D105.md
[D106]: decisions/D106.md
[D107]: decisions/D107.md
[D108]: decisions/D108.md
[D109]: decisions/D109.md
[D110]: decisions/D110.md
[D111]: decisions/D111.md
[D112]: decisions/D112.md
[D113]: decisions/D113.md
[D114]: decisions/D114.md
[D115]: decisions/D115.md
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
[D126]: decisions/D126.md
[D127]: decisions/D127.md
[D128]: decisions/D128.md
[D129]: decisions/D129.md
