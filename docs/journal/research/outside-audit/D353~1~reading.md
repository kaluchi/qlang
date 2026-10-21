# Разбор десятого внешнего аудита

Чтение модели, сессия 497db7b4, 2026-10-20. Аудит — [D353~1.md](D353~1.md):
чистый Opus с промптом `scripts/outside-audit-prompt.txt` на дереве
aa7019da, master, сам базис, посадка values-under-two-tags. Его вызвала
D353 по слову мейнтейнера, «а то давно не запускали и сформировать
прочтение» (maintainer, 2026-10-20 20:20 UTC, session 497db7b4), хотя её
правило не пускает аудит, пока батчи несут открытые записи; её `Runs.`
держит запуск. Девятый аудит и его
разбор стоят рядом, [D327~1.md](D327~1.md) и
[D327~1~reading.md](D327~1~reading.md). Каждое утверждение ниже
проверено запуском `qlang` того же дерева.

Прогон шёл из worktree коммита aa7019da вне репозитория, со своей
установкой и сборкой: в checkout работала другая сессия, а глобальный
`qlang` машины — npm-link на этот checkout. Читатель брал язык своего
дерева: ребёнок, запущенный с его флагами и окружением, находит первой в
PATH обёртку `qlang-of-the-tree-…` и отвечает на
`[1 2] | filter ~(1) !| type` так, как master,
`::vec/filter/ConditionNotBooleanError`, а не так, как ветка той сессии,
`::vec/filter/ConditionKindNotTakenError`. Команды Bash, которые только
читают, харнесс пропускает и без разрешения: читатель выполнил `ls`,
`time qlang` и сразу после первого экрана и листинга дерева
`cat CLAUDE.md | head -80`, так что затравку процесса прочёл до своего
взгляда, и его §6 на неё опирается;
`git log` и `git show` при том же старте просят разрешения и не проходят,
история вне его досягаемости.

## Что поменялось с девятым

Ушло: не названо снова.

- Тег второго слагаемого больше не теряется:
  `::W#5 | add ::H#1 !| get [~(type) /leftType /rightType]` отвечает
  `[::call/KindsMismatchedError ::W ::H]`, выбор мейнтейнера в D388.
- Кодек: `{:"__proto__" 1 :b 2} | json` отвечает `{"__proto__":1,"b":2}`,
  JSON со входа держит порядок текста, `{"b":1,"2":2,"a":3}` даёт
  `[:b :"2" :a]`.
- Строки упорядочены по кодовым точкам, как их считает `count`:
  `["ﬁ" "😀"] | sort` отвечает `["ﬁ" "😀"]`, D334.
- Код возврата: `--fail` даёт отказу 1, умолчание 0, D335.
- `5 | is ::Numbr` по-прежнему `false`: D382 отложила отказ, значение под
  тегом, которого никто не объявил, — значение [QSNAM#address].
- `::W#"a" | payload | type` по-прежнему `::regex`; `manifest` вперемешку,
  `[1 2] | payload`, `keys` против `entries`, `map`, сбрасывающий тег,
  `:vec/sum ~(count)` — не названы, дерево отвечает, как отвечало.
- Два поля одной записи и семейство `*Of` не названы; первая страница
  держит свой абзац, `get /price | mul (get /qty)` отказывает
  `::path/SubjectHasNoPartsError`.
- Отказ слова, зависящий от числа видов, на которых оно живёт:
  `5 | count` отвечает `::call/KindAnswersNoVerbError`, `5 | concat [1]` —
  `::vec/concat/SubjectNotVecError`. Десятый его не называет. Разбор
  девятого внёс его в D311, и D355 решила ось: где имя держит один глагол,
  отказывает он под своим адресом, где несколько — вызов, а счёт идёт по
  глаголам скоупа [QSDSP#residence], [QSDSP#refusal].

Названо снова:

- имя со значением или цитатой отвечает ими поздним шагом, D256:
  `:inc ~(add 1) | [1 2] | inc` отвечает `~(add 1)`,
  `:five 5 | [1 2] | five` — `5`; девятый голосовал за тривию, десятый — за
  отказ;
- хранимый код не видит значений читателя, D281, куда влилась D304, пятый
  аудит подряд, и снова замыкание через `fill`;
- `reduce 0 ~(add)` против любой другой цитаты, теперь по правилу,
  которое решил мейнтейнер в D367;
- значение или код у условий: у девятого три формы, у десятого четыре, к
  `if`, `cond` и `allOf` он добавил `coalesce`;
- регистр прозы, десятый аудит подряд;
- грамматика: перенос строки у объявлений, комментарии на символе пайпа,
  продукции отказов, D295; с девятого она выросла с 938 до 1084 строк;
- отступ прозы в страницах, D295;
- вес процесса и глава работы в `docs/spec/`, с девятого выросшая с 614
  до 889 строк;
- печать без бюджета по умолчанию, D327: у девятого — `shape`, `paths` и
  `elide` на первом экране, у десятого — прямо бюджет хоста; первый экран
  по-прежнему печатается в 14491 знак;
- синонимы `size`, `length`, `flatten`: девятый просил подсказку в
  `:nearest` вместо слов, десятый — убрать их из `manifest`;
- построчный JSON, `--jsonl`;
- старт: девятый его не называл, разбор девятого мерил 0,86–0,92 с,
  десятый пишет около секунды, его `time qlang '1 | add 1'` — 1,04 с; в
  этой сессии `node cli/src/bin.mjs '1'` шёл 1,1–1,7 с; D257 держит
  ленивую загрузку корня.

## Что он нашёл нового

Проверено пробами:

- **Своя функция требует страницы на каждом входе (3.5).**
  `:number/plus (::fn | takes :by /0 | impl ~(add by))` отказывает
  `::fn/CommandNotTakenError`, `:index 1`, `:actualValue /0`: вход — это
  имя, страница, место и виды [QSBLD#input]. Восьмой называл эту
  церемонию, девятый нет; вернулась.
- **`has` вектора — два вопроса по виду того, что ему дали (3.8).**
  `[5 6] | has 0` отвечает `false`, `has 5` — `true`, `has /0` — `true`:
  значение спрашивает элемент, путь — часть, по правилу [QSPTH#has]. Его
  “одно имя, два смысла” верно.
- **`:actualType` отказа аргументов — тег адреса (3.8).**
  `5 | range 100 !| get [~(type) /actualType]` отвечает
  `[::number/range/ArgsBeyondInputsError ::number/range]`: аргументы
  вызова — вектор под тегом адреса глагола [QSBLD#input], факт — вид
  отказанного значения [QSERR#site]. Последовательно, но читатель видит в
  `:actualType` то вид субъекта, то адрес.
- **Сравнение отказывает под `::call`, а не под `gt` (3.8).**
  `"a" | gt 1 !| type` отвечает `::call/KindsMismatchedError`: один отказ
  вызова для пары, выбор мейнтейнера в D388 [QSCND#compare].
- **`explain` даёт статичный пример (3.7).** `{:a 1} | get /b !| explain`
  отвечает страницей `::path/KeyNotInMapError`, её пример — “after
  `get /dependencies |`…”, а факты вызова, `:key :b` и `:nearest [:a]`,
  стоят в `:value`. Страница отказа одна на все вызовы [QSSLF#explain];
  консилиум D327, часть 8, оставляет её прозу под алертом целой.
- **Печать `source` вытягивает команду цепочки в строку (3.11).**
  `::vec/sort | source` печатает 60 строк, каждая команда цепочки — закон
  с его страницей и запросом — одной строкой до 214 знаков, а каталог
  пишет имя, док и запрос на своих строках [QSWRK#catalog]. Печать здесь
  следует своему правилу, часть в одну строку стоит на одной строке
  [QSPRN#print]; ширины печати не держит ни одно правило.
- **Скорость вычислителя (3.12).** Каждый шаг идёт через `async`/`await`
  (`eval.mjs:55-72`).
  `100000 | range | map ~(get [~(it) ~(mul 2)]) | filter ~(get /1 | gt 10) | count`
  идёт 6,6 с, тот же запрос на 300000 — 11,3 с, `100000 | range | map ~(mul 2) | sum` —
  1,7 с со стартом. Его 25 с на миллионе правдоподобны. Анализ батча 27
  ищет рост сверх линейного; постоянную цену шага не держит никто.
- **`coalesce` берёт и значения, и код (3.1).** `null | coalesce 1` и
  `null | coalesce ~(1)` отвечают `1`, `null | coalesce 1 2` отказывает
  `::any/coalesce/alternatives/ValuesAloneError`, и страница пишет `~(it)`
  для субъекта [QSCND#coalesce].
- **Проза спецификации (3.7).** `QSBLD-functions-and-kinds.md:12-44` —
  один абзац из пяти предложений, три из них в 85, 134 и 135 слов. Слова,
  которые он считает своими: subject, modifier, label, noun, lane, flight,
  door, “error at rest”, tells/wraps/carries/proves. У девятого были lane,
  withheld, residence, walk, label, noun, node, topic, axis: residence,
  walk, node, topic и axis ушли из списка, flight, door, subject и modifier
  пришли.
- **Мелочи.** `{:a null} | query /a 5` отвечает `null`: умолчание — для
  пропущенной части, `null`, стоящий на пути, отвечается как стоит
  [QSPTH#query], и `query /a | coalesce 5` отвечает `5`. `kinds` отвечает
  одно и то же на `5` и на `"x"`: его страница — “whatever the subject”,
  как у `env`.

## Где он ошибся или неточен

- **§6, “альтернативу, которую там отвергли” (D281).** Замыкание через
  `fill` стоит в D281 открытой дорогой со своей ценой, “the quote under
  the name no longer being the text written and of a value declared after
  it never reaching it”, а не отвергнутой. Слово мейнтейнера на этой оси
  есть и связывает: «в цитате никакого скрытого энва! цитата это чистые
  данные, голый литерал!» (maintainer, 2026-10-13 06:21 UTC, session
  d65e4c1d, в D367). Дорога `fill` его держит: значения вписаны в текст
  цитаты, а не спрятаны.
- **3.4, “AIM обещает naming with lexical scope, сейчас это неправда”.**
  Шаг и цитата, написанная в шаге, читают имена перед ними,
  `:n 3 | [1 2] | map ~(mul n)` отвечает `[3 6]`; не читает их код,
  хранимый как данные [QSQUO#held]. Расходится с хранимым кодом
  классическое замыкание, и это ось D281, а не ложь первого пункта цели.
- **3.9, “трасса теряет самый полезный факт”.** Трасса его держит: кадр
  `filter` — вектор и место `/1`, и `!| get /trace/1/0/1` отвечает
  `{:name "Bo" :age "15"}`. Прячет запись алерт, где субъект позднего
  кадра уступает элизии. Консилиум D327, часть 2, оставил алерт как есть,
  запись — одно чтение; десятый — второй читатель после ревью
  D337~1, `git show a65a21b5:docs/journal/research/reviews/D337~1.md`,
  который этого чтения не сделал.
- **3.8, “`contains` фактически дублирует `has`”.**
  `[/a] | get [~(contains /a) ~(has /a)]` отвечает `[true false]`:
  `contains` спрашивает путь, лежащий элементом, как и пишет [QSPTH#has].
- **3.11, “складывает цепочку в нечитаемую строку”.** Строка на команду
  цепочки, до 214 знаков, а не одна на цепочку.
- **3.6, “разрешён `filter(gt(1))`”.** Грамматика читает его как вызов с
  группой, вызов отказывает `::vec/filter/predicate/KindNotTakenError`, а
  `filter(~(gt 1))` отвечает `[2 3]` [QSSYN#step]: прочитан и отклонён с
  починкой.
- **Мелочи, “`shape` помечает элементы списка `::absent`”.**
  `[{:a 1 :b 2} {:a 3}] | shape` отвечает
  `::shape[{:a ::number :b ::absent::number}]`: метка у ключа, которого
  нет в части записей [QSPTH#shape].
- **3.7, “страница `coalesce` занимает около 200 слов”.** 347.
- **§6, “около 20 открытых”.** Открытых 14, в силе 19, в `replaced/` —
  375.
- **§6, D295, D333 и D339, часть 12, как несогласие.** Это согласие.
  Маленькая грамматика с проходом отказов над деревом разбора — первая
  дорога D295. Явный глагол с исходом каждой части — ведущая дорога D333.
  Каждый факт на одной странице — дорога, которую консилиум выбрал для
  D339, части 12, и которую несёт батч 27.
- Остальные его пробы на этом дереве отвечают, как он пишет:
  `kinds | toVec | map ~(runLaws | filter ~(get /ok | not) | map /law) | flat`
  отвечает `[]`, опечатка `mapp` — `:nearest [:map]`,
  `QSQUO-code-as-data.md:249-263` — абзац о полосе хранимого кода,
  `eval.mjs:844` — `foldingCodeOf`.

## Что просило вашего слова

1. **Имя в позднем шаге, D256.** Второй аудит подряд, и голоса разошлись:
   девятый — за тривию под ответом, ваш первый вариант, десятый — за
   отказ, как D248 отказывает значению в позднем шаге. Запись ждёт вашего
   слова на своей оси.
2. **Замыкание через `fill`, D281.** Пятый аудит подряд предлагает его.
   Ваше слово против скрытого окружения в цитате стоит, и дорога `fill`
   его не нарушает; её цена — цитата под именем, напечатанная не так, как
   написана, и значение, объявленное после неё, до неё не доходит. D353
   держит D281 среди записей, ждущих вашего слова.
3. **Вес процесса.** Десятый, как и девятый, не принимает журнал “вне
   счёта”: седьмое состояние цели ставит журнал вне счёта диффа, а читает
   его каждая сессия. Цель держится на ваших словах.

## Что сделано без вашего слова

- В коде — ничего, в записях — только строка `Runs.` записи D353, которую
  написал скрипт; рядом с ней в дереве стоят отчёт и это прочтение.
  Судьбы со словом open в конце ждут переноса в открытые записи своих
  осей.

## Судьбы находок

The problems, its third section:

1. Value or code at the inputs. By [QSQUO#modifier], [QSCND#branch], [QSCND#boolean] and [QSCND#coalesce], each input by its rule: the condition of `if` computed once, the code that runs by element or by choice a quote, `allOf` and `coalesce` taking either; set aside as in the ninth.
2. The form of the reducer. By [QSCOL#reduce], the maintainer's rule in D367, «ну и само собой полная форма ~(add) остается за главную...» (maintainer, 2026-09-23 21:43 UTC, session 86982eb5); set aside.
3. A bare name answering its value as a later step. Open as D256, the tenth voting for its refusal as D248 refuses a value written there; a value named as a word met aloud at the call by [QSNAM#reach], its refusal at the declaration waiting beside D256.
4. Held code and the values of the reader. Open as D281, the closure by `fill` among its roads, which keeps the maintainer's word against a hidden environment in a quote.
5. The page of every input. By [QSBLD#input]; a short form of a function waits for a task.
6. The grammar. Open as D295, its first road the tenth's, which the twenty-seventh batch of D353 decides.
7. The prose. The words by [QSWRK#documents], distilled at each run of the pentimento audit; the length of the sentences of the chapters and the pages, named by the tenth audit in a row and held by no record in force since D294 left: open.
8. Words of several senses. `has` by [QSPTH#has], `contains` asking a path held as an element; the aliases by the maintainer's D321 and [QSWRK#catalog]; the `:actualType` of the args by [QSBLD#input] and [QSERR#site]; the comparison refused under the call by the maintainer's D388 and [QSCND#compare].
9. The record a filter failed on. Open as D327, its part 2, where the consilium keeps the alert as it stands and the record one read away, `!| get /trace/1/0/1`; the tenth the second reader after the review D337~1 to miss that read.
10. The print of an answer whole. Open as D327, the bound at the print of every host, its parts from the third to the seventh, which the twenty-fifth batch of D353 carries.
11. The print of a doc and of a source. The indentation of a page's prose open as D295, its road of a doc read without the indentation of its source; each command of a chain on a line of its own by [QSPRN#print], a part of one line staying on its line, up to 214 characters, and no width of the print held by any record: open; beside the road of the printer in D295.
12. The speed. The start open as D257, its lazy boot of the root; the constant price of a step, `async` at each, held by no record and asked by no task: open; to carry beside the lazy boot of D257.
13. The small ones. `query` and its default by [QSPTH#query], `coalesce` after it; the marks of `shape` by [QSPTH#shape]; `kinds` by its page, as `env`.

Its order of the effort, the fourth section: one rule of value or code set aside with the first problem; the bare name with D256; the closure with D281; the prose with the seventh problem; the budget by default with D327; the grammar with D295; a synchronous evaluator with the twelfth problem.

Its proposals, the fifth section: a short form of a function waits for a task, the page of an input staying the rule of [QSBLD#input]; quotes closed over their names and printed through `fill` in D281; a word that settles each part of a template, the leading road of D333; a check of the traps before a run, a tool the language server would share, waits for a task; the aliases out of `manifest` set aside by D321, as the ninth's `:nearest` was; `has` and `contains` split across the kinds set aside by [QSPTH#has]; an `explain` of two steps against D327 part 8, which keeps the prose of the page whole below the alert; a synchronous evaluator with the twelfth problem; `--jsonl` set aside by D335, `--raw` with `lines | map ~(parseJson)` reading JSON a line, which the usage shows; the chapter of the work out of `docs/spec/` set aside by [QSWRK#documents].

Its disagreements, the sixth: lexical scope and the closure with D281, the road it calls rejected standing among its roads; one sense against the paradigms by the aim, which ranks the two as one choice, a term of one sense where the rest is equal and the one a reader knows outside where two tie; the budget at the print of the host agreed with D327; D256 takes its vote for the refusal; D333, D295 and D339 part 12 agreements it read as disagreements; the journal outside the count of the seventh state the maintainer's to weigh; the measure of the mission agreed.

The run itself: the start of a clean reader lets the commands of Bash that only read pass beside `qlang`, `ls`, `cat`, `which`, `type` and `time`, so the reader read `CLAUDE.md` among its first commands, before its own view, while `git log` and `git show` ask approval and stay out of its reach; the head's `qlang` allowed names what the script allows, not all the reader ran, held by no record: open.
