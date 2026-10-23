# QSERR · Errors

An error rests as a value and flies as a failure the pipe alone
carries: `raise` raises it, `!|` alone catches it, and its trace holds a
frame for each step it passed. The requirements of each section are the
cases of its file under `core/test/conformance/QSERR/`.

## rest

At rest an error is a value like any other, a map of facts under
`::error`, the kind of errors, under the tag of the site that refused:
a container holds it, a step reads it, `print` writes it, and its print
reads back as itself. `!{…}` is its literal, the literal of `::error`,
whose payload is the map of the facts, a payload of another kind refused
as `::error/PayloadKindNotTakenError`, and `::Foo!{…}` is
`::Foo::error{…}`, the facts laid under the tag written before the bang
through its label, a refusal of the label answering for the literal; the
kind of errors over an error at rest is that error. An
error at rest holds the facts it is written with, a `:kind` entry a fact
as any key is and a `:trace` that holds no frames among them, so
`!{:trace 5}` stands as the value it writes. The walk of an error passes
the tag of its site and `::tagged`, then `::error`, then the map, so a
verb declared once on `::error` reaches every error and a path reads the
facts beneath the tags.

```qlang
> [!{:a 1}] | get /0
!{:a 1}

> ::Oops!{:a 1} | eq ::Oops::error{:a 1}
true

> !{:kind ::Foo} | get [~(type) /kind]
[::error ::Foo]

> !{:trace 5} | get [~(type) /trace]
[::error 5]

> :error/twice ~(get /a | mul 2) | ::Oops!{:a 3} | twice
6

> !{:by 3} | tag ::error | eq !{:by 3}
true
```

## raise

Raising is an act, and `raise` alone performs it: it puts its subject on
the fail track, a map as `::error{…}` and a map under a tag as the error
of the outermost tag; a subject that is no map, a value under a tag over
another value among them, is refused as `::map/raise/SubjectNotMapError`.
An error at rest raised again is the error it was.

```qlang
> {:k 1} | raise !| type
::error

> ::Foo{:a 1} | raise !| type
::Foo

> "x" | add 1 !| raise !| type
::number/add/SubjectNotNumberError
```

## catch

A failure lives in the pipe alone: `|` passes it by, and `!|` alone
catches it, its step running on the error at rest, a value from then
on. `!|` passes a value by. A value written after `!|` is the recovery
the catch answers, and the facts of the error are read from it by `get`,
the parser refusing there a path, a quote and a literal that holds
either [QSSYN#step], so a quote the recovery answers is computed by a
group, `!| (~(…))`. A pipe written before `!|`, `a | !| b`, stands for the
combinator after it. The error at rest a catch holds is laid under the
tag of its site through the tag's label, none where the site is the kind
of errors itself, and a label whose payload takes no facts, or whose
invariant the error at rest breaks, refuses it with a frame at the step
of the catch. `ok` answers
`true`, so `ok !| false` asks whether the step before stood. A fact is
taken on the way and a failure recovered by its type in lines of
`!| … | raise`.

```qlang
> get [~("x" | add 1 !| 0) ~("x" | add 1 !| (~(get /message)))]
[0 ~(get /message)]

> !{:k 1 :j 2} | raise !| get [/k /j]
[1 2]

> 42 !| get /kind
42

> [1 "x"] | map ~(mul 2) | !| 0
0

> 5 | ok !| false
true

> !{:a 1} | raise !| payload | type
::map

> :Box |~~ A parcel. ~~| (::kind | holds :k |~~ k. ~~| ~(type | eq ::map)) | {:a 1} | tag ::Box | raise !| it !| get [~(type) /actualType]
[::Box/k ::Box]
```

## trace

A raised error holds the facts of its site and, after them, its trace
under `:trace`, a value of `::trace` that the verb `trace` reads: a frame
for each step that raised it or handed it on, from the step where it
arose to the step where it is read. A frame is a value of `::frame`, the
vector of the subject the step met, the quote of the steps of its level
from the one that failed, and, where the step failed at a part of its
subject, the path of that part; a step the failure skips joins the steps
of the last frame. The verbs of `::frame` read its parts:
`subject` the value its step met, `unfinished` the steps from the one
that failed, `failed` that step and `skipped` the steps after it, and
`place` the path of the part, or null; a path reads a frame as the vector
it is, `/0` its subject, so the part a step failed at is one read away.

A step whose answer is a failure its subject was not passes a frame: a
step that fails, `raise`, and a step that answers a failure from inside
it, the call of a verb, a group, a verb running a quote and the one word
of a fold [QSCOL#reduce], while a modifier of a step, a raise written
there among it, and a part of a literal, which is one step, answer within
the frame of that step, and no step the reader did not write joins it.
Where a step failed at a part of its subject is named once, by the place
of its frame, the path of its index, in a set the index in the one order,
or of its key in a map: the part the code of a verb failed on, `map`,
`filter`, `every`, `any` and `reduce` and the keys of `sort`, `min`,
`max`, `groupBy` and `indexBy`; the part whose answer it refused, the
verdict of `filter`, `every` and `any` and the key of `groupBy` and
`indexBy`; the part it refused itself, an element of `sum`, `avg`, `zip`,
`join`, `toPath`, `toMap` and a fold of the algebra, the key of a pair of
`toMap` and a key a fold of `minus` or `inter` reads at its path within
the value; the part a modifier of the step failed at; and the path
`update` wrote. The place and whether a raise resumes its trace are facts
of the call, which the step that receives the failure writes its frame
by, a refusal carrying the place of its part on its throw, the step of
`apply` by those of the function it runs and a declaration by those of
the call of its body, so no value carries them from one call into
another; a step that failed at no part names none. The
steps skipped at the level that reads the failure,
`trace | last | skipped`, run again by `apply` as held code runs
[QSQUO#held].

The kind `::trace` alone holds what a trace is: a vector of frames in the
order the failure flew, plain or under `::trace`, an element under a tag
over a frame read as the frame beneath it. Any other payload, a set and a
vector under a tag of another kind among them, is refused as
`::trace/PayloadKindNotTakenError`, and an element that is no frame, a
frame laid over a vector under a tag or over a set among them, as
`::trace/ElementKindNotTakenError` at its index; a frame of a subject
alone, or whose place is no path, is refused as
`::frame/PayloadNotSubjectAndStepsError`. The kind holds a trace wherever
one is laid: its literal and `tag ::trace`; `raise`, which lays the
`:trace` of the map or the error at rest it raises through the kind's
label; and `trace`, which brings its answer to `::trace` by its
`returns` [QSBLD#answer], `::trace[]` for an error that holds none, refuses a subject
that is no error as `::error/trace/SubjectNotErrorError` and an error
whose `:trace` is no trace by its answer,
`::error/trace/answer/KindNotTakenError`, while `/trace` reads the key and
is refused where there is none.

An error at rest that writes a `:trace` holding a frame resumes that
trace when raised and passes no frame, the steps the failure skips after
it joining the last frame of that trace; an empty `:trace` is no trace,
as an error at rest that holds none, so its raise starts the trace at its
own frame, the steps the failure skips after it joining that frame, as
the raise of a map that writes no `:trace` does. Every failure a step
answers holds its trace from its first frame, and an error at rest raised
again is the error it was, and raised without its `:trace` starts the
trace over at that raise.

```qlang
> "x" | add 1 !| keys
#[:actualType :trace]

> [1 "x" 3] | map ~(mul 2) | count !| trace
::trace[
  ::frame["x" ~(mul 2)]
  ::frame[[1 "x" 3] ~(map ~(mul 2) | count) /1]
]

> "x" | add 1 | mul 2 !| trace | first | get [~(subject) ~(unfinished) ~(failed) ~(skipped)]
["x" ~(add 1 | mul 2) ~(add 1) ~(mul 2)]

> [{:name "Ann" :age 30} {:name "Bo" :age "15"}] | filter ~(get /age | gt 18) !| get /trace/1/0/1
{:name "Bo" :age "15"}

> [1 2 3] | take (count | sub "1") !| trace | map ~failed
[~(sub "1") ~(take (count | sub "1"))]

> {:a 1 :trace []} | raise !| keys
#[:a :trace]

> {:a 1 :trace []} | raise | count !| trace
::trace[::frame[{:a 1 :trace []} ~(raise | count)]]

> {:a 1 :trace []} | raise !| :e it | raise !| eq e
true

> !{:a 1} | raise | count !| raise | add 1 !| trace | last | skipped
~(count | add 1)

> !{:a 1} | raise | count !| minus #[:trace] | raise | add 1 !| trace | last | skipped
~(add 1)

> get [~({:trace 5} | raise !| type) ~({:trace [5]} | raise !| get [~(type) /index]) ~({:trace #[::frame[1 ~(a)]]} | raise !| type) ~(::frame[1] !| type)]
[::trace/PayloadKindNotTakenError [::trace/ElementKindNotTakenError 0] ::trace/PayloadKindNotTakenError ::frame/PayloadNotSubjectAndStepsError]

> ::error{:a 1} | trace
::trace[]

> get [~(::A[::number"x"] !| trace | map ~failed) ~(!{:a 1 :trace ::trace[::frame[1 ~(pre)]]} | eq raise !| trace | map ~failed)]
[[~(::A[::number"x"])] [~(pre) ~(eq raise)]]

> !{:a 1 :trace 5} | trace !| type
::error/trace/answer/KindNotTakenError

> get [~([1 "x"] | sum !| trace | first | place) ~([[1 "x"]] | map ~(sum) !| trace | map ~place) ~([1 "x"] | eq sum !| trace | map ~place) ~({:a 1} | filter ~(5) !| trace | last | place)]
[/1 [/1 /0] [/1] /a]
```

## flow

A failure stands in the pipe alone. Code a verb runs that answers a
failure answers the verb, the elements after it left unrun: `map`,
`filter`, `every`, `any`, `reduce`, the branches of `if`, and the keys of
`sort`, `groupBy` and `indexBy`, while code that recovers inside keeps
every element. A literal whose part fails answers that failure, and so
does a template of `get` whose quote answers one, the first in the order
the literal holds its parts, a set in its one order and a map with the
last value of each key, a value a later entry of its key replaces
running nowhere; the body of a declaration that fails leaves the scope as it
was and answers the failure; a tag over a payload that fails answers the
failure, and so does a verb whose answer the kind of its subject refuses,
under the tags its walk passed as under none, since no tag is laid over a
failure; a modifier that answers a failure answers the call where its
input takes a value, and is refused under the input where it takes code
[QSQUO#modifier]. A refusal holds a failure computed at the call as the
error at rest it is, so reading it raises nothing.

```qlang
> get [1 ~("x" | add 1)] !| type
::number/add/SubjectNotNumberError

> :x (1 | div 0) !| env | has :x
false

> [1 "x" 3] | map ~(add 10 !| 0)
[11 0 13]

> :Pair |~~ Two elements. ~~| (::kind | holds :NotPairError |~~ A pair holds two. ~~| ~(count | eq 2)) | ::Box::Pair[1 2] | take 1 !| type
::Pair/NotPairError

> [1 2] | map (1 | div 0) !| type
::vec/map/code/KindNotTakenError

> get [~(#[::number"b" ::string#1] !| type) ~({:k ::number"x" :k 1} | count)]
[::string/PayloadKindNotTakenError 1]
```

## site

Every place that refuses has a tag of its own, its address: the address
of the place it guards and a last name that says in the language's
words what was refused, `::number/add/SubjectNotNumberError` for the
subject of `add` and `::number/add/addend/KindNotTakenError` for its
input. The last name names the refusal alone, so two places may share
one, `::construct/LiteralComputesError` beside
`::quote/LiteralComputesError`. A value of none of the kinds a holder
takes is refused by the holder's role, `KindNotTakenError`,
`PayloadKindNotTakenError` or `ElementKindNotTakenError`, the answer of a
verb, the subject of a function `apply` runs, `SubjectKindNotTakenError`,
the key an element files under, `KeyKindNotTakenError`, the answer of a
condition, `ConditionKindNotTakenError`, the row of a table,
`RowKindNotTakenError`, and the constructor and the recipe of a chain
and the answer of code a verb runs among them, the set of the kinds it
takes the fact `:expected`; the subject of a verb is
refused by the label it resides on, `SubjectNotNumberError`. A last name
names a kind after `Not` there alone and as the kind a conversion of its
address reads, `::string/toNumber/TextNotNumberError`, so a name moves
only with its word, and an invariant names the roles of what it holds,
`::point/PayloadNotOffsetLineAndColumnError`. The
refusal of an input's value lives under the input and that of the
subject's under `subject`, whether an invariant or a primitive raises
it, and what a run answers under the verb. A
refusal is declared in the source of the place it guards, but for one the
runtime raises by rule: the refusal of the kinds of an input, a field or
a payload is a node the chain lays, with a page of its own where no
`throws` gives one, and any other no `throws` declares reads the record
of its place [QSSLF#axis]. The refusal of a primitive takes the address
of the verb that ran it, but for a pair a step relates or combines and
cannot, which the call refuses as `::call/KindsMismatchedError`
[QSDSP#answer], a refusal of the read of a path sits under
`::path`, whichever verb reads it, a place of the args an input reads and
the call leaves out refused under the input [QSBLD#input], and a refusal
of the language's own steps sits under the record or the kind that holds
the rule, `::call`, `::bind`, `::construct`, `::fail`, `::group`,
`::quote` and `::error`, and links the page of its place [QSQUO#step];
what no query reaches is a defect of the runtime declared at its site
under `::builtin`, the descriptor of a primitive: the table of
primitives, the declarations of refusals and their facts, the root, the
bootstrap and the loaders, and a value of no kind a host handed, whose
addresses and pages a query reads as it reads any name's. The refusal of
an answer past the budget of every host's print,
`::qlang/AnswerBeyondBudgetError`, stands under `::qlang`, the topic
of the language, with its facts `:characters`
and `:budget` before those of `::error`: no step raises it and no `!|`
reaches it, since a host raises it after the last step of the query
[QSPRN#budget]. A failure
inside a primitive a host hands is
`::call/HostFailureError`, with its `:message` and `:causes`, and so is
an answer of such a primitive, or a fact of a refusal it throws, that is
or holds a value of no kind of the language, its `:message` naming the
verb and the path where that value stands [QSHST#door]. A refusal of
the runtime holds its facts in the order the catalog declares them, the
label's own first, the facts `::error` declares after them, `:expected`,
`:actualType` and `:actualValue` among them, and the trace last: the
value it refuses as `:actualValue`, whatever that value equals, and its
kind as `:actualType`, but a refusal of the subject its step was served,
which holds the kind of that value alone, the first frame holding the
subject, a host refusing its own so through `refusingTheSubject`
[QSHST#source], and a refusal of a part of the subject holds no index and
no key, the place of its frame naming the part [QSERR#trace]; an error a
reader writes holds its facts as written,
a `:trace` it writes where it stands and the trace its flight begins
last. A fact is a value of the language: a name a step read, a key a path
read and the keyword two values file under are keywords, and an index and
a segment a path read as an index numbers.

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(type) /expected /actualType]
[::number/add/addend/KindNotTakenError #[::number] ::string]

> 1 | add 1 2 !| entries | map ~first
[:actualType :places :actualValue :trace]

> get [~("zz" | toRegex "zz" !| has /actualValue) ~(::W"x" | toNumber !| get [~(keys) /actualType])]
[true [#[:actualType :trace] ::string]]

> [1 "x"] | sum !| get [~(keys) ~(trace | first | place)]
[#[:actualType :actualValue :expected :trace] /1]

> ::error | manifest | has ::error/actualType
true

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(::number/plus/by/KindNotTakenError | binding | get /name) ~(::number/plus/by/NotGivenError | binding | get /name)]
[:number/plus/by/KindNotTakenError :number/plus/by]

> ::builtin | manifest | filter ~(binding | get /name | toString | endsWith "Error") | count
12

> ::qlang/AnswerBeyondBudgetError | manifest
#[::qlang/AnswerBeyondBudgetError/budget ::qlang/AnswerBeyondBudgetError/characters]
```

## print

A failure prints as the error at rest a catch holds, the trace it left
among its facts, and its print read back by `parse | open` and raised
resumes that trace; a query that does not parse flew no step and prints
its facts alone. The answer of a host that is a failure prints as its
alert under the line comment `|~| raised, and no !| caught it`, which a
reading of the literal passes over, and so does the refusal a host
prints in the place of an answer past its budget, which was no failure
[QSPRN#budget]; the command line writes the content of the refusal's page
below, and the REPL prints without it. An error at rest an answer gives
prints as the value it is. A host that prints for a person's eye draws below the
refusal of a text of one line that line within an excerpt of three
hundred characters around the place its `:location` names, an ellipsis
where the excerpt cuts it, and a caret under that place as far as the
excerpt reaches, whatever the length of the line; `:location` names the
place in the whole text.

```qlang
> !{:a 1} | raise !| print | parse | open | raise !| keys
#[:a :trace]

> "x" | add 1 !| print | parse | open | raise | count !| trace | map ~(get [~(subject) ~(failed) ~(skipped)])
[["x" ~(add 1) ~(count)]]

> !{:a 1}
!{:a 1}
```

```sh
$ qlang '[01' < /dev/null | sed -n '1,8p'
|~| raised, and no !| caught it
::quote/ParseError!{
  :source "[01"
  :message "a number is written without a leading zero: write `1`"
  :location ::span[1 1 2 3 1 4]
}
|~| [01
|~|  ^~

$ qlang "[1 2 $(printf 'x%.0s' $(seq 1 330))" < /dev/null | grep -c -e '^|~| …x' -e '\^$'
2
```

## alert

A host prints a failure as its alert: its tag and its facts in the order
the catalog declares them, the subject of the first frame of its trace,
where it arose, and every other fact cut to an excerpt of three hundred
characters, a string past the excerpt giving way whole with its `:head`,
and the subject of each later frame giving way to an elision where the
elision prints shorter, each subject measured on the one line its frame
prints on, every frame keeping its steps and its place; each elision's
`:read` continues the query beneath `!|`, the record a word's code
failed on standing in the subject of its frame at the place the frame
names, `!| get /trace/1/0/1`. An alert within the budget stands as it
prints. Past it the failure keeps its tag and the names of its facts:
its trace keeps its first frames within an excerpt of its own, three
hundred characters, and ends with the elision of the rest,
`~(!| get /trace | drop k)`, and then each fact gives way within the
budget, the trace among them, which gives way whole where the budget
holds not even its first frame. The excerpts of an alert and its cut
tell the rest of a part by the elisions they made, so each `:size`
counts what its `:read` answers. A failure whose alert passes the
budget, the names of its facts kept, prints as the refusal of an answer
past it, its `:actualType` the tag of the failure and its head the error
at rest, each `:read` there beneath `!|`. The line of the raise and the
caret [QSERR#print] and the content of a page stand beside the budget
[QSPRN#budget].

```sh
$ qlang ':number/inf ~(add 1 | inf) | 0 | inf' < /dev/null | grep -o ':size [0-9]* :read ~(!| get /trace | drop [0-9]*)'
:size 993 :read ~(!| get /trace | drop 8)

$ qlang '3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise' < /dev/null | grep -o -E '::qlang/AnswerBeyondBudgetError|:actualType ::error'
::qlang/AnswerBeyondBudgetError
:actualType ::error
```

```qlang
> [{:name "Ann" :age 30} {:name "Bo" :age "15"}] | filter ~(get /age | gte 18) !| get /trace/1/0/1
{:name "Bo" :age "15"}
```
