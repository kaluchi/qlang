# QSCND · Conditions and conversions

A condition is a boolean, strictly, and a value turns into another kind
only by a word named for the kind it turns into. The requirements of
each section are the cases of its file under
`core/test/conformance/QSCND/`.

## compare

`eq` and `ne` compare any two values by their structure; `gt`, `gte`,
`lt` and `lte` compare two values of one kind, the kind each resides on,
by the one order [QSORD#order]. Null is tested with `eq null`.

```qlang
> [1 2 3] | eq [1 2 3]
true

> 1 | ne 2
true

> [null 1] | filter ~(eq null)
[null]
```

## boolean

A condition answers a boolean or is refused under the word that runs it
or the input that takes it: no value is true or false by itself. `not`,
`and` and `or` take booleans. `allOf` and `anyOf` take conditions, each
a boolean computed at the call, or a quote or a path that answers one in
its turn, run once every condition before it held for `allOf` and once
none did for `anyOf`, the first that decides answering with the quotes
after it unrun.

```qlang
> 5 | if 1 ~(1) ~(2) !| type
::any/if/condition/NotBooleanError

> true | and 1 !| type
::boolean/and/right/NotBooleanError

> {:email null} | allOf (get /email | ne null) ~(get /email | endsWith ".org")
false
```

## branch

`if` takes its condition as a value, computed at the call, and its two
branches as quotes, running one of them on the subject; an identity
branch, `~()`, leaves the subject. `cond` takes its clauses as quotes,
pairs of a predicate and a branch run in order, an odd last clause the
default, null where none matches and no default stands; a call with no
pair is refused.

```qlang
> 75 | if (gte 60) ~("pass") ~("fail")
"pass"

> -5 | if (gt 0) ~(add 100) ~()
-5

> 5 | cond ~(gt 10) ~("big") ~(gt 3) ~("mid") ~("small")
"mid"
```

## quantify

`any` answers whether one element meets a predicate and `every` whether
all do, each stopping at the first that decides: `any` false and `every`
true over an empty container. Over a map they read its values; a
predicate that answers no boolean is refused at its index.

```qlang
> [] | every ~(gt 0)
true

> {:a -1 :b 2} | any ~(gt 0)
true
```

## coalesce

`coalesce` answers the first alternative that is not null. An
alternative is code, a quote or a path, which runs against the subject,
or a value, which answers itself; a call whose alternatives are all
values puts the subject first, so `query /timeout | coalesce 30` reads
the timeout, else 30. A failing alternative after the one that answers
is never run.

```qlang
> {} | coalesce /missing ~("fallback")
"fallback"

> [{:t 45} {:t null}] | map ~(query /t | coalesce 30)
[45 30]
```

## convert

A value turns into another kind by a word of its own kind named `to`
and the kind it answers: `toString`, `toNumber`, `toKeyword`, `toTag`,
`toVec`, `toSet` and `toMap`, a kind answering its own word as itself.
`toNumber` reads a string whose whole text is a number's literal;
`toKeyword` files a value as `groupBy` files a key; `toMap` reads pairs,
the last pair of a key holding. A value turned into a wider kind and
back is itself. Nothing converts where no such word is written: a
container has no `toString`, its texts being `print` and `json`.

```qlang
> "42" | toNumber
42

> ["4x" ""] | map ~(toNumber !| type)
[::string/toNumber/TextNotNumberError ::string/toNumber/TextNotNumberError]

> [42 :a ::vec true] | map ~toString
["42" "a" "vec" "true"]

> [[:a 1] [:a 2]] | toMap
{:a 2}

> [1] | toKeyword !| type
::call/KindAnswersNoVerbError
```
