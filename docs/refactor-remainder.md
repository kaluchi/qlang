# Остаток Variant-B рефакторинга — ТЗ

Документ пишется как snapshot после сессии, которая уложила 12
коммитов на `master`:

```
8ac6fcd  align docs and review-agent lexicon with Variant-B surface
6dafcfd  add parse / eval reflective operands — the code-as-data ring closer
61dc889  Variant-B cutover — langRuntime parses core.qlang, dispatch via PRIMITIVE_REGISTRY
94dff34  add lib/qlang/core.qlang — Variant-B langRuntime source catalog
6bb49d5  stamp AST-Maps onto :trail instead of source-text strings
69f92fb  bind every runtime/*.mjs primitive into PRIMITIVE_REGISTRY at load
83b182b  rename primitive-registry vocabulary to bind / resolve / seal
279d6ec  lift generated parser and manifest artifacts out of src/ into gen/
c282bc9  add MapEntry doc-comment attachment — grammar, eval, codec
e6a1f47  add src/primitives.mjs — primitive registry foundation
b40aa61  add astNodeToMap / qlangMapToAst — bidirectional AST ↔ qlang-Map codec
aa6b52b  lift operand-errors.mjs out of runtime/ to the core src/ root
```

Сессия закрыла **Variant-B** полностью для `src/`, `docs/`, и
`lib/qlang/core.qlang`. 1823 теста зелёные, coverage
100/99.35/100/100. Remaining work ниже сгруппирован по приоритету.

## Контекст — что изменилось под капотом

Короткая выжимка для того, кто будет это делать (или вспоминать
через неделю), без необходимости читать 12 commit messages:

1. **`langRuntime()` — это теперь 10 строк**. Парсит
   `lib/qlang/core.qlang` в один большой `MapLit` AST,
   эвалит его против пустого env, получает `Map<keyword,
   descriptor-Map>`, возвращает shallow-copy на каждый вызов.
   Никакого `bootstrap.mjs`, `enrichWithManifest`, `IMPLS`,
   `forceDescriptor` — удалены.

2. **Каждый built-in — это Map в env**, не function value.
   Дескриптор несёт `:qlang/kind :builtin`, `:qlang/impl
   :qlang/prim/<name>` (namespaced keyword, ключ в
   `PRIMITIVE_REGISTRY`), `:category`, `:subject`, `:returns`,
   `:modifiers`, `:examples`, `:throws`, и `:docs` Vec (собранный
   из doc-comment prefix'а `|~~ ~~|` над MapEntry в core.qlang
   через `foldEntryDocs` в `evalMapLit`).

3. **`evalOperandCall` dispatch'ит через `applyBuiltinDescriptor`**
   когда resolved env value — это Map с `:qlang/kind :builtin`.
   `PRIMITIVE_REGISTRY.resolve(:qlang/impl)` достаёт JS function
   value, затем обычный `applyRule10`. Bare non-nullary lookup
   (no captured args, `minCaptured > 0`) short-circuit'ит —
   возвращает сам descriptor как pipeValue для REPL
   introspection.

4. **Function values остались для conduit-parameters**. Это
   единственная production-path категория function-values; они
   появляются в env внутри conduit body через
   `makeConduitParameter` в `eval.mjs`, живут один call,
   dispatch'атся через старую `isFunctionValue` ветку
   `evalOperandCall`.

5. **Conduit и snapshot остались frozen JS objects** с `.type`
   маркером (`{type: 'conduit', body, envRef, ...}` и
   `{type: 'snapshot', value, docs, ...}`). Variant-B **не**
   доводил их до Map-form — это в списке remainder'а ниже.

6. **`:trail` — Vec of AST-Maps**, не Vec of strings. Каждый
   deflect стамп'ит через `walk.mjs::astNodeToMap(stepNode)`.
   Downstream query'и читают `:name`, `:args`, `:location`,
   `:text` и так далее как обычные Map-поля. Display-form —
   `/trail * /text`. Re-eval — `/trail * eval`.

7. **Два новых reflective operand'а**: `parse` (string → AST-Map)
   и `eval` (AST-Map → pipeValue). Закрывают code-as-data кольцо.
   Каталог сейчас — 69 entries.

8. **`lib/qlang/core.qlang`** — authored source, 740+ строк qlang.
   `gen/core.mjs` — build output (`CORE_SOURCE` string constant).
   `scripts/build-core.mjs` — build script. `.gitignore`
   исключает `gen/`, `package.json "files"` включает его в npm
   publish tarball.

---

## Приоритет 1 — зависимые компоненты (возможно сломанные)

Эти компоненты не были затронуты сессией, но могут опираться на
старый shape env-bindings (function values) и поломаться на
первом вызове. Проверка и фикс — в следующей сессии первым делом.

### 1.1. LSP features — `lsp/src/features.mjs`

**Риск**: высокий. LSP likely использует `reify`, `manifest`,
`env | /name`, или прямые JS-level импорты из `langRuntime()`.
Любая code-path, которая ожидает `function value` (с `.meta`,
`.arity`, `.fn`) от env-lookup, сломается — env теперь хранит
`Map` descriptors.

**Что сделать**:
1. `cd lsp && npm test` — посмотреть какие тесты падают.
2. Пройтись по `lsp/src/features.mjs` и найти сайты, которые:
   - Читают `fn.meta.docs`, `fn.meta.examples`, `fn.meta.throws`,
     `fn.meta.captured`, `fn.arity` — заменить на
     `descriptor.get(keyword('docs'))` и т.д.
   - Проверяют `isFunctionValue(resolved)` — добавить
     `isQMap + :qlang/kind :builtin` check'и, или использовать
     `reify(:name)` через public API вместо direct inspection.
   - Импортируют `langRuntime().get(...)` для hover / completion
     — это сейчас Map descriptor, формат проекции полей
     (`:category`, `:docs`, etc.) отличается от старого
     `buildBuiltinDescriptor` output.
3. Запустить `lsp/test/**` и убедиться, что все feature-тесты
   зелёные после апдейта.

**Тестирование вживую**: открыть `.qlang` файл в VSCode с
установленным extension'ом, проверить hover на built-in operand,
autocomplete, goto-definition (`reify(:count)`), diagnostics.

### 1.2. VSCode extension — `vscode-extension/`

**Риск**: средний. Extension обычно тонкий LSP-client, основная
работа делается LSP server'ом. Но если extension делает прямые
qlang-level eval'ы (для REPL panel, например), те code-path'ы
могут опираться на старый env shape.

**Что сделать**:
1. `cd vscode-extension && npm run build && npm test` — посмотреть.
2. Если есть REPL panel — проверить, что `env | /count` показывает
   descriptor Map (а не упавший JS error).

---

## Приоритет 2 — Variant-B consistency доводка

Variant-B задумывался так, что **каждый** env binding —
descriptor Map с `:qlang/kind`. Реализован он частично: built-ins
— Map'ы, но conduits и snapshots остались frozen JS objects. Это
непоследовательно — `reify` имеет две ветки, `evalOperandCall`
имеет три ветки dispatch'а. Доводка унифицирует их.

### 2.1. Conduits как Map descriptors

**Цель**: `let(:double, mul(2))` создаёт в env запись
```
:double {:qlang/kind :conduit
         :qlang/body <AST-Map of mul(2)>
         :qlang/envRef <opaque env anchor>
         :params []
         :docs [...]
         :location {...}}
```

вместо текущего frozen `{type: 'conduit', body, envRef, ...}` JS
объекта.

**Файлы**:
- `src/types.mjs::makeConduit` — меняет return type на frozen
  Map. `isConduit` становится
  `isQMap(v) && v.get(:qlang/kind) === :conduit`.
- `src/eval.mjs::evalOperandCall` — объединяет dispatch-ветки
  `:qlang/kind :builtin` и `:qlang/kind :conduit` в одну
  `applyBindingDescriptor` функцию, которая роутит по
  discriminator'у.
- `src/runtime/intro.mjs::letOperand` — создаёт Map через
  `makeConduit`, никаких изменений в call site.
- `src/runtime/intro.mjs::describeBinding` — `isConduit` ветка
  использует новый Map shape напрямую, убирается
  `buildConduitDescriptor` как отдельный helper.
- `src/session.mjs::serializeSession` / `deserializeSession` —
  conduit сериализация через `:qlang/body` (уже AST-Map благодаря
  Step 1 codec'у) вместо `body.text` rendering.

**Subtlety**: `envRef` — JS-side mutable holder для tie-the-knot
рекурсии. Не qlang data. Храним под namespaced ключом
`:qlang/envRef` с непрозрачным значением — codec'ы
(`toTaggedJSON`, `serializeSession`) пропускают его.

**Тесты**: conduit pattern queries (`let(:walk, {:label /label
:children /children * walk})`), recursive definitions, parametric
conduits with `envRef` tie-the-knot. Все существующие тесты должны
остаться зелёными.

### 2.2. Snapshots как Map descriptors

**Цель**: `42 | as(:answer)` создаёт в env запись
```
:answer {:qlang/kind :snapshot
         :qlang/value 42
         :docs [...]
         :location {...}}
```

вместо текущего `{type: 'snapshot', value: 42, ...}` JS объекта.

**Файлы**: зеркально с 2.1 — `makeSnapshot`, `isSnapshot`,
`evalOperandCall` projection branch (`isSnapshot(resolved)`
unwrap path для bare lookup), `describeBinding`.

**Subtlety**: `evalProjection` сейчас имеет явный unwrap
snapshot'а через `isSnapshot(current)` — надо перевести на
`isQMap(current) && current.get(:qlang/kind) === :snapshot`
или вообще убрать unwrap и заставить users делать
`snapshot | /qlang/value`. Последнее ломает `as(:r) | r`
эргономику.

**Решение**: keep transparent unwrap в `evalProjection` и
`evalOperandCall`, но через Map-based check.

### 2.3. Унификация dispatch под `applyBindingDescriptor`

После 2.1 и 2.2, `evalOperandCall` получает один helper
`applyBindingDescriptor(descriptor, node, name, state)` который
роутит по `:qlang/kind`:

```js
case KW_BUILTIN:  return applyBuiltinDispatch(descriptor, node, name, state);
case KW_CONDUIT:  return applyConduitDispatch(descriptor, node, name, state);
case KW_SNAPSHOT: return withPipeValue(state, descriptor.get(KW_QLANG_VALUE));
```

Исчезают три отдельных `isConduit` / `isSnapshot` /
`isFunctionValue` ветки. Остаётся одна ветка для
conduit-parameter'ов (function values) как единственное
"не-Map-descriptor" значение в env.

---

## Приоритет 3 — известные loose ends

Известные находки из ревью и в ходе этой сессии, которые не
попали в коммиты.

### 3.1. `sourceOfAst` defensive dead code в `runtime/intro.mjs`

**Находка из первого review** (Section 4 — defensive noise):
`nodeSource(node)` в `runtime/intro.mjs` читает
`node.text ?? sourceOfAst(node)`. Под `grammar.peggy`'s
`node()`-helper'ом каждый AST узел несёт `.text`, так что
`sourceOfAst` fallback — 30-строчный `switch` по `node.type`,
который никогда не fire'ит.

**Что сделать**: удалить `sourceOfAst` целиком, заменить
`nodeSource` на прямое `node.text` чтение. Если кому-то понадобится
программный source-render из AST-Map, они должны строить его
сами через `walk.mjs` или через формат, ориентированный на
Map-shape.

### 3.2. Deserialized conduit dynamic scope

**Находка из первого review** (Section 5 / 8 — half-measure +
doc drift): `session.mjs::deserializeSession` создаёт conduit'ы
через `makeConduit(bodyAst, { name, params, docs })` — без
`envRef`, так что at call time `applyConduit` fallback'ит на
`state.env` как lexical anchor. Это **dynamic scope**, не
documented lexical scope через envRef tie-the-knot.

**Что сделать**: второй pass в `deserializeSession` после того,
как все bindings restored, проходит по conduit'ам и проставляет
`envRef.env = session.env` через helper в `types.mjs`. Тогда
restored conduit'ы получают lexical anchor на restored env,
соответствующий тому, что дал бы свежий `evalCell` let-statement
в той же среде.

Альтернатива: document degradation в qlang-internals.md и убрать
fallback из `applyConduit`. Но вариант (a) — правильный.

### 3.3. `DocCommentList` orphan в `grammar.peggy`

`DocCommentList` production определена в grammar.peggy но не
используется ни в одной другой production. Осталась от старого
refactor'а, где её consumption path исчез. Мёртвый код в
сгенерированном parser'е.

**Что сделать**: удалить production, regenerate grammar, запустить
тесты.

### 3.4. `site` context field в `operand-errors.mjs` факторах

**Находка из первого review** (Section 4 — defensive noise):
Каждый `declare*Error` фактор добавляет `{ site: className, ...context }`
в context, и затем `error-convert.mjs::errorFromQlang` filters
`k === 'site'` чтобы не exposить его пользователю. Redundant:
`this.name`/`this.fingerprint` уже несут имя класса, `site`
дублирует без добавленной информации.

**Что сделать**: убрать `{ site: className, ...context }` spread
в фабриках; убрать filter `k === 'site'` в `errorFromQlang`.

### 3.5. Conformance JSONL для `parse`/`eval` операндов

Step 10 commit добавил тесты parse/eval в `core-catalog.test.mjs`,
но существующая конвенция — иметь per-operand JSONL файлы в
`test/conformance/operands/`. Там нет `parse.jsonl` и `eval.jsonl`.

**Что сделать**: создать два JSONL файла с conformance cases —
happy-path (scalar / operand-call / pipeline round-trip) плюс
error cases (`parse` на non-string subject, `eval` на non-Map,
malformed source). Не массивные — по 5-10 кейсов на файл.

---

## Приоритет 4 — organic next steps

Это не loose ends — это расширения, которые становятся
естественно возможными после Variant-B. Не блокеры для чего
бы то ни было, но достраивают картину.

### 4.1. `truncateTrail` conduit в `lib/qlang/error.qlang`

**Мотивация**: идиома `union({:trail []}) | error` для
сбрасывания накопленного `:trail` Vec'а документирована в
`qlang-spec.md` и `qlang-internals.md` как explicit-truncation
механизм, но не имеет именованного сиблинга в
`lib/qlang/error.qlang` рядом с `retry`, `withContext`,
`mapError`, `tapError`, `finallyError`. Двухстрочный conduit
закрыл бы дырку:

```qlang
|~~ Sheds the accumulated trail before re-lifting an error
    into a fresh error value. Used at fail-track boundaries
    where the incoming trail is no longer load-bearing
    (cross-module calls, retry resets, etc.). Call via `!|`
    on fail-track. ~~|
let(:truncateTrail,
  union({:trail []}) | error)
```

**Тесты**: пара cases в `test/unit/error-lib.test.mjs` +
conformance в `test/conformance/19-error-values.jsonl`.

### 4.2. `partition(pred)` Vec transformer

**Мотивация**: между `filter(pred)` (возвращает matching) и
`groupBy(keyFn)` (N корзин по keyword-ключу) лежит бинарный
`partition` — splits a Vec into `{:matches [...] :rest [...]}`.
Validation / happy-path split patterns используют его
постоянно.

**Файлы**:
- Entry в `lib/qlang/core.qlang` с `:category :vec-transformer`
- `src/runtime/vec.mjs` — impl через `higherOrderOp`
- `test/conformance/operands/partition.jsonl`
- Update catalog count в `core-catalog.test.mjs` (69 → 70)

**Return shape**: Map `{:matches [...] :rest [...]}`, не Vec
`[matches rest]`. Симметрично с `groupBy`'s Map return.

### 4.3. `bindingDescriptorsVisibleAt` walk primitive

**Мотивация**: `walk.mjs::bindingNamesVisibleAt` возвращает
Set имён для autocomplete. Editor'ам нужна richer форма —
имя + kind + docs preview. Под Variant-B это выводимо из
существующих primitives:

```js
export function bindingDescriptorsVisibleAt(ast, offset, env) {
  const names = bindingNamesVisibleAt(ast, offset);
  const descriptors = [];
  for (const name of names) {
    const kw = keyword(name);
    if (env.has(kw)) descriptors.push({ name, descriptor: env.get(kw) });
  }
  return descriptors;
}
```

**Use case**: LSP completion shows `{ label, kind, documentation }`
per binding. Under Variant B, `kind` и `documentation` читаются
напрямую из descriptor Map без отдельного `reify` round-trip'а.

### 4.4. Inline plain comments в Map/Vec/Set literals

**Мотивация**: `lib/qlang/core.qlang` под Sub-commit A не имеет
section dividers внутри outer Map literal потому что grammar
не допускает plain comments (`|~ ── Vec reducers ── ~|`)
между MapEntries. Пришлось переместить section TOC наружу, в
leading comment block. Аналогичное ограничение у Vec и Set
literals.

**Что сделать**: расширить grammar — внутри `MapEntries`,
`PipelineList`, и equivalent productions разрешить plain
comments (`LinePlainComment` / `BlockPlainComment`) как
whitespace-equivalent. Они consume'ятся silently, AST их не
содержит.

**Грамматика**:

```peggy
MapEntries
  = head:MapEntry tail:(_ PlainCommentOrSeparator* _ MapEntry)*
    { return [head, ...tail.map(t => t[3])]; }

PlainCommentOrSeparator
  = PlainCommentStep _   |~| plain comment → skipped
  / "," _                |~| optional separator
```

Аналогично для `PipelineList`. Regenerate, add tests.

После этого core.qlang можно будет восстановить section
dividers inline:
```qlang
{
  |~ ── Vec reducers ── ~|
  :count {...}
  ...
  |~ ── Vec transformers ── ~|
  :filter {...}
  ...
}
```

---

## Приоритет 5 — вопросы для обсуждения перед работой

Это design decisions, которые я принял в одностороннем порядке в
этой сессии но могут стоить пересмотра прежде, чем двигаться
дальше.

### 5.1. `reify` substitution `:qlang/kind` → `:kind`

Сейчас `reify(:count)` возвращает Map с `:kind :builtin`
(без namespace prefix'а), потому что я посчитал что user
quer'ам удобнее писать `reify(:count) | /kind` чем
`reify(:count) | /:qlang/kind`. Substitution происходит в
`describeBinding` — я копирую descriptor и заменяю `:qlang/kind`
на `:kind`, плюс удаляю `:qlang/impl`.

**Альтернатива**: reify возвращает env value as-is. Users пишут
`/:qlang/kind`. Менее удобно, но более честно — "reify = env
lookup" как principle.

**Вопрос**: оставить substitution или убрать?

### 5.2. `:name` в `core.qlang` entries

Сейчас entry для `:count` не содержит явного `:name "count"` —
внешний Map key IS the name, и `reify(:count)` стампит `:name` в
output на момент вызова. Но value-level reify (`env | /count |
reify`) не имеет explicit name в scope, так что результат не
содержит `:name`.

**Альтернатива A**: добавить `:name "count"` в каждую entry
core.qlang. Redundant (дублирует Map key), но value-level
reify получает `:name` бесплатно.

**Альтернатива B**: документировать что value-level reify
теряет `:name`, и educational path — use `reify(:count)` named
form.

**Выбрано (сейчас)**: B. Но стоит ли — вопрос open.

### 5.3. Bare-non-nullary REPL ergonomic — opt-in или всегда on?

Сейчас bare `mul` / `filter` / `coalesce` / etc. возвращают
descriptor Map вместо firing an arity error. Это принятое
решение во имя REPL introspection.

**Концерн**: у не-REPL вызовов это может быть неожиданно.
Например, `pipeline | mul` в middle-of-query — раньше это была
arity error (explicit signal "I forgot args"), теперь это
silently заменяет pipeValue на descriptor Map. Тихое изменение
semantics posse.

**Альтернатива**: keep arity error on bare non-nullary, и
добавить explicit `describe(:name)` / `doc(:name)` operand для
REPL introspection. Users who want the descriptor write
`reify(:mul)` или `describe(mul)`.

**Выбрано (сейчас)**: always on. Но стоит ли — вопрос open.

### 5.4. `:throws` как Vec of keywords vs Vec of strings

Под Variant-B `:throws` в descriptor'е — Vec of keywords
(`[:AddLeftNotNumber :AddRightNotNumber]`). Раньше (через
`enrichWithManifest`) это был Vec of strings
(`["AddLeftNotNumber" "AddRightNotNumber"]`). Я поменял в процессе
сессии чтобы соответствовать core.qlang-literal form.

**За keywords**: typed, filterable через `eq(:AddLeftNotNumber)`,
interoperable с `filter` / `has` / `eq` predicates.

**За strings**: display-friendly, матчится напрямую с
`error !| /thrown` (который string/keyword... actually keyword
тоже).

**Выбрано (сейчас)**: keywords. Но если LSP / editor UI ожидают
strings, может понадобиться адаптер.

---

## Рекомендованный порядок работы

1. **Сразу после сессии**: запустить `cd lsp && npm test` и
   `cd vscode-extension && npm test` чтобы оценить breakage
   scope для Приоритета 1. Даже если ничего не ломается —
   это быстрый sanity check.

2. **Первая rebalance-сессия (~2-4 часа)**:
   - Приоритет 1 (LSP + vscode-extension) — обязательно.
   - Приоритет 3 — cleanup'ы (sourceOfAst, operand-errors site,
     DocCommentList, parse/eval conformance). Все маленькие,
     можно всё одним коммитом.

3. **Вторая rebalance-сессия (~4-6 часов)**:
   - Приоритет 2 (Conduit/Snapshot → Map descriptor). Big
     structural change, требует фокуса. Один большой commit.
   - После — unified `applyBindingDescriptor` dispatch.

4. **Третья сессия (~2-3 часа)**:
   - Приоритет 4 — organic next steps. Порядок безразличен,
     можно по одному коммиту каждому.

5. **В любой момент**:
   - Приоритет 5 — обсудить с пользователем прежде чем трогать.
     Каждый decision может потребовать сдвига в уже закоммиченной
     работе.

## Контракты что поддерживать

При любой работе на этом remainder'е:
- **1823 теста зелёные** на каждом коммите
- **Coverage 100/99/100/100** минимум (текущий 100/99.35/100/100)
- **Один коммит — одна концерн** (как в Variant-B сессии)
- **Никаких breaking changes в public API** без coordinated
  update к `src/index.mjs` re-exports и
  `docs/qlang-internals.md` embedding API section
- **Structural coherence**: если новый код живёт в файле — файл
  должен иметь derivable grouping principle в одно предложение
- **Per-site error classes**: каждый throw site получает unique
  class с fingerprint + structured context через factory в
  `src/operand-errors.mjs`
- **High-entropy lexicon**: никакого generic JS vocab'а там,
  где qlang vocab именует тот же концепт специфичнее
- **No temporal framing**: никаких "now", "previously", "was",
  "used to", "legacy", "deprecated" в коде или доках
