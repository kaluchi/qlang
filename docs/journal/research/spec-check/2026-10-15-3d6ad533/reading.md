# Разбор первой проверки глав

Это разбор модели, сессия e19131af, 2026-10-15. Семь чистых читателей
проверили дерево 3d6ad533, master после слияния the-voices-kept-apart, по
промпту `scripts/spec-check-prompt.txt`. Пробы отчётов перезапущены на
том же дереве: `node scripts/sensors/run-probes.mjs <отчёт>` ответил `ok`
на 267 из них. Расходятся три, и все три на стороне записи, а не дерева:

- проба строки, которую `content | lines | first` печатает без кавычек;
- `:source` ошибки разбора, сравнение печати на ней с потерями;
- `grep` по строке, которую ветка уже переписала.

Каждая находка ниже держит одну из судеб:

- **D303.** Правку делает эта ветка. Это код, страница, комментарий или
  кейс сейчас, а текст главы — при переносе базиса.
- **D304–D314.** Открытая запись своей оси.
- **Известна.** Ось уже держит открытая запись.
- **Снята.** Довод стоит в строке.

## Имена и диспатч (QSNAM, QSDSP)

1. design · QSNAM#scope — «declared once» считает написанное, а не
   исполненное: `{} | raise | :x 1 !| :x 2` отказывается. Открыта D305.
2. design · QSNAM#scope — данные под адресом доходят до тела слова и до
   удержанного кода, а голое значение не доходит. Открыта D304.
3. design · QSNAM#scope — одно чтение значения читателя даёт
   `UnknownNameError` в теле слова и `ValueWithheldError` в удержанном
   коде. Открыта D304, туда же ушло то, что значение `count` закрывает
   слово `count` в удержанном коде, а в теле слова нет.
4. design · QSNAM#binding — `env` и страница своей метки на трёх
   дорогах. Известна: D281.
5. design · QSDSP#residence — `#[1 2 3] | vec/reverse` отвечает `#[1 2 3]`:
   ответ, сохранённый видом субъекта, снова упорядочен. Открыта D306.
6. design · QSDSP#residence — функция хоста, прочитанная из печати, равна
   по `eq`, но словом не становится. Открыта D307.
7. design · QSNAM#value — `:actualValue` выпадает по идентичности
   объекта. D303: значение выпадает там, где оно равно субъекту, а это
   правило пишет QSERR#site.
8. conflict · QSNAM#owner — первая страница и `::qlang/names` говорят «no
   word of the root sees it» шире главы. D303: страницы сужены до слов
   на метках корня.
9. conflict · QSNAM#scope — страница `UnknownNameError` чинит то, что
   уже сделано. Открыта D304, вместе с 3.
10. text · QSNAM#binding — `source` записи и ось `source` разные.
    D303: глава и страница `::any/binding`.
11. text · QSDSP#refusal — условие `:nearest`, которое держит кейс.
    D303: текст.
12. text · QSNAM#address — правило тега слова, на которое ссылается
    QSLIT#tag. D303: текст и кейс.
13. text · QSNAM#reach — имя метки, которое тоже имя слова, отвечает
    словом. D303: текст.
14. conflict · `core/src/state.mjs:116` — комментарий шире главы.
    D303: комментарий.
15. conflict · QSNAM#letters — «takes any name» против слов литералов.
    D303: страницы.
16. case · QSNAM#address — у `UnknownAddressError` нет кейса. D303.
17. case · QSDSP#walk — узкая метка над широкой, `::vec | is ::vec`.
    D303.
18. case · QSNAM#root — `RootSourceNotDeclaredError` держит юнит-тест
    `core/test/unit/session.test.mjs`. Голое имя хоста, которое не
    метка, остаётся правилом хоста: источник ядра его не объявляет, и
    кейс ядра его не выразит. Снята.
19. case · QSNAM#declare — кейс `a-verb-moved-left-answers-as-inline`
    показывает QSQUO#modifier. D303: перенесён.

## Функции, виды, ошибки (QSBLD, QSERR)

1. design · QSBLD#fn — функция примитива из печати, контракт и
   `::builtin{}` вида читателя. Открыта D307.
2. conflict · QSERR#flow — `coalesce` ловит сбой без `!|`. Известна:
   D299.
3. implementation · QSBLD#input — вход `::map` и `::vec` сохраняет самый
   внутренний тег, вход числа не сохраняет ни одного. Открыта D308.
4. design · QSBLD#input — `/0` и `~(get /0)` по-разному считают
   лишние места. Известна: D274.
5. design · QSERR#site — `sumOf` отказывает значению и пути под
   разными адресами. Открыта D309.
6. design · QSBLD#fn — контракт под меткой даёт три ответа. Открыта D307.
7. design · QSERR#catch — после `!|` голый путь отказывается, а
   литерал путей отвечает данными. Открыта D310.
8. implementation · QSERR#trail — вектор и карта под тегом проходят как
   «plain» след. D303.
9. design · QSERR#trail — ошибка покоя с пустым `:trail` после `raise
   !|` перестаёт быть собой, а шаги, которые она пропустила, теряются.
   Открыта D314: глава прямо пишет «empty among them». Страница
   `::map/raise` сказала «an error at rest raised again is itself» шире
   дерева. D303: страница сужена до ошибки, открытой перехватом.
10. conflict · QSERR#site — отказы `get`, `put` и `update` под
    `::path`. D303: текст, отказ чтения пути живёт под `::path`, какое бы
    слово ни читало путь.
11. conflict · QSBLD#input и QSBLD#recipe — что видит инвариант
    входа. D303: «alone» в QSBLD#recipe говорит о том, какие имена
    читаются.
12. text · QSBLD#fn — факт стоит под отказом. D303.
13. text · QSBLD#fn и QSBLD#kind — слова литералов и вектор видов.
    D303: текст и страница.
14. text · QSBLD#chain — quote и путь под словом. D303.
15. text · цитаты разделов в коде. D303: комментарии.
16. case · десять отказов без кейсов. D303.
17. case · четыре кейса не в своём разделе. D303.
18. apophasis · три «so … changes no tag». D303.

## Текст, условия, код (QSTXT, QSCND, QSQUO)

1. design · QSCND#coalesce — `null`, вычисленный при вызове. Известна:
   D299.
2. design · QSQUO#held — `map (~(add k))` удерживает, `map ~(add k)`
   нет. Открыта D304.
3. design · QSQUO#modifier — `allOf` и `coalesce` на сбое, вычисленном
   при вызове. Известна: D299, расширена.
4. design · QSCND#coalesce — вычисленный путь читается как код.
   Известна: D299, расширена.
5. text · QSQUO#parse — печать quote в несколько строк. D303.
6. text · QSQUO#modifier — `ValueWithheldError` проходит через вход
   кода. D303.
7. text · QSTXT#pattern — `toRegex` без флагов. D303: текст и кейс.
8. text · QSTXT#search — «as `has` does». D303.
9. text · QSQUO#parse — `:message` и `:expected`. D303.
10. conflict · страница `::any/coalesce` — «no quote» против пути. D303:
    страница, семантика остаётся D299.
11. conflict · страница `::string/toTag` — «joined by `it`». D303.
12. conflict · `core/src/runtime/control.mjs:42` — пример. D303.
13. conflict · `core/test/unit/run-laws.test.mjs:94` — комментарий. D303.
14. case · QSCND#compare — отказы и сравнения строк. D303.
15. case · QSCND#boolean — отказы `allOf`. D303.
16. case · QSQUO#step и #apply — отказы quote, `apply`, `open`. D303.
17. case · QSTXT#string — `lines` и кодовые точки. D303.
18. case · два кейса не в своём разделе. D303.

## Литералы, порядок, грамматика (QSLIT, QSORD, QSSYN)

1. design · QSORD#desc — `2 | gt (1 | desc)`. Открыта D311.
2. design · QSSYN#combinator — объявление присоединяется без `|`. D303:
   правило держат грамматика и кейсы, и QSSYN#line его скажет.
3. design · QSLIT#tag — `::set` читает вектор под чужим тегом. Открыта
   D308.
4. design · QSLIT#closed — `::Lab::Lab[1]` зависит от объявления.
   Открыта D308.
5. conflict · страница `::vec/sort` — порядок видов. D303.
6. conflict · QSLIT#kind — set, quote, doc и error среди значений без
   тега. D303: текст.
7. conflict · страницы `sort` и `min` — `null` при вызове. D303.
8. text · QSSYN#refusal — `:source` — это строка. D303.
9. implementation · `lsp/src/features.mjs:242` — нет `Path` и
   `ErrorLit`. D303.
10. case · QSORD#order — пути и доки, имя кейса. D303.
11. case · QSORD#sort — отказ ключа. D303.
12. case · QSLIT#number — `1e-400` и точность. D303.
13. case · QSLIT#closed — литерал ошибки. D303.
14. case · QSSYN#combinator — имя кейса. D303.
15. case · QSLIT#atoms — кейс не в своём разделе. D303.
16. apophasis · QSORD#order — jq. D303.

## Пути, числа, коллекции (QSPTH, QSNUM, QSCOL)

1. implementation · QSNUM#arithmetic — `1.4999999999999998 | round`
   отвечает `2`. D303: округление по цифрам, как они написаны.
2. design · QSPTH#query — `null` под тегом. Открыта D309.
3. design · QSPTH#key — вычисленный ключ `null` или `true` отвечает
   собой. Открыта D309.
4. text · QSCOL#algebra — `minus` и `inter` после map. D303.
5. conflict · страницы `has` — «contains asks the same». D303.
6. conflict · страница `::path` — «prints as it is written». D303:
   страница и закон.
7. conflict · страница `::any/get` — quote без тега. D303.
8. conflict · страницы `get` и `put` — «whole number». D303.
9. design · QSPTH#words — `toPath` и дробный ключ. Открыта D309.
10. design · QSPTH#words — `/a | toPath`. Открыта D309.
11. conflict · страница `::tagged/within` — «The code is a quote». D303.
12. design · QSCOL#algebra — пара «set и map» на трёх дорогах. Открыта
    D312.
13. text · QSPTH#value — одиночный `/`. D303: текст и кейс.
14. case · `template.jsonl:14` — имя кейса. D303.
15. case · `template.jsonl:15–16` — имена кейсов. D303.
16. case · отказы `toPath`, `paths`, `has`. D303.
17. case · отказы чисел и `sumOf`/`subOf`. D303.
18. case · отказы `reduce`, `within`, `zip`, `unionOf`, `minus`. D303.

## Самоописание, печать, хосты (QSSLF, QSPRN, QSHST)

1. implementation · QSPRN#elide — маркер элемента принят за маркер
   остатка, `:size` 205 вместо 6. D303.
2. design · QSSLF#axis — опечатка в имени отказа читает страницу.
   Открыта D313.
3. design · QSSLF#laws — `runLaws` берёт якорь, `laws` и `tutorial` нет.
   Открыта D313.
4. design · QSSLF#laws — `tutorial` отказывает под адресом `doc`.
   Открыта D313.
5. text · QSSLF#explain — «a value whose kind nothing declares». D303.
6. conflict · QSSLF#catalog — проза страниц говорит то, что доказывает
   закон. Известна: D294.
7. conflict · QSSLF#explain — у отказов `::span` и `::point` нет законов.
   Известна: D294. Кейс на `5 | start` — D303.
8. text · QSHST#answer — проба под фразой о тексте печатает литерал.
   D303: проба шелла.
9. conflict · `core/src/runtime/axis.mjs:2` — комментарий. D303.
10. case · `axis.jsonl:12` — имя кейса. D303.
11. case · QSHST#source — рецепт `impl ::builtin{}`. D303.
12. case · QSPRN#json — отказы `parseJson` и обратное чтение. D303.
13. case · отказы осей. D303.
14. case · `42 | trail` — правило в двух главах. D303: кейс в QSERR#trail,
    фраза QSSLF#explain уходит.
15. text · QSSLF#manifest — узел `subject`. D303.
16. text · QSSLF#doc — `open` у ссылки. D303.
17. case · цитаты разделов в коде. D303: комментарии.
18. conflict · раскладка декларации — исключение для ключевого слова.
    D303: исключение уходит из QSWRK#catalog, ни одна декларация его не
    держит.
19. case · `print.jsonl:9` — имя кейса. D303.
20. case · `page.jsonl:4` — пустой предикат. D303.
21. apophasis · QSHST#input — «as every reader of a pipe does». D303.
22. apophasis · QSHST#source — «two things». D303.

## Работа (QSWRK)

1. implementation · `scripts/benchmark/sets.mjs:122` — `docs/decisions`.
   D303.
2. implementation · строки судьбы `Filed under`. D303: скрипты и текст.
3. text · QSWRK#cases — «of its chapter» против «its section». D303.
4. conflict · CLAUDE.md о цитатах открытых записей. D303.
5. implementation · `scripts/benchmark.mjs:8` — D104 без скобок. D303.
6. implementation · долю комментариев никто не меряет. D303:
   `measure.mjs` её считает.
7. implementation · ложные комментарии. D303.
8. text · QSWRK#tooling — дата истории и форма записи. D303.
9. implementation · у QSWRK нет проб. D303: глава работы держится
   проверками, которые она называет, и так и говорит.
10. conflict · раскладка декларации. D303, вместе с QSSLF 18.
11. apophasis · `Replaced in part by`. D303.
12. apophasis · «since the project may have had it», «goes stale in its
    tenses». D303.
13. apophasis · «since it ships…», «so every branch…», «so the name…».
    D303.
14. apophasis · «A clean reader knows no earlier form, so…». D303.
15. implementation · промпт проверки без `--error-unmatch`. D303.
16. implementation · генераторы наборов без метки. D303: QSWRK#marks
    называет исключение, которое держит `marks.mjs`.
17. text · QSWRK#target — `gate-diff` сторожит vitest и eslint. D303.
18. implementation · CLAUDE.md, `engines.node`. D303.
