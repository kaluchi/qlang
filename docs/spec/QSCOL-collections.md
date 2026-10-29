# QSCOL · Vectors, maps and sets

The verbs of the containers: what each answers over a vector, a set and
a map, the code they run on each element, and the algebra of sets and
maps. The requirements of each section are the cases of its file under
`core/test/conformance/QSCOL/`.

## sequence

A vector and a set answer `count`, and `size` and `length` as it does,
`empty`, `first` and `last`, `take` and `drop` a count of elements,
clamped to what there is, a count whole where it equals its floor, a
fraction refused as `::vec/take/CountNotIntegerError` and a value of
another kind as `…/CountKindNotTakenError`, `reverse`, the reverse of a
set a vector and of a vector under a tag the vector under that tag,
`flat`, which lifts one level under the tags of its subject, and
`flatten` as it does, `concat`, the vectors the call gives joined after
the subject under the tags they share, a value given that is no vector
refused as `::vec/concat/VectorsElementKindNotTakenError`, so
`reduce [] ~(concat)` joins the vectors a vector holds, `join`, the texts
of the elements under the tags its strings share, `sum`, the numbers the
elements hold beneath their tags added under the tags they share, an
element that is no number refused at its index, at its key over a map,
and then one under other tags than an element before it as the pair, the
path of the step's frame naming it [QSERR#trace], a total past the
doubles refused as no number, and `min` and `max`, which relate the
elements as `gt` relates two values [QSORD#sort]; `first`, `last`,
`min`, `max` and `avg` answer null over an empty container. `avg`
answers the mean, the sum of its numbers over their count where the sum
stays among the doubles and the running mean where it passes them, null
over nothing, under the tags its numbers share, read as `sum` reads them, an element that is no
number refused at its index, at its key over a map. `has` asks whether the vector or the set holds an element
equal to one [QSPTH#has]. `append` and `prepend` put one element at an
end, a vector given among them, and a set takes it into its order. `zip`
reads vectors side by side, as long as the shortest, an element that is
no vector refused at its index. A set answers these by the verbs of
vectors, each value held once in the set they answer, but `reverse` and
`zip`, its own, which answer a vector, the columns of `zip` in the one
order, two equal ones kept [QSDSP#residence], and the answer of a verb
keeps or leaves the tags of its subject as its kind says [QSDSP#answer].

```qlang
> [1 2 3] | take -1
[]

> [1] | append [2 3]
[1 [2 3]]

> #[1 2] | append 3
#[1 2 3]

> [[1 2 3] [:a :b]] | zip
[[1 :a] [2 :b]]

> get [~(#[[1 1] [2 2]] | zip) ~(#[1 [2]] | zip !| get [~(tag) ~(trace | last | path)])]
[[[1 2] [1 2]] [::set/zip/ElementKindNotTakenError /0]]

> get [~([1] | concat [2 3] [4]) ~([[1] [2 3]] | reduce [] ~(concat)) ~([[1 2] [3 [4]]] | flatten) ~(#[1 2] | size)]
[[1 2 3 4] [1 2 3] [1 2 3 [4]] 2]

> [1 2 3 4] | avg
2.5

> get [~([0 1 6 1] | avg) ~([1e308 1e308] | avg | eq 1e308) ~([1e308 -1e308] | avg)]
[2 true 0]

> [1 "x"] | avg !| get [~(tag) ~(trace | last | path)]
[::vec/avg/ElementKindNotTakenError /1]

> [::W#2 1] | sum
::W#3

> get [~([::T"a" ::T"b"] | join ",") ~([::A[1] ::B[2]] | flat) ~([::Cents#1 ::Dollars#2] | sum !| get [~(tag) ~(trace | last | path)])]
[::T"a,b" [1 2] [::call/KindsMismatchedError /1]]

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
key data, `empty` whether it holds none, by a verb of its own, and `has`
whether a key stands [QSPTH#has]. The verbs a vector
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
is the answer of the call. A value computed at the call instead of the
code is refused with what it computed as `found`, its page naming the
tilde [QSQUO#modifier].

```qlang
> #[1 2 3] | map ~(mod 2)
[1 0 1]

> ::Box[1 2] | map ~(add 1)
[2 3]

> [1 2] | map (add 1) !| tag
::vec/map/CodeKindNotTakenError
```

## filter

`filter` keeps the elements its predicate, a quote or a path, answers
`true` for, in their order, a map keeping its keys and a set its kind;
a predicate that answers no boolean is refused at its index, a map's at
its key, and one that answers a failure hands it on, the path of the
step's frame naming the element on either road [QSERR#trace].

```qlang
> {:c 3 :a 1 :b 2} | filter ~(gt 1)
{:c 3 :b 2}

> get [~([1 2] | filter ~(add 1) !| trace | last | path) ~([1 "x"] | filter ~(add 1 | gt 1) !| trace | last | path)]
[/0 /1]
```

## reduce

`reduce` folds a vector, a set or a map's values from a seed by code of
any form, the seed first and the code after it, a call with one arg
refused as `::vec/reduce/ReducerNotGivenError` and code computed at the
call as `::vec/reduce/ReducerKindNotTakenError`. The fold reads the
steps of its code: a quote of one step that is a call with no modifiers,
by the name of a verb or its address, `~(add)` or `~(number/add)`,
written or assembled from data alike, is the short form, which calls the
verb as the pipe calls it, the value so far its subject and the element
its first arg, and a value the step that wrote the quote names under the
name of the verb stands over the verb, so the call that hands it the
element is refused as a value given modifiers,
`::call/ValueTakesNoModifiersError` [QSNAM#value].
Any other code runs on the pair of the value so far and the element, a
path, a call with modifiers, a quote of more steps and a name that
reaches no verb among it. A failure the one word answers passes a frame
at its step, the value so far the subject that frame holds, and the step
of `reduce` names the path of the element [QSERR#trace].

```qlang
> [1 2 3] | reduce 0 ~(add)
6

> [1 2 3] | get [~(reduce 0 ([::call{:name :add}] | tag ::quote)) ~(reduce 0 ~(add | it) !| tag)]
[6 ::number/add/SubjectNotNumberError]

> [1 2 3] | reduce 0 ~(with {:sofar /0 :digit /1} ~(sofar | mul 10 | add digit))
123

> apply ~(:add 5; [1 2 3] | reduce 0 ~(add) !| get [~(tag) ~(addresses)])
[::call/ValueTakesNoModifiersError #[::number/add]]

> [1 2] | reduce "x" ~(add) !| trace | map ~(get [~(subject) ~(failed) ~(path)])
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
the input, `::set/union/OtherNotGivenError` as
`::map/union/OtherNotGivenError`, and a value of another kind, null
among them, as `::set/union/OtherKindNotTakenError`. A vector folds the
sets or the maps it holds, from its first element as it is written, and
takes no value beside them, `[#[1] #[2]] | union 5` refused as
`ArgsBeyondInputsError`. A fold takes a set or a map first, a value of
another kind refused at its index, `ElementKindNotTakenError`; `union`
refuses so a later value that is no set or map, while `minus` and
`inter` take after a map the keys a map, a vector or a set names, as the
verbs of a map do; a later value the algebra has no rule
for beside the one before it is refused as the pair,
`::call/KindsMismatchedError` with `:leftTag` and `:rightTag`, a set beside a
map in `union` among them, each refusal of a fold at the value or the key
it met, the path of its frame naming its path, a key's within its value
[QSERR#trace]; and a fold of nothing is refused as
`SubjectEmptyError`, a refusal of its subject [QSERR#site]. A set of sets
is folded by the verb of vectors,
`#[#[1] #[2]] | vec/union`, or as the vector it is in the one order,
`toVec | minus`, and `flat` unites it. The verbs of sets and the `union`
of a map answer under the tags the subject and the value they take
share, and the `minus` and the `inter` of a map under the subject's, the
keys sharing none [QSDSP#answer]; a vector's fold answers a set or a map
under the tags the values it combines share, a later value of a map's
difference or common part naming keys and sharing none, each laid
through its kind, and refuses at each value its kind, its pair and then
its tags. `unionOf` unites the maps or the sets its call computes, each a
map, a set, or a path or a quote that reads one against the subject, one
part at least, `::any/unionOf/PartsEmptyError` refusing none, under the
tags they share; one part answers itself, a part of another kind is
refused at its index, `::any/unionOf/PartsElementKindNotTakenError` where
it is given and `::any/unionOf/PartsAnswerKindNotTakenError` where its code
read it, and a map beside a set as the pair, `::call/KindsMismatchedError`.

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
|~| raised, and no !| caught it ::set/union/OtherNotGivenError!{ … }

> #[#[1] #[2]] | union null
|~| raised, and no !| caught it ::set/union/OtherKindNotTakenError!{ … }

> [1 2] | union !| tag
::vec/union/ElementKindNotTakenError

> ::T{:a 1} | union {:b 2}
::T{:a 1 :b 2}

> [{:a 1 :b 2} #[:a]] | get [~(minus) ~(inter) ~(union !| tag)]
[{:b 2} {:a 1} ::call/KindsMismatchedError]

> get [~([#[1] #[2] {:a 1}] | union !| get [~(tag) ~(trace | last | path)]) ~([{:a 1} [:a true]] | minus !| get [~(tag) ~(trace | last | path)])]
[[::call/KindsMismatchedError /2] [::vec/minus/KeyKindNotTakenError /1/1]]

> get [~([::A#[1] #[2]] | union) ~({:a 1} | union ::B{:b 2}) ~({:a 1 :b 2} | minus ::T[:a])]
[::A#[1 2] ::B{:a 1 :b 2} {:b 2}]
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
element under the verb as `…/KeyAnswerKindNotTakenError`, its `:expected`
the kinds a key files under, a key that is no code refused under the input
as `…/KeyKindNotTakenError`, and two values that file under one keyword
meet, the second refused as `KeyTakenError`, `key | answer` the keyword and
`:taken` the value that filed under it first, the path of the step's
frame naming the element in each [QSERR#trace].

```qlang
> [1 2 3] | groupBy ~(gt 1)
{:false [1] :true [2 3]}

> [{:k [1]}] | indexBy /k !| get [~(tag) ~(trace | last | path) ~(key | expected)]
[::vec/indexBy/KeyAnswerKindNotTakenError /0 #[::boolean ::keyword ::null ::number ::string ::tag]]

> [1 "1"] | groupBy !| tag
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
