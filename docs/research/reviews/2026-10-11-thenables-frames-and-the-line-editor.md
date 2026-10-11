## qlang review — modules-are-the-tree-of-names, 49cc8305..95f12244

Repository paths are under `D:\git\qlang`. Scratch files are in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-5\`:
- LF exports: `tree-49cc8305`, `tree-95f12244`, and `tree-patched` (95f12244 with the patch applied).
- Copies of 95f12244 that change one frame each: `tree-nopart`, `tree-nomod`, `tree-quoteframe`.
- Scripts: `probe.mjs`, `suite.mjs`, `cases3.mjs`, `least.mjs`, `visible.mjs`, `thenable-test.mjs`, `handback.mjs`, `comments.mjs`.
- Logs and exit files of every gate below.
- Timings used the fourth review's `review-4\tree-b03223ee`.

**Verdict**: REQUEST CHANGES. One major finding (1) and seven minor ones.

**Gates**: I did not run `npm run ci` or coverage, as instructed. Each exit code below is captured to a file:
- `npm run check:conventions`: 0.
- `npm run check:probes`: 0.
- `node scripts/sensors/check-quotes.mjs`: 0.
- `node scripts/requirements.mjs`: 0, and 0 with `D200` and with `D202`.
- vitest on core (eval-smoke, conformance, depth-budget, nouns, state, walk): 0, 1886 tests.
- vitest on cli (line-editor, argv, render, script-mode, repl, main, run): 0, 195 tests.
- `suite.mjs` (every case and every law) on `tree-95f12244` and on `tree-patched`: 1766 cases and 1454 laws under 542 addresses each, none failing.

**Sign of the diff** (numstat 49cc8305..95f12244, package-lock aside):
- **Core sources**: +49 −49, net 0. Code +7 −6 (the `isThenable` predicate), comments +41 −43, blank +1.
- **Catalog**: +9 −9, net 0.
- **Tests**: +21 −0. The three cases add 3 lines and carry the claims of a law the catalog dropped. The unit test of a host's thenable adds 18 lines and is the test the fourth review asked for. No deletion is named (D151).
- **Command line**: +81 −165, net −84, all comment lines.
- **Documents**: +385 −29, net +356. The stored review is +183 and the patch +147.
- **Tooling**: 0.
- Each commit's stated sign matches its numstat.
- Comment ratio over core, cli and lsp (the audit's probe): 0.347 at 49cc8305, 0.332 at 95f12244.

### Fates of the fourth review (`D:\git\qlang\docs\research\reviews\README.md:160-171`)

1. **Holds.**
   - Six waits read `isThenable`: `D:\git\qlang\core\src\eval.mjs:545`, `:548`, `:551`, `:673`, `:688`, `:692`.
   - I ran the test's own code on both exports (`thenable-test.mjs`). 49cc8305 answers `::number/add/SubjectNotNumberError` for both elements; 95f12244 answers `[43 43]`.
2. **Holds.**
   - In `[1] | ~(:x 1 | add 1 | x) | :y 2`, `x` is visible at offsets 12–24 and nothing at 25.
   - In `(:p 1) | p`, `p` is visible at offset 5 alone (`visible.mjs`, ran).
   - `walk.mjs:190-194` says so.
3. **Holds in part**: see finding 1.
4. **Holds.**
   - I ran `cases3.mjs` on the tree and on the three copies. Without the part's frame, case one answers `[]`. Without the scalar modifier's frame, case two answers `::vec/count/ArgsBeyondPartsError`. With a frame added to a quote modifier, case three answers `::call/EvaluationDepthExceededError`. The tree answers all three cases as written.
   - The ledger's reason, "some frames deep", is exactly one frame from the top (`D:\git\qlang\core\src\runtime\manifest.mjs:40`), and more when `runLaws` is called deeper.
5. **Holds in part**: see finding 4.
6. **Holds in part**: see finding 3.
7. **Holds.** `D:\git\qlang\core\src\runtime\nouns.mjs:176-181` reads the frame where the frame declares the address, and the root's otherwise.
8. **Holds in part.** Every comment the review named is one sentence and true of its code. The same files keep the comments of finding 2.
9. **Holds.** I ran D202's own command from the root of each export, five runs each:

   | Query | b03223ee (median) | 95f12244 (median) | Ratio |
   |---|---|---|---|
   | filter | 1761 ms | 510 ms | 0.29 |
   | word in steps | 273 ms | 177 ms | 0.65 |

10. **Holds in part.**
    - `git apply --check` exits 0 on the repository (read-only) and on the export.
    - On `tree-patched` the four probes answer `::bind/NameDeclaredTwiceError`, the page of `::vec`, `300` and the reader's page.
    - A reader's own call keeps its word and invariant: `:vec/second ~(/1) | [[1 2] [3 4]] | map ~(second)` answers `[2 4]`, and `500 | sub 200` answers the reader's refusal.
    - Every case and law holds on the patched export.
    - Ten unit files of the scope pass there, 162 tests: nouns, labels, bindings, state, session, eval-smoke, run-laws, doc-attachment-scope, verb-tooling, depth-budget.
    - The audit names the answers imprecisely: see finding 6.
11. **Holds.** `node scripts/requirements.mjs D200` prints "replaced in part by D202".
12. **Holds.** `README.md:140` says what b03223ee ran.

The stored review is identical, byte for byte, to the handback of agent-a30bd31c8cd813f82 (`handback.mjs`, ran).

### Findings (8)

1. **Prose names the invariant / Words carry paradigms** — major
   - `D:\git\qlang\cli\src\line-editor.mjs:323` keeps `// Enter (CR) — submit (PowerShell / bash parity)`. This is the terminals' reason the fourth review named at its line 376, and the ledger's fate 3 says every comment says what holds.
   - `:187` "The recall helpers" is a generic word, in a comment f69b68bf wrote.
   - `:144` "row 0 of the prior render" compares two repaints; `:63` calls it "the last repaint".
   - `:57` "The column a run of Up and Down aims at, which any other key resets" is false both ways:
     - Up or Down resets it when it walks the history or meets an edge (`:195`, `:204`, `:277`, `:295`).
     - A key with no binding keeps it, Tab or PageUp `ESC[5~` (`:329`, `:356-366`).
   - Probe (ran): `git grep -n "parity\|helpers\|prior" 95f12244 -- cli/src/line-editor.mjs`.
   - Repair:
     - `// Enter (CR) submits`.
     - "The recall of the history saves the draft of the place it leaves and loads the next place's, …".
     - "1. The cursor walks up to the first row of the last repaint."
     - "The column a run of Up and Down across the lines aims at, which an edit, a move along the line and a walk of the history reset."

2. **Prose names the invariant / Words carry paradigms** — minor
   Files f69b68bf touched keep comments outside the one-sentence form the audit asks (`D:\git\qlang\docs\qlang-audit.md:1116-1117`):
   - `D:\git\qlang\core\src\state.mjs:1-9` has two sentences.
   - `state.mjs:29` and `:34` read `→ State on the same frame`, with no sentence. This is the shape the commit repaired at `:62`, `:68`, `:73` and `:78`.
   - `D:\git\qlang\core\src\walk.mjs:8-10` and `:150-154` have two sentences each.
   - `walk.mjs:14-15` says "the step of a pipeline's unit rather than the unit".
   - `D:\git\qlang\core\src\eval.mjs:355-356`, "the scope takes the record of the binding", gives the scope a verb of mutation.
   - `eval.mjs:358`, "a doc alone a page", leaves out what binds: a declaration of docs alone binds them as a page (`:373-374`).
   - `D:\git\qlang\cli\src\script-mode.mjs:99-100`, "a value whole unless the caller asked for a budget and an error an alert", reads as one condition. An error prints as an alert with or without a budget.
   - Probe (ran): `node review-5\comments.mjs` over the touched files, then reading.
   - Repair: one sentence each.
     - "→ a state on the same frame holding the value" (`:29`), "… holding the scope" (`:34`).
     - "a fresh scope holds the record of the binding".
     - "a declaration of docs alone binding them as a page".
     - "a value whole unless the caller asked for a budget, an error an alert, …".

3. **The language describes itself** — minor
   - `D:\git\qlang\core\lib\qlang\vec.qlang:379-381` says "an element that is an error passing the code by and answering the call". That holds only for code whose steps ride `|`.
   - A code with a `!|` step runs on the error element: `[1 ("x" | add 1)] | map ~(add 1 !| 0)` answers `[2 0]` (ran). The second half of that sentence ("a code that recovers keeps every element") fits this answer; the first half denies it.
   - The law the page rests on, `answersAFailedElementToCodeOfOneValue`, claims code of one value only. No law holds an error element under a code that recovers.
   - Repair:
     - The page: "an element that is an error passes by the steps of the code that ride `|`, so code of one value answers it, `[1 ("x" | add 1)] | map ~(0)`, and a code that recovers, `map ~(add 1 !| 0)`, keeps every element, an error element among them".
     - A law `:vec/map/recoversAFailedElement`: `::law~([1 ("x" | add 1)] | map ~(add 1 !| 0) | eq [2 0])`.

4. **The language describes itself** — minor
   - `D:\git\qlang\core\lib\qlang\call.qlang:249-252` and `D:\git\qlang\docs\decisions\D202.md:21-22` say "a quote written as a modifier being a value that runs nothing".
   - The verb runs the code that quote holds, each run one frame below the call (`makeLambda`, `eval.mjs:784-787`).
   - Probe (ran, `least.mjs` and `qlang`):
     - `:any/down ~(if (gt 0) ~(sub 1 | down) ~(0))` is refused from 499 levels.
     - The same steps run by `map`, `~([/] | map ~(sub 1 | down) | first)`, are refused from 333.
     - At 333, `… | 333 | down !| type` answers `::call/EvaluationDepthExceededError`; with `~([/] | first | sub 1 | down)` it answers `0`.
   - The page's list of what runs a frame below leaves out the code a verb runs.
   - The page says a part read from its place "runs" a frame below, but it runs nothing; it meets the budget at the frame below, as D202 says.
   - The rewrite left line 254 short.
   - No case holds the frame of the code a verb runs.
   - Repair:
     - The page: "the body of a verb, a modifier computed at the call, `apply`, a constructor of a tag and each run of the code a verb runs, `map ~(…)`, run one frame below the step that called them, a part read from its place meets the budget at that frame, and a quote written as a modifier is a value at the call".
     - D202 says the same.
     - A case of D202: the `map` query at 333, answering `::call/EvaluationDepthExceededError`.
     - The paragraph reflowed.

5. **Sources, not confidence** — minor
   - `D:\git\qlang\docs\research\outside-audit\README.md:25` says D202's call "waits on what answers a promise alone".
   - D202:22-24 and `eval.mjs:806-808` wait on an answer that has a `then`. 4c241046 rewrote this same line and kept the clause.
   - Probe (ran): `grep -n "promise alone" docs/research/outside-audit/README.md`.
   - Repair: "waits on an answer that has a `then` alone".

6. **Sources, not confidence / Executable over narrated** — minor
   `D:\git\qlang\docs\qlang-audit.md:1864-1869`:
   - "`tutorial` reading the page of `doc`" is imprecise. Under the patch, `:vec/doc ~("a reader page") | [1 2] | tutorial | first` answers the page of `::vec`: the page the root's `doc` reads for `[1 2]`, and what `[1 2] | tutorial | first` answers on the tree (ran). "The page of `doc`" names a different page, `::any/doc | doc`.
   - "the probes above answer as the rule asks" is broader than what the patch does. The first probe answers `::bind/NameDeclaredTwiceError` under the patch, as on the tree (ran): the shadowing the maintainer named stays refused by D153. The patch changes only the two probes where a reader's word reaches into a word of the root.
   - "which `…marked-scopes.patch` makes of the tree" states a fact `git apply --check` computes, with no probe. The sentence goes false unseen once the core moves under the patch.
   - Repair:
     - "under it the probes of the reach into a word of the root answer as the rule asks, `tutorial` answering the page of `::vec` and `subOf` answering `300`, the shadowing staying refused [D153]".
     - A shell probe for `check:probes`: `$ git apply --check docs/research/lexical-extension/marked-scopes.patch && echo applies`, answering `applies`.

7. **Prose names the invariant, and the reason lives with the decision** — minor
   - f69b68bf deleted the reasons for two of the line editor's compromises and kept the compromises:
     - The 50 ms window at `D:\git\qlang\cli\src\line-editor.mjs:436-441`, which serves a host that hands over a paste in several chunks with bracketed paste on.
     - ESC+CR and ESC+LF both read as Alt+Enter (`:341-346`), for a host that intercepts Ctrl+Enter.
   - No record under `docs\decisions` holds them (grep for paste, Alt+Enter and Ctrl+Enter, ran).
   - The audit (`:1118-1119`) moves a reason into its decision's record, or deletes it together with the compromise it excuses. The fourth review's repair asked for the deletion alone.
   - Repair: a record of the command line's reading of keys and pastes, its Set aside naming bracketed paste alone. Or delete the window together with its reason.

8. **The order of concepts is the order of dependencies** — minor
   - `D:\git\qlang\core\src\eval.mjs:806-808`: `isThenable` stands between `SCALAR_LITERALS` and `codeOf`. Its first reader is `applyMember` (`:545`).
   - The file sets each constant under the function that first reads it: `ROOT_DEFINITIONS` `:564`, `TAG_KIND` `:609`, `ANY_KIND` `:627`, `ARGS_NAME` `:701`, `MISSED_PLACE` `:736`.
   - Repair: move `isThenable` under `applyMember`, after `:553`.

### Checked, no finding
- **Host boundary**: no `node:` import under `core/src`, in `lsp/src/features.mjs` or in the patch (grep, ran).
- **Where a host's answer enters**: a host's implementation is reached only through `runHostMember` and `constructedBy`. `constructedBy` awaits (`eval.mjs:283`), and an implementation handed for a name that is not a `::builtin{}` under a label is refused at the root (`root.mjs:65`).
- **The other rewritten comments are true of their code**: the heads of `nouns.mjs`, `walk.mjs`, `render.mjs` and the line editor, and the comments of `declaresWord`, `passedUntagged`, `mintUnderTag`, `isThenable`, `parseArgv` and `render.mjs:30` (`session.mjs:47-55`).
- **Laws of the touched pages**: `::vec/map | runLaws` and `::call/EvaluationDepthExceededError | runLaws` are all true (ran).
- **D202 requirements**: `requirements.mjs D202` lists the six cases, all met (ran).
- **Comparisons and negations in the commit messages of the range**: none found that compare states or define by negation.
- **The patch**: it is a prototype under `docs\research`, so I held it to the claims the audit makes about it and to nothing else.
