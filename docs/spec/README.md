# The specification

What the language is and what is required of it, by topic. Each chapter
states its rules section by section and shows them by probes, which
`npm run check:probes` runs. The requirements of a section are the
cases of the conformance file named for it,
`core/test/conformance/QSNAM/scope.jsonl` for the section `scope` of
`QSNAM`, and the code, the tests and the documents cite a section by
its chapter's code and its heading, `[QSNAM#scope]`.

The chapters, in the order the concepts rest on each other:

| code | topic |
|---|---|
| [QSLIT](QSLIT-values-and-literals.md) | a value and its literal, JSON as syntax, the atoms |
| [QSORD](QSORD-one-order.md) | one order over all values, the set |
| [QSSYN](QSSYN-grammar.md) | the grammar: steps, combinators, whitespace, comments, docs, refusals |
| [QSPTH](QSPTH-paths.md) | a path, read and written |
| [QSNUM](QSNUM-numbers.md) | the words of numbers |
| [QSCOL](QSCOL-collections.md) | vectors, maps and sets, their algebra, `map`, `filter`, `reduce`, `groupBy` |
| [QSTXT](QSTXT-text.md) | text and patterns |
| [QSCND](QSCND-conditions-and-conversions.md) | conditions and conversions |
| [QSQUO](QSQUO-code-as-data.md) | code as data: the quote, its steps, `apply`, modifiers, held code |
| [QSNAM](QSNAM-names-and-scope.md) | names and scope |
| [QSDSP](QSDSP-a-word-found-through-its-subject.md) | a word found through its subject |
| [QSBLD](QSBLD-functions-and-kinds.md) | a function and a kind built by commands |
| [QSERR](QSERR-errors.md) | an error at rest and in flight |
| [QSSLF](QSSLF-the-language-describes-itself.md) | the language describes itself: axes, laws, docs, the first page, the catalog |
| [QSPRN](QSPRN-printing-and-codecs.md) | printing, codecs, elision, a place in text |
| [QSHST](QSHST-hosts-and-the-command-line.md) | hosts and the command line |
| [QSWRK](QSWRK-the-work.md) | the work: the records of decisions, the specification, the cases, the branch, the measures and the tooling |
