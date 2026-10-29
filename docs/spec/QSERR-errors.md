# QSERR · Errors

An error rests as a value and flies as a failure the pipe alone
carries: `raise` raises it, `!|` alone catches it, and its trace holds a
frame for each step that raised it or handed it on. The requirements of
each section are the cases of its file under
`core/test/conformance/QSERR/`.

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
[QSBLD#kind]: of a refusal of a verb the verdict of the verb, which wires
each slot of the verb, the facts its `throws` writes and its `trace`, of a
refusal a kind raises the verdict of the kind, and of any other the kind
its `throws` writes [QSERR#site]. Its facts are read by their names, a
slot by its name and its parts by theirs, `!| addend | found`, no path
reads beneath its tag [QSPTH#get], and
`payload` answers the `::error` beneath it, which holds a fact past the
wiring of the kind; the walk of its tags meets no `::error`, so it is a
value of its refusal alone. The literal of an error of a refusal holds
each fact it holds to the kinds its kind wires, its `:trace` a trace and no
excerpt, and a fact it does not hold reads null by its name. The kind of
errors and the kind of each refusal take the excerpt of the facts a host
prints too, `::X::excerpt{…}` and `::error::excerpt{…}` [QSERR#alert], and
so does every kind that takes an error at rest, a label whose `accepts`
names `#[::map ::error]` among them; the tag of a refusal over
`::error::excerpt{…}` reads its facts beneath `::error`. The facts of an
excerpt are read by their names, or by their keys under `::error`, each
its value, the cell its host keeps it in or nothing, and a view a key no
name wires, read by `payload | get`, while `raise` refuses it as no map of
facts [QSERR#raise].

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

> :error/twice ~(get /a | mul 2); ::Oops!{:a 3} | twice
6

> !{:by 3} | tag ::error | eq !{:by 3}
true

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map); get [~(::map!{:a 1}) ~(::Late!{:by 3} !| get [~(tag) ~(found | tag)])]
[!{:a 1} [::Late/PayloadKindNotTakenError ::error]]

> "x" | add 1 !| get [~(subject | found) ~(get /subject !| tag) ~(payload | tag) ~(is ::error)]
["x" ::path/TagClosedError ::error false]

> ::number/add/SubjectNotNumberError!{:repair 5} !| tag
::number/add/SubjectNotNumberError/RepairKindNotTakenError

> ::number/add/AddendKindNotTakenError!{:trace ::excerpt{:failed []}} !| tag
::number/add/AddendKindNotTakenError/TraceKindNotTakenError

> ::number/add/AddendKindNotTakenError::excerpt{:addend/expected #[::number] :addend/found ::cell"f410f1df625c" :addend/found/tag ::vec :addend/found/count 3410} | get [~(tag) ~(addend | found | tag) ~(addend | expected) ~(payload | get /:addend/found/count)]
[::number/add/AddendKindNotTakenError ::cell #[::number] 3410]

> ::error::excerpt{:rows ::cell"f410f1df625c" :rows/count 5000} | get [~(tag) ~(get /:rows/count)]
[::error 5000]
```

## raise

Raising is an act, and `raise` alone performs it, a verb of every value:
it puts its subject on the fail track, a map beneath the tags over it, a
map as `::error{…}`, a map under a tag as the error of the outermost tag,
laid through the kind of the tag as a catch lays it, and the error at rest
of a refusal as the error of its refusal. A label whose kind takes no
error at rest by its own tag, `::error`, one whose `accepts` names maps
alone among them, or whose invariant the error at rest breaks, refuses the
raise by its door, the frame of the refusal standing at the `raise`, so a
failure a host prints reads back as the literal of its print; a subject
that is no map beneath its tags, a value under a tag over another value
among them, is refused as `::any/raise/SubjectKindNotTakenError`, and so is
the excerpt of the facts of a failure a host prints, `::X::excerpt{…}`,
which tells the failure and holds it not, the subject it found an
`::excerpt` beneath its tag, before any fact is laid under its kind, so the refusal is the step's and no
door of a kind of a fact answers it. An error at rest raised again is the
error it was.

```qlang
> {:k 1} | raise !| tag
::error

> ::Foo{:a 1} | raise !| tag
::Foo

> "x" | add 1 !| raise !| tag
::number/add/SubjectNotNumberError

> ::number/add/SubjectNotNumberError::excerpt{:subject/found #[1] :trace ::cell"093225005142" :trace/failed [~(add 1)]} | raise !| get [~(tag) ~(subject | found | payload | tag)]
[::any/raise/SubjectKindNotTakenError ::excerpt]

> :Box |~~ A parcel. ~~| (::kind | holds :k |~~ k. ~~| ~(tag | eq ::map)); {:a 1} | tag ::Box | raise !| get [~(tag) ~(found | tag) ~(trace | first | failed)]
[::Box/k ::error ~(raise)]

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map); ::Late{:by 3} | raise !| get [~(tag) ~(found | tag)]
[::Late/PayloadKindNotTakenError ::error]

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| #[::map ::error]); ::Late{:by 3} | raise !| print | parse | answer | get [~(tag) ~(get /by)]
[::Late 3]
```

## catch

A failure lives in the pipe alone: `|` passes it by, and `!|` alone
catches it, its step running on the error at rest, a value from then
on, while `coalesce` reads the miss of a read in an alternative as null,
as `query` reads it [QSCND#coalesce]. `!|` passes a value by. A value written after `!|` is the recovery
the catch answers, and the facts of the error are read from it by their
names, of an error under `::error` alone by `get`, the parser refusing there a path, a quote and a literal that holds
either [QSSYN#step], so a quote the recovery answers is computed by a
group, `!| (~(…))`. A pipe written before `!|`, `a | !| b`, stands for the
combinator after it. The error at rest a catch holds is laid under the
tag of its site through the tag's label, as `raise` laid it, none where
the site is the kind of errors itself, so a label whose `accepts` names
`#[::map ::error]` holds it and one that takes no error at rest refused
its raise [QSERR#raise]. `ok` answers
`true`, so `ok !| false` asks whether the step before stood. A fact is
taken on the way by the payload, `!| payload | union {…} | raise`, which
raises an error of `::error`, and a failure is recovered by its tag in
lines of `!| … | raise`. A verb that runs code holds the failure that
code answers as data where its page says so: `settle` the outcome of each
question it asks, `{:ok false :error …}` beside the answers of the others
[QSPTH#template], and `runLaws` the outcome of each law [QSSLF#laws].

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

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| #[::map ::error]); ::Late{:by 3} | raise !| get [~(tag) /by]
[::Late 3]

> get [~({} | coalesce ~(get /missing) 30) ~({} | get /missing !| tag)]
[30 ::path/KeyNotInMapError]

> {:age null} | settle [~(get /age | add 1)] | get /0/error | get [~(tag) ~(subject | found)]
[::number/add/SubjectNotNumberError null]
```

## trace

A raised error holds the facts of its site and its trace under `:trace`,
last where its flight begins it and where the reader wrote it in an error
at rest [QSERR#site], a value of `::trace`, which the kind of every refusal
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
`toMap`, a key a fold of `minus` or `inter` reads at its path within the
value and the second of a pair of two kinds `min` and `max` meet
[QSORD#sort]; the part a modifier of the step failed at; and the path
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
`::frame/UnfinishedNotGivenError`, a third part that is no path as
`::frame/PathKindNotTakenError`, and steps that hold none, a null
written at the third part and a part past it as
`::frame/PayloadNotSubjectAndStepsError`. The kind holds a trace wherever
one is laid: its literal and `tag ::trace`; `raise`, which lays the
`:trace` of the map or the error at rest it raises through the kind's
label; and the kind of a refusal, which lays `::trace` over the vector of
frames its error at rest holds as `:trace`, as `raise` and `tag ::trace`
lay it, and refuses any other value there under the refusal as
`…/TraceKindNotTakenError`, while `/trace` reads the key of an error
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
#[:subject/expected :subject/found :trace]

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

> {:code 404 :trace []} | raise !| with {:caught ~it} ~(raise !| eq caught)
true

> !{:a 1} | raise | count !| raise | add 1 !| get /trace | last | skipped
~(count | add 1)

> !{:a 1} | raise | count !| minus #[:trace] | raise | add 1 !| get /trace | last | skipped
~(add 1)

> get [~({:trace 5} | raise !| tag) ~({:trace [5]} | raise !| get [~(tag) ~(index)]) ~({:trace #[::frame[1 ~(a)]]} | raise !| tag) ~(::frame[1] !| tag)]
[::trace/PayloadKindNotTakenError [::trace/ElementKindNotTakenError 0] ::trace/PayloadKindNotTakenError ::frame/UnfinishedNotGivenError]

> get [~(::frame::X[1 ~(a)] !| get [~(tag) ~(found | tag)]) ~(::frame#[1 ~(a)] !| get [~(tag) ~(found | tag)])]
[[::frame/PayloadKindNotTakenError ::X] [::frame/PayloadKindNotTakenError ::set]]

> ::number/add/SubjectNotNumberError!{:subject/found "x"} | trace
null

> get [~(::A[::number"x"] !| trace | map ~failed) ~(!{:a 1 :trace ::trace[::frame[1 ~(pre)]]} | eq raise !| get /trace | map ~failed)]
[[~(::A[::number"x"])] [~(pre) ~(eq raise)]]

> ::number/add/SubjectNotNumberError!{:subject/found "x" :trace 5} !| tag
::number/add/SubjectNotNumberError/TraceKindNotTakenError

> ::number/add/SubjectNotNumberError!{:subject/found "x" :trace [::frame[1 ~(pre)]]} | trace | tag
::trace

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
running nowhere; the body of a declaration that fails fails its text,
which declares nothing and runs no query, the failure passing every `!|`
of the text to whoever reads it, the host, `parse | answer`, `answer` or
`apply`, which hands it to the `!|` after it, its frame the steps from the
declaration to the end of the text and no subject [QSERR#trace]; a tag
over a payload that fails answers the
failure, and so does a verb whose answer the kind of its subject refuses,
under the tags its walk passed as under none, since no tag is laid over a
failure; a modifier that answers a failure answers the call where its
input takes a value, and is refused under the input where its function
runs it as code, whatever kinds it names [QSQUO#modifier]. A refusal holds
a failure computed at the call as the error at rest it is, so reading it
raises nothing.

```qlang
> get [1 ~("x" | add 1)] !| tag
::number/add/SubjectNotNumberError

> get [~(~(:rate (1 | div 0); rate) | answer !| trace | map ~failed) ~(::host | env | has :rate)]
[[~(div 0) ~(:rate (1 | div 0);) ~(answer)] false]

> [1 "x" 3] | map ~(add 10 !| 0)
[11 0 13]

> :Pair |~~ Two elements. ~~| (::kind | holds :NotPairError |~~ A pair holds two. ~~| ~(count | eq 2)); ::Box::Pair[1 2] | take 1 !| tag
::Pair/NotPairError

> [1 2] | map (1 | div 0) !| tag
::vec/map/CodeKindNotTakenError

> get [~(#[::number"b" ::string#1] !| tag) ~({:k ::number"x" :k 1} | count)]
[::string/PayloadKindNotTakenError 1]
```

## site

Every site that refuses has a tag of its own, its address: the address
of the site it guards and a last name that says in the language's
words what was refused, `::number/add/SubjectNotNumberError` for the
subject of `add` and `::number/add/AddendKindNotTakenError` for its
input. The last name names the refusal alone, so two sites may share
one, `::construct/LiteralComputesError` beside
`::quote/LiteralComputesError`. A refusal of a verb stands one level under
the verb and a refusal of a kind one level under the kind: a refusal of a
slot is named by the slot, its first letter raised, before the rule or the
name the chain declares, `AddendKindNotTakenError`, `CountNotGivenError`,
`DivisorZeroError`, `::Box/WKindNotTakenError`, a value of none of the
kinds a slot takes refused as `KindNotTakenError` or
`ElementKindNotTakenError` after it, an element of the subject as
`ElementKindNotTakenError` under `subject`, as an element of a payload, and
a payload of none of the kinds of a kind as `PayloadKindNotTakenError` or
`ElementKindNotTakenError`; the answer of the code of a slot is refused as
`AnswerKindNotTakenError` after it, `PredicateAnswerKindNotTakenError`,
`ConditionsAnswerKindNotTakenError`, and the key an element files under as
`KeyAnswerKindNotTakenError`, the row of a table as `RowKindNotTakenError`,
the subject of a verb by the label it resides on, `SubjectNotNumberError`,
or by its rule, `::cell/answer/SubjectNotHeldError`, and that of a function
`apply` runs as `SubjectKindNotTakenError`. A last name names a kind after
`Not` there alone and as the kind a conversion of its address reads,
`::string/toNumber/TextNotNumberError` and
`::string/toPath/TextNotPathError`, a container after `NotIn` naming
none, `::path/KeyNotInMapError`, so a name moves only with its word, and
an invariant names the roles of what it holds,
`::point/PayloadNotOffsetLineAndColumnError`. A refusal is declared in the
source of the site it guards, but for one the runtime raises by rule: the
refusal of the kinds of an input, a field or a payload is a node the chain
lays, with a page of its own where no `throws` gives one, and any other no
`throws` declares reads the record of its site, the verb or the kind that
refused [QSSLF#axis].

A refusal of a verb is its verdict [QSBLD#fn], the map of its slots in one
flat list of keys, each a slot and a part of it: its kind wires
`subject`, each input, `surplus` for the args past the inputs and
`answer`, each a value of `::fn/slot` under the address of its role, read
by its name and its parts by theirs, `!| addend | found`, then `repair`,
the facts its `throws` writes and `trace` last. A slot is a value of
`::fn/slot`, which `is ::fn/slot` answers of it as of any value a kind
closes, the axes read it by the record of its role, its input or the role
every verb holds, `::fn/subject`, and a part of a slot of another kind is
refused by the kind of a slot, `::fn/slot/ExpectedKindNotTakenError`. The parts of a slot are `expected`, the kinds the rule
takes, `found`, what the call put in the slot as the call gave it, its
tags with it, `answer`, what the code of the slot answered, and `index`,
the element refused; beneath `found` stand the literal's own names alone,
and no fact retells what the literal tells of itself. The verdict pours
every slot the call filled, whatever raised it, a rule of the chain, a
primitive's throw or a failure the recipe of the verb raises under it, the
slot refused telling its `expected` beside its `found`: a refusal of a
part of the subject lays it under `subject`, the path of its frame naming
the part [QSERR#trace], and a refusal of an element of an input lays its
`index` beside it. A refusal a kind raises at its door, in its
constructor or by a `throws` of its chain is the verdict of the kind, the
parts of a slot but `answer`, the value refused under `found` beside
`expected` and `index`, the facts its `throws` writes beside them, and a
refusal the chain of a function or of a kind lays holds the modifier or
the chain refused under `found` beside its own facts. A refusal that
shares the kind of another by its tag is the verdict of its verb, every
slot poured, the facts that kind wires beside its slots, the refusals of
the axes of a name sharing `::any/UnknownNameError`, `::nope | doc`
holding `subject/found` and `anchor/found` beside `name`, `addresses` and
`nearest` [QSBLD#fn]; a refusal of a function `apply` runs, under
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
of the language, with its facts `:characters`,
`:budget` and `:answer`: no step raises it and no `!|`
reaches it, since a host raises it after the last step of the query
[QSPRN#budget]. A failure
inside a primitive a host hands is
`::call/HostFailureError`, with its `:message` and `:causes`, and so is
an answer of such a primitive, or a fact of a refusal it throws, that is
or holds a value of no kind of the language, its `:message` naming the
verb and the path where that value stands [QSHST#door]. A refusal of
the runtime holds its facts in the order the kind of its refusal wires
them, a fact the kind does not wire a defect of the runtime,
`::builtin/RefusalFactNotDeclaredError`, and the trace last; a refusal of
the read of a path and of a step of the language and a defect of the
runtime hold the value their rule met as `:found`, whatever that value
equals, the subject of the step among them, and no fact retells its kind,
which `found | tag` reads [QSHST#source]; an error a reader writes holds
its facts as written,
a `:trace` it writes where it stands and the trace its flight begins
last. A fact is a value of the language: a name a step read, a key a path
read and the keyword two values file under are keywords, and an index and
a segment a path read as an index numbers.

```qlang
> "hello" | add 1 !| tag
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(tag) ~(addend | expected) ~(addend | found | tag)]
[::number/add/AddendKindNotTakenError #[::number] ::string]

> 1 | add 1 2 !| payload | entries | map ~first
[:subject/found :addend/found :surplus/found :trace]

> get [~("zz" | toRegex "zz" !| flags | found) ~(::W"x" | toNumber !| get [~(payload | keys) ~(subject | found)])]
["zz" [#[:subject/found :trace] ::W"x"]]

> [1 "x"] | sum !| get [~(payload | keys) ~(trace | first | path)]
[#[:subject/expected :subject/found :trace] /1]

> ::number/add/AddendKindNotTakenError | manifest
#[::number/add/AddendKindNotTakenError/addend ::number/add/AddendKindNotTakenError/answer ::number/add/AddendKindNotTakenError/repair ::number/add/AddendKindNotTakenError/subject ::number/add/AddendKindNotTakenError/surplus ::number/add/AddendKindNotTakenError/trace]

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)); get [~(::number/plus/ByKindNotTakenError | binding | name) ~(::number/plus/ByNotGivenError | binding | name)]
[:number/plus/ByKindNotTakenError :number/plus]

> ::builtin | manifest | filter ~(binding | name | toString | endsWith "Error") | count
13

> ::qlang/AnswerBeyondBudgetError | manifest
#[::qlang/AnswerBeyondBudgetError/answer ::qlang/AnswerBeyondBudgetError/budget ::qlang/AnswerBeyondBudgetError/characters ::qlang/AnswerBeyondBudgetError/expected ::qlang/AnswerBeyondBudgetError/found ::qlang/AnswerBeyondBudgetError/index ::qlang/AnswerBeyondBudgetError/trace]

> ::nope | doc !| payload | keys
#[:addresses :anchor/found :name :nearest :subject/found :trace]

> "x" | add 1 !| subject | get [~(is ::fn/slot) ~(doc | eq (::fn/subject | doc)) ~(found)]
[true true "x"]

> ::number/add/SubjectNotNumberError!{:subject/expected 5} !| get [~(tag) ~(found)]
[::fn/slot/ExpectedKindNotTakenError 5]

> get [~([1] | filter ~(1) !| tag) ~([1 "x"] | sum !| tag) ~({} | get /a !| tag)]
[::vec/filter/PredicateAnswerKindNotTakenError ::vec/sum/ElementKindNotTakenError ::path/KeyNotInMapError]
```

## print

A failure prints as the error at rest a catch holds, the trace it left
among its facts, and its print read back by `parse | answer` and raised
resumes that trace; a query that does not parse flew no step and prints
its facts alone. The answer of a host that is a failure prints as its
alert under the line comment `|~| raised, and no !| caught it`, which a
reading of the literal passes over, and so does the refusal a host
prints instead of an answer past its budget, which was no failure
[QSPRN#budget]; the playground writes the content of the refusal's page
below, and its REPL prints without it. An error at rest an answer gives
prints as the value it is. A refusal of a text holds its caret beneath
its line, `:marker` under `:source`, the two printing in one column
within the room of a fact of an alert [QSSYN#refusal], so a host prints it as
any failure.

```qlang
> !{:code 404} | raise !| print | parse | answer | raise !| keys
#[:code :trace]

> "x" | add 1 !| print | parse | answer | raise | count !| trace | map ~(get [~(subject) ~(failed) ~(skipped)])
[["x" ~(add 1) ~(count)]]

> !{:a 1}
!{:a 1}
```

```sh
$ qplay '[01' < /dev/null | sed -n '1,7p'
|~| raised, and no !| caught it
::quote/ParseError!{
  :source "[01"
  :marker " ^~"
  :message "a number is written without a leading zero: write `1`"
  :location ::span[1 1 2 3 1 4]
}

$ qplay '{"a": 1 "b": 2}' < /dev/null | sed -n '3,4p'
  :source "{\"a\": 1 \"b\": 2}"
  :marker "          ^~       "

$ qplay "[1 2 $(printf 'x%.0s' $(seq 1 330))" < /dev/null | grep -c -e '^  :source "…x' -e '^  :marker " *\^"'
2
```

## alert

A host prints a failure nothing caught as its alert, the concentrate of the
failure: its tag and its facts in the order its kind wires them, each fact
whole where its print, as `print` answers it, holds three hundred
characters, the room of a fact, and past them as the cell its host keeps it
in [QSHST#cell], beside its tag, the first of its views, and the views the
kind of the fact reveals whose answers fit that room, flat under the name
of the fact and its own, `:addend/found/tag ::vec` and
`:addend/found/count 3410`, and beside them its parts by the same rule,
each under the name of the fact and its own, so a key is the chain that
reads it [QSPRN#excerpt]; a host that keeps no cell shows the views and
the parts alone. The room of the alert, two thousand characters, goes to
the facts before the parts beneath them, and where the alert passes it the
entries laid deepest and last drop until it fits, a kind wiring first what
a reader needs first. A failure every fact of which
stands whole prints as its error at rest, `::X!{…}`, and one any fact of
which gave way or dropped as the excerpt of its facts under its tag,
`::X::excerpt{…}`, a failure of no refusal `::error::excerpt{…}`, which the
kind of its tag reads back, each fact by its name [QSERR#rest]. The line of
the raise and the page of the refusal stand beside the room. A failure holds
its facts whole as it flies, and `!|` meets it live, a step after the catch
reading each fact as the failure met it. The caret of a refused text is a
fact within the room of a fact [QSSYN#refusal].

```sh
$ qplay '1 | add (3410 | range)' < /dev/null | grep -c -e '^::number/add/AddendKindNotTakenError::excerpt{$' -e '^  :addend/found ::cell"[0-9a-f]\{12\}"$' -e '^  :addend/found/tag ::vec$' -e '^  :addend/found/count 3410$'
4

$ qplay ':number/inf ~(add 1 | inf); 0 | inf' < /dev/null | grep -o -E ':trace ::cell|:trace/subject 999'
:trace ::cell
:trace/subject 999

$ qplay '::host | kinds | add 1' < /dev/null | grep -c -e '^  :trace ::cell"[0-9a-f]\{12\}"$' -e '^  :trace/failed \[~(add 1)\]$'
2

$ qplay 'get {:record ~(get {:a 1 :rows ~(5000 | range)})} | raise' < /dev/null | grep -o -E '^  :record/(a|rows/count) [0-9]+'
  :record/a 1
  :record/rows/count 5000
```

```qlang
> 1 | add (3410 | range) !| get [~(addend | found | count) ~(addend | found | take 3)]
[3410 [0 1 2]]

> get {:rows ~(5000 | range)} | raise !| get /rows | count
5000
```
