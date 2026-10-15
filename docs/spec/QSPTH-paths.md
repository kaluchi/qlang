# QSPTH · Paths

A path is a value that names a place in another value, and the word
that takes it reads it there or writes it. The requirements of each
section are the cases of its file under `core/test/conformance/QSPTH/`.

## value

A path is a value of the kind `::path`, written `/data/users/3/email`:
a key or a place from zero at each segment, a negative place counted
from the end, a key that is a keyword with a slash in its name after a
colon, `/:a/b`, which takes the bare names after it, so a key after it
stands behind a colon of its own, `/:a/b/:c`, and a key that is no bare
name in quotes, `/"first name"`. Each segment is text: a map reads it as the key that
spells it and a vector, quoted or not, as the place its digits name, so
`/"0"` equals `/0`. A path prints in one spelling that reads back as
itself, `/"0"` printing `/0`, JSON writes its literal as a string, two paths are equal when
their segments are, and the one order ranks paths by their segments
[QSORD#order].

```qlang
> /items/1 | type
::path

> /items/1 | print
"/items/1"

> [/a/0 /a/0 /a/1] | distinct | count
2

> {:"first name" 1} | get /"first name"
1

> ["a/b" "c"] | toPath | print
"/:a/b/:c"
```

## get

`get` answers the value at a path and refuses a miss, each refusal
holding the path it followed as `:path`: a key a map lacks,
`::path/KeyNotInMapError` with the keys near it as `:nearest`; a place
past the end, `::path/IndexOutOfBoundsError`; a segment that is no whole
number on a value read by place, `::path/IndexNotIntegerError`; a value
on the path that has no parts, `::path/SubjectHasNoPartsError`. A path
reads beneath the tags over each value it meets, and a vector, a set, a
doc, a quote and a function read by place.

```qlang
> {:a {:b [10 20]}} | get /a/b/-1
20

> {:emails [] :age 3} | get /email !| get [~(type) /nearest /path]
[::path/KeyNotInMapError [:emails] /email]

> {:a 5} | get /a/b !| type
::path/SubjectHasNoPartsError
```

## query

`query` reads a path as `get` does and answers `null` where a key or a
place is missing or `null` stands on the path; another kind on the path
it refuses as `get` does, a segment that is no whole number on a vector
among it. Its second input is a default, answered as it is where the
path misses; a `null` that stands at the path is answered as it stands.

```qlang
> {:a null} | query /a/b
null

> [] | query /0 7
7

> [null] | query /0 7
null

> [1 2] | query /a !| type
::path/IndexNotIntegerError
```

## has

`has` on a map takes a key as `get` takes one, a keyword, a string, a
number or a path, and answers whether `get` reads it, a number naming
the key of its text; a key of another kind is refused as
`::map/has/key/KindNotTakenError`. On a vector and a set `has` asks
whether an element equal to the value stands, and reads a path, answering
whether `query` finds a part there, so a path held as an element is
asked for by `contains` [QSCOL#sequence].

```qlang
> {:a {:b 1}} | get [~(has /a/b) ~(has /a/c)]
[true false]

> {:"1" 5} | get [~(has 1) ~(has 2)]
[true false]
```

## key

A key alone is the path of one segment where `get`, `query` and the
words that write take a path: a keyword, a number or a string, one
segment of its text, which a map reads as a key and a vector as a place,
so a key the query computes is read; any other value given to `get` or
`query` is a template and answers as it is [QSPTH#template]. Every place
that takes a key of a map reads a string so: `minus` and `inter` on a
map take a map, a vector or a set of keys, each a keyword or a string,
an element of another kind refused at its index,
`::map/minus/KeyNotKeywordOrStringError` and
`::map/inter/KeyNotKeywordOrStringError`, and a single key refused as
`::map/minus/keys/KindNotTakenError`. Inside a keyword the slash is a
letter of the one name, `get :a/b` reading the key `:a/b`; in a path it
parts the segments, `get /a/b` reading `:b` under `:a`.

```qlang
> {:k "b" :b 7} | get (get /k)
7

> {:a 1 :b 2} | minus ["a"]
{:b 2}

> {:a/b 1} | get :a/b
1
```

## template

`get` and `query` over a template, a literal of paths and quotes at any
depth of its vectors, maps and sets, answer the template with each path
read and each quote run against the subject in its place, any other
value of it as it is. A container under a tag in the template, a stack
of tags and a set among them, is read and laid back under its tags
through their constructors, which check the
template as its literal writes it and then the payload read, so a kind
whose field takes a number refuses a path written at that field, and
such a value is built by `get` and then `tag`, `get {:w /w} | tag ::Box`.
A quote under a tag, a doc, a function and a kind are answered as they
are, their parts unread, and a template held in a name builds the same
shape wherever it is applied.

```qlang
> {:price 4 :qty 3} | get [/price /qty]
[4 3]

> {:first "Ann" :age 30} | get {:who /first :next ~(get /age | add 1)}
{:who "Ann" :next 31}

> {:a 1} | query [~(get /a) /b]
[1 null]

> {:a 1} | get [::Box::Crate[/a] ::Box#[/a]]
[::Box::Crate[1] ::Box#[1]]
```

## code

A word whose input takes code takes a path as the code that reads it
from each value it runs on, as `get` reads it: `map /name`,
`filter /active`, `sort /age`, `groupBy /status`. The inputs of `get`,
`query` and `has` and those of the words that combine several values of
one subject, `sumOf`, `subOf`, `mulOf`, `divOf` and `unionOf`, take a
path and read it. An input whose kinds leave a path out refuses one,
naming as `:read` the read the call was likely meant for, `take /n`
naming `take (get /n)`; an input that takes any value, the value of
`put`, `append`, `eq`, takes the path as the value it is.

```qlang
> [{:n 2} {:n 1}] | sort /n
[{:n 1} {:n 2}]

> {:price 4 :qty 3} | mulOf /price /qty
12

> 5 | mul /qty !| get [~(type) /read]
[::number/mul/multiplier/KindNotTakenError ~(mul (get /qty))]
```

## words

A path answers the words of `::path` and those every value answers,
`eq`, `type`, `print`, `json`; a word of another kind called on one is
refused, the refusal naming as `:read` the read the step was likely
meant for. `segments` answers the keys and places of a path, a place as its number
and a segment of digits that writes no number as its text, `/01`
answering `[:"01"]`. `toPath`
reads a path from a vector of keys and places, an empty one refused as
`::vec/toPath/EmptyError` and an element that is no key as
`::vec/toPath/ElementNotKeyError`, and from a string in the form of JSON
Pointer, its escapes read and a leading `#` of a fragment among it, a
string of another form refused as `::string/toPath/NotPointerError`.
`paths` answers the set of the paths at which a value holds no parts,
beneath the tags over it, the outline of any value, `#[]` for an atom.

```qlang
> /tags | count !| get /read
~(get /tags | count)

> /a/0 | segments
[:a 0]

> /01 | segments
[:"01"]

> "/a~1b/0" | toPath
/:a/b/0

> {:a {:b 1 :c [2 3]} :d []} | paths | map ~(print)
["/a/b" "/a/c/0" "/a/c/1" "/d"]
```

## write

`put` lays a value at a path, adding a key the last map lacks and
replacing a key it holds or a place a vector holds; `update` lays anew
the part at a path by what its code, a quote or a path, answers for it,
an error the code answers being the answer; `delete` takes the part out,
the elements after it moving up. Each follows the path as `get` does, a
key or a place missing on the way refused there, and for `update` and
`delete` the part itself must be there; a key is the path of one
segment. Every container on the way is built again under the tags it
stood under, their constructors and invariants run, so a set is ordered
again and a value that breaks the invariant of its tag is refused.

```qlang
> {:a {:b 1}} | put /a/c 2
{:a {:b 1 :c 2}}

> {:n 1} | update /n ~(add 1)
{:n 2}

> [1 2 3] | delete /1
[1 3]

> {:box ::Box{:w 2}} | put /box/w 3 | get /box | type
::Box
```

## it

`it` answers the value in the pipe, the value itself where a word takes
a value.

```qlang
> 5 | mul it
25
```
