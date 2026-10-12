## qlang review: modules-are-the-tree-of-names, 926f2476..ac91c086

**Verdict**: REQUEST CHANGES. Findings 1 and 2 are major, and findings 3 to 5 are minor.
- Findings 1 and 2 are each a reading this range wrote that no test holds. I rated them major because the seventh review rated the same kind of gap major. The rule's own wording, "a behaviour without its case", would make them blockers.
- Each repair is one test case.

**Gates**: I did not run `npm run ci`, as instructed. I ran each of these and saved its exit code in a file under `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-9\`:
- `check:conventions`: exit 0.
- `check:probes`: exit 0. The probes at `docs/qlang-audit.md:1716`, `:1718` and `:1012` are ok.
- `check-quotes.mjs`: exit 0. `D204.md:46` is ok.
- `requirements.mjs`: exit 0. It lists D204 among the tests of the command line.
- vitest on `cli/test/line-editor.test.mjs`: exit 0, 99 tests pass.

`git status` is clean, and I removed the scratch `node_modules` junction.

**Sign of the diff** (numstat, ran). Each commit's stated sign matches its numstat.
- Core sources: 0.
- Catalog: 0.
- Command line: +15 −12.
- Command-line tests: +42.
- Documents: +155 −32. That is D204 +41 −30, the audit +3 −2, the stored review +97 and the ledger +14.

### Fates of the eighth review (`D:\git\qlang\docs\research\reviews\README.md:221-227`)
1. **Holds.** `line-editor.mjs:488` reads `!typedAlone`. The cases at `:585` and `:592` fail on 926f2476's editor and pass on HEAD (`run-editors.mjs`, ran). D204 says it at `:19-23`. The same keys delivered in one chunk still pair with the escape (finding 3).
2. **Holds.** `D204.md:12-14` and `:17-19`.
3. **Holds.** The case at `:599` is the only case that fails when `firstNewline !== chunkText.length - 1` is cut (`mutate.mjs`, ran).
4. **Holds in part.**
   - `:348` and `:471` read as the fate says.
   - The editor reads an emoji of one code point as it reads a letter, but an emoji of several code points it reads otherwise (finding 4).
   - "Two tests hold both" is true for the escape before the emoji and for the rule of the Escape key. No test holds the code-point count inside `keys` (finding 2).
5. **Holds.** `docs/qlang-audit.md:1728-1730`. The fifth milestone's line on `:trail` is at `:1481-1483`.
- **Last paragraph:** holds for the end marker. The case at `:578` fails when the end marker is taken out only once. No test holds the begin marker (finding 1).
- **The stored eighth review** is the handback of agent-a62c77e424dc337d9 word for word, apart from the final newline (`review-8/handback.mjs`, ran).

### Findings (5)

1. **The tests follow what they test / Executable over narrated**: major
   - **The claim.** `D:\git\qlang\cli\src\line-editor.mjs:520` takes every begin marker out of a gathered paste. `D:\git\qlang\docs\decisions\D204.md:59-60` and `:70` say the tests hold "every bracket marker it holds taken out".
   - **What no test holds.** The case at `D:\git\qlang\cli\test\line-editor.test.mjs:578` holds end markers only. I made two copies of the editor, one that takes the begin marker out once and one that leaves it in. All 99 cases pass on both (`mutate.mjs`, ran).
   - **What those copies do.** `'p\r\nq'+BEGIN+'r', 's'+BEGIN+'t', CR`:
     - On HEAD it answers `["p\nqrst"]`.
     - On the copy that takes it out once it answers `["p\nqrs\u001b[200~t"]`.
     - On the copy that leaves it in it answers `["p\nq\u001b[200~rs\u001b[200~t"]` (`probe.mjs`, ran).
   - **Repair:** add the case `feed(stdinStream, 'p\r\nq' + BRACKETED_PASTE_BEGIN + 'r', 's' + BRACKETED_PASTE_BEGIN + 't', SUBMIT)` → `['p\nqrst']`.

2. **The tests follow what they test / Executable over narrated**: major
   - **The reading.** `line-editor.mjs:471-472` counts code points inside `keys` too, so a character beyond the basic plane typed alone ends a gathering, as a letter does.
   - **What no test holds.** On a copy whose `keys` counts code units again, all 99 cases pass (`mutate.mjs`, ran).
   - **What that copy does.** `'one\r\ntwo\r\n', '\u{1F600}', CR` answers `["one\ntwo\n😀"]`. HEAD answers `["one\ntwo😀"]`, as it does for `x` (`probe.mjs`, ran).
   - **The claims.** `README.md:224` says "two tests hold both", and `D204.md:68-69` says "a character beyond the basic plane typed alone is one key". The case at `:606` holds only the rule of the Escape key at `:488`.
   - **Repair:** add the case `feed(stdinStream, 'one\r\ntwo\r\n', '\u{1F600}', SUBMIT)` → `['one\ntwo\u{1F600}']`.

3. **Prose names the invariant**: minor. This predates the range; a22bfa72 gives the same answers.
   - **The defect.** When an escape and a second escape arrive in one chunk, `line-editor.mjs:348` drops both, and the rest of the key is typed (`probe.mjs`, ran):
     - `'abc', ESC+ESC+'[D', 'X', CR` answers `["abc[DX"]`. Split as `ESC, ESC+'[D'` (the case at `:585`), the same keys answer `["abXc"]`.
     - `'one\ntwo', ESC+ESC+'[D', 'X', CR` answers `["one\ntwo[DX"]`. That makes `D204.md:15-16`, "Keys end the gathering and are read as the keys they are", false for this chunk.
     - `ESC+BEGIN+'one\r\ntwo'+END, CR` answers `["[200~one","\ntwo"]`. This is the symptom of the eighth review's finding 1.
   - **Where it happens.** `ESC ESC [D` is Alt+Left in a terminal whose Alt sends an escape before the key. It is also the chunk a reader sends who presses Escape and an arrow while an answer is being computed.
   - **Repair:**
     - At `:312-316`, an escape that arrives while one is pending opens its own sequence: `if (ch === ESC) { pendingEscape = ESC; return; }`.
     - D204 says that an escape before an escape is the Escape key.
     - On a copy with that line, the three deliveries answer `["abXc"]`, `["one\ntwXo"]` and `["one\ntwo"]`, and all 99 cases pass. Over the 30783 deliveries it differs from HEAD only where an escape arrives while one is pending, 2776 of them (`diff-repair.mjs`, ran).
     - Add the cases `feed(stdinStream, 'abc', ESC + ESC + '[D', 'X', SUBMIT)` → `['abXc']` and `feed(stdinStream, ESC + BRACKETED_PASTE_BEGIN + 'one\r\ntwo' + BRACKETED_PASTE_END, SUBMIT)` → `['one\ntwo']`.

4. **Prose names the invariant**: minor
   - **The claim.** `D:\git\qlang\docs\research\reviews\README.md:224` says "the editor reads an emoji as it reads a letter". That holds for an emoji of one code point.
   - **Where it fails.** An emoji of several code points typed alone is a chunk of several characters, so it is read as text (`probe.mjs`, ran):
     - `ESC, '❤️', 'x', CR` answers `["❤️x"]`, and so do `👍🏽` and `🇺🇦`. `ESC, 'й', 'x', CR` answers `["x"]`.
     - `ESC+'❤️', 'x', CR` types a lone variation selector: `["\uFE0Fx"]`.
   - D204 itself is exact: "a character beyond the basic plane" (`D204.md:68`).
   - **Repair:** `README.md:224` reads "the editor reads a character beyond the basic plane as it reads a letter".

5. **Prose names the invariant**: minor. This predates the range (d0e9e21c), but the range touches the file.
   - **The comment.** `line-editor.mjs:6-8`, the comment at the top of the file, says "a paste, bracketed or a chunk longer than one character whose first line break is not its last, landing whole at the cursor".
   - **Where it is false.** A chunk that begins with an escape and holds a line feed before its end is read as keys (the case at `line-editor.test.mjs:641`). It does not land as a paste.
   - **Repair:** "a paste, bracketed or text whose first line feed is not its last character, landing whole at the cursor".

### Checked, no finding
- **Counting a key typed alone by code points changes no earlier reading.** I ran 30783 deliveries of up to three chunks over 31 chunks (`diff.mjs`, `classify.mjs`, ran). The chunks include:
  - keys of one code unit, Alt+key, and both spellings of Alt+Enter, whole and split;
  - escape sequences split after the escape and after `[`;
  - bracketed pastes;
  - text holding a begin marker;
  - an emoji whole and split across its bytes.
- **HEAD against the eighth review's repaired copy** differs on 2472 deliveries:
  - 2338 of them vanish when the emoji is replaced by a one-code-unit letter.
  - 134 are gatherings that hold a second marker (`replaceAll`).
  - By cause:

    | Change | Deliveries |
    |---|---|
    | The drop rule | 2206 |
    | `replaceAll` | 132 |
    | The count inside `keys` | 69 |
    | The count inside the Escape-key rule | 5 |
    | The count and `replaceAll` together | 2 |
    | The count and the drop rule together (`ESC`, then `😀` typed alone) | 58 |
- **The eighth review's copy against the other editors:**
  - Against a22bfa72: 4370 differences, each with a chunk that begins with an escape and holds a line feed before its end.
  - Against 926f2476: 606 differences, each an escape alone before a chunk that begins with an escape.
- **Your summary is incomplete.** It says the editor differs from the review's copy "only on deliveries with an emoji". It leaves out the gatherings with a second marker. Your own `diff-editor.mjs` prints 52 of them, and the ledger's last paragraph names them.
- **An emoji reads as a letter.** Over 17679 valid deliveries holding an emoji of one code point, HEAD reads it as it reads a one-code-unit letter, with 0 differences. The eighth review's copy differs on 2381 (`emoji-letter.mjs`, ran).
- **`pendingEscape[1] !== '['` at `:348` is never reached with a one-code-unit escape.** `tryConsumeEscapeSequence` is called only at `:314`, after `pendingEscape += ch` under `pendingEscape.length > 0`. `ch` comes from `for (const ch of chunkText)` at `:502` and is never empty. `:321` sets `ESC` and returns.
- **The fifteen clauses you named** each fail a case when cut on my copy, as you said (`mutate.mjs`, ran).
- **The rest of D204 states what the code does**, sentence by sentence. The exceptions are `:15-16` (finding 3) and the two Requirements in findings 1 and 2. Every other Requirement has its case at `:543`, `:550`, `:557`, `:564`, `:571`, `:585`, `:592`, `:599`, `:606`, `:613`, `:620`, `:627`, `:634`, `:641`, `:648`, `:133` and `:140`.
- **The open question at `docs/qlang-audit.md:1708-1730`** prices its third alternative as the eighth review asked, and its probes answer as written.
- **No test is skipped**, and no `.only` is left in the test file.
- **Host boundary.** No `node:` import under `core/src` or in `lsp/src/features.mjs`. The range touches neither.

Everything is in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-9\`: the scripts named above and the editor copies under `variants\`.
