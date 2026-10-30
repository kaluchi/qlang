# QSORD · One order over all values

One order ranks every value, so anything sorts, a vector is a compound
key, and the set is the vector in that order. The requirements of each
section are the cases of its file under `core/test/conformance/QSORD/`.

## order

Values order first by kind: null, boolean, number, string, regex,
keyword, tag name, path, vector, set, map, quote and doc, and after them
every value under another tag by the name of its tag, a desc, an excerpt,
a label, an error at rest and a kind of a host among them. Within a kind,
numbers order by value,
`false` before `true`, and a text by its code points, the characters a
string counts [QSTXT#string]: a string, the name of a keyword and of a
tag, a key of a map, a regex by its text and then its flags, and a
path segment by segment, an index among them, so `/10` ranks before
`/9`; vectors element by element, a shorter before a longer it begins, a set
as its vector, maps by their keys and then their values, a quote by its
steps, a doc by its segments in turn, a run of prose before a quote, and
a value under another tag by its payload, which a desc reverses. Two
values are equal where the order ranks them alike:
`eq` answers by that tie, as `has` of a vector and of a set, the
elements a set keeps, the algebra of sets, the keys `groupBy` and
`indexBy` file under and the merge of a shape do.

```qlang
> [{:a 1} #[1] [1] ::t :k "s" 1 true null] | sort
[null true 1 "s" :k ::t [1] #[1] {:a 1}]

> get [(!{:a 1} | eq !{:a 2}) (#[!{:a 1} !{:a 2}] | count) (::A#1 | eq ::A::B#1) (#[::A#1 ::A::B#1] | count) (#[1 2] | eq [1 2])]
[false 2 false 2 false]

> ["b" "B" "a"] | sort
["B" "a" "b"]

> ["😀" "ﬁ" "a" "👍"] | sort
["a" "ﬁ" "👍" "😀"]

> [/b /a/c /a] | sort | map print
["/a" "/a/c" "/b"]

> get [([::aaa#1 ::excerpt{:count 1}] | sort | map tag) ([::desc#1 ::excerpt{:count 1} ~(a) |~~ a ~~| {:a 1}] | sort | map tag)]
[[::aaa ::excerpt] [::map ::quote ::doc ::desc ::excerpt]]
```

## set

A set is the vector in the one order without duplicates, under the tag
`::set`: `#[…]` is its literal, `toSet` answers it, and its payload is
that vector. Its constructor orders what it is given and
holds each element once, so `tag ::set` and a write lay the set anew. A
set reads by index as its vector does, two sets are equal by their
elements, and equality reads the kind, so `#[1 2] | eq [1 2]` is false.
Its own verbs are those whose answer on a set is not the answer of the
verb of vectors on it: `sort` and `reverse` answer the vector of an
order, `toVec` the vector of its elements, `zip` the vector of its
columns, two equal ones kept, `toSet` and `distinct` the set itself under
the tags it came with, each element in it once already, `groupBy` files
into sets, and `union`, `minus` and `inter` meet the set
the call gives [QSCOL#algebra]. Every other verb of vectors reaches a set
through the walk, an answer of the vector's label brought back as a set,
each value held once there [QSDSP#residence], `filter`, `take` and `flat`
among them, and so does a verb of vectors called by its address on a set,
while `map` answers the vector of the images.

```qlang
> [2 1 2] | toSet
#[1 2]

> [3 1 3] | tag ::set
#[1 3]

> #[:z :x :y] | query /1
:y

> #[1 2] | eq [1 2]
false

> #[3 1 2] | filter (gt 1)
#[2 3]

> get [(#[3 1 2] | sort) (#[3 1 2] | reverse) (#[3 1 2] | take 2) (#[-1 1] | map (mul 0))]
[[1 2 3] [3 2 1] #[1 2] [0 0]]

> #[1 2] | get [(binding :filter | name) (binding :sort | name)]
[:vec/filter :set/sort]

> get [(#[[1 1] [2 2]] | zip) (#[[1 1] [2 2]] | flat) (#[[1 1] [2 2]] | vec/zip)]
[[[1 2] [1 2]] #[1 2] #[[1 2]]]
```

## sort

`sort` orders a vector, a set or a map by the one order of its values,
equal values keeping the order they stood in, a map's entries ordered by
their values, each value keeping its key; `min` and `max` relate the
values as `gt` relates two and answer the least and the greatest, null
for an empty container, a pair of two kinds, null beside a number among
them, refused where its second stands, a missing value taken out first,
`filter (ne null) | max`, and a value that is no container answers none
of them. Each takes a key, null,
code or a path, another kind refused under its input `key`,
`::vec/sort/KeyKindNotTakenError`, `::map/sort/KeyKindNotTakenError` and
`::vec/min/KeyKindNotTakenError`,
and ranks by what the key answers, a vector key ranking index by index,
the first index first and each later one among the elements the indices
before it leave alike; `min` and `max` with a key answer the element,
the first of equal ones. A key that fails answers the call, and an error
at rest a key answers ranks as the one order ranks it, as an error among
the elements does where no key is given. `gt`, `gte`, `lt` and `lte`
compare within one kind [QSCND#compare].

```qlang
> [{:a 1 :b 2} {:a 1 :b 1} {:a 0 :b 9}] | sort (get [/a /b]) | map /b
[9 1 2]

> [{:age 30} {:age 40}] | max /age
{:age 40}

> [{:k 1 :i 0} {:k 0 :i 1} {:k 1 :i 2}] | sort /k | map /i
[1 0 2]

> [!{:k 1} 1 null] | sort
[null 1 !{:k 1}]

> get [([3 1 2] | min) ([1 null 3] | max !| get [tag (trace | last | path)]) ([1 null 3] | filter (ne null) | max)]
[1 [::call/KindsMismatchedError /1] 3]
```

## desc

`::desc` is a tag whose values rank among the other tags by its name and
within it by the reverse of their payloads' rank, under another tag as
well, written by `desc` or by its literal, `::desc#5`. `desc` turns its
subject: a value of `::desc` answers its payload, the tags over it kept,
and any other is laid under `::desc`, so a value turned twice is itself
and ranks, compares and equals as itself, `5 | desc | tag ::Box | desc`
answering `::Box#5` and a key turned ranking a value of `::desc` under
another tag the other way. `::desc` laid over a value under it stands
once, `::desc::desc#5` being `::desc#5` [QSLIT#tag].
The comparisons compare two values under `::desc` by the reverse of their
payloads of any kinds, as `sort` ranks them, so `min`, `max` and `sort`
read it alike, and one element of a vector key descends whatever the
kind it ranks; a value under `::desc` beside one that is not is a pair of
two kinds, which a comparison refuses [QSCND#compare].

```qlang
> ["b" "c" "a"] | sort desc
["c" "b" "a"]

> [{:n 1 :s "b"} {:n 2 :s "c"} {:n 2 :s "a"}] | sort (get [(get /n | desc) /s]) | map /s
["a" "c" "b"]

> 1 | desc | gt (2 | desc)
true

> 1 | desc | gt ("a" | desc)
true

> get [(1 | desc | gt 2 !| tag) (2 | gt (1 | desc | desc) !| tag) (get [2 (1 | desc | desc)] | sort)]
[::call/KindsMismatchedError true [1 2]]

> get [(5 | desc | desc) (::desc::desc#5) (5 | desc | tag ::Box | desc)]
[5 ::desc#5 ::Box#5]

> [1 2] | map (desc | tag ::Box) | get [(sort | map (payload | payload)) (sort desc | map (payload | payload))]
[[2 1] [1 2]]

> [1 3 2] | sort (desc | desc)
[1 2 3]

> get [(1 | desc | tag ::Box) (2 | desc | tag ::Box)] | sort
[::Box::desc#2 ::Box::desc#1]
```
