# QSPRN · Printing, codecs and places in text

How a value is written as text and read back, what a budget leaves out,
and the place a reading of text stopped. The requirements of each
section are the cases of its file under `core/test/conformance/QSPRN/`.

## print

`print`, a word of `::any`, answers the text of its subject: an atom as
its literal, a vector and a map by their brackets around the print of
each element, the set, the quote, the doc and the error by their own
brackets, a quote of a path alone as `::quote[/a]`, and any other value
under a tag as its tag before the print of its payload, every tag but
the kind the brackets imply, so `::vec[1 2]` prints `[1 2]`; the text of
a value of the language reads back as it. A kind answers `print` under
its own label, and the print of a value finds the `print` of each part
by the walk of that part, an answer that is no string printed in its
place; a kind's own `print` gives the text it chooses, which reads back
where it writes the kind's literal. What a host leaves out of an answer
stands as an `::elision` before the print, so the print holds all it is
given. The print of a failure finds the print of each part of its facts as the
print of every value does. Every host prints an answer through `print`,
the command line a string as its text and the REPL as its literal.

```qlang
> {:a [1 "x" :k]} | :v it | print | parse | apply it | eq v
true

> #[2 1] | print
"#[1 2]"

> :Box |~~ B ~~| | :Box/print ~("box") | [::Box#1] | print
"[box]"
```

## json

`json` writes the JSON text of a value and `parseJson` reads one. A set
is written as the array of its elements in the one order, a keyword as
its name, a path and a pattern as their literals, a quote, a doc and a
tag name as their prints, and a value under a tag as the object
`{"$tag": name, "payload": …}`, the name without its `::`, an error at
rest two such layers, the tag of its site over `error`; `parseJson`
reads such an object back as the plain map it is. `parseJson` takes a
string, `::string/parseJson/SubjectNotStringError` refusing another,
and refuses a text that is no JSON with the reason, and a number past
the doubles with its `:path`, the vector of the keys, strings as JSON
writes them, and the places to it; a
duplicate key reads as `JSON.parse` reads it.

```qlang
> #[3 1] | json
"[1,3]"

> ::Box#1 | json
"{\"$tag\":\"Box\",\"payload\":1}"

> "[1, 2" | parseJson !| type
::string/parseJson/TextNotJsonError

> "[1e400]" | parseJson !| get [~(type) /path]
[::string/parseJson/NumberNotFiniteError [0]]
```

## elide

`elide` answers a value whose print fits a budget of characters, a whole
count above zero, another refused as `::any/elide/budget/NotCountError`,
where it can, replacing parts by values of the kind `::elision`.
The largest part gives way first, or in its place a part within it that
prints more than half of it, and a part gives way only where the least it
gives way to prints shorter than it, so where no part's least is shorter
the answer stands over the budget. A string, a doc, a quote or a map
beneath the top gives way whole to its marker, and a vector or a set to
its first half and a marker of the rest, halving until it gives way
whole, a set standing in the one order; the top keeps its shape, a vector
or a set there halving to its first element at the least, and a
container under a tag keeps its shape, its parts giving way within. A
part a kind prints its own way stands as that kind prints it, the budget
counting the print a host writes. A marker holds `:size`, what it stands
for, a part that already gave way whole counting as one element and a
text its characters as `count` counts them, through the tags over it,
`:read`, the quote that
applied to the value `elide` took answers the part left out, and for a
string, a doc and a quote `:head`, the first characters of its text; it
prints and reads back as the value it is. A
value whose print fits is answered as it is.

```qlang
> [1 2] | elide 100
[1 2]

> [[] {:n 1} "short"] | elide 3
[[] {:n 1} "short"]

> 200 | range | map ~("a") | join "" | :s it | get [~(s) ~(s)] | elide 200 | get [~(count) ~(last | type)]
[2 ::elision]

> [1 2] | elide 0 !| type
::any/elide/budget/NotCountError
```

## span

The place a reading of text stopped is a span: six integers under
`::span`, the offset of its start and its line and column, then those of
the point after its end, the parser counting the offset from zero and
the line and the column from one, the offset and the column in the
characters a string counts. `start` and `end` answer its ends as
points, three integers under `::point`, read by `offset`, `line` and
`column`, each a word of its kind, `5 | start` refused as
`::span/start/SubjectNotSpanError`. A payload that is no vector is
refused as `…/PayloadKindNotTakenError`, an element that is no number as
`…/ElementKindNotTakenError` with its `:index`, and a vector of another
length or with a fraction by the invariant of the kind,
`::span/PayloadNotSixNumbersError` and
`::point/PayloadNotThreeNumbersError`.

```qlang
> "[1 2" | parse !| get /location | start
::point[4 1 5]

> ::span[0 1 1] !| type
::span/PayloadNotSixNumbersError

> ::span[0 1 "x" 1 1 2] !| get [~(type) /index]
[::span/ElementKindNotTakenError 2]
```
