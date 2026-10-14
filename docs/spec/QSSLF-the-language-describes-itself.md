# QSSLF · The language describes itself

Every name has a page, every page its laws, and a reader asks the
language itself what a name means, what lies under it and what holds of
it. The requirements of each section are the cases of its file under
`core/test/conformance/QSSLF/`.

## axis

The axes read a name: `doc` its page, `source` the declaration that
wrote it, `binding` the record of its binding [QSNAM#binding]. A value
is read by its kind, `5 | doc` the page of `::number`, a keyword among
values, and a name by its tag, the address of its node,
`::vec/count | doc`, a label of the root from the root and any other
name at its nearest declaration. An axis takes the name of a member
after it and reads the member the subject holds under that name, an
input of a word or the word a name calls on a noun, `::map | doc :minus`;
a vector of names reads a path of members, a set several. A name nothing
declares is refused under the axis, `::any/doc/UnknownNameError`, named
by the tag or the keyword asked, with the addresses of words of the
name and the names near it. A name declared without a page answers null.
A field of a map names nothing, so `{:kind ::set} | doc` is the page of
maps, and a label may declare a `doc` of its own, which its values
answer before the word of every value.

```qlang
> 5 | doc | eq (::number | doc)
true

> :limit | doc | eq (::keyword | doc)
true

> ::map | doc :minus | eq (::map/minus | doc)
true

> ::nosuchbinding | doc !| get [~(type) /name]
[::any/doc/UnknownNameError ::nosuchbinding]
```

## manifest

`manifest`, a word of `::tag`, answers the nodes declared one name
under a noun: its words, its refusals, its pages and the inputs and
answer of a word, its laws aside, which `laws` reads. The topic of the
language lists its chapters, and a noun the refusals its source
declares.

```qlang
> ::vec | manifest | has ::vec/count
true

> ::qlang | manifest | has ::qlang/values
true
```

## laws

A law is a query that answers `true`, a value of `::law`, declared under
the name whose claim it proves, its page the claim. `laws` answers the
laws under a name by their names, each the pair of its page and its
query; `runLaws` runs each in isolation and answers an outcome per law,
`{:law :says :actual :ok :error}`, a law passing only where it answers
`true` and a law that answers a failure holding it at rest under
`:error`; a value runs the laws of its kind, and a name nothing declares
is refused as `::any/runLaws/UnknownNameError`. `tutorial` answers the page
of a name and its laws. Every law of the core passes.

```qlang
> :three 3 | :three/isThree ::law~(3 | eq 3) | ::three | runLaws | map /ok
[true]

> ::number/add | laws | count
4
```

## near

A name that reaches nothing, a tag nothing declares and a member a page
lacks are refused with `:nearest`, the names near the one written: a
slip of the hand, a longer guess that begins with a name, among the
names the step could reach at the depth of the one written, a tag among
tags, an address among addresses, a member among the members the axis
reads. A name is no guess for itself.

```qlang
> 5 | ad 2 !| get /nearest
[:add :and]

> ::str | doc !| get /nearest
[::string]

> ::qlang | doc :pipelin !| get /nearest
[:pipeline]
```

## explain

`explain`, a word of `::any`, answers the explanation of any value, a
value of the kind `::explanation`: the page `doc` reads for it under
`:page`, then the value under `:value`. A name reads its own page, a
value the page of the kind it shows, and an error `!|` opened the page
of its site, its value the error at rest that `raise` raises again. An
explanation prints the page above the value.

```qlang
> "x" | add 1 !| explain | payload | keys
#[:page :value]

> 42 | explain | value
42
```

## doc

A doc is the markdown of the language, the vector of its segments,
prose strings and quotes, under `::doc`. The parser reads the segments:
a `~(…)` whose text reads as code is a quote, under the tags written
before it, a span between backquotes and an unclosed quote are prose,
and each run of prose is one string. `content` answers the text, each
quote and its tags where it stands, `segments` the parts, and `tag
::doc` builds a doc from strings and quotes. A tag gives a quote a role:
`::link`, which `links` answers and `open` follows to a page, and
`::snippet`, which `snippets` answers and `open` runs to what it shows.
`open`, a word of `::quote`, runs a quote beneath its tags. `content`
writes each quote as its literal spelled it and prints only a quote
assembled from data. A doc lays each tag of a quote's role through the
tag's label, so a tag that takes no quote refuses the doc.

```qlang
> |~~ a ~(add 1) b ~~| | segments
[" a " ~(add 1) " b "]

> |~~ a ::snippet~(1 | add 1) b ~~| | snippets | first | open
2
```

## page

`::qlang` is the topic of the language: its page is the first page,
its members are its chapters, the concepts the first page names, each a
page by its address, `::qlang/pipeline`, and a member of a noun is no
name a query calls. Every link of the first page opens a page, every
word of the core has a page, and the first page holds the weight it has,
13664 characters at the most.

```qlang
> ::qlang | doc | links | map ~open | every ~(type | eq ::doc)
true

> ::qlang | doc :pipeline | type
::doc

> ::qlang | doc | print | count | lte 13664
true
```

## catalog

The catalog is the reference of the language, and its pages follow one
form. A page is prose about the name it is declared with: what the name
is for and how it relates to the rest, its links and snippets standing
in its prose where it names them; how the name behaves is told by its
laws, each a definition under the name, so a behaviour the prose tells
and a law proves is told by the law alone. A definition is a story of
statements in the order a reader asks: a word, its page, its inputs
each with the refusal of its kinds, its answer, its refusals each with
the repair, its laws and its recipe last; a kind, its payload, its
fields, its refusals and their facts, its invariants, its laws and the
check of its host last. The page of a kind is a short article in one
order: what the kind is, the forms a reader meets with an example, how
one is read and made, its words, where it stands at the borders, and
the links that go deeper. The page of a tag is the legend of its
payload: what the data beneath it is, what each part means and which
words carry it on; a field names its kinds and stops there, a value
shared by several kinds carrying a tag of its own. The first page tells
the language whole in the order its parts rest on each other, each rule
once with an example whose answer it states, in base forms. An
example holds code under a bare name and runs it by `apply`, or hands
it bare to a word that takes code, and declares a word under a label
only where it shows a word, under the label of the values it serves. A
declaration is laid out its name on a line, each doc of its slot on the
lines after it indented two, and its value after them.
