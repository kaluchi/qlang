# QSLIT · Values and their literals

What a value is, how its text writes it, and the kind every value has.
A literal is a value its text alone fixes; what computes a value is a
word, [QSPTH#template] for a shape and `tag` for a tag laid over a value
computed. The requirements of each section are the cases of its file
under `core/test/conformance/QSLIT/`.

## kind

Every value has a kind: the outermost tag of its stack, and for a value
with no tag of its own, the kind of the core its literal implies. `[…]`
implies the vector, `{…}` the map, `#[…]` the set, `#"…"` the pattern,
`~(…)` the quote, `|~~ … ~~|` the doc, `!{…}` the error, `/a` the path,
and a number, a string, a keyword, a tag name, a boolean and null each
have their own. `type` answers the kind of any value, and the kind's
page is one step away. A tag is the name of an interpretation: tags
stack over any payload and read from the outside in, `payload` reading
what stands beneath the outermost; behaviour lives in the catalog and is
found through the tag, never in the value.

```qlang
> [1 2] | type
::vec

> null | type
::null

> ::A::B{} | get [~(type) ~(payload | type)]
[::A ::B]

> 5 | type | type
::tag
```

## number

A number is a finite double, written as JSON writes one: an integer, a
decimal, a sign, an exponent, `1e10`, `2.5e-3`, `1.5E+6`.

```qlang
> -2.5e3
-2500

> [1e0 2e3 1.5e-2]
[1 2000 0.015]
```

## string

A string is written in double quotes with the escapes of JSON, `\"`,
`\\`, `\/`, `\n`, `\t`, `\r`, `\b`, `\f` and `\u` with four hexadecimal
digits.

```qlang
> "A"
"A"

> "hello world"
"hello world"
```

## keyword

A keyword is a value and names nothing: `:name`. A name of any other
letters is written in quotes, `:"foo bar"`, `:""`, `:"123"`, and quotes
around a bare name change nothing. Names joined by `/` make one keyword,
`:qlang/core/strings`, and the words of the literals are keywords after
the colon, `:null`.

```qlang
> :"name" | eq :name
true

> :qlang/error | eq :qlang/http
false

> [:null :true :"$ref"]
[:null :true :"$ref"]
```

## container

A vector `[1 2 3]`, a set `#[1 2]` and a map `{:a 1}`, each empty as
`[]`, `#[]` and `{}`, hold literals at any depth. A set holds each
element once in the one order [QSORD#order], a function of its literal
alone, so `#[3 1 3]` is `#[1 3]`. A map's keys are keywords; of two
entries of one key, the last value stands in the first entry's place.

```qlang
> #[3 1 3]
#[1 3]

> {:a 1 :b 2 :a 3}
{:a 3 :b 2}
```

## json

JSON is syntax: an object, an array, `true`, `false` and `null` read as
the values they write, commas between elements read as whitespace, and
an object's keys read as keywords, quoted where the key is no bare name.
A map is a map whatever its keys say, a key named `type` among them, and
a duplicate key reads as `JSON.parse` reads it.

```qlang
> {"name": "alice", "age": 30}
{:name "alice" :age 30}

> {"a b": 1} | keys
#[:"a b"]

> [1, null, true]
[1 null true]

> {"type": "quote", "source": "hi"} | type
::map

> {"a": 1, "b": 2, "a": 3}
{:a 3 :b 2}
```

## tag

A tag name, `::Box`, is a value of the kind `::tag`; taken as a value it
is the kind as a subject. A tagged literal writes its payload touching
the tag by the sign its payload opens with: `::T[…]`, `::T{…}`,
`::T#[…]`, `::T"…"`, `::T#"…"`, `::T~(…)`, `::T|~~ … ~~|`, `::T:k`,
`::T!{…}`, `::A::B[…]`. A number, `true`, `false`, `null` and a path,
whose first character would continue the tag's name, take `#`:
`::Width#5`, `::T#/a`, and print so. The words of the literals are tag
names after `::`, `::null`.

The constructor of the tag's kind attaches the tag to the payload the
literal writes, or refuses it naming why the payload does not fit; it
builds no other value from it. A kind of the core reads a payload of its
own kind alone, so `::number"5"` is refused, and a tag no declaration
names lays itself over a payload as it is [QSNAM#address].

```qlang
> ::Width#5 | add 3 | get [~(type) ~(payload)]
[::Width 8]

> [::Pos#-3 ::T#true ::T#null ::T#/a]
[::Pos#-3 ::T#true ::T#null ::T#/a]

> ::number"5" !| type
::number/PayloadNotNumberError

> #[2 1] | tag ::vec !| type
::vec/PayloadNotVecError
```

## closed

A literal is closed from its opening to its closing pair: nothing
inside reads the scope or the value in the pipe. A group or a name
written inside a container is refused by the parser, which names `get`
[QSPTH#template]; parentheses after a tag hold code and are refused,
naming `tag` for a value computed. In the code of a doc, a literal that
computes reads as prose.

```qlang
> "[(5 | add 1) 2]" | parse !| get /message
"a literal computes nothing: a shape computed is built by `get`, its parts paths and quotes, write `get [~(5 | add 1) 2]`"

> "::Width(5)" | parse !| get /message
"a number, a boolean, null or a path touches its tag by `#`: write `::Width#5`"
```

## atoms

Every value comes apart into the set of its atoms and a shape, and the
shape applied to the set builds a value equal to the first. The atoms
are the values no verb takes further apart: null, booleans, numbers,
strings, patterns, keywords, tag names and paths, each once and in the
one order; the keys of maps and the tags over payloads are atoms as the
other leaves are. The shape is a quote that reads the value back by
`get` over a template of the reads of its parts: an atom by the path of
its place in the set, a vector as the vector of its elements' reads, a
map from the pairs of its keys and values by `indexBy`, and a tagged
value, a set, a quote, a doc and an error at rest among them, from its
tag and its payload by `tag`. Both ways are written in the language in the test
tree, and the test of the ring runs them over every example of the
catalog and every literal a case expects.

```qlang
> #[1 "x" :a :b] | apply ~(get [/1 [/0 /0] ~(get [[/3 /2]] | indexBy ~(first) | map ~last)])
["x" [1 1] {:b :a}]

> #[1 ::Foo] | get [/1 /0] | tag
::Foo#1
```
