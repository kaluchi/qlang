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
- Opener `~{`, closer `}`. Content matches `Pipeline` rule (whatever Pipeline rejects falls through to a `QuoteChar` byte). Balance derives entirely from the standard qlang grammar — `MapLit` / `SetLit` / `VecLit` / `ErrorLit` / `ParenGroup` / nested `QuoteLit` each end on their own closer, string literals and comments are skip-zones recognized by Pipeline itself.
- No escape mechanism. Valid qlang carries no unbalanced `{` / `}` / `` ` `` outside `"..."` / comment skip-zones. Backtick has no syntactic role anywhere in qlang.
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
::ExamplesSubjectNotKeywordOrType {
  :qlang/kind :type
  :qlang/impl :qlang/error/auto-thrown
  :category :type-error
  :spec {:operand "examples" :context-shape ...}
}
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
:count {...}
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

### M1. Quote pair'd grammar  (done)

- `grammar.peggy::QuoteLit` rule → `~{...}` with content matching `Pipeline { return text(); }` plus a `QuoteChar` fallback.
- `BacktickSpan` в block-comments → `QuoteSpan` под `~{...}` pattern.
- `printValue` / `printConduit` / `CELL_HANDLERS.Quote` / `INLINE_HANDLERS.Quote` emit `'~{' + src + '}'` verbatim — no escape.
- `doc-segments.mjs::findQuoteEnd` — balanced `~{` / `}` scanner over string-literal skip-zones.
- Sweep `core.qlang`, conformance JSONL, unit-tests, docs: `` `x` `` → `~{x}`.
- Tests: nested Quote, balanced Map / Vec / Set / ParenGroup inside Quote, full `core.qlang` round-tripping through one `~{...}`.

### M2. TaggedLit atomic + namespaced

- `grammar.peggy::TaggedLit` — drop `_` между tag и payload. `BareTypeKeyword` same.
- Tag name extend к `NamespacedName`.
- Sweep author examples в docs / plan где whitespace был между tag и payload — нормализовать compact.
- Tests: namespaced tag'и, boundary cases (whitespace separation, ParenGroup payload).

### M3. Assertion redesign  (done)

- `::assertion` type-binding и `qlang/type/assertion` primitive removed from `core.qlang` / `tagged.mjs`.
- `doc-segments.mjs::parseDocSegments` already generic — extracts every Quote / TaggedLit / Prose, no `::assertion` privilege.
- `runExamples` simplified: each Quote → result Map `{:snippet :actual :ok :error}`; `:ok` is true iff the Quote eval result is truthy (not `false`, not `null`, not an error-value).
- `examples` axis returns `Vec<Quote>` directly (no Map-filtering for `:qlang/kind :assertion`).
- `core.qlang` sweep: each `::assertion[~{a} ~{b}]` rewritten to `~{a | eq(b)}` (single Quote-as-test). Prose qlang references that previously appeared as inline emphasis-Quotes (`~{|}`, `~{!|}`, `~{parse}`, `~{vals | sum}` etc.) demoted to bare prose — they were never tests, and runExamples is honest about that now.
- Catalog self-test re-expressed as `manifest | every(runExamples | every(/ok))` — boolean composition instead of `flat | distinct`.

### M3.5. BindStep — declarative bindings

Каждый binding в каталоге — синтаксически отдельный step с именем
в head-position. Doc-prefix в spec-slot. Body — impl. Identifier
карьерой entropy promotion в front, supplementary context в back.

**Форма:**

```
:count
  |~~ Returns the number of elements. Polymorphic over Vec
      (length), Set (size), and Map (entry count).

      ~{[1 2 3] | count | eq(3)}
      ~{#{:a :b} | count | eq(2)} ~~|
  {:qlang/kind :builtin
   :qlang/impl :qlang/prim/count
   :category :container-reducer
   :subject [:vec :set :map]
   :returns :number
   :throws [::CountSubjectNotContainer]}

::conduit
  |~~ Conduit literal — invokeable lexically-scoped value carrying
      a frozen body AST plus optional self-name and parameter list. ~~|
  {:qlang/kind :type
   :qlang/impl :qlang/type/conduit
   :spec {:payload :vec}
   :throws [::ConduitPayloadNotVec ::ConduitArityInvalid ...]}
```

**Grammar:**

```peggy
RawStep
  = BindStep
  / Primary

BindStep
  = key:BindName _? docs:DocPrefix? rest:BindRest?
    & { return docs !== null || rest !== null; }
    { return node('BindStep',
        { key, docs, params: rest?.params ?? null, body: rest?.body ?? null },
        location(), text()); }

BindName
  = Keyword           // value-namespace
  / BareTypeKeyword   // type-namespace

BindRest
  = params:Params _? body:BindBody    // parametric conduit
  / body:BindBody                     // value/literal

Params
  = "[" _L head:Keyword tail:(_L Keyword)* _L "]"

BindBody
  = body:Primary
    &{ return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }

ContinuationUnit
  = step:BindStep { return { combinator: '|', step }; }
  / ExplicitContinuation
  / ... (rest unchanged)
```

Между BindStep'ами combinator не нужен — следующий `:foo` / `::Foo`
сам выступает разделителем. Pipeline level only — внутри `[...]` /
`{...}` / `#{...}` / `(...)` BindStep не пробуется, элементы парсятся
как обычно (`PipelineInLiteral`).

**Семантика:**

BindStep **прозрачен для pipeValue** — выводит declarations в чистую
декларативно-эвалящуюся плоскость, независящую от результатов
предыдущих step'ов. Эффект только на env. После BindStep'а
`state.pipeValue === incoming pipeValue`.

`evalBindStep(node, state)`:
1. Если `node.body === null` and `node.docs !== null` — bound =
   `makeSnapshot(makeDoc(docs.join('\n')), { name, docs, location })`.
2. Если body есть и `isPureLiteralAst(body)` — eval body в state
   с `pipeValue = null` (body не зависит от pipeValue), bound =
   `makeSnapshot(value, { name, docs, location })`.
3. Если body impure (содержит OperandCall / Projection / ParenGroup /
   Pipeline) — bound = `makeConduit(body, { name, params, docs, envRef,
   location })`. envRef tie-the-knot как был в прежнем `defOperand`
   до удаления в 26fbc4e.
4. `envSet(state.env, name, bound)`. pipeValue preserved.

`name` ← `':' + key.name` for Keyword, `'::' + key.tag` for
BareTypeKeyword. Effect-laundering AST scan тот же что был у
прежнего `defOperand` до его удаления — пер-binding @-prefix check.

**Body restriction.** Bare Keyword / BareTypeKeyword запрещены как
body (`:foo :bar` не парсится как binding — бессмысленно). Body
обязан быть structural или non-keyword scalar: Map / Vec / Set /
Error / Quote / Doc / TaggedLit / ParenGroup / OperandCall /
Projection / String / Number / Boolean / Null. Для редкого случая
"bind name to keyword value" — wrap в ParenGroup: `:status (:active)`.

**Что заменяется:**

- `:name body` 2-арная форма → `:name body` (BindStep).
- `def(:name)` 1-арная форма с attached doc-prefix → `:name |~~ docs ~~|`.
- `:name [:p ...] body` 3-арная (parametric conduit) →
  `:name [:p ...] body` (BindStep 4-position).
- `::Tag body` (type-binding) → `::Tag body`.

**Что остаётся:**

- `as(:foo)` — снапшот current pipeValue в env под `:foo`. Семантика
  ровно про pipeValue, не покрывается BindStep'ом (там body эксплицитный).
- `def`-operand — больше нет: BindStep + `as` покрывают все формы.

**Самореференция растворяется.** `:def {desc}` — обычный BindStep,
grammar-resolved, не env-lookup. Bootstrap-descriptor для `:def` в
`runtime/index.mjs::langRuntime` удаляется — каталог сам ставит.
`runtime/index.mjs::langRuntime` reduces к: parse → evalAst →
snapshot-unwrap pass → resolution pass.

**:throws migrate to `::Tag`.** Вектор `:throws` в descriptor'ах теперь
несёт `BareTypeKeyword`-references (`[::CountSubjectNotContainer
::SortNaturalNotComparable]`), не plain `:keyword`'ы. Axis-navigable
через те же operand'ы что и остальные `::tag` bindings — `:add | /throws |
first | docs` достанет prose. Entropy promotion в действии — каждое имя
ошибки становится navigable type-binding.

**Migration:**

- `scripts/sweep-bindsteps.mjs` — regex + balance-aware конвертит
  `:name body` → `:name body`, `def(:name)` + attached doc →
  `:name |~~ docs ~~|`, `:name [:p ...] body` → `:name [:p ...]
  body`, `::Tag body` → `::Tag body`.
- Sweep `core.qlang`, conformance JSONL, unit-tests, docs.
- `:throws` Vec sweep: `:CountSubjectNotContainer` → `::CountSubjectNotContainer`
  внутри `:throws` Vec'ах.

**Walker / codec:**

- `astNodeToMap` для `BindStep` — `{:qlang/kind :BindStep :key {AST-map}
  :docs [String...] :params [Keyword-map...] :body {AST-map}}`. params/body
  могут быть `null`.
- `qlangMapToAst` обратно.
- `walk.mjs::astChildrenOf` — `BindStep` children = `[key, params?,
  body?]` (docs не AST, остаются на самом ноде).

**Axis-operands:**

- `findDefStepAcrossModules` → `findBindingAcrossModules`. Walks
  Pipeline.steps, ищет `BindStep` где `bindingKey(step.key) === target`
  (с учётом `:` / `::` префикса).
- `docs / source / examples / runExamples` читают атрибуты с того же
  AST-нода. Никакого OperandCall-special-casing для def/as.

**Conduits / parametric.** 4-position BindStep `:name [:p ...] body`
покрывает parametric conduit. Литеральный conduit-литерал
`::conduit[[:p ...] ~{body}]` остаётся доступен через TaggedLit-body:
`:double ::conduit[[:x] ~{mul(x, 2)}]` — body=TaggedLit, конструктор
производит Conduit-value, BindStep snapshot'ит. Эквивалентные пути для
case'ов где нужно отличить declarative-conduit от literal-conduit-value.

**Reserved symbols.** В пайплайне свободны `=` `.` `:=` `;` — пока не
используются, зарезервированы под будущие decoupling-формы. Shell-safe
(не катастрофичны в bash при unquoted query).

---

### M4. Named errors as type-bindings — landed

`feature/hypertext-redesign` — full series of commits `3ec6c42 …
84c2ac8`. Stage A+B+C plus the followup polish below. Constructors
qlang-side per §II.3 — deferred (no JS impact, can come at any
later point). What's live:

**Core M4 mechanism**

- `core/lib/qlang/error/registry.qlang` — every JS-class from
  `operand-errors.mjs` carries a matching `::Tag {:qlang/kind :type}`
  declaration loaded before `core.qlang`.
- `errorFromQlang` stamps `:thrown` as `makeTagKeyword(fingerprint)`;
  the factories pass canonicalised qlang type-name(s) (`'number'`,
  `['vec','set','map']`) for `expectedType`, lowered to a single
  keyword or a frozen Vec of keywords.
- `printValue` for error-values emits `::Tag!{…}` head + payload
  form with the three elisions (`:thrown` absorbed by tag-head;
  `:trail null`; `:message` when tag-head is present).
- Tagged-instance round-trip — `::Tag!{…}` literal in source stamps
  `:thrown ::Tag` onto the payload's descriptor and returns an
  ErrorValue (universal named-error constructor, no per-tag
  Quote-impl required yet).
- Identifier-shaped descriptor fields (`:operand`, `:position`,
  `:axisName`, `:bindingName`, `:conduitName`, `:paramName`,
  `:namespaceName`, `:effectfulName`, `:tag`) all lift through
  `error-convert.mjs::liftIdentifier` to Keyword (or TagKeyword when
  the source string carries a `::` prefix). Uniform identifier-typed
  surface across every error descriptor.

**Follow-up polish (same M4 design axis, landed in subsequent commits)**

- **Initial pipeValue = `null`** in `evalQuery` / `session.evalCell`.
  The pre-M4 default of seeding pipeValue with the env Map made bare
  identifiers like `count` return "count of env bindings" and dumped
  the full ~250-entry env into `:fault.input` on every error. Now
  every pipeline brings its own subject through an explicit head
  step; the `env` identifier still resolves through env-lookup so
  `env | keys` / `env | /count | reify` work identically.
- **Strict projection**. `/key` no longer coalesces misses to null:
  Map miss → `::ProjectionKeyNotInMap`, Vec OOB →
  `::ProjectionIndexOutOfBounds`, Vec non-integer segment →
  `::ProjectionVecKeyNotInteger`, value-class unknown field →
  `::ProjectionFieldNotOnValueClass`, `null` subject →
  `::ProjectionSubjectNotMap`. The `at` operand keeps soft-access
  semantics (Map miss / Vec OOB → null) as the explicit "this field
  might be absent" path; `coalesce` / `firstTruthy` treat ErrorValue
  as "try next" alongside null so their "first defined value"
  semantic survives strict projection.
- **`::ParseError!{…}` as a first-class lifted ErrorValue**. Parse
  failures (top-level and Quote-source re-parse mid-`eval`/`apply`)
  ride through `errorFromParse` to a structured descriptor —
  `:source` + `:marker` (caret-pointer, same-length keys for
  column-aligned rendering), deduplicated `:expected` Vec of literal
  strings / class keywords / `:end-of-input`, `:found`,
  `:location`, `:uri`. `evalNode`'s catch arm separately recognises
  `ParseError` so a mid-eval parse failure lifts to the same shape,
  with the originating step's `:fault` stamped.
- **`apply(subject)` operand**. Runs the Quote-or-AST currently in
  pipeValue against the captured subject — the classical Lisp / JS
  `apply(fn, args)` convention. Together with the Pipeline-leading
  combinator support (`~{| count}` / `~{* mul(2)}` etc. now parse
  cleanly), trail-emitted suffix Quotes are directly re-executable:
  `"x" | add(1) | mul(2) !| /trail | apply(5)` → 10.
- **CLI `--color={auto,always,never}`** — script-mode now paints
  printValue output through `highlightAnsi` when stdout is a TTY
  (or the user passes `--color=always`). JSON-format output stays
  unpainted unconditionally so `jq` / pipe consumers see clean
  payloads. `NO_COLOR` / `FORCE_COLOR` env vars resolved at
  invocation; explicit flag wins.
- **Quote body highlight with per-kind italic + green delimiters.**
  `~{` / `}` paint as upright green delimiters; the body sub-
  tokenises through the regular tokeniser and every inner span
  carries `italic: true`, so the renderer composes italic on top
  of each kind's colour (atom / operand / number / string / …).
  Unparseable body falls back to a single italic-whitespace span.
- **BindStep / `as` doc-prefix comment span.** Grammar's `DocPrefix`
  rule stamps the prefix's first-doc start offset on a side-channel
  field, propagated to the AST node as `docPrefixStart`. The
  highlighter emits one contiguous `comment`-kind span over the
  prefix region instead of letting `pushGapTokens` byte-by-byte
  misclassify the prose as `punct`.
- **Multi-line list layout for Vec / Set / JsonArray.** Inline
  `[a b c]` rendering when every rendered element is single-line;
  one-element-per-row indented column when any element already
  contains a newline. Removes the "ladder" verticality for shapes
  like `[~{multi-line-Quote} ~{multi-line-Quote}]`.
- **`def` operand removed entirely**. Every catalog / test / docs
  call-site converted to the M3.5 BindStep declarative form
  (`:name body`, `:name [params] body`); `defOperand` and its
  four arg-validation error classes (`DefNameNotKeyword`,
  `DefParamsNotVecOfKeywords`, `DefArityInvalid`,
  `DefMissingDocOrBody`) deleted. `evalBindStep` is the sole
  binding mechanism at the AST level.
- **REPL Enter ↔ Ctrl+Enter swap.** Enter submits (PowerShell /
  bash muscle-memory parity); Ctrl+Enter / Ctrl+J inserts a soft
  newline for multi-line composition.


Каждое named error-имя — first-class type-binding в каталоге, with
the same machinery как у `::conduit` / `::qlang`. Никакой OOP-flavored
терминологии (`Class` etc.) — named error / error-kind / type-binding.

**Строгая 1:1 связка JS-class ↔ qlang-tag.** Каждая JS-сторона error-class из `operand-errors.mjs` остаётся как одна точка throw-site'а — 1 throw = 1 JS-class. qlang catalog объявляет zеркальный `::Имя` type-binding под точно совпадающим именем (`AddLeftNotNumber` JS-class ↔ `::AddLeftNotNumber` type-binding). Никакого generic constructor'а — каждый named-error имеет свой qlang-side `:constructor ::conduit[[:payload] ~{validation-body}]` (per §II.3 в redesign-plan'е), validation-body берёт payload Map после `!{...}` и проверяет наличие+тип всех required полей; iff payload корректен — lift'ит как error-value с `:thrown <::Tag>` stamped; иначе throws structural-error на fail-track. Mechanism уже существует в `eval.mjs::evalTaggedLit` L427-431 через Quote-impl path, JS не вовлечён.

- `core/src/operand-errors.mjs` factory'и **сохраняются** (1:1 JS-class per throw-site). Дополнительно emit'ятся type-binding declarations в catalog (либо inline в `core.qlang` как BindStep'ы, либо separate catalog `core/lib/qlang/error/registry.qlang` loaded at bootstrap). Constructors qlang-side добавляются позже — сначала minimum нужный для eval + print.
- `error-convert.mjs::errorFromQlang` stamps `:thrown` как TagKeyword (`makeTagKeyword(qlangError.fingerprint)`).
- `core.qlang` descriptor'и уже carry `:throws [::Tag ::Tag]` после M3.5 sweep'а — это естественно sticks.

**Печатная форма error-value:**

`printValue` для error-value с TagKeyword'ом в `:thrown` emit'ит TaggedLit-форму `::Tag!{ <fields> }` с tag'ом в structural front position. Внутри `!{...}` идут per-invocation runtime поля упорядоченные по информативности; static / derivable / null-default поля **не выводятся** (round-trip восстановит через makeErrorValue инвариант и через axis-навигацию `::Tag | spec` / `| docs`).

**Правила сериализации полей:**

1. **Identifier-string'и → keyword'ы.** `:operand "add"` → `:operand :add`. `:expectedType "Number"` → `:expectedType :number`. `:position "subject"` → `:position :subject`. (`:position` числовая остаётся числом: `:position 1`.) Структурный qlang-тип identifier'a — Keyword, не String.
2. **Generated prose выкидывается.** `:message "<template-substituted text>"` не печатается — это шаблон-fill, derivable из `:operand` + `:position` + `:expectedType` + `:actualType`. Hypertext-навигация `::Tag | docs` поднимает каноническую prose.
3. **Default-equal-null поля выкидываются.** `:trail null` не печатается — `makeErrorValue` инвариант ставит `null` обратно при reconstruction'е (`types.mjs::L351-353`).
4. **`:thrown <TagKeyword>` field-key elided.** TagKeyword в front-position `::Tag` уже несёт identity. Дублирование выкидывается из payload-Map'ы.
5. **Ordering по importance** (high-entropy diagnostic data первым, low-entropy taxonomy последним):
   - `:fault` — Map `{:step ~{...} :input ...}`. Step — Quote AST-anchor'а throw-site'а (может быть **тонкий surface-call** скрывающий conduit с десятками внутренних step'ов — глубина читается через `:trail`).
   - `:actualValue` — runtime значение что fails.
   - `:actualType` — type-classification actualValue.
   - `:expectedType` — constraint.
   - `:operand` — owning operand.
   - `:position` — slot (`:subject` / число / `:element`).
   - `:trail` — Quote propagation-trace. Печатается **только если non-null** (deflection'ы случились).
   - `:origin` — domain (`:qlang/eval` / `:qlang/parse` / `:host`).
   - `:kind` — категория (`:type-error` / `:arity-error` / etc.).

**Конкретный пример** — `"1" | add(1)`:

```
::AddLeftNotNumber!{
  :fault {:step ~{add(1)} :input "1"}
  :actualValue "1"
  :actualType :string
  :expectedType :number
  :operand :add
  :position 1
  :origin :qlang/eval
  :kind :type-error
}
```

`:fault.step` здесь surface-call `~{add(1)}` потому что `add` — builtin без internal conduit-frame'ов. Если ошибка fired бы изнутри user-defined conduit'a (e.g. `:double mul(2)` declared via BindStep, invocation `"x" | double` → mul throws on string), `:fault.step` пойнтнул бы на innermost AST-узел где JS-factory throw'ом — `~{mul(2)}` внутри conduit's body — а `:trail` накопил бы пройденные deflection'ы surface'а. Истинная глубина не на `:fault.step`, а в combinated `:trail`.

- Tests: roundtrip `::Tag!{ <fields> }` parse → eval → print → parse identity; registration discipline (typo'нутый tag → `TaggedLitTagNotFound`); axis-operands работают для named-error-bindings (`::AddLeftNotNumber | docs` returns docs); `:trail` для nested-conduit-throw'ов содержит propagation chain.

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
- Conduit value-literal vs declaration-form — display `:name body` через `printConduit`, strict round-trip через codec.mjs (tagged-JSON). Settled.
- `let` → `def` operand rename — Done in current session.
- `:trail` Quote vs AST-Map shape — Quote-source. Done.
- `:fault.step` Quote-shape. Done.
- ConduitBodyMissingSource invariant в `makeConduit`. Done.
- CLI host operands wrapping в descriptor Map (`bindHostBuiltin`). Done.
