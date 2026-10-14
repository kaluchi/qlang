# QSQUO · Code as data

Code is a value, the quote: a vector of steps a word runs and a reader
takes apart and builds back. The requirements of each section are the
cases of its file under `core/test/conformance/QSQUO/`.

## literal

A quote is written `~(…)`, its code a pipeline read with the text
around it, so a quote whose content reads as no pipeline is refused by
the parser. `~()` is the empty quote, which runs as the identity. A
quote of a single name or tag name may drop its parentheses, `~add`,
`~::T`; the full form is the one the printer writes. Two quotes are
equal when their steps are, spacing and comments aside. A quote is a
value like any other: a container holds it, a name holds it, and it
runs where a word applies it.

```qlang
> ~add
~(add)

> ~(mul 2 |~ note ~|) | eq ~(mul 2)
true

> 5 | apply ~()
5
```

## step

A quote is a vector of steps under `::quote`, and the words of a vector
apply to it as to any vector under a tag. A step is stored as the record
of its form: a call as `::call`, its name and its modifiers, each
modifier the step it is, so `add ~(x)` holds `[~(x)]` and `add x` holds
`[::call{:name :x}]`; a declaration as `::bind`, its docs the doc values
of its slot; a constructor's step as `::construct`; a step of the fail
track under `::fail`; a group as its quote under `::group`; an error
literal as the error at rest it writes; any other literal as itself.
`::fail` and a declaration stand in a pipeline alone, so inside a
container, a field or a payload a step is an element step. The
constructor of each record checks the fields the printer reads against
its schema, `::call/PayloadNotSchemaError`, prints the step and reads the
text back, so an assembly that reads back as another step is refused
where it is made, `::call/ReadBackDiffersError`. `tag ::quote` builds a
quote from a vector of steps, an element that is no step refused as
`::quote/ElementNotStepError`, and a quote built over a path alone
prints under its tag, `::quote[/age]`, and reads back as it.

```qlang
> ~(filter ~(gt 1)) | payload
[::call{:name :filter :modifiers [~(gt 1)]}]

> ~(add 1 !| 0) | query /1
::fail~(0)

> ~(:x |~~ note ~~| it) | first | get /docs
[|~~ note ~~|]

> [[1 2] ::call{:name :count}] | tag ::quote | parse
"[1 2] | count"

> [/age] | tag ::quote | print
"::quote[/age]"
```

## parse

`parse` turns text into the quote it writes and a quote into its text,
an involution: `"add 1 | mul 2" | parse` and back. A blank source is the
empty quote. A quote whose steps are all declarations prints one
declaration a line, each after the first led by its pipe; any other
quote prints on one line. Every text a quote prints reads back as the
same quote.

```qlang
> "add 1 | mul 2" | parse
~(add 1 | mul 2)

> ~(add 1 | mul 2) | parse
"add 1 | mul 2"

> ~(:a 1 | :b 2) | parse
":a 1\n| :b 2"
```

## apply

`apply` runs code against its subject: a quote, a path, which reads, or
a function. Code a quote declares stays inside its run. A value of
another kind is refused as `::any/apply/code/NotFnOrPathOrQuoteError`.
`open`, a word of `::quote`, runs a quote from null, beneath whatever
tags stand over it.

```qlang
> 5 | apply ~(add 1 | mul 2)
12

> {:a 1} | apply ~(:x 2) | x !| type
::call/UnknownNameError

> 42 | apply 1 !| type
::any/apply/code/NotFnOrPathOrQuoteError
```

## modifier

A modifier holds a value: it is read by its own form and evaluated at
the call against the subject, a bare name and a group included, so
`take count` takes as many elements as there are. A command's modifiers
are forks against the subject, results by position, none seeing
another; a call computes them in their order up to the first that
answers a failure, and the forks of every sequence run in its order:
the elements a word runs over, the parts of a template, the modifiers
of a command, the keys of `sort` and the laws `runLaws` runs.

A word that runs a part per element, in its own order, or only when the
part is chosen takes a quote or a path there: `filter ~(gt 1)`,
`reduce 0 ~(add)`, the branches of `if` and the clauses of `cond`, while
the condition of `if`, which always runs, is a value. An input that
takes code takes a quote, a path or a function, a group that computes a
quote among them, and refuses a value computed at the call that none of
its kinds takes, a failure among it, under its own address, the value
its `:actualValue` and its tag its `:actualType`; the page of that
refusal names the tilde. An input of a value hands the failure of its
modifier on as the answer of the call.

```qlang
> [1 2 3] | take count
[1 2 3]

> [{:a true}] | filter (get /a) !| type
::vec/filter/predicate/NotPathOrQuoteError
```

## held

Code a verb runs is code of a step or code held as data. A quote written
in a step, an object of a call or a part of a template, a quote or a
template under a tag among them, is code of that step: the call runs it
in the scope of the step that wrote it, by whatever road it takes inside
the call. A quote stays the value its print shows, and the meaning of
held code is its text and the vocabulary.

Any other code runs in a lane of its own: a quote held in a name, a
field or a page, a law and a snippet among them, a quote a call
answered or a group computed, and the steps a trail skipped. The lane is
the one of the step a call keeps as the code's origin, or else of the
step that runs it: its past is the subject it runs on, the words, the
nodes and the labels of that step's scope, and the names the code
declares itself, which `doc` and `binding` read there. A value that
scope names is withheld: read by a step, by a tag or as the noun of a
declaration, it is refused under its name as `::call/ValueWithheldError`,
while a tag reads a label of the root before any name of the reader. The
scope of a word's body is its own, so code a word holds is refused under
a value its body names; a law the root declares runs in a lane over the
root alone. A value held code needs is an input of a function,
`apply f [4]`, or written into its code by `fill`, and code that calls
itself is a word.

```qlang
> :k 10 | [1 2] | map ~(add k)
[11 12]

> :big ~(gt lim) | :lim 4 | [1 5 10] | filter big !| get [~(type) /name]
[::call/ValueWithheldError :lim]

> :k 1 | :f ~(:k 2 | add k) | 5 | apply f
7
```
