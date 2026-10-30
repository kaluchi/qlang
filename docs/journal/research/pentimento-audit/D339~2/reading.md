# Разбор третьего аудита пентименто

Чтение модели, сессия c31f3094, 2026-10-30. Прогон — шесть чистых
читателей `scripts/pentimento-audit.mjs --for D339` на дереве 9778080c,
базис 9780e1ed, дерево смены D496–D502 до её посадки; строку запуска
держат `Runs.` записи D339. Прогон шёл из worktree коммита 9778080c вне
репозитория, `D:\git\qlang-worktrees\pentimento-d339`, со своей
установкой и сборкой, читатели на effort `max` с разрешёнными `qplay`,
`grep` и `git ls-files`. Разбирать его мейнтейнер велел по существу:
«разбирайся там с замечаниями docs\journal\research\pentimento-audit\D339~2
- мы потратили кучу денег на это ..» (maintainer, 2026-10-30, session
c31f3094). Пробы ниже запущены `qplay` ветки после починок.

Находок 114. Хвосты самой смены и починки, которые не двигают правило,
взяты в руки на ветке, коммиты d2a18ccf, 2299ad97 и 36640f42; кейсы,
переименованные и снятые, называет D503. Находки в текстах глав правятся
при закрытии, где растворяются записи над их разделами. Две находки уходят
в D269 и D424, вопросы которых они задают; что двигает правило, несёт
часть 14 записи D339, по осям, каждая с пробой своего отчёта; две сняты с
причиной.

## В руки

Хвосты самой смены:

- **scripts--seeds, shim · sentence-lengths.mjs:22**: сенсор предложений,
  на котором держится проверка (27), находит доки через `commentRanges`
  парсером ядра, и голову источника проверка (6) читает так же.
- **set--vec, pentimento · vec.qlang:1782**: страница `sort` не сравнивает
  ключ с `ORDER BY`, страница `every` не говорит о применении глагола.
- **core-host, archaism · stdio.qlang:229** (и :236): `get [it] | table`.
- **cases--core, archaism · showcase.qlang:59** (и :98): витрина сервера
  пишет код голым, и свёртка зовёт глагол, написанный один.
- **cases--core, archaism · reduce.jsonl:9** (и :28, `D417.test.mjs:10`) и
  **cases--core, drift · input.jsonl:76**: кейсы свёртки и модификаторов
  после входов названы по правилу, код — `withTheModifiersPastTheInputs`.
- **cases--core, pentimento · atoms.qlang:22**: страница `atomKinds`
  говорит только, что это за имя.
- **qlang--builtin, vestige · any.qlang:2972**: тело `with` берёт то, что
  берёт `get`, `#[::map ::path ::quote ::tagged ::vec]`, как говорит его
  глава [QSPTH#template], и `with [/b] :b` отказывает.
- **qlang--builtin, vestige · any.qlang:99** (и :168, `bind.qlang:207`):
  закон мягкого чтения стоит под глаголом; под
  `ConditionsElementKindNotTakenError` — закон значения другого вида, под
  `SubjectNotGivenError` — закон глагола, вызванного без значения.
- **call--regex, archaism · number.qlang:554**: пример `toKeyword` читает
  запись по `at`.

Починки, которые не двигают правило, из прежних слоёв:

- **qlang--builtin, vestige · builtin.qlang:108**: отказы корня провязывают
  свои факты, и `:refusal` — тег, не строка.
- **qlang--builtin, archaism · qlang.qlang:599** (и `builtin.qlang:84`,
  `retired-words.mjs:80`): ячейка блокнота.
- **qlang--builtin, shim · qlang.qlang:550**, в части: восемь пар законов с
  одним запросом сведены к закону под именем, чьё утверждение он
  доказывает; пары первой страницы держит часть 13 D339.
- **qlang--builtin, vestige · qlang.qlang:463**: закон читает начало
  печати.
- **qlang--builtin, drift · page.jsonl:8** и **cases--core, drift ·
  page.jsonl:8**: кейсы первой страницы.
- **qlang--builtin, archaism · any.qlang:2205**: страница `self` без «S».
- **qlang--builtin, vestige · absent.qlang:11**: под фразой о ключе пример
  ключа, под фразой об элементе пример элемента.
- **qlang--builtin, drift · bind.qlang:35**: «the docs of its page».
- **qlang--builtin, shim · json.mjs:73**, в части: страница
  `ForeignValueError` не называет функцию пакета.
- **qlang--builtin, shim · any.qlang:2123**: пример `runLaws` без числа.
- **qlang--builtin, subordination · any.qlang:1869**: что хост пишет за
  ответ, говорит его страница, `::host | doc`.
- **qlang--builtin, archaism · any.qlang:280**: закон
  `runsTheSkippedStepsAgain`.
- **qlang--builtin, vestige · control.mjs:1** (и `tagged-primitives.mjs:7`):
  метки [QSCND#branch] и [QSCOL#within].
- **qlang--builtin, subordination · qlang.qlang:1006**: каталог ядра не
  называет `qplay`.
- **call--regex, archaism · map.qlang:441** (и `keyword.qlang:72`, :85):
  ключ первой записи, и без `toVec`.
- **call--regex, vestige · call.qlang:164**, в части: страницы `:nearest` и
  `:addresses` двух отказов говорят, что держат, и `mul` for `multiply`.
- **call--regex, archaism · fail.qlang:12**, в части каталога: шаг трека
  неудачи — `message`, путь — `/reason`.
- **call--regex, vestige · fail.qlang:31**: страница `StepNotCommandError`
  называет путь, литерал пути и квоту.
- **call--regex, shim · fn-primitives.mjs:30**: имя `args` записано один
  раз, в цепочке.
- **call--regex, vestige · arith.mjs:13**: нормализации отрицательного нуля
  нет; печать, `toString`, `json`, `eq` и порядок читают его нулём.
- **call--regex, pentimento · excerpt.qlang:22**, в части: страница говорит,
  что записи сверх комнаты алерта падают.
- **call--regex, drift · keyword.qlang:12** (и `call.qlang:48`,
  `cell.qlang:9`): буквы имени по [QSNAM#letters], идентичность ячейки —
  латинские буквы.
- **call--regex, vestige · kind.qlang:60**: ссылка на `reveals`, и страница
  повторного имени называет вид и страницу.
- **call--regex, subordination · code.mjs:18**: `refusalOfAParse` стоит ниже
  глаголов, в `eval.mjs` рядом с `layTag`.
- **call--regex, pentimento · kind.qlang:379** (и `qlang.qlang:364`):
  «a reader's kind».
- **set--vec, archaism · trace.qlang:115**, в части каталога и кейса: путь
  кадра — часть, на которой шаг отказал.
- **set--vec, vestige · span.qlang:57**: у `StartNotReadError` страница и
  закон, как у конца.
- **set--vec, shim · convert.mjs:14**: текст `null` даёт примитив текстов
  атомов.
- **set--vec, drift · sequence.mjs:338**: `reducedFrom`,
  `foldOfTheAlgebra`, `indexedBy`.
- **set--vec, subordination · tagged.qlang:39**: закон шага стоит один, под
  `::construct`.
- **set--vec, shim · setops.mjs:52**: отказ ключа по роли вручает
  вызывающий, флага нет.
- **set--vec, pentimento · snippet.qlang:12**: без довода.
- **cases--core, shim · eval.mjs:416**: ремонт пути переписывает
  модификатор, который прочёл отвергнутый вход, его держит вызов; кейсы
  the-repair-of-a-path-rewrites-the-modifier-the-refused-input-read и
  an-input-read-by-a-path-into-an-arg-names-no-repair-of-a-path. Слот
  читается из фактов, которые вызов налил сам.
- **cases--core, archaism · parse.mjs:27**: отказ источника не-строки
  словами языка.
- **cases--core, drift · grammar.peggy:853**: «the elements of a literal».
- **cases--core, archaism · chain.mjs:278**: `pathReadOf`, `wiringByPaths`,
  `partAtThePath`, `byPaths`, `factWaiting`.
- **cases--core, archaism · grammar.peggy:413**: правила `Comment`, и запись
  комментария без `text`; `content` читает `scripts/comments.mjs`, `type` —
  тест.
- **cases--core, archaism · steps.mjs:186**: `isModifier` и знак тега
  `SIGN_OF_A_TAG` в `types.mjs`.
- **cases--core, archaism · json.jsonl:11** и **cases--core, archaism ·
  recipe.jsonl:16**: кейсы названы по правилу.
- **cases--core, vestige · cli-notebook.mjs:13**: `stdioNames`.
- **cases--core, drift · ordering.mjs:28**: `rankOf`, `formOfAStep`,
  `kindNameOf`.
- **cases--core, archaism · grammar.peggy:949**: `CallNameHead`,
  `NameStart`, `NameLetter`, и лексикон без исключения.
- **cases--core, archaism · order.test.mjs:28** (и `algebra.test.mjs`,
  `print.test.mjs`): заголовки словами раздела.
- **cases--core, vestige · types.mjs:241**: таблица выровнена по своему
  длиннейшему имени.
- **core-host, drift · repl.mjs:61**, в части: `heldTheChannel` в
  playground.
- **core-host, drift · line-editor.mjs:35**: `submitted`, `submittedAt`,
  `editsKept`.
- **core-host, pentimento · repl.mjs:43**: справка словами главы.
- **core-host, drift · argv.mjs:14**: отказ ведёт к `qplay --help`.
- **core-host, vestige · server.mjs:90**: диагностика — ошибка.
- **core-host, vestige · main.mjs:13**: `if (env.NO_COLOR)`.
- **core-host, vestige · stdio.qlang:34**: законы установки сняты.
- **scripts--seeds, drift · core/README.md:23**, в части README: «The
  playground».
- **scripts--seeds, drift · anchors.mjs:13**: якоря и даты читаются во всех
  семенах из `CITING_DOCUMENTS`.
- **scripts--seeds, pentimento · check-conventions.mjs:182**: исключения
  названы правилом [QSVOX#pentimento].
- **scripts--seeds, vestige · check-conventions.mjs:193**: исключения ревью
  по дате нет.
- **scripts--seeds, vestige · check-conventions.mjs:393**: без «§» и без
  истории.
- **scripts--seeds, archaism · decision-records.mjs:107** (и
  `check-conventions.mjs:550`, `retired-words.mjs:64`): без «walk».
- **scripts--seeds, pentimento · eslint.config.mjs:5**: голова называет
  [QSGAT#gate], без `site/coverage`.
- **scripts--seeds, shim · import-reach.mjs:23**: рабочие пространства из
  `readWorkspaces`.
- **scripts--seeds, subordination · vitest.config.mjs:23**: оба загрузчика
  в `core/host`, покрытие `src/**` без исключений.
- **scripts--seeds, vestige · child.mjs:17**, в части комментария.
- **scripts--seeds, drift · workspace-manifests.mjs:1**, в части
  комментариев.
- **scripts--seeds, shim · growth.mjs:102**: одна сборка грамматики,
  `parserSourceOf`.
- **scripts--seeds, vestige · dissolve-records.mjs:28**: `rewrite` в
  `tree-reads.mjs`.

```qlang
> get [({:b 7} | with [/b] :b !| tag) (::any/self | doc | content | contains "the S of") (::vec/sort | doc | content | contains "ORDER BY") (::vec/table | doc | content | contains "get [it] | table") (::any/allOf | laws | has :readsAMissingFieldSoftly) (::span/StartNotReadError | doc | content | lines | first) ([1 2] | toString !| nearest) (::cell | doc | content | contains "Latin letters") (::fail | doc | content | contains "get /kind") (-0.4 | round | print) (::null/toString | binding | value | get /1) (::qlang | doc | content | contains "qplay")]
[::any/with/BodyKindNotTakenError false false true true "A span holds six numbers, the point of its start and the point" [:json :print] true false "0" ::builtin{:of ::null/toString} false]
```

## В главах при закрытии

Раздел пишется при закрытии, где в него растворяется запись смены:

- **call--regex, archaism · fail.qlang:12**, в части главы: [QSERR#rest]
  (:44, :60) и [QSERR#catch] (:168) без факта `:kind`.
- **call--regex, pentimento · QSLIT:130**: [QSLIT#json] без `type` и
  `error`; два кейса отсутствия кодека сняты, D503 их называет.
- **call--regex, pentimento · QSPRN:48**: [QSPRN#print] без регекса.
- **call--regex, subordination · QSNAM:330**: [QSNAM#address] говорит
  «label».
- **set--vec, archaism · trace.qlang:115**, в части главы: [QSPRN#excerpt]
  (:250).
- **set--vec, subordination · QSLIT:131** (и QSPRN:201): [QSLIT#json] и
  [QSPRN#json] ведут к [QSLIT#container].
- **set--vec, subordination · QSSLF:335**: [QSSLF#catalog] без хоста и
  оболочки.
- **set--vec, drift · QSHST:127**: [QSHST#source], «byte order mark».
- **set--vec, vestige · QSCLI:28**: [QSCLI#answer] ссылается на
  [QSGAT#hosts].
- **core-host, pentimento · QSHST:251**: [QSHST#effect] без фразы о теге,
  описывающем эффект; дорогу держит D424.

## В открытые записи их вопроса

- **D269**, столкновения имён: **core-host, drift · playground.qlang:63**,
  секция экрана, названная `labels`, потому что имя `kinds` занято глаголом
  `::host/kinds`.
- **D424**, обитатель тега: **core-host, pentimento · QSHST:251**, дорога
  тега, описывающего действие хоста, и происхождения значения.

## D339, часть 14

Каждая с пробой своего отчёта, по осям.

- Факты отказа: cases--core steps.mjs:190; call--regex call.qlang:164 в
  части пустого `:addresses`; call--regex excerpt.qlang:22 в части алерта,
  молчащего о записях, которые упали.
- Дома и один факт дважды: qlang--builtin shape-primitives.mjs:17;
  call--regex kind-primitives.mjs:27; set--vec regex-primitives.mjs:39, :38
  и :57; cases--core types.mjs:408 и eval.mjs:1151; core-host
  features.mjs:329; cases--core steps.mjs:186 в части сырых `::`.
- Ядро называет потребителей: qlang--builtin json.mjs:73 в части
  экспортов; cases--core parse.mjs:78; core-host nouns.mjs:647.
- Термины одного смысла: call--regex call.qlang:98 и quote.qlang:121;
  scripts--seeds core/README.md:23 в части скриптов и workspace-manifests.mjs:1
  в части имён модуля.
- Множество, идущее через `::tagged` вектором: set--vec set.qlang:288 и
  set.qlang:64; снятие адреса `::set/distinct` ждёт слова мейнтейнера о
  своей оси.
- Каталог: qlang--builtin qlang.qlang:158, число комнаты в прозе, к части
  12.
- Playground, сервер, сайт и скрипты: core-host features.mjs:58 и :417,
  run.mjs:12, render.mjs:74, Base.astro:9, stdio.qlang:185,
  format-example.js:38, repl.mjs:18 и repl.mjs:61 в части ключа
  `recordStdoutEffect`, который вручает и сестринский проект;
  scripts--seeds screens.mjs:18, tasks.mjs:120 и child.mjs:17 в части
  разрешения и промптов.

## Сняты

- **set--vec, shim · shape-primitives.mjs:51**: регекс — быстрый путь,
  решает `numberWritten`, и снятие стоило бы чтения грамматикой на каждом
  ключе свёртки.
- **call--regex, subordination · each.qlang:37**: законы доказывают
  границу свёртки, которую страница `::each` называет, где она сворачивает
  карту и где оставляет её ключи.
