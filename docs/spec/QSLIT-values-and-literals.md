# QSLIT · Values and their literals

What a value is, how its text writes it, and the kind every value has.
A literal is a value its text fixes, reading no name and no subject, a
tag it writes laid through the label the scope declares under that
name; what computes a value is a verb, `get` over a template for a
shape [QSPTH#template] and `tag` for a tag laid over a value computed.
The requirements of each section are the cases of its file under
`core/test/conformance/QSLIT/`.

## kind

Every value has a kind: the outermost tag of its stack, and for a value
with no tag of its own, the kind of the core its literal implies. `[…]`
implies the vector, `{…}` the map, `#"…"` the regex, `::regex`, `/a`
the path, and a number, a string, a keyword, a tag name, a boolean and
null each have their own; `#[…]` writes the set, `~(…)` the quote,
`|~~ … ~~|` the doc and `!{…}` the error, each a payload under the tag of
its kind, which `payload` opens; a host's value carries its tags above
one of them. `type` answers the kind of any value, the kind a literal implies
for one under no tag, and the kind's page is one step away. A tag names
a kind: tags stack over any payload and read from the outside in,
`payload` reading what stands beneath the outermost and refusing a value
under no tag as `::tagged/payload/SubjectNotTaggedError`; behaviour
lives in the catalog and is found through the tag.

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

A number is a finite double, written as an integer, a decimal, a minus
sign and an exponent, `1e10`, `2.5e-3`, `1.5E+6`, its whole part
written as JSON writes it, a zero alone or digits opening with another,
`01` refused by the parser with the form `1`. A literal whose magnitude
passes the largest double, `1e400`, is refused by the parser where it
begins; one smaller than the least reads as `0`, and digits past a
double's precision round.

```qlang
> -2.5e3
-2500

> "1e400" | parse !| get [~(type) /found /location]
[::quote/ParseError "1" ::span[0 1 1 1 1 2]]

> [1e0 2e3 1.5e-2]
[1 2000 0.015]
```

## string

A string is written in double quotes with the escapes of JSON, `\"`,
`\\`, `\/`, `\n`, `\t`, `\r`, `\b`, `\f` and `\u` with four hexadecimal
digits, and holds any other character written raw as it is, a line
break, a tab and a character of control among them.

```qlang
> "A"
"A"

> "hello world"
"hello world"
```

## keyword

A keyword is data, a key: `:name`. A name of any other letters is
written in quotes, `:"foo bar"`, `:""`, `:"123"`, and a bare name in
quotes is that name. Names joined by `/` make one keyword,
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
the values they write, and an object's keys read as keywords, quoted
where the key is no bare name. A vector separates its elements by
whitespace or by commas, one comma between every two, and braces with
string keys separate their entries by commas, one between every two; a
map of keyword keys and a set are written with whitespace, and a map that
writes its keys both ways is refused where its entries end, naming the
two. An object reads
as the map of its keys, `type` and `error` as any other, and a
duplicate key reads as `JSON.parse` reads it, at the boundary as in a
query [QSPRN#json].

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

> "{\"a\": 1, :b 2}" | parse !| get [/message /location]
["a map writes its keys one way, as keywords, `{:a 1 :b 2}`, or as the strings of JSON, `{\"a\": 1, \"b\": 2}`" ::span[7 1 8 7 1 8]]
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

The tag's kind lays the tag before the tags of the payload the literal
writes and never in their place, or refuses it naming why the payload
does not fit [QSBLD#value], so a label laid over a value already under it
stands again, `::Lab::Lab[1]`, and `::desc` stacks its reversals
[QSORD#desc]. A kind of the core reads its payload, a value of its own
kind or, for a set, a quote and a doc, a vector, and for an error the map
of its facts, so `::number"5"` is refused and `::set[3 1]` is `#[1 3]`,
a vector or a map under a tag of another kind refused, which `payload`
opens. A tag
no declaration names, the tag of a verb and the tag of an invariant lay
themselves over a payload as it is [QSNAM#address], and the tag of a
name that holds data is refused as `::construct/TagNamesAValueError`. `tag`
lays a tag over the value in the pipe, `5 | tag ::Foo`, or over the pair
`[tag payload]` it takes apart, through the tag's kind; a name that is
no tag name is refused as `::any/tag/name/KindNotTakenError`, a
subject that is no pair as `::any/tag/SubjectNotPairError`, and a pair
whose first is no tag as `::any/tag/PairTagKindNotTakenError`.

```qlang
> ::Width#5 | add 3 | get [~(type) ~(payload)]
[::Width 8]

> [::Pos#-3 ::T#true ::T#null ::T#/a]
[::Pos#-3 ::T#true ::T#null ::T#/a]

> ::number"5" !| type
::number/PayloadKindNotTakenError

> :Lab |~~ L ~~| | get [~(::Lab::Lab[1]) ~(::T[2 1] | tag ::set !| type)]
[::Lab::Lab[1] ::set/PayloadKindNotTakenError]

> #[2 1] | tag ::vec !| type
::vec/PayloadKindNotTakenError

> [::Foo 5] | tag
::Foo#5

> get [~(::vec/sort#5 | type) ~(::vec/take/count/NotIntegerError#5 | type) ~(:limit 5 | ::limit#1 !| type)]
[::vec/sort ::vec/take/count/NotIntegerError ::construct/TagNamesAValueError]
```

## closed

A literal is closed from its opening to its closing pair: its parts are
literals, fixed by its text, which reads no name and no subject, and a
tag it writes is laid through the label the scope declares under that
name, its kind attaching the tag to the payload or refusing it
[QSLIT#tag]. A group or a name written inside a container, at any depth,
is refused by the parser, which names the literal whole as the template
of `get`, its tags and its brackets kept, `[::Box[x] 1]` naming
`get [::Box[~(x)] 1]` [QSPTH#template], and inside an error literal names
the facts built by `get` and made an error by `raise`; code in
parentheses after a tag is refused, naming `tag` for a value computed,
and a literal in them names the literal touching its tag, `::Width(5)`
naming `::Width#5`; a map entry of two values is refused where it
stands, naming the template of `get`. In the code of a doc, a literal
that computes reads as prose.

```qlang
> "[(5 | add 1) 2]" | parse !| get /message
"a literal computes nothing: a shape computed is built by `get`, its parts paths and quotes, write `get [~(5 | add 1) 2]`"

> "::Width(5)" | parse !| get /message
"a number, a boolean, null or a path touches its tag by `#`: write `::Width#5`"

> "{:a 1 2}" | parse !| get [/message /location]
["a map entry holds one literal, `{:k 1}`, and a shape computed is built by `get`: `get {:k ~(f x)}`" ::span[6 1 7 6 1 7]]

> :Pos |~~ P ~~| (::kind | holds :NegError |~~ n ~~| ~(gt 0)) | ::Pos#-1 !| type
::Pos/NegError
```

## atoms

Every value comes apart into the set of its atoms and a template, and
`get` over the template, read against the set, builds a value equal to
the first. The atoms
are the leaves the decomposition stops at: null, booleans, numbers,
strings, regexes, keywords, tag names and paths, each once and in the
one order; the keys of maps and the tags over payloads are atoms as the
other leaves are. The template is the literal of the reads of its
parts: an atom by the path of
its index in the set, a vector as the vector of its elements' reads, a
map from the pairs of its keys and values by `indexBy`, and a tagged
value, a set, a quote, a doc and an error at rest among them, from its
tag and its payload by `tag`, each of the two a quote `get` runs against
the set. Every value comes back so, each example of
the catalog and each literal a case expects among them.

```qlang
> #[1 "x" :a :b] | apply ~(get [/1 [/0 /0] ~(get [[/3 /2]] | indexBy ~(first) | map ~last)])
["x" [1 1] {:b :a}]

> #[1 ::Foo] | get [/1 /0] | tag
::Foo#1
```
