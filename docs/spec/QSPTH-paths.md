# QSPTH · Paths

A path is a value that locates a part of another value, and the verb
that takes it reads the part there or writes it. The requirements of
each section are the cases of its file under
`core/test/conformance/QSPTH/`.

## value

A path is a value of the kind `::path`, written `/data/users/3/email`:
a key or an index from zero at each segment, a negative index counted
from the end, a key that is a keyword with a slash in its name after a
colon, `/:a/b`, which takes the bare names after it, so a key after it
stands behind a colon of its own, `/:a/b/:c`, and a key that is no bare
name in quotes, `/"first name"`; a path holds one segment at least, the
slash alone refused naming `it`, the value itself. Each segment is text:
a map reads it as the key that spells it and a vector, quoted or not, as
the index its digits write, so `/"0"` equals `/0`. A path prints in one
spelling that reads back as itself by `parse | open`, `/"0"` printing
`/0`, JSON writes its literal as a string, two paths are equal when their
segments are, and the one order ranks paths by their segments
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

> ["a/b" "c"] | toPath | :p it | get [~(print) ~(print | parse | open | eq p)]
["/:a/b/:c" true]
```

## get

`get` answers the value at a path and refuses a miss, each refusal
holding the path it followed as `:path`: a key a map lacks,
`::path/KeyNotInMapError` with the key as `:key` and the keys near it as
`:nearest`; an index past either end, `::path/IndexOutOfBoundsError`
with the index as `:index`; a segment that is no whole number on a value
read by index, `::path/IndexNotIntegerError`, and a value on the path
that has no parts, `::path/SubjectHasNoPartsError`, each naming the
segment it could not read as `:segment`. A path reads beneath the tags
over each value it meets, and a vector, a set, a doc, a quote, a function
and a kind read by index.

```qlang
> {:a {:b [10 20]}} | get /a/b/-1
20

> {:emails [] :age 3} | get /email !| get [~(type) /key /nearest /path]
[::path/KeyNotInMapError :email [:emails] /email]

> [10 20] | get /name !| get [~(type) /segment]
[::path/IndexNotIntegerError :name]

> {:a 5} | get /a/b !| get [~(type) /segment]
[::path/SubjectHasNoPartsError :b]
```

## query

`query` reads a path as `get` does and answers `null` where a key or an
index is missing or `null` stands on the path; another kind on the path
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
whether `get` reads a part there, so a path held as an element is
asked for by `contains` [QSCOL#sequence].

```qlang
> {:a {:b 1}} | get [~(has /a/b) ~(has /a/c)]
[true false]

> {:"1" 5} | get [~(has 1) ~(has 2)]
[true false]
```

## key

A key alone is the path of one segment where `get`, `query` and the
verbs that write take a path: a keyword, a number or a string, one
segment of its text, which a map reads as a key and a vector as an index,
so a key the query computes is read; any other value given to `get` or
`query` is a template [QSPTH#template]. Every place that takes a key of a
map reads a string so. The keys `minus` takes out of a map and `inter`
keeps of it are the value of their input `keys`, a map, a vector or a set
of keys, each a keyword or a string: an element of another kind is
refused under that input at its index, the two kinds as `:expected`,
`::map/minus/keys/ElementKindNotTakenError` and
`::map/inter/keys/ElementKindNotTakenError`, and a single key as
`::map/minus/keys/KindNotTakenError` and
`::map/inter/keys/KindNotTakenError`. A vector that folds the maps it
holds by `minus` and `inter` [QSCOL#algebra] reads the keys in each
element after the first, a key of another kind refused under the verb,
`::vec/minus/KeyKindNotTakenError` and `::vec/inter/KeyKindNotTakenError`.
Inside a keyword the slash is a letter of the one name, `get :a/b`
reading the key `:a/b`; in a path it parts the segments, `get /a/b`
reading `:b` under `:a`.

```qlang
> {:k "b" :b 7} | get (get /k)
7

> {:a 1 :b 2} | minus ["a"]
{:b 2}

> get [~({:a 1} | minus [:a 1] !| get [~(type) /index /expected]) ~([{:a 1} [1]] | minus !| type)]
[[::map/minus/keys/ElementKindNotTakenError 1 #[::keyword ::string]] ::vec/minus/KeyKindNotTakenError]

> {:a/b 1} | get :a/b
1
```

## template

`get` and `query` over a template, a literal of paths and quotes at any
depth of its vectors, maps and sets, answer the template with each path
read and each quote run against the subject, any other value of it as it
is, so two fields of one record are read in one step by `get`, and
softly by `query`. A container under a tag in the template, a stack of
tags and a set among them, is read and laid back under its tags through
their kinds, which hold the template as its literal writes it and then
the payload read, so a kind whose field takes a number refuses a path
written at that field, and such a value is built by `get` and then `tag`,
`get {:w /w} | tag ::Box`. A quote under a tag, a doc, a function and a
kind are answered as they are, their parts unread, and a template held in
a name builds the same shape wherever it is applied. A part that answers
a failure is the answer of the template, the parts after it unread
[QSERR#flow].

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

A verb whose input takes code takes a path as the code that reads it
from each value it runs on, as `get` reads it: `map /name`,
`filter /active`, `sort /age`, `groupBy /status`; a read that misses
passes a frame at the value it missed, its step the `get` of the path,
as `~(get /name)` passes one there. The path of `get`, `query` and `has`
and the inputs of the verbs of one subject, which combine several of its
values, `sumOf`, `subOf`, `mulOf`, `divOf` and `unionOf`, take a path and
read it against the subject. An input whose kinds leave a path out
refuses one, naming as `:repair` the step the call was likely meant as,
`take /n` repaired as `take (get /n)`; an input that takes any value, the
value of `put`, `append`, `eq` and the default of `query`, takes the path
as the value it is.

```qlang
> [{:n 2} {:n 1}] | sort /n
[{:n 1} {:n 2}]

> [{:n 1} {:m 2}] | map /n !| trace | map ~failed
[~(get /n) ~(map /n)]

> {:price 4 :qty 3} | mulOf /price /qty
12

> 5 | mul /qty !| get [~(type) /repair]
[::number/mul/multiplier/KindNotTakenError ~(mul (get /qty))]
```

## verbs

A path answers the verbs of `::path` and those every value answers,
`eq`, `ne`, `type`, `print`, `json` and `tag` among them; a name whose
verbs serve other kinds is refused on a path, under the address of its
verb where one verb holds the name and by the call where several do
[QSDSP#refusal], the refusal naming as `:repair` the step the call was
likely meant as. `segments` answers the keys and the indices of a path,
an index as its number and a segment of digits that writes no number as
its text, `/01` answering `[:"01"]`. `toPath` reads a path from a vector
of keys and indices, an empty one refused as
`::vec/toPath/SubjectEmptyError` and an element that is no key as
`::vec/toPath/ElementNotKeyError`, and from a string in the form of JSON
Pointer, its escapes read and a leading `#` of a fragment among it, a
string of another form refused as `::string/toPath/NotPointerError`.

`paths` answers the outline of a value, the set of its leaves, each the
pair of the path that reads it and its kind, the value read beneath the
tags over it, a part under a tag a leaf and a set opened as a vector, and
`#[]` for an atom. `shape`, a verb of `::any`, answers the schema of a
value in its own literal under `::shape`, a label whose page tells how a
shape reads, so `doc` on the answer reads that page: the value read
beneath the tags over it, each map keeping its keys, each vector and each
set one element whose shape holds of all its elements, a set as `#[E]`,
an empty vector `[]`, and each part that holds no parts its kind, as
`type` answers it, a part under a tag standing whole as its tag, a quote
and a doc among them. The tags a shape lays over a part are its marks:
`::absent` over a part some of the data lacks, `::nullable` over a part
null in some of the data, and `::each` over a map whose keys are data.
Records that share a key merge into one, the keys of all of them, a key
some lack marked `::absent` over its shape and a part null in some
`::nullable`, `::absent` outside, and a part that is null alone stands as
`::null`; records that share no key stand apart, and where the elements
part, the shape there is the set of their kinds, as `:expected` writes
the kinds a holder takes, any two of them that merge merged until none
do, so records that share keys merge whatever their order. The element
of a vector or a set empty in some of the data stands marked `::absent`,
and vectors of one length that part index by index are tuples, a shape
for each index, where vectors of one length and one shape are lists. A
map folds into `::each` over its first key and the shape of its values,
the one key standing for all of them and telling how the keys of the data
read: where every key is data, an id of digits, a date or a time, a uuid,
an email, whatever its values hold, and where it holds more than eight
names whose values, maps, vectors, sets, values under a tag or null,
share one shape; a map of names over atoms keeps them however many, a key
that reads as no name among them, as a map of fewer names or of names
whose values part does. A path of the data reads its shape through its
marks as far as a part holds one kind.

```qlang
> get [~(/tags | count !| get [~(type) /repair]) ~(/tags | keys !| get [~(type) /repair])]
[[::call/KindAnswersNoVerbError ~(get /tags | count)] [::map/keys/SubjectNotMapError ~(get /tags | keys)]]

> /a/0 | segments
[:a 0]

> /01 | segments
[:"01"]

> "/a~1b/0" | toPath
/:a/b/0

> [] | toPath !| type
::vec/toPath/SubjectEmptyError

> {:q ~(add 1) :n [1 "x"] :s #[2]} | paths
#[[/n/0 ::number] [/n/1 ::string] [/q ::quote] [/s/0 ::number]]

> {:a {:b 1 :c [2 3]} :d []} | paths | map ~(print)
["[/a/b ::number]" "[/a/c/0 ::number]" "[/a/c/1 ::number]" "[/d ::vec]"]

> get [~([{:labels [{:name "bug"}]} {:labels []}] | shape) ~({:rows [["2024-01-01" 1.5] ["2024-01-02" null]]} | shape)]
[::shape[{:labels [::absent{:name ::string}]}] ::shape{:rows [[::string ::nullable::number]]}]

> {:users [{:name "a" :age 1 :tags ["x" "y"]} {:name "b" :age "2" :tags []}]} | shape | get [/users/0/name /users/0/age /users/0/tags]
[::string #[::number ::string] [::absent::string]]

> [{:a 1} {:a null :b "x"} {:c 2}] | shape
::shape[#[{:a ::nullable::number :b ::absent::string} {:c ::number}]]

> [{:author {:login "a"}} {:author null}] | shape | get /0/author/login
::string

> get [~({:"17" {:id 1} :"42" {:id 2}} | shape) ~({:"2024-01-01" 3 :"2024-01-02" 5} | shape) ~({:"ann@x.org" 1 :"bo@y.org" 2} | shape) ~({:db {:host "h"} :cache {:host "c"}} | shape) ~({:x 1 :y 2} | shape)]
[::shape::each{:"17" {:id ::number}} ::shape::each{:"2024-01-01" ::number} ::shape::each{:"ann@x.org" ::number} ::shape{:db {:host ::string} :cache {:host ::string}} ::shape{:x ::number :y ::number}]

> {:"17" {:id 1} :"42" {:id 2}} | shape | get /17/id
::number
```

## write

`put` lays a value at a path, adding a key the last map lacks and
replacing a key it holds or the element at an index a vector holds;
`update` lays anew the part at a path by what its code, a quote or a
path, answers for it, an error the code answers being the answer;
`delete` takes the part out, the elements after it moving up. Each
follows the path as `get` does, a key or an index missing on the way
refused there, and for `update` and `delete` the part itself must be
there; a key is the path of one segment. Every container on the way is
built again under the tags it stood under, each laid again through its
kind, so a set is ordered again and a value that breaks the invariant of
its tag is refused.

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

`it` answers the value in the pipe, the value itself where a verb takes
a value.

```qlang
> 5 | mul it
25
```
