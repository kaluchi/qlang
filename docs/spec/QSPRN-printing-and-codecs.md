# QSPRN · Printing, codecs and places in text

How a value is written as text and read back, what a budget leaves out,
and the place a reading of text stopped. The requirements of each
section are the cases of its file under `core/test/conformance/QSPRN/`.

## print

`print`, a word of `::any`, answers the text that reads back as its
subject: an atom as its literal, a vector and a map by their brackets
around the print of each element, the set, the quote, the doc and the
error by their own brackets, and any other value under a tag as its tag
before the print of its payload, every tag but the kind the brackets
imply, so `::vec[1 2]` prints `[1 2]`. A kind answers `print` under its
own label, and the print of a value finds the `print` of each part by
the walk of that part; a compact print a host gives reads back through
the constructor of its tag. What a host leaves out of an answer stands
as an `::elision` before the print, so the print holds all it is given.
Every host prints an answer through `print`.

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
tag name as their prints, and a value under a tag, an error among them,
as its tag beside its payload. `parseJson` refuses a text that is no
JSON with the reason, and a number past the doubles with its `:path`.

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

`elide` answers a value whose print fits a budget of characters,
replacing what does not fit by values of the kind `::elision`. A part
gives way only where its marker prints shorter than it, the largest
first: a string or a map to its marker, a vector to its first half and a
marker of the rest. A marker holds `:size`, what it stands for, `:read`,
the quote that applied to the value `elide` took answers the part left
out, and for a string `:head`; it prints and reads back as the value it
is. A value whose print fits is answered as it is.

```qlang
> [1 2] | elide 100
[1 2]

> [[] {:n 1} "short"] | elide 3
[[] {:n 1} "short"]
```

## span

The place a reading of text stopped is a span: six whole numbers under
`::span`, the offset from zero, the line and the column from one of its
start and then of the point after its end. `start` and `end` answer its
ends as points, three whole numbers under `::point`, read by `offset`,
`line` and `column`. A payload that is no vector is refused as
`…/PayloadNotVecError`, an element that is no number as
`…/ElementNotNumberError` with its `:index`, and a vector of another
length or with a fraction by the invariant of the kind,
`::span/PayloadNotSixNumbersError` and
`::point/PayloadNotThreeNumbersError`.

```qlang
> "[1 2" | parse !| get /location | start
::point[4 1 5]

> ::span[0 1 1] !| type
::span/PayloadNotSixNumbersError

> ::span[0 1 "x" 1 1 2] !| get [~(type) /index]
[::span/ElementNotNumberError 2]
```
