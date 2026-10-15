# QSORD · One order over all values

One order ranks every value, so anything sorts, a vector is a compound
key, and the set is the vector in that order. The requirements of each
section are the cases of its file under `core/test/conformance/QSORD/`.

## order

Values order first by kind: null, boolean, number, string, pattern,
keyword, tag name, path, vector, set, map, quote, doc, elision and desc,
and after them every other tag by its name, the labels, the errors and
the kinds of hosts among them. Within a kind, numbers order by value,
`false` before `true`, strings by their UTF-16 code units, patterns by
their text and then their flags, paths segment by segment, each segment
by its code units, an index among them, so `/10` ranks before `/9`,
vectors element by element, a shorter before a longer it begins, a set
as its vector, maps by their keys and then their values, a quote by its
steps, a doc by its segments in turn, a run of prose before a quote, an
elision by its payload, a desc by the reverse of its payload's place, an
error by its tag and then its facts, and a value under another tag by
its payload.

```qlang
> [{:a 1} #[1] [1] ::t :k "s" 1 true null] | sort
[null true 1 "s" :k ::t [1] #[1] {:a 1}]

> ["b" "B" "a"] | sort
["B" "a" "b"]

> [/b /a/c /a] | sort | map ~(print)
["/a" "/a/c" "/b"]
```

## set

A set is the vector in the one order without duplicates, under the tag
`::set`: `#[…]` is its literal, `distinct` and `toSet` answer it, and
its payload is that vector. Its constructor orders what it is given and
holds each element once, so `tag ::set` and a write lay the set anew. A
set reads by place as its vector does, two sets are equal by their
elements, and equality reads the kind, so `#[1 2] | eq [1 2]` is false.
A word over a set answers a set where the set is its own kind's answer,
`filter` among them, and a vector where it answers an order of its own,
`sort` and `reverse`, or the images of the elements, `map`.

```qlang
> [2 1 2] | distinct
#[1 2]

> [3 1 3] | tag ::set
#[1 3]

> #[:z :x :y] | query /1
:y

> #[1 2] | eq [1 2]
false

> #[3 1 2] | filter ~(gt 1)
#[2 3]
```

## sort

`sort` orders a vector, a set or a map by the one order of its values,
equal values keeping the order they stood in, a map's entries ordered by
their values, each value keeping its key; `min` and `max` answer the
first and the last value in it, null for an empty container, and a value
that is no container answers none of them. Each takes a key, null, a
quote or a path, another kind refused under the word's key,
`::vec/sort/key/KindNotTakenError`, `::map/sort/key/…` and `::vec/min/key/…`,
and ranks by what the key answers, a vector key ranking place by place,
the first place first and each later one among the elements the places
before it leave alike; `min` and `max` with a key answer the element,
the first of equal ones. A key that fails answers the call, and an error
at rest a key answers ranks as the one order ranks it, as an error among
the elements does where no key is given. `gt`, `gte`, `lt` and `lte`
compare within one kind [QSCND#compare].

```qlang
> [{:a 1 :b 2} {:a 1 :b 1} {:a 0 :b 9}] | sort ~(get [/a /b]) | map /b
[9 1 2]

> [{:age 30} {:age 40}] | max /age
{:age 40}

> [{:k 1 :i 0} {:k 0 :i 1} {:k 1 :i 2}] | sort /k | map /i
[1 0 2]

> [!{:k 1} 1 null] | sort
[null 1 !{:k 1}]
```

## desc

`::desc` is a kind whose order is the reverse of its payload's, written
by `desc` or by its literal, `::desc#5`, and a desc of a desc stands
twice, its reversals undoing each other, so it ranks as the value does.
It owns its comparisons, `gt`,
`gte`, `lt` and `lte`, which rank its payloads of any kinds by the one
order as `sort` does, so `min`, `max` and `sort` read it alike, and one
place of a vector key descends whatever the kind it ranks; the
comparisons of the core compare within one kind.

```qlang
> ["b" "c" "a"] | sort ~(desc)
["c" "b" "a"]

> [{:n 1 :s "b"} {:n 2 :s "c"} {:n 2 :s "a"}] | sort ~(get [~(get /n | desc) /s]) | map /s
["a" "c" "b"]

> 1 | desc | gt (2 | desc)
true

> 1 | desc | gt ("a" | desc)
true

> [1 3 2] | sort ~(desc | desc)
[1 2 3]
```
