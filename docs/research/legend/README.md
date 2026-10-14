# The legend of a value, and the language it asks for

A research note of the model, session 22b934f8, 2026-10-09. The
maintainer turned the work from specifications of kinds to what a
reader meets: a pipeline begins with a noun and computes a noun, `S | V
O`, so `S | doc` is where every explanation starts, and the legend of
the payload under a label is what that answer owes [D161], [D162]. The
note holds the concepts that never landed and why, the model the legend
asks for, a prototype of it that runs, and what clean models did with
it. Everything here is the model's reading; nothing is decided.

The maintainer's words that set the frame, from this session:
«мы теперь `S | V O` - subject на первом месте, ему всегда можно сделать
`S | doc` и получить релевантную подсказку.. включая доступные для
контекста команды», «все эти "глаголы" и спеки к ним это тоже возможно
форма старого мира.. и потому стоит делать упор на S и правильную
легенду для него», and, of the heads, «если головы были объявлены ещё в
хрен пойми каком десижене - и до сих пор так мы их не победили и не
смогли ни замлементить ни разкрыть вопросы .. значит с ними и проблема».

## What never landed

`node scripts/requirements.mjs` lists, as being decided still, the
records of the payload's description from the third week of September:
D6, a tag's declaration as its schema, D33, the contracts a kind owns,
and D50, a field's meaning given by the schema of its tag. Counting the
`Replaced in part by` lines of every record shows which concepts were
rewritten again and again; the counts below are the rewrites of a
record, then the records its rewrites reached in turn:

| record | rewritten | reached | what it decided |
|---|---|---|---|
| D45 | four | eleven | the slot list carries the kinds |
| D4 | three | seventeen | a parameter binds a value |
| D44 | three | twelve | a verb declares its slots |
| D12 | two | fifteen | modifiers evaluate as elements |
| D47 | two | twelve | a modifier is stored as its step |
| D6 | two | twelve | a tag's declaration is its schema |
| D57 | two | ten | a verb is written `~[slots](body)` |
| D67 | two | eight | leading declarations are a verb's signature |
| D68 | two | five | a slot takes the value of its kind |

D56 names the gap in its title, a slot of code takes a quote «before the
argument model», and the argument model never came. The cluster is one
concept, the head of a verb, and the payload's description was bound to
it: D6 spelled a record's schema as a map of fields, D45 and D67
replaced that by the head, `::spec~(:w ::number)`, and from then on the
schema shared the head's fate. In the tree it is still decoration:

```qlang
> :Box ::spec~(:w |~~ the width ~~| ::number) | ::Box{:w "x"}
::Box{:w "x"}

> :Box ::spec~(:w |~~ the width ~~| ::number) | ::Box | doc :w
::any/DocBindingNotFoundError!{…}
```

The reading of why: the head does four jobs in one construct, a second
language inside a quote that is otherwise a pipeline. It names the
objects for the body, checks their kinds, describes them to a reader,
and carries roles, defaults, the rest and the arity for the runtime.
Each record moved one job and broke another. And the axes were built on
the same verb-first ground: they read declarations, so a value reads the
page of its kind, `5 | doc` the page of `::number` [D61], and no answer
ever explained the value in hand.

## The model

Everything below is one mechanism, the label and what is declared under
it, used for the subject and for the object alike.

A label is declared by its page. The page says what the data under the
label is, and a law on it under `::holds` is an invariant every value
under the label keeps:

```qlang
:Box
  |~~ A parcel as the courier measures it. ::holds~(length | gt 0) ~~|
```

An aspect is a quote declared under a label. Named on a value of the
label, it runs on that value: a part, `~(/0)`, a value derived from
parts, `~(mul length (mul width height))`, a nested collection under a
label of its own, `~(/stages * tag ::Stage)`. The name is the handle a
reader calls and the legend shows; the order or the key lives inside
the quote, so a vector stays the compact payload and gains names
without named projections:

```qlang
:Box/length |~~ The length, in centimetres. ~~| ~(/0)
:Box/weight |~~ The weight of what is inside, in kilograms. ~~| ~(/3)
:Box/volume |~~ The space inside, in cubic centimetres. ~~| ~(mul length (mul width height))
```

An action is an aspect whose call carries an object, the O of `S | V
O`. The head moves out of the quote into the action's own namespace:
each part of the object is declared under the action's address in the
form a part of the payload takes, a name, its page and the selector
that reads it, and a `::holds` on that page checks it. A call `put 10`
makes the modifiers a value, `::Box/put[10]`, each computed against
the subject as a modifier always is; each declared part is read from it,
checked, and bound in the body by its name, so the body is a pipeline
that says `weight`. What the head did, slots, their kinds, defaults,
the rest, is the legend the subject has: a default is a part read
softly, `~(at 0 | coalesce 0)`, a check is a law, a rest is a part that
reads the tail, `~(drop 1)`, and the whole object stays reachable as
`object`.

```qlang
:Box/put
  |~~ The same box with another weight inside. ::call~(put 10) ~~|
  ~(within ~(take 3 | append weight))
:Box/put/weight
  |~~ The weight to put inside, in kilograms. ::holds~(type | eq ::number) ~~|
  ~(/0)
```

The object is the literal of a call, the address of the action and the
vector its arguments land in, which the maintainer read at once:
«`::Box/put[10]` это прям как своеобразная литеральная форма вызова, имя
метода + массив куда аргументы скидываются - и тем же способом мы можем
давать им внятные имена и доку». A step of a quote holds the same call
unrun, `~(put 10) | payload` the record `::call{:name :put :args
[10]}`, an argument that computes held as its code, `~(put (weight |
add 1))` the group of its steps; the object holds every argument
computed against the subject, the intent applied. So a trail can carry what came in, not
only the step, and an effect has its literal: `::Pipe/@retry[:integration]`
is the write D2 asks a tag to describe and an explicit step at the host
boundary to perform, the form the open question of effects as emitted
values lacks, a value a reader builds, reads by its legend and hands on
before anything acts.

The address `::Box/put` is the verb under the noun of the subject's
kind, and the vector is the object; the subject itself stays the value
the step runs on. An object of one map takes named keys, the options
D40 asked to be one map: each key is a part declared by its selector,
a default a soft read, and a misspelled key is refused at the selector
that reads it, with the object in the trail:

```qlang
:Box/pack/weight
  |~~ The weight to put inside, in kilograms. ::holds~(type | eq ::number) ~~|
  ~(/0/weight)
:Box/pack/note |~~ A note for the courier, none when left out. ~~| ~(/0 | at :note | coalesce "")

> ::Box[1 2 3 4] | pack {:weight 9}
::Box[1 2 3 9]
```

A refusal is then named by the address of what refused, with no
constant written for it: `put "x"` answers
`::Box/put/weight/HoldsNotMetError`, and `::Box/put/weight | doc` is the
page of the part. Inside the body `weight` is the part of the object;
outside it, in a modifier, `put (weight | add 1)`, it is the aspect of
the box, since the modifier is computed against the subject.

Nested structure follows D50 without a schema: the data stays rows, and
an aspect lays a label over each when it is read, so the meaning of a
row lives once, in the catalog, and a reader reaches it through the
aspect, `run | stages | /1 | doc`.

`S | doc` on a value answers its legend, a doc: the label's first
sentence; the figure, the value printed with a callout at each part a
path aspect reads, a collection under a label shown by its first rows
and the names of its parts; the invariants; the key, each derived
aspect with its answer on this value and each action with its call and
answer, or the note that it acts on the world; and the way deeper, the
links to the labels of nested parts and `doc :name` for any aspect. On
a name, `doc` answers its page as before.

The figure carries comments, which are trivia, and the question was how
a value can hold them. It does not: the figure is prose of the legend,
held between backquotes, and the legend is a doc, a value that prints
and reads back as itself, while the figure inside it reads back as the
value it explains. The prototype answers both:

```qlang
> run | :s / | doc | :d / | print | parse | :q / | null | apply q | eq d
true

> run | :s / | doc | content | split "`" | /1 | parse | :q / | null | apply q | eq s
true
```

What leaves the language under this model: the head, `::verb` over an
aspect, `::spec` for the kinds of readers and hosts, `:returns`, the
slot kinds, defaults and rest as syntax, and the axes' rule that a value
reads its kind's page. A primitive a host hands takes the subject and
the values of the object, as it takes them today.

## The prototype

A detached worktree of commit `e283af3` holds it; `prototype.patch`
beside this note is its diff to the core, and `prototype/` its new
files: `legend.mjs`, the runtime of `doc` on a value; `ci.qlang`, a
host's labels written in the model; `q.mjs`, the command line over them;
`children.mjs`, the run of clean children, and `children-sonnet.txt` and `children-haiku.txt` what they answered. To run it again, add a worktree of `e283af3`, apply the patch, copy `legend.mjs` to `core/src/runtime/` and the rest to `proto/`, and copy `core/gen/` from a built checkout. The change to the core is
four rules: a member of a label that is a quote resides on the label and
runs on the value it is named on, in the scope of its declaration over
the root as it stands, with the call's modifiers as its object; a node
that holds a page is a label, and lays its tag over a payload that keeps
every `::holds` of the page; a verb declared under such a label resides
on it; `doc` on a value answers `legendOf`.

What it answers, on the run of a CI pipeline the host bound as `run`:

```text
|~~::Pipe — one run of the CI pipeline.

`::Pipe{
  :id 8812              |~ id — the number of the run. ~|
  :st :red              |~ verdict — the verdict: :green, every stage passed at its first attempt; :amber, every stage passed, some after a retry; :red, some stage failed. ~|
  :stages [             |~ stages — the stages in the order they ran. Each a ::Stage [name outcome seconds]. ~|
    [:checkout :ok 3.1]
    [:build :ok 41.2]
    [:unit :flaky 88.5]
    |~ and 4 more like them ~|
  ]
  :owners #[:ann :bob]  |~ owners — who is paged when the verdict is :red. ~|
  :fails [              |~ fails — the tests that failed at least once. Each a ::Fail [name attempts]. ~|
    ["parse/empty" 2]
    ["eval/deep" 3]
    ["db/pool" 4]
    |~ and 1 more like them ~|
  ]
}`

What it answers next, each run on this value:
::snippet~(ok) is `false` — whether the run counts as passed, true for :green and :amber.
::snippet~(slowest) is `:integration` — the name of the stage that took longest.
::snippet~(@retry :test) acts on the world, so it is not run here — runs one stage again and answers the new ::Pipe.

Deeper: the page of any name above by `doc :name`, ::link~(::Stage | doc), ::link~(::Fail | doc), and the verbs of its shape, ::snippet~(::map | manifest).
~~|
```

The same `doc` explains a positional payload, the box, each position
with its callout and each action with its call and answer,
`::snippet~(put 10) is ::Box[1 2 3 10] — the same box with another
weight inside. Its object: weight — the weight to put inside, in
kilograms.` It explains an error a step answered, `"x" | add 1 !| doc`,
the page of the refusal's site above the error with a callout at
`:actualType`, the facts a reader could not learn before. And it
explains the object of a refused call, which is a value too:

```text
> ::Box[1 2 3 4] | put "x" !| /actualValue | doc
|~~::Box/put — the same box with another weight inside.

`::Box/put[
  "x"  |~ weight — the weight to put inside, in kilograms. ~|
]`

Every value under the label holds `weight | type | eq ::number`.
~~|
```

## What clean models did

The blind runs earlier in this session gave a clean child, with no tool,
a printed value and one form of a legend. Today's page alone failed:
Haiku read a run under `:amber` as failed and `ok` as `false`, and
Sonnet hedged every answer. A head shown to a reader taught the wrong
call, `@rerun :failed` for `:only ::keyword`. Every form that named the
parts and showed each continuation as a call answered every question
right in both models, and the figure with callouts was the cheapest of
them. `run-box.mjs`, `run-run.mjs`, `run-composite.mjs` and
`run-author.mjs` beside this note reproduce them.

Against the prototype's command line, `children.mjs` gave clean children
the tool answer bound as `run`, the command `qlang` on their path, the
sentence that `x | doc` explains any value, and seven questions, two
runs a model with the legend and two with `doc` answering the label's
page as the tree does. Sonnet with the legend read `run | doc` in both
runs and answered every question in three calls; it ran the retry it
was told only to write, both times. Without the legend one run said
of the rerun «I found no verb in the docs I read that reruns a stage»
and guessed the attempts «which the output doesn't label», and the
other got everything right in seven calls and more than twice the
tokens, reading `::Pipe | manifest` and the page of each member.

Haiku never asked for `run | doc` in either arm. It read the first page,
printed the value and worked by positions, from thirteen to twenty-three
calls a run; it found `@retry` once, in the legend arm, through
`::Pipe | manifest`, and never in the other. The legend works when it is
read, and a weaker reader does not ask for it: it has to arrive with
the value, the first time a label is met in a session, which is what
the maintainer said of it, «легенда она прежде всего от printValue».
The first page the children read still says that `doc` answers the
page of a kind.

## Open questions

- How the legend arrives. A reader that does not ask for it never sees
  it, so the host prints it the first time a label is met in a session,
  or the print of a labelled value carries the step that reads it; the
  audit's enrichment once per session is the first, and the theorem of
  the print holds for both, since the legend is computed from the value
  and the catalog.
- `doc` or an axis of its own. The maintainer named `S | doc`; the
  prototype answers the legend there for a value and the page for a
  name, so `5 | doc` stops reading the page of `::number`.
- The scope an aspect runs in. The prototype takes the root as it stands
  at the call, so the aspects of one label see each other whatever their
  order, which the first draft of the host source tripped over; a name
  the reader declared does not reach into them.
- The call with the subject written first, `mul /price /qty`, which the
  runtime told by one modifier more than the slots; without slots it
  needs another sign, or leaves.
- A refusal of a `::holds` is named `HoldsNotMetError` under the label's
  address; it could carry the name of the law it broke.
- The catalog of the core is written in heads; under the model it is a
  set of labels with aspects and actions, and its primitives take the
  subject and the object's values.
- A modifier is computed against the subject of its own step, so
  `length | mul (width | mul height)` reads the width of a number; the
  prototype's host source tripped over it too, and wrote `mul length
  (mul width height)`.

## The catalog under the model

The verbs of the catalog, written today with a head, as the model would
write them. `add` today, its head and three refusals of its own:

```qlang
:number/add |~~ Adds two numbers: … ~~| ::verb~(:addend ::number | :returns ::number | ::builtin{})
:number/AddLeftNotNumberError |~~ … ~~| ::spec~()
:number/AddRightNotNumberError |~~ … ~~| ::spec~()
:number/AddResultNotFiniteError |~~ … ~~| ::spec~()
```

Under the model: the action and its part, the part's page where the
refusal of the right operand was, and the primitive's own refusal under
the action's address. The form that reads two fields of one value,
`{:x 10 :y 3} | add /x /y`, which the runtime made of a call with one
modifier more than the slots, is a form of its own on any value, listed
where a reader finds it:

```qlang
:number/add |~~ Adds a number to this one: `10 | add 3` is 13. ::call~(add 3) ~~| ::builtin{}
:number/add/addend |~~ The number added. ::holds~(type | eq ::number) ~~| ~(/0)
:number/add/ResultNotFiniteError |~~ … ~~|
:any/add |~~ Adds two numbers the call computes against this value. ::call~(add /x /y) ~~| ~(left | add right)
:any/add/left |~~ The first number. ::holds~(type | eq ::number) ~~| ~(/0)
:any/add/right |~~ The second number. ::holds~(type | eq ::number) ~~| ~(/1)
```

The rest of the heads map the same way. A default is a part read
softly, `round`'s `:number/round/digits ~(at 0 | coalesce 0)`; a rest is
a part that reads the whole object or its tail, `coalesce`'s
`:any/coalesce/alternatives ~(/)` with `::holds~(count | gt 0)` where
`CoalesceNoAlternativesError` was; `reduce` has two parts, `seed ~(/0)`
and `reducer ~(/1)`, and `if` three, `condition`, `then` and `else`,
each with its law. A word several kinds answer, `filter` on vectors,
maps and sets, declares its parts once, under its contract,
`:any/filter/predicate ~(/0)` with `::holds~(type | eq ::quote)`, and
each residence is its primitive alone; the refusal a primitive raises
while it runs, a predicate answering no boolean, sits under the part.
The arity is the positions the parts read, so a call that gives more is
refused under the action's address rather than read another way, and a
slot's kind that minted its modifier, `80` becoming `::Width(80)`, is a
selector that lays the label, `~(/0 | tag ::Width)`. `:subject` is the
residence already [D156]; `:returns` with a kind leaves, the page saying
what the action answers; `:returns /`, that the answer goes back under
the subject's labels, is the one role that stays, a mark on the
action's page.

The prototype runs the forms on a label of its own, `::Num`:

```qlang
> ::Num(10) | plus 3
13
> ::Num(10) | plus "x" !| type
::Num/plus/addend/HoldsNotMetError
> ::Num(1) | plus 1 2 !| [type /parts /actualValue]
[::Num/plus/ObjectBeyondPartsError 1 ::Num/plus[1 2]]
> {:x 10 :y 3} | plus /x /y
13
> ::Num(2.567) | [rounded (rounded 1)]
[3 2.6]
> {} | sumOf !| [type /actualValue]
[::any/sumOf/numbers/HoldsNotMetError ::any/sumOf[]]
```

The tree today answers `1 | add 1 2` with `3`, reading the first
modifier as the subject and dropping the value in the pipe.

## A quote that captures what its print does not show

D44 split a declaration's body, computed once where it stands, from a
verb, computed at each mention against the subject there, and left a
quote a value that only `apply` runs; the maintainer's words then were
«методы вызываются по одной логике, квоты по apply .. все различимо и
юзкейсы не перемешиваются». The second axis, where a quote's names
resolve, rides a slot the print does not show. A quote written as a
declaration's body or as a modifier carries the environment it was
written in (`quoteInEnv` in `core/src/types.mjs`), a verb carries its
own, and a quote read by `parse` or built from steps carries none and
resolves where it is applied:

```qlang
> :a 1 | :q1 ~(a) | :q2 ("a" | parse) | (:a 2 | [(apply q1) (apply q2) (q1 | eq q2) (q1 | print) (q2 | print)])
[1 2 true "~(a)" "~(a)"]

> :limit 10 | :f ~(gt limit) | f | print
~(gt limit)
```

Two quotes equal and printed alike answer apart, against the first
page's «Every value prints as a literal that reads back as itself: what
an answer shows is the value». The snapshot D5 removed with `as` lives
on in the slot. Under the model an aspect needs no captured scope: what
it names is an aspect of its subject, found by the walk, or a name of
the tree, an address anyone reads. A quote of the reader can capture
values instead of a scope: the names it reads that the reader's scope
binds to values are put in at the moment it is written, so `filter ~(gt
limit)` holds `~(gt 10)`, prints it, reads back as it and equals what it
does, while the names of the tree stay names. The price is the print of
a large value a quote captured, which a budget bounds as it bounds any.

What the capture would touch is narrow: a free name of the quote that
the reader's scope binds to a value. `~(/)` names nothing, `/` being the
subject itself; a name the quote declares, `~(:n / | n)`, is its own; a
word of the vocabulary or a name of the tree stays a name. The
prototype does not carry the capture yet.

## A name of the reader that takes a word of the subject's

A reader's bare name is found before the verbs the walk of the subject
reaches [D153], so a value named after a verb stands where the verb was
meant, refused or answered silently:

```qlang
> :filter 5 | [1 2 3] | filter ~(gt 1)
::call/ValueTakesNoModifiersError!{…}

> :sort ~(reverse) | [3 1 2] | sort
~(reverse)

> :first 9 | {:a [1 2]} | /a | first
9
```

Under the model a label controls its names, and the reader's bare names
are values, since a verb of the reader is an aspect declared under the
noun it serves, `:vec/second ~(/1)`. The prototype refuses a bare name
of the reader that takes a word of the vocabulary, the name of a verb
or of an aspect some label answers, where it is declared, with the
addresses of the word, `:filter 5` answering
`::bind/NameTakenByVocabularyError` with `#[::map/filter ::set/filter
::vec/filter]`; `:limit 2 | [5 6 7] | take limit` answers `[5 6]`.

## Two thoughts of the maintainer

A step on both tracks, `|!| legend` for `| explain !| explain`. The
language holds it as a composition of two steps already: `!|` passes a
value untouched and `!| /` hands an error on as its opened facts, so `!|
/ | doc` runs `doc` on whatever came. In the prototype `"x" | add 1 !| /
| doc` answers the legend of the error, and `[("x" | add 1) 5] * (!| / |
type)` answers `[::number/AddLeftNotNumberError ::number]`. A token of
its own would spell what two steps say, the case D51 removed `>>` for;
what the idiom lacks is a sentence of the first page that names it. And
the legend a reader needs most arrives with the print, which no
combinator writes.

A path language after the tag, `::tag/v/v/v` with axes and names, as
XPath has. The names it would give are what aspects give, each with its
page and its selector, and the axes are steps the pipeline has, `*` for
each element and `filter` for a predicate; a sub-language of paths would
be a second language inside the first, which is what the head was. The
reading of the model is to keep `/k` and `/0` as the one projection and
let a label name its parts.

## Readings this note held before, set aside

The first version of this note proposed a mirror, a value of the
payload's shape with a doc in each place, as a member of the label, and
then the head of a kind's `::spec` as the place of the captions. The
mirror spelled nested structure inline, against D50, and duplicated
what aspects say by name; the head is the concept the chronology above
shows stalled. Both readings are withdrawn.

[D2]: ../../decisions/replaced/D2.md
[D40]: ../../decisions/replaced/D40.md
[D50]: ../../decisions/replaced/D50.md
[D61]: ../../decisions/replaced/D61.md
[D153]: ../../decisions/replaced/D153.md
[D156]: ../../decisions/replaced/D156.md
[D161]: ../../decisions/replaced/D161.md
[D162]: ../../decisions/replaced/D162.md
