# qlang Redesign — оставшиеся секции

Staging area для обсуждения. Содержит:

- Сохранённые секции исходного редизайн-плана + post-redesign-plan'а, чей дизайн **landed в коде, но chapter в `qlang-spec.md` / `qlang-internals.md` / `qlang-operands.md` отсутствует**. Решить — перенести в spec или удалить.
- Сохранённые секции, чей дизайн **частично landed**. Остаток либо обсуждается, либо помечается как future-work.
- Сохранённые секции **не landed вообще** — material для отдельного решения.

Что выпилено (landed AND отражено в spec/operands/internals):
- §0 онбординг агента (правила переехали в `CLAUDE.md` + `.claude/agents/qlang-review.md`).
- §I current state / problems pre-redesign — archeology.
- §II.1 базовая теорема round-trip — `qlang-spec.md` "Round-trip invariant".
- §II.2 Quote — `qlang-spec.md` lexical structure + round-trip invariant; `qlang-operands.md` parse/eval/apply.
- §II.4 Conduit literal `::conduit[…]` — `qlang-spec.md` round-trip invariant; `qlang-internals.md` BindStep evaluator.
- §II.5 Doc / Comment value-classes — `qlang-spec.md` Comments section.
- §II.7 DocAttach mechanism — `qlang-spec.md` Comments "Attach-to-next".
- §II.9 Spec внутри qlang (attached docs as binding documentation) — `qlang-spec.md` Comments + Reflection.
- §II.10 Errors через Quote — `qlang-spec.md` Error track; `qlang-internals.md` "Error values and fail-track dispatch".
- §II.12 Value-class summary table — `qlang-spec.md` Atomic / Composite chapters.
- §II.13 Invariant self-check — conformance JSONL plus unit tests; this is a test catalogue, not design.
- (post §1) Quote balanced paired delimiter — landed, отражено в spec lexical structure.
- (post §2) TaggedLit atomic / namespaced syntax — landed; overview в spec lexical-structure, design-rationale chapter сохранён ниже под §II.3.
- (post §3) Error classes as first-class type-bindings — printValue tag-head emission, `::Tag!{…}` round-trip, `:throws` Vec TagKeyword references, registration discipline через `TaggedLitTagNotFoundError` — landed; описано в `qlang-spec.md` Error track + Round-trip invariant + reify descriptor `:throws` shape.
- (post §4) Assertion redesign — Quote-as-test — landed; описано в `qlang-spec.md` runExamples chapter.
- Phase 0 / 1 / 2 / 3 / 4 (через M3.5 BindStep) / 5 / 6 / 7 / 9 / 11 / 12 — landed.
- M1 / M2 / M3 / M3.5 / M4 / M6 — landed либо текущая работа.

---

## §II.3. Tagged literals и type-level identifiers

(landed: TaggedLit / BareTypeKeyword AST nodes, two-namespace env через `TYPE_BINDING_PREFIX`, `evalTaggedLit` / `evalBareTypeKeyword`, `runtime/tagged.mjs` constructors. **Not in spec**: full chapter про `::tag` mechanism / hierarchy `:` vs `::` / constructor flow / DSL templating pattern.)

`::tag<container>` — generic механизм для value-class литералов через type-tag prefix + произвольный container. **Угловые скобки `<...>` в этой документации — meta-placeholder для любого Primary**; реальный syntax не несёт `<...>` — author пишет напрямую `::duration{:hours 3}`, `::regex"^[a-z]+$"`, `::bytes[72 101 108]`. Грамматика: `TaggedLit = "::" Ident Primary`. Strict grammar literal (α) — собственный AST-узел `TaggedLit`. Eval lookup'ит `::tag` binding в env, invoke'ит constructor против payload. `printValue` выпускает обратно ту же `::tag<payload>` форму.

```qlang
::duration{:hours 3}
::regex"^[a-z]+$"
::permitted-tags#{:read :write}
::bytes[72 101 108 108 111]
```

Container выбирается под natural fit для payload данного type'а (Vec / Map / Set / String / Quote). Tag — что за value-class, container — shape данных.

**Hierarchy `:` vs `::`.** `:foo` — value-level identifier (keyword as value, Map key, identifier reference к value-binding). `::foo` — type-level identifier (type tag, type reference, type-binding). Разные namespace в env; `:duration` (value binding) и `::duration` (type binding) могут coexist без conflict'а.

`::` — load-bearing disambig. Без него `[:user :data ::permissions#{:read :write}]` становится ambiguous (`:data` как keyword value vs как type-tag). С `::`: unambiguous, visual hierarchy clean (colon-count → role).

**Constructor через subject-form.** Под капотом `::tag<container>` semantically equivalent `payload | tag` — operand под `::tag` namespace принимает payload как subject и строит value. Symmetric с другими subject-form constructors (`"name" | keyword`, `[items] | doc`).

**Базовые containers** (Vec, Map, Set, Error, Quote) имеют compact shorthand'ы (`[...]`, `{...}`, `#{...}`, `!{...}`, `~{...}`) — frequent value-classes earned short syntax. Новые value-classes — через verbose `::tag<container>` форму до earn'ивания shorthand'а через usage.

### §II.3.1. Convention для tagged constructor / printer

TaggedLit eval flow:

1. Парсер строит `TaggedLit` AST с полями `tag` (Ident) и `payload` (Primary AST).
2. Eval payload по обычным правилам (inference §II.11.1 применяется внутри payload independently). Получаем **payload-value**.
3. Lookup `::tag` в type-namespace env. Если binding отсутствует — `TaggedLitTagNotFoundError`.
4. Резолюшен — descriptor type-binding'а это Map с `:qlang/kind :type`, `:qlang/impl :qlang/prim/<tag>` (либо Quote-value).
5. `:qlang/impl` keyword resolve'ится через `PRIMITIVE_REGISTRY` → **constructor function-value**. Альтернатива — Quote-value (qlang-side constructor body).
6. Constructor invoke'ит `(payload) → value`. Может throw'ать дополнительные per-site error'ы.
7. Returned value становится pipeValue.

**Constructor может быть JS-side или qlang-side (landed):**

- **JS-side** (для embedder'ов, host-нативные types): `:qlang/impl :qlang/prim/<tag>` keyword handle в descriptor'е, function зарегистрирована через `PRIMITIVE_REGISTRY.bind`.
- **qlang-side** (для user-defined domain types): `:qlang/impl ~{body}` (Quote-value) в descriptor'е. Author пишет constructor прямо в qlang. Никакого engineering wall'а между user и embedder — symmetric пути.

```qlang
|~~ Set permissions — only :read/:write/:delete allowed. ~~|
::permissions {:qlang/kind :type
   :allowed #{:read :write :delete}
   :qlang/impl ~{as(:p)
     | every(:permissions/allowed | has)
     | when(not, error({:kind :PermissionUnknown}))
     | p}}
```

`::permissions#{:read :write}` → constructor invoke с payload Set, every-check проходит, returns payload. `::permissions#{:read :write :lie}` → fail, throws `:PermissionUnknown` на fail-track.

**Constructor invariants:**

- **Pure** в смысле no-side-effects on env / no I/O. Effectful constructor'ы — anti-pattern; такие types должны декларироваться через `@`-prefixed tag (`::@launch ...`). Effect-laundering invariant работает на type-level symmetrically с BindStep'ом.
- **Deterministic** по payload. Same payload → same value (round-trip integrity).
- Returned value — **frozen** (immutable).
- Round-trip property: `parse(printValue(constructor(payload)))` дает equivalent value.

### §II.3.2. Payload eval semantics — Smalltalk keyword-message style

(landed механика: `evalTaggedLit` evaluates payload через стандартный AST descent, captured pipeValue прокидывается естественно через fork-tree. **Не в spec**: analogy / pattern description.)

`::tag<container>` — это **не литеральная статика**. Container это **Primary expression** (по grammar `TaggedLit = "::" Ident Primary`), который eval'ится по обычным правилам, **с захватом outer pipeValue**.

Конкретно: payload может быть:

- **Map literal** `{:k1 expr1 :k2 expr2}` — каждое entry-value fork'ает sub-pipeline получая outer pipeValue в context'е. Inherited из `eval.mjs::evalMapLit`.
- **Vec literal** `[el1 el2 el3]` — каждый element fork'ает sub-pipeline.
- **Set / Error literal** — same forking semantics.
- **Inner TaggedLit** `::otherTag{...}` — eval'ится first (children before parents), result становится inner-value outer container'а.
- **Quote** `~{expr}` — frozen code-as-data; constructor получает Quote-value, может lazy-eval отдельно.
- **Scalar / Keyword / Projection / OperandCall** — literal или sub-pipeline шаг.

**Captured pipeValue в payload — first-class:**

```qlang
{:name "alice"}
  | ::user{:name /name :access ::permissions#{:read :write}}
```

Eval flow:
1. Outer pipeValue = `{:name "alice"}`.
2. Inner Map `{:name /name :access ::permissions#{...}}` eval'ится:
   - Entry `:name /name` — sub-fork, `/name` против outer pipeValue → `"alice"`.
   - Entry `:access ::permissions#{:read :write}` — inner TaggedLit eval'ится first, constructor `::permissions` invoke с Set, returns validated permissions value.
3. Outer payload Map `{:name "alice" :access <permissions>}` готов.
4. Constructor `::user` invoke против этой Map'ы → user-value.

**Smalltalk keyword-message-passing analogy.** Сравни:

| Форма | Семантика |
|---|---|
| `value \| op(arg1, arg2)` | OperandCall — positional args |
| `value \| ::tag{:k1 expr1 :k2 expr2}` | TaggedLit — keyword-keyed args (named slots) |

Дуальные. Для богатых domain-DSL keyword-message читается лучше — author видит **named slots**, знает что куда идёт. Positional хорош для математики (`add`, `mul`), keyword-message — для domain construction.

### §II.3.3. DSL templating через Doc-payload (золотая жила)

(не landed: ::sql / ::html / ::shell / ::url constructors. Mechanism готов: `parseDocSegments` extracts Quote segments из Doc-content, constructor может walk segments. Только bodies нужны.)

TaggedLit с **Doc-value payload** даёт натуральный DSL-templating с **automatic parameter binding** — никакой string concatenation, никакого manual escaping, никаких injection'ов.

Doc-content уже парсится через `parseDocSegments` в Vec из `:prose` / Quote / TaggedLit-built сегментов. DSL-constructor walks segments, обрабатывает Quote сегменты как **interpolated parameter slots** — evaluates Quote против outer pipeValue, binds result как parameter, prose-сегменты идут как static text.

**Пример: SQL prepared statement без ручного escaping:**

```qlang
::sql {:qlang/kind :type
   :qlang/impl ~{/segments
     | as(:parts)
     | { :sql      parts | * (if(/qlang/kind | eq(:prose),
                                  /text,
                                  "?"))
                         | join("")
        :params   parts | filter(isQuote)
                         | * (/source | parse | eval) }}}
```

Author пишет SQL inline, native syntax, с qlang-выражениями для параметров через Quote'ы:

```qlang
{:userId 42 :status "active"}
  | ::sql|~~ SELECT *
              FROM users
             WHERE id = ~{/userId}
               AND status = ~{/status}
               AND created > ~{now() | minus(::duration{:days 7})} ~~|
```

Constructor walks Doc-segments, returns:

```qlang
{:sql    "SELECT * FROM users WHERE id = ? AND status = ? AND created > ?"
 :params [42 "active" <date-value>]}
```

— готовое prepared statement для DB driver. **Никакой конкатенации, никакого escaping, никакого SQL injection вообще возможен** — Quote-сегменты eval'ятся в qlang-стороне до build'а query-string'а, results bind'ятся через `?`-плейсхолдеры.

**Same pattern для других DSL'ов:**

- **HTML / JSX templating:** `::html|~~ <div class="~{/className}">~{/content}</div> ~~|` — constructor escapes Quote-results через `htmlEntities` до splice'а в template.
- **Shell command building:** `::shell|~~ git log --since=~{/sinceDate} --author=~{/author} ~~|` — constructor shell-quote'ит Quote-results.
- **URL building:** `::url|~~ https://api.com/users/~{/id}/profile?token=~{/token} ~~|` — constructor URL-encode'ит Quote-results.
- **Path building, regex composition, log formatting** — same pattern.

**Это снимает целый класс vulnerabilities** (injection семейство) на уровне language-mechanism, а не библиотек. Author не может **случайно забыть escape** — eval Quote-сегмента всегда даёт qlang-value, constructor всегда binds его как parameter, не как raw text. Single source of truth — constructor function.

И — ключевое: **author пишет в native domain syntax** (SQL / HTML / shell — выглядят как сам этот язык), parameter-interpolation через Quote — **читаемо**, не обвешано ceremonial `${...}` или `printf`-подобной нотацией.

### §II.3.4. Lazy payload через Quote

(landed: Quote literal `~{…}` сохраняет AST lazy, `/ast` / `eval` / `apply` resolve on demand.)

Default eval — eager: payload вычисляется до constructor invocation. Если constructor хочет deferred eval (например для conditional / lazy patterns) — author оборачивает expression в Quote:

```qlang
::lazy {:qlang/impl ~{as(:wrapped) | wrapped}}  -- noop, просто хранит Quote

::cond {:qlang/impl ~{as(:branches)
  | first(/condition | parse | eval | isTruthy)
  | /body | parse | eval}}

::cond[{:condition ~{/age | gt(18)} :body ~{"adult"}}
       {:condition ~{true}              :body ~{"minor"}}]
```

Constructor получает Vec branches с Quote-value'ями для condition / body, eval'ит их selectively. Никакого grammar-level lazy-flag'а — convention через Quote.

---

## §II.6. Type definitions через `::tag descriptor`

(landed: BindStep `::Tag {descriptor}` форма + `evalTaggedLit` resolving `:qlang/impl` keyword/Quote. **Not in spec**: chapter про type bindings как такие.)

Type definitions через BindStep `::tag descriptor`. Descriptor — Map с `:qlang/kind :type`, `:qlang/impl :qlang/prim/<tag>` (handle keyword в `PRIMITIVE_REGISTRY`, тот же механизм что builtin descriptor'ов в `core/lib/qlang/core.qlang`) либо Quote-value (qlang-side body), `:docs` (через attached doc-prefix). function-value в descriptor **не хранится** — это нарушает базовую теорему round-trip'а.

User-space type'ы регистрируют constructor через `PRIMITIVE_REGISTRY.bind('qlang/prim/<tag>', constructorFn)` и ссылаются на handle keyword'ом из descriptor'а — либо пишут Quote-impl прямо в qlang.

---

## §II.8. Hypertext через axis-операнды (частично landed)

(landed: `source`, `docs`, `examples` через `runtime/axis.mjs`. **Not landed**: multi-source aggregation.)

**Identity** — keyword (`:foo` value-level или `::foo` type-level). **Reference** — keyword в pipeline / Map value / Vec element. **Resolution** — env lookup → binding. **Binding** — Map с structured fields (constructor / docs / examples / source). **Navigation** — axis-операнды.

```qlang
:filter | docs           — value-level navigation       (landed)
::duration | docs        — type-level navigation        (landed)
:CountErrorFamily | docs — vocabulary entry navigation  (landed для error tags)
```

Universal pattern `<keyword | tag> | <axis>` для всех named bindings.

**Multi-source aggregation (не landed).** Один keyword упомянутый в нескольких модулях даёт Vec всех находок с атрибуцией `{:from :ns :text "…"}`. Поиск по declaring `BindStep`-step'ам с совпадающим `:name`. Сейчас `findBindingStepAcrossModules` возвращает last-match по shadowing semantics — нужно extension либо отдельный axis-operand `docsAll` для multi-source форм.

---

## §II.11. JSON-bridge — остаток

(landed: JsonObjectLit / JsonArrayLit grammar, `JSON_OBJECT_TAG` / `JSON_ARRAY_TAG`, `makeJsonObject` / `makeJsonArray`, `isJsonObject` / `isJsonArray`, type-preserving operands через `vecLikeOf` / `mapLikeOf` / `retagPerElement`, conversion через `::qlang` / `::json` TaggedLit constructors. **Not landed**: details below.)

### §II.11.1. Context-aware default для inner empty/single (не landed)

Defaults для ambiguous container'ов (нет маркеров) — context-aware:

- **Top-level** (нет parent container'а): default qlang.
  - `qlang '{}'` → qlang Map.
  - `qlang '[]'` → qlang Vec.
  - `qlang '[42]'` → qlang Vec (single element без commas).
- **Inner** (внутри parent container'а): **inherit** type от parent.
  - `{"users": []}` — outer JSON Object → inner `[]` JSON Array.
  - `{"users": [42]}` — inner `[42]` JSON Array (inherit).
  - `{:wrap []}` — outer qlang Map → inner `[]` qlang Vec.
  - `{:items [{"k": 1}]}` — inner `[{"k": 1}]` qlang Vec (inherit от qlang Map), внутри JSON Object element.

Сейчас grammar ordered-choice статичный: empty `[]` / `{}` всегда qlang, single-element `[42]` всегда qlang. Inheritance требует context-aware parser pass — либо grammar-level token-state, либо post-parse decoration через `containerKindOf` walker.

**Зачем context-aware:** paste'нутый JSON payload `{"users":[{"name":"alice"}]}` парсится через всё дерево как JSON. Без inheritance inner single-element `[{"name":"alice"}]` становится qlang Vec на top-level правиле — type leakage в середине дерева, JSON-purity ломается на первом single-element шаге.

JSON-empty / JSON-single на top-level — explicit через TaggedLit: `::json{}`, `::json[]`, `::json[42]`.

### §II.11.5. CollectKindMismatch loud-fail (design drift)

**Plan**: `*`-distribute и `>>`-merge при subject = JSON Array но body выдаёт element несовместимого типа (qlang-only) — **runtime type-error** «cannot collect qlang-element into JSON Array». Author явно cast'ит subject через `qlang` operand перед `*` если нужно.

**Реализация**: `eval.mjs::retagPerElement` — silent degradation. Если subject JSON Array но один element не JSON-storeable, container degrades в qlang Vec. Это противоположно plan'у.

Trade-off для решения:
- Plan-style strict: предсказуемо, loud-fail на shape-mismatch, требует explicit `| qlang` cast.
- Текущий silent: composable, user-friendly, но скрывает type drift; downstream `| json` все равно ловит на serialize-time.

### §II.11.6. Subject-form `qlang` operand (не landed)

`::qlang{…}` / `::json{…}` (TaggedLit constructors) — landed.

`subject | json` — landed (`runtime/format.mjs::json`, `JSON.stringify(toPlain)`).

`subject | qlang` — **не landed**. Должен symmetric с `json`: pipeValue JSON Object/Array → qlang Map/Vec, рекурсивно через всё дерево. Сейчас доступно только через `::qlang(payload)` ParenGroup hack или через `::qlang<payload>` TaggedLit.

---

## §II.14. Обоснования ключевых решений (residual rationale)

(Большая часть landed AND отражена в spec. Оставшиеся пункты — design-rationale, ценный сам по себе, ещё не в spec:)

**Quote, не AST-Map наружу.** AST-Map в pipeValue — serialized Map-tree, читать невозможно для модели. Quote (`~{source}`) — одна строка кода, copy-pasteable. Модель видит code как code. Errors с Quote'ами — модель сразу понимает failed code и может extend / fix.

**`::tag`, не `#tag` или другой prefix.** `::` aligns с keyword family — `:foo` / `::foo` — visual hierarchy value vs type через colon-count. Single literal root — value-level и type-level identifier'ы parallel'ны. Namespacing inheritance из keyword grammar (`::qlang/conduit`, `::jdt/method-skeleton`).

**Two-namespace env (`:` / `::`), не один.** `::` — load-bearing disambig. Position-dependent rules для распознавания tag vs keyword brittle. С `::`: unambiguous, visual hierarchy clean.

**JSON остаётся JSON.** `jq` use case требует JSON in → JSON out. Auto-lift в qlang Map ломает этот use case. Explicit lift через operand — author явно решает.

---

## Successive refinement — design rationale (из post §5)

(landed как pattern в `error-convert.mjs::RUNTIME_FIELD_ORDER` + `printValue::printErrorValue` tag-head + `:trail null` + `:message` elisions. **Not in spec/internals**.)

Borrowed из теории кодирования с потерями (progressive JPEG / embedded coding в JPEG2000 / SVD truncation): syntactic positions ordered по informational priority. Front carries critical / high-variance content; tail carries supplementary / class-derivable / low-variance content. Truncation в любой точке degrades gracefully — surviving prefix остаётся meaningful.

**Применяется fractal'но:**

(a) **На уровне syntax structure** — class identifier в front (`::Class!{...}`), supplementary fields в back (`!{...}` payload):
- `::AddLeftNotNumberError!{...}` — class в tag-position, payload context — в map-entries.
- vs flat `!{:thrown :AddLeftNotNumberError ...}` где class drowns среди других equal-prefix entries.

(b) **На уровне payload Map field ordering** — context-variable fields в front, class-derivable / constant fields в back (или altogether omitted через class-level defaults в type-binding):
- Variable: `:actualType :vec`, `:actualValue [1 2 3]`, `:fault {...}`, dynamic `:message` — front.
- Class-derivable: `:origin :qlang/eval`, `:kind :type-error`, `:operand "add"`, `:position 1`, `:expectedType "Number"`, constant `:message` template — back / omitted.

**Канонический compression pattern для future:** class type-binding declares `:defaults` Map (class-constant fields) и `:message-template` (Quote что computes dynamic message из merged context). Constructor merges author payload с defaults. `printValue` emit'ит delta — fields deviating from class defaults appear в literal, defaults implied tag'ом.

Result форма:

```
::AddLeftNotNumberError!{:actualType :vec :actualValue [1 2 3] :fault {:step ~{add(1)} :input [1 2 3]}}
```

vs flat (~16 fields):

```
!{:origin :qlang/eval :kind :type-error :thrown :AddLeftNotNumberError :operand "add" :position 1 :expectedType "Number" :actualType :vec :actualValue [1 2 3] :message "..." :fault {...} :trail null}
```

Compression — через class-level defaults factored out. Field ordering — variance-priority (variable first). Truncation at column N — class identity + most diagnostic context survive.

**Contrast с Java pattern** (`private static final long MAX_READ_BYTES = ...`): modifier chain (low-entropy, repetitive) occupies positions highest priority в declaration. Identifier (high-entropy, the actual signal) — pushed past 4-5 boilerplate tokens. Truncation at column 30 → `private static final long MAX_R` — identifier обрезан, modifiers выжили. Wrong information survived. **qlang design pursues inverted ordering** — identifier / class / structural marker в front, modifiers / supplementary context в back.

---

## Phase 8 — Axis-операнды (остаток)

(landed: `source` / `docs` / `examples` axes, `parseDocSegments` tokenizer, single-source last-match-wins lookup.)

**Не landed**:

- Multi-source aggregation в `docs` — если keyword documented в двух модулях, axis возвращает Vec всех находок с `{:from :ns :text "…"}` атрибуцией. Сейчас `findBindingStepAcrossModules` last-match-wins.

---

## Phase 10 — JSON default + qlang opt-in (остаток)

(landed: grammar / runtime types / type-preserving operands / `parseJson` / `::qlang` `::json` TaggedLit constructors. Listed unlanded в §II.11.)

**Не landed**:

- **Context-aware default JSON/qlang inheritance** для inner empty / single containers (§II.11.1).
- **Subject-form `qlang` operand** (value-namespace JSON→qlang converter, симметричный с `json`) — §II.11.6.
- **`CollectKindMismatch` strict loud-fail** для `*` / `>>` через JSON Array subject + qlang-only body — §II.11.5. Currently silent degradation в `retagPerElement`.

---

## M5. Hypertext catalog integration (из post-redesign-plan, не landed)

- `manifest` operand surface'ит type-bindings parallel'но value-bindings — отдельный axis или extended `manifest(:axis :type)` overload.
- LSP `hoverAtOffset` recognize TaggedLit / BareTypeKeyword — surface `::Class | docs` markdown на hover.
- LSP `definitionAtOffset` resolves `::Class` references через catalog index.
- LSP completion — `::tag`-prefix references в context'ах принимающих TaggedLit.
- `bindingNamesVisibleAt` extension на type-namespace — для LSP autocomplete после `::`.
