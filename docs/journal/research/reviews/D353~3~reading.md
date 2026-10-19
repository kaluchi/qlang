# Разбор второго прохода рецензента перед посадкой ветки the-code-is-its-steps

Чтение модели, сессия d7f52e95, 2026-10-19. Отчёт — [D353~3.md](D353~3.md):
тот же рецензент, что и в [D353~2.md](D353~2.md), продолженный сессией с
первым проходом в контексте, на дереве 44ad7c8d, 19:01–19:11 UTC, вердикт
`changes asked`, одиннадцать находок. Главная — правила инструментов,
которые первая починка записала в главу и в код без своей записи; их решила
запись [D372] и растворилась в QSHST#tools и QSHST#stdin при этом же
переносе.

Промпт, на который он отвечал:

```text
Second pass: the session repaired the branch by your sixteen findings in commit 44ad7c8d on the-code-is-its-steps, and wrote each finding's fate at the end of docs/journal/research/reviews/2026-10-19-the-code-is-its-steps.md. Read that commit whole (`git -C /d/git/qlang-worktrees/the-code-is-its-steps show 44ad7c8d`) and the fates, and refute them: a fate that does not hold in the tree, a repair that breaks something else (rerun your probes, and `npx vitest run` in core and lsp for the files it touches), and anything the repair newly writes against the rules of the work or the aim. Same rules as before: change no file, run long commands under `timeout 300`, every finding with its file:line, the rule and the probe you ran. Return in Russian: the first line `Verdict: accepted` or `Verdict: changes asked`, then only the findings that remain or are new, numbered, the weightiest first.
```

Судьбы, каждая с пробой на дереве после починки:

1. **Записана.** Правила, которые починка написала в главу и в код, решила
   [D372]: окраска по имени, виды ответа после вызова, зазор по грамматике,
   имена тела глагола по тексту, шаг у курсора и знаки автодополнения из
   ядра, которые [D374] вернула серверу, оговорка QSHST#stdin. Растворена в
   QSHST#tools и QSHST#stdin. Проба:
   `rg -n "^Dissolved into" docs/journal/replaced/D372.md` → одна строка.
2. **Записана.** Чтение имён тела глагола по тексту решила [D372], чтение у
   каждого вызова отставлено с ценой; из списка идей [D257] пункт ушёл. Проба:
   `rg -n "read at each call" docs/journal/replaced/D372.md` → одна строка.
3. **Отставлена.** Шаг у курсора и знаки, после которых редактор просит
   автодополнение, третья починка отдала ядру, `partsBeforeACursor` и
   `SIGNS_A_WORD_FOLLOWS`; [D374] вернула их серверу: шаг сервер отбрасывает
   до шагов, а список знаков был второй грамматикой поверх парсера. Проба:
   `git grep -l -F -e "partsBeforeACursor" -e "SIGNS_A_WORD_FOLLOWS" -- core/src lsp/src` → пусто.
4. **Решена записями.** Рост документов — рост журнала, который [D373]
   выводит из счёта, рост тестов держит [D296]; отчёты названы по записи,
   `D353~2`–`D353~4`, и стоят под `Runs.` записи. Проба:
   `rg -n "D353~2.md" docs/journal/D353.md docs/journal/D296.md` → `Runs.` у
   D353, источник у D296.
5. **Сделана.** QSNAM#scope говорит об именах в силе там, где стоит шаг, у
   рецепта — о тех, что открывает вызов, без `env`. Проба:
   `:number/m (::fn | takes :x |~~ x ~~| /0 | impl ~(env | keys)) | 1 | m 2`
   → `#[:number/m :number/m/x]`, и `rg -n "env" docs/spec/QSNAM-names-and-scope.md`
   не находит его в первой фразе раздела.
6. **Сделана.** Проба видов ниже метки стоит под фразой о видах после вызова:
   `get [~(::Box[1 2] | within ~(get /0) | payload | type) ~(::Box[1 2] | payload | type)]`
   → `[::number ::vec]`; вычислительная половина теста читает `type` и
   `payload | type`.
7. **Сделана.** Проба: `rg -n "by what it reaches" core/test/unit/highlight.test.mjs` → пусто.
8. **Сделана.** `::tagged` назван видом. Проба:
   `rg -n "the tag the value it reached|the tag that value stands under|the tag of the value its label reached" docs core` → пусто.
9. **Сделана.** Оговорка ушла с [D372]. Проба: `rg -n "node of the query" docs/spec` → пусто.
10. **Сделана.** Проба: `rg -n "million characters" docs/journal/D257.md` → строка замера
    11 октября, перенесённая из D268 как история, нового счёта нет.
11. **Сделана.** У каждой судьбы обоих проходов проба:
    [D353~2~reading.md](D353~2~reading.md) и этот разбор.

[D257]: ../../D257.md
[D296]: ../../D296.md
[D372]: ../../replaced/D372.md
[D373]: ../../replaced/D373.md
[D374]: ../../replaced/D374.md
