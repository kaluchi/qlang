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
4. The pages of the three kinds say a word answers under the subject's tags, which `map` does not. Open.
5. `vec/sort` says a map sorts by its keys; it sorts by its values. Answered by edac4969.
6. `map/at` says null answers null; it answers the default, and the pages do not lead to `::null/at`. Answered by edac4969, the law repeating `null/at` gone; `vec/at` still leads nowhere, open.
7. `union`, `minus` and `inter` over a container of values that are neither sets nor maps refuse with a page that does not fit. Open, a change of the language's answers.
8. The part `with` of the algebra of vectors names a value nothing is joined with. Open, with 7.
9. The algebra says join, the name of the word that writes strings together. Open.
10. Refusal pages that do not say how to repair the call. Answered by cf359631: every refusal page of the three kinds shows the call that works.
11. Generic words where the language has its own: listing, container, bucket, pipeline. Answered by 610b05d4 for bucket and the laws named after a pipeline and by f3ebc9f4 for the listing; listing and container had left the vectors with their rewrite.
12. Law names that do not say what their queries prove. Open.
13. Laws that prove one claim twice. Answered by 0a6cdfd0; the pair of `reduce` stays, each law the claim of its own page, the word's and the repair its refusal gives.
14. One fact told in different words across the three kinds. Open.
15. A refusal with a page under one kind and none under the others. Open.
16. Claims of the pages with no law. Open.
17. `minus` and `inter` over a vector take sets too, which their pages do not say. Open.
18. The fold of a set of sets keeps the tag, the others do not. Open, with 7.
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
9. Refusal pages with no law under their address. Answered by cf359631 for numbers and strings, any value and the small kinds following; the refusals of `builtin` and `call/HostFailureError` are defects of a host, raised past the fail track, which no law can raise.
10. Refusal pages that do not say how to repair the call. Answered by cf359631 for numbers and strings, any value following.
11. Pages that do not say what a call with no value or with more values does. Open.
12. Claims with no law under their name. Open.
13. `runLaws` does not say what `:error` holds, and `:actual` is wrong for a law that answered an error. Open.
14. `:any/apply/runsADistribute` and laws named after `*`. Answered by 1389eb66.
15. Laws that prove nothing of their page. Open.
16. Negations standing for definitions. Answered by f3ebc9f4: the law of `::error` defined by what a refusal is not leaves, the chapter of errors proving the site, and the page of a number past the doubles says what it is; the address that held no one entity had left with an earlier rewrite.
17. Words of mutation: edits, has become, is replaced. Answered by edac4969 for has become and by 610b05d4 for edits and is replaced.
18. A guardian with no payload, a word the language does not have. Answered by 610b05d4: a noun that stands for a thing outside the language.
19. The order of the kinds in `qlang.qlang` and of the words of `any.qlang`. Open.
20. Pages of kinds that lead nowhere, and kinds in no chapter. Open.
21. Strings say an emoji counts one; a modifier or a flag counts each code point. Answered by edac4969, with a law.
22. `lines` and `join "\n"` do not write back a closing break; commas between elements. Answered by edac4969, with a law on commas.
23. Law literals whose characters the page cannot tell apart. Open.
24. Generic words: schema, result, implicit argument, pages about tests. Answered by 610b05d4 for schema and by f3ebc9f4 for result, the pages of the suite and the parts of `sumOf`; implicit argument left with the page of D185 and the part named X with an earlier rewrite; the part `value` that number and string pages do not name, open.
25. `:any/JsonValueNotEncodableError` told inside `json`, which no query meets. Open.
26. Headers of the sources that repeat the order of a story. Answered by cf359631 for the laws named as refusals are; the headers, open.

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
10. Rule refusals with no page and no repair. Open.
11. Invariant refusal pages that say what must hold and not how to repair the call. Open.
12. The sister project still writes `*`. Awaits the maintainer's word.
13. Laws standing before the refusal they prove; `vec/table` with no page of its refusal. Open.
14. Claims with no law. Open.
15. Laws that repeat laws; the facts `printed` and `field` declared again under each step kind. Answered by 1827f51b for `printed` and `field` and by 0a6cdfd0 for the laws of `doc` and `tag`; the law under `proj` no longer repeats one of vectors; the two laws of `call` stay apart, the addresses of the core and of a reader being two claims.
16. Generic words: env, descriptor, rewrap, constructor invocation, edit, still. Answered by 610b05d4 for env, descriptor, rewrap, constructor invocation and edit, and by f3ebc9f4 for still and the two comments; the part `value` the pages of tags and keywords do not name, open.
17. The page of `::explanation` misses the case of a refusal with no page. Answered by edac4969, with a law.
18. D181 replaced D52 only in part, a claim without its source, no case naming D181 for `map`. Answered by 08f332a5.
19. A refusal of an unknown combinator the parser cannot produce; `fork.mjs` holding one function; broken comment lines. Answered by 4622ace2, the comment of the language server by 64908015.

The question of the language server's precision after `map`, whose
answer D182 declares `::any`: open.
