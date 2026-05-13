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
- §II.3 Tagged literals (overview / hierarchy `:` vs `::` / constructor flow / qlang-side vs JS-side / payload eval / Quote-payload deferred semantics / tagged-instance round-trip) — landed; перенесено в `qlang-spec.md` "Type bindings" chapter + `qlang-internals.md` "Type bindings and TaggedLit dispatch" chapter.
- §II.6 Type definitions через `::tag descriptor` — landed; перекрывается с "Type bindings" chapter в spec.

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
