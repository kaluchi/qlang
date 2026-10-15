# Разбор шестого внешнего аудита

Чтение модели, сессия d65e4c1d, 2026-10-13. Аудит —
[2026-10-13-cbaaeb2d.md](2026-10-13-cbaaeb2d.md): чистый Opus с тем же
промптом, на дереве cbaaeb2d — master после слияния the-path-is-a-value
(D248–D255 и правки ревью ветки). Каждое утверждение ниже проверено
запуском `qlang` на том же дереве.

## Что поменялось с пятым

Ушло: не воспроизводится и не названо снова.

- Скрытое замыкание цитаты-тела объявления: прежний запрос пятого
  аудита теперь отвечает `[true 6 6]`, а не `[true 30 6]` — D251 сделал
  цитату данными без области видимости.
- Роль определения по форме значения: слово и вид строятся цепочками
  (D251–D253), объявления по имени отказываются. Аудит называет только
  остаток — код, который читается по форме (3.2).

Названо снова:

- процесс тяжелее языка (3.8), шестой аудит подряд;
- словарь вызова (3.4): modifier, object, args, input — открытая D276;
- мосты из чужих слов (3.7): `size`, `slice`, `find`;
- одно написание: каталоги вектора, множества и карты втроём (3.8).

## Что он нашёл нового

Проверено пробами и, по-моему, верно:

- **Хранимая цитата читает имена там, где её запускают (3.1).**
  `[(:k 1 | :f ~(add k) | [5] | map ~(:k 100 | apply f)) (:f ~(add k) | :k 10 | 1 | apply f)]`
  отвечает `[[105] 11]`. Это прямое следствие D251: цитата, хранимая
  как данные, бежит “in the tree of names of the query, the scope of the
  reader's step its call began from”. Рецепт слова при этом изолирован:
  `:k 1 | :f ~(add k) | :vec/run (::fn | takes :q |~~ q ~~| /0 ::quote | impl ~(:k 100 | map q)) | [5] | run f`
  отвечает `[6]`. Фраза финиша аудита “a quote handed over sees the
  names of its author” была двусмысленной: “автор” в D251 — читатель,
  а не место, где цитату написали. Это самая глубокая находка: пятый
  аудит ругал скрытое замыкание, шестой — его отсутствие. Записано
  открытой D278, шрамом “The names a held quote reads” и поправленной
  фразой финиша.
- **Значение после объявления (3.3).** `[1] | :x it | 5` отвечает `5`:
  после объявления значение начинает новую голову (D248). Первая
  страница говорила только “A value written as a later step is
  refused” — теперь называет и голову после объявления.
- **Следы старых слов (3.4).** “form whose args” в `path.qlang` и
  “a form that combines” на странице глаголов; `~(get /age)` дважды в
  странице `sort`; страницы ключа и редьюсера во всех трёх каталогах
  (“The key is a quote or null” при входе `#[::null ::path ::quote]`);
  мёртвые сниппеты VS Code (`:name /`, `~(/field)`, `:Kind/construct`,
  `:any/f/part`); “projection” в TextMate и в узле парсера. Всё
  поправлено, узел `Projection` стал `Path`, как D248 назвал путь.
- **Шум трассы (3.6).** `{:price 4 :qty 3} | get /price | mul (get /qty) !| get /trail | map /step`
  отвечает `[~(get /qty) ~((get /qty)) ~(mul (get /qty))]`: кадр группы
  ничего не добавляет. `:skipped ~()` стоит в каждом кадре.
- **`:expected` обещан, но отсутствует (3.6).** У отказа с привычкой,
  `"[1 2 3] | 5" | parse !| keys`, поля нет. Страница
  `::quote/ParseError` теперь говорит, что `:message` называет привычку,
  а `:expected` стоит там, где её нет.
- **`manifest` (3.7).** `::vec | manifest` отвечает не только словами,
  но и отказами и ролями цепочки; первая страница говорила “the words
  of a kind” — поправлено.
- **Грамматики нет в шрамах (6).** Пятое условие аудита меряет
  грамматику, а шрама не было. Добавлен: формы комментариев и доков,
  отказы привычек продукциями, счётчики `docQuoteDepth` и
  `lookingAhead`.

## Где он ошибся или неточен

- **3.6, “`filter` индекс даёт”.** Ни `[1 2 3] | map ~(get /x) !| keys`,
  ни то же с `filter` индекса не несут: оба отвечают
  `#[:actualType :key :path :trail]`. Индекс есть у отказа самого
  `filter` на не-булево условие, `[1 2] | filter ~(1) !| keys`.
- **3.4, экраны бенчмарка “без пометки архива”.** Экраны — записи
  прогонов, по их хешу прогон сверяется с тем, что читал ребёнок (D26);
  переписывать их нельзя.
- **3.2, `withReadOfPath`.** Это подсказка в факте `:read`, она ничего
  не исполняет и смысла запроса не меняет.
- **3.2, `reduce`.** Одно слово против пары — разница реальная
  (`[1 2 3] | reduce 0 ~(add | it)` отказывает на `[0 1]`), но это ваш
  канонический вызов `reduce 0 ~(add)` (D233), а не случайная форма.

## Что просит вашего слова

1. **Имена хранимой цитаты (D278).** Варианты: как есть — имена читаются
   там, где цитата бежит; связывать их при объявлении, `fill` пишет их в
   голову, `:f ~(add k)` держит `~(:k 1 | add k)` — печать показывает,
   `eq` сравнивает (это предложение аудита, 5); отказ при объявлении
   цитаты с несвязанным именем. Я за второе: оно закрывает обе жалобы
   сразу, скрытое замыкание пятого и динамику шестого, и цитата остаётся
   данными, которые видны целиком.
2. **Код по форме одним правилом (3.2, 6).** Аудитор видит один шаблон в
   `reduce`, местах `query`/`it` (D274), неудачном модификаторе и
   `:read` и просит одно правило. `reduce` по паре всегда — против вашего
   `reduce 0 ~(add)`; места — второй вариант D274 (умолчание отдельным
   объектом `takes`).
3. **Имена отказов из видов (3.5).** Добавишь вид ко входу — тег отказа
   меняется (`NotNullOrQuoteError` → `NotNullOrPathOrQuoteError`). Варианты:
   как есть (D180, D251); по роли, `…/key/KindError` с фактом `:expected`.
4. **Трасса (3.6).** Схлопнуть кадр группы, не печатать пустой
   `:skipped`, класть `:index` в отказы поэлементных слов.
5. **Мосты (3.7).** `size`/`length` → `count`, `slice` → `drop | take`,
   `find` → `filter | first` через `:nearest`; третий аудит подряд.
6. **Каталог втроём (3.8, 6).** Вектор, множество и карта — 4323 строки;
   множество — вектор под тегом. Наследовать страницы и законы вектора, а
   седьмое условие — считать ли каталог.
7. **Процесс (3.8, 6).** Аудитор за меньше записей и больше замеров меры
   “с первой попытки”. Замер был сегодня (D270), но в последних сорока
   коммитах он один.

## Что сделано без вашего слова

- Скрипт аудита `scripts/outside-audit.mjs` и запись D277: одна команда,
  отчёт сам ложится под датой и деревом.
- Страницы: форма и args, путь в ключе и редьюсере во всех трёх
  каталогах, первая страница (голова после объявления, `manifest`),
  страница `::quote/ParseError`.
- Сниппеты VS Code и TextMate; узел парсера `Projection` → `Path`.
- Аудит: шрамы “The names a held quote reads” (D278) и “The grammar”,
  фраза финиша о цитате.

## Судьбы находок

The problems, its third section:

1. Code held as data reads its names where it runs, `:k 1 | :f ~(add k) | [5] | map ~(:k 100 | apply f)` answering `[105]`. Open as D278; the audit's finish names whose names a handed quote reads and asks where, and a scar of its own holds the probe.
2. Code read by its form: the one word of `reduce`, the places `~(query /n d)` and `~(it)`, the failed object an input of code refuses, the read a refusal names. The places are open as D274; `reduce 0 ~(add)` stands as the maintainer's canonical call (D233); the failed object stands by D129; the read is a hint the refusal carries, which runs nothing.
3. Exceptions to a step as a command. A value after a declaration: answered, the first page names the head after a declaration. The line breaks around a declaration: told by the page of the pipeline since 68255c84. The grammar's counters: a scar of the audit's. A quote of a doc that does not read as code stays prose by D19, the pages of the catalog held by the test `no quote of a page is read as prose`.
4. Traces of older paradigms. The form and the args on the pages of `path` and of the verbs: answered. The projection: answered, the parser's node of a path named `Path` and the editor's grammar saying path. The pages of a key and of a reducer that left out the path: answered across the catalogs of a vector, a set and a map. The editor's snippets: answered. The vocabulary of a call: open as D276. The screens of the benchmark stand as the runs read them.
5. The names of refusals made from the kinds an input takes, a public name that moves with a signature. Open as D287.
6. Noise and gaps in the errors. The page of `::quote/ParseError` says where `:expected` stands: answered. The stop of a group, the empty `:skipped`, the `:index` of a failure in `map` and a hint that reads one example: open.
7. Discoverability. The first page says what `manifest` answers, the words of a kind, its refusals and the roles of its chain: answered. Words of other languages: open since 3495de5d. The reads of a key by a keyword or a string stand by D139 and D248.
8. Complexity: the catalogs of a vector, a set and a map written thrice, the register of the prose, the process. Open.

Its proposals, the fifth section, are open but for the snippets and the promise of `:expected`, answered. Its disagreements, the sixth: the scope is D278 and a scar; the grammar a scar; the consumers answered where it named them; the pattern of code read by its form, the catalog the seventh condition leaves out, the priorities and the process are the reading's questions to the maintainer.
