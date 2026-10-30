# QSQUO · Code as data

Code is a value, the quote: a vector of steps a verb runs and a reader
takes apart and builds back. The requirements of each section are the
cases of its file under `core/test/conformance/QSQUO/`.

## literal

A quote is written `~(…)`, its code a pipeline read with the text
around it, so a quote whose content reads as no pipeline is refused by
the parser. `~()` is the empty quote, which runs as the identity. A
quote of a single name or tag name may drop its parentheses, `~add`,
`~::Box`; the full form is the one the printer writes, and `toString`
writes the text of its code, wherever the quote stands, in a vector or a
map among them. Two quotes are equal when their steps are, spacing and
comments aside. A quote is a value like any other: a container holds it,
a name holds it, and it runs where a verb applies it.

```qlang
> ~add
~(add)

> ~(mul 2 |~ note ~|) | eq ~(mul 2)
true

> {:body ~(mul 2)} | get /body | toString
"mul 2"

> :same ~(); 5 | apply same
5
```

## step

A quote is a vector of steps under `::quote`, and the verbs of a vector
apply to it as to any vector under a tag, a path reading a step by its
index. Code is one model, the records of its steps, which the evaluator
runs by their tags, a quote read from text and a quote assembled from
data alike: a call is held as `::call`, its `:name` and its
`:modifiers`, each modifier the step it is, so `add ~(bonus)` holds
`[~(bonus)]`, `add bonus` holds `[::call{:name :bonus}]` and
`filter (gt 1)` holds `[::group~(gt 1)]`; a declaration, which
writes a `::binding` into its scope, as `::bind`, its `:name`, the doc
values of its slot as `:docs` and its body, the step after its name and
its page, as `:body`, each where the declaration writes one; a tagged
literal as `::construct`, its `:tag` and the `:payload` the literal
writes, a tag written before an error literal among them, `::Late!{:by 3}`
the construction of `::Late` over `!{:by 3}` and `::Late::error!{:by 3}`
the same step; a step of the fail track under `::fail`; a group as its quote
under `::group`; and any other value as itself, a literal, the step that
stands as the value it writes, a regex, the error at rest `!{…}` writes
and a doc, the quotes of its roles under the tags written before them,
among them. A declaration stands at the head of its text, before its
query, and `::fail` in a pipeline alone, so inside a container, a field
or a payload a step is a part of a literal. The parser reads a text into these
records, building each through its constructor, and keeps beside them
the span of every part it read, which a refusal and the tools
read.

Each rule a step holds stands once, in the constructor of the record or
of `::quote` that holds the step, which `tag ::quote` and the parser both
go through, refusing under its holder: a value written as a later step on
the success track as `::quote/StepNotCommandError`, its message naming
the verb that takes the value, `get` a path, a container and a tagged
literal, `tag` a tag name, `apply` a quote, and any other value 'a step
is a command'
[QSSYN#step], and a declaration after the first step of the query or on
the fail track so, its message naming the head of the text; a part that
computes inside a literal [QSLIT#closed], the
payload of a tagged literal as `::construct/LiteralComputesError`, the
value it refuses the map the record is built from, which reads back from
its print, and an element or a field of a container step as
`::quote/LiteralComputesError`; a name that is no name of the language
[QSNAM#letters] under `::call` and `::bind`; and every other rule of a
step under the record that holds it. The payload of a record of a step
that is no map, and of `::fail` and `::group` one that is no quote, is
refused by the `accepts` of its kind, `…/PayloadKindNotTakenError` with `:expected`, and a map
whose fields break the fields of its record as `…/PayloadNotSchemaError`,
its `:field` the field, the kind of errors over an error literal, which
is that literal, refused by `::construct` naming its `:tag`. A text that breaks a rule of a step answers
`::quote/ParseError` at the span of the step with the rule's message, and a throw
of the parser that is no refusal of the text, the overflow of its stack
under a nest too deep among it, passes as it is, which `parse` answers as
`::quote/ParseError` with its message. `tag ::quote`
builds a quote from a vector of steps, which `toString` writes as their
text: a payload that is no vector is refused as
`::quote/PayloadKindNotTakenError`, and an element that no text writes
as a step, a value under a tag of its own and the quote of a path alone
among them, as `::quote/ElementNotStepError`. A quote built over a path
alone prints under its tag, `::quote[/age]`, reads back as it, and
answers the path it holds; written as `~(/age)` it is refused by the
parser, which gives the path bare.

```qlang
> ~(filter (gt 1)) | payload
[::call{:name :filter :modifiers [::group~(gt 1)]}]

> ~(add 1 !| 0) | query /1
::fail~(0)

> ~(:rate |~~ The rate. ~~| it;) | first | get /docs
[|~~ The rate. ~~|]

> [~(:rate 1;) ~(:rate |~~ The rate. ~~| 1;) ~(:Box |~~ A box. ~~|;)] | map (first | keys)
[[:name :body] [:name :docs :body] [:name :docs]]

> ~(::Box[1 2]) | first | get [tag /tag /payload]
[::construct ::Box [1 2]]

> [[1 2] ::call{:name :count}] | tag ::quote | toString
"[1 2] | count"

> [[1 2] 5] | tag ::quote !| tag
::quote/StepNotCommandError

> [/age] | tag ::quote | print
"::quote[/age]"

> get [([::construct{:tag ::Box :payload ::call{:name :count}}] | tag ::quote !| tag) ([[::call{:name :count}]] | tag ::quote !| tag)]
[::construct/LiteralComputesError ::quote/LiteralComputesError]

> get [(::call[1] !| get [tag expected]) (::fail[1] !| get [tag expected]) (::call{:name 1} !| field)]
[[::call/PayloadKindNotTakenError #[::map]] [::fail/PayloadKindNotTakenError #[::quote]] :name]

> get {:tag ::Box :payload (~(width) | first)} | tag ::construct !| get [tag (found | tag) (eq (print | parse | answer))]
[::construct/LiteralComputesError ::map true]

> "::Late::error!{:by 3}" | parse | eq ("::Late!{:by 3}" | parse)
true

> get [(~(::Late!{:by 3}) | first | get [tag /tag /payload]) (::construct{:tag ::error :payload !{:by 3}} !| get [tag field])]
[[::construct ::Late !{:by 3}] [::construct/PayloadNotSchemaError :tag]]
```

## parse

`parse` reads text alone, into the quote it writes, a blank source the
empty quote, and refuses any other subject under its one verb,
`::string/parse/SubjectNotStringError`. A source that reads as no
pipeline is refused as `::quote/ParseError` with its `:source`, the line
where the reading stopped, cut around that point where it is long, the
one text that holds what `parse` read from a string the query computed,
its `:marker`, the caret beneath it [QSSYN#refusal], its `:location`,
where the reading stopped, as a `::span` [QSPRN#span], the `:message` of the habit
the grammar names or the `:expected` continuations where it
stopped and what it met there as `:found` [QSSYN#refusal], and its
`:origin`, the verb that read it, `:string/parse`. `toString` writes a
quote as the text of its code, its steps in the one spelling the printer
writes and without its brackets, `"5 |  mul   2" | parse | toString`
answering `"5 | mul 2"`, and `parse` reads that text back as the quote,
so a quote turned into text and read back is itself. A quote whose steps
are all declarations, or of several steps one of which takes several
lines, writes a step a line, each declaration ended by its `;` and each
step of the query after the first led by its pipe, a step that takes
several lines written on them, and any other quote
writes its steps on one line, a step past eighty characters laid on lines
as [QSPRN#print] lays it; on one line, as a frame of a trace and a
cell of a table print it, every quote writes each step and each part of
it on one line [QSPRN#print]. Every text a quote prints reads back as
the same quote.

```qlang
> "add 1 | mul 2" | parse
~(add 1 | mul 2)

> ~(add 1 | mul 2) | get [toString print (toString | parse | eq ~(add 1 | mul 2))]
["add 1 | mul 2" "~(add 1 | mul 2)" true]

> ~(:rate 2; :fee 5;) | toString
":rate 2;\n:fee 5;"

> ~(add 1 | mul 2) | parse !| get [tag (subject | found | tag)]
[::string/parse/SubjectNotStringError ::quote]

> "add (" | parse !| get [tag source origin]
[::quote/ParseError "add (" :string/parse]
```

## apply

`apply` runs code against its subject: code written bare, a path, which
reads, a function, which takes its args as one vector, as a call holds
its args, `apply f [4]`, or a name that holds one, where code and a path
take none, `::any/apply/ArgsNotTakenError`, and args that are no vector
are refused as `::any/apply/ArgsKindNotTakenError`. Code a group declares
stays inside its run, and what the code answers is the answer, a
function or a quote it builds among it, which runs where a name hands it
on. A value of another kind is refused as
`::any/apply/CodeKindNotTakenError`. `answer`, a verb of `::quote`, runs
a quote from null, beneath whatever tags stand over it, and answers what
its code answers, so a print reads back as the value it writes by
`parse | answer`; it runs the code of a link and of a snippet alike, and
`open` opens the page a link names [QSSLF#doc].

```qlang
> 5 | apply (add 1 | mul 2)
12

> :f (::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by)); 5 | apply f [3]
8

> {:id 7} | apply (:rate 2;) | rate !| tag
::call/UnknownNameError

> 42 | apply 1 !| tag
::any/apply/CodeKindNotTakenError

> get [({:id 7} | print | parse | answer) ("10 | add 5" | parse | answer)]
[{:id 7} 15]
```

## modifier

A step writes its modifiers, each as it is written, and its verb reads
them one by one, each into the input that takes it, which decides what
the modifier is. An input of a value computes its modifier at the call
against the subject of the step, a bare name and a group among them, so
`take count` takes as many elements as there are and `5 | add (mul 2)`
answers `15`; their values are the args of the call, which the inputs of
its function read by their selectors. An input of code or of a template
takes a group and a name that holds no value of the step, a verb, a
program its text declares or a name the verb gives, as code at rest,
whatever stands at its head, and runs it on the values of its own
choosing, `[1 2] | map (5 | add 1)` answering `[6 6]`; a literal, a
quote, a path, a tag and a name that holds a value of the step are the
values they are at either. `it` names the subject the code runs on,
`[true false true] | filter it` answering `[true true]`, and `self` the
subject of the step that writes the code [QSQUO#held]. The modifiers past
the inputs of a verb are the modifiers of the bare verb its last input
takes, `map gt 0` reading `map (gt 0)` and `5 | add mul 2` reading
`add (mul 2)`, and past any other they are refused [QSBLD#input].

The modifiers a call computes are forks against the subject, their values
the args in their order, none seeing another; a call computes them in
their order up to the first that answers a failure, which answers the
call, and the forks of every sequence run in its order: the elements a
verb runs over, the parts of a template, the modifiers of a command, the
keys of `sort` and the laws `runLaws` runs.

A verb that runs a part per element, in its own order, or only when the
part is chosen takes code there: `filter (gt 1)`, `reduce 0 add`, the
branches of `if` and the clauses of `cond`, the conditions of `allOf`
and `anyOf` and the alternatives of `coalesce` each in its turn, while
the condition of `if`, which always runs, is a value. An input of code is
one its function marks to run, to fold or to read within, the names and
the body of `with` among them, and one of a verb written in the language
whose kinds name `::quote` or `::fn`. A quote written in the step where
its verb takes code or a template, beneath any tags over it, is refused
under the address of the verb and the name of its input,
`::vec/map/CodeQuotedError`, and code whose one step is a quote written
in a group or a name of the step that holds code as
`::vec/map/CodeQuotedTwiceError`. A value of none of the kinds an input
of code takes is refused under the input, `42 | apply 1` as
`::any/apply/CodeKindNotTakenError`.

```qlang
> [1 2 3] | take count
[1 2 3]

> 5 | add (mul 2)
15

> [1 2] | map (5 | add 1)
[6 6]

> [-1 2] | map gt 0
[false true]

> [true false true] | filter it
[true true]

> [1 2] | map ~(mul 2) !| tag
::vec/map/CodeQuotedError

> :mf ~(mul 2); [1 2] | get [(map mf) (map (mf) !| tag)]
[[2 4] ::vec/map/CodeQuotedTwiceError]
```

## held

Code a verb runs is held as a quote, which is its literal. Code written
in a step, a group or a name at rest where its call takes code, or a part
of a template the modifier writes, an error literal or a template under a
tag among them, is code of that step. Where the step hands it to a verb
that runs it, the step writes at its head a declaration of each value of
its scope the code reads and does not declare itself, read by its bare
name or by its tag, with the page of its record, and of `self`, the
subject of the step, where the code reads it, so the verb takes the
literal of what it runs, the values it reads in it, and
`[1 2 3] | map (div (self | sum))` divides each element by the sum of
them all. A verb runs code by an input a primitive runs, the code of
`map`, `filter`, `sort` or `if` and the templates of `get`, `query` and
`map`, by any input of a verb written in the
language, whose recipe may hand it on, by the args `apply` hands a
function, and by the body and the selectors of `with`, whose names stand
over the values of the step [QSPTH#template]; an input that takes a quote
as data takes it as it is written. The code holds what it reads, so it
runs alike by whatever road the call hands it on, and a quote a call
answers carries what its step wrote into it. The declarations of the
head are declared once, where the step hands the code on, its steps after
them running at each run of the code, and the value of a declaration the
step wrote is answered as itself, built once, and printed as its literal.

All code runs in a lane: the subject the verb that runs it hands it, the
verbs, the nodes and the labels of the step that runs it, and the names
the code declares itself, those its step wrote into it among them, which
`env`, `doc` and `binding` read there. A value of that step is withheld:
read by a step, by a tag or as the noun of a declaration, it is refused
under its name as `::call/ValueWithheldError`, while a tag reads a label
of the root before any name of the reader. A quote its step did not
write, read from a name, a field or a page, a law and a snippet among
them, computed by a group of a template or answered by a call, is held as it is
written: a verb of the root runs it in the lane of its step, which
withholds the value it reads, and a verb written in the language refuses
it at the step that hands it on, under the name it reads that the step
names as a value. The scope of a verb's recipe is its own, so code a verb
holds is refused under a value its recipe names; a law the root declares
runs in a lane over the root alone. The trace holds the steps as the text
wrote them, the declarations of the head run before the step that
failed. A value code needs is an input of a function, `apply f [4]`, a
name of the step that hands the code on, or a value `fill` writes at the
head of a quote: `fill` takes a map of the names the code reads and their
values and answers the quote with a declaration of each at its head, in
the order the code reads the names, under the tags the quote came through,
and refuses a name the code does not read, one it declares itself among
them, as `::quote/fill/NamesNameNotReadError` with its `:name` and the
names the code reads near it as `:nearest`. Code that calls itself is a
verb.

```qlang
> [1 2] | apply (:bonus 10; map (add bonus))
[11 12]

> :vec/show (::fn | takes :code |~~ The code. ~~| /0 ::quote | impl ~(code)); [1] | apply (:bonus 10; get [(show (add bonus)) (show (add 1))])
[~(:bonus 10; add bonus) ~(add 1)]

> :vec/twice (::fn | takes :code |~~ The code. ~~| /0 ::quote | impl ~(map code | map code)); [1 2] | apply (:bonus 10; twice (add bonus))
[21 22]

> 5 | apply (:bonus 10; get [(get ::Late!{:by (add bonus)}) (get !{:by (add bonus)})])
[::Late!{:by 15} !{:by 15}]

> ~(add bonus) | eq ~(add bonus)
true

> apply (:vec 5; get [(::host | env | has :vec) (vec)])
[false 5]

> [1 5 10] | apply (:big ~(gt limit); :limit 4; filter big !| get [tag name])
[::call/ValueWithheldError :limit]

> [1 2] | apply (:bonus 10; get [(with {:q (~(add bonus))} (map q) !| tag) (:rule ~(add bonus); map rule !| tag)])
[::call/ValueWithheldError ::call/ValueWithheldError]

> 5 | apply (:rate 1; :rule ~(:rate 2; add rate); apply rule)
7

> :vec/tally (:count 7; :rule ~(count); apply rule); [1 2 3] | tally !| query [tag name]
[::call/ValueWithheldError :count]

> [1 2] | apply (:bonus "x"; map (add bonus) !| trace | map failed)
[~(add bonus) ~(map (add bonus))]

> get [(~(mul qty | add fee) | fill {:fee 5 :qty 3}) (5 | with {:q (~(add bonus) | fill {:bonus 10})} (apply q))]
[~(:qty 3; :fee 5; mul qty | add fee) 15]

> [[1 2] [3]] | get [(map (it | count)) (map (self | count))]
[[2 1] [2 2]]

> ~(add myaddend) | fill {:myadend 1} !| get [tag name nearest]
[::quote/fill/NamesNameNotReadError :myadend [:myaddend]]
```
