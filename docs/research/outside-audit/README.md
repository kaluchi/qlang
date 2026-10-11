# Outside audits of the language

Each audit stands as a clean outside reader wrote it: `claude -p --model
opus` started from an empty directory, with no CLAUDE.md, no memory and
no MCP server, prompted by [prompt.txt](prompt.txt). Below each, its
findings in its order, one line each, and the fate of each: the commit
or the decision that answered it, the question of the audit it is, or
the decision it stands by. A finding not yet settled says open.

## 2026-10-10 · 401046d

[2026-10-10.md](2026-10-10.md). The problems, its third section:

1. The role of a declaration read from the form of its value and the depth of its address. Answered in part: the answer of a word is the name `answer` (D180), so `:Box |~~ b ~~| | :Box/area ~(1) | :Box/area/unit ::string | ::Box{} | area` answers `1`; a page still makes a label (D168), a topic is a label and `::qlang{:a 1}` stands, a question of the audit, and the place, the code and the kind of a part are still read from its form (D169, the model's), which the second audit holds the first scar. Open.
2. The bare name of a kind answers its page. Answered by D181 for `map`, a word, and by D191: a kind of the root is reached by its tag alone, and `"5" | number` is refused with `::number` nearest.
3. One fact written three times over vectors, sets and maps, comparisons on five kinds, `runLaws` on two. Answered in part: `runLaws` stands on `::any` alone (D180); a word declared under each kind stands by D169, the model's, which both audits dispute. Open.
4. Comparison against the first page. Answered in part: the first page no longer says every value compares (D185); `1 | gt "a"` is refused, and `gt` over the one order on `::any` is open.
5. Refusals by rule absent from the catalog, and refusals placed unevenly. Answered by D180 and the pages of cf359631, e35d202c and faf4c8cd for the first: `::number/add | manifest | has ::number/add/SubjectNotNumberError` answers `true`, and the refusal has its page. A refusal on the word beside one on the part, `round/DigitsNotIntegerError` and `round/digits/NotNumberError`, `filter/ConditionNotBooleanError` and `if/condition/NotBooleanError`, is open.
6. The word law meaning two things. Answered by D174, D175 and D185: a law is a definition `::law~(…)` that `laws` and `runLaws` read, an invariant a `::holds~(…)` named by its refusal, and the first page names laws alone.
7. Gaps of expression. Answered in part by D194: `range` and `zip` are words, and `find`, `replace` of a text and an update of a field are spelled already, by `filter … | first`, `split … | join …` and `union`. Open: `reduce` takes one word, `[1 2 3] | reduce 0 ~(add 1)` refused, and regular expressions; the family of `…Of` and the declarations of a word of one part stand by D165 and D173.
8. Scars of older models in names. Answered in part: `operand` left the code, the files and the catalog (14d351e), the old names of cases left, and the second spelling of an error's tag by D190; `descriptor` in the JSON of an error, answered by D192, which writes `facts`; `TagKeyword` and `BareTypeKeyword` in the core, and the several words for a call's values are open.
9. Prose and examples. Answered in part: `the than` left with the part named `value` (a7b3f58a), and the law `:qlang/rounds` and the bare `::call~(add 3)` left the pages; `is read first by parseJson` and the print of a law that writes JSON as qlang are open.
10. The literal of a doc. Did not hold for an unbalanced `~(`, the doc closing (marked ✗); a comment and a doc told apart by one tilde is open.
11. The process. Open, a matter of the process.
12. The implementation. Answered in part by D200: a word of the root runs over the root, so a call copies no frame of its source, and ten thousand calls of `allOf` take 1.5 seconds where they took 8.9. Open: every node runs through `async`.

Its proposals, the fifth section, and its disagreements with the audit, the sixth, are open, but for these: hints for names of other languages, `map` among them, answered by D181 for `map`; the literal that fails at its first error, a question of the audit for the maintainer's word; and the page of a refusal named by its site, answered with the fifth finding.

## 2026-10-11 · 68af9ab5

[2026-10-11.md](2026-10-11.md). The problems, its third section:

1. Almost no abstraction of a reader's own. Answered in part by D194: `mod`, `abs`, `floor`, `ceil`, `range` and `zip` are words, and `find`, `replace` of a text and an update of a field are spelled already, by `filter … | first`, `split … | join …` and `union`. Answered by D197 for the short circuit: a condition of `allOf` may be a quote, run in its turn, `[1 null] | filter ~(allOf (ne null) ~(gt 0))` answering `[1]`. Open: no quote with parameters, `reduce` of one word, and regular expressions.
2. Quiet traps against the language's own principles. Answered in part: the bare name of a kind by D191; the command line on JSON input by D192, whose refusal holds the answer's literal, `| /users | type` reading `"printed": "::vec"`, and an error's JSON writing `facts`. Open: `[1 ("x" | add 1)] | count` answers `2`, a question of the audit, which the model left open after weighing it, since the step of an error literal a quote holds waits on what it is as data; `groupBy` turns `2020` into `:"2020"` and refuses a boolean; `{:status :count} | /status | doc` looks up the name `count`. Set aside: `1 | gt "a"` refused while `sort` ranks every value, since a comparison across kinds refused catches a number read as text, `"30" | gt 25`, which the one order would answer without a word.
3. The role of a declaration read from its form, a second, hidden mechanism. Open: a page makes a label (D168) and `::qlang{:a 1} | type` answers `::qlang`; the place of a part read from `/n` or `at n`, its kind from a law of the form `is ::k`, the last names `answer`, `subject` and `construct` reserved (D169, D180, the model's); three words for a call's values, and `0 | cond` showing `:actualValue ::any/cond[]`; a step computed or code by the word, `if (gt 0) "pos" "neg"` refused.
4. A reader cannot name a value by a word of the vocabulary, `[1 2] | :first / | first` refused. Stands by D166, the model's, which this audit disputes; the maintainer shares the concern and leaves it for later (2026-10-11). Open.
5. The effect marker wrong both ways, `:map/f ~(/@x)` refused and a quote nested in a quote unchecked. Open, the audit's repair after the sister project.
6. Scars of older models. Answered in part: the second spelling of an error's tag by D190, and `descriptor` by D192; `describeType` beside `typeKeyword`, `source and module [D5]` in `core/src/runtime/axis.mjs`, the snippets and the TextMate grammar of the editor, the names of the cases of bindings and the vocabulary of thirteen words are open.
7. Complexity that does not pay. Answered in part: `source` prints a declaration a line (D193). The catalog's length, `add` written in sixty-seven lines and a word declared under three kinds stand: the maintainer holds the catalog still being combed, its order easy to reorganize once it is (2026-10-11). Answered in part: the parser reads a run of a doc's prose whole (590ca261), the parse of the root falling from 312 to 232 milliseconds. Open: comments and docs near a third of the grammar, a cold start near three quarters of a second, no file mode and no lasting session.
8. The process eats the design. Open, a matter of the process; the findings of the first audit not followed, answered by this ledger.

Its proposals and its disagreements are open, but for the literal that fails at its first error and the topic that is a label, questions of the audit for the maintainer's word.
