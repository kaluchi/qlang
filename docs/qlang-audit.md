# Qlang Audit

This document is addressed to whoever picks the project up next. Most
likely that is a model in a fresh session, with this file, the
repository, and a maintainer who answers questions; it may also be the
maintainer alone, checking whether the work still points where it
should. It records what the maintainer and the model that wrote most of
this code agreed on in September 2026: what the language is for, what
state would count as satisfactory, why the code fell short of it, and
in what order to close the gap. Read it once, start to finish, before
touching the tree. The language reference in `docs/qlang-spec.md`
explains how each construct works and is not repeated here; this
document explains what should stay, what should go, and why.

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
as hypertext around keywords and tags. The sister project, an Eclipse
JDT search tool, is where the language was born and is its key
stakeholder. Its command line had grown a command for every feature, a
help text no session could afford, and answers whose shape only another
flag could change, and every excerpt of that help kept in an
instruction file went stale with the next release. Three requirements
came out of it and hold for every host. Onboarding lives inside the
tool and is obtained from it by a command, because knowledge about a
tool that has been copied out of it is a liability. Nothing is
delivered as a sheet: the caller controls the shape and the detail of
what it receives. And the shape of an answer can be known before the
answer is fetched, from the tool itself, since a query that reshapes
blind cannot be written. The last requirement was learned from the
attempt to write every schema and example into the tool's help: the
share of such a sheet that bears on the task at hand falls toward
nothing, because the shape a session needs is that of the one answer
it is about to reshape, and that shape belongs to the operand it is
about to call.

That gives the project a single measure of quality. A fresh session,
having read only what the language says about itself, writes a correct
query on the first attempt. Everything else in this document is a
consequence of taking that measure seriously: every construct is judged
by whether it makes that first attempt more likely, and every document
by whether it is something the language could have said about itself.
Round trips and the token bill of a whole task are how the measure is
counted.

## What a satisfactory state looks like

The project is in a satisfactory state when seven things hold at once.

First, every feature is an instance of one core concept. The core is
small: a state pair of value and environment, a step that maps one
state to the next, a handful of combinators, the fork rule for nested
expressions, subject-first application, a literal as a step, naming
with lexical scope, the error as a value with a trail, and a catalog
that describes itself. A construct that needs a fifth mechanism to be
explained is not in the language; it is a scar.

Second, self-description is complete. A session that reads only the
language's own first screen and then asks the language for what it
needs solves a benchmark of realistic JSON tasks at the first attempt,
within a token budget. No markdown document restates what the catalog
already says.

Third, every fact has one spelling. A fact is written where it is used
and derived everywhere else. There is no test whose job is to keep two
spellings of the same fact in agreement, because there are no two
spellings.

Fourth, the grammar is proportional to the language. Comments are
trivia; the grammar that handles them fits in a few lines.

Fifth, the consumers run. There are several: the sister project, which
queries a code graph through qlang; the documentation site with its
playground; the language server; and the editor extension that
highlights the syntax.
Each builds against the workspace copy of the core, each reads what it
needs from the catalog rather than from prose typed by hand, and none
carries a spelling of the language of its own.

Sixth, the goal itself is written down, lives in the repository, and
every session begins from it. This document is where it lives, and the
other conditions are reachable because this one holds.

Seventh, the revision as a whole deletes more than it adds. Measured
against the September 2026 master, the diff is negative in the core
sources, in the catalog, in the documents, and in the tests. This
document stands outside that count: it is the measure, not what is
measured. A branch that claims to remove noise and lands with a
positive diff has moved noise, not removed it.

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

Composition multiplies. A primitive enters if it expresses what was
inexpressible or shortens what exists. What can be written as the
composition of two existing constructs does not become a primitive.

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

Prose names the invariant. A comment that explains why a compromise is
acceptable means the compromise should be removed, not described.

## The core that stays

Holding the tree against those principles confirms the core rather
than shaking it. The evaluator threads a frozen pair of value and
environment through steps, and every step returns a fresh pair; the
only bookkeeping beyond the pair is a depth counter that stops runaway
recursion. The `|` combinator applies a step and deflects on an error,
recording the skipped step on the error's trail; `*` forks a step over
each element and keeps a per-element error as a value inside the
result; `!|` is the only combinator that fires on an error, and `|`,
`*` and `>>` step around it. Parentheses, vectors, maps, sets, and error literals all
obey one fork rule: the inner pipeline starts from the outer state and
returns only its value, which is where every scoping rule in the
reference comes from. A literal is a step that replaces the value, and
the values it builds fork against the outer value, which is what makes
reshaping a matter of writing the shape you want. Projection walks a
path with strict misses. Application is subject-first, partial when
fewer arguments are captured than the operand takes, full when all
are.

Naming is lexical: a binding sees itself and everything declared
before it, and recursion through the pipeline value is correct. The
error is a value with a tag and a descriptor; its trail is a quote of
the steps it skipped, and applying that quote to a fresh subject
replays them. Quote is code as a value, Doc is prose as a value, and a
tag is identity stamped on any value without changing its shape. The
catalog is qlang source: every operand is a binding with prose and
examples, four axis operands read a binding's source, prose, examples,
and declared facts, `manifest` enumerates what exists, and
`runExamples` executes a binding's examples as tests. The self-test
over the whole catalog runs in under a second.

Three of these are in the core for reasons the mechanisms do not show.
The fail track is there because a session that is learning a tool
fails often, and a failure is the moment when the relevant knowledge
is cheapest to deliver: the error travels as data so that whatever
stands after it, a step of the query, the host's renderer, a separate
utility, can enrich it with the document, the example and the names
that were near. Doc and Quote are values so that an answer can be a
page, data with prose and runnable snippets in one immutable value that
still fits the next step; a Doc is markdown in essence, carrying quotes
of qlang the way a markdown page carries a snippet of any language. And
a literal is the format in which values travel between utilities as
well as the way they print, which is why everything, code included,
reads back as what it was.

All of that stays. Each item is an instance of exactly one concept, and
removing it would leave something inexpressible. The audit is about
what grew around it.

## Progressive disclosure

The contract between a session and a tool that embeds qlang has a
name, progressive disclosure: an overview first, then zoom and filter,
then details on demand. Seen from the session it has four clauses. The
session controls the detail of an answer. An answer never exceeds a
budget. When the whole answer would have exceeded it, the answer says
what was left out and how much of it there is. And the session can
read what was left out, all of it or a part, through the same pipeline
that produced the answer. Work begins with one start command that
returns the base of the language under the same contract, so reading
the guide is already practice in the protocol.

The labour divides cleanly. The language computes the exact value of a
query, whatever its size, and leaves nothing out; a literal can always
evaluate to a sheet. Containing it is the host's act at the end of the
pipe. Values are immutable, and any part of a value can be replaced by
any other value, so the host replaces what does not fit with an
elision marker, a value under the `::elision` tag whose payload is
whatever helps: the size of what it stands for, counted in the
elements of the vector it replaces, since the steps that read the
rest count the same way, a brief summary,
references, the steps that read the rest. The elided answer is still a
well-formed literal and still fits the next utility. On 19 September
2026:

```qlang
> [{:fqn "a"} {:fqn "b"} ::elision{:size 808 :read ~{drop(2) | take(20)}}]
[{:fqn "a"} {:fqn "b"} ::elision{:size 808 :read ~{drop(2) | take(20)}}]
```

Enrichment is an act of the same kind. The host's renderer sees that a
value, or an error, carries tags and keywords the session has not met,
and loads their documents into the answer while the budget allows:
first the documents of the tags in the literal, then whatever the
keywords and quotes inside those documents lead to. The vocabulary of
the value drives it, and nothing is authored per operand. Which parts
to elide, what a session has already been told, how an error is
explained, how an effect is performed: these belong to the host and
its session and stay out of the language.

What the language owes the host for this is short. A tag goes over any
payload without a declaration and prints faithfully; that holds. The
pipeline is the cursor: a query is a pure path to its data, so the part
of an answer that was left out is the same query with a tail, and no
session is needed to read in pieces.

```qlang
> [10 20 30 40 50] | drop(2) | take(2)
[30 40]
```

That works only where every part of a value has, inside the pipe, a
size, an address and a slice. A vector, a set, a map, a value under a
tag and an error on the fail track have them. A string has none of the
three except by way of its lines, and strings are what overflows in
the sister project, source text and rendered cards:

```qlang
> "hello world" | count
::CountSubjectNotContainerError!{ … :actualType :string }

> "a\nb\nc\nd" | split("\n") | drop(1) | take(2) | join("\n")
b
c
```

A quote has none, since it holds its code as text, and a Doc offers
its content and its segments and no more, so the guide itself cannot
be read in pieces. The pageable shape is the vector, and a value that can
overflow has to break into one. Next, every tag and keyword inside a
value is an anchor that resolves to its document. A tag is one. A
keyword resolves only as the name of a binding, so the keyword of a
field and the keyword that is one of an enumeration lead nowhere, and
one keyword means different things in different records: `:modifiers`
on a node of the sister project's graph and `:modifiers` on an
operand's descriptor. The address of a field is the tag of its record
together with the keyword. A record that is to be enriched therefore
carries a tag, where the sister project's nodes carry their kind as a
string field, and the declaration of a tag is where the fields of its
record are documented. The shape of an answer is read the same way,
before the answer is fetched: the operand's declaration names the tag
or the type of its result, the tag's declaration names the fields, and
`spec` and `docs` on the operand answer for one operand what a schema
sheet would answer for all. The sister project already declares its
graph shapes as tags with their fields in prose and names them in the
`:returns` of its host operands; a declared pipeline such as
`@problems` names no result, a vector names no element, and the fields
are prose that nothing reads. The result of a declared pipeline is
declared with the operand model, the fields with the tag, and the
element shape of a container is spelled as the container's literal
around the kind, `[::Method]` for a vector of methods. Last, everything prints
as what it is, code included, because an elided and enriched page
travels on.

## How the project got here

The core landed in three days in early April 2026, carried over from a
specification written inside the sister project. The following ten
days added, in the order the consumer asked for them, comments that
behave as pipeline steps, effect markers on names, control flow, the
error as a value, named pipelines with parameters, a module system, a
language server, the catalog, and a command line. In the middle of May
the hypertext ideas arrived: Quote, Doc, tags, the axis operands, and
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

Features arrived in the order they were needed rather than in the
order they depend on each other. Quote arrived after named pipelines
had already chosen how to pass arguments; Doc arrived after comments
had already become the way to attach prose; tags arrived after JSON
containers had become a second type.

Every fix added a guard rather than removing a cause. A drift test
protects two spellings of a fact instead of one of them being deleted;
a snapshot wrapper is unwrapped at every place the environment is read
instead of not existing; a dynamic import breaks a module cycle instead
of the cycle being cut.

And the model that wrote the code, working under context compaction
and under those rules, produced justification instead of deletion:
comments explaining why a workaround was acceptable, a memory that grew
until it overflowed the sessions it was meant to help, decisions
re-derived from summaries and reversed in the next session.

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

## The scars

The rest of the audit walks the scars in the order in which their
repairs depend on each other. Each section states the problem, shows
it running, and names what its repair must achieve. Every example can
be reproduced from a shell with the `qlang` command or in its REPL;
the outputs are those of 14 September 2026.

### Arguments that move with the subject

A named pipeline with parameters binds each parameter to the
expression written at the call site, and that expression is evaluated
against whatever the pipeline value is at the moment the parameter is
read inside the body. With a literal argument the difference is
invisible:

```qlang
> :m [:x] (mul(10) | add(x)) | 2 | m(3)
23
```

With an argument that reads the subject, the parameter follows the
subject as the body transforms it:

```qlang
> :m [:x] (mul(10) | add(x)) | 2 | m(/)
40
```

The author of that call expected 22. The same rule makes the natural
recursive factorial wrong:

```qlang
> :fact [:n] (if(n | lte(1), 1, n | mul(fact(n | sub(1))))) | 5 | fact(/)
40
```

It answers 120 only when the recursive call passes `/` rather than an
expression built from the parameter, which is why every recursive
example in the catalog recurses through the pipeline value and none
through a parameter. The rule exists because the language has no way
to say whether an argument is a value or a piece of code: built-in
operands get that distinction from the JavaScript wrapper that
implements them, one wrapper per calling shape, while named pipelines
get no distinction at all and so treat every argument as code. Around
this sit seven dispatch wrappers, a family of arity error classes for
the predicates that dispatch on a parameter count, and a second calling
convention that hands a named pipeline fixed values.

The repair must make a parameter bind a value by default, make code an
explicit Quote at the call site, and make the laziness of a built-in
operand's slot a declaration the runtime reads, so that the catalog's
slot vocabulary stops being decoration. An operand is then a
declaration, whatever implements it: the tag or the type of its
subject, its slots with their kinds, value or code, the tag or the
type of its result, and its Doc; the runtime executes the
declaration, so a built-in, a host's operand and a declared pipeline
share one convention, and the seven wrappers go with the arity
classes. That vocabulary carries the calling shape as well as the
laziness. A predicate, a key and a
pipeline slot run their code against one subject. A reducer slot and a
comparator slot hold two values for the code they run: they run it
against the accumulator, or the left element, and supply the other
value as a trailing modifier to the code's last step, the way `xargs`
completes the command it was given. The completed step is always
applied with the subject as its first operand, so code that has
already spent its modifiers is refused by arity and never turns into a
full application; that keeps the canonical fold, `reduce(0, add)`
today, in its shape once the runtime stops inspecting the reducer, and
a reducer that wants the element anywhere but last is declared with a
parameter one step earlier in the same query. A user pipeline declares
its slots in its parameter vector, a keyword for a value and a quote
of the name for code, `[:n ~(f)]`, so the tilde says one thing
wherever it stands: this is code, do not evaluate it now; the vector
stands where it stands today, after the name and before the body,
`:twice [~(f)] ~(f | f)`. A predicate
slot refuses a result that is not a boolean, so a quote handed where a
predicate was expected fails at the slot instead of counting as true,
and a result that is an error is the error itself, by the one law for
nested errors. The same refusal reaches every condition: `not` takes a
boolean, `firstTruthy` becomes `coalesce`, `when` and `unless` become
`if` with an identity branch, and the three leave the catalog; the test
for null is `eq null` followed by `not`, and whether that test earns an
operand of its own is a question the benchmark answers. A predicate
over a Map sees the value alone, by the rule for maps stated with the
containers; the conformance cases that bind `[:k :v]` are the ones that
change.

### A call borrowed from another paradigm

A step with arguments is written as a function call, a name with a
parenthesised list, and the notation is the one foreign thing about
it. What happens is native: each argument is a pipeline forked against
the subject, and its value parameterises the step, which is the fork
rule applied to a step. On 19 September 2026:

```qlang
> 5 | add(mul(2))
15
```

The notation brings baggage of its own. Parentheses mean two things,
the argument list of a call and a group. The comma is a token of the
argument list alone, and the grammar has already stopped requiring it,
as it has stopped requiring that the parenthesis touch the name. A call
without arguments has two spellings:

```qlang
> [1 2 3] | reduce(0 add)
6

> [1 2 3] | filter (gt(1))
[2 3]

> [1 2] | count()
2
```

And the reading the notation invites, a function applied to its
arguments, brings the expectations of a functional language, a
standard library to complete and lambdas to pass around, to a language
whose steps are the commands of a tool with the subject arriving by
pipe. That is how the sister project's command line was used before
the language existed, and it is the form a session is most practised
in.

The repair is the command form. A step is a command: a name followed
by its modifiers, separated by spaces. A modifier is one word, a
literal, a projection, a name, a quote, or a pipeline in parentheses,
and that is the only thing parentheses mean. A command stands bare
where the pipeline delimits it, up to the next combinator, the next
closing bracket or the end of its line, since a newline ends a command
in every shell too; inside a modifier and inside a literal, where words
are elements, a command that has modifiers goes in parentheses, and
there a newline is whitespace. It is the rule of every shell:
`methods | filter (/modifiers | any (eq "public")) * /name`. A line is
a step: the line that follows continues the pipeline through the
combinator it begins with, or through `|` when it begins with none, so
an example keeps its combinator first on the line, two declarations
stand on two lines with nothing between them as the catalog writes
them, and a module prints as it is written, a step to a line. The
parts of a binding, the name, its Doc, its parameter vector and its
body, are no modifiers and may take a line each. The
argument comma leaves the grammar, a command without modifiers has one
spelling, and a query never carries more parentheses than the call
form gave it and carries one pair fewer at every leaf. A command whose
slots are all required value slots may be given its subject as its
first modifier, the pipeline value then serving as context alone,
`mul /price /qty`, which is how two projections of one subject meet in
one operand; an operand with a code slot or an optional slot takes its
subject from the pipe and from nowhere else. Named options are one
modifier, a map under a tag whose declaration documents its fields,
`refs {:kind :call :limit 20}`, so the keys and flags that swelled a
command line are data. The binding form stays as it is, a keyword and
a body; the body is a step, `:six add 1`, and code is a quote,
`:inc ~(add 1)`. The form is part of the format in which values
travel, since a trail, a snippet in a Doc and an example all carry it,
so it is settled before the printer exists.

### Two container families

The syntax of a literal decides its runtime type. Braces with string
keys and commas make a JSON object; braces with keywords make a map.
Brackets with commas make a JSON array, and so does a single-element
bracket whose element is JSON-only, while whitespace-separated elements
make a vector:

```qlang
> [1] | type
:jsonArray

> [1 2] | type
:vec
```

The two families answer differently to the same operand and are equal
to each other at the same time:

```qlang
> {"a": 1} | keys
["a"]

> {:a 1} | keys
#[:a]

> {"a": 1} | eq({:a 1})
true
```

The JSON family was introduced to keep a pasted document's shape
through a pipeline, and it costs a shape predicate in every container
operand, a re-stamping pass in the distribute and merge combinators and
in every transformer, a codec of its own, and the tests that guard all
of it. The language server's list of fork-isolating nodes does not
include the JSON literals, although the evaluator forks them, which is
the kind of inconsistency a second family produces wherever it is not
remembered.

The set is a third family, and the language's own history says what
it is. The May commit that moved its literal from braces to brackets
explains that `#[…]` reads as a tagged `[…]` and that the set carries
the invariant of no duplicates onto the type plane. That is the
definition of a tag with a constructor: an insertion-ordered vector
whose constructor removes structural duplicates and runs again after
any transform that could reintroduce them. The runtime keeps it as a
JavaScript set instead, with its own literal, its own answer from
`type`, and a branch of its own in most container operands, while the
tag-constructor re-invocation machinery, which exists for exactly this
contract and pays for it with a dynamic import that breaks a module
cycle, serves no value of the language. Its equality is the one place
where it behaves as a set, `#[1 2] | eq(#[2 1])` answering true, while
its membership is a linear scan, so the uniqueness it guarantees speeds
nothing. And the language has no order over its values beyond pairs of
numbers, strings or keywords: `sort` refuses a mixed vector, a null
inside a sort key and a vector as a key, and a family of comparator
operands with their refusals exists to work around that.

The repair must leave one map and one vector. JSON syntax stays
accepted on input and is normalized at parse time; the JSON shape is a
concern of the codec at the boundary, and the branch that preserves it
through transforms is deleted with the family. An object key reads as
the keyword of its string, quoted when the string is no identifier,
which is what the equality above already says; and the codec writes a
keyword back as the bare string, for keys and for values alike, where
today it writes the colon into the string:

```qlang
$ echo '{"a":1}' | qlang 'keys'
[":a"]
```

A duplicate key in a map literal, in either spelling, reads as
`JSON.parse` reads it, the last value in the first position, and the
boundary reads the same, so a document means one thing whether it was
pasted into a query or piped into it.

A map is a record and a dictionary at once, insertion-ordered, equal
to another by its keys. Its elements are its values and its keys are
the shape that travels with them, so every operation over elements
sees a value and keeps the key: `*` replaces the values under their
keys, `filter` keeps the entries whose value passes, `sort`, `take`,
`drop` and `reverse` order and cut the entries by value, and the
reducers read the values. `keys` answers the sorted set of keys, `at`
reads one, `inter` and `minus` select by any vector of keys. A
predicate therefore sees the value alone and the two-parameter
convention goes; the joint test of a key with its value is written
over `keys` with `at`, a vector of records is made from a map through
`keys` and rebuilt into one through `indexBy`, and `groupBy` and
`indexBy` answer maps.

One order over all values comes first: by the type, null, boolean,
number, string, keyword, vector, map, and after them every tagged
value by the name of its tag, so that a null sorts first unless a key
says otherwise; then within the type as today, vectors element by
element, maps by their keys and then their values, a tagged value by
its payload. With it
`sort` accepts any vector, a vector serves as a compound key and
`[(eq null) /]` as one that puts nulls last, the comparator operands
and the refusals of incomparability go, and the ordering predicates
keep their refusal through the kind of their slot. The set is then the
vector in that order without duplicates, under the `::set` tag,
`distinct` its constructor and `#[…]` its literal, so that `#[3 1 3]`
prints as `#[1 3]` and equality, structural like everywhere, compares
two sets by their content. Wherever a vector is accepted a set is
accepted, since it is one; the reverse does not hold. `filter`, `take`,
`drop` and `*` keep the set, an operand that imposes an order answers
a vector, `flat` over a set of sets is their union, membership is a
binary search and the algebra of two sets a merge, and the vector keeps
its own arithmetic, since `union`, `minus` and `inter` are operations
of sets and maps. The price is that `distinct` no longer keeps the
order of first occurrence, `keys` no longer answers in document order,
and a literal reorders when printed. The JavaScript set goes with its
literal, its answer from `type`, its branches and its codec envelope.

### Two ways to name a thing, and comments that are steps

A value can be named by the `as` operand, which freezes the current
value under a name, or by the binding form `:name body`, which binds an
expression. The two are not interchangeable: the binding form cannot
freeze the current value, because its body is re-evaluated at every
use, and `as` cannot bind code. The wrapper that `as` produces is
transparent to lookup, so it is unwrapped at more than half a dozen
places in the evaluator, and it is the reason the environment holds
three kinds of binding, each serialized and described differently. The
binding form itself chooses between a snapshot and a lazily evaluated
body by inspecting the shape of the body's syntax tree, so the
distinction between value and code is decided by a predicate over
syntax rather than written by the author. The tag-namespace form of the
binding adds a third declaration syntax.

Comments are the larger half of this scar. They are pipeline steps
that absorb the combinators on either side; a line comment eats to the
end of the line, so the closing marker shown in the reference is
cosmetic and swallows whatever follows it:

```qlang
> 1 |~| c |~| add(1)
1
```

A third of the grammar, counted in rules and in lines, exists to
parse four comment forms, their nesting, their absorption of
combinators, and their attachment to bindings as documentation; the
pipeline production exists twice, once with comments and once without,
and the evaluator carries two branches to step around them. A doc
comment attaches only to a binding; before any other step it is a
parse error. Three different syntax-tree nodes carry the same doc text
depending on where it stands.

The repair must leave one binding form in which a value body is
evaluated at declaration and a Quote body is code, which retires `as`
and the snapshot wrapper; must make comments trivia at the level of
whitespace; and must give documentation its own slot with its own
literal, which Doc already is: the doc form `|~~ … ~~|` is that
literal today, a standalone Doc value anywhere and the documentation
of a binding when it stands between the name and the body, and only
the plain forms become whitespace. Each role of `as` has its spelling in
that form: freezing the current value is a binding whose body is `/`,
aliasing an operand is a binding whose body is a quote of the call,
naming the element inside a group is the same freeze inside the
group, and freezing a parameter goes with values by default. The
sister project is the largest user of `as`, almost always to name the
subject inside a group, and its lines are where the marker's spelling
is tried. The form flips one spelling the other way: today's
`:inc add(1)` declares a pipeline because its body is a call, and
under the one form a bare call body is evaluated at declaration, so
every pipeline declared in the catalog's examples, in the tests and in
the sister project gains the tilde, `:inc ~(add 1)`, in the same
branch.

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

> :filter mul(2) | :filter | docs | count
0
```

The shadowed original is still there, behind the housekeeping key, and
still runs:

```qlang
> :filter mul(2) | env | /"qlang/namespace/qlang/operand/container" | /filter | as(:orig) | [1 2 3] | orig(gt(1))
[2 3]
```

But the binding value itself knows nothing about its documentation or
where it came from: asked for its docs, it answers with the docs of
the `::builtin` tag it carries on its header, and the manifest has no
field naming the module a binding came from. Hypertext is anchored to
names, and names are the one thing the language lets a query
overwrite.

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

The repair must put the documentation and the origin on the binding
value, so that the axes read a value instead of searching for a name;
must make a namespace a value with a way to obtain it by module name,
so that a shadowed binding stays one projection away; must let a
module decide its own surface without a keyword, a module that ends in
a map exporting that map alone and a module of declarations exporting
its declarations, so that helpers stay lexically visible to the
operands that use them and out of the client's environment, `env`
answering the user's own names and `manifest` enumerating the
namespaces; and may add a qualified spelling later as sugar over the
namespace projection.

### Code as data, half a ring

Code is a value, and the language can look inside it:

```qlang
> ~{1 | add(1) | mul(2)} | /ast | /steps | count
3
```

What it looks at is the parser's own tree turned into a map: every
node carries its source text and its position with offsets, lines and
columns, and every step rides inside a wrapper map with a kind of its
own. A map built by hand fails unless it reproduces that shape:

```qlang
> {:kind :Pipeline :steps [{:kind :NumberLit :value 5}]} | eval
::AstMapMalformedError!{ … :reason "Pipeline step at index 0 is not a :PipelineStep Map" }
```

Editing fares no better, since `union` is shallow and nothing in the
language updates a nested slot. And the ring has no return path: a
map can be evaluated but never printed back into a Quote, because no
printer from the data form to source exists. A query that wants to
build code builds a string and parses it.

The repair must close the ring with a data form made of the
language's own values, and the quote is that form: a vector of steps
under the code tag, spelled `~(…)` by the rule the set's move from
`#{…}` to `#[…]` established, that the sigil names the tag and the
bracket names the shape of the payload, a map under `!{…}`, a vector
under `#[…]`, a pipeline under `~(…)` because the parenthesis is the
pipeline's delimiter everywhere else. So `count` counts steps,
`filter` selects them, a quote is assembled on a plain vector and
tagged last, since distribute drops a tag and `union` takes no vector,
the empty quote `~()` is the identity, a tagged quote `::T~(…)` is
the effects candidate's literal, the tilde staying inside it because
`::T(…)` already means a tag over the value of a group, and the tag's
constructor
re-establishes the one invariant, that every element is a step, after
each transform. Where the syntax
is a literal, the step is that literal itself, a nested quote
included; where the syntax computes, a command, a projection, a
declaration, a constructor invocation, the step is a tagged record
declared and documented in the catalog. The combinators dissolve into
the step: `5 | add(1) !| type` answers 6, so a step listens on one
track and is skipped on the other; the fail track begins where a step
produces an error and ends at the first step that listens on it,
which receives the error as data, so `"x" | add(1) !| / | 5` answers
5 today. The group, the fail track, the distribute and the flatten
are therefore attributes of a step, each a tag stacked on the quote
of that step, as `::T[1 2] | tag(::U)` already stacks to
`::U::T[1 2]`,
while `|` is the adjacency of the vector. The head of a pipeline is
a step like the others and rides `|` unless tagged otherwise, and
that is a change: today the head of a query, of a group and of a
distribute body runs on whatever it receives without a track, an
error included, so `[1 "x"] * add(1) * (false !| true)` answers
`[false false]` while the same group with a leading `|` answers
`[false true]`, and `isError` is a primitive only because a head runs
on both tracks, since `"x" | add(1) | isError` deflects. With the head
riding `|`, the leading combinator needs no field, `~{| count}` and
`~{count}` are one quote, an error element under `*` passes through
with its trail as the law for nested errors wants where today the
body wraps it in a second refusal, and `isError` is the composition
`(false !| true)` and leaves the catalog. Nothing in the form carries a `:kind`, since the tag
is the language's own identity and errors already left `:kind`
behind; the parser's tree with its positions and text never leaves
the runtime, staying available to the tools as a separate view.
`parse` reads text into a quote and its inverse prints a quote as
text, the way `keyword` flips a string and a keyword, and equality
over quotes is structural. Running code held as data is one
operation, subject first: `apply q` runs the quote against the
subject under the fork rule, the parenthesised group is the same run
written as a literal, the wrapper tag on a quote that stands beside
the distribute, the flatten and the fail track, so that `(x)` behaves
as `apply ~(x)` while its datum carries no doubled quote, and `eval`,
being `apply /`, leaves with the ring; today `apply` takes
the code as its subject and lets the declarations made inside leak
out, while the group keeps the fork rule. A quote carries no
environment, its names resolve where it is applied. The closure of
the language is the binding, which carries its lexical environment on
its header as the named pipeline does today; a parameter declared as
code is a binding minted at the call site with the caller's
environment, so an argument sees the names of its author, and a quote
passed into a value slot is data that the body runs with `apply` in
its own environment. That environment contains the binding itself,
since a body may call its own name, so it is a cycle that no literal
prints; it rides on the binding's header as the named pipeline's does
today, and the data plane shows the module the binding came from,
which is what the axes need. This is the one place where everything
having a literal rests on a reference. Templates with holes are not needed: a hole is a
free name.

Taking a quote apart and putting it back is the same pair of moves
at every level. `payload` peels the tag from a quote, a record or a
wrapped step, and `tag` puts it back; `[type payload] | tag` is the
identity on every tagged value today, and `payload | type` answers
the container shape beneath a tag. The literal of whatever `payload`
shows rebuilds it: a vector literal, a map literal, a quote literal,
then `tag`. Every field of a record that holds a pipeline holds a
quote, the modifiers of a command included, so the obvious assembly, a
quote where a pipeline goes, is the right one, and the wrong one, a
bare value where a quote belongs, is refused by the record's
constructor at construction rather than accepted as a program that
runs. A literal modifier cannot be stored bare while a computed one is
stored as a quote, because `add ~(x)` and `add x` would then share
the datum `~(x)`; so `add 1` carries `~(1)`, the printer shows `1`,
and the one doubled quote left in the form is a quote literal written
as a modifier, `~(~(x))`. The binding record says by its field whether it holds code or
a value body, `:code` for a named pipeline and `:body` for a value
evaluated at declaration, so that the commonest declaration carries
no doubled quote. What remains to know is one rule: a quote literal
in a declaration is code, and a quote held as a value is written
through a group or arrives through a value slot, `parse`, a trail or
an example.

### Errors named by their site

Every throw site in the runtime declares its own error class, and the
class name is a function of the facts the site records:
`AddLeftNotNumberError` is the operand `add`, position 1, expected type
number, and nothing else. There are more such classes than there are
operands, and the catalog carries a prose entry for every one of them,
so the prose about errors outweighs the prose about the operands
themselves. The prose is formulaic because it has nothing to add to the
facts:

```qlang
> "hello" | add(1) !| type | spec
{:category :typeError :operand :add :position 1 :expectedType :number}

> "hello" | add(1) !| type | docs | first | /content
 Captured argument at position 1 of `add` must be Number. …
```

Keeping the class names and the catalog in agreement requires a
registry of throw-site specifications, a stamping pass at bootstrap
that runs twice because there are two bootstrap paths, a test that
checks six axes of agreement, an injection script that copies example
queries from the conformance suite into the catalog, and two tables in
the error converter that spell the descriptor's field order and which
fields are identifiers. The structure was built for an observability
backend that fingerprints errors by class name; no such backend is
attached. A foreign failure, a JavaScript error escaping an operand,
is lifted with the JavaScript class name as its tag, so `::RangeError`
can appear on the fail track: the language the runtime happens to be
written in leaks into the language's identities, and a port to another
host language would change what a query sees.

Three different policies govern an error raised inside a nested
evaluation. Distribute keeps it as a value in the result. The container
selectors abort with it:

```qlang
> [1 "x"] | filter(add(1) | gt(1))
::AddLeftNotNumberError!{ … :trail ~{| gt(1)} }
```

And the fallback operands swallow it, so a misspelled field name
silently becomes the fallback:

```qlang
> {:a 1} | coalesce(/b, /a)
1
```

A library of error-handling pipelines, retry and recover and assert
and their kin, ships in the core package, is reachable only through the
Node module resolver used by tests, and cannot be loaded from the
command line at all.

The repair must take the declarations out of error identity: one tag
per kind of refusal, named for the refusal and not for being an error,
since the `!` of the literal already says that and the fail track
already acts on it; the operand, position, and expected type on the
descriptor; and any bright per-site headline derived from those facts
rather than declared, so that each error still points at one place in
the system while nothing has to be authored per site; must give a
foreign failure a tag of the language, with the host's class name as a
field; must hold one law for an error inside a nested evaluation,
derived from the fork rule: the error of a fork is its value, handed to
whatever ran the fork; a place declared for any value keeps it, as an
element of a literal or of a distribute does today; a place declared
for a kind, the number slot of `add` or the boolean a predicate must
return, fails with that same error, unchanged, so a selector still
aborts on a failing predicate and an arithmetic step stops nesting one
error inside another; and an operand whose alternatives are pipeline
slots, `coalesce` and its kin, runs them in order and treats an error
result as no value, which is that operand's documented contract, so
the misspelled field that becomes the fallback is the price of asking
for a fallback, paid where it was asked; must let a host explain an error once per
session, through the same chain from the error to its document, without
repetition; and must decide whether the error library enters the
catalog with examples or leaves the package.

### Self-description without a front door

The language can answer any question about itself, and has no first
screen. The only entry is `manifest`, whose full answer weighs about
twenty-two kilobytes as JSON where the bare names weigh under one; there
is no view by subject or by category, and the `:subject` field is
sometimes a keyword and sometimes a vector, so the reverse index "what
can I do with this value" cannot be written as a single filter. The
descriptor's category, subject, return, and slot fields are an ontology
nobody executes: the runtime reads only the implementation handle, and
the slot vocabulary is read by one drift test.

Examples live on four planes: the conformance suite, the `~{…}` quotes
in the catalog, the REPL pairs in the reference, and the arrow pairs in
the operand document, with three test runners and a script that copies
from the first plane into the second. The catalog's own examples run in
under a second and are the only plane the language can reach.

Doc content is tokenized by a second, character-level parser that
recognizes quotes and tag literals, and it executes the tag literals it
finds:

```qlang
> ::builtin | docs | first | /segments * type
[:map … ::builtin :map]
```

The prose of the `::builtin` tag mentions the syntax `::builtin{…}`,
and reading its segments constructs a descriptor from that mention; the
prose of the `tag` operand mentions `::Outer[tagged]`, and reading it
yields a tagged instance wrapping an unresolved-identifier error. No
documentation in the catalog uses tag literals on purpose. Prose cannot
mention the syntax without running it.

Errors and parse errors print without a budget. Each error carries its
full input in the descriptor, so one wrong query over the manifest
returns forty kilobytes of errors, and a parse error lists every
alternative the parser considered, up to two dozen for a single
misplaced character.

The repair must give the language a root Doc that a fresh session reads
first, with a discovery protocol and views sized to a budget, and
`:subject` declared as a vector on every descriptor so that the view
by subject is one filter; must
reduce catalog prose to what the facts do not say; must make examples
live on one plane; must reduce doc segments to prose and quotes, the
Doc being the vector of those segments under its own tag, so that it
counts, addresses and slices as every vector does, its literal
`|~~ … ~~|` is the fourth sigil over the one mechanism, and its text
is the join of its segments; and must print errors and parse failures
economically, with the full value reachable by projection rather than
dumped.

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

The repair must leave each document either generated from the catalog
or deleted, with the reference reduced to what the catalog cannot say:
the evaluation model, the combinators, the fork rule, and the reading
protocol.

### Host concerns inside the core

Effect markers are a naming convention: an identifier that begins with
`@` is effectful, a binding whose body mentions an effectful name must
itself carry the marker, and the evaluator checks this at declaration
and at call. The core has no effectful operand of its own; every one
belongs to a host. The flag rides on every function value, binding, and
manifest entry in the core, and the guarantee it offers is incomplete,
because an effect passed as an argument runs under a clean name:

```qlang
> :run [:x] x | "leak" | run(@out)
leak
```

The error classes carry a fingerprint and a schema version for an
observability backend that is not attached. More than half of the
error categories describe failures of the host or the runtime that no
query author meets. The command line seeds the pipeline value with the
empty string when standard input is empty, so a bare `count` fails
with a message about a string subject and `type` answers `:string`,
while the core seeds `null`. Its JSON output
writes a keyword value as a string with a leading colon, `{:k :v}`
leaving as `{"k": ":v"}`, which the first consumer of that JSON will
not expect. A raw-mode line editor and its tests are the
largest single piece of the command-line workspace, and the REPL it
serves cannot save a session although the core can serialize one. The
sister project pins a published version of the core instead of the
workspace, still uses a set literal the grammar retired in May,
reimplements the parse-error descriptor by hand, and onboards its user
with a static guide that teaches both.

The repair must remove the effect marker from the language rather than
relocate it: a naming convention would keep every `@`-name a different
name from its plain twin, so that reading its documentation means
remembering the sigil, and the core has no consumer of purity, since it
neither reorders nor caches nor optimizes by it. A host whose operand
reads an index or throws dice marks the provenance of the value it
returns with a tag, which the language already has, so provenance
moves from the source name onto the value. A host's operands are then
named as the core's are, and a host name that collides with a core
name refuses loudly when the module loads, so that a client never
runs an operand other than the one whose documentation it read; the
sister project's catalog collides with the core on `type` and
`source` alone, which the host renames or a qualified spelling
separates. Selecting an operand by the tag of its subject stays a
candidate until a task asks for it. Whether an effect deserves
to become a value of its own, an action awaiting the host the way a
Quote awaits `eval`, is a question for a later branch that would have
to show a task no plainer construct solves. The repair must also drop
the observability fields with the error classes, seed the command line
with `null` and lift standard input only when it carries bytes, and
put the sister project on the workspace copy with a guide generated
from the catalog.

### Concurrency nobody declared

The evaluator is asynchronous, and it fans out in some places and not
in others. Distribute and the vector literal evaluate their elements
at once; the map, set, and error literals evaluate their entries one
after another; the container selectors walk elements one at a time,
while the captured arguments of a single operand resolve together. The
reference states none of this. In a pure pipeline the difference is
invisible, because values are immutable and an element's error stays
a value in its place. It becomes visible through host effects: a
diagnostic print inside a distribute appears in completion order
rather than element order, and a vector of ten thousand elements
issues ten thousand simultaneous calls to a host with nothing to bound
them.

The repair must state the rule in the reference: results are ordered
by element, the modifiers of a command among the elements, simultaneity
is unspecified, and bounding the fan-out is the host operand's
business. Once effects are values in a log merged
in element order, completion order stops being observable at all.

### A process that grows text

The file the tooling injects into every session carries the design of
the catalog and of the error classes among its process rules, so the
design is repeated as law in the one place the model cannot avoid
reading. Several of the review rules generate additions by
construction, one by demanding a
distinct class per throw site, one by requiring that the documents be
kept in step with code they duplicate, one by asking the reviewer to
propose sibling operands, one by requiring retroactive fixes in every
diff. The coverage threshold of one hundred percent on every axis has
produced a test corpus heavier than the code it covers. The drift tests
and three of the five convention checks exist to guard duplicates. The
external reviewer is run as a gate and, round after round, proposes
fallbacks and defensive checks that the principles reject.

The repair must derive every process rule from a principle, with each
rule reading as the principle plus the check that enforces it; must
replace the coverage number with a policy that keeps the threshold for
the language core and a no-number rule elsewhere; must demote the
external reviewer to a signal at milestones; and must delete each guard
together with the duplicate it guards.

## The language after the revision

Seen together, the repairs describe one language rather than eight
fixes. A pipeline carries values; code is a Quote, written as such
wherever it is passed. A step is a command, a name and its modifiers
as words, bare where the pipeline delimits it and in parentheses
inside a modifier or a literal, so parentheses mean one thing, a
pipeline as one word, and a built-in, a host's operand and a declared
pipeline are called the same way. A parameter holds a value; a
built-in that wants a lazy slot declares it in the catalog, a declared
pipeline declares it with a quote of the parameter's name, and the
runtime reads the declaration. There is one binding form: a value body is evaluated once
at declaration against the current value and bound as a value, a Quote
body is bound as code, and parameters belong to Quote bodies. The pipe
is linear continuation and the binding is a branch to the side:
`x | f` hands f's result onward, `x | :name f` names f's value and
hands x onward, so `5 | :six inc | :again inc` names six twice while
`5 | inc | inc` reaches seven. A name is for the non-linear reach, a
value wanted again later or beside another; the linear reach is the
pipe. The binding's transparency to the pipeValue is the shape of
those two intentions, not a compromise struck early against a syntax
and a feature set. A declared pipeline runs when its name is
mentioned, so `apply` is only for a Quote held as data, from `parse`,
a trail, a value parameter or a literal; `~(inc)` is that Quote and
`inc` is the command. A command without modifiers is the bare name and
has no second spelling. Comments
are whitespace; documentation is a Doc literal in the binding's slot.
Maps and vectors are the only containers; JSON syntax is read,
normalized, and forgotten until the codec at the boundary writes it
back. A map's elements are its values and its keys are the shape that
travels with them, so one rule serves the record and the dictionary.
One order ranks every value, so anything sorts. A predicate answers a
boolean or fails at its slot. A tag stamps identity on any value, and
a value under a tag obeys the tag's invariant, established by the
tag's constructor and re-established after every transform whose
declaration keeps the tag; the set is the vector in that order without
duplicates. A tag's declaration is its schema, a map from field to
kind that the runtime checks as it checks a slot, or its constructor,
code run on the payload; a tag with neither is identity. A sigil literal is
the spelling of a tag: `#[…]` spells the set, `!{…}` spells an error,
`~(…)` spells code, `|~~ … ~~|` spells a Doc over its segments, and
each keeps its own token in the editor while the runtime holds one
mechanism behind all four. An error carries one tag per
kind of refusal and states its operand, position, and expected type as
fields; the fail track reads `!| /operand` where it read a class name.
A nested evaluation that fails yields its error as a value, and every
operand treats that value by one rule. One `use` merges a map into the
environment, a namespace is a value, and the environment the user sees
holds only the user's names. A declaration produces a binding value
that carries its name, its documentation, its source, the module it
came from, and its value or its code, so the axes read values rather
than search names, and a shadowed binding stays one projection away
through its namespace. A module is written as a pipeline of
declarations and evaluates to a namespace map: the map is what the
steps produce, whether the module ends in one or its declarations
make it, so the editor keeps its steps and
the value keeps its origin. Effect markers are gone; a host that wants
the provenance of a value visible tags the value. Fingerprints and
terminal conveniences belong to hosts. So do the budget of an answer,
the elision of what exceeds it, and the enrichment of an answer with
the documents its tags and keywords lead to; the language computes
whole values, and every part of a value, a string, a quote and a Doc
included, has a size, an address and a slice, so what a host left out
is the same query with a tail. A record that a host wants explained
carries a tag whose declaration documents its fields, so a keyword
inside a value leads to its document as an operand's name does. Code
is a value, the quote, a
vector of steps made of the language's values with an involution to
and from its text, so a query reads, counts, transforms, and
assembles code without leaving the language; a binding's source, an
error's trail, and a doc's examples are quotes. Every repair in this
picture rebuilds an earlier concept on the two that arrived last,
Quote and tag; that is why they compose.

The catalog is the documentation. A root Doc is the first thing a
session reads: what the language is in a sentence, how to discover with
`manifest`, `docs`, `examples`, and `spec`, how to read an error, and a
few seed pipelines that a grep would not suggest. Every other question
is answered at the point of need, in views sized to a budget. Examples
live in the catalog and run as its tests; the conformance suite keeps
only what a quote cannot express. The reference shrinks to the
evaluation model and the reading protocol; the other documents are
generated or gone. The sister project's guide is generated the same
way.

The process is derived from the principles. A branch repairs one scar,
or one part of one, shows a negative diff, and proves with a command
what it changed. Progress is read off the scars this document still
carries, off a metrics script over the tree, and off the mission
benchmark at milestones.

## The way of working

The repairs depend on each other, so they land in order. First this
document lands in the repository, the injected instruction file shrinks
to a pointer and the commands, and the review rules are rewritten from
the principles; otherwise every deletion that follows fights the
review. At the same time the sister project moves onto the workspace
copy of the core, because the principle of the radical replacement
means that every breaking branch lands in every consumer in the same
move, and a consumer pinned to a published version cannot receive it;
its generated guide comes last, but its link comes first. Then the self-modeling kernel: the data form of code and the
involution between it and its text are settled before anything that
produces or consumes a Quote, because the argument model passes code
as a Quote, a binding value keeps its source as one, an error's trail
is one, a doc's examples are ones, and an effect as a value would be
one; with the form fixed first they all speak the same language, and
whether a thing is stored as text or as data stops mattering, since
the involution converts either way. The command form of the step comes
next, on the ring's heels: the step's form is what the printer prints
and what every trail, snippet and example carries, and the parser of
the call form together with the printer of the command form rewrites
every text by machine, so each later branch writes its examples once;
the ring's own printer prints the call form, and the command-form
branch replaces it and proves the round trip again. The ring branch
also decides `>>`, sugar over `flat`, before it encodes the flatten,
since a form encodes no combinator a later branch would remove.
Then the argument model, because it defines what code and value mean
for everything else, once the content of the catalog is decided, since
what a predicate over a map sees follows from it, and immediately
after it the single binding form. Then, each on its own branch: the order over values, the container
family, error
identity, host concerns out of the core, `use`, the nested-error law,
doc segments, reading in pieces, fields documented on their tags, and
the revision of the other derivable forms. Then
the single-spelling work: the documents, the examples, the bootstrap
pass, the keyword form, the error library, the editor grammar, and with
them the guards that no longer guard anything. Then the front door: the
root Doc, the catalog prose, answers within a budget, enrichment once
per session, and the benchmark that gates the milestone. Then
the consumers' own surfaces, the sister project's guide first, and last
the remaining process items.

A branch has one scar or one part of one, a command that shows what
it changed, and a diff whose sign is reported by area: core sources,
catalog, documents, tests. A branch that introduces a model, such as the
argument model, is allowed to add, and says in its description what the
next branch will delete because of it.

A session is one of three kinds. A design session talks, decides, and
updates this document; it reads this document, the Tier 1 sources the
instruction file names, and the file under dispute, and no more. An implementation session takes one scar,
reads this document and the files it touches, runs the tests, and ends
with a pull request. An audit session runs the metrics and the
benchmark, checks each scar against the tree, and removes the scars
the tree no longer shows.
Every session opens by reading this document, running `git status` and
the tests, and stating in one paragraph where the work stands; it
closes by updating this document with what was decided, so that no
decision survives only in a conversation. A session does not read the
tree wholesale: the September session that produced this audit
overflowed its context by doing exactly that, and everything it needed
was recoverable by reading at the point of need and by running `qlang`
to check a claim.

When a claim about the language is in doubt, run it. When the intention
behind a construct is in doubt, ask the maintainer; the repository
records what was built, not why.

## What the maintainer still decides

Five decisions shape the core. Two of them were taken while this audit
was being written, on 15 September 2026. Containers: one map and one
vector, JSON as syntax and codec, the preservation branch deleted; the
maintainer judged the JSON family a failed experiment whose one
lasting gift was the tag. Host concerns: the effect marker leaves the
language rather than moving to a convention, provenance is a tag on a
value where a host needs it, and the checks and flags go with the
marker. The order of the first moves was settled at the same time: the
data form of code and its involution come before the argument model.

The remaining decisions were taken by the model at the maintainer's
request, and each stands until the maintainer vetoes it. Arguments: a
parameter holds a value; the catalog's slot vocabulary is what the
runtime reads, so a built-in's lazy slot is declared and a user
pipeline declares its own with a quote of the parameter's name,
`filter (gt 1)` keeping its shape on both surfaces; an explicit quote
passes code into a slot declared for a value; the arity dispatch of
predicates and the second calling convention go. Naming: one form with `:name` as its marker, a
tilde after the name declaring code and a bare body evaluated in
place, tags declared through the same form, `as` and the snapshot
gone. A tag's body is its schema when it is a map, a field's kind
being a type, a tag, `[kind]` for a vector of the kind or `#[…]` for
an enumeration of keywords, and its constructor when it is code; the
runtime derives a record's constructor from its schema with the
checker that checks a slot, the three tags built in the host language
keep the builtin descriptor as their body, and a tag without a body
is identity. A record that wants a check beyond the kinds of its
fields is declared with code and documents its fields in prose. The
Doc of a tag documents its fields, and a field keyword leads to that
Doc; the spelling of a slot list, which a vector of one kind would
otherwise collide with, is settled with the argument model. Errors: one tag per kind of refusal with the operand, position
and expected type on the descriptor and a headline the printer
derives; the alternative, a per-site tag such as
`::AddLeftNotNumberError` derived by the runtime from the same facts,
removes the declarations just as well but costs a naming rule in the
runtime and a tag that names no catalog entry, and was set aside for
that. The quote is spelled `~(…)` and is transparent over its vector;
the alternative, an opaque value exposed through one involution
operand the way `error` exposes its descriptor, was set aside because
transparency removes a value class where the alternative adds an
operand, at the cost of every container operand acquiring a meaning
on a quote. `apply` is subject first, code as the argument like every
other higher-order operand, with no overload by the type of the
argument, since two quotes would make it undecidable; the price, a
declaration when the code arrives through the pipeline, is accepted:
a trail replays as `err !| :t /trail | 5 | apply t`, the declaration
standing on the fail track because a declaration is a transparent
step and hands the descriptor on as data, which
`"x" | add(1) !| :t /trail | 5` answering `5` today confirms. A
change to documents alone needs neither a branch nor a pull
request. The ring branch is the first change to the language.

The command form of the step was settled by the maintainer. The call
form it replaces is uniform and delimits itself, and was set aside
because it keeps two meanings of parentheses and a reading, the
function call, that brings the expectations of another paradigm;
dropping the comma alone, `op(a b)`, keeps both; parentheses around
every command cost a pair on every step of the top level, which is the
body of every query. The price accepted is that one text reads as a
command with a modifier on the pipe and as two elements inside a
literal, which the first screen states in a sentence and a parse error
names, and that the habits of a shell reach further than the language
does: a bare word here is a name, strings are quoted, and options are
a map.

The order in which a command's modifiers evaluate was accepted by the
maintainer on the model's proposal. The modifiers are the elements of
a vector of forks against the subject at the call site, so they
evaluate as the elements of a vector literal do: results by position,
simultaneity unspecified, none of them seeing another, and a value
that two modifiers want is declared a step earlier. The modifier of a
code slot is closed at the call site and run by the operand in the
operand's own order, which its catalog entry states where the order is
observable; `if`, `cond` and `coalesce` are lazy by that declaration,
as they are today. The law for nested errors stands in the errors
section; the maintainer left `coalesce` to the model, and the model
kept its alternatives as pipeline slots, since the slot kind and the
law together say what it does.

Progressive disclosure was settled by the maintainer: its name, the
`::elision` tag for what a host leaves out, and the division by which
the language computes whole values while the budget, elision,
enrichment, the explanation of an error and the performing of an
effect belong to the host and its session. The payload of the marker
is a map with two fields the host owes and the tag's declaration
documents, `:size`, in the elements of the vector the marker replaces,
and `:read`, a quote that applied to the original answer yields the
part left out; every other field, a summary, references, is the
host's. The two are what the clauses of the contract need, and nothing
in the core reads them.

The content of the catalog is the maintainer's to decide, and the
model's proposal stands as the question. The catalog is the coreutils
of values: an operand enters when it expresses what was inexpressible
over the values the language has, or shortens what every host would
otherwise write, and a domain's operands belong to its host. There is
one sequence, the vector: a string becomes a vector through `split`,
`lines` and `join` and is worked on as one, so the string operands
stay a handful and a string reads in pieces by the rule everything
else obeys; the alternative, a string library of its own, is what the
sister project's source text asks for first and is the one road on
which the catalog grows without bound. What a map is was settled with
the containers: its elements are its values, its keys travel with
them, and a predicate sees the value alone; the entry as a value, with
an `entries` and `fromEntries` pair, was set aside because it is the
reflex of every other language and pays with a second collection
inside the map, while `*` over a map and `indexBy` write both
directions as compositions.

Three of the four questions that holding this document against the
tree raised were settled on 22 September 2026, the model proposing
and the maintainer accepting. Predicates are strict: a condition
answers a boolean or fails at its slot. Truthiness, under which `null`
and `false` were false and every other value true, so that
`{:name null} | unless(/name, "anonymous")` answered `anonymous` and
`filter(/n)` kept the records whose field is set, was set aside
because it needs a second kind in the declaration of a slot and
answers silently where a string or a quote lands in a predicate,
while the idioms it served have homes, `coalesce` for a null and
`eq null` for the test. The set is the vector in the one order without
duplicates, and the order itself was the decision: without it a set
could only be a primitive with an equality of its own, or a vector
whose equality knew order and so was no set; a language without sets,
the same order with `distinct` answering a canonical vector, was
weighed and set aside by a small margin, the vector under the tag
costing two lines of catalog and answering for itself when printed.
The declaration of a tag is its schema or its constructor, as the
naming decision states. The fourth question, the benchmark, was
settled the same day: both instruments, each in its role. The
fresh-session attempt by a model in the loop is the mission's measure
and runs at milestones: a script hands a fresh model the first screen
as its only prior, the task with its input, and one tool, the query,
counts every answer the tool returns toward the bill, and runs the
first query the model offers as its answer against the expected
value. A deterministic proxy runs on every branch: the token bill of
the shortest reading path to a task's expected query, the first
screen, the documents of every operand and tag the query names, and
the printed answer, all derived from the expected query itself so that
nothing is authored per task. The threshold is the whole set, since a
correct query on the first attempt is the mission's own sentence; a
task that fails names a scar and enters this document. The tasks are
the sister project's queries and the command line's integration tests,
each with its expected value, so that correctness is `eq` against
that value and needs no judge.

The first screen is settled before the benchmark, since the
benchmark's budget is the first screen's. Its budget is a screen, what a terminal
shows at once: four kilobytes, about a thousand tokens. The name gives
the measure, and the bare names of the whole catalog weigh under a
kilobyte, so the screen holds them beside a sentence on what the
language is, the protocol for asking and the reading of an error,
while the full manifest stays behind a view. The screen divides by
what differs between hosts. The protocol for asking, `manifest`,
`docs`, `examples`, `spec` and how an error reads, is the same
everywhere and takes one paragraph of the start command's screen,
written once in the core; the rest of that screen is the host's
domain, its root operands and tags, since the domain is what a task is
about; the language's own base and its seed pipelines stand on a
screen of their own, one query away under the same budget. The price
is that a session facing a reshaping beyond projection reads two
screens before its first query. When two of the seven conditions
conflict, the ranking is the order in which this document derives
them. One model comes first: a construct that helps the first attempt
but needs a second mechanism stays out, as `isError` and truthiness
did, because the mechanism would have to be explained on every first
screen that follows. Then self-description, the measure itself; then
one spelling, since a second spelling is what goes stale under a
session; then the consumers running, since the language lives inside
its hosts; then the grammar's proportion, a symptom of the first and
the third. The sixth condition is the precondition of the others and
competes with none. The seventh, the sign of the diff, is the check on
the revision as a whole; it yields to a branch that introduces a
model, as the way of working allows, and to nothing else.

## Ledger

The branches in their order, one item each, with what a branch shows
when it lands. The list illustrates the order the chapter on the way
of working sets and binds nobody: the direction of an item is the one
its scar section states, except where the chapter before this one
lists the question as still the maintainer's, and a scar leaves this
document when the tree no longer shows it.

- Audit in the repository; injected instructions reduced to a pointer
  and the commands. Shown when the instruction file names no design
  rule.
- Review rules derived from the principles. Shown when every rule
  cites a principle and the addition-generating rules are gone.
- Sister project on the workspace copy. Shown when its dependency on
  the core resolves to the workspace folder rather than a published
  version, and its status page renders without a parse error.
- Code as data closes the ring. Shown when a quote answers `count`
  with its step count and `eq` compares quotes by structure, `parse`
  and its inverse round-trip every example in the catalog, `payload`
  down to atoms and `tag` back up rebuild every example as an `eq`
  quote, the data form carries no `:kind` and no positions, `apply`
  takes the quote as its modifier and runs it against the subject
  under the fork rule, the head of a pipeline rides `|`, `isError` is
  gone with `eval`, `>>` is deleted or kept by the branch's
  description, and a wrong assembly is refused by a constructor.
- Command form of the step. Shown when a step is a name followed by
  its modifiers and `[1 2 3] | filter (gt 1)` answers `[2 3]`, the
  argument comma is gone from the grammar, a command without modifiers
  has one spelling, and the catalog, the tests, the documents and the
  sister project carry no call form.
- Argument model. Shown when the `m(/)` probe answers 22 and the
  natural factorial answers 120.
- One binding form. Shown when `as` is absent from the catalog and no
  snapshot unwrap remains in the evaluator.
- One order over values. Shown when `sort` accepts any vector,
  `sort([/a /b])` orders by both keys, a null inside a key sorts, and
  the comparator operands are gone with the refusals of
  incomparability.
- One container family. Shown when a single-element bracket and a
  two-element bracket report the same type, `keys` has one answer,
  `{:a 1 :b 2} * add(1)` answers `{:a 2 :b 3}`, and the
  shape-preservation branch is gone.
- Set as the vector in canonical order under its tag. Shown when
  `#[2 1]` prints as `#[1 2]`, `#[1 2] | eq(#[2 1])` answers true,
  `[1 2 1] | distinct | type` answers `::set`, and no JavaScript set
  remains in the runtime.
- Error identity without declarations. Shown when no factory-declared
  class remains, the fail track reads the operand from the descriptor,
  a foreign failure carries a tag of the language, and the throw-site
  registry and both drift tests are gone.
- Host concerns out of the core. Shown when the language has no
  effect marker and no effect flag, the core carries no fingerprint,
  host categories are declared by hosts, and the host catalogs name
  their operands without a sigil.
- Command line seeds `null`. Shown when `qlang 'type'` on empty
  input answers `:null`.
- One `use`, namespaces as values, origin on bindings. Shown when a
  single form remains, the environment lists only user names, a
  namespace is obtainable by module name as a map, a binding answers
  its own documentation and its module, a shadowed binding is
  reachable through its namespace without a quoted housekeeping key,
  and a module ending in a map exports that map alone, so the sister
  project's helpers no longer appear in a client's manifest.
- One law for nested errors. Shown when one conformance case per
  operand family passes under the same rule.
- Doc segments are prose and quotes. Shown when reading a doc executes
  nothing.
- Every value reads in pieces. Shown when a string, a quote and a Doc
  each have one documented spelling for their size, for the address of
  a part and for a slice, and a probe fetches a left-out part of each
  with the original query and a tail.
- Fields documented on their tags. Shown when the declaration of a
  tag documents the fields of its record, a field keyword and an
  enumerated keyword resolve to their documents through the tag, and
  the sister project's nodes carry their kind as a tag.
- Derivable forms revised. Shown when the keyword-form
  projection segment `/:name` and the computing projections `/ast`
  and `/segments` are each deleted or justified in the catalog, and
  `when`, `unless` and `firstTruthy` are gone.
- Documents generated or deleted. Shown when no operand contract is
  spelled outside the catalog.
- Concurrency stated. Shown when the reference says which constructs
  evaluate their elements together and that results are ordered by
  element, and a host catalog documents how its operands bound
  fan-out.
- Examples on one plane. Shown when the injection script and the
  document-compliance runner are gone.
- One bootstrap pass. Shown when one stamping site remains.
- Keyword form carried from the parser. Shown when no parser call
  exists outside `parse.mjs`.
- Error library decided. Shown when it is in the catalog with
  examples, or deleted.
- Editor grammar generated or minimal. Shown when the TextMate
  grammar is produced by a script from the parser's token classes, or
  contains only what the editor cannot obtain from the language
  server.
- Root Doc and budget views. Shown when one start command returns the
  root Doc, the first screen fits the budget, and `manifest` offers a
  names view and a by-subject view.
- Catalog prose only for the underivable. Shown when no tag entry's
  prose restates its declared facts.
- Answers within a budget. Shown when a host answers within a budget
  and replaces what exceeds it with `::elision` markers that say what
  they stand for and how to read it, an error's input included, a
  parse error prints without the alternative list, and `:trail` prints
  the same way on an error value and on its materialized descriptor,
  where today the error literal hides a null trail and the descriptor
  shows it.
- Enrichment once per session. Shown when a host's renderer loads,
  within its budget, the documents of the tags and keywords that an
  answer or an error carries and the session has not been shown, and
  withholds the ones it has.
- Mission benchmark. Shown when the task set, threshold, and budget
  are defined and the benchmark runs at milestones.
- Sister project's guide generated. Shown when the guide is produced
  from the catalog and no hand-written spelling of the language
  remains in it.
- Site decided. Shown when the site renders the root Doc and the
  catalog, or has been reduced to the playground.
- Coverage policy. Shown when the threshold applies to the language
  core alone and the other workspaces run under a rule without a
  number.
- Reviewer as a signal. Shown when the injected instructions and the
  review rules describe the external reviewer as a milestone signal
  and no branch waits on its findings.
- Candidate, not yet an item: effects as emitted values. A write to
  the outside world becomes a tagged value that a pipeline emits into
  a log flowing outward with the pipeline value, and the host performs
  the log at the boundary; or a Quote tagged as a host effect, which
  the boundary evaluates, so that the effect is the pipeline's result
  rather than a side channel; reads stay ordinary host operands. Enters
  the ledger only with a task no plainer construct solves, the sister
  project's plan-then-apply workflow being the first candidate, and
  only after the argument model and the binding form have landed,
  because it amends the state pair.
- Candidate, not yet an item: dispatch by tag. A binding whose code is
  a map from tags to Quotes applies to a subject by selecting the
  Quote under the subject's `type`, so that `[::Dog{} ::Cat{}] * voice`
  reads each animal's answer from one table; extension is `union` on
  the table under lexical scope, a fallback is a key for a base type
  or for `:any`, and hierarchies stay out until a task needs them. It
  is expressible today through `cond`, so its ticket is open extension
  without editing, which the sister project's per-node-kind cards
  would use; it needs tags admitted as map keys and follows the ring
  and the argument model, since it rests on code as a value.