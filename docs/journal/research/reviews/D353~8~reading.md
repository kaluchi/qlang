# Разбор ревью девятнадцатой пачки перед переносом базиса ветки what-a-chain-declares

Чтение модели, сессия 4234a75b, 2026-10-20. Отчёт — [D353~8.md](D353~8.md):
рецензент, которого сессия запустила над веткой пачки [D379] до переноса
базиса, на дереве eab08c06, 06:27–07:03 UTC, вердикт `changes asked`,
четырнадцать находок и заметка о том, что держится. Главные: примитив ядра
бежал на субъекте чужой метки через `apply` своей функции и через алиас,
инвариант субъекта выпал из `manifest`, команда читалась дважды и
отказывала, не называя объекта, закон и инвариант под тегами читались двумя
способами, а корень сторожил согласие двух написаний. Всё это ветка
починила или отнесла в открытую запись; правило каждого раздела, который
задели починки, вошло в переопределения D379.

Промпт, на который он отвечал:

```text
Ты рецензент ветки проекта qlang (язык запросов-конвейеров). Ветка `what-a-chain-declares` лежит в worktree `D:/git/qlang-worktrees/what-a-chain-declares`, её база — `master` (3ca7eee8). В основной копии `D:/git/qlang` ничего не трогай; в соседнем проекте `D:/git/eclipse-jdt-search` тоже ничего не меняй (только читай).

Что несёт ветка. Пачку 19 из записи `docs/journal/D353.md`: запись `docs/journal/D379.md` в транзите (главы `docs/spec/` ещё старые; их перепишет перенос базиса после ревью). D379 закрывает открытые D272, D274, D307 (теперь в `docs/journal/replaced/`) и части 4g, 8, 9, 10 записи D339 (подрезана) по дорогам консилиума `docs/journal/research/design-check/D339~2.md`. Решения:
(1) `impl` всегда отвечает функцией, которую строит: `::fn | impl ~(add 1)` — это `::fn[~() ~(add 1)]`; рецепт, написанный один под меткой, остаётся цитатой;
(2) `holds` пишет инвариант субъекта (`:subject/…`); `range` держит целое число так (`::number/range/subject/NotIntegerError`), проверка ушла из примитива;
(3) виды языка, значение которых пишет читатель, объявляют нагрузку: `::binding` (wraps ::map и reads пяти полей), `::explanation` (wraps ::map; его поля читают глаголы `page` и `value`, адреса полей заняты ими), `::law`, `::invariant`, `::link`, `::snippet` (wraps ::quote под любыми тегами);
(4) страница `::link` говорит правило стопки тегов;
(5) D272: читатель цепочки (`core/src/chain.mjs`) — одно чтение того, что берёт каждая команда, на обеих дорогах (глагол команды и литерал); глаголы команд (`::fn/takes` и другие, `::kind/wraps` и другие) отдают объекты ему, их входы без видов; отказ `::fn/CommandNotTakenError` / `::kind/CommandNotTakenError` держит команду как написана в `:actualValue`, страница отказа ссылается на страницы команд; `impl` отдаёт рецепт или конструктор конструктору (`RecipeNotCodeError` / `ConstructorNotBuiltinError` на обеих дорогах); имена, которые примитив читает как код (`runs`, `runsWithin`, `folds`, теперь одна таблица `inputsAsCode` в `core/src/primitives.mjs`), — входы функции, с которой его отдали, иначе дефект корня `::builtin/InputNotTakenError`; виды ключа как стоят (один список в `core/src/path-read.mjs`);
(6) D274: место входа — путь, читается строго; формы `~(query /n)`, `~(query /n d)` и `~(it)` читаются как написаны, их не достаёт глагол читателя с таким именем (раньше `~(it)` бежал кодом и глагол читателя `vec/it` его подменял); любая другая цитата — код над аргументами;
(7) D307: функция под меткой — глагол, каков бы ни был её рецепт; вызов по имени, по адресу или `apply` бежит рецепт или отказывает `::fn/RecipeMissingError`; `::builtin{}` бежит примитив, который хост отдал вместе с функцией, что его держит (`primitiveFor(descriptor, holder)` в `core/src/types.mjs`, держатели в `core/src/runtime/root.mjs`), так что `::builtin{}` читателя, прочитанный из печати или вставленный в свою функцию, ничего не бежит; конструктор хоста бежит внутри своего вида (и по адресу `construct`), а чужому виду ничего не конструирует (вид без отданного конструктора, как и раньше, кладёт тег: источники `::fn`, `::kind`, `::builtin` кладут свои теги до выдачи);
(8) командная строка: дефект ячейки пишется одним хелпером `cellText` в `cli/src/render.mjs` для `main` и REPL; тесты дефекта берут ячейку, вложенную глубже стека движка (прежний путь — примитив ядра в чужой функции — закрыт решением 7).

Как читать. Сначала целиком `docs/spec/QSWRK-the-work.md` и `docs/journal/AIM.md`, затем `docs/journal/D379.md`, подрезанную `docs/journal/D339.md` и `docs/journal/D329.md` (в ней поменялись ответы проб). Затем `git -C D:/git/qlang-worktrees/what-a-chain-declares diff master...HEAD` и каждый тронутый файл целиком (кроме больших страниц каталога `core/lib/qlang/fn.qlang` и `core/lib/qlang/kind.qlang` и файлов кейсов — там читай тронутые места). Каждое утверждение о поведении проверяй языком этого worktree: из его корня `node cli/src/bin.mjs '<запрос>' < /dev/null` (не глобальный `qlang`). Можно гонять `node scripts/check-conventions.mjs`, `node scripts/sensors/run-probes.mjs docs/journal/D379.md`, `npx vitest run <файл>` в `core/`, `cli/` и `lsp/`, `npm run check:fuzz`, `node scripts/benchmark.mjs check`. Файлы не меняй, ничего не коммить. Резку условий можно делать только на одноразовой копии во временном каталоге, которую потом удалишь.

Что проверять. Дифф против принципов AIM (одна модель, одно написание факта, язык описывает себя, всякое значение — литерал, который печатается и читается обратно, отказ в словах читателя, работа удаляет больше, чем добавляет) и правил QSWRK (кейсы показывают правило своего раздела, имя кейса — правило словами языка; каждое условие держится тестом, который без него падает; комментарий — одно предложение о том, что держится, со ссылкой; страницы каталога согласны с кодом; запись верна дереву целиком). Отдельно взвесь:
(a) D272: остались ли в каталоге, главах, коде, тестах, сервере языка и сестринском проекте чтения видов входов команд или отказов вида `::fn/<команда>/<вход>/KindNotTakenError`; говорят ли страницы входов команд, что каждая берёт; не стал ли отказ менее точным, чем был; что не так с одной таблицей `inputsAsCode` и проверкой корня;
(b) D307: дыры правила «примитив бежит в функции, с которой его отдали» (алиасы одного значения, `construct` по адресу, функция без команд из рецепта, разделённые описатели, хосты cli и jdt); что сломается у хостов;
(c) часть 9: порядок инвариантов субъекта, их отказ (какие факты), страницы и законы;
(d) часть 10: что пропустит и что зря отвергнет `::binding`; печать и чтение назад записи; `::explanation` без полей;
(e) D274: граница форм (что считается формой, что кодом), `~(it)` в `handedTo` и `refusalOfFailedModifier` в `core/src/eval.mjs`;
(f) командная строка: `cellText`, тесты на дефект от глубины стека (устойчивы ли), что потерялось;
(g) какие разделы глав перепишет перенос и что в них сейчас неверно; пробы глав и записей.

Ответ по-русски: вердикт (accepted или changes asked), затем находки, каждая с файлом и строкой, с принципом или правилом, которое она нарушает, и с пробой (запрос и ответ дерева). Без пересказа диффа, только находки, самые весомые первыми.
```

Судьбы, каждая с пробой на дереве после починки:

1. **Примитив бежал на субъекте чужой метки, и вопрос D307 оставался
   открытым.** Починено. Примитив бежит только на субъекте, который служит
   метка, под которой хост его отдал, сверх метки имени, что его зовёт:
   `handedFor` в `core/src/types.mjs` отдаёт эту метку, `callFunction` в
   `core/src/eval.mjs` проходит теги субъекта к ней. `apply` своей функции и
   алиас под широкой меткой отказывают под адресом вызова. Седьмое решение
   D379 говорит это. Кейс
   `a-primitive-runs-on-a-subject-the-label-it-was-handed-under-serves`
   (QSHST#source). Резка любой из двух клауз роняет этот кейс.
   `get [~({:a 1} | apply (::vec/first | binding | get /value) [] !| type) ~(:any/first2 (::vec/first | binding | get /value) | {:a 1} | first2 !| type) ~(:any/first2 (::vec/first | binding | get /value) | [4 5] | first2)]`
   → `[::fn/call/SubjectNotVecError ::any/first2/SubjectNotVecError 4]`.
2. **Отказ `range` о дробном счёте выпал из `manifest`, а его закон — из
   обхода.** Починено. Цепочка кладёт узел `subject` под глаголом, где его
   пишет `on` или под ним стоит имя (инвариант или страница), и `answer` так
   же (`nodesOfFunction`). Узел без своей страницы держит пустые доки, так что
   его запись — законный `::binding`. `range` пишет счёт через `on` со
   страницей. QSSLF#manifest не переопределяется: дерево ему снова верно.
   Кейс `the-subject-and-the-answer-lie-under-a-verb-with-no-page-of-their-own-where-a-name-stands-under-them`
   (QSBLD#fn); резка каждой клаузы, включая пустые доки, его роняет.
   - `::number/range | manifest` →
     `#[::number/range/CountTooLargeError ::number/range/SubjectNotNumberError ::number/range/answer ::number/range/subject]`.
   - `::number/range/subject/NotIntegerError | laws | keys` → `#[:refusesAFraction]`.
   - Обход манифестов рецензента → `[true true true]`.
3. **Команда читалась дважды: число объектов и null.** Починено. Глагол
   каждой команды берёт объекты целиком, `objects ~(it)`, и отдаёт их цепочке
   как написаны, null среди них. Глаголы `::fn` и `::kind` регистрирует один
   цикл по таблице команд цепочки (`FN_COMMAND_NAMES`, `KIND_COMMAND_NAMES`),
   `withCommand` с фильтром null ушёл. Кейс `answer.jsonl:14` теперь отвечает
   `[::fn/CommandNotTakenError 1]`, и D379 переопределяет [QSBLD#answer].
   `get [~(::fn | takes :by |~~ x ~~| !| type) ~(::fn[~(takes :by |~~ x ~~|) null] !| type) ~(::kind | wraps !| type) ~(::fn | takes :x |~~ x ~~| /0 null !| get /index) ~(::fn[~(takes :x |~~ x ~~| /0 null) null] !| get /index)]`
   → `[::fn/CommandNotTakenError ::fn/CommandNotTakenError ::kind/CommandNotTakenError 3 3]`.
4. **Отказ команды говорил меньше прежнего.** Починено. Отказ называет
   команду как написана (`:command`, его объявляет
   `carries :CommandNotTakenError/command` у `::fn` и `::kind`), место
   отвергнутого объекта от нуля или первого пропущенного (`:index`) и сам
   объект (`:actualValue`, у пропущенного его нет). Страница отказа говорит
   факты и где читать объекты каждой команды, `::fn/takes | doc`.
   `::fn | takes :x 5 /0 ::number !| get [~(type) /command /index /actualValue]`
   → `[::fn/CommandNotTakenError ~(takes :x 5 /0 ::number) 1 5]`.
   Отставлено в D379:
   - `:command` при кадре трассы, который его держит. На дороге литерала
     кадр держит весь литерал, и только `:command` называет команду; один
     отказ читается одинаково по любой дороге.
   - `:expected` не пишется: правила объектов не виды.
5. **Конструктор хоста работал вне своего вида.** Починено той же проверкой
   метки. Конструктор, отданный другим видом, ничего не строит, как говорят
   D379 и закон `constructsNothingByAConstructorOfAnotherKind`.
   `get [~(:vec/mk (::set/construct | binding | get /value) | [3 1 1] | mk !| type) ~(:B |~~ B. ~~| (::kind | impl (::set/construct | binding | get /value)) | ::B[3 1 1])]`
   → `[::vec/mk/SubjectNotSetError ::B[3 1 1]]`.
6. **Разделённый дескриптор: тексты говорили «runs its primitive».**
   Починено. Дефект `::builtin/PrimitiveNamesNoBuiltinError` говорит «which
   took it first». Страница `builtin.qlang` говорит: имя, держащее значение
   другого имени, бежит его примитив, а своя функция над тем же
   `::builtin{}` не бежит ничего. Комментарий корня и название теста в
   `session.test.mjs` говорят то же. Скрипт рецензента → `fn/RecipeMissingError`
   и `qlang root: the source t is handed a primitive for :any/hail, whose ::builtin{} is another name's, :any/greet, which took it first`.
7. **Тексты описывали закрытую дорогу.** Починено:
   - страница `ForeignValueError` (`builtin.qlang`): печать и кодек JSON
     поднимают его для значения без вида, которое хост отдаёт ячейке;
   - `call.qlang` говорит о примитиве хоста без «whatever function runs it»;
   - `core/README.md`: примитив бежит в функции или виде, с которыми его
     отдали, на субъекте их метки;
   - комментарий `print-value-extras.test.mjs` переписан.

   `rg -n "whatever function runs it|a function of the reader that answers|primitive of the core under no kind|whose primitive it runs" core cli lsp docs/spec`
   → пусто.
8. **`::law` и `::invariant` под тегами читались двумя способами.** Починено:
   их читатели (`isLaw`, `isInvariant` в `nouns.mjs`, закон в
   `manifest.mjs`) читают цитату сквозь теги, как читатели ссылки и сниппета.
   Теперь фраза D379 «wrap a quote beneath whatever tags it is given under»
   верна целиком. Кейсы
   `a-law-runs-the-query-beneath-the-tags-it-is-given-under` (QSSLF#laws) и
   `an-invariant-declared-by-a-name-is-refused-under-whatever-tags-its-condition-stands`
   (QSBLD#chain, которую D379 теперь переопределяет). Отставлено в D379: виды
   отказывают цитате под своим тегом, и одна нагрузка читается двумя способами.
   - `:three 3 | :three/x |~~ x ~~| ::law::Foo~(3 | eq 3) | get [~(::three | laws | count) ~(::three | runLaws | map /ok)]` → `[1 [true]]`.
   - `:Positive ::invariant::Foo~(gt 0) !| type` → `::bind/WrittenOutsideItsChainError`.
9. **`::explanation{}` проходил вид.** Починено: инвариант
   `::explanation/NotPageAndValueError`, `~(keys | eq #[:page :value])`.
   Кейс `an-explanation-a-reader-writes-is-the-map-of-a-page-and-a-value`
   (QSSLF#explain). `get [~(::explanation{} !| type) ~("x" | add 1 !| explain | type)]`
   → `[::explanation/NotPageAndValueError ::explanation]`.
10. **Проверка корня сторожила согласие двух написаний.** Принято наполовину.
    Проверка ушла вместе с дефектом `::builtin/InputNotTakenError`, его
    страницей и тестом. Это согласие хост сломать не может: ни одна дверь
    пакета не отдаёт метки. У ядра имена в метках держат законы каждого
    глагола, что бежит код: резка `runs(['alternatives']` у `coalesce` и
    `runs(['code']` у `update` на копии роняет «every law answers true».
    Второе написание имени входа в метке ядра остаётся, а дорога хоста к
    своему коду вошла в открытую [D293]: вопрос, альтернатива с ценой и проба
    `['readingState', 'registerStateReader', 'runs', 'runsWithin', 'folds']`
    → `0`. D379 говорит о метках ядра в пятом решении и отставляет проверку
    корня со ссылкой на D293. Проба QSERR:310 вернулась к ответу master, 12.
11. **Страницы входов команд были неточны.** Починено. Страница входа
    `:objects` каждого глагола команды говорит каждый объект в его порядке:
    набор видов — «a tag or a set of one tag or more»; имя поля и страницы
    вида — «none of `payload`, `construct` and the words of a literal»; имя
    входа — «neither `answer` nor `subject` … nor a word of a literal».
    Страницы `impl` говорят про null.
    `get [~(::fn/on/objects | doc | content | contains "one tag or more") ~(::kind/tells/objects | doc | content | contains "none of `payload`") ~(::fn/impl/recipe | doc | content | contains "null for a contract")]`
    → `[true true true]`.
12. **Мелкое.**
    - Комментарий `holds` в `fn.mjs` ушёл вместе с регистрацией по одной
      команде: один цикл и одно предложение над ним.
    - Лексикон велит писать `handedFor`, нынешнее имя в `types.mjs`.
    - Метки видов: `binding` — QSNAM#binding, `explanation` — QSSLF#explain,
      `law` — QSSLF#laws, `link` и `snippet` — QSSLF#doc; `invariant` уже
      держал QSBLD#fn.
    - Комментарий `main.test.mjs`: «A literal nested past the stack the parser
      reads it with raises a defect past the fail track».
    - Сквозной тест дефекта печати — без правки. Значение без вида до печати
      теперь доносит только хост. Его держит `render.test.mjs` через
      `cellText`, единственного писателя ячейки для `main` и REPL; сквозные
      тесты `main` и REPL держат того же писателя дефектом парсера.
13. **Знак диффа.** Починено слиянием кейсов одного правила:
    - вызов `impl` и команда после него;
    - отказ инварианта субъекта и его факты;
    - отказ команды по обеим дорогам;
    - конструктор не `::builtin{}` по `impl` и литералом, базовый
      `the-constructor-impl-gives-a-kind-is-the-hosts` назван в D379;
    - `::builtin{}` без своего хоста.

    Тест проверки корня ушёл вместе с ней. Замер после коммита починок
    записан ниже.
14. **Что перепишет перенос.** Принято. D379 переопределяет ещё
    [QSBLD#answer] (`returns` без видов) и [QSBLD#chain] (инвариант под
    тегами). Перенос перепишет 15 разделов: QSBLD#fn, #input, #answer,
    #kind, #label (тег контракта под меткой кладётся, потому что контракт —
    глагол), #chain; QSNAM#address, #binding; QSNUM#arithmetic;
    QSDSP#residence; QSSLF#doc, #explain, #laws; QSERR#site; QSHST#source.

Сверка с master всех текстов кейсов и каталога: 5010 текстов разобраны
одинаково. 31 запрос отвечает иначе, и каждый — кейс D379 или кейс master,
который D379 называет.

[D293]: ../../D293.md
[D379]: ../../D379.md
