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
shell command. A target, the answer a repair must produce, is a
conformance case that names its decision [D58]; a block fenced as
`qlang target` holds one whose answer no literal states yet, and it
disagrees with the tree until the repair lands. An anchor names a file
and a symbol, `core/src/eval.mjs` and
`applyConduit`; line numbers drift and are avoided. Evidence goes
stale, and the only defence is to run it: a probe whose answer changed
means the sentence around it is wrong, and the sentence is replaced by
the new fact with its new probe.

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

The kind of an operand's result belongs to its declaration [D4], [D41].

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
applied [D43], [D44].

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
decoration [D4], [D43], [D45]. An operand is then a declaration, whatever
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
`as` and the snapshot wrapper [D5], [D44], [D57]; must make comments trivia
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

The repair must keep error identity per site and declare it once [D7],
[D46]: each site's tag is a kind declared in the catalog beside its
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
a binding whose value is a conduit, `~[slots](body)`, `~[]` when it
takes no modifiers [D44], [D57]. A name is declared once in a scope. The
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
milestone reached are the targets its decisions left in the
conformance suite, which answer otherwise until the work lands [D58].

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
closed and the command form has landed [D3], [D8], [D9], [D10], [D11], [D47],
[D51]–[D56]: a quote is the vector of its steps, every step is a command,
and every text of the repository and of the sister project is written
in that form. The argument model follows [D4], [D43], [D45], [D57], writing
every slot list once, in the head of the verb literal and in the
descriptor of a built-in, with the interface of hosts designed in the
same branch and landed in every host; the one binding form closes the
milestone [D5], [D44], with comments as whitespace and the doc literal
in the binding's slot.

The milestone's answers are the targets of [D4], [D43], [D44] and
[D57] in the conformance suite, which `node scripts/requirements.mjs`
prints as the focus while any of them is open. Among them `42 | :x / |
add 1 | x` answers 43 today,
because `:x /` re-evaluates its body at every mention; under the one
binding form a bare body is evaluated once, at declaration, and that
is how `as` is spelled once it is gone.

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
[D1], [D14], [D15], [D16], [D18], [D32], [D48], and so have the command line's
default subject and its terminal views [D37]. What remains is the
contracts moving onto the kinds, an edit that keeps its kind among
them [D33], [D41]; the tags of the refusing sites
as kinds with their schemas and procedures, and the law for nested
errors [D7], [D13], [D46], which is where the JavaScript classes of errors
and the prose that restates their facts disappear; and the effect
marker leaving the core [D2].

Its answers are the targets of [D13] and [D41] in the conformance
suite. Beside the answers: no factory-declared error class remains;
every
refusal's tag is declared once in the catalog and prints its facts in
its schema's order; the throw-site registry and both drift tests are
gone; the language has no effect marker and no effect flag; host
categories of error are declared by hosts.

### Milestone 3 · One spelling

Every fact has one spelling. Namespaces become values, bindings carry
their origin, the axes become projections, and one loader remains [D5];
mounted namespaces arrive with it [D24], each a subtree answered by its
provider, the subject opening its own [D35], [D36]; collisions get their
rule [D23], [D34], and a host's verbs move onto its tags; the literal
becomes the one lossless format and tagged JSON and the session envelope
go [D30]; the doc becomes the vector of its segments, and strings,
quotes and docs read in pieces [D19]; the documents are generated or
deleted, the examples live on one plane, the bootstrap has one stamping
site, the keyword's form comes from the parser, the error library is
decided, and the editor's grammar is generated or reduced; the consumers
lose the rules they carry of their own.

Its answers are the targets of [D5], [D19], [D34] and [D36] in the
conformance suite. The names `namespace` and `binding` there stand for
the operands the branch names; where a target uses a name or a field
no decision fixes, the name is a placeholder and the answer's shape is
the requirement.

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

Its answer is the target of [D7] in the conformance suite, whose field
name is a placeholder. Beside it: `manifest`
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

The key of a sort that answers an error [D13], [D16]. The one order ranks
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

The spelling of a verb's head [D34], [D40], [D57]. «я вижу массу
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

The contract of a verb [D45], [D46], [D57]. «наверное такой контакт чуть ли
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
constructor [D6], [D50]; optionality is a property of the context that
asks for an attribute, the lesson of the schema and select of its second
spec, so in the open question of optional slots the mark stands in the
head beside the slot and a kind means the same wherever it is taken; and
the vocabulary of a kind is the set of verbs that take it as their
subject, which its protocols declare and the language computes,
`manifest | filter ~(/subject | eq :string) * /name` answering the verbs
on strings [D34]. A pre- or postcondition written as code is a head that
computes; a constraint is a kind whose constructor checks it [D6], [D33],
and the runtime checks every call against the declaration [D45], where
Clojure's instrumentation is a mode switched on for development. The
dispatch asked after, «а мультидиспатч каокй-то там был?» (07:27), is
decided: a verb is found by walking the subject's tags from the outside
in, and it keeps one contract, its document and its examples, which
every kind that implements it answers as laws [D23], [D34]. The head then
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

How a check finds the tag of its site [D45], [D46]. The runtime checks an
operand's subject and slots from its declaration, and a refusal must
carry the tag declared for that site. The tag can name its site in its
declaration, the runtime indexing the declarations by site when it loads
them; the slot list can name the tag after the slot's kind, which
lengthens every declaration; or the tag can be the site's path under the
operand in the tree of names, `::add/n`, which needs no index and gives
up the self-describing name a reader sees first.

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
is one more check on every constructor.

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
