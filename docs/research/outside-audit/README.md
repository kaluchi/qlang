# Outside audits of the language

Each audit stands as a clean outside reader wrote it: `claude -p --model
opus` started from an empty directory, with no CLAUDE.md, no memory and
no MCP server, prompted by [prompt.txt](prompt.txt), which
`node scripts/outside-audit.mjs` runs and writes under its date and tree
[D277]. Below each, its findings in its order, one line each, and the
fate of each: the commit or the decision that answered it, the question
of the audit it is, or the decision it stands by. A finding not yet
settled says open.

The audits are run with one prompt from time to time, and the work
takes from each what it takes, or goes its own way; the next audit,
compared with the ones before, shows how the reading of the language,
its strengths and its problems, drifts. The six so far are named below
by their trees, 401046d, 68af9ab5, 6f8c9422, 7fe783f6, 3495de5d and
cbaaeb2d.

## The drift of the assessment

The strengths, theme by theme, and the audits that named each:

- The failure as a value under the address of its site, with its trail,
  and the two tracks, `|` and `!|`: all six.
- The literal as the shape of the answer: all five; a step of its own in
  the first four, at the head and under `get` since D248.
- A grammar that teaches, its refusals naming the habit of another
  language: all six, the fifth with the read a refusal names, `:read`,
  the sixth with `query` for `/a?`.
- Strictness: no truthiness, no text read as a number, a number a finite
  double: 401046d, 6f8c9422, 7fe783f6, 3495de5d, cbaaeb2d, and 68af9ab5
  as the early refusal of a value where code is wanted.
- One order of every value, a set as the ordered vector: 401046d,
  68af9ab5, 7fe783f6, 3495de5d, cbaaeb2d.
- Code as data that prints and reads back: 401046d, 68af9ab5, 7fe783f6,
  3495de5d, cbaaeb2d, the sixth with a literal for everything the
  language holds.
- The catalog as an executable specification, its laws run: 68af9ab5,
  6f8c9422, 7fe783f6, 3495de5d, cbaaeb2d, and 401046d as the cases of
  query and expectation; the sixth with one protocol, `doc`, `manifest`,
  `laws` and `source`, for a word, a kind and a topic.
- The budget of an answer, an elision whose `:read` continues the
  query: 401046d, 68af9ab5, 6f8c9422, 3495de5d.
- The path as a value the word that takes it reads, strictly by `get`,
  softly by `query`: 3495de5d.
- Tags kept through a computation, `::Width(2) | add 3`: 68af9ab5,
  7fe783f6, cbaaeb2d, the sixth with the dispatch by the kind of the
  subject.
- The conformance suite outside the language, each case bound to its
  decision, a specification that outlives a rewrite of the core:
  cbaaeb2d.

The problems, theme by theme, the audits that named each, and what
became of it:

- The role of a definition read from the form of its value: all six,
  first or third, the fifth with the short form of `reduce` and the
  selectors of parts; answered for a declaration by D251, D252 and
  D253, a word and a kind built by their chains, and the sixth names
  what stays, code read by its form: the one word of `reduce`, the
  places `~(query /n d)` and `~(it)`, open as D274, and the failed object
  an input of code refuses.
- Two inputs, the family `…Of` and a fold of one word: all five, the
  first named as a lack of user abstraction and gaps of expression; the
  fold answered by D233, which runs code of any shape on the pair of the
  value so far and the element, the family `…Of` open, the fifth
  proposing one word of two fields in its place.
- The process eats the design: all six; answered in part by D225, D226
  and D227, which the fourth reads as more accounting, the fifth as the
  artifact that grows fastest and the sixth as a measure taken too
  seldom beside the records.
- Scars of older models in names, prose written for its author: all
  six, shrinking from whole kinds of names to the names of cases; the
  fifth names the traces D248 left, cleaned by f9d4b9f5, and the
  register of the prose, and the sixth the form, the args and the
  projection of the pages, the pages of a key and a reducer that left
  out the path, and the editor's snippets, answered on the branch of
  its reading.
- The weight of the implementation, `async` on every node and the cold
  start: 401046d, 6f8c9422, 7fe783f6, 3495de5d; open.
- `::any` as the place of the reader's words: 68af9ab5, a verb declared
  there for want of an abstraction; 6f8c9422, words that read no
  subject; 7fe783f6, a common dump, the first page showing no
  declaration of a word. The fold answered by D233, and the dump by
  D235, the examples holding code under a bare name run by `apply` and
  declaring a word only where they show one; the words that read no
  subject open.
- The marker `@`: 68af9ab5, 6f8c9422, 7fe783f6; answered by D234, which takes it out of the language and meets the target of D2.
- One fact in one spelling broken, in the catalog and then in the
  grammar: 401046d, 6f8c9422, 7fe783f6, 3495de5d, cbaaeb2d, the sixth
  with the catalogs of a vector, a set and a map written thrice and five
  spellings of one read; open.
- Each word deciding code or value on its own: 6f8c9422, 7fe783f6,
  3495de5d, cbaaeb2d, the fifth with `get` reading the paths a template
  computed, the sixth with the failed object an input of code refuses
  and another passes; stands, each by its reading.
- The vocabulary of the concepts: 6f8c9422, 7fe783f6, 3495de5d,
  cbaaeb2d, the sixth with the modifier, the object, the args and the
  input of one call; open, D276.
- A value named by a word of the vocabulary banned: 68af9ab5, 6f8c9422;
  answered by D223, not named again.
- A silent trap against the language's own rules, a literal holding a
  failure or `groupBy` merging keys: 68af9ab5, 6f8c9422; answered by
  D210 and D228, not named again.
- The bare name of a kind as a value, `5 | string`: 401046d; answered
  by D191.
- The comparison model against the first page, the word `law` meaning
  two things, refusals missing from the catalog: 401046d; answered by
  D185, D174 and the catalog, not named again.
- The error model after D210 and D211: 6f8c9422; answered by b5c89c30
  and D220, not named again.
- New with 7fe783f6: a quote under a bare name answering itself, a
  number as the key of `at`, `runLaws` that stops at a word, an
  undeclared tag taken silently.
- New with 3495de5d: a quote written as the body of a declaration
  closing over its scope where its print does not show it, a declaration
  both a step and a separator, a query of a path alone over an input
  answering the path in silence, names of refusals that say quote where
  a path is taken, and no bridge from the words of other languages.
- New with cbaaeb2d: a quote held as data reading its names where it
  runs, open as D278; the names of refusals made from the kinds an input
  takes, a public name that moves with a signature; the stop of a group
  on a trail, an empty `:skipped` in every stop and no `:index` in the
  failures of `map`; and a grammar the audit's own fifth condition
  measures and its scars did not name, a scar since.

## 2026-10-10 · 401046d

[2026-10-10.md](2026-10-10.md). The problems, its third section:

1. The role of a declaration read from the form of its value and the depth of its address. Answered in part: the answer of a word is the name `answer` (D180), so `:Box |~~ b ~~| | :Box/area ~(1) | :Box/area/unit ::string | ::Box{} | area` answers `1`; a page still makes a label (D168), a topic is a label and `::qlang{:a 1}` stands, a question of the audit, and the place, the code and the kind of a part are still read from its form (D169, the model's), which the second audit holds the first scar. Open.
2. The bare name of a kind answers its page. Answered by D181 for `map`, a word, and by D191: a kind of the root is reached by its tag alone, and `"5" | number` is refused with `::number` nearest.
3. One fact written three times over vectors, sets and maps, comparisons on five kinds, `runLaws` on two. Answered in part: `runLaws` stands on `::any` alone (D180); a word declared under each kind stands by D169, the model's, which both audits dispute. Open.
4. Comparison against the first page. Answered in part: the first page no longer says every value compares (D185); `1 | gt "a"` is refused, and `gt` over the one order on `::any` is open.
5. Refusals by rule absent from the catalog, and refusals placed unevenly. Answered by D180 and the pages of cf359631, e35d202c and faf4c8cd for the first: `::number/add | manifest | has ::number/add/SubjectNotNumberError` answers `true`, and the refusal has its page. A refusal on the word beside one on the part is answered by D218: a part's value, or an element of it, is refused under the part, `round/digits/NotIntegerError` beside `round/digits/NotNumberError`, while `filter/ConditionNotBooleanError` refuses what a run answered and stays under the word, the condition of `if` being a part the call computes.
6. The word law meaning two things. Answered by D174, D175 and D185: a law is a definition `::law~(…)` that `laws` and `runLaws` read, an invariant a `::holds~(…)` named by its refusal, and the first page names laws alone.
7. Gaps of expression. Answered in part by D194: `range` and `zip` are words, and `find`, `replace` of a text and an update of a field are spelled already, by `filter … | first`, `split … | join …` and `union`. Open: `reduce` takes one word, named by its name or its address (D224), and a fold of another step is spelled by a word declared with its part, which `reduce` calls with the value so far and the element, `:vec/withTotal ~(append (last | coalesce 0 | add n)) | :vec/withTotal/n ~(/0) | [1 2 3] | reduce [] ~(withTotal)` answering `[1 3 6]` at the cost of a declaration, while the audit asks whether a quote closes over the scope it was written in, its question of a helper of one word; regular expressions, a question of the audit. The family of `…Of` and the declarations of a word of one part stand by D165 and D173.
8. Scars of older models in names. Answered in part: `operand` left the code, the files and the catalog (14d351e), the old names of cases left, and the second spelling of an error's tag by D190; `descriptor` in the JSON of an error, answered by D192, which writes `facts`; `TagKeyword` and `BareTypeKeyword` by D207, which names a tag a tag. The several words for a call's values are open.
9. Prose and examples. Answered in part: `the than` left with the part named `value` (a7b3f58a), and the law `:qlang/rounds` and the bare `::call~(add 3)` left the pages; the passive `is read first by parseJson`, which the pages write beside the query that reads, `"5" | parseJson | add 1`, and the print of a law written in JSON, which prints its code in qlang, `:j |~~ J. ~~| | :j/readsJson ::law~({"a": 1} | eq {:a 1}) | ::j | laws | first | /1` answering `~({:a 1} | eq {:a 1})`, are open.
10. The literal of a doc. Did not hold for an unbalanced `~(`, the doc closing (marked ✗); a comment and a doc told apart by one tilde is open.
11. The process. Open, a matter of the process.
12. The implementation. Answered in part by D200: a word of the root runs in the frame of its source's bare values over the root, so a call copies that frame, which the sources of the language leave empty, with the names with a path of the caller's frame; and by D202: a call reads its word's definition, its parts, their invariants and its answer, once for the root where the scope declares nothing under the word, builds its args where something reads them and waits on an answer that has a `then` alone, so the filter D202 times takes under a third of its time at b03223ee and a word written in steps about two thirds. Open: every node runs through `async`.

Its proposals, the fifth section, and its disagreements with the audit, the sixth, are open, but for these: hints for names of other languages, `map` among them, answered by D181 for `map`; the literal that fails at its first error, answered by D210, a literal answering the first failure among its parts; and the page of a refusal named by its site, answered with the fifth finding.

## 2026-10-11 · 68af9ab5

[2026-10-11.md](2026-10-11.md). The problems, its third section:

1. Almost no abstraction of a reader's own. Answered in part by D194: `mod`, `abs`, `floor`, `ceil`, `range` and `zip` are words, and `find`, `replace` of a text and an update of a field are spelled already, by `filter … | first`, `split … | join …` and `union`. Answered by D197 for the short circuit: a condition of `allOf` may be written as a quote that answers it in its turn, `[1 null] | filter ~(allOf (ne null) ~(gt 0))` answering `[1]`. Open: a quote with parameters, which a word declared with its parts spells at the cost of a declaration and which the audit asks as its question of a helper of one word; regular expressions, a question of the audit.
2. Quiet traps against the language's own principles. Answered in part: the bare name of a kind by D191; the command line on JSON input by D214, which writes every answer as its literal whatever the input was and converts it by `| json`, so `| /users | type` answers `::vec`; a literal holding a failure by D210, `[1 ("x" | add 1)] | count !| type` answering `::number/add/SubjectNotNumberError`. Answered by D221 for a keyword read as a name: a keyword is data that names nothing, so `{:status :count} | /status | doc` answers the page of `::keyword`. A key of `groupBy` files a number under the keyword of its text and a boolean under that of its literal by D201, and two values that would share one meet and are refused by D228. Set aside: `1 | gt "a"` refused while `sort` ranks every value, since a comparison across kinds refused catches a number read as text, `"30" | gt 25`, which the one order would answer without a word.
3. The role of a declaration read from its form, a second, hidden mechanism. Open: a page makes a label (D168) and `::qlang{:a 1} | type` answers `::qlang`; the place of a part read from `/n` or `at n`, its kind from a law of the form `is ::k`, the last names `answer`, `subject` and `construct` reserved (D169, D180, the model's); three words for a call's values; a step computed or code by the word, `if (gt 0) "pos" "neg"` refused. `0 | cond` showing `:actualValue ::any/cond[]` stands by D173, the maintainer's: the args of a call are the word's tag over the values it gave, the literal form of a call that reads back, and a part that reads them whole holds them so.
4. A reader cannot name a value by a word of the vocabulary, `[1 2] | :first / | first` refused. Answered by D223, which lifts the ban of D166: a value takes any name, and a step that calls it on a subject a word of the name answers is refused aloud with the address of the word, which calls it, so `[1 2] | :first / | first` answers `::call/ValueMeetsWordError` with `#[::vec/first]`, `[1 2] | :first / | 7 | first` answers `[1 2]`, and a word the core or a host adds breaks only a step that calls its name on a subject it answers; a fold meets the word as a step does and names it by its address (D224).
5. The effect marker wrong both ways, `:map/f ~(/@x)` refused and a quote nested in a quote unchecked. Open, the audit's repair after the sister project.
6. Scars of older models. Answered in part: the second spelling of an error's tag by D190, `descriptor` by D192, `TagKeyword`, `BareTypeKeyword`, `makeTagKeyword` and `TAG_BINDING_TAG` by D207, which names a tag a tag, and `describeType` beside `typeKeyword`: the form a writer of the core reads a value by, `formOf`, is derived from `typeKeyword`, a kind of the core by its name, `underTag` for a value under any other tag (the review of 2026-10-11, its third finding); `source and module [D5]` left `core/src/runtime/axis.mjs` (b3210635), the `keyword-atom` and `operand` of the editor's grammar and the `freeze` of its snippets left with it, and the snippets are labelled by declarations where they named the parser's `BindStep`. The grammar of the editor written apart from the parser's, which the audit would generate from it, the names of the cases of bindings and the vocabulary of thirteen words are open.
7. Complexity that does not pay. Answered in part: `source` prints a declaration a line (D193). The catalog's length, `add` written in sixty-seven lines and a word declared under three kinds stand: the maintainer holds the catalog still being combed, its order easy to reorganize once it is (2026-10-11). Answered in part: the parser reads a run of a doc's prose as one part (590ca261). Open: comments and docs near a third of the grammar, no file mode and no lasting session. The cold start of the command line, which boots the whole root in each process, is measured in the question of the audit, `qlang '1'` taking 0.74 to 0.84 s and the boot 0.63 s of it (31e800bb), and its work waits on the maintainer's word (2026-10-11).
8. The process eats the design. Open, a matter of the process; the findings of the first audit not followed, answered by this ledger.

Its proposals and its disagreements are open, but for the literal that fails at its first error, answered by D210, and the topic that is a label, a question of the audit for the maintainer's word.

## 2026-10-11 · 6f8c9422

[2026-10-11-6f8c9422.md](2026-10-11-6f8c9422.md), and the model's reading of it, [2026-10-11-6f8c9422-reading.md](2026-10-11-6f8c9422-reading.md). The problems, its third section:

1. The role of a definition read from the form of its value. New: a label whose declaration holds an invariant in its body is a value, so `:Box |~~ A box. ~~| ::holds~(/w | is ::number) | :Box/area ~(mulOf /w /h) | ::Box{:w 2 :h 3} | area` answers `::call/UnknownNameError` with no addresses. Answered for the trap by D229, an invariant a bare name declares refused where it stands, `::bind/InvariantNotUnderLabelError`; the roles of definitions read from the form of their values are open, the layer of declarations of the work on names.
2. No abstraction over two inputs: `reduce` takes a quote of one word, and the family `…Of` is incomplete and redundant, `{:price 4 :qty 3} | [/price /qty] | reduce 1 ~mul` answering `12`. A reducer names its word by its address as well (D224); the fold answered by D233, code of any shape running on the pair of the value so far and the element; the family `…Of` open.
3. `groupBy` merges distinct values under one key, `[1 "1" :"1"] | groupBy ~(/)` answering `{:"1" [1 "1" :"1"]}`. Answered by D228: two values of a key that file under one keyword meet and are refused, `[1 "1"] | groupBy !| type` answering `::vec/groupBy/KeyTakenError`, in `groupBy` and `indexBy` on vectors and sets.
4. The print of a failure against D209: misread, `:trail []` marking a failure raised with no step, which `raise` resumes; D219 cites D209 (b5c89c30). A query that does not parse is written with the prose of its page (b5c89c30), and names no `:uri` where no host named its source, a cell the session numbers itself.
5. `raise` on a map stands by D209, a second spelling of `!{…} | raise` whose removal waits on the maintainer's word; `runLaws` answered by D220, its `:error` the error at rest and its `:says` the page.
6. Code computed or quoted by the word, `if`, `cond`, `allOf`: stands, each by its own reading, D197 for `allOf`.
7. Second spellings in the grammar: `a | !| b` stands by D130, a group touching a name by the grammar's rule; the paired `Line*` rules are open; the refusal of a comma between modifiers says how they are separated (b5c89c30).
8. Scars: the broken wraps of the first page, of `runLaws` and of `raise` answered (b5c89c30); `lambda` in `eval.mjs` answered, the evaluator naming the modifiers of a call and code closed at the call; the cases `as-is-no-word` and `22-json-type-key-collision` stand, each stating what the language does, `as` refused as a name no word holds by D70 and a JSON object with a `"type"` key read as a map; the words for the concepts open; `[Dnn]` in the comments stands, the sources citing the records.
9. Words that read no subject on `::any`, `@in`, `@out`, `@err`, `@tap`, `env` and `kinds`, and `::cli | manifest` answering `#[]`; the marker `@`, which D2 took out of the core, still there. The marker answered by D234, which takes it out of the language; `out`, `err` and `tap` read their subject and hand it on, and the place of a word that reads none, `in`, `env` and `kinds`, is open.
10. The ban on a value named by a word of the vocabulary, D166. Answered by D223, a value taking any name and a step where it meets a word refused aloud, and by D224 for a fold.
11. Prose written for its author: the page of a zero divisor shows the record its test stands on (b5c89c30); the page of `UnknownNameError` opens with the repair and leads to the page of `:nearest`, which states the rule of the nearest names whole (48d1edc8); the length of the first page is open.
12. The process eats the design. Answered in part by D225, D226 and D227: a record in force says only what holds, the parts a newer record took pruned from it and a record no part of which holds closed whole, and the lines that replaced a record in part fell from 173 at the baseline to the three of E1, E2 and E3, whose fate waits on the maintainer's word; the code and the cases cite only records in force.
13. The implementation: a missed place told by the name of its tag (`isMissedPlace` in `core/src/eval.mjs`) stands by D166, a selector of steps that misses a place or a key of the args reading a part not given, the case `a-key-a-selector-of-steps-misses-is-a-part-not-given`, the two tags it reads the refusals of a projection that misses; `scopeOfMember` copying the scope at each call and `async` on every node are open; the cold start is measured in the audit's question and its work waits on the maintainer's word.

Its proposals and its disagreements are open, but for the page of a parse refusal and the strings of `runLaws`, answered with the fourth and fifth findings, and the lexical refinements its sixth section agrees with, answered by D222: a reader's extension of a noun of the root stands in the reader's queries alone, and a kind the reader declared goes with its values into a word of the root.

## 2026-10-12 · 7fe783f6

[2026-10-12-7fe783f6.md](2026-10-12-7fe783f6.md), and the model's reading of it, [2026-10-12-7fe783f6-reading.md](2026-10-12-7fe783f6-reading.md). The problems, its third section:

1. Two inputs: the family `…Of` incomplete, `addOf` unknown with `:nearest [:add]`, and redundant beside `[/x /y] | sum`; `reduce` takes a quote of one word. The fold answered by D233, code of any shape running on the pair of the value so far and the element, `reduce 0 ~(sumOf /0 (/1 | /x))`, the word of one name its short form; the family `…Of` open.
2. The role of a definition read from the form of its value: a part whose invariant is `is ::number` is served beneath its tags, and one whose invariant is `is ::number | eq true` is not; the reserved last names `answer`, `subject` and `construct`. Open, the layer of declarations, waiting on the maintainer's word; a label is a name with its page by D168, and `kinds` answers the labels, a topic among them, by D160.
3. A quote under a bare name answers itself, `:double ~(mul 2) | 5 | double` answering `~(mul 2)`, while `:any/double ~(mul 2)` is a word, and the first page shows no declaration of a word, so `::any` has become a common dump of the reader's words. Stands by D44, a name holding a value and `apply` running a quote; whether the step says so aloud is open with the layer of declarations. The dump answered by D235: an example holds code under a bare name and runs it by `apply`, `:double ~(mul 2) | 5 | apply double` answering `10`, or hands it bare to a word that takes code, and declares a word only where it shows one, under the label of the values it serves; the first page shows both, and the laws and the showcase of the language server follow.
4. A number as a key: `at` on a map refuses `1` where the projection reads `/1` and `groupBy` files the number under `:"1"`; `2 | keyword` is refused. Open: `at` refuses a number by the invariant of its key, a keyword or a string, which the page states, and a number taken as the keyword of its text waits on the maintainer's word.
5. The marker `@`: the guarantee leaks through a quote under a bare name that `apply` runs; cases mark pure words, `@topBy`, `@surround`, `@matching`; `@callers` names no word of any host, so the case `an-effectful-verb-under-a-marked-name-runs` expects `::call/UnknownNameError`. Answered by D234, which takes the marker out of the language, no name beginning with `@` and no declaration checking what its body calls, and meets the target of D2; the case of the marked word checks what its name says, and the pure words of the cases bear no marker (d51fcacb).
6. The grammar: a line break is `|` at the top level and a space in brackets, the paired `Line*` rules, and `docQuoteDepth`. Open: one rule for line breaks waits on the maintainer's word; a prototype of one family of rules, told apart by the depth of brackets, reads every input the tree's parser reads alike, the cases, the sources of the catalog and inputs made from them.
7. Code or value decided by each word, `if`, `cond` and `allOf`. Stands, each by its own reading, D197 for `allOf`.
8. The vocabulary of the concepts; `slot` in the names of cases, meaning a part; `::any/tutorial` beside `doc` and `laws`. The words for the concepts wait on the maintainer's word; the names of the cases say part where they said slot (d51fcacb).
9. `runLaws` runs the laws of a word and not those of its refusals, and no one query runs the whole catalog. Open.
10. The weight of the catalog, the refusals of every word written by hand; the cold start; `async` on every node; an undeclared tag taken silently, `::Pont{…}`. Open; the cold start waits on the maintainer's word.
11. The process eats the design: half of the last forty commits prune records, and the comments of the code cite records. The walk of this shift is a debt paid once, the lines that replace a record in part falling from 173 at the baseline to the three of E1, E2 and E3, which the ratchet keeps from growing; a citation of a record in force in the code stands by D225; its rule that a finding open in the ledger closes by code is open, a matter of the process.

Its proposals, the fifth section, and its disagreements with the audit, the sixth, are open.

## 2026-10-13 · 3495de5d

[2026-10-13-3495de5d.md](2026-10-13-3495de5d.md), and the model's reading of it, [2026-10-13-3495de5d-reading.md](2026-10-13-3495de5d-reading.md). The problems, its third section:

1. A quote carries a hidden scope: one written as the body of a declaration closes over that scope where its print does not show it, so two quotes `eq` holds equal run apart, `:f (:k 10 | :g ~(mul k) | g) | :k 2 | :h ~(mul k) | [(f | eq h) (3 | apply f) (3 | apply h)]` answering `[true 30 6]`. The fact stands in the open question of a helper of one word (f9d4b9f5), whose sentence that a quote does not close held of a bare quote alone; printing the names a quote closes over as declarations at its head, the audit's proposal, waits on the maintainer's word. Open.
2. Meaning read from the form of the syntax: the short form of `reduce` for one word, an invariant of the form `is ::k` that serves a part beneath its tags, the selectors of parts. Open, the layer of declarations.
3. Each word its own model of arguments: the branches of `if` quotes alone, and `get` reading the paths a template computed, `:p ([:b] | toPath) | {:b 7} | get [p (get /b)]` answering `[7 7]`. `get` stands by D248, a modifier computed at the call and every path of the value read; the rest stands, each word by its reading, open with the layer of declarations.
4. Names: one space of values and words, resolved by the kind of the subject, stands by D223; a declaration both a step and a separator, `:x 5 | 7 | add x` answering `12`, the head after a declaration of D248, the model's part, waits on the maintainer's word; a subject a name replaces in silence, `7 | :r 5 | add 1 | r`, is the open question of a step that drops its subject; `[1 2] :x 3 | x` stands by D243, a keyword on the line of a command being its modifier and one after a literal a declaration.
5. The traces of D248's move: the first example of `::cli`, the note for a query the shell turned into a path, the example of `zip`, two spellings of `allOf` and pages of `allOf` and `anyOf` naming a quote alone, answered by f9d4b9f5. A query of a path alone over an input answering the path in silence, `echo '[10,20]' | qlang '/0'`, the names of refusals that say quote where a path is taken, `…/NotQuoteError`, and the vocabulary of modifiers, args, parts and places, open.
6. The register of the prose and the citations of records in the comments. Open; a citation of a record in force in the code stands by D225.
7. Discoverability: no bridge from `select`, `length` or `.users[0].name`; the manifest of a kind listing its refusals beside its words; `::runLaws | doc` refused with `:nearest []`. Open.
8. Complexity: the refusals of the grammar; a quote of a doc that does not parse read as prose, which the test `no quote of a page is read as prose` catches for the catalog and nothing for a span in backquotes; the weight of the catalog; the kinds of steps; the process. Open.

Its proposals and its disagreements are open, but for the sentences of the project's audit on a literal as a step and on a quote that does not close, answered by f9d4b9f5.

## 2026-10-13 · cbaaeb2d

[2026-10-13-cbaaeb2d.md](2026-10-13-cbaaeb2d.md), and the model's reading of it, [2026-10-13-cbaaeb2d-reading.md](2026-10-13-cbaaeb2d-reading.md). The problems, its third section:

1. Code held as data reads its names where it runs, `:k 1 | :f ~(add k) | [5] | map ~(:k 100 | apply f)` answering `[105]`. Open as D278; the audit's finish names whose names a handed quote reads and asks where, and a scar of its own holds the probe.
2. Code read by its form: the one word of `reduce`, the places `~(query /n d)` and `~(it)`, the failed object an input of code refuses, the read a refusal names. The places are open as D274; `reduce 0 ~(add)` stands as the maintainer's canonical call (D233); the failed object stands by D129; the read is a hint the refusal carries, which runs nothing.
3. Exceptions to a step as a command. A value after a declaration: answered, the first page names the head after a declaration. The line breaks around a declaration: told by the page of the pipeline since 68255c84. The grammar's counters: a scar of the audit's. A quote of a doc that does not read as code stays prose by D19, the pages of the catalog held by the test `no quote of a page is read as prose`.
4. Traces of older paradigms. The form and the args on the pages of `path` and of the verbs: answered. The projection: answered, the parser's node of a path named `Path` and the editor's grammar saying path. The pages of a key and of a reducer that left out the path: answered across the catalogs of a vector, a set and a map. The editor's snippets: answered. The vocabulary of a call: open as D276. The screens of the benchmark stand as the runs read them.
5. The names of refusals made from the kinds an input takes, a public name that moves with a signature. Stands by D180 and D251, which name a refusal by rule; the cost is the reading's question to the maintainer.
6. Noise and gaps in the errors. The page of `::quote/ParseError` says where `:expected` stands: answered. The stop of a group, the empty `:skipped`, the `:index` of a failure in `map` and a hint that reads one example: open.
7. Discoverability. The first page says what `manifest` answers, the words of a kind, its refusals and the roles of its chain: answered. Words of other languages: open since 3495de5d. The reads of a key by a keyword or a string stand by D139 and D248.
8. Complexity: the catalogs of a vector, a set and a map written thrice, the register of the prose, the process. Open.

Its proposals, the fifth section, are open but for the snippets and the promise of `:expected`, answered. Its disagreements, the sixth: the scope is D278 and a scar; the grammar a scar; the consumers answered where it named them; the pattern of code read by its form, the catalog the seventh condition leaves out, the priorities and the process are the reading's questions to the maintainer.
