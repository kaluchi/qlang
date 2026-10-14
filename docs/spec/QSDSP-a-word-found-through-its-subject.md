# QSDSP · A word found through its subject

How a name a step calls finds its word: by the subject's kinds, from the
outside in, and what a word takes as its subject and answers. The
requirements of each section are the cases of its file under
`core/test/conformance/QSDSP/`.

## walk

A word resolves against the subject by walking its stack of tags from
the outside in, down to the kind of the core at the bottom, and beneath
every kind lies `::any`, where every walk ends and the words of any value
live: `type`, `eq`, `apply`, `if`, `cond`, `coalesce`, `json`, `env`,
and the axes. A tagged value reaches `::tagged` after its own tag and
before its payload, where `payload` and `within` live, so a tag over a
value passes to the words of its payload. A word on a narrower label
stands over one of the same name on a broader one.

```qlang
> ::Box#1 | payload
1

> ::Box#5 | gt 3
true

> :number/type ~("mine") | 5 | type
"mine"
```

## residence

A word resides on the kind its subject names, declared in the source of
that noun, and a name several kinds answer is declared on each,
`::vec/count`, `::set/count`, `::map/count`, `::string/count`, one
primitive serving several where they share it. A word takes as its
subject a value the walk of its tags brings to its label and refuses any
other under its own address; no constructor turns the value in the pipe
into the kind a word serves. A word is called by its name or by its
address, which checks the subject by that residence; a set is a vector
to a word of vectors. The comparisons reside on each kind whose values
they compare, an input of another kind refused.

```qlang
> :Pos |~~ Pos. ~~| | :Pos/f ~(1) | -1 | f !| type
::Pos/f/SubjectNotPosError

> #[1 2] | vec/count
2

> "b" | gt "a"
true

> 1 | gt "x" !| type
::number/gt/value/NotNumberError
```

## refusal

A name no kind of the subject answers is refused as
`::call/KindAnswersNoVerbError`, with the kind as `:actualType` and the
addresses of the words of that name as `:addresses`.

```qlang
> 5 | count !| get [~(type) /actualType /addresses]
[::call/KindAnswersNoVerbError ::number #[::map/count ::set/count ::string/count ::vec/count]]
```

## answer

A word whose answer is its subject's own kind keeps the tags the walk
passed, their constructors run again, so an edit that breaks an
invariant of a tag is refused under it; a word whose answer names
another kind answers that kind, the passed tags left behind. A word
whose function names its answer's kinds checks the answer against them.

```qlang
> ::T{:a 1 :b 2} | filter ~(eq 1) | type
::T

> ::Box[1 2] | map ~(add 1)
[2 3]

> :vec/n (::fn | returns |~~ The answer. ~~| ::string | impl ~(count)) | [1] | n !| type
::string/PayloadNotStringError
```

## tagname

A tag name in the subject position walks the kind of tag names, then the
noun the tag names, then `::any`, so a bare name after it finds the
tag's own words first, then the noun's. A word of the noun itself, whose
function names `::tag` by `on`, serves the noun's own tag name alone; a
word of the noun's values refuses a tag name under the word.

```qlang
> ::number | gt ::A
true

> ::vec | count !| type
::vec/count/SubjectNotVecError

> :Shop |~~ A shop. ~~| | :Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5")) | get [~(::Shop | hours) ~(::Other | hours !| type)]
["9 to 5" ::Shop/hours/SubjectNotShopError]
```
