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

## 2026-10-11 · the thenables, the frames and the line editor

[2026-10-11-thenables-frames-and-the-line-editor.md](2026-10-11-thenables-frames-and-the-line-editor.md), at 95f12244, over 49cc8305..95f12244.

Each fate of the fourth review that it found holding in part is one of its findings below.

1. The line editor kept a terminal's reason, a generic word, a comparison of two repaints and a column whose reset its comment told wrong. Answered by 95a4474e: Enter submits, the recall of the history and the last repaint are named, and the column is reset by an edit, a move along the line and a walk of the history.
2. Comments of two sentences or of none in the state, the walks, the binding and the channel. Answered by 95a4474e.
3. The page of `:vec/map` said an error element passes every code by, which a code that recovers does not. Answered by 95a4474e: the page says the steps that ride `|` pass it by, and a law holds a code that recovers it.
4. The page of the budget and D202 left out the frame of the code a verb runs and said a part read from its place runs. Answered by 95a4474e for the page and a case of the code `map` runs, and by dfc9aced for D202.
5. The ledger of the outside audits said a call waits on a promise alone. Answered by dfc9aced.
6. The audit's alternative of marked scopes named the answers loosely and its patch with no probe. Answered by dfc9aced: `tutorial` answers the page of `::vec`, the shadowing stays refused, and a shell probe holds that the patch applies.
7. The line editor's two readings lost their reasons with no record. Answered by 95a4474e: D204 records them, and a test holds a paste over chunks, which fails with the window of the gathering off.
8. `isThenable` stood far from its first reader. Answered by 95a4474e: it stands under `applyMember`.

## 2026-10-11 · the gathering of a paste

[2026-10-11-the-gathering-of-a-paste.md](2026-10-11-the-gathering-of-a-paste.md), at 8f36d29e, over 95f12244..8f36d29e.

The fates of the fifth review it found holding in part stand in its findings below.

1. D204 and the comments of the gathering stated it wider than the code, and a key spelled by an escape joined a gathering paste as text. Answered by 7e292e7b: a chunk that begins with an escape ends the gathering and is read as the key it is, an escape pending alone before a paste is the Escape key, which does nothing, the comments say what the code does, and four tests hold a chunk of one character, an arrow, Alt+Enter and a paste after the Escape key; and by 9f476293 for D204. The paste the review found read key by key after the Escape key gathers, and a test holds it.
2. D204's Source and Set aside told the bracketed paste, the dropped spelling of Alt+Enter and the key map untruly and cited no commit. Answered by 9f476293.
3. The law of a failed element under code of one value said it passes every step. Answered by 7e292e7b: every step that rides `|`.
4. Two cases of D202 said a part and a scalar modifier run a frame below. Answered by 7e292e7b: they meet the budget a frame below.
5. The fates of the fifth review counted the fates of the fourth holding in part, wrongly. Answered by 9f476293: they name them by their findings, with no count.
6. The state's comments named the depth a frame and kept a fragment. Answered by 7e292e7b.
7. The line editor's tests kept comments of several sentences, reasons among them. Answered by 7e292e7b: each says in one sentence what its case holds, one is deleted where its case's name says it, and the inline comments that defined by negation say what holds.

## 2026-10-11 · the escapes around a paste

[2026-10-11-escapes-around-a-paste.md](2026-10-11-escapes-around-a-paste.md), at a22bfa72, over 8f36d29e..a22bfa72.

The fates of the sixth review it found holding in part stand in its findings below.

1. The clause that keeps an escape split before `[` one key was held by no test. Answered by d0e9e21c: two tests hold a split arrow and a split begin marker, and fail with the clause taken out; and by 70738672 for D204's Requirements.
2. A chunk that begins with an escape and holds a line feed started a gathering of its own, its escape landing as text, and a bracketed paste whose begin marker shared its first chunk with its body was cut by a pause. Answered by d0e9e21c: a chunk that begins with an escape is keys and starts no gathering, and two tests hold both cases, failing on the editor of ef973523; and by 70738672 for D204, under which a bracketed paste is read up to its end marker.
3. D204 and the name of a test said a line break handed over alone submits. Answered by d0e9e21c and 70738672: Enter, a carriage return handed over alone, submits.
4. The comment of the gathering said each chunk of a paste joins it. Answered by d0e9e21c: each chunk of text joins it, and keys end it.
5. The fates of the sixth review said each fate of the fifth it found holding in part is one finding, and named a fate by its alternative. Answered by 70738672.
6. Three commit messages told loosely what they did. The messages stand, since a commit is never amended, and the fates say what each did.

## 2026-10-11 · the Escape key before keys

[2026-10-11-the-escape-key-before-keys.md](2026-10-11-the-escape-key-before-keys.md), at 926f2476, over a22bfa72..926f2476.

The fates of the seventh review it found holding in part stand in its findings below.

1. d0e9e21c read a chunk that begins with an escape as keys in the rule of the Escape key, so the Escape key before a key spelled by an escape or before a bracketed paste paired with its escape and typed the rest. Answered by b38aa741: the rule reads a chunk of several characters, and two tests hold a key spelled by an escape and a bracketed paste after the Escape key; and by 606ffc1d for D204.
2. D204 said a bracketed paste is read up to its end marker whatever chunks carry it, and that a paste keeps its line breaks. Answered by 606ffc1d: a bracketed paste whose begin marker opens a chunk, and its line breaks kept as line feeds, the trailing ones dropped.
3. No test held the clause under which text whose one line feed ends it is read key by key. Answered by b38aa741.
4. An escape before a character beyond the basic plane stayed pending and swallowed the keys after it, and a key typed alone was counted in code units. Answered by b38aa741: an escape before any character but `[` is dropped, and a key typed alone is counted by characters, so the editor reads a character beyond the basic plane as it reads a letter over every delivery of up to three chunks, and two tests hold both; and by 606ffc1d for D204. The records keep "one character", which the code meets, where the review proposed "one code unit".
5. The audit's third alternative on the path of an error named no cost. Answered by 606ffc1d: the line of the fifth milestone on `:trail`.

The differential run of the repair found a gathered paste that held two end markers landing the second as text; b38aa741 takes every marker out, and a test holds it.

## 2026-10-11 · an escape after an escape

[2026-10-11-an-escape-after-an-escape.md](2026-10-11-an-escape-after-an-escape.md), at ac91c086, over 926f2476..ac91c086.

The fates of the eighth review it found holding in part stand in its findings below.

1. No test held every begin marker taken out of a gathered paste. Answered by e194acda: a test fails on a copy that takes it out once.
2. No test held a character beyond the basic plane typed alone ending a gathering. Answered by e194acda: a test fails on a copy that counts a key typed alone in code units.
3. An escape and a second escape in one chunk were dropped together and the rest of the key typed, so Alt with an arrow typed its tail and an escape before a bracketed paste cut it. Answered by e194acda: an escape that arrives while one is pending opens its own sequence, and two tests hold Alt with an arrow and the paste; and by 7e61353e for D204. Under it the rule of the Escape key reads `!typedAlone` and `!keys` alike, so the cut that swaps them leaves the mutations.
4. A fate said the editor reads an emoji as a letter, which an emoji of several code points is not. Answered by 7e61353e: a character beyond the basic plane.
5. The comment at the head of the line editor named a chunk longer than one character as a paste. Answered by e194acda: text whose first line feed is not its last character.

The gatherings with a second marker, which the review found left out of a summary, stand in the last paragraph of the eighth review's fates.

## 2026-10-11 · the mean at the ends

[2026-10-11-the-mean-at-the-ends.md](2026-10-11-the-mean-at-the-ends.md), at 7ae8d5c6, over e129cd54..7ae8d5c6.

1. The step of the mean rounded three times, so `avg` answered other last digits on ordinary numbers. Answered by 62d138f6: the step divides the gap where the gap stays finite and divides first where it does not, answering the digits of e129cd54 wherever its mean was finite, and `:vec/avg/answersTheSumOverTheCount` fails on the step of 7ae8d5c6.
2. The comment of the mean defined it by two values it never forms, one of them false. Answered by 62d138f6: every step stays among the finite doubles.
3. The laws of the ends settled a question no page asked, named `1e308` an end, and left the set and the map without one. Answered by 62d138f6: each page of `avg` says the mean of finite numbers stays among the doubles, the laws name numbers near the opposite ends, and `:set/avg` and `:map/avg` hold them too.
4. 7ae8d5c6 told a count of mutants no script in the tree prints. The message stands, since a commit is never amended; the scripts of the fuzz stay in the session's scratch folder, and the messages after it tell no count of them.
5. The constructor step of an answer stood twice. Answered by 62d138f6: one statement names the label.

Outside the commit, `::number!{:a 1} !| /` lays a kind's tag over the opened facts of an error without its constructor, and the command line exits printing it; it stands unrepaired, a question of which tags an error literal may carry.

## 2026-10-11 · the digits of the running mean

[2026-10-11-the-digits-of-the-running-mean.md](2026-10-11-the-digits-of-the-running-mean.md), at 5269315e, over 7ae8d5c6..5269315e.

The fate of the tenth review it found true to the tree but untrue of the mean stands in its findings below.

1. A law said the mean of numbers whose sum stays among the doubles is their sum over their count, which the running mean is not, `[0 1 6 1] | avg` answering `1.9999999999999998`. The law is named for its instance, `:vec/avg/averagesZeroOneAndFour`, and the page of `:vec/avg` says the last digit is the running mean's, with `:vec/avg/keepsTheLastDigitOfTheRunningMean`.
2. The laws of the ends spoke of any two numbers near the opposite ends, and the pages of the doubles where the language says the finite doubles. The laws speak of a number and its negation, and the pages of the finite doubles.
3. No law held the divisor of the step past the ends. `:vec/avg/dividesPastTheEndsByTheCount` holds `[1e308 1e308 1e308 -1e308] | avg` answering `5e307`.
4. The opened error under a kind's tag stood in a fate alone. The audit's chapter of open questions asks it, with its probe, its alternatives and their cost.

The catalog answers by ef006452, and the audit and this ledger by the commit that keeps the review.

## 2026-10-12 · the catalog of the command line and the records merged by axis

[2026-10-12-the-cli-catalog-and-the-records-merged-by-axis.md](2026-10-12-the-cli-catalog-and-the-records-merged-by-axis.md), at ef5acaaa, over master..ef5acaaa.

1. A body of one group was refused as a step of the body's pipeline. Answered by 9554c9d4: the parent is read only of a body that is a pipeline, and the case `a-body-of-one-group-declares-a-part-in-the-group-s-scope` holds it.
2. The test of the command line's catalog spelt the core's checks again. Answered by d2d38158: the checks stand in one module, `core/test/helpers/catalog-pages.mjs`, and the streams that do nothing in one helper of the command line's tests.
3. The merge script spelt the citation in words again, its example was written anew by the script itself, and an object stood for a pattern. Answered by 70f2458c: the walk exports the pattern, the comment names no record, and a predicate names the documents.
4. D200 said the lexical extension stays unmet, which the tree contradicts. Answered by 70f2458c: the sentence left.
5. The REPL wrote a failed cell on standard error while D7 has every failure an answer on stdout. Answered by f20a1d22: the REPL prints it on stdout, and D7 says so for both modes.
6. The decider lines of the merged records held a choice of the maintainer beside the model's mechanics. Answered by c12dd033, under which such a line names the model's parts, and by 9554c9d4 for D71's line.
7. D71 set aside a scope kept on the state while the change keeps a mark on the body's scope. Answered by 9554c9d4: D71 tells the mark and why a fork resets nothing of it.
8. Words of time and a bare name of a known type. Answered by d2d38158 for the test's comments, 48323e7a for D46, 70f2458c for D13 and 9554c9d4 for `bindStep`; the message of 598511eb stands, since a commit is never amended.
9. The merges dropped claims the code cites the survivors for. Answered by 48323e7a for D46's invariants of the parts and the dispatch a primitive keeps none of, and by 70f2458c for D13's step of a tag on a failure's trail.
10. Counts written in words in the sources of the merged records. Answered by f20a1d22, 48323e7a and 70f2458c.
11. Pruned lines named records merged into their survivor. Answered by f20a1d22 for D7, 48323e7a for D46 and 70f2458c for D13 and D200; D34's line was written anew by 69b2a3ec.
12. A link's definition was read by a pattern that took a line of prose. Answered by 70f2458c: one pattern anchored on the file it links, and D138's line reflowed.
13. D237 kept the fate of a record as history and not its source. Answered by 70f2458c.
14. The order of the evaluator's names and of the laws of a refusal. Answered by 9554c9d4 for the check beside the declaration, the name of the args before its use and spelt once, and by 70f2458c for the laws.
15. A sentence cited one record more than once. Answered by 9554c9d4 and 70f2458c, the other such sentences of the tree found by a search and written so.
16. The help's test held the old text gone, and the refusal of a pipe after a combinator dropped the catch. Answered by 70f2458c for the test and by 48323e7a for the refusal, which names `a !| b`.

## 2026-10-13 · the open questions walked

[2026-10-13-the-open-questions-walked.md](2026-10-13-the-open-questions-walked.md), at 5ddc5d45, over master..5ddc5d45.

1. The names near an unknown name read the links of a page by a walk of their own beside `holdsRole`. Answered: `doc.mjs` exports the reader of the links of a page, which `doc/links` and the names near an unknown name both call.
2. `toMap` and `toVec` stand beside the constructors of `::map` and `::vec`, which still convert, D138 unpruned and the first page teaching `tag ::map`. Answered: the constructors of `::map` and `::vec` read their own kind alone, `toMap` refuses under `::vec/toMap/…`, the first page and the pages of `::map` write `entries | toMap`, and D244 prunes D138.
3. The refusal of a pattern quotes the engine's literal, and its hint reads V8's words. Answered: the refusal keeps the engine's reason without its literal and reads the repair of a habit from the source, and the case asks the tag and that no literal of the engine stands in `:message`.
4. `replace` of the empty text by a string splits a character of two code units. Answered: a text is looked for by code points on both paths, held by the law `:string/replace/cutsNoCharacterInHalves` and a case.
5. A pattern written by JSON and read back by `toRegex` is another pattern, in silence. Answered: `toRegex` refuses a text that writes the literal of a pattern whole, `::string/toRegex/LiteralNotSourceError`, naming `parse | apply /`, and the law `:regex/readsBackFromJson` reads the literal JSON wrote.
6. The literal reads groups of flags and group names written twice, which D246 sets aside. Answered: the literal refuses a group of flags and a group name written twice on every host, and D246 names the dialect of 2018.
7. The refusals of `toString` on a container and `toVec` on a map name no word that does the act. Answered by D247: the refusal leads by `:nearest` to the words the pages of the word link that the subject answers in a kind the word answers.
8. The law of `parseJson` reading a number runs `toNumber`. Answered: the law runs `parseJson`.
9. Two laws are named for words that left. Answered: `:any/sumOf/readsTextByToNumber` and `:keyword/gt/comparesTextTurnedIntoAKeyword`.
10. The page of `replace` puts the matches where the replacement goes. Answered: the page puts the replacement in the place of every match.
11. The pages of strings teach `print` where D244 has `toString`. Answered: the pages of strings, of docs and of `join` name `toString` for a scalar and `print` for the literal of any value, and their laws follow.
12. The pages of the parts that take a pattern speak of text alone. Answered: the parts take a text or a pattern.
13. The page of `::string` leads to no word that reads text by a pattern. Answered: the page of `::string` names the words that read text by a pattern and links `::regex`, with its law.
14. `toRegex` makes no flags. Answered: `toRegex` takes its flags as a part, `"error" | toRegex "i"`, held by the check of a literal's flags.
15. Three sentences have only a combinator join two steps, which a declaration does by whitespace. Answered: the audit, the grammar and D243 join steps by a combinator and a declaration by whitespace as well.
16. The editor's hand-written grammar gains the pattern. Set aside: without the rule the string rule of the editor's grammar paints the `\d` of a pattern as an escape a string refuses; the rule leaves with the scar, once the editor's grammar is made from the parser's tokens.
17. The core grows by the pattern and the conversions, and the branch names no deletion. Set aside: the growth buys the pattern and the conversions, the branch having deleted `keyword`, the constructors that converted and the twin rules of a line, and no deletion follows from either.

The tree answers by the commit that keeps this review.

## 2026-10-13 · the path is a value

[2026-10-13-the-path-is-a-value.md](2026-10-13-the-path-is-a-value.md), at 59774765, over master..59774765.

1. Quotes were built by printing text and parsing it again, and `fill` read a doc it was given as a second page of the declaration. Answered: `fill`, the `:read` of a refused path and the reads of an elision assemble their quotes from steps, `commandStep`, `groupStep` and `declarationStep` in `core/src/quote.mjs`, the step of a value the literal it prints as; a doc goes into the head of the code in parentheses, held by the law `:fn/fill/writesADocAsTheValue`.
2. Names, tags and addresses were spelled twice in the core. Answered: the name of the answer, the kinds `any` and `tagged`, the tags of an invariant and of a law and the words of the literals are spelled once and imported; a missed place is read by the addresses of the classes of its refusals; a place of a path prints through `segmentIndex`; one `layerOf` lays the nodes of a kind and of a function. The refusal of another noun's tag by a builder, one tag raised at two sites, is the open record D275.
3. The objects of each command were spelled outside the catalog, the table refusing a vector of two kinds the word takes. Set aside: the open record D272 asks it, and the route names its table among the deletions of the next branch.
4. The tools read the role of a declaration from the form of its source. Set aside: the open record D273, named by the route.
5. Pages stated what the tree does not do. Answered: the page of `is` says it answers and holds nothing, an input held to its kinds by its `takes`; the page of the verbs and D253 say a recipe written alone takes no object, held by the law `:qlang/verbs/takesNoObjectForARecipeWrittenAlone`; the page of the pipeline and the grammar's header tell where a line break ends a declaration, held by the law `:qlang/pipeline/runsADefinitionBegunOnTheNextLineOn`; the laws read `get /price |` and `get /qty |`.
6. `::span` and `::point` took or misnamed a payload of another shape. Answered: each kind `wraps` a vector of numbers and holds its count and the wholeness of its numbers, so text, a number and a map are refused as no vector and an element that is no number by its index, held by their laws and by cases of D249, whose record names the refusals; the case of D250 writes a fraction into a span.
7. A place was read by the form of its code, `~(query /n d)` and `~(it)`. Set aside: the open record D274, named by the route.
8. The audit named two baselines. Answered by its fourteenth version, which names one.
9. The core grew and nothing named what the next branch deletes, and commit messages carried counts. Answered: the route names the deletions the model opens, D272 to D275 and the editor's grammar written by hand; the messages stand, since a commit is never amended.
10. `targets.jsonl` held met cases under a name for what they were, case names kept the parts, and two unit tests repeated laws. Answered: the cases joined their topic files and the file left, D13 and D206 naming the files; the names say input and recipe; the two tests left, the recipe written alone joining `:fn/answersTheFailureOfAnObject` and the args whole the law `:fn/takes/refusesAStepWrittenForAQuoteOfTheArgsByItsPlace`.
11. Comments narrated mechanisms, one of them false since D249. Answered: the rules of the grammar for a declaration that opens and a quote of a doc, the continuations and the excerpt of a parse failure and the comments of equality say what holds in one sentence, the false one gone. The counters stay, since the parser's generator gives a rule no parameter.
12. Words of another paradigm and of time. Answered: a tool shows the `inputs` of a word; the code, the pages and a law say input and recipe where they said part and body; the records say what holds where they said now and no longer. The two words for what a command takes, modifier and object, are the open record D276.
13. The value under a kind stood before what it rests on. Answered: the evaluator holds a value to its kinds, reads the places of the args and opens the scope of a call before the call of a function and the value under a kind.
14. The tools of the records kept open records in force and spelled their fields thrice. Answered: an open record is held by the tests of no domain, the runner of probes reads it by `isOpenText`, the fields stand once in `scripts/decision-records.mjs`, and the message names `Decided by.` and `Decision.`.
15. The round trip of the print built no function and no kind. Answered: the property test builds both by their chains, pages over several lines, inputs, fields, invariants, refusals, facts and laws among them.
16. The consumers spelled the language again. Answered: the hover of a path reads `::path | doc`, and the editor's grammar reads a name in any script, `:данные` among them; the grammar written by hand stays the scar the route names.

The tree answers by the commits that keep this review.
