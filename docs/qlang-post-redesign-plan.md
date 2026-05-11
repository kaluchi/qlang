# qlang Hypertext Post-Redesign

Финиш hypertext-направления: каждое named-entity — first-class type-binding с навигируемыми axes (docs / spec / source / runExamples); единый `::tag` синтаксис для navigate / construct / print / reference; registration discipline через `TaggedLitTagNotFound`; entropy-promotion — семантически-сильнейшие bit'ы в structurally-dominant позиции syntax'а.

## Цель

- Снять greedy-quoting проблему (Quote с backtick'ами внутри content'а).
- Закрыть syntactic gap в TaggedLit где optional whitespace создавал ambiguity между nested-composition и separate-elements.
- Поднять `:thrown` error-class из map-entry в structural tag-position (entropy promotion).
- Уравнять error-classes с остальными type-bindings — same `::tag` family, same axis'ы, same registration discipline.
- Снять hardcoded `::assertion` через generic Quote-as-test.

## Концептуальные решения

### 1. Quote — balanced paired delimiter

Greedy `` `...` `` заменяется на pair'd `~{...}`:
- Opener `~{`, closer `}`. Scanner — brace-balance counter, string/comment-aware (skip-zones для `"..."` StringLit, `|~ ~|` / `|~~ ~~|` block-comments, line-comments to newline).
- Backtick — language-wide escape char внутри Quote content: `` `{ `` → literal `{`, `` `} `` → literal `}`, ``  `` `` `` → literal `` ` ``.
- Content — валидный qlang код (lazy parse через `parse` / `eval` operands).
- Brace family parallel: `{}` Map / `#{}` Set / `!{}` Error / `~{}` Quote / `?{}` reserved (future boolean/ternary).

### 2. TaggedLit — atomic, namespaced

- `::tag<Primary>` без whitespace между tag и payload. Grammar `_` дроп'нут из `TaggedLit`.
- Whitespace форсит interpretation как BareTypeKeyword reference + следующий Vec/Pipeline element.
- Tag name — `NamespacedName` (`::ns/sub/leaf`) — symmetric с keyword namespacing.
- Scalar / identifier payload через ParenGroup wrap: `::tag(42)`, `::tag(foo)`, `::tag(a | b)`.
- Composite payload compact: `::tag[...]`, `::tag{...}`, `::tag#{...}`, `::tag!{...}`, `::tag~{...}`, `::tag"..."`, `::tag:keyword`.

Семантика — uniform constructor invocation. ParenGroup в payload — single-Pipeline evaluator scope, не argument list (запятые internal не поддерживаются grammar'ом).

### 3. Error classes — first-class type-bindings

Каждый per-site error class registered как type-binding:

```
|~~ Subject of `examples` / `docs` / `source` axis must be a Keyword
    (binding-name) or a type-binding descriptor Map. ~~|
def(::ExamplesSubjectNotKeywordOrType, {
  :qlang/kind :type
  :qlang/impl :qlang/error/auto-thrown
  :category :type-error
  :spec {:operand "examples" :context-shape ...}
})
```

- `:thrown` field error-value — **TagKeyword** (`::ExamplesSubjectNotKeywordOrType`), не plain keyword.
- printValue для error-value с TagKeyword `:thrown` emit'ит `::ClassName!{:other-fields}` — class в tag-position, прочие fields в Map. `:thrown` field из Map removed (implied tag'ом).
- Roundtrip: `::Class!{}` parse → TaggedLit → constructor stamps `:thrown :Class` + merges payload → error-value. Identity.
- **Registration discipline:** попытка `::FakeClass!{...}` для unregistered tag → `TaggedLitTagNotFound`. Typo'и / catalog drift surface loudly.
- `:throws` Vec'и в descriptor'ах operand'ов carry TagKeyword references `[::ClassA ::ClassB]` — navigable axis'ами.
- Existing axis-operands (`::Class | docs`, `| source`, `| spec`, `| runExamples`) уже работают для type-bindings — naturally extend на error-classes.

### 4. Assertion redesign — Quote-as-test

`::assertion[snippet expected]` deprecate. Замена — Quote-as-test:

```
|~~ Returns the number of elements.

    ~{[1 2 3] | count | eq(3)}
    ~{#{:a :b} | count | eq(2)}
    ~~|
def(:count, {...})
```

- `doc-segments.mjs` извлекает Quote-segments generic'но (без `::assertion` special-recognition).
- `runExamples`: eval каждый Quote — truthy result → pass; falsy / error-value → fail. Returns `[{:snippet :actual :ok :error}]`.
- `assert(msg)` operand из `lib/qlang/error.qlang` остаётся для descriptive failures.
- Tagged Quote'ы `::category~{...}` — optional categorization через user-defined type-bindings (`::test`, `::perf/benchmark`).

### 5. Successive refinement

Borrowed из теории кодирования с потерями (progressive JPEG / embedded coding в JPEG2000 / SVD truncation): syntactic positions ordered по informational priority. Front carries critical / high-variance content; tail carries supplementary / class-derivable / low-variance content. Truncation в любой точке degrades gracefully — surviving prefix остаётся meaningful.

**Применяется fractal'но:**

(a) **На уровне syntax structure** — class identifier в front (`::Class!{...}`), supplementary fields в back (`!{...}` payload):
- `::AddLeftNotNumber!{...}` — class в tag-position, payload context — в map-entries.
- vs flat `!{:thrown :AddLeftNotNumber ...}` где class drowns среди других equal-prefix entries.

(b) **На уровне payload Map field ordering** — context-variable fields в front, class-derivable / constant fields в back (или altogether omitted через class-level defaults в type-binding):
- Variable: `:actualType :vec`, `:actualValue [1 2 3]`, `:fault {...}`, dynamic `:message` — front.
- Class-derivable: `:origin :qlang/eval`, `:kind :type-error`, `:operand "add"`, `:position 1`, `:expectedType "Number"`, constant `:message` template — back / omitted.

**Канонический compression pattern для future:** class type-binding declares `:defaults` Map (class-constant fields) и `:message-template` (Quote что computes dynamic message из merged context). Constructor merges author payload с defaults. printValue emit'ит delta — fields deviating from class defaults appear в literal, defaults implied tag'ом.

Result форма:

```
::AddLeftNotNumber!{:actualType :vec :actualValue [1 2 3] :fault {:step `add(1)` :input [1 2 3]}}
```

vs текущая verbose (~16 fields):

```
!{:origin :qlang/eval :kind :type-error :thrown :AddLeftNotNumber :operand "add" :position 1 :expectedType "Number" :actualType :vec :actualValue [1 2 3] :message "..." :fault {...} :trail null}
```

Compression — через class-level defaults factored out. Field ordering — variance-priority (variable first). Truncation at column N — class identity + most diagnostic context survive.

**Contrast с Java pattern** (`private static final long MAX_READ_BYTES = ...`): modifier chain (low-entropy, repetitive) occupies positions highest priority в declaration. Identifier (high-entropy, the actual signal) — pushed past 4-5 boilerplate tokens. Truncation at column 30 → `private static final long MAX_R` — identifier обрезан, modifiers выжили. Wrong information survived. **qlang design pursues inverted ordering** — identifier / class / structural marker в front, modifiers / supplementary context в back.

## Milestones

### M1. Quote pair'd grammar

- `grammar.peggy::QuoteLit` rule → `~{...}` + brace-balance scanner (string/comment-aware).
- `BacktickSpan` в block-comments → `QuoteSpan` под `~{...}` pattern.
- Escape `` `{ `` / `` `} `` / ``  `` `` `` внутри Quote content.
- `printValue` / `printConduit` / `CELL_HANDLERS.Quote` / `INLINE_HANDLERS.Quote` emit `~{...}` (auto-escape unbalanced chars).
- `doc-segments.mjs::findQuoteEnd` — balanced `~{` / `}` scanner.
- Sweep `core.qlang`, conformance JSONL, unit-tests, docs: `` `x` `` → `~{x}`.
- Tests: nested Quote, string-with-brace inside Quote, comment-with-brace, escape forms.

### M2. TaggedLit atomic + namespaced

- `grammar.peggy::TaggedLit` — drop `_` между tag и payload. `BareTypeKeyword` same.
- Tag name extend к `NamespacedName`.
- Sweep author examples в docs / plan где whitespace был между tag и payload — нормализовать compact.
- Tests: namespaced tag'и, boundary cases (whitespace separation, ParenGroup payload).

### M3. Assertion redesign

- Drop `::assertion` type-binding из `core.qlang` (или migrate в `lib/qlang/test/` как optional `::test` category).
- `doc-segments.mjs::parseDocSegments` — extract Quote'ы generic'но, без `::assertion` privilege.
- `runExamples` simplify: eval Quote, truthy/error check.
- Sweep `core.qlang` assertion examples: `::assertion[\`a\` \`b\`]` → `~{a | eq(b)}`.

### M4. Error classes as type-bindings

- Generic constructor primitive `:qlang/error/auto-thrown` в `runtime/error.mjs` — `(payload, state, tagName) → error-value` stamping `:thrown <TagKeyword(tagName)>` + merge payload, lift via `makeErrorValue`. Требует modify `evalTaggedLit` signature чтобы передать `node.tag` в constructor.
- `core/src/operand-errors.mjs` factory'и emit'ят type-binding declarations alongside class definitions (либо inline в `core.qlang`, либо separate catalog `core/lib/qlang/error/classes.qlang` loaded at bootstrap).
- `error-convert.mjs::errorFromQlang` stamps `:thrown` как TagKeyword (`makeTagKeyword(qlangError.fingerprint)`).
- `printValue` Map handler: если value — error-value и `:thrown` TagKeyword — emit `::Class!{:other-fields}` form. Anonymous (plain keyword `:thrown` или absent) → emit `!{:thrown ... :other-fields}` form.
- `core.qlang` descriptor'и: `:throws [...]` Vec'и → TagKeyword references.
- Tests: roundtrip `::Class!{}` parse → eval → print → parse identity; registration discipline (typo'нутый tag → `TaggedLitTagNotFound`); axis-operands работают для error classes (`::AddLeftNotNumber | docs` returns docs).

### M5. Hypertext catalog integration

- `manifest` operand surface'ит type-bindings parallel'но value-bindings — отдельный axis или extended `manifest(:axis :type)` overload.
- LSP `hoverAtOffset` recognize TaggedLit / BareTypeKeyword — surface `::Class | docs` markdown на hover.
- LSP `definitionAtOffset` resolves `::Class` references через catalog index.
- LSP completion — `::tag`-prefix references в context'ах принимающих TaggedLit.

### M6. Docs sync

- `docs/qlang-spec.md`: chapter про Quote `~{...}`, TaggedLit grammar / namespacing, error classes as type-bindings, entropy promotion principle.
- `docs/qlang-internals.md`: Quote scanner algorithm, TaggedLit dispatch flow, error class registration model.
- `docs/qlang-operands.md`: `:throws` field shape (TagKeyword Vec), error operand entries.
- `docs/qlang-redesign-plan.md` после полной выкладки разбросать по spec / internals / operands и удалить.

## Out of scope (settled elsewhere)

- Function-value handling — invariant `FunctionValueLeakedToPrint` + projection `:qlang/impl` function→keyword в render-paths. Done.
- Conduit value-literal vs declaration-form — display `def(:name, body)` через `printConduit`, strict round-trip через codec.mjs (tagged-JSON). Settled.
- `let` → `def` operand rename — Done in current session.
- `:trail` Quote vs AST-Map shape — Quote-source. Done.
- `:fault.step` Quote-shape. Done.
- ConduitBodyMissingSource invariant в `makeConduit`. Done.
- CLI host operands wrapping в descriptor Map (`bindHostBuiltin`). Done.
