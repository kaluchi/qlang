# QSBLD · A function and a kind built by commands

A function and a kind are built from their noun by a chain, the
commands written on it, which a call and a constructor read; a function
named under a label is a verb, and a kind declared under a name a label
[QSNAM#address]. The requirements of each section are the cases of its
file under `core/test/conformance/QSBLD/`.

## fn

A function is a value of the kind `::fn`: the commands of its chain and
its recipe. It is built from the noun by a chain, each command a verb of
`::fn` whose subject is the function so far, and what a command writes
is named by the noun of the thing: `on` names its subject, its page and
its kinds, `takes` writes an input, `returns` the answer, `throws` a
refusal, `carries` a fact of a refusal, `holds` an invariant of an input
or of the answer, a quote under `::invariant`, `proves` a law, a quote
under `::law`, and `impl` gives it its recipe, code or a host's
`::builtin{}`; a command written after `impl` joins the others and the
recipe stays, while `impl` over the noun alone makes the function of no
commands, its code, which takes no command after it,
`::fn/takes/SubjectNotFnError`. A command refuses a value of another
kind under its input, `::fn/takes/kinds/KindNotTakenError`, and a step of
the chain written with args its rules do not take is refused as
`::fn/CommandNotTakenError`: each name is written with its page, a doc,
the name of an input of one segment, neither `answer` nor `subject`,
which the chain lays itself, nor a word of a literal, a place is a path
or a quote, and kinds are a tag or a set of one tag or more, or for an
input a vector of one of them. A name is declared once,
`::fn/NameDeclaredTwiceError` refusing a name declared again, an
invariant named as a refusal the runtime raises by rule under its input
or its answer among them, the refusal of the kinds and of a place left
out. A refusal and an invariant written with a path stand under an input
taken before it or under the answer, an invariant always written so,
`::fn/NameUnderNoInputError` refusing one under none; a fact, always
written with a path, and a law with a path stand under a name declared
before them, a refusal among them, `::fn/FactUnderNoNameError` and
`::fn/LawUnderNoNameError` refusing one under none.

A verb serves the values of its label and of the kinds `on` names, of
tag names the noun's own alone [QSDSP#tagname], refusing any other
subject by its label; a function `apply` runs serves the kinds `on`
names, or any subject where it names none, another refused as
`::fn/call/SubjectKindNotTakenError` with the kinds as `:expected`. A
function prints as its literal, the chain folded into a quote and its
recipe after it, null for a function with none, which the constructor of
`::fn` reads back, a payload that is no pair of the quote of a chain and
a recipe refused as `::fn/PayloadNotPairError`, a step of the quote that
is no command its chain takes as `::fn/CommandNotTakenError` and a
recipe that is no code as `::fn/RecipeNotCodeError`. `apply` hands a
function its args, a vector or a set, another value refused as
`::any/apply/args/KindNotTakenError`, and the call of the function is
refused under `::fn/call/…`, a function with no recipe as
`::fn/RecipeMissingError`; a quote or a path takes empty args alone,
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

> ::fn | impl ~(add 1) | eq ~(add 1)
true

> get [~(::fn[[] ~(1)] !| type) ~(::fn | returns |~~ A. ~~| #[] !| type) ~(::fn | takes :null |~~ w ~~| /0 !| type)]
[::fn/PayloadNotPairError ::fn/CommandNotTakenError ::fn/CommandNotTakenError]

> 5 | apply ~(add 1) [3] !| type
::any/apply/args/NotTakenError
```

## input

An input, `takes :by |~~ How much. ~~| /0 ::number`, has a name, a page,
the place of the args it reads, and its kinds. The place is a path read
strictly, `/0` the first arg, `/-1` counted from the end, `/0/by` the
key `by` of the first, or code over the args, `~(query /0 3)` for an
input with a default and `~(it)` for the args whole. The args of a call,
the values its modifiers computed against the subject, are a value
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
places the inputs read, where every input reads a numbered place, a path
from a place or `query` of one, under the call as
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
```

## answer

`returns` names the kinds of the answer of a function, at least one,
`::fn/returns/kinds/NotGivenError` refusing none given and
`::fn/CommandNotTakenError` an empty set; a failure the recipe answers
passes as it is. An answer the walk of whose tags reaches one of the
kinds other than the verb's own label is the value it reaches, `::W#5`
the number `5` where `returns` names `::number`; an answer of the verb's
own label goes back under the subject's tags, held to the label; and
where the walk reaches none, the one kind `returns` names makes the
answer by its constructor and its invariants. An answer of none of the
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
each input by its name, and the names its steps declare; what it reads
as data, `env`, a page or a binding, reads the tree of names of the
query that made the call [QSNAM#owner]. A value the reader bound to a
bare name stands outside that scope, a bare step of that name refused as
`::call/UnknownNameError` while `env` reads it, so a value a recipe
needs is an input. A place reads the args alone, and an invariant reads
its input's value alone, as the call gives it. A verb calls itself by
its name. A recipe written alone under a label takes no args, those
given to it refused as `…/ArgsBeyondInputsError`, and hands its answer
on as it is.

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
`impl ::builtin{}` gives a kind of the core the constructor its host
hands, which attaches the tag to a payload or refuses it,
`::kind/impl/constructor/KindNotTakenError` refusing another value; a
command written after `impl` joins the others. The slot of a
kind holds its constructor, null for a kind whose commands alone lay its
tag, and a `::builtin{}` no host hands constructs nothing, so a reader's
kind lays its tag by its commands alone; the literal `::kind[…]` refuses
a constructor of another value as `::kind/ConstructorNotBuiltinError`. A
name is declared once, `::kind/NameDeclaredTwiceError`, an invariant
named as a refusal the runtime raises by rule under its field among
them, the refusal of the kinds and of a place left out, and a step of
the chain written with args its rules do not take is refused as
`::kind/CommandNotTakenError`, the name of a field and of a page of one
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
[::kind/PayloadNotPairError ::kind/CommandNotTakenError ::kind/impl/constructor/KindNotTakenError ::kind/ConstructorNotBuiltinError]

> :B |~~ B. ~~| (::kind | wraps |~~ w ~~| ::number | impl ::builtin{}) | get [~(::B#5 | type) ~(::B"x" !| type)]
[::B ::B/PayloadKindNotTakenError]
```

## value

A value put under a kind holds the value of its payload's kinds,
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
#[:actualType :actualValue :trail]

> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | get [~(::Sorted[1 2] | payload) ~(::Sorted[2 1] !| get /actualValue)]
[[1 2] ::Sorted[2 1]]
```

## label

The verbs of a label are the functions and the recipes named under it,
and its nodes lie under its address for `doc`, `manifest` and the tools,
its laws for `laws`, and its constructor as `construct` where `impl`
gives it the one its host hands, which runs where its tag is laid, as a
literal or by `tag`, and which no step calls. A word of a literal,
`::null`, is declared by the chain of a kind. A label declared by its
page alone is a kind of no commands, which lays its tag over a payload
as it is. A value laid under
a tag before its kind is declared keeps the tag; a literal or `tag`
after the declaration is held to the kind, and so is a verb that keeps
the value's kind, which runs the constructors of its tags again, so an
edit that breaks an invariant is refused. The tag of a name that holds a
value is refused as `::construct/TagNotKindError`, while the tag of an
invariant, whose node holds its quote under `::invariant`, lays itself
over the value as a tag nothing declares does.

```qlang
> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | ::Sorted[1 2 3] | reverse !| type
::Sorted/NotSortedError

> :limit 5 | ::limit[1] !| type
::construct/TagNotKindError

> :Box |~~ B ~~| (::kind | holds :TooBigError |~~ t ~~| ~(lt 9)) | ::Box/TooBigError[1] | type
::Box/TooBigError

> ::vec/take/count/NotIntegerError | binding | get /value | type
::invariant

> ::keyword/construct | binding | get /value | type
::builtin

> :Pos |~~ A positive number. ~~| (::kind | impl ::builtin{}) | ::Pos#5 | construct !| type
::call/UnknownNameError

> ::null | binding | get /value | type
::kind
```

## chain

What a chain holds is written in the chain, and a declaration by name
of what it holds is refused where it stands as
`::bind/WrittenOutsideItsChainError`: an invariant, a quote under
`::invariant`, wherever it is declared, the constructor `construct`
under a label, and under a verb its `answer`, its `subject` and an
input, any quote or path a reader declares there, which a place of an
input writes. A page, a law and any other value a reader declares by
name under a verb or a label lie there for `doc`, `manifest` and
`runLaws`.

```qlang
> :Positive ::invariant~(gt 0) !| type
::bind/WrittenOutsideItsChainError

> :number/add/extra |~~ More. ~~| /1 !| type
::bind/WrittenOutsideItsChainError

> :any/k ~(5) | :any/k/note |~~ A note. ~~| | ::any/k | manifest
#[::any/k/note]
```
