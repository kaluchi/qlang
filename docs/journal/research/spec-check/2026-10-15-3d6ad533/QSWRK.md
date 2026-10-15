<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSWRK-the-work.md, on 2026-10-15 from 07:04 to 07:12 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### implementation · scripts/benchmark/sets.mjs:122
QSWRK#measure: «A measurement belongs to a record in force, which says what it measures and why, and carries its number, `run --decision Dnn`». QSWRK#documents: «`docs/` holds two folders», и записи лежат в `docs/journal/`. При этом `run` ищет запись в `docs/decisions/`, а такой папки в дереве нет:

```sh
$ grep -n "'docs', 'decisions'" scripts/benchmark/sets.mjs
122:  if (!/^D\d+$/.test(decision ?? '') || !existsSync(join(repoRoot, 'docs', 'decisions', `${decision}.md`))) {

$ git ls-files --error-unmatch docs/decisions
error: pathspec 'docs/decisions' did not match any file(s) known to git
Did you forget to 'git add'?

$ git ls-files --error-unmatch docs/journal/D270.md
docs/journal/D270.md
```

Раздел утверждает, что измерение можно провести под записью в силе. Скрипт же отказывает для любого `--decision`, в том числе для D270, которая в силе. Вопрос: какой ответ согласован — `run` принимает запись, лежащую там, где QSWRK#documents помещает записи?

### implementation · QSWRK#journal
«A record out of force moves once to `docs/journal/replaced/`, under the line of its fate, `Dissolved into`, `Merged into`, `Replaced by` or `Filed under the principles by`». Скрипт переноса и проверка папок признают только три первые строки. Кроме того, в журнале есть судьба `Filed under the tooling by`, которой глава не называет:

```sh
$ grep -n "under the principles by" docs/spec/QSWRK-the-work.md
102:under the principles by`, and under its

$ grep -n "const replacedWhole" scripts/replaced-records.mjs scripts/check-conventions.mjs
scripts/replaced-records.mjs:19:const replacedWhole = text => /^(Replaced by|Merged into|Dissolved into) /m.test(text);
scripts/check-conventions.mjs:406:  const replacedWhole = path => /^(Replaced by|Merged into|Dissolved into) /m.test(readFileSync(join(repoRoot, path), 'utf8'));

$ grep -rn "^Filed under" docs/journal/replaced/D159.md
43:Filed under the tooling by [D226]: `check:conventions` holds it.
```

По главе запись только со строкой `Filed under the principles by` уходит в `replaced/`. `replaced-records.mjs` её не переносит, а `check:conventions` сочтёт такую запись под `replaced/` «in force». `decision-records.mjs:72` и `gate-diff.mjs:105` при этом знают обе формы, `principles|tooling`. Вопрос: какой набор строк судьбы согласованно переносит запись и проверяется?

### text · QSWRK#cases
«`check:conventions` refuses a case whose record overrides no section of its chapter». QSWRK#baseline говорит о записи «in transit over its section», и реализация требует, чтобы запись перекрывала именно секцию этого случая (или главу целиком):

```sh
$ grep -n "overrides no section of its chapter\|over its section claims\|no record in transit over its section" docs/spec/QSWRK-the-work.md
158:overrides no section of its chapter.
261:no record in transit over its section claims, the case naming it or,

$ grep -n "which overrides no section" scripts/baseline-walk.mjs
227:      if (test.decision !== undefined && !overrides(test.decision, chapter, section)) unclaimed.push({ where: `${file}#${name}`, problem: `names ${test.decision}, which overrides no section ${chapter}#${section}` });
```

Пример расхождения: запись перекрывает `[QSNAM#reach]` и названа в случае из `QSNAM/scope.jsonl`. По фразе QSWRK#cases это допустимо, по QSWRK#baseline и `baseline-walk.mjs` такой случай будет отказан.

### conflict · CLAUDE.md:211
CLAUDE.md: «a citation of a record not in force, which the code, the tests and the cases never make and the documents make only of one waiting on its target». QSWRK#baseline: «a citation in a document that cites of a record out of force or of the language with no case, an open record among those it may cite». Сам CLAUDE.md при этом цитирует открытую запись:

```sh
$ grep -n "documents make only of one waiting\|\[D296\]" CLAUDE.md
212:documents make only of one waiting on its target [QSWRK#baseline]. `npm run check:probes` runs every probe of the open records, the
219:and `cli/`; which thresholds the work keeps is an open record [D296].

$ grep -n "^Question\." docs/journal/D296.md
4:Question. Which tests and guards does the work keep? The thresholds of

$ grep -n "an open record among those it may cite" docs/spec/QSWRK-the-work.md
270:no case, an open record among those it may cite. `npm run
```

Тексты расходятся в том, какие записи вне ответа кейсом документ вправе цитировать. По CLAUDE.md только ждущие свою цель, по QSWRK#baseline ещё и открытые.

### implementation · scripts/benchmark.mjs:8
QSWRK#baseline: `check:conventions` держит «a citation in the code and the tests of a record that no met case holds». Код ссылается на запись вне силы без скобок, и обход такую форму не читает:

```sh
$ grep -n "D104" scripts/benchmark.mjs
8:// wrote up, is the first screen's reading test of D104.

$ git ls-files --error-unmatch docs/journal/replaced/D104.md
docs/journal/replaced/D104.md

$ grep -n "^Replaced by\|^Merged into\|^Dissolved into" docs/journal/replaced/D104.md
26:Merged into [D26].

$ grep -n "CITATION_IN_WORDS =" scripts/baseline-walk.mjs
24:export const CITATION_IN_WORDS = /\bdecisions? ((?:[DE]\d+)(?:(?:,\s*| and )[DE]\d+)*)/g;
```

Скрипт называет запись вне силы, а обход видит только `[Dnn]` и `decision Dnn`. Вопрос: какой ответ согласован — запись, названная в коде любым написанием, держится тем же правилом, или код называет записи только формой цитаты?

### implementation · QSWRK#code
«The ratio of comment lines to code lines over the core, the command line and the language server falls, measured on every branch against the baseline». Ни один скрипт эту долю не считает:

```sh
$ grep -n "ratio of comment lines" docs/spec/QSWRK-the-work.md
336:and deletes a false comment. The ratio of comment lines to code lines

$ grep -ciE "comment" scripts/measure.mjs
0

$ grep -niE "comment" scripts/check-conventions.mjs
360:// The comment at the head of a source, `|~ … ~|`, is no page a reader
```

Глава называет величину, которая «measured on every branch», но в `scripts/` её никто не измеряет. Вопрос: каким средством согласованно измеряется эта доля?

### implementation · scripts/check-conventions.mjs:12
QSWRK#code: «deletes a false comment». В дереве стоят комментарии, которые говорят о дереве неправду:

```sh
$ grep -n "CLAUDE.md's forbidden list\|Scanned in .mjs" scripts/check-conventions.mjs
12://       `backwards compat`. Scanned in .mjs / .js source. The
14://       in CLAUDE.md's forbidden list too but carry too many

$ grep -n "mjs|js|md|qlang" scripts/check-conventions.mjs
130:    if (!/\.(mjs|js|md|qlang)$/.test(entry) || VERBATIM_REPORT.test(relPath)) continue;

$ grep -n -A2 "temporal lexicon" CLAUDE.md
185:`npm run check:conventions` fails on temporal lexicon in the sources
186-outside `docs/` (legacy, deprecated, currently, previously, backward
187-compatibility, and the TODO, FIXME, and HACK markers), on a digit

$ grep -n "two-line shebang" cli/vitest.config.mjs
23:      // bin.mjs is the Node-runtime adapter — a two-line shebang

$ grep -c "" cli/src/bin.mjs
16

$ grep -n "site-tests" .github/workflows/ci.yml
116:  # the qlang-core package; the site-tests job above runs unit

$ grep -n "Publishing from the package directory" .github/workflows/deploy.yml
50:      # Publishing from the package directory rather than through
51:      # Publishing from the package directory rather than through
```

Что именно не так:
- Сканируются ещё `.md` и `.qlang`, а не только «.mjs / .js».
- В списке CLAUDE.md нет слов now/was/old/new.
- `bin.mjs` — 16 строк, а не «two-line shebang».
- Задания `site-tests` в `ci.yml` нет.
- Строка комментария в `deploy.yml` повторена дважды.

Правило QSWRK#code эти места не выполняют.

### text · QSWRK#tooling
«`check:conventions` holds, beside the walk, the fates and the anchors, the words …, a count in markdown prose …; the ranges of the siblings; and every refusal declared by its address». Скрипт держит ещё два правила, которых QSWRK не формулирует. Первое — название месяца в главе, в CLAUDE.md и в README, которое CLAUDE.md называет «a date of the history». Второе — форма записи: `Domain.` и поля открытой записи. Глава из этого называет только строку решающего:

```sh
$ grep -n "const HISTORY_DATE" scripts/check-conventions.mjs
506:const HISTORY_DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

$ grep -ciE "month|date of the history" docs/spec/QSWRK-the-work.md
0

$ grep -n "date of the history" CLAUDE.md
197:their file no longer holds, on a date of the history in a text that
```

Реализация и CLAUDE.md держат правило о дате, а глава работы его не формулирует.

### implementation · QSWRK#spec
«A chapter states the rule of each section in the present …; it shows its rules by probes». README говорит то же: «shows them by probes». В самой главе работы нет ни одной пробы:

```sh
$ grep -n "it shows its rules by probes" docs/spec/QSWRK-the-work.md
119:writes and the refusal that teaches it; it shows its rules by probes;

$ grep -c '^```' docs/spec/QSWRK-the-work.md
0
```

Ни одна из 14 секций QSWRK не показывает своё правило пробой, хотя QSWRK#probe допускает shell-пробы, читающие только репозиторий. Вопрос: какой ответ согласован — главы, у которых нет кейсов, показывают свои правила shell-пробами, или правило о пробах исключает такие главы?

### conflict · QSWRK#catalog
QSWRK#catalog: «…and its value on the line after them; a keyword value stays on the line of its doc». QSSLF#catalog описывает ту же раскладку без исключения: «each doc of its slot on the lines after it indented two, and its value after them». В каталоге исключению не соответствует ни одна декларация:

```sh
$ grep -n "a keyword value stays" docs/spec/QSWRK-the-work.md
459:of its own, and its value on the line after them; a keyword value stays

$ grep -n "and its value after them" docs/spec/QSSLF-the-language-describes-itself.md
236:lines after it indented two, and its value after them.

$ grep -rnE '~~\| +:[A-Za-z]' core/lib cli/lib | wc -l
0
```

Две главы задают раскладку декларации каталога по-разному: исключение для keyword есть только в QSWRK.

### apophasis · QSWRK#journal
«the lines `Replaced in part by` are no more than the baseline held». Глава вводит взамен формы `Pruned of what` и `Replaces in part`, а форму `Replaced in part by` описывает только пределом относительно базы. Ни одна запись её не держит:

```sh
$ grep -n "Replaced in part by" docs/spec/QSWRK-the-work.md
108:lines `Replaced in part by` are no more than the baseline held, a record

$ grep -rlE "^Replaced in part by" docs/journal | wc -l
0
```

Правило отсылает к форме, оставшейся в истории, вместо того чтобы сказать, что держит журнал.

### apophasis · QSWRK#journal
«…the maintainer's words about it are searched, `node scripts/sensors/maintainer-messages.mjs`, since the project may have had it and left it». То же в этой секции: «A record goes stale in its tenses before its rules».

```sh
$ grep -n "since the project may" docs/spec/QSWRK-the-work.md
70:`node scripts/sensors/maintainer-messages.mjs`, since the project may

$ grep -n "goes stale in its tenses" docs/spec/QSWRK-the-work.md
54:record goes stale in its tenses before its rules: its source is history,
```

Здесь правило оправдывает себя историей проекта.

### apophasis · QSWRK#tooling
«no `node:*` import under `core/src/`, since it ships to a browser, to Deno and to Bun»; «so every branch worth covering lives where a test reaches it»; «so the name of that file bears weight».

```sh
$ grep -n "since it ships\|bears weight\|so every branch worth covering" docs/spec/QSWRK-the-work.md
549:import under `core/src/`, since it ships to a browser, to Deno and to
562:resolves, so every branch worth covering lives where a test reaches it;
598:of npm, so the name of that file bears weight; the commit of a release
```

Каждая из трёх фраз объясняет, зачем правило, а не говорит, что держится.

### apophasis · QSWRK#review
«A clean reader knows no earlier form, so it probes the bounds of each rule as it stands …, while a reader of the records is handed the words the language left, so that its probes look for them».

```sh
$ grep -n "A clean reader knows no earlier form\|language left, so that" docs/spec/QSWRK-the-work.md
523:two latest runs. A clean reader knows no earlier form, so it probes the
526:language left, so that its probes look for them; a check goes deeper
```

Фраза оправдывает порядок проверки и говорит о прежних формах языка.

### implementation · scripts/spec-check-prompt.txt:12
QSWRK#probe: «a probe that lists files by `git ls-files` lists them with `--error-unmatch`». QSWRK#review: пробы отчёта прогоняет `run-probes.mjs`. Промпт же предлагает читателю `git ls-files` и не называет флага:

```sh
$ grep -n "error-unmatch" docs/spec/QSWRK-the-work.md scripts/spec-check-prompt.txt
docs/spec/QSWRK-the-work.md:371:lists them with `--error-unmatch`. `npm run check:probes` runs every probe of

$ grep -n "listsFilesUnguarded =" scripts/sensors/run-probes.mjs
112:const listsFilesUnguarded = command => /\bgit ls-files\b(?![^|]*--error-unmatch)/.test(command);
```

Проба отчёта, написанная по промпту без флага, получит от `run-probes.mjs` вердикт `UNGUARDED` и завалит прогон. Вопрос: какой ответ согласован — промпт требует флаг, или прогон отчётов судит такие пробы иначе?

### implementation · QSWRK#marks
«An artifact that names nothing, a tracked `.mjs`, `.js`, `.peggy` or `.qlang` outside `docs/` or a workflow, is an orphan». Отслеживаемые генераторы наборов не несут метки, а `marks.mjs` их молча исключает:

```sh
$ git ls-files --error-unmatch scripts/benchmark/sets/U/author/gen.js scripts/benchmark/sets/V/author/gen.js
scripts/benchmark/sets/U/author/gen.js
scripts/benchmark/sets/V/author/gen.js

$ grep -cE '\[(D[0-9]+|QS[A-Z]{3})' scripts/benchmark/sets/U/author/gen.js scripts/benchmark/sets/V/author/gen.js
scripts/benchmark/sets/U/author/gen.js:0
scripts/benchmark/sets/V/author/gen.js:0

$ grep -n "RUN_OUTPUT =" scripts/marks.mjs
32:const RUN_OUTPUT = /^scripts\/benchmark\/(runs|sets)\//;
```

По главе это сироты, а реализация их не видит.

### text · QSWRK#target
«…lists every such move: … a change to the specification, `scripts/`, a `package.json`, `.github/`, `CLAUDE.md`, `.claude/`, or the comparator of the runner and its judge». `gate-diff.mjs` считает воротами ещё конфигурации vitest и eslint:

```sh
$ grep -n "a change to the specification, .scripts/." docs/spec/QSWRK-the-work.md
183:record; a change to the specification, `scripts/`, a `package.json`,
```

```sh
$ grep -n "vitest\|eslint" scripts/gate-diff.mjs
38:  /(^|\/)vitest\.config\.[cm]?js$/,
39:  /(^|\/)eslint\.config\.[cm]?js$/,
```

Перечень «every such move» в главе уже, чем то, что держит скрипт.

### implementation · CLAUDE.md:149
«the Node floor is the `engines.node` field of each workspace». У `site` нет поля `engines`, у `vscode` в `engines` только `vscode`:

```sh
$ grep -n '"engines"' -A2 site/package.json vscode/package.json
vscode/package.json:7:  "engines": {
vscode/package.json-8-    "vscode": "^1.91.0"
vscode/package.json-9-  },
```

У двух из пяти воркспейсов поля, на которое ссылается CLAUDE.md, нет.
