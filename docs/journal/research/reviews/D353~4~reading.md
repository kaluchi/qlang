# Разбор третьего прохода рецензента перед посадкой ветки the-code-is-its-steps

Чтение модели, сессия d7f52e95, 2026-10-19. Отчёт — [D353~4.md](D353~4.md):
тот же рецензент, продолженный сессией с двумя проходами в контексте, на
дереве 1e7c0913, 19:19–19:24 UTC, вердикт `changes asked`, семь находок.
Главная — шаг у курсора и знаки автодополнения, которые сервер писал сам:
третья починка отдала их ядру, а [D374] вернула серверу.

Промпт, на который он отвечал:

```text
Third pass, narrow: the session answered your second pass in commit 1e7c0913 (`git -C /d/git/qlang-worktrees/the-code-is-its-steps show 1e7c0913`): the rules of the tools the first repair wrote now stand in a record of their own, docs/journal/replaced/D372.md, dissolved into QSHST#tools and QSHST#stdin; the reports of your two passes are renamed by the record that called for them, docs/journal/research/reviews/D353~2.md and D353~3.md, each beside its reading with a probe for every fate, and D353 holds the growth of the diff and lists them under `Runs.`. Refute only this commit and the fates in D353~3~reading.md: a fate that does not hold, a rule D372 decides that the tree or the chapter contradicts, a probe that does not answer its sentence, and anything this commit writes against the rules of the work or the aim. Same rules: change no file, long commands under `timeout 300`, each finding with its file:line, the rule and the probe you ran. Return in Russian: the first line `Verdict: accepted` or `Verdict: changes asked`, then only the findings, numbered, the weightiest first.
```

Судьбы, каждая с пробой на дереве после починки:

1. **Отставлена.** Шаг у курсора не пишет глагола корня: сервер отбрасывает
   его до шагов, `steps.slice(0, -1)` в `lsp/src/features.mjs`, и годится
   любое слово. Знаки автодополнения — настройка сервера, когда спрашивать,
   а не факт языка: их список в ядре стал второй грамматикой поверх парсера,
   без `~` цитаты имени и с `|` и `~`, которые открывают и закрывают
   комментарий. Третья починка отдала оба ядру, [D374] вернула их серверу.
   Проба: `git grep -c -F "steps.slice(0, -1)" -- lsp/src/features.mjs` → одна строка;
   `git grep -l -F -e "partsBeforeACursor" -e "SIGNS_A_WORD_FOLLOWS" -- core/src lsp/src` → пусто.
2. **Сделана.** Глава говорит об именах, до которых доходит сервер, а не об
   именах, которые шаг может вызвать, и называет расхождение чтения по тексту
   с языком. Проба: `rg -n "reaches a node" docs/spec/QSHST-hosts-and-the-command-line.md` → одна строка.
3. **Сделана.** Из [D353] история ушла: рост документов — рост журнала,
   который [D373] выводит из счёта, рост тестов держит открытая запись их
   оси, [D296]. Проба: `rg -n "grew its documents|grown past" docs/journal/D353.md` → пусто;
   `rg -n "D353~2.md" docs/journal/D296.md` → одна строка.
4. **Сделана частично.** Отчёты остаются названными по записи, чью работу
   читал рецензент, — так велел мейнтейнер, назвав имя с датой мусором,
   «docs/journal/research/reviews/2026-10-19-the-code-is-its-steps.md -
   вообще не по формату названо .. мусор» (maintainer, 2026-10-19 19:12 UTC,
   session d7f52e95); README исследований называет теперь и ревью ветки,
   несущей пачки записи, по этой записи, и читателя, которого запускает
   сессия, рядом с чистым. Строки `Runs.` написала сессия, потому что эти
   ревью запустил не скрипт; слово `clean` у рецензента ушло из [D372] и из
   строки `Runs.` у [D353].
   Проба: `rg -n "reader the session starts" docs/journal/research/README.md` → одна строка;
   `rg -n "clean reviewer|clean reader" docs/journal/replaced/D372.md docs/journal/D353.md` → пусто.
5. **Сделана.** `Left at` у [D372] называет коммит этой починки, где глава
   держит то, что запись решила. Проба: `git show <Left at>:docs/spec/QSHST-hosts-and-the-command-line.md | rg -c "partsBeforeACursor"` → `1`.
6. **Отставлена с [D374].** Раздел QSHST#tools пишется при переносе заново,
   без шага и знаков из ядра и без их пробы. Проба:
   `node scripts/sensors/run-probes.mjs docs/spec/QSHST-hosts-and-the-command-line.md` → все ok.
7. **Сделана.** Промпт первого прохода стоит в его разборе целиком, проба
   судьбы 9 называет все пять цитат. Проба:
   `rg -n "Sample at least forty" docs/journal/research/reviews/D353~2~reading.md` → одна строка.

[D296]: ../../replaced/D296.md
[D353]: ../../D353.md
[D372]: ../../replaced/D372.md
[D373]: ../../replaced/D373.md
[D374]: ../../replaced/D374.md
