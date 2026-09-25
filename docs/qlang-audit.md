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
from #42 to #52, and is frozen in commit `32db75c`. This third version
holds the text against the tree those repairs left: a scar the tree no
longer shows has left the document, and what remains of a scar is
stated as it stands. `git diff 32db75c -- docs/qlang-audit.md` shows
what changed, and the message of the commit that wrote this version
tells what the repairs did.

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
typed into `qlang` and whose other lines are what the tree answered on
the date written before the block; a probe that begins with `$` is a
shell command. A block fenced as `qlang target` shows the answer a
repair must produce, so it disagrees with the tree until the repair
lands. An anchor names a file and a symbol, `core/src/eval.mjs` and
`applyConduit`; line numbers drift and are avoided. Evidence goes
stale, and the only defence is to run it: a probe whose answer changed
means the sentence around it is wrong, and the sentence is replaced by
the new fact with its new probe.

A decision is a choice between alternatives. Decisions are numbered,
`D1` to the last, and recorded in the chapter of decisions [D31], one
record each: what was decided, who decided it, the source, what it
rests on, and the alternatives set aside with the reason. The source of
a decision the maintainer took is the maintainer's own words, quoted
verbatim in the language they were written in, slips of typing
included, an elision marked […], with the time in UTC as the transcript
records it and the prefix of the session whose transcript holds the
conversation around them. The maintainer's words stand in «…»
everywhere in this document, and words quoted from the tree stand in
“…” beside their anchor, so a script can hold the first against the
transcripts and a grep the second against the tree. The source of a
decision the model took says so, and says what request it answered.
Other chapters cite a decision by its number. A decision changes by a
new record that names the one it replaces; the old record stays,
marked replaced, so the chain of reasons survives.

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
  stale the week after, as the weight of `manifest` did. The number
  lives in a probe next to the command that recomputes it, and the
  prose states what the number shows.
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
  paraphrase. A short script over them finds the maintainer's words on
  any topic, and the entrypoint document carries one that checks every
  quote of a document against them. When a record's quote is not
  enough, the transcript around it is.
- Before the first claim about the language, a session reads the
  sources the instruction file names in its first tier, whole. The
  file-reading tool cuts a read at its token cap, and the transcript
  stores every read with the lines it returned and the lines the file
  has, marking a cut read with `truncatedByTokenCap`; a read that
  stopped there did not read the file, and the entrypoint document
  carries the script that measures what a session has read.
- Nothing here is condensed or deleted without the maintainer's word,
  except a sentence that the tree proves wrong, which is replaced by
  the fact and its probe.

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
against the September 2026 master, commit `f5e8ec8`, the diff is
negative in the core sources, in the catalog, in the documents, and in
the tests. This document and the entrypoint document stand outside
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
the language reference, then the catalog and the conformance cases,
then the tools, then the process. A lower text does not contradict a
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
and keeps a per-element error as a value inside the result; `!|` is the
only combinator that fires on an error, and `|` and `*` step around it
[D51]. Parentheses, vectors, maps, sets, and error literals all obey one
fork rule: the inner pipeline starts from the outer state and returns
only its value, which is where every scoping rule in the reference comes
from. A literal is a step that replaces the value, and the values it
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
value with a tag and a descriptor; its trail is a quote of the steps it
skipped, and applying that quote to a fresh subject replays them. A
quote is code as a value, a doc is prose as a value, and a tag names the
kind of a value and is stamped on it without changing its shape. The
catalog is qlang source: every operand is a binding with prose and
examples, four axis operands read a binding's source, prose, examples,
and declared facts, `manifest` enumerates what exists, and `runExamples`
executes a binding's examples as tests. The self-test over the whole
catalog runs in under a second.

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
docs` can ask the kind for its document. Behaviour is kept out of the
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
clauses. The session controls the detail of an answer. An answer never
exceeds a budget. When the whole answer would have exceeded it, the
answer says what was left out and how much of it there is. And the
session can read what was left out, all of it or a part, through the
same pipeline that produced the answer. Work begins with one start
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
- The cheap path is the default. `head` prints ten lines, `ls` does not
  recurse without a flag, and a job card declared its limit of printed
  lines together with what to do when the limit was reached. The full
  view is an explicit request.
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
::CountSubjectNotContainerError!{ … :actualType ::string }

> "a\nb\nc\nd" | split "\n" | drop 1 | take 2 | join "\n"
b
c
```

A quote has all three, being the vector of its steps [D53], and a doc
offers its content and its segments and no more, so the guide itself
cannot be read in pieces. On 25 September 2026:

```qlang
> ~(add 1 | mul 2) | take 1
~(add 1)

> |~~ a ~(add 1) b ~~| | count !| type
::CountSubjectNotContainerError
```

The pageable shape is the vector, and a value that can overflow has to
break into one, as the quote has: a string through its lines, a doc as
the vector of its segments [D19].

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
`docs` on the operand answer for one operand what a schema sheet would
answer for all. The result of a verb is the kind its head declares
last, a declared verb's and a built-in's alike [D57]; the fields are
declared with the tag, and the element shape of a container is spelled
as the container's literal around the kind, `[::Method]` for a vector of
methods. Last, everything prints as what it is, code included, because
an elided and enriched page travels on.

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
language. What those repairs left is what the scars below describe.

## The scars

The rest of the audit walks the scars in the order in which their
repairs depend on each other. Each section states the problem, shows it
running, and names what its repair must achieve; the decisions that fix
the direction are cited by number. Every probe can be reproduced from a
shell with the `qlang` command or in its REPL; a probe without a date
answered so on 14 September 2026, the command form rewrote the query of
every probe on 24 September 2026, and on 25 September 2026 every probe
of this version answered as its block records.

### Arguments that move with the subject

A named pipeline with parameters binds each parameter to the
expression written at the call site, and that expression is evaluated
against whatever the pipeline value is at the moment the parameter is
read inside the body. With a literal argument the difference is
invisible:

```qlang
> :m [:x] (mul 10 | add x) | 2 | m 3
23
```

With an argument that reads the subject, the parameter follows the
subject as the body transforms it:

```qlang
> :m [:x] (mul 10 | add x) | 2 | m /
40
```

The author of that call expected 22. The same rule makes the natural
recursive factorial wrong:

```qlang
> :fact [:n] (if (n | lte 1) ~(1) ~(n | mul (fact (n | sub 1)))) | 5 | fact /
40
```

It answers 120 only when the recursive call passes `/` rather than an
expression built from the parameter, which is why every recursive
example in the catalog recurses through the pipeline value and none
through a parameter.

The rule survives for a declared pipeline alone. A modifier of a
built-in is evaluated at the call against the subject, and a slot the
catalog declares of a code kind takes a quote and refuses any other
value [D56], so the reference's chapter on binding became its chapter on
commands and their modifiers (`docs/qlang-spec.md`). A declared pipeline
has no way to say whether an argument is a value or a piece of code, and
so treats every argument as code. Around this sit seven dispatch
wrappers in `core/src/runtime/dispatch.mjs`, one per calling shape, a
family of arity error classes for the predicates that dispatch on a
parameter count, and a second calling convention,
`invokeConduitWithFixedArgs`, that hands a named pipeline fixed values;
each slot of code asks `codeOfModifier` in `core/src/eval.mjs` for its
quote.

The catalog declares a slot vocabulary for every operand, and the
runtime reads none of it, so the declarations are free to be wrong,
and they are. On 23 September 2026:

```qlang
> :gt | spec | [/subject /modifiers]
[:number [:number]]

> "a" | gt "b"
false

> :runExamples | spec | /subject
:map
```

`gt` is declared for numbers and compares strings; `runExamples` is
declared for maps and takes a keyword. The mission's third requirement,
that the shape of an answer can be known before it is fetched, reads
these declarations, and today it reads something false. Executing the
declaration is the only thing that keeps it true.

The declarations speak keywords where the values speak kinds: `type`
answers a tag for every value [D32], while the catalog declares the
subject, the slots and the result of an operand with keywords, and the
page of a refusal names the kind it expected with one. On 25 September
2026:

```qlang
> 1 | type
::number

> :add | spec | /subject
:number
```

The kinds move into the declarations with the kinds of the slots
[D45].

Whether a transform keeps its subject's tag at all is an option of the
operand's implementation, `preservesTag`, which `applyTagPreservation`
in `core/src/runtime/dispatch.mjs` reads, and a second option there,
`imposesOrder`, lets `sort` and `reverse` answer a vector over a set,
as D16 asks. Neither is a fact of a declaration, so an edit of a
tagged map keeps the tag or loses it by which implementation set the
flag, and the loss is silent:

```qlang
> ::T{:a 1 :b 2} | filter ~(eq 1) | type
::T

> ::T{:a 1} | union {:b 2} | type
::map

> ::T{:a 1} | payload | union {:b 2} | tag ::T
::T{:a 1 :b 2}
```

The kind of an operand's result belongs to its declaration [D4, D41].

A quote held as data carries no environment, so a parameter of the
body that receives one captures a name of the caller, where an
argument of today's lazy form is read in its author's environment:

```qlang
> :x 10 | :t [:f :x] (f) | 2 | t (add x) 99
12

> :x 10 | :t [:q :x] (apply q) | 2 | t ~(add x) 99
101
```

A quote written as a modifier carries the environment of its call and
one written as the body of a binding that of its declaration, so code
handed to another pipeline sees the names of its author wherever it is
applied [D43, D44].

The wrappers are also the host's interface. The command line's I/O
operands and every operand of the sister project are built from
`nullaryOp`, `valueOp` and `overloadedOp` and from the per-site error
factories, imported through the `dispatch` and `operand-errors`
subpaths of the core (`cli/src/io-operands.mjs`, and
`cli/lib/jdt/graph.impl.mjs` in the sister project, which also carries
its own copy of `fromPlain`). Deleting the wrappers is therefore a
change to every host, and the argument model is where the interface of
a host operand gets designed rather than inherited.

The repair must make a parameter bind a value, make code an explicit
quote at the call site, and make the kind of every slot a declaration
the runtime reads, so that the catalog's slot vocabulary stops being
decoration [D4, D43, D45]. An operand is then a declaration, whatever
implements it: the tag or the type of its subject, its slots with their
kinds, code among them, the tag or the type of its result, and its doc,
written in the head of its literal [D57]. The runtime executes the
declaration: it checks the subject and every slot before the
implementation runs, a slot of kind code taking a quote and nothing
else, and it checks the result. A built-in, a host's operand and a
declared pipeline share one convention, and the seven wrappers go with
the arity classes. A host operand becomes a plain function over values
the runtime has already checked, handed to the core as `{ source, impls
}` where the source is the catalog module that declares it; nothing else
of the runtime is exported for building operands.

The vocabulary carries the calling shape as well as the kind. A
predicate, a key and a pipeline slot run their code against one subject.
A reducer slot holds two values for the code it runs: it runs it against
the accumulator and supplies the element as a trailing modifier to the
code's last step, the way `xargs` completes the command it was given.
The completed step is always applied with the subject as its first
operand, so code that has already spent its modifiers is refused by
arity and never turns into a full application; the canonical fold is
`reduce 0 ~(add)` [D43], whose slot today finds `add` by the name its
quote holds [D56], and a reducer that wants the element anywhere but
last is declared with a parameter one step earlier in the same query. A
declared pipeline's parameters are values, and its body applies one that
holds code, `:twice ~[:f](apply f | apply f)`, so the tilde says one
thing wherever it stands: this is code, and only `apply` runs it. The
main live use of lazy parameters, a key function handed down through
several layers of pipelines, keeps its shape: the reference's `:@topBy
[:keyFn :n] (sort ~(keyFn) | reverse | take n)` receives its key as a
quote that carries its caller's environment and hands it on as a value.

A condition answers a boolean or is refused at its site [D14], and a
predicate's own error is the answer of `filter`, `every`, `any` and
`cond`. A value slot, a condition computed at the call among them,
refuses an error value by the tag of its own site, where the one law
for nested errors hands the error on unchanged; the law comes with the
kinds of the slots [D13].

The declaration is also where help comes from. Once the runtime reads
the slots, completion in the editor, the list of verbs that accept a
value, the name and kind of the next modifier, and the wording of an
arity or kind refusal are all derived from the same record, the way
TOPS-20 derived its `?` and its guide words from the syntax a program
declared. The language server finds the active parameter among the
modifiers the parser gives the command (`lsp/src/features.mjs`,
`signatureHelpAtOffset`) and labels them from the descriptor's
`:modifiers`; it reads the slot record once the runtime executes one.

### Two ways to name a thing, and comments that are steps

A value can be named by the `as` operand, which freezes the current
value under a name, or by the binding form `:name body`, which binds an
expression. The two are not interchangeable: the binding form cannot
freeze the current value, because its body is re-evaluated at every
use, and `as` cannot bind code. The wrapper that `as` produces is
transparent to lookup, so it is unwrapped wherever a binding is read,
across the evaluator, the dispatch wrappers, the axes and `use`, and it
is the
reason the environment holds three kinds of binding, each serialized
and described differently. The binding form itself chooses between a
snapshot and a lazily evaluated body by inspecting the shape of the
body's syntax tree (`core/src/walk.mjs`, `isPureLiteralAst`), so the
distinction between value and code is decided by a predicate over
syntax rather than written by the author, and the language server
re-derives the same predicate to label a symbol. The tag-namespace form
of the binding adds a third declaration syntax.

Comments are the larger half of this scar. They are pipeline steps
that absorb the combinators on either side; a line comment eats to the
end of the line, so the closing marker shown in the reference is
cosmetic and swallows whatever follows it:

```qlang
> 1 |~| c |~| add(1)
1
```

A third of the grammar, counted in rules and in lines, exists to parse
four comment forms, their nesting, their absorption of combinators, and
their attachment to bindings as documentation; the pipeline production
exists twice, once with comments and once without, and the evaluator
carries two branches to step around them. A doc comment attaches only
to a binding; before any other step it is a parse error. Three
different syntax-tree nodes carry the same doc text depending on where
it stands.

The repair must leave one binding form, in which a body is evaluated at
declaration and named as a value, a quote included, and a verb is the
same form with a conduit for its value, `~[slots](body)`, which retires
`as` and the snapshot wrapper [D5, D44, D57]; must make comments trivia
at the level of whitespace; and must give documentation its own slot
with its own literal, which doc already is: the doc form `|~~ … ~~|` is
that literal today, a standalone doc value anywhere and the
documentation of a binding when it stands between the name and the body,
and only the plain forms become whitespace. Each role of `as` has its
spelling in that form: freezing the current value is a binding whose
body is `/`, aliasing an operand is a verb whose body is the call, `:len
~[](count)`, naming the element inside a group is the same freeze inside
the group, and freezing a parameter goes with values by default. The
sister project is the largest user of `as`, almost always to name the
subject inside a group, and its lines are where the marker's spelling is
tried. The form flips one spelling the other way: today's `:inc add 1`
declares a pipeline because its body is a command, and under the one
form a bare call body is evaluated at declaration, so every pipeline
declared in the catalog's examples, in the tests and in the sister
project gains the verb literal, `:inc ~[](add 1)`, in the same branch.

Today's binding is lazy, so code moved into a declaration further left
answers as it did inline, even when it reads the subject:

```qlang
> {:items [1 2 3] :limit 2} | /items | take (count | sub 1)
[1 2]

> {:items [1 2 3] :limit 2} | :most (count | sub 1) | /items | take most
[1 2]
```

Under the one form the verb keeps that, `:most ~[](count | sub 1)` read
at each mention against the subject there, while `:most (count | sub 1)`
is a value computed where it is declared, which is what a snapshot is
for. A quote or a verb moved left means the same wherever its names mean
the same, and a name is declared once in a scope, so the move either
answers as the inline form did or is refused [D44].

The pipe is linear continuation and the binding is a branch to the
side: `x | f` hands f's result onward, `x | :name f` names f's value and
hands x onward, so `5 | :six inc | :again inc` names six twice while `5
| inc | inc` reaches seven. A name is for the non-linear reach, a value
wanted again later or beside another; the linear reach is the pipe.

### Names that lose their origin

The environment is one flat map of names. A namespace exists at the
moment `use` merges a module into it and dissolves in the merge: it has
no literal, no name afterwards, and the only trace it leaves is a
housekeeping key reachable through a quoted projection. A keyword with
a slash in it, `:vec/filter`, is a keyword and addresses nothing.
Documentation is addressed by name, because it lives in the syntax
tree as a doc comment and the axis has to find that syntax by walking
every loaded module, so a name that is shadowed takes its
documentation out of reach:

```qlang
> :filter | docs | count
1

> :filter mul 2 | :filter | docs | count
0
```

The shadowed original is still there, behind the housekeeping key, and
still runs:

```qlang
> :filter mul 2 | env | /"qlang/namespace/qlang/operand/container" | /filter | as :orig | [1 2 3] | orig ~(gt 1)
[2 3]
```

But the binding value itself knows nothing about its documentation or
where it came from: asked for its docs, it answers with the docs of the
`::builtin` tag it carries on its header, and the manifest has no field
naming the module a binding came from. Hypertext is anchored to names,
and names are the one thing the language lets a query overwrite. The
environment also carries the runtime's own housekeeping, the parsed
source of every module under one prefix, the export map of every
namespace under another, and the host's locator, a raw JavaScript
function, under a third, and every reader of the environment filters
them by prefix; `env | json` prints the locator as a string that reads
back as a string.

A module also exports everything it declares. Its surface is the
difference between the environment before and after its steps ran, so
a helper written for the module's own definitions lands in the
client's environment beside the operands meant for the client, and a
module that loads another module inside itself passes that module's
names on as its own. The language offers an underscore convention to
which it attaches nothing. The sister project's graph catalog uses no
such convention and is loaded whole into every session, so a client's
manifest shows the dispatch helpers behind `@problems` next to
`@problems` itself.

And names collide, which the maintainer has named as the one worry the
design never resolved: «стремительно растущий зоопарк операндов меня
все время беспокоил и конфликты имен .. последнее так и осталось
неразрешенным до сих пор» (maintainer, 2026-09-23 07:02, session
86982eb5). The sister project collides with the core on `type` and on
`source`, and its graph alone declares sixty operands, among them six
lookups by kind of element, four accessors of the containing element,
four enumerations by scope, some fifteen relations and four private
helpers of `@problems`. On 23 September 2026, in the sister project:

```sh
$ grep -oE '^:@[A-Za-z]+' cli/lib/jdt/graph.qlang | sort -u | wc -l
60
```

That is the `ioctl` of Unix: every new capability a new verb in one
shared space. Plan 9 answered the same growth by keeping the verbs
fixed, the handful of operations of its file protocol, and letting the
nouns grow, every resource a path in a per-process namespace; the
catalog should grow the same way.

A verb over a stack of tags is refused, a tag over a set or a quote
making such a stack, and `payload` is the one way beneath; the walk of
the tags is the decision that lets a verb reach the value under them
[D34]. On 25 September 2026:

```qlang
> ::Box#[3 1] | count !| type
::CountSubjectNotContainerError

> ::Box#[3 1] | payload
#[1 3]
```

The repair must put the documentation and the origin on the binding
value, so that the axes read a value instead of searching for a name,
and the four axes then become projections of one binding record:
`source`, the doc, the examples as the quotes among the doc's segments,
and the declared facts [D5]. It must make a namespace a value with a
way to obtain it by module name, so that a shadowed binding stays one
projection away. It must let a module decide its own surface without a
keyword, a module that ends in a map exporting that map alone and a
module of declarations exporting its declarations, so that helpers
stay lexically visible to the operands that use them and out of the
client's environment, `env` answering the user's own names and
`manifest` enumerating the namespaces. It must replace the
housekeeping prefixes with values of their own. And it must give
collisions a rule instead of a refusal [D23]:

- A verb resolves against the subject first. The verbs a tag declares
  for itself are found before the global ones, the way a major mode's
  keymap in Emacs is searched before the global map and an interface
  mode of Cisco's command line offers its own commands; after the
  tag's verbs come those of the payload, since a value under a tag is
  still a vector or a map. Stacked tags are searched from the outside
  in, which gives the linear precedence of a method resolution order
  without its algorithm, and with the core's kinds at the bottom of
  every stack the payload's verbs are simply the last tag's [D34].
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
  patch active only where `using` names it; `use` does that already,
  and a module's verbs for foreign tags are active in the query that
  uses the module and nowhere else.
- Names without a prefix belong to the core. EDN reserves its
  unprefixed tags for built-ins and requires every user tag to carry a
  prefix the user owns, a domain or a mark; CBOR's registry gives its
  short tag numbers only through a standard. JavaScript learnt the
  cost of the alternative when `Array.prototype.flatten` could not ship
  because an old library had already put a different `flatten` there,
  and the method became `flat`: a shared space of verbs that hosts can
  write into freezes the core out of its own names.
- The user's own declaration in a query wins over a tag's verb, since
  the user wrote it there and sees it; and one query shows every
  definition of a name and which one wins, as `type -a` does in bash.

Namespaces that are too large to bind become mounted [D24]. The sister
project's types are tens of thousands of names; they cannot live as
bindings in an environment map. A host serves a namespace lazily, the
way a file server was mounted into a namespace of Plan 9: a tag that no
binding knows is asked of the mounted namespaces in order, and the
first that knows it answers,
with the order of mounting and the rule of ownership settling any
overlap. The core knows nothing about Java; it knows how to ask a
mounted namespace. With that, a Java type is a tag, written in Java's
own spelling so that the name has one spelling, copied from a stack
trace and pasted into a query:

```qlang target
> ::app.m8.web.servlet.gwt.orgstructure.functask.ConfirmFtNewEmpHandler | source
```

answers the type's source text, and `docs`, `spec` and the type's
relations work on it as they work on any tag of the catalog. On 23
September 2026 the slash is accepted inside a tag's name and the dot is
not:

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
operands, and the catalog carries a prose entry for every one of them,
so the prose about errors outweighs the prose about the operands
themselves. The prose is formulaic because it has nothing to add to
the facts:

```qlang
> "hello" | add 1 !| type | spec
{:category :typeError :operand :add :position 1 :expectedType :number}

> "hello" | add 1 !| type | docs | first | /content
 Captured argument at position 1 of `add` must be Number. …
```

The cord from the alert to its document exists and works; what hangs
at its end is the alert said again, followed by an example that
produces the same error. What the reader should do, the procedure,
is absent.

The strict conditions and the kinds of the core added such pages, and
the catalog is the one area whose diff against the September master
is positive. On 25 September 2026:

```sh
$ git diff --shortstat f5e8ec8 -- core/lib cli/lib
 25 files changed, 1759 insertions(+), 1604 deletions(-)
```

Keeping the class names and the catalog in agreement requires a registry
of throw-site specifications, a stamping pass at bootstrap that runs
twice because there are two bootstrap paths, a test that checks six axes
of agreement, an injection script that copies example queries from the
conformance suite into the catalog, and two tables in the error
converter that spell the descriptor's field order and which fields are
identifiers. The structure was built for an observability backend that
fingerprinted errors by class name; the fingerprints have left the
errors, and the structure stayed.

The alerts themselves are lit, where the cockpit wants them dark. An
error carries its whole input, so one failing step over a large value
prints the value; a name that does not resolve says so and stops; and
a parse error lists the alternatives of the parser in the parser's own
vocabulary. On 23 September 2026:

```sh
$ qlang 'manifest | add 1' | wc -c
25599
```

```qlang
> [1 2 3] | filtr ~(gt 1)
::UnresolvedIdentifierError!{ … :identifierName "filtr" }

> [1 2 3] | filter ~(gt 1
::ParseError!{ … :expected [:whitespace "|~|" "|~" "|~~|" "|~~" "!|" "|" "*" ")"] … }
```

`filtr` is one letter from `filter` and the error does not say so; the
unclosed quote has one sensible continuation, `)`, and the error names
every token the parser could have taken there, among them the markers of
comments.

An error raised inside a nested evaluation meets the law of D13 in most
places: distribute keeps it as a value in the result, a container
selector answers with it, and `coalesce` treats it as no value, which
is its contract, so a misspelled field becomes the fallback where a
fallback was asked for:

```qlang
> [1 "x"] | filter ~(add 1 | gt 1)
::AddLeftNotNumberError!{ … :trail ~(gt 1) }

> {:a 1} | coalesce ~(/b) ~(/a)
1
```

A value slot is where the law does not hold: it refuses an error value
by the tag of its own site, so one error nests inside another. On 25
September 2026:

```qlang
> 1 | add (!{:k 1}) !| type
::AddRightNotNumberError
```

A library of error-handling pipelines, retry and recover and assert
and their kin, ships in the core package, is reachable only through
the Node module resolver used by tests, and cannot be loaded from the
command line at all; the reference nonetheless shows `use(:qlang/error)`
as if it could.

The repair must keep error identity per site and declare it once [D7,
D46]: each site's tag is a kind declared in the catalog beside its
operand, whose schema owns the site's fields in the order a reader needs
them and whose document is the site's procedure; the throw site passes
the facts, and the tag's constructor checks them. It must hold one law
for an error inside a nested evaluation, derived from the fork rule
[D13]: the error of a fork is its value, handed to whatever ran the
fork; a place declared for any value keeps it, as an element of a
literal or of a distribute does today; a place declared for a kind, the
number slot of `add` or the boolean a predicate must return, fails with
that same error, unchanged, so a selector still aborts on a failing
predicate and an arithmetic step stops nesting one error inside another;
and an operand whose alternatives are pipeline slots, `coalesce` and its
kin, runs them in order and treats an error result as no value, which is
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
takes first. An unresolved name names the nearest known names; a parse
error names the continuations a reader could have meant, in the reader's
vocabulary. And it must decide whether the error library enters the
catalog with examples or leaves the package.

### Self-description without a front door

The language can answer any question about itself, and has no first
screen. The only entry is `manifest`, whose full answer weighs about
twenty-two kilobytes as JSON where the bare names weigh under one;
there is no view by subject or by category, and the `:subject` field
is sometimes a keyword and sometimes a vector, so the reverse index
"what can I do with this value" cannot be written as a single filter.
On 23 September 2026:

```sh
$ qlang 'manifest | json' | wc -c
21679
$ qlang 'manifest * /name | json' | wc -c
708
```

The expensive view is the default one, where the terminals of the
paper age made the cheap path the default and the full view a flag.
The descriptor's category, subject, return, and slot fields are an
ontology nobody executes, and they are wrong in places, as the
arguments scar shows.

The catalog itself speaks the vocabulary of its implementation. The
prose a session reads to learn the language names JavaScript files,
symbols and services: the type classifier's entry explains that identity
rides on “the value's JS-header `TAG_HEADER_SYMBOL` slot”
(`core/lib/qlang/operand/typeClassifier.qlang`); the invariants module
speaks of the `BUILTIN_IMPL_SLOT` and of `createPrimitiveRegistry()`
(`core/lib/qlang/runtime-invariants.qlang`); and the reflective family
refers the reader to `runtime/manifest-op.mjs`. A session learning qlang
from its catalog meets the names of the files that implement it.

Examples live on four planes: the conformance suite, the `~{…}` quotes
in the catalog, the REPL pairs in the reference, and the arrow pairs in
the operand document, with three test runners and a script that copies
from the first plane into the second. The catalog's own examples run
in under a second and are the only plane the language can reach.

The content of a doc is tokenized by a second, character-level parser
that recognizes quotes and tag literals, and it executes the tag
literals it finds:

```qlang
> |~~ note ::Box[1] here ~~| | /segments * type
[::map ::Box ::map]
```

A code span is prose [D55], so the mentions of the syntax the catalog
makes in code spans, `::builtin{}` in the prose of `::builtin` and
`::Outer[tagged]` in that of `tag`, stay prose; a tag literal written
outside a code span runs when its doc is read, as above. No
documentation in the catalog uses tag literals on purpose. The language
server scans the same text a third time, with its own loop over braces
and strings, to strip the quotes for a hover (`lsp/src/features.mjs`,
`stripQuoteSegments`).

The repair must give the language a root doc that a fresh session
reads first, with a discovery protocol and views sized to a budget,
the cheap view the default and `:subject` declared as a vector on
every descriptor so that the view by subject is one filter [D27]. It
must reduce catalog prose to what the facts do not say, written in the
language's own vocabulary, with no name of a file, a symbol, a service
or a section of another document in it. It must make examples live on
one plane; reduce doc segments to prose and quotes, the doc being the
vector of those segments under its own tag [D19], parsed once by the
language's own parser, so that it counts, addresses and slices as every
vector does, its literal `|~~ … ~~|` is the fourth sigil over the one
mechanism, and its text is the join of its segments; and print errors
and parse failures economically, with the full value reachable by
projection rather than dumped.

### Three documents that retell the catalog

The reference, the evaluation-model document, and the operand document
together weigh more than twice the core sources, and each restates the
catalog: an operand's contract is spelled in the catalog, in the
operand document, in a chapter of the reference, and in a chapter of
the evaluation model. A convention check exists to keep the operand
document from drifting against the catalog, which is machinery guarding
a duplicate. The documentation site links to the reference on GitHub
and renders none of it; the language server reads the catalog directly
and never the documents. The reference opens with a screen and a half
on comments before it has shown a value or a pipeline, because the
grammar of comments dictated the order of concepts. The reference's
grammar chapter is a third spelling of the grammar, beside the parser
and a hand-written TextMate copy for the editor.

The reference is a tutorial rather than a specification, as the
maintainer put it: «это не спецификация, а скорее референс, туториал»
(maintainer, 2026-09-23 00:47, session 86982eb5). It introduces the
concepts in order on REPL pairs, and its normative parts ride behind:
the grammar chapter, the table of evaluation rules, the tables of the
codecs, the embedding API. Read whole against the tree on 23 September
2026, the two halves fared differently. The REPL pairs are true,
because the document-compliance runner executes them; the prose and
the tables are false in places, because nothing executes them:

- The chapter on null says a missing map key produces `null`, and the
  table of evaluation rules says a projection answers `null` if the key
  is missing; the REPL pair a few chapters earlier shows the strict
  miss correctly:

  ```qlang
  > {:a 1} | /b
  ::ProjectionKeyNotInMapError!{ … :key "b" }
  ```

- The chapter on reflection says a built-in without arguments
  evaluates to its own descriptor rather than an arity error:

  ```qlang
  > [1 2 3] | filter
  ::HigherOrderOpArityMismatchError!{ … :operandName :filter … }
  ```

- The chapter on modules shows `use(:qlang/error)` loading the error
  library, which the command line cannot load:

  ```qlang
  > use(:qlang/error)
  ::UseNamespaceNotFoundError!{ … :namespaceName :qlang/error }
  ```

- The example of a quote-bodied constructor, `::cond`, calls `first`
  with a modifier, and fails.
- The grammar chapter has no quote, no tag, no doc and no binding form.
- The table of the plain JSON codec says that an error is unencodable
  and makes `toPlain` throw, while `json` writes it:

  ```qlang
  > [!{:a 1}] | json
  [{"$error":{"$tag":"Error","descriptor":{"a":1,"trail":null}}}]
  ```
- The embedding API tells a host to install its operands with
  `session.bind(name, fn)`, which the runtime's own render guard calls
  a leak of a function value.

The executable half stayed true and the narrated half rotted, inside
one document. That is the argument for the principle of executable
over narrated, in the project's own text.

The repair must leave each document either generated from the catalog
or deleted, with the reference reduced to what the catalog cannot say:
the evaluation model, the combinators, the fork rule, and the reading
protocol. The tutorial's order of concepts and its REPL session are
worth keeping, as a page generated from executable examples in that
order.

### Host concerns inside the core

Effect markers are a naming convention: an identifier that begins with
`@` is effectful, a binding whose body mentions an effectful name must
itself carry the marker, and the evaluator checks this at declaration
and at call. The core has no effectful operand of its own; every one
belongs to a host. The flag rides on every function value, binding, and
manifest entry in the core, and the guarantee it offers is incomplete,
because an effect passed as an argument runs under a clean name, and so
does one in the body of a conduit bound as a value:

```qlang
> :run [:x] x | "leak" | run @out
leak

> :g ::conduit[[:x] ~(@out x)] | g "hi"
hi
```

More than half of the error categories describe failures of the host
or the runtime that no query author meets. The command line starts
from `::qlang` when standard input carries no bytes [D37], and the noun
of a project's `.qlang/` folder comes with the modules. A raw-mode line
editor and its tests are the largest single piece of the command-line
workspace, and the REPL it serves cannot save a session although the
core can serialize one.

The sister project builds on the workspace copy of the core since 23
September 2026, its dependency a link to the core's folder:

```sh
$ grep '"@kaluchi/qlang-core"' ../eclipse-jdt-search/cli/package.json
    "@kaluchi/qlang-core": "file:../../qlang/core",
```

Its query command still reimplements the parse-error descriptor by
hand, and it onboards its user with a static guide.

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
collisions [D23]. Selecting an operand by the tag of its subject is part
of that rule. Whether an effect deserves to become a value of its own,
an action awaiting the host the way a quote awaits `apply`, is a
question for a later branch that would have to show a task no plainer
construct solves. The repair must also give the sister project a guide
generated from the catalog.

### Concurrency nobody declared

The evaluator is asynchronous, and it fans out in some places and not
in others. Distribute and the vector literal evaluate their elements at
once; the map, set, and error literals evaluate their entries one after
another; the container selectors walk elements one at a time, while the
captured arguments of a single operand resolve together. The reference
states none of this. In a pure pipeline the difference is invisible,
because values are immutable and an element's error stays a value in
its place. It becomes visible through host effects: a diagnostic print
inside a distribute appears in completion order rather than element
order, and a vector of ten thousand elements issues ten thousand
simultaneous calls to a host with nothing to bound them.

The repair must state the rule in the reference: results are ordered
by element, the modifiers of a command among the elements [D12],
simultaneity is unspecified, and bounding the fan-out is the host
operand's business. Once effects are values performed at the boundary,
completion order stops being observable at all.

### Code that explains itself

The code is more commentary than design. On 25 September 2026, over the
JavaScript of the core, the command line and the language server, the
tree and then the September master:

```sh
$ git ls-files 'core/src/*.mjs' 'cli/src/*.mjs' 'lsp/src/*.mjs' | xargs cat | awk '/^[ \t]*\/\//{c++; next} /^[ \t]*$/{b++; next} {k++} END{print "code", k, "  comment", c, "  blank", b}'
code 7016   comment 4318   blank 993
$ git ls-tree -r --name-only f5e8ec8 | grep -E '^(core|cli|lsp)/src/.*\.mjs$' | sed 's#^#f5e8ec8:#' | xargs git show | awk '/^[ \t]*\/\//{c++; next} /^[ \t]*$/{b++; next} {k++} END{print "code", k, "  comment", c, "  blank", b}'
code 7529   comment 4644   blank 1025
```

The repairs deleted comments and code in about the proportion they
stood in, so the ratio D30 asks to fall has barely moved.

In several files the comments outweigh the code: the bootstrap of the
runtime, the primitive registry, the error roots and the descriptor
stamping carry more lines of prose than of statements, and the grammar
carries more comment lines than rule lines. The comments are of two
kinds, and none states an invariant in a sentence:

- Some are false. The package's entry point promises that `keyword`
  interns, “every call with the same name returns the same interned
  object” (`core/src/index.mjs`), while `keyword` builds a fresh object
  on every call (`core/src/types.mjs`, `keyword`). The header of the
  tagged-JSON codec
  says the conformance runner hydrates its cases from that format
  (`core/src/codec.mjs`); the runner compares qlang literals. The
  values module says that each of the three reserved tags of the
  header, `::conduit`, `::snapshot` and `::builtin`, owns a path of its
  own through the printer (`core/src/types.mjs`, beside
  `isTaggedInstance`), while `describeType` gives `::builtin` none, so
  a descriptor reaches the printer of maps and prints without its tag.
- Most justify. The bootstrap calls its seeding of `::builtin`
  “Chicken-and-egg” and explains it (`core/src/runtime/index.mjs`);
  the registry explains why its verb is “seal” and not “freeze”
  (`core/src/primitives.mjs`). Each is a decision that has no record,
  written where it will be read by whoever touches the line and by
  nobody who decides.

The false comment about the reserved tags shows in a query, found on
23 September 2026 by running this document's probes: every descriptor
of the catalog prints as a bare map, and the map it prints reads back
as another value.

```qlang
> env | /count | type
::builtin

> ::builtin{:a 1}
{:a 1}

> ::builtin{:a 1} | eq {:a 1}
false
```

The rest of the scar is duplication the other sections name only in
part:

- Three codecs for one value. The literal and its parser; a tagged JSON
  with envelopes for keywords, maps and tagged values
  (`core/src/codec.mjs`), exposed on the command line as `tjson` and
  `parseTjson`; and a lossy JSON (`core/src/runtime/format.mjs`,
  `toPlain` and `fromPlain`). A fourth format is the session envelope,
  a JSON with a schema version and binding kinds
  (`core/src/session.mjs`, `serializeSession`). The literal is lossless
  for every value but a descriptor under `::builtin`, which prints as
  its bare map; the tagged JSON cannot even encode a named pipeline,
  which the literal prints.
- Three loaders of modules: the bootstrap of the catalog
  (`core/src/runtime/index.mjs`, `buildLangRuntime`), `use` through a
  locator (`core/src/runtime/use-op.mjs`, `resolveNamespaceEnv`), and a
  resolver of module directories used by tests alone
  (`core/host/module-resolver.mjs`). Each computes a module's surface as
  a delta of the environment and each stamps descriptors its own way.
- An embedding surface that was never designed. The package's entry
  point re-exports about ninety names, the Symbol slots of the headers
  and the prefixes of the environment's housekeeping keys among them,
  and the package exposes sixteen subpaths, the dispatch wrappers and
  the error factories included, which is what hosts build on.
- Surface without users. The session keeps a history of cells with the
  environment after each, and offers to take and restore snapshots;
  nothing outside the tests calls any of it, and the counter of cells
  leaks into what a user sees, `:uri "cell-2"` on a parse error of the
  command line.
- Consumers that carry spellings of the language. The language server
  re-derives the snapshot-or-conduit choice of the binding form and
  scans doc text with its own loop, and the TextMate grammar hard-codes
  the slot vocabulary of the catalog.

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
branch against the September master and falls.

### A process that grows text

Several of the review rules generate additions by construction, one by
demanding a
distinct class per throw site, one by requiring that the documents be
kept in step with code they duplicate, one by asking the reviewer to
propose sibling operands, one by requiring retroactive fixes in every
diff. The coverage threshold of one hundred percent on every axis has
produced a test corpus heavier than the code it covers, and most of it
tests the mechanism rather than the language: almost every unit test
imports the internals it checks, so it dies with them, while the
conformance cases, each a query and the literal it must answer, state
what the language does and survive any rewrite of how. The drift tests
and three of the five convention checks exist to guard duplicates.

The repair must derive every process rule from a principle, with each
rule reading as the principle plus the check that enforces it; must
replace the coverage number with a policy that keeps the threshold for
the language core and a no-number rule elsewhere; must treat the
conformance cases as the requirements of the language and the unit
tests as scaffolding that goes with what it scaffolds; and must delete
each guard together with the duplicate it guards.

## Decisions

Each record states the decision, its source, what it rests on where
that is not obvious, and the alternatives set aside with the reason.
A decision the maintainer took is sourced by the maintainer's words; a
decision the model took says so and names the request it answered.
Several decisions of 15 September were taken by the model at the
maintainer's request; the first version of this document records the
request, and the maintainer's words for it were not found when the
transcripts were searched on 23 September, so those records say only
that, and a record whose words a later search found quotes them. When
the model took the remaining open questions on 22
September, it was because the maintainer asked why those decisions
fell to the maintainer at all:
«давай по остатку, почему это мои решения? .. из чего мне выбирать?
можешь разобраться, а то я не понимаю.. что ты можешь предложить сам?»
(maintainer, 2026-09-22 04:37, session 0ea77851) and, later the same
day in another session, «почему все мое?» (2026-09-22 07:21, session
86982eb5).

### D1 · One map and one vector; JSON is syntax and codec

Decision. The JSON container family leaves the runtime. JSON syntax is
accepted on input and normalized at parse time; the JSON shape is the
business of the codec at the boundary; the branch that preserves it
through transforms goes, and so does every shape predicate that
serves it.
Source. «с json тоже в целом согласен.. считаю этот эксперимент
неудачным.. но только благодаря всем трудностям при его внедрении и
появились ::Тэги в языке» (maintainer, 2026-09-14 22:38, session
268516f5); its scale, once counted across every layer from the grammar's
literals to the catalog: «так я хоть осознаю теперь объем его семейства
это считай дубликат qlangа был .. начиная с парсера и дальше в эвал ..
что б развести по семантике это.. он считай "возводил в квадрат" связи
базовой модели» (maintainer, 2026-09-23 18:38, session 86982eb5).
Set aside. Keeping the family to preserve a pasted document's shape: it
costs a predicate in every container operand, a re-stamping pass in
every transformer and a codec of its own, and the shape is recovered at
the boundary anyway.

### D2 · The effect marker leaves the language

Decision. The `@` convention, its checks and its flags leave the core
and are not relocated into a host convention. A host that wants the
provenance of a value visible tags the value. A tag may describe an
effect, a write the host is to perform, and such a value is performed
only by an explicit step at the host boundary; a tag's constructor is
pure, and reading or constructing a literal performs nothing.
Source. «эффекты в ядре как "не пришей к кобыле хвост" .. […] я даже в
какой-то момент думал их вообще просто удалить и никуда не переностить
никак» (maintainer, 2026-09-15 00:12, session 268516f5), and «на
границе хоста и хостовых операндах через ::тэги можно эффекты и всякую
мутабельность моделировать при желании и надобности» (maintainer,
2026-09-23 08:58, session 86982eb5). The purity of constructors and the
place of performance are the model's, from the history of YAML's
unsafe `load`.
Set aside. The marker as a host naming convention: every `@`-name stays
a different name from its plain twin, reading its document means
remembering the sigil, and the core has no consumer of purity.

### D3 · The ring comes first

Decision. The data form of code and the involution between it and its
text are settled before anything that produces or consumes a quote, the
argument model included.
Source. «кольцо Code as data и инволюция вероятно первичны в дизайне по
отношению к прочим фичам» (maintainer, 2026-09-15 02:12, session
268516f5).

### D4 · A parameter binds a value, and an operand is a declaration

Decision. A parameter holds a value; code passed to an operand is an
explicit quote, or the slot is declared as code. Every operand, built
in, hosted or declared as a pipeline, is a declaration of its subject,
its slots with their kinds, its result and its doc, and the runtime
executes it: subject and value slots are checked before the
implementation runs, code slots are closed at the call site, the result
is checked after. A reducer or comparator slot supplies its second
value as a trailing modifier of the code's last step. The arity
dispatch of predicates and the second calling convention go. A host
operand is a plain function over checked values, delivered with the
module that declares it as `{ source, impls }`; the dispatch wrappers
and error factories stop being an interface.
Source. The model, 15 September 2026, at the maintainer's request; the
interface of hosts was added by the model on 23 September 2026 when the
reading of the whole tree showed the wrappers to be that interface.
The parameter written `~(f)` and the rules of forks were accepted in
passing: «с ~(f) синтаксисом параметров наверное тоже всех устроит, как
и те правила с форками» (maintainer, 2026-09-22 01:30, session
96f3df79).
Set aside. Lazy parameters by default, which produce the `m(/)` answer
of forty; keeping the wrappers and adding declarations beside them,
which is a second spelling of every calling shape.
Replaced in part by D43, under which a slot captures nothing, code
arrives as a quote, and a declared pipeline's parameter is a value its
body applies.
Replaced in part by D16, under which the comparator slot leaves with the
comparator operands.

### D5 · One binding form, and the binding is a record

Decision. One form, `:name body`: a quote body is code, a bare body is
evaluated once at declaration against the current value, tags are
declared through the same form, and `as` and the snapshot go. A
declaration produces a binding value that carries its name, its doc,
its source, the module it came from, and its value or its code; the
four axes become projections of that record, the examples being the
quotes among the doc's segments.
Source. The binding as a named result is the maintainer's: «если считать
биндинг просто как именованным результатом вычисления над тем же
pipeValue […] без всяких там as(:name)» (maintainer, 2026-09-15 23:14,
session f4f0c99b); `:n /` in place of `as`, «да, выглядит что ты прав..
просто изначально были там всякие let def и т.п. операнды.. и вообще
отстутсвовала биндинг форма с :n /» (18:47), answering the model's
account of the four roles of `as`; the binding that keeps its origin
answers «источник теряется.. пуповина обрывается.. наши BindStep-ы не
дорабатывают..» (maintainer, 2026-09-15 01:20, session 268516f5). The
quote body as code, the model, the same day; the axes as projections,
the model, 23 September 2026.
Set aside. Keeping `as` beside the binding form, which keeps the
snapshot wrapper and its eight unwraps; deciding between value and code
by the shape of the body's syntax.
Replaced in part by D44, under which a binding names a value, a quote
included, and a verb is declared with its slot list.

### D6 · A tag's declaration is its schema or its constructor

Decision. A tag's body is its schema when it is a map, a field's kind
being a type, a tag, `[kind]` for a vector of the kind or `#[…]` for an
enumeration of keywords, and its constructor when it is code; the
runtime derives a record's constructor from its schema with the checker
that checks a slot. The tags built in the host language keep the
builtin descriptor as their body, and a tag without a body is identity.
A record that wants a check beyond the kinds of its fields is declared
with code. The spelling of a slot list, which a vector of one kind
would otherwise collide with, is settled with the argument model.
Source. Proposed by the model on 22 September 2026 as the fourth
question; «ладно тогда 4 ок» (maintainer, 2026-09-22 05:56, session
0ea77851).
Replaced in part by D45, which spells the slot list that this record
left to the argument model.

### D7 · One tag per kind of refusal

Decision. Error identity stops being declared per throw site. There is
one tag per kind of refusal, named for the refusal; the operand, the
position and the expected type are fields of the descriptor; a bright
headline is derived by the printer from those fields; a foreign failure
carries a tag of the language with the host's class name as a field.
The document behind each refusal kind is a procedure: what it means,
which field names the culprit, the usual cause, the recovery through
`!|` as a runnable example, and the kinds it is confused with. An error
prints like an alert, headline and anchors and a short excerpt, with
the full value one projection away; an unresolved name names the
nearest known names, and a parse error the continuations a reader
could have meant.
Source. The identity, the model, 14 September 2026, which offered it
beside per-site tags and left the choice to the maintainer, who did not
answer then. The tag of the language for a foreign failure answers «ни в
коем случае js-ошибки не должны вытекать из рантайма, вычисляться во
что-то что не является литералом qlang.. хотя бы потому как вдург qlang
на rust кто-то захочет переписать..» (maintainer, 2026-09-14 23:30,
session 268516f5). The procedure and the printing, the model, 23
September 2026, after the maintainer named what the tags were for:
«именно поэтому я и вводил в ошибки qlang тэги и делал их
гипертекстовыми.. и подразумевая что получившая их модель может
провалиться и дочитать там гипертекст-инстркции как поступать с ошибкой,
как она возникает и что значит» (maintainer, 2026-09-23 04:35, session
86982eb5).
Set aside. A per-site tag such as `::AddLeftNotNumberError` derived by
the runtime from the same facts: it removes the declarations as well,
but costs a naming rule in the runtime and a tag that names no entry of
the catalog.
Replaced in part by D46, under which a refusal keeps the tag of its
site, declared once as a kind.

### D8 · The quote is `~(…)`, transparent over its vector of steps

Decision. A quote is a vector of steps under the code tag, spelled
`~(…)`; container operands apply to it as to any tagged vector; the
data form carries no `:kind` and no positions; the parser's tree stays
a separate view for tools.
Source. The spelling is the maintainer's: «ладно ~() .. наверное
перевешивает и старую форму и альтернативу в виде ~[] ...» (maintainer,
2026-09-15 22:47, session f4f0c99b). Transparency answers «для упаковки
и распаковки наверное проше операнд с биекцией придумать?» (20:52) with
the bijection every tag already has, `payload` one way and `tag` the
other, as the maintainer read it back, «т.е. ты предлагаешь что-то типа
~(1 | add(/a | mul(2))) | payload = и на выходе я получаю [1 ::Call{}]
или как?» (21:09), and it was accepted with «ок, принимаю» (maintainer,
2026-09-24 00:07, session 86982eb5). The data form, the model, 15 and 19
September 2026.
Set aside. An opaque value reached through one involution operand, the
way `error` exposes its descriptor: transparency removes a value class
where the alternative adds an operand, at the price of every container
operand acquiring a meaning on a quote.
Replaced in part by D47, which stores a modifier as its step and names
the tags of the data form.

### D9 · `apply` is subject first

Decision. `apply q` runs the quote against the subject under the fork
rule; the group is the same run written as a literal; `eval` leaves.
Source. The model, 15 September 2026, answering «про apply можешь мне
расписать текушие формы и из недостатки и что именно ты предлагаешь и
как оно со всем будет сочетаться - потому как оно звучит наверное
здраво» (maintainer, 2026-09-15 19:19, session f4f0c99b); the replay of
a trail took the form the maintainer asked about, «а так что будет, если
→ завтра err !| :t /trail | 5 | apply(t)» (19:44). The subject first is
the maintainer's reading: «есни надо выполнить квоту - то против
субъекта (apply q) это явно и правильно звучит» (maintainer, 2026-09-23
21:14, session 86982eb5).
Set aside. Overloading `apply` by the type of its argument, which two
quotes make undecidable. The price accepted: a declaration when the
code arrives through the pipeline, as in the replay of a trail.

### D10 · The command form

Decision. A step is a command, a name followed by its modifiers
separated by spaces; parentheses mean only a pipeline taken as one
word; the argument comma leaves the grammar.
Source. Proposed by the model; «давай уже зафиксируем командную форму
тобой предложенную» (maintainer, 2026-09-19 10:11, session ad12f85d).
The exploration opened with «идея с командной строкой возможно
действительно лучше» (maintainer, 2026-09-16 02:04, session f4f0c99b).
Set aside. The call form, uniform and self-delimiting, which keeps two
meanings of parentheses and the reading of a function call that brings
another paradigm's expectations; dropping the comma alone, `op(a b)`,
which keeps both; parentheses around every command, which costs a pair
on every step of the top level. The price accepted: one text reads as
a command with a modifier on the pipe and as two elements inside a
literal, which the first screen states in a sentence and a parse error
names.

### D11 · A line is a step

Decision. A newline ends the modifiers of a bare command; the next line
continues the pipeline through the combinator it begins with, or
through `|` when it begins with none; inside parentheses and literals a
newline is whitespace; the parts of a declaration may take a line each.
Source. The model, 22 September 2026, answering «по семантике синтаксису
все решено?» (maintainer, 2026-09-22 07:27, session 86982eb5). The rule
held under the maintainer's condition on the whitespace of D43, «[…]
если ты подвердишь что с многострочными примерами и переносами
комбинаторов туда сюда проблем не будет и все будет праситься как
надо..» (maintainer, 2026-09-23 21:40, session 86982eb5), which the
model's check answers, recorded in the scar of the call in the second
version of this document.
Replaced in part by D43, which continues a line that ends with a
combinator through that combinator and sets every combinator off by
whitespace.

### D12 · Modifiers evaluate as the elements of a vector

Decision. A command's modifiers are forks against the subject at the
call site, evaluated as the elements of a vector literal: results by
position, simultaneity unspecified, none seeing another. A code slot's
modifier is closed at the call site and run by the operand in its own
order, which its catalog entry states where the order is observable;
`if`, `cond` and `coalesce` are lazy by that declaration.
Source. Proposed by the model and accepted by the maintainer, as the
first version records, and confirmed on 22 September: «ок, слева
направо ты предложил.. в целом ок» (maintainer, 2026-09-22 01:30,
session 96f3df79), answering the model's account of the order in which
modifiers evaluate.
Replaced in part by D43, under which a slot of kind code receives a
quote instead of capturing its modifier, and `if`, `cond` and
`coalesce` take as quotes the parts they run only when chosen.

### D13 · One law for nested errors

Decision. The error of a fork is its value, handed to whatever ran the
fork. A place declared for any value keeps it; a place declared for a
kind fails with that same error, unchanged. An operand whose
alternatives are pipeline slots, `coalesce` and its kin, runs them in
order and treats an error result as no value, which is its documented
contract.
Source. The model; the maintainer left `coalesce` to the model: «с
coalesce наверное можно как-то и смириться с тем что оно все аргументы
посчитает до вызова.. что возможно некоторых может смутить ..хотя может
и раньше так оно было .. в общем здесь ты лучше самостоятельно подумай»
(maintainer, 2026-09-22 01:30, session 96f3df79).

### D14 · Predicates are strict

Decision. A condition answers a boolean or fails at its slot. `when`,
`unless` and `firstTruthy` leave the catalog; `not` takes a boolean;
null is tested with `eq null`; `runExamples` passes an example only when
it answers `true`.
Source. Proposed by the model on 22 September 2026 as the first
question; «по 1 пункту согласен с тобой» (maintainer, 2026-09-22 05:34,
session 0ea77851).
Set aside. Truthiness, under which `null` and `false` were false and
every other value true: it needs a second kind in the declaration of a
slot and answers silently where a string or a quote lands in a
predicate. A `boolean` coercion operand: it carries the Lisp reading
that false is absence into a tool for JSON, where null is explicit and
`false` is a value.

### D15 · A map's elements are its values

Decision. A map is a record and a dictionary at once. Its elements are
its values, and its keys are the shape that travels with them: `*`,
`filter`, `sort`, `take`, `drop` and `reverse` act on the values and
keep the keys, the reducers read the values, `keys` answers the sorted
set of keys, and a predicate sees the value alone.
Source. Proposed by the model on 22 September 2026 as the second
question; «2 - согласен тоже» (maintainer, 2026-09-22 05:34, session
0ea77851).
Set aside. The entry as a value with an `entries` and `fromEntries`
pair: the reflex of every other language, paid for with a second
collection inside the map, while `*` over a map and `indexBy` write both
directions as compositions.

### D16 · One order over all values, and the set as the ordered vector

Decision. One order ranks every value, so anything sorts, a vector is a
compound key, and the comparator operands and the refusals of
incomparability go. The set is the vector in that order without
duplicates, under the `::set` tag, with `distinct` its constructor and
`#[…]` its literal.
Source. The maintainer first asked whether the set should leave the
language: «может вообще сеты убрать из языка? а есть isDistict/isSet
операнд над вектором» (maintainer, 2026-09-22 05:34, session 0ea77851);
after the model's second pass, «ок, убедил.. дорабатывай аудит»
(maintainer, 2026-09-22 06:27, session 0ea77851). The comparators left
after the maintainer asked after the motive, «это мы так договаривались,
сносить компараторы? .. напомни мотивацию?» (maintainer, 2026-09-24
07:48, session 86982eb5), and heard their price, «ааа ок, продолжай»
(07:50).
Set aside. A language without sets, the same order with `distinct`
answering a canonical vector, set aside by a small margin since the
tagged vector costs two lines of catalog and answers for itself when
printed; a set as a primitive with an equality of its own; a vector
whose equality knew order, which would be no set. The price accepted: a
key that descends beside one that ascends is written for numbers alone,
`sort ~([/p (/t | mul -1)])`; the descending order is the sort reversed,
which reverses the order of equal keys as well; and `firstNonZero`, the
composition primitive of compound comparators, leaves with them.

### D17 · The order of the types

Decision. Values order first by type: null, boolean, number, string,
keyword, tag name, vector, map, and after them every tagged value by
the name of its tag; within a type as today.
Source. The model, 22 September 2026; the place of tag names after
keywords, the model, 23 September 2026, since the first list omitted
them.
Replaced by D48, which places the tagged kinds of the core and the kinds
of the hosts.

### D18 · A duplicate key reads as JSON reads it

Decision. A duplicate key in a map literal, in either spelling, keeps
the last value in the first position, as `JSON.parse` does, and the
boundary reads the same.
Source. «ок, видимо у нас правильно js-совместимо сделано, с учетом
того что мы должны жевать любой json на входе и относиться к нему как к
тому все привыкли уже» (maintainer, 2026-09-22 06:17, session
0ea77851).

### D19 · A doc is the vector of its segments

Decision. A doc is the vector of its segments, prose strings and
quotes, under its own tag, parsed once by the language's parser; it
counts, addresses and slices as a vector; `|~~ … ~~|` is its literal;
its text is the join of its segments.
Source. The model, 22 September 2026, from the maintainer's picture of a
doc: «так и в qlang - любой Doc - задумывался так что б быть маркдауном
по сути .. и внутри него есть квоты из qlang-а» (maintainer, 2026-09-19
07:18, session ad12f85d).

### D20 · A tag names a kind

Decision. A tag is the name of an interpretation. It stacks over any
payload and reads from the outside in; the tag taken as a value is the
kind as a subject; behaviour lives in the catalog and is found through
the tag, never in the value. The vocabulary of objects stays out of the
language and its documents; the first screen defines the word in one
sentence, since a model's prior for "tag" is vague, HTML and git and
clouds of labels.
Source. «мне нравится что "имена интерпретации" в целом много что
моделируют и компонуются .. т.е. то же множественное-наследование ради
полиморфизма там легко можно реализовать наслаиванием конкатенацией
тэгов» and «слова тащат парадигму -- верно на 100%» (maintainer,
2026-09-23 08:58, session 86982eb5); the definition and its
consequences, the model, the same day.

### D21 · Progressive disclosure and the elision marker

Decision. The contract is called progressive disclosure. What a host
leaves out is replaced by a value under `::elision`. The language
computes whole values; the budget, elision, enrichment, the explanation
of an error and the performing of an effect belong to the host and its
session. The marker's payload is a map with two fields the host owes
and the tag's declaration documents, `:size`, in the elements of the
vector it replaces, and `:read`, a quote that applied to the original
answer yields the part left out; every other field is the host's.
Source. «да, progressive disclosure - ок, как и ::elision и c его
внутренностями произвольными» (maintainer, 2026-09-19 08:43, session
ad12f85d); the two owed fields, the model, 22 September 2026.

### D22 · The catalog is the coreutils of values

Decision. An operand enters the catalog when it expresses what was
inexpressible over the values the language has, or shortens what every
host would otherwise write; a domain's operands belong to its host.
There is one sequence, the vector: a string becomes a vector through
`split`, `lines` and `join` and is worked on as one, so the string
operands stay a handful and a string reads in pieces by the rule
everything else obeys.
Source. The model's proposal of 15 September 2026, restated on 22
September; the maintainer has raised no objection.
Set aside. A string library of its own, which the sister project's
source text asks for first and is the one road on which the catalog
grows without bound.
Replaced in part by D49, which counts a host without a shell among every
host.

### D23 · Collisions are resolved by the subject, ownership and scope

Decision. A verb resolves against the subject first: the tag's own
verbs, from the outermost tag inward, then the verbs of the payload's
shape, then the global verbs. A verb and a kind may be joined by
whoever owns one of them, so a host may specialize a core verb on its
own tags and may not redefine a core verb on the core's kinds.
Extensions to foreign tags are active only in a query that uses their
module. Names without a prefix belong to the core. The user's own
declaration in a query wins over a tag's verb. One query shows every
definition of a name and which one wins.
Source. «глаголов мало, субьектов много .. поэтому и смотрел в сторону
мультидиспатча на тэгах - что б хоть что-то полиморфное и релевантное
текущему pipeValue получать» (maintainer, 2026-09-23 07:02, session
86982eb5) and «правильный дизайн где-то там же в районе тэгов.. как
будто бы сейчас кажется нельзя выставлять свои "глаголы" просто так»
(maintainer, 2026-09-23 08:58); the parts of the rule, the model, the
same day, from the keymaps of Emacs, the modes of Cisco's command line,
the orphan rule of Rust, the rule against type piracy in Julia, Ruby's
refinements and EDN's reserved tags.
Set aside. A table owned by each verb, the generic function of CLOS
and Julia, which makes adding a verb cheap and adding a kind expensive
and is the candidate of the first version; a loud refusal of every
collision, which makes a host rename its verbs and lets the core's
names freeze the hosts out.
Replaced in part by D34, which restates the order of resolution on the
kinds of D32.

### D24 · Large namespaces are mounted, and Java types become tags

Decision. A host may serve a namespace lazily: a tag no binding knows
is asked of the mounted namespaces in order, the first that knows it
answers, and ownership settles overlap. The core knows how to ask a
mounted namespace and nothing about any domain. The sister project
mounts its types, each a tag spelled as Java spells it; the dot is
admitted inside a tag's name and a quoted form, `::"…"`, covers the
rest; a member of a type is a record under the host's tag pointing at
its type.
Source. «а для графа jdt (навигации по типам, методам и т.п.) .. можно
ведь было fqn-ы жавы перенести как на ::тэги? и упростить там апи по
связям» (maintainer, 2026-09-23 07:24, session 86982eb5); mounting,
spelling and members, the model, the same day.
Set aside. Binding every type in the environment, which cannot hold
tens of thousands of names; slashes in Java names, which give one name
two spellings and a conversion at every paste.

### D25 · Where the meaning of a field lives

Decision, proposed. A bare key in a tagged record is read through the
record's tag, whose declaration documents it; a namespaced keyword is a
global attribute owned by its prefix and documented once, so that a
field shared by several kinds of record, `:jdt/location` on a type, a
method and a field, has one document.
Source. The model, 23 September 2026, refining the first version's
decision that a tag's declaration documents the fields of its record,
from the design of Clojure's spec, where the meaning of an attribute
lives with the attribute. The maintainer has not answered.
Set aside. Documenting every field on every tag that carries it, which
gives a shared field as many documents as it has records.
Replaced by D50, under which a key stays short and a value shared by
several kinds of record carries its own tag.

### D26 · The benchmark

Decision. Both instruments, each in its role. The attempt of a fresh
model in the loop is the mission's measure and runs at milestones: a
script hands the model the first screen as its only prior, the task
with its input, and one tool, the query; every answer the tool returns
counts toward the bill; the first query the model offers as its answer
runs against the expected value. A deterministic proxy runs on every
branch: the token bill of the shortest reading path to a task's
expected query, the first screen, the documents of every operand and
tag the query names, and the printed answer, all derived from the
expected query itself. The threshold is the whole set; a task that
fails names a scar and enters this document. The tasks are the sister
project's queries and the command line's integration tests, each with
its expected value, so correctness is `eq` and needs no judge.

The attempt runs every task in three arms, the same tool behind each.
The first is the query. The second is code mode: the tool is an API the
model calls from code that runs in a sandbox, the pattern Cloudflare
published as Code Mode (Kenton Varda and Sunil Pai, 26 September 2025)
and Anthropic as code execution with MCP (Adam Jones and Conor Kelly,
4 November 2025), and which Anthropic's API ships as programmatic tool
calling (Bin Wu, 24 November 2025), so the arm needs no sandbox of the
project's own. The third is the shell: the tool answers JSON through a
flag and the model composes it with `jq` and `head`, the way the sister
project was used before qlang. Code mode keeps intermediate results out
of the context and speaks a language the model has read a great deal
of; the shell composes tools and lets a model discover them with
`--help`, but its pipes carry text, so `head` cuts a document in the
middle of an object and `wc` counts lines. The query has to beat both
on the bill and on first attempts, and a task where another arm wins
names a scar.
Source. The model, 22 September 2026, answering «почему все мое?»; the
arms, the model, 23 September 2026, from the three articles read whole,
after an outside reviewer called the niche empty, and «тулам гораздо
лучше живется, когда они живут внутри баша» (maintainer, 2026-09-23
14:18, session 86982eb5).
Set aside. The proxy alone, which cannot measure the mission; the model
alone, which cannot gate a branch; a single baseline, which leaves the
query unmeasured against the other.

### D27 · The first screen

Decision. The first screen is a screen, what a terminal shows at once,
about four kilobytes. The protocol for asking, `manifest`, `docs`,
`examples`, `spec` and how an error reads, is the same everywhere and
takes one paragraph written once in the core; the rest of the start
command's screen is the host's domain; the language's own base and its
seed pipelines stand on a screen of their own, one query away. The
cheap view is the default everywhere.
Source. The model, 22 September 2026, answering «почему все мое?».
Set aside. A larger first screen, which pays on every session for what
most never read. The price: a session facing a reshaping beyond
projection reads two screens before its first query.

### D28 · The ranking of the seven conditions

Decision. When two conditions of the satisfactory state conflict, the
earlier in their list wins. One model comes first, because a construct
that helps the first attempt but needs a second mechanism would have to
be explained on every first screen that follows; then self-description,
the measure itself; then one spelling, since a second spelling is what
goes stale under a session; then the consumers, since the language
lives inside its hosts; then the grammar's proportion. The sixth is the
precondition of the others and competes with none; the seventh yields
only to a branch that introduces a model.
Source. The model, 22 September 2026, answering «почему все мое?».

### D29 · The route is a sequence of milestones

Decision. The work runs from the start, the tree as the scars describe
it, to the finish, the tree the chapter on the finish describes,
through milestones that are states of the language, each followed by a
release. The order of branches under a milestone illustrates and binds
nobody; a scar leaves this document when the tree no longer shows it.
Source. «нам нужна точка старта и точка финиша, и их итеративно
проявляем/уточнями.. что б в коцне концов получить итоговый маршнут и
последовательность вех на нём» (maintainer, 2026-09-23 00:04, session
86982eb5); on the order of work as an illustration, «в плане если это
просто для илюстрации порядка будущих работ - то ок. но как
ОБЯЗАТЕЛЬСТВО - я против подобного» (maintainer, 2026-09-22 04:09,
session 0ea77851).
Set aside. A ledger with closing conditions and statuses, which turns
the order of work into an obligation and drifts from the tree.

### D30 · The texture of the code is repaired by every branch

Decision. Every branch leaves the files it touches with comments that
state what holds in one sentence, moves any reason it finds into the
record of its decision or deletes it with the compromise it excuses,
and deletes false comments. The literal is the one lossless format; one
loader remains; the embedding surface is designed with the argument
model; the unused session surface goes; consumers keep no rule of their
own. The ratio of comment lines to code lines is measured against the
September master and falls.
Source. The model, 23 September 2026, from the reading of the whole
tree, answering what the maintainer asked of the work: «итоговый код
как бы дисцилировался, непрерывно улучшался, сокрашался, уплотнялся в
связях и качестве, а такое ощущение что модели хочется его разбавить
токенами, лишней писаниной или адхуками, которые следствие плохой
подготовительной работы» (maintainer, 2026-09-23 00:04, session
86982eb5).

### D31 · How decisions and requirements are recorded

Decision, partly adopted. Adopted in this document: decisions are
numbered records in this chapter, cited by number elsewhere, changed by
a new record that names the one it replaces; a block fenced as `qlang
target` states the answer a repair must produce. Proposed and designed
in the entrypoint document, not yet adopted: each new or replacing
record lands on master as a commit whose subject begins with its
number and whose body is the record, commits that implement a decision
carry a `Decision:` trailer and a replacing record a `Supersedes:`
trailer, and the status of a record is computed from those trailers;
the conformance cases are the requirements of the language, a case
that confirms a decision names it and is red until the branch that
implements the decision makes it green; the probes and the `qlang
target` blocks of this document run as tests, through the probe runner
the entrypoint document carries, so that a changed answer marks the
sentence around it stale.
Source. The maintainer proposed Markdown decision records and empty
commits (2026-09-23 01:29, session 86982eb5), asked for chronology and
immutable hashes, «а хронология, ссылки на коммиты и т.п. незименяемые
хэши... а как кратко ссылаться на предыдущее?» (2026-09-23 02:06), and
for tests as the basis of requirements, «у нас есть юнит тесты, они
ведь могут служить оснвой какой-то для формирования и проверки
требований?» (2026-09-23 02:14); the design, the model, the same day.
Set aside. Records as a directory of files beside git, which duplicates
the identity, chronology and immutability git already has; empty
commits, which blame cannot reach and a squash merge swallows; the unit
tests as requirements, since almost all of them import the internals
they check.

### D32 · Every value has a kind, and a bare literal has the core's

Decision. Every value has a kind: the outermost tag of its stack, and
for a value without a tag of its own, the kind of the core its literal
implies. `[…]` implies the vector, `{…}` the map, `#[…]` the set,
`~(…)` the quote, `|~~ … ~~|` the doc, and a number, a string, a
keyword, a tag name, a boolean and null each have their own; a host's
value carries its tags above one of them. The core's kinds are named
under its prefix, `::qlang/vec`, `::qlang/map`, `::qlang/number`,
`::qlang/set`, and print short, `::vec`, since the names without a
prefix belong to the core [D23]. The printer writes every tag of a
stack except the kind the brackets already imply, so `[1 2]` prints
bare and `::jdt/list[1 2]` prints its tag. `type` answers the kind of
any value, `[1 2] | type` answering `::vec`, and `type | docs` leads
to the kind's page for a value of the core as for a host's. The long
form `::qlang/vec[1 2]` reads as the same value and is never printed.
Source. «с этой позиции то что без тэга это все голый ::qlang и его
наймес только и [] и {} ~{} и что там было ... который мы опускаем..»
(maintainer, 2026-09-23 18:20, session 86982eb5); «да, ты прав насчет
вид: ::qlang/vec, ::qlang/map, ::qlang/number, ::qlang/set»
(maintainer, 2026-09-23 18:25); the printing rule and the answer of
`type`, the model, the same day.
Set aside. One tag `::qlang` over every value of the core, which names
the owner and loses the kind the core's verbs dispatch on.

### D33 · A kind owns its constructor, JSON form, order and laws

Decision. The contracts of a value attach to its kind. A kind declares
its constructor, which checks and normalizes a payload after the
parser has read it, since no kind reads text itself; its JSON form, the
lossy codec of the boundary, which by default drops the tag and writes
the payload, and from which only the core's kinds come back; its place
in the one order, the core fixing the order of its own kinds and the
hosts' kinds following by name [D48]; and its document, whose examples
are its laws. The literal belongs to no kind: one rule of the core
prints every stack, and `parse(print(v)) = v` holds for every kind and
is tested with the kind's examples. A rendering, the dark cockpit, a
compact view, a table, is a view at the boundary, lossy and marked by
elision, and a kind may offer one to its host.
Source. «и возможно к ним же и можно подцепить все эти
printValue-контракты или что там можно присобачить тогда.. сериализацию
десериализацию там какую если надо» (maintainer, 2026-09-23 18:25,
session 86982eb5); the literal kept apart from the renderings, the
model, the same day, from the printer that drops `::builtin` because
its table of handlers has no line for it.
Set aside. A kind that prints its own literal, which lets a host print a
node as a reference and breaks the involution.

### D34 · A verb is found by walking the subject's tags

Decision. A verb resolves against the subject by walking its stack of
tags from the outside in, down to the core's kind at the bottom [D32];
the verbs of a payload's shape and the global verbs of the first
formulation are the verbs of the core's kinds. A host puts its verbs on
the tags it owns, its own noun included, `::jdt | projects`,
`::workflow | status`, so no verb of a host takes a global name. The
core owns the contract of a verb that several kinds answer, its
document and its examples, and every specialization answers the
examples as laws; a verb means one act wherever it resolves, and a kind
implements it. `status` and `compact` are verbs of the hosts whose
contracts are shared, the way `git status --porcelain` is a promise of
form. The rest of the rule of collisions stands [D23].
Source. «да, ::jdt | projects и ::jdt | status и т.д. - это именно то о
чем я и думал...» (maintainer, 2026-09-23 15:34, session 86982eb5);
«SVO звучит практично и как то что нам подойдет» (maintainer,
2026-09-23 17:49); «если мы делаем 'status | compact' - то compact же
будет резолвиться относительно результата прошлого шага.. от его тэгов
стартовать» (maintainer, 2026-09-23 18:00); «status и compact это
вероятно хостовые концерны.. ядру они не особо нужны..» (maintainer,
2026-09-23 18:13); the contracts and their laws, the model, the same
day. The order rests on an asymmetry the maintainer named, «если я
использую "Инвариант ..." и надо будет подставить глагол - то вариантов
будет сильно меньше» (maintainer, 2026-09-23 17:32): after a noun the
verbs that can follow are few, after a verb the nouns are many, so the
subject first narrows a model's next step and a completion list alike.
Set aside. The verb first, the order of a shell's command line, which
opens the whole catalog at the first word.

### D35 · The subject opens its namespace

Decision. A noun in the subject position is the pipeline value and
opens its namespace for the steps after it, so that mentioning a host
is using it. Every pipeline starts inside the core's namespace, and a
host's pipeline inside its own, `::qlang | ::jdt`. A name typed bare
resolves first among the core's names, then as a module mounted at that
name, then through the nearest open namespace outward. The search
happens only where a name enters the text: the values a host produces
carry qualified tags, so dispatch between steps never searches. A name
that two open namespaces know is a refusal that lists both, an answer
names who resolved its names, and a qualified name skips the search.
An argument is a fork from the subject, as it is today, so it resolves
inside the subject's namespace and what it opens ends with it:

```qlang
> [1 2 3] | take (count | sub 1)
[1 2]
```

Source. «типа дефолт любого пайплайна это ::qlang в субъектной позиции
и это триггерит загрузку модуля и дальнейший резолв относительно
субъекта .. а если мы внутри jdt - то там это просто '::qlang | ::jdt'
в роли умолчания .. и если я пишу потом ::app/m8/Handler - то
резолвится сначала прямой модуль, если нет - то через ближайший ...
т.е. через ::jdt ...» (maintainer, 2026-09-23 17:49, session
86982eb5); the boundary of the search, the refusal of ambiguity and the
scope of an argument, the model, the same day, from the search lists of
DNS, where a name that resolved through one domain resolves through
another once the other starts to know it.
Set aside. A search at every step, which lets a value change its
meaning between two steps; the first match among open namespaces, which
lets a new module change the meaning of an old query.

### D36 · A namespace is a subtree of names with its provider

Decision. The flat environment splits into three things. The lexical
scope holds the names the user declares in a query, and it is all that
`env` shows. The verbs live on tags [D34]. The nouns form a tree of
names in which each subtree is answered by a provider: the core answers
its own names, a host its prefix and the names it mounts, the `.qlang/`
folder of a repository its project [E1 in the entrypoint document]. A
namespace is such a subtree with its provider, the way a file server
was mounted at a path in Plan 9. A module is the unit that brings tags
with their documents and the verbs on them. One loader remains, from a
tag to its provider to its declaration, and the stages of the
bootstrap, the language's catalog, a host's catalog, the user's query,
become namespaces asked when a name needs them rather than stages that
merge their deltas into one environment. `use` remains for bringing a
library's declared pipelines into the user's names. The kernel is the
evaluator with its table of primitives and the one shape it knows,
`::builtin`, which the catalog documents rather than defines.
Source. «а ещё неймспейсы все никак не поймем что такое.. по крайней
мере я в них плаваю, с учетом субьекто-ориентированности .. тут я ещё
не осознал решение» (maintainer, 2026-09-23 17:17, session 86982eb5),
with the long pipeline recalled in the same message, «langSpec |
langRuntime | hostRuntime | userQuery | hostRendering !|
hostErrorHandling»; the split, the model, the same day. It rests on the
conceptual model of `docs/qlang-internals.md`, whose state starts from
the runtime as its subject, and on the seeding of `use` and
`::builtin` in `buildLangRuntime` (`core/src/runtime/index.mjs`),
which the code calls “Chicken-and-egg”.
The kernel as the bottom, documented by the catalog and defined by
nothing in it, was left to the model: «здесь на твое усмотрение, что
красиво в коде - то красиво и в использовании как по мне...»
(maintainer, 2026-09-24 00:55, session 86982eb5), and the model keeps
the decision as it stands.
Set aside. Namespaces as maps merged into one environment, which is the
scar of names that lose their origin.

### D37 · A host's setting is the first value of the pipe

Decision. A host sets up a query by one thing, the value its pipe
starts from, and by nothing else in the environment. `jdt q 'status'`
is `qlang '::m8 | status'`, the workspace derived from the working
directory, or `::jdt` when none is. The command line of the language
starts from the standard input when it carries bytes, and otherwise
from the noun of the nearest `.qlang/` folder, or `::qlang` outside any
project; the empty start as `null` goes. The module is the unit a host
ships: a catalog with its implementations, loaded by the language's
command line through its tag and by the host's command as its default
subject. A registry of the user's, written by the host's setup, lets the
language's command line and the language server find the modules
installed outside a repository.
Source. «если поступать так, то все вроде как связно выходит»
(maintainer, 2026-09-23 16:32, session 86982eb5), answering the model's
sentence that a host's setting comes down to the first value of the
pipe; the default subject and the registry, the model, the same day.
Set aside. Seeds a host installs into the environment before the query,
which is the long pipeline this replaces; `null` as the start, which
carries no meaning where a noun can.

### D38 · Several workspaces

Decision. A name of the sister project is a workspace and a name inside
it, since several workspaces open at once are ordinary. A name
qualified by its workspace, `::m8/app.m8.web.Handler`, is unambiguous
everywhere; a workspace in the subject position resolves the names
after it, `::m8 | ::app.m8.web.Handler | source`, and
`[::m8 ::m8-review] * (::app.m8.web.Handler | source)` compares two
checkouts. Every node a host answers carries its workspace, so the verbs
applied to it search where it came from. A bare name resolves in the
workspace derived from the working directory; a name that several open
workspaces know is a refusal listing the qualified candidates, the way
the sister project refuses an ambiguous overload with
`:context/candidates`. A binary type whose source lives in another
workspace answers with a link to it.
Source. «несколько воркспейсов в эклипсе обычное дело как оказалось..
много кто ревьювит код так, или просто одному проекту делает воркспейс
или там в одином пишет клиент, плагин.. а в другом откыто апи или
сервер и их документацией исходниками и т.п.» (maintainer, 2026-09-23
15:42, session 86982eb5); the mechanism, the model, the same day, after
reading `docs/jdt-use-spec.md` and `cli/src/resolve.mjs` of the sister
project.
Set aside. A workspace pinned outside the value, as `jdt use` pins it
in files keyed by the parent process and the terminal tab: on 23
September a pin written on 18 September for a shell long gone named a
process id that another process had taken, and no answer says which
workspace it came from.

### D39 · Commands write, queries read

Decision. A query reads. What changes the world or streams to a
terminal, a launch, a test run, a build, a refactoring, stays a command
of its host, and its result becomes a noun that queries read,
`::jdt | launches`, a launch's status, its log in pieces. A command and a
query address the same names, the pair of control and status files
Plan 9 gave every resource.
Source. «просто qlang это все ещё язык запросов.. а в jdt и всякие
мутации и стриминг в консоль чего там только нет.. но все что readonly
конечно можно выставить в qlang напрямую» (maintainer, 2026-09-23 16:14,
session 86982eb5); the pairing, the model, the same day. The question of
effects as emitted values stays open.

### D40 · Named options are one map

Decision. A command's positional modifiers stay few, since their place
is their role; the options beyond them are one map whose keys the verb
declares, where a key names the role and the order is free, as a case
names the role in a language whose word order is free. A view needs few
options when its default is the cheap one and more is read by the query
that follows it, a projection or the quote of an elision marker.
Source. The model, 23 September 2026, answering the maintainer's
recollection of PowerShell's switches and splatting, «когда можно быбло
писать jdt 'status { :compact true}' или как-то ещё jdt 'status
:compact' ... в общем не то что бы оно сильно нужно» (maintainer,
2026-09-23 18:13, session 86982eb5).
Set aside. A keyword standing for `{:k true}`, which is a second
spelling; binding a map in the pipe to a verb's parameters by name, as
PowerShell binds by property name, which takes the subject's place.

### D41 · An edit keeps its kind, and `within` edits under a tag

Decision. Whether a verb keeps its subject's kind is part of its
declaration, as its result [D4], and never an option of its
implementation. When it keeps the kind, the constructors of the tags
above the edited payload run again from the inside out, and an edit
that breaks an invariant is a refusal naming the field and the kind it
expected. A host may own the verbs of editing on its tags, so a kind
may be read only, a computed dashboard refusing `assoc`, and `payload`
is then the deliberate exit into plain data. `within ~(…)` edits under
one tag: it takes the payload, applies the quote to it as a fork, and
wraps the result back into the same tag, whose constructor runs once,
at the rewrap; the steps between may break the invariant, since an
invariant holds of the result, and a deeper stack is reached by
nesting. A kind's laws are written with it:
`::jdt/gate{:name :net :state :red} | within ~(dissoc :state)` answers
the refusal of `:state`, and `#[1 2] | within ~(append 1)` answers
`#[1 2]`, the set's constructor normalizing where a record's refuses.
Source. «язык допускает прямое низкоуровневое редактирование тэгов ..
::jdt/dashboard::qlang/map{} - c заполненными как-то внутренностями ..и
если мы вводим какой-то аналог операнда set/assoc или чего там когда мы
имитируем мутабельность .. то то что оставалось валидным для ::qlang -
может стать невалидным уже для ::jdt и тогда конструктор отработает и
как-то ругнется что нарушен инвариант какой-то ... а хочешь что б не
ругалось - то сперва делай | payload и потом ковыряй чистый qlang»
(maintainer, 2026-09-23 19:45, session 86982eb5); «а как бы про
проваливание вгубь упаковок переделки внутренностей и запаковки всего
назад» (maintainer, 2026-09-23 19:59); the read-only kind, the model,
and «следствие которое нравится тебе, мне тоже симпатично» (maintainer,
2026-09-23 19:55); the rest, the model, the same day.
Set aside. The name `into`, whose prior from Clojure is conversion; a
conversion verb `into K`, which pours a value into a kind and would
fold `distinct`, the exit to the core's map and a checked construction
into one verb, left to the rule of the catalog [D22] until a task asks
for it; the behaviour of Clojure's records, where `dissoc` of a declared
field silently answers a plain map, which is today's `union` over a
tagged map.

### D42 · Any value comes apart into atoms and back

Decision. Every value comes apart into its atoms, null, booleans,
numbers, strings, keywords and tag names, and a shape, a quote over the
vector of those atoms written with projections, `/0`, `/1`; applying
the shape to the atoms rebuilds a value equal to the first. The taking
apart and the putting back are written in qlang with its own verbs,
`payload`, `tag`, `type`, `keys`, `indexBy`, the literals and `*`. The
ring is closed when they are, a part that needs a primitive of the host
language marking it open, and the round trip runs over every example of
the catalog and every literal of the conformance cases.
Source. «просто я рассматриваю сейчас задачу программной сборки и
разборки квоты средствами самого qlang .. у нас в нем есть неделивые
никак дальше атомы, а есть молекулы-датумы или как ты их называл .. так
вот хочется уметь разбирать все до атомов и наоборот собирать все из
атомов ..» (maintainer, 2026-09-15 20:36, session f4f0c99b); «мне
важная некая обратимость и симметричность формы .. т.е. если я что-то
разбираю до атомов и дальше из них собираю .. то у меня не должно
возникать ступора..» (maintainer, 2026-09-15 21:23); «да входе у нас
вектор атомов - на выходе из него мы должны уметь получить любую
собирающуюся из частей стрктуру используя там /0 /1 /2 /3 /4 /5 .. ну и
наоборот ..» (maintainer, 2026-09-23 20:10, session 86982eb5); the
shape as a quote over the atoms, the model, the same day.

### D43 · Code is a quote, and only `apply` runs it

Decision. A modifier is read by its own form and evaluated at the call
against the subject, a bare name and a group included, so `take count`
takes as many elements as there are [D12]. Code is a quote, `~(…)`,
and a quote of a single word may drop the parentheses, `~add` or
`~/age`; the full form is the main one, which the printer writes and
the documents show. Nothing runs a quote but `apply`. An operand that
runs a part per element, in its own order or only when that part is
chosen declares the slot of kind code, takes a quote there and nothing
else, and applies it: `filter ~(gt 1)`, `reduce 0 ~(add)` as the
canonical fold, the branches of `if`, the clauses of `cond` and the
alternatives of `coalesce`, while the condition of `if`, which always
runs first, is a value, `if (n | lte 1) ~(1) ~(…)`. So `filter (gt 1)`,
whose group computes a boolean at the call, is refused, and the
refusal names the tilde. A declared pipeline's parameters are values,
and its body applies one that holds code, `:twice [:f]
~(apply f | apply f)`. A quote written as a modifier carries the
environment of its call, so code handed to another pipeline sees the
names of its author wherever it is applied; a quote held as data
resolves its names where it is applied. A combinator is set off by
whitespace on both sides, a line break counting as whitespace and an
opening bracket or the start of the text standing for the space before
it, so `|~`, `|~|`, `|~~` and `|~~|` written together always open a
comment or a doc, `| ~(add)` is a pipe before a quote, and a
combinator written against its neighbour is refused with a message that
names the space. A line that ends with a combinator is continued by the
next line through it [D11]. Inside a doc only `~(` opens a quote, and
the rest is prose.
Source. «квота это просто данные и любой их неявный автозапуск может
удивить .. есни надо выполнить квоту - то против субъекта (apply q) это
явно и правильно звучит ... может просто в других местах не хватает
apply .. на вызываемой стороне ...» (maintainer, 2026-09-23 21:14,
session 86982eb5); the short form, «а если как-то доработать грамматику
квоты до ~add без скобок ?» (21:23); the space, «я просто думал
что |-комбинатор эт |+пробельный символ или как там..я бы и спереди и
сзади требовал такое..» (21:33); «согласен запретом короткой формы в
доках, убедил .. и с тем что выше согласен... если ты подвердишь что с
многострочными примерами и переносами комбинаторов туда сюда проблем не
будет и все будет праситься как надо..» (21:40), a condition the model
checked the same night, as the scar of the call in the second version
of this document records; «ну и само
собой полная форма ~(add) остается за главную...» (21:43). The rest, the
model, 23 September 2026: the reading of modifiers, the canonical fold,
the refusal and the rule for a doc in the evening, and that night the
slot that takes code alone, the condition of `if` as a value, the
clauses of `cond` as quotes and the environment a handed quote carries,
the last from a probe in which a parameter of the body captures a name
of the caller.
Set aside. A slot of kind code that captures its modifier and runs it
later, the form of D4 and D12, under which a call reads only with the
operand's declaration at hand and a quote meant as data is run by the
slot it lands in. A bare name that stands for its binding without
running it, as `+` does in Clojure's `reduce`, which keeps `reduce 0
add` and makes `take count` a refusal. The quote without a short form,
which costs two brackets on every reference, and the short form inside
a doc too, where `~/.jdtbridge`, `~5` and `~~struck~~` would need
escapes and a forgotten escape breaks a document silently. A new sign
for a reference, `&add`, which spells code a second way, and a new sign
for a comment, `#`, which trades the trap at `|~` for one at `#[`. A
slot that takes a value or code and runs code, as Smalltalk's `value`
answers on any object, under which a branch computed at the call
silently does its work and a quote held as data runs where it lands. A
quote that resolves its names only where it is applied, which lets a
parameter capture a name of the caller; a slot of kind code that closes
what it receives, which leaves open to that capture every declared
pipeline whose declaration omits the kind; a quote that carries its
environment wherever it is evaluated, which makes a quote held as data
more than data.
Replaced in part by D44, which gives a quote written as a binding's body
the environment of its declaration.

### D44 · A binding names a value, and a verb declares its slots

Decision. A binding names a value: its body is evaluated once, at
declaration, against the current value, and a quote body is a quote held
as a value, so `:q ~(add 1) | q` answers `~(add 1)`. A verb is the same
form with its slot list, `[]` when it takes no modifiers, and a quote
body, `:inc [] ~(add 1)` and `:m [:x] ~(mul 10 | add x)`; it runs when
it is mentioned, as a built-in does, and `~inc` hands it on as code. A
value never runs by itself, and `apply` runs a quote; a slot of kind
code applies what it receives, so a named quote goes into it bare,
`:adult ~(/age | gte 18) | [{:age 30} {:age 12}] | filter adult`.
Today's lazy binding splits in two: the verb keeps its behaviour,
computed at each mention against the subject there, and the value is the
snapshot `as` used to make. A quote written as a binding's body carries
the environment of its declaration, as one written as a modifier carries
that of its call [D43]. A name is declared once in a scope, and a second
declaration there is refused; a cell of the REPL opens a scope of its
own. Under these rules code moved into a declaration further left
answers as it did inline or is refused: a quote or a verb means the same
wherever its names mean the same, and only a value, computed where it is
declared, follows the subject there, as its spelling shows.
Source. «[] у каждого глагола без модификаторов - и это правильно ..
согласен с предложениями, в целом ..» (maintainer, 2026-09-23 23:02,
session 86982eb5) and «ок, это меня устроит .. выходит проще и
синтаксически куда заметнее .. методы вызываются по одной логике, квоты
по apply .. все различимо и юзкейсы не перемешиваются» (23:14). It
answers «тут как по мне заворачивание в скобки может смутить .. с другой
стороны нехота везде писать apply q -- но может так и честнее и
правильнее» (22:47), read with «когда мы это все первый раз решали .. то
ещё не было осознано .. что дает субъектно-ориентированность .. вообще
про это не думали тогда» (22:50): under subject orientation a verb is
the vocabulary of a kind [D34], and a name the user declares is a noun.
The law of extraction answers «не нарушится ли логика .. если я
инлайново написал какой-то степ с квотами внутри.. а оптом просто что б
сократить написание вынес их в объявления левее .. и у меня неожиданно
поменялось поведение..» (23:02). The slot list as the mark of a verb,
the environment of a named quote and the single declaration, the model,
the same night.
Set aside. The quote body as code, the first spelling of D5, under which
one literal is data everywhere but as a body and a quote held as a value
needs a group, `:q (~(add 1))`. `apply` before every declared pipeline,
under which a user's verb is called otherwise than a built-in and a
host's catalog reads `apply problems`. A named quote that resolves its
names where it is applied, which keeps extraction free but lets a
parameter of another verb capture a name of the caller. A second
declaration of a name in one scope, which lets a quote moved left past
it silently see the first.
Replaced in part by D45, under which a built-in is a verb with the same
slot list and its descriptor for a body.
Replaced in part by D57, under which a verb is a binding whose value is
a conduit, written `~[slots](body)`, and the slot list leaves the place
after the name.

### D45 · The slot list carries the kinds

Decision. A verb's slot list says what the verb accepts, in the language
of a schema [D6]. A slot's kind follows its name, `[:n ::number :ids
[::number] :dir #[:in :out] :f ::quote]`, and a name without a kind
takes any value; since a name is a keyword and a kind a tag name,
`[::number]` after a name is a vector of numbers, as it is in a schema,
and the collision D6 foresaw does not arise. The subject's kind stands
first, before the names, `[::jdt/Method]` and `[::number :n ::number]`,
so the list reads in the order of the call; a verb with a subject kind
lives on that kind [D34], and one without takes any subject. The result
of a declared pipeline is the kind its body answers, so the fact has one
spelling: a body that promises a shape tags its result, and the tag's
schema checks it. Host code, which has no body in qlang, declares its
result with its descriptor, and a built-in takes the same slot list,
`:add [::number :n ::number] ::builtin{:impl :qlang/prim/add :returns
::number}`, so `:subject` and `:modifiers` leave the descriptor. A
declaration writes a kind of the core short, `::number`, as the printer
does [D32]: a name without a prefix belongs to the core, resolves among
its names first, and no other scope may declare it [D23, D35];
`::qlang/number` reads as the same kind.
Source. «ок, все устраивает» (maintainer, 2026-09-23 23:31, session
86982eb5), accepting the model's three rules and its answer to «а
::number или ::qlang/number или как мы там недавно вводили для
примитивов тэги .. что б формально точнее быть и ссылать на одно и то же
объявление .. без разночтений что такое ::number» (23:29). The result
read from the body follows «форму ответа можно было вывести»
(maintainer, 2026-09-22 02:09, session 96f3df79). The rules, the model,
the same night.
Set aside. The kinds in a descriptor beside the slot list, today's
`:subject`, `:modifiers` and `:returns`, which give the call two
spellings and have drifted, `gt` declared for numbers and comparing
strings. A declared result for a declared pipeline, a second spelling of
what its body answers. The subject's kind written before the verb's
name, `::jdt/Method :callers …`, which reads as a kind standing in the
subject position followed by a binding. The long form `::qlang/number`
in a declaration, which the printer would not write back.
Replaced in part by D57, under which the slot list stands in the head of
the verb literal, each slot written as a declaration with its doc, the
result's kind stands last in the head as the subject's stands first, and
a built-in carries its slots and its result in its descriptor.

### D46 · A refusal keeps the tag of its site

Decision. Error identity stays per site: every place that refuses has a
tag of its own, named so that a reader knows at once what failed,
`::AddLeftNotNumberError`, and pointing at that one place in the system.
The tag is declared once, in the catalog beside its operand, as a kind
[D6]. Its schema owns the facts of the site, in the order a reader needs
them; the step, the input and the trail are the frame every error
carries, declared once by the kind of errors and printed after the
facts, so the signal comes in the first characters and elision takes the
tail. Its document is the site's procedure [D7]. A throw site passes the
facts and the tag's constructor checks them, so no place adds or drops a
field that another fills. What leaves with today's declarations is their
second spelling: the JavaScript class of every site, the registry of
throw sites, the stamping passes, the drift tests, the injection script,
and the converter's table of field order. A host's refusals carry tags
under its prefix [D23].
Source. «я не хочу генерик сайты - это откат для рантайма.. потом
какие-то поля в одном месте добавлять, в другом убирать - у семерых
нянек дите без глазу.. всетаки это более сильный сигнал для читающей
ошибку модели, куда качественнее дообогащаемый.. и там ещё кажется
как-то порядок обявления полей влиял на их printValue - тем самым важное
шло в начале, в первых же символах.. неважное могло быть в конце и
спокойно подвергаться элизии ..» (maintainer, 2026-09-23 23:53, session
86982eb5), holding to «стоит ли реюзить ошибку между операндами -- как
по мне сомненительно, это снижает диагностическую ценность полученного
сигнала - куда проще когда имя ошибки уникально (или её какой-то
идентификатор) пойнтит в единственное место во всей системе (но возможно
это вкусовщина моя такая..)» (maintainer, 2026-09-14 23:30, session
268516f5). The schema as the owner of the fields and their order, and
what leaves, the model, the same night.
Set aside. One tag per kind of refusal with the site as fields, the
first form of D7: fewer pages and a weaker signal, and a tag shared by
sites that each fill its fields their own way. A per-site tag the
runtime derives from the facts, which has no entry of the catalog behind
it.

### D47 · A modifier is stored as its step, in a form of eight tags

Decision. A command's modifiers are words [D10], and the data form
stores each as its step, by the rule of a literal's elements: a literal
as itself, a quote literal included, a name or a projection as its
record, a group as its quote under `::group`. `add ~(x)` and `add x`
stay apart, `[~(x)]` against `[::call{:name :x}]`, and no quote is
doubled, so `filter ~(gt 1)` is `::call{:name :filter :args [~(gt 1)]}`
and assembling it is writing what one reads. A field that holds a word
holds its step, and a field that holds a pipeline holds a quote: a value
binding is `::bind{:name :q :body ~(add 1)}` and a verb `::bind{:name
:inc :slots [] :code ~(add 1)}` [D44, D45]. The data form speaks with
eight tags of the core, written small as the core's kinds are [D32]: the
records `::call`, `::proj`, `::bind` and `::tagged`, and the wrappers of
a step, `::each` for `*`, `::flat` for `>>`, `::fail` for `!|` and
`::group` for parentheses; `::flat` lives as long as `>>` does.
Source. «ок, принимаю» (maintainer, 2026-09-24 00:07, session 86982eb5),
answering the model's proposal and its question on the case of the
names. The rule, the model, the same night, from the one word of D10 and
the quotes of D43, held to the maintainer's measure of 15 September:
«мне важная некая обратимость и симметричность формы .. т.е. если я
что-то разбираю до атомов и дальше из них собираю .. то у меня не должно
возникать ступора.. а почему из полученных запчастей я не могу
пересобрать то же самое назад самым очевидным интуитивным синтаксисом»
(maintainer, 2026-09-15 21:23, session f4f0c99b).
Set aside. Every modifier as the quote of its pipeline, the form of 15
September, which doubles the quote of every code modifier once D43 makes
code a quote and asks an assembler to wrap a literal as `~(1)`. The
names with a capital, `::Call`, which the first sketch used and the
core's kinds do not.
Replaced in part by D51, under which `>>` leaves and `::flat` with it,
so the form speaks with seven tags.
Replaced in part by D57, under which a verb's binding holds its conduit
as its body, `::bind{:name :inc :body ~[](add 1)}`, so a binding is one
record.

### D48 · The order of the kinds

Decision. Values order first by kind: null, boolean, number, string,
keyword, tag name, vector, set, map, quote, doc, error and elision, and
after them the kinds of the hosts by name [D33]. Within a kind the order
is today's: numbers by value, strings by their code units, vectors
element by element, a set as its vector, maps by their keys and then
their values, and a host's value by its payload. The part that JSON has
is the order of jq, null before false before true before numbers,
strings, arrays and objects, so a session trained on jq meets no
surprise; a kind JSON lacks stands beside the one it resembles, the
keyword and the tag name after the string, the set after the vector, and
the kinds of code, prose and refusal after the map.
Source. «д17 ок и остальное что написал тоже ок» (maintainer, 2026-09-24
00:18, session 86982eb5), answering the model's list of the same night,
which placed the tagged kinds of the core [D32] and the kinds of the
hosts [D33] in the order of D17.
Set aside. The tagged kinds of the core ordered among the hosts' kinds
by the names of their tags, the reading of D17 before D32, under which a
host's kind whose name sorts before `quote` would fall between two kinds
of the core.

### D49 · The catalog serves a host without a shell

Decision. The measure of D22, what every host would otherwise write,
counts a host that has no shell around its queries, the site's sandbox
and its demos among them. The core therefore carries the working set a
shell would otherwise supply: the JSON codec both ways, text as lines,
`split` and `join`, trimming, replacing, case and search. A host keeps
its domain, its input and output, `@in`, `@out` and `@tap`, and its
renderings, `table` and `template`, since a rendering is a view at the
boundary [D33] and the sandbox draws values itself. The benchmark [D26],
run in the sandbox, is the measure: every task is solved by the query
alone, and a task that lacks an operand names it.
Source. «d22 непонятно будет когда у нас песочница в австросайте и демки
... им по идее тоже нужны эти базовые вещи .. т.е. не только одним башем
мы живем..» (maintainer, 2026-09-24 00:36, session 86982eb5), and «ок,
согласен ...» (00:44) to the model's reading of it.
Set aside. Sizing the core by what the command line cannot reach through
its shell, the reading D22 was given, which leaves every other host to
write the same basics again.

### D50 · A field means what its schema and its value's kind say

Decision. A key of a record is short, and its meaning is given by the
schema of the record's tag [D6]. A value shared by several kinds of
record carries a tag of its own and is documented by it, once, wherever
it appears, `:location ::jdt/Location`; a Java type named by its tag is
already such a link [D24]. A schema names the kind of a field and stops
there: it never spells a nested structure inline, since the kind is a
link, and a reader who wants the fields of `::jdt/Location` follows it.
The depth is the reader's choice, the cheap view first and the detail on
demand [D21]: an axis that reads a declaration may take one map of
options [D40], of the depth, what to follow and what to expand, and
answer the expanded structure. The grammar keeps keys with a prefix for
a host that wants a global attribute; the convention of the core is the
short key.
Source. «d25 - там наверное что-то похожее уже было у ошибок возможно ..
:jdt/location возможно вообще какой-то тэг со своей структурой полей ..
если пор значения говорим .. а вот насчет длинных ключей в мэпах даже и
не знаю ..» (maintainer, 2026-09-24 00:36, session 86982eb5); «ок,
согласен ... и да .. не надо в схеме пытаться там сразу всю вложенность
мутить .. у нас же гипертекст :location ::jdt/Location и все .. кому
надо подробности тот уже делает провал в схему ::jdt/Location - и
добирает {:file … :line …} и остальное .. есни надо то там docs и
остальное можно параметризовать какими-то мэпом потом с ключами {
:глубина фоллоу expand и т.п.} - который выдаст массив или ещё какую-то
нестед структуру если надо ...» (00:44). The comparison with Clojure's
spec, where the meaning of an attribute lives with a namespaced keyword,
and with Hickey's talk Maybe Not, where which keys a map must hold is
decided where it is used, the model, the same night.
Set aside. Global attributes under long keys, the proposal of D25 after
clojure.spec, which JSON-shaped data and the sessions trained on it do
not expect and the tags of values make unnecessary. Documenting every
field on every tag that carries it, which gives a shared field as many
documents as it has records.

### D51 · `>>` leaves

Decision. The flatten combinator leaves the language: `x >> f` is `x |
flat | f`, and the operand `flat` already says it. With it go its tokens
in the grammar, its branch in the evaluator and its refusal, its syntax
in a trail, its token in the editor's grammar, and its tag in the data
form, `::flat`, so the form speaks with seven tags [D47]; its
conformance cases go with it, the one example of the catalog that uses
it is written with `flat`, and the refusal it raised leaves with its
page.
Source. The model, 24 September 2026, at the opening of the ring branch,
which this document left to decide it before encoding it; the maintainer
asked «а что с судьбой >> ? операндом заменить или что ?» (maintainer,
2026-09-24 01:04, session 86982eb5), and no operand is needed.
Set aside. Keeping `>>`, which spends a token, a production, a branch of
the evaluator and a tag of the data form on what two steps already say.

### D52 · The parentheses after `*` delimit its body

Decision. The body of `*` is the step after it, and parentheses there
delimit the body the way a call's parentheses delimit an argument, so
the body's own head meets each element and rides `|` unless it names
another combinator: `* (false !| true)` asks each element whether it is
an error, `* (!| 0)` recovers an error element, and `* (count)` hands
one on with its trail. In the data form the distribute wraps the quote
of its body, `* (false !| true)` being `::each~(false !| true)` and
`* add(1)` being `::each~(add(1))`, while a group inside the body stays
a group.
Source. The model, 24 September 2026, on the ring branch, from the
example the scar of code as data in the second version of this
document gave for a head that rides `|`, in
which the group after `*` answers as the same group written with a
leading `|`.
Set aside. The group after `*` as one step riding `|`,
`::each::group~(…)`, under which the group deflects an error element
before its `!|` can answer, so `* (!| 0)` no longer recovers one and no
body under `*` can ask whether an element is an error.

### D53 · The data form reads the call form until the command form lands

Decision. On the ring branch the quote is the vector of steps D8 and D47
describe, read from the call form of today's surface: a call holds each
argument as the quote of its pipeline, since in the call form an
argument is code the operand runs against an input of its choosing, and
the branch of the command form moves the argument of a value slot to its
step [D47]. A container literal holds the steps of its elements, a
pipeline element as its group; the step of an error literal is an error
value whose fields hold their steps as written; a path segment is an
index when the parser saw a canonical integer and a key otherwise;
`type` answers the code tag, `::quote`. A quote literal's content is
read with the text around it, so a literal that holds no pipeline is a
syntax error, `~{}` is the empty quote and runs as the identity, and
inside a doc a `~{…}` that does not read as code is prose. A quote runs
through the tree it was read from, or through the parse of its printed
text, kept on the quote. `parse` flips text and a quote; the map of the
parser's tree, `/source` and `/ast` leave with the code they served, and
a trail prints without the `|` of its head. `tag` mints through the
tag's constructor when the tag carries one, so `tag(::quote)` refuses a
vector holding an element that is no step; the records and the wrappers
name identities alone until their constructors refuse a wrong field.
Source. The model, 24 September 2026, on the ring branch, reading D8,
D47 and D52 in the call form the ring keeps.
Set aside. Each argument as its step on this branch already, which needs
the kinds of the slots to tell code from value and prints
`filter(false !| true)` as a group, changing what the argument does to
an error element. The parser's tree as the quote's payload, which
carries positions and text into the data. A quote literal read when it
runs, which keeps an unparseable literal alive until then and leaves its
steps undefined.
Replaced in part by D54, under which the records and the wrappers carry
constructors that read each step back from its text.
Replaced in part by D55, under which a command stores each modifier as
its step and the quote literal is `~(…)`.

### D54 · A step is what its text reads back as

Decision. The constructor of every record and wrapper of a quote checks
the fields the printer reads against the record's schema, prints the
step and reads the text back; an assembly that reads back as another
step, or as none, is refused where it is made, with the text it printed
as. The printer therefore prints what text can produce and nothing more.
The wrappers of the fail track and the distribute, a declaration and a
documented `as` stand in a pipeline alone, so inside a container, a
field or a payload a step is an element step, and an error is a step
when it is an error literal's, under `::Error`. `parse` and its inverse
round-trip every example of the catalog, which a test written in qlang
holds.
Source. The model, 24 September 2026, on the ring branch, from the rule
of the scar of code as data in the second version of this document
that a wrong assembly is refused by the
record's constructor at construction rather than run as a program.
Set aside. A constructor that turns a wrong assembly into the step its
text reads back as, which accepts what the author did not write. The
fields checked one by one against the grammar's classes, which copies
the parser into the runtime. The quote's constructor reading every quote
back from its text, which a transform of a large quote would pay for in
parsing.

### D55 · The command form as it reads

Decision. The command form of D10, D11 and D43 reads as follows where
those records leave a choice. The first modifier of a command may touch
its name when it opens with a parenthesis, so `filter(gt(1))` reads as
`filter` with the group `(gt(1))`, and a call written by habit runs at a
value slot and is refused at a slot of code; every other word is set off
from the one before it by whitespace or a comment, so `add (1)(2)` is
refused. Inside a literal every element is a word, so a pipeline stands
there in parentheses as a command with modifiers does, `{:n (/items |
count)}`, a call written by habit, `[mul(2)]`, is refused where it would
read as two elements, and a doc after a command is the next step and
never its modifier. At the top level a command whose modifiers take
several lines stands in parentheses, and inside brackets a declaration
that follows a command takes its `|`, since the command would take its
words. The short form of a quote holds a name, a projection or a tag
name, `~add`, `~/age`, `~::T`. The comma leaves the set literal with the
argument comma and stays in the JSON literals until the JSON family
leaves [D1]. The data form stores each modifier as its step [D47]: `add
1` holds `[1]`, and `take (count | sub 1)` holds `[::group~(count | sub
1)]`. A code span of a doc is prose, as markdown reads it, so a doc
names `filter ~(gt 1)` in a code span without running it, and only a
`~(…)` or a tag literal outside one is a segment of code. A refusal the
grammar names itself carries its sentence as `:message`: a combinator
written against its neighbour names the space, `|~` without a closer
names `| ~(…)`, a comma inside parentheses names the command form, a
word written against the one before it names the space, and a map entry
that holds a command, or a word of a literal written against the one
before it, names the parentheses.
Source. The model, 24 September 2026, on the command-form branch,
reading D10, D11 and D43 against every text of the repository and of the
sister project, which the parser of the call form and the printer of the
command form rewrote by machine, each rewritten text read back into the
tree the old one read into.
Set aside. A first modifier that must be set off by a space, under which
a call written by habit is a parse error even where it would answer
rightly. The elements of a literal as pipelines of bare commands, `{:n
/items | take 2}`, under which a word inside a literal reads otherwise
after a pipe than before it. A newline that stands for `|` inside
brackets too, which splits the parts of `if` and `cond` spread over
lines. A code span that opens quotes in a doc, under which a doc cannot
name a command with a slot of code without running its quote as an
example.

### D56 · A slot of code takes a quote before the argument model

Decision. Until the argument model executes the declarations [D4, D45],
an operand of the core whose slot runs code on each element or only when
chosen, a slot the catalog declares `:predicateLambda`, `:keyLambda`,
`:comparatorLambda`, `:reducerLambda` or `:pipeline`, evaluates its
modifier at the call against the subject; a quote is applied to each
input the operand hands it, in the environment of the call, and any
other value, an error value among them, is refused by the tag of that
site, `::FilterPredicateNotQuoteError` and its kin, each declared in the
catalog beside its operand [D46]. The condition of `if` is declared a
value, as D43 wants, and the renderer of `@out`
and `@err` a string, since each runs once against the subject. A
declared pipeline keeps its lazy parameters, so a call of one carries no
tilde until the argument model makes its parameters values [D43, D44]. A
predicate or a reducer that names a declared pipeline or an operand
keeps the dispatch of today, read from the single step of its quote,
`filter ~(hot)` with the two-parameter `hot` over a map and `reduce 0
~(add)`, until the argument model completes the last step with the
second value and the rule for maps drops the two-parameter predicate
[D15].
Source. The model, 24 September 2026, on the command-form branch, from
the order of the route, under which the command form rewrites every text
once with the tilde on every slot of code and the argument model
follows.
Set aside. The evaluator reading the kinds of `:modifiers`, which would
make the runtime execute the one part of the declaration the argument
model replaces. One refusal shared by every slot of code, which D46
refuses. An error value passed through a slot of code unchanged, which
D13 asks of every slot at once and which lands with it.

### D57 · A verb is a value, written `~[slots](body)`

Decision. A verb is a value, the conduit, and its literal is
`~[slots](body)`: its head in brackets and its body, a pipeline in
parentheses [D8], opening right after the bracket; `~[](add 1)` is a
verb without modifiers beside the quote `~(add 1)`. The head declares
both ends of the verb and reads in the order of the call: the subject's
kind first, as D45 has it, the slots after it, and last the kind the
verb answers, `~[::jdt/Method :depth |~~ levels of callers to walk ~~|
::number ::jdt/CallerTree](…)`. The two kinds that follow no name are
the ends, and a kind right after a name is that name's, so a result
after a slot without a kind follows `::any`, the kind the descriptors
write `:any` today. The runtime checks the result against its kind as it
checks every slot, and a verb that declares none answers any value. A
slot is written as a declaration is, its name, its doc when it has one
and, in the place of a body, the kind it takes; inside the brackets a
newline is whitespace, so a slot may take a line of its own, and inside
the body a slot is a name like any declared one, its doc with it. A verb
is a record of its slots, its result and its body, whatever implements
it: `~[:n ::number ::number](add n)` is the short spelling of
`::conduit{:slots [:n ::number] :returns ::number :body ~(add n)}`, as
`~(…)` is of `::quote[…]`, so a conduit prints as it is written and
reads back from its print [D54], and a built-in, whose body is host
code, is `::builtin{:slots [::number :n ::number] :returns ::number
:impl :qlang/prim/add}`, so `:subject` and `:modifiers` leave the
descriptor and `spec` answers the same fields for both. A binding is
`:name value` wherever it stands, and a verb is a binding whose value is
a conduit, `:inc ~[](add 1)`: the slot list leaves the place after the
name, the conduit's name leaves the value, so a bound conduit equals its
literal, and a binding is one record, `::bind{:name :inc :body ~[](add
1)}` [D47].
Source. «да, принимаю .. только ты мне скажи ... в слотах точно можно
будет использовать обычный синтаксис биндингов?» (maintainer, 2026-09-24
06:20, session 86982eb5), accepting the model's reading of his proposal,
«у меня кстати появилась идея доработать квоты .. точнее форму её
усилить .. сделав более литеральной.. ну или как-то закинув и квоты и
кондуиты в одно семейство ... отличие простое как мне кажется и весьма
элеганатное ~(add x) и ~[:x](add x) - второе это литеральная
принтабельная форма параметризуемой в точке вызова квоты, т.е. кондуита
ну или ещё как ~{:name :type}( use name) придумать.. что б то выглядело
более самоописуемо и самодокументируемо ... подумай об этом после того
как доделаешь текущую часть.. тогда биндинг будет проще и понятнее
выглядеть» (04:25), and of the signal at its start, «туда бы хорошо
встал класический биндинг ~(:name doc value | :name2 если есть)(code)..
но грамматика чуть усложнится .. или делать как ~(:name doc value |
:name2 | code) - но это тогда обычная квота ... и её со старта нужно
тогда отделять другим знаком ~~(двойная квота?) ... или квота которая
вычисляет квоту.. тоже бред какой-то ... или дважды применяемая квота ..
или квота-вектор из двух групп ~[declageparams code] - где первая группа
может быть пустой и тогда все кодпайп ~[noargcodepipe] такой синтаксис
жуется вроде ~[("" | "") ("y" | "z")] - только скобки с недавних пор
стали обязательны .. но можно и так обойти тогда ~[declale][code] -
тогда так уже оно и так было "~[" - будет тем самым сильным стартовыми
сигналом снимающим дальнейшую неоднозначность.. и премственность
какая-то будет .. квота фиксированная или квота ленивая
параметризуемая(кондуит) ..» (05:52), after he asked «так а что насчет
~[] преложения? не разорит оно нас и нашу модель?..» (06:02). The slot
written as a declaration answers his question and his recollection «и у
нас уже было как-то .. что-то подобное в мэпах {:x |~~ paramdoc ~~|
(coalesce value defaultValue) } и потом эти доки вмерживались и были
видны как обычные биндинги ... но там когда-то гигамэп из-за этого
возникать начал.. и модель начала утрачивать свой пайплайную форму..»
(05:23): the doc of a slot stays where a declaration keeps it, and the
value computed in the head leaves. His remark «и да.. у нас же не только
параметры .. но и вовзращаемое значение же наверное есть ... и вход и
выход.. тут ты прав что ранее написал» (06:34) asks for both ends, and
his question «а так возвращаемый тип задаваться будет в объявлении? или
как и раньше - никак? и какой-то приемственнсоти и билтинами не будет ?»
(06:48) puts the result in the head: a built-in declares it today,
`:add | spec | [/subject /modifiers /returns]` answering `[:number
[:number] :number]`, while a conduit declares none, `::conduit[:f [:x]
~((add x))]`. D45 read the source of its rule, «форму ответа можно было
вывести» (maintainer, 2026-09-22 02:09, session 96f3df79), as a result
derived from the body, where the maintainer asked for the shape of an
answer to be found on demand, from the verb's source or its docs, which
a declared result gives before the verb runs. The result stands without
a mark of its own, «не хотел бы я эти стрелки вводить .. так долго без
них жили» (06:58). The reading, the model, the same morning, from the
tree: a conduit prints as `::conduit[[:x] ~(add x)]` and a binding of it
runs, `:g ::conduit[[:x] ~(add x)] | 5 | g 2` answering `7`, and the
grammar reads a head of declarations as words, `[:x |~~ how many ~~|
::number :y] | count` answering `4`.
Set aside. The slot list after the name, the form of D44, under which a
verb and a value bind in two forms, and `:f [:x] ~(add x) | 5 | f 2`
answers its quote while the conduit prints it doubled, `::conduit[:f
[:x] ~(~(add x))]`. An arrow before the result, `-> ::jdt/CallerTree`, a
token the language has lived without. The result read from the body, the
rule of D45, under which a verb promises a tag and never
`[::jdt/Method]`, a reader finds the promise in the last step of the
body while a built-in declares it in its descriptor, and a body that
ends otherwise promises nothing. The tagged vector the runtime prints a
conduit as today, `::conduit[[:x] ~(add x)]`, whose places name nothing,
where the record names its fields as the descriptor of a built-in does.
The body in brackets, `~[declare][code]`, where every element is a word
[D55], so `[add x]` is two words. A head that computes, the quote in two
parts «про кондуиты добавлю .. что я просто думал ещё в строну того что
б квота как бы была двухсоставная.. в порядке бреда.. где первая часть
это решейпинг пайплайн из субъекта и аргументов а ля ~(bindparamstep |
bindingparamstep | minienv_map_here)(code) -- т.е. первая часть смотрела
в точку использования выковыривала данные.. а вторая уже работала над
расковырянными данными .. т.е. мы эти 2 концерна как бы могли развести
...через какое-то соглашение по вызову ..» (04:58) and the head of
bindings joined by `|`, `~(:name doc value | :name2)(code)`: it cannot
be read before it runs, so the arity, the names and the kinds that help,
completion and the refusals take from the slot list are lost, where
PowerShell's `param()` keeps its binding declarative for its help; a
value computed in the head, `(coalesce value defaultValue)`, is such a
head, and it brought the gigamap the catalog left, «раньше у нас были
гигамэп в качестве декларации рантайма - убивавший подсветку синтаксиса
и различимость в редакторе... и гигаквоту предлагал кто-то .. но как-то
все не увязывалось с идеей длинного пайплайна .. разбитого на шаги ..»
(maintainer, 2026-09-15 01:20, session 268516f5), `94dff34` writing the
catalog as one map literal and `86c0a80` rewriting it into a series of
declaration steps. A head as a map of kinds, «вот и я колеблюсь насчет
слота из субъекта.. есть ли смысл .. или же клей проще держать на
вызывающей стороне, а в параметрической квоте оставлять только
требования .. но каким образом эти требования задать, как ограничения и
констрейны вписать если те нужны там .. просто map из кейворд тэг
кортежей смотрелась бы наверное максимально увиверсально .. ну а если
пишем через вектор - то там только имена которые по порядку агрументов
матчатся (как сейчас).. это если никак граматику не расширять ... а так
можно более сложную логику /проекций всегда сделать ... /:glang/subject
/:qlang/args или ещё как в порядке бреда.. для экзотический случаев»
(05:16), which compares equal in either order, `{:x ::number :y
::string} | eq {:y ::string :x ::number}` answering `true`, while the
order of the slots decides which modifier each takes; with it the
projections that reach the frame of the call, `/:qlang/subject`, keys of
the runtime's housekeeping, since the glue stays at the calling side,
`{:price 100 :qty 3} | mul /price /qty` answering `300`. `~~(…)`, which
after a pipe opens a comment, `5 |~~(add 1)` refused as one never
closed, and a doubled quote [D47]. `apply` taking the glue beside the
quote, «и что там было с агрументами apply - может не надо ниче с этими
кондуитами мучиться а просто в apply систаксис доработать и передавать
клей сцепление с квотой..» (06:30), which the maintainer set aside
himself: «хотя нет.. документацию все равно цеплять надо же какую-то..
если у нас реюз подразумевается» (06:31). The glue is written already
with a binding before `apply`, `5 | :x 2 | apply ~(add x)` answering
`7`, or with `use`, `{:x 2} | use | 5 | apply ~(add x)` answering `7`,
and it declares nothing a reader finds before the code runs, neither a
doc nor a kind; a named quote carries the names of its declaration
[D44], so glue at the point of application reaches only a quote without
an environment. A value in the place of the kind, which collides with
the kinds since a tag name is a value too; a default belongs to the open
question of optional slots [D45].

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
a binding whose value is a conduit, `~[slots](body)`, `~[]` when it
takes no modifiers [D44, D57]. A name is declared once in a scope. The
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
a large one mounted and served on demand [D36]. A noun in the subject
position opens its namespace for the steps after it, a name typed bare
is searched outward from there, and values carry their qualified tags
[D35]; a host sets up a query by the first value of its pipe and nothing
else [D37]. `use` brings a library's pipelines into the user's names,
and the environment the user sees holds only those. A declaration
produces a binding value that carries its name, its documentation, its
source, the module it came from, and its value or its code, so the axes
are projections of that value and a shadowed binding stays one
projection away through its namespace. A module is a pipeline of
declarations and evaluates to a namespace map. Effect markers are gone;
a host that wants provenance visible tags the value, and an effect
described by a value is performed at the boundary and nowhere else.

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
sentence, how to discover with `manifest`, `docs`, `examples`, and
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

What leaves the tree, as the repairs land: the snapshot and conduit as
two kinds of binding; the seven dispatch wrappers and the application
rule built on them; the classes of errors with their factories, the
registry of throw sites, the stamping passes and the converter's
tables; the primitive registry with its sealing; tagged JSON and the
session envelope; the effect marker and its checks; the character
scanner of doc text; the housekeeping keys of the environment; the
history of cells; the resolver of module directories; the call to the
parser from outside `parse`; the error prose of the catalog that
restates the facts; the drift tests, the injection script and the
document-compliance runner for the documents that go.

The documents at the finish are few. This audit and the entrypoint
document, which are the measure. The reference, reduced to the
evaluation model, the combinators, the fork rule and the reading
protocol, with the tutorial's order of concepts kept as a page built
from executable examples. Everything that retells an operand is
generated from the catalog or gone.

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

The start is the tree as the scars describe it, measured against the
September master, commit `f5e8ec8`. The finish is the tree the previous
chapter describes. Between them lie five milestones, each a state of
the language, each followed by a release
[D29]. Under each milestone the branches that reach it are named in an
order that illustrates and binds nobody, and the answers that show a
milestone reached are written as target blocks, which disagree with the
tree until the work lands.

### Milestone 0 · Footing

The measure is in the repository and every consumer can receive a
breaking change in the same move. This document and the entrypoint
document are on master, the instruction file is reduced to how a
session starts, and the sister project builds on the workspace copy of
the core. What remains is the entrypoint of the work in its first
version, the command that measures the tree and prints the state of
the work as a dark cockpit, so that every later session starts from
what is computed; its design is the entrypoint document's, its first
sensors are the ones that document carries, and its first gates are
the ones this milestone closes.

### Milestone 1 · Kernel

The syntax and the mechanism of an operand are final. The ring is
closed and the command form has landed [D3, D8, D9, D10, D11, D47,
D51–D56]: a quote is the vector of its steps, every step is a command,
and every text of the repository and of the sister project is written
in that form. The argument model follows [D4, D43, D45, D57], writing
every slot list once, in the head of the verb literal and in the
descriptor of a built-in, with the interface of hosts designed in the
same branch and landed in every host; the one binding form closes the
milestone [D5, D44], with comments as whitespace and the doc literal
in the binding's slot.

```qlang target
> :m ~[:x](mul 10 | add x) | 2 | m /
22

> :fact ~[:n](if (n | lte 1) ~(1) ~(n | mul (fact (n | sub 1)))) | 5 | fact /
120

> :inc ~[](add 1) | 5 | inc | inc
7

> :most ~[](count | sub 1) | {:items [1 2 3] :limit 2} | /items | take most
[1 2]

> 42 | :x / | add 1 | x
42
```

The last block answers 43 today, because `:x /` re-evaluates its body
at every mention; under the one binding form a bare body is evaluated
once, at declaration, and that is how `as` is spelled once it is gone.

Beside the answers: taking every example of the catalog apart into
atoms and a shape and putting it back, both written in qlang, answers
an `eq` value [D42]; a second declaration of a name in one scope is
refused [D44]; the seven wrappers are gone; no snapshot unwrap remains;
the declarations of the catalog are true, since the runtime executes
them.

### Milestone 2 · Values

The semantics are final. The one order, the single container family
with the rule for maps and the reading of duplicate keys, the set as
the ordered vector, the kinds and the strict predicates have landed
[D1, D14, D15, D16, D18, D32, D48], and so have the command line's
default subject and its terminal views [D37]. What remains is the
contracts moving onto the kinds [D33]; the tags of the refusing sites
as kinds with their schemas and procedures, and the law for nested
errors [D7, D13, D46], which is where the JavaScript classes of errors
and the prose that restates their facts disappear; and the effect
marker leaving the core [D2].

```qlang target
> 1 | add (!{:k 1}) !| type
::Error
```

Beside the answer: no factory-declared error class remains; every
refusal's tag is declared once in the catalog and prints its facts in
its schema's order; the throw-site registry and both drift tests are
gone; the language has no effect marker and no effect flag; host
categories of error are declared by hosts.

### Milestone 3 · One spelling

Every fact has one spelling. Namespaces become values, bindings carry
their origin, the axes become projections, and one loader remains [D5];
mounted namespaces arrive with it [D24], each a subtree answered by its
provider, the subject opening its own [D35, D36]; collisions get their
rule [D23, D34], and a host's verbs move onto its tags; the literal
becomes the one lossless format and tagged JSON and the session envelope
go [D30]; the doc becomes the vector of its segments, and strings,
quotes and docs read in pieces [D19]; the documents are generated or
deleted, the examples live on one plane, the bootstrap has one stamping
site, the keyword's form comes from the parser, the error library is
decided, and the editor's grammar is generated or reduced; the consumers
lose the rules they carry of their own.

```qlang target
> :filter ~[](mul 2) | namespace :qlang/operand/container | /filter | docs | count
1

> :filter | binding | /module
:qlang/operand/container

> ::builtin | docs | first | /segments * type | distinct
#[:string]

> "a\nb\nc" | lines | drop 1 | take 1
["b"]
```

The names `namespace` and `binding` stand for the operands the branch
names; where a target block uses a name or a field no decision fixes,
the name is a placeholder and the answer's shape is the requirement.

Beside the answers: `env` lists only the user's names; a module ending
in a map exports that map alone, so the sister project's helpers leave
its client's manifest; no operand contract is spelled outside the
catalog; the injection script and the document-compliance runner are
gone; no parser call exists outside `parse`; one query shows every
definition of a name and which one wins.

### Milestone 4 · Front door

The measure can be taken as the mission states it. The root doc and the
views sized to a budget arrive, the cheap view the default [D27]; the
catalog's prose is reduced to what the facts do not say and written in
the language's own vocabulary; answers stay within a budget and replace
what exceeds it with `::elision` markers [D21]; errors print as alerts,
an unresolved name names its neighbours and a parse error the
continuations a reader meant [D7]; enrichment happens once per session;
fields are documented by their records' tags and shared values by their
own [D50]; the sister project's nodes carry their kind as a tag, its
types are mounted, its verbs shrink to about a dozen, and its guide is
generated from the catalog [D24]; its workspaces become nouns and its
answers name the workspace they came from [D38]; a host's command is the
language's with its noun as the first value [D37]; and the benchmark
runs [D26].

```qlang target
> [1 2 3] | filtr ~(gt 1)
!{ … :nearest [:filter] }
```

Beside the answer, whose tag and field name are placeholders: `manifest`
answers by default a view of names that fits the first screen; one start
command returns the root doc within four kilobytes; a host answers
within a budget and marks what it left out with its size and the query
that reads it, an error's input included; a parse error prints without
the parser's list of alternatives; `:trail` prints the same way on an
error value and on its materialized descriptor, where the error literal
hides a null trail and the descriptor shows it; a renderer loads the
documents of the tags and keywords an answer carries that the session
has not been shown, and withholds the ones it has.

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
[D30]. A design question that appears during a branch is decided in
this document on master before the branch goes on; an implementation
session decides nothing silently, since a decision taken in code is a
decision no one will find. The sister project receives every breaking
change in the same move.

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
a host can say that every kind of its nodes answers a verb once.

The spelling and the mechanics of mounting [D24]. Admitting the dot
inside a tag's name is local to the grammar; the quoted form `::"…"`
mirrors the quoted keyword. Open: how a module declares that it serves
a namespace, whether a mount is visible in the manifest as a namespace
among others, and the exact record of a member.

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
the first candidate, and only after the argument model and the binding
form have landed, because it amends the state pair.

The error library. It either enters the catalog with examples, as
pipelines built on the refusal tags, or leaves the package.

The test for null. Whether `eq null | not` earns an operand of its own
is a question the benchmark answers under the rule of the catalog
[D22].

The key of a sort that answers an error [D13, D16]. The one order ranks
errors, and in the model's reading a sort key is a place declared for
any value, so a key that answers an error is ranked as a value and a
key that misses a field sorts its element among the errors. On 25
September 2026:

```qlang
> [{:a 2} {:b 1}] | sort ~(/a)
[{:a 2} {:b 1}]
```

The alternative is the rule of `filter` and `groupBy`, under which the
error of a key is the answer of the operand: a misspelled key is then
loud, at the price of a sort by key over a vector that holds errors,
which answers the first of them, while a sort without a key still ranks
them. The review of pull request #46 raised it.

The spelling of a verb's head [D34, D40, D57]. «я вижу массу
неоднозначности и слабую структуру.. это ~::jdt/CallerTree[:jdt/Method
:depth |~~ levels of callers to walk ~~| ::number][:jdt/Method
:parallel |~~ way of working ~~| ::boolean](Сode) - а если так?
~[][][][]..[]() - такое типа если :count ~::number[](::builtin{:impl})»
(maintainer, 2026-09-24 07:09, session 86982eb5), held back for a fresh
look, «ок, отложим на свежую голову ..» (07:31). The proposal puts the
result's kind right after the tilde, where D57 has it last in the head,
so the head holds only what the verb takes and needs no rule of
position; `~::number[…]` stands free, since a word written against a
word is refused, while `~::number` alone stays the quote of a tag name,
`~::number` answering `~(::number)`. It writes a built-in with the same
literal, its descriptor for the body, `:count
~::number[](::builtin{:impl})`, so every verb is one literal. Its
groups, one bracket after another, read as alternative signatures:
`sort` takes a key or none, `[3 1 2] | sort` and `[{:a 2} {:a 1}] | sort
~(/a)` both answering, which its descriptor cannot say, `:modifiers
[:keyLambda]`. A group for each kind of the subject repeats the walk of
D34, which finds the implementation of one contract on each kind, so
what the groups may hold is the alternatives of arity, and alternatives
told apart by the kind of a modifier are the overloading D9 set aside.
Read as one group for each slot, the groups must touch one another to
stay one word, since `f ~::T [x] (y)` reads otherwise as three
modifiers. Inside one head every keyword opens a slot and holds what
follows it up to the next keyword, its doc and then its kind, which the
grammar reads already as words: a head of five slots reads as the
subject's kind and five times a keyword, a doc and a kind. Options
beyond a few positional modifiers are one map whose keys the verb
declares [D40], `callers 2 {:scope :project :keep ~(/static | not)
:limit 50 :parallel false}` holding two modifiers where the positional
call holds five, and a map entry holds one word, so a key of such a map
has no doc of its own.

The contract of a verb [D45, D46, D57]. «наверное такой контакт чуть ли
не отдельным способом описывается.. типа интерфейс вызова .. что там
умного у кложуры было или что ты можешь подходящего для нас и не костыль
и эмержентно сочетающегося со всем предложить?» (maintainer, 2026-09-24
06:37, session 86982eb5), and «и там ты тоже выше хорошо упоминал про
билтины .. оно ведь рядом тоже.. все фактически к глаголу относится, как
ты сказал.. я просто затупил» (06:40). The model's reading: the contract
is the verb's declaration read as data, one for a built-in and for a
declared verb, and the axis `spec` answers it as a value. Today it
answers the descriptor, `:gt | spec | [/subject /modifiers /returns]`
answering `[:number [:number] :boolean]`, with the tags of the refusals
under `:throws`; under D57 it answers the slots, the result and the tags
of the verb's sites [D46], the same fields for a built-in and a declared
verb. Clojure writes a contract beside the definition, `s/fdef` with
`:args`, `:ret` and `:fn` in a registry keyed by the function's name, a
second spelling of what the declaration says, the drift D45 set aside.
What it teaches without that price: the meaning of an attribute is
declared once and reused wherever the attribute stands, which the
language keeps in a kind, a tag with its doc and its schema or
constructor [D6, D50]; optionality is a property of the context that
asks for an attribute, the lesson of the schema and select of its second
spec, so in the open question of optional slots the mark stands in the
head beside the slot and a kind means the same wherever it is taken; and
the vocabulary of a kind is the set of verbs that take it as their
subject, which its protocols declare and the language computes,
`manifest | filter ~(/subject | eq :string) * /name` answering the verbs
on strings [D34]. A pre- or postcondition written as code is a head that
computes; a constraint is a kind whose constructor checks it [D6, D33],
and the runtime checks every call against the declaration [D45], where
Clojure's instrumentation is a mode switched on for development. The
dispatch asked after, «а мультидиспатч каокй-то там был?» (07:27), is
decided: a verb is found by walking the subject's tags from the outside
in, and it keeps one contract, its document and its examples, which
every kind that implements it answers as laws [D23, D34]. The head then
belongs to that contract and is written once, a kind that implements the
verb brings its body, a variant by the subject's kind is the walk's, and
what one head may hold beside its slots is the alternatives of its
arity, the open question of optional slots.

Optional and variadic slots [D45]. `sort` takes a key or none, `cond`
and `coalesce` take as many clauses as they are given, and the slot list
has no mark for either. A default after the kind would mark a slot
optional and say what it takes when absent, `:key ::quote ~()`, at the
price of a value inside a list of kinds; a mark on the kind would keep
the list to kinds and leave the default to the prose. A last slot that
gathers the remaining modifiers needs a mark of its own, since a slot of
kind `[::quote]` already takes one vector.

How a check finds the tag of its site [D45, D46]. The runtime checks an
operand's subject and slots from its declaration, and a refusal must
carry the tag declared for that site. The tag can name its site in its
declaration, the runtime indexing the declarations by site when it loads
them; the slot list can name the tag after the slot's kind, which
lengthens every declaration; or the tag can be the site's path under the
operand in the tree of names, `::add/n`, which needs no index and gives
up the self-describing name a reader sees first.

How elision knows a kind [D21, D34, D46]. «просто рано или поздно все
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
is one more check on every constructor.

The entrypoint. Where the modules of the work live, how the start
command measures the tree, the schema of the dashboard, how hooks call
it, how the state of what a session has been shown is kept, how sensed
items are computed, and how the maintainer's intent enters the task:
all of it is the subject of `docs/qlang-entrypoint.md`, and the
maintainer wants to explore it before it is fixed.
