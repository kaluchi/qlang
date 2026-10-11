## qlang review — 7ae8d5c6 on `modules-are-the-tree-of-names`

**Verdict**: REQUEST CHANGES

**Gates**: I did not run `npm run ci`, as you asked. These ran:
- `npm run check:conventions` exit 0
- `npm run check:probes` exit 0
- `node scripts/sensors/check-quotes.mjs` exit 0
- `node scripts/requirements.mjs` exit 0
- vitest on `eval-smoke`, `catalog-laws` and `conformance`: exit 0, 1817 passed

**Sign of the diff**:
- core sources +11 −5 (code +3 −1, comments +8 −4)
- catalog +8 −0
- tests +12 −0
- documents 0

### Findings (5)

1. **The language describes itself** — major
   - **Where:** `core/src/runtime/vec.mjs:82`.
   - **What holds:** the step `element / (count + 1) - mean / (count + 1)` rounds three times; e129cd54's `(element - mean) / (count + 1)` rounded twice. So `avg` of a vector, a set and a map answers differently on ordinary numbers. No law, page or message states this change.
   - **Named inputs** (ran on both command lines):
     - `[0 1 4] | avg`: e129cd54 answers `1.6666666666666667`, which is also what `[0 1 4] | sum | div 3` answers; 7ae8d5c6 answers `1.6666666666666665`.
     - `[0 1 7]`: `2.6666666666666665` on e129cd54, `2.666666666666667` on 7ae8d5c6.
     - `[41.4 47.4 14.5 37.6 9.6]`: `30.099999999999994` on e129cd54, `30.1` on 7ae8d5c6. Here 7ae8d5c6 is the closer one.
   - **Exhaustive count:** every vector of two or three integers in 0..30 and of four or five in 0..12, 430,606 vectors. e129cd54's mean is the correctly rounded `sum / count` in 424,747 of them, 7ae8d5c6's in 408,768.
   - **Random vectors** (20,000 per family): the two means differ by 1–2 ulps in:
     - 14% of small-integer vectors; 7ae8d5c6 is closer to the exact mean in 1,074 of the 2,812 that differ.
     - 16–20% of decimal vectors.
     - 17% of unit floats; 7ae8d5c6 is closer in 1,409 of 3,497.
     - For mixed magnitudes 7ae8d5c6 is closer in 3,208 of 5,385.
   - **Nothing states a digit these break:** the means the pages and the D147 cases state (2.5, 3, 2, 1.5, `{:a 2 :b 5}`) and benchmark Q14 (600.5, 80, 61) answer alike on both trees. `D:\git\eclipse-jdt-search` has no `avg`.
   - **Repair:** use this step:
     ```js
     const gap = element - mean;
     mean += Number.isFinite(gap) ? gap / (count + 1) : element / (count + 1) - mean / (count + 1);
     ```
     - It answers as e129cd54 on every vector whose e129cd54 mean is finite: 0 differences over 300,000 vectors in six families, subnormals and the ends included.
     - It stays finite and between the least and greatest element on all of them, and both laws the commit adds hold under it.
     - A branch-free alternative, `(element / 2 - mean / 2) / (count + 1) * 2`, matches e129cd54 above the subnormals (0 differences over 250,000 vectors).
     - The law `[0 1 4] | avg | eq ([0 1 4] | sum | div 3)` fails on 7ae8d5c6's step.

2. **Prose names the invariant** — major
   - **Where:** `core/src/runtime/vec.mjs:72-76`.
   - **What holds:** "so neither a partial sum nor the gap between two numbers at opposite ends leaves the finite doubles" defines the step by two values it never forms. That is a negation that defines, carrying a reason that belongs to D147 (which records the partial sum).
   - **False as written:** the gap between `1e308` and `-1e308` is `2e308`, which is past the doubles.
   - **What actually holds:** every step and the running mean stay among the finite doubles. The comment grows by two lines for the denial.
   - **Repair:** "The mean of the numbers, a running mean whose every step stays among the finite doubles; an empty container has none, and answers null as `min` and `max` do [D147]." That fits in the three lines the comment had.

3. **The language describes itself** — minor
   - **Where:** `core/lib/qlang/vec.qlang:248-254`.
   - **Page:** the two laws settle a question the page of `:vec/avg` (215-224) never asks, the mean at the ends of the doubles. D179 gives a word "its laws, one for each question the page settles".
   - **Claims:** they say "the two ends of the doubles", but the literal `1e308` is not an end; the greatest double is `1.7976931348623157e308`.
   - **`:set/avg` (`set.qlang:244`) and `:map/avg` (`map.qlang:281`):** their answers change the same way and their laws stay as they were. On e129cd54, `#[1e308 -1e308] | avg` and `{:a 1e308 :b -1e308} | avg` answer a refusal whose print throws; on 7ae8d5c6 they answer `0` (ran).
   - **Repair:**
     - Add a sentence to each of the three pages: the mean of finite numbers stays among the doubles, `[1e308 -1e308] | avg` answering `0`.
     - Either the claims say "two numbers near the opposite ends", or the literals become `±1.7976931348623157e308`. Those answer `0` and the end (ran).
     - Add one law under `:set/avg` and one under `:map/avg`.

4. **Executable over narrated** — minor
   - **Where:** the commit message: "over 137,100 mutants after the repair, no host failure and no throw".
   - **What holds:** no script in the tree runs that fuzz. `grep -rli "mutant\|fuzz" scripts core/test cli/test` finds nothing (ran).
   - **Repair:** land the fuzz under `scripts/sensors/` so it prints its count, or drop the claim from later messages. This message stays as written.

5. **The sign of the diff** — minor
   - **What holds:** core sources grow by 6 lines net and tests by 12. No model is introduced and nothing is named for deletion (D151).
   - **Where:** `core/src/eval.mjs:629-631` spells the constructor step twice: `kinds[0]` for one label, and the answer's own kind among several labels.
   - **Repair:** fold them into one statement:
     ```js
     const constructing = kinds.length === 1 ? kinds[0] : kinds.find(kind => kind === typeKeyword(answer).name);
     if (constructing !== undefined) return mintUnderTag(state, makeTagKeyword(constructing), answer);
     ```
     Together with the comment from finding 2, that takes three lines off the core.

### Checked without a finding
- **Caller:** `answerUnderItsLabel` has one caller, `applyMember` (`eval.mjs:547`), reached by name, by address and through `callMemberOn`. An error answer returns before it (`eval.mjs:546`).
- **Reach of `eval.mjs:630-631`:** it only meets an answer whose `type` names a label that the walk's kind test (`verb.mjs:32-41`) refuses:
  - a number past the finite doubles;
  - a value whose outer tag is `::number`, `::vec` or `::map` over a payload of another kind.

  A finite number, a set, a quote, a doc, a tagged value, a map under a label and a reader's own kind are all reached by the walk first.
- **Differential, the 12 core words with several labels** (`avg`, `union`, `minus`, `inter` of vectors, sets and maps, `any/source`, `any/doc`, `explanation/page`): 29,620 queries over 73 subjects and modifiers of every kind, plus the fail track on 11 errors.
  - 9 answers differ, all `avg` at opposite ends on a vector, a set and a map: a refusal whose print threw on e129cd54, `0` on 7ae8d5c6.
  - The other printed differences are `source` of `::vec` and `::vec/avg`, which now carry the two added laws.
- **Differential, a reader's words** under `::Box` and `::any`, 158 sets of labels over the 73 values (23,068 queries): 60 differ.
  - Each is `::number!{:a 1} !| /` or `::vec!{:a 1} !| /` answered under labels that include that kind.
  - e129cd54 refuses it as `…/answer/Not…Error`. 7ae8d5c6 refuses it as `::number/PayloadNotNumberError` / `::vec/PayloadNotVecError`, the same refusal `::number` alone gives (ran).
  - Its print throws on both trees.
- **Host words, 140 answers:**
  - A non-finite number under labels that include `::number` answers `::number/NotFiniteError`, which prints.
  - A host's `::map`-tagged vector of pairs under `#[::map ::set]` or `#[::map ::null]` answers the map `{:a 1 :b 2}`; e129cd54 refused it.
  - A forged `::number`, `::vec` or `::map` tag over another payload answers that kind's `PayloadNot…Error`.
  - Under labels without `::number`, a non-finite answer stays a refusal whose fact cannot print. That is a host defect, the one `builtin/NumberNotFiniteLeakedToPrintError` names.
- **Finiteness of 7ae8d5c6's mean:** finite and between the least and greatest element over 221,000 random vectors. 40,000 of them are near the ends, where e129cd54's mean overflowed in 31,645.
- **The two laws:** `averagesTheOppositeEnds` fails on e129cd54's mean with either evaluator. `averagesOneEnd` holds on e129cd54 too and only fails under a mean that sums first; the message's "the first failing" says as much.
- **The unit test:** answers `false` on e129cd54's evaluator (`::any/past/answer/NotNullOrNumberError`) and `true` with 7ae8d5c6's evaluator alone, checked on mixed trees.
- **Comment of `answerUnderItsLabel`** (`eval.mjs:615-622`): says what the code does.
- **The message's account of the crash** (ran):
  - e129cd54's command line exits 1 on `[1e308 -1e308] | avg` with `NumberNotFiniteLeakedToPrintError`, thrown from `elideAnswer`.
  - `!| type` answers `::vec/avg/answer/NotNullOrNumberError`.
  - The numstat matches the message's counts.
- **Host boundary and order:** `grep -rn "from 'node:" core/src/` is empty, and the laws sit in story order.

### Outside the commit
- `core/src/eval.mjs:180`: `!|` lays the error's own tag over its opened facts with `makeTaggedInstance`, without running the constructor.
  - So `::number!{:a 1} !| /` puts into the pipe a `::number` that no literal reads back.
  - The command line exits 1 printing it (`NumberNotFiniteLeakedToPrintError`; a `TypeError` for `::vec!{…}` and `::map!{…}`), on both trees.
  - Apart from host values, this is the only kind of value that reaches the commit's new line.

### Scripts
Under `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-10\`:
- `mean-diff.mjs`, `mean-examples.mjs`, `guarded.mjs`, `halved.mjs`, `tiny-acc.mjs`
- `queries.mjs`, `run-diff.mjs`, `cmp2.mjs` (outputs in `out-*.jsonl`)
- `host-diff.mjs`, `unit-replica.mjs`
- the trees: `old\`, `new\`, `mixEval\`, `mixMean\`
