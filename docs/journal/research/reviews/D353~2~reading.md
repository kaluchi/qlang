# Разбор первого прохода рецензента перед посадкой ветки the-code-is-its-steps

Чтение модели, сессия d7f52e95, 2026-10-19. Отчёт — [D353~2.md](D353~2.md):
Opus, запущенный сессией по слову мейнтейнера, на дереве bb62f35b,
18:03–18:49 UTC, вердикт `changes asked`, шестнадцать находок. Все
починены коммитом 44ad7c8d, кроме находки 6, которую решили [D373] для
журнала и [D296] для тестов, и правил инструментов, которые второй и третий проходы
([D353~3.md](D353~3.md), [D353~4.md](D353~4.md)) велели записать: их решила
запись [D372], растворённая при этом же переносе.

Промпт, на который он отвечал:

```text
You are a clean reviewer of the branch `the-code-is-its-steps` of the qlang repository before it lands on master. The branch is checked out in the git worktree D:/git/qlang-worktrees/the-code-is-its-steps (Git Bash path /d/git/qlang-worktrees/the-code-is-its-steps); master is 6ebe3da0, the baseline. You change no file anywhere: you read, run and report. Run git only as `git -C /d/git/qlang-worktrees/the-code-is-its-steps …`. Run the language of the worktree, never the `qlang` on the PATH: `cd /d/git/qlang-worktrees/the-code-is-its-steps && node cli/src/bin.mjs '<query>' < /dev/null`. Search with `rg` or `git grep`, never a recursive `grep` over the worktree. Do not run `npm run ci`, the coverage or the fuzz; a probe of a document runs with `node scripts/sensors/run-probes.mjs <file>`.

Read first, whole: the worktree's `CLAUDE.md`, `docs/spec/QSWRK-the-work.md` (the rules of the work) and `docs/journal/AIM.md` (the principles a review holds a diff against).

The branch holds, in order (`git -C … log --oneline 6ebe3da0..HEAD`): two batches of work and the move of the baseline.
- 816a23d5: batch 14, record D367 (now `docs/journal/replaced/D367.md`): code is one model, the records of its steps.
- e51f6f60: batch 15, record D371 (now `docs/journal/replaced/D371.md`): the painter, the language server and the extension read the language from the core; its last round, the kinds of the answer of a call (`answerKindsOf`, `kindsWalkedTo` in core/src/nouns.mjs) and the names visible inside the body of a verb (`bindingNamesVisibleAt` in core/src/walk.mjs, `declaredAt` in lsp/src/features.mjs), was written by the session and reviewed by no reader.
- 086312ae: the move: the sections D367, D368 and D371 override written anew in the present (`docs/spec/`: QSQUO#step, QSSLF#doc, QSERR#site, QSERR#flow, QSCOL#reduce, QSCOL#within, QSNAM#scope, QSSYN#doc, QSSYN#comment, QSWRK#cases, QSHST#repl, QSHST#tools), the records dissolved by `scripts/dissolve-records.mjs`, and every citation of them in the code and the tests named by the section whose rule its block holds (234 of them).
- bb62f35b: the walk of the open records at the move: D370 merged into D295, D316 and D318 into D309, D297 into D293, D304 into D281, D259 and D268 into D257, each survivor written anew; D273 and D322 decided and dissolved into QSHST#tools and QSWRK#target; D353 (the plan of the batches) carrying every open record left in a batch.

Refute the move first, then the last round of batch 15, then the branch against the aim:
1. Each section written anew states, in the present and in the cataphatic voice, every rule the dissolved record decided for it and nothing the tree contradicts: hold each section against its record's `Decision.` (`git -C … show 086312ae~1:docs/journal/D367.md`, D368, D371, and `docs/journal/replaced/D273.md`, `D322.md`), run its probes, and name a rule the record decided that no section now states, a sentence the tree contradicts (with the query that shows it), a pentimento (a history, a contrast with what the tree does not hold, a word to a reader) and a drift (one thing under two words).
2. The citations named at the move (`git -C … diff 086312ae~1 086312ae -- core cli lsp site vscode`): a citation whose block holds the rule of another section than the one named, with the file, the line and the section it should name. Sample at least forty, the comments of `core/src/eval.mjs`, `core/src/grammar.peggy`, `core/src/steps.mjs`, `core/src/walk.mjs` and `lsp/src/features.mjs` all of them.
3. The survivors of the merges and the plan: each survivor carries the questions, the probes, the sources and the alternatives of the records merged into it faithfully (`git -C … show bb62f35b~1:docs/journal/D370.md` and the rest), with no sentence the tree contradicts; D353 places every open record in force in a batch or among those that wait for the maintainer (`ls docs/journal`), each batch's area covering what its records ask.
4. The last round of batch 15 (`git -C … show 304e9163` is not on this branch; read the code as it stands): `kindsWalkedTo` and `answerKindsOf` against the evaluator's walk of a subject's tags (`subjectOfCall` in core/src/dispatch.mjs, `answerUnderItsLabel` in core/src/eval.mjs), `bindingNamesVisibleAt` against the rule of QSNAM#verb that a verb reads the tree where it is called and against the scope a call opens (`scopeOpenedIn`, `nodesAndLabelsOf` in core/src/eval.mjs), each with a counterexample you run where you claim one.
5. The branch against the principles of the aim and the rules of the work: one spelling of a fact, no second road beside a new one, a comment that states what holds and cites its section, the ratio of comment lines (`node scripts/measure.mjs 6ebe3da0 HEAD`), the sign of the diff by area (`node scripts/measure.mjs --steps 6ebe3da0 HEAD`).

A finding is something you can show: a file and a line, the rule of the work or the principle of the aim it breaks or the rule of a record it misses, and the probe or the command you ran and what it answered. No style preference, no finding you did not run. Answer in Russian. Return the report as plain text: a first line `Verdict: accepted` or `Verdict: changes asked`, then the findings numbered, the weightiest first, each with its file:line, what is wrong, the rule or principle, and the probe with its answer; at most twenty-five findings.
```

Судьбы, каждая с пробой на дереве после починки:

1. **Сделана частично, правило записано.** Виды ниже метки не факт ответа:
   `get [~(::Box[1 2] | within ~(get /0) | payload | type) ~(::Box[1 2] | payload | type)]`
   → `[::number ::vec]`. Поэтому сервер их не предлагает, а `::tagged`
   достигнутого значения держит; тест verb-tooling “keeps of the walk the
   kind `::tagged` …” падает на каждом разрезе. Правило решила [D372].
2. **Записана.** Чтение имён тела глагола по тексту, а не по вызовам,
   решила [D372], расхождение с языком глава называет, чтение у каждого
   вызова отставлено с ценой. Проба:
   `rg -n "a reading of the text alone" docs/spec/QSHST-hosts-and-the-command-line.md` → одна строка.
3. **Сделана.** Окраска по одному имени. Проба:
   `rg -n "read by the name alone" docs/spec/QSHST-hosts-and-the-command-line.md` → одна строка; правило в [D372].
4. **Сделана.** Зазор читает грамматика: справка подписи на
   `[1 2 3] | take |~ how many ~| ` → `take count`, тест падает на сервере до
   починки; шаг у курсора и знаки автодополнения сервер пишет сам, ядро их
   не экспортирует [D374]. Проба:
   `git grep -l -F -e "partsBeforeACursor" -e "SIGNS_A_WORD_FOLLOWS" -- core/src lsp/src` → пусто.
5. **Сделана.** Проба: `rg -n "part of its node" docs/spec lsp/src` → пусто.
6. **Решена записями.** Документы выросли журналом, его историей и
   отчётами ревью, а журнал стоит вне счёта диффа [D373]; главы выросли
   правилами пачек, которые перенос записал в их разделы, при ядре в минусе;
   рост тестов держит [D296], запись тестов и проверок, которую несёт пачка 17.
   Проба: `node scripts/measure.mjs --steps 6ebe3da0 b9008a4d` → ядро
   +1704 −1968, документы +237 −78, тесты +1893 −1327.
7. **Сделана.** `answerKindsOf` для `vec/h` с `returns #[::vec ::number]`
   → `[vec number]`; тест verb-tooling.
8. **Сделана.** Проба: `rg -n "as \`answerKindsOf\` reads them" lsp/src/features.mjs` → одна строка.
9. **Сделана.** Пять цитат названы разделами, чьи правила держат их блоки.
   Проба: `rg -n "at none \[QSQUO#step\]|raised it \[QSQUO#step\]|\[QSERR#rest\], \[QSHST#tools\]|declaration \[QSHST#tools\]|map alone \[QSERR#rest\]|\[QSQUO#step\], \[QSSYN#doc\]" core/test/unit/eval-smoke.test.mjs core/test/unit/errors.test.mjs lsp/test/features.test.mjs core/test/unit/door.test.mjs core/src/grammar.peggy`
   → eval-smoke:283, errors:61, features.test:374 и :636, door:221,
   grammar.peggy:16 (и :249, что называла эти разделы и раньше), и
   `rg -n "^// \[QSNAM#scope\]\." core/src/eval.mjs` → :150, у `evalGroup`.
10. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/spec/QSHST-hosts-and-the-command-line.md` → все ok.
11. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/journal/D293.md` → все ok, `typeof declareRefusal(…)` → `function`.
12. **Сделана.** Проба: `rg -n "vscode/syntaxes" docs/journal/D353.md` → одна строка.
13. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/journal/D257.md` → ok и одна цель.
14. **Сделана.** Проба: `rg -n "two counters and a flag" docs/journal/D295.md` → одна строка.
15. **Сделана со второго прохода.** Глава говорит об именах в силе там, где стоит шаг, без `env`.
    Проба: `:number/m (::fn | takes :x |~~ x ~~| /0 | impl ~(x)) | 1 | m 2` → `2`.
16. **Сделана.** Проба: `::call[1] !| type` → `::call/PayloadKindNotTakenError`.

[D296]: ../../replaced/D296.md
[D372]: ../../replaced/D372.md
[D373]: ../../replaced/D373.md
[D374]: ../../replaced/D374.md
