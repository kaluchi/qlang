# Outside audits of the language

Each audit stands as a clean outside reader wrote it: `claude -p --model
opus` started from an empty directory, with no instruction file, memory
or server, prompted by `scripts/outside-audit-prompt.txt` as the tree it
read held it, which `node scripts/outside-audit.mjs` runs and writes under
its date and tree. The two latest audits stay here, each with the
model's reading beside it and below, its findings in its order, one line
each, and the fate of each: the commit or the record that answered it,
or the record that holds it open. The run gives an older audit to the
history with its reading and its part of this ledger, and what the tree
still shows of its findings stands in the open records.

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
5. The names of refusals made from the kinds an input takes, a public name that moves with a signature. Open as D287.
6. Noise and gaps in the errors. The page of `::quote/ParseError` says where `:expected` stands: answered. The stop of a group, the empty `:skipped`, the `:index` of a failure in `map` and a hint that reads one example: open.
7. Discoverability. The first page says what `manifest` answers, the words of a kind, its refusals and the roles of its chain: answered. Words of other languages: open since 3495de5d. The reads of a key by a keyword or a string stand by D139 and D248.
8. Complexity: the catalogs of a vector, a set and a map written thrice, the register of the prose, the process. Open.

Its proposals, the fifth section, are open but for the snippets and the promise of `:expected`, answered. Its disagreements, the sixth: the scope is D278 and a scar; the grammar a scar; the consumers answered where it named them; the pattern of code read by its form, the catalog the seventh condition leaves out, the priorities and the process are the reading's questions to the maintainer.
