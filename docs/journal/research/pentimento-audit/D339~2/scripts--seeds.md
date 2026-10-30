> A pentimento audit of scripts--seeds for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:33 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### drift · core/README.md:23
Текст: «The command line, `@kaluchi/qlang-playground`, `qplay`, runs a query from the shell.» Так же `docs/spec/README.md:34`: «the command line and its REPL», хотя сама глава называется «The playground of the command line and its REPL».
Слой: здесь живёт имя рабочего пространства `cli`, которое D477 разделило на `stdio` и `playground` (`D339~1/reading.md:164`). Поэтому одно слово «the command line» называет сразу пять вещей: среду процесса (так в главах), саму площадку (семя, индекс глав, `pipe-env.mjs`, `benchmark.mjs`, `run-probes.mjs`, `child.mjs:31,44`, `sets.mjs:257`, `verdict.mjs:108` «с командной строкой qlang», идентификаторы `commandLine`), CLI Claude Code (`child.mjs:59,65`), `process.argv` (`import-reach.mjs:107`), а также примитивы потоков и домен записей, которых в силе больше нет.
Чистый лист: «the command line» означает только среду процесса, как в [QSHST#effect]; площадка везде называется «the playground», `qplay`, а CLI агента — `claude`. Находка добавляет к части 13 D339 (термины нескольких смыслов) ещё и этот термин.
```
$ grep -n -i -o ".\{0,30\}the command line.\{0,25\}" core/README.md docs/spec/README.md docs/spec/QSCLI-the-command-line.md docs/spec/QSHST-hosts.md scripts/pipe-env.mjs scripts/benchmark/child.mjs scripts/import-reach.mjs scripts/retired-words.mjs scripts/requirements.mjs
core/README.md:23:rt | doc` the page of a name. The command line,
docs/spec/README.md:34:(QSCLI-the-command-line.md) | the command line and its REPL: the answer
docs/spec/QSCLI-the-command-line.md:1:# QSCLI · The playground of the command line and its REPL
docs/spec/QSCLI-the-command-line.md:3:How the playground of the command line reads a query and writes
docs/spec/QSHST-hosts.md:9:sections; the playground of the command line is [QSCLI], and the
docs/spec/QSHST-hosts.md:16:playground of the command line, the language server and
docs/spec/QSHST-hosts.md:238:`::stdio` a host on the command line installs, a verb of a st
scripts/pipe-env.mjs:1:/ The environment a tool runs the command line in when it reads what th
scripts/benchmark/child.mjs:31:// The environment with the command line of a tree first on the P
scripts/benchmark/child.mjs:44:// What a tool result of the command line answered: the tag of the
scripts/benchmark/child.mjs:59:// The reply the command line writes instead of an ans
scripts/benchmark/child.mjs:67: and tokens, and the calls of the command line in their order.
scripts/retired-words.mjs:83:, written: 'the primitives of the command line, `streamPrimitives` and 
scripts/requirements.mjs:48: of any other domain, a host, the command line or

$ grep -n -o -E "\b(commandLine|withTheCommandLine|onCommandLine|COMMAND_LINE_TOOLS|COMMAND_LINE)\b *=[^;]{0,60}" scripts/*.mjs scripts/benchmark/*.mjs scripts/sensors/*.mjs
scripts/import-reach.mjs:109:COMMAND_LINE = Symbol('commandLine')
scripts/benchmark/child.mjs:15:COMMAND_LINE_TOOLS = ['Bash(qplay:*)', 'Bash(MSYS_NO_PATHCONV=1 qplay:*)', 'Bash
scripts/benchmark/child.mjs:36:commandLine = join(repoRoot, 'playground', 'src', 'bin.mjs')
scripts/benchmark/screens.mjs:13:commandLine = join(benchDir, '..', '..', 'playground', 'src', 'bin.mjs')
scripts/benchmark/sets.mjs:24:commandLine = join(repoRoot, 'playground', 'src', 'bin.mjs')
scripts/sensors/run-probes.mjs:154:commandLine = join(repoRoot, 'playground', 'src', 'bin.mjs').split('\\').
```

### shim · scripts/benchmark/screens.mjs:18
Текст: `'[::qlang ::host] | map (get [it doc])'` — запрос первого экрана, который фиксирует каждый прогон.
Слой: один факт, запрос первого экрана, записан восемь раз двумя написаниями. Длинное `map (get …)` стоит в [QSMSR#benchmark], [QSPRN#budget], `budget.test.mjs` и здесь; короткое `map [it doc]` стоит в четырёх промптах читателей. При этом первая страница учит, что `map` сам строит шаблон.
Чистый лист: одно написание в базовой форме, экспорт `screens.mjs`. Его читают тест бюджета и промпты, а главы ссылаются на него. Находка добавляет к части 13 D339.
```
$ git grep -c -F "[::qlang ::host] | map (get [it doc])" -- docs/spec playground/test scripts
docs/spec/QSMSR-the-measures.md:1
docs/spec/QSPRN-printing-and-codecs.md:1
playground/test/QSPRN/budget.test.mjs:1
scripts/benchmark/screens.mjs:1

$ git grep -c -F "[::qlang ::host] | map [it doc]" -- docs/spec playground/test scripts
scripts/design-check-prompt.txt:1
scripts/outside-audit-prompt.txt:1
scripts/pentimento-audit-prompt.txt:1
scripts/spec-check-prompt.txt:1
```
```
> [::qlang ::host] | with {:a (map [it doc]) :b (map (get [it doc]))} (a | eq b) < /dev/null
true

> ::qlang | doc | content | contains "`map`\nbuilds its template on each element" < /dev/null
true
```

### vestige · scripts/benchmark/tasks.mjs:120
Текст: `answer: '::host | kinds | map doc | map content'`; так же в N2 (:126) и N4 (:138). Шапка файла при этом обещает «the answer, as JSON … or as a qlang literal».
Слой: поле `answer` навигационных задач держит второй запрос, и `benchmark.mjs:54` выполняет его через `evalQuery(task.answer)`. Выходит, `check:benchmark` сверяет эталон с эталоном. Если `doc`, `content`, `manifest` или `laws` изменятся, обе стороны изменятся вместе, и проверка не упадёт.
Чистый лист: `answer` — литерал ответа, как у N3 `#[::fail]`, а запрос живёт только в `reference`. Это дополняет часть 13 D339 («references longer than the shortest query»): там речь о длине эталонов, здесь — о поле `answer`, которое ответом не является.
```
$ git grep -n -E "answer: '(::|#)" -- scripts/benchmark/tasks.mjs
scripts/benchmark/tasks.mjs:120:    answer: '::host | kinds | map doc | map content'
scripts/benchmark/tasks.mjs:126:    answer: '::string | manifest | filter (binding | value | tag | eq ::fn) | map (get [it (doc | content)]) | sort'
scripts/benchmark/tasks.mjs:132:    answer: '#[::fail]'
scripts/benchmark/tasks.mjs:138:    answer: '::vec | manifest | filter (binding | value | tag | eq ::fn) | map (runLaws | count) | sum'
```
```
> ["::host | kinds | map doc | map content" "::vec | manifest | filter (binding | value | tag | eq ::fn) | map (runLaws | count) | sum" "#[::fail]" "[3 6 9]"] | map (parse | map tag) < /dev/null
[[::tag ::call ::call ::call] [::tag ::call ::call ::call ::call] [::set] [::vec]]
```

### drift · scripts/anchors.mjs:13
Текст: `const ANCHOR_DOCUMENTS = ['CLAUDE.md', 'docs/journal/AIM.md'];`
Слой: для проверки якорей семя — это один `CLAUDE.md`. Но [QSVOX#seed] и [QSREQ#probe] считают семенем и README рабочих пространств. Поэтому якоря `README.md`, `core/README.md` и `playground/README.md` проверка (5) не читает. Сам список семян при этом записан ещё трижды: в `reconciliation.mjs:22`, литералом в `check-conventions.mjs:650` (хотя этот модуль импортирует `CITING_DOCUMENTS`) и в `vocabulary.mjs:23`.
Чистый лист: один список семян, `CITING_DOCUMENTS`, из которого берут и якоря, и даты проверки (12), и словарь.
```
$ git grep -n -E "'CLAUDE\.md'" -- scripts
scripts/anchors.mjs:13:const ANCHOR_DOCUMENTS = ['CLAUDE.md', 'docs/journal/AIM.md'];
scripts/check-conventions.mjs:199:  'CLAUDE.md',
scripts/check-conventions.mjs:650:  ['CLAUDE.md', 'README.md', 'core/README.md', 'playground/README.md'].forEach(datedLines);
scripts/reconciliation.mjs:22:export const CITING_DOCUMENTS = ['CLAUDE.md', 'README.md', 'core/README.md', 'playground/README.md'];
scripts/sensors/vocabulary.mjs:23:const TEXTS = ['docs/spec', 'core/lib', 'stdio/lib', 'playground/lib', 'core/src', 'stdio/src', 'playground/src', 'lsp/src', 'site/src', 'core/test', 'playground/test', 'lsp/test', 'CLAUDE.md', 'README.md', 'core/README.md', 'playground/README.md'];

$ git grep -n -e "the instruction file of" -e "and the READMEs of the workspaces" -- docs/spec/QSVOX-the-texts-and-their-voices.md
docs/spec/QSVOX-the-texts-and-their-voices.md:114:A seed is a text a session or a reader starts from: the instruction file of
docs/spec/QSVOX-the-texts-and-their-voices.md:115:the repository, `CLAUDE.md`, and the READMEs of the workspaces. `CLAUDE.md`

$ git grep -n -F "core/vitest.config.mjs" -- core/README.md
core/README.md:130:The thresholds of coverage are pinned in `core/vitest.config.mjs`.
```

### shim · scripts/sensors/sentence-lengths.mjs:22
Текст: `const docsOfSource = text => [...text.replace(CODE_SPAN, 'Code').matchAll(/\|~~(?!\|)([\s\S]*?)~~\|/g)]`
Слой: это второй читатель доков каталога, регексом; на нём держится проверка (27). Рядом есть `comments.mjs`, который читает те же доки парсером ядра. Третий читатель — голова источника, которую `check-conventions.mjs:487` находит по тексту первой строки. Всё это против [QSREQ#rigor] «through one reader». Регекс обрывает док на первом `~~|`, а язык допускает вложенные доки и док внутри сниппета.
Чистый лист: предложения страниц и голова источника берутся из одного чтения, `commentRanges(path, text, { docs: true })`. Это добавляет к D391: число, которое там предлагают ограничить, меряет читатель, который неверно находит сами доки.
```
$ git grep -n -e "const headEnd = " -e "const docsOfSource" -e "forEachPart(root" -- scripts/check-conventions.mjs scripts/sensors/sentence-lengths.mjs scripts/comments.mjs
scripts/check-conventions.mjs:487:    const headEnd = lines[0]?.startsWith('|~') && !lines[0].startsWith('|~~') ? lines.findIndex(line => line.includes('~|')) : -1;
scripts/comments.mjs:29:    forEachPart(root, part => {
scripts/sensors/sentence-lengths.mjs:22:const docsOfSource = text => [...text.replace(CODE_SPAN, 'Code').matchAll(/\|~~(?!\|)([\s\S]*?)~~\|/g)]

$ git grep -n -e "through one reader" -e "a source of the catalog by the parser of the core, its docs" -- docs/spec/QSREQ-the-requirements.md
docs/spec/QSREQ-the-requirements.md:198:the parser of its language through one reader, `scripts/comments.mjs`: a
docs/spec/QSREQ-the-requirements.md:199:module by acorn, a source of the catalog by the parser of the core, its docs
```
```
> get [(|~~ a |~~ b ~~| c ~~| | content) (|~~ see ::snippet~(|~~ x ~~| | content) y ~~| | segments | count)] < /dev/null
["a |~~ b ~~| c" 3]
```

### pentimento · scripts/check-conventions.mjs:182
Текст: «the doc tree (quotes CLAUDE.md rules verbatim and can name the forbidden words for pedagogy)» и в строке 196: «Files that quote the forbidden list verbatim», где в `RULESET_FILES` стоит `'CLAUDE.md'`.
Слой: так было, когда `CLAUDE.md` держал правила и список запретных слов. Сегодня он «restates no rule» и ни одного из этих слов не пишет. Кроме того, `docs/` вообще не входит в `IGNORE_DIRS`: её пропускает строка 251.
Чистый лист: исключения названы тем правилом, которое их задаёт, — [QSVOX#pentimento] «outside `docs/`, `vscode/` and the instructions» — без причины, которой дерево не держит. Это добавляет к части 3 D412 (проза скриптов). Тот же слой прогон `D339~1` назвал в находке `eslint.config.mjs:15`, но в проверке его так и не сняли.
```
$ git grep -c -i -E "\b(TODO|FIXME|HACK|legacy|deprecated|currently|previously)\b|backwards? compat" -- CLAUDE.md scripts/check-conventions.mjs
scripts/check-conventions.mjs:13

$ git grep -n -e "quotes CLAUDE.md rules verbatim" -e "Files that quote the forbidden list verbatim" -e "It restates no rule" -- scripts/check-conventions.mjs CLAUDE.md
CLAUDE.md:6:and the chapters that state the rules [QSVOX#seed]. It restates no rule;
scripts/check-conventions.mjs:182:// tree (quotes CLAUDE.md rules verbatim and can name the forbidden
scripts/check-conventions.mjs:196:// Files that quote the forbidden list verbatim — exempt from the
```

### vestige · scripts/check-conventions.mjs:193
Текст: «A review of a branch, named by its date, stands as its reviewer wrote it» и регекс `VERBATIM_REPORT` по шаблону `reviews/\d{4}-\d{2}-\d{2}…\.md`.
Слой: так раньше называли ревью — по дате. [QSRVW#research] называет ревью по записи, `reviews/D324~4.md`, и ни одного ревью с датой в дереве нет.
Чистый лист: отчёты исследования узнаются только по формам папок (`foldersOfForm`), без исключения для формы, которой нет.
```
$ git -C D:/git/qlang-worktrees/pentimento-d339 ls-files --error-unmatch "docs/journal/research/reviews/20*.md"
error: pathspec 'docs/journal/research/reviews/20*.md' did not match any file(s) known to git
Did you forget to 'git add'?

$ git grep -n -e "named by its date" -e "const VERBATIM_REPORT" -- scripts/check-conventions.mjs
scripts/check-conventions.mjs:193:// A review of a branch, named by its date, stands as its reviewer wrote it,
scripts/check-conventions.mjs:195:const VERBATIM_REPORT = new RegExp(`^${RESEARCH}/reviews/\\d{4}-\\d{2}-\\d{2}[^/]*\\.md$`);

$ git grep -n -e "docs/journal/research/reviews/D324" -- docs/spec/QSRVW-the-reviews-and-the-research.md
docs/spec/QSRVW-the-reviews-and-the-research.md:21:record did, `docs/journal/research/reviews/D324~4.md`; a critique of a
```

### vestige · scripts/check-conventions.mjs:393
Текст: «(«1192 error-producing conformance cases»). A digit carrying a section sign (`§3 rule`, `#4 case`) addresses a chapter rather than counting one» и `(?<![§#])` в `TALLY_RE`.
Слой: это спецификация с нумерованными параграфами `§3`. Кроме того, фраза, которую тексты когда-то писали, процитирована в «…» — кавычках, которыми журнал цитирует мейнтейнера. Сегодня раздел цитируется кодом главы и заголовком, а знак `§` встречается только в самой этой проверке.
Чистый лист: исключение, если оно нужно, — для ссылки `[QS…#…]`, и пример без истории. В части комментария это добавляет к части 3 D412.
```
$ git grep -n -e "1192" -e "§" -- . ":!docs/journal" ":!scripts/benchmark/sets"
scripts/check-conventions.mjs:393:// («1192 error-producing conformance cases»). A digit carrying a
scripts/check-conventions.mjs:394:// section sign (`§3 rule`, `#4 case`) addresses a chapter rather
scripts/check-conventions.mjs:397:  String.raw`(?<![§#])\b\d[\d,]*\s+(?:[a-z][a-z-]*\s+){0,2}(?:` + TALLY_NOUNS + String.raw`)\b`,

$ git grep -c -F "[QS" -- docs/spec/QSWRK-the-work.md docs/spec/QSVOX-the-texts-and-their-voices.md
docs/spec/QSVOX-the-texts-and-their-voices.md:14
docs/spec/QSWRK-the-work.md:23
```

### archaism · scripts/decision-records.mjs:107
Текст: «A walk files a principle and a rule of the tooling under their domain». Так же `check-conventions.mjs:550` — «the graph of the records walks from any document» — и `retired-words.mjs:64` — «the walk of the editor finds».
Слой: «walk» здесь значит обход записей, связей и редактора. Этот смысл вывели из текстов D429 (walk of the baseline) и D436, который оставил слову один смысл — обход тегов значения, [QSDSP#walk]. Регексы лексикона ловят лишь составные имена и эти строки пропускают.
Чистый лист: «A record filed under the principles or the tooling…», «the links lead from any document into the past», «the occurrences of a name the editor finds». Находка добавляет к части 13 D339 (термины одного смысла).
```
$ git grep -n -o -e "A walk files a principle" -e "records walks from any document" -e "the walk of the editor finds" -- scripts
scripts/check-conventions.mjs:550:records walks from any document
scripts/decision-records.mjs:107:A walk files a principle
scripts/retired-words.mjs:64:the walk of the editor finds

$ git grep -h -o -E "walk naming the walk of the tags of a value alone', by: '[A-Z0-9]+'" -- scripts/retired-words.mjs
walk naming the walk of the tags of a value alone', by: 'D436'
```

### pentimento · eslint.config.mjs:5
Текст: «Author formatting is preserved — qlang source frequently uses hand-aligned columns inside comment tables and deliberately wide signatures. Prettier is intentionally absent; this config refuses to fight it.» И в строке 24: «site/coverage/** — vitest coverage HTML artefacts».
Слой: здесь — исходники с прозой-таблицами в комментариях и широкими строками, и противопоставление инструменту, которого дерево не держит. Сегодня комментарий ядра, потоков, площадки и сервера — только метка (проверка 22), строка каталога — не длиннее восьмидесяти символов (26), а сайт покрытия не пишет вовсе.
Чистый лист: голова называет, что конфиг держит, и свои метки [QSGAT#workspaces] и [QSGAT#gate]; без `site/coverage/**`. Это добавляет к части 3 D412. Прошлая находка `eslint.config.mjs:15` сняла только строки 15–25, кроме строки 24.
```
$ git grep -n -e "hand-aligned" -e "wide signatures" -e "Prettier" -e "site/coverage" -- eslint.config.mjs
eslint.config.mjs:5:// qlang source frequently uses hand-aligned columns inside comment
eslint.config.mjs:6:// tables and deliberately wide signatures. Prettier is intentionally
eslint.config.mjs:24://   * site/coverage/** — vitest coverage HTML artefacts
eslint.config.mjs:35:      'site/coverage/**',

$ git grep -c -E "^ *// *[A-Za-z]" -- core/src stdio/src playground/src lsp/src

$ git grep -n -e "CATALOG_WIDTH = 80" -e "const MARKS_ALONE" -- scripts/check-conventions.mjs
scripts/check-conventions.mjs:933:const MARKS_ALONE = new RegExp(String.raw`^\s*${CITED}(?:,\s*${CITED})*\s*$`);
scripts/check-conventions.mjs:970:const CATALOG_WIDTH = 80;

$ git grep -n -E "\"test:coverage\"|\"test\"" -- site/package.json lsp/package.json vscode/package.json stdio/package.json playground/package.json
lsp/package.json:8:    "test": "vitest run",
playground/package.json:14:    "test": "vitest run",
playground/package.json:16:    "test:coverage": "vitest run --coverage",
site/package.json:10:    "test": "vitest run"
vscode/package.json:12:    "test": "vitest run"
```

### shim · scripts/import-reach.mjs:23
Текст: `for (const workspace of ['core', 'stdio', 'playground', 'lsp', 'site', 'vscode']) {`
Слой: список рабочих пространств записан вручную, хотя `workspace-manifests.mjs:35` читает его из `package.json#workspaces`. Корни их кода и каталога записаны ещё по меньшей мере в семи таблицах (сюда входит и `gate-diff.mjs:120`), так что новое рабочее пространство с каталогом требует правки каждой.
Чистый лист: корни выводятся из `readWorkspaces` и форм папок `src/`, `lib/`, `test/`. Это добавляет к части 13 D339: там шесть таблиц папок, которых дерево не читает, а здесь те же таблицы для папок, которые оно читает.
```
$ git grep -n -e "for (const workspace of \[" -e "rootManifest.workspaces" -- scripts
scripts/import-reach.mjs:23:  for (const workspace of ['core', 'stdio', 'playground', 'lsp', 'site', 'vscode']) {
scripts/workspace-manifests.mjs:35:  return rootManifest.workspaces.map((dir) => {

$ git grep -n -o -E "\[[^]]*'stdio/lib'[^]]*\]|'core/lib', 'stdio/lib'" -- scripts
scripts/check-conventions.mjs:473:['core/lib', 'stdio/lib', 'playground/lib']
scripts/check-conventions.mjs:660:['stdio/lib', /\.qlang$/]
scripts/pentimento-audit.mjs:104:['core/host', 'stdio/src', 'stdio/lib', 'playground/src', 'playground/lib', 'lsp/src', 'vscode/src', 'site/src', 'site/scripts']
scripts/reconciliation.mjs:18:['core/src', 'core/host', 'core/lib', 'core/test/unit', 'core/test/helpers', 'core/test/qlang', 'stdio/src', 'stdio/lib', 'playground/src', 'playground/lib', 'playground/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'site/scripts', 'site/test', 'core/scripts', 'scripts', '.github/workflows']
scripts/sensors/sentence-lengths.mjs:36:['core/lib', 'stdio/lib', 'playground/lib']
scripts/sensors/vocabulary.mjs:23:['docs/spec', 'core/lib', 'stdio/lib', 'playground/lib', 'core/src', 'stdio/src', 'playground/src', 'lsp/src', 'site/src', 'core/test', 'playground/test', 'lsp/test', 'CLAUDE.md', 'README.md', 'core/README.md', 'playground/README.md']
```

### subordination · core/vitest.config.mjs:23
Текст: `exclude: ['src/load-source-web.mjs']`, под комментарием «The browser's loader, the `default` condition of `#qlang/load-source`, stands outside the coverage».
Слой: загрузчик браузера — дорога платформы с `fetch` — стоит в `core/src` рядом со средой исполнения, а его пара для Node — в `core/host`. Их развели по признаку «импортирует ли модуль `node:*`», а не по понятию. Отсюда особый случай в покрытии, и отсюда же `core-imports.mjs:1` говорит о «the loaders of `core/host`».
Чистый лист: оба загрузчика платформ лежат в `core/host/`, ядро ходит к ним только через `#qlang/load-source`, а покрытие `src/**` обходится без исключений. Это добавляет к части 13 D339 («the core naming its consumers»).
```
$ git grep -n -e "load-source" -e "the loaders of" -- core/package.json core/vitest.config.mjs scripts/core-imports.mjs
core/package.json:22:    "#qlang/load-source": {
core/package.json:23:      "node": "./host/load-source-node.mjs",
core/package.json:24:      "default": "./src/load-source-web.mjs"
core/vitest.config.mjs:21:      // `#qlang/load-source`, stands outside the coverage, which
core/vitest.config.mjs:23:      exclude: ['src/load-source-web.mjs'],
scripts/core-imports.mjs:1:// The imports of the modules of the core, those of `core/src`, the loaders of

$ git grep -n -F "fetch" -- core/src
core/src/load-source-web.mjs:6:/* global fetch */
core/src/load-source-web.mjs:14:  const res = await fetch(url);
```

### vestige · scripts/benchmark/child.mjs:17
Текст: «Git Bash rewrites an argument that begins with `/` into a path of Windows, which mangles a query that reads a part, and the conversion is off.»
Слой: один и тот же выключатель щёлкают дважды. `CHILD_ENVIRONMENT` уже ставит `MSYS_NO_PATHCONV=1` в окружение каждого ребёнка и читателя (`research-runs.mjs:138`), а разрешения `Bash(MSYS_NO_PATHCONV=1 qplay:*)` и четыре промпта велят писать его ещё раз. Сам комментарий оправдывает выключатель порчей запроса, которую площадка чинит сама [QSCLI#shell] — об этом говорит и семя.
Чистый лист: одно место — окружение старта. Комментарий называет единственный случай, который площадка не читает назад: первый сегмент из одной буквы. Находка добавляет к части 13 D339.
```
$ git grep -n -F "CHILD_ENVIRONMENT" -- scripts
scripts/benchmark/child.mjs:20:export const CHILD_ENVIRONMENT = Object.freeze({ MSYS_NO_PATHCONV: '1' });
scripts/benchmark/child.mjs:29:export const RUN_ENVIRONMENT = Object.freeze({ ...CHILD_ENVIRONMENT, ...BENCHMARK_EFFORT });
scripts/research-runs.mjs:12:import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';
scripts/research-runs.mjs:138:  const started = { ...env, ...CHILD_ENVIRONMENT, CLAUDE_CODE_EFFORT_LEVEL: effort };

$ git grep -c -F "MSYS_NO_PATHCONV" -- scripts ":!scripts/benchmark/sets"
scripts/benchmark/child.mjs:2
scripts/design-check-prompt.txt:1
scripts/outside-audit-prompt.txt:1
scripts/outside-audit.mjs:1
scripts/pentimento-audit-prompt.txt:1
scripts/research-runs.mjs:1
scripts/sensors/run-probes.mjs:1
scripts/spec-check-prompt.txt:1

$ git grep -n -e "which the playground reads back" -e "The playground reads a query written under the root from" -- CLAUDE.md docs/spec/QSCLI-the-command-line.md
CLAUDE.md:111:query that begins with `/` arrives as a path, which the playground reads back
docs/spec/QSCLI-the-command-line.md:150:as a drive. The playground reads a query written under the root from
```

### drift · scripts/workspace-manifests.mjs:1
Текст: «The manifest surface the release rewrite and the convention check share»; `check-conventions.mjs:874` — «its manifest's `.`»; строки 23 и 383 — «the manifest, or a grep».
Слой: это слово npm для `package.json`, и стоит оно рядом с осью языка `manifest`: в том же файле, строка 138, — «which `manifest` lists them in». Поэтому, что значит «the manifest» в проверке (3), читатель не различит. Главы пишут `package.json` для файла, а `manifest` — только для оси.
Чистый лист: в именах и комментариях скриптов — `package.json` (и, например, `workspace-packages.mjs`), а `manifest` остаётся только осью. Это добавляет к части 13 D339 (термины нескольких смыслов).
```
$ git grep -n -o -e "the manifest, or a grep" -e "its manifest's" -e "The manifest surface" -e "which .manifest. lists them in" -- scripts/check-conventions.mjs scripts/workspace-manifests.mjs
scripts/check-conventions.mjs:23:the manifest, or a grep
scripts/check-conventions.mjs:138:which `manifest` lists them in
scripts/check-conventions.mjs:383:the manifest, or a grep
scripts/check-conventions.mjs:874:its manifest's
scripts/workspace-manifests.mjs:1:The manifest surface
```
```
> ::any/manifest | doc | content | lines | first < /dev/null
Answers the set of the nodes declared one name under the name the subject
```

### shim · scripts/sensors/growth.mjs:102
Текст: `peggy.generate(grammar, { output: 'source', format: 'es', trace: true, allowedStartRules: ['Query'] })` и `.replaceAll("from '../src/", …)` на следующей строке.
Слой: сенсор генерирует парсер второй раз, со своей копией опций `build-grammar.mjs`. Импорты сгенерированного текста он переписывает заменой строки, а она зависит от того, как peggy печатает инициализатор `grammar.peggy`.
Чистый лист: одна функция генерации в `core/scripts/build-grammar.mjs` с флагом трассировки и путём импортов; её зовут и сборка, и сенсор. Находка добавляет к части 13 D339.
```
$ git grep -n -E "allowedStartRules|replaceAll\(\"from '\.\./src/" -- core/scripts/build-grammar.mjs scripts/sensors/growth.mjs
core/scripts/build-grammar.mjs:28:  allowedStartRules: ['Query']
scripts/sensors/growth.mjs:102:  const parser = peggy.generate(grammar, { output: 'source', format: 'es', trace: true, allowedStartRules: ['Query'] })
scripts/sensors/growth.mjs:103:    .replaceAll("from '../src/", `from '${pathToFileURL(join(root, 'core/src'))}/`);
```

### vestige · scripts/dissolve-records.mjs:28
Текст: `const rewrite = (path, change) => {`; тот же помощник буква в букву стоит в `merge-records.mjs:43`.
Слой: два скрипта журнала держат по своей копии переписи файла с сохранением концов строк.
Чистый лист: один `rewrite` в `tree-reads.mjs` — модуле, через который скрипты уже читают тексты. Находка добавляет к части 13 D339.
```
$ git grep -n -F "const rewrite = (path, change)" -- scripts
scripts/dissolve-records.mjs:28:const rewrite = (path, change) => {
scripts/merge-records.mjs:43:const rewrite = (path, change) => {
```
