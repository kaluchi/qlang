## qlang review — modules-are-the-tree-of-names, 1327c652..cd8829fe

**Verdict**: REQUEST CHANGES

**Gates**: I did not run `npm run ci`, as instructed. Exit codes, each captured to a file under `review-3/`:
- `check:conventions` 0, `check:probes` 0, `check-quotes` 0, `requirements.mjs` 0.
- vitest over the six unit files the range touches: 0 (112 tests). `conformance.test.mjs`: 0 (1760 cases).
- `runLaws` over every address that holds a law: 1453 laws, none failing.

These runs used the working tree between 10:13 and 10:14. At that time its core was cd8829fe's except for comments and one renamed parameter (checked by diff). The branch has moved since: 4f1cc1b7, e567e559, 0d851edd and others, and 0d851edd edits `eval.mjs`. So every probe below was rerun on `git archive` exports of b03223ee, 90009e0f and cd8829fe. On the cd8829fe export one law, `::quote/printsADeclarationALine`, fails only because `git archive` wrote CRLF into a string that spans a line.

**Sign of the diff** (numstat 1327c652..cd8829fe):
- core sources (`core/src`, grammar included): +260 −193, net +67
- catalog: +109 −89, net +20
- tests: +93 −431, net −338
- documents: +411 −47, net +364
- tooling: 0

### Findings (13)

1. **One model** — blocker
   - `core/src/eval.mjs:805-819` (d61cd051): `makeLambda` answers a scalar literal's value directly, without the success track.
   - `codeOf` (`eval.mjs:826-828`) builds every quote a word runs as code through `makeLambda`. So a quote whose body is one scalar literal no longer steps around an error it is handed.
   - Every other quote still does (`eval.mjs:157-158`; audit 422-424).
   - Probes, ran on the exports:
     - `[1 ("x" | add 1)] | map ~(0) !| type` answers `::number/add/SubjectNotNumberError` at b03223ee and 90009e0f, and `[0 0]` at cd8829fe.
     - At cd8829fe, `map ~(type)` and `map ~(0 | add 0)` over the same vector still answer the error.
     - `every ~(true)` answers `true` (was the error); `filter ~(true)`, `sort ~(0)` and `groupBy ~(:k)` keep or file the error element.
   - No law or case holds this, and the commit names only the frame budget.
   - Repair:
     - The scalar branch serves only the modifiers of a call (`eval.mjs:481` and `:531`); `codeOf` keeps the success track.
     - Add a case naming D182, `[1 ("x" | add 1)] | map ~(0) !| type` → `::number/add/SubjectNotNumberError`, and a law under `:vec/map`.

2. **The language describes itself** — major
   - `core/lib/qlang/call.qlang:249-251` says "every verb body, modifier, `apply` and constructor of a tag runs one frame below the step that called it". At cd8829fe that is false in two places:
     - a modifier that is a scalar literal, and `apply` of a quote of one, open no frame (d61cd051);
     - a part read from its place opens no frame (90009e0f, `eval.mjs:697, 735-740`).
   - Probes, ran:
     - `:any/down ~(if (gt 0) ~(sub 1 | down) ~(0)) | 499 | down !| type` answers `::call/EvaluationDepthExceededError` at b03223ee and 90009e0f, and `0` at cd8829fe.
     - A chain `:any/w0 ~([3 1] | sort | first)`, then `:any/wK ~(w<K-1>)` up to w999, then `5 | w999 !| type`: `::call/EvaluationDepthExceededError` at b03223ee, `1` at 90009e0f.
   - D202 names no change to the frame budget, and 90009e0f's message says the suites "hold every answer".
   - Repair: the page lists what opens a frame as the tree has it, and D202's Decision says that a part read from its place opens none.

3. **The tests follow what they test** — major
   - ec0d6254 deleted the only pins of two forms. `git grep "print | parse"` finds no other test of either:
     - (a) an error read back from a print whose `:trail` holds a stop: `!{}`, `!{:kind :oops}` and `::construct/TagNotKindError!{…}` evaluated as a step (deleted file, lines 108-119);
     - (b) every payload under a label the source declares, `:Tag1 |~~ Tag1. ~~| | ::Tag1…` (lines 174-243), which reads back through the label's page.
   - The walk (`core/test/unit/print-round-trip.test.mjs:21-51`) builds errors only inside a vector, with an empty trail. Its tags are `::T` and `::E`, which no node answers, plus `::qlang` and `::json`.
   - The ledger (`docs/research/reviews/README.md:127`) says the finding is answered whole because "the walk takes every form of the examples".
   - Probes, ran:
     - All 13 forms hold at cd8829fe (`rt-top.mjs`).
     - Through the walk's own query, these hold: `[("x" | add 1)]`, `[!{:k 1 :trail [{:step ~(count) :subject 1 :skipped ~()}]}]`, `:L |~~ L. ~~| | ::L[1 ::L(2)]` and `:L |~~ L. ~~| | ::L~(| count)`.
   - Repair: add those forms to the walk's pools, and correct the fate in the ledger.

4. **The hierarchy of texts** (audit 395-399) — major
   - `core/src/state.mjs:20` returns the state unfrozen, and `docs/decisions/D202.md:17-19` decides so.
   - The audit says "The evaluator threads a frozen pair of value and environment through steps" (`docs/qlang-audit.md:420`). D202 does not name that sentence; under the hierarchy the lower text changes.
   - Measured on a scratch copy with the freeze restored: the filter query of D202 takes about 640 ms against 565 ms (3846 ms at b03223ee), and the `sumOf` query is about 5% slower.
   - Repair:
     - `makeState` returns `Object.freeze({ pipeValue, env, depth })`.
     - The `Object.isFrozen` assertion comes back to `state.test.mjs`.
     - D202 drops the clause.

5. **The sign of the diff** — major
   - Core sources grow by 67 lines over the range. 90009e0f alone is +138 −78, and its message says "no deletion follows from it" (D151).
   - Repair: name the deletion the plan allows, or bring the core back below zero. Candidates:
     - the `PARTS` cache of `partsOfName` (`nouns.mjs:330-335`), whose word calls are now read once per root in `planIn` (`eval.mjs:588`);
     - `INVARIANTS_READ` (`eval.mjs:317-330`), which caches per list what `derivedOf` already caches per noun (`nouns.mjs:120-131`).

6. **Sources, not confidence** — minor
   - `README.md:122` credits a077e3ef with D200's Requirements; 9b3e058f wrote them.
   - `README.md:132` credits 9b3e058f with the ledger's quote and the open count; 791c3a99 wrote them.
   - Probe: `git show --stat` of the three commits (ran).
   - Repair: name 9b3e058f and 791c3a99.

7. **Sources, not confidence** — minor
   - `docs/decisions/D200.md:12-16` and `outside-audit/README.md:25` say a call "copies the frame of its source's bare values alone … and walks it alone for … its parts, its invariants".
   - In the code:
     - `scopeOfMember` (`eval.mjs:665-673`) also copies every name with a path in the caller's frame;
     - since D202, parts and invariants come from the plan read once per root (`eval.mjs:573-575`).
   - Neither record links the other.
   - Repair: "…and the names with a path of the caller's frame". D202 says "Replaces in part [D200]", and D200 says "Replaced in part by [D202]".

8. **Sources, not confidence / The maintainer's words bind** — minor
   - `docs/qlang-audit.md:1826-1829` (line numbers at cd8829fe) states that an address read as data reaches the reader's node, with no probe.
     - Probe, ran: `:vec/second |~~ The second element. ~~| ~(/1) | ::vec/second | tutorial | first` → `|~~ The second element. ~~|`.
   - `:1809-1813` cuts the message before «т.к. короткое имя смотрит в локальную область видимости и потом прямо в то что привязано к типу текущего сабжекта? так..» (session 86982eb5).
     - The maintainer was asking how a short name resolves, and the audit presents that as his reading of the rule.
     - The same words grant shadowing («затенять»), which the tree refuses: `:vec/count ~(99) | [1] | count !| type` → `::bind/NameDeclaredTwiceError` (ran).
   - `:1835-1837` and `D202.md:37-40` credit the first two alternatives with "the plan of a word of the root read once whatever the reader declares".
     - No alternative gives that to the reader's own call: `:number/add/addend/TooBigError ::holds~(lt 100) | 1 | add 200` reads its plan in the reader's scope under every alternative (`34-labels-and-parts.jsonl:27`).
   - Repair:
     - Add the probe.
     - Quote the message whole, with its question mark, and note the shadowing the tree refuses.
     - The cost reads "the plan of a call inside a word of the root".

9. **Executable over narrated** — minor
   - `D202.md:44-47` requires that a reader's part, invariant or answer under a word of the root changes the next call. One case holds this, and only for the invariant of a part.
   - No word of the root lacks `answer` (ran: 176 words, none without one), so a reader can only add an invariant to an answer.
   - Probes, ran, same answer on b03223ee and cd8829fe:
     - `1 | add 200 | :before / | :number/add/answer/Small ::holds~(lt 100) | 1 | add 200 !| [before type]` → `[201 ::number/add/answer/Small]`
     - `1 | add 2 3 !| type | :before / | :number/add/extra ~(/1) | 1 | add 2 3 | [before (/)]` → `[::number/add/ArgsBeyondPartsError 3]`
   - `D202.md:19-21` also decides a non-change: the hidden slots stay out of the enumeration.
   - Repair: make both probes cases naming D202; the Requirements say "an invariant of its answer"; the clause on slots moves to Set aside.

10. **Executable over narrated** — minor
    - At cd8829fe no case names D203: `git grep -n D203 cd8829fe -- core/test` is empty (ran). 4f1cc1b7, after the range, adds one.
    - `D203.md:6-11` calls `:nearest` the keys the miss "was likely meant to be", but a one-letter miss suggests every one-letter key:
      - `{:x 1 :y 2 :z 3} | /w !| /nearest` → `[:x :y :z]` (ran);
      - `21-json-literals.jsonl` pins `:nearest [:a]` for `/b`.
    - Repair: D203 states what the distance measure gives short keys, or `nearestKeys` makes no edit-distance suggestion below three letters.

11. **Prose names the invariant** — minor
    - `grammar.peggy:43-45` carries its reason ("where peggy's `location()` walks the input"). Repair: "The offsets where the lines of the input begin, which `span()` reads a node's lines and columns from."
    - `grammar.peggy:10-11` still says `.location` holds "peggy's start/end offsets"; `span()` (`:59-63`) computes it now.
    - `eval.mjs:567-572` (`planOf`) is two sentences. `eval.mjs:171-176, 246-253, 288-292, 540-546, 675-683` stay multi-sentence in a file four commits of the range touch.
    - `print-value-extras.test.mjs:1-5` says the tests "build the values directly" and uses "Function value", "pipeValue" and "ceremony". The suite moved in at `:263-287` runs queries.
    - Repair: one sentence each, stating what holds.

12. **Words carry paradigms** — minor
    - "plan" (`planOf`, `planIn`, `ROOT_PLANS`, D202) names a word's parts with their invariants and its answer, which the language calls the word's definition [D179]. Repair: `definitionOf`.
    - These compare two states:
      - `D202.md:44` "as they were";
      - `outside-audit/README.md:25` "the time they took";
      - d61cd051's message "stands as it stood";
      - e9904df5's message "as they were".
    - "Environment" stands where the language says scope at `eval.mjs:1`, `:57`, `:821-825` and `types.mjs:144`.

13. **The tests follow what they test** — minor
    - `print-value-extras.test.mjs:264-269` prints `env` of a fresh query, which is `{}` (ran on the export), so its three checks hold of an empty map.
    - `json-bridge.test.mjs:118-120` holds a projection, `::builtin{:note :draft} | /note`, in the file of the JSON bridge.
    - Repair:
      - Evaluate `:f ~(add 1) | :v 5 | :T |~~ A kind. ~~| | env`; it prints three binding records the parser reads (ran).
      - Move the projection test next to the projections.

### Checked, no finding
- **e9904df5 (grammar):** the 1327c652 and cd8829fe parsers agree on 97 targeted sources, the 34 catalog and sister-project sources with their CRLF copies, 1758 case queries and 70,000 fuzzed sources. Compared:
  - trees, `.location` and `.comments`;
  - errors (message, location, found, sentence), with `:expected` compared after `errorFromParse`'s dedup. Before the dedup the raw lists differ on 9 inputs.
  - peggy 5.1.0 counts lines by `\n` and columns in UTF-16 units, as `span()` does.
- **D202's caches:** 18 probes answer alike at b03223ee, 90009e0f and cd8829fe. They cover a reader's names under a root word, a reader's label, a later source adding a part to an earlier source's word (during and after its run), the frame of a source's bare values, and a scope with no root. Both caches read only names under the address, root first, and every scope Map is complete before `pathNamesOf` reads it.
- **Ledger fates** 2, 4, 5, 7, 8, 9 and 10 hold. For fate 5, `'!{'` occurs 9 times in the catalog: 6 in laws, 3 in pages.
- **Stored review report:** byte-identical to the reviewer's handback (`agent-afbc8477500782bd1`).
- **b03223ee catalog diff:** whitespace only, apart from one law renamed and its page changed. No backquote span is broken across lines in either file it touches.
- **Host boundary:** no `node:` import in `core/src` or `lsp/src/features.mjs`.
- **Commit messages:** each commit's stated sign matches its numstat.
- **D202 timing:** confirmed. 3846 → 731 ms and 534 → 173 ms.

All scratch files are in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-3\`:
- the exports `tree-head`, `tree-base`, `tree-90009` and `tree-freeze`;
- the scripts `cmp.mjs`, `pdiff.mjs`, `fuzz.mjs`, `fuzz2.mjs`, `rt-top.mjs`, `alllaws.mjs` and `time.mjs`;
- the logs and exit codes of the gates.
