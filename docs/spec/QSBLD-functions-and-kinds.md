# QSBLD · A function and a kind built by commands

A function and a kind are built from their noun by a chain, the
commands written on it, which a call of the function and a value put
under the kind read; a function named under a label is a verb, and a
kind declared under a name a label [QSNAM#address]. The requirements of
each section are the cases of its file under
`core/test/conformance/QSBLD/`.

## fn

A function is a value of the kind `::fn`: the commands of its chain and
its recipe. It is built from the noun by a chain, each command a verb of
`::fn` whose subject is the function so far, and what a command writes
is named by the noun of the thing, no kind of the catalog bearing the
name of a command of a chain: `on` names its subject, its page and its
kinds, `takes` writes an input, `returns` the answer, `throws` a
refusal and the kind of its facts, `holds` an invariant of the subject, an input
or the answer, a quote under `::invariant`, `proves` a law, a quote under
`::law`, and `impl` gives it its recipe, code or a host's
`::builtin{}`, and answers the function it builds, `::fn | impl ~(add 1)`
the function of no commands `::fn[~() ~(add 1)]`; a command written after
`impl` joins the others and the recipe stays. The chain is the one
reading of what each command takes: the verb of a command hands it its
modifiers whole, as written, its input `modifiers`, and a step of the chain
written with modifiers its rules do not take is refused as
`::fn/CommandNotTakenError` whether its verb wrote it or the literal,
`:command` the command, `:index` the index of the modifier refused, from
zero, or of the first left out, and `:actualValue` that modifier: each name is written with its page, a doc,
the name of an input of one segment, neither `answer` nor `subject`,
which the chain lays itself, nor a word of a literal, a selector is a path
or a quote, and kinds are a tag or a set of one tag or more, or for an
input a vector of one of them. A name is declared once,
`::fn/NameDeclaredTwiceError` refusing a name declared again, an
invariant named as a refusal the runtime raises by rule under its input
or its answer among them, the refusal of the kinds and of an input left
out. A refusal and an invariant written with a path stand under the
subject, an input taken before it or the answer, an invariant always
written so, `::fn/NameUnderNoInputError` refusing one under none, and the
chain lays the subject and the answer where a name stands under them,
with no page where no command writes one; a law with a path stands under
a name declared before it, a refusal among them, `::fn/LawUnderNoNameError`
refusing one under none. The facts a refusal carries are the commands of
the kind of the refusal, the quote `throws` writes after its page,
`throws :TooBigError |~~ … ~~| ~(wires :bound |~~ The bound. ~~| ::number)`,
each `wires` a fact read by the key of its name and one carried at times
by `query`; `throws` builds the kind of them, its payload the `::error`
the refusal raises and its wiring ending with `trace`, a payload or a
`trace` the quote writes refused as `::kind/NameDeclaredTwiceError`, and
a refusal a rule of the chain lays carries the facts of the family of its
rule [QSERR#site]. The quote, no kind, stands in the commands, so the
literal of the function reads back as itself. Instead of the quote
`throws` writes the tag of a refusal whose kind its refusal shares,
`throws :ConditionKindNotTakenError |~~ … ~~| ::fn/KindNotTakenError`: the
error at rest of the refusal is closed by the kind that closes the refusal
the tag names, its facts read by their names and paged by the wiring of
that kind, and its node holds its page; a refusal that names itself, or a
round of them, shares no kind and stays open.

A verb serves the values of its label and of the kinds `on` names, of
tag names the noun's own alone [QSDSP#tagname], refusing any other
subject by its label; a function `apply` runs serves the kinds `on`
names, or any subject where it names none, another refused as
`::fn/call/SubjectKindNotTakenError` with the kinds as `:expected`; the
invariants of the subject hold of the subject served before the inputs
are read, their refusal holding its kind alone. A function prints as its
literal, the chain folded into a quote and its recipe after it, null for
a function with none, which the constructor of `::fn` reads back, a
payload that is no pair of the quote of a chain and a recipe refused as
`::fn/PayloadNotPairError`, a step of the quote that is no command its
chain takes as `::fn/CommandNotTakenError` and a recipe that is no code,
there or given by `impl`, as `::fn/RecipeKindNotTakenError`. `apply` hands a
function its args, a vector or a set, another value refused as
`::any/apply/args/KindNotTakenError`, and the call of the function is
refused under `::fn/call/…`, a function whose recipe it cannot run as
`::fn/RecipeMissingError`, a contract and a `::builtin{}` no host handed
with it [QSHST#source]; a quote or a path takes empty args alone,
`[]`, `#[]` or an empty vector under a tag, others refused as
`::any/apply/args/NotTakenError`; `fill` writes the args into the head
of its code, refused under `::fn/call/…` as a call and, for a function
whose recipe is no quote, a primitive's or none, as
`::fn/fill/RecipeKindNotTakenError` at the path of the recipe; and `inputs` answers its inputs, each a
map of its name, its page, its selector and its kinds as written.

```qlang
> ::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by) | print
"::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)]"

> :f ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | 5 | apply f [3]
8

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | fill 3
~(:by |~~ How much. ~~| 3 | add by)

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | inputs | map /name
[:by]

> get [~(::fn | impl ~(add 1)) ~(::fn | takes 5 |~~ x ~~| /0 !| get [~(command) ~(index) ~(actualValue)]) ~(-5 | apply (::fn | holds :subject/NotAboveZeroError |~~ Above zero. ~~| ~(gt 0) | impl ~(add 1)) [] !| tag)]
[::fn[~() ~(add 1)] [~(takes 5 |~~ x ~~| /0) 0 5] ::fn/call/subject/NotAboveZeroError]

> get [~(::fn[[] ~(1)] !| tag) ~(::fn | returns |~~ A. ~~| #[] !| tag) ~(::fn | takes :null |~~ w ~~| /0 !| tag)]
[::fn/PayloadNotPairError ::fn/CommandNotTakenError ::fn/CommandNotTakenError]

> 5 | apply ~(add 1) [3] !| tag
::any/apply/args/NotTakenError

> kinds | inter #[::accepts ::holds ::impl ::on ::proves ::returns ::takes ::tells ::throws ::wires]
#[]

> :number/plus (::fn | takes :by |~~ How much. ~~| /0 | throws :TooBigError |~~ A sum past a bound. ~~| ~(wires :bound |~~ The bound. ~~| ::number) | impl ~(add by)) | get [~(::number/plus/TooBigError!{:bound 3} | bound) ~(::fn | throws :E |~~ e ~~| ~(accepts |~~ p ~~| ::map) !| tag) ~(::number/plus | binding | value | print | parse | open | eq (::number/plus | binding | value))]
[3 ::kind/NameDeclaredTwiceError true]
```

## input

An input, `takes :by |~~ How much. ~~| /0 ::number`, has a name, a page,
its selector over the args, and its kinds. The selector is a path read
strictly, `/0` the first arg, `/-1` counted from the end, `/0/by` the
key `by` of the first; one of two forms read as written and never run,
which no verb named `query` or `it` reaches, `~(query /0 3)`, the first
arg or, where the call gives none, what `3` answers over the args, null
where none is written, and `~(it)`, the args whole; or any other quote,
code over the args that runs one deeper in the evaluation depth than the
call [QSNAM#verb]. The args of a
call, the values its modifiers computed against the subject, are a value
under the tag of its verb, `::number/add[1 2]`, which reads back as it
prints; inside a recipe `args` reads them, and the counts of `coalesce`
and `cond` are the invariants of their inputs.

An input holds a value of its kind the walk of its tags reaches, a recipe
the value as the call gives it, its tags with it, and a primitive the
value the walk reaches [QSDSP#answer]: a value of none is refused under
the input as `…/by/KindNotTakenError`,
the kinds it takes its `:expected`, a set of tags, and the value of an
input of each element that is no vector as of no `::vec`; an arg the
call leaves out, read strictly by a path or by code, as
`…/by/NotGivenError`, and a path that meets a value it cannot read with
the path's refusal, `::path/SubjectHasNoPartsError`; args past the
arity of the function, the most args its inputs read where every input
reads the arg at an index, by a path from it or by `query` of one, under
the call as `…/ArgsBeyondInputsError` with the arity as `:arity`, while an
input that reads `/-1`, the args whole or an arg by any other code, `~(get /0)` among it, takes any
number; and a value that breaks an invariant under the invariant's name,
the invariant holding of the value as the call gives it, its tags among
it, which the refusal holds as `:actualValue`. Kinds written as a vector
of one tag or of one set are the kinds of each element: the input holds
a vector, or a set, of the value of each, a recipe each as given, a quote
and a doc as they are, a value that is no vector refused as `…/KindNotTakenError`
and an element of none as `…/ElementKindNotTakenError` with its
`:index`.

```qlang
> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(5 | plus 2) ~(5 | plus "x" !| tag) ~(5 | plus !| tag) ~(5 | plus 1 2 !| tag)]
[7 ::number/plus/by/KindNotTakenError ::number/plus/by/NotGivenError ::number/plus/ArgsBeyondInputsError]

> :vec/top (::fn | takes :n |~~ The n. ~~| ~(query /0 3) ::number | impl ~(sort | reverse | take n)) | [5 1 4 2] | get [~(top) ~(top 1)]
[[5 4 2] [5]]

> :m (::fn | takes :xs |~~ X ~~| /0 [::number] | impl ~(xs)) | get [~(5 | apply m [5] !| tag) ~(5 | apply m [[1 "a"]] !| get [~(tag) /index])]
[::fn/call/xs/KindNotTakenError [::fn/call/xs/ElementKindNotTakenError 1]]

> 1 | add 1 2 !| actualValue
::number/add[1 2]

> :vec/it ~(99) | :vec/query (::fn | takes :p |~~ P. ~~| /0 | takes :d |~~ D. ~~| ~(query /1 null) | impl ~(99)) | :number/w (::fn | takes :cs |~~ C. ~~| ~(it) | impl ~(cs)) | :number/a (::fn | takes :by |~~ B. ~~| ~(query /0 1) | impl ~(add by)) | 5 | get [~(w 1 2) ~(a) ~(a 2)]
[::number/w[1 2] 6 7]

> get [~(:any/m (::fn | takes :x |~~ The x. ~~| /0 ::number | impl ~(x)) | null | m ::Width#5) ~("abc" | take ::N#2)]
[::Width#5 "ab"]
```

## answer

`returns` names the kinds of the answer of a function, at least one,
`::fn/CommandNotTakenError` refusing none given and an empty set alike;
a failure the recipe answers passes as it is. An answer the walk of whose tags reaches one of the
kinds other than the verb's own label stands as it is, `::W#5` where
`returns` names `::number`; an answer of the verb's own label goes under
the tags its operands share [QSDSP#answer], held to the label, and stands
as it is where none is laid; and where the walk reaches none, the one kind `returns` names makes the
answer as a value is put under it [QSBLD#value]. An answer of none of the
kinds, a payload the one kind refuses for its kind among them, is
refused as `…/answer/KindNotTakenError` with the kinds as `:expected`,
while an invariant of the kind refuses under its own name. A function
whose `returns` names `::any`, or that has none, hands its answer on as
it is.

```qlang
> :Box |~~ B ~~| | :Box/half (::fn | returns |~~ The half. ~~| ::string | impl ~(get /0 | div 2)) | ::Box[4] | half !| tag
::Box/half/answer/KindNotTakenError

> :any/f (::fn | returns |~~ r ~~| ::number | impl ~(::W#5)) | 1 | f
::W#5
```

## recipe

A recipe is the code a function runs, which `impl` gives it, or a quote
written alone under a label, the function of no commands it is. It runs
in the scope its call opens: the root, the nodes and the labels of the
scope the call is made in, the verbs among them, the args as `args`,
each input by its name, and the names its steps declare, and what it
reads as data is read as [QSNAM#owner] states. The recipe of a word under
a label whose kind wires its parts sees the names of the wiring of its
subject beside its inputs, `:Card/minutes ~(took | div 60)`, as the body
of `with` sees the names it is given, and an input named as one of them
is refused where the word is declared, `::bind/NameDeclaredTwiceError`. A value the reader bound
to a bare name stands outside that scope, a bare step of that name
refused as `::call/UnknownNameError`, so a value a recipe needs is an
input. A selector reads the args alone, and an invariant reads its input's
value alone, as the call gives it. A verb calls itself by its name. A
recipe written alone under a label takes no args, those given to it
refused as `…/ArgsBeyondInputsError`, and hands its answer on as it is.

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| tag
::call/UnknownNameError

> :number/fact ~(if (lte 1) ~(1) ~(:n it | sub 1 | fact | mul n)) | 5 | fact
120

> :any/n ~(args | count) | 5 | get [~(n) ~(n 1 !| tag)]
[0 ::any/n/ArgsBeyondInputsError]
```

## kind

A kind is a value of the kind `::kind`: the commands of its chain and
its constructor. It is built from its noun by a chain, each command a
verb of `::kind` whose subject is the kind so far: `accepts` names the
payload, its page and its kinds, the set of no kinds for a kind that
takes none, `wires` a part of the payload, its name, its page, its
selector over the payload and its kinds, `tells` a page of the kind on a
name, a chapter of a topic among them [QSNAM#root], `holds` an invariant
of the value or of a field, a quote under `::invariant`, `throws` a
refusal and the kind of its facts, as `::fn/throws` writes it, `proves` a
law, a quote under `::law`, and
`impl` its constructor, a `::builtin{}`, another value refused as
`::kind/ConstructorKindNotTakenError` as the literal refuses it; a command
written after `impl` joins the others. The slot of a kind holds
its constructor, the `::builtin{}` `impl` gives it, or null where its
chain writes no `impl`. The guard of a kind is its chain, a kind of the
core's as any other: `accepts` names the kinds of its payload, and the
constructor a host hands with a kind beside its source builds the one form
the kind reads its payload into [QSHST#source], the order of a set, the
steps of a quote, the prose of a doc, the frames of a trace, which the raise
of an error at rest reads too, and the descriptor of a builtin, or refuses a
number past the doubles, while a kind that reads its payload as it is holds
none. A `::builtin{}` constructs within the kind its host handed it with
and within one equal to it the root holds at the address the descriptor
names, a kind read back from its print among them [QSHST#source], and
within no other, so a reader's kind lays its tag by its commands alone,
whatever its slot holds. A
name is declared once, `::kind/NameDeclaredTwiceError`, an invariant
named as a refusal the runtime raises by rule under its field among
them, the refusal of the kinds and of a field left out, and a step of
the chain written with modifiers its rules do not take is refused as
`::kind/CommandNotTakenError` on either road with the facts of
`::fn/CommandNotTakenError`, the name of a field and of a page of one
segment, neither `payload` nor a word of a literal; a
refusal or an invariant written with a path stands under a field read
before it, and a law under a name declared before it,
`NameUnderNoFieldError` and `LawUnderNoNameError` refusing one under
none. A part written with no selector reads the key of its name in the
payload, `wires :w |~~ The width. ~~| ::number`, as a fact of a refusal
does. A kind prints as its literal, the chain folded
into a quote and its constructor or null after it, which the constructor
of `::kind` reads back, a payload that is no pair of the quote of a
chain and a constructor refused as `::kind/PayloadNotPairError`.

```qlang
> ::kind | accepts |~~ The sizes. ~~| ::map | print
"::kind[~(accepts |~~ The sizes. ~~| ::map) null]"

> get [~(::kind[[] null] !| tag) ~(::kind | wires :null |~~ n ~~| /n !| tag) ~(::kind | impl 5 !| tag) ~(::kind[~() ~(add 1)] !| tag)]
[::kind/PayloadNotPairError ::kind/CommandNotTakenError ::kind/ConstructorKindNotTakenError ::kind/ConstructorKindNotTakenError]

> :B |~~ B. ~~| (::kind | accepts |~~ w ~~| ::number | impl ::builtin{}) | get [~(::B#5 | tag) ~(::B"x" !| tag)]
[::B ::B/PayloadKindNotTakenError]

> :B |~~ B. ~~| (::kind | impl (::number | binding | value | get /1)) | get [~(::B | binding | value | get /1) ~(::number | binding | value | get /1) ~(::B"x")]
[::builtin{:of ::number} ::builtin{:of ::number} ::B"x"]
```

## value

A value put under a kind holds a value of its payload's kinds by its own
tag, the tag of the kind standing over it: a payload whose own tag names
none of the kinds is refused under the kind, `…/PayloadKindNotTakenError`
with the kinds as `:expected` and its tag as `:actualTag`, a value under a
tag of its own among them, which is taken off first,
`::W#5 | payload | tag ::Pos`, or named among the kinds. Where the kinds
are of each element the payload is a vector by its own tag, and an
element of none of them, read through its tags, is refused as
`…/ElementKindNotTakenError` with its `:index`. A kind whose `accepts` names
the set of no kinds takes no payload, its refusal holding the empty set
as `:expected`, and a kind whose chain names no kind of its payload takes
any. The door reads each part the kind wires once, by its selector, as
the value is built: a part the payload leaves out is refused under its
name as `…/NotGivenError`, a fact an error at rest does not hold reading
null instead and an excerpt standing for any fact of one [QSERR#rest], one its selector fails to read as
`…/NotReadError`, the failure at rest its `:actualValue`, and a value of
none of its kinds under its name; a part no name wires is taken and read
by nothing. The invariants of the value hold of the payload beneath the
tag, the data its page tells of, so a verb in one that keeps its
subject's kind runs over no tag: each is refused under its name, the value
under the tag that broke it its `:actualValue`, and an invariant that
answers an error hands it on.

A kind that wires a part closes its tag. A value of it is read by the
names its kind wires alone, each bare, `card | took`, the name residing on
the label as its words do [QSDSP#walk]; no path reads or writes beneath
the tag, `::path/TagClosedError` [QSPTH#get], a value of the kind built
anew through its door, and `payload` answers the payload bare. A value laid
under the tag before the kind was declared answers a name of the kind
through the door of the kind, as its print read back is read, its names or
the refusal of the door. A kind that
wires no part stays open, its tag passing the words of its payload,
`::Width#2 | add 3` answering `::Width#5`.

```qlang
> :Box |~~ A box. ~~| (::kind | wires :w |~~ The width. ~~| /w ::number | holds :TooWideError |~~ At most ten. ~~| ~(get /w | lte 10)) | get [~(::Box{:w 3} | tag) ~(::Box{} !| tag) ~(::Box{:w "x"} !| tag) ~(::Box{:w 20} !| tag)]
[::Box ::Box/w/NotGivenError ::Box/w/KindNotTakenError ::Box/TooWideError]

> :Box |~~ B. ~~| (::kind | holds :NegError |~~ Above zero. ~~| ~(get /0 | gt 0)) | ::Box[-1] !| payload | keys
#[:actualTag :actualValue :trace]

> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | get [~(::Sorted[1 2] | payload) ~(::Sorted[2 1] !| actualValue)]
[[1 2] ::Sorted[2 1]]

> :Pos |~~ P ~~| (::kind | accepts |~~ n ~~| ::number) | get [~(::W#5 | tag ::Pos !| get [~(tag) ~(actualTag)]) ~(::W#5 | payload | tag ::Pos)]
[[::Pos/PayloadKindNotTakenError ::W] ::Pos#5]

> :Nums |~~ n ~~| (::kind | accepts |~~ v ~~| [::number]) | get [~(#[2 1] | tag ::Nums !| tag) ~([1 "a"] | tag ::Nums !| get [~(tag) ~(index)])]
[::Nums/PayloadKindNotTakenError [::Nums/ElementKindNotTakenError 1]]

> :Topic |~~ A topic. ~~| (::kind | accepts |~~ None. ~~| #[]) | 5 | tag ::Topic !| get [~(tag) ~(expected)]
[::Topic/PayloadKindNotTakenError #[]]

> :Card |~~ A card. ~~| (::kind | accepts |~~ The parts. ~~| ::vec | wires :took |~~ The seconds. ~~| /1 ::number) | ::Card["a" 312] | get [~(took) ~(get /took !| repair) ~(count !| tag) ~(payload | get /1)]
[312 ~(took) ::call/KindAnswersNoVerbError 312]

> :E |~~ E ~~| (::kind | accepts |~~ t ~~| ::string | wires :n |~~ n ~~| ~(toNumber) ::number) | ::E"x" !| get [~(tag) ~(actualValue | tag)]
[::E/n/NotReadError ::string/toNumber/TextNotNumberError]

> ::Box{:w 3} | :Box |~~ B ~~| (::kind | wires :w |~~ w ~~| /w ::number) | w
3
```

## label

A label is a kind declared under a name [QSNAM#address]. Its verbs are
the functions and the recipes named under it, `construct` a name there
like any other, and its nodes lie under its address for `doc`,
`manifest` and the tools and its laws for `laws`; its constructor, where
`impl` gives it one, stands as the second part of the literal of its
kind and runs where its tag is laid, as a literal or by `tag`, under that
kind alone. A word of a literal, `::null`, is
declared by the chain of a kind. The tag of a label declared by its page
alone lays itself over a payload as it is. A value laid under a tag
before its kind is declared keeps the tag; the tag laid again after the
declaration, by a literal or by `tag`, is laid over the payload beneath
it and held to the kind, and so is a verb that keeps the value's kind,
which lays its tags again, each through its kind, so an edit that breaks
an invariant is refused. The tag of a name that holds a value is
refused as `::construct/TagNamesAValueError`, while the tag of a verb, a
contract among them, lays itself over the value [QSNAM#address], and the
tag of an invariant, whose node holds its quote under `::invariant`, is
the tag of its refusal, which lays the kind of its family over an error
at rest alone [QSERR#rest].

```qlang
> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | ::Sorted[1 2 3] | reverse !| tag
::Sorted/NotSortedError

> ::Pos#-3 | :Pos |~~ A positive number. ~~| (::kind | holds :NotPositiveError |~~ Above zero. ~~| ~(gt 0)) | tag ::Pos !| tag
::Pos/NotPositiveError

> :number/c (::fn | takes :x |~~ x ~~| /0) | get [~(::number/c[1] | tag) ~(:limit 5 | ::limit[1] !| tag)]
[::number/c ::construct/TagNamesAValueError]

> :Box |~~ B ~~| (::kind | holds :TooBigError |~~ t ~~| ~(lt 9)) | get [~(::Box/TooBigError[1] !| tag) ~(::Box/TooBigError!{:actualTag ::number :actualValue 10} | actualValue)]
[::Box/TooBigError/PayloadKindNotTakenError 10]

> ::vec/take/count/NotIntegerError | binding | value | tag
::invariant

> get [~(::set | binding | value | get /1 | tag) ~(::keyword | binding | value | get /1)]
[::builtin null]

> :Pos |~~ A positive number. ~~| (::kind | impl ::builtin{}) | :Pos/construct ~(add 0) | get [~(::Pos#5 | construct) ~(::Pos | manifest)]
[::Pos#5 #[::Pos/construct]]

> ::null | binding | value | tag
::kind
```

## chain

What a chain holds is written in the chain, and a declaration by name
of what it holds is refused where it stands as
`::bind/WrittenOutsideItsChainError`: an invariant, a quote under
`::invariant` by its own tag, wherever it is declared, a quote under
another tag refused by the kind of invariants, and under a verb its `answer`, its `subject` and an input, any quote or
path a reader declares there, which the selector of an input writes. A page,
a law and any other value a reader declares by name under a verb or a
label lie there for `doc`, `manifest` and `runLaws`, a verb under a
label among them, whatever its name.

```qlang
> get [~(:Positive ::invariant~(gt 0) !| tag) ~(:Positive ::invariant::Foo~(gt 0) !| tag)]
[::bind/WrittenOutsideItsChainError ::invariant/PayloadKindNotTakenError]

> :number/add/extra |~~ More. ~~| /1 !| tag
::bind/WrittenOutsideItsChainError

> :any/k ~(5) | :any/k/note |~~ A note. ~~| | ::any/k | manifest
#[::any/k/note]
```
