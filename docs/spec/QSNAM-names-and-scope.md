# QSNAM · Names and scope

How a name is declared, what it holds, where it is seen, and what a bare
name reaches. The requirements of each section are the cases of its
file under `core/test/conformance/QSNAM/`, `scope.jsonl` for
[QSNAM#scope]; the blocks below are probes the tree answers.

## declare

One form declares every name: `:name body`. The body, the step after
the name and its page, `:body` of the `::bind` a quote holds of the
declaration [QSQUO#step], runs once, where the declaration stands,
against the value in the pipe, and the name holds what it answered. The
declaration hands its subject on unchanged, so the binding is a branch
to the side; a body that answers a failure declares nothing, the failure
goes on in the pipe and the steps after it are skipped.

The body is a step: a literal, `it` for the value in the pipe, a group
for what the group computes, a call of a verb, a quote, which is held as
the value it is, a keyword or a tag name, and a word after a keyword or
a tag name is a step of its own, joined by a combinator. A page written
between the name and the body is the name's page. A quote in a
declaration is held as data, and run later it reads the verbs, the nodes
and the labels of the step it runs in, a value the reader named withheld
from it [QSQUO#held]; a verb declared under a label reads the tree as it
stands where it is called [QSNAM#verb]; and a value is computed once,
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

> ~(:x 1) | first
::bind{:name :x :body 1}

> ":s ::vec it" | parse !| get /message
"steps are joined by `|`: write `a | b`"

> :k 10 | :q ~(add k) | 5 | apply q !| type
::call/ValueWithheldError
```

## letters

A name a step can call begins with a letter of any script or `_` and
goes on with letters, digits, `_` and `-`, and a tag is written in the
same letters, while a key of a path may begin with a digit or `-` as
well, `/1a`; names joined by `/` make a name with a path
[QSNAM#address]. A bare name in quotes declares that name, and a
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

> {"1a": 1} | get /1a
1
```

## value

A bare name that holds a value answers the value, a quote among values:
the name alone reads its quote. Code under a bare name runs by `apply`,
and a quote or a path under it goes bare into an input that takes code,
held as data [QSQUO#held], a function to `apply` alone [QSQUO#modifier]. A
name that holds a value, called with modifiers, is refused as
`::call/ValueTakesNoModifiersError` with its `:name`, the name as it was
declared, its value as `:actualValue` and the `:addresses` of the verbs of
its last name.

```qlang
> :double ~(mul 2) | 5 | double
~(mul 2)

> :double ~(mul 2) | 5 | apply double
10

> :double ~(mul 2) | [1 2 3] | map double
[2 4 6]

> 5 | :five it | five 42 !| get [~(type) /actualValue]
[::call/ValueTakesNoModifiersError 5]

> :Box |~~ Box. ~~| | :Box/side 3 | Box/side 1 !| get /name
:Box/side

> :five 5 | :string/five ~(1) | 3 | five 42 !| get /addresses
#[::string/five]
```

## verb

A name with a path under the label of the values it serves declares a
verb where its value is a function or a recipe,
`:number/double ~(mul 2)`: the recipe runs on the subject at each
mention, the last name of its address calls it, and so does the address
written as a step. `~double` hands the verb on as code. A verb reads the
verbs and the nodes of the tree as the tree stands where it is called,
so a verb calls itself by its name. The evaluator counts the nesting of
the code it runs beneath a step, its evaluation depth: the recipe of a
verb, a modifier the call computes, `apply`, the constructor of a tag
and each run of the code a verb runs go one deeper than the step that
called them, an input read from its place and a modifier of an atom
meeting the limit one deeper than the call, while the steps of one
pipeline and a group run at its depth and a quote written as a modifier,
handed to the call as it is, goes no deeper; a run past the limit, a
call that recurses without end among them, is refused as
`::call/EvaluationDepthExceededError` with its `:depth` and `:limit`.

```qlang
> :number/double ~(mul 2) | 5 | double
10

> :number/inc ~(add 1) | 5 | inc | inc
7

> :number/plus10 ~(add 10) | [1 2 3] | map ~plus10
[11 12 13]

> :number/inf ~(add 1 | inf) | 0 | inf !| get [~(type) ~(keys | has :depth) ~(keys | has :limit)]
[::call/EvaluationDepthExceededError true true]
```

## scope

A step runs on a state of two parts, the value in the pipe and its
scope, the names in force where it stands over the root, a recipe's those
its call opens [QSBLD#recipe]. A scope is shared by the steps of one
pipeline, its first step and every step `|` or `!|` joins to it. A name
is declared once in a scope,
counted in its steps as they are written, run or skipped: a declaration
the fail track passed by counts, and so does one whose body failed, so a
recovery after `!|` declares another name. The second declaration is
refused where it stands, `::bind/NameDeclaredTwiceError` with `:name`,
its step the one that failed.

A group and each run of a quote are scopes of their own: a modifier, a
part of a template of `get`, the code `map` runs on each element. A
declaration there stands over the name of the scope around, and a name
declared there stays there.

The recipe of a function runs in the scope its call opens
[QSBLD#recipe]: the recipe, or a step of its pipeline, that declares
`args` or an input is refused as a second declaration, while a group of
the recipe and a quote it runs are scopes of their own, where an input
may be shadowed, and a verb the recipe calls runs in a scope its own
call opens anew. What the recipe declares stays in it. A source is the
scope of its text, and a cell of a session is a scope of its own, so a
cell after another declares again any name or node a reader declared,
under the reader's noun or under one of the root.

```qlang
> :k 1 | :k 2 | k !| get [~(type) /name]
[::bind/NameDeclaredTwiceError :k]

> {} | raise | :x 1 !| :x 2 | x !| type
::bind/NameDeclaredTwiceError

> :k 1 | (:k 2 | k)
2

> :x 1 | [2 3] | map ~(:x it) | x
1

> :k 1 | get [~(:k 2 | k) ~(k)]
[2 1]

> :number/m (::fn | takes :x |~~ The x. ~~| /0 | impl ~(:x 3 | add x)) | 1 | m 2 !| get [~(type) /name]
[::bind/NameDeclaredTwiceError :x]

> :number/m (::fn | takes :x |~~ The x. ~~| /0 | impl ~((:x 3 | x) | add x)) | 1 | m 2
5
```

## reach

A bare name reaches, nearest first: the declaration of the reader's
scope; a verb residing on a label the walk of the subject's tags
reaches; the one verb of that name, which refuses a subject the walk
does not bring to its label; a bare name a host's source declares that
is no label. A node of data under a noun, a chapter of a topic among
them, is read by its address alone. A name that reaches nothing is
refused as `::call/UnknownNameError`, with the names near it, and a name
whose verbs reside on several kinds, none of which the walk reaches, as
`::call/KindAnswersNoVerbError` [QSDSP#refusal].

A label, a topic among them, is reached by its tag, `::string`, as it is
written wherever it is meant; its name written bare is the reader's to
declare, and undeclared, where no verb of that name answers the subject,
it is refused as `::call/UnknownNameError`, its `:nearest` naming the
tag first. A reader's bare name stands over a bare name of the root,
while the tag of a label of the root stays the root's.

A value and a verb meet aloud: a bare step that reaches a value the
scope binds, an input and the call's `args` among them, where a verb of
the same name serves the subject, is refused as
`::call/ValueMeetsVerbError`, whose `:addresses` hold the verb's; where
no verb answers the subject the value is read, and the verb is called
beside the value by its address. A value named by the name of a verb of
`::any`, `type`, `doc`, `env`, `get`, meets that verb on every subject,
so it is read under another name.

```qlang
> 5 | string !| get /nearest
[::string]

> 5 | pipeline !| type
::call/UnknownNameError

> :vec 5 | vec
5

> :count 5 | 7 | count
5

> :count 5 | [1 2] | count !| type
::call/ValueMeetsVerbError

> :count 5 | [1 2] | vec/count
2

> :count 5 | ::vec | count
5
```

## address

The names form one tree, every node a binding of a name, its page and
its value, and a node is what lies under a noun at its address,
`::vec/sort` under `::vec`, `manifest` answering the nodes one name
under a noun. A name with a path declares a node under the noun its
path names before its last name, a noun declared before it, else
`::bind/NounNotDeclaredError`; the tag of a name is its address, the
name as it was declared. A noun is the name an address names before its
last name, a label, a verb or a name of data, as the value of its
binding says. A label is a kind declared under a name, by the chain that
builds it from `::kind` or by its page alone, which declares a kind of
no commands: its verbs reside on it, its nodes lie under its address,
`kinds` answers it where its name is of one segment [QSNAM#root], and a
value goes under its tag through the kind [QSBLD#label]. A verb is a
function named under a label, whatever recipe it holds, or a recipe
written alone there, the value its declaration wrote, what runs on the
values of its label [QSNAM#verb];
under it lie
the roles of its chain, its subject, its inputs, its answer, its
refusals and the facts they carry, its invariants and its laws, so what
a verb is is the set of the nodes under its address, and a helper
several verbs share is a node under their noun. Any other value is data.

Written as a step, an address reads what it declared, a verb run on the
subject its residence serves [QSDSP#residence] and any other value
itself, whatever the subject; a
node that holds data is read by its address alone, its last name no bare
name. An address no declaration
names, written as a step, is refused as `::call/UnknownAddressError`
with its `:address` and the tag names near it as `:nearest`. A tag no
declaration names, the tag of a verb and the tag of an invariant lay
themselves over a payload as it is.

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

> ::vec | manifest | has ::vec/sort
true

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | throws :TooBigError |~~ t ~~| | returns |~~ r ~~| ::number | impl ~(add by)) | ::number/plus | manifest
#[::number/plus/TooBigError ::number/plus/answer ::number/plus/by]

> ::Nobody[1 2] | type
::Nobody

> :number/a (::fn | impl ~(add 1)) | :number/b ~(add 1) | get [~(::number/a | binding | get /value | type) ~(::number/b | binding | get /value | type) ~(5 | a) ~(5 | b)]
[::fn ::quote 6 6]

> get [~(5 | number/add 1) ~("x" | number/add 1 !| type) ~(::vec/take/count/NotIntegerError#5 | type)]
[6 ::number/add/SubjectNotNumberError ::vec/take/count/NotIntegerError]
```

## root

The root is a scope: the one the host's sources declare, each source a
cell run over the root the sources before it left, the language's
first, before the first step of a reader. A source, a cell and a query
are written alike; a source declares no name the root holds, bare or
with a path, and fails whole as `::builtin/RootSourceNotDeclaredError`, a
defect of the host raised past the fail track, while a cell and a query
declare a bare name of the root over it. A binding records its
`:origin`, the source or the cell it was read from. `kinds` answers the
set of the labels of one segment the scope reads, the language's, the
hosts' and the reader's, the topics among them: the topic of the
language is the label `::qlang`, whose page is the first page, and the
topic of the command line `::cli`. What `tells` declares under a topic
is a chapter, the page of a concept, read by `manifest` of its noun; a
chapter of `::qlang` holds the set of the kinds it tells of, data, so
its tag lays nothing, `::qlang/values[1]` refused as
`::construct/TagNamesAValueError`, and the refusal the topic throws holds
its page.

```qlang
> ::vec/filter | binding | get /origin
:qlang/vec

> :Box |~~ Box. ~~| | kinds | get [~(has ::vec) ~(has ::Box)]
[true true]

> get [~(kinds | has ::qlang) ~(::qlang | binding | get /value | type) ~(::qlang | manifest | map ~(binding | get /value | type) | toSet) ~(::qlang/values[1] !| type)]
[true ::kind #[::doc ::set] ::construct/TagNamesAValueError]
```

## binding

A declaration writes into its scope a record, `::binding`, a map its
kind reads: `:name`, a keyword, `:docs`, the docs of its page, `:value`,
`:source`, the declaration, null for a node a chain lays, and `:origin`,
a keyword or null, a record a reader writes refused where it leaves one
out, `::binding{:name :x}` as `::binding/docs/NotGivenError`. `env` answers the declarations of
the reader where the step stands, in the recipe of a verb those of the
query that called it [QSNAM#owner], in code held as data its own and the
nodes and the labels of the step it runs from [QSQUO#held], each by its
name with its record, `{}` where the reader declared nothing. `binding`
reads the record itself, `doc` its page, and `source` every declaration
written under the name's address, the record's `:source` holding the
step of the one that wrote it; given an anchor, each reads the node its
subject holds under it [QSSLF#axis].

```qlang
> :x |~~ note ~~| 1 | ::x | binding | keys
#[:docs :name :origin :source :value]

> get [~(::binding{:name :x} !| type) ~(:x |~~ One. ~~| 5 | ::x | binding | :b it | print | parse | open | eq b)]
[::binding/docs/NotGivenError true]

> :x 1 | env | get [~(has :x) ~(has :vec)]
[true false]

> :x 1 | :Box |~~ B. ~~| | :Box/side 3 | :e ~(env | keys) | 5 | apply e
#[:Box :Box/side]

> :x |~~ note ~~| 1 | ::x | doc
|~~ note ~~|

> ::vec/count/answer | source
null

> ::vec/take | binding :count | get /name
:vec/take/count
```

## owner

A verb of the root runs in a scope marked as the root's. There a name
under a noun of the root reads the root alone, so a verb a reader
declared under it answers the reader's own calls; a name under a noun
the reader declared reads as the reader wrote it, and the reader's
labels go with the reader's values into the verb. A verb joined to a
kind by the kind's owner goes where the kind's values go; an extension
of a kind of another owner stays where it was written.

A verb written in the language and a verb of the host answer alike.
Inside the recipe of a verb, the names the recipe writes resolve in the
verb's own scope [QSBLD#recipe], and what the recipe reads as data,
`env`, a page, a binding, reads the tree of names of the query that
called the verb, as a verb of the host that reads the state of its call
reads that tree wherever it is called; the tree carries down through
every verb the recipe calls. The recipe's own names, its inputs and the
names its steps declare, stay in its scope, and a value of the reader
reaches the recipe as data alone.

```qlang
> :vec/doc ~("a reader page") | [1 2] | doc
"a reader page"

> :vec/doc ~("a reader page") | [1 2] | tutorial | first | type
::doc

> :x 1 | :any/names ~(:y 2 | env | get [~(has :y) ~(has :x)]) | names
[false true]
```
