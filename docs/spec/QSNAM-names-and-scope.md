# QSNAM · Names and scope

How a name is declared, what it holds, where it is seen, and what a bare
name reaches. The requirements of each section are the cases of its
file under `core/test/conformance/QSNAM/`, `scope.jsonl` for
[QSNAM#scope]; the blocks below are probes the tree answers.

## declare

One form declares every name: `:name body;`, which stands at the head of
its text, before the query [QSSYN#step], and adds a word with its page to
the scope of the text. The body, the step after the name and its page,
`:body` of the `::bind` a quote holds of the declaration [QSQUO#step],
runs once, where the declaration stands, with no subject: a verb called
there is refused as `::bind/SubjectNotGivenError` with its `:name`, and a
value of the subject is named for the steps after it by `with`
[QSPTH#template]. A failure of a declaration is the failure of its text,
which declares nothing and runs no query, the failure passing every `!|`
of the text to whoever reads it, the host, `parse | answer`, `answer` or
`apply` [QSERR#flow].

A text declares the words its query reads: a verb or a recipe under the
label of the values it serves, `:number/double ~(mul 2);`, a kind by its
chain or by its page alone, `:Box |~~ A box. ~~|;`, a page under a noun
among them, a law under a noun,
`:Box/fits |~~ A box fits. ~~| ::law~(true);`, a node of data under an
address, a word every code reads, and a value under a bare name, a
constant the query reads where a value stands and the code its steps write
carries, while code held as data withholds it and the body of a word does
not see it [QSQUO#held]. A chain, a tag name and the commands joined to it
up to the `;`, builds a word, a kind, a function, a page or a law, under a
noun the recipe of a verb among them, and one that answers any other
value is refused as `::bind/ChainAnswersNoWordError` with its `:name` and
what it answered as `:found`. A text of declarations alone answers the set
of the addresses it declared, `:Box |~~ A box. ~~|` answering `#[::Box]`.
Inside a command a name holds a value: in a modifier, in a quote, which
declares names of its own, and in the recipe of a verb, whose inputs its
call declares [QSBLD#recipe].

The body is a step: a literal, a group for what the group computes, a
name for the value it holds, a quote, which is held as the value it is, a
keyword, a tag name, a doc, or a chain, and a word after the body is
refused naming the `;`. A page written between the name and the body is
the name's page. A quote in a declaration is held as its literal and runs
in the lane of the step that runs it [QSQUO#held]; a verb declared under a
label reads the tree as it stands where it is called [QSNAM#verb]; and a
value is computed once, at the declaration.

```qlang
> :number/double ~(mul 2); :Box |~~ A box. ~~|; 5 | double
10

> :rate 2; [1 2] | map ~(mul rate)
[2 4]

> :Box |~~ A box. ~~|; :Box/k 3; :number/f ~(Box/k); 5 | f
3

> {:price 4 :qty 3} | with {:order ~it} ~(get /price | mul (order | get /qty))
12

> 5 | apply ~(:rate |~~ The rate. ~~| 2; mul rate)
10

> get [~(~(:size (count); 1) | answer !| get [~(tag) ~(name)]) ~([1 2 3] | with {:size ~count} ~(map ~(mul size)))]
[[::bind/SubjectNotGivenError :count] [3 6 9]]

> get [~(:Box |~~ A box. ~~|;) ~(~(:Box |~~ A box. ~~| ::vec | manifest;) | answer !| get [~(tag) ~(found | tag)])]
[#[::Box] [::bind/ChainAnswersNoWordError ::set]]

> apply ~(:noun ::vec; noun)
::vec

> ~(:rate 2;) | first
::bind{:name :rate :body 2}

> ":noun ::vec it" | parse !| message | contains "a declaration ends with `;` before what follows it"
true

> 5 | apply ~(:bonus 10; :rule ~(add bonus); apply rule !| tag)
::call/ValueWithheldError
```

## letters

A name a step can call begins with a letter of any script or `_` and
goes on with letters, digits, `_` and `-`, and a tag is written in the
same letters, while a key of a path may begin with a digit or `-` as
well, `/1a`; names joined by `/` make a name with a path
[QSNAM#address]. A bare name in quotes declares that name, and a
name in quotes that a step cannot call is refused by the parser at the
keyword. The words of the literals, `true`, `false` and `null`, are read
by a step as the literals, so each declares a label, which its tag
reaches where the root holds no label of that name, a label of the root
staying the root's, `::null` among them, and its nodes are read by their
tags, `::false/rank`, the parser refusing a step `false/rank`; or a last
name under a noun, which its address calls.

```qlang
> apply ~(:имя 5; имя)
5

> apply ~(:"foo" 5; foo)
5

> ":true 5 | 7" | parse !| message
"`:true` is the word of a literal, which a step reads as the value: declare another name"

> apply ~(:false |~~ F. ~~|; :false/rank 3; ::false/rank | binding | value)
3

> "false/rank" | parse !| tag
::quote/ParseError

> {"1a": 1} | get /1a
1
```

## value

A bare name that holds a value answers the value where a value stands:
at the head of a query, the declarations of its text before it, after
`!|`, and as
what a verb takes, a modifier and a part of a template among them, a
quote among values, the name alone reading its quote. Code under a bare
name runs by `apply`, and a quote or a path under it goes bare into an
input that takes code, held as its literal [QSQUO#held], a function to
`apply` alone [QSQUO#modifier]. Written as a later step, a name that holds
a value would drop the subject the steps before it answered, as a literal
written there would, so it is refused as `::call/ValueAsALaterStepError`
with its `:name`, its value as `:found` and the `:addresses` of the verbs
of its name, and a node of data read by its address is refused there
alike. A name that holds a value, called with modifiers, is refused as
`::call/ValueTakesNoModifiersError` with its `:name`, the name as it was
declared, its value as `:found` and the `:addresses` of the verbs of its
last name.

```qlang
> apply ~(:double ~(mul 2); double)
~(mul 2)

> 5 | apply ~(:double ~(mul 2); apply double)
10

> [1 2 3] | apply ~(:double ~(mul 2); map double)
[2 4 6]

> 7 | apply ~(:rest 5; add 1 | rest) !| get [~(tag) ~(name) ~(found)]
[::call/ValueAsALaterStepError :rest 5]

> apply ~(:bonus 5; bonus 42) !| get [~(tag) ~(found)]
[::call/ValueTakesNoModifiersError 5]

> apply ~(:Box |~~ Box. ~~|; :Box/side 3; Box/side 1 !| name)
:Box/side

> :string/five ~(1); 3 | apply ~(:five 5; five 42 !| addresses)
#[::string/five]
```

## verb

A name with a path under the label of the values it serves declares a
verb where its value is a function or a recipe,
`:number/double ~(mul 2)`: the recipe runs on the subject at each
mention, the last name of its address calls it, and so does the address
written as a step. `~double` hands the verb on as code. A verb reads the
verbs and the nodes of the tree as the tree stands where it is called,
so a verb calls itself by its name. The evaluator counts the nesting of
the code it runs beneath a step, its evaluation depth: the recipe of a
verb, a modifier the call computes, `apply`, the constructor of a tag
and each run of the code a verb runs go one deeper than the step that
called them, an input read by its selector and a modifier of an atom
meeting the limit one deeper than the call, while the steps of one
pipeline and a group run at its depth and a quote written as a modifier,
handed to the call as it is, goes no deeper; a run past the limit, a
call that recurses without end among them, is refused as
`::call/EvaluationDepthExceededError` with its `:depth` and `:limit`.

```qlang
> :number/double ~(mul 2); 5 | double
10

> :number/inc ~(add 1); 5 | inc | inc
7

> :number/plus10 ~(add 10); [1 2 3] | map ~plus10
[11 12 13]

> :number/inf ~(add 1 | inf); 0 | inf !| get [~(tag) ~(payload | keys | has :depth) ~(payload | keys | has :limit)]
[::call/EvaluationDepthExceededError true true]
```

## scope

A step runs on a state of two parts, the value in the pipe and its
scope, the names in force where it stands over the root, a recipe's those
its call opens [QSBLD#recipe]. A scope is shared by the declarations of
one text and its query. A name is declared once in a scope, counted in
the declarations as they are written: the second declaration is refused,
`::bind/NameDeclaredTwiceError` with `:name`, the failure of the text,
its frame the declaration and the steps after it [QSERR#trace]. The nodes
the chain of a noun lays under its address, the page of the payload of a
kind, its fields, the inputs of a function and their refusals,
invariants, laws and pages, count as declared by the declaration of the
noun, so a later declaration of its text that declares one of their
addresses is refused as well, while a name beside them stands.

A group and each run of a quote are scopes of their own: a modifier, a
part of a template of `get`, the code `map` runs on each element. A
declaration there stands over the name of the scope around, and a name
declared there stays there.

The recipe of a function runs in the scope its call opens
[QSBLD#recipe]: the recipe, or a step of its pipeline, that declares
`args` or an input is refused as a second declaration, while a group of
the recipe and a quote it runs are scopes of their own, where an input
may be shadowed, and a verb the recipe calls runs in a scope its own
call opens anew. What the recipe declares stays in it. A source is the
scope of its text, and a cell of a notebook is a scope of its own, so a
cell after another reads the words and the values a cell before it
declared and declares again any name or node a reader declared, under the
reader's noun or under one of the root, while a cell whose declaration
failed declared nothing.

```qlang
> apply ~(:rate 1; :rate 2; rate) !| get [~(tag) ~(name)]
[::bind/NameDeclaredTwiceError :rate]

> ~(:Box |~~ A box. ~~| (::kind | wires :width |~~ The width. ~~| /width ::number); :Box/width ~(2)) | answer !| get [~(tag) ~(name)]
[::bind/NameDeclaredTwiceError :Box/width]

> :Box |~~ A box. ~~| (::kind | wires :width |~~ The width. ~~| /width ::number); :Box/area ~(width | mul 2); get [~(::Box{:width 3} | area) ~(:Box/width ~(2); ::Box{:width 3} | width)]
[6 2]

> apply ~(:rate 1; (:rate 2; rate))
2

> apply ~(:rate 1; [2 3] | map ~(:rate 5; rate) | get [~(it) ~(rate)])
[[5 5] 1]

> apply ~(:rate 1; get [~(:rate 2; rate) ~(rate)])
[2 1]

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 | impl ~(:by 3; add by)); 1 | plus 2 !| get [~(tag) ~(name)]
[::bind/NameDeclaredTwiceError :by]

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 | impl ~((:by 3; by) | add by)); 1 | plus 2
5
```

## reach

A bare name reaches, nearest first: a name the code declares, a value a
quote declares, a name `with` gives its body, an input its call declares
in a recipe and a value the step wrote at the head of the code among
them, which stands over a verb of its name for the steps after it, the
verb called by its address; a verb residing on a label the walk of the
subject's tags reaches; and the one verb of that name whose `on` names no
kind, which refuses a subject the walk does not bring to its label, a
verb whose `on` names kinds reached by the walk or by its address alone
[QSDSP#residence]. A node of data under a
noun, a chapter of a topic among them, is read by its address alone. A
name that reaches nothing is refused as `::call/UnknownNameError`, with
the names near it, and a name whose verbs reside on several kinds, none
of which the walk reaches, as `::call/KindAnswersNoVerbError`
[QSDSP#refusal].

A label, a topic among them, is reached by its tag, `::string`, as it is
written wherever it is meant; its name written bare is the reader's to
declare, and undeclared, where no verb of that name answers the subject,
it is refused as `::call/UnknownNameError`, its `:nearest` naming the
tag first. A reader's bare name stands over a bare name of the root,
while the tag of a label of the root stays the root's; a label of the
reader goes into a verb of the root for its tag alone, its bare name
reaching nothing there, so a verb of the root calls the verbs of the
names it writes past a label the reader named so.

```qlang
> 5 | string !| nearest
[::string]

> 5 | pipeline !| tag
::call/UnknownNameError

> apply ~(:count 5; count)
5

> apply ~(:count 5; [1 2] | count) !| get [~(tag) ~(addresses)]
[::call/ValueAsALaterStepError #[::map/count ::string/count ::vec/count]]

> apply ~(:count 5; [1 2] | vec/count)
2

> ::order{:id 100 :item :bigmac :count 2} | with [/count] ~(get [~(count) ~(map/count)])
[2 3]

> :sum |~~ A sum of a bill. ~~|; {:price 4 :tax 1} | sumOf /price /tax
5
```

## address

The names form one tree, every node a binding of a name, its page and
its value, and a node is what lies under a noun at its address,
`::vec/sort` under `::vec`, `manifest` answering the nodes one name
under a noun. A name with a path declares a node under the noun its
path names before its last name, a noun declared before it, else
`::bind/NounNotDeclaredError`; the tag of a name is its address, the
name as it was declared. A noun is the name an address names before its
last name, a label, a verb or a name of data, as the value of its
binding says. A label is a kind declared under a name, by the chain that
builds it from `::kind` or by its page alone, which declares a kind of
no commands: its verbs reside on it, its nodes lie under its address,
`::host | kinds` answers it where its name is of one segment [QSNAM#root], and a
value goes under its tag through the kind [QSBLD#label]. A verb is a
function named under a label, whatever recipe it holds, or a recipe
written alone there, the value its declaration wrote, what runs on the
values of its label [QSNAM#verb];
under it lie
the roles of its chain, its subject, its inputs, its answer, its
refusals and the facts they carry, its invariants and its laws, so what
a verb is is the set of the nodes under its address, and a helper
several verbs share is a node under their noun. Any other value is data.

Written as a step, an address reads what it declared, a verb run on the
subject its residence serves [QSDSP#residence] and any other value
itself, whatever the subject; a
node that holds data is read by its address alone, its last name no bare
name. An address no declaration
names, written as a step, is refused as `::call/UnknownAddressError`
with its `:address` and the tag names near it as `:nearest`. A tag no
declaration names and the tag of a verb lay themselves over a payload as
it is, and the tag of a refusal, an invariant's among them, lays the kind
of the refusal over an error at rest alone [QSERR#rest].

The root holds the nodes of the language and of its hosts. A reader
extends a noun of the root with nodes of its own and declares no name
with a path the root holds, `:vec/count ~(0)` refused as a second
declaration; a bare name of the root it may declare over [QSNAM#reach].

```qlang
> apply ~(:Box |~~ Box. ~~|; :Box/side 3; Box/side)
3

> ~(:Box/side 3;) | answer !| tag
::bind/NounNotDeclaredError

> :vec/second ~(get /1); [7 8 9] | second
8

> ::vec | manifest | has ::vec/sort
true

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | throws :TooBigError |~~ Too big. ~~| | returns |~~ The sum. ~~| ::number | impl ~(add by)); ::number/plus | manifest
#[::number/plus/ByKindNotTakenError ::number/plus/TooBigError ::number/plus/answer ::number/plus/by]

> ::Nobody[1 2] | tag
::Nobody

> :number/inc (::fn | impl ~(add 1)); :number/next ~(add 1); get [~(::number/inc | binding | value | tag) ~(::number/next | binding | value | tag) ~(5 | inc) ~(5 | next)]
[::fn ::quote 6 6]

> get [~(5 | number/add 1) ~("x" | number/add 1 !| tag) ~(::vec/take/CountNotIntegerError#5 !| tag)]
[6 ::number/add/SubjectNotNumberError ::vec/take/CountNotIntegerError/PayloadKindNotTakenError]
```

## root

The root is a scope: the one the host's sources declare, each source a
text run over the root the sources before it left, the language's
first, before the first step of a reader. A source, a cell and a query
are written alike; a source declares no name the root holds, bare or
with a path, and fails whole as
`::builtin/RootSourceNotDeclaredError`, a defect of the host raised past
the fail track, and no value under a bare name, which serves the query of
its own text and reaches no reader, as `::builtin/RootValueNotWordError`,
while data under an address is a node of the root and a cell and a query
declare a bare name of the root over it. The root holds no value under a
bare name, so its bare names are its labels alone, `::host` among them,
the host a session is in, whose page a source of the host writes by a
declaration of its page alone, `:host |~~ … ~~|;`, which the root lays
over the noun of the core once [QSHST#source]. A binding records its
`:origin`, the source or the cell it was read from. `::host | kinds`
answers the set of the labels of one segment the scope reads, the
language's, the hosts' and the reader's, the topics among them: the topic
of the language is the label `::qlang`, whose page is the first page, and
the noun of the streams a host on the command line installs `::stdio`.
What `tells` declares under a topic is a chapter, the page of a concept,
read by `manifest` of its noun; a chapter of `::qlang` holds the set of
the kinds it tells of, data, so its tag lays nothing,
`::qlang/values[1]` refused as `::construct/TagNamesAValueError`, and the
refusal the topic throws holds the kind of the facts it carries.

```qlang
> ::vec/filter | binding | origin
:qlang/vec

> :Box |~~ Box. ~~|; ::host | kinds | get [~(has ::vec) ~(has ::Box)]
[true true]

> get [~(::host | kinds | has ::qlang) ~(::qlang | binding | value | tag) ~(::qlang | manifest | map ~(binding | value | tag) | toSet) ~(::qlang/values[1] !| tag)]
[true ::kind #[::doc ::kind ::set] ::construct/TagNamesAValueError]
```

## binding

A declaration writes into its scope a record, `::binding`, a map whose
kind wires its five parts, so its tag is closed and its parts are read by
their names, bare [QSBLD#value]: `name`, a keyword, `docs`, the docs of
its page, `value`, `source`, the declaration, null for a node a chain
lays, and `origin`, a keyword or null, `::Box/side | binding | value`; a
record a reader writes is refused where it leaves one out,
`::binding{:name :rate}` as `::binding/DocsNotGivenError`. `::host | env` answers
the declarations of the reader where the step stands, in the recipe of a
verb those of the query that called it [QSNAM#owner], in code its own
names and the nodes and the labels of the step it runs in [QSQUO#held],
each by its name with its record, `{}` where the reader declared nothing.
`binding` reads the record itself, `doc` its page, and `source` every
declaration written under the name's address, the record's `:source`
holding the step of the one that wrote it; given an anchor, each reads
the node its subject holds under it [QSSLF#axis].

```qlang
> apply ~(:Box |~~ A box. ~~|; :Box/side |~~ The side. ~~| 3; ::Box/side | binding | get [~(name) ~(docs | count) ~(value) ~(keys !| tag)])
[:Box/side 1 3 ::map/keys/SubjectNotMapError]

> get [~(::binding{:name :rate} !| tag) ~(:Box |~~ A box. ~~|; :Box/side |~~ The side. ~~| 3; ::Box/side | binding | eq (print | parse | answer))]
[::binding/DocsNotGivenError true]

> apply ~(:rate 2; ::host | env | get [~(has :rate) ~(has :vec)])
[true false]

> :Box |~~ A box. ~~|; :Box/side |~~ The side. ~~|; apply ~(:rate 2; ::host | env | keys)
#[:Box :Box/side :rate]

> :Box |~~ A box. ~~|; :Box/side |~~ The side. ~~|; ::Box/side | doc
|~~ The side. ~~|

> ::vec/count/answer | source
null

> ::vec/take | binding :count | name
:vec/take/count
```

## owner

A verb of the root runs in a scope marked as the root's. There a name
under a noun of the root reads the root alone, so a verb a reader
declared under it answers the reader's own calls; a name under a noun
the reader declared reads as the reader wrote it, and a label of the
reader goes into the verb for its tag alone [QSNAM#reach]. A verb joined
to a kind by the kind's owner goes where the kind's values go; an
extension of a kind of another owner stays where it was written.

A verb written in the language and a verb of the host answer alike.
Inside the recipe of a verb, the names the recipe writes resolve in the
verb's own scope [QSBLD#recipe], and what the recipe reads as data,
`::host | env`, a page, a binding, reads the tree of names of the query that
called the verb, as a verb of the host that reads the state of its call
reads that tree wherever it is called; the tree carries down through
every verb the recipe calls. The recipe's own names, its inputs and the
names its steps declare, stay in its scope, and a value of the reader
reaches the recipe as data alone.

```qlang
> :vec/doc ~("a reader page"); [1 2] | doc
"a reader page"

> :vec/doc ~("a reader page"); [1 2] | tutorial | first | tag
::doc

> :Box |~~ A box. ~~|; :any/names ~(:rate 2; ::host | env | get [~(has :rate) ~(has :Box)]); names
[false true]
```
