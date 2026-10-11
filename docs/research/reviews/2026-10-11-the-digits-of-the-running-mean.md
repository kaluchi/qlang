## qlang review — 7ae8d5c6..5269315e on `modules-are-the-tree-of-names`

**Verdict**: REQUEST CHANGES. There is one major finding.

**Gates**: I did not run `npm run ci`, as you asked. These ran:
- `npm run check:conventions`: exit 0
- `npm run check:probes`: exit 0
- `node scripts/sensors/check-quotes.mjs`: exit 0
- `node scripts/requirements.mjs`: exit 0
- vitest on `catalog-laws`, `conformance` and `eval-smoke`: exit 0, 1817 passed

**Sign of the diff** (numstat, matching both messages):
- core sources: +7 −9
  - `vec.mjs`: +5 −6
  - `eval.mjs`: +2 −3
- catalog: +28 −11
- documents: +129 −0
- tests: 0

### Fates checked
1. **True.** The step equals e129cd54's step for as long as the gap stays finite. At the first infinite gap, e129cd54's mean becomes infinite and then NaN, so it never answers finite again.
   - Ran `review-11/mean-diff.mjs`: e129cd54's primitives against HEAD's on vectors, sets and maps.
   - 723,000 runs in 13 families: small, decimal, unit, mixed, near the ends, the whole range, subnormal, constant, long.
   - Where e129cd54's mean is finite: 0 differences.
   - On HEAD: 0 non-finite answers and 0 answers outside the least and greatest element.
   - The law body of `answersTheSumOverTheCount` answers `false` on the 7ae8d5c6 tree (ran).
2. **True.** `vec.mjs:72-74` states the invariant in one sentence, and the invariant holds (the same differential).
3. **True to the tree.** The pages and the laws stand as the fate says, but two of the claims are false (findings 1 and 2).
4. **True.**
   - `crash-fuzz.mjs` and `crash-fuzz.progress` are in the session's scratch folder; line 138 of the progress file reads 137000.
   - Neither 62d138f6 nor 5269315e gives a count of mutants.
5. **True.**
   - `kindsNamedBy` (`nouns.mjs:169-173`) answers a non-empty list of tag names.
   - `typeKeyword` (`types.mjs:359`) is total and pure.
   - So `kinds.find(kind => kind === own)` answers `own` exactly where `kinds.includes(own)` answered true, and undefined where it answered false.

The stored review matches the tenth reviewer's handed-back report except for the final newline. I diffed it against the subagent transcript.

### Findings (4)

1. **The language describes itself** — major
   - **Where:** `core/lib/qlang/vec.qlang:241-243`.
   - **What holds there:** the doc says "The mean of numbers whose sum stays among the doubles is that sum over their count." That is false (ran):
     - `[0 1 0] | avg` answers `0.33333333333333337`; `[0 1 0] | sum | div 3` answers `0.3333333333333333`.
     - `[0 1 6 1] | avg` answers `1.9999999999999998`, while the mean, and `sum | div 4`, is `2`.
     - `[0.1 0.1 0.1] | avg` answers `0.1`; `| sum | div 3` answers `0.10000000000000002`.
   - **How often:** 374 of the 2,197 vectors of three whole numbers in 0..12 differ (`review-11/sum-over-count.mjs`, ran).
   - **What the law covers:** it holds the one instance `[0 1 4]`. No statement of the page says "the sum over the count" (D179).
   - **Repair:**
     - Name the law for its instance: `:vec/avg/averagesZeroOneAndFour`, "The mean of zero, one and four is their sum over three."
     - Add a sentence to the page of `:vec/avg` saying the last digit is the running mean's, `[0 1 6 1] | avg` answering `1.9999999999999998`, with a law of that.
     - Dividing the sum first does not repair this: it answers `0.10000000000000002` for `[0.1 0.1 0.1]`, which is past every element.

2. **The language describes itself** — minor
   - **Where:** `vec.qlang:255`, `set.qlang:275`, `map.qlang:314`.
   - **What holds there:** "The mean of two numbers near the opposite ends of the doubles is zero." That is false: `[1e308 -1.5e308] | avg` answers `-2.5e+307` (ran).
   - **Page sentences** (`vec.qlang:218`, `set.qlang:247`, `map.qlang:284`): they say the mean "stays among the doubles". The first page (`core/lib/qlang.qlang:10`) calls numbers "finite doubles", and the comment at `vec.mjs:72-73` says "the finite doubles".
   - **Repair:**
     - The laws' doc: "The mean of a number near one end of the doubles and its negation is zero."
     - The pages: "the mean of numbers stays among the finite doubles".

3. **The tests follow what they test** — minor
   - **Where:** `core/src/runtime/vec.mjs:81`.
   - **What holds there:** no law holds the divisor `count + 1` of the step taken when the gap is past the doubles. Every law and case that reaches that step has two elements.
   - **The gap this leaves:** a step that divides by `2` passes all of them. On `[1e308 1e308 1e308 -1e308]` that step answers `0`, where HEAD answers `5e+307` (ran in node and qlang).
   - **Repair:** add a law under `:vec/avg` holding `[1e308 1e308 1e308 -1e308] | avg | eq 5e307`. It also fails on e129cd54, whose mean there is `-Infinity`.

4. **Executable over narrated** — minor
   - **Where:** `docs/research/reviews/README.md:253`.
   - **What holds there:** the fate leaves `::number!{:a 1} !| /` as "a question of which tags an error literal may carry".
   - **Where it is not written:** neither the chapter "Open questions" (`docs/qlang-audit.md:1538`) nor any target case holds it.
   - **The defect at HEAD:** the command line still exits 1 with `NumberNotFiniteLeakedToPrintError` and a host stack (ran).
   - **Repair:** add the question to the audit's open questions with its alternatives and their cost, as CLAUDE.md asks of a hole.

### Checked without a finding
- On HEAD (ran): `[0 1 4] | avg` answers `1.6666666666666667`, and `[1e308 -1e308]`, `#[1e308 -1e308]` and `{:a 1e308 :b -1e308}` each answer `0` under `avg`.
- `runLaws` (ran): all laws hold, 6 under `::vec/avg`, 4 under `::set/avg` and 3 under `::map/avg`.
- The bodies of the three end laws throw `NumberNotFiniteLeakedToPrintError` on the e129cd54 tree (ran).
- `eval.mjs:615-622`: the comment of `answerUnderItsLabel` still says what the code does.
- `grep -rn "from 'node:" core/src/` is empty, and `lsp/src/features.mjs` imports nothing of Node.
- The working tree is clean; I edited nothing.

My scripts and their outputs are in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-11\`:
- `mean-diff.mjs` (output in `mean-diff.out`)
- `sum-over-count.mjs`
- `sum-first.mjs`
- `handback.mjs` (writes `hb2.md`)
- the gate logs
