# QSNAM · Names and scope

How a name is declared, what it holds, where it is seen, and what a bare
name reaches. The requirements of each section are the cases of its
file under `core/test/conformance/QSNAM/`, `scope.jsonl` for
[QSNAM#scope]; the blocks below are probes the tree answers.

## declare

One form declares every name: `:name body`. The body runs once, where
the declaration stands, against the value in the pipe, and the name
holds what it answered. The declaration hands its subject on unchanged,
so the binding is a branch to the side; a body that answers a failure
declares nothing, the failure goes on in the pipe and the steps after it
are skipped.

The body is a step: a literal, `it` for the value in the pipe, a group
for what the group computes, a call of a word, a quote, which is held as
the value it is, a keyword or a tag name, and a word after a keyword or
a tag name is a step of its own, joined by a combinator. A page written
between the name and the body is the name's page. A quote in a
declaration is held as data, and run later it reads the words, the nodes
and the labels of the step it runs in, a value the reader named withheld
from it [QSQUO#held]; a word declared under a label reads the tree as it
stands where it is called [QSNAM#word]; and a value is computed once,
against the subject at the declaration.

```qlang
> 42 | :answer it | add 1 | answer
42

> 5 | :x |~~ note ~~| 1 | add 1
6

> [1 2 3] | :n (count) | n
3

> :s ::vec | s
::vec

> ":s ::vec it" | parse !| get /message
"steps are joined by `|`: write `a | b`"

> :k 10 | :q ~(add k) | 5 | apply q !| type
::call/ValueWithheldError
```

## letters

A name a step can call begins with a letter of any script or `_` and
goes on with letters, digits, `_` and `-`, and a key of a path and a tag
are written in the same letters; names joined by `/` make a name with a
path [QSNAM#address]. A bare name in quotes declares that name, and a
name in quotes that a step cannot call is refused by the parser at the
keyword. The words of the literals, `true`, `false` and `null`, are read
by a step as the literals, so each declares a label, which its tag
reaches where the root holds no label of that name, a label of the root
staying the root's, `::null` among them, and its nodes are read by their
tags, `::false/x`, the parser refusing a step `false/x`; or a last name
under a noun, which its address calls.

```qlang
> :имя 5 | имя
5

> :"foo" 5 | foo
5

> ":true 5 | 7" | parse !| get /message
"`:true` is the word of a literal, which a step reads as the value: declare another name"

> :false |~~ F. ~~| | :false/x 3 | ::false/x | binding | get /value
3

> "false/x" | parse !| type
::quote/ParseError
```

## value

A bare name that holds a value answers the value, a quote among values:
the name alone reads its quote. Code under a bare name runs by `apply`,
or goes bare into an input that takes code, held as data [QSQUO#held]. A
name that holds a value, called with modifiers, is refused as
`::call/ValueTakesNoModifiersError` with its `:name`, the name as it was
declared, and the `:addresses` of the words of its last name.

```qlang
> :double ~(mul 2) | 5 | double
~(mul 2)

> :double ~(mul 2) | 5 | apply double
10

> :double ~(mul 2) | [1 2 3] | map double
[2 4 6]

> 5 | :five it | five 42 !| type
::call/ValueTakesNoModifiersError

> :Box |~~ Box. ~~| | :Box/side 3 | Box/side 1 !| get /name
:Box/side
```

## word

A name with a path under the label of the values it serves declares a
word, `:number/double ~(mul 2)`: its body runs on the subject at each
mention, the last name of its address calls it, and so does the address
written as a step. `~double` hands the word on as code. A word reads the
words and the nodes of the tree as the tree stands where it is called,
so a word calls itself by its name. Each call runs a frame: an input
read from its place, a modifier that is the literal of an atom and each
run of the code a verb runs meet the budget of frames one below the
call, a quote written as a modifier handed to the call as it is, and a
call that recurses without end is refused as
`::call/EvaluationDepthExceededError` with its `:depth` and `:limit`.

```qlang
> :number/double ~(mul 2) | 5 | double
10

> :number/inc ~(add 1) | 5 | inc | inc
7

> :number/plus10 ~(add 10) | [1 2 3] | map ~plus10
[11 12 13]

> :number/inf ~(add 1 | inf) | 0 | inf !| type
::call/EvaluationDepthExceededError
```

## scope

A scope is the steps of one pipeline that run in one env: its first step
and every step `|` or `!|` joins to it. A name is declared once in a
scope: the second declaration is refused where it stands,
`::bind/NameDeclaredTwiceError` with `:name`, its step the fault.

A group and each run of a quote are scopes of their own: a modifier, a
part of a template of `get`, the code `map` runs on each element. A
declaration there stands over the name of the scope around, and a name
declared there stays there.

The body of a word runs in the scope its call opens: the root, `args`,
each input of the word, and the nodes and labels of the scope it is
called in. A value the reader bound to a bare name stands outside it, a
bare step of that name refused as `::call/UnknownNameError` while `env`
reads it [QSNAM#owner]. A step of the body's pipeline that declares
`args` or an input is refused as a second declaration; a group of the
body and a quote it runs are scopes of their own, where an input may be
shadowed, and a word the body calls runs in a scope its own call opens
anew. What the body declares stays in it. A source is the scope of its
text, and a cell of a session is a scope of its own, so a cell after
another declares again any name or node a reader declared, under the
reader's noun or under one of the root.

```qlang
> :k 1 | :k 2 | k !| get [~(type) /name]
[::bind/NameDeclaredTwiceError :k]

> :k 1 | (:k 2 | k)
2

> :x 1 | [2 3] | map ~(:x it) | x
1

> :k 1 | get [~(:k 2 | k) ~(k)]
[2 1]
```

## reach

A bare name reaches, nearest first: the declaration of the reader's
scope; a word residing on a label the walk of the subject's tags
reaches; the one word of that name, which refuses a subject the walk
does not bring to its label; a bare name a host's source declares that
is no label. A name that reaches nothing is refused as
`::call/UnknownNameError`, with the names near it.

A label, a kind or a topic, is reached by its tag, `::string`, as it is
written wherever it is meant; its name written bare is the reader's to
declare, and undeclared it is refused as `::call/UnknownNameError`, its
`:nearest` naming the tag first. A reader's bare name stands over a bare
name of the root, while the tag of a label of the root stays the root's.

A value and a word meet aloud: a bare step that reaches a value the
scope binds, an input and the call's `args` among them, where a word of
the same name serves the subject, is refused as
`::call/ValueMeetsWordError`, whose `:addresses` hold the word's; where
no word answers the subject the value is read, and the word is called
beside the value by its address. A value named by the name of a word of
`::any`, `type`, `doc`, `env`, `get`, meets that word on every subject,
so it is read under another name.

```qlang
> 5 | string !| get /nearest
[::string]

> :vec 5 | vec
5

> :count 5 | 7 | count
5

> :count 5 | [1 2] | count !| type
::call/ValueMeetsWordError

> :count 5 | [1 2] | vec/count
2

> :count 5 | ::vec | count
5
```

## address

The names form one tree, every node a binding: a name, its page and its
value. The value says what the node is: a page or a kind makes a label,
a function or a quote under a label a word, any other value data. A name
with a path declares a node under the noun its path names before its
last name, a noun declared before it, else `::bind/NounNotDeclaredError`;
the tag of a name is its address, the name as it was declared. Written
as a step, an address reads what it declared, a word run and any other
value itself, whatever the subject; a node that holds data is read by
its address alone, its last name no bare name. An address no
declaration names, written as a step, is refused as
`::call/UnknownAddressError` with its `:address` and the tag names near
it as `:nearest`. Under a word lie its inputs, its answer, its refusals
and its laws, so what a word is is the set of declarations under its
address; a helper several words share is a node under their noun. A tag
no declaration names lays itself over a payload as it is.

The root holds the nodes of the language and of its hosts. A reader
extends a noun of the root with nodes of its own and declares no name
with a path the root holds, `:vec/count ~(0)` refused as a second
declaration; a bare name of the root it may declare over [QSNAM#reach].

```qlang
> :Box |~~ Box. ~~| | :Box/side 3 | Box/side
3

> :Box/side 3 !| type
::bind/NounNotDeclaredError

> :vec/second ~(get /1) | [7 8 9] | second
8

> ::Nobody[1 2] | type
::Nobody
```

## root

The root is a scope: the one the host's sources declare, each source a
cell run over the root the sources before it left, the language's
first, before the first step of a reader. A source, a cell and a query
are written alike; a source declares no name the root holds, bare or
with a path, and fails whole as `::builtin/RootSourceNotDeclaredError`, a
defect of the host raised past the fail track, while a cell and a query
declare a bare name of the root over it. A
binding records its `:origin`, the source or the cell it was read from.
`kinds` answers the set of the labels of one name the scope reads, the
language's, the hosts' and the reader's; a label declared under a noun,
`::qlang/values`, is read by `manifest` of its noun.

```qlang
> ::vec/filter | binding | get /origin
:qlang/vec

> :Box |~~ Box. ~~| | kinds | get [~(has ::vec) ~(has ::Box)]
[true true]
```

## binding

A declaration writes into its scope a record, `::binding`: the name,
the docs of its page, the value, the source of the declaration, null for
a node a chain lays, and its origin. `env` answers the declarations of
the reader where the step stands, in the body of a word those of the
query that called it [QSNAM#owner], each by its name with its record,
`{}` where the reader declared nothing. The axes read the record: `binding` the record itself,
`source` its source and `doc` its page.

```qlang
> :x |~~ note ~~| 1 | ::x | binding | keys
#[:docs :name :origin :source :value]

> :x 1 | env | get [~(has :x) ~(has :vec)]
[true false]

> :x |~~ note ~~| 1 | ::x | doc
|~~ note ~~|

> ::vec/count/answer | source
null
```

## owner

A word of the root runs in a scope marked as the root's. There a name
under a noun of the root reads the root alone, so a word a reader
declared under it answers the reader's own calls; a name under a noun
the reader declared reads as the reader wrote it, and the reader's
labels go with the reader's values into the word. A word joined to a
kind by the kind's owner goes where the kind's values go; an extension
of a kind of another owner stays where it was written.

A word written in the language and a word of the host answer alike.
Inside the body of a word, the names the body writes resolve in the
word's own scope, and what the body reads as data, `env`, a page, a
binding, reads the tree of names of the query that called the word, as a
word of the host that reads the state of its call reads that tree
wherever it is called; the tree carries down through every word the
body calls. The body's own names, its inputs and the names its steps
declare, stay in its scope, and a value of the reader reaches the body
as data alone.

```qlang
> :vec/doc ~("a reader page") | [1 2] | doc
"a reader page"

> :vec/doc ~("a reader page") | [1 2] | tutorial | first | type
::doc

> :x 1 | :any/names ~(:y 2 | env | get [~(has :y) ~(has :x)]) | names
[false true]
```
