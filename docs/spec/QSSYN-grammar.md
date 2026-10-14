# QSSYN · The grammar

How a query is written: steps, combinators, whitespace, comments and
docs, and what the parser refuses and how it says so. The requirements
of each section are the cases of its file under
`core/test/conformance/QSSYN/`.

## step

A query is a pipeline of steps. A step is a command: a word and its
modifiers, separated by whitespace, `take 2`, `if (gt 0) ~("pos") ~("neg")`.
Parentheses mean only a pipeline taken as one value, a group. The first
modifier of a command may touch its name where it opens with a
parenthesis, so `filter(gt(1))` reads as `filter` with the group
`(gt(1))`; every other word is set off from the one before it.

A value stands at the head of a query, of a group and of a quote, after
a declaration, and as a modifier. A value written as a later step on the
success track is refused by the parser, which names the word the habit
meant: `get` for a path and for a literal of a container, `tag` for a
tag name, `apply` for code; after `!|` a value is the recovery the
catch answers, but a path, which the habit wrote there to read a fact of
the error, is refused as after `|`. A question mark after a segment of
a path is refused, naming `query`. A quote whose code is a path alone is
refused, the path given bare in its place, and a path followed by a word
is refused naming the verb it meant, `/ne ""` naming `ne`.

```qlang
> "{:a 1} | /a" | parse !| get /message
"a path is a value, which the word that takes it reads: write `get /a`"

> "5 | ~(add 1)" | parse !| get /message | contains "by `apply`"
true

> "get /age?" | parse !| get /message
"a part that may be missing is read by `query`, which answers null where it misses: write `query /age`"

> "add (1)(2)" | parse !| get /message
"words are set off by whitespace; only the first modifier of a command may touch its name, `f(a) (b)`"
```

## combinator

Steps are joined by a combinator: `|`, which carries the value and
passes a failure by, and `!|`, which carries a failure and passes a
value by [QSERR#catch]. A combinator is set off by whitespace on both
sides, a line break counting as whitespace and an opening bracket or the
start of the text standing for the space before it, so `|~`, `|~|`,
`|~~` and `|~~|` written together always open a comment or a doc. A
combinator stands once between two steps, and one written against its
neighbour is refused with a message that names the space.

```qlang
> "[1] || count" | parse !| get /message
"a combinator is set off by whitespace on both sides: write ` | `"

> "[1 2] |~(add)" | parse !| get /message | contains "`|~` opens a comment"
true
```

## line

A line break is whitespace wherever whitespace stands, at the top level
as inside brackets. Steps are joined by a combinator written at the end
of a line or at the start of the next, never by the break alone; the
modifiers of a command and the elements of a literal run on across
lines. A keyword that begins a line opens a declaration of its own, so
the body before it ends there, while a tag name on a later line is the
body of the declaration above.

```qlang
> "[3 1 2] sort" | parse !| get /message
"steps are joined by `|`: write `a | b`"
```

## comment

A comment, `|~| …` to the end of its line or `|~ … ~|`, which nests, is
whitespace wherever whitespace stands: between steps, between the
modifiers of a command, inside a literal and inside a quote. A comment
carries no combinator, so a pipe is written beside it. A source of
whitespace and comments alone is the empty pipeline, which answers the
value it is handed and reads as the empty quote. No step, quote or trail
holds a comment; the parser keeps them beside its tree for the tools.

```qlang
> 5 | |~ why ~| add 3
8

> [1 |~ middle ~| 2 3]
[1 2 3]

> "|~ only a note ~|" | parse | eq ~()
true
```

## doc

The doc forms, `|~~| …` to the end of its line and `|~~ … ~~|`, which
nests, are one literal, the doc. A declaration's page is the doc
literals in its slot, between its name and its body, joined in the
order they are written; a comment among them is whitespace. A doc
written before a declaration is refused, naming the slot; a doc that
opens a query is the doc value it is; a doc after a step is refused, a
note inside a pipeline being a comment.

```qlang
> :foo |~~ one ~~| |~ why ~| |~~ two ~~| 42 | ::foo | doc | content
" one \n two "

> "|~~ note ~~| :x 42" | parse !| get /message | contains "the slot of the declaration"
true
```

## refusal

A source the parser refuses answers `::quote/ParseError` with its
`:source`, a `:marker` under the place it failed, its `:location`, the
continuations a reader could have meant as `:expected`, and a
`:message` where the grammar names the habit it met. A source that ends
with a bracket open names the bracket and where it opened, and its
`:expected` holds the closers that complete the source. A form another
language writes is refused with the form of this one: a set written with
braces names `#[`, a quote written with braces names its parentheses.

```qlang
> "[1 2 3] | filter ~(gt 1" | parse !| get [/expected /message]
[[")"] "`~(` opened at line 1, column 18 is never closed; `)` completes the source"]

> "#{1}" | parse !| get /message | contains "#["
true
```
