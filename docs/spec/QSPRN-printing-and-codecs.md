# QSPRN · Printing, codecs and places in text

How a value is written as text and read back, what a budget leaves out,
and the place a reading of text stopped. The requirements of each
section are the cases of its file under `core/test/conformance/QSPRN/`.

## print

`print`, a verb of `::any`, answers the text of its subject: an atom as
its literal, a vector and a map by their brackets around the print of
each element, the set, the quote, the doc and the error by their own
brackets, a quote of a path alone as `::quote[/a]`, and any other value
under a tag as its tag before the print of its payload, every tag but
the kind the brackets imply, so `::vec[1 2]` prints `[1 2]`; the text of
a value of the language reads back as it by `parse | open`. A vector and
a set stand on one line unless a part takes several, and then each part
stands on a line of its own; a map of two entries or fewer, none a
container, stands on one line, and any other puts each entry on a line
of its own, indented by two. An elision stands on one line whatever it
holds, so a container that holds one keeps the layout its other parts
give it, and a value of `::frame` stands on one line whatever it holds as
well, a value of `::trace` of two frames or more putting each frame on a
line of its own. A kind answers `print` under
its own label, and the print of a value finds the `print` of each part
by the walk of that part, an answer that is no string printed in its
place; a kind's own `print` gives the text it chooses, which reads back
where it writes the kind's literal. What a host leaves out of an answer
stands as an `::elision` before the print, so the print holds all it is
given. The print of a failure finds the print of each part of its facts as the
print of every value does. Every host prints an answer through `print`,
the command line a string as its text and the REPL as its literal.

```qlang
> {:a [1 "x" :k]} | :v it | print | parse | open | eq v
true

> #[2 1] | print
"#[1 2]"

> :Box |~~ B ~~| | :Box/print ~("box") | [::Box#1] | print
"[box]"

> {:a {:b [1 2]}} | get /c !| trace
::trace[::frame[{:a {:b [1 2]}} ~(get /c)]]

> [1 "x" 3] | map ~(mul 2) !| trace | print | lines | count
4
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

> "[1, 2" | parseJson !| type
::string/parseJson/TextNotJsonError

> "[1e400]" | parseJson !| get [~(type) /path]
[::string/parseJson/NumberNotFiniteError /0]

> "1e400" | parseJson !| keys
#[:trace]
```

## elide

`elide` answers a value whose print fits a budget of characters, a whole
count above zero, another number refused as
`::any/elide/budget/NotCountError` and a value of another kind as
`::any/elide/budget/KindNotTakenError`, where it can, each part it leaves
out giving way to an elision, a value of the kind `::elision`.
The largest part gives way first, or in its place a part within it that
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
quote, `~()`; a frame keeps its steps and its place, its subject alone
giving way, and an atom stands. An elision holds `:read`, the query that,
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

> 100 | range | elide 10 | last | get [~(type) /size /read]
[::elision 99 ~(drop 1)]

> [1 2] | elide 100
[1 2]

> [[] {:n 1} "short"] | elide 3
[[] {:n 1} "short"]

> 200 | range | map ~("a") | join "" | :s it | get [~(s) ~(s)] | elide 200 | get [~(count) ~(last | type)]
[2 ::elision]

> [1 2] | elide 0 !| type
::any/elide/budget/NotCountError

> 1000 | range | map ~(get [~(it) ~(it)]) | toMap | get [~(print | count) ~(elide 2000 | print | count | lte 2000)]
[12783 true]

> 300 | range | tag ::Box | elide 100 | get [~(type) ~(print | count | lte 100)]
[::Box true]

> 200 | range | map ~("a") | join "" | elide 50 | get [~(type) /size /read]
[::elision 200 ~()]

> get [~({"a": 1, "…": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7} | elide 34 | get /"…"/size) ~({"…": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6} | elide 20 | get /read)]
[6 ~()]

> get [~(1000 | range | elide 120 | elide 40) ~([1 2 3 4 5 6 7 8 9 10 11 12 ::elision{:size 1000 :read ~(drop 12)}] | elide 30)]
[[0 ::elision{:size 16 :read ~(drop 1)}] [1 ::elision{:size 12 :read ~(drop 1)}]]

> get {:b ~(300 | range | tag ::Box) :n 1} | elide 40 | get /b
::elision{:size 300 :read ~(get /b)}

> [{:n 1} "x" 3] | map ~(mul 2) !| get /trace | elide 60 | print | parse | open !| type
::trace/ElementKindNotTakenError
```

## span

The place a reading of text stopped is a span: six integers under
`::span`, the offset of its start and its line and column, then those of
the point after its end, the parser counting the offset from zero and
the line and the column from one, the offset and the column in the
characters a string counts. `start` and `end` answer its ends as
points, three integers under `::point`, read by `offset`, `line` and
`column`, each a verb of its kind, `5 | start` refused as
`::span/start/SubjectNotSpanError`. A payload that is no vector is
refused as `…/PayloadKindNotTakenError`, an element that is no number as
`…/ElementKindNotTakenError` with its `:index`, and a vector of another
length or with a fraction by the invariant of the kind,
`::span/PayloadNotStartAndEndError` and
`::point/PayloadNotOffsetLineAndColumnError`, each naming the roles of
its numbers.

```qlang
> "[1 2" | parse !| get /location | start
::point[4 1 5]

> ::span[0 1 1] !| type
::span/PayloadNotStartAndEndError

> ::span[0 1 "x" 1 1 2] !| get [~(type) /index]
[::span/ElementKindNotTakenError 2]
```
