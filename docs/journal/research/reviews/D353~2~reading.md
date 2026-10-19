# Разбор первого прохода рецензента перед посадкой ветки the-code-is-its-steps

Чтение модели, сессия d7f52e95, 2026-10-19. Отчёт — [D353~2.md](D353~2.md):
Opus, запущенный сессией по слову мейнтейнера, на дереве bb62f35b,
18:03–18:49 UTC, вердикт «changes asked», шестнадцать находок. Все
починены коммитом 44ad7c8d, кроме находки 6, которую держит [D353], и правил
инструментов, которые второй проход ([D353~3.md](D353~3.md)) велел записать:
их решила запись [D372], растворённая при этом же переносе.

Промпт, на который он отвечал:

```text
You are a clean reviewer of the branch `the-code-is-its-steps` of the qlang repository before it lands on master. The branch is checked out in the git worktree D:/git/qlang-worktrees/the-code-is-its-steps (Git Bash path /d/git/qlang-worktrees/the-code-is-its-steps); master is 6ebe3da0, the baseline. You change no file anywhere: you read, run and report. Run git only as `git -C /d/git/qlang-worktrees/the-code-is-its-steps …`. Run the language of the worktree, never the `qlang` on the PATH: `cd /d/git/qlang-worktrees/the-code-is-its-steps && node cli/src/bin.mjs '<query>' < /dev/null`. Search with `rg` or `git grep`, never a recursive `grep` over the worktree. Do not run `npm run ci`, the coverage or the fuzz; a probe of a document runs with `node scripts/sensors/run-probes.mjs <file>`.

Read first, whole: the worktree's `CLAUDE.md`, `docs/spec/QSWRK-the-work.md` (the rules of the work) and `docs/journal/AIM.md` (the principles a review holds a diff against).

[the commits of the branch, the move and the walk of the open records]

Refute the move first, then the last round of batch 15, then the branch against the aim:
1. Each section written anew states, in the present and in the cataphatic voice, every rule the dissolved record decided for it and nothing the tree contradicts …
2. The citations named at the move: a citation whose block holds the rule of another section than the one named …
3. The survivors of the merges and the plan …
4. The last round of batch 15: `kindsWalkedTo` and `answerKindsOf` against the evaluator's walk of a subject's tags, `bindingNamesVisibleAt` against the rule of QSNAM#verb …
5. The branch against the principles of the aim and the rules of the work: one spelling of a fact, no second road beside a new one, a comment that states what holds and cites its section, the ratio of comment lines, the sign of the diff by area.

A finding is something you can show: a file and a line, the rule of the work or the principle of the aim it breaks or the rule of a record it misses, and the probe or the command you ran and what it answered. Answer in Russian. Return the report as plain text: a first line `Verdict: accepted` or `Verdict: changes asked`, then the findings numbered, the weightiest first; at most twenty-five findings.
```

Судьбы, каждая с пробой на дереве после починки:

1. **Сделана частично, правило записано.** Виды ниже метки не факт ответа:
   `get [~(::Box[1 2] | within ~(get /0) | payload | type) ~(::Box[1 2] | payload | type)]`
   → `[::number ::vec]`. Поэтому сервер их не предлагает, а `::tagged`
   достигнутого значения держит; тест verb-tooling «keeps of the walk the
   kind `::tagged` …» падает на каждом разрезе. Правило решила [D372].
2. **Записана.** Чтение имён тела глагола по тексту, а не по вызовам,
   решила [D372], чтение у каждого вызова отставлено с ценой. Проба:
   `rg -n "a reading of the text alone" docs/spec/QSHST-hosts-and-the-command-line.md` → одна строка.
3. **Сделана.** Окраска по одному имени. Проба:
   `rg -n "read by the name alone" docs/spec/QSHST-hosts-and-the-command-line.md` → одна строка; правило в [D372].
4. **Сделана для зазора, остальное записано.** Зазор читает грамматика:
   справка подписи на `[1 2 3] | take |~ how many ~| ` → `take count`; тест
   падает на сервере до починки. Шаг `it` у курсора и знаки автодополнения
   сервер пишет сам — так и сказано в главе и в [D372].
5. **Сделана.** Проба: `rg -n "part of its node" docs/spec lsp/src` → пусто.
6. **Держит запись.** Рост документов и тестов ветки названа в [D353], которая
   ссылается на этот отчёт и держит следующие пачки к диффу, удаляющему
   больше, чем добавляет. Проба: `node scripts/measure.mjs --steps 6ebe3da0 HEAD`
   → документы и тесты в плюсе.
7. **Сделана.** `answerKindsOf` для `vec/h` с `returns #[::vec ::number]`
   → `[vec number]`; тест verb-tooling.
8. **Сделана.** Проба: `rg -n "as \`answerKindsOf\` reads them" lsp/src/features.mjs` → одна строка.
9. **Сделана.** Пять цитат названы разделами, чьи правила держат их блоки.
   Проба: `rg -n "\[QSERR#rest\], \[QSHST#tools\]" lsp/test/features.test.mjs` → одна строка.
10. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/spec/QSHST-hosts-and-the-command-line.md` → все ok.
11. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/journal/D293.md` → все ok, `typeof declareRefusal(…)` → `function`.
12. **Сделана.** Проба: `rg -n "vscode/syntaxes" docs/journal/D353.md` → одна строка.
13. **Сделана.** Проба: `node scripts/sensors/run-probes.mjs docs/journal/D257.md` → ok и одна цель.
14. **Сделана.** Проба: `rg -n "two counters and a flag" docs/journal/D295.md` → одна строка.
15. **Сделана со второго прохода.** Глава говорит об именах в силе там, где стоит шаг, без `env`.
    Проба: `:number/m (::fn | takes :x |~~ x ~~| /0 | impl ~(x)) | 1 | m 2` → `2`.
16. **Сделана.** Проба: `::call[1] !| type` → `::call/PayloadKindNotTakenError`.

[D353]: ../../D353.md
[D372]: ../../replaced/D372.md
