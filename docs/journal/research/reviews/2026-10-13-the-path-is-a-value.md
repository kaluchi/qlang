## qlang review: the-path-is-a-value (master...59774765)

**Verdict**: REQUEST CHANGES

**Gates**: I did not run `npm run ci`, at your word; you report exit 0 on 4d753971. On 59774765 I ran:
- `npm run check:conventions`: exit 0.
- `npm run check:probes`: exit 0, the probes of the open records included.
- `npx vitest run --root core` over catalog-laws, print-round-trip, conformance and error-tag-catalog-drift: 4 files, 2657 tests, exit 0. This runs every law of the root, so it covers `runLaws` for every page the diff touches. The laws of `::cli`, `in`, `out`, `err` and `tap` also answer true.
- The sister project's CLI suite (D:/git/eclipse-jdt-search/cli, 9dc338c), run against this checkout: 52 files, 920 tests, exit 0.

`gate-diff --task` does not apply, because this branch decides records rather than only working targets. I held the branch to `.claude/agents/qlang-review.md` as HEAD writes it; I found no point where it disagrees with the audit.

### Findings (16)

1. **One fact, one spelling** (blocker): quotes are built by printing text and parsing it again.
   - D:/git/qlang/core/src/eval.mjs:516-530: `readOfPathSubject` and `readOfRefusedPath` build `:read` as `get … | ${node.text}`, slicing `node.text` at the offsets of the written path, and hand it to `quoteOfSource`. That is a second parse of text the parser already read.
   - D:/git/qlang/core/src/runtime/fn.mjs:117-118: `fill` prints each input's page and value and the recipe, then parses the joined text.
   - D:/git/qlang/core/src/elide.mjs:60-64: `readOf` reads `!| ` off a text prefix with a regex, then parses.
   - Evidence, `fill`:
     `:f (::fn | takes :d |~~ A doc. ~~| /0 | impl ~(d | content)) | [(5 | apply f [|~~ x ~~|]) (f | fill |~~ x ~~| | :q it | 5 | apply q)]` answers `[" x " " A doc. \n x "]`.
     `f | fill |~~ x ~~|` answers `~(:d |~~ A doc. ~~| |~~ x ~~| | d | content)`. The doc argument reads back as a second page of the declaration. This breaks the page of `fill` ("as its call reads it", D:/git/qlang/core/lib/qlang/fn.qlang:637-643).
   - Repair: assemble each quote from steps.
     - `fill`: `::bind` steps (`:name`, `:docs [page]`, `:body` the value, a doc body inside a `::group`, as the page of `::bind/ReadBackDiffersError` asks), then the recipe's steps.
     - `:read`: a `::call` of `get` on the path, then `stepOfNode(node)`, or the node's step with the path modifier replaced by a `::group` of that call.
     - Add a law under `::fn/fill` for a doc argument.

2. **One fact, one spelling** (blocker): names, tags and addresses are spelled twice in the core.
   - `ANSWER_NAME = 'answer'` appears at D:/git/qlang/core/src/runtime/signature.mjs:21 and at D:/git/qlang/core/src/runtime/nouns.mjs:105, plus `${address}/answer` at nouns.mjs:370.
   - `HOLDS_TAG` and `LAW_TAG` (D:/git/qlang/core/src/eval.mjs:472-473) stand beside `INVARIANT_TAG_NAME` and `LAW_TAG_NAME` (nouns.mjs:113, 121).
   - `LITERAL_WORDS` appears at signature.mjs:27 and at D:/git/qlang/core/src/grammar.peggy:143.
   - The kind name `'any'` appears at signature.mjs:71, beside `ANY_KIND_NAME` (nouns.mjs:21) and `ANY_KIND` (eval.mjs:635).
   - `isMissedPlace` (eval.mjs:906-908) compares the strings `'path/IndexOutOfBoundsError'` and `'path/KeyNotInMapError'`. Those addresses are already held as `.prototype.address` of the classes declared at D:/git/qlang/core/src/path-read.mjs:10-11.
   - What counts as a place is `/^-?\d+$/` at D:/git/qlang/core/src/runtime/print-value.mjs:50, beside `segmentIndex` (path-read.mjs:21-23).
   - The `lay` closure and the loops over pages, facts, invariants and laws are written twice: eval.mjs:418-421 with :439-442, and :452-455 with :465-468.
   - The subject refusals of the builders are declared by hand: 16 `declareRefusal` calls (D:/git/qlang/core/src/runtime/fn.mjs:26-33, D:/git/qlang/core/src/runtime/kind.mjs:19-26). The runtime raises the same addresses by rule (nouns.mjs:332). `5 | fn/takes :by |~~ x ~~| /0 !| type` (raised by rule, eval.mjs:716) and `::number | takes :by |~~ x ~~| /0 !| type` (raised by fn.mjs:59) both answer `::fn/takes/SubjectNotFnError`: one tag, two sites.
   - Repair:
     - Export each constant once and import it everywhere else.
     - Compare `isMissedPlace` against the classes' addresses.
     - Print a place through `segmentIndex`.
     - Write one lay helper shared by both builders of nodes.
     - Let the walk of a tag reach a word of a noun only for that noun's own tag, so the rule raises the subject refusal and the 16 declarations go.

3. **One fact, one spelling** (blocker): the contract of each command is spelled outside the catalog.
   - `COMMANDS` and `KIND_COMMANDS` (D:/git/qlang/core/src/runtime/signature.mjs:37-55) spell what each command takes. The inputs of `:fn/on` … `:fn/proves` (fn.qlang:230-600) and `:kind/wraps` … `:kind/proves` (D:/git/qlang/core/lib/qlang/kind.qlang:220-464) spell it again. The pages of `::fn/SignatureNotCommandsError` (fn.qlang:46-57) and `::kind/SignatureNotCommandsError` (kind.qlang:43-53) spell it a third time.
   - The spellings already disagree:
     - `::fn | takes :by |~~ x ~~| /0 [::number ::string] !| type` answers `::fn/SignatureNotCommandsError`. The input `:kinds` of `takes` accepts any `::vec`; the table refuses this one.
     - The kind refusal page leaves out `tells`, which `KIND_COMMANDS` holds (signature.mjs:50).
   - `runs(['code'], …)` (D:/git/qlang/core/src/primitives.mjs:107-121 and its call sites) spells the catalog's input names a second time. `handedTo` (eval.mjs:737-745) skips a name no input bears without saying so.
   - The audit's milestone 4 requires "no operand contract is spelled outside the catalog" (D:/git/qlang/docs/qlang-audit.md:1065-1066).
   - Repair:
     - The constructors read each command's objects from the function of `::fn/<command>` or `::kind/<command>`; the JS table stays only for the literal words that load before them.
     - The refusal pages link to the commands' pages.
     - `runs` refuses a name its word does not take.

4. **One fact, one spelling** (blocker): the tools read the role of a declaration from the form of its source.
   - `builtFrom` and `declaresKind` (D:/git/qlang/core/src/walk.mjs:138-149) take a body that opens with `::kind` for a kind. `bodyRuns` (D:/git/qlang/lsp/src/features.mjs:449-455) takes a body that opens with `::fn` and holds a step named `impl` for a word. The runtime reads the value instead.
   - Evidence: `:K (::kind | wraps |~~ x ~~| ::map) | :Box |~~ A box. ~~| K | [(::Box{:a 1} | type) (::Box(5) !| type) (kinds | has ::Box)]` answers `[::Box ::Box/PayloadNotMapError true]`. For the same declaration of `:Box`, `declaresKind` answers false (`parse` + `walkAst`). D253 retired role-by-form from the evaluator, but it stands in the tools.
   - Repair: the language server takes roles from the records a session's run of the document writes (`isLabel`, `isWord`). `builtFrom` and `declaresKind` leave the walk and `core/src/index.mjs`.

5. **The language describes itself** (blocker): pages state behaviour the tree lacks, with no law behind them.
   - a. D:/git/qlang/core/lib/qlang/any.qlang:1910-1914 (page of `is`): "A part of the args whose invariant asks `is` is handed to its name as the value of the kind…".
     `5 | apply (::fn | takes :by |~~ How much. ~~| /0 | holds :by/E |~~ A number. ~~| ~(is ::number) | impl ~(by | type)) [::Width(3)]` answers `::Width`. D253 retired this mechanism and its laws; the sentence stayed.
   - b. D:/git/qlang/core/lib/qlang.qlang:590-592 says a recipe written alone has "its args read by `args`", and D:/git/qlang/docs/decisions/D253.md:27-30 says it "binds its args as `args`".
     `:number/p ~(args) | 5 | p 1 2` is refused `::number/p/ArgsBeyondInputsError` with `:places 0`, and `:number/p ~(args) | 5 | p` answers `::number/p[]`.
   - c. D:/git/qlang/core/lib/qlang.qlang:423-424: "A line break is a space wherever it stands".
     `[1 2 3] | :vec/f ~(get /1) | count` answers `3`. The same query with a line break after `:vec/f` answers `[1 2 3]`, and `vec/f` holds `1`: under D251, a body begun on a later line takes the next command into it.
   - d. qlang.qlang:211 and :220 teach `/price |` and `/qty |` as steps, which D248 refuses.
   - Repair: rewrite each statement to match the tree, with a law each.
     - (b): the page and D253 say a recipe written alone takes no object.
     - (c): the chapter names where a line break separates (D243, D66, D251); otherwise D251's sentence rule goes.
     - (d): "After `get /price |`".

6. **The language describes itself** (major): `::span` and `::point` accept or misname payloads of another shape, against D249.
   - D:/git/qlang/core/lib/qlang/span.qlang:15-19 and D:/git/qlang/core/lib/qlang/point.qlang:13-17 hold `~(allOf (count | eq 6) ~(every ~(is ::number)) …)`.
     - The first condition is computed at the call, which the first page warns against (qlang.qlang:124-129).
     - It asks for kinds inside an invariant, which the page of `::holds` says no invariant does (D:/git/qlang/core/lib/qlang/holds.qlang:15-18).
   - Evidence:
     - `::span"abcdef" !| type` answers `::call/KindAnswersNoVerbError`.
     - `::span(6) !| type` answers `::any/allOf/conditions/ElementNotBooleanOrPathOrQuoteError`.
     - `::point{:a 1 :b 2 :c 3} | get [(type) (offset !| type)]` answers `[::point ::path/KeyNotInMapError]`: a map is accepted as a point.
   - Repair: `wraps |~~ … ~~| [::number]` with `holds … ~(allOf ~(count | eq 6) ~(every ~(eq (floor))))`, D249 naming the refusals those kinds raise. Add cases in 38-a-place-in-source-is-a-span.jsonl for a string, a number and a map payload.

7. **One model** (major): a place is read by the form of its code.
   - D:/git/qlang/core/src/runtime/nouns.mjs:409 and :422 recognise `~(query /n d)` and `~(it)` by the names `query` and `it`. `placeRead` (eval.mjs:868-878) answers them without running the code; its comment gives the reason ("so the inputs of `query` itself read without calling it"). D251 set aside the same reading of `drop n` («а это зачем в эвале? какой-то фикс хак или что?»).
   - Evidence: `:vec/query (::fn | takes :p |~~ P. ~~| /0 | takes :d |~~ D. ~~| ~(query /1 null) | impl ~(99)) | :number/a (::fn | takes :by |~~ B. ~~| ~(query /0 1) | impl ~(add by)) | :number/b (::fn | takes :by |~~ B. ~~| ~(query /0 1 | it) | impl ~(add by)) | 5 | get [a b]` answers `[6 104]`. One read gives two answers depending on how it is spelled.
   - Repair: every quote place runs as code. A session record replaces this model-decided part of D251 (D155) and settles how an input with a default, `query`'s own among them, reads its place.

8. **Sources, not confidence** (major): the audit names two baselines.
   - D:/git/qlang/docs/qlang-audit.md:17-18 names `4d753971`, which `scripts/baseline-walk.mjs:55` reads.
   - qlang-audit.md:307-309 ("commit `4dc957d` for this one") and :970 ("The start … commit `4dc957d`") still name the twelfth version's baseline.
   - Repair: both sentences name `4d753971`.

9. **The sign of the diff** (major): the core and its tests grow, and nothing names what the next branch deletes.
   - `node scripts/measure.mjs 611a948d 59774765`:

     | area | before → after | net |
     |---|---|---|
     | core sources | 7242 → 8216 | +974 (+1738 −763) |
     | unit tests | 8096 → 8332 | +236 |
     | conformance | 1937 → 2061 | +124 |
     | catalog | 14204 → 13953 | −251 |

   - The branch introduces a model (D248, D251, D252), but no record, commit or route line names what the next branch deletes because of it (D151; qlang-audit.md:1136-1140).
   - Commit messages carry counts the history answers (D208): 9535576b "Six targets of D251 are met", b0dbd5dc "The ledger counts five audits".
   - Repair: D252 or the route names the deletions the model opens (findings 1, 3, 4 and 7, and the editor grammar's hand-written rules).

10. **The tests follow what they test** (major): D254 is unmet in its own branch.
    - D:/git/qlang/core/test/conformance/targets.jsonl holds 110 met cases of 28 records under a name for what they were. D254 asks that files be "named for what they hold".
    - Some case names keep the parts vocabulary D253 retired:
      - 23-a-word-is-found-through-its-subject.jsonl:6, 7, 9, 11 (for example `a-rest-part-gathers-the-modifiers-that-remain`)
      - 21-a-name-holds-a-value.jsonl:16-25 (for example `a-body-declares-no-part-of-its-word-again`)
      - 05-a-step-is-a-command.jsonl:54
      - 10-the-words-of-numbers.jsonl:16
    - D:/git/qlang/core/test/unit/fn.test.mjs:72-89 state in JavaScript what the laws `answersTheFailureOfAnObject` (fn.qlang:127-135) and `refusesAStepWrittenForItsQuote` (fn.qlang:375-384) already prove.
    - Repair: the cases join their topic files and targets.jsonl goes. The names say input and recipe. The two unit tests go.

11. **Prose names the invariant** (major).
    - grammar.peggy:357-366 narrates how `DeclarationOpens` raises `lookingAhead` inside a predicate and gives it back through an alternative that always fails (:367-371). The comment excuses a mechanism.
    - D:/git/qlang/core/src/error-convert.mjs:121-130 is false since D249: it says the position "lives in `:location.start`", but the location is a `::span` read by `start`.
    - error-convert.mjs:90-94 and D:/git/qlang/core/src/equality.mjs:14-19 explain mechanisms over several sentences.
    - signature.mjs:25-26 describes the `COMMANDS` table but sits above `LITERAL_WORDS`.
    - 59774765 claims the comments say what holds in one sentence.
    - Repair: one sentence of what holds each. The false comment is deleted. The counter becomes a rule without side effects, or its reason goes into a record.

12. **Words carry paradigms** (major).
    - D:/git/qlang/core/src/runtime/verb.mjs:98-106: `shownFor` returns input names as `labels` (read as `shown.labels` at lsp/src/features.mjs:83 and :615). In the language, a label is a tag's node.
    - The parts vocabulary remains in places:
      - nouns.mjs:334: `partAddress`
      - eval.mjs:956: "a part of code"
      - D:/git/qlang/core/src/runtime/axis.mjs:17 and any.qlang:961: "a part of the args"
      - D:/git/qlang/core/src/runtime/vec.mjs:348: "the first part of its args"
      - D:/git/qlang/core/lib/qlang/bind.qlang:188: law `refusesAPartDeclaredInTheBody`
    - The objects of a command go by two names: "modifier" (qlang.qlang:50, 59, 73, 79) and "object" (D248, fn.qlang:17, 27, 48, 143, 645).
    - Temporal and negating wording in records the branch adds (some of it moved from the audit's open chapter): D254.md:6 "no longer told", D255.md:5 "no longer gathered", D255.md:7 "made now", D258.md:11, D259.md:43 and D261.md:4 "rather than", D262.md:5 and :7 "today", "now run", D269.md:16 and :41 "now". In the audit: qlang-audit.md:1072 "it stands now".
    - Repair: `inputs` for `labels`; input or recipe for part or body; one word for the objects of a command; sentences that state what holds.

13. **The order of concepts is the order of dependencies** (major).
    - `underKind` and `fieldRefusal` (eval.mjs:289-333) come before what they rest on: `recipeScopeOf` (:659), `heldByItsKinds` (:820), `invariantRefusal` (:859), `pathOfArgs` (:883) and `isMissedPlace` (:906).
    - Repair: the helpers that holding by kinds, reading places, invariants and the scope a call opens rest on stand first, then the call of a function and the value under a kind.

14. **One fact, one spelling / Executable over narrated** (major, tooling).
    - D:/git/qlang/scripts/requirements.mjs:90-93: `inForceOf` keeps open records. So `node scripts/requirements.mjs` lists D260, D262 and D264 as "held by the tests of the host" and D268 as "held by the tests of the implementation", while also listing them as "being decided".
    - D:/git/qlang/scripts/sensors/run-probes.mjs:36 repeats `/^Question\. /m` beside `isOpenText` (D:/git/qlang/scripts/decision-records.mjs:96).
    - The record fields are listed three times: decision-records.mjs:22, marks.mjs:144, check-conventions.mjs:386-387.
    - The message at check-conventions.mjs:577 ("…and neither of those until it is decided") reads as refusing the three fields it asks for.
    - Repair: `inForceOf` excludes `record.open`; run-probes imports `isOpenText`; one exported list of fields; the message names `Decided by.` and `Decision.`.

15. **Everything is a value** (minor).
    - D:/git/qlang/core/test/unit/print-round-trip.test.mjs generates no `::fn` and no `::kind`. Their round trip rests on one law each (fn.qlang:92-94, kind.qlang:84-86).
    - Repair: generators of chains in the property test, with multi-line pages, fields and invariants.

16. **One fact, one spelling in the consumers** (minor).
    - D:/git/qlang/vscode/syntaxes/qlang.tmLanguage.json `span-code` spells strings, patterns, keywords and comments again. Its keyword pattern `:[_a-zA-Z][a-zA-Z0-9_-]*` admits no letter of another script; name-chars.mjs does (`:данные` reads back). The audit names this grammar as the scar that remains (qlang-audit.md:632-633), and the branch grows it.
    - lsp/src/features.mjs:405-410 hand-types a page for a path that `::path | doc` already holds.
    - Repair: the hover reads `::path | doc`; the editor's grammar is generated from the grammar's tokens or reduced, as the route says.

### Where I found nothing
- **Host boundary:** no `node:` import under core/src, and lsp/src/features.mjs imports only `@kaluchi/qlang-core`.
- **Foreign formats:** none in the core.
- **Decider lines:** every record the branch adds names its decider and the model's parts; the open records name none and keep the form `Question.`, `Source.`, `Alternatives.`.
- **Quotes:** `check-quotes` on D248–D269 and the audit matched all 96 quotes.
- **New refusals:** the ten I checked each have a page and a law.
- **Tests:** no skipped test and no open target.
- **Open-record probes:** they answer as written.
- **Claims I probed:** the claims of D251 and D253 I ran answer as their records say.
- **Consumers:** the CLI help, the READMEs and the site speak the new forms.

## The fates of the findings

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
