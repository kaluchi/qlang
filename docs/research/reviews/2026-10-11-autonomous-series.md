## qlang review: modules-are-the-tree-of-names, 3c986534..832df32c (fifteen commits)

**Verdict**: REQUEST CHANGES

**Gates**: I did not run `npm run ci`, as you asked. I ran these instead, each exit code captured to a file:
- `npm test -w @kaluchi/qlang-core`: 0 (3175 tests)
- `npm test -w @kaluchi/qlang-cli`: 0 (258 tests)
- `npm run check:conventions`: 0
- `npm run check:probes`: 0
- `node scripts/sensors/check-quotes.mjs`: 0
- eslint over the touched sources: 0
- Coverage, integration and the site build were not run.

Every "base answers" below comes from a run. I exported the base tree to a scratch directory and built its parser from its own grammar.

What holds:
- The prose runs added to `grammar.peggy` build the same trees as the base parser over all 35 sources: the catalog, the command line and the sister project.
- The laws under every page the series touched run green.
- `grep -rn "from 'node:" D:/git/qlang/core/src/` is empty, and so are the Node imports of `D:/git/qlang/lsp/src/features.mjs`.

Sign of the diff by area (numstat):

| Area | Added | Deleted |
|---|---|---|
| Core sources | +99 | −66 |
| Catalog | +219 | −113 |
| Core tests | +51 | −47 |
| Command line | +22 | −3 |
| Command-line tests | +23 | −3 |
| Documents | +280 | −6 |
| Editor and CLAUDE.md | +4 | −4 |

### Findings (16)

1. **The tests follow what they test** — blocker
   `D:/git/qlang/core/src/runtime/root.mjs:68,76-82` points every quote a source of the root declared at a frame that holds `ROOT_KEY` alone. A bare name inside such a word then reaches its own source's bare value only at the last step of `bareNameReach` (`D:/git/qlang/core/src/runtime/nouns.mjs:207-215`). Any word of that name on any kind reaches it first, the reader's among them, because `scopeOfMember` (`D:/git/qlang/core/src/eval.mjs:613-621`) carries the reader's addresses into the word's scope. Probe: a session over one host source `:Foo |~~ A kind. ~~|`, `:width 5`, `:Foo/w ~(width)`:
   ```
   > :vec/width ~(99) | ::Foo{} | w !| type
   base 3c986534: 5        HEAD: ::vec/width/SubjectNotVecError
   ```
   A later source that declares `:Bar/width ~(7)` makes `::Foo{} | w` answer `::Bar/width/SubjectNotBarError` at HEAD and `5` at the base. No test holds either case.
   - D200 says "a word sees every name it saw" (`D:/git/qlang/docs/decisions/D200.md:9`); these probes refute it.
   - It says the word sees "the names its source declared after it besides" (`D:/git/qlang/docs/decisions/D200.md:10`). The base already gave those through the call's root: a word reading a name its source declares after it answers `7` on both trees.
   - D200 replaces in part D44 ("A quote written as a binding's body carries the environment of its declaration"; D44's Set aside names the capture of a caller's name) without naming it.
   - It widens what the audit's target confines, "a reader's verb under a noun of the root, `:vec/second`, stands in its scope alone" (`D:/git/qlang/docs/qlang-audit.md:817-821`), without naming that either.
   - `D:/git/qlang/core/src/types.mjs:144-146,158` and `D:/git/qlang/core/src/eval.mjs:534-536` state that a quote runs in the scope of its declaration. A word of the root does not, at HEAD.

   Repair:
   - The frame a source's quotes run over holds, beside `ROOT_KEY`, the source's bare declarations that hold no page. The first step of `bareNameReach` then reaches them as at the base, and a label stays no bare name [D191].
   - A test of `declareRoot` that names D200 holds that a reader's word and a later source's word leave a host word's bare name to its source.
   - D200 names D44 and the audit's target, and drops the two sentences the probes refute.
   - The three comments state the scope a declared quote runs in.

2. **The language describes itself** — blocker
   `D:/git/qlang/core/lib/qlang/any.qlang:1913-1914` says "A quote answers a boolean, refused otherwise as the predicate of `every` is, by the index of its condition", and `D:/git/qlang/core/lib/qlang/any.qlang:1980` repeats it for `anyOf`. No law and no case holds it: `D:/git/qlang/core/test` calls neither word with a quote. The refusal lands on a page that names neither word:
   ```
   > {:email "a@b.org"} | allOf true ~(/email) !| [type /index /actualType]
   [::vec/every/ConditionNotBooleanError 1 ::string]
   > {:email "a@b.org"} | allOf true ~(/email) !| explain | /page | segments | filter ~(type | eq ::string) | join ""
   " The predicate of `every` answers a boolean for each element;
         `:index` names the element whose predicate answered another kind."
   ```
   The refusal's first stop is the body of `allOf`, `~(every ~(if (is ::quote) ~(:condition / | subject | apply condition) ~(/)))`, over `[true ~(/email)]`. The repair of the call stands on no page `!| explain` reaches.

   Repair:
   - The refusal is each word's own: `::any/allOf/ConditionNotBooleanError` and `::any/anyOf/ConditionNotBooleanError`, beside `::vec/filter/ConditionNotBooleanError`.
   - Each has a page that names the quote's repair and a law under its address, and the body raises it.
   - D197 weighs this against the composition its Set aside kept.

3. **One fact, one spelling** — blocker
   `D:/git/qlang/core/src/types.mjs:349-364` `formOf` walks the predicates `typeKeyword` walks (`D:/git/qlang/core/src/types.mjs:368-383`). It answers the kinds of the core as strings, `'null'` to `'doc'`, which `CORE_KIND` already spells (`D:/git/qlang/core/src/types.mjs:253-265`). That is a second table of the kinds.
   - The second outside audit named `describeType` "вторая система типов рядом с `typeKeyword`" and asked to delete it (`D:/git/qlang/docs/research/outside-audit/2026-10-11.md:53,75`). The ledger marks it answered by the rename (`D:/git/qlang/docs/research/outside-audit/README.md:38`).
   - The rename also gives `tagged` a narrower meaning than the kind `::tagged`:
   ```
   > [(#[1] | is ::tagged) (~(a) | is ::tagged) (::Box(1) | is ::tagged)]
   [true true true]
   ```
   For the same three values `formOf` answers `'set'`, `'quote'` and `'tagged'`. Its comment, "`tagged` for a value under a tag of its own" (`D:/git/qlang/core/src/types.mjs:346-347`), holds of the set too.

   Repair:
   - The form is derived from `typeKeyword`: the key of the `CORE_KIND` entry whose tag it answers, `'error'` for an error, and for a value under any other tag a name the language gives no other meaning.
   - The second walk is deleted.
   - The ledger's item 6 says open until it is.

4. **One fact, one spelling** — blocker
   `D:/git/qlang/core/lib/qlang/number.qlang:466-468` writes the bound `4294967295`, which `D:/git/qlang/core/src/runtime/arith.mjs:30` already holds as `LONGEST_VECTOR = 2 ** 32 - 1`.
   - The page names the host's implementation language, "for JavaScript".
   - Its repair, "a count of such size is read some other way", names no step.
   - The bound is not a vector length this host can hold. This host's heap is 4.19 GiB (`node -e "console.log(require('v8').getHeapStatistics().heap_size_limit/2**30)"`), and a vector of 4294967295 numbers takes upward of 16 GiB. So a count far below the bound ends in the host's out-of-memory abort, which no refusal names. This is my reading; I did not run it.

   Repair:
   - The refusal carries the bound as a fact, `:longest`, declared under `::number/range/CountTooLargeError` [D172].
   - Its page names the fact and drops the number and "JavaScript".
   - The page names the repair it means, or says the call has none.

5. **Words carry paradigms** — major
   D197 calls a quote a condition, while the catalog defines a condition as a boolean.
   - `D:/git/qlang/core/lib/qlang.qlang:24` opens §9 with "A condition is a boolean, and nothing else is truthy" and closes it with "a condition that may fail where an earlier one does not hold is a quote".
   - `D:/git/qlang/core/lib/qlang.qlang:483` and the law `:qlang/verbs/needsABoolean` (`D:/git/qlang/core/lib/qlang.qlang:533-535`) say "a condition is a boolean". So does the audit: "every condition is a boolean" (`D:/git/qlang/docs/qlang-audit.md:740`).
   - `D:/git/qlang/core/lib/qlang/any.qlang:1907-1910,1978` say "A condition is a boolean computed at the call … or a quote".
   - In the same source, `if` refuses a quote: "A condition given as a quote is code and no boolean" (`D:/git/qlang/core/lib/qlang/any.qlang:508-512,577-581`). A reader who carries the form from `allOf` to `5 | if ~(gt 0) ~(1) ~(2)` is refused.

   Repair:
   - In every sentence D197 wrote, the quote is code that answers a condition: "a condition, or a quote that answers one in its turn", on the first page and on both word pages.
   - The part pages say "the conditions, booleans and quotes that answer them" (`D:/git/qlang/core/lib/qlang/any.qlang:1924-1926,1992-1994`).
   - The record states the term.

6. **The language describes itself** — major
   The invariant `every ~(is ::boolean ::quote)` sends the error of any condition computed at the call through the refusal of code computed at the call. That rule's comment names "the step ran on the subject by mistake" (`D:/git/qlang/core/src/eval.mjs:664-681`). It applies to the first condition too, where nothing guards it and the page's repair, "written as a quote it runs only once every condition before it held" (`D:/git/qlang/core/lib/qlang/any.qlang:1935-1941`), changes nothing:
   ```
   > {:a 1} | allOf (/b | eq 1) !| type
   base 3c986534: ::proj/KeyNotInMapError     HEAD: ::any/allOf/conditions/ElementNotBooleanOrQuoteError (:index 0)
   > {:a 1} | allOf ~(/b | eq 1) !| [type /key]
   [::proj/KeyNotInMapError :b]
   ```
   The sister project's `:any/problemsInRangeOf` (`D:/git/eclipse-jdt-search/cli/lib/jdt/graph.qlang:693`) meets this refusal for a marker without a start line, where the base answered `proj/KeyNotInMapError`. Probe of the same shape: `[{:location {}}] | filter ~(allOf (/location/startLine | gte 1) (/location/startLine | lte 9)) !| [type /actualType]`.

   Repair:
   - The pages of both refusals name the soft read of a field a record may lack, `allOf (at :b | eq 1)`, beside the quote, each with a law at index 0.
   - D197 states that a condition computed at the call that fails is refused at every index.

7. **The language describes itself** — major
   These page statements have no law under their address:
   - `:any/anyOf/conditions/ElementNotBooleanOrQuoteError` (`D:/git/qlang/core/lib/qlang/any.qlang:2003-2007`): an error of a condition computed at the call is refused at its index. Its laws are `#[:refusesANumber]`; `allOf` holds the statement (`D:/git/qlang/core/lib/qlang/any.qlang:1959`).
   - `:map/reduce/reducer/NotQuoteError` and `:set/reduce/reducer/NotQuoteError` (`D:/git/qlang/core/lib/qlang/map.qlang:938-942`, `D:/git/qlang/core/lib/qlang/set.qlang:1106-1110`): the reducer written first. Only `vec` holds it (`D:/git/qlang/core/lib/qlang/vec.qlang:1538`).
   - D201's boolean, null and tag name:
     - on `:set/indexBy`, no law; its laws are `#[:filesANumberUnderItsText :filesEachUnderItsKey :filesUnderItselfWithoutAKey :keepsTheLastOfAlikeKeys]`;
     - on `:vec/indexBy` and `:set/groupBy`, the boolean alone.
   - The keyword separator of `:vec/join/separator/NotStringOrKeywordError` (`D:/git/qlang/core/lib/qlang/vec.qlang:1828-1831`): its laws are `#[:refusesANumber]`, and only the case `join-keyword-separator-written-as-its-name` holds it.

   The records claim that laws hold these: "the laws of both words" (`D:/git/qlang/docs/decisions/D197.md:42`), "the laws of the three words" (`D:/git/qlang/docs/decisions/D198.md:35-36`), "the laws of the four words" (`D:/git/qlang/docs/decisions/D201.md:31-32`).

   Repair: a law under each address for each statement:
   - `:any/anyOf/conditions/ElementNotBooleanOrQuoteError/refusesAConditionThatFailedAtTheCall`
   - `:map/reduce/reducer/NotQuoteError/refusesTheReducerFirst` and `:set/reduce/reducer/NotQuoteError/refusesTheReducerFirst`
   - `:set/indexBy/filesABooleanUnderItsLiteral`, and the laws of null and of a tag name on `set/indexBy`, `vec/indexBy` and `set/groupBy`
   - `:vec/join/writesAKeywordSeparatorAsItsName`

8. **The language describes itself** — major
   D201 files a boolean, null and a tag name under the same keyword a string of the same text files under. Values of two kinds therefore share a group, and `indexBy` silently keeps one of them:
   ```
   > [true "true" null "null" ::a :a 1 "1"] | groupBy
   {:true [true "true"] :null [null "null"] :a [::a :a] :"1" [1 "1"]}
   > [true "true"] | indexBy
   {:true "true"}
   ```
   The second outside audit named the turn of `2020` into `:"2020"` a quiet trap. D201 extends that turn to three more kinds, while the ledger keeps the trap open beside it (`D:/git/qlang/docs/research/outside-audit/README.md:34`). None of these say anything about it: the record's Set aside (`D:/git/qlang/docs/decisions/D201.md:25-27`), the pages (`D:/git/qlang/core/lib/qlang/vec.qlang:782-789`, `D:/git/qlang/core/lib/qlang/set.qlang:598-602,667-671`, the four `KeyNotKeywordError` pages), or the laws.

   Repair:
   - The pages of `groupBy` and `indexBy` on vectors and sets say that values whose text is one file under one key.
   - Each gets a law: `[true "true"] | groupBy | eq {:true [true "true"]}` and `[true "true"] | indexBy | eq {:true "true"}`.
   - D201 weighs this against a refusal of a key whose keyword a value of another kind already took.

9. **Sources, not confidence** — major
   `D:/git/qlang/docs/decisions/D199.md:16-20` counts twenty-nine paths the shell wrote, met "from the first runs to the last". The runs say otherwise.
   - Six runs of set T were measured under D187: `D187~cli~sonnet~1..3` and `D194~cli~sonnet~1..3` in `D:/git/qlang/scripts/benchmark/sets/T/runs/`. Their records hold `"environment": {"MSYS_NO_PATHCONV": "1"}`, and they contain no such path.
   - All twenty-nine fall in the thirty-nine runs before D187, counting `Program Files/Git/` in each record.
   - D187 runs the children with the conversion off, and set aside "a reading in the language of a path Git Bash wrote". D199 names neither.
   - D199's Set aside, "the prompt of the benchmark, which keeps its line" (`D:/git/qlang/docs/decisions/D199.md:29-31`), holds of the prompt of `D:/git/qlang/scripts/benchmark.mjs:84`. The prompt of the sets has no such line, by D187.

   Repair: D199's Source:
   - places the paths in the runs before D187;
   - names D187, whose environment already answers the children;
   - names the reader D199 serves: a session or a reader of the command line outside the benchmark;
   - says why a reading in the command line escapes D187's reason, which spoke of the core.

10. **Sources, not confidence** — major
    The open question `D:/git/qlang/docs/qlang-audit.md:1729-1748` writes numbers a command answers into prose, with no command:
    - a start near three quarters of a second;
    - a parse near 280 ms, and later in the same paragraph "where the parse takes 240": two figures for one parse;
    - the declarations near 100 ms;
    - trees as JSON near seven megabytes, read in near 35 ms.

    The ledger gives a third figure for the parse, "from 312 to 232" (`D:/git/qlang/docs/research/outside-audit/README.md:39`). A warm median of nine parses of the catalog measures 150 ms at HEAD and 212 at the base.

    The question also paraphrases the maintainer: "The maintainer asked whether a source loaded when a name it declares is first read pays at all, since words read the whole universe". The transcript holds his words: «потом уже переходи к ленивой загрузке.. потому как непонятно как это скажется на производительности и остальном.. или смысла нет там вообще.. т.к. есть операнды которые работают над всей вселенной..» (maintainer, 2026-10-07 21:23, session 22b934f8), and «или там с какой-то лейзи загрузкой каталога оно так.. и всякие оптимизации на таком разделении держатся..» (2026-10-11 00:38).

    The readers of the whole root it lists carry no anchor.

    Repair:
    - The question quotes the maintainer.
    - Each number becomes a probe that prints it to the precision the sentence needs, such as a ratio of parse to start, or leaves.
    - The readers of the whole root are anchored by file and symbol.

11. **Words carry paradigms** — major
    The series writes negation and comparisons of two states:
    - `D:/git/qlang/core/src/grammar.peggy:500-501`, "is read whole, not a character after every other reading failed", retells the replaced rule.
    - `D:/git/qlang/docs/decisions/D200.md:11` "no longer copies"; `D:/git/qlang/docs/decisions/D200.md:23` "take 1.5 and 1.0 now".
    - `D:/git/qlang/docs/decisions/D198.md:16-17` "still refuses", twice.
    - `D:/git/qlang/docs/decisions/D199.md:15` "fails as before"; `D:/git/qlang/docs/decisions/D199.md:28` "which name the launcher, not the root".
    - `D:/git/qlang/docs/decisions/D201.md:14-15` "as before"; `D:/git/qlang/docs/decisions/D201.md:29` "was refused".
    - The commit messages compare states:
      - "now" in 832df32c, 6887c2ac, d598b58f, 856dc584, 0aa4518e, 79f3850e, 92eeee68, ac5a1834 and 590ca261;
      - "instead" in 007b4263;
      - "as before" in f07e2693;
      - 590ca261's title defines by negation.

    Repair:
    - The comment states what holds: "A run of prose free of `~`, a backquote, `:` and, in a block, `|` is one part: …".
    - The records say "a call of a word of the root copies no frame of its source", "refuses a keyword", "fails with the note of [D144]", "is refused at its element", and "under which a key of any other kind is refused".
    - The commits that follow say what holds.

12. **Executable over narrated** — minor
    `D:/git/qlang/docs/decisions/D198.md:6-7` says "Where a word writes a value into text, a keyword is written as its name". `print` refutes it: it writes a keyword into text with its colon:
    ```
    > [(:a | print) (["x" :a] | join "")]
    [":a" "xa"]
    ```
    The page of `join` opens "Answers the strings the vector holds joined into one" and says "the pairs of a map's entries join as they stand" (`D:/git/qlang/core/lib/qlang/vec.qlang:1805,1809-1811`). That holds of a map of strings alone: `{:port 80} | entries | map ~(join "=") !| [type /index /actualType]` answers `[::vec/join/ElementNotStringOrKeywordError 1 ::number]`.

    Repair:
    - The record: "Where `join`, `append` and `prepend` write a value into text".
    - The page: "Answers the strings and keywords the vector holds joined into one", and "the pairs of a map of strings join as they stand".

13. **Prose names the invariant** — minor
    The series left these names and comments in files it touched:
    - `D:/git/qlang/core/test/unit/edge-cases.test.mjs:189` titles a test by `VecJoinElementNotStringError`, a constant the series renamed.
    - `D:/git/qlang/core/test/unit/error-values.test.mjs:71` says 'returns "Error"' over an expectation of `'error'`.
    - `D:/git/qlang/core/src/runtime/format.mjs:45-49` is three sentences on the header slot, ending "mirrors the symmetric `Error` envelope". The error's `{$error: {$tag, facts}}` does not share that shape.
    - `D:/git/qlang/core/src/runtime/format.mjs:27-28` writes "Map → object …, Vec → array, Set → array", the names the series took out of the writer tables.
    - `D:/git/qlang/core/src/types.mjs:345-348` is two sentences.

    Repair: the titles name `ElementNotStringOrKeywordError` and `'error'`. Each comment is one sentence of what holds, in the names `formOf` answers.

14. **One fact, one spelling** — minor
    `D:/git/qlang/core/src/runtime/print-value.mjs:49` writes `m[TAG_HEADER_SYMBOL]?.literal ?? ''` before a map. The dispatch hands the `map` writer only maps without a tag; a tagged one goes to `tagged` (`D:/git/qlang/core/src/types.mjs:359-361`). The check repeats a precondition the caller holds and is always empty. It predates the series, which rewrote the line.

    Repair: `map: (m, indent, printedOf) => printMapLike('{', m, indent, printedOf)`.

15. **The hierarchy of texts** — minor
    The ledger closes questions the audit holds open.
    - `D:/git/qlang/docs/research/outside-audit/README.md:33` answers the second audit's "no quote with parameters" with "a word declared with its parts".
    - `D:/git/qlang/docs/research/outside-audit/README.md:20` answers the first audit's `reduce` of one word with a word declared with its part.
    - `D:/git/qlang/docs/qlang-audit.md:1712-1727` poses the helper of one word as an open question, between a quote that closes over its scope and the helper as a word.

    Repair: both items say open and cite the audit's question.

16. **The sign of the diff** — minor
    Core sources +99 −66 and tests +74 −50 (core +51 −47, command line +23 −3). The series introduces no model and names no deletion [D151]. It can delete `formOf`'s second walk (finding 3) and the prefix of finding 14.

    Repair: the branch reports the sign of the whole series by area and names these deletions.
