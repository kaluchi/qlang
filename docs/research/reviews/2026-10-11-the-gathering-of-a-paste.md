## qlang review — modules-are-the-tree-of-names, 95f12244..8f36d29e

**Verdict**: REQUEST CHANGES. There are two major findings (1 and 7) and five minor ones.

**Gates**: I did not run `npm run ci`, `npm test` or coverage, as instructed. Every gate I did run exits 0, each exit code captured to a file in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-6\`:
- `check:conventions`: 0.
- `check:probes`: 0. The new shell probe at `qlang-audit.md:1876` is ok.
- `check-quotes.mjs`: 0. The quote of D204 is ok.
- `requirements.mjs`: 0. It lists D204 as "held by the tests of the command line".
- vitest `cli/test/line-editor.test.mjs`: 0, 84 tests.
- vitest on core (conformance, depth-budget, state, walk, eval-smoke): 0, 1869 tests.
- vitest on core (catalog-laws, run-laws): 0, 17 tests.

**Sign of the diff** (numstat 95f12244..8f36d29e):
- **Core sources**: +28 −28. Comments, and `isThenable` moved.
- **Catalog**: +17 −11.
- **Tests**: +1 case.
- **Command line**: +8 −7.
- **Command-line tests**: +8 −1.
- **Documents**: +220 −8. The stored review is 159 lines, D204 29, the fates 15, the audit +11 −4, D202 +5 −3, the outside-audit ledger +1 −1.
- **Comment ratio** (the audit's probe): 1875/5645 = 0.332 at both ends, so it does not fall.
- **Stated signs**: each commit's stated sign matches its numstat. The one exception is 95a4474e, whose message leaves out documents +188; dfc9aced's message says so.
- The stored fifth review is identical to the handback of agent-ad384c564c1a4401d, 14321 characters (ran).

### Fates of the fifth review (`D:\git\qlang\docs\research\reviews\README.md:179-186`)
1. **Holds.** The four comments in `D:\git\qlang\cli\src\line-editor.mjs` are true of their code:
   - `:57-58`: the column resets at `:176`, `:196`, `:205`, `:278`, `:296`, `:375`, `:382`, `:391`, `:399`, `:406`, `:412`, `:415-416`, `:427` and `:503`. An unbound key keeps it.
   - `:145`: `lastCursorRow` is counted from the first row.
   - `:188-190`: true of `:191-211`.
   - `:324`: Enter submits.
2. **Holds** for the lines the review named. `state.mjs:21-22` was not among them (finding 6).
3. **Holds in part**: see finding 3.
4. **Holds in part**: see finding 4. The case answers as written (ran):
   - At 333: `::call/EvaluationDepthExceededError`.
   - At 332: `0`.
   - `~([/] | first | sub 1 | down)` at 333: `0`.
5. **Holds.** `D:\git\qlang\docs\research\outside-audit\README.md:25`.
6. **Holds.** On an export of 8f36d29e with `marked-scopes.patch` applied (`review-6\tree-patched`, ran):
   - The four probes answer `::bind/NameDeclaredTwiceError`, the page of `::vec`, `300` and the reader's page.
   - `:vec/second ~(/1) | [[1 2] [3 4]] | map ~(second)` answers `[2 4]`.
7. **Holds in part**: see findings 1 and 2. The new test fails on a copy of the editor whose first chunk lands as a paste of its own (`le-nogather.mjs`): it answers `["one\ntwo","\nthree"]` (ran).
8. **Holds.** `D:\git\qlang\core\src\eval.mjs:557`, under `applyMember` (`:532-555`).

### Findings (7)

1. **Prose names the invariant / Sources, not confidence** — major
   - D204 states the gathering wider than `onData` (`D:\git\qlang\cli\src\line-editor.mjs:462-492`) does. The false clauses are in `D:\git\qlang\docs\decisions\D204.md:5-10` and its Requirements at `:27-29`. The comments at `line-editor.mjs:437-439` ("each chunk … joins the first", "no line break of its body submits") and `:467-468` ("A single key … acts as the key it is") say the same.
   - The code ends the gathering at any chunk of one character and adds any longer chunk to it. It starts the gathering only when no escape is pending (`:483`).
   - I ran three cases, with `scenarios2.mjs`, `scenarios.mjs` and `scenarios3.mjs` on `le-head.mjs`, an export of 8f36d29e:
     - A line break handed over alone submits the lines before it. Chunks `'one\r\ntw'`, `'o'`, `'\r'`, `'\nthree'`, `'\r'` answer `["one\ntwo","\nthree"]`.
     - A key spelled by an escape joins the paste as text. `'one\ntwo'`, `'\x1b[D'`, `'X'`, `'\r'` answer `["one\ntwo\u001b[DX"]`. Alt+Enter, `'\x1b\r'`, after a paste submits nothing.
     - After a lone Escape, a paste is read key by key. `'\x1b'`, `'one\r\ntwo'`, `'\r'` answer `["ne","\ntwo"]`.
   - No test holds any of these edges.
   - Repair:
     - The Decision, the Requirements and both comments say what holds. A chunk of one character ends the gathering and is read as a key, a line break handed over alone among them. A longer chunk joins within 50 ms of the last. A pending escape keeps a paste from starting the gathering.
     - A test holds each of the three answers.
     - The escape landing in the buffer is a defect of `:469-478`. The repair ends the gathering at a chunk that begins with ESC, with a test of an arrow after a paste.

2. **Sources, not confidence** — minor
   - `D204.md:23-24`: "Bracketed paste alone, under which a paste a host hands over in chunks is read key by key". The editor's paste mode spans chunks. With the gathering removed, `'\x1b[200~one\rtw'`, `'o\rthree\x1b[201~'`, `'\r'` answer `["one\ntwo\nthree"]` (ran). The gathering serves a host that ignores the bracketed paste the editor asks for at `:513`. The Source's "even with bracketed paste on" (`:13-16`) should name that host.
   - `:25-26`: "one spelling of Alt+Enter, under which the other host's key breaks a line" is false. `line-editor.mjs:348-353` drops the ESC together with the next byte. With one spelling read (`le-cr-only.mjs`, `le-lf-only.mjs`), `'a'`, the other spelling, `'b'`, `'\r'` answer `["ab"]` (ran), so the other host's key does nothing.
   - `:15-16`, "a terminal that keeps Ctrl+Enter for itself", is the reason b314edff gave when Ctrl+Enter submitted (`git show b314edff:cli/src/line-editor.mjs`, lines 284-285 and 303-305). Under the key map of 5f40a15d, Enter submits and Ctrl+Enter or Ctrl+J breaks a line, so that terminal needs no second submit.
   - The Source cites deleted comments by no commit. d5b93889 made the gathering at the paste the maintainer reported, and f69b68bf deleted the comments.
   - Repair: the Set aside names the host that sends no brackets and says the other spelling is dropped. The Source cites d5b93889, b314edff and f69b68bf, and states the reason for Alt+Enter that holds under 5f40a15d's key map.

3. **The language describes itself** — minor
   - `D:\git\qlang\core\lib\qlang\vec.qlang:446` says "An element that is an error passes code of one value by, as it passes every step".
   - The page (`:379-383`) and the new law `recoversAFailedElement` (`:441-443`) hold a `!|` step that runs on the error element.
   - Repair: "…, as it passes every step that rides `|`."

4. **The language describes itself** — minor
   - `D:\git\qlang\core\test\conformance\18-declared-verbs.jsonl:23` is named `a-part-read-from-its-place-runs-a-frame-below-its-call`, and `:24` is named `a-modifier-of-a-scalar-runs-a-frame-below-its-call`.
   - The repaired page (`call.qlang:252`) and D202 (`:18-20`) say these meet the budget and make no state of their own.
   - Repair: rename them `a-part-read-from-its-place-meets-the-budget-a-frame-below-its-call` and `a-modifier-of-a-scalar-meets-the-budget-a-frame-below-its-call`.

5. **Executable over narrated** — minor
   - `D:\git\qlang\docs\research\reviews\README.md:177` says "found four holding in part".
   - `grep -c "Holds in part"` on the stored review answers 5: fates 3, 5, 6, 8 and 10 (ran).
   - Repair: "The fates of the fourth review it found holding in part are each one of its findings below."

6. **Words carry paradigms / Prose names the invariant** — minor
   - In `D:\git\qlang\core\src\state.mjs`, "frame" names both the depth (`:2`, `:12`, `:21`, `:38`, `:48`) and the names a scope holds over the root (`:5`, `:55`, `:61`, `:67`).
   - Read in the second sense, `:33` "→ a state on the same frame holding the scope" says the frame stays while `withEnv` replaces the scope. `:27-28` uses the same phrase.
   - `:21-22` "→ State at depth 0 — the entry frame of …" keeps the fragment that the fifth review's finding 2 named at `:29` and `:34`.
   - Repair: "→ a state at the same depth holding the value" and "… holding the scope", and "→ a state at depth 0, the first of a query, a cell of a session or a source of the root".

7. **Prose names the invariant, and the reason lives with the decision** — major
   - 95a4474e is the branch's first commit to touch `D:\git\qlang\cli\test\line-editor.test.mjs`. The file keeps comments of several sentences:
     - `:545-548` gives a reason: "This lets the user append…".
     - `:601-604` says "the same `insertPasteAtCursor` helper".
     - `:641-645` says "bytes, not code points" and gives the mojibake reason.
     - `:681-685` gives a reason.
     - `:455-459` ends "never silent no-ops".
     - `:529-532` ends "not at its end".
   - Repair: each comment becomes one sentence that says what its case holds, or is deleted where the case's name already says it. The reasons move to D204 or are deleted.

### Checked, no finding
- **Host boundary**: no `node:` import under `core/src` or in `lsp/src/features.mjs` (ran).
- **Laws of the touched pages**: `::vec/map`, `::call/EvaluationDepthExceededError` and `::vec/map/code/NotQuoteError` run `runLaws` all true (ran).
- **D204 Requirements**: tests exist at `line-editor.test.mjs:135`, `:142` and `:564`, and pass.
- **D202 and the audit**: the rewritten sentences are true. D202 lists seven cases, all met (ran).
- **Other comments of the range**: one sentence each and true: `eval.mjs:355-361` (`42 | :x / | add 1 | x` answers 42, ran), `walk.mjs:8-10`, `:14-15` and `:150-154`, and `script-mode.mjs:99-104`.
- **Commit messages**: no comparison of states or definition by negation.
