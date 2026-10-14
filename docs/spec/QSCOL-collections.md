# QSCOL · Vectors, maps and sets

The words of the containers: what each answers over a vector, a set and
a map, the code they run on each element, and the algebra of sets and
maps. The requirements of each section are the cases of its file under
`core/test/conformance/QSCOL/`.

## sequence

A vector and a set answer `count`, `empty`, `first` and `last`, `take`
and `drop` a count of elements, clamped to what there is, `reverse` and
`flat`, `sum`, and `min` and `max` in the one order [QSORD#sort], null
over an empty container where it reads one. `avg` answers the mean,
null over nothing, kept as a running mean, an element that is no number
refused at its index. `has` asks whether an element equal to one
stands. `append` and `prepend` put one element at an end, a vector given
among them, and a set takes it into its order. `zip` reads vectors side
by side, as long as the shortest, an element that is no vector refused
at its index. The answer of a word keeps or leaves the tags of its
subject as its kind says [QSDSP#answer].

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
`[key value]`, the step that makes a key data, and `has` whether a key
stands [QSPTH#has].

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
a vector it answers the vector of what each answered, under no tag of
the subject; over a map the map of the answers under the same keys;
over a set the vector of the images in the one order. The first error
its code answers is the answer of the call. A value computed at the call
in place of the code is refused with the repair.

```qlang
> #[1 2 3] | map ~(mod 2)
[1 0 1]

> ::Box[1 2] | map ~(add 1)
[2 3]

> [1 2] | map (add 1) !| type
::vec/map/code/NotPathOrQuoteError
```

## filter

`filter` keeps the elements its predicate, a quote or a path, answers
`true` for, in their order, a map keeping its keys and a set its kind;
a predicate that answers no boolean is refused at its index.

```qlang
> {:c 3 :a 1 :b 2} | filter ~(gt 1)
{:c 3 :b 2}
```

## reduce

`reduce` folds a vector, a set or a map's values from a seed by code of
any shape. A quote of one word is the short form: the fold calls the
word as the pipe calls it, the value so far its subject and the element
its first object, the word named by its name or its address. Any other
code runs on the pair of the value so far and the element. A value the
scope binds under the name of the word meets it, as a step does.

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
elements, its input left out; a map folds nothing, so its input is
given, `{:a 1} | union` refused as `::map/union/other/NotGivenError`,
and a value of another kind beside a set is refused under the input. A
map's `minus` and `inter` take the keys a map, a vector or a set names;
`union` of maps lets the later value of a key stand. A value that is no
set or map is refused at its index, a set beside a map as a pair the
algebra has no rule for, `KindsMismatchedError` with `:leftType` and
`:rightType`, and a fold of nothing as `SubjectEmptyError`. The answer
keeps the subject's tags. `unionOf` unites the maps its call computes
from one subject.

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
buckets and `indexBy` into a map of one element a key, the last of one
key standing. The key, a quote, a path or none, files an element under
a keyword: a keyword as it is, a string or a number under the keyword of
its text, a boolean or null under that of its literal, a tag name under
that of its name, and without a key an element is its own. A key of
another kind is refused at its element, and two values that file under
one keyword meet, the second refused as `KeyTakenError`, its `:key` the
keyword, `:taken` the value that filed under it first and `:index` the
element that met it.

```qlang
> [1 2 3] | groupBy ~(gt 1)
{:false [1] :true [2 3]}

> [1 "1"] | groupBy !| type
::vec/groupBy/KeyTakenError

> [{:id :a :v 1} {:id :a :v 2}] | indexBy /id | get /a/v
2
```

## within

`within` edits under one tag: it applies its code to the payload and
lays the tag back, its constructor running once at the rewrap, so the
steps between may break the invariant the result holds. A host may own
the words of editing on its tags, so a kind of its own reads alone.

```qlang
> ::Box#[1 2] | within ~(append 1)
::Box#[1 2]

> ::Box[1 2] | within ~(append 3)
::Box[1 2 3]
```
