# QSAIM · The aim

What the language is for, the state of the work that counts as
satisfactory, the principles the code and the texts are held to, and the
order of the texts. Every other chapter rests on this one, and a session
reads it first.

## mission

qlang is the pipeline language for a model working under the pressure of
a task in a session that remembers nothing. Such a session meets
JSON-shaped data from sources it has never seen, has to collect and shape
it correctly, and cannot afford to learn a language first, so the
language teaches its user from inside itself: the catalog of words is
written in qlang, every binding carries its own prose and runnable
examples, and an error leads to the page that explains it. A model needs
no manual delivered in advance; it needs a protocol for asking at the
point of need.

The reason is the economy of such a session. Its context only grows:
whatever an answer adds is read again on every later round trip, so the
bill of a task grows with the square of its length, and the tokens spent
first, when the session knows least about what is relevant, are paid for
longest. A question about relations, who calls this, what implements
that, what breaks if it changes, answered by text search rebuilds the
graph inside the context, the most expensive place there is.

The language lives inside a tool that already holds such a graph or such
data. The tool embeds it and exposes its domain as words, and a session
asks one question where it would make many calls: the query names the
shape of the answer, so nothing arrives that was not asked for and
nothing needed is missing, the intermediate data stays out of the
context, and what the tool can do is learned from the tool at the point
of need. It is precise fetching against a typed schema, kept on the
client's side over whatever a tool answers, with a pipe that computes and
the schema as hypertext around keywords and tags.

Three requirements hold for every host. Onboarding lives inside the tool
and is obtained from it by a command, since knowledge copied out of a
tool goes stale with its next release. Nothing is delivered as a sheet:
the caller controls the shape and the detail of what it receives. And the
shape of an answer is known before the answer is fetched, from the tool
itself, because the shape a session needs is that of the one answer it is
about to shape, which belongs to the word it is about to call.

An answer is a presentation, data filtered for a question, never the
data a host holds. The arguments of a host's verb choose what the host
computes at all, and the pipeline cuts what arrived, a literal, to any
depth. A command has one output, a value under its tag, and the kinds of
its refusals. What a reader holds after a call is a printed value, and
its explanation starts there: the tag on it leads to the legend of its
payload, what was received, what each part means and which verbs carry
it on, read progressively, each step a literal of the language
[QSSLF#catalog].

The measure of quality is one: a fresh session, having read only what
the language says about itself, writes a correct query on the first
attempt. Every construct is judged by whether it makes that first attempt
likelier, every text by whether it is something the language could say
about itself, and the round trips and the token bill of a whole task
count it [QSWRK#measure]. Need is measured by tasks and by the pain a
session meets, and the code of a host is no measure of what the language
needs.

The same contract serves the work on qlang: a session that develops the
language starts from amnesia and a seed text, and the state of its work
is computed and delivered by a command, `npm run desk`, the screen of the
work [QSWRK#documents].

## state

The work is in a satisfactory state when seven things hold at once.
Where two conflict, the earlier wins; the sixth competes with none, and
the seventh yields only to a branch that introduces a model.

1. Every feature is an instance of one core concept. The core is small:
   a state pair of value and environment, a step that maps one state to
   the next, a handful of combinators, the fork rule for nested
   expressions, subject-first application, a literal as a subject,
   naming with lexical scope, the error as a value with a trail, a tag
   that names the kind of a value, and a catalog that describes itself.
2. Self-description is complete: a session that reads only the first
   screen of the language and asks the language for what it needs solves
   a benchmark of realistic JSON tasks at the first attempt, within a
   token budget, and no markdown text restates what the catalog says.
3. Every fact has one spelling, written where it is used and derived
   everywhere else, so no test keeps two spellings in agreement.
4. The consumers run: the sister project, the site and its playground,
   the language server, the editor extension and the screen of the work,
   each building against the workspace copy of the core and reading what
   it needs from the catalog, none carrying a spelling of the language of
   its own.
5. The grammar is proportional to the language, its comments trivia a
   few lines handle.
6. The aim is written down, in this chapter, and every session begins
   from it.
7. The work deletes more than it adds: the diff of a piece of work is
   negative in the core sources, the texts and the tests, and the catalog
   grows by the words a task asks for and the pages that tell them
   [QSWRK#diff].

## principles

One model. Everything the language does is a step over the state pair
and a combinator between steps; a construction that needs another
mechanism to be explained does not enter.

Everything is a value. Code, documentation, an error, the environment
and the description of a word are values, each with a literal that
prints and reads back, and only what has a literal reaches the pipeline.

A literal stands as a subject. Whatever the language holds has a
literal, a value, a kind, the address of a word, code, a page, an error
at rest, a path, and a literal stands at the head of a pipeline, where
the ordinary protocol asks it, `doc`, `explain`, `type`, `manifest`. A
step is a command, a word and its objects, and a value is the subject or
an object [QSPTH#value].

The language describes itself. The one description of a word is its
declaration in the catalog: documentation is read out of the language,
examples execute, and an error leads to its page.

One fact, one spelling. A fact is recorded where it is used and derived
everywhere else; a test that guards the agreement of two spellings is a
symptom, not a safeguard.

Executable over narrated. A fact a command computes is computed where it
is shown and copied into no prose, and a requirement a case can state is
a case; what stays prose is what no command computes, intentions, reasons
and the order of work.

Composition multiplies. A primitive enters where it expresses what was
inexpressible or shortens what exists; the catalog grows by names, few
verbs over many addressable nouns, tags, keys and namespaces.

Words carry paradigms. The vocabulary of the language and of its texts is
chosen for the habits it wakes in a reader trained on every other
language: a tag names a kind, a step is a command, and a word stays where
the habit it wakes is the right one.

Borrow concepts, not formats. The lessons of the history of interfaces
are taken, levels of help, the procedure behind an alert, typed link
relations, ownership of names; everything the language says is said in
its own literal, and a foreign format appears only at the host boundary.

The order of concepts is the order of dependencies. A concept comes
before anything that rests on it, in the text and in the implementation,
and where a later concept proves more fundamental, the earlier one is
rebuilt on it.

The host boundary. The needs of a terminal, an editor, an observability
backend and byte-exact JSON live beyond the embedding boundary and shape
no semantics of the core.

The sign of the diff. A change answers what became shorter, and a
replacement lands in every consumer at once: less code at the same
behaviour is a refactoring, less with a feature the work to praise, as
much with a feature good work, and more with features asks what they are
worth to the language [QSWRK#diff].

Prose names the invariant, and the reason lives with the decision. A
comment in code states what holds, in one sentence; why it holds, and why
the alternatives were set aside, is said in the dialogue or written as a
record [QSWRK#code], [QSWRK#documents].

Sources, not confidence. Every load-bearing sentence carries the handle
by which it is verified again: a probe, an anchor, the maintainer's words
or the inference it was drawn from.

## texts

The texts of the work rank in one order: this chapter first, then the
specification, the catalog and the cases, which are the reference of the
language [QSWRK#spec], then the tools, then the process. A lower text
holds to a higher one, and where they conflict, the lower one changes;
the process brings no entity into the language. The voices the texts
speak in and where each lives are the chapter of the work
[QSWRK#documents].
