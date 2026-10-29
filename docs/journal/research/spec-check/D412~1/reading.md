# Разбор проверки глав для D412

Разбор модели, сессия ac8a358c, 2026-10-29. Семь чистых читателей
`scripts/spec-check.mjs --for D412` проверили дерево 09767318 на базисе
6285e02c — дерево закрытия смены D421, D476, D477 и D478: главы, которые
D421 переписала целиком, и разделы, которые переписали D476, D477 и D478.
Прогон шёл из worktree `D:\git\qlang-worktrees\closeout-spec`. Пробы отчётов
перезапущены на ветке до починок: каждая находка воспроизвелась. Разошлись
с записью только пробы находок, которые уже взяли починки второго аудита
пентименто (коммит 18001c79), и пробы с путями worktree.

Находок 186. Мейнтейнер велел решать их в этой смене: «думаю надо в этой
смене решать, зачем будущим агентам нужны наши недоработки.. если им надо -
они своих наделают :D» (maintainer, 2026-10-29 00:45 UTC). Выводимое из
увиденного решено на месте, а связанный остаток пополнил открытые записи
для брейншторма (01:02 UTC). Ни одна болезнь, которую внесла `;`, не
перенесена.

Судьбы:

- **D481** — решение записи в пути над разделами языка, с кейсами, которые
  её называют.
- **D482** — решение записи в пути над главами работы.
- **В руки** — починка, которая не двигает правило, сделана на ветке.
- **18001c79** — взято починками второго аудита пентименто.
- **D257, D281, D339, D369, D412, D423** — открытая запись, чей вопрос
  находка задаёт; запись пополнена её пробой.

## Литералы, порядок, грамматика (QSLIT, QSORD, QSSYN)

1. text · QSLIT#kind — формула разбора и сборки. В руки:
   `with {:t ~tag} ~(payload | tag t)`, как пишут страницы.
2. design · QSLIT#closed — названная починка литерала под тегом
   отказывается. D481: нагрузка собирается `get`, тег кладётся после неё,
   `get {:w ~(x)} | tag ::Box`; литерал ошибки под тегом — с bang,
   `get !{…} | tag ::X | raise`.
3. design · QSORD#desc — `desc` не поворачивает `::desc` под другим
   тегом. D481.
4. text · QSSYN#step — последнее объявление у конца текста. В руки: глава,
   страницы `::qlang` и `::qlang/pipeline`.
5. implementation · QSSYN#refusal — комбинатор перед комментарием в конце
   текста. В руки: пропущенный шаг называет грамматика, регэксп поверх
   парсера снят, и ложное «`|~` opened…» у `[1] |~ x ~| |` ушло тоже; кейс.
6. implementation · QSSYN#step — путь из нескольких сегментов перед
   словом. В руки: грамматика читает весь путь и называет чтение части;
   кейс.
7. implementation · QSLIT#json — смешанные ключи в двух порядках из
   четырёх. D481: отказ называет оба написания при любом порядке; кейс.
8. text · QSSYN#doc — одинокий `\r`. В руки: глава говорит правило кейса.
9. text · QSORD#sort — имена отказов ключа. В руки.
10. text · QSORD#set — `distinct` и критерий своих глаголов. В руки:
    `distinct` стоит рядом с `toSet` как имя привычки.
11. conflict · QSSYN#step и QSQUO#step — литерал под тегом как шаг. В руки:
    QSQUO#step называет `get`.
12. conflict · QSSYN#refusal и страница `::quote/ParseError`. В руки:
    страница называет `:message` и `:expected` вместе и всё, что оставлено
    открытым.
13. implementation · QSSYN#combinator — `;|`. В руки: `;` перед запросом
    стоит за пробел, как начало текста.
14. drift · QSLIT/tag.jsonl:35 — `wraps`. D481: кейс назван по `accepts`, два
    заголовка `site.test.mjs` тоже.
15. drift · QSSYN/line.jsonl:11 — «sentence». 18001c79.
16. drift · QSLIT/json.jsonl:26 — «identifier». D481: кейс назван по голому
    имени.
17. case · QSORD#desc — `::desc` под другим тегом. D481: два кейса.
18. case · QSSYN#step — сообщения пути парсера. В руки: кейсы держат
    сообщения, литерал под тегом и путь из сегментов; кейс `!|` среди
    объявлений перенесён из QSERR#catch.
19. case · QSSYN#comment — `;` внутри комментария, дока и регекса, `~(` без
    пары. В руки: кейсы.
20. case · QSSYN#doc — док перед объявлением называет слот. В руки: кейс.
21. case · QSORD#sort — первый из равных у `max`. D481: кейс.
22. implementation · ring-of-atoms.mjs:56 — цитата в заголовке группы
    помощника. В руки: заголовок без цитаты, а проверка (21) читает
    заголовки помощников тестов.
23. conflict · grammar.peggy:1078 — «`:"any text"` то же ключевое слово».
    В руки: комментарий и метка `[QSLIT#keyword]`.

## Имена, диспатч, функции и виды (QSNAM, QSDSP, QSBLD)

1. text · QSDSP#answer — `within ~(distinct)` у цитаты и дока. В руки:
   вектор.
2. design · QSBLD#kind — метка с видом `::number` отказывает каждому числу.
   D481: метка вида корня есть этот вид, конструктор `::number` держит
   конечное число.
3. conflict · QSBLD#fn — страницы `::fn/throws` разрешают путь. В руки.
4. conflict · QSBLD#kind — страница `::kind/throws/modifiers`. В руки.
5. conflict · QSNAM#binding — страница `::host/env` о коде, который написал
   шаг. В руки.
6. implementation · QSBLD#fn — `holds :ArgsBeyondInputsError`. D481.
7. design · QSBLD#fn — факт `subject` в цитате `throws`. D481: отказ в
   цепочке.
8. implementation · QSNAM#reach — неизвестное имя в теле объявления. В
   руки: это болезнь `;`; теперь `::call/UnknownNameError` с ближайшими;
   кейс.
9. text · QSDSP#walk — внешний тег кладётся заново через вид. В руки.
10. text · QSNAM#address — адрес как поздний шаг. В руки: «Written as the
    first step».
11. implementation · QSNAM#letters — буква за базовой плоскостью, `·` и
    `‿`. D481: грамматика читает символ имени по кодовой точке, глава
    называет набор продолжения.
12. case · QSDSP#tagname — кейс на `gt`. D481: кейс и проба на `toString`.
13. implementation · QSBLD#fn — закон под фактом отказа. D481.
14. design · QSBLD#input — вход `args`. D481: отказан при рецепте-коде.
15. conflict · QSDSP#walk — страницы `::any/is` и
    `::call/KindAnswersNoVerbError` без `::tagged`. В руки.
16. text · QSBLD#label — тег роли строит слот. В руки.
17. conflict · QSDSP#residence — имена кейсов сравнений. D481: «resides on
    any».
18. case · QSDSP#refusal — глагол под вторым существительным. D481: кейс.
19. conflict · QSNAM#declare — значение как слово. В руки: «word» — вид,
    глагол, узел, а глава говорит «names».
20. text · QSNAM#declare — объявление внутри команды. В руки.
21. conflict · QSNAM#declare — последний `;`. В руки, как п. 4 первого
    отчёта.
22. text · QSBLD#chain — глагол под глаголом. В руки: функция под глаголом
    лежит данными.
23. conflict · QSBLD#fn — страница `::fn/takes/modifiers` называет два
    имени. В руки: пять и `args`.
24. conflict · QSBLD#kind — страница `::kind` без `reveals`. В руки.
25. conflict · QSBLD#kind — `impl null`. В руки: глава.
26. conflict · QSBLD#label — имя кейса `construct`. D481.
27. conflict · QSNAM#scope — имя кейса о позднем шаге рецепта. D481.
28. drift · QSBLD#recipe — «sentence». 18001c79.
29. drift · QSDSP#refusal — «contract». D481: кейсы названы.
30. pentimento · QSNAM#value — «would drop the subject». В руки: глава и
    страница отказа говорят, что держится.

## Ошибки (QSERR)

1. implementation · QSERR#rest — excerpt под `::error`, сбой хоста
   `facts is not iterable`. В руки: дверь читает факты под `::error`; кейс.
2. design · QSERR#site — слот вердикта. D481: значение `::fn/slot` под
   адресом роли.
3. conflict · QSERR#rest — rest.jsonl:31, тег без узла. D481:
   `::fn/slot/ExpectedKindNotTakenError`.
4. design · QSERR#print — `raise` в обход вида. D481.
5. conflict · QSERR#catch — `coalesce` проглатывает промах. В руки:
   QSERR#catch называет чтение промаха в `coalesce` рядом с `!|`, правило
   страницы `coalesce` оставлено (D481, Set aside).
6. conflict · qlang.qlang:824 — «but where the step refused its subject».
   В руки.
7. design · QSERR#trace — простой вектор кадров. D481.
8. text · QSERR#rest — «no excerpt as a fact». D481: текст и имя кейса.
9. conflict · QSERR#rest — тег отказа над excerpt. В руки: QSLIT#tag,
   QSNAM#address, QSBLD#label.
10. conflict · error.qlang:30 — `::X::error::excerpt`. В руки: страница
    `::error`.
11. conflict · QSERR#site — исключение `NotIn`. В руки: глава называет его.
12. conflict · QSERR#site — `NotPointerError`, `NotHeldError`. D481:
    `TextNotPathError`, `SubjectNotHeldError`.
13. text · QSERR#site — элемент субъекта. В руки.
14. text · QSCOL#group — `KeyAnswerKindNotTakenError`. В руки.
15. text · QSERR#print — «draws nothing below it». В руки.
16. text · QSERR:4 — «a frame for each step it passed». В руки: глава и
    первая страница.
17. text · QSERR#trace — пара `min` и `max`. В руки.
18. conflict · frame.qlang:85. 18001c79.
19. conflict · error.qlang:1 — комментарий источника. В руки.
20. conflict · QSERR#raise — «the-bang-raises-an-error». D481.
21. pentimento · error.qlang:13 — обоснование через читателя. В руки:
    страницы `::error` и `::qlang/errors`.
22. drift · QSERR#site — «law» для инварианта. D481: кейс назван.
23. drift · QSERR#rest — «error value». D481: кейс назван; QSHST#source
    пишет «failure».
24. case · QSERR#alert — файла кейсов нет. В руки: `QSERR/alert.jsonl`.
25. case · QSERR#print — печать, прочитанная и поднятая. В руки: кейс.
26. case · QSERR#site — ссылки отказов шагов языка. В руки: кейс.
27. case · QSERR#catch — catch.jsonl:29. В руки: перенесён в QSSYN#step.
28. text · QSERR#trace — `:trace` после фактов. В руки.
29. text · run-probes.mjs:183 — форма excerpt. В руки: регэксп и
    комментарий.
30. conflict · QSPTH#template — `settle` над множеством. В руки: страница и
    `:expected` отказа.

## Самоописание, печать, хосты, командная строка, сервер

1. design · QSPRN#print — док с переводом строки на одной строке. D369:
   одна строка уступает переводу строки прозы, текст QSPRN#print;
   литерал, который пишет перевод строки в одной строке, остаётся
   вопросом D369.
2. design · QSSLF#axis — тег слота. D481.
3. conflict · QSPRN#print — бюджет REPL. В руки.
4. conflict · stdio.qlang:149. 18001c79.
5. text · QSCLI#answer — страница адреса у тега на `Error`. В руки.
6. text · QSHST#effect — `stdio/in` на `::tag`. В руки.
7. conflict · QSHST#notebook — имена хоста. В руки.
8. conflict · QSHST#source — факты `SourceLoadError`. В руки: виды двух
   дефектов проводят свои факты.
9. case · QSSLF#axis — законы отказов. D481: девять законов и кейс.
10. text · QSPRN#span. В руки.
11. conflict · QSPRN#print и QSSLF#catalog — раскладка. D423: одна
    раскладка кода — её вопрос; QSPRN#print больше не приписывает себе
    раскладку каталога.
12. text · QSHST#source — источник playground. В руки.
13. conflict · QSLSP#symbols — метка через имя вида. В руки: QSNAM#address
    называет третью дорогу.
14. design · QSLSP#reach — сервер и язык. D281.
15. drift · QSHST#notebook — «session». 18001c79.
16. drift · QSHST#cell — `names.qlang`. В руки.
17. case · QSSLF#catalog — порядок команд. D481: девять глаголов и кейс.
18. case · QSSLF#catalog — проза пересказывает законы. В руки: страница
    `::number/add`.
19. text · QSLSP#server — скобки цитаты и литерала ошибки. В руки.
20. text · QSPRN#legend — третье правило. В руки.
21. text · QSCLI#repl — `.help` и `.exit`. В руки.
22. text · QSCLI#line-editor. В руки.
23. conflict · docs/spec/README.md:6. В руки.
24. text · QSCLI:6. В руки.
25. case · QSSLF#manifest — кейс разветвления. D481: перенесён в
    QSDSP#tagname.
26. case · QSCLI#colour — пустой `FORCE_COLOR`. В руки: красит, как пишет
    глава и как читает Node; тест.
27. text · QSHST#cell — буквы идентичности. В руки: латинские.
28. text · QSPRN#print — DEL и C1. В руки: текст называет управляющие
    символы, которые JSON оставляет как есть; стоимость экранирования на
    каждой строке печати не стоит редкого случая.
29. text · QSPRN#print — `print` под `::any`. В руки.
30. pentimento · QSPRN#excerpt. В руки.
31. pentimento · QSCLI#answer — «No flag». В руки: снято в QSCLI и QSPRN.
32. pentimento · QSSLF#catalog. В руки.
33. pentimento · QSHST#effect. В руки.
34. pentimento · run-probes.mjs:6. В руки.

## Пути, числа, коллекции (QSPTH, QSNUM, QSCOL)

1. design · QSNUM#combine — путь, прочитавший не число. D257: отказ шага
   рецепта глагола каталога.
2. text · QSCOL#group — как п. 14 QSERR. В руки.
3. design · QSPTH#code — `:repair` при вызове адресом. D481.
4. design · QSCOL#algebra — `unionOf` и свёртка. D257, вместе с п. 1.
5. conflict · QSDSP#answer — `append` и `prepend`. В руки: QSDSP#answer.
6. text · QSCOL#group — `:key` у `KeyTakenError`. В руки.
7. conflict · vec.qlang:946, :1059, set.qlang:200. В руки: страницы.
8. text · QSPTH#get — `has`. В руки.
9. design · QSPTH#template — цитата на месте имён. D481.
10. implementation · QSPTH#code — `:repair` у входа каждого элемента. D481.
11. text · QSCOL#map — `empty`. В руки.
12. text · QSCOL#image — «refused with the repair». В руки.
13. design · QSPTH#shape — ключ `"01"`. D481: число, как его читает
    `toNumber`.
14. drift · each.qlang:7 — «an id». В руки.
15. text · QSPTH#get — `:length`. В руки.
16. text · QSPTH#shape — пустые листья. В руки.
17. case · QSPTH#verbs — `:repair` пути-субъекта. В руки: кейс.
18. text · QSPTH#has — ссылка на `contains`. В руки.
19. drift · within.jsonl:4 — «returns» и «yields». D481: кейсы названы
    «answers».

## Текст, условия, код (QSTXT, QSCND, QSQUO)

1. design · QSCND#coalesce — цитата под тегом. D481.
2. design · QSCND#coalesce — провал при вызове. D481.
3. conflict · QSCND#boolean — закон с небулевым ответом. В руки: инвариант
   ломается, закон проваливается.
4. design · QSTXT#search — половина суррогатной пары. D481.
5. design · QSTXT#string — пробелы `trim` и парсера. D481.
6. design · QSTXT#split — пустое совпадение на концах. В руки: глава
   говорит правило дерева.
7. design · QSCND#boolean — теги `and`. D481.
8. design · QSCND#compare — общий тег. D481.
9. text · QSQUO#modifier — метка отказывает ошибке покоя. D481: отказ
   стоит у `raise`, кейс переписан.
10. design · QSCND#boolean — одно имя на два правила. D481: отказ ответа
    кода назван по слоту.
11. text · QSQUO#step — литерал под тегом. В руки.
12. text · QSQUO#parse — одна строка и восемьдесят символов. В руки.
13. text · QSCND#convert — `toRegex` с флагами. В руки.
14. text · QSTXT#string — эмодзи из нескольких кодовых точек. В руки.
15. case · QSTXT#string — символы за базовой плоскостью. В руки: кейс.
16. design · QSCND#convert — `desc`. D481.
17. design · QSTXT#match — `replace` с ключевым словом. D481.
18. case · QSCND#convert — «every-atom». D481: кейс назван.
19. case · QSQUO#step — вложенность глубже стека. В руки: кейс.
20. drift · QSQUO#step — «element step». В руки: «part of a literal».
21. conflict · json.mjs:136 и table.mjs:1. 18001c79 для `json.mjs`, метка
    `table.mjs` в руки.
22. conflict · sequence.mjs:300 и string-primitives.mjs:18. В руки: метки.
23. pentimento · regex.qlang:22. В руки.

## Работа (QSWRK, QSVOX, QSLEX, QSREQ, QSMSR, QSRVW, QSGAT)

1. implementation · sets.mjs:88. 18001c79.
2. conflict · retired-words.mjs:107 — D442 против D467. В руки: запись D442
   называет `found | tag`; образцы четырёх записей в тестах лексикона.
3. implementation · gate-diff.mjs:32. 18001c79.
4. conflict · CLAUDE.md:118 — «inner loop». В руки.
5. design · QSREQ#marks — два прочтения цитаты. В руки: сверка, desk и
   растворение читают цитату кода в его комментариях, как `marks.mjs`.
6. implementation · spec-check-prompt.txt:9 — папка `cli`. В руки.
7. conflict · QSWRK#stint и QSWRK#journal — вопрос со своей записью. D482.
8. implementation · CLAUDE.md:100 — seed пересказывает правила и держит
   свои. D412, часть 7: привычки сессии и их раздел.
9. conflict · core/README.md:18. 18001c79.
10. implementation · QSREQ#rigor — регэксп поверх JavaScript. В руки:
    заголовки тестов, экспорты и `root-exports` читаются acorn.
11. implementation · QSLEX#term — записи без образцов. В руки.
12. implementation · QSLEX#code — проза грамматики. В руки: глава говорит о
    модулях JavaScript; судьба прозы грамматики — часть 3 D412.
13. implementation · QSLEX#grep — дома примитивов. D339, часть 13: правило
    стоит, переезд модулей по существительным ждёт смены.
14. drift · QSLEX#grep — «session». 18001c79.
15. conflict · QSWRK#stint и QSGAT#release. D482.
16. text · QSMSR#benchmark — reference у задач набора. В руки.
17. implementation · QSVOX#folders — README. В руки: `prior-art/README.md`.
18. implementation · QSVOX#folders — каталоги сенсоров. D482.
19. implementation · QSWRK#reconciliation — серии на desk. В руки.
20. conflict · QSWRK#closeout — дерево внешнего аудита. В руки: QSRVW#audits.
21. conflict · CLAUDE.md:113 — «Commit on request». В руки.
22. text · QSWRK#journal — домен Benchmark. D482.
23. drift · merge-records.mjs:148 — «walk». В руки.
24. conflict · README.md:44. 18001c79.
25. implementation · QSGAT#gate — тайм-аут интеграционных тестов. В руки.
26. pentimento · eslint.config.mjs:15. 18001c79.
27. pentimento · deploy.yml:20 и ci.yml:137. В руки.
