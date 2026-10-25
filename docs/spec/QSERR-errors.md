# QSERR · Errors

An error rests as a value and flies as a failure the pipe alone
carries: `raise` raises it, `!|` alone catches it, and its trace holds a
frame for each step it passed. The requirements of each section are the
cases of its file under `core/test/conformance/QSERR/`.

## rest

At rest an error is a value like any other, a map of facts under
`::error`, the kind of errors, under the tag of the refusal that refused:
a container holds it, a step reads it, `print` writes it, and its print
reads back as itself. `!{…}` is its literal, the literal of `::error`,
whose payload is the map of the facts, a payload of another kind refused
as `::error/PayloadKindNotTakenError`, and `::Foo!{…}` is
`::Foo::error{…}`, the facts laid under the tag written before the bang
through its label, a refusal of the label answering for the literal.

The tag of a refusal closes its error at rest by the kind of the refusal
[QSBLD#kind]: the kind its `throws` writes, its payload the `::error`
and its wiring the facts the refusal carries and its `trace`, or the kind
of the family of the rule that lays it [QSERR#site]. Its facts are read by
their names, `!| actualTag`, no path reads beneath its tag [QSPTH#get], and
`payload` answers the `::error` beneath it, which holds a fact past the
wiring of the kind; the walk of its tags meets no `::error`, so it is a
value of its refusal alone. The literal of an error of a refusal holds
its facts to the kinds its kind wires.

Under `::error` alone, or under a tag no node declares, an error at rest
is a map of facts no refusal declares: it holds the facts it is written
with, a `:kind` entry a fact as any key is and a `:trace` that holds no
frames among them, so `!{:trace 5}` stands as the value it writes, and the
walk of its tags passes `::error`, then the map, so a path reads its facts
and a verb declared once on `::error` reaches it. A label of the reader
takes an error at rest by its own tag, `::error`, so one whose `accepts`
names maps alone refuses it and one that names `#[::map ::error]` holds
it, while the kind of errors and the kind of maps over an error at rest
are that error.

```qlang
> [!{:a 1}] | get /0
!{:a 1}

> ::Oops!{:a 1} | eq ::Oops::error{:a 1}
true

> !{:kind ::Foo} | get [~(tag) /kind]
[::error ::Foo]

> !{:trace 5} | get [~(tag) /trace]
[::error 5]

> :error/twice ~(get /a | mul 2) | ::Oops!{:a 3} | twice
6

> !{:by 3} | tag ::error | eq !{:by 3}
true

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map) | get [~(::map!{:a 1}) ~(::Late!{:by 3} !| get [~(tag) ~(actualTag)])]
[!{:a 1} [::Late/PayloadKindNotTakenError ::error]]

> "x" | add 1 !| get [~(actualTag) ~(get /actualTag !| tag) ~(payload | tag) ~(is ::error)]
[::string ::path/TagClosedError ::error false]

> ::number/add/SubjectNotNumberError!{:actualTag 5} !| tag
::number/add/SubjectNotNumberError/actualTag/KindNotTakenError
```

## raise

Raising is an act, and `raise` alone performs it, a verb of every value:
it puts its subject on the fail track, a map beneath the tags over it, a
map as `::error{…}`, a map under a tag as the error of the outermost tag
and the error at rest of a refusal as the error of its refusal; a subject
that is no map beneath its tags, a value under a tag over another value
among them, is refused as `::any/raise/SubjectKindNotTakenError`. An
error at rest raised again is the error it was.

```qlang
> {:k 1} | raise !| tag
::error

> ::Foo{:a 1} | raise !| tag
::Foo

> "x" | add 1 !| raise !| tag
::number/add/SubjectNotNumberError
```

## catch

A failure lives in the pipe alone: `|` passes it by, and `!|` alone
catches it, its step running on the error at rest, a value from then
on. `!|` passes a value by. A value written after `!|` is the recovery
the catch answers, and the facts of the error are read from it by their
names, of an error under `::error` alone by `get`, the parser refusing there a path, a quote and a literal that holds
either [QSSYN#step], so a quote the recovery answers is computed by a
group, `!| (~(…))`. A pipe written before `!|`, `a | !| b`, stands for the
combinator after it. The error at rest a catch holds is laid under the
tag of its site through the tag's label, none where the site is the kind
of errors itself, and a label that takes no error at rest by its own tag,
`::error`, one whose `accepts` names maps alone among them, or whose
invariant the error at rest breaks, refuses it with a frame at the step
of the catch, the refusal raised to the next catch; a label whose `accepts`
names `#[::map ::error]` holds it. `ok` answers
`true`, so `ok !| false` asks whether the step before stood. A fact is
taken on the way by the payload, `!| payload | union {…} | raise`, which
raises an error of `::error`, and a failure is recovered by its tag in
lines of `!| … | raise`.

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

> !{:a 1} | raise !| payload | tag
::map

> :Box |~~ A parcel. ~~| (::kind | holds :k |~~ k. ~~| ~(tag | eq ::map)) | {:a 1} | tag ::Box | raise !| it !| get [~(tag) ~(actualTag)]
[::Box/k ::Box]

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map) | ::Late{:by 3} | raise !| it !| get [~(tag) ~(actualTag)]
[::Late/PayloadKindNotTakenError ::error]

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| #[::map ::error]) | ::Late{:by 3} | raise !| get [~(tag) /by]
[::Late 3]
```

## trace

A raised error holds the facts of its site and, after them, its trace
under `:trace`, a value of `::trace`, which the kind of every refusal
wires as `trace`, null where it flew no step, so the error at rest of a
refusal answers it by its name, `!| trace`, and one under `::error` alone
by its key, `get /trace`: a frame
for each step that raised it or handed it on, from the step where it
arose to the step where it is read. A frame is a value of `::frame`, the
vector of the subject the step met, the quote of the steps of its level
from the one that failed, and, where the step failed at a part of its
subject, the path of that part; a step the failure skips joins the steps
of the last frame. Its kind wires those parts [QSBLD#value], each read by
its name: `subject` the value its step met, `unfinished` the steps from
the one that failed and `path` the path of the part, or null,
`!| trace | last | path`, and the words `failed` and `skipped` read that
step and the steps after it; no path reads beneath the tag of a frame, so
the part a step failed at is read by the names,
`!| trace | last | subject | get /1`. The core builds a frame by the
wiring the root hands it [QSHST#source].

A step whose answer is a failure its subject was not passes a frame: a
step that fails, `raise`, and a step that answers a failure from inside
it, the call of a verb, a group, a verb running a quote and the one word
of a fold [QSCOL#reduce], while a modifier of a step, a raise written
there among it, and a part of a literal, which is one step, answer within
the frame of that step, and no step the reader did not write joins it.
Where a step failed at a part of its subject is named once, by the path
of its frame, the path of its index, in a set the index in the one order,
or of its key in a map: the part the code of a verb failed on, `map`,
`filter`, `every`, `any` and `reduce` and the keys of `sort`, `min`,
`max`, `groupBy` and `indexBy`; the part whose answer it refused, the
verdict of `filter`, `every` and `any` and the key of `groupBy` and
`indexBy`; the part it refused itself, an element of `sum`, `avg`, `zip`,
`join`, `toPath`, `toMap` and a fold of the algebra, the key of a pair of
`toMap` and a key a fold of `minus` or `inter` reads at its path within
the value; the part a modifier of the step failed at; and the path
`update` wrote. The path and whether a raise resumes its trace are facts
of the call, which the step that receives the failure writes its frame
by, a refusal carrying the path of its part on its throw, the step of
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
`::trace/PayloadKindNotTakenError`, and an element that is no frame as
`::trace/ElementKindNotTakenError` at its index; a frame takes the vector
of its parts by its own tag, a vector under a tag and a set refused as
`::frame/PayloadKindNotTakenError`, a frame of a subject alone as
`::frame/unfinished/NotGivenError`, a third part that is no path as
`::frame/path/KindNotTakenError`, and steps that hold none, a null
written at the third part and a part past it as
`::frame/PayloadNotSubjectAndStepsError`. The kind holds a trace wherever
one is laid: its literal and `tag ::trace`; `raise`, which lays the
`:trace` of the map or the error at rest it raises through the kind's
label; and the kind of a refusal, which holds the `:trace` of its error at
rest to `::trace`, another refused under the refusal as
`…/trace/KindNotTakenError`, while `/trace` reads the key of an error
under `::error` alone and is refused where there is none.

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
> "x" | add 1 !| payload | keys
#[:actualTag :trace]

> [1 "x" 3] | map ~(mul 2) | count !| trace
::trace[
  ::frame["x" ~(mul 2)]
  ::frame[[1 "x" 3] ~(map ~(mul 2) | count) /1]
]

> "x" | add 1 | mul 2 !| trace | first | get [~(subject) ~(unfinished) ~(failed) ~(skipped)]
["x" ~(add 1 | mul 2) ~(add 1) ~(mul 2)]

> [{:name "Ann" :age 30} {:name "Bo" :age "15"}] | filter ~(get /age | gt 18) !| trace | get /1 | subject | get /1
{:name "Bo" :age "15"}

> [1 2 3] | take (count | sub "1") !| trace | map ~failed
[~(sub "1") ~(take (count | sub "1"))]

> {:a 1 :trace []} | raise !| keys
#[:a :trace]

> {:a 1 :trace []} | raise | count !| get /trace
::trace[::frame[{:a 1 :trace []} ~(raise | count)]]

> {:a 1 :trace []} | raise !| :e it | raise !| eq e
true

> !{:a 1} | raise | count !| raise | add 1 !| get /trace | last | skipped
~(count | add 1)

> !{:a 1} | raise | count !| minus #[:trace] | raise | add 1 !| get /trace | last | skipped
~(add 1)

> get [~({:trace 5} | raise !| tag) ~({:trace [5]} | raise !| get [~(tag) ~(index)]) ~({:trace #[::frame[1 ~(a)]]} | raise !| tag) ~(::frame[1] !| tag)]
[::trace/PayloadKindNotTakenError [::trace/ElementKindNotTakenError 0] ::trace/PayloadKindNotTakenError ::frame/unfinished/NotGivenError]

> get [~(::frame::X[1 ~(a)] !| get [~(tag) ~(actualTag)]) ~(::frame#[1 ~(a)] !| get [~(tag) ~(actualTag)])]
[[::frame/PayloadKindNotTakenError ::X] [::frame/PayloadKindNotTakenError ::set]]

> ::number/add/SubjectNotNumberError!{:actualTag ::string} | trace
null

> get [~(::A[::number"x"] !| trace | map ~failed) ~(!{:a 1 :trace ::trace[::frame[1 ~(pre)]]} | eq raise !| get /trace | map ~failed)]
[[~(::A[::number"x"])] [~(pre) ~(eq raise)]]

> ::number/add/SubjectNotNumberError!{:actualTag ::string :trace 5} !| tag
::number/add/SubjectNotNumberError/trace/KindNotTakenError

> get [~([1 "x"] | sum !| trace | first | path) ~([[1 "x"]] | map ~(sum) !| trace | map ~path) ~([1 "x"] | eq sum !| trace | map ~path) ~({:a 1} | filter ~(5) !| trace | last | path)]
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
> get [1 ~("x" | add 1)] !| tag
::number/add/SubjectNotNumberError

> :x (1 | div 0) !| env | has :x
false

> [1 "x" 3] | map ~(add 10 !| 0)
[11 0 13]

> :Pair |~~ Two elements. ~~| (::kind | holds :NotPairError |~~ A pair holds two. ~~| ~(count | eq 2)) | ::Box::Pair[1 2] | take 1 !| tag
::Pair/NotPairError

> [1 2] | map (1 | div 0) !| tag
::vec/map/code/KindNotTakenError

> get [~(#[::number"b" ::string#1] !| tag) ~({:k ::number"x" :k 1} | count)]
[::string/PayloadKindNotTakenError 1]
```

## site

Every site that refuses has a tag of its own, its address: the address
of the site it guards and a last name that says in the language's
words what was refused, `::number/add/SubjectNotNumberError` for the
subject of `add` and `::number/add/addend/KindNotTakenError` for its
input. The last name names the refusal alone, so two sites may share
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
refusal is declared in the source of the site it guards, but for one the
runtime raises by rule: the refusal of the kinds of an input, a field or
a payload is a node the chain lays, with a page of its own where no
`throws` gives one, and any other no `throws` declares reads the record
of its site [QSSLF#axis]. A refusal a rule lays carries the facts of the
family of its rule, a refusal written once on the noun of the rule,
`::fn/KindNotTakenError` for the kinds of an input and of the answer,
`::fn/ElementKindNotTakenError`, `::fn/NotGivenError`,
`::fn/ArgsBeyondInputsError`, `::fn/SubjectRefusedError` for a subject
of another label and one an invariant of the subject refuses, and
`::fn/InvariantNotHeldError`, `::kind/PayloadKindNotTakenError`,
`::kind/ElementKindNotTakenError`, `::kind/KindNotTakenError`,
`::kind/NotGivenError`, `::kind/NotReadError` and
`::kind/InvariantNotHeldError`, and any other the kind its `throws`
writes, the quote of the wires of its own or the tag of a refusal whose
kind it shares, a refusal a primitive raises of a value of none of the
kinds it takes sharing `::fn/KindNotTakenError`, one of an element
`::fn/ElementKindNotTakenError`, one of its subject that carries the kind
of the subject alone `::fn/SubjectRefusedError` and one of an input its
rule does not hold of `::fn/InvariantNotHeldError`, and one a constructor
raises of a payload `::kind/PayloadKindNotTakenError` and of a value or a
part its rule does not hold of `::kind/InvariantNotHeldError`
[QSBLD#kind]; the refusals of the axes of a name share the family
`::any/UnknownNameError`, and refusals of one shape at sibling sites the
kind of one of them; a refusal of its subject wires no value refused,
which the first frame of its trace holds and the runtime drops; a refusal
of a function `apply` runs, under
`::fn/call`, declares none and stays open. The refusal of a primitive takes the address
of the verb that ran it, but for a pair a step relates or combines and
cannot, which the call refuses as `::call/KindsMismatchedError`
[QSDSP#answer], a refusal of the read of a path sits under
`::path`, whichever verb reads it, an arg an input reads and the call
leaves out refused under the input [QSBLD#input], and a refusal
of the language's own steps sits under the record or the kind that holds
the rule, `::call`, `::bind`, `::construct`, `::fail`, `::group`,
`::quote` and `::error`, and links the page of its site [QSQUO#step];
what no query reaches is a defect of the runtime declared at its site
under `::builtin`, the descriptor of a primitive: the table of
primitives, the declarations of refusals and their facts, the root, the
bootstrap and the loaders, and a value of no kind a host handed, whose
addresses and pages a query reads as it reads any name's. The refusal of
an answer past the budget of every host's print,
`::qlang/AnswerBeyondBudgetError`, stands under `::qlang`, the topic
of the language, with its facts `:characters`
and `:budget` before `:actualTag` and `:actualValue`: no step raises it and no `!|`
reaches it, since a host raises it after the last step of the query
[QSPRN#budget]. A failure
inside a primitive a host hands is
`::call/HostFailureError`, with its `:message` and `:causes`, and so is
an answer of such a primitive, or a fact of a refusal it throws, that is
or holds a value of no kind of the language, its `:message` naming the
verb and the path where that value stands [QSHST#door]. A refusal of
the runtime holds its facts in the order the kind of its refusal wires
them, a fact the kind does not wire a defect of the runtime,
`::builtin/RefusalFactNotDeclaredError`, and the trace last: the
value it refuses as `:actualValue`, whatever that value equals, and its
kind as `:actualTag`, but a refusal of the subject its step was served,
which holds the kind of that value alone, the first frame holding the
subject, a host refusing its own so through `refusingTheSubject`
[QSHST#source], and a refusal of a part of the subject holds no index and
no key, the path of its frame naming the part [QSERR#trace]; an error a
reader writes holds its facts as written,
a `:trace` it writes where it stands and the trace its flight begins
last. A fact is a value of the language: a name a step read, a key a path
read and the keyword two values file under are keywords, and an index and
a segment a path read as an index numbers.

```qlang
> "hello" | add 1 !| tag
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(tag) ~(expected) ~(actualTag)]
[::number/add/addend/KindNotTakenError #[::number] ::string]

> 1 | add 1 2 !| payload | entries | map ~first
[:actualTag :arity :actualValue :trace]

> get [~("zz" | toRegex "zz" !| payload | has /actualValue) ~(::W"x" | toNumber !| get [~(payload | keys) ~(actualTag)])]
[true [#[:actualTag :trace] ::string]]

> [1 "x"] | sum !| get [~(payload | keys) ~(trace | first | path)]
[#[:actualTag :actualValue :expected :trace] /1]

> ::fn/KindNotTakenError | manifest
#[::fn/KindNotTakenError/actualTag ::fn/KindNotTakenError/actualValue ::fn/KindNotTakenError/expected ::fn/KindNotTakenError/repair ::fn/KindNotTakenError/trace]

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(::number/plus/by/KindNotTakenError | binding | name) ~(::number/plus/by/NotGivenError | binding | name)]
[:number/plus/by/KindNotTakenError :number/plus/by]

> ::builtin | manifest | filter ~(binding | name | toString | endsWith "Error") | count
12

> ::qlang/AnswerBeyondBudgetError | manifest
#[::qlang/AnswerBeyondBudgetError/actualTag ::qlang/AnswerBeyondBudgetError/actualValue ::qlang/AnswerBeyondBudgetError/budget ::qlang/AnswerBeyondBudgetError/characters ::qlang/AnswerBeyondBudgetError/trace]
```

## print

A failure prints as the error at rest a catch holds, the trace it left
among its facts, and its print read back by `parse | open` and raised
resumes that trace; a query that does not parse flew no step and prints
its facts alone. The answer of a host that is a failure prints as its
alert under the line comment `|~| raised, and no !| caught it`, which a
reading of the literal passes over, and so does the refusal a host
prints instead of an answer past its budget, which was no failure
[QSPRN#budget]; the command line writes the content of the refusal's page
below, and the REPL prints without it. An error at rest an answer gives
prints as the value it is. A host that prints for a person's eye draws below the
refusal of a text of one line that line within an excerpt of three
hundred characters around the point its `:location` names, an ellipsis
where the excerpt cuts it, and a caret under that point as far as the
excerpt reaches, whatever the length of the line; `:location` names the
span in the whole text.

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
prints on, every frame keeping its steps and its path; each elision's
`:read` continues the query beneath `!|`, the record a word's code
failed on standing in the subject of its frame at the path the frame
names, `!| trace | get /1 | subject | get /1`, the facts of a refusal read
by their names and those of an error under `::error` alone by their keys,
and the elision of a subject reading its frame by the name of the part. An alert within the budget
stands as it prints. Past it the failure keeps its tag and the names of its facts:
its trace keeps its first frames within an excerpt of its own, three
hundred characters, and ends with the elision of the rest,
`~(!| trace | drop k)`, and then each fact gives way within the
budget, the trace among them, which gives way whole where the budget
holds not even its first frame. The excerpts of an alert and its cut
tell the rest of a part by the elisions they made, so each `:size`
counts what its `:read` answers. A failure whose alert passes the
budget, the names of its facts kept, prints as the refusal of an answer
past it, its `:actualTag` the tag of the failure and its head the error
at rest, each `:read` there beneath `!|`. The line of the raise and the
caret [QSERR#print] and the content of a page stand beside the budget
[QSPRN#budget].

```sh
$ qlang ':number/inf ~(add 1 | inf) | 0 | inf' < /dev/null | grep -o ':size [0-9]* :read ~(!| trace | drop [0-9]*)'
:size 993 :read ~(!| trace | drop 8)

$ qlang '3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise' < /dev/null | grep -o -E '::qlang/AnswerBeyondBudgetError|:actualTag ::error'
::qlang/AnswerBeyondBudgetError
:actualTag ::error
```

```qlang
> [{:name "Ann" :age 30} {:name "Bo" :age "15"}] | filter ~(get /age | gte 18) !| trace | get /1 | subject | get /1
{:name "Bo" :age "15"}
```
