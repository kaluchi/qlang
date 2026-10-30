# QSDSP · A verb found through its subject

How a name a step calls finds its verb: by the subject's kinds, from the
outside in, and what a verb takes as its subject and answers. The
requirements of each section are the cases of its file under
`core/test/conformance/QSDSP/`.

## walk

A name a step calls finds its verb by walking the subject's stack of
tags from the outside in, down to the kind of the core at the bottom,
and beneath every kind lies `::any`, where every walk ends and the verbs
of any value live: `tag` and `payload`, the two sides of a value,
`eq`, `apply`, `with`, `if`, `cond`, `coalesce`, `json`, `raise`, and the
axes. A tagged value reaches `::tagged` after its own tag and before its
payload, where `within` lives, so a tag over a value passes to the verbs
of its payload, and a vector or a
map that holds a tag of its own, a set, a quote and a doc among them,
reaches `::vec` or `::map` after `::tagged`. A word reads a value it takes
from its subject or from code as a kind the same way, beneath every tag
over it, `::desc` among them: an element, a key, a condition, a pair and a
part a path meets on its way, two values that file under one keyword
meeting as they are, and a quote or a path beneath tags, which an input
that runs code runs. The verbs of `::any` meet the subject whole: `eq`
and the comparisons relate two values as they are, so a value under a tag
and a value of its payload's kind are a pair of two kinds to a comparison,
and so are two values under one tag whose payloads are of two kinds,
`::desc` aside [QSCND#compare], while a verb of the payload's kind answers under the tag,
and two values a step combines meet beneath the tags they share, a bare
one sharing any, two under different tags combining in no step
[QSDSP#answer]. A name means one act
wherever it resolves, each kind that answers it implementing that act,
and a verb on a label the walk reaches first stands over one of the same
name it reaches later, a verb of `::tagged` over one of the payload's
kind. `is` answers whether the walk of a value's tags reaches a value of
one of the kinds it is given, or one of them closes the value, each kind
read in the scope of its step, the slot of
a verdict a value of `::fn/slot` [QSERR#site], one kind at least, a call
of none refused as `::any/is/KindsEmptyError`, `::any` among them; a tag
name is a value of `::tag`, so `::vec | is ::vec` is false and
`::vec | is ::tag` true, and a tag the walk of a value reaches beneath its
outermost, laid over it, changes nothing, the outermost laid again through
its kind [QSLIT#tag]. A kind that wires the parts of its payload closes its tag
[QSBLD#value]: the walk stops at it, the names its kind wires, its words
and those of `::tagged` and `::any` serving its value and no word of a
kind beneath it, so a closed value of a vector answers no `count` but the
part its kind names so.

```qlang
> ::Box#1 | payload
1

> ::Box#5 | add 3
::Box#8

> ::Box#5 | gt 3
|~| raised, and no !| caught it
::call/KindsMismatchedError!{
  :leftTag ::Box
  :rightTag ::number
…

> :number/tag ~("mine"); 5 | tag
"mine"

> :tagged/count ~(99); #[1 2] | count
99

> get [(5 | is ::number) (::vec | is ::vec) (::vec | is ::tag) (#[1] | is ::vec)]
[true false true true]

> get [(5 | is !| tag) (!{} | get [(is ::map) (tag ::map)])]
[::any/is/KindsEmptyError [true !{}]]

> get [([::A::T{:a 1} {:b 2}] | union) ([::T"a" "b"] | join ",") ([1 2] | filter (gt 1 | tag ::Ok)) ([::W#1 ::W#1] | groupBy)]
[::A::T{:a 1 :b 2} ::T"a,b" [2] {:"1" [::W#1 ::W#1]}]

> :Card |~~ A card. ~~| (::kind | accepts |~~ The parts. ~~| ::vec | wires :took |~~ The seconds. ~~| /1 ::number); ::Card["a" 312] | get [took (count !| tag) (vec/count !| tag) tag]
[312 ::call/KindAnswersNoVerbError ::vec/count/SubjectNotVecError ::Card]
```

## residence

A verb resides on the label its address names, whoever declared it, a
reader extending a noun of the root among them, and so does a name the
kind of a label wires, its call answering that part of the subject,
`card | took`, by its address `card | Card/took`, and taking no modifiers
[QSBLD#value], whether a node lies at its address or the wiring alone names
it, the facts of a refusal among them, `!| found` [QSERR#rest]; a name several kinds answer is declared on each, `::vec/count`, `::map/count`,
`::string/count`, one primitive serving several where they share it. A
bare name reaches the verbs the walk of its subject's tags brings to their
labels alone; a verb called by its address serves those values and,
beside them, a value of the kinds its `on` names, `::any` among them, of
tag names the noun's own alone [QSDSP#tagname], so a verb whose `on`
names kinds beside its label is called by its address, `5 | Shop/double`,
`[1 2] | stdio/out json`. A subject no verb of a name serves is refused,
where one verb holds the name and its `on` names no kind, by that verb
under its own address, with its page and its repair, `42 | keys` as
`::map/keys/SubjectNotMapError`, and otherwise by the call
[QSDSP#refusal]. A refinement a verb checks of its subject is an
invariant under its subject, `holds :SubjectNotIntegerError`, and one
that names a concept a kind of its own, written where the value is made,
`x | tag ::Pos | f`, its kind answering there. A
verb is called by its name or by its address, which checks the subject
by that residence. A set, a quote and a doc are vectors to a verb of
vectors, an answer of the vector's label brought back as their own kind
[QSDSP#answer]. A set declares, beside its constructor, the page of its
payload and its refusal, the verbs whose answer on a set is not the
answer of the verb of vectors on it: `sort` and `reverse`, which answer
the vector of an order, `zip`, the vector of its columns, `groupBy`, whose
buckets are sets, `toVec`, `toSet` with `distinct` beside it, and
`union`, `minus` and `inter`, which meet a value [QSCOL#algebra]; every
other verb reaches a set through the walk as the verb of vectors, with
its page, its laws and its refusals, and `::vec | manifest` lists the
verbs a set answers beside its own. Two nouns hold `zip`, so a subject
neither serves is refused by the call with their addresses. The
comparisons reside on `::any`, two values of one kind compared and a pair
of two kinds refused [QSCND#compare].

```qlang
> :Pos |~~ Pos. ~~|; :Pos/f ~(1); -1 | f !| tag
::Pos/f/SubjectNotPosError

> :Shop |~~ A shop. ~~|; :Shop/double (::fn | on |~~ A number. ~~| ::number | impl ~(mul 2)); get [(5 | Shop/double) (5 | double !| get [tag addresses])]
[10 [::call/KindAnswersNoVerbError #[::Shop/double]]]

> 42 | keys !| tag
::map/keys/SubjectNotMapError

> #[1 2] | vec/count
2

> #[3 1 2] | get [(binding :count | name) (filter (gt 1)) (take 2) (map (mul 2))]
[:vec/count #[2 3] #[1 2] [2 4 6]]

> ::set | manifest
#[::set/PayloadKindNotTakenError ::set/distinct ::set/groupBy ::set/inter ::set/minus ::set/payload ::set/reverse ::set/sort ::set/toSet ::set/toVec ::set/union ::set/zip]

> 42 | zip !| get [tag addresses]
[::call/KindAnswersNoVerbError #[::set/zip ::vec/zip]]

> get [(#[1 "a"] | sum !| tag) (true | flat !| tag) (::set | count !| tag) (::set | manifest | has ::set/count)]
[::vec/sum/ElementKindNotTakenError ::vec/flat/SubjectNotVecError ::call/KindAnswersNoVerbError false]

> ~(a | b | c) | take 2
~(a | b)

> "b" | gt "a"
true

> 1 | gt "x" !| tag
::call/KindsMismatchedError
```

## refusal

A name whose verbs reside on several kinds, none of which the walk of
the subject reaches, is refused by the call as
`::call/KindAnswersNoVerbError`, with the subject as `:found`, the name
as `:name`, the addresses of the verbs of that name
as `:addresses`, where the pages of those verbs lead to one, `:nearest`,
the verbs they link that the subject answers and whose answer is a kind
those verbs answer, and, where the subject is a path, `:repair`, the
step the call was likely meant as [QSPTH#verbs]. A name one verb holds
whose `on` names no kind refuses such a subject by that verb, and one
whose verb's `on` names kinds is refused by the call [QSDSP#residence];
the verbs of
a name are those the scope of the step holds, so a verb the reader
declares under a second noun makes the refusal of a name one verb of the
root holds the call's, its address beside the root's.

```qlang
> 5 | count !| get [tag found addresses]
[::call/KindAnswersNoVerbError 5 #[::map/count ::string/count ::vec/count]]

> :Box |~~ A box. ~~|; :Box/keys ~(1); 42 | keys !| get [tag addresses]
[::call/KindAnswersNoVerbError #[::Box/keys ::map/keys]]

> [1 2] | toString !| nearest
[:json :print]

> /tags | count !| repair
~(get /tags | count)
```

## answer

A verb written in steps runs on its subject and its inputs as the call
gives them, their tags with them, and what it answers keeps the tags its
steps keep; a primitive runs on the values the walk served. A primitive
that combines its subject with the value its input takes, `add`, `sub`,
`mul`, `div` and `mod`, `and` and `or`, the `append` and the `prepend` of
a string, `concat`, the `union` of a set or a map and the `minus` and the
`inter` of a set, works
beneath the tags the two share, a bare one sharing any and a value of
another kind its input takes sharing none, and two under different tags
are refused as the pair, `::call/KindsMismatchedError`, its facts their
kinds where their tags part; `append` and `prepend` of a vector put the
element whole under the tags of the subject [QSCOL#sequence]; an input
of any other step steers it and
shares no tag, the digits of `round` and the keys a map's `minus` takes
off among them. `returns` names the kinds a verb answers, each answer
brought to them by the one rule of [QSBLD#answer]: an answer of the
verb's own label goes under the tags its operands share, the tags the
walk passed where it combines nothing, each laid again through its kind,
its own giving way, so an edit that breaks an invariant of a tag is
refused under it and a set under a tag keeps it, `::Box#[2 1] | distinct`
answering `::Box#[1 2]`, and it stands as it is where no tag is laid;
and an answer of another kind leaves the tags the walk passed behind and
stands as it is, so `toSet`, whose answer names `::set`,
answers a set under no tag over a vector under one,
`::Box[2 1 2] | toSet` answering `#[1 2]`, and the set of the elements
beneath the tag of a vector stays under it by `within toSet`. An answer the rule brings to none of the kinds is
refused as `…/AnswerKindNotTakenError`. A verb whose answer names
`::any`, or that names none, hands on what it computed, `map` among
them, and no chain of the catalog names a kind its verb does not answer
under the rule, which the laws of each verb hold [QSSLF#laws].

```qlang
> ::T{:a 1 :b 2} | filter (eq 1) | tag
::T

> ::Box[1 2] | map (add 1)
[2 3]

> :vec/n (::fn | returns |~~ The answer. ~~| ::string | impl ~(count)); [1] | n !| tag
::vec/n/AnswerKindNotTakenError

> get [([2 1 2] | toSet | tag) (::vec/toSet/answer | binding | value) (::vec/map/answer | binding | value) (::map/map/answer | binding | value)]
[::set ::set ::any ::any]

> get [(::Box[2 1 2] | toSet) (::Box#[2 1] | distinct) (::Box[2 1 2] | within toSet) (~(a | a) | toSet)]
[#[1 2] ::Box#[1 2] ::Box#[1 2] #[::call{:name :a}]]

> get [(::Ok#true | and false) (::Ok#true | and ::No#true !| tag) (::A[1] | append ::B[2])]
[::Ok#false ::call/KindsMismatchedError ::A[1 ::B[2]]]

> get [(100 | add ::Cents#1) (::Cents#100 | add ::Dollars#1 !| get [tag leftTag rightTag]) (1.234 | round ::D#2)]
[::Cents#101 [::call/KindsMismatchedError ::Cents ::Dollars] 1.23]
```

## tagname

A tag name in the subject position walks the kind of tag names, then the
noun the tag names, then `::any`, so a bare name after it finds the
tag's own verbs first, then the noun's, each step resolving by its own
subject; a fan-out over the noun is a template of `get` whose quotes run
against the tag name. A verb of the noun itself, whose function names
`::tag` by `on`, serves the noun's values and the noun's own tag name; a
bare name after another tag name reaches it not, and called by its address
it refuses every other tag name, one under the noun among them. A verb
or a field of the noun's values passes a tag name to the verb of its name
on `::any` where one lives, `::Box | label` reading `:any/label` where
`:Box/label` reads the values of `::Box`, and refuses it under the verb
where none does; and a function `apply` runs, which has no label, serves
any tag name where its `on` names `::tag`. The commands of a chain, `on`,
`takes`, `accepts`, `wires` and the rest, are verbs of `::fn` and of
`::kind` themselves, so a tag of another noun reaches none of them by
the bare name, `::call/KindAnswersNoVerbError`, and is refused by the
command called by its address as by every verb.

```qlang
> get [(::number | toString) (::number | number/toString !| tag)]
["number" ::number/toString/SubjectNotNumberError]

> ::vec | count !| tag
::vec/count/SubjectNotVecError

> :Shop |~~ A shop. ~~|; :Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5")); get [(::Shop | hours) (::Other | hours !| tag) (::Other | Shop/hours !| tag)]
["9 to 5" ::call/KindAnswersNoVerbError ::Shop/hours/SubjectNotShopError]

> get [(::number | takes :by |~~ b ~~| /0 !| tag) (::number | fn/takes :by |~~ b ~~| /0 !| tag)]
[::call/KindAnswersNoVerbError ::fn/takes/SubjectNotFnError]

> :any/label ~("any"); :Box |~~ A box. ~~|; :Box/label ~("box"); get [(::Box | label) (::Box[1] | label)]
["any" "box"]
```
