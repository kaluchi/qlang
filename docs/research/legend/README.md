# The legend of a value

A research note of the model, written on 2026-10-09 in session
22b934f8, after the maintainer turned the work from specifications of
kinds to what a reader sees: a pipeline begins with a noun and computes
a noun, `S | doc` is where every explanation starts, and the legend of
the payload under a label is what that answer owes [D161], [D162]. It
holds what the tree answers, what other systems did, what clean models
did with six forms of a legend, and the readings that follow. The
readings are the model's; nothing here is decided.

The runners beside this note reproduce every run:
`node docs/research/legend/run-box.mjs sonnet haiku`, `run-run.mjs`,
`run-author.mjs`; they start clean children through
`scripts/benchmark/child.mjs` and write their records under the
system's temporary directory. `box.qlang` is the kind the first run
describes, and it loads: `qlang "$(cat docs/research/legend/box.qlang)
| ::Box[1 2 3 4] | put 10"` answers `::Box[1 2 3 10]`.

## What the tree answers today

`42 | doc` answers the page of the kind, “The kind of a number, a
finite double”, a description of the type rather than of the value in
hand, and points at its verbs through a snippet, `::number | manifest`.
From the value itself there is no step to them: `42 | manifest`
refuses with `::tag/ManifestSubjectNotTagError`, and `manifest` lists
the members of one noun, never the verbs of `::any` that reach the
value as well.

A declared label without a page answers nothing at all:

```qlang
> :Box ::spec~() | ::Box[1 2 3 4] | doc
null
```

An undeclared one stops the reader at the label, though the payload
is a vector with a legend of its own: `::Foo[1 2] | doc` answers
`::any/DocBindingNotFoundError` with `:nearest []`. An error's page
tells how to repair the step, `"a" | mul 2 !| doc`, and nothing of
`:actualType` or `:trail`, the parts of the value the reader holds.

Everything a legend needs is computable by a query today. Over the
kind of `box.qlang`, whose page carries `::part~(/0) the length, in
centimetres` and so on:

```qlang
> :s ::Box[1 2 3 4] | ::Box | doc | segments | filter ~(type | eq ::part) * [/ (payload | :q / | s | apply q)]
[[::part~(/0) 1] [::part~(/1) 2] [::part~(/2) 3] [::part~(/3) 4]]

> :s ::Box[1 2 3 4] | ::Box | manifest | filter ~(spec | payload | count | eq 1) * [/ (binding | /value | :v / | s | v)]
[[::Box/density 0.6666666666666666] [::Box/empty ::Box[1 2 3 0]] [::Box/volume 6]]
```

A tag over a quote in a doc is a segment of that role and no law, so
the caption lines need no change of grammar:
`|~~ ::part~(/0) length ~~| | laws | count` answers `0`.

## What others did

A subagent opened the sources; the lessons are the model's.

- PowerShell's `Get-Member` lists the members of each type that
  arrives in the pipeline, with a definition per member, and
  `types.ps1xml` lets the author of a type name the few properties
  shown by default. The legend is found through the chain of type
  names, as ours is through the stack of tags; its weakness is that
  nothing in the printed object points to it.
- Nushell's `describe --detailed` answers the type of a value as a
  record, so the description of a value is a value the pipeline reads
  on. It does not list the commands a value accepts.
- Glamorous Toolkit's moldable inspector gives an object a tab for
  every method of its class marked `<gtView>`, and actions the same
  way. Its stated goal is views that cost a few lines, found at run
  time: a legend that is expensive to write is not written.
- Naked Objects derives the whole interface from the domain objects
  and the actions they declare, so the list of actions cannot drift
  from the code.
- Siren puts the actions a client may take next into the response,
  each with the fields it takes; HAL has a short relation name resolve
  to the documentation of its meaning.
- A style guide for technical illustration prefers numbered callouts
  with a key over labels on the drawing: the key stays small and
  stable, the explanation lives in the legend and grows there.
- Anthropic's guidance on tools for agents asks for a concise and a
  detailed form of a result, natural names over cryptic identifiers,
  and steering text where a result was cut; it says the best format
  must be measured, not assumed.
- JSON Schema separates annotations, a title, a description and
  examples that are never validated, from the assertions that are.

## Experiments

Every run gave a clean child, with no tool and no memory, the same
primer of the pipeline (projection by `/0`, `|`, `*`, `filter`, `gt`,
`eq`, a tag as a label over plain data), a printed value, one form of
its legend, and the same questions. Sonnet and Haiku each answered
every form once. The forms:

- F0, the value alone.
- F1, today's tree: the page of the label in prose and `manifest`.
- F2, the label's page with a caption per part, `::part~(/0) the
  length, in centimetres`, and each verb with its `spec` and the first
  sentence of its page.
- F3, a legend computed on the value: each caption with the value at
  its part, `::part~(/0) is 1, the length…`, and each verb as a call
  with its answer on this value, `::snippet~(volume) is 6, the space
  inside…`; a verb with an effect is shown as a call and not run.
- F4, the same as laws that hold on the value, `~(/0 | eq 1) the
  length…`, `~(put 10 | eq ::Box[1 2 3 10]) the same box with…`.
- F5, the same as a map, `{:parts [{:at ~(/0) :value 1 :means "…"}]
  :next [{:run ~(volume) :answers 6 :means "…"}]}`.
- F6, callouts: the projection, the value and the caption in columns,
  `/0  :amber  the verdict…`, nested parts as paths, `/4/0/0`, which
  the language reads, and the calls as `| ok  true, whether…`.

### A box, a domain the models already know

`::Box[1 2 3 4]` with `volume`, `density`, `empty` and `put`. Without a
legend Sonnet refused every question, saying nothing defined the
positions, while Haiku guessed length, width, height and weight from
its priors and was right. With today's page Sonnet could not answer
what `empty`, `put` or `density` do, and Haiku read the height at `/1`
and computed `11/6` for a density of `7/6`. Every form that named the
parts and showed the verbs, F2 to F5, answered all questions right in
both models; the domain is too familiar to tell them apart. Two
frictions were reported: under F2 Haiku asked how `:weight ::number` in
the `spec` relates to `put 7`, and under F3 it read the tags
`::part~` and `::snippet~` as notation that does not match the syntax
of a query.

### A test run, a domain with no priors

`::Run[:amber 214 0 12.4 [::Fail["parse/empty" 2] ::Fail["eval/deep"
3]]]`: a verdict whose three keywords carry meanings no name reveals,
counts, a time, nested failures under a label of their own, and three
verbs, `ok`, `flaky` and `@rerun :only :flaky`, the last one with an
effect. Under today's page Haiku answered that the run failed and that
`ok` answers `false`, both wrong, and read the 3 of a `::Fail` as the
failures; Sonnet hedged every answer with “probably” and could not
write the call of `@rerun`. Under F2 Sonnet wrote `@rerun :failed`,
missing the keyword `:only` that the head `:only ::keyword` names:
the head of a verb did not teach how to call it. F3, F4, F5 and F6
answered every question right in both models. What the children still
asked about was the meaning of the domain, whether `:only :failed`
means the tests that failed on every attempt, never the form.

The prompts with a legend cost from about three to six hundred tokens
over the bare value; F6 was the shortest of the computed forms, F5 the
longest.

### Writing a legend

A clean child was shown a kind declared in one of two styles and asked
to declare `::Run`, `::Fail`, and the verbs `ok` and `slow` with a law
each. Style A captions the parts on the label's page, `::part~(/0) …`;
style C declares a verb per part, `:Box/weight ::verb~(/3)`, the
maintainer's example of `:Box/length ~(/0)`. Each answer was loaded
into `qlang` and its laws run.

Sonnet wrote both styles correctly, every law holding. Under style C
the meanings of the verdict's keywords left the caption of the part for
the prose of the kind, and the verb `verdict` kept only “:green, :amber
or :red”: a legend split over names scatters what style A keeps in one
place. Haiku failed the body of `ok` in both styles on one cause,
reaching the outer subject from inside a nested pipeline:
`filter ~(eq /0)` reads `/0` of the element, and `any ~(eq :green | eq
:amber)` was handed a keyword. The model met the same trap writing
`box.qlang`: in `/0 | mul (/1)` the parenthesis forks from `2`, the
value of the step, not from the box, and a verb's body has no name for
its subject, `subject` being unknown there.

## Readings

These are the model's, to be weighed.

The legend is computed, and the author writes only what no command
computes. That is three things: the caption of each part, on the
label's page, `::part~(/0) the length, in centimetres`, the meanings of
an enumeration inside it; the first sentence of each verb's page; and
one call of each verb that takes modifiers, which a law of its page
already holds. Everything else is computed on the value in hand: the
stack of labels from the outside in, the value at each part, the verbs
the walk of its tags reaches, those of `::any` among them, and the
answer of every verb that has no effect and needs no modifier. The
caption style keeps the legend in one place and costs a line per part,
which is what the moldable inspector teaches about a view that gets
written.

What reaches the reader is calls, never heads. In both runs the head of
a verb misled where a call taught: `put 7` against `:weight ::number`,
`@rerun :failed` against `:only ::keyword`. A computed legend shows each
continuation as the call it is, with its answer on this value when it
can be run and marked as acting on the world when it cannot. The head
stays the verb's means of refusing a wrong call, and leaves the page a
reader is meant to read.

The form of the computed legend matters less than its content: F3 to
F6 answered alike. Two properties choose between them. F4 is the only
form whose every line is a law that holds on this value, so `runLaws`
over a legend proves it and a legend cannot lie about the value it
explains; it adds no tag of role a reader has to learn, Haiku's friction
with F3; and its call lines are queries a reader copies. F6 is the
shortest and the nearest to a figure with numbered callouts, and its
paths, `/4/0/0`, are projections the language reads. A legend could
print as F6 under a budget and as F4 in full, the concise and the
detailed form Anthropic's guidance asks for, both computed from the
same captions.

Nested labels are read progressively: the legend of a `::Run` names
`::Fail` at the part where it stands and links to its legend; the
children needed the nested captions, which F3 gave behind a link and
F4 and F6 inline, and every form that gave them succeeded.

Positions and names can live together. Style C makes a query read as
prose, `filter ~(weight | gt 3)`, where style A asks for `/3`. A caption
could name its part, `::part~(/3) weight: the weight of what is
inside`, and the walk could answer the name as the projection, which
would keep the legend in one place and give queries names; it would
also be a second way to reach a part, and is a question, not a reading.

## Beyond the vector: the overlay and the mirror

The forms above grew from the declaration a kind has today and were
measured on vectors. The maintainer turned it back: maps, sets and any
composite are values too, and the protocol of introspection is free, so
long as it answers a literal and explains best what the model holds.
Two facts of the grammar open it. A comment is trivia inside any
literal, so a value with comments between its parts reads back as the
same value:

```qlang
> {:a 1 |~ the a ~| :b 2} | eq {:a 1 :b 2}
true

> #[:x |~ an x ~| :y] | count
2
```

And a doc stands wherever a value stands, read by the same path as the
datum it explains:

```qlang
> {:a |~~ the a ~~| :b [|~~ each b ~~|]} | /b/0 | content
 each b
```

The overlay is the value printed with its legend laid over it as
comments, the maintainer's picture of highlighting laid over text: the
caption sits at the part it explains, whatever the composite, and what
the reader holds is still the value, which the next step reads. The
mirror is a value of the value's own shape whose every part is the doc
of the part at the same path, so `S | /fails/0/1` reads a datum and `S
| legend | /fails/0/1` its meaning, with no addressing of its own: a
vector of one element describes each element, a map from keywords to
docs lists the values a keyword part takes, and a set of one doc says
what each member is. The calls the value answers ride at the end of the
overlay and under a key of the mirror.

`run-composite.mjs` showed both to clean children over
`::Pipe{:id 7731 :st :amber :stages [[:build :ok 41.2] …] :owners
#[:ann :bob] :fails [["parse/empty" 2] …]}`, a map over rows of a
vector, a set and two enumerations. Without a legend Sonnet called the
meaning of the attempts a guess and could not call the retry, and Haiku
wrote a filter in its place. With the overlay or the mirror both models
answered every question of meaning and wrote the call; Haiku's slips
were of the primer's syntax, `~(…)~`. The overlay was the cheaper by a
tenth, and the mirror let Sonnet find a fault in the legend itself:
`:amber` says every stage passed while `lint` was skipped.

Readings of the model:

- The overlay is what a reader meets, `S | doc` or the host's print
  under a flag; the mirror is the value the overlay is printed from,
  the one a query reads, elides by the same budget, and runs laws
  within.
- The declaration of a label can be its mirror, written once: a blank
  form with a caption in every field, `[[|~~ the name ~~| {:ok |~~ passed
  ~~| …} |~~ seconds ~~|]]`. It is a literal of the shape the data has,
  which a model reads as data, and a constructor can hold a payload
  against it, so the description of the payload and the check of it are
  one spelling.
- A legend is what makes the terse form affordable. Rows of a vector
  cost no keys, and a map repeats its keys in every row; once the
  meaning of each column travels in the legend, a host can answer the
  tersest shape, the way a table states its header once.
- Progress through depth is the budget's: the mirror of a large value
  collapses a homogeneous collection to its one element, and a nested
  label stands as a link to its own mirror.

## Faults met on the way

- A declared label with no page answers `null` to `doc`, and an
  undeclared one refuses, though its payload has a legend.
- `manifest` refuses a value, and lists one noun's members, so no step
  goes from a value to everything that reaches it.
- `::Box/v | spec | /0` refuses with `::proj/FieldNotInSignatureError`
  whose descriptor speaks of a `:valueClass "spec"` and
  `:availableFields ["subject"]`, words of the runtime rather than of
  the language.
- No name inside a nested pipeline or a verb's body reaches the outer
  subject; `:s /` before the step is the only way, and both a clean
  Haiku and the model fell into it.

[D161]: ../../decisions/D161.md
[D162]: ../../decisions/D162.md
