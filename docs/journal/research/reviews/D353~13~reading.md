# Разбор ревью двадцать четвёртой пачки перед переносом базиса ветки refusals-named-by-their-holder

Чтение модели, сессия 4234a75b, 2026-10-20 и 2026-10-21. Отчёт — [D353~13.md](D353~13.md):
рецензент, которого сессия запустила над веткой пачки [D389] до переноса
базиса, на дереве c55c3e2f, 19:40–20:24 UTC. Вердикт `changes asked`,
двенадцать находок и поправка к четвёртой. Все двенадцать подтвердились
пробами. Правило было доведено не по всему дереву. В ядре остался
сборщик имени из списка видов. Проверка пропускала метку адреса под любой
ролью и список видов с другим союзом. Хук сессии, которого мейнтейнер не
просил, снят вместе с его записью D390, а проверка осталась в
`check:conventions`, среди линтов гейта. Исключение дефектов списком
фабрик после слов мейнтейнера убрано: правило держится для каждого адреса.

Промпт, на который он отвечал:

```text
Ты рецензент ветки проекта qlang (язык запросов-конвейеров). Ветка `refusals-named-by-their-holder` вытащена в основную копию `D:/git/qlang` (там она сейчас и стоит), её база — `master` (aa7019da, он же последний перенос базиса). В основной копии НИЧЕГО не меняй, не переключай ветки и не коммить; в соседнем проекте `D:/git/eclipse-jdt-search` тоже ничего не меняй (только читай). Резку условий делай только на одноразовой копии во временном каталоге вне репозитория (`tar` дерева без `.git` и `node_modules`, но с `docs/` и `scripts/`, плюс junction на `D:/git/qlang/node_modules`), которую потом удалишь, сняв junction через `cmd //c rmdir` до `rm -rf`.

Что несёт ветка. Пачку 24 из записи `docs/journal/D353.md`, по слову мейнтейнера в диалоге (его слова — в `Source.` записей): две записи в транзите (главы `docs/spec/` ещё старые; их перепишет перенос базиса после ревью).
(1) `docs/journal/D389.md` (Language). Отказ публичен: его адрес сравнивают ловушки, законы и страницы. Вид в последнем имени отказа после `Not` допустим только там, где его называет и адрес: метка, на которой живёт субъект (`number/add/SubjectNotNumberError`), или вид, который читает преобразование (`string/toNumber/TextNotNumberError`). Остальные отказы вида называются ролью держателя, а виды едут фактом `:expected`, как D287 назвала держателей цепочки. Переименованы отказы, которые называли примитивы: элементы свёрток `sum`, `avg`, `join`, `union`/`minus`/`inter` над вектором и `zip` → `…/ElementKindNotTakenError`; условия `filter`, `every`, `any`, `allOf`, `anyOf`, `cond` → `…/ConditionKindNotTakenError`; якорь `doc` → `any/doc/anchor/ElementKindNotTakenError`; строка `table` → `vec/table/RowKindNotTakenError`; субъект `out` и `err` → `…/SubjectKindNotTakenError`; конструктор вида → `kind/ConstructorKindNotTakenError`; `construct/TagNotKindError` → `construct/TagNamesAValueError`. Факт `:expected` добавлен в каждом месте подъёма (`core/src/runtime/sequence.mjs`, `setops.mjs`, `control.mjs`, `axis.mjs`, `kind.mjs`, `cli/src/table.mjs`, `cli/src/streams.mjs`); `kindsExpected` экспортирован корнем ядра. Проверка (20) в `scripts/check-conventions.mjs` с чистой функцией `scripts/refusal-kinds.mjs` отказывает отказу, объявленному в коде (`declareRefusal`) или страницей каталога (`throws`), чьё последнее имя называет после `Not` существительное каталога, которого не называет адрес; дефекты `::builtin` вне правила. Старые имена ушли в лексикон отставленных слов `scripts/retired-words.mjs`. D329 обрезана: часть об именах отказов элемента ушла в D389.
(2) `docs/journal/D390.md` (Tooling). Хук в `.claude/settings.json` (PreToolUse на Bash|PowerShell, `scripts/commit-hook.mjs --run`) перед `git commit` сессии запускает `check:conventions` и отказывает вызову с находками (код 2), чтобы нарушение правила входило в разговор там, где сделано. Тест — `core/test/unit/commit-hook.test.mjs`.

Как читать. Сначала целиком `docs/spec/QSWRK-the-work.md` и `docs/journal/AIM.md`, затем D389, D390, `docs/journal/replaced/D287.md`, тронутые места D329 и строку пачки 24 в D353. Затем `git -C D:/git/qlang diff master...HEAD` и каждый тронутый файл кода и скриптов целиком (страницы каталога и файлы кейсов — в тронутых местах), и главы разделов, которые D389 и D390 переопределяют. Каждое утверждение о поведении проверяй языком этой копии: из корня `D:/git/qlang` — `node cli/src/bin.mjs '<запрос>' < /dev/null` (запрос, начинающийся с `/`, Git Bash читает как путь). Можно гонять `node scripts/check-conventions.mjs`, `node scripts/sensors/run-probes.mjs <документы>`, `npx vitest run <файл>` в `core/`, `cli/` и `lsp/`, `npm run check:fuzz`, `node scripts/benchmark.mjs check`, `node scripts/measure.mjs`. Искать — `rg` или `git grep`.

Что проверять. Дифф против принципов AIM (одна модель, одно написание факта, язык описывает себя, отказ в словах читателя, работа удаляет больше, чем добавляет) и правил QSWRK (кейсы показывают правило своего раздела, имя кейса — правило словами языка; каждое условие держится тестом, который без него падает; комментарий — одно предложение о том, что держится, со ссылкой; доля комментариев падает; страницы каталога согласны с кодом; запись верна дереву целиком). Отдельно взвесь:
(a) Полноту и точность правила. Остались ли отказы, чьё имя несёт закрытый список видов или вид, не связанный с адресом, и которые проверка пропускает: в коде, каталоге, командной строке, сервере языка? Не ловит ли проверка лишнее? Верно ли, что вид в адресе стабилен (`any/tag/PairTagNotTagError` проходит, потому что адрес называет `tag`, — честно ли это или совпадение)? Верно ли чтение `throws` каталога построчно: объявление с колонки 0, многострочные объявления, отказы под путём входа (`throws :anchor/…`)? Исключение `::builtin` — принципиальная граница или дыра?
(b) Факт `:expected`: есть ли он у каждого переименованного отказа, верны ли виды в каждом месте (например, элемент набора якорей `doc` берёт ключевое слово, null и вектор), порядок фактов, страницы `throws` — говорят ли они о `:expected`, где нужно.
(c) Хук: верно ли распознаётся коммит (варианты `git commit`, `git -C`, `git -c`, сложные командные строки, `commit-tree`, `log --grep`), раскрывается ли `$CLAUDE_PROJECT_DIR` в оболочке хука на Windows, что будет в worktree (`.claude/worktrees`), при коммите в соседнем проекте, при падении `check:conventions` по чужой причине, при таймауте; не мешает ли хук работе (цена 3 с на коммит), и верна ли граница D390 (Tooling) против QSWRK#tooling.
(d) Записи: верны ли D389 и D390 дереву целиком; полон ли Overrides (все разделы, кейсы которых ветка тронула, и те, чьи предложения теперь неверны); названы ли переименованные кейсы базиса; верна ли обрезка D329 и строки `Replaces in part`/`Pruned of what`; цитаты мейнтейнера.
(e) Что перенос базиса перепишет в главах: какие предложения глав и страниц каталога теперь неверны (старые имена, «names the refusal by hand» и подобное), включая `CLAUDE.md`, который перечисляет, что держат соглашения.
(f) Сестринский проект jdt: читает ли он переименованные адреса.

Ответ по-русски: вердикт (accepted или changes asked), затем находки, каждая с файлом и строкой, с принципом или правилом, которое она нарушает, и с пробой (запрос и ответ дерева или команда и её вывод). Без пересказа диффа, только находки, самые весомые первыми.
```

Судьбы, каждая с пробой на дереве после починки, 9f2a6111:

1. **Правило не доведено по всему дереву.** Подтвердилось. Запись в транзите
   [D389]: ответ кода `replace`, тег пары `tag`, рецепт `fn` и `fill`,
   элемент `doc` и `toPath` названы по роли держателя с `:expected`. Рецепт
   `fill` отказывается как часть субъекта, `/1`, и потому ушёл из кейса
   отказов, держащих вид одного субъекта. `quote/ElementNotStepError` и
   `…/StepNotCommandError` оставлены: шаг читается по форме, а не по виду, и
   из двух цитат одна принимается, другая отказывается.
   ```qlang
   > get [~("a" | replace #"a" ~(1) !| get [~(type) /expected]) ~([:foo 1] | tag !| get [~(type) /expected]) ~(::fn[~() 5] !| get [~(type) /expected]) ~([1] | tag ::doc !| get [~(type) /expected]) ~([:a true] | toPath !| get [~(type) /expected])]
   [[::string/replace/with/AnswerKindNotTakenError #[::string]] [::any/tag/PairTagKindNotTakenError #[::tag]] [::fn/RecipeKindNotTakenError #[::builtin ::null ::quote]] [::doc/ElementKindNotTakenError #[::quote ::string]] [::vec/toPath/ElementKindNotTakenError #[::keyword ::number ::string]]]

   > get [~([~(get /a)] | tag ::quote | type) ~(get [1 ~("/name" | parse)] | tag ::quote !| type)]
   [::quote ::quote/ElementNotStepError]
   ```

2. **Сборщик имени из видов в ядре.** Подтвердилось и починено:
   `subjectRefusalAddress` берёт одну метку, `kindsWord` с `join('Or')` ушёл.
   ```sh
   $ git grep -h "subjectRefusalAddress = " -- core/src
   export const subjectRefusalAddress = (address, labelName) => `${address}/SubjectNot${capitalOf(labelName)}Error`;
   ```

3. **Проверка (20) пропускала имена, против которых написана.** Подтвердилось.
   Правило теперь смотрит на роль: вид после `Not` разрешён только как
   метка субъекта после `SubjectNot` и как вид преобразования `to<Kind>`.
   Место после `NotIn` вида не называет. Множественное число, артикль и
   любой союз читаются одинаково. Каждое условие держится тестом, все
   двенадцать резок на копии роняют свой тест. Имя без `Not`,
   `ElementNumberExpectedError`, оставлено ревью: имена дерева говорят, чем
   значение не является, после `Not`.
   ```sh
   $ node -e "import('./scripts/refusal-kinds.mjs').then(m=>console.log(JSON.stringify(m.kindsNamedOffTheirAddress(['vec/zip/ElementNotVecError','vec/sum/ElementNotNumbersError','vec/join/ElementNotStringNorKeywordError','vec/sum/ElementNotANumberError','vec/sum/ElementNumberExpectedError','number/add/SubjectNotNumberError','path/KeyNotInMapError'].map(address=>({address})), new Set(['vec','number','string','keyword','map'])).map(r=>r.address))))"
   ["vec/zip/ElementNotVecError","vec/sum/ElementNotNumbersError","vec/join/ElementNotStringNorKeywordError","vec/sum/ElementNotANumberError"]
   ```

4. **Хук.** Снят по словам мейнтейнера: «а зачем прям хук для клода? … я
   вроде так не просил прям», «оно ведь будет медленно я полагаю», «просто
   в процессе всех запуском литов и конфомансов что б быа проверка».
   Скрипт, его тест и запись D390 удалены, настройки равны master.
   Поправка рецензента к этой находке теперь вопроса не имеет.
   ```sh
   $ git diff --quiet master HEAD -- .claude/settings.json && echo same
   same
   ```

5. **Код цитирует разделы вместо записи в транзите.** Подтвердилось. Блоки,
   тронутые работой записи, цитируют [D389]. Перенос вернёт им разделы.
   ```sh
   $ node scripts/marks.mjs D389 | grep -c "^core/src"
   20
   ```

6. **Сид `core/README.md`.** Подтвердилось и починено: отказ хоста назван по
   роли с `:expected` через `kindsExpected`. Старый адрес записан в лексикон.
   ```sh
   $ grep -c "SubjectKindNotTakenError" core/README.md
   1
   ```

7. **Обрезка D329 удалила цитату мейнтейнера.** Подтвердилось и починено:
   цитата и ссылка на D342 возвращены. Вопрос про `on` задан один раз и
   несёт находку 11: виды элемента код пишет дважды.
   ```sh
   $ grep -c "рецепт агент" docs/journal/D329.md
   1

   $ grep -c 'whether `on` writes' docs/journal/D329.md
   1
   ```

8. **Один адрес на два держателя.** Подтвердилось. Имя, читаемое по очереди,
   стало `any/doc/anchor/NameKindNotTakenError` с индексом в своём векторе.
   Элемент набора якорей остался `…/ElementKindNotTakenError` с индексом в
   наборе. Страница, законы и кейсы дают обоим их виды.
   ```qlang
   > get [~(::vec | doc [:take 1] !| get [~(type) /index /expected]) ~(::vec | doc #[[:take 1]] !| get [~(type) /index /expected]) ~(::vec | doc #[:take 5] !| get [~(type) /index /expected])]
   [[::any/doc/anchor/NameKindNotTakenError 1 #[::keyword]] [::any/doc/anchor/NameKindNotTakenError 1 #[::keyword]] [::any/doc/anchor/ElementKindNotTakenError 0 #[::keyword ::null ::vec]]]
   ```

9. **Второе чтение проверки (20).** Подтвердилось и починено.
   - Код проверка читает тем же разбором фабрик, что (2), один раз на обе.
   - Каталог читает парсером, `throws` и `holds` в цепочке и в цитате
     литерала; доки и законы не читает.
   - Виды берёт из деклараций каталога, тем же чтением, что (18).
   - Исключение дефектов списком фабрик после слов мейнтейнера «когда я
     вижу подобное const UNCAUGHT = … мне хочется рыгать» убрано.
   - Правило держится для каждого адреса: дефект `builtin/AddressNotStringError`
     стал `builtin/AddressKindNotTakenError`, инварианты точки и отрезка
     названы ролями своих чисел.
   ```qlang
   > get [~(::point[0.5 1 1] !| type) ~(::span[0 1 1] !| type)]
   [::point/PayloadNotOffsetLineAndColumnError ::span/PayloadNotStartAndEndError]
   ```

10. **Overrides без QSWRK#tooling.** Подтвердилось: D389 переопределяет
    QSWRK#tooling и QSHST#source вместе с остальными разделами, чьи кейсы и
    предложения тронула ветка. Перенос пишет проверку (20) в QSWRK#tooling и
    в сид `CLAUDE.md`.

11. **Знак диффа.** Подтвердилось отчасти. Ядро +11, тесты +60, скрипты
    +119: по одному факту `:expected` на каждый подъём, проверка и её
    тесты. Корень лишнего — виды, которые код пишет дважды, в тесте и в
    `:expected`. Этот вопрос стоит рядом с вопросом `on` в открытой записи
    [D329].

12. **Законы написаны двумя способами.** Подтвердилось и починено: первый
    закон каждого переименованного отказа показывает `:expected`, как
    законы командной строки.
    ```sh
    $ git grep -c "/expected\]" -- core/lib/qlang/vec.qlang core/lib/qlang/map.qlang core/lib/qlang/any.qlang
    core/lib/qlang/any.qlang:6
    core/lib/qlang/map.qlang:7
    core/lib/qlang/vec.qlang:15
    ```

**(e)** Список разделов, которые перепишет перенос, принят в Overrides D389,
QSHST#source и QSWRK#tooling среди них. **(f)** Сестринский проект не
читает ни одного переименованного адреса, новых тоже; поиск старых имён по
`D:/git/eclipse-jdt-search` пуст.

[D389]: ../../replaced/D389.md
[D329]: ../../D329.md
