# Reviews of the catalog

Each report stands as its reviewer wrote it. Below each, its findings in
its order, one line each, and the fate of each: the commit that answered
it, the question of the audit it became, or the reason it was set aside.
A finding not yet settled says open.

## 2026-10-10 · vectors, sets and maps

[2026-10-10-vec-set-map.md](2026-10-10-vec-set-map.md), at 1c0758e3.

1. `leftType`, `rightType` and `key` declared again under each word, where D172 puts shared facts under `::error`. Answered by 1827f51b for `leftType` and `rightType`; `key` stays under each refusal, which names its own key, the first entry whose value is no number, the key a map lacks, the segment a projection read.
2. Laws named after `*`, `readsAFieldUnderStar` and `readsTheKeysOfEachMapUnderStar`, and five in `string.qlang`. Answered by 1389eb66.
3. The page of a law of `map/raise` calls `map` as a word it is no longer. Answered by edac4969.
4. The pages of the three kinds say a word answers under the subject's tags, which `map` does not. Answered by 621a5b54: the headers say which answers go back under the subject's tags, by the label each word's answer names.
5. `vec/sort` says a map sorts by its keys; it sorts by its values. Answered by edac4969.
6. `map/at` says null answers null; it answers the default, and the pages do not lead to `::null/at`. Answered by edac4969, the law repeating `null/at` gone; `vec/at` still leads nowhere, open.
7. `union`, `minus` and `inter` over a container of values that are neither sets nor maps refuse with a page that does not fit. Answered by 621a5b54 (D188): a value of no kind of the algebra is refused at its index by `ElementNotSetOrMapError`, a set beside a map with the pair.
8. The part `with` of the algebra of vectors names a value nothing is joined with. Answered by 621a5b54 (D188): a vector's word takes no value, refused beyond its parts with a page of `a | union b`, and the part of sets and maps is `other`.
9. The algebra says join, the name of the word that writes strings together. Answered by 621a5b54: the pages say unite, take from and keep what values share.
10. Refusal pages that do not say how to repair the call. Answered by cf359631: every refusal page of the three kinds shows the call that works.
11. Generic words where the language has its own: listing, container, bucket, pipeline. Answered by 610b05d4 for bucket and the laws named after a pipeline and by f3ebc9f4 for the listing; listing and container had left the vectors with their rewrite.
12. Law names that do not say what their queries prove. Answered by 24c66f1e: each law named by its claim and proving it; the law of a reversed set made a set by `distinct` stands under `reverse`, the law of `drop` that called `minus` is gone, and the page of `entries` says what its law proves.
13. Laws that prove one claim twice. Answered by 0a6cdfd0; the pair of `reduce` stays, each law the claim of its own page, the word's and the repair its refusal gives.
14. One fact told in different words across the three kinds. Open.
15. A refusal with a page under one kind and none under the others. Answered by faf4c8cd for `at` with no index or key, of vectors, maps and null; the rest stays as the rule refusals of finding ten of the third review stay.
16. Claims of the pages with no law. Answered by 68af9ab5: each claim holds by a law under its word, the page of `flat` says the subject's tag stays, and the page of `has` no longer names the search of the runtime.
17. `minus` and `inter` over a vector take sets too, which their pages do not say. Answered by 621a5b54: their pages name a map, a set or a vector of keys, and union's page says sets or maps of any count.
18. The fold of a set of sets keeps the tag, the others do not. Set aside by D188: the rule of the answer's label decides, and a set's fold answers a set, under the subject's tags as every word whose answer names its own label.
19. The order of the words in the three files does not follow what rests on what. Open.
20. Words of time and of mutation: already, instead, was called. Answered by 610b05d4.

## 2026-10-10 · the first page, any value, numbers and strings

[2026-10-10-first-page-any-number-string.md](2026-10-10-first-page-any-number-string.md), at 1c0758e3.

1. The page of `::boolean` says `if` takes a quote that answers a boolean; it takes the boolean. Answered by edac4969.
2. A page of `if` and its law speak of a subject of each element, the reading of `*`. Answered by edac4969.
3. `parseJson` says an error reads back as a map of `$tag` and `payload`; it reads back under `$error`. Answered by edac4969, with a sentence and a law on `json`.
4. The page of `::builtin` names `::vec` among the values `::builtin{}`. Answered by edac4969.
5. Laws of the first page repeating the laws of the chapters word for word, and `:qlang/rounds`. Answered by acbb73a2 from the other side: the first page of D185 shows its examples in its prose, which a test runs, so its copies leave and the chapters and words keep theirs; the sentences the page repeated left with the page of D185.
6. Laws that nearly repeat each other. The laws that repeat each other query for query left with acbb73a2 and 0a6cdfd0, none left now; the near repeats, open.
7. Pages of kinds that repeat the pages of words. Answered by f3ebc9f4 for the twice told range of `::number`; the rest, open.
8. Pages of words that repeat the repair their refusals' pages give. Open.
9. Refusal pages with no law under their address. Answered by cf359631 and e35d202c: every refusal of a part has its law; the refusals of `builtin` and `call/HostFailureError` are defects of a host, raised past the fail track, which no law can raise.
10. Refusal pages that do not say how to repair the call. Answered by cf359631 and e35d202c: every refusal page shows the call that works.
11. Pages that do not say what a call with no value or with more values does. Answered by faf4c8cd for the comparisons of numbers and strings, whose parts show their call; the other words, whose refusal by rule names the part a call lacks, stay as they are.
12. Claims with no law under their name. Answered by 68af9ab5: each claim holds by a law under its word, the law of the order of keys under `eq`, and the false cases of `gte`, `lte` and `lt` stand.
13. `runLaws` does not say what `:error` holds, and `:actual` is wrong for a law that answered an error. Answered by 24c66f1e: the page says `:actual` is null where a law answered an error, which `:error` names, with the law `failsALawThatAnswersAFailure`, named so that no law ends in `Error`.
14. `:any/apply/runsADistribute` and laws named after `*`. Answered by 1389eb66.
15. Laws that prove nothing of their page. Answered by 24c66f1e: the two laws are gone; the invariants and `construct` of a label stand under the chapter of verbs, and `::tag::Box` under the constructor of tag names, whose page makes the claim.
16. Negations standing for definitions. Answered by f3ebc9f4: the law of `::error` defined by what a refusal is not leaves, the chapter of errors proving the site, and the page of a number past the doubles says what it is; the address that held no one entity had left with an earlier rewrite.
17. Words of mutation: edits, has become, is replaced. Answered by edac4969 for has become and by 610b05d4 for edits and is replaced.
18. A guardian with no payload, a word the language does not have. Answered by 610b05d4: a noun that stands for a thing outside the language.
19. The order of the kinds in `qlang.qlang` and of the words of `any.qlang`. Answered in part by D189: the kinds left `qlang.qlang`, which holds the topic and its chapters alone; the order of the kinds is the list of the sources, a step of its own, and the order of the words of `any.qlang` stays open.
20. Pages of kinds that lead nowhere, and kinds in no chapter. Answered by 24c66f1e: every page of a kind leads on; `::desc` and `::tagged` stand in the chapter of values, `::holds` in that of verbs, `::law` in that of hypertext and `::builtin` in that of hosts, which says so, and the chapter of errors links that of code.
21. Strings say an emoji counts one; a modifier or a flag counts each code point. Answered by edac4969, with a law.
22. `lines` and `join "\n"` do not write back a closing break; commas between elements. Answered by edac4969, with a law on commas.
23. Law literals whose characters the page cannot tell apart. Answered by 24c66f1e: the laws write `"e\u0301"` and `"\u00a0a\u00a0"`.
24. Generic words: schema, result, implicit argument, pages about tests. Answered by 610b05d4 for schema and by f3ebc9f4 for result, the pages of the suite and the parts of `sumOf`; implicit argument left with the page of D185 and the part named X with an earlier rewrite; the part `value` that number and string pages do not name, open.
25. `:any/JsonValueNotEncodableError` told inside `json`, which no query meets. Answered by 24c66f1e: the refusal stands first under `::any`, and its page says it is a defect of the host thrown past the fail track, which no query meets.
26. Headers of the sources that repeat the order of a story. Answered by cf359631 for the laws named as refusals are, and by 24c66f1e for the headers, which say what each source holds, the order of a story told once in the chapter of verbs, where `source` reads it.

The first page itself was written anew by D185 and D186 after this
review; findings 5 and 6 still stand for the laws declared under
`::qlang`.

## 2026-10-10 · small kinds, step kinds, the command line, the core around `map`

[2026-10-10-small-kinds-steps-cli-map-core.md](2026-10-10-small-kinds-steps-cli-map-core.md), at c9c43bdb and 1c0758e3.

1. The site's first page taught `*`. Answered by 08f332a5.
2. Cases of comments that lost their comment, a case of a group with no comment, a case of a pipe before `*`. Answered by 08f332a5.
3. Two target cases walked an empty set, `::qlang | manifest` naming chapters with nothing under them. Answered by 08f332a5: they walk `kinds | map ~(manifest) | flat`.
4. Duplicates among cases and unit tests. Answered by 08f332a5, the copy naming the decision staying.
5. A test of the wrapper built under `::each`, a tag nothing answers. Answered by 08f332a5.
6. Names of cases and tests after `*`. Answered by 08f332a5 for the tests and by 1389eb66 for the catalog.
7. The language server matches the combinators by its own expressions, a second spelling of the grammar. Answered by 64908015: it reads the combinator from the parse of the source with a step at the cursor.
8. The fields of the step records stand in a schema and again in prose, and differ. Open, a decision.
9. `error.qlang` says a stop for each step passed; `doc.qlang` says `segments` answers one string. Answered by edac4969.
10. Rule refusals with no page and no repair. Answered by faf4c8cd where a repair helps: the compared value of every comparison shows its call on its part's page, which `!| explain` reads for a call with no value, and `at`, `within`, `not` and the streams page their refusal by rule with a law; the other refusals by rule stay without a page, their address naming what the call lacks.
11. Invariant refusal pages that say what must hold and not how to repair the call. Answered by e35d202c: the pages of tags, keywords, descents and booleans show the call that works, and every comparison has its law.
12. The sister project still writes `*`. Answered by the port of the sister project onto D196, «ладно, jdt никуда не пуши, просто подтяни до актуального кода qlang и доработай проект если надо» (maintainer, 2026-10-11 02:52, session 22b934f8), its commits c04ba19 and 880b9fc on its local branch `feature/status-guide-newcomer-flow`.
13. Laws standing before the refusal they prove; `vec/table` with no page of its refusal. Answered by 24c66f1e: the law of `ParseError` stands after its facts, the laws of `:cli` after its refusal, and `table` pages `SubjectNotVecError` with its repair and its two laws under it.
14. Claims with no law. Answered by 68af9ab5: each claim holds by a law under its word or its refusal.
15. Laws that repeat laws; the facts `printed` and `field` declared again under each step kind. Answered by 1827f51b for `printed` and `field` and by 0a6cdfd0 for the laws of `doc` and `tag`; the law under `proj` no longer repeats one of vectors; the two laws of `call` stay apart, the addresses of the core and of a reader being two claims.
16. Generic words: env, descriptor, rewrap, constructor invocation, edit, still. Answered by 610b05d4 for env, descriptor, rewrap, constructor invocation and edit, and by f3ebc9f4 for still and the two comments; the part `value` the pages of tags and keywords do not name, open.
17. The page of `::explanation` misses the case of a refusal with no page. Answered by edac4969, with a law.
18. D181 replaced D52 only in part, a claim without its source, no case naming D181 for `map`. Answered by 08f332a5.
19. A refusal of an unknown combinator the parser cannot produce; `fork.mjs` holding one function; broken comment lines. Answered by 4622ace2, the comment of the language server by 64908015.

The question of the language server's precision after `map`, whose
answer D182 declares `::any`: open.

## 2026-10-11 · the autonomous series, D197 to D201

[2026-10-11-autonomous-series.md](2026-10-11-autonomous-series.md), at 832df32c, over 3c986534..832df32c.

1. A word of a source reached a bare value of its source after any word of that name, a reader's or a later source's, under D200's frame of the root alone. Answered by d6733d8c: the frame holds the source's bare values that hold no page over the root, two tests of the names of the scope hold it, D200 names D44 and the audit's lexical extension, and the comments of `types.mjs` and `eval.mjs` state the scope a declared quote runs in.
2. A quote condition of `allOf` and `anyOf` answering another kind met the refusal of `every`. Answered by fba5256f: the words are primitives beside `cond`, each refusing as its own `ConditionNotBooleanError` with a page and a law, and D197's Set aside weighs the composition.
3. `formOf` walked the predicates `typeKeyword` walks, a second table of the kinds, and its `tagged` narrower than `::tagged`. Answered by cae66823: the form is derived from `typeKeyword`, the second walk deleted, a value under any other tag `underTag`, and the ledger of the outside audits says so.
4. The bound of `range` written twice, in its page and in the host, the page naming JavaScript and no repair. Answered by d6733d8c: the refusal carries the bound as its fact `:longest`, declared under it, and its page names the fact and says the call has no repair but a count within it. A count below the bound that outgrows the host's memory, which no refusal names: open.
5. A quote called a condition where the catalog defines a condition as a boolean. Answered by fba5256f: the pages, the first page and D197 say a condition, or a quote that answers one in its turn.
6. A condition computed at the call refused at its first place under a repair, the quote, that changes nothing there. Answered by fba5256f: the pages of both refusals name the soft read of a field a record may lack beside the quote, a law at the first place under each, and D197 says the refusal holds at every place; the sister project's `problemsInRangeOf` meets an error for a marker without a start line on both trees.
7. Statements of pages with no law under their address. Answered by fba5256f for `anyOf` and by 847a868e for the reducer written first on maps and sets, the boolean, null and tag name keys of `indexBy` and `groupBy` on vectors and sets, and the keyword separator of `join`.
8. Values of two kinds whose text is one share a key of `groupBy` and `indexBy`, told nowhere. Answered by 847a868e: the pages of the four words say it, a law under each holds it, and D201's Set aside weighs a refusal of such a key.
9. D199 counted the paths of the shell from the first runs to the last, where all fall before D187. Answered by 49830b60: D199 places them before D187, names the reader it serves outside the benchmark, and says why a reading in the command line escapes D187's reason.
10. The open question of the root's boot wrote numbers no command printed and paraphrased the maintainer. Answered by 49830b60: it quotes his words, keeps no number, and anchors each reader of the whole root by its file and symbol; the ledger of the outside audits keeps no number of the parse either.
11. Comparisons of two states in a comment, the records and the commits. Answered by d6733d8c for the comment of the grammar and D200, by 847a868e for D198 and D201, and by 49830b60 for D199; the commits of the repair say what holds.
12. D198 claimed every word that writes text writes a keyword's name, which `print` refutes, and `join`'s page joined a map's pairs whose values may be numbers. Answered by 847a868e: D198 names `join`, `append` and `prepend`, and the page joins the pairs of a map of strings.
13. Names and comments of the implementation in files the series touched. Answered by cae66823.
14. A prefix of the map's writer that is always empty. Answered by cae66823.
15. The ledger of the outside audits closed questions the audit holds open. Answered by 49830b60: both items say open and cite the audit's question of a helper of one word.
16. The series named no deletion. Answered by cae66823, which names its deletions: the second walk of the kinds and the prefix of the map's writer.

## 2026-10-11 · the repair of the series

[2026-10-11-repair-of-the-series.md](2026-10-11-repair-of-the-series.md), at 1327c652, over cae66823~1..1327c652.

Its check of the fates of the review of the series found some answered in part, and each part left open is one of its findings below.

1. No test held that a label of a source is no bare name inside its words. Answered by a077e3ef, a test of the names of the scope holding it, `::shop{} | self` refused where `:shop/self ~(shop)`, and by 9b3e058f, D200's Requirements naming it.
2. The frame of the root wrote again whether a record holds a page. Answered by a077e3ef: `nouns.mjs` exports `holdsAPage`, which `isLabel` and the frame read.
3. D200 said the audit's lexical extension holds, that a call copies no frame, and that the tests of the scope hold a reader's frame. Answered by 9b3e058f: D200 says the extension stays unmet with the probe of `:vec/doc` inside `tutorial`, that a call copies the frame of its source's bare values alone, in the ledger of the outside audits too, cites the cases of D44, and says scope.
4. The pages of the conditions' refusals called a condition a quote. Answered by 6750f841: a condition that fails where an earlier one decides is written as a quote that answers it in its turn.
5. D197 set the composition aside by a reading of the principle the audit does not hold. Answered by 9b3e058f: no word of the catalog raises a refusal of its own, its error literals standing in laws and pages alone, so the word's own refusal at an index needs a site in the host.
6. The property test of the round trip took no error, and the example test beside it makes the same claim. Answered in part by a077e3ef: the walk takes an error and a named error inside a vector, and its comment names the examples as the pins of the forms the walk does not take, the forms of JSON, every payload of a tag, declared tags, a leading combinator; deleting the suites the walk reaches is the work of the branch that grows its pools to those forms. Answered by ec0d6254 for the forms of JSON, the payloads under a tag no node answers and a leading combinator, the examples' file left and its suites the round trip does not reach moved to the files of their topics, and by 188bb5f7 for the two forms the third review found unpinned: an error with a stop on its trail, and a label the source declares.
7. Comments of the codec and titles of the edge cases in the words of an older model. Answered by a077e3ef.
8. Comparisons of two states in D199, D197 and the commits of the repair. Answered by 9b3e058f for the records; the commits of this repair say what holds.
9. D199's counts in words and D200's figures with no command. Answered by 9b3e058f: D199 names the grep, and D200 the command whose time it measured.
10. The repairs the refusal pages of the conditions state had no law, and a law's page of `join` said a map's entries. Answered by 6750f841.
11. The ledger answered a finding at the maintainer's word without his words, and gave a disposition no record holds. Answered by 791c3a99: the ledger quotes his word with its time and session, and the count that outgrows the host's memory says open.

The sister project's `problemsInRangeOf`, which the review noted reads a marker's start line strictly, stands a marker without one outside the range by d58c903 there.

## 2026-10-11 · the plans, the grammar and the tests

[2026-10-11-plans-grammar-and-tests.md](2026-10-11-plans-grammar-and-tests.md), at cd8829fe, over 1327c652..cd8829fe.

1. Code of one scalar stepped past an error it was handed, `codeOf` building it as the value. Answered by 188bb5f7: code is a step on the success track whatever it holds, the quick lambdas serving the modifiers of a call alone, and code of one quote, which b03223ee ran on an error element, steps around it as all code does; two cases of D182 and a law under `:vec/map` hold it.
2. A modifier of a scalar and a part read from its place opened no frame, against the page of the budget. Answered by 188bb5f7: both meet the budget at the frame below the call by `frameBelow`, a law of the budget holds a recursion that meets it in its frames, and D202 says so (3483289a).
3. The example test's last pins left with it: an error with a stop on its trail and a label the source declares. Answered by 188bb5f7: the walk takes both, and the ledger's fate of the earlier finding says what each commit answered.
4. The state unfrozen against the audit's frozen pair. Answered by 188bb5f7: the state is frozen and its test holds it, and D202 sets the unfrozen state aside (3483289a).
5. Core sources grew with no deletion named. Answered by 188bb5f7: the cache of parts and the second cache of invariants left, `invariantsUnder` reading the kinds an invariant asks in its one cache, the repair's core sources +124 -140.
6. The ledger credited the wrong commits. Answered by this ledger: 9b3e058f wrote D200's Requirements and 791c3a99 the quote and the open count.
7. D200 and the ledger of the outside audits said a call copies its source's frame alone and walks it for parts and invariants. Answered by 3483289a: both say the names with a path of the caller's frame come with it, and D202 replaces D200 in part.
8. The audit's question cut the maintainer's question and claimed an address read as data with no probe. Answered by 3483289a: it quotes his question whole, probes the shadowing the tree refuses and the address read as data, and prices the definition of a call inside a word of the root.
9. D202 required what one case held and decided a non-change. Answered by 3483289a: two cases more, an invariant of the answer and a part a reader declares, and the slots stand in its Set aside.
10. D203 claimed what a key of one letter meets. Answered by 3483289a: D203 says a key of one letter is near every other, with its probe; 4f1cc1b7 names D203 by a case.
11. Comments with their reasons, and the grammar's `.location` called peggy's. Answered by 188bb5f7: the grammar, the evaluator and the extras of the printer say what holds in a sentence.
12. "Plan" where the language says definition, comparisons of two states, environment for scope. Answered by 188bb5f7 and 3483289a for the code and the records; the commits of the range say what they said.
13. The test of `env` held of an empty map, and a projection stood in the bridge of JSON. Answered by 188bb5f7: the test prints three records, and the projection is a case of the projections.

## 2026-10-11 · the waits, the repairs and the comments

[2026-10-11-waits-repairs-and-comments.md](2026-10-11-waits-repairs-and-comments.md), at 49cc8305, over cd8829fe..49cc8305.

Its check of the fates of the third review found three holding in part, each part one of its findings below.

1. A host's answer that has a `then` but is no promise of the core's realm reached the pipe unresolved. Answered by f69b68bf: every wait of a call reads `isThenable`, and a test of the evaluator holds a thenable and a promise of another realm, which fails on the evaluator of 49cc8305.
2. The comment of the names visible at a cursor said both halves wrong. Answered by f69b68bf: it says what the code computes, a declaration inside a node whose declarations stay inside it seen only from within the part that holds it, its end included.
3. The line editor kept the terminals' reasons and comparisons, and its head left out the history and `submit`. Answered by f69b68bf: every comment says what holds in a sentence, and the head names the history, `submit` and the chunk a paste starts with.
4. The law of the budget held two frames only together. Answered by f69b68bf: `runLaws` runs a law some frames deep, so three cases of the declared verbs, which run from the top, hold the frame of each and the quote written as a modifier; each case fails when its frame is dropped.
5. Three texts said every modifier meets the budget. Answered by f69b68bf for the page of the budget, by the cases for the law, and by 4c241046 for D202: a modifier computed at the call runs a frame below, a quote written as one is a value.
6. The law of an error element under `map` proved a claim the page did not make. Answered by f69b68bf: the page says it.
7. The comment of the residence said a scope with no name with a path. Answered by f69b68bf: a scope that does not declare the address.
8. Comments of several sentences or of none, a peggy location, a session that fails to start, `parseArgv`'s comment far from it. Answered by f69b68bf.
9. D202's timing gave the word in steps the filter's ratio. Answered by 4c241046: the filter under a third of its time at b03223ee, the word in steps about two thirds, in D202 and in the ledger of the outside audits.
10. The prototype the audit cited lived in a scratchpad. Answered by 4c241046: `docs/research/lexical-extension/marked-scopes.patch` holds it, it applies to the tree, and the audit names it.
11. D200's mark of D202 stood mid-line, where the requirements do not read it. Answered by 4c241046: `node scripts/requirements.mjs D200` reads it.
12. Comparisons in commits and in this ledger. Answered by this ledger for its line on code of one quote; the commits say what they said.
