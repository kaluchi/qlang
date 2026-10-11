## qlang review: modules-are-the-tree-of-names, a22bfa72..926f2476

**Verdict**: REQUEST CHANGES. Finding 1 is a blocker. Findings 2 to 5 are minor.

**Gates**: I ran each of these and saved its exit code in a file under `C:\Users\EugenPC\AppData\Local\Temp\claude\D--git-qlang\22b934f8-e6d3-44b2-96d3-5f61137f1d0f\scratchpad\review-8\`. I did not run `npm run ci`, as instructed.
- `check:conventions`: 0.
- `check:probes`: 0. The probes at `docs/qlang-audit.md:1715` and `:1717` are ok.
- `check-quotes.mjs`: 0. `D204.md:41` is ok.
- `requirements.mjs`: 0. It lists D204 among the tests of the command line.
- vitest on `cli/test/line-editor.test.mjs`: 0, 93 tests.

**Sign of the diff** (numstat, ran). Each commit's stated sign matches its numstat.
- Core sources: +3 −8.
- Catalog: 0.
- Command line: +17 −13.
- Command-line tests: +38 −1.
- Documents: +188 −29. That is D204 +35 −27, the audit +25, the stored review +113 and the ledger +15 −2.

### Fates of the seventh review (`D:\git\qlang\docs\research\reviews\README.md:208-213`)
1. **Holds.** I cut `chunkText[0] !== '['` at `line-editor.mjs:486` on a copy, and the cases at `:578` and `:592` fail (ran). `D204.md:56-57` names both splits.
2. **Holds in part.** The cases at `:599` and `:606` fail on the editor of ef973523 (ran). But the same `keys` also went into the rule of the Escape key (finding 1), and d0e9e21c's message does not mention it. D204's sentence on the bracketed paste is wider than the code (finding 2).
3. **Holds.** `D204.md:15` and `:52-53`, and the test name at `:550`.
4. **Holds.** `line-editor.mjs:437-439` and `:472`.
5. **Holds.** `README.md:192` and `:194` read as the review proposed.
6. **Holds.** `README.md:198` says what 9f476293 did, `:194-200` what 7e292e7b did, and `:212` what a22bfa72 did.

### Findings (5)

1. **The tests follow what they test / Prose names the invariant**: blocker
   - **The defect.** At `D:\git\qlang\cli\src\line-editor.mjs:486`, d0e9e21c wrote `!keys` where a22bfa72 had `chunkText.length > 1`. That adds `chunkText[0] !== ESC` to the rule of the Escape key.
   - **The effect.** When an escape is pending alone and the next chunk begins with an escape, the pending escape stays. At `:348` it pairs with the chunk's escape and both are dropped, and the rest of the key is typed. I ran `harness2.mjs` on both editors:
     - `'abc', ESC, ESC+'[D', 'X', CR` answers `["abc[DX"]`. On a22bfa72 it answers `["abXc"]`.
     - Up after the Escape key types `[A`, and Home types `[1~`.
     - `ESC, BEGIN+'one\r\ntwo'+END, CR` answers `["[200~one","\ntwo"]`, because the carriage return inside the paste submits. On a22bfa72 it answers `["one\ntwo"]`.
   - **What it makes false.** After the Escape key, `D204.md:13-17` is false: keys read as the keys they are, an arrow moving the cursor, and a bracketed paste read up to its end marker. The comment at `:467-469` is false there too.
   - **Why the tests missed it.** No case holds the Escape key before a key spelled by an escape. The seventh review had listed `ESC, ESC+'[D'` reading the arrow as one of a22bfa72's readings.
   - **Scope** (`diff-fuzz2.mjs`, ran over 9723 deliveries of up to three chunks):
     - The editor of 926f2476 and the repaired copy differ on 296 deliveries. Each one is an escape alone before a chunk that begins with an escape.
     - a22bfa72 and the repaired copy differ on 2001 deliveries. Each one has a chunk that begins with an escape and holds a line feed before its end, which is exactly what the seventh review's finding 2 asked for.
   - **Repair:**
     - At `:486`, write `chunkText.length > 1` in place of `!keys`.
     - The comment at `:483-485` and `D204.md:17-20` read: "an escape pending alone before a chunk of several characters that does not begin with `[` is the Escape key".
     - Add two cases. `feed(stdinStream, 'abc', ESC, ESC + '[D', 'X', SUBMIT)` → `['abXc']`, and `feed(stdinStream, ESC, BRACKETED_PASTE_BEGIN + 'one\r\ntwo' + BRACKETED_PASTE_END, SUBMIT)` → `['one\ntwo']`. Both fail on 926f2476 and pass on the repaired copy, with the other 93 green (`run-variants.mjs`, ran).
     - D204's Requirements add: "a key spelled by an escape and a bracketed paste after the Escape key are read as they are".

2. **Prose names the invariant**: minor. D204's Decision states two readings more widely than the code does.
   - **The bracketed paste.** `D:\git\qlang\docs\decisions\D204.md:15-17` says "whatever chunks carry it and however long they take".
     - When a chunk of text holds the begin marker after its first character and a line feed after the marker, it starts a gathering, and a pause past the window cuts the paste.
     - `'x'+BEGIN+'one\r\ntwo'`, 80 ms, `'three\r'`, `'\nfour'+END`, CR answers `["xone\ntwothree","\nfour"]`. With the begin marker opening its chunk, the same delivery answers `["one\ntwothree\nfour"]` (`harness.mjs`, ran).
     - Repair: "A bracketed paste whose begin marker opens a chunk, whole or split across chunks, is read up to its end marker, however long it takes."
   - **The line breaks.** `D204.md:12` says "its line breaks kept".
     - The paste lands with CRLF and CR read as LF, and its trailing line breaks are dropped (`line-editor.mjs:504-509`). `'one\ntwo\n', CR` answers `["one\ntwo"]` (ran; the case at `:615` holds this).
     - Repair: "its line breaks kept as line feeds, the trailing ones dropped".

3. **Executable over narrated**: minor
   - `D204.md:7` says "Text whose first line feed is not its last character starts the gathering". The comment at `line-editor.mjs:488-491` says "a typed line ending in a line feed among it".
   - No case holds the clause `firstNewline !== chunkText.length - 1` at `:494`. With it cut on a copy, all 93 cases pass (`mutate.mjs`, ran).
   - Repair: add the case `feed(stdinStream, 'abc' + NEWLINE, 'd', SUBMIT)` → `['abc\nd']`. With the clause cut it answers `['abcd']` (ran).

4. **Prose names the invariant**: minor; this predates the range.
   - **The defect.** `line-editor.mjs:348` drops an escape followed by anything but `[` only when the pending escape is two code units long.
     - An escape and a character beyond the basic plane in one chunk make three code units. The escape stays pending and swallows every key up to the next letter or `~`.
     - `ESC+'\u{1F600}', '1', '2', 'y', 'z', CR` answers `["z"]` (`harness3.mjs`, ran).
     - The comment at `:349-350`, "so a pending escape past this point begins with `ESC[`", is false for this delivery.
   - **The false sentence.** `D204.md:5-6` and the comment at `:467` say a chunk of one character is keys. But `:470` counts code units, so that character alone is read as text.
     - `ESC, '\u{1F600}', 'x', CR` answers `["\u{1F600}x"]`, while `ESC, 'й', 'x', CR` answers `["x"]` (ran).
   - **Repair:**
     - At `:348`, write `if (pendingEscape[1] !== '[')` and delete the length clause. On a copy the swallowing delivery then answers `["12yz"]` and the 93 cases stay green (ran). Add that delivery as a case.
     - `D204.md:5-6` and `:467` say "a chunk of one code unit".

5. **Prose names the invariant**: minor
   - **The missing cost.** The chapter promises each alternative with its cost (`D:\git\qlang\docs\qlang-audit.md:1537-1538`). The third alternative at `:1727-1729`, "the two as they stand", names none. Its cost is that the fifth milestone's line at `:1480-1483` stays unmet.
   - **The shared merit.** The read-back it names as its merit holds under the first alternative as well. `[!{:a 1 :trail []}] | map ~(!| payload) | eq ([!{:a 1}] | map ~(!| payload))` answers `true` (ran).
   - Repair: "and the two as they stand, a print like its source, at the price of the line of the fifth milestone on `:trail`".

### Checked, no finding
- **ef973523 changes no code.**
  - With comments and whitespace stripped, `eval.mjs`, `walk.mjs` and `nouns.mjs` hash the same before and after. The comment words of `eval.mjs` hash the same too (ran).
  - It also drops the blank last line of `walk.mjs` and `nouns.mjs`, which its message does not mention.
- **The nine clauses of the reading of a chunk** each fail a case when cut on a copy (`mutate.mjs`, ran):
  - keys `length === 1`: 8 cases fail. Keys `[0] === ESC`: 4.
  - Join `!keys`: 10 when cut to true, 1 (`:543`) when cut to false.
  - Escape rule `pendingEscape === ESC`: 1 (`:585`). Escape rule `!keys`: 1 (`:316`). Escape rule `[0] !== '['`: 2 (`:578`, `:592`).
  - Start of a gathering `!keys`: 2 (`:599`, `:606`). Start `!pasteMode`: 1 (`:606`). Start `pendingEscape.length === 0`: 1 (`:592`).
- **Alt+Enter.** Cutting either spelling fails `:133` or `:140` (ran).
- **The stored seventh review** is the handback of agent-abe872e35c890d6ff, 8555 characters, apart from the final newline (`handback.mjs`, ran).
- **The open question at `docs/qlang-audit.md:1707-1729` is true:**
  - Its probe answers as written (ran).
  - `D:\git\qlang\core\src\runtime\print-value.mjs:91` skips an empty `:trail`.
  - `:error/trail` is `~(/trail)` at `D:\git\qlang\core\lib\qlang\error.qlang:144`.
  - `[!{:a 1}] | map ~(!| payload)` prints `{:a 1 :trail []}`.
  - `::error{:a 1} | trail` refuses with `::proj/KeyNotInMapError`, so the cost of the second alternative follows. The cost of the first follows from the print.
  - No record already answers it. D85 decides the read-back, and D82, in the part D85 replaced, the empty trail of a literal. D97 decides the bang and the stack. None decides how an empty path prints.
- **Host boundary.** No `node:` import under `core/src` or in `lsp/src/features.mjs` (ran). The range touches no catalog source.
- **D204's Decided by** names the model, and its quote holds at `:41`.

The scripts and the editor copies are in the scratch folder named above. I removed the temporary `node_modules` link I made there; the repository's `node_modules` is intact and `git status` is clean.
