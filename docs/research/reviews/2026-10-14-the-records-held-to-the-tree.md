## qlang review — the-records-held-to-the-tree, master..0739dfe4

**Verdict**: REQUEST CHANGES

**Gates**: `npm run ci` was not run, as you asked, so no exit code is reported. What I ran instead:
- `runLaws` on every page the diff touches: `::vec/join`, `::builtin`, `::fn`, `::fn/on`, `::fn/takes`, `::fn/impl`, `::kind`, `::kind/wraps`, `::keyword`, `::point`, `::span`, `::path`, `::any`, `::any/type`, `::any/apply`, `::any/query`, `::any/put`, `::map/filter`, `::doc`, `::call`, `::qlang` and `::any/doc`. No law fails.
- `node scripts/measure.mjs --steps master HEAD` (core sources | catalog | documents | tests | tooling): +131 −136 | +52 −47 | +3432 −2188 | +442 −437 | +61 −53.
- The records in force go from 194 records and 9671 lines on master to 156 records and 9487 lines at HEAD. The 39 records moved to `replaced/` held 1376 lines on master.
- The probes of the sampled records (D4, D5, D72, D132, D144, D153, D164, D185, D275, D281) hold, except where a finding below says otherwise.
- Not run: `check:conventions`, `check:probes`, `check-quotes.mjs` and the baseline's `gate-diff.mjs`.

**What holds.**
- The core shrinks by five lines while it gains three behaviours: D275's refusal by rule, the names near a missing member, and the refusal of an argument after the query.
- The hand refusals leave `fn.mjs` and `kind.mjs` (sixteen constants).
- `process.stdout` leaves `repl.mjs`.
- The JSON refusal moves to `::builtin`, and `:UnknownAddressError/nearest` stops repeating the `:nearest` of `::error`.
- The records in force shrink by 38 records.

### Findings (11)

1. **One fact, one spelling** — blocker
   core/src/nearest-names.mjs:115-121, `nearestMembers`, rebuilds by hand two facts the tree already holds:
   - For a tag, it filters `nodeAddresses` down to the last names one level under the tag. That is `namesDeclaredUnder(env, address)` (core/src/runtime/nouns.mjs:510-512).
   - For any other value, it offers the names a step reaches. That is a second guess at the reach of `memberRecordOf` (core/src/runtime/axis.mjs:91-94), and the two disagree both ways:
     - `1 | doc :and !| get /nearest` answers `[:add :any :end]`, yet `1 | doc :any` and `1 | doc :end` are each refused with `::any/doc/UnknownNameError`.
     - `::vec | doc :manifst !| get /nearest` answers `[]`, yet `::vec | doc :manifest` opens a page, because `memberRecordOf` falls through to `residenceOnSubject`.
   - The comment at nearest-names.mjs:111-114 says this outright: "the names a step reaches, the words its walk may find among them".
   Repair: draw the candidates from the reach the axis itself reads, so a name `:nearest` offers is one `memberRecordOf` answers. The tag case reads `namesDeclaredUnder` plus the words `residenceOnSubject` reaches for the tag; any other value reads the words its walk reaches. Delete the hand filter. Add cases to 33-a-miss-leads-to-the-names-near.jsonl for `1 | doc :and` and `::vec | doc :manifst`.

2. **The language describes itself** — major
   Every member refusal of the axes now carries `:nearest` (axis.mjs:98-105): `doc`, `binding`, `source`, `laws` and `runLaws` through `recordReadBy`. Yet neither the page of `::any/doc/UnknownNameError` nor its laws changed.
   - `::any/doc/UnknownNameError | doc | content` does not name `:nearest`.
   - `::any/doc/UnknownNameError | laws` holds `refusesANameNothingDeclares`, `namesWhereTheWordLives`, `namesWhereAnotherWordLives` and `refusesAnAnchorNoMemberAnswers`, and none is about the names near.
   - The behaviour is held only by the D118 cases.
   Repair: the page of each member refusal (core/lib/qlang/any.qlang near :1064, and the refusal pages of `binding` and `source`) says that `:nearest` names the members near the missed name. Add a law `:UnknownNameError/namesTheMembersNear`, `~(::qlang | doc :pipelin !| get /nearest | eq [:pipeline])`, under `::any/doc`.

3. **One fact, one spelling; one model** — major
   core/src/eval.mjs:847 is D275's rule: a tag name serves a word of the noun it names and no other noun. That rule is a fact of the walk of a tag name, which `kindsOfWalk` already spells (core/src/runtime/nouns.mjs:215-221, which yields `value.name` after `::tag` [D88]). `subjectOfCall` walks a second way, through `walkToKinds` (core/src/runtime/verb.mjs:45-54), which never passes the named noun, and then filters its result: `isTag(byKinds.served) && byKinds.served.name !== labelName ? null : byKinds`.
   - D275.md:8-9 and the comment at eval.mjs:837-838 both state the rule as the walk ("the walk of a tag name passes the noun it names and no other"). The code holds it as a filter applied after the walk.
   Repair: `subjectOfCall` and `residenceOnSubject` read one walk, in which a tag name reaches the label it names. Line 847 then goes, and D275's cases (23-a-word-is-found-through-its-subject.jsonl, D275) stay green.

4. **Words carry paradigms; the sign of the diff** — major
   cli/src/repl.mjs:55, `width = stdinStream`, names a stream `width`. The REPL reads `width.columns` (:79).
   - The only caller that passes the input is main.mjs:84-88, which hands `stdoutStream`.
   - The default `stdinStream` serves the eight calls in cli/test/repl.test.mjs:37-86. That is a fallback kept for a caller.
   Repair: name the input `terminal`, the stream whose columns the line editor reads, and drop the default. repl.test.mjs passes its harness stream.

5. **Words carry paradigms: definition by negation** — major
   - cli/src/argv.mjs:66-67: "is refused rather than left unread".
   - docs/decisions/D176.md:19-20, a sentence this branch wrote: "rather than answered as a pair of two errors".
   Repair:
   - argv.mjs: "An argument after the query is read by nothing and is refused, a flag written there, `--budget=10`, among them [D120]."
   - D176: "`::any/doc/UnknownNameError`, the refusal `doc` answers." The answer that is a pair stands in its own sentence.

6. **One fact, one spelling: the letters of a name** — major
   The branch edited vscode/language-configuration.json:2 (`wordPattern`) and :26 (`folding.markers.start`) and left them in ASCII, `[_a-zA-Z][a-zA-Z0-9_-]*`. Elsewhere the same letters are spelled for any script:
   - core/src/name-chars.mjs:7-8 reads `\p{ID_Start}` and `\p{ID_Continue}`.
   - vscode/syntaxes/qlang.tmLanguage.json, in the same extension, uses `[_\p{L}][\p{L}\p{N}_/-]*`.
   - The page this branch rewrote, core/lib/qlang/keyword.qlang:13, says "a letter of any script".
   `:имя 5 | имя` answers `5`, yet the editor breaks the word at `и`.
   Repair: `[_\\p{L}][\\p{L}\\p{N}_-]*` in both places, matching the tmLanguage. The editor's JSON cannot import name-chars.mjs, so the two editor files hold one spelling between them.

7. **The language describes itself: a law for each statement** — major
   - core/lib/qlang/kind.qlang:29-31 adds two statements with no law among `::kind | laws | keys`: `manifest` lists everything under a kind except its laws, which `laws` reads; and a label declared by its page alone lays its tag. Both hold: `::path | laws | count` answers `6` while `manifest` lists no law, and `:shop |~~ A shop. ~~| | ::shop{:a 1} | type` answers `::shop`.
   - core/lib/qlang/vec.qlang:1597-1600 keeps "any value written as its literal by `print`", but the branch rewrote its law `:joinsValuesMadeText` (:1645) to `toString`, so no law holds `print` any more. Line 1600 also runs past the width of its paragraph.
   Repair:
   - `::kind` gets `:listsItsNamesButItsLaws`, `~(::path | manifest | map ~(laws) | ...)`, or a simpler `~(::path | laws | count | gt 0)` beside a manifest that holds no law. It also gets `:laysTheTagOfALabelOfItsPageAlone`, `~(:shop |~~ A shop. ~~| | ::shop{:a 1} | type | eq ::shop)`.
   - `::vec/join` gets `:joinsValuesWrittenAsLiterals`, `~([1 :a] | map ~(print) | join "+" | eq "1+:a")`.
   - Rewrap line 1600.

8. **The maintainer's words bind** — major
   docs/decisions/D153.md has no `Decided by.` line. It absorbed D191, whose record carries "Decided by. The maintainer, between the two readings the model laid out" (docs/decisions/replaced/D191.md:4). The maintainer's choice and the model's parts are now stated only in Source prose (D153.md:102-108). check-conventions.mjs:383 exempts records numbered below D155, so the merge dropped the decider line without the check noticing.
   Repair: D153 gets `Decided by.`, naming the maintainer for the kinds taken out of the bare names («я тоже за путь 2») and the model for the reach order, the address refusal, `env` and the nearest of a kind's name. The merge script carries a merged record's decider line into a survivor that has none.

9. **Prose names the invariant: records that narrate** — minor
   Sentences this branch wrote into Decision lines tell an event or a count:
   - D4.md:23, "and `eval` leaves".
   - D4.md:43-44, "The arity dispatch of predicates and the second calling convention go".
   - D72.md:35-38, "The dispatch wrappers `valueOp`, `nullaryOp`, `overloadedOp` and `stateOp` left with the words of the hosts…".
   - D72.md:28, "among the five of `toString`", a count that `grep -n "toString'" core/src/runtime/string.mjs` answers.
   - D185.md:40-41, "The page prints about three quarters of the characters of the page it replaces", with no probe.
   Repair: each Decision line states what holds ("`eval` is no word of the language"). The history moves to Source or Set aside, and the count and the measure go.

10. **Words carry paradigms: an earlier paradigm in the records the walk held** — minor
    D280 names "a slot, a head, an operand" as words the language left, yet Decision lines still carry them:
    - D153.md:14, "its page in the slot after it".
    - D168.md:14, "the doc in the slot of a declaration".
    - D5.md:15, "the docs of its slot".
    - D88.md:10-11, "the name `subject` under it naming `::tag` [D179]". That is a role declared by name under a word, which D253 refuses; the word's chain names it by `on ::tag`.
    Repair: "its page after it", "the page of a declaration", "its page", and "whose chain names `::tag` by `on`".

11. **The tests follow what they test: the cases the walk rebound** — minor
    - core/test/conformance/08-a-path-is-a-value.jsonl:45-46, `query-json-object-string-key` and `query-json-object-keyword-key`, run the same query, `::json{:a 1 :b 2 :c 3} | query /b`, and both moved to D13. Lines 39-40 (`query-map-keyword-key` and `query-map-string-key`) do the same over `{:a 1 :b 2 :c 3}`.
    - 28 pairs of cases with one query stand on the tree, as on master. Among them are `D16:first-of-an-empty-set-is-null` / `D16:first-set-empty` and `D14:not-false` / `D14:not-negates-a-boolean`.
    - The Cyrillic, Greek and CJK path cases (02-json-is-syntax.jsonl:39 onward, `unicode-cyrillic-bare-key` and the rest) moved to D1, which states no rule on the letters of a name. name-chars.mjs cites D2 for them.
    Repair:
    - The string-key cases read the key by a string, `query "b"` [D139].
    - Delete the second case of each identical pair.
    - Bind the path segments of any script to the record of the letters of a name.

The session holds these findings against the tree and gives each its fate.
