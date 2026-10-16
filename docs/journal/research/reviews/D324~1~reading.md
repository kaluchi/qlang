# Разбор первого обзора `shape`

Чтение модели, сессия 70702c43, 2026-10-16. Отчёт — [D324~1.md](D324~1.md):
чистый Opus, запущенный, как сказано в шапке отчёта, на дереве
f67ae518, 2026-10-15, 16:12–16:18 UTC. Он гонял `shape` первой формы:
схема в литерале данных, записи без отметок, множество видов там, где
части расходятся. Обзоры `shape` запускал разовый скрипт сессии с флагами из
шапки отчёта; в дереве его нет. Промпт первого обзора стоит
ниже. Второй обзор добавил к страницам для чтения `::shape | doc` и
`::each | doc`, третий и четвёртый — ещё `::absent | doc` и
`::nullable | doc`; остальное слово в слово то же.

```
You are a clean reviewer of one word of qlang, a pipeline query language: `shape`. Its reference implementation lives in D:/git/qlang, and you run the language with `qlang '<query>' < /dev/null`; write `MSYS_NO_PATHCONV=1 qlang '…' < /dev/null` where a query begins with `/`. Do not modify anything, and do not start the interactive REPL.

First read what the language says about itself, as a session meets it: run `qlang '[::qlang ::cli] | map ~(get [~(it) ~(doc)])' < /dev/null` and read the answer whole. Then read the page of the word and of its neighbours: `qlang '::any/shape | doc' < /dev/null`, `qlang '::any/shape | laws' < /dev/null`, `qlang '::any/paths | doc' < /dev/null` and `qlang '::any/type | doc' < /dev/null`.

Your task: put `shape` through its paces as a model that meets unfamiliar JSON in the middle of a task and has to write a correct query on the first attempt. Feed it the kinds of data such a session meets: an API response with nested records and arrays; records whose fields differ in kind or are missing in some; null values; empty arrays and maps; deep nesting; a vector of vectors; a map whose keys are data, ids or dates, rather than names; a large array; mixed scalars; strings that hold numbers; and values under tags, quotes and docs. A query reads JSON pasted as a literal: `qlang '{"users": [{"name": "Ann", "age": 30}]} | shape' < /dev/null`.

For each case, say what you expected `shape` to answer before you ran it, what it answered, and whether the answer helped you write the next query: which paths to read, which fields may be missing or of another kind, how large the data is. Weigh the form of the answer: how it reads, what it costs in tokens against the data, what it leaves out that you needed, what it shows that you did not need, and how it compares with the forms you know, the TypeScript types inferred from JSON, JSON Schema, jq's `paths`, the dtypes of pandas, Clojure's spec and the like.

If you see another form of the answer that would meet your expectations better, propose it: write the answer it would give on the cases you ran, in qlang's own literal, say what it gains and what it costs, and how it would be read by the same paths as the data. Propose nothing that needs a construct qlang lacks without saying so.

Report in Russian, keeping queries, names and answers as they are: first a verdict in a few sentences; then the cases, each with its probe, a fenced block whose lines that begin with `> ` are the queries you ran and whose other lines are what qlang printed, exactly, your expectation and your judgement; then your alternative form, if you have one, with its examples. No preamble and no praise.
```

Судьбы:

- **Сделана.** Правка в дереве, правило держит [D324]; проба на дереве,
  где обзор сделан.
- **Открыта.** Ось держит открытая запись: очертание полегче, счёт и
  примеры — дорога очертания в [D327], подводные камни — абзац о `shape`
  в [D332].
- **Снята.** Довод стоит в строке.

1. Отсутствующий ключ и null давали один ответ. Сделана: ключ, которого
   нет у части записей, — `::absent`, null — `::nullable`,
   `[{:a 1} {:a null} {}] | shape` отвечает
   `::shape[{:a ::absent::nullable::number}]`.
2. Вектор, пустой у части записей, не отмечен. Сделана:
   `[::absent E]`, проба в [D324].
3. Путь данных не читал «объект или null». Сделана: `::nullable{…}`
   читается путём, `/0/author/login` даёт `::string`. Объединение разных
   составных видов путь по-прежнему не читает. Открыта: [D332].
4. Map с ключами-данными не сворачивалась и была длиннее данных. Сделана:
   `::each{<первый ключ> E}`.
5. `elide` не режет map в ширину. Открыта: дорога вида в [D327].
6. Теги — глухие листья, тег верхнего уровня теряется, множества — глухой
   `::set`. Множества сделаны, `#[E]`. Теги сняты словами мейнтейнера
   «тэги сами расскажут о себе» (Source [D324]). Потеря тега над
   субъектом открыта: [D332].
7. Нет размеров и частот. Открыта: [D327], слово `profile`.
8. Кортежи сливались в объединение. Сделана: `[A B]`.
9. Глубокая вложенность дорого печатается лесенкой. Открыта: [D327],
   очертание полегче.
10. Строка с числом не отличается от любой строки, нужен пример. Открыта:
    [D327], примеры в `profile`.
11. Альтернативная форма: `::OrAbsent`, `::OrNull`, `::OrEmpty`, `::mapOf`
    с размером и образцом, `::setOf`, тег над схемой. Сделана в своём
    виде: `::absent`, `::nullable`, `[::absent E]`, `::each`, `#[E]`.
    Размер и образец открыты в [D327], тег над схемой снят, как в пункте
    6.

[D324]: ../../D324.md
[D327]: ../../D327.md
[D332]: ../../D332.md
