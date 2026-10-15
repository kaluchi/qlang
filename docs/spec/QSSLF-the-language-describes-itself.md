# QSSLF · The language describes itself

Every name has a page, every page its laws, and a reader asks the
language itself what a name means, what lies under it and what holds of
it. The requirements of each section are the cases of its file under
`core/test/conformance/QSSLF/`.

## axis

The axes, words of every value, read a name: `doc` its page, `source`
every declaration written under its address, `binding` the record of its
binding [QSNAM#binding], `manifest` the names under it, `laws` its laws
and `explain` its explanation. A value is read by its kind, `5 | doc` the
page of `::number`, a keyword among values, a value under a tag nothing
declares by the first kind its stack of tags declares from the outside
in, as a call of a word walks it, so `::Box{:a 1} | doc` is the page of
`::map`; and a name by its tag, the address of its node,
`::vec/count | doc`, a label of the root from the root and any other
name at its nearest declaration. `binding` and `source` take the name of
one member after it, a keyword, and read the member the subject holds
under that name, an input of a word or the word a name calls on a noun,
`::map | doc :minus`; `doc` takes as well a vector of names as a path of
members and a set as several pages, refusing another anchor as
`::any/doc/anchor/KindNotTakenError` and an element that is no keyword
as `::any/doc/anchor/ElementNotKeywordError` with its `:index`; `laws`
and `explain` take no member. A tag nothing declares whose last name
ends in `Error` reads the record of the address before it, a refusal the
runtime raises by rule having no node of its own; any other name
nothing declares is refused under the axis, `::any/doc/UnknownNameError`,
named by the tag or the keyword asked, with the addresses of words of
the name and the names near it. A name declared without a page answers
null. A map is read by its kind whatever its fields hold,
`{:kind ::set} | doc` the page of maps, and a label may declare a `doc` of its own, which its
values answer before the word of every value. A reader adds an axis of
its own by laying a tag over values and declaring words on the tag.

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

`manifest`, an axis, answers the set of the nodes declared one name
under the name its subject reads: its words, its refusals, its pages and
the inputs and answer of a word, its laws aside, which `laws` reads; a
value answers those of the kind it shows, `5 | manifest` those of
`::number`, and a name nothing declares is refused as
`::any/manifest/UnknownNameError`. The topic of the language lists
its chapters, and a noun the refusals its source declares.

```qlang
> ::vec | manifest | has ::vec/count
true

> ::qlang | manifest | has ::qlang/values
true
```

## laws

A law is a query that answers `true`, a value of `::law` over a quote,
declared under the name whose claim it proves, its page the claim.
`laws` answers a map from the name of each law under a name, in the
order of their declarations, to the pair of its page and its query, and
refuses a name nothing declares as `::any/laws/UnknownNameError`;
`runLaws` runs each as held code on null [QSQUO#held], the laws of a
member when it is given its anchor, `::qlang | runLaws :errors`, and
answers an outcome per law, `{:law :says :actual :ok :error}`, `:says`
null for a law without a page, a law passing only where it answers
`true` and a law that answers a failure holding it at rest under
`:error`; a value runs the laws of its kind, and a name nothing declares
is refused as `::any/runLaws/UnknownNameError`. `tutorial` answers the
pair of a name's page and its laws, a name nothing declares refused as
`doc` refuses it. Every law of the core passes.

```qlang
> :three 3 | :three/isThree ::law~(3 | eq 3) | ::three | runLaws | map /ok
[true]

> ::number/add | laws | count
4
```

## near

A name that reaches nothing, a tag nothing declares and a member a page
lacks are refused with `:nearest`, the names near the one written, in
the order of their spelling: the names within a slip of the hand, an
insertion, a deletion, a substitution or a swap of two neighbours, up to
a third of its length and one at least, the nearest of them alone;
beside them the names one of which begins the other, three letters at
least; and the words the page of a word it begins with links whose
names end as it goes on, `addOf` meeting `sumOf`. Each stands among the
names the step could reach at the depth of the one written: near a bare
name the names a step reaches, a label of the root that is no word
standing as its tag, its tag first where the name written is the
label's own; a tag among tags, an address among addresses, a member
among the members the axis reads, a key among the keys of the map a path
missed. A name is no guess for itself.

```qlang
> 5 | ad 2 !| get /nearest
[:add :and]

> ::str | doc !| get /nearest
[::string]

> ::qlang | doc :pipelin !| get /nearest
[:pipeline]

> {:a 1 :b 2} | addOf /a /b !| get /nearest
[:add :sumOf]
```

## explain

`explain`, a word of `::any`, answers the explanation of a value, a
value of the kind `::explanation`: the page `doc` reads for it under
`:page`, then the value under `:value`, which the words `page` and
`value` read. A name reads its own page, a value the page of the kind it
shows, and an error `!|` opened the page of its site, its value the
error at rest that `raise` raises again; a refusal the runtime raises by
rule under a word, with no page of its own, reads the page of what
refused; a value whose kind nothing declares is refused as
`::any/explain/UnknownNameError`. The page of a refusal says what
failed, which fact names the culprit and how the call is repaired, and
its laws hold the recovery through `!|`. An explanation prints the page
above the value. `trail` is a word of errors, `42 | trail` refused.

```qlang
> "x" | add 1 !| explain | payload | keys
#[:page :value]

> 42 | explain | value
42

> 42 | trail !| type
::error/trail/SubjectNotErrorError
```

## doc

A doc is the markdown of the language, the vector of its segments,
prose strings and quotes, under `::doc`. The parser reads the segments:
a `~(…)` whose text reads as code is a quote, under the tags written
before it, a span between backquotes and an unclosed quote are prose,
and each run of prose is one string, an empty one dropped. `content`
answers the text, each quote and its tags where it stands, written as
its literal spelled it, a quote assembled from data printed; `segments`
answers the parts, and `tag ::doc` builds a doc from a vector of strings
and quotes, a payload that is no vector refused as
`::doc/PayloadKindNotTakenError` and an element of another kind as
`::doc/ElementNotSegmentError`. A tag gives a quote a role, the tags of a
stack read from the outside in: `::link`, which `links` answers and
`open` follows to a page, and `::snippet`, which `snippets` answers and
`open` runs to what it shows; each is a kind of the core with a page,
and a role that asks a check of its own comes as a kind of its own. A
span between backquotes holds a fragment of the language that is no
query to run. A doc lays each tag of a quote's role through the tag's
label, so a tag that takes no quote refuses the doc.

```qlang
> |~~ a ~(add 1) b ~~| | segments
[" a " ~(add 1) " b "]

> |~~ a ::snippet~(1 | add 1) b ~~| | snippets | first | open
2
```

## page

`::qlang` is the topic of the language: its page is the first page,
its members are its chapters, the concepts the first page names, each a
page by its address, `::qlang/pipeline`, read through the noun,
`::qlang | doc :pipeline`. A concept's page tells in prose what it rests
on and what rests on it, with links to go deeper, and its value is the
set of the kinds that are it. A member of a noun is read through its
noun or at its address. The first page tells how to ask for a budget
before an answer meets a marker. Every link of every page of the catalog
opens a doc, every word of the core has a page, and the first page
prints within 13664 characters.

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
shared by several kinds carrying a tag of its own, and a key is short,
its meaning given by the field. The page of a kind names the concept it
serves. A chain is laid out a command a line, its pipe under the `f` of
`::fn` or the `k` of `::kind`, a command too long for its line standing
on three, its head, its page and its objects. The first page tells
the language whole in the order its parts rest on each other, each rule
once with an example whose answer it states, in base forms. An
example holds code under a bare name and runs it by `apply`, or hands
it bare to a word that takes code, and declares a word under a label
only where it shows a word, under the label of the values it serves. A
declaration is laid out its name on a line, each doc of its slot on the
lines after it indented two, and its value after them.
