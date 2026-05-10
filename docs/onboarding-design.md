# Дизайн-линия: qlang под нагрузкой онбординга

Магистраль обсуждения. Инварианты, требования финиша, открытые
вопросы. Любая ветка обсуждения сверяется отсюда.

---

## 0. Причина

qlang существовал как pipeline-язык трансформации данных.
Появилась вторая нагрузка — **онбординг**: pipeline должен
предоставлять информацию о самом языке (docs, source, contracts,
examples, cross-references). Эта информация не выводится из
аргументов operand'а и его AST — она пришла из исходного текста
.qlang-файла.

---

## 1. Точка старта

### 1.1 Архитектура

- **1.1.1** Variant-B каталог: `core/lib/qlang/core.qlang` —
  descriptor-Map'ы с `:qlang/kind :builtin` +
  `:qlang/impl :qlang/prim/<name>`.
- **1.1.2** `PRIMITIVE_REGISTRY`: bind → resolve → seal на
  bootstrap.
- **1.1.3** Двухфазный eval: peggy parse полностью → post-pass
  декорация (`attachAstParents`, `assignAstNodeIds`,
  `decorateAstWithEffectMarkers`) → async tree-walker.
- **1.1.4** env иммутабелен по ссылке (`envSet` → new Map).
  Eval strict left-to-right, без backtracking.
- **1.1.5** Четыре комбинатора `|`, `*`, `>>`, `!|`. Track-
  dispatch на success/fail плоскостях.
- **1.1.6** Forks с discarded inner.env в `(...)`, `[...]`,
  `{...}`, `#{...}`, `!{...}`, `*` distribute.
- **1.1.7** Conduit lexical scope через envRef tie-the-knot
  (закрытие env на момент `let`-eval'а, не call-site).
- **1.1.8** Per-site error classes — шесть фабрик в
  `operand-errors.mjs`. Каждый throw-site — свой класс.
- **1.1.9** Error value frozen, trail — frozen linked list
  (`_trailHead`); материализация в `!|` через append.
- **1.1.10** Сериализация: `printValue` (qlang rich,
  round-trip через грамматику), `toTaggedJSON / fromTaggedJSON`
  (lossless cross-process), `toPlain` / `json` (lossy plain
  JSON).
- **1.1.11** Doc-комменты на AST: `entry.docs` через
  `MapEntryDocPrefix`; `step.docs` через
  `DocAttachedSequence`; standalone identity-step как
  `LineDocComment`/`BlockDocComment`. `foldEntryDocs`
  материализует MapEntry-docs в value-Map под `:docs` Vec
  строк.
- **1.1.12** env — `Map<string, value>`. Один неймспейс
  ключей-строк, без отдельных хранилищ для разных kind'ов
  binding'а. Поведение binding'а определяется значением через
  `:qlang/kind`-дискриминатор (`applyBindingDescriptor`).
  Соглашения по именам (`qlang/locator`, `qlang/<ns>`,
  `qlang/ast/<uri>`) — namespacing через name-prefix.
- **1.1.13** Snapshot и Function — **env-биндинги**, не
  grammatical literal в pipeValue: identifier-lookup и
  projection делают auto-unwrap для Snapshot; Function
  живёт внутри descriptor'а builtin'а под `:qlang/impl` и
  наружу не попадает в нормальной работе. Conduit в
  pipeValue появляется через **expression-form** (β по
  3.2.4): operand `fn([:p], body)` строит Conduit-value
  с envRef = current env (lexical capture at eval-time).
  Runtime-shape — frozen Map с `:qlang/kind :Conduit`,
  `:params`, `:ast`, `:text`, `:envRef`. envRef
  session-зависим, в literal-форме отсутствует.

### 1.2 Действующие нарушения литеральной универсальности

| Симптом | Текущая форма | Где |
|---|---|---|
| Function в descriptor под `:qlang/impl` | `<function:name arity=N>` | printValue |
| Conduit в Map-value | `let(:n, body)` (let — step, не value) | printValue |
| AST-Map в trail/fault | многострочный Map-литерал | printValue |
| Doc-комменты в descriptor | escape'нутые строки в `:docs` | foldEntryDocs |
| Module AST после eval | отбрасывается | runtime/index.mjs |
| `:examples` snippets | string-литералы кода | core.qlang |
| Keyword'ы без axis'ов | dangling pointers | runtime |
| Auto-lift JSON в qlang Map | `parseJson` / CLI script-mode auto-detect → qlang Map с keyword keys; output не JSON, JSON-purity транзитивность (3.2.6) сломана, `jq`-replacement use-case не работает | runtime/format.mjs `fromPlain`, cli script-mode |
| Quoted keyword form | `:"foo bar"`, `:""`, `:"$ref"`, `:"123"` для поддержки произвольных JSON-keys; pollute keyword grammar edge-cases которые нужны были только ради JSON-key конверсии | grammar.peggy `QuotedKeywordName` |

### 1.3 Backtick

Единственный синтаксический символ, не используемый текущей
грамматикой. Свободен под новое value-правило.

---

## 2. Финиш

### 2.1 Литеральная универсальность — базовая теорема

Каждый value-class, который может появляться в pipeValue,
имеет **грамматический литерал**. Для любого вычисленного
значения V выполняется:

```
parse(printValue(V)) → AST → eval → V'   ⟺   V ≡ V'
```

по содержимому (не по object identity). Round-trip
тождественен.

Snapshot и Function — **env-биндинги**, не value-class в
pipeValue (см. 1.1.13). Теорема к ним не применяется: они в
pipeValue в нормальной работе не попадают, грамматический
литерал избыточен.

### 2.2 Таблица литералов

| Value-class | Грамматический литерал |
|---|---|
| `null` / `bool` / `number` / `string` | `null` / `true \| false` / `42` / `"text"` |
| `Vec` | `[el1 el2 ...]` |
| `Map` | `{:k1 v1 :k2 v2 ...}` |
| `Set` | `#{el1 el2 ...}` |
| `Error` | `!{:k1 v1 ...}` |
| `Keyword` | `:foo` / `:"text"` / `:ns/name` |
| `Quote` (parsed code as value) | `` `body` `` (backtick-литерал, α). Внутри backtick'а — валидный qlang (3.2.7) |
| `Conduit` (parametric quoted body) | `::conduit[:self?, [:p1 :p2], `body`]` — tagged literal (α по 3.2.4). Self-name optional, обязателен для recursive (local tie-the-knot). Body — Quote-литерал с frozen AST. См. §3.8 |
| `Doc` (структурированный документ-value) | `\|~~ text ~~\|` в expression-position |
| `Comment` (plain-комментарий-value) | `\|~ text ~\|` в expression-position |

Trail-элементы и `:fault/step` — Quote-value'ы (frozen
parsed code, производные от `parse` или от deflect'а в
success-track combinator'е). Литерал — backtick. AST-узлы
не отдельный value-class — они **внутри** Quote'а как frozen
content, наружу всегда выходят как Quote.

### 2.3 Рефлексия как axis-операнды

Доступ к metadata из pipeline'а через `:keyword | <axis>`
(value-level binding) или `::tag | <axis>` (type-level binding):
`source`, `docs`, `seeAlso`, `describe`, `spec`, `examples`,
`reify`. Каждый axis читает **module AST в env** под
`qlang/ast/<uri>` и descriptor-Map в env. Stateless по env
(не пишут). Token-density минимальна: `::duration | docs` —
4 токена, model-friendly cost для metadata navigation.

### 2.4 Spec внутри qlang

Документация — внутри .qlang модулей. Двухуровневая структура:

- **Краткое описание binding'а** (1-3 предложения) — на AST
  через `DocAttachedSequence` (doc-prefix перед `def`/`as`-step,
  §3.6.4). Никаких полей в value, только узлы AST.
- **Длинные гайды** — отдельные модули
  `qlang/guides/<topic>.qlang`. Каждый гайд — Doc-value под
  именем (`:guide-error-handling`, `:guide-onboarding`).
  Доступ — `:guide-name | guide` axis.

Cross-reference между keyword'ами — через keyword внутри
Doc-content прозы (`|~~ See :error-handling for context ~~|`),
rich-парсинг doc-content'а собирает refs в seeAlso.

Имя binding'а — anchor; spec / docs / examples / source /
implementation — рефлексивные projections с этого anchor'а.

### 2.5 JSON-bridge

JSON ⊂ qlang грамматически. JSON-литерал на входе — валидный
qlang без отдельной обработки.

**JSON-purity транзитивна.** Pipeline сохраняет JSON-форму
если все промежуточные value'ы рекурсивно JSON-compatible
(`null` / `bool` / `number` / `string` / Vec из них / Map с
string-key'ами и JSON-compatible value'ами). На таком pipeValue
`printValue` даёт **JSON-форму** (с запятыми, double-quoted
keys). qlang-only-лифт (Keyword-as-value, Set, Error, Quote,
Conduit, Doc, Comment, AST-узлы) в любом узле дерева
переключает вывод в qlang-rich форму.

Формат выхода — **выводится из содержимого**, не выбирается
глобальным флагом. JSON-вход без явного лифта → JSON-выход.
Эмбеддер получает rich qlang-литералы (`:docs`, `:throws`,
hypertext keyword refs, и т.д.) только когда сам сделал лифт
явным operand'ом (`keyword` для String→Keyword, `set` для
Vec→Set, `error` для Map→Error, backtick-литерал для Quote)
или потребил рефлексивный operand, возвращающий qlang-only
структуру (`reify`, `manifest`, `:keyword | docs`).

Дополнительные сериализаторы для cross-process:

- `toTaggedJSON` — lossless tagged JSON (включая qlang-only
  через `$keyword`/`$set`/`$error`-теги), для qlang-aware
  peer'а;
- `toPlain` — plain JSON, lossy для qlang-only типов.

### 2.6 Rendering ошибок

Errors — first-class data. printValue rich. `:fault/step` —
Quote-value (frozen failed step), `:trail` — Vec Quote-value'ей
(deflected steps). Никаких AST-Map'ов в errors — только
Quote-литералы (backtick одной строкой). Модель видит
copy-pasteable code, не сериализованное Map-дерево.

---

## 3. Инварианты

### 3.1 Семантика

- **3.1.1** env иммутабелен по ссылке.
- **3.1.2** Eval strict left-to-right, без backtracking, без
  re-eval AST-узла.
- **3.1.3** Литералы не имеют побочных эффектов на env.
  Запрещены мутирующие vocabulary/index/registry структуры,
  наполняемые при evalKeyword или другом литерал-eval.
- **3.1.4** Lexical scope: Conduit / captured-arg lambda
  захватывают env на момент объявления.
- **3.1.5** Forks: env-write локально, не вытекает наружу.
- **3.1.6** Effect-markers: parse-time scan тела `let` ловит
  effect laundering.
- **3.1.7** Per-site error class: один throw-site — один
  класс.
- **3.1.8** Error value и trail иммутабельны после
  конструирования.
- **3.1.9** env — `Map<string, value>`; семантика binding'а
  определяется значением через `:qlang/kind`-дискриминатор,
  env собственной типовой структуры не имеет.
- **3.1.10** Documentation payload **не embedd'ится** в
  value-Map binding'а. Источник docs — `module AST` в env под
  `qlang/ast/<uri>`. Доступ — рефлексивный axis-operand
  (`:keyword | docs`). Embedding под ключи `:doc`/`:examples`
  внутри descriptor'а ломает structural equality (см.
  Clojure `with-meta` carve-out), раздувает tagged JSON,
  делает printValue двусмысленным. Параллель к 3.1.3 на
  другой оси (literal-eval vs binding-storage).

### 3.2 Грамматика и литералы

- **3.2.1** JSON ⊂ qlang. JSON-литерал — валидный qlang.
- **3.2.2** Один режим грамматики, без флагов.
- **3.2.3** Каждый value-class в pipeValue имеет
  грамматическое правило литерала. Без грамматического
  правила нет литерала.
- **3.2.4** `printValue(V)` — строгое обратное парсингу:
  `parse(printValue(V))` даёт AST, eval которого
  восстанавливает V по содержимому. Два допустимых случая:
  - **(α) strict grammatical literal** — собственный
    AST-узел (`NumberLit`, `VecLit`, `MapLit`, `QuoteLit`,
    …), eval тривиально возвращает value через
    `eval*Lit`-handler без operand-invocation.
  - **(β) round-trip-able expression-form** — `OperandCall`
    AST-узел, eval invocate operand, результат тождественен
    V. Operand должен быть в env при eval (session-зависимая
    часть, допустимая по §2.1).
  Round-trip identity держится через цикл `parse → eval` в
  обоих случаях.
- **3.2.5** Operand'ы принимают JSON-shape и qlang-shape
  значения взаимозаменяемо где это семантически корректно
  (Map с string-key'ами через `:foo`-literal-key и через
  `"foo": v`-string-key — одно и то же значение). Конверсии
  между shape'ами — через явные операнды (`keyword`, `set`,
  `error`, `parseJson`), не неявные.
- **3.2.6** JSON-purity транзитивна: JSON-pure pipeValue под
  JSON-pure-операндами остаётся JSON-pure. qlang-only-лифт —
  только через явный операнд или рефлексивный возврат
  (см. 2.5).
- **3.2.7** Backtick-литерал содержит **валидный qlang**.
  Расквотировав содержимое и вставив как source, оно
  парсится и эвалится. Внутри backtick'а — только обычный
  Pipeline (OperandCall'ы, литералы, ParenGroup'ы); никаких
  специальных аннотаций или префиксов. Назначение Quote —
  copy-pasteable примеры в Doc'ах и frozen code-as-data.

### 3.3 Сериализация

- **3.3.1** tagged JSON lossless для всех value-типов кроме
  session-only (envRef-зависимые, Function-pointer).
- **3.3.2** Module Quote-value после load остаётся в env под
  `qlang/ast/<uri>` (Quote frozen module's parsed code).
  Axis-операнды читают через эту Quote'у.
- **3.3.3** Четыре комбинатора (`|`, `*`, `>>`, `!|`) не
  изменяются.

### 3.4 Принципы render'а

- **3.4.1** Литерал производен от source-формы. Источник —
  каноническая форма; round-trip возвращает её.
- **3.4.2** Promote existing grammar form. Если форма парсится
  и подсвечивается — продвинуть в literal-статус, не вводить
  новый syntax. Не вводить literal-форму для concept'а,
  выражаемого existing literal'ом (single-key Map покрывает
  MapEntry-семантику; one-element Vec покрывает singleton-
  семантику; и т.п.).
- **3.4.3** Position-disambiguated semantics допустимы.
  Прецедент: `:foo` literal vs `foo` identifier reference.
- **3.4.4** Map с `:qlang/kind` — runtime representation семьи
  (Quote, Conduit, Doc, Comment). Каждый kind имеет собственное
  грамматическое правило литерала; runtime-shape единая.
  AST-узлы не отдельный value-class — они frozen content
  внутри Quote'а, наружу всегда выходят как Quote.
- **3.4.5** Минимум нового синтаксиса. При поиске формы для
  нового value-class'а — приоритет у promotion existing
  grammar form (3.4.2). Введение нового символа допустимо,
  но обосновывается отсутствием подходящей existing-формы.
  Выбор формы — отдельное решение per value-class в §4.

### 3.5 Покрытие

100/100/100/100 (lines / branches / functions / statements).
Падение ниже — блокер.

### 3.6 Doc, Comment, doc-attach

- **3.6.1** Doc — value-class. Литерал `|~~ content ~~|`
  (block) и `|~~| content` до newline (line) в любой
  Primary-позиции, включая pipe-step head, эвалится в
  Doc-value. Position-disambig отсутствует —
  `2 | |~~ c ~~|` заменяет pipeValue на Doc-value.
- **3.6.2** Comment — value-class. Литерал `|~ content ~|`
  (block) и `|~| content` до newline (line) по тому же
  правилу — эвалится в Comment-value в любой Primary-позиции.
- **3.6.3** Внутри композитных литералов (Vec / Map / Set /
  Error) doc-prefix к содержимому не привязывается. Doc/Comment
  внутри литерала — только standalone value (3.6.1, 3.6.2),
  становится элементом контейнера. Никакой grammar-аннотации
  типа DocKeyword нет.
- **3.6.4** DocAttachedSequence — единственный grammar-механизм
  doc-attach. Паттерн `DocComment+ _L (DefCall / AsCall)` в
  pipeline-позиции; AST OperandCall-узел `def`/`as` получает
  `.docs` — Vec строк в declaration order. Один doc-блок —
  одна запись Vec'а; адъяцентные line-doc'и не конкатенируются.
  Перед любым другим OperandCall (`filter`, `mul`, …) doc-prefix
  не ассоциируется — Doc становится standalone DocLit (3.6.1)
  как первый pipe-step, следующий operand идёт отдельным шагом.
- **3.6.5** Eval operand-call'а — pure. Runtime function-value
  не несёт `.docs`. AST-узел хранит `.docs` для axis-операндов
  из §2.3, которые читают через `qlang/ast/<uri>` в env
  (§3.1.10).
- **3.6.6** Удаляются: правило `MapEntryDocPrefix` и фолдинг
  `foldEntryDocs`. Docs на bindings — через DocAttachedSequence
  на declaring step (§3.7), не на value-Map (§3.1.10).
- **3.6.7** Multi-source aggregation: axis-операнд `docs` для
  keyword'а возвращает Vec всех documented occurrences с
  атрибуцией `{:from :ns :text "…"}`. Источник — `qlang/ast/<uri>`
  AST'ы в env. Поиск по declaring def-step'ам (§3.7) с
  совпадающим `:name`. Один keyword упомянутый в нескольких
  модулях даёт Vec всех находок.
- **3.6.8** Doc-content парсится parse-time в Vec структурных
  сегментов. Узкий канон: `:Prose` (plain text), `:Quote`
  (`` `code` `` — same Quote value-class что top-level),
  `:Assertion` (`` `snippet` → `expected` `` — pair Quote-
  сегментов для example extraction через `runExamples` и
  подобные). Остальное (keyword references, type tags,
  имена) остаётся частью Prose plain-text'ом — модель
  распознаёт сама без grammar-уровня дискриминации.
  Doc-value хранит `:segments` Vec; навигация — `doc | /segments`
  и фильтры по `:qlang/kind` сегмента.

### 3.7 Declarative bindings

- **3.7.1** Mathematica-style reading order: имя > спецификация >
  реализация. Все declarative bindings декларируются через
  `def(:name, ...)` в captured-form — имя первый captured-arg.
- **3.7.2** `def` pipeline-transparent. Subject pipeValue passes
  through unchanged. Declaration consumes только captured-args
  и attached doc-prefix; subject не используется как часть
  declaration semantics.
- **3.7.3** `as(:name)` — отдельный operand для pipeValue
  capture. Subject-form, scope-local handle. Не overlap'ится
  с `def`. Concern: reuse значения в fan-out / cross-step
  reference, не env declaration.
- **3.7.4** `def` semantics adapts по arity captured-args:
  - 1 captured-arg (`:name`): attached doc-prefix становится
    binding value (для guides / vocabulary entries / pure-doc
    binding'ов). Без attached doc — error.
  - 2 captured-args (`:name`, body): body — implementation;
    attached doc — documentation about binding. Snapshot vs
    conduit определяется purity-analysis body AST'а — pure
    literal eval'ится at def-time и хранится как snapshot;
    impure body хранится как deferred AST для conduit
    invocation per lookup.
  - 3 captured-args (`:name`, params Vec, body): parametric
    conduit; attached doc — documentation.
- **3.7.5** Гига-мэп — antipattern. Bindings декларируются
  микро-инкрементами (по одному `def`-step), не одним Map
  literal'ом. Map literal — для **значений**, не для контейнера
  деклараций. Каждый builtin / vocabulary entry / error-class
  / type-alias — отдельный `def`-step с собственным attached
  doc-prefix'ом и собственной AST-позицией для axis-операндов.

### 3.8 Tagged literals и type-level identifiers

- **3.8.1** Hierarchy `:` vs `::` — два namespace identifier'ов.
  `:foo` — value-level (keyword as value, Map key, identifier
  reference к value-binding). `::foo` — type-level (type tag,
  type reference, type-binding). Разные namespace в env;
  `:duration` (value binding) и `::duration` (type binding)
  могут coexist без conflict'а.
- **3.8.2** Tagged literal — `::tag<container>`. Generic
  механизм для value-class литералов через type-tag prefix
  + произвольный container (Vec / Map / Set / String / Quote).
  Eval lookup'ит `::tag` binding в env, invoke'ит constructor
  против payload. Strict literal (α по 3.2.4) — собственный
  AST-узел `TaggedLit`, eval напрямую без operand-call
  indirection. printValue выпускает обратно ту же
  `::tag<container>` форму. Round-trip clean.
- **3.8.3** `Conduit` literal — `::conduit[:self?, params, body]`
  через tagged literal pattern. Self-name optional Keyword,
  params Vec keyword'ов, body Quote-литерал. Eval строит
  Conduit-value с envRef = current env. Self-name (если есть)
  даёт local tie-the-knot для recursion **независимо от
  external env** — recursion preserved через round-trip.
- **3.8.4** Type definitions — `def(::tag, descriptor)`.
  Descriptor содержит `:qlang/kind :type`, `:constructor`
  (frozen body или function reference), `:spec` (ожидаемая
  shape payload), `:docs`, `:examples`. Author определяет
  новые types в user-space без core-changes —
  type-system extensibility через обычные `def`-step'ы.
- **3.8.5** Type metadata navigation — `::tag | <axis>` той
  же hypertext-моделью, что `:keyword | <axis>` (§2.3).
  4 токена на запрос, dense сигнал per token. Symmetric с
  operand-binding inspection — единый pattern для всех
  named bindings (operand'ы, conduit'ы, types, vocabulary).
- **3.8.6** Базовые containers (Vec / Map / Set / Error / Quote)
  имеют compact shorthand'ы (`[...]` / `{...}` / `#{...}` /
  `!{...}` / `` `...` ``) — frequent value-classes earned
  short syntax. Новые value-classes — через verbose
  `::tag<container>` форму до earn'ивания shorthand'а через
  usage. Backward extensibility открыта без break'а existing.

