## qlang review — modules-are-the-tree-of-names, cd8829fe..49cc8305

Paths below are under `D:\git\qlang` unless they start with a drive. My scratch files are in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-4\`. That folder holds LF exports of b03223ee, cd8829fe, 0d851edd and 49cc8305, plus two copies of 49cc8305 that each drop one `frameBelow` call.

**Verdict**: REQUEST CHANGES — three majors (findings 1–3).

**Gates**: I did not run `npm run ci`, as instructed, and did not run coverage. What I ran, each exit code captured to a file in the folder above:
- `check:conventions` 0, `check:probes` 0, `check-quotes.mjs` 0, `requirements.mjs` 0.
- vitest over 7 core files (state, print-round-trip, print-value-extras, json-bridge, depth-budget, conformance, nouns): exit 0, 1841 tests.
- vitest over 8 CLI files (argv, main, render, repl, script-mode, run, line-editor, highlight-ansi): exit 0, 214 tests.
- `suite.mjs` over the 49cc8305 export: 1763 cases and 1455 laws under 542 addresses, none failing.

**Sign of the diff** (numstat cd8829fe..49cc8305, package-lock aside):

| Area | Added | Removed | Net |
|---|---|---|---|
| core sources (grammar included) | +217 | −289 | −72 |
| catalog | +8 | 0 | +8 |
| tests | +23 | −17 | +6 |
| command line | +86 | −356 | −270 |
| documents | +292 | −71 | +221 |
| tooling | 0 | 0 | 0 |

- Core sources without comment lines: +97 −87, net +10 (0d851edd +19, 188bb5f7 −9).
- Tests: the cases account for +6; the unit tests are +17 −17.
- Documents: the stored review accounts for +152.
- The comment ratio over core, cli and lsp goes from 0.410 (cd8829fe) to 0.347 (49cc8305); master is 0.401.

### Fates of the third review (`docs/research/reviews/README.md:140-152`)
1. **Holds.** Both cases of D182 and the `:vec/map` law pass. `[1 ("x" | add 1)] | map ~(0) !| type` answers the error at b03223ee and 49cc8305, and `[0 0]` at cd8829fe (ran).
2. **Holds in part.** The code is repaired. The law holds the two frames only together (finding 4), and D202's "as every modifier does" is wrong for a quote (finding 5).
3. **Holds.** The seeded walk generates 41 values under `::L`, 6 errors with a stop on their trail and 6 errors that write their trail (counted). The 13 forms of `review-3\rt-top.mjs` hold at 49cc8305 (ran).
4. **Holds.** `state.mjs:20` freezes the state, `state.test.mjs:37` holds it, and D202's Set aside names the unfrozen state.
5. **Holds.** 188bb5f7 is +124 −140 in core sources; the caches of parts and of invariants read are gone.
6. **Holds.** 9b3e058f touched D200 and 791c3a99 wrote the quote and the open count (`git show --stat`).
7. **Holds in part.** D200 and the outside-audit ledger say it, but `requirements.mjs` cannot read D200's mark (finding 11).
8. **Holds.** The quote at audit:1821 is the maintainer's whole message (2026-09-25T09:28:38Z, session 86982eb5, read from the transcript). Its probes pass `check:probes`.
9. **Holds.** Two more cases name D202; the Requirements and the Set aside are rewritten.
10. **Holds.** `{:x 1 :y 2 :z 3} | /w !| /nearest` answers `[:x :y :z]` (ran), and 4f1cc1b7 adds a case naming D203.
11. **Holds in part.** Every line range the third review named is fixed. Other comments of more than one sentence remain in `eval.mjs`, and `walk.mjs:219` still calls `.location` peggy's (finding 8).
12. **Holds.** No plan or environment wording is left in `core/src`, D200, D202 or the outside-audit ledger (git grep).
13. **Holds.** The env test prints three `::binding{` records (ran), and the projection is a case in `02-projection.jsonl`.

The fate of finding 6 of the review of the repair, rewritten in 49cc8305, holds.

### Findings (12)

1. **Everything is a value / The host boundary** — major
   - Where: `core/src/eval.mjs:544-547`, with `core/src/runtime/verb.mjs:85-89` (0d851edd).
   - A host primitive's answer is awaited only when it is a `Promise` of the core's own realm. A thenable, or the promise of an async function made in another realm (a `vm` context, another frame of a page), reaches the pipe unresolved — a value with no literal.
   - Probe, ran (`review-4\thenable.mjs`). One source declares `:number/@thenable ::builtin{}`, whose impl answers `{ then(resolve) { resolve(n + 1) } }`, and `:number/@realm`, whose impl is `vm.runInNewContext('(async (s) => s + 1)')`:
     - `41 | @thenable` answers `42` at b03223ee and `[object Object]` at 49cc8305.
     - `41 | @realm | add 1` answers `43` at b03223ee. At 49cc8305 it answers `::number/add/SubjectNotNumberError` with `:actualType ::unknown` and `:subject [object Promise]`.
   - No test holds what a host's answer becomes. D202:21-22 says only "waits on what answers a promise alone".
   - Repair: `runHostMember`, the one site where a host's value enters, waits on any answer that has a `then`; add a unit test of a primitive answering a thenable. Alternatively, `core/README.md` and D202 state the contract (a value or a promise of the core's realm) and any other value with a `then` is refused as a defect of the host.

2. **Prose names the invariant** — major
   - Where: `core/src/walk.mjs:190-194` (9f78bef6), the comment of `bindingNamesVisibleAt`.
   - It says the visible names are "every declaration that ends before it outside a node whose declarations stay inside it, a cursor at the end of such a node seeing its own". Both halves are false.
   - Probe, ran: `parse('[1] | ~(:x 1 | add 1 | x) | :y 2')`, where the quote spans 6..25 and its body 8..24.
     - Offsets 15, 23 and 24, inside the quote, answer `['x']`.
     - Offset 25, at the quote's end, answers `[]`.
   - The comment 9f78bef6 replaced hid a declaration behind such a node only when the node is "crossed before reaching the cursor".
   - Repair: "the names a step may call at the UTF-16 offset: the declarations that end at or before it, one inside a node whose declarations stay inside it only for an offset within the part of that node that holds it, its end included, and under the spelling of a tag the labels alone [D168]."

3. **Prose names the invariant / Words carry paradigms** — major
   - Where: `cli/src/line-editor.mjs`, which 8783dcdb touches.
   - Comments in it still give the terminals' reasons and compare two states:
     - 23-28: "no longer flashes", "matching the prior behaviour without regression".
     - 376: "(PowerShell / bash parity)".
     - 395-398: "so the binding works uniformly … on hosts where Ctrl+Enter is intercepted".
     - 498-507: "what PowerShell and several other Windows hosts do".
     - 274-278: "rather than orphan halves".
   - Blocks of two to four sentences remain at 50-54, 57-65, 70-74, 77-78, 81-86, 95-98, 104-105, 161-166, 220-227, 250-256, 290-295, 366-371, 404-407, 531-533, 537-543, 555-560 and 573-577 (scan ran, `review-4\comments.mjs`).
   - Against `docs/qlang-audit.md:1115-1119`, which asks a branch to leave every file it touches with one-sentence comments and every reason moved or deleted.
   - The head (1-11) is three sentences, and:
     - its "the arrows … move across the lines" leaves out that Up and Down at the first and last line walk the history (313-346);
     - it does not mention `submit` (613-618);
     - "a chunk that holds a line break" is in fact a chunk longer than one character whose line break is not its last character (561-566).
   - Repair: one sentence per comment stating what holds, with the terminals' reasons deleted; the head names the history and `submit`.

4. **The tests follow what they test** — minor
   - Where: the law at `core/lib/qlang/call.qlang:275-277`, which D202's Requirements cite ("a part read from its place and a modifier of a scalar meet the budget of frames").
   - The law holds the two frames only together, because both decide at the same frame of `gt 0`.
   - Ran (`review-4\suite.mjs`): a copy of 49cc8305 without `frameBelow(state)` at `eval.mjs:688`, and a copy without it at `eval.mjs:802`, each answer `true` to the law and keep all 1763 cases and 1455 laws green.
   - Repair: one law per frame, each named for its claim:
     - `:any/down ~(if (gt 0) ~(sub 1 | down) ~(apply ~(apply ~([] | map ~(x))))) | 498 | down !| type` — the part of `map` read from its place decides.
     - The same query with `~([] | count 1)` — the scalar modifier decides.
     - Each answers `::call/EvaluationDepthExceededError` at 49cc8305 and b03223ee, and stays under the budget on the copy without its frame (ran, `review-4\depth3.mjs`).

5. **The language describes itself** — minor
   - Three texts say every modifier meets the budget:
     - `docs/decisions/D202.md:18-21`: "as every modifier does".
     - The law's name `countsTheFrameOfEveryModifier` (`call.qlang:275`).
     - The page at `call.qlang:248-256`: "every verb body, modifier, `apply` and constructor of a tag runs one frame below".
   - A quote written as a modifier opens no frame (`eval.mjs:801`).
   - Probe, ran, same answers at b03223ee and 49cc8305:
     - `:any/down ~(if (gt 0) ~(sub 1 | down) ~(apply ~(apply ~([] | count ~(x))))) | 498 | down !| type` answers `::vec/count/ArgsBeyondPartsError`.
     - With `count 1` or `count (1)` it answers `::call/EvaluationDepthExceededError`.
   - Repair: the page and D202 say a modifier computed at the call meets the budget a frame below, while a quote written as a modifier is a value; the law is named for what it proves.

6. **The language describes itself** — minor
   - Where: `core/lib/qlang/vec.qlang:438-440`, the law `answersAFailedElementToCodeOfOneValue`.
   - It proves a claim the page of `:vec/map` (369-388) does not make. The page says what the code answers for an element and nothing about an element that is an error.
   - Repair: the page says "an element that is an error passes the code by and answers the call, `[1 ("x" | add 1)] | map ~(0)`", which is the statement the law proves.

7. **Prose names the invariant** — minor
   - Where: `core/src/runtime/nouns.mjs:178-179`.
   - The comment says "a scope whose frame declares no name with a path reads the root's". The code of 0d851edd (`:182`) reads the root's residence wherever the frame does not declare the address, as D202:12-14 says.
   - Repair: "…; a scope whose frame does not declare the address reads the root's."

8. **Prose names the invariant / Words carry paradigms** — minor
   - Comments of more than one sentence: `core/src/eval.mjs:337-341` and `:356-364`, `core/src/runtime/nouns.mjs:1-8` and `:56-61`, `core/src/runtime/verb.mjs:16-18`, `cli/src/script-mode.mjs:99-104`.
   - Comments with no sentence at all: `core/src/state.mjs:68`, `:73`, `:78` (`→ boolean`, `→ new env Map`).
   - `core/src/walk.mjs:1-4` says "rather than a walk of their own", denying an alternative nobody raised.
   - `core/src/walk.mjs:219` says "a peggy location", where the grammar comment corrected by 188bb5f7 says `span()` computes `.location`.
   - `cli/src/render.mjs:1-5` and `:30-31` name "a session that fails to start". `createSession` throws inside `runQuery` (`cli/src/run.mjs:12`) before any cell exists, so this branch serves a query that does not parse and a defect raised past the fail track.
   - `cli/src/argv.mjs:1-7` sits above `HELP_TEXT`, 67 lines away from `parseArgv` (`:74`). It also calls the command line's arguments `args`, the word the language keeps for the values of a call.
   - Repair: one sentence each; the `parseArgv` comment goes over the function and says "the arguments of the command line".

9. **Sources, not confidence** — minor
   - Where: `docs/decisions/D202.md:33-35` and `docs/research/outside-audit/README.md:25`: "about a quarter of its time at b03223ee, and so with `10000 | range | map ~(sumOf / 1) | sum`".
   - Ran, with the record's own command from the root of each export:

   | Query | b03223ee | 49cc8305 | Ratio |
   |---|---|---|---|
   | filter of 100,000 | 1686–1780 ms | 468–538 ms | about 0.29 |
   | sumOf of 10,000 | 240–278 ms | 145–179 ms | about 0.65 |

   - Warm medians for the sumOf query: 218 ms and 130 ms.
   - Repair: give the sumOf query its own ratio, about two thirds.

10. **Sources, not confidence** — minor
    - Where: `docs/qlang-audit.md:1859-1868`, the alternative of marked scopes, "which a session of 2026-10-11 built outside the tree … held every case of the core, the time of a query within its noise".
    - The prototype lives only in the scratchpad of session 22b934f8 (`scratchpad\lex\`). The audit does not name it and no commit holds it, so no reader can rerun "held every case". Its three probes do answer as the audit states (ran).
    - Line 1860 also says "marked instead".
    - Repair: keep the prototype as a branch or as a patch under `docs/research/` that the sentence names, or keep only what the probes show; write "the scopes of the words of the root marked".

11. **Executable over narrated** — minor
    - Where: `docs/decisions/D200.md:43-44`. "Replaced in part by [D202]" stands in the middle of a line, and `scripts/requirements.mjs:31` reads this mark only at the start of a line, as `D174.md:48` and `D185.md:65` write it.
    - Ran: `node scripts/requirements.mjs D200` prints only "replaces in part D44", and D200 is missing from the list of records replaced in part.
    - Repair: put the mark on a line of its own.

12. **Words carry paradigms / Sources, not confidence** — minor
    - Commit messages:
      - 1767ab54: "instead of retelling their pages".
      - 9f78bef6: "the old words of the AST's plumbing".
      - 8783dcdb: "where it listed them".
      - 0d851edd: "two thirds of its time before this change".
      - e567e559 reports "Documents +12 -1"; numstat is +11 −1.
    - Ledger, `docs/research/reviews/README.md:140`: "which stepped past an error at b03223ee already".
    - Repair: commits are not amended. The ledger line becomes "code of one quote, which b03223ee ran on an error element, steps around it as all code does".

### Checked, no finding
- **Differential fuzz of every core word**, LF exports, `diff-words-err4.mjs`: 153,790 calls over 179 words. 13 differ, and each is code of one quote over an error element: `~(~(x))` under `any`, `every`, `filter`, `groupBy`, `indexBy`, `map`, `max`, `min` and `sort` of vectors. This is the deliberate change, pinned by a case of D182.
- **The author's claims about the budget**: the recursion at 499 and the chain of 1000 words refuse at both b03223ee and 49cc8305 (ran).
- **Least refused depth**: 20 shapes give the same value at b03223ee and 49cc8305; cd8829fe differs by one on 17. The shapes cover:
  - modifiers of each kind;
  - parts read by place, by code, softly and strictly;
  - invariants of kinds and of queries, and answer invariants;
  - `apply`, `map` and `reduce`;
  - chains of words.
- **Earlier probes**: the third reviewer's 58 probes (`review-3\c1..c8.json`) answer alike at b03223ee and 49cc8305, except the `:nearest` fact of D203.
- **Residence cache**:
  - Every path name of the root has its noun declared in the root (`eval.mjs:371`), so `residenceAt` reads only the exact address from the frame, and `residenceOf` computes that address in the scope.
  - 56 cells across sessions sharing one root answer alike at both trees. They cover reader labels, words, parts, answer invariants and extensions of root kinds.
- **Definition cache**: everything `definitionIn` reads stands under `address/`, which `declaresUnder` tests.
- **Promises and throws inside the core**:
  - Every caller of `refusalOf`, `answerUnderItsLabel`, `keptAsSubject` and `partOf` waits on the promises they answer.
  - A synchronous throw from a primitive, or from `frameBelow` in a modifier or a part, rejects the same async frame (`argsOf`, `applyMember`) as at b03223ee.
  - There is no `Promise.all` in core, cli or lsp.
- **Stored third review**: byte-identical to the handback of agent-ac736cd7c5530c0c7.
- **CLI comments that are true of their code**:
  - `resolveShouldColorize`: always or never first, then a `FORCE_COLOR` other than "0", then a non-empty `NO_COLOR`, then whether stdout is a terminal.
  - `parseArgv`'s five shapes.
  - `liftParsedDocument`: `fromPlain` raises only `NumberNotFiniteError`.
  - `runQuery`.
  - The REPL head: `@in` is the empty string, a query after `-i` runs through `submit`, plus `.help`, `.exit` and Ctrl+D.
  - `writeCellOutcome`.
- **`--help`**: its paragraph wraps at 70 characters.
- **0d851edd's timing**: the map over 100,000 numbers goes from 182 to 111 ms warm median (cd8829fe → 0d851edd), so its "two thirds" holds.
- **Host boundary**: no `node:` import under `core/src`, and none in `lsp/src/features.mjs`.
- **Commit messages**: each stated sign matches its numstat, except e567e559.
