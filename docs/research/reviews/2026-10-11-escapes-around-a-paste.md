## qlang review — modules-are-the-tree-of-names, 8f36d29e..a22bfa72

**Verdict**: REQUEST CHANGES. Findings 1 and 2 are major, and 3 to 6 are minor.

**Gates**: I did not run `npm run ci`, as instructed. Every gate I ran exits 0, each exit code captured to a file in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-7\`:
- `check:conventions`: 0.
- `check:probes`: 0. The audit's probe of the documents lists the sixth review.
- `check-quotes.mjs`: 0. `D204.md:39` is ok.
- `requirements.mjs`: 0. It lists D204 under the tests of the command line, and D202's renamed cases as met.
- vitest `cli/test/line-editor.test.mjs`: 0, 88 tests.
- vitest `core/test/unit/conformance.test.mjs`: 0, 1769 tests.
- `qlang '::vec/map | runLaws'`: 13 laws, all ok.

**Sign of the diff** (numstat, ran). Each commit's stated sign matches its numstat.
- Core sources: +4 −4.
- Catalog: +1 −1.
- Conformance tests: +2 −2.
- Command line: +17 −12.
- Command-line tests: +103 −122.
- Documents: +166 −25. D204 is +46 −24, the stored review +103, the ledger +15 −1, the audit +1.

### Fates of the sixth review (`D:\git\qlang\docs\research\reviews\README.md:194-200`)
1. **Holds in part**: see findings 2 and 4. The three new tests fail on the editor of 8f36d29e and the fourth passes there (ran).
2. **Holds.** Each Source sentence matches the message or the diff of its commit (`git show`, ran):
   - d5b93889 describes the PowerShell chunks and the window of 50 ms.
   - b314edff (`line-editor.mjs`) says "Some terminals send ESC+CR, others ESC+LF; … hosts where Ctrl+Enter is intercepted".
   - 5f40a15d swaps the keys and keeps Alt+Enter.
   - f69b68bf deleted both reasons.
3. **Holds.** The law is true of the page, and all 13 laws of `::vec/map` hold (ran).
4. **Holds.** No stale name is left (`git grep`, ran).
5. **Holds.** `README.md:177` is true: the fifth review's fates 3, 5, 6, 8 and 10 are its findings 1, 4, 3, 2 and 6 (grep, ran).
6. **Holds.** `D:\git\qlang\core\src\state.mjs:21-22`, `:27-28` and `:33`.
7. **Holds.** I read each rewritten comment against its case's code, and every one is true. No comment of the file defines by negation (grep, ran).

The stored sixth review is identical to the handback of agent-a6a65bcabe29afeda, 9766 characters, apart from the final newline (ran).

### Key readings run against the editor
I ran each reading on exports of 8f36d29e and a22bfa72 (`harness.mjs`, ran).

These answer the same on both:
- A split arrow: `'abc', ESC, '[D', 'X', CR` answers `["abXc"]`. Split as `ESC, '[A'` it recalls the history, and `ESC+'[', 'D'` also reads as one key.
- Alt+Enter split as `ESC, CR` or as `ESC, LF` submits.
- A bracketed paste lands whole in each of these deliveries:
  - markers in chunks of their own;
  - a begin marker split as `ESC, '[200~…'`;
  - markers inside a gathered chunk;
  - an end marker alone during a gathering;
  - an end marker split across chunks.
- The existing test's `ESC, 'Z', 'a'` answers `["a"]`.

These readings changed, as D204's rule of the Escape key says:
- `ESC, 'Za'` answers `["Za"]`, where 8f36d29e answered `["a"]`.
- `ESC, 'OP'` answers `["OP"]`, where 8f36d29e answered `["P"]`.
- `ESC, ESC+'[D'` reads the arrow, where 8f36d29e typed `[D`.

### Findings (6)

1. **The tests follow what they test / Executable over narrated** — major
   - `D:\git\qlang\cli\src\line-editor.mjs:482` and `D:\git\qlang\docs\decisions\D204.md:16-18`: an escape pending alone before a chunk that begins with `[` stays a sequence. This clause keeps a split arrow and a split begin marker one key.
   - No test holds it. Only `line-editor.test.mjs:319` and `:574` hand over a bare escape (grep, ran).
   - I deleted `&& chunkText[0] !== '['` from a copy of the editor (`le-nobracket.mjs`). All 88 cases still pass on it (ran under a node stand-in for vitest's `describe`, `it` and `expect`, `vitest-shim.mjs`; the tip passes all 88 there too). Yet that copy:
     - answers `'abc', ESC, '[D', 'X', CR` with `["abc[DX"]`;
     - types `[A` for a split Up;
     - lands a split begin marker as `"[200~one\ntwo"`.
   - Repair: a test `feed(stdinStream, 'abc', ESC, '[D', 'X', SUBMIT)` answering `['abXc']`, and one of `ESC, '[200~one\r\ntwo', END, SUBMIT`. D204's Requirements gain "an escape sequence split after its escape stays one key".

2. **Prose names the invariant / Sources, not confidence** — major
   - `D204.md:12-14` and `line-editor.mjs:467-469` say a chunk that begins with an escape ends the gathering and is read as the key it is.
   - A chunk that begins with an escape and holds a line break before its last character starts a gathering of its own (`:488-493`). Its escape lands as text: `'one\ntwo', ESC+'[Dx\ny', CR` answers `["one\ntwo\u001b[Dx\ny"]` (`harness4.mjs`, ran).
   - The same path takes a bracketed paste whose begin marker shares its first chunk with a line break of its body, and reads it under the window. A gap past 50 ms cuts it, and a carriage return submits (`harness2.mjs`, ran):
     - `BEGIN+'one\r\ntwo'`, 80 ms, `'three\r'`, `'\nfour'+END`, CR answers `["one\ntwothree","\nfour"]`.
     - With the begin marker alone in its chunk, the same paste answers `["one\ntwothree\nfour"]`.
     - 8f36d29e answers the same, so this half predates the range.
   - Repair: a chunk that begins with an escape starts no gathering, `&& chunkText[0] !== ESC` in the condition at `:488`.
     - On that copy (`le-nogatheresc.mjs`) the two cases answer `["one\ntwx\nyo"]` and `["one\ntwothree\nfour"]`, and all 88 cases pass (ran).
     - A test for each case.
     - D204's Decision says a bracketed paste is read up to its end marker.

3. **Words carry paradigms** — minor
   - Three places say a line break handed over alone submits:
     - `D204.md:15-16`, "a line break handed over alone submits as Enter does";
     - `D204.md:47-49`;
     - the test name at `D:\git\qlang\cli\test\line-editor.test.mjs:550`.
   - In the same Decision, "line break" is the line feed (`:6-8`, which the code reads by `indexOf('\n')`). `'one\rtwo', CR` answers `["one","two"]` (ran).
   - A line feed handed over alone breaks a line: `'one\ntwo', '\n', 'x', CR` answers `["one\ntwo\nx"]` (ran).
   - The test hands over `SUBMIT`, which its file names plain Enter (`:12`).
   - Repair: D204 reads "Enter, a carriage return handed over alone, submits", and the test is named "…, Enter handed over alone submitting".

4. **Prose names the invariant** — minor
   - `line-editor.mjs:437-439` says "each chunk of a paste arriving within the window after the last joining it".
   - A chunk of one character, or one that begins with an escape, ends the gathering (`:471-477`). `'one\r\ntw', 'o', CR, '\nthree', CR` answers `["one\ntwo","\nthree"]` (ran).
   - Repair: "each chunk of several characters that begins with no escape, arriving within the window after the last, joining it".

5. **Executable over narrated / Words carry paradigms** — minor
   - `README.md:192` says "Each fate of the fifth review that it found holding in part is one of its findings below". The fifth review's seventh fate is two findings, the first and the second (stored review `:41`).
   - `:194` "repaired rather than recorded" defines the fate by the alternative.
   - Repair:
     - `:192`: "The fates of the fifth review it found holding in part stand in its findings below."
     - `:194`: "The paste the review found read key by key after the Escape key gathers, and a test holds it."

6. **Sources, not confidence** — minor
   - The author's suspicion holds. 9f476293's title says "count the fates by their marks" and its body "tell … by their marks", while `README.md:177` counts nothing and names no mark.
   - 7e292e7b's body compares two states: "where its bytes joined the paste as text", "where the escape took its first character".
   - a22bfa72 says "repaired rather than recorded".
   - Repair: none on the commits, which are never amended. Fate 5 at `README.md:198` says truly what 9f476293 did.

### Checked, no finding
- **Host boundary**: no `node:` import under `core/src` or in `lsp/src/features.mjs` (ran).
- **D204's Set aside**: the host that sends no brackets and the dropped spelling are true.
- **D204's Decided by**: the line names the model and is not presented as the maintainer's rule.
- **Other comments of the range**: `line-editor.mjs:480-481` and `:484-487` are true of the code.

Scratch files are in `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-7\`.
