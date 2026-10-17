# QSERR · Errors

An error rests as a value and flies as a failure the pipe alone
carries: `raise` raises it, `!|` alone catches it, and its trail is the
path it flew. The requirements of each section are the cases of its
file under `core/test/conformance/QSERR/`.

## rest

At rest an error is a value like any other, a map of facts under
`::error`, the kind of errors, under the tag of the site that refused:
a container holds it, a step reads it, `print` writes it, and its print
reads back as itself. `!{…}` is its literal, the literal of `::error`,
whose payload is the map of the facts, a payload of another kind refused
as `::error/PayloadKindNotTakenError`, and `::Foo!{…}` is
`::Foo::error{…}`, the facts laid under the tag written before the bang
through its label, a refusal of the label answering for the literal. A
`:kind` entry is a fact as any key is. The
walk of an error passes the tag of its site and `::tagged`, then
`::error`, then the map, so a verb declared once on `::error` reaches
every error and a path reads the facts beneath the tags.

```qlang
> [!{:a 1}] | get /0
!{:a 1}

> ::Oops!{:a 1} | eq ::Oops::error{:a 1}
true

> !{:kind ::Foo} | get [~(type) /kind]
[::error ::Foo]

> :error/twice ~(get /a | mul 2) | ::Oops!{:a 3} | twice
6
```

## raise

Raising is an act, and `raise` alone performs it: it puts its subject on
the fail track, a map as `::error{…}` and a map under a tag as the error
of the outermost tag; a subject that is no map, a value under a tag over
another value among them, is refused as `::map/raise/SubjectNotMapError`.
An error opened by a catch and raised again is the error it was.

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
the catch answers. A pipe written before `!|`, `a | !| b`, stands for the
combinator after it. `!|` opens an error under its tag through the
tag's label, and a label whose payload takes no facts refuses it with a
frame at the step of the catch. `ok` answers `true`, so `ok !| false`
asks whether the step before stood. A fact is taken on the way and a
failure recovered by its type in lines of `!| … | raise`.

```qlang
> "x" | add 1 !| 0
0

> 42 !| get /kind
42

> [1 "x"] | map ~(mul 2) | !| 0
0

> 5 | ok !| false
true
```

## trail

A raised error holds the facts of its site and, after them, the path it
flew under `:trail`, a value of `::trail`: a frame for each step that
raised it or handed it on, from the step where it arose to the step
where it is read. A frame is a value of `::frame`, the vector of the
subject the step met, the quote of the steps of its level from the one
that broke, the first broken and the rest left unrun, and, where the
step ran its code on a part of its subject, the path of that part; a step
the failure skips joins the steps of the last frame. A step whose answer
is a failure its subject was not passes a frame: a step that fails,
`raise`, and a step that answers a failure from inside it, the call of a
verb, a group, a verb running a quote, while a modifier of a step answers
within the frame of that step. A verb that runs its code on the elements
of its subject, `map`, `filter`, `every`, `any` and `reduce`, and the keys
of `sort`, `min`, `max`, `groupBy` and `indexBy`, names the place of the
element its code broke on, its index or its key, and `update` the path it
wrote; a step that ran no code on a part names none. `subject`, `step`,
`skipped` and `place`, verbs of `::frame`, read a frame, and a path reads
it as the vector it is, `/0` its subject, so the part a verb's code broke
on is one read away; the steps skipped at the level that reads the
failure, `trail | last | skipped`, run again by `apply` as held code runs
[QSQUO#held]. An error at rest holds the facts it is written with; one
that writes a `:trail` that holds a frame resumes that path when raised
and passes no frame, the steps the failure skips after it joining the
last frame of that path, and an empty `:trail` is no path, as an error holds
none, so its raise starts the path at its own frame, the steps the
failure skips after it joining that frame, as the raise of a map that
writes no `:trail` does: every failure a step answers holds its path from
its first frame, and an error a catch opened, raised again, is the error
it was, and raised without its `:trail` starts the path over at that
raise. The `:trail` an error is made with is a vector of frames, plain,
which the error lays under `::trail`, or one under `::trail` already,
and any other value is refused as `::error/TrailNotFramesError`; a frame
of a subject alone, or whose place is no path, is refused as
`::frame/PayloadNotSubjectAndStepsError`, and a trail that holds a value
that is no frame as `::trail/ElementKindNotTakenError` at its index. The
verb `trail` answers the path, `::trail[]` for an error that holds none,
refuses a subject that is no error as `::error/trail/SubjectNotErrorError`
and an error whose `:trail` is no path, which its literal may write, by
its answer, `::error/trail/answer/KindNotTakenError` [QSBLD#answer], while
`/trail` reads the key and is refused where there is none.

```qlang
> "x" | add 1 !| keys
#[:actualType :trail]

> [1 "x" 3] | map ~(mul 2) | count !| trail
::trail[
  ::frame["x" ~(mul 2)]
  ::frame[[1 "x" 3] ~(map ~(mul 2) | count) /1]
]

> [{:name "Ann" :age 30} {:name "Bo" :age "15"}] | filter ~(get /age | gt 18) !| get /trail/1/0/1
{:name "Bo" :age "15"}

> [1 2 3] | take (count | sub "1") !| trail | map ~step
[~(sub "1") ~(take (count | sub "1"))]

> {:a 1 :trail []} | raise !| keys
#[:a :trail]

> {:a 1 :trail []} | raise | count !| trail
::trail[::frame[{:a 1 :trail []} ~(raise | count)]]

> {:a 1 :trail []} | raise !| :e it | raise !| eq e
true

> !{:a 1} | raise | count !| raise | add 1 !| trail | last | skipped
~(count | add 1)

> !{:a 1} | raise | count !| minus #[:trail] | raise | add 1 !| trail | last | skipped
~(add 1)

> "x" | add 1 | mul 2 !| trail | last | skipped
~(mul 2)

> {:trail [{:step ~(pre) :subject 1 :skipped ~()}]} | raise !| type
::error/TrailNotFramesError

> ::error{:a 1} | trail
::trail[]

> !{:a 1 :trail 5} | trail !| type
::error/trail/answer/KindNotTakenError
```

## flow

A failure stands in the pipe alone. Code a verb runs that answers a
failure answers the verb, the elements after it left unrun: `map`,
`filter`, `every`, `any`, `reduce`, the branches of `if`, and the keys of
`sort`, `groupBy` and `indexBy`, while code that recovers inside keeps
every element. A literal whose part fails answers that failure, and so
does a template of `get` whose quote answers one, the first in the order
written; the body of a declaration that fails leaves the scope as it
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
```

## site

Every place that refuses has a tag of its own, its address: the address
of the place it guards and a last name that says in the language's
words what was refused, `::number/add/SubjectNotNumberError` for the
subject of `add` and `::number/add/addend/KindNotTakenError` for its
input. The last name names the refusal alone, so two places may share
one, `::call/ReadBackDiffersError` beside `::quote/ReadBackDiffersError`.
A value of none of the kinds a holder takes is refused by the holder's
role, `KindNotTakenError`, `PayloadKindNotTakenError` or
`ElementKindNotTakenError`, the answer of a verb, the subject of a
function `apply` runs, `SubjectKindNotTakenError`, and the key an element
files under, `KeyKindNotTakenError`, among them, its kinds the fact
`:expected`; the subject of a verb is refused by the label it resides on,
`SubjectNotNumberError`. The refusal of an input's value lives under the
input, whether an invariant or a primitive raises it, and what a run
answers under the verb. A refusal is declared in the source of the place
it guards, but for one the runtime raises by rule: the refusal of the
kinds of an input, a field or a payload is a node the chain lays, with a
page of its own where no `throws` gives one, and any other no `throws`
declares reads the record of its place [QSSLF#axis]. The refusal of a
primitive takes the address of the verb that ran it, a refusal of the
read of a path sits under `::path`, whichever verb reads it, a place of
the args an input reads and the call leaves out refused under the input
[QSBLD#input], and a refusal of the language's own steps sits under the
kind of that step, `::call`, `::bind`, `::construct`, `::quote` and
`::error`, and links the page of its place; what no query reaches, the
table of primitives or a node of the parser's tree the evaluator does
not know, is a defect of the runtime under `::builtin`, and a
failure of a host's implementation is `::call/HostFailureError`, with
its `:message` and `:causes`. A refusal of the runtime holds its facts
in the order the catalog declares them, the label's own first, the facts
`::error` declares after them, `:expected`, `:actualType` and
`:actualValue` among them, `:actualValue` left out where it equals the
subject the first frame holds, whatever its identity, and the trail
last; an error a reader writes holds its facts as written, a `:trail` it
writes where it stands and the trail its flight begins last. A fact is a
value of the language: a name a step read and a key a path read are
keywords, an index a number, an entry of a map named by its `:key`.

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(type) /expected /actualType]
[::number/add/addend/KindNotTakenError #[::number] ::string]

> 1 | add 1 2 !| entries | map ~first
[:actualType :places :actualValue :trail]

> ::error | manifest | has ::error/actualType
true

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(::number/plus/by/KindNotTakenError | binding | get /name) ~(::number/plus/by/NotGivenError | binding | get /name)]
[:number/plus/by/KindNotTakenError :number/plus/by]
```

## print

A failure prints as the error at rest `!|` opens it to, the path it flew
among its facts; the refusal of a text that does not parse, which flew no
step, prints its facts alone, and its print raised starts its path at
that raise. The answer of a host that is a failure prints under
the line comment `|~| raised, and no !| caught it`, which a reading of
the literal passes over, and an error at rest an answer gives prints as
the value it is.

```qlang
> !{:a 1} | raise !| print | parse | apply it | raise !| keys
#[:a :trail]

> !{:a 1}
!{:a 1}
```

```sh
$ qlang '[01' < /dev/null | sed -n '1,7p'
|~| raised, and no !| caught it
::quote/ParseError!{
  :source "[01"
  :marker " ^~"
  :message "a number is written without a leading zero: write `1`"
  :location ::span[1 1 2 3 1 4]
}
```
