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
and `::Foo!{…}` is `::Foo::error{…}`, the facts laid under the tag
written before the bang through its label, a refusal of the label
answering for the literal. A `:kind` entry is a fact as any key is. The
walk of an error passes the tag of its site, then `::error`, then the
map, so a word declared once on `::error` reaches every error and a path
reads the facts beneath the tags.

```qlang
> [!{:a 1}] | get /0
!{:a 1}

> ::Oops!{:a 1} | eq ::Oops::error{:a 1}
true

> !{:kind ::Foo} | get [~(type) /kind]
[::error ::Foo]
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
stop at the step of the catch. `ok` answers `true`, so `ok !| false`
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
flew under `:trail`: a vector of stops from the step where it arose to
the step where it is read, each stop `{:step :subject :skipped}`, the
step that raised the error or handed it on, the subject that step had,
and the steps of its pipeline the error skipped after it, printed
without the pipe of their head. A step whose answer is a failure its
subject was not adds a stop: a step that fails, `raise`, and a step that
answers a failure from inside it, the call of a word, a group, a word
running a quote. `/trail/0` is where the error arose and
`/trail/-1/skipped` the steps skipped at the level that reads it, which
`apply` runs again as held code [QSQUO#held]. An error at rest holds the
facts it is written with; one that writes its `:trail`, empty among
them, resumes that path when raised and adds no stop, and a trail other
than a plain vector of maps, each holding a quote under `:skipped`, is
refused as `::error/TrailNotVecError`. The word `trail` answers the path,
`[]` for an error that holds none, and refuses a subject that is no
error as `::error/trail/SubjectNotErrorError`, while `/trail` reads the
key and is refused where there is none.

```qlang
> "x" | add 1 !| keys
#[:actualType :trail]

> {:a 1 :trail []} | raise !| keys
#[:a]

> "x" | add 1 | mul 2 !| get /trail/0/skipped
~(mul 2)
```

## flow

A failure stands in the pipe alone. Code a word runs that answers a
failure answers the word, the elements after it left unrun: `map`,
`filter`, `every`, `any`, `reduce`, the branches of `if`, and the keys of
`sort`, `groupBy` and `indexBy`, while code that recovers inside keeps
every element. A literal whose part fails answers that failure, and so
does a template of `get` whose quote answers one, the first in the order
written; the body of a declaration that fails leaves the scope as it
was and answers the failure; a tag over a payload that fails answers the
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
`ElementKindNotTakenError`, the answer of a word and the subject of a
function `apply` runs among them, `SubjectKindNotTakenError`, its kinds
the fact `:expected`, so a kind that joins a holder changes no tag; the
subject of a word is refused by the label it resides on,
`SubjectNotNumberError`. The refusal of an input's value lives under the
input, whether an invariant or a primitive raises it, and what a run
answers under the word. A refusal is declared in the source of the place
it guards, and a refusal the catalog declares links the page of its
place. The refusal of a primitive takes the address of the word that
ran it, and a refusal of the language's own steps sits under the kind of
that step, `::path`, `::call`, `::bind`, `::construct`, `::quote` and
`::error`; what no query reaches, the table of primitives or a node the
evaluator does not know, is an invariant of the implementation under
`::builtin`, and a failure of a host's implementation is
`::call/HostFailureError`, with its `:message` and `:causes`. A refusal
of the runtime holds its facts in the order the catalog declares them,
the label's own first, the facts `::error` declares after them,
`:expected`, `:actualType` and `:actualValue` among them, `:actualValue`
left out of a refusal of the subject, which the first stop holds, and
the trail last; an error a reader writes holds its facts as written, a
`:trail` it writes where it stands and the trail its flight begins
last. A fact is a value of the language: a name a step read and a key a
path read are keywords, an index a number, an entry of a map named by
its `:key`.

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add "x" !| get [~(type) /expected /actualType]
[::number/add/addend/KindNotTakenError #[::number] ::string]

> 1 | add 1 2 !| entries | map ~first
[:actualType :places :actualValue :trail]

> ::error | manifest | has ::error/actualType
true
```

## print

A failure prints as its error at rest with the path it flew among its
facts, `:trail []` for one that flew no step, a query that does not
parse among them, so its print under `| raise` is the failure again;
the error at rest `!|` grounds it to holds no empty `:trail`. The answer of a host that is a failure prints under
the line comment `|~| raised, and no !| caught it`, which a reading of
the literal passes over, and an error at rest an answer gives prints as
the value it is.

```qlang
> !{:a 1} | raise !| print | parse | apply it | raise !| keys
#[:a :trail]

> !{:a 1}
!{:a 1}
```
