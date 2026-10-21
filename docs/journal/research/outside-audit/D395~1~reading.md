# Разбор одиннадцатого внешнего аудита

Чтение модели, сессия 4fde8c60, 2026-10-21. Аудит — [D395~1.md](D395~1.md):
чистый Opus с промптом `scripts/outside-audit-prompt.txt` на дереве
22ac26d2, базис a07a6ef5 и над ним запись D395, первый коммит ветки
the-bound-at-the-print. Его вызвала D395 по слову мейнтейнера, «пока у нас
чистая ветка запусти ещё аутсайд-аудит и бенчмарки соннетом .. что б знать
что было» (maintainer, 2026-10-21 00:28 UTC, session 4fde8c60); её `Runs.`
держит запуск. Десятый аудит и его разбор стоят рядом,
[D353~1.md](D353~1.md) и [D353~1~reading.md](D353~1~reading.md). Каждое
утверждение ниже проверено запуском `qlang` дерева ветки, чей язык тот же,
что у 22ac26d2: после него ветка меняла журнал, набор бенчмарка и
`.gitattributes`.

Прогон шёл из worktree коммита 22ac26d2 вне репозитория,
`D:\git\qlang-worktrees\audit-D395`, со своей установкой и сборкой. Первый
старт отказал: `npm ci` переписал первую строку `cli/src/bin.mjs` на перевод
строки LF, при `core.autocrlf=true` git увидел изменение, хотя `git diff`
пуст, и скрипт отказался читать дерево с изменением, которого не держит
коммит. Файл вернулся из коммита, а ветка держит строку
`cli/src/bin.mjs text eol=lf` в `.gitattributes`, после которой свежая
установка оставляет дерево чистым. Читатель шёл на effort `max`, первый
аудит после D394: его транскрипт пишет `"effort":"max"`, транскрипт
десятого — `medium`. Он запускал `qlang`, `ls`, `wc` и `time`, читал файлы
дерева, AIM и записи журнала, `CLAUDE.md` не открывал, к истории не
обращался, и ни одна команда не ждала разрешения.

## Что поменялось с десятым

Названо снова:

- хранимый код не видит значений читателя, D281, шестой аудит подряд, и
  снова замыкание: через `fill` или захват при объявлении;
- имя с цитатой отвечает ею поздним шагом, D256:
  `:double ~(mul 2) | 5 | double` отвечает `~(mul 2)`; десятый и
  одиннадцатый голосуют за отказ;
- грамматика и перенос строки, D295; она по-прежнему в 1084 строки;
- регистр прозы, теперь с мерой D391;
- слова нескольких смыслов: `has`, `union`, синонимы в `manifest`;
- старт и цена шага, D257;
- печать без бюджета, D327: у одиннадцатого — раскладка карт, трасса в
  алерте и строка верхнего уровня;
- семейство `*Of`, теперь с дырой `gtOf`.

Не названо снова: форма редьюсера, запись, на которой упал фильтр,
`:actualType` аргументов, ширина печати `source`, умолчание `query` перед
`null`.

## Что подтвердилось

- **Происхождение цитаты (3.1).** `:k 10 | [1 2] | map ~(add k)` отвечает
  `[11 12]`; `map (~(add k))`, `map ([~(add k)] | first)` и
  `:q ~(add k) | … | map q` отказывают `::call/ValueWithheldError`; а
  `[~(add k)] | first | eq ~(add k)` — `true`. Глагол ядра, прочитанный из
  своей печати, `::number/add | binding | get /value | print | parse | open`,
  на `apply` отвечает `::fn/RecipeMissingError`.
- **Одно пространство имён (3.2).** `:count 5 | 7 | count` отвечает `5`,
  `:count 5 | [1 2] | count` — `::call/ValueMeetsVerbError`, и внутри
  `map ~first` так же по элементу. После `:vec/add ~(append 1)`
  `"x" | add 1 !| type` отвечает `::call/KindAnswersNoVerbError` вместо
  `::number/add/SubjectNotNumberError`. Тело под меткой без тильды —
  данные: `5 | :number/inc add 1 | number/inc` отвечает `6`, голое `inc` —
  `::call/UnknownNameError` с `:nearest [:in]`, а
  `::number | manifest | has ::number/inc` — `true`.
- **Перенос строки (3.3).** `{:mode :slow} | put /mode` и `:fast` на
  следующей строке отвечают `{:mode :fast}`, с `:fast 1` —
  `::any/put/value/NotGivenError`: ключевое слово в начале строки со шагом
  после него открывает объявление [QSSYN#line]. Тело `:number/inc`,
  начатое на следующей строке, `add 1 | mul 10`, считается при объявлении
  над `::qlang` и отказывает `::number/add/SubjectNotNumberError` с
  `:actualType ::tag`.
- **Два поля (3.4).** `{:a 5 :b 3} | gtOf /a /b` — `::call/UnknownNameError`;
  `5 | if (gt 0) "pos" "neg"` — `::any/if/then/KindNotTakenError`, страница
  отказа называет `~("yes")`.
- **Проза (3.5).** Фраза страницы `get`, которую он приводит, стоит на ней
  дословно. `{:a 1} | put /b !| explain` даёт страницу «The value laid at
  the path.»: у отказа пропущенного входа своей страницы нет, и он берёт
  страницу входа.
- **Пробелы (3.6).** `[{:id 1}] | indexBy /id | keys` отвечает `#[:"1"]`,
  `groupBy ~(get [/a /b])` — `::vec/groupBy/KeyKindNotTakenError`,
  `{:a 1} | put /x/y 2` — `::path/KeyNotInMapError` [QSPTH#write],
  `["b" "a" "b"] | distinct` — `#["a" "b"]`, `[1 "x"] | sort | last` —
  `"x"`, а `max` — `::call/KindsMismatchedError`, `laws` — `::map`,
  `runLaws` — `::vec`. `{:users 1} | .users` отказывает `::quote/ParseError`
  с `:found "."` и двадцатью продолжениями в `:expected`, без `:message`;
  так же без `:message` отказывает `;` между двумя запросами в одной строке,
  `::number/round | doc; ::vec/sum | doc`, который писали дети D395.
- **Цена (3.7).** Глубина: `:number/down` над 450 отвечает `0`, над 500 —
  `::call/EvaluationDepthExceededError`.
- **Печать (3.8).** Рекурсия над 2000 оставляет трассу в 1001 кадр, алерт
  печатает каждый.

## Где он ошибся или неточен

- **3.3, «тексты утверждают обратное».** И первая страница
  (`core/lib/qlang.qlang:474-479`), и [QSSYN#line] в том же абзаце, где
  перенос строки — пробел, говорят, что ключевое слово в начале строки со
  шагом или доком после него открывает объявление. Ловушка верна, а
  утверждения, что тексты её отрицают, нет.
- **3.8, «девять строк».** `[{:a 1 :b 2 :c 3}] | print | lines | count`
  отвечает `7`.
- **3.6, «`union` требует `vec/union`».** Верно, и отказ
  `#[#[1] #[2]] | union` — `::set/union/other/NotGivenError`: обход тегов
  сначала доходит до бинарного `union` множества [QSDSP#walk].
- **§6.5, «агент теряет запрошенные данные».** Решение консилиума D327
  держит ответ в отказе: `:actualValue` — сам ответ, урезанный видом до
  выдержки, и `:read` каждой элизии в ней продолжает запрос от ответа
  (`docs/journal/research/design-check/D327~2.md:52`). Данные — одно чтение,
  а не потеря.
- **§6.4, «мера проверяется на наборе W».** Набор пишет чистый автор,
  который языка не видел [QSWRK#measure]: набор, нацеленный на конструкции,
  написал бы тот, кто их знает. После его дерева ветка добавила набор X.
- **§6.1, «AIM обещает лексическую область».** Шаг и цитата, написанная в
  шаге, читают имена перед ними, `:k 10 | [1 2] | map ~(add k)` отвечает
  `[11 12]`; не читает их код, хранимый как данные [QSQUO#held], и это ось
  D281, как сказал и разбор десятого.

## Что просит вашего слова

1. **Граница D327 (пачка 26).** Он против вашей дороги, сбоя за бюджетом, и
   за элизию по умолчанию. Ваши слова связывают; его довод о потере данных
   снимает выдержка ответа в отказе (выше).
2. **`--raw`, D340 часть 11 (пачка 27).** Он за то, чтобы оставить `--raw`,
   привычку `jq -R`, и убрать только `--json`. Ваших слов об удалении флагов
   ввода нет.
3. **Имя в позднем шаге, D256.** Второй аудит подряд за отказ.
4. **Замыкание, D281.** Шестой аудит подряд. Ваше слово против скрытого
   окружения в цитате стоит; захват при объявлении вписывает значения в
   текст цитаты и его не нарушает.
5. **Три корня, D257.** Он ставит их первыми. Ваше слово — «трудно
   подступиться».
6. **Вес процесса.** Седьмое состояние цели не считает журнал и процесс; он
   просит отрицательного диффа и для них.

## Что сделано без вашего слова

- В коде языка — ничего. Отчёт и строка `Runs.` записи D395, которую
  написал скрипт, перенесены из worktree в ветку; `.gitattributes` держит
  переводы строк `cli/src/bin.mjs`.
- Судьбы без записи перенесены в открытые записи своих осей, D257 и D295;
  открытой осталась одна, слова нескольких смыслов, до чтения
  пентименто-аудита.

## Судьбы находок

The problems, its third section:

1. The origin of a quote decides how it runs. Held code and the values of the reader open as D281, the closure by `fill` or by a capture at the declaration among its roads, the sixth audit in a row to propose it; a primitive read back from its print answering `::fn/RecipeMissingError` by [QSHST#source], a primitive running only beside the source a host handed it with; set aside.
2. One space of names. A value named as a verb met aloud per subject by [QSNAM#reach], within `map` as in any step; a bare name answering its quote as a later step open as D256, the eleventh voting for its refusal as the tenth did; the tag of a refusal moving with the verbs of the scope by [QSDSP#refusal]; set aside. A body under a label written without a tilde declares a node of data, `5 | :number/inc add 1 | number/inc` answering `6`, while the bare name is refused `::call/UnknownNameError` with `:nearest [:in]`, naming no node under a label that holds its last name: carried into D257, its check of the traps before a run.
3. The line break. A keyword that begins a line opening a declaration by [QSSYN#line], which the first page states beside the line break as a space; the road of a line break that is a space everywhere, declarations joined by `|` and a body of several steps in parentheses as `source` prints it, the line-sensitive productions leaving the grammar: carried into D295 as a road of its own.
4. Two fields of one record. The words of one subject by [QSNUM#combine]; a word that makes the first value it reads the subject of a verb and the rest its args, `of ~gt /a /b`, a road for the third of the roots D257 holds, a modifier computed from the subject alone: carried into D257 beside its three roots. The branches of `if` as code by [QSCND#branch], its refusal naming `~("yes")`; set aside.
5. The prose. Its register and the length of its sentences open as D391; a fact on several pages open as D339, its part 12; the page of a refusal of an input the call left out, which is the page of the input, `{:a 1} | put /b !| explain` reading “The value laid at the path.”, open as D339, its part 13; the page of the package in the same register with D391.
6. Gaps and words. A key of several parts, `groupBy ~(get [/a /b])` refused `::vec/groupBy/KeyKindNotTakenError`, a join of two inputs, a format of text, a `zip` with an arg and several inputs of the command line, asked by no task yet: carried into D257, keys of several parts, joins and formats. A write along a path that builds the maps it lacks, refused by [QSPTH#write]; `union` of a set of sets by [QSDSP#walk]; `has` by [QSPTH#has]; `distinct` beside `toSet` by [QSWRK#catalog]; `max` of two kinds by D388 and [QSCND#compare]; `laws` and `runLaws` by their pages; the aliases by D321 and [QSWRK#catalog]; set aside. A habit of jq, `.users`, and two queries written into one with `;`, which the children of D395 wrote, refused with `:expected` alone where the grammar names other habits [QSSYN#refusal]: carried into D295 with a road that names them.
7. The price. The start and the price of a step open as D257, its lazy boot and its price of a step, the eleventh holding that the mission asks for both; the depth of a recursion, refused between 450 and 500 levels, by its limit [QSNAM#verb]; set aside.
8. The print. A map of three entries or more on lines of its own by [QSPRN#print], a width of the print open as D295 beside its width of a chain; the alert of a runaway recursion, a thousand frames, carried out by D397, the alert within the budget keeping the first frames of its trail and an elision of the rest, `:number/down ~(if (gt 0) ~(sub 1 | down) ~(0)) | 2000 | down` printing `::elision{:size 997 :read ~(!| get /trace | drop 4)}`; a string answered as its text by [QSHST#answer]; set aside.
9. The weight. The repeated laws and refusals of the catalog open as D339, its part 12; the weight of the process the maintainer's, the seventh state of the aim.

Its order of the effort, the fourth section: the roots with D257; the line break with the third problem; a check of the traps before a run, diagnostics of the language server and `qlang --check` over `map (…)`, a branch of `if` written as a value, a name of a quote as a later step, a body under a label without a tilde, a value named as a verb and held code reading a name of its step, named by the tenth and the eleventh: carried into D257 as a check of the traps before a run; the start and the step with D257; the print with D397 and D295; the prose with D339 and D391; the gaps with the sixth problem.

Its proposals, the fifth section: each with the problem it repairs above; a print of a primitive that reads back, `::builtin{:of :number/add}`, set aside with the first problem; the strings of an answer printed as literals outside a terminal set aside with the eighth.

Its disagreements, the sixth: the lexical scope with D281; the three roots the maintainer's to rank, his word in D257; the start and the step with D257; a set aimed at the constructs set aside by [QSWRK#measure]; the bound past the budget the maintainer's road, carried out by D397, the answer past it refused with its head; a term of several senses, `held` at the door, held code and held to its kinds, and the words door, lane, flight and residence, to the distillation of the pentimento audit by [QSWRK#documents], held by no record: open; D333 agreed; D256 and D269 take its votes; D326 a vote for its fourth road, words that read the fields with paths reading the payload; D369 a vote for the strict road of its part 2; D340 part 11 a vote to keep `--raw`, the maintainer's word asked; the seventh state the maintainer's.
