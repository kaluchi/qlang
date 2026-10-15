# QSBLD · A function and a kind built by commands

A word is a function and a label is a kind, each built from its noun by
commands, a chain, which a call and a constructor read. The requirements
of each section are the cases of its file under
`core/test/conformance/QSBLD/`.

## fn

A function is a value of the kind `::fn`: the roles of its signature
and its recipe. It is built from the noun by commands: `on` names its
subject's kinds, `takes` an input, `returns` its answer, `throws` a
refusal, `holds` an invariant of an input or of the answer, `proves` a
law, `carries` a fact of a refusal, and `impl` its recipe, code or a
host's `::builtin{}`; a command written after `impl` joins the others
and the recipe stays, while `impl` over the noun alone makes the
function of no commands, its code, which takes no command after it,
`::fn/takes/SubjectNotFnError`. Each name is written with its page and
declared once, an input's of one segment beside the names `answer` and
`subject`, which the chain lays itself, and the words of a literal,
`::fn/SignatureNotCommandsError` refusing one written otherwise and
`::fn/NameDeclaredTwiceError` a name declared again, an invariant named
as the refusal of its input's kinds among them. A refusal and an
invariant written with a path stand under an input taken before it or
under the answer, an invariant always written so,
`::fn/NameUnderNoInputError` refusing one under none; a fact, always
written with a path, and a law with a path stand under a name declared
before them, a refusal among them, `::fn/FactUnderNoNameError` and
`::fn/LawUnderNoNameError` refusing one under none.
A word serves the values of its label and of the kinds `on` names, of
tag names the noun's own alone [QSDSP#tagname], refusing any other
subject by its label; a function `apply` runs serves
the kinds `on` names, or any subject where it names none, another
refused as `::fn/call/SubjectKindNotTakenError` with the kinds as
`:expected`. A function prints as its literal, the chain folded into a
quote and its recipe after it, which the constructor of `::fn` reads
back, a payload that is no such pair refused as
`::fn/PayloadNotPairError`. `apply` hands a function a vector or a set
of arguments, another value refused as
`::any/apply/args/KindNotTakenError`, and refused under `::fn/call/…`
as a call of the function, a function with no recipe as
`::fn/RecipeMissingError`; a quote or a path takes empty
args alone, `[]`, `#[]` or an empty vector under a tag, others refused
as `::any/apply/args/NotTakenError`; `fill` writes the arguments into
the head of its code, refused under `::fn/call/…` as a call and, for a
function whose recipe is no code, a primitive's or none, as
`::fn/fill/RecipeNotCodeError`; and `params` answers its inputs.

```qlang
> ::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by) | print
"::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)]"

> :f ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | 5 | apply f [3]
8

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | fill 3
~(:by |~~ How much. ~~| 3 | add by)

> ::fn | impl ~(add 1) | eq ~(add 1)
true

> 5 | apply ~(add 1) [3] !| type
::any/apply/args/NotTakenError
```

## input

An input, `takes :by |~~ How much. ~~| /0 ::number`, has a name, a page,
the place of the call it reads, and its kinds. The place is a path read
strictly, `/0`, `/-1` counted from the end, `/0/by` a key of an object,
or code over the args, `~(query /0 3)` for an input with a default and
`~(it)` for the args whole. The args of a call, the values its
modifiers computed against the subject, are a value under the tag of
its word, `::number/add[1 2]`, which reads back as it prints; inside a
word `args` reads them, and the counts of `coalesce` and `cond` are the
invariants of their inputs.

An input holds the value of its kind the walk of its tags reaches: a
value of none is refused under the input as `…/by/KindNotTakenError`,
the kinds it takes its `:expected`, a set of tags, and the value of an input of each
element that is no vector as of no `::vec`; a place the call leaves out,
read strictly by a path or by code, as `…/by/NotGivenError`, and a path
that meets a value it cannot read with the path's refusal,
`::path/SubjectHasNoPartsError`; args past the places the inputs read,
where every input reads a numbered place, a path from a place or
`query` of one, under the call as `…/ArgsBeyondInputsError`, while an
input that reads `/-1`, the args whole or a place by any other code,
`~(get /0)` among it, takes any number; and a value that breaks an
invariant under the invariant's name, the invariant holding of the value
as the call gives it, its tags among it, which the refusal holds as
`:actualValue`. Kinds written as a vector of one tag or of one set are
the kinds of each element: the input holds a vector, or a set, of the
value of its kind of each, a quote and a doc as they are, a value that
is no vector refused as `…/KindNotTakenError` and an element of none as
`…/ElementKindNotTakenError` with its `:index`.

```qlang
> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(5 | plus 2) ~(5 | plus "x" !| type) ~(5 | plus !| type) ~(5 | plus 1 2 !| type)]
[7 ::number/plus/by/KindNotTakenError ::number/plus/by/NotGivenError ::number/plus/ArgsBeyondInputsError]

> :vec/top (::fn | takes :n |~~ The n. ~~| ~(query /0 3) ::number | impl ~(sort | reverse | take n)) | [5 1 4 2] | get [~(top) ~(top 1)]
[[5 4 2] [5]]

> :m (::fn | takes :xs |~~ X ~~| /0 [::number] | impl ~(xs)) | get [~(5 | apply m [5] !| type) ~(5 | apply m [[1 "a"]] !| get [~(type) /index])]
[::fn/call/xs/KindNotTakenError [::fn/call/xs/ElementKindNotTakenError 1]]
```

## answer

`returns` names the kinds of a word's answer, at least one,
`::fn/returns/kinds/NotGivenError` refusing none given and
`::fn/SignatureNotCommandsError` an empty set; a failure the recipe
answers passes as it is. An answer that reaches
one of several kinds by the walk is that value; one kind makes the
answer by its constructor and its invariants; an answer of the word's
own label goes back under the subject's tags, held to the label. An
answer of none of the kinds, a payload the one kind refuses for its kind
among them, is refused as `…/answer/KindNotTakenError` with the kinds as
`:expected`, while an invariant of the kind refuses under its own name. A word whose `returns`
names `::any`, or that has none, hands its answer on as it is.

```qlang
> :Box |~~ B ~~| | :Box/half (::fn | returns |~~ The half. ~~| ::string | impl ~(get /0 | div 2)) | ::Box[4] | half !| type
::Box/half/answer/KindNotTakenError
```

## recipe

A recipe runs in the scope its call opens: its inputs by their names
and the args as `args`, the names its steps declare, and the tree, the
words and the nodes of the root and of the query. A value a recipe needs
is an input. A place reads the args alone, and an invariant reads its
input's value alone, as the call gives it.
A word calls itself by its name. A recipe written alone under a label
is the function of no commands it is: args given to it are refused as
`…/ArgsBeyondInputsError`, and it hands its answer on as it is.

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| type
::call/UnknownNameError

> :number/fact ~(if (lte 1) ~(1) ~(:n it | sub 1 | fact | mul n)) | 5 | fact
120
```

## kind

A kind is a value of the kind `::kind`, built from its noun by commands:
`wraps` names the payload's kinds, `reads` a field, its name, its page,
its place in the payload and its kinds, `tells` a page of the kind on a
name, `holds` an invariant of the value or of a field, `throws` a
refusal, `carries` a fact, `proves` a law, and `impl ::builtin{}` the
check a host hands a kind of the core, the one recipe a kind takes,
`::kind/impl/recipe/KindNotTakenError` refusing another, and the literal
`::kind[…]` taking null for none and refusing another as
`::kind/RecipeNotBuiltinError`; a command
written after `impl` joins the others. A name is declared once,
`::kind/NameDeclaredTwiceError`, an invariant named as the refusal of
its field's kinds among them, a field's and a page's of one segment
beside `payload`, `construct` and the words of a literal,
`::kind/SignatureNotCommandsError` refusing one written otherwise; a
refusal or an invariant written with
a path stands under a field read before it, and a law or a fact under a
name declared before it, `NameUnderNoFieldError`, `LawUnderNoNameError`
and `FactUnderNoNameError` refusing one under none; a fact written with
no path is a fact of the payload, as the kind of errors names the facts
every error may carry. A kind prints as its
literal, which the constructor of `::kind` reads back.

```qlang
> ::kind | wraps |~~ The sizes. ~~| ::map | print
"::kind[~(wraps |~~ The sizes. ~~| ::map) null]"
```

## value

A value put under a kind holds the value of its payload's kinds,
refused under the kind where it holds none, `…/PayloadKindNotTakenError`
with the kinds as `:expected`, and where its kinds are of each element
an element of none as `…/ElementKindNotTakenError` with its `:index`. Each
field reads its place of the payload, a place left out refused under the
field as `…/NotGivenError` and a value of none of its kinds under the
field. The invariants of the value hold of the payload beneath the tag,
the data its page tells of, so a word in one that keeps its subject's
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

A kind declared under a name is a label: its words are functions named
under it, its names stand in a namespace of its own, and its nodes lie
under its address for `doc`, `manifest` and the tools, its laws for
`laws`, and its constructor `construct` where `impl` gives it the check
of its host, which runs where its tag is laid, as a literal or by `tag`.
A word of a literal, `::null`, is declared by the chain of a kind. A
label declared by its page alone lays its tag over a payload as it is,
as a kind of no commands does. A value laid under a tag before its kind
is declared keeps the tag; a literal or `tag` after the declaration is
checked, and so is a word that keeps the value's kind, which runs the
constructors of its tags again, so an edit that breaks an invariant is
refused. The tag of a name that holds a value is refused as
`::construct/TagNotKindError`, while the tag of an invariant, whose node
holds its `::holds`, lays itself over the value as a tag nothing
declares does.

```qlang
> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(eq (sort))) | ::Sorted[1 2 3] | reverse !| type
::Sorted/NotSortedError

> :limit 5 | ::limit[1] !| type
::construct/TagNotKindError

> :Box |~~ B ~~| (::kind | holds :TooBigError |~~ t ~~| ~(lt 9)) | ::Box/TooBigError[1] | type
::Box/TooBigError

> ::null | binding | get /value | type
::kind
```

## chain

What a chain holds is written in the chain: a declaration that writes
by name an invariant, a constructor, or under a word an input, its
answer or its subject is refused where it stands as
`::bind/WrittenOutsideItsChainError`, and so is a quote or a path a
reader declares by name under a word, which a place of an input writes.
A page, a law and any other value a reader declares by name under a word
or a label lie there for `doc`, `manifest` and `runLaws`.

```qlang
> :Positive ::holds~(gt 0) !| type
::bind/WrittenOutsideItsChainError

> :number/add/extra |~~ More. ~~| /1 !| type
::bind/WrittenOutsideItsChainError
```
