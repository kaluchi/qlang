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
value passes to the words of its payload. A word means one act wherever
it resolves, each kind that answers it implementing that act, and a word
on a label the walk reaches first stands over one of the same name it
reaches later, a word of `::tagged` over one of the payload's kind.
`is` answers whether the walk of a value's tags reaches a value of one
of the kinds it is given, `::any` among them; a tag name is a value of
`::tag`, so `::vec | is ::vec` is false and `::vec | is ::tag` true.

```qlang
> ::Box#1 | payload
1

> ::Box#5 | gt 3
true

> :number/type ~("mine") | 5 | type
"mine"

> 5 | is ::number
true
```

## residence

A word resides on the label its address names, whoever declared it, a
reader extending a noun of the root among them, and a name several kinds
answer is declared on each, `::vec/count`, `::set/count`, `::map/count`,
`::string/count`, one primitive serving several where they share it. A
word serves the values the walk of their tags brings to its label and,
beside them, a value of the kinds its `on` names, of tag names the
noun's own alone [QSDSP#tagname]; a word that is the one
word of its name refuses any other subject under its own address. A
refinement a word wants checked is written where the value is made,
`x | tag ::Pos | f`, its constructor answering there. A word is called by
its name or by its address, which checks the subject by that residence;
a set, a quote and a doc are vectors to a word of vectors, each answered
back as its own kind. The comparisons reside on each kind whose values
they compare, an input of another kind refused.

```qlang
> :Pos |~~ Pos. ~~| | :Pos/f ~(1) | -1 | f !| type
::Pos/f/SubjectNotPosError

> #[1 2] | vec/count
2

> ~(a | b | c) | take 2
~(a | b)

> "b" | gt "a"
true

> 1 | gt "x" !| type
::number/gt/value/KindNotTakenError
```

## refusal

A name whose words reside on several kinds, none of which the walk of
the subject reaches, is refused as `::call/KindAnswersNoVerbError`, with
the name as `:name`, the subject's outermost tag as `:actualType`, the
addresses of the words of that name as `:addresses`, and, where the
pages of those words lead to one, `:nearest`, the words they link that
the subject answers and whose answer is a kind those words answer.

```qlang
> 5 | count !| get [~(type) /actualType /addresses]
[::call/KindAnswersNoVerbError ::number #[::map/count ::set/count ::string/count ::vec/count]]

> [1 2] | toString !| get /nearest
[:json :print]
```

## answer

A word written in steps runs on the subject with its tags, and what it
answers keeps the tags its steps keep; a primitive runs on the value the
walk served. A word whose answer is its subject's own kind keeps the
tags the walk passed, their constructors run again, so an edit that
breaks an invariant of a tag is refused under it, and an answer that is
no value of the label is refused as `…/answer/KindNotTakenError`
[QSBLD#answer]. A word whose answer names another kind answers that
kind, made by its constructor and refused under the answer where the
kind refuses it, the passed tags left behind; and a word whose answer
names `::any`, or that names none, answers what it computed, `map` among
them.

```qlang
> ::T{:a 1 :b 2} | filter ~(eq 1) | type
::T

> ::Box[1 2] | map ~(add 1)
[2 3]

> :vec/n (::fn | returns |~~ The answer. ~~| ::string | impl ~(count)) | [1] | n !| type
::vec/n/answer/KindNotTakenError
```

## tagname

A tag name in the subject position walks the kind of tag names, then the
noun the tag names, then `::any`, so a bare name after it finds the
tag's own words first, then the noun's, each step resolving by its own
subject; a fan-out over the noun is a template of `get` whose quotes run
against the tag name. A word of the noun itself, whose function names
`::tag` by `on`, serves the noun's values and the noun's own tag name,
and refuses every other tag name, one under the noun among them; a word
of the noun's values refuses a tag name under the word; and a function
`apply` runs, which has no label, serves any tag name where its `on`
names `::tag`. The builders of a function and of a kind, `on`, `takes`,
`wraps`, `reads` and the rest, are words of their nouns, so a tag of
another noun is refused by them as by every word.

```qlang
> ::number | gt ::A
true

> ::vec | count !| type
::vec/count/SubjectNotVecError

> :Shop |~~ A shop. ~~| | :Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5")) | get [~(::Shop | hours) ~(::Other | hours !| type)]
["9 to 5" ::Shop/hours/SubjectNotShopError]

> ::number | takes :by |~~ b ~~| /0 !| type
::fn/takes/SubjectNotFnError
```
