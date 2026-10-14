# The specification

What the language is at the baseline and what is required of it, by
topic [D283]. A chapter states what holds and nothing else: no history,
no form the language left, no refusal of a form that is gone but one
that teaches the form that is. Its sections show their rules by probes,
which `npm run check:probes` runs, and hold their requirements as the
cases of a file of the conformance suite named for the section,
`core/test/conformance/QSNAM/scope.jsonl` for the section `scope` of
`QSNAM`. The code, the tests, the cases and the documents cite a
section by its chapter's code and its heading, `[QSNAM#scope]`, and the
walk of the baseline holds every such citation to a heading the chapter
has.

The change is the journal's, `docs/decisions/`: a record in transit
names the sections it overrides and rules over them while its work
runs, and at the move of the baseline it dissolves into them and leaves
for `replaced/`, its line `Dissolved into` naming where. A case under a
chapter names a record only while that record's change is in transit
over it.

The chapters, in the order the concepts rest on each other; a chapter
not written yet keeps its rules in the records in force and its cases
in the files of the suite outside the chapters.

| code | topic | written |
|---|---|---|
| QSLIT | a value and its literal, JSON as syntax, the atoms | |
| QSORD | one order over all values, the set | |
| QSSYN | the grammar: a command, whitespace and comments, what the parser refuses | |
| QSPTH | a path is a value, written and read | |
| QSNUM | the words of numbers | |
| QSCOL | vectors, maps and sets, their algebra, `map`, `groupBy` | |
| QSTXT | text and patterns | |
| QSCND | a condition is a boolean, a value turned into another kind | |
| QSQUO | code as data: the quote, its steps, `apply`, forks | |
| [QSNAM](QSNAM-names-and-scope.md) | names and scope | yes |
| QSDSP | a word found through its subject | |
| QSBLD | a function and a kind built by commands | |
| QSERR | an error at rest and in flight, a refusal names its site | |
| QSSLF | the language describes itself: names of the catalog, laws, `explain`, docs, the first page, the names near | |
| QSPRN | printing, elision, a place in source | |
| QSHST | the boundary of a host and the command line | |
| QSWRK | the order of the work: the journal, the baseline, branches, sensors | |

[D283]: ../decisions/D283.md
