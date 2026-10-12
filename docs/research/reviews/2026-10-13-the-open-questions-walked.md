## qlang review — the-open-questions-walked, master...5ddc5d45

**Verdict**: REQUEST CHANGES
**Gates**: `npm run ci` exit 0: the build, eslint, the conventions, the probes, the fuzz, which broke no law, the references of the benchmark, every suite, the coverage, the command line's integration and the site. The quotes of D242–D246 and of the audit hold against the transcripts.

**Scope.** The commits of D243, D244, D242, D245 and D246, their files read whole where the change is heavy and by their diffs in the large sources of the catalog, which a search for the words the branch retired covers. The probes ran on the tree at 5ddc5d45.

**Sign** (`node scripts/measure.mjs --steps`), core sources | catalog | documents | tests | tooling:

- 1c175460, D243: +30 −77 | +11 −7 | +276 −105 | +68 −49 | +3 −3
- 7532bcf1, D244: +82 −22 | +553 −170 | +15 −12 | +29 −29 | +2 −2
- 30525398, D242: +42 −4 | +0 −0 | +14 −9 | +18 −2 | +0 −0
- 3789e042, D245: +23 −3 | +0 −0 | +41 −1 | +5 −0 | +0 −0
- 5ddc5d45, D246: +255 −31 | +351 −21 | +90 −23 | +63 −10 | +18 −2

### Findings (17)

1. **One fact, one spelling** — blocker
   `core/src/nearest-names.mjs:72-80`: `linkedNameOf` walks the tags over a segment of a page and asks each for `link`, the walk `holdsRole` makes for the word `links` (`core/src/runtime/doc.mjs:17-22`). The segment in the role of a link is spelled twice, the name `'link'` written in each.
   Repair: one reader of the links of a page, exported by `doc.mjs`, which `doc/links` and the names near an unknown name both call.

2. **One fact, one spelling** — blocker
   `toMap` and `tag ::map` both build a map from its pairs, and `toVec` and `tag ::vec` both turn a set into a vector.
   - `[[:a 1]] | tag ::map` answers `{:a 1}` and `#[2 1] | tag ::vec` answers `[1 2]` (`core/src/runtime/tagged.mjs:65`, `:80-91`).
   - The first page teaches the constructor, `core/lib/qlang.qlang:109-110` and the law `:qlang/buildsAMapFromEntries` (`:256-258`), and so do the pages of `::map` (`core/lib/qlang/map.qlang:27`, `:497-498`, `:1070-1071`) and its laws (`:51-115`, `:1100`).
   - D138 sets aside «a verb of its own for the reverse, `fromEntries`, a second spelling of what the constructor does» (`docs/decisions/D138.md:25-27`); D244 adds that verb and prunes nothing of D138.
   - The maintainer on `tag`: «его базовй прайор это встать спереди пайлоада, перед его текущим тэгом.. а не заменить его тэг или тэги» (2026-10-12 18:47, session 014e5a04). The model's plan named `tag ::map` of pairs and `tag ::vec` of a set among the conversions that leave `tag` for `toX` (18:52, 19:16), and the maintainer took it: «а так да, записывай и погнали делать..» (19:18). D244 keeps them, «as the constructors of `::set` and `::map` build them from their parts» (`docs/decisions/D244.md:26-28`).
   - `toMap` refuses under the constructor's address: `[[:a 1] 5] | toMap !| type` answers `::map/ElementNotPairError`, whose page tells of the vector `::map` builds from (`core/lib/qlang/map.qlang:70-79`).
   Repair: the constructor of `::map` reads a map and that of `::vec` a vector, a vector of pairs and a set refused by pages that name `toMap` and `toVec`; `toMap` refuses under `::vec/toMap/…`; the first page writes `entries | toMap`; D244 prunes D138 of the constructor's reading of pairs and of the reverse verb it set aside, and the cases of D138 move to `toMap`. `tag ::set` stays, the set being the vector in the one order under its tag [D16].

3. **Borrow concepts, not formats** — blocker
   `core/src/pattern.mjs:31-36`: the refusal of a pattern quotes the engine's message whole, a literal of JavaScript with a flag the reader never wrote inside it. `#"a\-b"` is refused with «`#"a\-b"` is no pattern the engine reads: Invalid regular expression: /a\-b/u: Invalid escape; …», and `"(a" | toRegex !| /message` answers `"Invalid regular expression: /(a/u: Unterminated group"`. The hint of a needless backslash is chosen by V8's words, `/Invalid escape/` (`:34`), so an engine that words the reason otherwise gives none, and the case `toRegex-refuses-a-source-the-engine-cannot-read` (`core/test/conformance/42-a-pattern-reads-text.jsonl:28`) asks for V8's «Unterminated».
   Repair: the refusal keeps the reason, the engine's prefix and its literal cut; the hint is read from the source, a backslash before a character no escape needs, which the engine reads once the backslash goes; the case asks the tag and a `:message` that is a string.

4. **Everything is a value** — major
   `core/src/runtime/regex.mjs:75`: a text looked for and replaced by a string is cut by code units, `replaceAll`, so the empty text splits a character of two: `"a😀" | replace "" "-"` answers a string of lone surrogates, `"-a-\ud83d-\ude00-"`, its count 7, which no channel of UTF-8 carries back, while `"a😀" | replace "" ~("-")` answers `"-a-😀-"`.
   Repair: one path for a text, `text.replace(engineOfText(pattern), () => replacement)`, which reads by code points as the path of code does, and a law of the empty text over an emoji.

5. **Everything is a value** — major
   JSON writes a pattern as its literal (`core/src/runtime/format.mjs:37`), and `toRegex` reads a string as a source (`core/src/runtime/convert.mjs:72-78`), so a pattern read back from JSON by the word of its kind is another pattern, in silence: `{:p #"\d+"i} | json | parseJson | /p | :p (toRegex) | ["12" "#\"12\"i"] | map ~(contains p)` answers `[false true]`. The literal of a tag read back by `toTag` is refused aloud.
   Repair: `toRegex` refuses a text that writes the literal of a pattern whole, as the parser reads it, its page naming `parse | apply /`, the reading of a literal.

6. **Sources, not confidence** — major
   D246 holds the dialect «the same on every host» and sets aside flags written inside, `(?i:…)`, «which not every engine the core ships to reads» (`docs/decisions/D246.md:13-16`, `:64-65`); the tree reads `#"(?i:a)b"` and the group name written twice of `#"(?<a>x)|(?<a>y)"`, both of ECMAScript 2025, on Node 24, so a literal parses on one host and is refused on another, the browser of the playground among them.
   Repair: the literal refuses a group of flags and a group name written twice, read from its source, the dialect held to ECMAScript 2018 read by code points, which D246 names.

7. **The language describes itself** — major
   `[1 2] | toString` and `{:a 1} | toVec` answer `::call/KindAnswersNoVerbError`, whose `:addresses` lists the kinds that answer the word and whose page tells the reader to turn the subject into one of them first. No refusal names `print` or `json` for the text of a container, or `entries`, `keys` and `vals` for the parts of a map, which D244 states (`docs/decisions/D244.md:38-40`) and which the model's plan the maintainer took at 19:18 had the two refusals name; the case `a-container-has-no-string-and-a-map-no-vector` (`core/test/conformance/41-a-value-turns-into-another-kind.jsonl:10`) asks the tag alone.
   Repair: the refusal of a word a kind lacks leads to the procedure the kind keeps for it, a page declared under the kind by the word's name, which `explain` lands on; the case asks that page.

8. **Executable over narrated** — major
   `core/lib/qlang/string.qlang:1077-1079`: the law `:string/parseJson/readsANumber`, «A JSON number reads as a number.», runs `"42" | toNumber | eq 42`; the rewrite of D244 put `toNumber` into a law of `parseJson`, which master holds as `"42" | parseJson | eq 42`.
   Repair: the law runs `parseJson`.

9. **The language describes itself** — major
   Two laws are named for a word that left: `:any/sumOf/readsTextByParseJson` (`core/lib/qlang/any.qlang:1715`) proves `toNumber`, and `:keyword/gt/comparesTextTurnedByKeyword` (`core/lib/qlang/keyword.qlang:98`) proves `toKeyword`.
   Repair: `:any/sumOf/readsTextByToNumber` and `:keyword/gt/comparesTextTurnedIntoAKeyword`.

10. **Prose names the invariant** — major
    `core/lib/qlang/string.qlang:1426-1428`, the page of `replace`: «Answers the text with every match of the pattern the call gives in the place of the replacement» puts the matches where the replacement goes.
    Repair: «Answers the text with the replacement the call gives in the place of every match of the pattern or the text».

11. **One fact, one spelling** — major
    D244 turns a number or a keyword into text by `toString`, and the pages of `::number` and `::keyword` teach it, while the pages of `::string` teach `print` for the same act: `core/lib/qlang/string.qlang:20-22`, `:32-34` (`:string/isMadeByPrint`), `:52-58`, `:467`, `:553`, `:706`, `:941-942`, `:971-972`, `:987`, `:1017-1018`, with `core/lib/qlang/doc.qlang:57` and `core/lib/qlang/vec.qlang:1925`. A keyword so made keeps its colon, `:a | print` answering `":a"`.
    Repair: the pages name `toString` where a scalar becomes text and `print` where the literal of any value is meant, and the laws follow.

12. **Prose names the invariant** — minor
    The pages of the parts that take a pattern speak of text alone: `:string/split/separator`, «The string the subject is cut at» (`core/lib/qlang/string.qlang:450-452`), and `:string/contains/needle`, «The text looked for» (`:755-757`).
    Repair: «The text or the pattern the subject is cut at» and «The text or the pattern looked for».

13. **The language describes itself** — minor
    The page of `::string` (`core/lib/qlang/string.qlang:18-25`) names no word that reads text by a pattern and links no `::regex`, so `"x" | type | doc` leads to `match`, `capture`, `scan` and `replace` through the snippet of its manifest alone.
    Repair: a sentence of the words that read text by a pattern, and a link to `::regex`.

14. **Composition multiplies** — minor
    `toRegex` makes a pattern of no flags (`core/src/runtime/convert.mjs:72-78`, `core/lib/qlang/string.qlang:1493-1499`), and a flag written inside the source is refused, `"(?i)abc" | toRegex !| /message` answering «…Invalid group», so a pattern kept in data cannot ignore case.
    Repair: a part `flags` of `toRegex`, `"error" | toRegex "i"`, held by the check of a literal's flags.

15. **Sources, not confidence** — minor
    `docs/qlang-audit.md:784-785` writes «only a combinator joining two steps», `core/src/grammar.peggy:5` «only a combinator joins two steps», and `docs/decisions/D243.md:8` «Steps are joined by a combinator alone»; a declaration joins the step before it by whitespace, on that step's line too: `"5 :x 1 | x" | parse | apply /` answers `1`.
    Repair: the three sentences join a step by a combinator and a declaration by whitespace as well.

16. **One fact, one spelling** — minor
    `vscode/syntaxes/qlang.tmLanguage.json:99-110` adds the pattern to the editor's hand-written grammar, the second spelling of the grammar the audit keeps as a scar (`docs/qlang-audit.md:1029-1030`), while the language server paints the literal as `regexp`.
    Repair: the rule leaves the TextMate grammar.

17. **The sign of the diff** — minor
    The core sources grow over the branch, +432 −137: D243 −47, D244 +60, D242 +38, D245 +20, D246 +224. The growth buys the pattern, which answers the open question every outside audit raised, and the family of conversions, which retires `keyword` and the detours through `tag` and `parseJson`; the branch names no deletion that follows from either [D151].
