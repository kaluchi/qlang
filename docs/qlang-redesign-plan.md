# qlang Hypertext Redesign

Самодостаточный документ — содержит всё необходимое для review
и реализации. Три раздела:

- **I.** Текущее состояние — архитектура, инварианты, проблемы.
- **II.** Целевое состояние — что хотим, как, почему.
- **III.** План реализации поэтапно.

---

## I. Текущее состояние

### I.1. Архитектура текущей реализации

qlang — pipeline-язык трансформации данных. Pipeline threading
state pair `(pipeValue, env)` через шаги. Базовые свойства:

- **Variant-B catalog** — `core/lib/qlang/core.qlang` содержит
  один большой Map literal с descriptor'ами всех built-in
  operand'ов. Каждый descriptor — Map с `:qlang/kind :builtin`,
  `:qlang/impl :qlang/prim/<name>` (handle в primitive registry),
  и authored metadata (`:subject`, `:returns`, `:modifiers`,
  `:examples`, `:throws`, `:docs`).
- **PRIMITIVE_REGISTRY** — JS-side primitives bound at module-load
  time, resolved at `langRuntime()` bootstrap (handle keyword →
  function value), затем sealed.
- **Двухфазный eval** — peggy parse полностью → post-pass
  декорация (`attachAstParents`, `assignAstNodeIds`,
  `decorateAstWithEffectMarkers`) → async tree-walker.
- **Conduit lexical scope** — envRef tie-the-knot, env
  захватывается на момент `let`-eval'а, не при invocation.
- **Doc-комменты на AST** — `entry.docs` через
  `MapEntryDocPrefix` (внутри Map'ов), `step.docs` через
  `DocAttachedSequence` (перед operand-call'ами), `foldEntryDocs`
  материализует MapEntry-docs в value-Map под `:docs` Vec строк.
- **Сериализация** — `printValue` (qlang rich, пытается
  round-trip), `toTaggedJSON` / `fromTaggedJSON` (lossless
  cross-process), `toPlain` / `json` (lossy plain JSON).
- **Snapshot и Function** — env-binding-only, не value-class
  в pipeValue.
- **Backtick** — единственный синтаксический символ, не
  используемый текущей грамматикой.

### I.2. Нерушимые инварианты

Эти свойства уже в коде, на них опираются дальнейшие решения.
В редизайне они **не должны** меняться.

- **env иммутабелен по ссылке.** `envSet` возвращает новый Map.
- **Eval strict left-to-right**, без backtracking, без re-eval
  AST-узла.
- **Литералы не имеют побочных эффектов на env.** Vocabulary /
  index / registry мутации через literal-eval запрещены.
- **Lexical scope.** Conduit / captured-arg lambda захватывают
  env на момент объявления, не call-site.
- **Forks.** env-write локально внутри `(...)`, `[...]`, `{...}`,
  `#{...}`, `!{...}`, `*`-distribute. Не вытекает наружу.
- **Effect-markers.** `@`-prefix propagation enforced parse-time
  (effect-check.mjs) + runtime safety net (evalOperandCall).
- **Per-site error class.** Один throw-site, один класс.
  `instanceof` + `.fingerprint` для observability.
- **Error value и trail иммутабельны.** Trail — frozen linked
  list, материализация в `!|` через append.
- **env — `Map<string, value>`.** Один namespace ключей-строк,
  без отдельных хранилищ для разных kind'ов binding'а. Поведение
  определяется значением через `:qlang/kind`-дискриминатор.
- **Четыре комбинатора** — `|`, `*`, `>>`, `!|`. Track-dispatch
  на success/fail плоскостях. Формальный закон, не меняется.
- **JSON ⊂ qlang грамматически.** JSON-литерал на входе валиден
  без обработки.
- **Coverage 100/100/100/100.** Lines / branches / functions /
  statements. Падение — блокер.

### I.3. Действующие проблемы

Каждая — нарушение базовой теоремы (см. §II.1) или критической
usability требования.

**I.3.1. Function в descriptor под `:qlang/impl`** — printValue
выдаёт `<function:count arity=1>`. Невалидный qlang. Round-trip
ломается. Модель не может скопировать descriptor через
`reify | json | parseJson | reify | eq`.

**I.3.2. Conduit в Map-value** — printValue выдаёт `let(:n,
body)` step-form. Это declaration-step, не value-form. Parse
+ eval даёт side-effect declaration, не Conduit-value back.
Live-нарушение round-trip для любого env-projection (например
`env | /someConduit`).

**I.3.3. AST-Map в trail/fault** — `:fault` хранит Map
`{:step <AST-Map> :input <pipeValue>}`. `:step` и trail-entries
— AST-Map'ы; printValue разворачивает каждый на 30+ строк
дерева. Failed `add(1)` нечитаемо. `:input` остаётся полезен
как есть — проблема только в форме `:step` и trail-entries.

**I.3.4. Doc-комменты в descriptor** — `foldEntryDocs`
материализует attached-docs в value-Map под `:docs` поле как
escape'нутые строки. Markdown с newlines становится
`"text\r\n  with \\n escapes"`. Author writes prose, runtime
stores garbage.

**I.3.5. Module AST после eval отбрасывается.** Source кода
нет в env после parse — только evaluated values. Axis-операнды
(`source`, `docs`) не имеют откуда читать, кроме как из embedded
field'ов в descriptor'ах (что само problem — см. I.3.4).

**I.3.6. `:examples` snippets — string-литералы кода.**
`{:doc "..." :snippet "[1 2 3] | count" :expected "3"}`. Snippet
— строка которую runtime парсит. Модель видит escape'нутую
строку, не код. Quote literal'ов нет.

**I.3.7. Keyword'ы без axis'ов — dangling pointers.**
`:TypeNotFound | reify` → `{:kind :value :type :keyword}` —
бесполезное three-field descriptor. 128 thrown-классов как
dead-end terms — модель видит keyword reference, не имеет
способа узнать что значит.

**I.3.8. Auto-lift JSON в qlang Map.** `parseJson` / CLI
script-mode auto-detect конвертирует JSON в qlang Map с keyword
keys. Output не JSON. JSON in → qlang out. `jq`-replacement
use case **не работает** — author piping JSON через qlang
получает qlang-форму с `:"..."` keyword'ами.

**I.3.9. Quoted keyword form** — `:"foo bar"`, `:""`, `:"$ref"`,
`:"123"` в keyword grammar существуют как цена возможности
лифтить JSON-keys (произвольные строки с пробелами, цифрами,
спецсимволами) в qlang keyword'ы. В обычном qlang code форма
не используется — pollute'ит keyword grammar edge-case'ами
ради JSON-конверсии. Пока explicit lift из JSON в qlang Map
остаётся (через operand типа `parseJson`) — quoted keyword form
остаётся как стоимость этой возможности. Устранение auto-lift'а
(I.3.8) уменьшает частоту появления quoted keyword'ов в output'е,
но не удаляет form из grammar.

**I.3.10. Гига-мэп core.qlang.** Один Map literal с десятками
descriptor'ов всех builtin'ов. Author не может заквотить
отдельный entry — `\`:filter {...}\`` не валидный qlang
(MapEntry — не standalone expression). Нет microincrement
evolution: добавление / удаление binding'а — правка большой
Map'ы. Doc-comments отрываются от source через `foldEntryDocs`.

---

## II. Целевое состояние

### II.1. Базовая теорема

Каждый value-class, который может появляться в pipeValue, имеет
**грамматический литерал**. Для любого вычисленного значения V:

```
parse(printValue(V)) → AST → eval → V'   ⟺   V ≡ V'
```

по содержимому (не по object identity). Round-trip тождественен.

Snapshot и Function — env-binding-only, теорема к ним не
применяется (они не value-class в pipeValue).

Два допустимых случая literal-формы:

- **(α) strict grammatical literal** — собственный AST-узел.
  Eval тривиально возвращает value через `eval*Lit`-handler,
  без operand-invocation. Примеры: `NumberLit`, `VecLit`,
  `MapLit` (вводимые ниже `QuoteLit`, `DocLit`, `CommentLit`,
  `TaggedLit`).
- **(β) round-trip-able expression-form** — `OperandCall`
  AST-узел. Eval invocate operand, результат тождественен V
  по содержимому. Operand должен быть в env при eval.

### II.2. Quote — frozen code-as-data

Quote — passive value-class содержащий frozen AST. Литерал —
backtick: `` `body` ``. Strict grammatical literal (α).

```qlang
`mul(2)`
`[1 2 3] | filter(gt(1))`
`{:label /label}`
```

Eval Quote'а — возвращает себя (passive). Чтобы выполнить
содержимое — `quote-value | eval`, который invocate AST против
текущего state.

**Назначение:** embedded source в descriptor'ах, errors, docs,
examples. Модель видит backtick → понимает что внутри
copy-pasteable qlang-код. Без backtick'а embedded source — это
String с escape-sequences, бесполезен.

**Round-trip.** `parse(\`mul(2)\`)` → QuoteLit AST → eval →
Quote-value → printValue → `\`mul(2)\``. Identity по содержимому
держится тривиально.

**Backtick содержит валидный qlang Pipeline** — расквотировав
content и вставив как source, оно парсится и эвалится. Внутри
— OperandCall'ы, литералы, ParenGroup'ы; никаких специальных
аннотаций.

**AST-узлы не отдельный value-class** — они frozen content
внутри Quote'а. Через `parse` operand source-string становится
Quote-value (frozen AST). Наружу всегда выходят как Quote.

### II.3. Tagged literals и type-level identifiers

`::tag<container>` — generic механизм для value-class литералов
через type-tag prefix + произвольный container. **Угловые скобки
`<...>` в этой документации — meta-placeholder для любого
Primary**; реальный syntax не несёт `<...>` — author пишет
напрямую `::duration{:hours 3}`, `::regex"^[a-z]+$"`,
`::bytes[72 101 108]`. Грамматика (Phase 6):
`TaggedLit = "::" Ident Primary`. Strict grammar literal (α)
— собственный AST-узел `TaggedLit`. Eval lookup'ит `::tag`
binding в env, invoke'ит constructor против payload. printValue
выпускает обратно ту же `::tag<payload>` форму.

```qlang
::duration{:hours 3}
::regex"^[a-z]+$"
::permitted-tags#{:read :write}
::bytes[72 101 108 108 111]
```

Container выбирается под natural fit для payload данного type'а
(Vec / Map / Set / String / Quote). Tag — что за value-class,
container — shape данных.

**Hierarchy `:` vs `::`.** `:foo` — value-level identifier
(keyword as value, Map key, identifier reference к value-binding).
`::foo` — type-level identifier (type tag, type reference,
type-binding). Разные namespace в env; `:duration` (value
binding) и `::duration` (type binding) могут coexist без
conflict'а.

`::` — load-bearing disambig. Без него `[:user :data
::permissions#{:read :write}]` становится ambiguous (`:data`
как keyword value vs как type-tag). С `::`: unambiguous,
visual hierarchy clean (colon-count → role).

**Constructor через subject-form.** Под капотом
`::tag<container>` semantically equivalent `payload | tag` —
operand под `::tag` namespace принимает payload как subject
и строит value. Symmetric с другими subject-form constructors
(`"name" | keyword`, `[items] | doc`).

**Базовые containers** (Vec, Map, Set, Error, Quote) имеют
compact shorthand'ы (`[...]`, `{...}`, `#{...}`, `!{...}`,
`` `...` ``) — frequent value-classes earned short syntax.
Новые value-classes — через verbose `::tag<container>` форму
до earn'ивания shorthand'а через usage.

#### II.3.1. Convention для tagged constructor / printer

TaggedLit eval flow:

1. Парсер строит `TaggedLit` AST с полями `tag` (Ident) и
   `payload` (Primary AST).
2. Eval payload по обычным правилам (inference §II.11.1
   применяется внутри payload independently). Получаем
   **payload-value**.
3. Lookup `::tag` в type-namespace env. Если binding
   отсутствует — `TaggedLitTagNotFound` error.
4. Резолюшен — descriptor type-binding'а это Map с
   `:qlang/kind :type`, `:qlang/impl :qlang/prim/<tag>`,
   опциональный `:spec`, `:docs`, `:examples`.
5. `:qlang/impl` keyword resolve'ится через
   `PRIMITIVE_REGISTRY` → **constructor function-value**.
6. (Optional) Generic spec-check: если descriptor содержит
   `:spec` — payload-value валидируется против spec
   до invocation. Несоответствие → `TaggedLitSpecMismatch`
   с structured context (`{tag, expectedSpec, actualValue}`).
7. Constructor invoke'ит `(payload) → value`. Может
   throw'ать дополнительные per-site error'ы (через
   `declareSubjectError` / `declareShapeError` /
   `declareModifierError` factories — те же что для обычных
   operand'ов).
8. Returned value становится pipeValue.

**Constructor signature:**

```js
// constructor : (payload) → value
//   payload — value, полученный после eval'а payload AST'а.
//   value  — любой qlang value-class.
//   Может throw'ать per-site error class extending QlangError
//   (lift на fail-track автоматически через evalNode try/catch).

import {
  declareSubjectError,
  isQMap,
  keyword,
  // ...
} from '@kaluchi/qlang-core';

const DurationPayloadNotMap = declareSubjectError(
  'DurationPayloadNotMap', '::duration', 'Map with :hours/:minutes');

PRIMITIVE_REGISTRY.bind('qlang/prim/duration', (payload) => {
  if (!isQMap(payload)) throw new DurationPayloadNotMap(payload);
  return Object.freeze(new Map([
    ['qlang/kind', keyword('duration')],
    ['hours',   payload.get('hours')   ?? 0],
    ['minutes', payload.get('minutes') ?? 0]
  ]));
});
```

**Round-trip через printValue.** Constructor возвращает Map с
`:qlang/kind :<tag-name>` discriminator (или value-class иной
shape). printValue видит `:qlang/kind :<tag>` keyword, не из
core-set'а (`:conduit` / `:snapshot` / `:builtin` / `:type`) —
диспатчит на **printer function** зарегистрированную под
convention'ом `:qlang/prim/<tag>/print`:

```js
PRIMITIVE_REGISTRY.bind('qlang/prim/duration/print', (value) => {
  return `::duration{:hours ${value.get('hours')} ` +
                    `:minutes ${value.get('minutes')}}`;
});
```

Если printer не зарегистрирован — fallback на generic
`::<tag>{<map-content>}` (printValue эмитит payload Map в
qlang-form).

**Pair-registration helper** для эмбеддера, чтобы не writing
два bind'а руками:

```js
import { defineTaggedType } from '@kaluchi/qlang-core';

defineTaggedType({
  tag: 'duration',
  spec: { /* optional shape descriptor */ },
  construct: (payload) => { /* ... */ },
  print:     (value)   => { /* ... */ },
});
// → bind'ит обе функции в registry под правильными ключами.
```

**Constructor может быть JS-side или qlang-side:**

- **JS-side** (для embedder'ов, host-нативные types):
  `:qlang/impl :qlang/prim/<tag>` keyword handle в descriptor'е,
  function зарегистрирована через `PRIMITIVE_REGISTRY.bind`.
- **qlang-side** (для user-defined domain types):
  `:constructor <Conduit-value>` в descriptor'е. Author
  пишет constructor прямо в qlang через `::conduit[[:payload]
  body]`. Никакого engineering wall'а между user и embedder
  — symmetric пути.

```qlang
|~~ Set permissions — only :read/:write/:delete allowed. ~~|
def(::permissions,
  {:qlang/kind :type
   :spec {:payload :set}
   :allowed #{:read :write :delete}
   :constructor ::conduit[[:payload]
     `payload | every(:permissions/allowed | has)
             | when(not, error({:kind :PermissionUnknown}))
             | payload`]})
```

`::permissions#{:read :write}` → constructor invoke с
payload Set, every-check проходит, returns payload. 
`::permissions#{:read :write :lie}` → fail, throws
`:PermissionUnknown` на fail-track.

**Composability — constructor может invoke другие
TaggedLit'ы внутри body** (recursive type system из qlang):

```qlang
def(::positiveInt, {:constructor ::conduit[[:n]
  `n | when(lt(0), error({:kind :NegativeNotAllowed})) | n`]})

def(::age, {:constructor ::conduit[[:n]
  `n | (::positiveInt) | when(gt(150), error({:kind :TooOld})) | n`]})
```

`::age 42` → ok (`42`). `::age -5` → throws
`:NegativeNotAllowed`. `::age 200` → throws `:TooOld`.

**Constructor invariants:**

- **Pure** в смысле no-side-effects on env / no I/O.
  Effectful constructor'ы — anti-pattern; такие types должны
  декларироваться через `@`-prefixed tag (`def(::@launch, ...)`).
  Effect-laundering invariant работает на type-level
  symmetrically с let/def: `def(::tag, {:constructor
  conduit-вызывающий-@hostOp})` без `@`-prefix tag'а →
  `:EffectLaunderingAtLetParse` (же mechanism что для regular
  let/def, расширенный на type-namespace).
- **Deterministic** по payload. Same payload → same value
  (round-trip integrity).
- Returned value — **frozen** (immutable, §I.2).
- Round-trip property: `parse(printValue(constructor(payload))) →
  TaggedLit AST → eval → equivalent value` (по §II.1
  базовой теореме).

#### II.3.2. Payload eval semantics — Smalltalk keyword-message style

`::tag<container>` — это **не литеральная статика**.
Container это **Primary expression** (по grammar
`TaggedLit = "::" Ident Primary`), который eval'ится по
обычным правилам, **с захватом outer pipeValue**.

Конкретно: payload может быть:

- **Map literal** `{:k1 expr1 :k2 expr2}` — каждое entry-value
  fork'ает sub-pipeline получая outer pipeValue в context'е.
  Inherited из `eval.mjs::evalMapLit`.
- **Vec literal** `[el1 el2 el3]` — каждый element fork'ает
  sub-pipeline.
- **Set / Error literal** — same forking semantics.
- **Inner TaggedLit** `::otherTag{...}` — eval'ится first
  (children before parents), result становится inner-value
  outer container'а.
- **Quote** `` `expr` `` — frozen code-as-data; constructor
  получает Quote-value, может lazy-eval отдельно.
- **Scalar / Keyword / Projection / OperandCall** — literal
  или sub-pipeline шаг.

**Captured pipeValue в payload — first-class:**

```qlang
{:name "alice"}
  | ::user{:name /name :access ::permissions#{:read :write}}
```

Eval flow:
1. Outer pipeValue = `{:name "alice"}`.
2. Inner Map `{:name /name :access ::permissions#{...}}`
   eval'ится:
   - Entry `:name /name` — sub-fork, `/name` против
     outer pipeValue → `"alice"`.
   - Entry `:access ::permissions#{:read :write}` — inner
     TaggedLit eval'ится first, constructor `::permissions`
     invoke с Set, returns validated permissions value.
3. Outer payload Map `{:name "alice" :access <permissions>}`
   готов.
4. Constructor `::user` invoke против этой Map'ы → user-value.

Никаких специальных правил для TaggedLit — composition
наследуется через стандартный fork-tree-walk eval.

**Smalltalk keyword-message-passing analogy.** Сравни:

| Форма | Семантика |
|---|---|
| `value \| op(arg1, arg2)` | OperandCall — positional args |
| `value \| ::tag{:k1 expr1 :k2 expr2}` | TaggedLit — keyword-keyed args (named slots) |

Дуальные. Для богатых domain-DSL keyword-message читается
лучше — author видит **named slots**, знает что куда идёт.
Positional хорош для математики (`add`, `mul`),
keyword-message — для domain construction.

**Distribute через TaggedLit естественно работает:**

```qlang
employees * ::employeeRecord{:id /id
                             :name /name
                             :salary mul(/baseSalary, 1.1)}
```

Каждый element distribute'а fork'ается, payload eval'ится
в context'е element'а, constructor валидирует, output Vec
validated employee records.

#### II.3.3. DSL templating через Doc-payload (золотая жила)

TaggedLit с **Doc-value payload** даёт натуральный DSL-templating
с **automatic parameter binding** — никакой string concatenation,
никакого manual escaping, никаких injection'ов.

Doc-content уже парсится parse-time в `:segments` Vec с
дискриминатором `:Prose` / `:Quote` / `:Assertion` (§II.5).
DSL-constructor walks segments, обрабатывает `:Quote`
сегменты как **interpolated parameter slots** —
evaluates Quote против outer pipeValue, binds result как
parameter, prose-сегменты идут как static text.

**Пример: SQL prepared statement без ручного escaping:**

```qlang
def(::sql,
  {:qlang/kind :type
   :spec {:payload :doc}
   :constructor ::conduit[[:payload]
     `payload | /segments
             | as(:parts)
             | { :sql      parts | * (if(/qlang/kind | eq(:Quote),
                                          "?",
                                          /text))
                                 | join("")
                :params   parts | filter(/qlang/kind | eq(:Quote))
                                 | * (/source | eval) }`]})
```

Author пишет SQL inline, native syntax, с qlang-выражениями
для параметров через backtick'и:

```qlang
{:userId 42 :status "active"}
  | ::sql|~~ SELECT *
              FROM users
             WHERE id = `/userId`
               AND status = `/status`
               AND created > `now() | minus(::duration{:days 7})` ~~|
```

Constructor walks Doc-segments, returns:

```qlang
{:sql    "SELECT * FROM users WHERE id = ? AND status = ? AND created > ?"
 :params [42 "active" <date-value>]}
```

— готовое prepared statement для DB driver. **Никакой
конкатенации, никакого escaping, никакого SQL injection
вообще возможен** — Quote-сегменты eval'ятся в qlang-стороне
до build'а query-string'а, results bind'ятся через `?`-плейсхолдеры.

**Same pattern для других DSL'ов:**

- **HTML / JSX templating:**
  ```qlang
  ::html|~~ <div class="`/className`">`/content`</div> ~~|
  ```
  Constructor escapes Quote-results через `htmlEntities`
  до splice'а в template — XSS protection из коробки.

- **Shell command building:**
  ```qlang
  ::shell|~~ git log --since=`/sinceDate` --author=`/author` ~~|
  ```
  Constructor shell-quote'ит Quote-results — command injection
  невозможен.

- **URL building:**
  ```qlang
  ::url|~~ https://api.com/users/`/id`/profile?token=`/token` ~~|
  ```
  Constructor URL-encode'ит Quote-results — ни spaces, ни
  special chars в path не проходят raw.

- **Path building, regex composition, log formatting** — same
  pattern.

**Это снимает целый класс vulnerabilities** (injection
семейство) на уровне language-mechanism, а не библиотек. Author
не может **случайно забыть escape** — eval Quote-сегмента
всегда даёт qlang-value, constructor всегда binds его как
parameter, не как raw text. Single source of truth — constructor
function.

И — ключевое: **author пишет в native domain syntax**
(SQL / HTML / shell — выглядят как сам этот язык),
parameter-interpolation через backtick — **читаемо**, не
обвешано ceremonial `${...}` или `printf`-подобной нотацией.

#### II.3.4. Lazy payload через Quote

Default eval — eager: payload вычисляется до constructor
invocation. Если constructor хочет deferred eval (например
для conditional / lazy patterns) — author оборачивает
expression в backtick:

```qlang
def(::lazy, {:constructor ::conduit[[:wrapped]
  `wrapped`]})  -- noop, просто хранит Quote

def(::cond, {:constructor ::conduit[[:branches]
  `branches | first(/condition | eval | isTruthy)
            | /body | eval`]})

::cond[{:condition `/age | gt(18)` :body `"adult"`}
       {:condition `true` :body `"minor"`}]
```

Constructor получает Vec branches с Quote-value'ями для
condition / body, eval'ит их selectively. Никакого grammar-
level lazy-flag'а — convention через Quote.

### II.4. Conduit — invokeable lexically-scoped value

Conduit — value-class содержащий frozen body + params +
lexical env (envRef) + опционально self-name. Invokeable через
identifier-lookup (когда binding'ится в env) или через
application.

**Литерал** — tagged literal (II.3) с tag `::conduit`. Payload —
**qlang Vec без commas** (по §II.11.1 запятая в Vec'е форсит
JSON Array, который не может содержать qlang-only элементы
типа Quote и keyword'ов):

```qlang
::conduit[[] `mul(2)`]
::conduit[[:pfx :sfx] `prepend(pfx) | append(sfx)`]
::conduit[:walk [] `{:label /label :children /children * walk}`]
```

Структура — Vec из 2 или 3 элементов:
- 2 elements `[params body]` — non-recursive.
- 3 elements `[:self-name params body]` — с self-name для
  recursion preservation.

Body — Quote-литерал (II.2) с frozen AST. Params — Vec
keyword'ов (опционально пустой `[]`). Self-name (опционально)
— Keyword.

**Self-name даёт recursion preservation.** Внутри body
identifier равный self-name resolve'ится через **local
tie-the-knot envRef'а**, не через external env. То есть
recursive Conduit invocable independently от binding context'а
— round-trip сохраняет recursion.

**Eval** строит Conduit-value с envRef = current env (lexical
capture at eval-time). printValue выпускает обратно tagged
literal — round-trip держится по содержимому (envRef может
отличаться через re-eval, по §2.1 это допустимо).

### II.5. Doc и Comment — content value-classes

**Doc** — value-class для markdown-content'а. **Comment** —
value-class для inline annotation. Оба эвалятся в pipeValue
в любой Primary-position, включая pipe-step head;
position-disambig нет — `2 | |~~ c ~~|` заменяет pipeValue
на Doc-value.

**Две входные формы, одна выходная:**

- **Block** (`|~~ ... ~~|` для Doc, `|~ ... ~|` для Comment)
  — output-canonical. printValue эмитит **только** block —
  держит multi-line content и round-trip'ится.
- **Line** (`|~~| ...` до newline для Doc, `|~| ...` до newline
  для Comment) — input-only удобство для редактора, как `//`
  в JS. printValue её никогда не выпускает (newline в content
  тут же закроет токен — round-trip multi-line content
  ломается).

Парсе обе формы строит одинаковый Doc/Comment-value —
различие только в source-syntax'е, не в семантике.

**Внутри композитных литералов** (Vec / Map / Set / Error)
doc-prefix к содержимому не привязывается. Doc/Comment внутри
литерала — только standalone value, становится элементом
контейнера.

**Doc-content узкий канон сегментов.** Парсится parse-time в
Vec структурных сегментов:

- `:Prose` — plain text.
- `:Quote` — `` `code` `` (same Quote value-class что II.2).
- `:Assertion` — `` `snippet` → `expected` `` (pair Quote-
  сегментов для example extraction через `runExamples`).

Остальное (keyword references, type tags, имена) — Prose
plain-text'ом. Модель распознаёт keywords / tags сама без
grammar-уровня дискриминации.

Doc-value хранит `:segments` Vec; навигация — `doc | /segments`
и фильтры по `:qlang/kind` сегмента. Comment-value хранит
plain string content без сегментирования.

### II.6. Declarative bindings — def, as

**Mathematica-style reading order.** Имя > спецификация >
реализация. Все declarative bindings декларируются через
`def(:name, ...)` в captured-form — имя первый captured-arg.

**`def` pipeline-transparent.** Subject pipeValue passes through
unchanged. Declaration consumes только captured-args и
attached doc-prefix; subject не используется как часть
declaration semantics.

**`def` semantics adapts по arity captured-args:**

- **1 captured-arg** (`:name`) — attached doc-prefix становится
  binding value (для guides / vocabulary entries / pure-doc
  binding'ов). Без attached doc — error.
- **2 captured-args** (`:name`, body) — body — implementation;
  attached doc — documentation about binding. Snapshot vs
  conduit определяется purity-analysis body AST'а: pure literal
  eval'ится at def-time и хранится как snapshot; impure body
  хранится как deferred AST для conduit invocation per lookup.
- **3 captured-args** (`:name`, params Vec, body) — parametric
  conduit; attached doc — documentation.

**`as(:name)` — subject-form для лифта pipeValue в env.** Тоже
env declaration, как и `def`, но другой surface — захватывает
текущий pipeValue snapshot'ом и связывает его с именем для
reuse в fan-out / cross-step reference. Quick scope-local
handle. Doc-attach допустим (через DocAttachedSequence II.7),
но обычно не используется — `as` для transient захватов в
середине pipeline'а.

**Type definitions через `def(::tag, descriptor)`** (II.3).
Descriptor — Map с `:qlang/kind :type`, `:qlang/impl
:qlang/prim/<tag>` (handle keyword в `PRIMITIVE_REGISTRY`,
тот же механизм что builtin descriptor'ов в
`core/lib/qlang/core.qlang`), `:spec` (ожидаемая shape
payload), `:docs`, `:examples`. function-value в descriptor
**не хранится** — это нарушает базовую теорему round-trip'а
(§I.3.1). User-space type'ы регистрируют constructor через
`PRIMITIVE_REGISTRY.bind('qlang/prim/<tag>', constructorFn)`
и ссылаются на handle keyword'ом из descriptor'а.

**Гига-мэп — antipattern.** Bindings декларируются
микро-инкрементами (по одному `def`-step), не одним Map
literal'ом. Map literal — для значений, не для контейнера
деклараций. Каждый builtin / vocabulary entry / error-class
/ type-alias — отдельный `def`-step с собственным attached
doc-prefix'ом и собственной AST-позицией.

### II.7. Doc-attach mechanism

**DocAttachedSequence — единственный grammar-механизм
doc-attach.** Паттерн `DocComment+ _L (DefCall / AsCall)` в
pipeline-position. AST OperandCall-узел `def` или `as` (II.6)
получает `.docs` — Vec строк в declaration order. Один doc-блок
— одна запись Vec'а; адъяцентные line-doc'и не конкатенируются.

```qlang
|~~ Pi constant ~~|
def(:pi, 3.14)

|~~ Doubles a number ~~|
def(:double, mul(2))

|~~ Wraps with prefix and suffix ~~|
def(:@surround, [:pfx :sfx], prepend(pfx) | append(sfx))
```

Перед любым другим OperandCall (`filter`, `mul`, …) doc-prefix
не ассоциируется — Doc становится standalone DocLit (II.5)
как первый pipe-step, следующий operand идёт отдельным шагом.

**Eval pure.** Runtime function-value не несёт `.docs`. AST-узел
хранит `.docs` для axis-операндов (II.8), которые читают через
module Quote'ы в env (II.9).

### II.8. Hypertext через axis-операнды

**Identity** — keyword (`:foo` value-level или `::foo`
type-level, II.3). **Reference** — keyword в pipeline / Map
value / Vec element. **Resolution** — env lookup → binding.
**Binding** — Map с structured fields (constructor / docs /
spec / examples / source). **Navigation** — axis-операнды.

Семейство axis-операндов: `source`, `docs`, `seeAlso`,
`describe`, `spec`, `examples`, `reify`. Каждый — stateOp с
доступом к env. Stateless по env (не пишут).

```qlang
:filter | docs           — value-level navigation
::duration | spec        — type-level navigation
:CountErrorFamily | docs — vocabulary entry navigation
```

**Token-density минимальна:**

```
::duration | docs        — 4 токена
:filter | examples       — 4 токена
::tag | spec             — 4 токена
```

Cheap inference для модели per metadata query. Universal
pattern `<keyword | tag> | <axis>` для всех named bindings.

**Multi-source aggregation.** Один keyword упомянутый в
нескольких модулях даёт Vec всех находок с атрибуцией
`{:from :ns :text "…"}`. Поиск по declaring `def`-step'ам
(II.6) с совпадающим `:name`.

### II.9. Spec внутри qlang

Документация — единый механизм: doc-prefix **над** `def`-step'ом
через DocAttachedSequence (II.7). Форма `def` адаптируется по
arity (II.6).

**Краткое описание binding'а** — 1-3 предложения над `def` с
body:

```qlang
|~~ Doubles a number. ~~|
def(:double, mul(2))
```

doc-prefix хранится на AST `def`-step'а как `.docs`, доступен
через axis-операнды (II.8). Body — implementation.

**Длинный гайд** — большое markdown-полотно над `def` без
body (1-arg form):

```qlang
|~~ # Error Handling Guide

Errors flow на fail-track через `!|`.

`expr !| /kind` → `:type-error`

... ~~|
def(:qlang/error-guide)
```

Здесь attached doc-prefix **становится** binding value (II.6,
1-arg form `def`). Lookup `:qlang/error-guide` возвращает
Doc-value напрямую.

Никаких отдельных namespace'ов / специальных модулей для
гайдов — гайд это обычный named binding под нужным keyword'ом,
content которого Doc-value.

**Cross-reference между keyword'ами** — через keyword в
Doc-content prose. Модель распознаёт references plain-text'ом.

**Имя binding'а — anchor;** docs / examples / source / spec —
рефлексивные projections с этого anchor'а через axis-операнды
(II.8).

**`qlang/ast/<uri>` — module Quote storage.** После load
module хранится как Quote-value (II.2) в env под ключом
`qlang/ast/<uri>`. Источник для axis-операндов: они ходят по
этой Quote'е, ищут declaring `def`-step'ы с совпадающим
`:name`, читают `.docs` / source / examples. `runtime/index.mjs`
(langRuntime) и module-loader сохраняют module Quote под этим
ключом.

### II.10. Errors — failure code как Quote'ы

Существующее (инварианты I.2): error — value на fail-track,
текут через `!|`, deflect'ятся success-track combinator'ами,
несут descriptor с `:kind`, `:thrown`, `:fault`, `:trail`.

`:fault` — Map `{:step <code> :input <pipeValue>}`. В текущей
реализации `:step` и trail-entries — AST-Map'ы; printValue
разворачивает каждый на 30+ строк дерева.

В редизайне:

- **`:fault.step` — Quote-value** с source failed step'а
  одной строкой backtick'ом. `:fault.input` форму не меняет
  (pipeValue который шаг получил).
- **`:trail` — один Quote-value** с source-кускoм всего
  pipeline-suffix'а после failed step'а. Combinator'ы между
  deflected step'ами **встроены в source** естественно — это
  валидный pipeline-fragment, не Vec обёрток. Если deflection
  не было (failed на последнем step'е) — `:trail null`.

Источник для trail-source: каждый success-track combinator при
deflect стампит свой `combinator-keyword` + `stepNode.text`
в `_trailHead` linked-list (механика существующая,
`appendTrailNode` в `types.mjs`). При `!|` materialize
склеивает накопленные fragment'ы в единую source-строку через
`COMBINATOR_SYNTAX` mapping (`pipe → '|'`, `distribute → '*'`,
`merge → '>>'`), оборачивает в Quote-value.

Quote с trail-source может начинаться с `*` или `>>` (если
первый deflected step распределялся / мерджил). Такой fragment
**не parse'ится как standalone Pipeline** (head должен быть
RawStep, не combinator). Quote хранит `.source` строкой, `.ast`
**lazy** — парсится при первом запросе через `quote | /ast` или
`quote | eval`. Для display (printValue) `.ast` не нужен.

Модель видит copy-pasteable suffix pipeline'а одной строкой —
может скопировать, prepend новый код, run заново; fault step
тоже Quote, тоже copy-pasteable. Никаких AST-Map'ов в errors.

**Примеры (после Phase 9):**

```
qlang> [1 "two" 3] | sum | mul(2) | count
!{
  :origin :qlang/eval
  :kind :type-error
  :thrown :SumElementNotNumber
  :message "sum: element 1 expects Number, got string"
  :operand "sum"
  :index 1
  :expectedType "Number"
  :actualType :string
  :actualValue "two"
  :fault {:step `sum` :input [1 "two" 3]}
  :trail `| mul(2) | count`
}

qlang> [1 "two" 3] | sum * inc | sort
!{ ... :fault {:step `sum` :input [1 "two" 3]}
   :trail `* inc | sort` }

qlang> [1 "two" 3] | filter(gt(2)) | count
!{ ... :thrown :GtOperandsNotComparable
   :leftType :string :leftValue "two"
   :rightType :number :rightValue 2
   :fault {:step `gt(2)` :input "two"}
   :trail `| count` }

qlang> [1 "two" 3] | sum
!{ ... :fault {:step `sum` :input [1 "two" 3]}
   :trail null }
```

### II.11. JSON-bridge

JSON и qlang — **два различимых типа** на parse-time и на
runtime. Pipeline никогда не лифтит между ними неявно;
каждый шаг preserve domain subject'а.

#### II.11.1. Parse-time inference

Парсер выводит тип каждого composite literal'а из локальных
синтаксических маркеров:

| Контейнер | JSON-marker | qlang-marker |
|---|---|---|
| Object/Map | `"key":` (string-key + `:`-разделитель) | `:keyword` (keyword-key) |
| Array/Vec | comma между элементами | whitespace-separated, без commas |

Парсер стрипит entries container'а, фиксирует mode по первому
маркеру, валидирует все остальные на consistency.

**Comma как маркер JSON-mode применяется ТОЛЬКО внутри
Vec/Array literal'ов и Map/Object literal'ов.** В OperandCall
ArgList (`def(:double, mul(2))`, `filter(/age, gt(18))`) и
других non-literal context'ах commas остаются обычным
optional separator'ом — не JSON-marker. То есть
`def(:foo, [1 2 3])` парсится: `def` operand с двумя args
(comma — arg-separator), второй arg — qlang Vec без commas
внутри.

**Mode-conflict в одном container'е — parse-error:**

- `{:a 1, :b 2}` — keyword-key (qlang) + comma (JSON) → conflict.
- `{"a": 1 "b": 2}` — string-key (JSON) + no-comma (qlang) → conflict.
- `[1, 2, :foo]` — comma (JSON Array) + keyword-as-value (qlang-only) → conflict.
- `[{:a 1}, {"b": 2}]` — outer Array commas (JSON), но первый
  element keyword-key Map (qlang) → conflict.

JSON-mode container содержит **только JSON-valid** values
(рекурсивно — JSON Object, JSON Array, scalar). qlang-only
element внутри JSON-mode parent — parse-error.

**Defaults для ambiguous (нет маркеров) — context-aware:**

- **Top-level** (нет parent container'а): default qlang.
  - `qlang '{}'` → qlang Map.
  - `qlang '[]'` → qlang Vec.
  - `qlang '[42]'` → qlang Vec (single element без commas).
- **Inner** (внутри parent container'а): **inherit** type от
  parent.
  - `{"users": []}` — outer JSON Object → inner `[]` JSON Array.
  - `{"users": [42]}` — inner `[42]` JSON Array (inherit).
  - `{:wrap []}` — outer qlang Map → inner `[]` qlang Vec.
  - `{:items [{"k": 1}]}` — inner `[{"k": 1}]` qlang Vec
    (inherit от qlang Map), внутри JSON Object element.
- JSON-empty / JSON-single на top-level — explicit через
  TaggedLit: `::json{}`, `::json[]`, `::json[42]`.

**Зачем context-aware:** paste'нутый JSON payload
`{"users":[{"name":"alice"}]}` парсится через всё дерево как
JSON. Без inheritance inner single-element `[{"name":"alice"}]`
становится qlang Vec на top-level правиле — type leakage в
середине дерева, JSON-purity ломается на первом single-element
шаге. С inheritance — JSON через всё дерево consistent.

Top-level default qlang оправдан тем что:
- `{} | use`, `let(:counter, {})`, `let(:bag, [])` — типичные
  qlang use case'ы без ceremony.
- §II.11 принцип «default JSON, qlang активируется явными
  маркерами» — про **non-empty containers с маркерами**.
  Empty не имеет маркеров, попадает в default-when-no-markers
  ветку, для которой qlang естественнее.

#### II.11.2. Runtime representation

| Value-class | JS runtime | Различение |
|---|---|---|
| qlang Map | `Map` instance (frozen) | `instanceof Map` |
| qlang Vec | plain Array (frozen, без Symbol-tag) | `Array.isArray && !v[JSON_ARRAY_TAG]` |
| qlang Set | `Set` instance (frozen) | `instanceof Set` |
| JSON Object | plain object (frozen, с `JSON_OBJECT_TAG` Symbol non-enumerable) | `typeof === 'object' && !Map/Set/Array && v[JSON_OBJECT_TAG]` |
| JSON Array | Array (frozen, с `JSON_ARRAY_TAG` Symbol non-enumerable) | `Array.isArray && v[JSON_ARRAY_TAG]` |

`JSON_OBJECT_TAG` и `JSON_ARRAY_TAG` — module-level Symbol
constants в `core/src/types.mjs`. Stamped на construction-time
через `Object.defineProperty` (non-enumerable, чтобы не
светить в `Object.keys` / `JSON.stringify`), затем
`Object.freeze`. После freeze tag не виден через обычный
inspection, но `instanceof`-style check видит.

Никаких wrapper-Map'ов с `:qlang/kind :json-shape`. Никаких
discriminator-полей внутри value. Различение через runtime-тип
естественно и hot-path-cheap.

#### II.11.3. Embedder API

Эмбеддер пишет операнды (например `@coverage`), которые
возвращают composite values. Чтобы вернуть качественно-
типизированное value, импортирует constructor helper'ы из
`@kaluchi/qlang-core`:

```js
import {
  makeJsonObject,    // (entriesObj) → frozen JSON Object с JSON_OBJECT_TAG
  makeJsonArray,     // (items) → frozen JSON Array с JSON_ARRAY_TAG
  // qlang-side: обычный new Map() / [] / new Set() — никаких helper'ов
} from '@kaluchi/qlang-core';

const coverageOp = nullaryOp('@coverage', async (subject) => {
  const raw = await readCoverageJson();           // plain JS data
  return makeJsonArray(raw.files.map(makeJsonObject));
  // ↑ возвращает JSON Array of JSON Objects;
  //   author получает JSON-form output естественно
});
```

Если эмбеддер хочет вернуть qlang-нативный Vec (например для
конструирования env-bindings), создаёт обычный `[...]` (или
`Object.freeze([...])`):

```js
const builtinsOp = nullaryOp('@builtins', async (_subject) => {
  return Object.freeze([
    Object.freeze(new Map([['name', 'count'], ['arity', 1]])),
    Object.freeze(new Map([['name', 'filter'], ['arity', 2]])),
  ]);  // qlang Vec of qlang Maps
});
```

Эмбеддер **выбирает** какой тип возвращать — runtime-различение
тем самым на стороне эмбеддера и видно через type-predicate
operand'ы (`isJsonArray`, `isMap`, etc.).

#### II.11.4. Type-predicates на новые классы

Дополняют существующее семейство `isString` / `isNumber` /
`isVec` / `isMap` / `isSet` / `isKeyword` / `isBoolean` /
`isNull`:

- `isMap(v)` — only qlang Map (`v instanceof Map`).
- `isVec(v)` — only qlang Vec (frozen Array без `JSON_ARRAY_TAG`).
- `isJsonObject(v)` — only JSON Object.
- `isJsonArray(v)` — only JSON Array.

Каждый total over всех value-class'ов, никогда не throws.

#### II.11.5. Pipeline behaviour

**Container-shape-preserving operand'ы** (`filter`, `take`,
`drop`, `distinct`, `reverse`, `flat`, projection через `/key`,
`*`-distribute, `>>`-merge) **preserve тип subject'а**:

- `{"a": {"b": 1}} | /a` → JSON Object `{"b": 1}` (один шаг
  projection, inner composite сам по себе JSON Object потому
  что был построен parser'ом таким на eval-time).
- `{"a": 1} | /a` → `1` (scalar — type-neutral).
- `{:a {:b 1}} | /a` → qlang Map `{:b 1}`.
- Multi-segment `/users/0/name` walks shаg за шагом, каждый
  шаг preserve type. Без silent lift'а.

**`*`-distribute и `>>`-merge сохраняют тип subject'а в
result'е.** Если body выдаёт element несовместимого типа
(qlang-only element при JSON Array subject) — **runtime
type-error** «cannot collect qlang-element into JSON Array».
Author явно cast'ит subject через `qlang` operand перед
`*` если нужно.

**Type-restricted operand'ы** (`use` qlang-only,
`keyword`-lift, `set`-conversion, `error`-lift) **loud-fail
на subject не своего типа.** Например `jsonObj | use` —
runtime type-error «use requires qlang Map, got JSON Object».
Author явно конвертит: `jsonObj | qlang | use`.

#### II.11.6. Conversion между типами

Только через **explicit operand или TaggedLit** — никогда
silently:

- **Pipeline-time:** subject-form operand'ы в **value-namespace**
  (`def(:qlang, ...)`, `def(:json, ...)`):
  - `value | qlang` — JSON Object/Array → qlang Map/Vec
    (string keys → keyword keys для Map, рекурсивно).
  - `value | json` — qlang Map/Vec → JSON Object/Array
    (keyword keys → string keys, рекурсивно).
- **Source-literal override** через TaggedLit в
  **type-namespace** (`def(::qlang, ...)`, `def(::json, ...)`):
  - `::qlang{"k": "v"}` — literal в qlang form.
  - `::json{:k "v"}` — literal в JSON form.

`:qlang`/`:json` (value-level operand'ы) и `::qlang`/`::json`
(type-level constructor'ы) — **разные binding'и в разных
namespace'ах env** (см. §II.3 hierarchy `:` vs `::`),
семантически симметричные. coexist'ят без conflict'а.

Inline lift конкретного value (без полной конверсии
container'а) — через `keyword`, `set`, `error` operand'ы
на нужном projection.

`jq`-replacement: `qlang '{...JSON...} | /path | filter(...)
* /name'` — JSON in (parser детектит), all preserve type
(projection / filter / distribute), JSON out (printValue
эмитит JSON form через runtime-тип). Author не делает
ничего специального.

#### II.11.7. Cross-process serialization

`toTaggedJSON` для cross-process payload (`codec.mjs`):

- JSON Object / JSON Array — сериализуются как **обычный
  JSON напрямую** (они уже JSON, никакого `$tag` не нужно).
- qlang-only типы — `$keyword`, `$map`, `$set`, `$error`,
  `$quote`, `$doc`, `$comment`, `$conduit`, `$tagged`.

`fromTaggedJSON` восстанавливает по тегам обратно в правильный
runtime-тип (qlang Map / Set / etc. для tagged variants;
plain object/array для bare JSON; tag stamping автоматически
при восстановлении JSON-form).

`toPlain` — plain JSON, lossy для qlang-only типов
(существующее поведение, не меняется).

**Дополнительные сериализаторы для cross-process:**

- `toTaggedJSON` — lossless tagged JSON. JSON-shape value
  сериализуется как обычный JSON напрямую (он уже JSON, никакой
  обёртки). Qlang-only типы — через `$keyword` / `$set` /
  `$error` / `$quote` / `$doc` / `$comment` / `$conduit` /
  `$tagged` теги, для qlang-aware peer'а.
- `toPlain` — plain JSON, lossy для qlang-only типов.

### II.12. Summary — value-classes и литералы

Все типы введены выше; таблица — quick-reference для review.

| Value-class | Литерал | Введено |
|---|---|---|
| `null` / `bool` / `number` / `string` | `null` / `true` `false` / `42` / `"text"` | базовые |
| `Vec` | `[el1 el2 ...]` | базовый |
| `Map` | `{:k v ...}` | базовый |
| `Set` | `#{el1 el2 ...}` | базовый |
| `Error` | `!{:k v ...}` | базовый |
| `Keyword` | `:foo` / `:ns/name` | базовый (без quoted form) |
| `Quote` | `` `body` `` | II.2 |
| `Doc` | `\|~~ content ~~\|` | II.5 |
| `Comment` | `\|~ content ~\|` | II.5 |
| `Conduit` | `::conduit[:self?, params, `body`]` | II.4 (tagged literal pattern из II.3) |
| Generic tagged | `::tag<container>` | II.3 |

Trail/fault entries — Quote-value'и (II.10). AST-узлы не
отдельный value-class — они frozen content внутри Quote'а
(II.2).

### II.13. Самопроверка инвариантов (anti-loss-from-compaction)

Консолидированный список ключевых invariant'ов с
тестируемыми ожиданиями. Если детализированные verify-секции
в Phase'ах потеряются от compaction, этот блок остаётся
single-source-of-truth для каждого core invariant'а.

**Round-trip каждого value-class'а** (§II.1 базовая теорема):

```
qlang '42 | json | parseJson | eq(42)'                 → true
qlang '"x" | json | parseJson | eq("x")'               → true
qlang ':foo | json | parseJson | eq(:foo)'             → true
qlang '[1 2 3] | json | parseJson | eq([1 2 3])'       → true
qlang '{:k 1} | json | parseJson | eq({:k 1})'         → true
qlang '#{:a :b} | json | parseJson | eq(#{:a :b})'     → true
qlang '!{:k 1} | json | parseJson | eq(!{:k 1})'       → true
qlang '`mul(2)` | json | parseJson | eq(`mul(2)`)'     → true
qlang '|~~ d ~~| | json | parseJson | reify | /type'   → :doc
qlang '|~ c ~| | json | parseJson | reify | /type'     → :comment
qlang '::conduit[[] `42`] | json | parseJson | reify | /kind' → :conduit
qlang '{"k":"v"} | json | parseJson | isJsonObject'    → true
qlang '[1,2,3] | json | parseJson | isJsonArray'       → true
```

**Type-purity preservation через projection** (§II.11):

```
qlang '{"users":[{"name":"alice"}]} | /users/0/name'   → "alice"
qlang '{"users":[{"name":"alice"}]} | /users/0'        → {"name":"alice"}
qlang '{:users [{:name "alice"}]} | /users/0'          → {:name "alice"}
qlang '{"a":{"b":{"c":1}}} | /a/b/c'                   → 1
qlang '{"a":{"b":{"c":1}}} | /a/b'                     → {"c":1}
```

**Type-purity preservation через filter / distribute / merge:**

```
qlang '[1,2,3] * mul(2)'                                → [2,4,6]    (JSON)
qlang '[1 2 3] * mul(2)'                                → [2 4 6]    (qlang)
qlang '[1,2,3] | filter(gt(1))'                         → [2,3]      (JSON)
qlang '[1 2 3] | filter(gt(1))'                         → [2 3]      (qlang)
qlang '[[1,2],[3,4]] >> sum'                            → 10          (scalar)
```

**Type-mismatch loud-fail (никакого silent lift'а):**

```
qlang '[1,2,3] * (as(:x) | x | reify)'  → !{:thrown :CollectKindMismatch ...}
qlang '{"k":1} | use'                    → !{:thrown :UseSubjectNotMap ...}
qlang '[{:a 1}, {"b":2}]'                → parse-error mode-conflict
qlang '{:a 1, :b 2}'                     → parse-error mode-conflict
```

**Type-conversion explicit:**

```
qlang '{"k":1} | qlang | isMap'                         → true
qlang '{:k 1} | json | isJsonObject'                    → true
qlang '::qlang{"k":1} | isMap'                          → true
qlang '::json{:k 1} | isJsonObject'                     → true
```

**Doc-attach только к def/as** (§II.7):

```
qlang '|~~ doc ~~| def(:x, 42) | reify(:x) | /docs | first' → "doc"
qlang '|~~ doc ~~| as(:y) | reify(:y) | /docs | first'      → "doc"
qlang '|~~ doc ~~| filter(...)' → Doc-value standalone, filter отдельный шаг
qlang '{|~~ doc ~~| :k 1}' → parse-error (no MapEntryDocPrefix)
```

**Errors через Quote** (§II.10):

```
qlang '"x" | add(1) !| /fault/step'              → `add(1)` (Quote)
qlang '"x" | add(1) !| /fault/input'             → "x"
qlang '"x" | add(1)              !| /trail'      → null
qlang '"x" | add(1) | mul(2)     !| /trail'      → `| mul(2)` (Quote)
qlang '"x" | add(1) * inc | sort !| /trail'      → `* inc | sort` (Quote)
qlang '"x" | add(1) !| /fault/step | /source'    → "add(1)" (String)
```

**Module Quote доступен** (§II.9):

```
qlang 'env | /qlang/ast/qlang/core | reify | /type'    → :quote
qlang 'env | /qlang/ast/qlang/core | /source | contains("def(:count")' → true
```

**Axis-операнды** (§II.8):

```
qlang ':filter | docs | first | /text | contains("predicate")' → true
qlang ':count  | source | reify | /type'                       → :quote
qlang '::duration | spec | isMap'                              → true
```

**Two-namespace coexist** (§II.3):

```
qlang 'def(:foo, 42) | def(::foo, {:qlang/kind :type ...}) | :foo'  → 42
qlang 'def(:foo, 42) | def(::foo, {:qlang/kind :type ...}) | ::foo | reify | /kind' → :type
```

**Effect-laundering safety net по-прежнему живой** (§I.2 invariant):

```
qlang 'let(:safe, @hostOp)' → !{:thrown :EffectLaunderingAtLetParse}
qlang 'let(:@safe, @hostOp)' → ok
```

**Microincrement quotability** (§II.6):

```
qlang 'env | /qlang/ast/qlang/core | /source | contains("def(:filter")' → true
qlang ':filter | source | /source | startsWith("def(:filter")'         → true
```

**Bare type-keyword vs TaggedLit** (§II.3, Phase 6):

```
qlang '::duration'                  → bare type-keyword reference
qlang '::duration{:hours 3}'        → TaggedLit (constructor call)
qlang '::duration | reify | /kind'  → :type
```

**Trail-Quote source-fragment** (§II.10, Phase 9):

```
qlang '"x" | add(1) | mul(2) | count !| /trail | /source'
  → "| mul(2) | count"

qlang '"x" | filter(gt(2)) | count !| /trail | /source'
  → "| count"
```

**TaggedLit composability — captured pipeValue в payload**
(§II.3.2):

```
qlang '{:n 5} | ::pair{:original /n :doubled mul(/n, 2)}'
  → ::pair{:original 5 :doubled 10}

qlang '[1 2 3] * ::wrap{:value /. :double mul(/., 2)}'
  → [::wrap{:value 1 :double 2} ::wrap{:value 2 :double 4}
     ::wrap{:value 3 :double 6}]
```

**TaggedLit nesting — recursive constructor invocation**
(§II.3.2):

```
def(::positiveInt, {:constructor ::conduit[[:n]
  `n | when(lt(0), error({:kind :NegativeNotAllowed})) | n`]})

qlang '::positiveInt 42'              → 42
qlang '::positiveInt -5  !| /kind'    → :NegativeNotAllowed
qlang '::positiveInt 0'               → 0
```

**DSL templating — automatic parameter binding** (§II.3.3):

```
qlang '{:userId 42}
       | ::sql|~~ SELECT * FROM users WHERE id = `/userId` ~~|
       | /sql'
  → "SELECT * FROM users WHERE id = ?"

qlang '{:userId 42}
       | ::sql|~~ SELECT * FROM users WHERE id = `/userId` ~~|
       | /params'
  → [42]
```

**Effect-laundering на type-level** (§II.3.1):

```
qlang 'def(::launchMissile,
            {:constructor ::conduit[[:p] `p | @nukeApi`]})'
  → !{:thrown :EffectLaunderingAtLetParse}

qlang 'def(::@launchMissile,
            {:constructor ::conduit[[:p] `p | @nukeApi`]})'
  → ok
```

**Constructor JS-side vs qlang-side — symmetric:**

```
qlang ':conduitTagged | reify | /constructor | reify | /kind'
  → :conduit  (user-defined constructor через qlang Conduit)

qlang ':primTagged | reify | /qlang/impl | reify | /type'
  → :keyword  (host-defined constructor через :qlang/prim/<tag>
              handle, не function-value напрямую)
```

### II.14. Обоснования ключевых решений

**Quote, не AST-Map наружу.** AST-Map в pipeValue — serialized
Map-tree, читать невозможно для модели. Quote (`\`source\``) —
одна строка кода, copy-pasteable. Модель видит code как code.
Errors с Quote'ами — модель сразу понимает failed code и может
extend / fix.

**`::tag`, не `#tag` или другой prefix.** `::` aligns с
keyword family — `:foo` / `::foo` — visual hierarchy value vs
type через colon-count. Single literal root — value-level и
type-level identifier'ы parallel'ны. Namespacing inheritance
из keyword grammar (`::qlang/conduit`, `::jdt/method-skeleton`).

**Microincrements, не гига-мэп.** Гига-мэп — Map literal с
десятками declarations. Не quotable (entry — не valid qlang
standalone). Doc-comments отрываются через foldEntryDocs.
Microincrement: каждый `def`-step — отдельная AST-позиция,
quotable, doc-comments сохраняются на declaring-step'е.

**`def` captured-form (name first), не subject-form.**
Mathematica-style reading order: имя сразу видно author'у,
spec/impl после. Pipeline-transparency (subject passes through)
— `def` declarative side-effect, не value-construction.
`as` отдельно — другой concern (pipeValue capture).

**Узкий canon Doc-content (только Prose / Quote / Assertion).**
Парсер один общий rule per-сегмент. Keywords / tags / имена
в content — модель распознаёт сама из plain-text. Без
disambiguation parser-уровня (URLs с `:`, prose с двоеточиями
— collision-free).

**JSON остаётся JSON.** `jq` use case требует JSON in → JSON
out. Auto-lift в qlang Map ломает этот use case. Explicit lift
через operand — author явно решает.

**Quote сохраняется, отдельно от Conduit.** Quote — passive
frozen code (для embedding в descriptor'ы / errors / docs).
Conduit — invokeable lexically-scoped (с params + envRef).
Они related (Quote — building block для Conduit body), но
разные value-classes.

**Two-namespace env (`:` / `::`), не один.** `::` — load-bearing
disambig. Position-dependent rules для распознавания tag vs
keyword brittle. С `::`: unambiguous, visual hierarchy clean.

---

## III. План реализации

Этапы упорядочены по зависимостям. Каждый имеет проверяемый
verification.

### Phase 0 — printValue cleanups

**Что:**

- `core/src/runtime/format.mjs::printFunction` — вместо
  `<function:name arity=N>` выпускать `:qlang/prim/<name>`
  keyword.
- Очистка escape'нутых строк в `:docs` field для tests /
  observability (временное решение до Phase 4).

**Зависимости:** нет.

**Verify:** `qlang 'reify(:count) | json | parseJson |
reify(:count) | eq'` — round-trip workable.

### Phase 1 — Quote literal

**Что:**

- Grammar `QuoteLit = "\`" content:Pipeline "\`"`.
- AST node `QuoteLit`; codec `astNodeToMap` / `qlangMapToAst`
  обновлён.
- Quote value-class в `types.mjs`: `describeType('Quote')`,
  `typeKeyword(:quote)`, `isQuote` predicate, `deepEqual` по
  source-string'у (структурное сравнение через сравнение
  source-text'ов; ast lazy и не сравнивается).
- Constructor `makeQuote(source, astOpt)`. Хранит `.source`
  всегда, `.ast` lazy — парсится при первом `/ast` projection
  или `eval` invocation. Source-only Quote (без обязательного
  parse'а) нужен для trail-fragment'ов которые могут начинаться
  с combinator'а (`* inc | sort`) и не парсятся как standalone
  Pipeline (см. Phase 9).
- `printValue` Quote — backtick form, эмитит `.source`.
- Codec: `{"$quote": "source"}`.
- Highlight token kind `'quote'`.

**Зависимости:** Phase 0.

**Verify** (соломка инвариантов):

- **Round-trip.** `qlang '\`mul(2)\`'` → `` `mul(2)` ``.
  Парсер строит QuoteLit, eval возвращает Quote-value,
  printValue эмитит обратно backtick + source.
- **Eval-через-Quote.** `qlang '5 | \`mul(2)\` | eval'` →
  `10`. Quote eval'ится против текущего pipeValue (`5`).
- **Quote как passive value на pipeline.** `qlang '\`mul(2)\` |
  /source'` → `"mul(2)"` (Quote — Map-like value со полем
  `:source`). `qlang '\`mul(2)\` | /ast'` — lazy parse,
  возвращает AST-Map узла Pipeline.
- **Round-trip через codec.** `qlang '\`mul(2)\` | json |
  parseJson | eq(\`mul(2)\`)'` → `true` (cross-process
  fidelity).
- **deepEqual по source-string.** `qlang 'eq(\`mul(2)\`,
  \`mul(2)\`)'` → `true`. `qlang 'eq(\`mul(2)\`,
  \`mul(3)\`)'` → `false`.
- **describeType / typeKeyword.** `qlang '\`x\` | reify |
  /type'` → `:quote`. `qlang '\`x\` | isQuote'` → `true`.
- **Quote с произвольным content'ом.** `qlang
  '\`[1 2 3] | filter(gt(1))\` | eval'` → `[2 3]`.
- **Highlight token kind.** В источнике `[1 2] | \`code\` |
  count` диапазон от опена-backtick до закрывающего получает
  kind `'quote'`.

### Phase 2 — Doc / Comment value-class

**Что:**

- Grammar `DocLit` / `CommentLit` как Primary (literal-везде).
- Doc / Comment value-class в `types.mjs`. Обновить
  `describeType`, `typeKeyword`, `equality.deepEqual` для
  обоих новых классов.
- `printValue` Doc / Comment — соответствующая literal-form.
- `codec.toTaggedJSON` / `fromTaggedJSON`: `{"$doc": "source"}`
  и `{"$comment": "source"}` для cross-process round-trip.
- Doc-content parser (canon: `:Prose`, `:Quote`, `:Assertion`).
  Doc-value хранит `:segments` Vec.
- `runExamples` через `:Assertion` сегменты.

**Зависимости:** Phase 1 (Quote-сегменты в Doc-content).

**Verify** (соломка инвариантов):

- **Doc value-class в pipeline.** `qlang '|~~ hello ~~| | reify
  | /type'` → `:doc`. `qlang '2 | |~~ replace pipeValue ~~|'`
  → Doc-value (pipeValue заменён, position-disambig нет).
- **Comment value-class.** `qlang '|~ note ~| | reify | /type'`
  → `:comment`.
- **Block vs line форма — output-canonical через block.**
  `qlang '|~~| oneliner'` → `|~~ oneliner ~~|` (line-form
  парсится, но printValue эмитит block-form как canonical).
- **Doc-content сегменты.**
  `qlang '|~~ Keeps :vec items. \`[1 2 3] | filter(gt(1))\` →
  \`[2 3]\` ~~| | /segments | count'` → `5` (Prose, Quote
  отсутствует [keyword `:vec` живёт в Prose], Prose, Assertion,
  Prose). `qlang '|~~ assertion only \`a\` → \`b\` ~~| |
  /segments | filter(/qlang/kind | eq(:Assertion)) | count'`
  → `1`.
- **Inline composites не attach'ат doc-prefix.** `qlang
  '[|~~ doc ~~| 42]'` → `[<Doc-value> 42]` (Doc — element
  Vec'а, не attach к `42`). Аналогично для Map / Set / Error.
- **Codec round-trip.** `qlang '|~~ x ~~| | json | parseJson |
  reify | /type'` → `:doc`.
- **runExamples из Assertion.** Descriptor с attached
  doc-comment'ом содержащим `\`[1 2 3] | count\` → \`3\``:
  `descriptor | runExamples | first | /ok` → `true`.

### Phase 3 — DocAttached cleanup

**Что:**

- Удалить `MapEntryDocPrefix` правило из `grammar.peggy`.
- Удалить `foldEntryDocs` из `eval.mjs`.
- DocAttachedSequence ограничить только `def` / `as`
  operand-call'ы: `DocComment+ _L (DefCall / AsCall)`.

**Зависимости:** Phase 4 (def operand) **и** Phase 5
(microincrement core.qlang). Phase 3 удаляет
`MapEntryDocPrefix` — пока core.qlang в форме гига-мэпа,
docs MapEntry-уровня обязаны существовать (иначе
`core/test/unit/core-catalog.test.mjs` отвалится). Phase 3
выполняется после того, как core.qlang переписан в серию
`def`-step'ов с doc-атрибуцией через DocAttachedSequence.

**Verify:**

- `core/test/unit/core-catalog.test.mjs` проходит без
  `foldEntryDocs` — все builtin descriptor'ы получают docs
  через DocAttachedSequence над `def`-step'ом.
- `qlang '{|~~ this would have attached ~~| :k 1}'` —
  doc-prefix внутри Map literal'а **больше не attach'ится**
  к entry. Парсер либо рассматривает Doc как standalone
  value-element и rejects (Doc не является валидным MapEntry
  key), либо `MapEntryDocPrefix` правило удалено и парсер
  вообще не пытается. Concrete shape ошибки уточнить при
  реализации.
- `qlang '|~~ doc ~~| filter(...)'` — DocAttachedSequence
  применяется **только** перед `def`/`as`. Перед другими
  OperandCall — Doc становится standalone DocLit (первый
  pipe-step), `filter` идёт следующим step'ом.

### Phase 4 — `def` operand

**Что:**

- Новый builtin `def`. Captured-form `def(:name, body)` /
  `def(:name, [:p], body)` / `def(:name)` с attached doc.
- Pipeline-transparent (pipeValue passes through).
- Purity-analysis для 2-arg form: body состоит только из
  литералов рекурсивно → snapshot (eval at def-time); body
  содержит OperandCall / Projection / ParenGroup → conduit
  (deferred AST). 3-arg form всегда conduit.
- `let` deprecate (заменить core.qlang usage на `def`).
- `as` остаётся как есть.

**Зависимости:** Phase 1 (Quote для body), Phase 2 (Doc для
1-arg form).

**Verify:**

- **2-arg conduit path.** `qlang 'def(:double, mul(2)) | 5 |
  double'` → `10`. Body `mul(2)` содержит OperandCall →
  conduit → invoke per-lookup.
- **2-arg snapshot path.** `qlang 'def(:pi, 3.14) | :pi'` →
  `3.14`. Body `3.14` — pure literal → snapshot → eval at
  def-time, бинд-значение.
- **2-arg conduit с partial application.** `qlang 'def(:next,
  add(1)) | 5 | next'` → `6`.
- **3-arg parametric.** `qlang 'def(:@surround, [:pfx :sfx],
  prepend(pfx) | append(sfx)) | "x" | @surround("[", "]")'`
  → `"[x]"`. Всегда conduit (params implies invocation).
- **1-arg pure-doc.** `qlang '|~~ Pi ~~| def(:piDoc) | :piDoc
  | reify | /type'` → `:doc` (attached doc стал binding value).
- **1-arg без attached doc — error.** `qlang 'def(:noDoc)'`
  → error `:DefMissingDocOrBody`.
- **Pipeline-transparent.** `qlang '42 | def(:x, 99)'` → `42`
  (pipeValue не меняется, declaration consumes только
  captured-args).
- **Purity-criterion granularity.** `qlang 'def(:onlyLits,
  [1 2 {:k :v}]) | :onlyLits'` → `[1 2 {:k :v}]` (snapshot,
  все литералы). `qlang 'def(:withCall, [1 2 (mul(2))]) | 5 |
  withCall'` — body содержит ParenGroup с OperandCall →
  conduit. `qlang '5 | withCall'` → `[1 2 10]`.
- **Doc-attach round-trip полный** проверяется в Phase 8.

### Phase 5 — Гига-мэп → microincrements

**Что:**

- Переписать `core/lib/qlang/core.qlang` из одного Map literal'а
  в серию `def`-step'ов.
- Каждый builtin — отдельный `def(:name, descriptor)`.
- Vocabulary entries (errors, types) — отдельные `def`-step'ы.
- `langRuntime()` bootstrap eval'ит серию step'ов вместо одного
  Map literal'а.

**Зависимости:** Phase 4 (def operand).

**Verify:**

- `npm test` — все existing tests проходят (zero regression
  на builtin descriptor surface).
- `qlang 'manifest | count'` возвращает то же число
  binding'ов что и до Phase 5 (количество builtin'ов
  сохраняется — переписан только container, не surface).
- `qlang 'reify(:count) | /docs | first'` — тот же текст
  что был во старом `core.qlang` под `:count` doc-prefix'ом
  (docs мигрировали через DocAttachedSequence без потерь).
- `qlang 'reify(:count) | /examples | count'` — то же число
  examples что было.
- **Quotability microincrement'а.** В `core.qlang` каждый
  builtin теперь — отдельный `def`-step, доступный
  через source-fragment lookup из axis-операнд'ов (Phase 8).
  Старый гига-мэп этого не позволял (entry — не valid qlang
  standalone).

### Phase 6 — Tagged literals + type system

**Что:**

- Grammar:
  - `TaggedLit = "::" tag:Ident container:Primary` — с
    payload, ordered-choice first.
  - `BareTypeKeyword = "::" Ident` — без следующего Primary,
    fallback. Для identifier-references на type-binding
    (например `::duration | spec`).
- Two-namespace env (`:` value-level, `::` type-level).
- `def(::tag, descriptor)` для type definitions; descriptor —
  Map с `:qlang/kind :type`, `:qlang/impl :qlang/prim/<tag>`
  handle (не function-value, §II.6 invariant), опциональный
  `:spec` (shape ожидаемого payload), `:docs`, `:examples`.
- TaggedLit eval (§II.3.1):
  1. Eval payload AST → payload-value.
  2. Lookup `::tag` в type-namespace env (`TaggedLitTagNotFound`
     если absent).
  3. Resolve `:qlang/impl` через `PRIMITIVE_REGISTRY` →
     constructor function.
  4. Optional spec-check (`TaggedLitSpecMismatch` если
     payload не соответствует `:spec`).
  5. Invoke constructor(payload-value) → result-value.
- Constructor / printer pair-registration через
  `defineTaggedType` helper (§II.3.1). Built-in tagged types
  (`::conduit`, `::qlang`, `::json`) регистрируются через
  тот же helper.
- Conduit literal `::conduit[:self? params body]` —
  constructor строит Conduit-value с runtime-shape
  `:qlang/kind :conduit`, printer эмитит обратно
  `::conduit[...]` форму (новая каноническая, replaces
  `let(:n, body)` step-form).
- `qlang` / `json` — пара constructor'ов рекурсивно
  конвертирующих между qlang Map/Vec и JSON Object/Array
  (§II.11.6).
- Effect-decorator (`effect-check.mjs::decorateAstWithEffectMarkers`)
  walk'ит payload TaggedLit'а — effectful identifier'ы внутри
  propagate marker на TaggedLit-узел и далее наверх.
- Codec для `$tagged` (generic) / `$conduit` (specialised для
  recursive через self-name): сериализация/десериализация
  TaggedLit-built value'ев через cross-process boundary.

**Зависимости:** Phase 1 (Quote для body), Phase 4 (def для
type declarations).

**Verify:**

- **TaggedLit construction.** `qlang 'def(::duration,
  {:qlang/kind :type :qlang/impl :qlang/prim/duration ...}) |
  ::duration{:hours 3} | /hours'` → `3` (constructor получает
  payload и возвращает Map с поле `:hours`).
- **Two-namespace coexist.** `qlang 'def(:foo, 42) |
  def(::foo, {:qlang/kind :type ...}) | [:foo ::foo]'` →
  два разных binding'а в одном Vec'е без conflict'а.
- **Bare type-keyword vs TaggedLit.** `qlang ':foo | reify'`
  через value-namespace; `qlang '::foo | reify'` через
  type-namespace (lookup'ит `::foo` binding). Парсер
  ordered-choice: TaggedLit first (требует Primary после
  Ident'а), fallback на bare type-keyword если Primary нет.
- **Conduit-as-TaggedLit литерал.** `qlang '::conduit[[]
  \`mul(2)\`] | reify | /type'` → `:conduit`.
  `qlang '5 | (::conduit[[] \`mul(2)\`])'` — application
  inline conduit через ParenGroup → `10`.
- **Recursive conduit с self-name.** `qlang
  '{:label "root" :children []} | (::conduit[:walk []
  \`{:label /label :children /children * walk}\`])'` —
  walk-конструктор работает тривиально на пустых children;
  на `{:label "a" :children [{:label "b" :children []}]}`
  возвращает то же дерево.
- **Effect-decoration через TaggedLit payload.** `qlang
  'let(:safeOp, ::conduit[[] \`@hostCall\`])'` → error
  `:EffectLaunderingAtLetParse` (effect-marker найден внутри
  payload TaggedLit'а, propagate к outer let-binding).
- **Codec round-trip Conduit.** `qlang 'def(:walk, ::conduit
  [:walk [] \`...\`]) | reify(:walk) | json | parseJson |
  reify(:walk) | eq'` — full lossless через `$conduit`
  tagged JSON form.
- **Constructor требует `:qlang/impl` handle.** Если
  descriptor содержит function-value напрямую под
  `:constructor` или `:qlang/impl` — это нарушение
  invariant'а (function-value не round-trip через
  printValue). Verify через self-check: `manifest * /qlang/impl
  * isString | every(eq(true))` (или аналог через keyword
  test) — все handle'ы должны быть keyword'ами `:qlang/prim/...`,
  не function-value.

### Phase 7 — Module Quote storage в env

**Что:**

- `langRuntime()` после parse сохраняет module как Quote-value
  под `qlang/ast/qlang/core` в env.
- `resolveNamespaceEnv()` при `use(:ns)` тоже сохраняет module
  Quote.
- `session.mjs::cellHistory` опционально сохраняет cell-level
  Quote'ы.

**Зависимости:** Phase 1 (Quote value-class).

**Verify:**

- **Core module Quote доступен.** `qlang 'env |
  /qlang/ast/qlang/core | /source'` возвращает source-text
  всего `core/lib/qlang/core.qlang`.
- **Quote — frozen Quote-value.** `qlang 'env |
  /qlang/ast/qlang/core | reify | /type'` → `:quote`.
- **Lazy AST доступ.** `qlang 'env | /qlang/ast/qlang/core |
  /ast | /qlang/kind'` → `:Pipeline` (или `:MapLit` если
  core.qlang один Map literal до Phase 5; после Phase 5 —
  `:Pipeline` из последовательности `def`-step'ов).
- **Use-loaded module тоже сохраняется.** `qlang 'use(:my/lib)
  | env | /qlang/ast/my/lib | /source'` returns module
  source после load.
- **Reserved namespace.** Ключи `qlang/ast/<uri>`,
  `qlang/locator`, `qlang/vocabulary` — runtime housekeeping,
  не подлежат user-binding (collision risk). `qlang
  'let(:qlang/ast/foo, 42)'` — либо silent-allow (override
  housekeeping, потенциально опасно) либо warn'ing. Concrete
  policy уточнить при реализации.

### Phase 8 — Axis-операнды

**Что:**

- Новые axis-операнды: `docs`, `source`, `seeAlso`, `describe`,
  `spec`, `examples`. State-op (доступ к env).
- Реализация — ходят по `qlang/ast/<uri>` Quote'ам, ищут
  binding by name, читают `.docs` / source / examples.
- Multi-source aggregation в `docs` operand'е.
- `reify` обновлён под новую structure.

**Зависимости:** Phase 7 (Module Quote в env).

**Verify:**

- **Value-level navigation.** `qlang ':filter | docs'` →
  Vec из `{:from <ns> :text "..."}` записей (multi-source
  aggregation если `:filter` documented в нескольких
  модулях; обычно один — core).
- **Type-level navigation.** `qlang '::duration | spec'` →
  Map описывающий expected payload shape для `::duration`
  TaggedLit'а.
- **Source axis.** `qlang ':filter | source'` → Quote-value
  с source declaring def-step'а из `core.qlang`.
- **Examples axis.** `qlang ':count | examples | first |
  /snippet | eval | eq(/expected | eval)'` — каждый example
  parses, evaluates, matches expected.
- **Multi-source aggregation.** Если `:keyword` documented в
  двух модулях (`core.qlang` + `domain/foo.qlang`):
  `:keyword | docs | count` → `2`, каждая запись с
  `:from` атрибутом.
- **reify обновлён.** `qlang 'reify(:filter) | /docs'` —
  возвращает то же что `:filter | docs`. Backward compat
  через reify сохранён.

### Phase 9 — Errors через Quote

**Что:**

- `eval.mjs::buildFaultMap` строит `:step` как Quote-value
  (`makeQuote(stepNode.text)`) вместо AST-Map.
  `:input` форму не меняет.
- `eval.mjs::trailEntry` упрощается — больше не вызывает
  `astNodeToMap`, возвращает легковесный
  `{ combinator: combinatorKind, text: stepNode.text }`.
- Mapping table `COMBINATOR_SYNTAX = { pipe: '|', distribute:
  '*', merge: '>>' }` рядом с `applyCombinator` (или в
  `types.mjs`).
- `types.mjs::materializeTrail` собирает накопленные fragment'ы
  из `_trailHead` linked-list, склеивает через
  `${COMBINATOR_SYNTAX[c]} ${text}` join'ом, оборачивает в
  Quote-value через `makeQuote`. Empty trail → `null`.
- `applyFailTrack` (eval.mjs:267) уже materializes trail на
  dispatch-time — без изменений в самой функции; просто получит
  Quote-value (или null) вместо Vec'а AST-Map'ов в combinedTrail.
  Stamping back на descriptor `:trail` остаётся.
- printValue error — выводит `:fault {:step \`code\` :input val}`
  одной строкой когда возможно (inline через printMapLike), и
  `:trail \`pipeline-suffix\`` или `:trail null`.

**Зависимости:** Phase 1 (Quote value-class с lazy `.ast` —
trail-source может начинаться с `*` / `>>`, parse'ится только
при явном `quote | eval` или `quote | /ast`).

**Verify:**

- `qlang '"hello" | add(1)'` → `:fault {:step \`add(1)\`
  :input "hello"}` `:trail null`.
- `qlang '"hello" | add(1) | mul(2)'` → `:trail \`| mul(2)\``.
- `qlang '"hello" | add(1) | mul(2) | count'` → `:trail
  \`| mul(2) | count\``.
- `qlang '[1 "two" 3] | sum * inc | sort'` → `:trail
  \`* inc | sort\`` (combinator-info preserved через source).
- `qlang '"hello" | add(1) !| /fault/step'` → `` `add(1)` ``.
- `qlang '"hello" | add(1) | mul(2) !| /trail'` →
  `` `| mul(2)` ``.

### Phase 10 — JSON default + qlang opt-in

**Что:**

- Grammar split с inference-маркерами (см. §II.11.1):
  - `JsonObjectLit` — string-keys с `:`-разделителем; commas
    обязательны между entries (≥2 entries).
  - `JsonArrayLit` — commas обязательны между entries (≥2 elements).
  - `MapLit` — keyword-keys; whitespace-separated.
  - `VecLit` — whitespace-separated, без commas.
  - Mode-conflict в одном container'е (mixed key-styles или
    mixed separators) — parse-error в semantic predicate
    после сбора entries.
  - Empty `{}`, `[]`, single-element без commas — context-aware
    default (см. §II.11.1): top-level → qlang; inner → inherit
    type от parent container'а.
- Eval строит runtime-типы согласно §II.11.2:
  - `MapLit` → `Object.freeze(new Map([...]))`.
  - `VecLit` → `Object.freeze([...])` (plain Array, без tag).
  - `JsonObjectLit` → frozen plain object с `JSON_OBJECT_TAG`
    Symbol non-enumerable.
  - `JsonArrayLit` → frozen Array с `JSON_ARRAY_TAG` Symbol.
- `core/src/types.mjs` — экспортит `JSON_OBJECT_TAG`,
  `JSON_ARRAY_TAG` Symbol constants; constructor helper'ы
  `makeJsonObject(plainObj)` / `makeJsonArray(items)`;
  predicates `isJsonObject(v)` / `isJsonArray(v)`. `isMap` /
  `isVec` уточняются — only qlang variants (Map instance / Array
  без JSON_ARRAY_TAG).
- `parseJson` и CLI script-mode auto-detect: возвращают
  JSON Object / JSON Array через `makeJsonObject` /
  `makeJsonArray`.
- Container-shape-preserving operand'ы — runtime dispatch
  внутри: смотрят runtime-тип subject'а (Map vs plain
  object vs Array vs JSON-tagged Array), работают над
  каждым через native API (`.get` / property-access /
  index-access), result строят того же типа — иначе
  type-error. Helper'ы `runtime-type.mjs` `containerKindOf(v)` /
  `makeOfKind(kind, items)` единая точка для dispatch.
- `printValue` dispatches по runtime-типу — JSON Object /
  JSON Array → JSON-form; Map / Set / Vec / etc. → qlang-form.
  Без `:qlang/kind` ковыряний.
- Subject-form `qlang` / `json` operand'ы: рекурсивная
  конверсия Object↔Map, Array↔Vec через всё дерево.
- TaggedLit'ы `::qlang<...>` / `::json<...>` (через Phase 6
  mechanism) — author-side literal override.
- `effect-check` / `walk` / `equality` / `codec` обновлены
  под новые AST node types и runtime-типы.
- Quoted keyword form (`:"foo bar"`) остаётся как стоимость
  lift'а JSON-keys в qlang keyword'ы через `qlang` operand.

**Breaking changes (отметить в release-notes / migration guide):**

- `isMap(v)` теперь возвращает `false` для JSON Object —
  только qlang Map. Existing user code `filter(isMap)` который
  ранее проходил оба типа теперь надо заменить на
  `filter(or(isMap, isJsonObject))` или сделать explicit
  conversion subject'а.
- `isVec(v)` аналогично — only qlang Vec. JSON Array отскакивает.
- Comma в qlang Map / Vec literal'е (например `{:a 1, :b 2}` или
  `[1 2, 3]`) — раньше парсилась как whitespace-equivalent,
  сейчас parse-error. Существующий code в `core.qlang` /
  embedded modules / тестах надо проскрейпить и убрать запятые
  из qlang-mode container'ов.
- Container-shape-preserving operand'ы (`count`, `empty`,
  `first`, `last`, `at`, `sum`, `min`, `max`, `filter`,
  `every`, `any`, `groupBy`, `indexBy`, `sort`, `sortWith`,
  `take`, `drop`, `distinct`, `reverse`, `flat`, `keys`,
  `vals`, `has`, set ops) — расширяются на JSON Object /
  JSON Array через runtime-type dispatch (см. §II.11.5).
  Operand'ы возвращают тот же container-тип что subject.
- **Новый per-site error class:** `CollectKindMismatch` —
  throws когда `*` / `>>` body выдаёт element несовместимого
  типа с subject container'ом (subject JSON Array, body
  qlang-only result).
- `set` operand (Vec → Set lift) — qlang-only (Set не
  существует в JSON). JSON Array | set → runtime type-error.
  Author явно: `jsonArr | qlang | set`.

**Зависимости:** Phase 6 (tagged literal mechanism для
`::qlang` / `::json` TaggedLit'ов; subject-form `qlang` /
`json` operand'ы от Phase 6 независимы).

**Verify** (output формы — JSON vs qlang — наблюдается через
печать, не через projection внутреннего discriminator'а):

- `qlang '{"k": "v"}'` → `{"k": "v"}`.
- `qlang '{:k "v"}'` → `{:k "v"}`.
- **Projection respect'ит JSON-shape рекурсивно:**
  - `qlang '{"users":[{"name":"alice"}]} | /users/0/name'` →
    `"alice"`.
  - `qlang '{"users":[{"name":"alice"}]} | /users/0'` →
    `{"name":"alice"}` (**не** `{:name "alice"}` — JSON
    preserved через projection).
  - `qlang '{"users":[{"name":"alice"}]} | /users'` →
    `[{"name":"alice"}]`.
- **Qlang-shape тоже preserved:**
  - `qlang '{:users [{:name "alice"}]} | /users/0'` →
    `{:name "alice"}`.
- **Distribute и filter сохраняют domain:**
  - `echo '{"users":[{"name":"alice"},{"name":"bob"}]}' | qlang '/users * /name'`
    → `["alice","bob"]` (JSON form).
  - `qlang '{"users":[{"age":25},{"age":15}]} | /users | filter(/age | gte(18))'`
    → `[{"age":25}]`.
- **Conversion explicit:**
  - `qlang '{"k": "v"} | qlang'` → `{:k "v"}`.
  - `qlang '{:k "v"} | json'` → `{"k": "v"}`.
- **TaggedLit literal-override** (реальный syntax — без
  угловых скобок, см. §II.3):
  - `qlang '::qlang{"k": "v"}'` → `{:k "v"}` (payload
    JSON Object, constructor конвертит в qlang Map).
  - `qlang '::json{:k "v"}'` → `{"k": "v"}` (payload qlang
    Map, constructor конвертит в JSON Object).
- **Mode-conflict — parse-error:**
  - `qlang '{:a 1, :b 2}'` → parse-error «mixed JSON/qlang
    in container» (keyword-key + comma).
  - `qlang '{"a": 1 "b": 2}'` → parse-error (string-key +
    no-comma).
  - `qlang '[1, 2, :foo]'` → parse-error (comma JSON Array +
    keyword-as-value qlang-only).
  - `qlang '[{:a 1}, {"b": 2}]'` → parse-error (outer JSON
    Array, first element qlang Map).
- **Context-aware default для inner empty/single:**
  - `qlang '{"users": []}'` → JSON Object с inner JSON Array
    empty (inherit от parent).
  - `qlang '{:wrap []}'` → qlang Map с inner qlang Vec
    (inherit).
  - `qlang '{}'` → top-level qlang Map.
  - `qlang '[]'` → top-level qlang Vec.
- **type-predicates различают:**
  - `qlang '{"a": 1} | isJsonObject'` → `true`.
  - `qlang '{"a": 1} | isMap'` → `false`.
  - `qlang '{:a 1} | isMap'` → `true`.
  - `qlang '{:a 1} | isJsonObject'` → `false`.
  - `qlang '[1, 2, 3] | isJsonArray'` → `true`.
  - `qlang '[1 2 3] | isVec'` → `true`.
  - `qlang '[1 2 3] | isJsonArray'` → `false`.
- **Heterogeneous qlang Vec.**
  - `qlang '[{:a 1} {"b": 2}] | filter(isMap)'` → `[{:a 1}]`
    (filter различает qlang Map от JSON Object).
  - `qlang '[{:a 1} {"b": 2}] | filter(isJsonObject)'` →
    `[{"b": 2}]`.
- **`*`/`>>` collide-detection:**
  - `qlang '[1, 2, 3] * (as(:x) | x | reify)'` → runtime
    type-error «cannot collect qlang-element into JSON Array»
    (subject JSON Array, body выдаёт qlang descriptor Map).
  - `qlang '[1, 2, 3] | qlang * (as(:x) | x | reify)'` —
    explicit cast subject в qlang перед distribute → OK,
    result qlang Vec of descriptor Maps.
- **`use` qlang-only:**
  - `qlang '{:k 42} | use | k'` → `42`.
  - `qlang '{"k": 42} | use'` → runtime type-error «use
    requires qlang Map».
  - `qlang '{"k": 42} | qlang | use | k'` → `42` (explicit
    convert).

### Phase 11 — Content rewrite + docs sync

**Что:**

- core.qlang — каждый builtin descriptor содержит attached
  doc-comment с inline assertions (через `:Assertion` сегменты).
- Поля `:examples`, `:returns`, `:modifiers` пересмотреть
  (remove или migrate в Doc-content).
- Vocabulary entries (`:CountSubjectNotContainer`, etc.) —
  отдельные `def`-step'ы с docs.
- jdt graph.qlang / coverage.qlang — переписать под новую
  structure.
- **`docs/qlang-spec.md`** — переписать под новый surface:
  Quote литерал, `::tag<container>` TaggedLit, two-namespace
  env, Conduit как `::conduit[...]` литерал, Doc/Comment
  value-classes, `:fault/step` поле, JSON-bridge default
  поведение. Старые описания (let-form, MapEntryDocPrefix,
  AST-Map в errors) удалить — спека всегда-была-такой.
- **`docs/qlang-internals.md`** — переписать evaluation-model:
  TaggedLit eval через `:qlang/impl` resolution, Quote eval
  trivial-passive, runtime-type dispatch для JSON Object /
  JSON Array vs qlang Map / Vec через `containerKindOf`,
  `makeOfKind`, Symbol-tag invariants.
- **`docs/qlang-operands.md`** — каталог axis-операнд (`docs`,
  `source`, `seeAlso`, `describe`, `spec`, `examples`),
  `qlang` / `json` conversion-pair, обновить `parse` / `eval`
  под Quote-в-Quote-out, `def` под captured-form, удалить
  `let` запись.
- **`core/src/session.mjs`** — расширить `serializeSession`
  / `deserializeSession`: добавить `kind: 'type'` для
  type-binding'ов (созданных через `def(::tag, descriptor)`
  в Phase 6) или routing через `value`-shape с recovery по
  `:qlang/kind :type` discriminator'у в descriptor'е. Тестовый
  case: восстановленная сессия после Phase 6 type-definition
  должна успешно invoke'ить TaggedLit constructor сквозь
  serialize/deserialize round-trip.

**Зависимости:** Phase 5, Phase 8, Phase 9, Phase 10.

**Verify:** `qlang 'manifest * (runExamples * /ok) | flat |
distinct'` returns `[true]` — все примеры catalog'а корректны.
`grep -E "MapEntryDocPrefix|let\(|<function:" docs/qlang-*.md`
— нет упоминаний удалённых конструкций в spec-документах.

### Phase 12 — End-to-end verify

**Что:**

- `npm test` — все workspaces зелёные.
- Coverage 100/100/100/100 (lines / branches / functions /
  statements) согласно invariant'у §I.2.
- **Catalog self-test:** `qlang 'manifest *
  (runExamples * /ok) | flat | distinct'` → `[true]` —
  каждый assertion в каждом builtin docstring'е проходит.
- **jdt q интеграция:** ручная проверка
  `jdt q '"X" | @sourceCard'`, `jdt q '"X" | @hierarchyCard'`
  дают rich Doc-output (Doc value-class через axis-операнд)
  для модели; в выводе backtick-Quote'ы для code-сегментов
  и markdown-form для prose.
- **LLM agent test:** модель получает rich error через
  `!| @explainError`, читает Quote'и в `:fault/step` и
  source-suffix в `:trail`, пишет recovery pipeline без
  фолбэка.
- **Round-trip invariant catalog:** `qlang 'manifest *
  (reify | json | parseJson | reify | eq) | distinct'` →
  `[true]` — каждый descriptor round-trip'ится через codec
  без потерь (Quote / Doc / Comment / TaggedLit / Conduit
  все survive serialization).
- **Grep удалённых конструкций:** `grep -rE
  "MapEntryDocPrefix|foldEntryDocs|<function:" core/src/`
  — нет вхождений (mechanism полностью убран).
- **Effect-laundering safety net по-прежнему loud-fail.**
  `qlang 'let(:safe, @hostOp)'` → `:EffectLaunderingAtLetParse`.

**Зависимости:** все предыдущие.

**Verify:** все checks выше пройдены, jdt релиз размещается.

### Граф зависимостей

```
Phase 0 (printValue cleanups)
   ↓
Phase 1 (Quote)
   ├─→ Phase 2 (Doc / Comment)
   ├─→ Phase 4 (def operand)
   │      ↓
   │   Phase 5 (Гига-мэп → microincrements)
   │      ↓
   │   Phase 3 (DocAttached cleanup — после Phase 5,
   │            когда core.qlang уже в форме def-step'ов)
   │      ↓
   │   Phase 6 (Tagged literals + type system)
   │      ↓
   │   Phase 10 (JSON через ::qlang/::json TaggedLit + qlang/json operand'ы)
   ├─→ Phase 7 (Module Quote в env)
   │      ↓
   │   Phase 8 (axis-операнды)
   └─→ Phase 9 (Errors через Quote)
            ↓
         Phase 11 (Content rewrite + spec/internals/operands docs)
            ↓
         Phase 12 (End-to-end verify)
```

Phase 1 — корень. Phase 5 — gate для Phase 3 (нельзя удалить
`MapEntryDocPrefix` пока core.qlang ещё гига-мэп). Phase 6 — gate
для tagged-based mechanisms (Phase 10 опирается). Phase 11 — после
большинства, включает rewrite docs/qlang-spec.md / qlang-internals.md
/ qlang-operands.md под новый surface. Phase 12 — финал.
