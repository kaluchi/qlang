# QSCND · Conditions and conversions

A condition is a boolean, strictly, and a value is read as another kind
of the same content by a verb named `to` and that kind. The requirements
of each section are the cases of its file under
`core/test/conformance/QSCND/`.

## compare

`eq` and `ne` compare any two values, equal where the one order ranks
them alike [QSORD#order]: a keyword is not its string, a vector is not
the set of its elements, and two maps of the same entries are equal
whatever the order of their keys. `gt`, `gte`, `lt` and `lte` reside on
`::any` and compare the subject with the `:value` the call gives, a value
of its kind as `type` answers it, by the one order, so `a | gt b` answers
`true` exactly where `sort` puts `b` before `a`, and `gte` with `lte`
exactly where `eq` does. The order ranks every value, the kinds among
themselves, while a comparison relates two values of one kind: a pair of
two kinds is refused as the pair, `::call/KindsMismatchedError`, its
facts the two kinds, `:leftType` and `:rightType`, a value under a tag
compared with a value of its payload's kind by `payload`, and text that
holds a number with a number by `toNumber`. A comparison takes one value,
two fields of one record compared through a name. Null is tested with
`eq null`.

```qlang
> [1 2 3] | eq [1 2 3]
true

> 1 | ne 2
true

> [null 1] | filter ~(eq null)
[null]

> get [~(5 | gt "a" !| type) ~(true | gt false !| type)]
[::call/KindsMismatchedError true]

> get [~([1 "a"] | max !| type) ~([1 "a"] | sort) ~("a" | gt 1 !| type) ~(::Cents#100 | gt ::Dollars#50 !| get [/leftType /rightType])]
[::call/KindsMismatchedError [1 "a"] ::call/KindsMismatchedError [::Cents ::Dollars]]

> get [~(#"a"i | eq #"a"i) ~(#"a"i | eq #"a") ~(/a/0 | eq /a/0) ~(1 | desc | eq (1 | desc)) ~({:b [1] :a #[2]} | eq {:a #[2] :b [1]}) ~(~(add 1) | eq ~(add 1))]
[true false true true true true]
```

## boolean

A condition answers a boolean, `true` or `false`, read beneath the tags
over it, the condition of an invariant and of a law among them
[QSDSP#walk], or is refused under the verb that runs it or the input
that takes it. `not` takes a boolean
subject, and `and` and `or` join a boolean subject with the
`:condition` the call gives, a value computed at the call and checked
whatever the subject decides, a subject of another kind refused under
the verb, `::boolean/and/SubjectNotBooleanError`, and a condition under
the input. `allOf` and `anyOf` take conditions, one at least,
`::any/allOf/conditions/EmptyError` refusing none: each a boolean
computed at the call, or a quote or a path that answers one in its turn,
run once every condition before it held for `allOf` and once none did
for `anyOf`, the first that decides answering with the quotes after it
unrun. A quote that answers another kind is refused at its index,
`::any/allOf/ConditionNotBooleanError`, a quote that answers a failure
hands it on as the answer, a condition of another kind than a boolean, a
path or a quote is refused as `ElementKindNotTakenError` at the first
such index, and an error computed at the call at its own, the conditions
computed in their order before their kinds are read [QSQUO#modifier].

```qlang
> 5 | if 1 ~(1) ~(2) !| type
::any/if/condition/KindNotTakenError

> true | and 1 !| type
::boolean/and/condition/KindNotTakenError

> {:email null} | allOf (get /email | ne null) ~(get /email | endsWith ".org")
false

> 5 | allOf ~(1) !| get [~(type) /index]
[::any/allOf/ConditionNotBooleanError 0]

> 5 | allOf ~(true | tag ::Ok)
true
```

## branch

`if` takes its `:condition` as a value, computed at the call, and its
two branches, `:then` and `:else`, as quotes or paths, running one of
them on the subject; an identity branch, `~()`, leaves the subject. A
condition or a branch the call leaves out is refused,
`::any/if/else/NotGivenError`, and a branch of another kind,
`::any/if/then/KindNotTakenError`. `cond` takes its clauses as quotes or
paths, pairs of a predicate and a branch run in order, an odd last
clause the default, null where none matches and no default stands: a
predicate that answers no boolean is refused as
`::any/cond/ConditionNotBooleanError` at its index from zero, one that
answers a failure hands it on, a clause of another kind is refused as
`::any/cond/clauses/ElementKindNotTakenError`, and a call with no pair as
`::any/cond/clauses/NoBranchesError`.

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
true over an empty container. They reside on vectors and on maps, a set
reaching those of vectors [QSDSP#residence], and over a map they read
its values. A predicate that answers no boolean is refused as
`::vec/every/ConditionNotBooleanError` at its index, at its key over a
map, the place of the step's frame naming it [QSERR#trace], and a
predicate that answers a failure hands it on as the answer.

```qlang
> [] | every ~(gt 0)
true

> {:a -1 :b 2} | any ~(gt 0)
true

> get [~(#[true 1] | every ~(it) !| type) ~(42 | any ~(gt 0) !| get /addresses)]
[::vec/every/ConditionNotBooleanError #[::map/any ::vec/any]]

> {:a true :b 1} | every ~(it) !| get [~(type) ~(trace | last | place)]
[::map/every/ConditionNotBooleanError /b]
```

## coalesce

`coalesce` answers the first of its alternatives that answers a value,
one at least, `::any/coalesce/alternatives/EmptyError` refusing none.
Each alternative stands in its place: code, a quote or a path, runs
against the subject, and a value answers itself; the subject stands
before the alternative where the call gives one and it is a value, so
`query /timeout | coalesce 30` reads the timeout, else 30, while several
values alone, which leave the place of the subject open, are refused,
`::any/coalesce/alternatives/ValuesAloneError`, the subject first written
by a quote, `coalesce ~(it) e 8080`, and a field by a path,
`coalesce /t 30`. An alternative passes to the next where it answers
null, beneath the tags over it, or the refusal of a read `query` answers
null for, a key a map
lacks, an index past an end or null on the way [QSPTH#query], met on its
own way and not in the code a verb ran on a part of it, whose frame
names the place of the part [QSERR#trace]; code that answers any other
failure answers the call with it, and so does a value computed at the
call that is a failure [QSQUO#modifier]. Null answers where every
alternative passes, and code after the alternative that answers stays
unrun.

```qlang
> {} | coalesce /missing ~("fallback")
"fallback"

> [{:t 45} {:t null}] | map ~(query /t | coalesce 30)
[45 30]

> get [~({:t null} | coalesce (get /t) 30 !| type) ~(9000 | coalesce ~(it) 7000 8080) ~({:t null} | coalesce /t 30)]
[::any/coalesce/alternatives/ValuesAloneError 9000 30]

> {:items [{:price 1} {:cost 2}]} | get [~(coalesce ~(get /items | map /price | sum) 0 !| type) ~(coalesce ~(get /items | first | get /cost) 0)]
[::path/KeyNotInMapError 0]

> get [~({:a null} | coalesce /a/b 0) ~({} | coalesce ~(nosuchword) 30 !| type) ~({:a ::T#null} | coalesce /a 0)]
[0 ::call/UnknownNameError 0]
```

## convert

A value is read as another kind by a verb of its own kind named `to` and
the kind it answers, a kind answering its own verb with itself under the
tags it came with, `::set/toSet` and `::map/toMap` among them. `toString`
writes the text a value stands for: a number as JSON writes it, a
keyword and a tag name by their names, a boolean and null by their
literals, and a quote by its code [QSQUO#parse]; a regex has no string,
its text being its literal. `toNumber` reads a string whose whole text is
a number's literal, and a keyword whose name is one; `toKeyword` answers
the keyword `groupBy`, `indexBy` and `toMap` file a value under, a
keyword as it is, a string or a number the keyword of its text, a boolean
or null that of its literal and a tag name that of its name; `toTag`
reads a string or a keyword that names a tag; the two refuse a subject
whose text writes no number or no name of a tag by the part of the
subject and the kind it does not become, `toNumber` as
`::keyword/toNumber/NameNotNumberError` and
`::string/toNumber/TextNotNumberError`, `toTag` as
`::keyword/toTag/NameNotTagError` and `::string/toTag/TextNotTagError`.
`toSet`
answers the elements of a vector in the one order without duplicates, as
the constructor of `::set` builds them, `distinct` answering as it does,
while a set beneath a tag, which that constructor refuses, answers
itself under the tag; `toVec` answers the elements of a set in its order;
`toMap` reads pairs, the last pair of a key holding, an element that is no
pair refused at its index and a key of another kind as
`::vec/toMap/KeyKindNotTakenError` at the key of its pair, its `:expected`
the kinds a key files under, the place of the step's frame naming each
[QSERR#trace]. A number, a keyword, a string or
a tag turned into a wider kind and back is itself, and so is a quote
turned into text and read back by `parse`, while a boolean and null turn
into text and a keyword one way. A container's texts are `print` and
`json`, the `:nearest` of `toString` over a vector, a set and a map
`[:json :print]`, the text of a doc is its `content`, and a map's parts
are read by `entries`, `keys` and `vals`.
`desc`, a verb of any value whose recipe is the one step `tag ::desc`,
puts a value under `::desc`, so `::Box#5 | desc` answers `::desc::Box#5`
[QSORD#desc].

```qlang
> "42" | toNumber
42

> ["4x" ""] | map ~(toNumber !| type)
[::string/toNumber/TextNotNumberError ::string/toNumber/TextNotNumberError]

> [42 :a ::vec true null ~(add 1 | mul 2)] | map ~toString
["42" "a" "vec" "true" "null" "add 1 | mul 2"]

> get [~(:"a b" | toTag !| type) ~("a b" | toTag !| type) ~(#"a" | toString !| type)]
[::keyword/toTag/NameNotTagError ::string/toTag/TextNotTagError ::call/KindAnswersNoVerbError]

> get [~(::Box#[2 1] | toSet) ~(::Box#[2 1] | tag ::set !| type) ~([2 1 2] | distinct) ~(::W#5 | toNumber)]
[::Box#[1 2] ::set/PayloadKindNotTakenError #[1 2] ::W#5]

> [[:a 1] [:a 2]] | toMap
{:a 2}

> [[[1] 2]] | toMap !| get [~(type) ~(trace | last | place) /expected]
[::vec/toMap/KeyKindNotTakenError /0/0 #[::boolean ::keyword ::null ::number ::string ::tag]]

> [1] | toKeyword !| type
::call/KindAnswersNoVerbError

> get [~(::Box#5 | desc) ~(::any/desc | binding | get /value | get /1)]
[::desc::Box#5 ~(tag ::desc)]
```
