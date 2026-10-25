# QSSYN · The grammar

How a query is written: steps, combinators, whitespace, comments and
docs, and what the parser refuses and how it says so. The requirements
of each section are the cases of its file under
`core/test/conformance/QSSYN/`.

## step

A query is a pipeline of steps. A step is a command: a name and its
modifiers, each one word, separated by whitespace, `take 2`,
`if (gt 0) ~("pos") ~("neg")`. Parentheses hold a pipeline taken as one
value, a group. The first modifier of a command may touch its name where
it opens with a parenthesis, so `filter(gt(1))` reads as `filter` with
the group `(gt(1))`, a call written by habit that runs where its input
takes a value and is refused where it takes code; every other word is
set off from the one before it, and a comma inside the parentheses of a
group or a quote is refused, naming the command form. A path written
before a word is refused naming both its readings, the read of a part,
`get /tags | count`, and the call of a verb by its name alone.

A step sees one value, the one the step before handed it, and
everything inside the step, its modifiers among them, is computed from
that value; what an earlier step saw a name keeps. A value stands at the
head of a query, of a group and of a quote, after a declaration, and as
a modifier. A value written as a later step on the success track is
refused by the parser: a path, a container literal and a tagged literal
naming `get`, a tag name `tag` and a quote `apply`, and an atom, a
regex, an error literal and a doc refused as a value standing where a
command stands; after `!|` a value is the recovery the catch answers, a
path and a quote are refused there as after `|`, and a literal that
holds a path or a quote at any depth, the template `get` reads, naming
`get`. A question mark after a segment of a path is refused naming
`query` and the path with its keys as written, and one inside a quoted
key is a letter of the key. A quote whose code is a path alone, a
leading `|` before it among it, is refused, the path given bare
instead, and a path followed by a word is refused naming the verb it
meant, `/ne ""` naming `ne`. The path of jq, a dot before a key, a
quoted key or an index, is refused naming the path of its keys and its
indices, which a step reads by `get`, `.users[0]` naming
`get /users/0`, and a modifier writes bare, `sort .age` naming `/age`,
and a dot alone before whitespace, a closing bracket, a pipe or the end
of the source is refused naming `it`. A tag name where a
declaration's name stands is refused.

```qlang
> "{:a 1} | /a" | parse !| message
"a path is a value, which the verb that takes it reads: write `get /a`"

> get [~("5 | ~(add 1)" | parse !| message | contains "by `apply`") ~("\"x\" | add 1 !| ~(get /message)" | parse !| message | contains "by `apply`")]
[true true]

> "5 | ::Box#5" | parse !| message
"a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`"

> "!{:k 1 :j 2} | raise !| [/k /j]" | parse !| message
"a literal that holds a path or a quote is the template `get` reads: write `get [/k /j]`"

> "get /age?" | parse !| message
"a part that may be missing is read by `query`, which answers null where it misses: write `query /age`"

> "add(1, 2)" | parse !| message
"modifiers are separated by spaces, not by commas: `f a b`"

> "{:users 1} | .users[0]" | parse !| message
"`.users[0]` is no path: a part is read by `get` and a path, which opens with a slash, `get /users/0`"

> "[{:age 2} {:age 1}] | sort .age" | parse !| message
"`.age` is no path: a path opens with a slash, `/age`"

> get [~({:"?a" 1} | get /"?a") ~("{:\"a?\" 1} | get /\"a?\"?" | parse !| message | contains "`query /\"a?\"`")]
[1 true]
```

## combinator

Steps are joined by a combinator: `|`, which carries the value and
passes a failure by, and `!|`, which carries a failure and passes a
value by [QSERR#catch]. A combinator is set off by whitespace on both
sides, a line break counting as whitespace and an opening bracket or the
start of the text standing for the space before it, so `|~`, `|~|`,
`|~~` and `|~~|` written together open a comment or a doc. One
combinator stands between two steps and at the head: a pipe written
before `!|` stands for the combinator after it, and any other
combinator after a combinator is refused naming the habit, after `| !|`
as after `!|`, one written against its neighbour with a message that
names the space; a combinator at the end of a pipeline, a group or a
quote is refused naming the step it misses. An unclosed `|~` after a
step is refused naming the verb that runs code on the value in the
pipe, `| apply ~(…)`, and a semicolon after a step where it stands,
naming the template that asks several things in one query,
`get [~(…) ~(…)]`. A pipeline, a group and a quote may open with a
combinator: a leading `|` is the head's combinator, and a leading `!|`
opens a step of the fail track.

```qlang
> "[1] || count" | parse !| message
"a combinator is set off by whitespace on both sides: write ` | `"

> "[1 2] |~(add)" | parse !| message | contains "| apply ~("
true

> "::vec | doc; ::map | doc" | parse !| message | contains "one query asks several by a template"
true

> "[1 2] | count ; count" | parse !| location
::span[14 1 15 15 1 16]
```

## line

A line break is whitespace wherever whitespace stands, at the top level
as inside brackets. A combinator joins steps, written at the end of a
line or at the start of the next; the modifiers of a command and the
elements of a literal run on across lines. A keyword that begins a line
with a doc or a step after it, on its line or a later one, opens a
declaration of its own, so the body before it ends there, and a keyword
alone on its line before a combinator, a line a keyword opens or the end
of the source is the modifier above. The body of a name with a path
begun on a later line, and the body of a bare name with its page begun
on a later line with a tag name, is a sentence: its steps run on, joined
by a combinator, to the next declaration or a value written after `|`;
any other body is one step, and a tag name on a later line is the body
of the declaration above. A value after the commands that follow a
declaration whose body is a tag name, a chain written on the line of its
name, is refused naming the body of one step it read and the
parentheses that hold a chain. A declaration joins a value or a group before
it on its own line with no combinator, `[1 2] :y 2 | y` answering `2`,
but for a tag name and a path, refused by the habits they meet
[QSSYN#step], while a keyword on the line of a command is a modifier of
it, and any other step is joined by a combinator.

```qlang
> "[3 1 2] sort" | parse !| message
"steps are joined by `|`: write `a | b`"

> "[1] | append\n:y\n:z 2\n| z" | parse
~([1] | append :y | :z 2 | z)

> "[1] | :vec/f\n  ~(first) !| 0\n:y 2 | y" | parse
~([1] | :vec/f (~(first) !| 0) | :y 2 | y)

> ":x ::Box | count | 5" | parse !| message | contains "is one step, `::Box`, and the commands after it are steps of the query: a chain stands in parentheses"
true
```

## comment

A comment, `|~| …` to the end of its line or `|~ … ~|`, which nests, is
whitespace wherever whitespace stands: between steps, between the
modifiers of a command, inside a literal and inside a quote. A `~(`
inside a block comment reads to the `)` that pairs it, where the source
holds one, so a closer inside the pair closes nothing. A pipe is
written beside a comment. A source of whitespace and comments alone is
the empty pipeline, which answers the value it is handed and reads as
the empty quote. Comments live beside the steps and the spans the parser
keeps, where the tools paint them, so none stands among the steps a
trace skipped.

```qlang
> 5 | |~ why ~| add 3
8

> get [~("[|~ ~(x ~|]" | parse) ~("(|~ ~(x ~|)" | parse !| tag)]
[~([]) ::quote/ParseError]

> [1 |~ middle ~| 2 3]
[1 2 3]

> "|~ only a note ~|" | parse | eq ~()
true
```

## doc

The doc forms, `|~~| …` to the end of its line and `|~~ … ~~|`, which
nests, are one literal, the doc, which reads a line break written as
`\r\n` as one. A declaration's page is the doc literals in its slot,
between its name and its body, joined in the order they are written
with a line break between them; a comment among them is whitespace. A
doc written before a declaration is refused, naming the slot; a doc that
opens a query is the doc value it is; a doc after a command is its next
modifier, and one after a step that is no command is refused, a note
inside a pipeline being a comment. Inside a doc, a span between
backquotes is prose, as markdown reads it, a run of backquotes closing
at the next run of as many and a run with no such closer prose itself.
In a block doc a span holds a doc nested in it: a `|~~` in the span
opens a doc of the span and a `~~|` closes the last it opened, `|~~|`
opening none; a `~~|` that closes none of the docs of the span ends the
span and the doc, and the run that closes the span closes it whatever
docs it left open. A `~(…)` outside a span, under the tags written before it, is a segment
of code where it reads as code, and prose where it does not, its steps
breaking a rule of a step or its text a rule the grammar holds there, a
number written with a leading zero among them; a `~(` that reads as no
code reads to the `)` that pairs it, in a line doc on its line as in a
block doc, as in a comment. The quote of a line doc is tried as code
within its line, so a source that fails after a line doc fails where its
reading stopped, and a source cut short in the quote of a line doc on
its last line names the continuations of the quote beside those of the
prose. The prose of a line doc ends at its line break, a carriage return
alone staying in it. A doc holds its prose with no whitespace at its edges
and no indentation its lines after the first share [QSSLF#doc], so
`|~~A box.~~|` and `|~~ A box. ~~|` are one doc.

```qlang
> :foo |~~ one ~~| |~ why ~| |~~ two ~~| 42 | ::foo | doc | content
"one\ntwo"

> get [~(|~~A box.~~| | content) ~(|~~   A box.   ~~| | content) ~("|~~ a\n      b\n    ~~|" | parse | first | content)]
["A box." "A box." "a\nb"]

> |~~ a ``~(add 1)`` c ~~| | segments
["a ``~(add 1)`` c"]

> |~~ a `f |~~ b ~~| c` then `~(count)` d ~~| | segments
["a `f |~~ b ~~| c` then `~(count)` d"]

> |~~ a `|~~` then `~(count)` d ~~| | segments
["a `|~~` then `~(count)` d"]

> [|~~ a `~~| |~~ b` c ~~|] | count
2

> get [~("|~~| a ~(b, ~(add 1)) c" | parse | first | segments | count) ~("|~~ a ~(f 01) ~~|" | parse | first | segments | count) ~(|~~ a ~(count | 1) b ~~| | segments | count)]
[1 1 1]

> "|~~ note ~~| :x 42" | parse !| message | contains "the slot of the declaration"
true

> "[|~~| x ~(a\n 1 2 | f" | parse !| location
::span[17 2 6 18 2 7]

> "[|~~| x ~(a" | parse !| expected | filter ~(eq ")") | count
1

> "|~~| x\r\n" | parse | first | content
"x"
```

## refusal

A source the parser refuses answers `::quote/ParseError` with its
`:source`, the line where the reading stopped, its `:location`, a
`::span` whose `start` and `end` are the points `line` and `column` read
[QSPRN#span], and, where a host named the source or the cell or `parse`
read the text, its `:origin`, `:string/parse` for a text `parse` read. A
refusal the grammar writes holds a `:message` that names the
habit it met; any other holds the continuations a reader could have
meant as `:expected` and what it met as `:found`, none at the end of the
source. A continuation is the text of a literal, or a part of the
grammar named as a keyword in the words of the language: a name and the
letters of a name [QSNAM#letters], a number, a hexadecimal digit,
whitespace, a doc, the end of the source, any character, and a character
by what it reads, a character of prose and a
character and a flag of a regex among them. A source that ends with a
bracket, a string, a quote, a doc or a comment open, a doc or a comment
nested in a comment or in the prose of a doc among them, where four
closers at most complete it, names the innermost and where it opened, its
`:message` naming the closers that complete the source, its `:expected`
the one closer the next character must be and its `:location` the end of
the source, while a refusal the grammar writes keeps its own words; one
that ends with a combinator names the step
it misses beside its continuations, where no refusal the grammar writes
stood before the end. A refusal the grammar writes reads no further
than the forms beside it until a look ahead found the form it refuses
whole, so the continuations of another error stand as they are and a
form left open is refused where its reading stopped. A form another
language writes is refused by the grammar with the form of this one: a
set written with braces names `#[`, a quote written with braces names
its parentheses, a comma between modifiers names the space, the path of
jq names a slash, and a semicolon between two queries names a template.

```qlang
> "[1 2 3] | filter ~(gt 1" | parse !| get [~(expected) ~(message)]
[[")"] "`~(` opened at line 1, column 18 is never closed; `)` completes the source"]

> get [~("[1 |~ a" | parse !| message) ~("|~~ a |~~ e" | parse !| message) ~("1 |~ a" | parse !| message | contains "apply")]
["`|~` opened at line 1, column 4 is never closed; `~|]` completes the source" "`|~~` opened at line 1, column 7 is never closed; `~~|~~|` completes the source" true]

> "#{1}" | parse !| message | contains "#["
true

> "[1 2" | parse !| get [~(source) ~(location | start | column) ~(origin)]
["[1 2" 5 :string/parse]

> "[1 2 x" | parse !| expected
[:"letters of a name" "/" :whitespace "]"]

> "(::Box ]" | parse !| expected
[:whitespace ":" "!|" "|" ")"]

> "::Box(1 ]" | parse !| location
::span[5 1 6 6 1 7]
```
