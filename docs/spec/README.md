# The specification

What the language is and what is required of it, by topic. Each chapter
of the language states its rules section by section and shows them by
probes, which `npm run check:probes` runs, and a chapter of the work
by the checks it names. The requirements of a section of the language
are the cases of the conformance file named for it,
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
| [QSNUM](QSNUM-numbers.md) | the verbs of numbers |
| [QSCOL](QSCOL-collections.md) | vectors, maps and sets, their algebra, `map`, `filter`, `reduce`, `groupBy` |
| [QSTXT](QSTXT-text.md) | text and regexes |
| [QSCND](QSCND-conditions-and-conversions.md) | conditions and conversions |
| [QSQUO](QSQUO-code-as-data.md) | code as data: the quote, its steps, `apply`, modifiers, held code |
| [QSNAM](QSNAM-names-and-scope.md) | names and scope |
| [QSDSP](QSDSP-a-verb-found-through-its-subject.md) | a verb found through its subject |
| [QSBLD](QSBLD-functions-and-kinds.md) | a function and a kind built by commands |
| [QSERR](QSERR-errors.md) | an error at rest and in flight, and the alert a host prints of a failure |
| [QSSLF](QSSLF-the-language-describes-itself.md) | the language describes itself: axes, laws, docs, the first page, the catalog |
| [QSPRN](QSPRN-printing-and-codecs.md) | printing, codecs, elision, the budget of an answer, a span of text |
| [QSHST](QSHST-hosts.md) | hosts and their boundary: the sources and the primitives a host hands, the doors, the notebook, the streams and the tokens |
| [QSCLI](QSCLI-the-command-line.md) | the command line and its REPL: the answer, standard input, the shell, the colour and the line editor |
| [QSLSP](QSLSP-the-language-server.md) | the language server and the editor: what the server reads, reaches and offers, the symbols of a document, and the extension |

The chapters of the work, which state the process by topic:

| code | topic |
|---|---|
| [QSWRK](QSWRK-the-work.md) | the work: the session and the stint, the records, the closeout and the reconciliation |
| [QSVOX](QSVOX-the-texts-and-their-voices.md) | the texts and their voices: the folders, the order, the voices, the pentimento, the seed and the chapter |
| [QSLEX](QSLEX-the-words-and-the-names.md) | the words and the names: the term, the grep and the names of the code |
| [QSREQ](QSREQ-the-requirements.md) | the requirements and what holds them: the cases, the target, the probe, the marks and the rigor of a change |
| [QSMSR](QSMSR-the-measures.md) | the measures: the benchmark and the diff |
| [QSRVW](QSRVW-the-reviews-and-the-research.md) | the reviews and the research: the review, the research, the readers and the audits |
| [QSGAT](QSGAT-the-repository-and-its-gate.md) | the repository and its gate: the workspaces, the imports, the hosts, the gate and the release |
