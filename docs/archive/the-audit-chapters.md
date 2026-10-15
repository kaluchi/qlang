# The chapters the audit held until its twelfth version

The audit of the language held these chapters until its twelfth version,
on the baseline `4dc957d`: the core that stays, the hypertext, and how
the project got here. Its thirteenth version left them here as they
were written, since the pages of the language tell the language, the
records hold its decisions, and the history of a project is no compass
of its work [D255]. No session maintains them, and a sentence of them
that the tree no longer bears stays as it was written.

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
pipeline comes from. A literal stands as a subject, at the head of a
pipeline or under `get`, and the values it builds fork against the outer
value, which is what makes reshaping a matter of writing the shape you
want, `get {:who /first :n (get /tags | count)}` [D248]. `get` reads a
path with strict misses and `query` softly. Application is
subject-first.

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
is read the same way, before the answer is fetched: the answer of a
word is the kind its `returns` names, laid under its address as the
node `answer`, and the commands of that kind say what its values hold
[D180], [D251], [D252]:

```qlang
> ::number/add/answer | binding | get /value
::number
```

Last, everything prints as what it is, code included, because an
elided and enriched page travels on.

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
that prove a name stand under it, each written by `proves` in the chain
of its word or its kind and laid as a `::law~(…)` under its name, which
`runLaws` holds to answer true, its page the claim it proves [D123],
[D124], [D252]; `laws` answers each as the pair of its page and its
query, and `tutorial` a name's page and its laws, the pair a reader
learns the name from [D176], [D177]:

```qlang
> ::vec/take | tutorial | get [(get /0 | type) (get /1 | keys | count | gt 0)]
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
form, a name is declared once in a scope, and a verb is a function
named under the label of its subject, built from `::fn` by commands, its
inputs, its answer, its refusals and its laws in its chain and its
recipe, a quote or a host's primitive, last, its args the values a call
gives under its tag, which read back as they print [D164], [D173],
[D251]; a kind is built from `::kind` so, its payload, its fields, its
invariants and its constructor in its chain, and nothing declared by
name under a word or a label takes a role [D252], [D253]. A name is read by its tag, and a keyword is data
that names nothing [D221]; a word of the root reads the nouns of the
root as the root holds them, and a kind a reader declared as the reader
wrote it, while what a word reads and runs as data, a page, a
law, code held as data, it reads in the tree of the query that called
it, as a word of the host does [D200]; a value takes any name, and a
step where it meets a word its subject answers is refused [D223], a fold
calling its word by its name or its address [D224], and a declaration
writes a name a step can call [D152]. Two values of a key
that file under one keyword meet in `groupBy` and `indexBy` and are
refused [D228]; the recipe of a word runs in the scope its call opens
with `args` and each input, and a step of the recipe declares none of
them again [D71]. A comment is
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
the word it begins with, `addOf` with `sumOf`, and a word the kind
of its subject lacks with the words its pages lead to that the subject
answers, `print` for the `toString` of a vector [D118]. The literal is the one lossless
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

[D5]: ../decisions/replaced/D5.md
[D7]: ../decisions/replaced/D7.md
[D8]: ../decisions/replaced/D8.md
[D13]: ../decisions/replaced/D13.md
[D19]: ../decisions/replaced/D19.md
[D20]: ../decisions/replaced/D20.md
[D21]: ../decisions/replaced/D21.md
[D26]: ../decisions/replaced/D26.md
[D30]: ../decisions/replaced/D30.md
[D46]: ../decisions/replaced/D46.md
[D50]: ../decisions/replaced/D50.md
[D51]: ../decisions/replaced/D51.md
[D71]: ../decisions/replaced/D71.md
[D108]: ../decisions/replaced/D108.md
[D116]: ../decisions/replaced/D116.md
[D118]: ../decisions/replaced/D118.md
[D119]: ../decisions/replaced/D119.md
[D120]: ../decisions/replaced/D120.md
[D121]: ../decisions/replaced/D121.md
[D122]: ../decisions/replaced/D122.md
[D123]: ../decisions/replaced/D123.md
[D124]: ../decisions/replaced/D124.md
[D128]: ../decisions/replaced/D128.md
[D132]: ../decisions/replaced/D132.md
[D133]: ../decisions/replaced/D133.md
[D138]: ../decisions/replaced/D138.md
[D140]: ../decisions/replaced/D140.md
[D152]: ../decisions/replaced/D152.md
[D161]: ../decisions/replaced/D161.md
[D164]: ../decisions/replaced/D164.md
[D173]: ../decisions/replaced/D173.md
[D175]: ../decisions/replaced/D175.md
[D176]: ../decisions/replaced/D176.md
[D177]: ../decisions/replaced/D177.md
[D178]: ../decisions/replaced/D178.md
[D180]: ../decisions/replaced/D180.md
[D185]: ../decisions/replaced/D185.md
[D200]: ../decisions/replaced/D200.md
[D217]: ../decisions/replaced/D217.md
[D221]: ../decisions/replaced/D221.md
[D223]: ../decisions/replaced/D223.md
[D224]: ../decisions/replaced/D224.md
[D228]: ../decisions/replaced/D228.md
[D243]: ../decisions/replaced/D243.md
[D244]: ../decisions/replaced/D244.md
[D246]: ../decisions/replaced/D246.md
[D248]: ../decisions/replaced/D248.md
[D251]: ../decisions/replaced/D251.md
[D252]: ../decisions/replaced/D252.md
[D253]: ../decisions/replaced/D253.md
[D255]: ../decisions/replaced/D255.md
