# QSQUO · Code as data

Code is a value, the quote: a vector of steps a word runs and a reader
takes apart and builds back. The requirements of each section are the
cases of its file under `core/test/conformance/QSQUO/`.

## literal

A quote is written `~(…)`, its code a pipeline read with the text around
it, so a quote that holds no pipeline is a syntax error. `~()` is the
empty quote, which runs as the identity. A quote of a single name or tag
name may drop its parentheses, `~add`, `~::T`; the full form is the one
the printer writes. Two quotes are equal when their steps are, spacing
and comments aside. A quote is a value like any other: a container holds
it, a name holds it, and it runs only where a word applies it.

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
modifier the step it is; a declaration as `::bind`; a constructor's step
as `::construct`; a step of the fail track under `::fail`; a group as
its quote under `::group`; an error literal as the error at rest it
writes; any other literal as itself. The constructor of each record
checks the fields the printer reads, prints the step and reads the text
back, so an assembly that reads back as another step, or as none, is
refused where it is made. `tag ::quote` builds a quote from a vector of
steps.

```qlang
> ~(filter ~(gt 1)) | payload
[::call{:name :filter :modifiers [~(gt 1)]}]

> ~(add 1 !| 0) | query /1
::fail~(0)

> [[1 2] ::call{:name :count}] | tag ::quote | parse
"[1 2] | count"

> ::call{:name "add"} !| type
::call/PayloadNotSchemaError
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
`open` runs a quote beneath whatever tags stand over it.

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
another. An input that takes code takes a quote, a path or a function,
and refuses what the call computed in its place, the error a modifier
answered among it, under the input's own address; an input whose kinds
hold no quote passes the error of its modifier as it is.

```qlang
> [1 2 3] | take count
[1 2 3]

> [{:a true}] | filter (get /a) !| type
::vec/filter/predicate/NotPathOrQuoteError
```

## held

Code a verb runs is code of a step or code held as data. A quote written
in a step, an object of a call or a part of a template, is code of that
step: the call runs it in the scope of the step that wrote it, whatever
road it takes inside the call, and a word's own inputs shadow nothing in
it. Any other code, a quote held in a name, a field or a page, a law and
a snippet among them, a quote a call answered or a group computed, runs
in a lane of its own: its past is the subject it runs on, the words, the
nodes and the labels of its scope, and the names it declares itself. A
value the reader named is withheld from it, refused under its name as
`::call/ValueWithheldError`. A value held code needs is an input of a
function, `apply f [4]`, and code that calls itself is a word.

```qlang
> :k 10 | [1 2] | map ~(add k)
[11 12]

> :big ~(gt lim) | :lim 4 | [1 5 10] | filter big !| get [~(type) /name]
[::call/ValueWithheldError :lim]

> :k 1 | :f ~(:k 2 | add k) | 5 | apply f
7
```
