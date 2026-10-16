# Разбор первого обзора следа из кадров

Чтение модели, сессия d7f52e95, 2026-10-16. Отчёт — [D337~1.md](D337~1.md):
чистый Opus, запущенный, как сказано в шапке отчёта, на дереве
65bbd4e2, 2026-10-16, 06:30–06:36 UTC. Он гонял след первой формы
D337: кадр на строку при двух кадрах и больше, субъект каждого
следующего кадра маркером, где маркер короче. Обзор запускал разовый
скрипт сессии с флагами из шапки отчёта; в дереве его нет. Промпт
стоит ниже.

```
You are a clean reviewer of one form of qlang, a pipeline query language: the path a failure flew, the trail of its frames. Its reference implementation lives in D:/git/qlang, and you run the language with `qlang '<query>' < /dev/null`; write `MSYS_NO_PATHCONV=1 qlang '…' < /dev/null` where a query begins with `/`. Do not modify anything, and do not start the interactive REPL.

First read what the language says about itself, as a session meets it: run `qlang '[::qlang ::cli] | map ~(get [~(it) ~(doc)])' < /dev/null` and read the answer whole. Then read the pages of the form and of its neighbours: `qlang '::trail | doc' < /dev/null`, `qlang '::frame | doc' < /dev/null`, `qlang '::frame | manifest | map ~(get [~(it) ~(doc)])' < /dev/null`, `qlang '::error/trail | doc' < /dev/null`, `qlang '::qlang | doc :errors' < /dev/null` and `qlang '::elision | doc' < /dev/null`.

Your task: put the trail through its paces as a model that meets failures in the middle of a task and has to repair its query on the next attempt. Make the failures such a session meets: a step that fails at the top of a query; a failure inside the code of `map`, `filter`, `sort`, `groupBy` or `reduce` over records of JSON, one of which holds a field of the wrong kind or lacks it; a failure deep in nested data and nested words; a failure inside a named quote run by `apply`, inside a group and inside a template of `get`; a failure caught by `!|` that fails again; a map raised by `raise`, an error at rest raised again, and one written with frames; a failure over a large input, where the alert cuts the subjects; and a query that reads the trail, its frames, their subjects, steps, skipped steps and places, by the words of a frame and by paths. A query reads JSON pasted as a literal: `qlang '{"users": [{"name": "Ann", "age": "30"}]} | get /users | filter ~(get /age | gt 18)' < /dev/null`.

For each case, say what you expected the failure to show before you ran it, what it printed, and whether it told you where the query broke, on which value and on which element of the data, and how to repair the query or the data. Weigh the form: how it reads, what it costs in lines and tokens against what it tells, what it leaves out that you needed, what it shows that you did not need, and how it compares with the traces you know, the tracebacks of Python, the stacks of JavaScript and of the JVM, the error chains of Rust, the errors of jq and of SQL.

If you see another form that would meet your expectations better, propose it: write what it would print on the cases you ran, in qlang's own literal, say what it gains and what it costs. Propose nothing that needs a construct qlang lacks without saying so.

Report in Russian, keeping queries, names and answers as they are: first a verdict in a few sentences; then the cases, each with its probe, a fenced block whose lines that begin with `> ` are the queries you ran and whose other lines are what qlang printed, exactly, your expectation and your judgement; then your alternative form, if you have one, with its examples. No preamble and no praise.
```

Судьбы:

- **Сделана.** Правка в дереве, правило держит [D337], проба на дереве
  после правки.
- **Открыта.** Ось держит открытая запись.
- **Снята.** Довод стоит в строке.

1. Субъект следующего кадра уходит в `::elision`, и запись, по которой
   узнают сломанный элемент, не печатается нигде: `{:name "Bo" :age
   "15"}`, `{:host "b" …}` (случаи 2 и 4, пункт 1 альтернативы).
   Открыта: [D327], дорога «часть, которую называет кадр», с тремя
   формами и их ценой; проба там же, `grep -c Bo` по алерту фильтра
   отвечает `0`. Выдержка у `:index 700` в `sum` (случай 8) туда же не
   идёт: отказ называет элемент сам, `1000 | range | update /700 ~("x")
   | sum !| get [/index /actualValue]` отвечает `[700 "x"]`.
2. Шаги уровня до сломанного теряются: `"15"` не связано с `/age`, а
   место — `/1`, а не путь в данных (случаи 2 и 4). Снята: шаги до
   сломанного стоят в шаге следующего кадра, где код слова написан
   целиком, `~(filter ~(get /age | gt 18))`; кадр держит шаги от
   сломанного, чтобы `skipped` доигрывал уровень, и сам обзор не
   предлагает четвёртого поля. Пути в данных значение не несёт: оно не
   помнит, откуда его прочли.
3. В шаблоне `get` у кадра нет места, ключ шаблона не виден (случай 5,
   пункт 3 альтернативы). Снята: место — путь части субъекта, на которой
   слово гоняло код, а код шаблона идёт по всему субъекту; путь `/y`
   адресовал бы шаг, а не субъект, и сломал бы закон `subject | get (f
   | place)`, что обзор сам называет ценой. Часть шаблона называет
   внутренний кадр, его субъект и шаги: `{"a": "1", "b": "2"} | get
   {:x ~(get /a | toNumber) :y ~(get /b | add 1)} !| trail | map
   ~place` отвечает `[null null]`, а первый кадр — `["2" ~(add 1)]`.
4. Повторный подъём теряет перехват и место подъёма, а к кадрам,
   записанным рукой, приклеиваются шаги запроса (случай 7, пункт 4
   альтернативы). Снята: `x !| raise` есть `x` по слову мейнтейнера,
   [D13] («Decided by. The maintainer»), и ошибка, напечатанная и
   прочитанная назад, при подъёме — та же ошибка. Так держат исходный
   след и голый `raise` в Python, и `throw e` в JVM. Кадр читается как
   кадр того же запроса без перехвата, который ничего не изменил:
   `[1 "x"] | map ~(mul 2) !| raise | count !| trail | last | step`
   отвечает `~(map ~(mul 2))`. Сменить это может только слово
   мейнтейнера об этой оси.
5. Карта под `raise` печатается дважды, как факты и как субъект кадра,
   а при пустом следе — 11 строк ради `{:k 1}` (случай 7, пункт 5
   альтернативы). Снята: кадр `raise` называет значение, которое
   встретил шаг, как любой кадр. С кадром на одной строке, пункт 8,
   `!{:k 1 :trail ::trail[]} | raise` печатается в четыре строки.
6. Код вложенного quote повторяется на каждом уровне, и цена растёт
   квадратично с глубиной (случай 7). Снята: шаг кадра — шаг уровня, как
   он написан, с кодом в аргументах, чтобы `skipped` доигрывал его, а
   quote не держит маркера.
7. Кадр группы `~((count | sub "1"))` — лишняя строка (случай 5).
   Сделана: аргумент шага, группа и шаблон среди них, отвечает в кадре
   своего шага, `[1 2 3] | take (count | sub "1") !| trail | map ~step`
   отвечает `[~(sub "1") ~(take (count | sub "1"))]`; кейсы
   `a-group-written-as-an-arg-answers-within-the-frame-of-its-step` и
   `a-literal-written-as-an-arg-answers-within-the-frame-of-its-step`.
   Кадр группы, которая стоит шагом, остаётся: она шаг своего уровня.
8. Структурный субъект печатается лесенкой: выдержка из четырёх записей
   занимает больше 20 строк, субъект в 30 знаков — 9 строк (случаи 4 и
   8, пункт 2 альтернативы). Сделана: кадр печатается на одной строке,
   что бы ни держал его субъект, след ошибки среди этого, а алерт меряет
   субъект на этой строке. `{:a {:b [1 2]}} | get /c !| trail` отвечает
   `::trail[::frame[{:a {:b [1 2]}} ~(get /c)]]`; кейсы
   `a-frame-prints-on-one-line-whatever-its-subject-holds` и
   `a-frame-prints-the-trail-of-an-error-it-holds-on-its-one-line`, закон
   `::frame` `:printsOnOneLine`. Факты ошибки, `:actualValue` карты в
   `toMap`, печатаются общей печатью лесенкой. Открыта: [D327], дорога
   очертания.
9. У кадра `reduce` нет места, сверху стоит кадр тела `sumOf`, а тег,
   `:index 1` и совет `map /amount | sum` говорят о `sum` (случай 3,
   пункт 6 альтернативы). Места нет только в печати отчёта: в дереве
   оно есть, `[{"p": 1}, {"p": 2}, {"p": "3"}] | reduce 0 ~(sumOf /0
   /1/p) !| trail | last | place` отвечает `/2`. Проба рядом нашла
   дефект: свёртка одного слова теряла место, когда вызов отказывала
   сама диспетчеризация, `[1 2 "3"] | reduce 0 ~(sum)`. Сделана: такой
   отказ отвечает на месте элемента, `!| get [~(type) ~(trail | last |
   place)]` даёт `[::call/KindAnswersNoVerbError /0]`; кейс
   `the-frame-of-reduce-names-the-element-a-call-of-its-one-word-is-refused-at`.
   Кадр тела `sumOf` снят: слово каталога, написанное запросом,
   `~(get numbers | sum)`, проходит кадры своего тела, как любой код,
   и `:index 1` читается против субъекта этого кадра, `[3 "3"]`; отказ
   называет слово, которое отказало, [QSERR#site].
10. У `SubjectNotNumberError` нет `:actualValue`, а страница молчит
    (случай 6). Снята: глава `::qlang | doc :errors` говорит: «The facts
    name what refused, and the first frame of the trail holds the value
    the step refused»; отказ субъекта не повторяет значение, которое
    держит первый кадр.
11. Перехват, упавший снова, даёт след `["x" ~(mul 2)]`, который не
    отличить от исходного отказа (случай 6). Снята: так совпал запрос,
    оба шага — `mul 2` над `"x"`; `[1 "x" 3] | map ~(mul 2) !| get
    /trail/0/0 | mul 2 !| trail` отвечает `::trail[::frame["x" ~(mul
    2)]]`, кадр шага, который упал, а шагов до сломанного не держит ни
    один кадр, пункт 2.
12. Сломанный шаг и пропущенные слиты в один quote (случай 1). Снята:
    первый шаг quote сломался, так говорят страница `::frame` и первая
    страница, и обзор так его и прочёл; `"x" | add 1 | mul 2 !| trail |
    first | get [~(step) ~(skipped)]` отвечает `[~(add 1) ~(mul 2)]`.
13. На длинном хвосте, `range 1000 | …`, строка кадра — весь запрос,
    около 200 знаков (случай 1). Снята: шаги кадра — его уровень от
    сломанного шага, их доигрывает `skipped`, а quote не держит маркера.
14. Страница `::path/KeyNotInMapError` — 10 строк, четыре из них о
    `get /dependencies |` (случаи 1–6). Снята: это не работа D337;
    предложение отвечает промаху замера, модификатору, прочитанному
    против субъекта, который сменил прежний шаг, в четырёх задачах из
    одиннадцати, [D141].
15. Номер кадра приходится считать, и место есть не у каждого кадра,
    так что `trail | map ~(get /2)` падает (случай 9). Снята: `place`
    отвечает null, где места нет, так говорит его страница, а `first` и
    `last` читают концы следа; `[{"host": "a", "ports": [80]}, {"host":
    "b", "ports": [80, "x"]}] | map ~(get /ports | map ~(add 1)) !|
    trail | map ~place` отвечает `[null /1 /1]`.
16. `IndexOutOfBoundsError` не говорит, что сломался сегмент `/3` после
    `/a/b/c` (случай 4). Снята: это не след; отказ пути называет путь,
    место и вектор, который встретил, `!| get [/index /actualValue]`
    отвечает `[3 [1 2 {:d 5}]]`.
17. Запись без `:k` в `sort` не замечена, и после починки будет второй
    отказ (случай 3). Снята: шаг останавливается на первом отказе, как
    обзор и сказал.

[D13]: ../../replaced/D13.md
[D141]: ../../replaced/D141.md
[D327]: ../../D327.md
[D337]: ../../replaced/D337.md
[QSERR#site]: ../../../spec/QSERR-errors.md#site
