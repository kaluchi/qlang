# The aim

What the work on qlang is for, the state it counts as satisfactory and
the principles a change is judged by: the yardstick of the work, which a
choice reads, in the dialogue and in the records, and which a session
reads at its landing with the records in transit and the open records.
It measures the distance between the tree and what the work wants; what
holds is the specification's to say [QSVOX#order].

## mission

qlang is the pipeline language for a model working under the pressure of
a task in a session that remembers nothing. Such a session meets a world
it has never seen, data to read and things to drive, has to handle them
correctly, and cannot afford to learn a language first, so the language
teaches its user from inside itself [QSSLF]: a model needs no manual
delivered in advance, but a way of asking at the point of need.

The reason is the economy of such a session. Its context only grows:
whatever an answer adds is read again on every later round trip, so the
bill of a task grows with the square of its length, and the tokens spent
first, when the session knows least about what is relevant, are paid for
longest. A question about relations, who calls this, what implements
that, what breaks if it changes, answered by text search rebuilds the
graph inside the context, the most expensive place there is.

The language lives inside a host, a tool that already holds such a
graph, such data or such things. The host embeds the language and
exposes its world through it [QSHST#source], `::codebase`,
`::deployment`, `::dashboard`, `::inbox`, `::thermostat`: a session asks
each what it is, what it offers and what state it is in, and tells it
what to do, by the one protocol the language sets. Every answer and
every part of it is annotated by a prefix that names its kind, and the
prefix is asked by the same protocol, so an answer leads on to its own
explanation inside the language. A session asks one question where it
would make many calls: the query names the shape of the answer, so
nothing arrives that was not asked for and nothing needed is missing,
and the intermediate data stays out of the context. Three requirements
hold for every host. Onboarding lives inside the tool and is obtained
from it by a command, since knowledge copied out of a tool goes stale
with its next release. Nothing is delivered as a sheet: the caller
controls the shape and the detail of what it receives. And the shape of
an answer is known before the answer is fetched, from the word about to
be called. An answer is as exact and as short as the query asks, and a
default answer, the print of a value and of a failure and the shape of a
value among them, carries signal enough to pay for the round trip that
brings it into the context; where a literal is hard to read on, or one
round trip cannot ask several questions at once, the round trips grow
with the inconvenience of the tool and not with the task.

The measure of quality is one: a fresh session, having read only what
the language says about itself, writes a correct query on the first
attempt. Every construct is judged by whether it makes that first
attempt likelier, every text by whether it is something the language
could say about itself, and the round trips and the token bill of a whole
task are counted in it [QSMSR#benchmark]. Need is measured by tasks and
by the pain a session meets, and the code of a host is no measure of
what the language needs.

## state

The work is in a satisfactory state when seven things hold at once.
Where two conflict, the earlier wins; the sixth competes with none, and
the seventh yields only to a branch that introduces a model.

1. Every feature is an instance of one core concept. The core is small:
   a state pair of a value and a scope, a step that maps one state to the
   next, two combinators, the fork rule for nested expressions,
   subject-first application, a literal as a subject, naming with
   lexical scope, the error as a value with a trace, a tag that names the
   kind of a value, and a catalog that describes itself.
2. Self-description is complete: a session that reads only the first
   screen of the language and asks the language for what it needs solves
   a benchmark of realistic tasks, reading the data and driving the
   things of a host, at the first attempt, within a token budget.
3. Every fact has one spelling, written where it is used and derived
   everywhere else, so no test keeps two spellings in agreement.
4. The consumers run: the sister project, the site and its playground,
   the language server, the editor extension and the screen of the work,
   each building against the workspace copy of the core and reading what
   it needs from the catalog, none carrying a spelling of the language of
   its own.
5. The grammar is proportional to the language, its comments trivia a
   few lines handle.
6. The aim is written down, here, and every session lands on it.
7. The work deletes more than it adds: the diff of a piece of work is
   negative in the core sources, the texts that state what holds and the
   tests, and the catalog grows by the words a task asks for and the pages
   that tell them [QSMSR#diff]; the journal stands outside that count,
   growing by the history of every decision, and every record lies in
   `replaced/`.

## principles

What a change is judged by, in a review [QSRVW#review] and in the choice
a record makes.

One model. Everything the language does is a step over the state pair
and a combinator between steps; a construction that needs another
mechanism to be explained does not enter.

Everything is a value. Code, a page, an error, the scope a query
declared and the description of a word are values, each with a literal
that prints and reads back and that stands at the head of a pipeline,
where the protocol asks it, `doc`, `tag`, `manifest`; only
what has a literal reaches the pipeline.

The language describes itself. The one description of a word is its
declaration in the catalog: documentation is read out of the language,
examples execute, and an error leads to its page.

Looking into an answer is safe. No answer the language prints floods a
reader's context, whatever the size of the literal it prints: where a
literal does not print within its bound, the language compresses it so
as to carry the most valuable information it holds, and says what it
left out and how to read it. A failure follows the same rule, an alert
and a refusal giving the most useful signal in the least room, and every
literal comes with the help it needs, its page, its shape and its words.

The language carries its tools. A reader finds in it what any further
reading of its literals needs, processing, transforming and filtering
them, and extends and completes that toolset with words and kinds of its
own.

One fact, one spelling. A fact is recorded where it is used and derived
everywhere else; a test that guards the agreement of two spellings is a
symptom, not a safeguard.

Executable over narrated. A fact a command computes is computed where it
is shown and copied into no prose, and a requirement a case can state is
a case; what stays prose is what no command computes, intentions,
reasons and the order of work.

Composition multiplies. A primitive enters where it expresses what was
inexpressible or shortens what exists [QSSLF#catalog]; the catalog grows
by names, few verbs over many addressable nouns, tags, keys and
namespaces.

Words carry paradigms. The vocabulary of the language and of its texts
is chosen for the habits it wakes in a reader trained on every other
language: a tag names a kind, a step is a command, and a word stays where
the habit it wakes is the right one.

A term strikes one sense. Other things equal, a term of the language and
of its texts is chosen high in entropy: one exact sense, which moves a
reader's inference to the one concept it names and which a search of the
project finds with few false matches, so the generic word every small
project writes gives way to it, as `::builtin` strikes its own domain where
`word` strikes a heap of senses. One concept goes by one term and one
image; a term is weighed in the texts of the project before it is chosen,
kept or split, and where two tie there, the one a reader knows outside in
the right pair wins [QSLEX#term].

Borrow concepts, not formats. The lessons of the history of interfaces
are taken, levels of help, the procedure behind an alert, typed link
relations, ownership of names; everything the language says is said in
its own literal, and a foreign format meets it where the language meets
the outside, JSON pasted as a literal and written by `json`.

The order of concepts is the order of dependencies. A concept comes
before anything that rests on it, in the text and in the implementation,
and where a later concept proves more fundamental, the earlier one is
rebuilt on it.

The host boundary. The needs of a terminal, an editor, an observability
backend and byte-exact JSON live beyond the embedding boundary and shape
no semantics of the core.

[QSHST#source]: ../spec/QSHST-hosts.md#source
[QSLEX#term]: ../spec/QSLEX-the-words-and-the-names.md#term
[QSMSR#benchmark]: ../spec/QSMSR-the-measures.md#benchmark
[QSMSR#diff]: ../spec/QSMSR-the-measures.md#diff
[QSRVW#review]: ../spec/QSRVW-the-reviews-and-the-research.md#review
[QSSLF#catalog]: ../spec/QSSLF-the-language-describes-itself.md#catalog
[QSSLF]: ../spec/QSSLF-the-language-describes-itself.md
[QSVOX#order]: ../spec/QSVOX-the-texts-and-their-voices.md#order
