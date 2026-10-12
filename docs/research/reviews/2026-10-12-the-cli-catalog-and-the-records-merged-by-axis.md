## qlang review — the-cli-catalog-held-and-the-records-merged-by-axis, master...ef5acaaa

**Verdict**: REQUEST CHANGES
**Gates**: `npm run ci` not run, at your word. `runLaws` over the touched pages (`::bind`, `::bind/NameDeclaredTwiceError`, `::qlang/verbs`, `::qlang`, `::builtin`) passes on every law.

**Scope.** The branch kept moving while I reviewed it. Four commits landed after ef5acaaa (c12dd033, 351f8c70, 3f5e0561, b85617b3), and the tree has uncommitted edits (D21, D98, D100 moved to `replaced/`, `axis.mjs`, `explanation.jsonl`). This review covers the twelve commits only. The probes ran on the working tree. There, eval.mjs, walk.mjs, state.mjs, env-keys.mjs, parse.mjs and bind.qlang are the same as at ef5acaaa; quote.mjs differs only by two citations.

**Sign** (`node scripts/measure.mjs --steps`):

| Area | Added | Removed |
|---|---|---|
| core sources | +120 | −110 |
| catalog | +13 | −5 |
| documents | +2125 | −1382 |
| tests | +376 | −280 |
| tooling | +36 | −23 |

- Records in force go from 204 to 182 files and from 79906 to 76993 words; `replaced/` grows by 1148 lines.
- The core growth (+10) is the D71 refusal.
- The test growth (+96) is the CLI catalog test (+71) plus the D71 cases. Finding 2 removes most of the CLI test's lines.

### Findings (16)

1. **The language describes itself** — blocker
   `core/src/eval.mjs:570`: the check `node.parent === binds.body` assumes the body is a pipeline.
   - The grammar collapses a group of one step (grammar.peggy:72-78, 422-424). So in `~((:x 3))` the body is the group, and the declaration's parent is that group.
   - Probe: `:number/m ~((:x 3)) | :number/m/x ~(/0) | 1 | m 2` answers `::bind/NameDeclaredTwiceError :x`.
   - Meanwhile `~((:x 3 | x))` answers `3`. D71.md and the page of `bind/NameDeclaredTwiceError` say a group of the body is a scope of its own.
   - A body built from data fails the same way: `:number/m (~((:x 3)) | [/0] | tag ::quote) | …`.
   - Repair: test the parent only when the body is a pipeline, as walk.mjs:163 does: `node === binds.body || (binds.body.type === 'Pipeline' && node.parent === binds.body)`. Add the case `:number/m ~((:x 3)) | :number/m/x ~(/0) | 1 | m 2` → `1`.

2. **One fact, one spelling** — blocker
   `cli/test/cli-catalog.test.mjs` re-spells the core's three catalog checks:
   - `quoteInProse` (line 24) is catalog-laws.test.mjs:84 verbatim.
   - The link check (lines 45-55) re-spells `wrongTarget` from catalog-links.test.mjs:30-36.
   - The law check (lines 41-43) re-spells catalog-laws.test.mjs:91.
   - `noopCtx` is copied from cli-sources.test.mjs:5.
   - Repair: one module holding the three checks over a list of addresses. The core calls it with `rootAddressesOf(langRuntime())`, the CLI with the names whose origin is `:cli`. Delete the copies.

3. **One fact, one spelling** — blocker
   `scripts/merge-records.mjs:79`:
   - The pattern for a citation written in words repeats the second half of `CITATION` in baseline-walk.mjs:21, in the same commit that imports `CITING_DOCUMENTS` from that file. Repair: export the pattern from baseline-walk.mjs and use it in both.
   - The comment at :77-78 reads "`decision D46` or `decision D46`". The script rewrites its own source as an artifact (:150-153), so its example citation was rewritten too and the plural form it described is gone. Repair: write the example with names of no record, `decision Dnn`.
   - :152 `const DOCUMENT = { test: … }` is an object pretending to be a regular expression. Repair: `const isDocument = path => CITING_DOCUMENTS.includes(path)`.

4. **Executable over narrated** — major
   `docs/decisions/D200.md:113-121` says the lexical extension "stays unmet": `:vec/doc ~("a reader page") | [1 2] | tutorial | first` answering `"a reader page"`.
   - This contradicts D200.md:19-23 (`[1 2] | tutorial` reads the page of `::vec`) and the tree: the probe answers `|~~ A vector is an ordered list…`.
   - D226's source names this very contradiction, "[D200] by [D222]", and the merge kept both sentences.
   - Repair: delete from "The audit's lexical extension" to `"a reader page"`.

5. **Executable over narrated** — major
   - D7.md:38-46 says every failure is an answer on stdout, and standard error is for what is no answer. D7.md:24-26 puts the REPL in scope.
   - The REPL writes a failed cell on stderr (cli/src/repl.mjs:134). Probe: `printf '1 | add "x"\n' | node cli/src/bin.mjs -i 2>/dev/null` prints only the prompts.
   - The comment at repl.mjs:132-133, "prints as every failure does, on stderr [D13]", cites a record that says nothing about channels. It is also false for script mode.
   - Repair: either D7 limits the stdout rule to script mode and states where the REPL writes a failure, with repl.mjs citing D7; or the REPL writes a failed cell on stdout.

6. **The maintainer's words bind** — major
   - The `Decided by.` lines at D7.md:4-5, D13.md:4-6, D34.md:4-5, D46.md:4-6, D200.md:4-5 and D71.md:4-5 each put a choice of the maintainer and the model's mechanics in one record.
   - At ef5acaaa that is forbidden by the audit (qlang-audit.md:131-132), D155.md:8-10, D237.md:42-43 and qlang-review.md:200-201. D200 was "Decided by. The model" on master and now opens with "The maintainer".
   - c12dd033, outside the range, rewrites the audit, D155, D237 and the review rule to allow it, on the 07:24 words about the doc's three records. If that commit stands, this finding is met there. D71's line names the maintainer's part where the rewritten rule asks for the model's parts.

7. **Prose names the invariant, and the reason lives with the decision** — major
   - D71.md:43-45 rejects "a scope kept on the state of the evaluator, which a slot binds without a declaration and which every fork must reset by hand".
   - The change keeps the names a call binds, without a declaration, on the body's scope (`CALL_BINDS_KEY`, env-keys.mjs:7, eval.mjs:718). Every fork inherits it, and only the identity of the body's tree limits its reach.
   - Repair: D71 states this mechanism and why no fork resets it, and rewrites the rejected alternative so it no longer reads as the code.

8. **Words carry paradigms** — major
   - cli-catalog.test.mjs:4-5 "a link the grammar no longer reads … once the sigil left", and :66 "no longer reads" → "a link whose quote does not parse".
   - D46.md:15 "rather than how the runtime met it" → drop the clause.
   - D13.md:200 "a spelling the language no longer has".
   - eval.mjs:568 `declaresWhatTheCallBinds(node, …)`: a bare `node` whose type is known → `bindStep`, as walk.mjs:162 names it.
   - Commit 598511eb: "still said … it says so now".

9. **Sources, not confidence** — minor
   The merges dropped claims that comments and cases still cite the surviving record for.
   - D172's sentence ("what an invariant states becomes the invariant…; a primitive keeps no dispatch on the kind…") is missing from D46. Yet these cite D46 for it: keyword.mjs:3 (D34.md:27-28 holds it), setops.mjs:3 (D34, D157), vec.mjs:318, arith.mjs:3-4.
   - D86's "the step of the tag joining its trail" is missing from D13. Yet quote.mjs:98-99 and eval.mjs:369-372 cite D13 for it, and so do the cases `the-tag-a-tagged-literal-over-a-failure-skips-is-its-call` (19-error-values.jsonl:43) and targets.jsonl:69.
   - Repair: put the two sentences back, or cite the records that hold them.

10. **Executable over narrated** — minor
    Counts written in words, which a grep answers and which slip past the digit check: D13.md:175 "the ten", D46.md:137 "the seven", D7.md:95 "the four", D34.md:111 and D200.md:94 "the three". Repair: "The cases named them apart".

11. **Sources, not confidence** — minor
    Each survivor's "Pruned of what" line names records now merged into it: D7.md:117 [D184], D13.md:238 [D87] [D210], D46.md:174 [D159] [D172], D34.md:149 [D62], D200.md:132 [D222]. Repair: remove them from the survivor's line.

12. **One fact, one spelling** — minor
    - The link-definition pattern `^\[([DE]\d+)\]: ` (merge-records.mjs:45, decision-records.mjs:29) treats any line that opens with a citation and a colon as a definition.
    - f2939166 fixed one instance by reflowing the entrypoint. D138.md:12 ("[D15]: `map`, `filter`…") still has the shape, and markdown hides that line as a definition.
    - Repair: one shared pattern anchored on `[DE]\d+\.md$`, and reflow D138.md:12.

13. **Executable over narrated** — minor
    merge-records.mjs:59 keeps a record's `Source.` as history. D237 at ef5acaaa says only "a statement of fate keeps the record it named", so D237 should say both.

14. **The order of concepts is the order of dependencies** — minor
    - `declaresWhatTheCallBinds` (eval.mjs:566-571) sits among names under a label; its caller is eval.mjs:400 and the mark is written at :718. Repair: move it beside `evalBindStep`.
    - `ARGS_NAME` is declared at :737 after its use at :610.
    - :718 binds the literal `'args'` beside `ARGS_NAME.name`. Repair: use one spelling.
    - The law at bind.qlang:148-150 stands before the laws for the statements that come before it on the page.

15. **Words carry paradigms** — minor
    One record cited two or three times in one sentence: qlang-audit.md:473-478, eval.mjs:231-232 and :681-683, raise.mjs:9-12, eval-trail.mjs:1-2. Repair: one citation per sentence.

16. **The tests follow what they test** — minor
    - argv.test.mjs:152 `not.toMatch(/exit 1/)` checks that the old help text is gone. Repair: delete it; the positive assertion holds the help.
    - Older than the branch, carried into D46.md:59-63: "names the form that is right" while the parser answers `[1] !| | count` with "write `a | b`", which drops the catch.

### Where I found nothing

- **Nested words:** a word declared inside another body sets its own mark. `:number/o ~(:number/i ~(:x 1 | add x) | :number/i/x ~(/0) | i 5) | 1 | o` is refused with `:x`, and the same body without the inner part answers `2`.
- **Recursion:** `down` answers 7, 1 and 9 as each shape should.
- **Quotes a body runs:** `apply`, `map` and `if` declare in their own scope (`apply ~(:x 3 | add x)` → 4). Data quotes carry no mark.
- **Fail track and default parts:** both refused, as the cases hold.
- **Root words:** read the root's parts alone, so a part a reader adds under a root word changes nothing.
- **No body declares its own part or `args`:** scanned the core catalog, the CLI catalog and the sister project's four sources (aliases, coverage, graph, render).
- **The mark stays inside the evaluator:** `env` lists no symbol key. Only declarations replace the scope (eval.mjs:408, 418), so the mark cannot be lost partway through a body.
- **The language server** reports parse errors only (features.mjs:91-116). It knows no refusal of a declaration, which matches what D71 set aside.
- **Conformance cases:** only `decision` fields changed, apart from the nine D71 cases. Every case names a record in force, once.
- **Records:** every link definition resolves.
- **Record claims probed true:**
  - D7: `--json`, numbers past the doubles, `{:a 1} | /b`, the shell path.
  - D13: all fourteen claims.
  - D46: all claims and requirements.
  - D34: every residence and example.
  - D200: all but finding 4.
- **Quotes:** D71's «и потом :number/m …» matches the maintainer's 09:22:06 message. His choice at 09:34:44 is his answer "Отказ (Recommended)" in the session dda915a5 transcript.
- **Host boundary:** clean at ef5acaaa.
