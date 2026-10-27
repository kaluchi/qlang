# QSSLF · The language describes itself

Every name has a page, every page its laws, and a reader asks the
language itself what a name means, what lies under it and what holds of
it. The requirements of each section are the cases of its file under
`core/test/conformance/QSSLF/`.

## axis

The axes, verbs of every value, read a name: `doc` its page, `source`
every declaration written under its address, null for a node a chain
lays, a law and a chapter among them, `binding` the record of its
binding [QSNAM#binding], `manifest` the nodes under it and `laws` its
laws. A value is read by its kind, `5 | doc` the page of `::number`, an
error at rest the page of the refusal it carries, the page that says how
the call is repaired, a keyword among values, a value under a tag
nothing declares by the first kind its stack of tags declares from the
outside in, the kind of the core beneath them last, so
`::Box{:a 1} | doc` is the page of `::map`; and a name by its tag, the
address of its node, `::vec/count | doc`, a label of the root from the
root and any other name at its nearest declaration. The page of a verb
is one value, whichever axis reaches it: `doc`, `binding | doc`,
`tutorial | first` and the anchor of its noun, `::vec | doc :sort`.

`binding`, `doc`, `laws`, `manifest`, `runLaws` and `source` take an
anchor, `:anchor`, a keyword, the last name of a node, and read the node the subject holds
under it: the node at the address of a tag name, an input of a verb
among them, `::vec/take | binding :count`, or else the verb of that name
the walk of the subject's tags reaches, `[1 2] | doc :count` the page of
`::vec/count`. `doc` takes as well a vector of anchors, read in turn,
each under the node the one before it reached,
`::vec | doc [:take :count]`, the empty vector the page of the subject
itself, and a set of anchors, a page at each in the order of the set,
null and a vector of anchors among them. An anchor of another kind is
refused under the input, `::any/source/AnchorKindNotTakenError` and its
kin, a name read in turn that is no keyword as
`::any/doc/AnchorNameKindNotTakenError`, its index in its vector its
`:index`, and an element of a set that is neither null, a keyword nor a
vector as `::any/doc/AnchorElementKindNotTakenError`, its index in the
one order of the set its `:index`; `tutorial`, which pairs the page and
the laws of the name its subject reads, takes no anchor, refusing one as
`::any/tutorial/ArgsBeyondInputsError`.

A tag nothing declares whose last name ends in `Error` reads the record
of the address before it, the call of a function, `::fn/call`, among them
[QSBLD#fn]; any other name nothing declares is refused
under the axis that read it, `::any/doc/UnknownNameError`, named by the
tag asked, with the addresses where the verbs of its last name live and
the names near it, and so is an anchor no node answers, named by the
keyword asked. A name declared without a page answers null. The error at
rest a catch holds reads the page of its site; a refusal the runtime
raises by rule under a verb or a kind, with no page of its own, reads the
page of what refused, the verb or the kind one level above it, the refusal
of the kinds of an input, a field or a payload the page of that part, and every such refusal of the catalog has
its page with its repair. The page of a refusal says what failed, which
fact or which path of the frame names the culprit and how the call is
repaired, and the laws of a refusal a query can meet hold the recovery
through `!|`, a defect of the runtime and a failure inside a primitive a
host hands, which no query of the language raises, holding none. A map is
read by its kind whatever its fields hold, `{:kind ::set} | doc` the
page of maps, and a label may declare a `doc` of its own, which its
values answer before the verb of every value. A reader adds an axis of
its own by laying a tag over values and declaring verbs on the tag.

```qlang
> 5 | doc | eq (::number | doc)
true

> :limit | doc | eq (::keyword | doc)
true

> ::map | doc :minus | eq (::map/minus | doc)
true

> ::vec/sort | get [~(doc) ~(binding | doc) ~(tutorial | first) ~(::vec | doc :sort)] | toSet | count
1

> ::vec/take | source 1 !| tag
::any/source/AnchorKindNotTakenError

> ::nosuchbinding | doc !| get [~(tag) ~(name)]
[::any/doc/UnknownNameError ::nosuchbinding]

> "x" | add 1 !| doc | eq (::number/add/SubjectNotNumberError | doc)
true

> 5 | gte !| get [~(tag) ~(doc | content | contains "comes after")]
[::any/gte/ValueNotGivenError true]

> ::number/add/FooError | binding | name
:number/add

> get [~(5 | apply (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) ["x"] !| get [~(tag) ~(doc | eq (::fn/call | doc))]) ~(::fn/call/refusesArgsPastItsInputs/FooError | binding | name)]
[[::fn/call/ByKindNotTakenError true] :fn/call/refusesArgsPastItsInputs]
```

## manifest

`manifest`, an axis, answers the set of the nodes one name under the
name its subject reads, each by its address: the verbs of a noun, its
refusals and its pages, and the roles the chain of a function or a kind
lays under its name, the subject, the inputs and the answer of a verb,
the payload, the fields and the constructor of a kind, the refusals of
its slots and of its fields, the invariants, each named by the refusal of
a call or a value that breaks it, and the parts a kind wires, the facts a
refusal carries among them, which lie under it by its wiring, the slots
of its verb and their parts beneath each slot,
`::number/add/AddendKindNotTakenError | manifest` [QSERR#site]; the laws
stand aside, which `laws` reads. A value
answers those of the kind it shows, `5 | manifest` those of `::number`,
and a name nothing declares is refused as
`::any/manifest/UnknownNameError`; an anchor reads the node the name
holds under it, as `doc` reads one. A noun lists what is declared under
it alone: the verbs a set answers as a vector lie under `::vec`, which
the walk of its tags reaches, so `::vec | manifest` lists the verbs a
set answers beside its own. The topic of the language lists its
chapters and the refusal of an answer past the budget, and a noun the
refusals its source declares.

```qlang
> ::vec | manifest | has ::vec/count
true

> ::qlang | manifest | get [~(has ::qlang/values) ~(has ::qlang/AnswerBeyondBudgetError)]
[true true]

> :Box |~~ A box. ~~| (::kind | wires :w |~~ The width. ~~| /w ::number) | ::Box | manifest
#[::Box/WKindNotTakenError ::Box/w]

> ::vec/take/count | manifest
#[::vec/take/count/answer ::vec/take/count/expected ::vec/take/count/found ::vec/take/count/index]

> ::vec/take/CountNotIntegerError | binding | value | tag
::invariant

> ::vec | manifest :take | eq (::vec/take | manifest)
true

> get [~(::set | manifest | has ::set/count) ~(#[3 1 2] | count) ~(#[3 1 2] | binding :count | name)]
[false 3 :vec/count]
```

## laws

A law is a query that answers `true`, a quote under `::law` by its own
tag, a quote under another tag and any other value refused, `::law#3` as
`::law/PayloadKindNotTakenError`, declared
under the name whose claim it proves, by the command `proves` of a chain
or by a name of its own, `:three/isThree ::law~(3 | eq 3)`, its page the
claim. `laws` answers a map from the name of each law under a name, or
under the node the subject holds under an anchor when it is given one,
`::qlang | laws :errors`, in the order of their declarations, to the pair
of its page and its query, and refuses a name nothing declares as
`::any/laws/UnknownNameError`; `runLaws` runs each as held code on null
[QSQUO#held], the laws under an anchor as `laws` reads them,
`::qlang | runLaws :errors`, and answers an outcome per law,
`{:law :says :actual :error :ok}`, `:says` null for a law without a
page, a law passing only where it answers `true` and a law that answers
a failure holding it at rest under `:error`; a value runs the laws of
its kind, and a name nothing declares is refused as
`::any/runLaws/UnknownNameError`. `tutorial` answers the pair of a
name's page and its laws, a name nothing declares refused as `doc`
refuses it. Every law of the core passes.

```qlang
> :Box |~~ A box. ~~| | :Box/holdsItsWidth ::law~(::Box{:width 1} | get /width | eq 1) | ::Box | runLaws | map /ok
[true]

> ::law::Foo~(3 | eq 3) !| get [~(tag) ~(found | tag)]
[::law/PayloadKindNotTakenError ::Foo]

> ::number/add | laws | count
4

> kinds | toVec | apply ~(:level1 it | map ~(manifest) | flat | :level2 it | map ~(manifest) | flat | :level3 it | map ~(manifest) | flat | :level4 it | map ~(manifest) | flat | :level5 it | get [~(level5 | map ~(manifest) | flat | count) ~(get [~(level1) ~(level2) ~(level3) ~(level4) ~(level5)] | flat | every ~(runLaws | every /ok))])
[0 true]
```

## near

A name that reaches nothing, a tag nothing declares and an anchor no
node answers are refused with `:nearest`, the names near the one
written, in the order of their spelling: the names within a slip of the
hand, an insertion, a deletion, a substitution or a swap of two
neighbours, up to a third of its length and one at least, the nearest of
them alone; beside them the names one of which begins the other, three
letters at least; and the names the page of a verb it begins with links
whose names end as it goes on, `addOf` meeting `sumOf`. Each stands
among the names the step could reach at the depth of the one written:
near a bare name the names a step reaches, a label of the root that is
no verb standing as its tag, its tag first where the name written is the
label's own; a tag among tags, an address among addresses, an anchor
among the nodes the subject holds and the verbs the walk of its tags
reaches, a key among the keys of the map a path missed. A name is no
guess for itself.

```qlang
> 5 | ad 2 !| nearest
[:add :and]

> ::str | doc !| nearest
[::string]

> ::qlang | doc :pipelin !| nearest
[:pipeline]

> {:a 1 :b 2} | addOf /a /b !| nearest
[:add :sumOf]
```

## doc

A doc is the markdown of the language, the vector of its segments, prose
strings and quotes, under `::doc`. The parser reads the segments: a
`~(…)` is a quote, under the tags written before it, and one whose text
reads as no code is refused, a span between backquotes is prose
[QSSYN#doc], and each run of prose is one string, an empty one dropped. The prose holds no whitespace at its edges and no indentation
its lines after the first share, a line of whitespace alone empty,
whatever built the doc, the parser, `tag ::doc` or the docs of a slot
joined into a page, so a doc holds one prose wherever its source indents
it. The segments compute nothing, a quote under the tag of a group among
them. `content` answers the text, each quote and its tags where it
stands, the quote written as `print` writes it, so two equal docs print
alike, a link and a snippet as the code they run; `segments` answers the
parts, of a doc under a tag as well, and `tag ::doc` builds a doc from a
vector of strings and quotes, joining strings that stand together and
dropping an empty one, as the parser does, a payload that is no vector
refused as `::doc/PayloadKindNotTakenError` and an element of another
kind as `::doc/ElementKindNotTakenError`. A tag gives a quote a
role, the tags of a stack read from the outside in: `::link`, which
`links` answers, whose code answers the name of a page and which `open`
opens to that page, and `::snippet`, which `snippets` answers and which
`answer` runs to what it shows, the code of either running by `answer`;
each is a kind of the core with a page, which holds a
quote by its own tag, or the other role, `::link::snippet~(…)`, so a tag a
host or a reader lays over a link keeps it a link, a quote under another
tag and `::link#5` refused as `::link/PayloadKindNotTakenError`, and a
role whose quotes hold an invariant is a label of its own. A doc is built
once from the values the labels of the tags of its roles lay over its
quotes, from the inside out, wherever it stands as a value, the docs of
the slot of a declaration among them: a tag that takes no quote refuses
the doc and the declaration that holds it as its page, and so does a
quote that breaks an invariant of its role, and `::quote~(add 1)` in a doc
is the quote itself; code holds a doc with the quotes of its roles as
written.

```qlang
> |~~ a ~(add 1) b ~~| | segments
["a " ~(add 1) " b"]

> ::Box|~~ a ~(add 1) b ~~| | segments
["a " ~(add 1) " b"]

> get [~(|~~ a ~(add   1) b ~~| | print) ~(|~~ see ::group~(add 1) ~~| | segments | count)]
["|~~ a ~(add 1) b ~~|" 2]

> get [~(|~~ a ::link~(::qlang) b ~~| | content) ~([" a\n     b "] | tag ::doc | content)]
["a ::link~(::qlang) b" "a\nb"]

> |~~ a ::snippet~(1 | add 1) b ~~| | snippets | first | answer
2

> |~~ a ::link~(::vec/sort) b ~~| | links | first | get [~(answer) ~(open | tag)]
[::vec/sort ::doc]

> get [~(::link#5 !| tag) ~(|~~ a ::Host::link~(1) b ~~| | links | count)]
[::link/PayloadKindNotTakenError 1]

> get [~(|~~ a ::link::snippet~(1) b ~~| | links | count) ~(::link::Foo~(1) !| get [~(tag) ~(found | tag)])]
[1 [::link/PayloadKindNotTakenError ::Foo]]

> :Role |~~ A role. ~~| (::kind | holds :k |~~ k. ~~| ~(count | gt 5)) | |~~ see ::Role~(x) ~~| !| tag
::Role/k

> get [~(|~~ see ::quote~(a) ~~| | segments | get /1 | eq ~(a)) ~(:x |~~ see ::map~(x) ~~| 1 !| tag)]
[true ::map/PayloadKindNotTakenError]
```

## page

`::qlang` is the topic of the language, a label whose page is the first
page, and `::cli` the topic of the command line. What `tells` declares
under a topic is a chapter, the page of a concept the first page names,
a node under the topic, `::qlang/pipeline`, read at its address or by
its anchor, `::qlang | doc :pipeline`, and listed by `manifest` of the
topic. A chapter tells in prose what it rests on and what rests on it,
with links to go deeper, and its value is the set of the kinds that are
it, data, so a chapter is no label [QSNAM#root]. The first page tells
the budget every answer prints within and the refusal of an answer past
it, the cell that keeps the answer and `answer` that reads it back, the
concentrate a failure prints as, a fact past its room the cell that keeps
it beside its tag, its views and its parts. Every link of every page of the catalog opens a
doc, every node one name under a label of the root has a page, and the
first page prints within 13664 characters.

```qlang
> ::qlang | doc | links | map ~open | every ~(tag | eq ::doc)
true

> ::qlang | doc :pipeline | tag
::doc

> get [~(kinds | has ::qlang) ~(::qlang | binding | value | tag) ~(::qlang/values[1] !| tag) ~(::qlang | manifest | has ::qlang/values)]
[true ::kind ::construct/TagNamesAValueError true]

> ::qlang | doc | content | get [~(contains "its views and its parts") ~(contains "the ::cell that") ~(contains "::qlang/AnswerBeyondBudgetError")]
[true true true]

> kinds | toVec | apply ~(:level1 it | map ~(manifest) | flat | :level2 it | map ~(manifest) | flat | :level3 it | map ~(manifest) | flat | :level4 it | map ~(manifest) | flat | :level5 it | get [~(level5 | map ~(manifest) | flat | count) ~(get [~(level1) ~(level2) ~(level3) ~(level4) ~(level5)] | flat | map ~(doc) | filter ~(eq null | not) | map ~(links) | flat | every ~(open | tag | eq ::doc))])
[0 true]

> kinds | map ~(manifest) | flat | every ~(doc | content | eq "" | not)
true

> ::qlang | doc | print | count | lte 13664
true
```

## catalog

A verb enters the catalog when it expresses what was inexpressible over the
values the language has, or shortens what every host would otherwise write;
the verbs and the nouns of a domain belong to its host. The core carries the
working set a shell would supply to every host, one with no shell around
its queries among them, the site's playground: the JSON codec both ways,
text as lines, `split` and `join`, trimming, replacing, case and search; a
host keeps its domain, its streams and its renderings. One sequence serves
them all, the vector, a string reading in pieces by `split`, `lines`,
`count`, `take` and `drop`.

A name a reader trained on other languages reaches for enters beside the
verb that answers what the habit expects, as `distinct` stands beside
`toSet`, `flatten` beside `flat`, `merge` beside `union` and `size` and
`length` beside `count`: a function under the same label whose recipe calls
the verb, its page naming the verb, so the fact keeps one spelling and the
name is another road to it. Where the habit expects another answer or
another call, the name is a verb of its own, as `concat` is, or none, since
a name that answers otherwise than the habit expects fails in silence.

The catalog is the reference of the language, and its pages follow one
form. A page is prose about the name it is declared with: what the name
is for and how it relates to the rest, its links and snippets standing
in its prose where it names them; how the name behaves is told by its
laws, each a definition under the name, so a behaviour the prose tells
and a law proves is told by the law alone. A definition is a story told
in the order a reader asks: a verb, its page, then its chain, its inputs
each with the refusal of its kinds, its answer, its refusals each with
the repair, its laws and its recipe last; a kind, its page, then its
chain, its payload, its fields, its refusals and their facts, its
invariants and its laws, and the constructor of a kind of the core last.
The page of a kind is a short article in one order: what the kind is,
the forms a reader meets with an example, how one is read and made, its
verbs, where it stands at the borders, and the links that go deeper. The
page of a tag is the legend of its payload: what the data beneath it is,
what each part means and which verbs carry it on; a field names its
kinds and stops there, a value shared by several kinds carrying a tag of
its own, and a key is short, its meaning given by the field. The page of
a kind names the concept it serves. A chain is laid out a command a
line, its pipe under the `f` of `::fn` or the `k` of `::kind`, a command
too long for its line standing on three, its head, its page and the
modifiers after its page. The first page tells the language whole in the
order its parts rest on each other, each rule once with an example whose
answer it states, in base forms. An example holds code under a bare name
and runs it by `apply`, or hands it bare to a verb that takes code, and
declares a verb under a label only where it shows a verb, under the
label of the values it serves. A declaration is laid out its name on a
line, each doc of its slot on the lines after it indented two, a doc of one
line on one line and a doc of several lines closing on a line of its own,
and its value after them.

```qlang
> [::number ::string ::vec ::map ::set] | map ~(binding | value | get /0 | map ~(get /name) | get [~(first) ~(last)]) | distinct
#[[:accepts :proves]]
```
