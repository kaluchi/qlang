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
refusal, `carries` a fact, `holds` an invariant of the subject, an input
or the answer, a quote under `::invariant`, `proves` a law, a quote under
`::law`, and `impl` gives it its recipe, code or a host's
`::builtin{}`, and answers the function it builds, `::fn | impl ~(add 1)`
the function of no commands `::fn[~() ~(add 1)]`; a command written after
`impl` joins the others and the recipe stays. The chain is the one
reading of what each command takes: the verb of a command hands it its
objects whole, as written, and a step of the chain written with objects
its rules do not take is refused as `::fn/CommandNotTakenError` whether
its verb wrote it or the literal, `:command` the command, `:index` the
place of the object refused, from zero, or of the first left out, and
`:actualValue` that object: each name is written with its page, a doc,
the name of an input of one segment, neither `answer` nor `subject`,
which the chain lays itself, nor a word of a literal, a place is a path
or a quote, and kinds are a tag or a set of one tag or more, or for an
input a vector of one of them. A name is declared once,
`::fn/NameDeclaredTwiceError` refusing a name declared again, an
invariant named as a refusal the runtime raises by rule under its input
or its answer among them, the refusal of the kinds and of a place left
out. A refusal and an invariant written with a path stand under the
subject, an input taken before it or the answer, an invariant always
written so, `::fn/NameUnderNoInputError` refusing one under none, and the
chain lays the subject and the answer where a name stands under them,
with no page where no command writes one; a fact, always written with a
path, and a law with a path stand under a name declared before them, a
refusal among them, `::fn/FactUnderNoNameError` and
`::fn/LawUnderNoNameError` refusing one under none.

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
there or given by `impl`, as `::fn/RecipeNotCodeError`. `apply` hands a
function its args, a vector or a set, another value refused as
`::any/apply/args/KindNotTakenError`, and the call of the function is
refused under `::fn/call/…`, a function whose recipe it cannot run as
`::fn/RecipeMissingError`, a contract and a `::builtin{}` no host handed
with it [QSHST#source]; a quote or a path takes empty args alone,
`[]`, `#[]` or an empty vector under a tag, others refused as
`::any/apply/args/NotTakenError`; `fill` writes the args into the head
of its code, refused under `::fn/call/…` as a call and, for a function
whose recipe is no code, a primitive's or none, as
`::fn/fill/RecipeNotCodeError`; and `inputs` answers its inputs, each a
map of its name, its page, its place and its kinds as written.

```qlang
> ::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by) | print
"::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)]"

> :f ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | 5 | apply f [3]
8

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | fill 3
~(:by |~~ How much. ~~| 3 | add by)

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | inputs | map /name
[:by]

> get [~(::fn | impl ~(add 1)) ~(::fn | takes 5 |~~ x ~~| /0 !| get [/command /index /actualValue]) ~(-5 | apply (::fn | holds :subject/NotAboveZeroError |~~ Above zero. ~~| ~(gt 0) | impl ~(add 1)) [] !| type)]
[::fn[~() ~(add 1)] [~(takes 5 |~~ x ~~| /0) 0 5] ::fn/call/subject/NotAboveZeroError]

> get [~(::fn[[] ~(1)] !| type) ~(::fn | returns |~~ A. ~~| #[] !| type) ~(::fn | takes :null |~~ w ~~| /0 !| type)]
[::fn/PayloadNotPairError ::fn/CommandNotTakenError ::fn/CommandNotTakenError]

> 5 | apply ~(add 1) [3] !| type
::any/apply/args/NotTakenError

> kinds | inter #[::carries ::holds ::impl ::on ::proves ::reads ::returns ::takes ::tells ::throws ::wraps]
#[]
```

## input

An input, `takes :by |~~ How much. ~~| /0 ::number`, has a name, a page,
the place of the args it reads, and its kinds. The place is a path read
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

An input holds the value of its kind the walk of its tags reaches: a
value of none is refused under the input as `…/by/KindNotTakenError`,
the kinds it takes its `:expected`, a set of tags, and the value of an
input of each element that is no vector as of no `::vec`; a place the
call leaves out, read strictly by a path or by code, as
`…/by/NotGivenError`, and a path that meets a value it cannot read with
the path's refusal, `::path/SubjectHasNoPartsError`; args past the
places the inputs read, where every input reads the arg at an index, by
a path from it or by `query` of one, under the call as
`…/ArgsBeyondInputsError`, while an input that reads `/-1`, the args
whole or a place by any other code, `~(get /0)` among it, takes any
number; and a value that breaks an invariant under the invariant's name,
the invariant holding of the value as the call gives it, its tags among
it, which the refusal holds as `:actualValue`. Kinds written as a vector
of one tag or of one set are the kinds of each element: the input holds
a vector, or a set, of the value of its kind of each, a quote and a doc
as they are, a value that is no vector refused as `…/KindNotTakenError`
and an element of none as `…/ElementKindNotTakenError` with its
`:index`.

```qlang
> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(5 | plus 2) ~(5 | plus "x" !| type) ~(5 | plus !| type) ~(5 | plus 1 2 !| type)]
[7 ::number/plus/by/KindNotTakenError ::number/plus/by/NotGivenError ::number/plus/ArgsBeyondInputsError]

> :vec/top (::fn | takes :n |~~ The n. ~~| ~(query /0 3) ::number | impl ~(sort | reverse | take n)) | [5 1 4 2] | get [~(top) ~(top 1)]
[[5 4 2] [5]]

> :m (::fn | takes :xs |~~ X ~~| /0 [::number] | impl ~(xs)) | get [~(5 | apply m [5] !| type) ~(5 | apply m [[1 "a"]] !| get [~(type) /index])]
[::fn/call/xs/KindNotTakenError [::fn/call/xs/ElementKindNotTakenError 1]]

> 1 | add 1 2 !| get /actualValue
::number/add[1 2]

> :vec/it ~(99) | :vec/query (::fn | takes :p |~~ P. ~~| /0 | takes :d |~~ D. ~~| ~(query /1 null) | impl ~(99)) | :number/w (::fn | takes :cs |~~ C. ~~| ~(it) | impl ~(cs)) | :number/a (::fn | takes :by |~~ B. ~~| ~(query /0 1) | impl ~(add by)) | 5 | get [~(w 1 2) ~(a) ~(a 2)]
[::number/w[1 2] 6 7]
```

## answer

`returns` names the kinds of the answer of a function, at least one,
`::fn/CommandNotTakenError` refusing none given and an empty set alike;
a failure the recipe answers passes as it is. An answer the walk of whose tags reaches one of the
kinds other than the verb's own label is the value it reaches, `::W#5`
the number `5` where `returns` names `::number`; an answer of the verb's
own label goes back under the subject's tags, held to the label; and
where the walk reaches none, the one kind `returns` names makes the
answer as a value is put under it [QSBLD#value]. An answer of none of the
kinds, a payload the one kind refuses for its kind among them, is
refused as `…/answer/KindNotTakenError` with the kinds as `:expected`,
while an invariant of the kind refuses under its own name. A function
whose `returns` names `::any`, or that has none, hands its answer on as
it is.

```qlang
> :Box |~~ B ~~| | :Box/half (::fn | returns |~~ The half. ~~| ::string | impl ~(get /0 | div 2)) | ::Box[4] | half !| type
::Box/half/answer/KindNotTakenError

> :any/f (::fn | returns |~~ r ~~| ::number | impl ~(::W#5)) | 1 | f
5
```

## recipe

A recipe is the code a function runs, which `impl` gives it, or a quote
written alone under a label, the function of no commands it is. It runs
in the scope its call opens: the root, the nodes and the labels of the
scope the call is made in, the verbs among them, the args as `args`,
each input by its name, and the names its steps declare, and what it
reads as data is read as [QSNAM#owner] states. A value the reader bound
to a bare name stands outside that scope, a bare step of that name
refused as `::call/UnknownNameError`, so a value a recipe needs is an
input. A place reads the args alone, and an invariant reads its input's
value alone, as the call gives it. A verb calls itself by its name. A
recipe written alone under a label takes no args, those given to it
refused as `…/ArgsBeyondInputsError`, and hands its answer on as it is.

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| type
::call/UnknownNameError

> :number/fact ~(if (lte 1) ~(1) ~(:n it | sub 1 | fact | mul n)) | 5 | fact
120

> :any/n ~(args | count) | 5 | get [~(n) ~(n 1 !| type)]
[0 ::any/n/ArgsBeyondInputsError]
```

## kind

A kind is a value of the kind `::kind`: the commands of its chain and
its constructor. It is built from its noun by a chain, each command a
verb of `::kind` whose subject is the kind so far: `wraps` names the
payload, its page and its kinds, `reads` a field, its name, its page,
its place in the payload and its kinds, `tells` a page of the kind on a
name, a chapter of a topic among them [QSNAM#root], `holds` an invariant
of the value or of a field, a quote under `::invariant`, `throws` a
refusal, `carries` a fact, `proves` a law, a quote under `::law`, and
`impl` its constructor, a `::builtin{}`, another value refused as
`::kind/ConstructorNotBuiltinError` as the literal refuses it; a command
written after `impl` joins the others. The slot of a kind holds
its constructor, the `::builtin{}` `impl` gives it, or null where its
chain writes no `impl`. The constructor a host hands with a kind beside
its source attaches the tag to a payload or refuses it [QSHST#source],
and a `::builtin{}` no host handed with that kind constructs nothing, so
a reader's kind lays its tag by its commands alone, whatever its slot
holds. A
name is declared once, `::kind/NameDeclaredTwiceError`, an invariant
named as a refusal the runtime raises by rule under its field among
them, the refusal of the kinds and of a place left out, and a step of
the chain written with objects its rules do not take is refused as
`::kind/CommandNotTakenError` on either road with the facts of
`::fn/CommandNotTakenError`, the name of a field and of a page of one
segment, none of `payload`, `construct` and the words of a literal; a
refusal or an invariant written with a path stands under a field read
before it, and a law or a fact under a name declared before it,
`NameUnderNoFieldError`, `LawUnderNoNameError` and
`FactUnderNoNameError` refusing one under none; a fact written with no
path is a fact of the payload, as the kind of errors names the facts
every error may carry. A kind prints as its literal, the chain folded
into a quote and its constructor or null after it, which the constructor
of `::kind` reads back, a payload that is no pair of the quote of a
chain and a constructor refused as `::kind/PayloadNotPairError`.

```qlang
> ::kind | wraps |~~ The sizes. ~~| ::map | print
"::kind[~(wraps |~~ The sizes. ~~| ::map) null]"

> get [~(::kind[[] null] !| type) ~(::kind | reads :null |~~ n ~~| /n !| type) ~(::kind | impl 5 !| type) ~(::kind[~() ~(add 1)] !| type)]
[::kind/PayloadNotPairError ::kind/CommandNotTakenError ::kind/ConstructorNotBuiltinError ::kind/ConstructorNotBuiltinError]

> :B |~~ B. ~~| (::kind | wraps |~~ w ~~| ::number | impl ::builtin{}) | get [~(::B#5 | type) ~(::B"x" !| type)]
[::B ::B/PayloadKindNotTakenError]

> :B |~~ B. ~~| (::kind | impl (::number/construct | binding | get /value)) | get [~(::B | binding | get /value | get /1) ~(::number | binding | get /value | get /1) ~(::B"x")]
[::builtin{} ::builtin{} ::B"x"]
```

## value

A value put under a kind holds a value of its payload's kinds beneath
the tags it is given under, which stay beneath the tag of the kind,
refused under the kind where it holds none, `…/PayloadKindNotTakenError`
with the kinds as `:expected`, and where its kinds are of each element
an element of none as `…/ElementKindNotTakenError` with its `:index`. Each
field reads its place of the payload, a place left out refused under the
field as `…/NotGivenError` and a value of none of its kinds under the
field. The invariants of the value hold of the payload beneath the tag,
the data its page tells of, so a verb in one that keeps its subject's
kind runs over no tag: each is refused under its name, the value under
the tag that broke it its `:actualValue`, and an invariant that answers
an error hands it on. `get` reads a field's place.

```qlang
> :Box |~~ A box. ~~| (::kind | reads :w |~~ The width. ~~| /w ::number | holds :TooWideError |~~ At most ten. ~~| ~(get /w | lte 10)) | get [~(::Box{:w 3} | type) ~(::Box{} !| type) ~(::Box{:w "x"} !| type) ~(::Box{:w 20} !| type)]
[::Box ::Box/w/NotGivenError ::Box/w/KindNotTakenError ::Box/TooWideError]

> :Box |~~ B. ~~| (::kind | holds :NegError |~~ Above zero. ~~| ~(get /0 | gt 0)) | ::Box[-1] !| keys
#[:actualType :actualValue :trace]

> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | get [~(::Sorted[1 2] | payload) ~(::Sorted[2 1] !| get /actualValue)]
[[1 2] ::Sorted[2 1]]

> :Pos |~~ P ~~| (::kind | wraps |~~ n ~~| ::number) | get [~(::W#5 | tag ::Pos) ~(::W#5 | tag ::Pos | payload)]
[::Pos::W#5 ::W#5]
```

## label

A label is a kind declared under a name [QSNAM#address]. Its verbs are
the functions and the recipes named under it, and its nodes lie under
its address for `doc`, `manifest` and the tools, its laws for `laws`,
and its constructor, where `impl` gives it one, as `construct`, which
runs where its tag is laid, as a literal or by `tag`, and which no bare
name reaches, its address running the one a host hands on the subject
its label serves [QSNAM#address]. A word of a literal, `::null`, is
declared by the chain of a kind. The tag of a label declared by its page
alone lays itself over a payload as it is. A value laid under a tag
before its kind is declared keeps the tag; a literal or `tag` after the
declaration is held to the kind, and so is a verb that keeps the value's
kind, which lays its tags again, each through its kind, so an edit that
breaks an invariant is refused. The tag of a name that holds a value is
refused as `::construct/TagNotKindError`, while the tag of a verb, a
contract among them, and of an invariant, whose node holds its quote
under `::invariant`, lays itself over the value [QSNAM#address].

```qlang
> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | ::Sorted[1 2 3] | reverse !| type
::Sorted/NotSortedError

> :number/c (::fn | takes :x |~~ x ~~| /0) | get [~(::number/c[1] | type) ~(:limit 5 | ::limit[1] !| type)]
[::number/c ::construct/TagNotKindError]

> :Box |~~ B ~~| (::kind | holds :TooBigError |~~ t ~~| ~(lt 9)) | ::Box/TooBigError[1] | type
::Box/TooBigError

> ::vec/take/count/NotIntegerError | binding | get /value | type
::invariant

> ::keyword/construct | binding | get /value | type
::builtin

> :Pos |~~ A positive number. ~~| (::kind | impl ::builtin{}) | get [~(::Pos#5 | construct !| type) ~(5 | number/construct)]
[::call/UnknownNameError 5]

> ::null | binding | get /value | type
::kind
```

## chain

What a chain holds is written in the chain, and a declaration by name
of what it holds is refused where it stands as
`::bind/WrittenOutsideItsChainError`: an invariant, a quote under
`::invariant` beneath whatever tags it stands, wherever it is declared,
the constructor `construct`
under a label, and under a verb its `answer`, its `subject` and an
input, any quote or path a reader declares there, which a place of an
input writes. A page, a law and any other value a reader declares by
name under a verb or a label lie there for `doc`, `manifest` and
`runLaws`.

```qlang
> get [~(:Positive ::invariant~(gt 0) !| type) ~(:Positive ::invariant::Foo~(gt 0) !| type)]
[::bind/WrittenOutsideItsChainError ::bind/WrittenOutsideItsChainError]

> :number/add/extra |~~ More. ~~| /1 !| type
::bind/WrittenOutsideItsChainError

> :any/k ~(5) | :any/k/note |~~ A note. ~~| | ::any/k | manifest
#[::any/k/note]
```
