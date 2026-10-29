# QSLEX · The words and the names

The words the texts of the work write and the names the code gives: each of
one sense in the project and chosen for the grep, the core first.

## term

A term of the language and of the texts that state what holds strikes one
sense, by the principle of the aim, and is weighed in those texts before it
is chosen, kept or split. The vocabulary is distilled at each run of the
pentimento audit by the measures `node scripts/sensors/vocabulary.mjs`
computes over those texts:

- the selectivity of a term, the share of its matches that stand in the
  files naming its anchor, the tag, the section or the refusal of its one
  sense, a match away from the anchor another sense;
- the consistency of a concept, one concept under one term and one image,
  the words that name it in the files naming its anchor, a second word there
  a drift, and the share of the files writing one term of a group that
  write its partner, a term from another image chosen again with the group;
- the prior of a new term where the two leave a choice, the files of a
  corpus of other projects, the `node_modules` of the checkout, that write
  it, a word rare in the project and known outside it in the right pair the
  best.

A term found in several senses is split into anchor terms, one a sense,
each with its own anchor; a concept under rival words keeps one; and a group
of another image is chosen again as a whole. A record that retires a term
writes it into the lexicon of retired terms, `scripts/retired-words.mjs`, in
the commit that retires it: a regex of the term, the term to write instead
and the record. An entry refuses a word whole in its spellings, where no
sense of the word fits the texts that state what holds, a compound term the
work retired, or the exact names a retired sense wrote; a word the texts
still write in another sense is parted first, each live sense under a word
of its own or the word kept to its one narrow scope, and no entry refuses a
sense by the words around a word. The lexicon holds the terms of the
project, each of one sense and high in entropy. A generic word of other
projects, which a search finds in a heap of senses, stays out of it, its
uses held by the readers of the pentimento audit and its retired senses by
their names, but for a generic word the texts that state what holds write
in no sense at all, which it refuses whole. The tests of the lexicon show
each entry by the spellings it refuses and the words beside it it leaves,
every entry refusing a sample, and hold no sentence the texts once wrote.
The journal and the research, which carry the change, keep the words they
quote.

## grep

A word of the texts and a name of the code are chosen for the grep, so a
search of it finds its anchor and its uses and little else: one sense in the
project, high in entropy, a word rare in the project and known outside it in
the right sense the best. The core comes first, its names and the names of
its files, since every tool and every reader searches it. The session names
the conversation of a model alone, the word of the harness its transcripts
are read by, and a notebook the cells a host runs over one scope
[QSHST#notebook]; a key of the specification is unique by its construction,
a code of five letters and a heading [QSVOX#chapter].

A name the code gives is measured by its false matches, the files that hold
it as a word and neither define, import nor re-export it, which `node
scripts/sensors/vocabulary.mjs --exports` counts for every export of
`core/src`, the most false first. A name of one word that a heap of senses
shares in the project takes the noun of what it reads or makes: the core
reads a source by `parseSource` and makes a keyword by `makeKeyword`, while
the verb `parse` and the kind `::keyword` of the language keep their bare
words. A family of names shares the stem of its reader, `runsAsCode` and
`foldsAsCode` beside `inputsAsCode`.

No two modules of the project, its `.mjs`, `.js`, `.qlang` and `.peggy`
files, bear one name, so a search of a name finds one file: the primitives of
a noun stand in `core/src/runtime/<noun>-primitives.mjs` beside its page,
`core/lib/qlang/<noun>.qlang`. A test file, which the section it stands at
names [QSREQ#marks], and a configuration of a tool, `*.config.mjs`, stand
aside by their form. `check:conventions` refuses two modules under one name,
`scripts/grep-ergonomics.mjs`.

```sh
$ node -e "import('./scripts/grep-ergonomics.mjs').then(m => console.log(m.namesSharedInTree('.').length))"
0
```

## code

The code names each thing as the language names it: a tag is a tag,
`makeTag`, `isTag`, `TagLit`, a step a step, a modifier a modifier. A
comment of the modules of JavaScript of the core, the streams, the
playground and the language server, their sources and their tests, is a
mark alone, the grammar keeping its prose over its rules, one line of the citations of the sections
and the records its block holds, `// [QSNAM#reach], [QSDSP#walk]`, or a
directive of a tool, `/* global fetch */`. What the code does is read from
the code and its names, the rule from its section and the reason from its
record, so no comment says again what a section states or the code shows,
and a mark that repeats the one before it in its file stands once, the block
of that one reaching to the next [QSREQ#marks]. `check:conventions` refuses
any other comment of them, each read by acorn, a comment after code on its
line among them.
