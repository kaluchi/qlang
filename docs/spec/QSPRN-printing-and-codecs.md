# QSPRN · Printing, codecs and spans of text

How a value is written as text and read back, the legend that glosses
its parts, the excerpt that tells a value within a room, the budget of an
answer, and the span where a reading of text stopped. The requirements of each
section are the cases of its file under `core/test/conformance/QSPRN/`.

## print

`print`, a verb of `::any`, answers the text of its subject: an atom as
its literal, a vector and a map by their brackets around the print of
each element, the set, the quote, the doc and the error by their own
brackets, a quote of a path alone as `::quote[/age]`, and any other value
under a tag as its tag before the print of its payload, every tag but
the kind the brackets imply, so `::vec[1 2]` prints `[1 2]`; the text of
a value of the language reads back as it by `parse | answer`. A string
prints as JSON writes it: `"` and `\` escaped, a line break, a tab, a
carriage return, a backspace and a form feed as `\n`, `\t`, `\r`, `\b` and
`\f`, and any other character below U+0020 and a lone surrogate as `\u`
and their four digits, so the print shows a control character below
U+0020 and holds no code unit a text in UTF-8 cannot carry, while DEL and
the controls of U+0080 to U+009F stand raw, as JSON writes them. A vector and
a set stand on one line unless a part takes several, and then each part
stands on a line of its own; a map of two entries or fewer, none a
container, stands on one line, and any other puts each entry on a line
of its own, indented by two. A doc prints as `|~~`, its prose and `~~|`,
a space between them, each line of its prose after the first at the
indentation of the line it opens on and two more and a blank line empty,
so it reads back as itself [QSSLF#doc]. A step of a quote whose line, its
pipe among it, passes eighty characters is laid on lines by the printer,
but where a value stands on one line: a command
writes its name on its line and each modifier on a line of its own,
indented by four, a keyword on the line before it, the name a command of
a chain gives, `| takes :digits`; a declaration
with a page writes its name on its line and each doc of its slot on a
line of its own, indented by two, its body on the line of its last doc,
each of which reads back as written, a line break being whitespace
[QSSYN#line]. A value of
`::frame` stands on one line whatever it holds but a line break of the
prose of a doc, a value of `::trace` of two frames or more putting each
frame on a line of its own. On one line every part stands on one line,
every part of a quote among it, the modifiers of its calls, the docs and
the body of its declarations and the parts of its literals, which read
back as the same steps, a line break of the prose of a doc standing as it
is, which the literal of a doc writes no other way [QSSLF#doc], so a frame lays the quote it holds on one line; a host that
writes a value on one line, a cell of the `table` of the streams among
them, whose view writes the prose of a doc with each line break as a
space, asks the printer for that form.

The literal of a value is the language's, whatever its kind: a `print`
declared under a label, a kind of a reader, of a host or of the root, is
refused, `::bind/PrintDeclaredError`, `:name` naming it, and one under
`::any`, whose `print` it is, as a name declared twice,
`::bind/NameDeclaredTwiceError`, and a view of a
value for reading is a verb of its own name, `legend` among them. What a
host prints of an answer is drawn over that literal by one layer of the
core, `printAnswer` and `boundAnswer`: the line
`|~| raised, and no !| caught it` over a failure [QSERR#print]; past the
budget of every answer the alert that keeps the answer in a cell
[QSPRN#budget], and a failure past its rooms told as a value of
`::excerpt` under the tag of its refusal, a fact past the room of a fact
the cell its host keeps it in [QSPRN#excerpt], each of which reads back
as itself, so the print holds all it is given and cuts nothing; and the
glosses of a legend laid over the parts of the value it tells as
comments, which read back as whitespace [QSPRN#legend]. `print` answers
that drawing whole and its painting is the medium's; the printer of the
literal knows no legend, a part drawn ahead of it standing on lines of
its own. Every host prints an answer through that layer, the playground
a string as its text and its REPL and the site an answer as its literal,
and every host but the REPL within the budget of every answer
[QSPRN#budget].

```qlang
> {:tags [1 "new" :vip]} | eq (print | parse | answer)
true

> #[2 1] | print
"#[1 2]"

> ["\uD800" "\u0007"] | map print
["\"\\ud800\"" "\"\\u0007\""]

> ["a\n  b\n\nc"] | tag ::doc | get [(print | lines | map count) (eq (print | parse | first))]
[[5 5 0 7] true]

> ::number/round | source | toString | lines | filter (startsWith "| takes") | first
"| takes :digits"

> [~(:Box |~~ B ~~|; :Box/print ~("box");) ~(:number/print ~("n");)] | map (answer !| get [tag name])
[[::bind/PrintDeclaredError :Box/print] [::bind/PrintDeclaredError :number/print]]

> [::Box#1 ::Box] | print
"[::Box#1 ::Box]"

> {:user {:tags [1 2]}} | get /group !| trace
::trace[::frame[{:user {:tags [1 2]}} ~(get /group)]]

> [1 "x" 3] | map (mul 2) !| trace | print | lines | count
4

> "[1] | map (:rate (\"x\" | add 1);\n:fee 2;\nrate)" | parse | answer !| trace | map (print | lines | count)
[1 1 1 1]
```

## legend

`legend`, a verb of `::any`, answers the legend of its subject, a value
under `::legend`, its literal the tag before the literal of the value it
tells, `::legend::point[…]`, a number, a boolean, null and a path
touching it by `#`, `::legend#5`, over which the layer that draws an
answer lays the glosses, the value told laid out by its kind
[QSBLD#value], so a host prints a legend as it prints any answer, painted
by the tokens of the language, and `payload` answers the value told
[QSPRN#print]. A part the kind reads by a path of one
segment, a key of the map or an index of the vector it is laid over,
stands on a line of its own beside its gloss, a part at an index beside
its name too, which its print does not write; the head, the tag and the
bracket the value opens with, stands beside the gloss of the page `doc`
reads of the subject [QSSLF#axis]; a part no name wires stands with no
comment, and a part the kind computes, by code or a longer path, stands in
no legend, `manifest` naming it and `doc` reading its page. A value of a
kind that wires nothing and one whose payload holds no key or index stand
on one line beside their gloss. A key beneath a
name the kind wires reads by three rules: its first segment the name, a
slot where the kind is the verdict of a verb; the next a part of the slot,
glossed beside it, `:addend/found`; and a name beneath a value a view of
that value, glossed by the verb of the view its tags walk to, or the tag
the alert shows first of a value past its room, `:addend/found/count`
beside `|~ count ::number · How many elements the vector holds ~|`. A key
an excerpt lays deep reads so from the kind the excerpt shows nearest
above it, the tag beneath an open tag, the tag a part shows first or the
kind of a part that stands whole [QSPRN#excerpt]. The gloss of
a page is its first words, before the first colon, semicolon or period its
prose ends a clause with, a span between backquotes and a quote of code
read whole, on one line; the page of a link alone is glossed by the page
`doc` reads of the tag it links to, and a page that leads to no words
leaves a part at a key with no comment and a part at an index named alone.
Each gloss is a closed comment, `|~ … ~|`, which ends where it closes, and
whitespace [QSSYN#comment], so the text reads back as the legend in any
layout it stands in, `payload` the subject; each part prints as its
literal, on one line, and the glosses of the lines within half
the width of a line stand aligned at a column of sixteen at least. A
vector, a set or a map that holds a legend lays each of its parts on a
line of its own. A tag name lays out the kind it names: the tag beside the
gloss of its page and beneath it a closed comment for each name the kind
wires, in the order it wires them, the name, the path it reads where it
reads no key of its own name, the kind of the part and the gloss of its
page, so the print reads back as the legend of the tag and
`::host | kinds | map legend` tells
the parts of every kind before a value of it is held; beneath them stands a
closed comment for each view the kind reveals [QSPRN#excerpt], its name,
the kind its verb answers and the gloss of the page of that answer, a view
whose verb names no answer standing with the gloss of the page of the verb
and a view that names no verb of the kind by its name. A legend is an
answer, printed within the budget of every answer as any answer is
[QSPRN#budget], every part of it whole.

```sh
$ qplay ':Box |~~ A parcel: of a width. ~~| (::kind | wires :width |~~ The width: in centimetres. ~~| /width ::number); ::Box{:width 3 :note "x"} | legend' < /dev/null
::legend::Box{  |~ A parcel ~|
  :width 3      |~ The width ~|
  :note "x"
}
```

```qlang
> [1 2] | map legend | get [(print | lines | count) (print | parse | answer) (first | tag)]
[4 [::legend#1 ::legend#2] ::legend]

> ::point | legend | print | lines | get /2
"|~ line /1 ::number · The line of the point, counted from one ~|"

> ::span | legend | print | parse | answer | payload
::span

> ::trace | legend | print | lines | drop 1 | first
"|~ failed ::vec · The steps that failed, level by level ~|"

> 1 | add (5000 | range) !| legend | print | get [(count | gt 16000) (contains "4999]")]
[true true]

> ::qlang/AnswerBeyondBudgetError::excerpt{:answer ::cell"dba04efcdf7d" :answer/tag ::legend :answer/payload/tag ::number/add/AddendKindNotTakenError :answer/addend/expected #[::number]} | legend | print | lines | get /4 | split "|~ " | get /1
"The number added to the subject, computed against the subject · The kinds the rule takes ~|"
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
the number is the whole text [QSPTH#value]; of two entries of one key the
last value stands where the first entry stood [QSLIT#container].

```qlang
> #[3 1] | json
"[1,3]"

> ::Box#1 | json
"{\"$tag\":\"Box\",\"payload\":1}"

> "[1, 2" | parseJson !| tag
::string/parseJson/TextNotJsonError

> "[1e400]" | parseJson !| get [tag path]
[::string/parseJson/NumberNotFiniteError /0]

> "1e400" | parseJson !| payload | keys
[:subject/found :trace]
```

## excerpt

A host prints the whole of a value: a fact of a failure past the room of
a fact, three hundred characters, stands as the cell its host keeps it in
[QSHST#cell], beside its tag, the first of its views, and the views the
kind of the fact reveals whose answers fit that room, each flat under the
name of the fact and its own, `:addend/found/tag ::vec` and
`:addend/found/count 3410` [QSERR#alert], and beside its parts, each by the
same rule under the name of the fact and its own, its own cell among it
where it passes its room: a map by its keys, an error at rest and an
excerpt by their facts, so a refusal a value holds shows its slots, and a
value under a tag its kind does not wire by the parts of what it holds, as
the walk of a verb passes that tag, the tag of what it holds under
`payload/tag`; a vector, a set, a string, a quote and a doc stand as their
views. A key is the chain a reader types, `:answer/addend/found/count`
read as `::cell"…" | answer | addend | found | count`, and a failure any
fact of which gave way prints as `::excerpt`, the map of the facts it
shows, under the tag of its refusal [QSERR#rest]. A kind reveals its views in its chain,
`| reveals :count`, each the name of a verb of the kind that takes no value
[QSBLD#kind], read as the verb of the kind that reveals it or of `::any`
where that kind declares none of its name, `shape` the verb of every
value; a value shows the views of the first kind of the walk of its tags
that reveals any, so a set shows those of vectors, and a view whose verb
refuses the value or that names no verb stands not, nor does one that
answers an empty vector, set, map or string. `::vec` reveals `count`,
`shape`, `first` and `last`, its size, its structure without its data and
the elements at its two ends; `::map` `count` and `shape`; `::string`
`count`; `::doc` `links`; and `::trace` `failed`, the steps that failed
level by level, `subject`, the subject the step that failed met, and
`paths`, the paths of the parts its levels failed at; the legend of
a tag name reads each view so. An excerpt is a map read by its keys, a view
by its key under the tag of a refusal, `payload | get /:addend/found/count`,
and prints and reads back as itself;
the whole is read live, a fact of a failure by `!|` and a cell by
`answer`.

```qlang
> [1 "x" 3] | map (mul 2) !| trace | get [failed subject paths]
[[~(mul 2) ~(map (mul 2))] "x" [/1]]

> ::excerpt{:addend/found ::cell"f410f1df625c" :addend/found/count 3410} | eq (print | parse | answer)
true

> ::number/add/AddendKindNotTakenError::excerpt{:addend/found ::cell"f410f1df625c" :addend/found/tag ::vec :addend/found/count 3410} | get [(addend | found | tag) (payload | get /:addend/found/count)]
[::cell 3410]

> ::vec | legend | print | lines | drop 1 | map (split " " | get /1)
["count" "shape" "first" "last"]

> ::map | legend | print | lines | drop 1 | map (split " " | get /1)
["count" "shape"]

> [1 2] | excerpt !| tag
::call/UnknownNameError
```

```sh
$ qplay '1 | add (3410 | range)' < /dev/null | grep -c -e '^  :addend/found ::cell"[0-9a-f]\{12\}"$' -e '^  :addend/found/tag ::vec$' -e '^  :addend/found/count 3410$'
3
```

## budget

Every host but the REPL prints an answer within one budget,
`ANSWER_BUDGET` of the core, the characters of the print counted as
`count` counts a string, which is never smaller than the first screen,
`[::qlang ::host] | map (get [it doc])`: an answer that fits
prints whole, and one past the budget prints as the failure
`::qlang/AnswerBeyondBudgetError` instead, under the line of the raise,
whose facts are `:characters`, the characters of the print, `:budget`,
and `:answer`, the answer, which its alert shows as any fact past the
room of a fact, the cell its host keeps it in, where it keeps one
[QSHST#cell], beside the views its kind reveals and its parts
[QSPRN#excerpt], so the alert of a legend past the budget shows the facts
of the refusal it tells.

```sh
$ qplay '3000 | range | map {:id it :name "user"}' < /dev/null | grep -o -E ':(characters|budget) [0-9]+|:answer ::cell"[0-9a-f]{12}"|:answer/count [0-9]+' | sed 's/"[0-9a-f]*"/"…"/'
:characters 70891
:budget 16000
:answer ::cell"…"
:answer/count 3000

$ qplay '1 | add (3410 | range) !| legend' < /dev/null | grep -o -E '^  :answer/(payload/tag|subject/found|addend/found/count) .*'
  :answer/payload/tag ::number/add/AddendKindNotTakenError
  :answer/subject/found 1
  :answer/addend/found/count 3410
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
numbers leaves an end unread, its start where it holds fewer than three,
`::span/StartNotReadError`, else its end, `::span/EndNotReadError`, the
refusal of the point among its facts, a point of fewer numbers leaves its
last part not given, `::point/ColumnNotGivenError`, and a point of more
or with a fraction is refused by the invariant of its kind,
`::point/PayloadNotOffsetLineAndColumnError`, which names the roles of its
numbers.

```qlang
> "[1 2" | parse !| location | start
::point[4 1 5]

> ::span[0 1 1] !| tag
::span/EndNotReadError

> ::span[0 1 "x" 1 1 2] !| get [tag index]
[::span/ElementKindNotTakenError 2]
```
