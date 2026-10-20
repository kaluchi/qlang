# QSCOL · Vectors, maps and sets

The verbs of the containers: what each answers over a vector, a set and
a map, the code they run on each element, and the algebra of sets and
maps. The requirements of each section are the cases of its file under
`core/test/conformance/QSCOL/`.

## sequence

A vector and a set answer `count`, and `size` and `length` as it does,
`empty`, `first` and `last`, `take` and `drop` a count of elements,
clamped to what there is, a count whole where it equals its floor, a
fraction refused as `::vec/take/count/NotIntegerError` and a value of
another kind as `…/count/KindNotTakenError`, `reverse`, the reverse of a
set a vector and of a vector under a tag the vector under that tag,
`flat`, which lifts one level, and `flatten` as it does, `concat`, the
vectors the call gives joined after the subject under its tags, a value
given that is no vector refused as
`::vec/concat/vectors/ElementKindNotTakenError`, so `reduce [] ~(concat)`
joins the vectors a vector holds, `sum`, a number beneath the tags over
an element read as the number and an element that is no number refused
at its index, at its key over a map, and `min` and `max` in the one
order or by a key [QSORD#sort]; `first`, `last`, `min`, `max` and `avg`
answer null over an empty container. `avg` answers the mean, null over
nothing, kept as a running mean, a number beneath its tags read as `sum`
reads it, an element that is no number refused at its index, at its key
over a map. `has` asks whether the vector or the set holds an element
equal to one [QSPTH#has]. `append` and `prepend` put one element at an
end, a vector given among them, and a set takes it into its order. `zip`
reads vectors side by side, as long as the shortest, an element that is
no vector refused at its index. A set answers these by the verbs of
vectors but `reverse`, its own [QSDSP#residence], and the answer of a
verb keeps or leaves the tags of its subject as its kind says
[QSDSP#answer].

```qlang
> [1 2 3] | take -1
[]

> [1] | append [2 3]
[1 [2 3]]

> #[1 2] | append 3
#[1 2 3]

> [[1 2 3] [:a :b]] | zip
[[1 :a] [2 :b]]

> get [~([1] | concat [2 3] [4]) ~([[1] [2 3]] | reduce [] ~(concat)) ~([[1 2] [3 [4]]] | flatten) ~(#[1 2] | size)]
[[1 2 3 4] [1 2 3] [1 2 3 [4]] 2]

> [1 2 3 4] | avg
2.5

> [::W#2 1] | sum
3

> [] | min
null
```

## map

A map is a record and a dictionary at once. Its elements are its
values, and its keys travel with them: `map`,
`filter`, `sort`, `take`, `drop` and `reverse` act on the values and
keep the keys, `first`, `last`, `sum`, `avg`, `min`, `max`, `reduce`,
`every` and `any` read the values, a predicate sees the value alone, and
`count`, `size` and `length` count its entries. `keys` answers the set of
its keys, `vals` the vector of its values, `entries` the vector of its
pairs `[key value]` in the order of its entries, the step that makes a
key data, and `has` whether a key stands [QSPTH#has]. The verbs a vector
has beyond these, `distinct`, `groupBy`, `flat` and `contains` among
them, a map does not answer, and a reader asks them of its values by
`vals` first, `{:a 1} | vals | contains 1` answering `true`.

```qlang
> {:b 2 :a 1} | map ~(add 1)
{:b 3 :a 2}

> {:a 3 :b 1} | sort | take 1
{:b 1}

> {:a 1 :b 2} | entries
[[:a 1] [:b 2]]
```

## image

`map` runs its code, a quote or a path, on each element in order: over
a vector it answers a plain vector of what each answered; over a map a
plain map of the answers under the same keys; over a set, which the
`map` of vectors serves, the vector of the images in the one order, its
answer naming `::any` [QSDSP#answer]. The first error its code answers
is the answer of the call. A value computed at the call in place of the
code is refused with the repair.

```qlang
> #[1 2 3] | map ~(mod 2)
[1 0 1]

> ::Box[1 2] | map ~(add 1)
[2 3]

> [1 2] | map (add 1) !| type
::vec/map/code/KindNotTakenError
```

## filter

`filter` keeps the elements its predicate, a quote or a path, answers
`true` for, in their order, a map keeping its keys and a set its kind;
a predicate that answers no boolean is refused at its index, a map's at
its key, and one that answers a failure hands it on.

```qlang
> {:c 3 :a 1 :b 2} | filter ~(gt 1)
{:c 3 :b 2}
```

## reduce

`reduce` folds a vector, a set or a map's values from a seed by code of
any form, the seed first and the code after it, a call with one arg
refused as `::vec/reduce/reducer/NotGivenError` and code computed at the
call as `::vec/reduce/reducer/KindNotTakenError`. The fold reads the
steps of its code: a quote of one step that is a call with no modifiers,
by the name of a verb or its address, `~(add)` or `~(number/add)`,
written or assembled from data alike, is the short form, which calls the
verb as the pipe calls it, the value so far its subject and the element
its first arg, in the scope of the step that wrote the quote, a value
that scope binds under the name of the verb meeting it as a step does.
Any other code runs on the pair of the value so far and the element, a
path, a call with modifiers, a quote of more steps and a name that
reaches no verb among it. A failure the one word answers passes a frame
at its step, the value so far the subject that frame holds, and the step
of `reduce` names the place of the element [QSERR#trace].

```qlang
> [1 2 3] | reduce 0 ~(add)
6

> [1 2 3] | get [~(reduce 0 ([::call{:name :add}] | tag ::quote)) ~(reduce 0 ~(add | it) !| type)]
[6 ::number/add/SubjectNotNumberError]

> [1 2 3] | reduce 0 ~(:acc (get /0) | :el (get /1) | acc | mul 10 | add el)
123

> :add 5 | [1 2 3] | reduce 0 ~(add) !| type
::call/ValueMeetsVerbError

> [1 2] | reduce "x" ~(add) !| trace | map ~(get [~(subject) ~(failed) ~(place)])
[["x" ~(add) null] [[1 2] ~(reduce "x" ~(add)) /0]]
```

## algebra

`union`, `minus` and `inter` reside on sets, on maps and on vectors. The
verbs of a set and of a map meet the value their call gives: those of a
set take the `:other` set, `#[1] | union #[2]`; the `union` of a map takes
the `:other` map, the later value of a key standing, `merge` answering as
it does; and the `minus` and `inter` of a map take off or keep the
`:keys` a map, a vector or a set names, each read as a key [QSPTH#key].
A call that gives none is refused under
the input, `::set/union/other/NotGivenError` as
`::map/union/other/NotGivenError`, and a value of another kind, null
among them, as `::set/union/other/KindNotTakenError`. A vector folds the
sets or the maps it holds, from its first element as it is written, and
takes no value beside them, `[#[1] #[2]] | union 5` refused as
`ArgsBeyondInputsError`. A fold takes a set or a map first, a value of
another kind refused at its index, `ElementNotSetOrMapError`; `union`
refuses so a later value that is no set or map, while `minus` and
`inter` take after a map the keys a map, a vector or a set names, as the
verbs of a map do; a later value the algebra has no rule
for beside the one before it is refused as the pair,
`KindsMismatchedError` with `:leftType` and `:rightType`, a set beside a
map in `union` among them; and a fold of nothing is refused as
`SubjectEmptyError`, a refusal of its subject [QSERR#site]. A set of sets
is folded by the verb of vectors,
`#[#[1] #[2]] | vec/union`, or as the vector it is in the one order,
`toVec | minus`, and `flat` unites it. The verbs of sets and of maps
answer under the subject's tags [QSDSP#answer]; a vector's fold answers
a set or a map of its own. `unionOf` unites the maps or the sets its call
computes, one part at least, `::any/unionOf/parts/EmptyError` refusing
none, under the tags of the first; one part answers itself.

```qlang
> {:age 20} | union {:age 30}
{:age 30}

> {:a 1 :b 2} | merge {:b 3 :c 4}
{:a 1 :b 3 :c 4}

> [#[:a :b] #[:b :d]] | inter
#[:b]

> get [~(#[#[1 2] #[1]] | vec/minus) ~([#[1 2] #[1]] | minus) ~(#[#[1] #[2]] | flat) ~(#[1] | union #[2])]
[#[] #[2] #[1 2] #[1 2]]

> #[#[1] #[2]] | union
|~| raised, and no !| caught it ::set/union/other/NotGivenError!{ … }

> #[#[1] #[2]] | union null
|~| raised, and no !| caught it ::set/union/other/KindNotTakenError!{ … }

> [1 2] | union !| type
::vec/union/ElementNotSetOrMapError

> ::T{:a 1} | union {:b 2}
::T{:a 1 :b 2}

> [{:a 1 :b 2} #[:a]] | get [~(minus) ~(inter) ~(union !| type)]
[{:b 2} {:a 1} ::vec/union/KindsMismatchedError]
```

## group

`groupBy` files the elements of a vector or a set into a map of
buckets, a set's buckets sets, and `indexBy` into a map of one element a
key, the last of one key standing, a set reaching the `indexBy` of
vectors. The key, a quote, a path or none, files an element under the
keyword `toKeyword` answers for it [QSCND#convert]: a keyword as it is, a
string or a number under the keyword of its text, a boolean or null
under that of its literal, a tag name under that of its name, and without
a key an element is its own. A key of another kind is refused at its
element under the verb as `…/KeyKindNotTakenError`, its `:index` the
element and its `:expected` the kinds a key files under, and two values
that file under one keyword meet, the second refused as `KeyTakenError`,
its `:key` the keyword, `:taken` the value that filed under it first and
`:index` the element that met it.

```qlang
> [1 2 3] | groupBy ~(gt 1)
{:false [1] :true [2 3]}

> [{:k [1]}] | indexBy /k !| get [~(type) /index /expected]
[::vec/indexBy/KeyKindNotTakenError 0 #[::boolean ::keyword ::null ::number ::string ::tag]]

> [1 "1"] | groupBy !| type
::vec/groupBy/KeyTakenError

> [{:id :a :v 1} {:id :a :v 2}] | indexBy /id | get /a/v
2
```

## within

`within` edits under one tag: it applies its code, a quote or a path, to
the payload and lays the tag back through its kind, once, on its
answer, so the steps between may break the invariant the result holds;
a set is edited as its vector and laid back under `::set`. A subject
under no tag is refused as `::tagged/within/SubjectNotTaggedError`.

```qlang
> ::Box#[1 2] | within ~(append 1)
::Box#[1 2]

> ::Box[1 2] | within ~(append 3)
::Box[1 2 3]

> #[1 2] | within ~(get [/0 /0 /1])
#[1 2]
```
