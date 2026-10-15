<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSWRK-the-work.md, on 2026-10-15 from 08:05 to 08:14 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### conflict · scripts/baseline-walk.mjs:106

Раздел QSWRK#journal задаёт одну форму для части, которую забрала более новая запись: старшая запись получает «the older gaining `Pruned of what [the newer] took.`», и проверка держит взятую часть «by `Pruned of what` and `Replaces in part` alone». Скрипты обхода, рабочего стола и требований читают другую строку, `^Replaced in part by`. Её не пишет ни одна запись журнала, а форму `Pruned of what` пишут 146 записей.

```sh
$ grep -n "Pruned of what" docs/spec/QSWRK-the-work.md
92:records' words, the older gaining `Pruned of what [the newer] took.` and
106:`Pruned of what` and `Replaces in part` alone, a record

$ grep -n "Replaced in part by/\|'in part '" scripts/baseline-walk.mjs scripts/decision-records.mjs
scripts/baseline-walk.mjs:106:  const partialLines = text => (text.match(/^Replaced in part by/gm) ?? []).length;
scripts/decision-records.mjs:68:      const replacing = inPart => [...recordText.matchAll(new RegExp(`^Replaced ${inPart ? 'in part ' : ''}by (.+)$`, 'gm'))]

$ grep -n "replaced in part" scripts/requirements.mjs
7:// later records replaced in part, and the decisions a case does not
35:    if (record.replacedInPartBy.length > 0) console.log(`  replaced in part by  ${record.replacedInPartBy.join(' ')}`);
52:  printList('replaced in part', decisionsWhere(record => !replacedWhole(record) && record.replacedInPartBy.length > 0));

$ grep -rlE "^Replaced in part by" docs/journal | wc -l
0

$ grep -rlE "^Pruned of what" docs/journal | wc -l
146
```

Глава называет формой частичной замены `Pruned of what`. Комментарии и код `baseline-walk.mjs` («the lines that replace a record in part only fall»), `requirements.mjs` (список «replaced in part») и `desk.mjs` («lines replace in part») считают строки `Replaced in part by`. Поэтому их счёт всегда равен нулю, и правило, которое они заявляют, ничего не держит.

### implementation · scripts/spec-check.mjs:72

QSWRK#probe: «a probe that lists files by `git ls-files` lists them with `--error-unmatch`». Промпт проверки тоже велит читателю брать факты файлов через `git ls-files --error-unmatch`. Но `spec-check.mjs` запускает читателя из пустого временного каталога и разрешает ему только `Bash(git ls-files:*)`.

```sh
$ grep -n "const ALLOWED\|cwd: mkdtempSync" scripts/spec-check.mjs
72:const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', 'Bash(grep:*)', 'Bash(git ls-files:*)'];
88:  const child = spawn('claude', flags, { cwd: mkdtempSync(join(tmpdir(), 'qlang-spec-check-')), env });

$ grep -c "git ls-files --error-unmatch" scripts/spec-check-prompt.txt
1
```

Из рабочего каталога читателя, который не является репозиторием, `git ls-files` ничего не перечислит. Форма `git -C D:/git/qlang ls-files …` под разрешение `git ls-files:*` не подпадает: в этом прогоне такой вызов потребовал подтверждения. Читатель не может выполнить пробу, которой требуют глава и промпт. Есть и вторая развилка: `run-probes.mjs` повторяет пробы оболочки из корня репозитория, а читатель запускает их из другого каталога.

Вопрос: какое поведение будет согласованным — читатель, запущенный там, где `git ls-files --error-unmatch` отвечает, или промпт, который такой пробы не требует?

### text · QSWRK#marks

В одном разделе стоят два утверждения о данных бенчмарка. Первое: «and the data of a measurement in the name of its file, `screens/D270.txt`». Второе: «the data a run of the benchmark wrote, its runs and the generators of the sets its authors wrote, mark nothing». Экран `screens/D270.txt` записывает сам `run` (`fixScreen`). `marks.mjs` считает имена экранов и прогонов наборов метками, а его же комментарий говорит, что они ничего не метят.

```sh
$ grep -n "mark nothing\|in the name of its file" docs/spec/QSWRK-the-work.md
198:in the name of its file, `screens/D270.txt`. A mark covers its block,
207:generators of the sets its authors wrote, mark nothing. A page of the catalog, the public interface of the

$ grep -n "marks nothing\|sets/V/runs/D270" scripts/marks.mjs
30:// generated, marks nothing [QSWRK#measure].
42:// `screens/D270.txt`, and a run of a set, `sets/V/runs/D270~cli~sonnet~1.json`
```

Раздел одновременно утверждает, что данные измерения называют запись именем файла и что данные прогона ничего не метят. `marks.mjs:42-46` следует первому утверждению, а `marks.mjs:30` — второму.

### implementation · QSWRK#tooling

«`check:conventions` holds … a month of the history in a text that states what holds». QSWRK#documents перечисляет тексты, которые говорят, что действует: «the chapters of the specification, the pages of the catalog, the cases and the comments of the code». Проверка же читает главы и четыре файла-затравки. Каталог, кейсы и комментарии кода она не читает, а читает `CLAUDE.md`, которого в этом перечне нет.

```sh
$ grep -n "for (const seed of" scripts/check-conventions.mjs
527:  for (const seed of ['CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md']) {

$ grep -n "the cases and the comments of the code" docs/spec/QSWRK-the-work.md
426:the cases and the comments of the code, each the rule, the form a reader
```

Множество текстов, которые держит проверка, расходится с множеством, которое глава называет текстами о действующем. Вопрос: какое поведение будет согласованным для месяца в странице каталога или в комментарии `core/src`?

### conflict · docs/spec/README.md:3

Указатель говорит обо всех главах: «Each chapter states its rules section by section and shows them by probes … The requirements of a section are the cases of the conformance file named for it». QSWRK говорит о себе другое: «and this chapter by the checks each section names». В QSWRK нет ни одного блока проб, и у неё нет каталога кейсов.

```sh
$ grep -n "this chapter by the checks" docs/spec/QSWRK-the-work.md
118:its rules by probes, and this chapter by the checks each section names;

$ ls core/test/conformance/QSWRK
ls: cannot access 'core/test/conformance/QSWRK': No such file or directory
```

Указатель утверждает пробы и кейсы для каждой главы, а QSWRK#spec и вводная часть QSWRK держат эту главу проверками, ревью и мейнтейнером.

### implementation · QSWRK#tooling

«and the form of a record, its `Domain.`, its decider and the fields of an open record». QSWRK#journal ограничивает порогом `D155` только решающего: «refuses a record from `D155` on that names its decider otherwise». Код отфильтровывает записи до D155 раньше любой проверки формы, поэтому `Domain.` и поля открытой записи у них тоже не проверяются.

```sh
$ grep -n "FIRST_RECORD_NAMING_ITS_DECIDER)" scripts/check-conventions.mjs
390:    .filter(({ number }) => number >= FIRST_RECORD_NAMING_ITS_DECIDER)

$ grep -n "its \`Domain.\`, its decider" docs/spec/QSWRK-the-work.md
588:its address; and the form of a record, its `Domain.`, its decider and the
```

Глава ставит порог одному решающему, а код ставит его всей форме записи. Вопрос: должна ли действующая запись до D155 (например, `D38`) без `Domain.` или без `Alternatives.` при `Question.` отклоняться?

### conflict · CLAUDE.md:186

Затравка сессии: «fails on temporal lexicon in the sources outside `docs/`». Глава: «in the sources outside `docs/`, `vscode/` and the instructions». Код исключает `vscode` и `CLAUDE.md`.

```sh
$ grep -n "outside \`docs/\`" docs/spec/QSWRK-the-work.md
585:outside `docs/`, `vscode/` and the instructions; a month of the

$ grep -n "'vscode'" scripts/check-conventions.mjs
86:  'vscode'
```

`CLAUDE.md` очерчивает область проверки шире, чем глава и `check-conventions.mjs`.

### implementation · scripts/release.mjs:5

QSWRK#code: «A comment states what holds … and deletes a false comment». Глава описывает выпуск через «the coverage of the core and the tests». Заголовок `release.mjs` говорит, что скрипт «runs every workspace's test suite and coverage thresholds», а код проверяет покрытие одного ядра.

```sh
$ grep -n "coverage" scripts/release.mjs
6:// coverage thresholds, pushes master, and waits for CI to go green
243:// ── Test + coverage ─────────────────────────────────────────
245:console.log('\nTests (coverage on @kaluchi/qlang-core):');
246:run('npm run test:coverage -w @kaluchi/qlang-core');
```

Глава и код согласны между собой (покрытие одного ядра), а комментарий заявляет пороги для каждого воркспейса. Вопрос: остаётся ли такой комментарий в дереве, если QSWRK#code требует удалять ложные?

### apophasis · QSWRK#journal

«Doubt is resolved by a record with its source, and by no item of a process, list of statuses or comment in code.» Правило уже сказано утвердительно, а вторая половина перечисляет, чем сомнение не разрешается.

```sh
$ grep -n "by no item of a process" docs/spec/QSWRK-the-work.md
41:a record with its source, and by no item of a process, list of statuses
```

В том же разделе есть обоснование, а не правило: «`[Dnn]`, so an editor or a browser opens it at a click and the chain of reasons is a graph of files».

```sh
$ grep -n "so an editor or a browser" docs/spec/QSWRK-the-work.md
15:file, `[Dnn]`, so an editor or a browser opens it at a click and the
```

### apophasis · QSWRK#cases

«`!{…} | raise`, so a case holds a form the language does not read yet and stands through a change that breaks the language's own sources». Предложение оправдывает форму кейса тем, что она даёт, вместо того чтобы сказать, что действует.

```sh
$ grep -n "so a case holds a form" docs/spec/QSWRK-the-work.md
140:`!{…} | raise`, so a case holds a form the language does not read yet
```

### apophasis · QSWRK#diff

«where a growth signals a crooked part, an old scar or a concept that does not compose». Это довод в пользу правила «a diff that deletes more than it adds», а не само правило.

```sh
$ grep -n "where a growth signals" docs/spec/QSWRK-the-work.md
355:adds, where a growth signals a crooked part, an old scar or a concept
```

### apophasis · QSWRK#branch

«and a session that finds none has read too little of the tree or run too few of its probes». Это суждение о сессии, которая ничего не нашла, а не правило работы.

```sh
$ grep -n "has read too little" docs/spec/QSWRK-the-work.md
317:that finds none has read too little of the tree or run too few of its
```
