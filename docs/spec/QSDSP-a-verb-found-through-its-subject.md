# QSDSP · A verb found through its subject

How a name a step calls finds its verb: by the subject's kinds, from the
outside in, and what a verb takes as its subject and answers. The
requirements of each section are the cases of its file under
`core/test/conformance/QSDSP/`.

## walk

A name a step calls finds its verb by walking the subject's stack of
tags from the outside in, down to the kind of the core at the bottom,
and beneath every kind lies `::any`, where every walk ends and the verbs
of any value live: `type`, `eq`, `apply`, `if`, `cond`, `coalesce`,
`json`, `env`, and the axes. A tagged value reaches `::tagged` after its
own tag and before its payload, where `payload` and `within` live, so a
tag over a value passes to the verbs of its payload, and a vector or a
map that holds a tag of its own, a set, a quote and a doc among them,
reaches `::vec` or `::map` after `::tagged`. A word reads a value it takes
from its subject or from code as a kind the same way, beneath every tag
over it, `::desc` among them: an element, a key, a condition, a pair and a
part a path meets on its way, two values that file under one keyword
meeting as they are. A name means one act
wherever it resolves, each kind that answers it implementing that act,
and a verb on a label the walk reaches first stands over one of the same
name it reaches later, a verb of `::tagged` over one of the payload's
kind. `is` answers whether the walk of a value's tags reaches a value of
one of the kinds it is given, `::any` among them; a tag name is a value
of `::tag`, so `::vec | is ::vec` is false and `::vec | is ::tag` true.

```qlang
> ::Box#1 | payload
1

> ::Box#5 | gt 3
true

> :number/type ~("mine") | 5 | type
"mine"

> :tagged/count ~(99) | #[1 2] | count
99

> get [~(5 | is ::number) ~(::vec | is ::vec) ~(::vec | is ::tag) ~(#[1] | is ::vec)]
[true false true true]

> get [~([::A::T{:a 1} {:b 2}] | union) ~([::T"a" "b"] | join ",") ~([1 2] | filter ~(gt 1 | tag ::Ok)) ~([::W#1 ::W#1] | groupBy)]
[{:a 1 :b 2} "a,b" [2] {:"1" [::W#1 ::W#1]}]
```

## residence

A verb resides on the label its address names, whoever declared it, a
reader extending a noun of the root among them, and a name several kinds
answer is declared on each, `::vec/count`, `::map/count`,
`::string/count`, one primitive serving several where they share it. A
verb serves the values the walk of their tags brings to its label and,
beside them, a value of the kinds its `on` names, of tag names the
noun's own alone [QSDSP#tagname]; a subject no verb of a name serves is
refused, where one verb holds the name, by that verb under its own
address, with its page and its repair, `42 | keys` as
`::map/keys/SubjectNotMapError`, and where several hold it by the call
[QSDSP#refusal]. A refinement a verb checks of its subject is an
invariant under its subject, `holds :subject/NotIntegerError`, and one
that names a concept a kind of its own, written where the value is made,
`x | tag ::Pos | f`, its kind answering there. A
verb is called by its name or by its address, which checks the subject
by that residence. A set, a quote and a doc are vectors to a verb of
vectors, an answer of the vector's label brought back as their own kind
[QSDSP#answer]. A set declares, beside its constructor, the page of its
payload and its refusal, the verbs whose answer on a set is not the
answer of the verb of vectors on it: `sort` and `reverse`, which answer
the vector of an order, `groupBy`, whose buckets are sets, `toVec`,
`toSet` with `distinct` beside it, and `union`, `minus` and `inter`,
which meet a value [QSCOL#algebra]; every other verb reaches a set
through the walk as the verb of vectors, with its page, its laws and its
refusals, and `::vec | manifest` lists the verbs a set answers beside its
own. The comparisons reside on each kind whose values they compare, an
input of another kind refused.

```qlang
> :Pos |~~ Pos. ~~| | :Pos/f ~(1) | -1 | f !| type
::Pos/f/SubjectNotPosError

> 42 | keys !| type
::map/keys/SubjectNotMapError

> #[1 2] | vec/count
2

> #[3 1 2] | get [~(binding :count | get /name) ~(filter ~(gt 1)) ~(take 2) ~(map ~(mul 2))]
[:vec/count #[2 3] #[1 2] [2 4 6]]

> ::set | manifest
#[::set/PayloadKindNotTakenError ::set/construct ::set/distinct ::set/groupBy ::set/inter ::set/minus ::set/payload ::set/reverse ::set/sort ::set/toSet ::set/toVec ::set/union]

> get [~(#[1 "a"] | sum !| type) ~(true | flat !| type) ~(::set | count !| type) ~(::set | manifest | has ::set/count)]
[::vec/sum/ElementNotNumberError ::vec/flat/SubjectNotVecError ::call/KindAnswersNoVerbError false]

> ~(a | b | c) | take 2
~(a | b)

> "b" | gt "a"
true

> 1 | gt "x" !| type
::number/gt/value/KindNotTakenError
```

## refusal

A name whose verbs reside on several kinds, none of which the walk of
the subject reaches, is refused by the call as
`::call/KindAnswersNoVerbError`, with the name as `:name`, the subject's
outermost tag as `:actualType`, the addresses of the verbs of that name
as `:addresses`, where the pages of those verbs lead to one, `:nearest`,
the verbs they link that the subject answers and whose answer is a kind
those verbs answer, and, where the subject is a path, `:repair`, the
step the call was likely meant as [QSPTH#verbs]. A name one verb holds
refuses such a subject by that verb [QSDSP#residence], and the verbs of
a name are those the scope of the step holds, so a verb the reader
declares under a second noun makes the refusal of a name one verb of the
root holds the call's, its address beside the root's.

```qlang
> 5 | count !| get [~(type) /actualType /addresses]
[::call/KindAnswersNoVerbError ::number #[::map/count ::string/count ::vec/count]]

> :Box |~~ A box. ~~| | :Box/keys ~(1) | 42 | keys !| get [~(type) /addresses]
[::call/KindAnswersNoVerbError #[::Box/keys ::map/keys]]

> [1 2] | toString !| get /nearest
[:json :print]

> /tags | count !| get /repair
~(get /tags | count)
```

## answer

A verb written in steps runs on the subject with its tags, and what it
answers keeps the tags its steps keep; a primitive runs on the value the
walk served. `returns` names the kinds a verb answers, each answer
brought to them by the one rule of [QSBLD#answer]: an answer of the
verb's own label goes back under the tags the walk passed, each laid
again through its kind, so an edit that breaks an invariant of a tag is
refused under it and a set under a tag keeps it, `::Box#[2 1] | distinct`
answering `::Box#[1 2]`; and an answer of another kind leaves the tags
the walk passed behind, so `distinct`, whose answer names `::set`,
answers a set under no tag over a vector under one,
`::Box[2 1 2] | distinct` answering `#[1 2]`, and the distinct elements
beneath the tag of a vector, a quote or a doc stay under it by
`within ~(distinct)`. An answer the rule brings to none of the kinds is
refused as `…/answer/KindNotTakenError`. A verb whose answer names
`::any`, or that names none, hands on what it computed, `map` among
them, and no chain of the catalog names a kind its verb does not answer
under the rule, which the laws of each verb hold [QSSLF#laws].

```qlang
> ::T{:a 1 :b 2} | filter ~(eq 1) | type
::T

> ::Box[1 2] | map ~(add 1)
[2 3]

> :vec/n (::fn | returns |~~ The answer. ~~| ::string | impl ~(count)) | [1] | n !| type
::vec/n/answer/KindNotTakenError

> get [~([2 1 2] | distinct | type) ~(::vec/distinct/answer | binding | get /value) ~(::vec/map/answer | binding | get /value) ~(::map/map/answer | binding | get /value)]
[::set ::set ::any ::any]

> get [~(::Box[2 1 2] | distinct) ~(::Box#[2 1] | distinct) ~(::Box[2 1 2] | within ~(distinct)) ~(~(a | a) | distinct)]
[#[1 2] ::Box#[1 2] ::Box#[1 2] #[::call{:name :a}]]
```

## tagname

A tag name in the subject position walks the kind of tag names, then the
noun the tag names, then `::any`, so a bare name after it finds the
tag's own verbs first, then the noun's, each step resolving by its own
subject; a fan-out over the noun is a template of `get` whose quotes run
against the tag name. A verb of the noun itself, whose function names
`::tag` by `on`, serves the noun's values and the noun's own tag name,
and refuses every other tag name, one under the noun among them; a verb
of the noun's values refuses a tag name under the verb; and a function
`apply` runs, which has no label, serves any tag name where its `on`
names `::tag`. The commands of a chain, `on`, `takes`, `wraps`, `reads`
and the rest, are verbs of `::fn` and of `::kind`, so a tag of another
noun is refused by them as by every verb.

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
