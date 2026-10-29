# Разбор второго аудита пентименто

Чтение модели, сессия ac8a358c, 2026-10-29. Прогон — шесть чистых читателей
`scripts/pentimento-audit.mjs --for D339` на дереве 09767318, базис
6285e02c, дерево после закрытия смены D421, D476, D477 и D478; его вызвала
D339 по слову мейнтейнера, «после переноса бейзлайна и до мержа в мастер
пользуйся аудиторами-ревьюверами бенчмарков» (maintainer, 2026-10-28 20:46
UTC, session ac8a358c), её `Runs.` держит запуск. Прогон шёл из worktree
коммита 09767318 вне репозитория, `D:\git\qlang-worktrees\closeout-pentimento`,
со своей установкой и сборкой, читатели на effort `max` с разрешёнными
`qplay`, `grep` и `git ls-files`. Пробы ниже запущены `qplay` ветки после
починок.

Находок 136. Сорок починок, которые не двигают правило, взяты в руки на
ветке; три находки уходят в D269, D412 и D424, вопросы которых они задают;
остальные, двигающие правило, несёт часть 13 записи D339, по осям, каждая
с пробой своего отчёта; две сняты.

## В руки

Хвосты самой смены, которые закрытие оставило:

- **qlang--builtin, vestige · qlang.qlang:676**: глава `::qlang/verbs`
  называет обе дороги, голое имя — обходом тегов, адрес — по резиденции и
  видам `on`, `5 | Shop/double`.
- **qlang--builtin, subordination · qlang.qlang:987, :216** и **cases--core,
  subordination · qlang.qlang:179**: первая страница, глава хостов и
  страница `::qlang/AnswerBeyondBudgetError` говорят то, что верно в любом
  хосте, а REPL, stdin, потоки и подпись под алертом называет страница
  хоста, `::host | doc`. Тест playground, ждавший под алертом
  `json | stdio/out`, ждёт теперь `::host | doc`.
- **call--regex, archaism · host.qlang:105**, **cases--core, drift ·
  playground.qlang:12**, **core-host, drift · playground.qlang:12** и
  **scripts--seeds, drift · playground.qlang:12**: «session» ячеек
  заменён на «notebook».
- **core-host, archaism · stdio.qlang:148**: страница `stdio/tap` говорит
  об отказе по бюджету словами нынешнего отказа, его `:answer` — ячейка.
- **call--regex, drift · excerpt.qlang:10** (там же cell.qlang:14 и
  kind.qlang:425): `;`, который механическая переписка D421 поставила
  после записей выписки, снят.
- **call--regex, subordination · cell.qlang:26**, в части: страница
  `::cell` говорит «a host of the streams», а не «the command line».
- **call--regex, vestige · env.mjs:1**: модуль глаголов `::host` назван
  по существительному, `core/src/runtime/host-primitives.mjs`, его метка —
  разделы, которые он держит; CLAUDE.md ведёт к нему.
- **core-host, archaism · repl.mjs:46**: справка REPL не называет
  отвергнутую форму `:name it`.
- **cases--core, archaism · QSNAM/declare.jsonl:1** и **QSBLD/recipe.jsonl:2**:
  кейсы `with` и кейсы «sentence» названы по правилу, которое держат,
  вместе с кейсом QSSYN/line.jsonl:11; старые имена названы в источнике
  D421, среди кейсов, переписанных под имена её дороги.
- **scripts--seeds, archaism · sets.mjs:88**: подсказка ребёнку бенчмарка
  называет `qplay` и `stdio/out`. Измерение D479 шло с прежней подсказкой;
  дети запускали `qplay`, который называет их первый экран и разрешения.
- **scripts--seeds, archaism · core/README.md:18, :75, :79, :100, :101**:
  `::host | env`, `::host | kinds`, адрес `stdio/out`, печать литералом,
  ячейка факта, «scan» и «the parts it keeps».
- **scripts--seeds, drift · README.md:44**: релиз поднимает те пакеты,
  которые публикует Deploy.
- **scripts--seeds, archaism · anchors.mjs:15**, в части: голова проверки
  (22), `release.mjs:195` и комментарии `eslint.config.mjs` говорят о
  потоках и playground; `cli` в двух регексах остаётся, он читает пути,
  которые называют тексты истории.
- **scripts--seeds, pentimento · eslint.config.mjs:15**: голова конфига
  называет [QSGAT#workspaces], а не CLAUDE.md, и без `cli`.
- **core-host, vestige · table.mjs:6**: выравнивание по чужой таблице снято.
- **cases--core, pentimento · answer.test.mjs:71**, в части: заголовок
  называет `::stdio | in`; сами тесты двух выведенных флагов — D339.

Починки, которые не двигают правило, из прежних слоёв:

- **call--regex, vestige · frame.qlang:85**: страница закона говорит, что
  части кадра читаются голыми именами.
- **call--regex, archaism · kind.qlang:342** (и :8): «part» и «wires».
- **call--regex, archaism · fn.qlang:209**: закон
  `countsTheModifiersAsTheLiteralDoes`.
- **call--regex, pentimento · fn.qlang:30, :152**: «called by its function
  alone» снято.
- **call--regex, drift · fail.qlang:36**: «after `!|`».
- **qlang--builtin, archaism · builtin.qlang:52**: страница отказа говорит
  о факте, которого не провязывает вид отказа, и чинит записью `wires`.
- **qlang--builtin, vestige · json.mjs:136**: метка `[QSPRN#json],
  [QSDSP#answer]`.
- **qlang--builtin, vestige · any.qlang:1026**: перечень осей называет
  `manifest`.
- **qlang--builtin, vestige · absent.qlang:1**: голова говорит о части,
  которой нет в части данных.
- **qlang--builtin, pentimento · qlang.qlang:731**: правило показано
  запросом, который отвечает, `::Desk | hours`.
- **qlang--builtin, drift · qlang.qlang:2**: «the first page».
- **scripts--seeds, vestige · gate-diff.mjs:32**: гейт держит путь
  раннера кейсов `core/test/unit/QSREQ/cases.test.mjs`.
- **scripts--seeds, archaism · run-probes.mjs:24** (там же
  check-conventions.mjs и conventions-verdict.mjs): «the closeout».
- **scripts--seeds, pentimento · requirements-coverage.mjs:4**:
  `QSREQ/cases`.
- **core-host, pentimento · QSHST:219**: взято раньше, коммит 6065c97f.

```qlang
> get [~(::qlang/verbs | doc | content | lines | join " " | contains "an address reaches the verb it names") ~(::qlang/AnswerBeyondBudgetError | doc | content | contains "stdio/out") ~(::qlang | doc | content | contains "REPL") ~(::host/env | doc | content | lines | join " " | contains "the cells of a notebook") ~(::stdio/tap | doc | content | contains ":read") ~(::excerpt | doc | content | contains "::vec;") ~(::fail/StepNotCommandError/found | doc | content)]
[true false false true false false "The value written after `!|`."]
```

## В открытые записи их вопроса

- **D269**, столкновения имён: **qlang--builtin, shim · bind.qlang:153**,
  отказ одному `print` из слов `::any`, и **call--regex, shim ·
  host.qlang:10**, повторное объявление одного `host` страницей хоста.
  Запись держит теперь обе пробы.
- **D412**, что держит каждую строку: **call--regex, vestige ·
  desc.qlang:4**, **set--vec, vestige · sequence.mjs:267** и **set--vec,
  vestige · set.qlang:5** (часть 3, метки и проза голов);
  **cases--core, subordination · index.mjs:7** (часть 1, чтения
  инструментов в ядре); **core-host, vestige · vscode/src/extension.js:1**
  и **core-host, pentimento · bundle-qlang.mjs:8** (правило комментариев
  за пределами `MARKED_SOURCES`).
- **D424**, обитатель тега: **call--regex, subordination · cell.qlang:26**,
  в части идентичности, и **core-host, subordination · cells.mjs:19**:
  ячейка — первый обитатель, которого вручает хост, и её идентичность
  продиктована одним хранилищем.

## D339, часть 13

Каждая с пробой своего отчёта, по осям части.

- Факты отказа: call--regex fn.qlang:298 и call.qlang:200; qlang--builtin
  bind.qlang:63, any.qlang:2386 и json.mjs:39; set--vec vec.qlang:946 и
  sequence.mjs:226; cases--core eval.mjs:623 и types.mjs:424.
- Дома примитивов: qlang--builtin tagged-primitives.mjs:11; set--vec
  regex-primitives.mjs:1, sequence.mjs:18 и setops.mjs:45; call--regex
  env.mjs:1 в части `arith.mjs` и `code.mjs`; cases--core
  lang-runtime.mjs:39, dispatch.mjs:1, steps.mjs:92 и scope-keys.mjs:2.
- Ядро называет потребителей: qlang--builtin print.mjs:52; cases--core
  highlight.mjs:89, name-chars.mjs:9 и ordering.mjs:24; call--regex
  regex.qlang:20; set--vec QSTXT:106 и string.qlang:815; core-host
  stdin.mjs:34.
- Термины одного смысла: qlang--builtin bind.qlang:7 и qlang.qlang:726;
  call--regex fn.qlang:355, call.qlang:37, host.qlang:31 и each.qlang:7;
  cases--core types.mjs:39 и host.qlang:31; core-host QSHST:205, QSHST:334
  и playground.qlang:58; set--vec string.qlang:885 и tag.qlang:19;
  scripts--seeds requirements.mjs:20.
- Подпорки каталога: qlang--builtin builtin.qlang:68, qlang.qlang:258,
  qlang.qlang:810, any.qlang:1663 и json.mjs:142; call--regex
  doc-primitives.mjs:8, invariant.qlang:22 и error.qlang:13; set--vec
  tagged.qlang:9, trace.qlang:108, trace.qlang:31, span.qlang:35,
  vec.qlang:796 и trace.qlang:94; core-host table.mjs:17 и cells.mjs:50.
- Имена кейсов и тестов прежних моделей: call--regex QSBLD:379, QSERR:41 и
  fail.qlang:12; cases--core QSLIT/tag.jsonl:35, QSQUO/apply.jsonl:23,
  QSERR/flow.jsonl:31, QSPTH/key.jsonl:7, QSSLF/axis.jsonl:21,
  QSSYN/refusal.jsonl:33 и answer.test.mjs:71 в части тестов флагов.
- Скрипты работы и playground: scripts--seeds tasks.mjs:24,
  research-runs.mjs:12, benchmark.mjs:41, reconciliation.mjs:26 и :23,
  build-grammar.mjs:3, desk.mjs:48 и :20, verdict.mjs:124, fuzz-laws.mjs:71
  и CLAUDE.md:100; cases--core bootstrap.mjs:17 и repl.test.mjs:4;
  core-host repl.mjs:20, render.mjs:11 и :52, argv.mjs:30,
  line-editor.mjs:137, server.mjs:186, load-source-node.mjs:11,
  format-example.js:29, _browser-entry.mjs:31 и index.astro:32.

## Сняты

- **core-host, pentimento · playground.qlang:7**: первую строку миссии
  выбрал мейнтейнер, «the smallest host - тоже правильно передавал затею»
  (maintainer, 2026-10-28 17:31 UTC, session ac8a358c), и её держит D477.
- **scripts--seeds, archaism · anchors.mjs:15**, в части регексов: `cli`
  читает пути, которые называют записи истории, и папки `cli/` нет в
  дереве потому, что D477 её разделила.
