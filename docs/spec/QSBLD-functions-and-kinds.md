# QSBLD · A function and a kind built by commands

A word is a function and a label is a kind, each built from its noun by
commands, a chain, which a call and a constructor read. The requirements
of each section are the cases of its file under
`core/test/conformance/QSBLD/`.

## fn

A function is a value of the kind `::fn`: the roles of its signature
and its recipe. It is built from the noun by commands, each written
after the ones before it and the recipe last: `on` names its subject's
kinds, `takes` an input, `returns` its answer, `throws` a refusal,
`holds` an invariant of an input or of the answer, `proves` a law,
`carries` a fact of a refusal, and `impl` its recipe, code or a host's
`::builtin{}`. A name of the signature is declared once, each written
with its page. A function prints as its literal, the chain folded into a
quote and its recipe after it, which the constructor of `::fn` reads
back; one of no commands is its code. `apply` hands a function a vector
of arguments, `fill` writes them into the head of its code, and
`params` answers its inputs.

```qlang
> ::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by) | print
"::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)]"

> :f ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | 5 | apply f [3]
8

> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | fill 3
~(:by |~~ How much. ~~| 3 | add by)

> ::fn | impl ~(add 1) | eq ~(add 1)
true
```

## input

An input, `takes :by |~~ How much. ~~| /0 ::number`, has a name, a page,
the place of the call it reads, and its kinds. The place is a path read
strictly, `/0`, or code over the args, `~(query /0 3)` for an input with
a default and `~(it)` for the args whole; kinds written as a vector of
one tag are the kinds of each element. An input holds the value of its
kind the walk of its tags reaches: a value of none is refused under the
input, `…/by/NotNumberError`, a strict place the call leaves out as
`…/by/NotGivenError`, args past the places the inputs read under the
call as `…/ArgsBeyondInputsError`, and a value that breaks an invariant
under the invariant's name. The args of a call, the values its
modifiers computed against the subject, are a value under the tag of
its word, `::number/add[1 2]`, which reads back as it prints; inside a
word `args` reads them, and the counts of `coalesce` and `cond` are the
invariants of their inputs.

```qlang
> :number/plus (::fn | takes :by |~~ How much. ~~| /0 ::number | impl ~(add by)) | get [~(5 | plus 2) ~(5 | plus "x" !| type) ~(5 | plus !| type) ~(5 | plus 1 2 !| type)]
[7 ::number/plus/by/NotNumberError ::number/plus/by/NotGivenError ::number/plus/ArgsBeyondInputsError]

> :vec/top (::fn | takes :n |~~ The n. ~~| ~(query /0 3) ::number | impl ~(sort | reverse | take n)) | [5 1 4 2] | get [~(top) ~(top 1)]
[[5 4 2] [5]]

> :any/all (::fn | takes :xs |~~ The xs. ~~| ~(it) [::number] | impl ~(xs | sum)) | null | all 1 2 3
6
```

## answer

`returns` names the kinds of a word's answer, which the call checks, an
answer of none refused under the answer's label; a word whose answer is
`::any` hands it on as it is.

```qlang
> :vec/n (::fn | returns |~~ The count. ~~| ::string | impl ~(count)) | [1] | n !| type
::string/PayloadNotStringError
```

## recipe

A recipe runs in the scope its call opens: its inputs by their names
and the args as `args`, the names its steps declare, and the tree, the
words and the nodes of the root and of the query. No value a sentence
names reaches a recipe, nor the places and invariants of its inputs; a
value a recipe needs is an input. A word calls itself by its name. A
recipe written alone under a label is the function of no commands it
is: it takes no object and hands its answer on as it is.

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| type
::call/UnknownNameError

> :number/fact ~(if (lte 1) ~(1) ~(:n it | sub 1 | fact | mul n)) | 5 | fact
120
```

## kind

A kind is a value of the kind `::kind`, built from its noun by commands,
`impl` last: `wraps` names the payload's kinds, `reads` a field, its
name, its page, its place in the payload and its kinds, `tells` a page
of the kind on a name, `holds` an invariant of the value or of a field,
`throws` a refusal, `carries` a fact, `proves` a law, and `impl
::builtin{}` the check a host hands a kind of the core. A name is
declared once. A kind prints as its literal, which the constructor of
`::kind` reads back.

```qlang
> ::kind | wraps |~~ The sizes. ~~| ::map | print
"::kind[~(wraps |~~ The sizes. ~~| ::map) null]"
```

## value

A value put under a kind holds the value of its payload's kinds,
refused under the kind where it holds none; each field reads its place
of the payload, a place left out refused under the field as `NotGiven`
and a value of none of its kinds under the field; the invariants hold of
the value, each refused under its name. A field is no word: `get` reads
its place. An invariant runs on the value under the label, so code in it
that keeps the tag reads the payload first, `~(payload | eq (sort))`.

```qlang
> :Box |~~ A box. ~~| (::kind | reads :w |~~ The width. ~~| /w ::number | holds :TooWideError |~~ At most ten. ~~| ~(get /w | lte 10)) | get [~(::Box{:w 3} | type) ~(::Box{} !| type) ~(::Box{:w "x"} !| type) ~(::Box{:w 20} !| type)]
[::Box ::Box/w/NotGivenError ::Box/w/NotNumberError ::Box/TooWideError]
```

## label

A kind declared under a name is a label, its words functions named
under it, its nodes under its address for `doc`, `manifest` and the
tools, its laws for `laws`. A label declared by its page alone lays its
tag over a payload as it is, as a kind of no commands does, and a tag a
kind declared later checks a value laid before it. A word that keeps its
subject's kind runs the constructors of its tags again, so an edit that
breaks an invariant is refused. The tag of a name that holds a value
builds nothing.

```qlang
> :Sorted |~~ Sorted. ~~| (::kind | holds :NotSortedError |~~ In order. ~~| ~(payload | eq (sort))) | ::Sorted[1 2 3] | reverse !| type
::Sorted/NotSortedError

> :limit 5 | ::limit[1] !| type
::construct/TagNotKindError
```

## chain

What a chain holds alone is written in the chain: a declaration that
writes by name an invariant, a constructor, or under a word an input,
its answer or its subject is refused where it stands as
`::bind/WrittenOutsideItsChainError`. A page, a law and any other value
a reader declares by name under a word or a label lie there for `doc`,
`manifest` and `runLaws`, and change no call and no value.

```qlang
> :Positive ::holds~(gt 0) !| type
::bind/WrittenOutsideItsChainError

> :number/add/extra |~~ More. ~~| /1 !| type
::bind/WrittenOutsideItsChainError
```
