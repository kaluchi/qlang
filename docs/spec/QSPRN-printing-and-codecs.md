# QSPRN · Printing, codecs and spans of text

How a value is written as text and read back, the legend that glosses
its parts, the excerpt that tells a value within a room, the budget of an
answer, and the span where a reading of text stopped. The requirements of each
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
later line runs on through the steps after it [QSSYN#line]. A value of
`::frame` stands on one line whatever it holds, a value of `::trace` of
two frames or more putting each frame on a line of its own. On one line every part stands on one line, every part of
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
reads back where it writes the kind's literal. The excerpt a host shows of
a fact of a failure or of an answer past the budget is a value of
`::excerpt` [QSPRN#excerpt], which prints as any value under its tag, so the
print holds all it is given. The print of a failure finds the print of each
part of its facts as the print of every value does. Every host prints an answer through the one print of the
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
line of its own. A tag name lays out the kind it names: the tag beside the
gloss of its page and beneath it a closed comment for each name the kind
wires, in the order it wires them, the name, the path it reads where it
reads no key of its own name, the kind of the part and the gloss of its
page, so the print reads back as the tag and `kinds | map ~legend` tells
the parts of every kind before a value of it is held. A legend is an
answer, printed within the budget of every answer [QSPRN#budget], and a
legend that lays its parts out a line each and passes the budget lays each
part past the room of a fact, three hundred characters, as its excerpt
[QSPRN#excerpt].

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

> ::point | legend | print | lines | get /2
"|~ line /1 ::number · The line of the point, counted from one ~|"

> ::span | legend | print | parse | open
::span

> 1 | add (5000 | range) !| legend | print | get [~(count | lt 16000) ~(contains ":actualValue ::excerpt{:of ::vec :count 5000")]
[true true]
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

## excerpt

`excerpt`, a verb of `::any`, answers the excerpt of its subject within the
characters of print it takes, three hundred where it takes none, a value of
`::excerpt`: `of` the tag of the subject, `count` its elements, its entries
or the characters of its text, as `count` counts them, and `parts` the
parts it shows whole, taken from its two ends inward by turns, an end
stopping at its first part that passes what the room leaves. A vector, a
set, a quote and a doc show their elements under their indices and a map
its entries under their keys; a string, a value with no parts and one its
kind prints show the first and the last characters of their text under
their offsets, which `drop` reads to them; and a value that fits shows
whole. `excerpt` always answers an excerpt, so the kind of its answer is
known before the call, and refuses a budget that is no whole count above
zero, `::any/excerpt/budget/NotCountError`, and one past the budget of
every answer, `::any/excerpt/budget/PastTheBudgetError`, which names that
budget. The kind of an excerpt wires its three names, so `count` answers
the count of the value told and no verb of that value answers it, a step
after it meeting a value of its own kind and never data with a hole; an
excerpt prints as a map under its tag and reads back as itself. A host
shows so a fact of a failure past the room of a fact [QSERR#alert] and an
answer past the budget [QSPRN#budget].

```qlang
> 3410 | range | excerpt | get [~(of) ~(count) ~(parts | get [/0 /3409])]
[::vec 3410 [0 3409]]

> [1 2] | excerpt
::excerpt{:of ::vec :count 2 :parts {:"0" 1 :"1" 2}}

> 1000 | range | map ~("ab") | join "" | excerpt 80 | get [~(of) ~(count) ~(parts | keys | count) ~(print | count | lte 80)]
[::string 2000 2 true]

> 3410 | range | excerpt | take 3 !| tag
::call/KindAnswersNoVerbError

> [1 2] | excerpt 300000 !| get [~(tag) ~(budget)]
[::any/excerpt/budget/PastTheBudgetError 16000]

> 1000 | range | excerpt | :e it | print | parse | open | eq e
true
```

## budget

Every host but the REPL prints an answer within one budget,
`ANSWER_BUDGET` of the core, the characters of the print counted as
`count` counts a string, which is never smaller than the first screen,
`[::qlang ::cli] | map ~(get [~(it) ~(doc)])`: an answer that fits
prints whole, and one past the budget prints as the failure
`::qlang/AnswerBeyondBudgetError` instead, under the line of the raise,
whose facts are `:characters`, the characters of the print, `:budget`,
`:answer`, the answer, which its alert shows as its excerpt
[QSPRN#excerpt], and `:cell`, the cell its host keeps the answer in,
where it keeps one [QSHST#cell]. A query tells a value within a budget of
its own by `excerpt`, and the command line writes no flag that sets or
cuts the budget [QSCLI#answer].

```sh
$ qlang '3000 | range | map ~(get {:id ~(it) :name "user"})' < /dev/null | grep -o -E ':(characters|budget|count) [0-9]+|:cell ::cell"[0-9a-f]{12}"' | sed 's/"[0-9a-f]*"/"…"/'
:characters 70891
:budget 16000
:count 3000
:cell ::cell"…"
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
