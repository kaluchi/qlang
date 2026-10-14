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
the fail track, a map as `::error{…}` and a value under a tag as the
error of the tag it shows, the outermost the walk passed. An error
opened by a catch and raised again is the error it was.

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
combinator after it. `ok` answers `true`, so `ok !| false` asks whether
the step before stood.

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
and the steps of its pipeline the error skipped after it. A step whose
answer is a failure its subject was not adds a stop: a step that fails,
`raise`, and a step that answers a failure from inside it, the call of
a word, a group, a word running a quote. `/trail/0` is where the error
arose and `/trail/-1/skipped` replays at the level that reads it. An
error at rest holds the facts it is written with and no `:trail`; one
that writes its `:trail`, empty among them, resumes that path when
raised and adds no stop, and a trail that is no vector is refused as
`::error/TrailNotVecError`. The word `trail` answers the path, `[]` for
an error that holds none.

```qlang
> "x" | add 1 !| keys
#[:actualType :trail]

> {:a 1 :trail []} | raise !| keys
#[:a]

> "x" | add 1 | mul 2 !| get /trail/0/skipped
~(mul 2)
```

## flow

No value holds a failure. A template of `get` whose quote answers one
answers it, the first in the order written; the body of a declaration
that fails binds nothing and answers the failure; a tag over a payload
that fails answers the failure; a modifier that answers a failure
answers the call, whatever the part it fills, and an input of a value
hands an error on unchanged. `map` answers the first failure its code
answers, the elements after it left unrun, and code that recovers
inside keeps every element.

```qlang
> get [1 ~("x" | add 1)] !| type
::number/add/SubjectNotNumberError

> :x (1 | div 0) !| env | has :x
false

> [1 "x" 3] | map ~(add 10 !| 0)
[11 0 13]
```

## site

Every place that refuses has a tag of its own, its address: the address
of the place it guards and a last name that says in the language's
words what was refused, `::number/add/SubjectNotNumberError` for the
subject of `add` and `::number/add/addend/NotNumberError` for its
input. The refusal of a primitive takes the address of the word that
ran it, and a refusal of the language's own steps sits under the kind
of that step, `::path`, `::call`, `::bind`, `::construct`, `::quote` and
`::error`. Its facts are declared under it in the order the catalog
writes them, those every refusal shares, `:actualType`, `:actualValue`,
under `::error`; a name a step read and a key a path read are keywords.

```qlang
> "hello" | add 1 !| type
::number/add/SubjectNotNumberError

> 1 | add 1 2 !| entries | map ~first
[:actualType :places :actualValue :trail]

> ::error | manifest | has ::error/actualType
true
```

## print

A failure prints as its error at rest, the literal `!|` grounds it to,
the path it flew among its facts, so its print under `| raise` is the
failure again. The answer of a host that is a failure prints under the
line comment `|~| raised, and no !| caught it`, which a reading of the
literal passes over.

```qlang
> !{:a 1} | raise !| print | parse | apply it | raise !| keys
#[:a :trail]
```
