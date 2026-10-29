> A pentimento audit of scripts--seeds for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:52 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### vestige · scripts/gate-diff.mjs:32
Текст: `/^core\/test\/unit\/conformance\.test\.mjs$/` под «The gates: the runner and the judge it compares with».
Слой: гейт хранит путь раннера кейсов из прежней раскладки, которого в дереве нет. Нынешний раннер `core/test/unit/QSREQ/cases.test.mjs` не совпадает ни с одним образцом `GATES`, поэтому ветка, переписавшая раннер требований, проходит `gate-diff` без «gate touched», хотя ревью [QSREQ#target] читает этот список первым.
Чистый лист: один путь раннера, тот, что уже держит `RUNNER_OF_THE_CASES` досье, и гейт, выведенный из него.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch core/test/unit/QSREQ/cases.test.mjs core/test/unit/conformance.test.mjs
error: pathspec 'core/test/unit/conformance.test.mjs' did not match any file(s) known to git
core/test/unit/QSREQ/cases.test.mjs
Did you forget to 'git add'?

$ grep -n -F -e 'unit\/conformance' -e 'unit/QSREQ/cases' scripts/gate-diff.mjs scripts/dossier.mjs
scripts/gate-diff.mjs:32:  /^core\/test\/unit\/conformance\.test\.mjs$/,
scripts/dossier.mjs:24:const RUNNER_OF_THE_CASES = 'core/test/unit/QSREQ/cases.test.mjs';
```

### archaism · scripts/benchmark/sets.mjs:88
Текст: «A query over a data file reads it from stdin: `qlang '<query>' < file.json`», а в :89 «do not end it with `| json` or `| out`».
Слой: подсказка ребёнку бенчмарка, то есть мерилу миссии, называет команду её прежним именем `qlang` и голый `out` той поры, когда поток достигался без адреса. Разрешён же ребёнку только `Bash(qplay:*)`, на PATH кладутся лишь `qplay` и `qplay.cmd`, а голый `out` ничего не достигает.
Чистый лист: подсказка из тех же имён, что и разрешения ребёнка, `qplay` и `stdio/out` по адресу.
```
$ grep -n -o -F -e "qlang \'<query>\' < file.json" -e 'do not end it with `| json` or `| out`' -e "'Bash(qplay:*)'" scripts/benchmark/sets.mjs scripts/benchmark/child.mjs
scripts/benchmark/sets.mjs:88:qlang \'<query>\' < file.json
scripts/benchmark/sets.mjs:89:do not end it with `| json` or `| out`
scripts/benchmark/child.mjs:15:'Bash(qplay:*)'

$ grep -n "writeFileSync(join(commands" D:/git/qlang-worktrees/closeout-pentimento/scripts/benchmark/child.mjs
38:  writeFileSync(join(commands, 'qplay'), ['#!/bin/sh', `exec node "${forTheShell}" "$@"`, ''].join('\n'), { mode: 0o755 });
39:  writeFileSync(join(commands, 'qplay.cmd'), `@node "${commandLine}" %*\r\n`);
```
```
> "hi" | out !| get [~(tag) ~(addresses)] < /dev/null
[::call/KindAnswersNoVerbError #[::stdio/out]]
```

### vestige · scripts/benchmark/tasks.mjs:24
Текст: `reference: 'groupBy ~(get /status | toKeyword) | map ~count'` при шапке «the reference, the shortest query the tree answers it with … so a reference that shrinks is a repair».
Слой: эталоны хранят цену языка прежней поры: T3 и T4 с `| toKeyword`, T5 с `distinct | sort`, T7 с `any ~(eq "ops")`, L8 с `apply ~(…)`, L9 с `map /ok | every ~(eq true)`. Тогда ключ `groupBy` требовал ключевое слово, `distinct` не отвечал упорядоченным множеством, а декларации жили только в цитате; `check:benchmark` сверяет лишь ответ и потому их не укорачивает.
Чистый лист: эталоны в нынешней кратчайшей форме: `groupBy /status`, `… | distinct`, `contains "ops"`, декларации в голове текста, `every /ok`.
```
$ qplay 'get [~(groupBy ~(get /status | toKeyword) | map ~count) ~(groupBy /status | map ~count)] | json' < scripts/benchmark/data/orders.json
[{"paid":3,"pending":2,"cancelled":1},{"paid":3,"pending":2,"cancelled":1}]

$ qplay 'get [~(lines | filter ~(contains "ERROR") | map ~(split "ERROR " | last) | distinct | sort) ~(lines | filter ~(contains "ERROR") | map ~(split "ERROR " | last) | distinct)] | json' < scripts/benchmark/data/app.log
[["db timeout"],["db timeout"]]

$ qplay 'get [~(get /data | filter ~(get /tags | any ~(eq "ops")) | map /email) ~(get /data | filter ~(get /tags | contains "ops") | map /email)] | json' < scripts/benchmark/data/users.json
[["Ann@Example.com","eve@example.com"],["Ann@Example.com","eve@example.com"]]
```
```
> get [~(::vec/groupBy | runLaws | map /ok | every ~(eq true)) ~(::vec/groupBy | runLaws | every /ok) ~(:two 2; :two/isTwo ::law~(2 | eq 2); :two/exceedsOne ::law~(2 | gt 1); ::two | laws | count)] < /dev/null
[true true 2]

> :two 2; :two/isTwo ::law~(2 | eq 2); :two/exceedsOne ::law~(2 | gt 1); ::two | laws | count < /dev/null
2
```

### archaism · core/README.md:18
Текст: «`env | keys` lists the names a query declared, `kinds` the labels the scope reads».
Слой: страница пакета держит модель, где `env` и `kinds` были глаголами любого значения. Теперь это `::host/env` и `::host/kinds`, и оба запроса страницы отказаны.
Чистый лист: `::host | env | keys` и `::host | kinds` ([QSNAM#binding], [QSNAM#address]).
```
$ grep -n "env | keys" core/README.md
18:laws run. `::qlang | doc` opens the first page, `env | keys` lists the
```
```
> get [~(env | keys !| tag) ~(kinds !| tag) ~(::host | env | keys) ~(::host | kinds | has ::vec)] < /dev/null
[::call/KindAnswersNoVerbError ::call/KindAnswersNoVerbError #[] true]
```

### archaism · core/README.md:101
Текст: «`printAnswer(value, scope)` writes a value as the language prints it, the print a kind declares among it».
Слой: модель, где ярлык объявлял свой `print`; сегодня такое объявление отказано как `::bind/PrintDeclaredError` [QSPRN#print].
Чистый лист: «writes a value as the language prints it, its literal».
```
$ grep -n "the print a" core/README.md
101:  value, scope)` writes a value as the language prints it, the print a
```
```
> ~(:Box |~~ B ~~|; :Box/print ~("box");) | answer !| get [~(tag) ~(name)] < /dev/null
[::bind/PrintDeclaredError :Box/print]
```

### archaism · scripts/sensors/run-probes.mjs:24
Текст: «an answer its work changed waits for the move». То же в :215, :235, :243, в `check-conventions.mjs:687,770,811` и в `conventions-verdict.mjs:50`.
Слой: «the move» — обрубок «the move of the baseline», который [D429] заменил на «the closeout». Запись `retired-words.mjs:100` ловит лишь полный оборот, поэтому короткое слово уцелело в восьми местах трёх скриптов, хотя рядом стоят ссылки на [QSREQ#probe] и [QSVOX#chapter], где написано «waits for the closeout».
Чистый лист: «waits for the closeout» везде и запись лексикона на этот смысл слова.
```
$ grep -n -w "move" scripts/check-conventions.mjs scripts/conventions-verdict.mjs scripts/sensors/run-probes.mjs
scripts/check-conventions.mjs:512:    ...inFolder(JOURNAL).filter(replacedWhole).map(path => ({ path, problem: 'is replaced whole: move it by `node scripts/replaced-records.mjs`' })),
scripts/check-conventions.mjs:687:// move that writes it anew, as its probes wait [QSREQ#probe].
scripts/check-conventions.mjs:770:  // move [QSVOX#chapter].
scripts/check-conventions.mjs:811:  // move [QSVOX#chapter].
scripts/conventions-verdict.mjs:50:    `the code, the catalog and the cases hold none of these since the baseline ${found[0].baseline}: a comment, a doc and the prose name what the reader finds, a section of a chapter waiting for its move under a record in transit over it, and what was lives in the record and the commit [QSVOX#pentimento].`),
scripts/sensors/run-probes.mjs:24:// answer its work changed waits for the move where the record holds a
scripts/sensors/run-probes.mjs:215:// move writes into the section [QSREQ#probe].
scripts/sensors/run-probes.mjs:235:      if (holding !== undefined) [verdict, note] = ['waits', `  [${holding} holds its answer until the move]`];
scripts/sensors/run-probes.mjs:243:if (process.exitCode === 1) console.log('a probe whose answer changed is held until the move by the record in transit over its chapter whole, or over its section by a probe of the same query in the record; a met target drops its mark, and a probe that lists files fails where one is missing [QSREQ#probe], [QSREQ#target]');

$ grep -n -o -e "waits for the closeout" -e "waits for its closeout" -e "waiting for its closeout" docs/spec/QSREQ-the-requirements.md docs/spec/QSVOX-the-texts-and-their-voices.md
docs/spec/QSREQ-the-requirements.md:99:waits for the closeout
docs/spec/QSREQ-the-requirements.md:102:waits for the closeout
docs/spec/QSVOX-the-texts-and-their-voices.md:102:waits for its closeout
docs/spec/QSVOX-the-texts-and-their-voices.md:149:waits for its closeout

$ grep -n "by: 'D429'" scripts/retired-words.mjs | cut -c1-110
100:  { regex: /\bmov(?:e|es|ed|ing)[\s-]+(?:of[\s-]+)?the[\s-]+baselines?\b|\bbaselines?[\s-]+mov(?:e|es|ed|i
101:  { regex: /\bwalk(?:s|ed)?[\s-]+(?:of[\s-]+)?(?:the|a)[\s-]+baselines?\b|\bbaseline[\s-]+walk\b|\bwalkOfB
```

### archaism · core/README.md:79
Текст: «`declareRefusal('any/out/SubjectKindNotTakenError')`».
Слой: адрес из модели, где поток `out` жил на `::any`; это тот же слой, что запись `any/(out|err)/SubjectNotStringError` в лексиконе снятых слов. Каталог `::any/out` не держит, а потоки объявляют `stdio/out/SubjectKindNotTakenError`.
Чистый лист: пример с адресом, который держит каталог, `stdio/out/SubjectKindNotTakenError`.
```
$ grep -n -o -E "declareRefusal\('[^']+'\)" core/README.md stdio/src/*.mjs
core/README.md:79:declareRefusal('any/out/SubjectKindNotTakenError')
stdio/src/cells.mjs:11:declareRefusal('cell/answer/NotHeldError')
stdio/src/streams.mjs:7:declareRefusal('stdio/out/SubjectKindNotTakenError')
stdio/src/streams.mjs:8:declareRefusal('stdio/err/SubjectKindNotTakenError')
stdio/src/table.mjs:6:declareRefusal('vec/table/RowKindNotTakenError')

$ grep -n -F "any\/(?:out|err)" scripts/retired-words.mjs | cut -c1-100
33:  { regex: /\bany\/(?:out|err)\/SubjectNotStringError\b/, written: 'the name by the role, `Subjec
```
```
> get [~(::any/out | doc !| tag) ~(::stdio/out | manifest | filter ~(binding | name | toString | endsWith "Error"))] < /dev/null
[::any/doc/UnknownNameError #[::stdio/out/ArgsBeyondInputsError ::stdio/out/SubjectKindNotTakenError ::stdio/out/TextKindNotTakenError]]
```

### archaism · core/README.md:75
Текст: «are handed hold by the same walk», а также :111 «which the walks of the tools read» и :116 «the light door that loads the parser and its walks and no runtime».
Слой: «walk» здесь в смысле, который [D436] снял: проход двери и обход частей. Теперь «walk» значит только проход по тегам значения, у двери это «scan» [QSHST#door], у `./highlight` — «the parts it keeps» [QSGAT#workspaces]; лексикон ловит лишь «walk of the door», поэтому README уцелел.
Чистый лист: «by the same scan», «which the tools read», «the parser and the parts it keeps».
```
$ grep -n -w -e "walk" -e "walks" core/README.md
75:  scope)` are handed hold by the same walk, and a value of no kind there
111:  read, each with its span, which the walks of the tools read;
116:  the light door that loads the parser and its walks and no runtime. The

$ grep -n -o -E "by one scan of the value|the light door that loads the parser and the parts it keeps and no" docs/spec/QSHST-hosts.md docs/spec/QSGAT-the-repository-and-its-gate.md
docs/spec/QSHST-hosts.md:172:by one scan of the value
docs/spec/QSGAT-the-repository-and-its-gate.md:25:the light door that loads the parser and the parts it keeps and no

$ grep -n -o "the scan of the door[^']*" scripts/retired-words.mjs
104:the scan of the door, and the files a script lists, `sourceFilesUnder` and `refusalScanFiles`, walk naming the walk of the tags of a value alone
```

### archaism · core/README.md:100
Текст: «each fact whole within three hundred characters and past them as its excerpt».
Слой: модель, где факт, не влезший в свою комнату, печатался вырезкой самого значения; это слой «elide», переименованный [D407] в «excerpt». Сегодня такой факт стоит как клетка хоста с её видами, `::excerpt` — это карта фактов всего отказа, а «no verb cuts a value to a room» [QSPRN#excerpt].
Чистый лист: «past them as the cell its host keeps it in, beside its views».
```
$ grep -n -e "past them as its excerpt" -e "fact whole within" core/README.md
99:  one, answers for it, and a failure as its alert, each fact whole within
100:  three hundred characters and past them as its excerpt; `printAnswer(

$ qplay '1 | add (3410 | range)' < /dev/null | sed -n '2,6p'
::number/add/AddendKindNotTakenError::excerpt{
  :subject/found 1
  :addend/expected #[::number]
  :addend/found ::cell"f1e540466b72"
  :addend/found/tag ::vec

$ grep -n -o -E "no verb cuts a value to a room|A host prints no value cut to a room" docs/spec/QSPRN-printing-and-codecs.md
216:A host prints no value cut to a room
247:no verb cuts a value to a room
```

### drift · playground/lib/qlang/playground.qlang:12
Текст: «`qplay -i ['<query>']` opens a session of cells». Это страница `::host`, вторая из первых страниц сессии.
Слой: одно понятие, клетки REPL над одной областью имён, названо двумя словами: на странице — «session», в README и в главе — «notebook» [QSCLI#repl]. При этом [QSLEX#grep] оставляет «session» только за разговором модели; это след эпохи `createSession`, которую снял [D431].
Чистый лист: «opens a notebook of cells».
```
> get [~(::host | doc | content | contains "opens a session of cells") ~(::host | doc | content | contains "notebook")] < /dev/null
[true false]
```
```
$ grep -n -e "opens a notebook" README.md playground/README.md
playground/README.md:55:`qplay -i` opens a notebook whose cells share the names they declare;

$ grep -n -A2 "The session names" docs/spec/QSLEX-the-words-and-the-names.md
53:its files, since every tool and every reader searches it. The session names
54-the conversation of a model alone, the word of the harness its transcripts
55-are read by, and a notebook the cells a host runs over one scope
```

### subordination · scripts/research-runs.mjs:12
Текст: `import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';`
Слой: запуск чистого читателя исследования (`qplay` дерева на PATH, выключенное преобразование путей) живёт под существительным бенчмарка, и все прогоны исследования зависят от модуля ребёнка бенчмарка. Сам запуск чистой модели написан трижды: ребёнок (`child.mjs:113-116`), автор (`sets.mjs:56`, без `--restricted` и со своей копией «You are a careful assistant.») и читатели (`research-runs.mjs:159-163`).
Чистый лист: один модуль запуска чистой модели, от которого зависят и бенчмарк, и исследование.
```
$ grep -n -e "from './benchmark/child.mjs'" -e "careful assistant" -e "spawn('claude'" scripts/research-runs.mjs scripts/benchmark/child.mjs scripts/benchmark/sets.mjs | cut -c1-130
scripts/research-runs.mjs:12:import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';
scripts/research-runs.mjs:163:    const child = spawn('claude', flags, { cwd: mkdtempSync(join(tmpdir(), workPrefix)), env });
scripts/benchmark/child.mjs:14:const SYSTEM_PROMPT = 'You are a careful assistant.';
scripts/benchmark/child.mjs:116:    const child = spawn('claude', flags, { cwd: workDir, env: withTheLanguageOf(join(import.meta.d
scripts/benchmark/sets.mjs:56:    const child = spawn('claude', ['-p', '--model', model, '--strict-mcp-config', '--system-prompt',

$ grep -n -o -e "'--restricted'" -e "'--system-prompt'" scripts/research-runs.mjs scripts/benchmark/child.mjs scripts/benchmark/sets.mjs
scripts/research-runs.mjs:159:'--restricted'
scripts/benchmark/child.mjs:113:'--restricted'
scripts/benchmark/child.mjs:114:'--system-prompt'
scripts/benchmark/sets.mjs:56:'--system-prompt'
```

### shim · scripts/benchmark.mjs:41
Текст: `async function answerOf(query, task)`, «run in this process as `bin.mjs` runs it».
Слой: один факт, JSON-ответ командной строки на запрос над данными задачи, вычисляется двумя дорогами: здесь в процессе через `main`, в `sets.mjs:175` дочерним процессом `bin.mjs`. Судят его тоже два равенства: `isDeepStrictEqual` здесь и `sameJson` с допуском `1e-9` в `sets.mjs:185`, так что эталон и прогон ребёнка судятся по-разному.
Чистый лист: один `answerOf` и одно равенство, общие для `check:benchmark` и для оценки прогона.
```
$ grep -n -o -e "await main(\[\`(\${query}) | json | stdio/out\`\]" -e "execFileSync(process.execPath, \[commandLine, \`(\${query}) | json | stdio/out\`\]" scripts/benchmark.mjs scripts/benchmark/sets.mjs
scripts/benchmark.mjs:45:await main([`(${query}) | json | stdio/out`]
scripts/benchmark/sets.mjs:178:execFileSync(process.execPath, [commandLine, `(${query}) | json | stdio/out`]

$ grep -n -e "function answerOf" -e "isDeepStrictEqual(JSON" -e "function sameJson" -e "abs(one - other)" scripts/benchmark.mjs scripts/benchmark/sets.mjs | cut -c1-120
scripts/benchmark.mjs:41:async function answerOf(query, task) {
scripts/benchmark.mjs:55:  return isDeepStrictEqual(JSON.parse(await answerOf(task.reference, task)), JSON.parse(task.an
scripts/benchmark/sets.mjs:175:function answerOf(setId, task, query) {
scripts/benchmark/sets.mjs:185:function sameJson(one, other) {
scripts/benchmark/sets.mjs:186:  if (typeof one === 'number' && typeof other === 'number') return Math.abs(one - other)
```

### vestige · scripts/reconciliation.mjs:26
Текст: `export const CITATION_IN_WORDS = /\bdecisions? ((?:[DE]\d+)…/g`.
Слой: вторая форма ссылки на запись, словами («decision D41»). Сверка её читает, `merge-records.mjs:85-90` пишет обратно, `check-conventions.mjs:606` ловит в главах, но ни один текст в силе её не пишет, а [QSWRK#journal] знает одну форму: «A citation of a record is a link of markdown to its file, `[Dnn]`».
Чистый лист: одна форма `[Dnn]` и один регекс.
```
$ cat CLAUDE.md README.md core/README.md playground/README.md docs/spec/*.md docs/journal/*.md | grep -c -E "decisions? [DE][0-9]+"
0

$ cat CLAUDE.md README.md core/README.md playground/README.md docs/spec/*.md docs/journal/*.md | grep -c -E "\[D[0-9]+\]"
190

$ grep -n -e "CITATION_IN_WORDS" -e "decisions? \[DE\]" scripts/reconciliation.mjs scripts/merge-records.mjs scripts/check-conventions.mjs
scripts/reconciliation.mjs:26:export const CITATION_IN_WORDS = /\bdecisions? ((?:[DE]\d+)(?:(?:,\s*| and )[DE]\d+)*)/g;
scripts/reconciliation.mjs:27:const CITATION = new RegExp(`\\[((?:[DE]\\d+)(?:,\\s*[DE]\\d+)*)\\]|${CITATION_IN_WORDS.source}`, 'g');
scripts/merge-records.mjs:17:import { CITATION_IN_WORDS, CITING_DOCUMENTS, citedOnce } from './reconciliation.mjs';
scripts/merge-records.mjs:85:  written = written.replace(CITATION_IN_WORDS, (run, list) => {
scripts/check-conventions.mjs:606:  { rule: 'a record of the journal', regex: /\[[DE]\d+\]|\bdecisions? [DE]\d+\b/ },
```

### pentimento · eslint.config.mjs:15
Текст: «(CLAUDE.md hard invariant: …) Test files, cli, and the lsp server are free to `node:*` as before», «core/gen/** — generated parser + compiled core catalog», «vscode/** — vendored extension».
Слой: комментарий рассказывает историю и прежний слой: правило жило в CLAUDE.md (тот же слой в `check-conventions.mjs:165`, «the doc tree (quotes CLAUDE.md rules verbatim …)»), рабочее пространство звалось `cli`, `gen/` держал скомпилированный каталог, а `vscode/` был чужим кодом. Сегодня правило стоит в [QSGAT#workspaces], папки `cli/` нет, сборка пишет лишь парсер, а `vscode/` — рабочее пространство дерева с тестами в гейте.
Чистый лист: метки `[QSGAT#workspaces]` и `[QSGAT#gate]` в голове файла и ни слова о прошлом. Это добавляет к части 3 [D412]: единственная метка файла — хвостовой `[QSMSR#benchmark]` в строке 37, и по правилу блока она покрывает весь конфиг с головы, правило ядра без `node:*` в том числе.
```
$ grep -n -e "CLAUDE.md" -e "cli" -e "as before" -e "vendored" -e "compiled core catalog" -e "HTML" -e "comment tables" eslint.config.mjs
15://     `node:*` modules (CLAUDE.md hard invariant: the core ships
17://     every non-Node consumer). Test files, cli, and the lsp
18://     server are free to `node:*` as before.
22://   * core/gen/**  — generated parser + compiled core catalog
24://   * site/coverage/** — vitest coverage HTML artefacts
25://   * vscode/**    — vendored extension, not under our lint remit
49:        // Node globals used by cli / lsp / scripts / tests.

$ grep -n -o -E "\[(QS[A-Z]{3}(#[a-z-]+)?|D[0-9]+)\]" eslint.config.mjs
37:[QSMSR#benchmark]

$ grep -n -F "node:*" CLAUDE.md docs/spec/QSGAT-the-repository-and-its-gate.md
CLAUDE.md:142:dependency at runtime and no `node:*` import under `core/src/`; `stdio/` the
docs/spec/QSGAT-the-repository-and-its-gate.md:15:JavaScript with no dependency at runtime and no `node:*` import under
```

### pentimento · scripts/sensors/requirements-coverage.mjs:4
Текст: «run by the test files of their two sections, `QSWRK/cases` and `QSSLF/laws`».
Слой: имя раздела кейсов из той поры, когда он стоял в главе работы. Теперь это [QSREQ#cases], и сам скрипт запускает `test/unit/QSREQ/cases.test.mjs`.
Чистый лист: `QSREQ/cases`.
```
$ grep -n -e "QSWRK/cases" -e "RUNNERS =" scripts/sensors/requirements-coverage.mjs
4:// files of their two sections, `QSWRK/cases` and `QSSLF/laws`, under the
20:const RUNNERS = ['test/unit/QSREQ/cases.test.mjs', 'test/unit/QSSLF/laws.test.mjs'];

$ grep -n -H "^## cases" docs/spec/QSWRK-the-work.md docs/spec/QSREQ-the-requirements.md
docs/spec/QSREQ-the-requirements.md:8:## cases
```

### drift · scripts/requirements.mjs:20
Текст: `const decisions = readDecisionRecords(root);`, а в `benchmark/sets.mjs:124` — «--decision names no decision …; a measurement belongs to a decision».
Слой: одна вещь, запись журнала, в скриптах зовётся «decision», а в главах «record». Идентификатор `decisions` к тому же держит и открытые записи, то есть вопросы, а не решения, тогда как главы пишут «A measurement belongs to a record in force» [QSMSR#benchmark] и «shows where every record stands» [QSWRK#journal].
Чистый лист: «record» в именах, флагах и сообщениях, «decision» — только поле `Decision.`.
```
$ grep -n -o -e "a measurement belongs to a decision" -e "--decision names no decision" scripts/benchmark/sets.mjs
124:--decision names no decision
124:a measurement belongs to a decision

$ grep -n -o -e "A measurement belongs to a record in force" -e "shows where every record stands" docs/spec/QSMSR-the-measures.md docs/spec/QSWRK-the-work.md
docs/spec/QSMSR-the-measures.md:21:A measurement belongs to a record in force
docs/spec/QSWRK-the-work.md:125:shows where every record stands

$ grep -c -w -i "decisions\?" scripts/requirements.mjs scripts/benchmark/sets.mjs scripts/gate-diff.mjs scripts/sensors/check-quotes.mjs docs/spec/QSWRK-the-work.md docs/spec/QSREQ-the-requirements.md docs/spec/QSMSR-the-measures.md
scripts/requirements.mjs:20
scripts/benchmark/sets.mjs:14
scripts/gate-diff.mjs:5
scripts/sensors/check-quotes.mjs:1
docs/spec/QSWRK-the-work.md:6
docs/spec/QSREQ-the-requirements.md:2
docs/spec/QSMSR-the-measures.md:1

$ grep -c -w -i "records\?" scripts/requirements.mjs scripts/benchmark/sets.mjs scripts/gate-diff.mjs scripts/sensors/check-quotes.mjs docs/spec/QSWRK-the-work.md docs/spec/QSREQ-the-requirements.md docs/spec/QSMSR-the-measures.md
scripts/requirements.mjs:17
scripts/benchmark/sets.mjs:18
scripts/gate-diff.mjs:9
scripts/sensors/check-quotes.mjs:5
docs/spec/QSWRK-the-work.md:64
docs/spec/QSREQ-the-requirements.md:32
docs/spec/QSMSR-the-measures.md:3
```

### shim · scripts/reconciliation.mjs:23
Текст: `const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);`
Слой: один факт, какие папки не держат кода дерева, записан шестью таблицами в пяти модулях, причём `check-conventions.mjs:689` повторяет эту строку буква в букву. Седьмая таблица — обход диска `IGNORE_DIRS`, где `'stdio/coverage' … 'site/coverage'` мертвы рядом с `'coverage'`, которое уже совпадает по имени записи.
Чистый лист: один предикат над `git ls-files`, которые и так знают игнор.
```
$ grep -n -e "UNREAD_FOLDERS = " -e "UNCITING_FOLDERS = " -e "NO_MODULES = " -e "HISTORY = " -e "OUTSIDE = " -e "RUN_OUTPUT = " scripts/*.mjs | cut -c1-120
scripts/check-conventions.mjs:689:const UNREAD_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);
scripts/grep-ergonomics.mjs:14:const NO_MODULES = /(?:^|\/)(?:gen|dist|node_modules|sets)\//;
scripts/grep-ergonomics.mjs:18:const HISTORY = /(?:^|\/)(?:gen|dist|node_modules|sets|screens|replaced|research)\//;
scripts/import-reach.mjs:16:const OUTSIDE = /^(docs|scripts\/benchmark\/sets)\//;
scripts/marks.mjs:36:const RUN_OUTPUT = /^scripts\/benchmark\/sets\//;
scripts/reconciliation.mjs:23:const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);

$ sed -n '163,171p' scripts/check-conventions.mjs
// Files and directory roots that are outside the review remit —
// generated code, vendored bundles, third-party modules, the doc
// tree (quotes CLAUDE.md rules verbatim and can name the forbidden
// words for pedagogy), and the ruleset files themselves.
const IGNORE_DIRS = new Set([
  'node_modules', '.git',
  'core/gen',
  'coverage',  // repo-root coverage/ from a top-level npm run test:coverage
  'stdio/coverage', 'playground/coverage', 'core/coverage', 'lsp/coverage', 'site/coverage',

$ grep -n -e "IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry)" -e "if (relFile.startsWith('docs/')) continue;" -e "if (RULESET_FILES.has(relFile)) continue;" scripts/check-conventions.mjs
212:      if (IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry)) continue;
233:    if (RULESET_FILES.has(relFile)) continue;
234:    if (relFile.startsWith('docs/')) continue;
```

### vestige · core/scripts/build-grammar.mjs:3
Текст: «Run via `npm run build:grammar`.»
Слой: у ядра два скрипта для одной команды, `build:grammar` и `build` (`core/package.json:41-42`), и `build:grammar` не запускает никто, кроме этого комментария. Это след той поры, когда `build` собирал больше, чем парсер; тот же слой, что «compiled core catalog» в линт-конфиге.
Чистый лист: один `build`.
```
$ grep -n -e "\"build" package.json core/package.json
package.json:15:    "build": "npm run build -w @kaluchi/qlang-core",
package.json:16:    "build:site": "npm run build -w @kaluchi/qlang-site",
core/package.json:41:    "build:grammar": "node scripts/build-grammar.mjs",
core/package.json:42:    "build": "node scripts/build-grammar.mjs"

$ grep -rn "build:grammar" --include=*.mjs --include=*.md --include=*.yml --include=*.json . 2>/dev/null | grep -v node_modules | grep -v "docs/journal"
./core/package.json:41:    "build:grammar": "node scripts/build-grammar.mjs",
./core/scripts/build-grammar.mjs:3:// Run via `npm run build:grammar`. Idempotent. The input lives in
```

### shim · scripts/desk.mjs:48
Текст: `const requirements = execFileSync(process.execPath, [join(root, 'scripts', 'requirements.mjs')], …).split('\n');`
Слой: экран работы получает открытые цели и записи на решении, разбирая текст, который печатает дочерний процесс (`'target · '`, `'being decided: '`), хотя `decision-records.mjs` экспортирует `readDecisionRecords` и `isBeingDecided`. Вызванный тут же `reconciliationOf` читает те же записи, так что за один экран записи читаются дважды, а формат печати становится интерфейсом.
Чистый лист: функция над записями, общая для `requirements.mjs` и `desk.mjs`.
```
$ grep -n -e "requirements.mjs" -e "startsWith('target · ')" -e "startsWith('being decided: ')" scripts/desk.mjs
48:const requirements = execFileSync(process.execPath, [join(root, 'scripts', 'requirements.mjs')], { cwd: root, encoding: 'utf8' }).split('\n');
49:const targets = requirements.filter(line => line.startsWith('target · ')).map(line => `  ${line}`);
51:const decided = requirements.find(line => line.startsWith('being decided: '));

$ grep -c "^export" scripts/requirements.mjs scripts/decision-records.mjs
scripts/requirements.mjs:0
scripts/decision-records.mjs:22
```

### vestige · scripts/benchmark/verdict.mjs:124
Текст: «не записаны: прогон шёл до того, как прогоны стали записывать решённые» и «Runs compare within one mode and one model» (:3).
Слой: вердикт держит ветки для прогонов без счёта и группирует по `mode`, который `sets.mjs:122` всегда ставит в `'cli'`. Все шесть хранимых прогонов держат и `score`, и `"mode": "cli"`.
Чистый лист: прогон всегда со счётом, без поля режима, сравнение по модели.
```
$ grep -n -e "не записаны: прогон" -e "Решённые у базы не записаны" -e "const mode = 'cli'" -e "Runs compare within one mode" scripts/benchmark/verdict.mjs scripts/benchmark/sets.mjs | cut -c1-120
scripts/benchmark/verdict.mjs:3:// computing nothing again. Runs compare within one mode and one model.
scripts/benchmark/verdict.mjs:124:    if (nowFigures.some(figure => figure.solved === null)) lines.push('  не запи
scripts/benchmark/verdict.mjs:158:  const caveat = solvedKnown ? '' : ' Решённые у базы не записан
scripts/benchmark/sets.mjs:122:  const mode = 'cli';

$ grep -h -o -E '"(mode|score|requests)": ?("[a-z]+"|\[|[0-9]+)' scripts/benchmark/sets/*/runs/*.json | sort | uniq -c
      6 "mode": "cli"
      2 "requests": 11
      1 "requests": 12
      1 "requests": 15
      2 "requests": 8
      6 "score": [
```

### drift · README.md:44
Текст: «Bumps the core and the command line and the sibling ranges».
Слой: README описывает релиз двух пакетов, ядра и «командной строки» (прежнее имя площадки), тогда как `deploy.yml` публикует три: ядро, потоки и площадку, а `release.mjs:3` «bumps every publishable workspace».
Чистый лист: «Bumps the workspaces the Deploy workflow publishes».
```
$ grep -n -o -E "(Bumps|bumps)[^;]*" README.md scripts/release.mjs
README.md:44:Bumps the core and the command line and the sibling ranges, rebuilds,
scripts/release.mjs:3:bumps every publishable workspace to <version>, points
scripts/release.mjs:171:bumps. A bumped sibling momentarily sits outside the range its
scripts/release.mjs:179:bumps:')

$ grep -n -E "^\s*- workspace:" .github/workflows/deploy.yml
27:          - workspace: "@kaluchi/qlang-core"
29:          - workspace: "@kaluchi/qlang-stdio"
31:          - workspace: "@kaluchi/qlang-playground"
```

### vestige · CLAUDE.md:100
Текст: «Only the maintainer's quoted words bind a session; a record the model decided is a reading weighed on its merits», а также :114 «never amend» и :142 «no `node:*` import under `core/src/`».
Слой: семя пересказывает правила [QSWRK#journal], [QSWRK#stint] и [QSGAT#workspaces]; это остаток поры, когда CLAUDE.md был домом правил. Его же строка 6 говорит «It restates no rule», а [QSVOX#seed] требует «restates none of them».
Чистый лист: на этих местах только ссылки на разделы.
```
$ grep -n -e "Only the maintainer's quoted words bind a session" -e "It restates no rule" -e "restates none of them" CLAUDE.md docs/spec/QSWRK-the-work.md docs/spec/QSVOX-the-texts-and-their-voices.md
CLAUDE.md:6:and the chapters that state the rules [QSVOX#seed]. It restates no rule;
CLAUDE.md:100:Only the maintainer's quoted words bind a session; a record the model
docs/spec/QSWRK-the-work.md:108:Only the maintainer's quoted words bind a session. A record the model
docs/spec/QSVOX-the-texts-and-their-voices.md:117:the sections it points to and restates none of them, so a rule changes in

$ grep -n -e "never amend" -e "is never amended" -e "pure JavaScript with no dependency at runtime" -e "JavaScript with no dependency at runtime" CLAUDE.md docs/spec/QSWRK-the-work.md docs/spec/QSGAT-the-repository-and-its-gate.md
CLAUDE.md:114:explicit invitation, never amend [QSWRK#stint].
docs/spec/QSWRK-the-work.md:32:a commit is never amended.
docs/spec/QSGAT-the-repository-and-its-gate.md:15:JavaScript with no dependency at runtime and no `node:*` import under
```

### archaism · scripts/anchors.mjs:15
Текст: `(?:core|cli|stdio|playground|…)` в `ANCHOR_PATH_RE`; то же в `replaced-records.mjs:28`.
Слой: `cli` — прежнее имя площадки, и папки `cli/` в дереве нет. То же имя живёт в заголовке проверки (22) «the core, the command line and the language server» (`check-conventions.mjs:127`), хотя проверка читает `playground/src` и `stdio/src`, и в «A consumer installing the CLI» (`release.mjs:195`).
Чистый лист: папки берутся из `package.json#workspaces`, а заголовок говорит «the core, the streams, the playground and the language server», как [QSLEX#code].
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch cli
error: pathspec 'cli' did not match any file(s) known to git
Did you forget to 'git add'?

$ grep -n -o -E "\(\?:core\|cli\|[a-z|\\.]+\)" scripts/anchors.mjs scripts/replaced-records.mjs
scripts/anchors.mjs:15:(?:core|cli|stdio|playground|lsp|site|vscode|scripts|docs|\.claude|\.github)
scripts/replaced-records.mjs:28:(?:core|cli|stdio|playground|lsp|vscode|site|scripts|docs|\.claude|\.github)

$ grep -n -e "core, the command" -e "line and the language server is a mark" -e "MARKED_SOURCES = " scripts/check-conventions.mjs | cut -c1-120
127://   (22) A comment of the sources and the tests of the core, the command
128://       line and the language server is a mark alone, one line of the
902:const MARKED_SOURCES = ['core/src', 'core/host', 'core/test', 'stdio/src', 'playground/src', 'playground/test', 'lsp

$ grep -n -e "installing the CLI" -e "used by cli" -e "Test files, cli" scripts/release.mjs eslint.config.mjs
scripts/release.mjs:195:// registry verbatim. A consumer installing the CLI resolves that
eslint.config.mjs:17://     every non-Node consumer). Test files, cli, and the lsp
eslint.config.mjs:49:        // Node globals used by cli / lsp / scripts / tests.
```

### shim · scripts/fuzz-laws.mjs:71
Текст: `laws.push(quote.slice(2, -1).replace(/\s+\|\s+eq\s[^|]*$/, ''))` над `map ~(get /1 | get /1 | print)`.
Слой: фазз достаёт код закона из текста его печати: срезает скобки и отрезает последнее `| eq …` регексом, хотя [QSREQ#rigor] не допускает регекса по тексту печати, а язык отдаёт тот же код как данные через `take (count | sub 1) | toString`. Это добавляет к третьей дороге [D423]: если печать кода разложить на строки, этот срез придётся переписывать вместе с ней.
Чистый лист: шаги цитаты как данные и `toString`.
```
$ grep -n -e "const quotes = await evalQuery" -e "quote.slice(2, -1)" scripts/fuzz-laws.mjs | cut -c1-130
70:  const quotes = await evalQuery(`::${name} | laws | entries | map ~(get /1 | get /1 | print)`, scope);
71:  if (Array.isArray(quotes)) for (const quote of quotes) laws.push(quote.slice(2, -1).replace(/\s+\|\s+eq\s[^|]*$/, ''));
```
```
> ::vec/sort | laws | entries | first | get /1 | get /1 | get [~(print) ~(take (count | sub 1) | toString)] < /dev/null
["~([3 1 4 1 5] | sort | eq [1 1 3 4 5])" "[3 1 4 1 5] | sort"]
```

### shim · scripts/desk.mjs:20
Текст: `const sister = join(root, '..', 'eclipse-jdt-search');`
Слой: место сестринского проекта записано тремя способами: абсолютным путём `D:\git\eclipse-jdt-search` в `CLAUDE.md:153`, соседом чекаута в `desk.mjs:20` и `anchors.mjs:35`, словом `jdt` в `run-probes.mjs:125`. В ворктри вне репозитория, где [QSRVW#readers] советует запускать прогоны, «сосед» оказывается `D:/git/qlang-worktrees/eclipse-jdt-search`, и экран работы вместе с проверкой якорей молча теряют сестру.
Чистый лист: одно место, читаемое из окружения и общее для всех трёх.
```
$ grep -n -e "eclipse-jdt-search" -e "jdt" CLAUDE.md scripts/desk.mjs scripts/anchors.mjs scripts/sensors/run-probes.mjs | cut -c1-120
CLAUDE.md:153:`D:\git\eclipse-jdt-search` consumes qlang and breaks first when the public
scripts/desk.mjs:20:const sister = join(root, '..', 'eclipse-jdt-search');
scripts/anchors.mjs:35:export function anchorsTheTreeLacks(repoRoot, sisterRoot = join(repoRoot, '..', 'eclipse-jdt-sear
scripts/sensors/run-probes.mjs:125:const readsTheRepositoryAlone = command => !/\bjdt\b|scripts\/sensors|^env\b|\$[A-Z]/
```
