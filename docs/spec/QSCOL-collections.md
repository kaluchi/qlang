# QSCOL · Vectors, maps and sets

The words of the containers: what each answers over a vector, a set and
a map, the code they run on each element, and the algebra of sets and
maps. The requirements of each section are the cases of its file under
`core/test/conformance/QSCOL/`.

## sequence

A vector and a set answer `count`, `empty`, `first` and `last`, `take`
and `drop` a count of elements, clamped to what there is, a count whole
where it equals its floor, a fraction refused as
`::vec/take/count/NotIntegerError` and a value of another kind as
`…/count/KindNotTakenError`, `reverse`, the reverse of a set a vector and
of a vector under a tag the vector under it, `flat`, which lifts one
level, `sum`, a number beneath the tags over an element read as the
number and an element that is no number refused at its index, at its key
over a map, and `min` and `max` in the one order or by a key
[QSORD#sort]; `first`, `last`, `min`, `max` and `avg` answer null over an
empty container. `avg`
answers the mean, null over nothing, kept as a running mean, a number
beneath its tags read as `sum` reads it, an element that is no number
refused at its index, at its key over a map. `has`
asks whether an element equal to one stands [QSPTH#has]. `append` and
`prepend` put one element at an end, a vector given among them, and a
set takes it into its order. `zip` reads vectors side by side, as long
as the shortest, an element that is no vector refused at its index. The
answer of a word keeps or leaves the tags of its subject as its kind
says [QSDSP#answer].

```qlang
> [1 2 3] | take -1
[]

> [1] | append [2 3]
[1 [2 3]]

> #[1 2] | append 3
#[1 2 3]

> [[1 2 3] [:a :b]] | zip
[[1 :a] [2 :b]]

> [1 2 3 4] | avg
2.5

> [::W#2 1] | sum
3

> [] | min
null
```

## map

A map is a record and a dictionary at once. Its elements are its
values, and its keys are the shape that travels with them: `map`,
`filter`, `sort`, `take`, `drop` and `reverse` act on the values and
keep the keys, the reducers, `min` and `max` read the values, and a
predicate sees the value alone. `keys` answers the set of its keys,
`vals` the vector of its values, `entries` the vector of its pairs
`[key value]` in the order of its entries, the step that makes a key
data, and `has` whether a key stands [QSPTH#has]. The words a vector has
beyond these, `distinct`, `groupBy`, `flat` and `contains` among them, a
map answers by `vals` first, `{:a 1} | vals | contains 1` answering
`true`.

```qlang
> {:b 2 :a 1} | map ~(add 1)
{:b 3 :a 2}

> {:a 3 :b 1} | sort | take 1
{:b 1}

> {:a 1 :b 2} | entries
[[:a 1] [:b 2]]
```

## each

`map` runs its code, a quote or a path, on each element in order: over
a vector it answers a plain vector of what each answered; over a map a
plain map of the answers under the same keys; over a set the vector of
the images in the one order. The first error its code answers is the
answer of the call. A value computed at the call in place of the code is
refused with the repair.

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
any shape, the seed first and the code after it, a call with one object
refused as `::vec/reduce/reducer/NotGivenError` and code computed at the
call as `::vec/reduce/reducer/KindNotTakenError`. A quote of one word is
the short form: the fold calls the word as the pipe calls it, the value
so far its subject and the element its first object, the word named by
its name or its address. Any other code runs on the pair of the value so
far and the element. A value the scope binds under the name of the word
meets it, as a step does.

```qlang
> [1 2 3] | reduce 0 ~(add)
6

> [1 2 3] | reduce 0 ~(:acc (get /0) | :el (get /1) | acc | mul 10 | add el)
123

> :add 5 | [1 2 3] | reduce 0 ~(add) !| type
::call/ValueMeetsWordError
```

## algebra

`union`, `minus` and `inter` reside on sets and maps, the other value
their input, and on vectors, which fold the sets or maps they hold and
take no value beside them, `[#[1] #[2]] | union 5` refused as
`ArgsBeyondInputsError`. A set of sets folds as the vector of its
elements, its input left out. A map's `union`, `minus` and `inter`
combine it with the value their input gives, which the call gives,
`{:a 1} | union` refused as `::map/union/other/NotGivenError`; its
`union` takes a map, the later value of a key standing, and its `minus`
and `inter` the keys a map, a vector or a set names; a value of another
kind is refused under the input, `::map/union/other/KindNotTakenError`.
A fold takes a set or a map first, a value of another kind refused at its
index, `ElementNotSetOrMapError`; `union` refuses so a later value that
is no set or map, while `minus` and `inter` take after a map the keys a
vector names, as the map's words do; a later value the algebra has no
rule for beside the one before it is refused as the pair,
`KindsMismatchedError` with `:leftType` and `:rightType`, a set beside a
map among them; and a fold of nothing is refused as
`SubjectEmptyError`. The words of sets and of maps answer under the
subject's tags; a vector's fold answers a set or a map of its own.
`unionOf` unites the maps or the sets its call computes, one part at
least, `::any/unionOf/parts/EmptyError` refusing none, under the tags of
the first; one part answers itself.

```qlang
> {:age 20} | union {:age 30}
{:age 30}

> [#[:a :b] #[:b :d]] | inter
#[:b]

> #[#[1] #[2]] | union
#[1 2]

> [1 2] | union !| type
::vec/union/ElementNotSetOrMapError

> ::T{:a 1} | union {:b 2}
::T{:a 1 :b 2}
```

## group

`groupBy` files the elements of a vector or a set into a map of
buckets, a set's buckets sets, and `indexBy` into a map of one element a
key, the last of one key standing. The key, a quote, a path or none,
files an element under a keyword: a keyword as it is, a string or a
number under the keyword of its text, a boolean or null under that of
its literal, a tag name under that of its name, and without a key an
element is its own. A key of another kind is refused at its element, and
two values that file under one keyword meet, the second refused as
`KeyTakenError`, its `:key` the keyword, `:taken` the value that filed
under it first and `:index` the element that met it.

```qlang
> [1 2 3] | groupBy ~(gt 1)
{:false [1] :true [2 3]}

> [1 "1"] | groupBy !| type
::vec/groupBy/KeyTakenError

> [{:id :a :v 1} {:id :a :v 2}] | indexBy /id | get /a/v
2
```

## within

`within` edits under one tag: it applies its code, a quote or a path, to
the payload and lays the tag back, its constructor running once at the
rewrap, so the steps between may break the invariant the result holds;
a set is edited as its vector and laid back under `::set`. A subject
under no tag is refused as `::tagged/within/SubjectNotTaggedError`.

```qlang
> ::Box#[1 2] | within ~(append 1)
::Box#[1 2]

> ::Box[1 2] | within ~(append 3)
::Box[1 2 3]
```
