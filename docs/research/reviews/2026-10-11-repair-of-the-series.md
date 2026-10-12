## qlang review — modules-are-the-tree-of-names, cae66823~1..1327c652 (the repair of the review of 3c986534..832df32c, and two commits after it)

**Verdict**: REQUEST CHANGES

**Gates**: I did not run `npm run ci`, as you asked. I ran these instead, each exit code captured to a file:
- `npm run check:conventions`: 0
- `npm run check:probes`: 0
- `node scripts/sensors/check-quotes.mjs`: 0
- vitest over the five unit files the repair touched: 0 (149 tests)
- `runLaws` over every address the repair touched: no law fails. The addresses are `allOf` and `anyOf` with their three refusals each, `range` and its refusal, `groupBy`, `indexBy` and `reduce` with their refusals, `join` and its separator's refusal, and `::qlang`.
- `grep -rn "from 'node:" core/src/` and the Node imports of `lsp/src/features.mjs`: both empty.
- The stored report `docs/research/reviews/2026-10-11-autonomous-series.md` matches the reviewer's handback byte for byte (its transcript is `subagents/agent-a4249cadccd82edb2.jsonl` of session 22b934f8).

**Sign of the repair by area** (numstat cae66823~1..HEAD):

| Area | Added | Deleted |
|---|---|---|
| Core sources | +62 | −50 |
| Catalog | +183 | −50 |
| Core tests | +66 | −5 |
| Documents | +428 | −113 |
| Tooling | +4 | −1 |

**Scratchpad, which is shared with your session.** I did not edit the repository, but I changed some of your files in the scratchpad:
- `tree-3c986534`, `tree-832df32c` and `tree-b217cacf` already existed. I deleted them and exported them again with `git archive` (core and `package.json` only, CRLF line endings), then rebuilt their parsers.
- I wrote `scratchpad/probe-root.mjs`. If you had a file of that name, it is overwritten.
- Everything else of mine is under `scratchpad/review-repair/`. I removed the one directory junction I made there, and `D:\git\qlang\node_modules` is untouched.

### The sixteen findings and their fates

1. **Fixed in the code and tests; the fate overstates D200.**
   - The finding's probes answer `5` at HEAD: `:vec/width ~(99) | ::Foo{} | w`, and `::Foo{} | w` beside a later `:Bar/width ~(7)`. At b217cacf they answered `::vec/width/SubjectNotVecError` and `::Bar/width/SubjectNotBarError`.
   - Tests: `core/test/unit/nouns.test.mjs:40-52`. D44 is marked: `docs/decisions/D44.md:56-57`. Comments: `core/src/types.mjs:144-148,159-160`, `core/src/eval.mjs:534-536`.
   - The fate says more than the tree shows on two points. D200 names the audit's lexical extension but says it holds, and probes refute that (finding 3). D200 also states a label rule that no test holds (finding 1).

2. **Answered.**
   - `{:email "a@b.org"} | allOf true ~(/email) !| [type /index /actualType]` answers `[::any/allOf/ConditionNotBooleanError 1 ::string]`, and `!| explain` lands on its page (`any.qlang:1945-1950`).
   - `5 | anyOf ~(gt 10) ~("x") !| [type /index /actualType]` answers `[::any/anyOf/ConditionNotBooleanError 1 ::string]`.
   - D197 weighs the composition, but with a reason the tree does not show (finding 5).

3. **Answered.**
   - `formOf` (`types.mjs:350-355`) reads `typeKeyword` and the keys of `CORE_KIND`. The second walk is gone, and ledger item 6 (`docs/research/outside-audit/README.md:38`) says so.
   - Comparing the tag's name with the keys is safe, because no value under a tag named for a kind of the core can be minted: `::vec[1 2] | type` answers `::vec` and prints `[1 2]`, `::number(5)` answers `5`, and `::tag[1 2]` is refused.

4. **All three repair items are done.**
   - `core/src/runtime/arith.mjs:33` hands `longest`. `core/lib/qlang/number.qlang:465-473` declares it under the refusal and puts it on the page. The law at `number.qlang:496-498` passes.
   - The fate's last clause, "stays the host's", is a disposition that no record holds (finding 11).

5. **Answered in part.**
   - These say that a quote answers a condition: the word pages (`any.qlang:1907-1911,2005-2007`), the part pages (`any.qlang:1924,2021`), the first page (`core/lib/qlang.qlang:24`) and `D197.md:6-8`.
   - But the refusal pages that the same commit rewrote call a condition a quote (finding 4).

6. **Answered.**
   - `{:a 1} | allOf (/b | eq 1) !| explain` lands on a page that names `allOf (at :b | eq 1)`.
   - The laws at the first place and the laws of the soft read pass under both words.
   - `D197.md:16-22` says the refusal holds at every place.
   - The clause about the sister project is literally true but hides that the error changed:
     - at 3c986534 a marker without a start line meets `::proj/KeyNotInMapError`;
     - at HEAD it meets `::any/allOf/conditions/ElementNotBooleanOrQuoteError`;
     - `problemsInRangeOf` (`D:/git/eclipse-jdt-search/cli/lib/jdt/graph.qlang:695-696`) reads the field strictly on both trees.

7. **Answered.** Every law the finding named exists and passes, for example `any.qlang:2077`, `map.qlang:969`, `set.qlang:732,1184` and `vec.qlang:1882`.

8. **Answered.**
   - Pages: `vec.qlang:788-789,893-895`, `set.qlang:602,683-684`.
   - Laws: `vec.qlang:861,957`, `set.qlang:663,744`.
   - D201's Set aside: `D201.md:28-34`.

9. **Answered.**
   - `D199.md:18-35`. The grep agrees: `grep -o 'Program Files/Git/' scripts/benchmark/sets/T/runs/*~cli~*.json | wc -l` answers 29, and the `D187~cli~*` and `D194~cli~*` runs hold none.
   - New problems in the rewrite: the counts are written in words, and "which CLAUDE.md told" compares two states (findings 8 and 9).

10. **Answered for the audit and the ledger.**
    - `docs/qlang-audit.md:1732-1753` quotes the maintainer, and check-quotes reports `ok` at line 1734.
    - Every anchor exists: `nouns.mjs:223,261,398,490` and `nearest-names.mjs:70`.
    - D200's Source still keeps its figures, including the start "near 0.75" (finding 9).

11. **Answered for the grammar comment and the records; the fate overstates the commits.**
    - Fixed: `grammar.peggy:500-503`, `D198.md:16-17`, `D199.md:15`, `D201.md:16,36`.
    - Three commit messages of the repair still compare states (finding 8).

12. **Answered.** `D198.md:1,6-7`, `vec.qlang:1825,1829-1830`. The page of the law at `vec.qlang:1878-1879` still says "a map's entries" (finding 10).

13. **Answered in part.**
    - Fixed: the two test titles, `format.mjs:45` and `types.mjs:347-349`.
    - Not fixed:
      - `format.mjs:26-35` keeps `Map`, `Vec` and "interned keywords" in two sentences.
      - Titles that cae66823 itself edited are wrong (finding 7).

14. **Answered.** `print-value.mjs:49`.

15. **Answered.** `docs/research/outside-audit/README.md:20,33`.

16. **Answered in part.** cae66823 names its deletions, but no commit and no document reports the sign of the whole series by area. Here it is, by numstat over 3c986534..HEAD:

    | Area | Added | Deleted |
    |---|---|---|
    | Core sources | +129 | −84 |
    | Catalog | +359 | −120 |
    | Core tests | +114 | −49 |
    | Command line | +25 | −4 |
    | Command-line tests | +23 | −3 |
    | Documents | +600 | −11 |
    | CLAUDE.md, site, editor snippets | +16 | −16 |
    | Tooling | +4 | −1 |

### Findings (11)

1. **The tests follow what they test** — blocker
   - `D:/git/qlang/docs/decisions/D200.md:10-11` says "a label of the source is no bare name there". `D:/git/qlang/core/src/runtime/root.mjs:81` keeps labels out of the frame with `!isDoc(bindingValueOf(record))`.
   - No test holds this. In a copy of HEAD with that conjunct removed, the whole core suite passes: 48 files, 3182 tests. No word of the catalog, the command line or the sister project reads its own label bare.
   - The behaviour differs from the base of the series. With a source `:Foo |~~ A kind. ~~|`, `:Foo/w ~(Foo)`, the query `::Foo{} | w !| type` answers the page `|~~ A kind. ~~|` at 3c986534 and `::call/UnknownNameError` at HEAD.
   - D200's Requirements (`D200.md:40-43`) do not name it.

   Repair:
   - Add a test under `describe('the names of the scope')` in `core/test/unit/nouns.test.mjs`, naming D191 and D200: a source `:shop |~~ A shop. ~~|\n:shop/self ~(shop)`, where `::shop{} | self !| type` answers `::call/UnknownNameError`.
   - D200's Requirements name the label.

2. **One fact, one spelling** — blocker
   - `D:/git/qlang/core/src/runtime/root.mjs:81` writes `!isDoc(bindingValueOf(record))` itself. That is the fact `holdsAPage` already spells at `D:/git/qlang/core/src/runtime/nouns.mjs:217-218` ("Whether a declaration of the root is a label, its value a page"), and `isLabel` spells it again at `nouns.mjs:39-41`.
   - `root.mjs` already imports `isUnderLabel` from `nouns.mjs`.

   Repair:
   - `nouns.mjs` exports `holdsAPage`, and `isLabel` reads `holdsAPage(nodeOf(env, name))`.
   - `root.mjs:81` calls `holdsAPage(record)`, and `isDoc` leaves the imports of `root.mjs`.

3. **Sources, not confidence** — major
   `D:/git/qlang/docs/decisions/D200.md:35-39` says the audit's lexical extension "holds as at 3c986534". The audit lists it among what remains (`docs/qlang-audit.md:811-823`). A reader's word under a noun of the root reaches into a word of the root on every tree:
   ```
   > :vec/doc ~("a reader's page") | [1 2] | tutorial | first
   "a reader's page"      (3c986534, b217cacf and HEAD; [1 2] | tutorial | first | type answers ::doc)
   ```
   Three more sentences claim more than the tree shows:
   - `D200.md:12` and the ledger's item 12 (`docs/research/outside-audit/README.md:25`) say "copies no frame of its source". But `scopeOfMember` copies the frame a quote carries on every call (`eval.mjs:615`), and that frame holds the source's bare values. The sources of the language declare none (a fresh session's root holds 2368 names, none bare without a page). A host's source may declare some.
   - `D200.md:40-43` says "the tests of the names of the scope hold both". The second requirement, a reader's word running in the frame of its declaration, is held by the cases of D44 (`core/test/conformance/targets.jsonl:81-82`). No test in `nouns.test.mjs` holds it.
   - `D200.md:30` says "every reader of the environment"; the language says scope.

   Repair:
   - "The audit's lexical extension … stays unmet as at 3c986534: a reader's address reaches into a word of the root by the walk of its subject, `:vec/doc` inside `tutorial`."
   - "A call copies the frame of its source's bare values alone", in D200 and in the ledger.
   - The Requirements cite the cases of D44, and "scope" replaces "environment".

4. **Words carry paradigms** — major
   - fba5256f wrote "a condition that fails where an earlier one does not hold is a quote" at `D:/git/qlang/core/lib/qlang/any.qlang:1939-1941`, and "a condition that fails where an earlier one holds is a quote" at `any.qlang:2036-2038`.
   - The same commit fixed the term everywhere else: a condition is a boolean, and a quote answers one. See `any.qlang:1910-1911` ("is written as such a quote"), `core/lib/qlang.qlang:24` and `D197.md:6-8`.
   - So the refusal pages contradict the word pages above them.

   Repair: "… is written as a quote that answers it in its turn, which runs only once every condition before it held". For `anyOf`: "once no condition before it held".

5. **Composition multiplies** — major
   - `D:/git/qlang/docs/decisions/D197.md:42-45` sets the composition aside because it "is longer than the primitive, which the principle of composition admits as it shortens what exists".
   - The audit says the opposite: "What can be written as the composition of two existing constructs does not become a primitive" (`docs/qlang-audit.md:357-359`). Its "shortens what exists" is about what a reader writes. No composition is written anywhere to compare lengths against.
   - The reason the tree shows is different:
     - a refusal is declared at its site through `declareRefusal`, or raised by rule;
     - no word body in the catalog raises an error from a literal, and its error literals appear only in laws and pages (`grep -n '!{' core/lib/qlang/*.qlang`);
     - so a word's own refusal carrying `:index` needs a site in the host.
   - The primitive grows `control.mjs` by +24 −4.

   Repair: D197's Set aside states that reason, with the grep, and drops the length claim.

6. **The sign of the diff** — minor
   - `D:/git/qlang/core/test/unit/print-round-trip.test.mjs:1-4` makes the same claim as the 407-line `core/test/unit/round-trip-invariant.test.mjs:1-12`. 1327c652 says "the tree had none" without naming that file.
   - The generator's pools hold no error, while the older test covers errors (`round-trip-invariant.test.mjs:108`).
   - Errors do round-trip: `[!{:a 1}] | :v / | print | parse | apply / | eq v` answers `true`. The test's generator with `[!{…}]` and `[::E!{:k …}]` added, at depth 3 over seeds 1, 2, 3, 11, 42, 99 and 1234 (1050 values), finds no value that fails.
   - The repair grows core sources (+62 −50) and tests (+66 −5) and names no deletion that follows [D151].

   Repair:
   - The pools take the two error forms.
   - Delete the suites of `round-trip-invariant.test.mjs` that the generator now reaches, keeping `env output is parseable` and `toPlain refuses unencodable values`. Alternatively, the branch names that deletion as the next branch's work.

7. **Prose names the invariant** — minor
   Files cae66823 touched still hold these:
   - `D:/git/qlang/core/src/runtime/format.mjs:26-35`: two sentences, an empty `//` line, and `fromPlain` described as "object → Map keyed by interned keywords, array → Vec". In fact a map keys its entries by the plain name (`types.mjs:78-79`, `format.mjs:119`).
   - `format.mjs:86-92`: three sentences, one of them a justification ("so a piped document cannot seed the pipeline").
   - `D:/git/qlang/core/test/unit/runtime-edge-cases.test.mjs`:
     - line 63 is titled "formOf for a verb and a binding record", but no verb is tested;
     - line 64 says "the tagged Map it is";
     - line 69 says "for a map under a tag" over the vector `[42]` (line 71);
     - lines 75-78 say "TaggedInstance … Vec payload … Array data" and carry a three-sentence comment.
   - At cae66823 itself, `types.mjs:144-148` describes the frame of the source's bare values, while that commit's `runInTheRoot` still set the root alone. The comment only became true at d6733d8c.

   Repair:
   - `format.mjs:26-35` becomes one sentence: "`toPlain` writes a value in JSON's shape and `fromPlain` reads that shape back as maps, vectors and the scalars."
   - `format.mjs:86-92` becomes one sentence of what holds.
   - The titles name a binding record, a vector under a tag and `underTag`.

8. **Words carry paradigms** — minor
   - Commit messages compare states:
     - d6733d8c: "where its page wrote the number and the host's language";
     - fba5256f: "the composition the words had";
     - 1327c652: "the tree had none", and "since its port".
   - `D:/git/qlang/docs/decisions/D199.md:24` says "which CLAUDE.md told to write `MSYS_NO_PATHCONV=1`". CLAUDE.md held that line at 3c986534, and f07e2693 rewrote it.
   - `D197.md:25-26` says "where it said to guard it by a filter before it".

   Repair:
   - D199: "a session that queries the tree from Git Bash".
   - D197: "The first page says that a condition which may fail where an earlier one does not hold is written as such a quote [D185]."
   - The commits that follow say what holds.

9. **Executable over narrated** — minor
   - `D:/git/qlang/docs/decisions/D199.md:18-21` writes counts that a grep answers, spelled in words, which slips past the digit rule of `check:conventions`: "twenty-nine of the thirty-nine parse errors of its forty-five runs" and "the thirty-nine runs before [D187]".
   - `D:/git/qlang/docs/decisions/D200.md:19-23` writes measures with no command: 8.9 and 1.5 seconds, 2.3 and 1.0, a start "near 0.75", 46 and 38 seconds.
     - The measure is of `allOf`, which fba5256f made a primitive, so it no longer runs a word written in steps.
     - "Near 0.75" is the figure finding 10 took out of the audit.

   Repair:
   - D199's Source names the grep and says every path the shell wrote stands in a run before [D187].
   - D200's Source names the command that measured a word written in steps, such as `sumOf`, or drops the figures.

10. **The language describes itself** — minor
    - The pages of `::any/allOf/ConditionNotBooleanError` (`any.qlang:1945-1950`) and `::any/anyOf/ConditionNotBooleanError` (`any.qlang:2042-2047`) state a repair, `~(/email | ne null)` and `~(/score | gt 95)`. No law under their address holds it: `runLaws` on each runs only the law of the refusal.
    - The page of `:vec/join/writesAKeywordAsItsName` (`vec.qlang:1879`) says "The pairs of a map's entries join", while the page of `join` says "a map of strings".

    Repair:
    - Add `:any/allOf/ConditionNotBooleanError/holdsAQuoteThatCompares` as `::law~({:email "a@b.org"} | allOf true ~(/email | ne null))`, and its `anyOf` twin.
    - The law's page reads "The pairs of the entries of a map of strings join, each key written as its name."

11. **Sources, not confidence** — minor
    - `D:/git/qlang/docs/research/reviews/README.md:83` answers the third review's twelfth finding "at the maintainer's word" without his words, their time or their session. Its commits c04ba19 and 880b9fc exist only on the sister project's local branch `feature/status-guide-newcomer-flow`.
    - `README.md:102`, the fate of finding 4, says "a count below the bound that outgrows the host's memory stays the host's". No record holds that disposition. Meanwhile `number.qlang:466-467` still calls 4294967295 "the longest vector the host holds". By inference (not run): such a vector takes at least 16 GiB, and this host's heap limit is 4.19 GiB (`node -e "console.log(require('v8').getHeapStatistics().heap_size_limit/2**30)"`).

    Repair:
    - The ledger quotes the maintainer's word with its time and session.
    - The fate of finding 4 cites a record or says open.
