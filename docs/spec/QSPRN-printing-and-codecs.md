# QSPRN · Printing, codecs and spans of text

How a value is written as text and read back, the legend that glosses
its parts, what a budget leaves out, and the span where a reading of text
stopped. The requirements of each
section are the cases of its file under `core/test/conformance/QSPRN/`.

## print

`print`, a verb of `::any`, answers the text of its subject: an atom as
its literal, a vector and a map by their brackets around the print of
each element, the set, the quote, the doc and the error by their own
brackets, a quote of a path alone as `::quote[/a]`, and any other value
under a tag as its tag before the print of its payload, every tag but
the kind the brackets imply, so `::vec[1 2]` prints `[1 2]`; the text of
a value of the language reads back as it by `parse | open`. A string
prints as JSON writes it: `"` and `\` escaped, a line break, a tab, a
carriage return, a backspace and a form feed as `\n`, `\t`, `\r`, `\b` and
`\f`, and any other character below U+0020 and a lone surrogate as `\u`
and their four digits, so the print shows a control character and holds no
code unit a text in UTF-8 cannot carry. A vector and
a set stand on one line unless a part takes several, and then each part
stands on a line of its own; a map of two entries or fewer, none a
container, stands on one line, and any other puts each entry on a line
of its own, indented by two. A doc prints as `|~~`, its prose and `~~|`,
a space between them, each line of its prose after the first at the
indentation of the line it opens on and two more and a blank line empty,
so it reads back as itself [QSSLF#doc]. A step of a quote whose line, its
pipe among it, passes eighty characters is laid on lines as a source of
the catalog writes it, but where a value stands on one line: a command
writes its name on its line and each modifier on a line of its own,
indented by four, a keyword on the line before it, since a keyword that
begins a line opens a declaration; a declaration with a page writes its
name on its line and each doc of its slot on a line of its own, indented
by two, its body on the line of its last doc, since a body begun on a
later line runs on through the steps after it [QSSYN#line]. An elision stands on one line whatever it
holds, so a container that holds one keeps the layout its other parts
give it, and a value of `::frame` stands on one line whatever it holds as
well, a value of `::trace` of two frames or more putting each frame on a
line of its own. On one line every part stands on one line, every part of
a quote among it, the modifiers of its calls, the docs and the body of
its declarations and the parts of its literals, which read back as the
same steps, so a frame lays the quote it holds on one line; a host that
writes a value on one line, a cell of the command line's `table` among
them, whose view writes the prose of a doc with each line break as a
space, asks the printer for that form and lays no print on one line by a
regex over its text. A kind answers `print` under
its own label, and the print of a value finds the `print` of each part,
a bare value among them, by the walk of that part as a verb of the root
reads it [QSNAM#owner], an answer that is no string printed instead:
a print a reader declares under a label of the root answers the reader's
own calls alone, and a print a label declares serves its values and no
tag name of it. A kind's own `print` gives the text it chooses, which
reads back where it writes the kind's literal. What the alert of a failure and the
head of an answer past the budget leave out stands as an `::elision`
before the print, so the print holds all it is given. The print of a
failure finds the print of each part of its facts as the print of every
value does. Every host prints an answer through the one print of the
core, `boundAnswer`, within the budget of every answer [QSPRN#budget],
the command line a string as its text and the REPL and the site as its
literal.

```qlang
> {:a [1 "x" :k]} | :v it | print | parse | open | eq v
true

> #[2 1] | print
"#[1 2]"

> ["\uD800" "\u0007"] | map ~print
["\"\\ud800\"" "\"\\u0007\""]

> ["a\n  b\n\nc"] | tag ::doc | :d it | get [~(print | lines | map ~count) ~(print | parse | first | eq d)]
[[5 5 0 7] true]

> ::number/round | source | toString | lines | filter ~(startsWith "| takes") | first
"| takes :digits"

> :Box |~~ B ~~| | :Box/print ~("box") | [::Box#1 ::Box] | print
"[box ::Box]"

> :number/print ~("n") | get [~([::Box#5 7] | print) ~(7 | print)]
["[::Box#5 7]" "n"]

> {:a {:b [1 2]}} | get /c !| trace
::trace[::frame[{:a {:b [1 2]}} ~(get /c)]]

> [1 "x" 3] | map ~(mul 2) !| trace | print | lines | count
4

> "[1] | map ~(:a (\"x\" | add 1)\n| :b 2)" | parse | open !| trace | map ~(print | lines | count)
[1 1 1 1]
```

## legend

`legend`, a verb of `::any`, answers the legend of its subject, a value
under `::legend`, a kind of the core whose `print` lays the print of the
value it tells out by that value's kind [QSBLD#value], so a host prints a
legend as it prints any answer, painted by the tokens of the language, and
`payload` answers the value told. A part the kind reads by a path of one
segment, a key of the map or an index of the vector it is laid over,
stands on a line of its own beside its gloss, a part at an index beside
its name too, which its print does not write; the head, the tag and the
bracket the value opens with, stands beside the gloss of the page `doc`
reads of the subject [QSSLF#axis]; a part no name wires stands with no
comment, and a part the kind computes, by code or a longer path, stands in
no legend, `manifest` naming it and `doc` reading its page. A value of a
kind that wires nothing, one whose payload holds no key or index and one
its kind prints itself stand on one line beside their gloss. The gloss of
a page is its first words, before the first colon, semicolon or period its
prose ends a clause with, a span between backquotes and a quote of code
read whole, on one line; the page of a link alone is glossed by the page
`doc` reads of the tag it links to, and a page that leads to no words
leaves a part at a key with no comment and a part at an index named alone.
Each gloss is a closed comment, `|~ … ~|`, which ends where it closes, and
whitespace [QSSYN#comment], so the text reads back as the subject in any
layout it stands in; each part prints as `print` prints it, the print of
its kind among them, on one line, and the glosses of the lines within half
the width of a line stand aligned at a column of sixteen at least. A
vector, a set or a map that holds a legend lays each of its parts on a
line of its own.

```sh
$ qlang ':Box |~~ A parcel: of a width. ~~| (::kind | wires :w |~~ The width: in centimetres. ~~| /w ::number) | ::Box{:w 3 :note "x"} | legend' < /dev/null
::Box{          |~ A parcel ~|
  :w 3          |~ The width ~|
  :note "x"
}
```

```qlang
> [1 2] | map ~legend | get [~(print | lines | count) ~(print | parse | open) ~(first | tag)]
[4 [1 2] ::legend]
```

## json

`json` writes the JSON text of a value and `parseJson` reads one. A set
is written as the array of its elements in the one order, a keyword as
its name, a path and a regex as their literals, a quote, a doc and a
tag name as their prints, and a value under a tag as the object
`{"$tag": name, "payload": …}`, the name without its `::`, an error at
rest two such layers, the tag of its site over `error`, while a failure a
host converts, which no value of the pipe holds, writes
`{"$error": {"$tag": name, "facts": …}}`; `parseJson`
reads such an object back as the plain map it is. `parseJson` takes a
string, `::string/parseJson/SubjectNotStringError` refusing another,
and refuses a text that is no JSON with the reason, and a number past
the doubles with its `:path`, the path to it in the text, and none where
the number is the whole text [QSPTH#value]; a duplicate key reads as
`JSON.parse` reads it.

```qlang
> #[3 1] | json
"[1,3]"

> ::Box#1 | json
"{\"$tag\":\"Box\",\"payload\":1}"

> "[1, 2" | parseJson !| tag
::string/parseJson/TextNotJsonError

> "[1e400]" | parseJson !| get [~(tag) ~(path)]
[::string/parseJson/NumberNotFiniteError /0]

> "1e400" | parseJson !| payload | keys
#[:trace]
```

## elide

`elide` answers a value whose print fits a budget of characters, a whole
count above zero, another number refused as
`::any/elide/budget/NotCountError` and a value of another kind as
`::any/elide/budget/KindNotTakenError`, where it can, each part it leaves
out giving way to an elision, a value of the kind `::elision`.
The largest part gives way first, or instead a part within it that
prints more than half of it, and a part gives way only where the least it
gives way to prints shorter than it, so where no part's least is shorter
the answer stands over the budget. Each part gives way by its kind, at
the top as beneath it. A vector, a set and a map keep their first half
and an elision of the rest, which its `:read` reads by `drop`, halving
until they give way whole beneath the top, while the top keeps its first
part at the least. A map's rest stands under the key `:"…"`: a map whose
kept entries hold that key of the data keeps the entries before it, and
gives way whole where it is the first. A set stands in the one order, its
elision where `::elision` ranks, and the parts a vector and a map keep
stand at the paths that read them in the value. A value under a tag
halves as its payload, its tag kept over what it keeps, and gives way
whole with its tags. A string, a doc, a quote and a part a kind prints
its own way give way whole, their elision holding under `:head` the first
characters of their text or of that print, the top read back by the empty
quote, `~()`; a frame keeps its steps and its path, its subject alone
giving way, read by the name its kind wires, `~(!| get /trace/1 | subject)`,
and an atom stands. An elision holds `:read`, the query that,
continued from the value `elide` took, reads the part left out, and
`:size`, the elements or the entries of a container its `:read` answers,
or the characters of a text, as `count` counts them, or of a print, an
elision the value holds counting as one element. An elision prints on one
line, the printer of the core writing it, since a view is cut before the
print a kind declares is asked for, so the budget goes to the parts the
view shows. The print of a view reads back as the view, but under a kind
that checks its parts, as `::trace` takes frames alone, which refuses the
elision it holds. A value whose print fits is answered as it is.

```qlang
> 1000 | range | elide 120 | print
"[0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 ::elision{:size 984 :read ~(drop 16)}]"

> 100 | range | elide 10 | last | get [~(tag) /size /read]
[::elision 99 ~(drop 1)]

> [1 2] | elide 100
[1 2]

> [[] {:n 1} "short"] | elide 3
[[] {:n 1} "short"]

> 200 | range | map ~("a") | join "" | :s it | get [~(s) ~(s)] | elide 200 | get [~(count) ~(last | tag)]
[2 ::elision]

> [1 2] | elide 0 !| tag
::any/elide/budget/NotCountError

> 1000 | range | map ~(get [~(it) ~(it)]) | toMap | get [~(print | count) ~(elide 2000 | print | count | lte 2000)]
[12783 true]

> 300 | range | tag ::Box | elide 100 | get [~(tag) ~(print | count | lte 100)]
[::Box true]

> 200 | range | map ~("a") | join "" | elide 50 | get [~(tag) /size /read]
[::elision 200 ~()]

> get [~({"a": 1, "…": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7} | elide 34 | get /"…"/size) ~({"…": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6} | elide 20 | get /read)]
[6 ~()]

> get [~(1000 | range | elide 120 | elide 40) ~([1 2 3 4 5 6 7 8 9 10 11 12 ::elision{:size 1000 :read ~(drop 12)}] | elide 30)]
[[0 ::elision{:size 16 :read ~(drop 1)}] [1 ::elision{:size 12 :read ~(drop 1)}]]

> get {:b ~(300 | range | tag ::Box) :n 1} | elide 40 | get /b
::elision{:size 300 :read ~(get /b)}

> [{:n 1} "x" 3] | map ~(mul 2) !| trace | elide 60 | print | parse | open !| tag
::trace/ElementKindNotTakenError
```

## budget

Every host but the REPL prints an answer within one budget,
`ANSWER_BUDGET` of the core, the characters of the print counted as
`count` counts a string, which is never smaller than the first screen,
`[::qlang ::cli] | map ~(get [~(it) ~(doc)])`: an answer that fits
prints whole, and one past the budget prints as the failure
`::qlang/AnswerBeyondBudgetError` instead, whose facts are
`:characters`, the characters of the print, `:budget`, `:actualTag`,
the kind of the answer, and `:actualValue`, its head, the answer cut to
the excerpt of an alert [QSERR#alert], or given way whole where no cut
fits it, the `:read` of each elision there continuing the query from the
answer, `~(drop 12)` [QSERR#site]. A query cuts a value by `elide`
[QSPRN#elide], and the command line writes no flag that sets or cuts the
budget [QSCLI#answer].

```sh
$ qlang '3000 | range | map ~(get {:id ~(it) :name "user"})' < /dev/null | grep -o -E ':(characters|budget) [0-9]+|::elision\{:size [0-9]+ :read ~\(drop [0-9]+\)\}'
:characters 70891
:budget 16000
::elision{:size 2988 :read ~(drop 12)}
```

## span

Where a reading of text stopped is a span: six integers under
`::span`, the offset of its start and its line and column, then those of
the point after its end, the parser counting the offset from zero and
the line and the column from one, the offset and the column in the
characters a string counts. Its kind wires its two ends [QSBLD#value],
`start` and `end`, each a point it decodes from three of the numbers
through the door of `::point`, three integers its kind wires as `offset`,
`line` and `column`, and each of its six numbers by its index,
`startOffset`, `startLine`, `startColumn`, `endOffset`, `endLine` and
`endColumn`, so the line where a parse stopped is read by its names,
`!| location | startLine`, and the location of a refusal
of a parse is laid through the door of its span. A payload that is no
vector is refused as `…/PayloadKindNotTakenError`, an element that is no
number as `…/ElementKindNotTakenError` with its `:index`; a span of fewer
numbers leaves its end unread, `::span/end/NotReadError`, the refusal of
the point among its facts, and a point of another length or with a
fraction is refused by the invariant of its kind,
`::point/PayloadNotOffsetLineAndColumnError`, which names the roles of its
numbers.

```qlang
> "[1 2" | parse !| location | start
::point[4 1 5]

> ::span[0 1 1] !| tag
::span/end/NotReadError

> ::span[0 1 "x" 1 1 2] !| get [~(tag) ~(index)]
[::span/ElementKindNotTakenError 2]
```
