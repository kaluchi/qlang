# RFC: Hypertext qlang — Quote type, doc-on-keyword, vocabulary

Status: draft
Scope: `core/` language changes (grammar, types, eval, printValue)

---

## Problem

After eval, qlang loses the structural richness of its source:

- **Doc-comments** fold into `:docs ["escaped\r\n string"]` — dead
  text, keywords inside are characters not values, formatting
  destroyed by escape sequences.
- **Code examples** trapped in `:snippet "string"` — must
  `parse(string) | eval` to execute, display shows quote-in-quote
  mess, no way to embed qlang code as a value without going through
  a string.
- **Keywords** are dangling pointers — 113 thrown-class keywords,
  16 category keywords, ~10 type keywords, all resolve to
  `{:kind :value :type :keyword}` via `reify`. No docs, no
  references, no landing page.
- **Conduits** in Map value positions render as `let(:name, body)` —
  a pipeline step, not a valid Map value literal.
- **Functions** render as `<function:name arity=N>` — not a valid
  qlang literal, breaks Map printing.
- **AST-Maps** in error descriptors (`:fault/step`, `:trail`
  entries) render as 50-line nested Map trees instead of the
  one-line source text they carry in `:text`.

Root cause: the language has no literal form for
**code-as-data** (Quote) and no mechanism for
**keyword metadata** (vocabulary). printValue doesn't
reconstruct doc-comments or function keywords from their
post-eval representations. Doc-comments attach to MapEntries
(grammar `MapEntryDocPrefix`), not to keywords — so keywords
outside MapEntry key position lose docs entirely.

---

## Hard invariants

1. **Zero doc-comment stripping.** Every doc-comment present in
   source survives eval and appears in printValue output.
   Top-level doc-comments on keywords, nested doc-comments on
   keywords inside Vecs/Sets/Maps, multiple doc-comments on
   the same keyword — all preserved. If the author wrote 5
   doc-comments, all 5 render.

2. **printValue output is valid qlang.** For every value type,
   `printValue(v)` produces a string that parses back via
   `parse`. No `<function:...>`, no `[object Map]`, no
   `let(:name, body)` in Map value position.

3. **Zero overhead when reflection not used.** Module ASTs
   stored at load time (parse already paid). Vocabulary index
   built lazily on first reify call. No per-eval-step overhead
   for non-reflective pipeline execution.

4. **Computational model unchanged.** Resolution pass stays.
   `evalOperandCall` dispatch stays. State pair
   `(pipeValue, env)` unchanged. All changes are in grammar,
   printValue, and reflective operand impls.

---

## Changes

### 1. Quote — 6th value type

A frozen, parsed-but-unevaluated fragment of qlang source.

**Literal syntax**: backtick-delimited.

```qlang
`42`
`[1 2 3] | filter(gt(1))`
`{:name "alice" :age 30}`
`mul(2)`
```

Single backtick spans lines — no separate multiline form needed.

**AST node type**: `QuoteLit` (follows `*Lit` convention:
`NumberLit`, `StringLit`, `VecLit`, `MapLit`, `ErrorLit`).

**Internal representation**:
`{ type: 'quote', ast: <AST-Map>, source: <string> }`.
The source is parsed at parse-time (syntax errors caught early)
and immediately converted to AST-Map form via `astNodeToMap` so
`eval` receives it without a separate conversion step. The source
string is the original text between backticks.

**printValue**: renders as `` `source text` ``. Round-trips through
parse.

**Pipeline behavior**: flows on success-track like any value. No
special combinator.

**Operations**:

| Operation | Result |
|---|---|
| `eval` | Quote's `.ast` is an AST-Map — `eval` operand accepts it directly (same dispatch as hand-built AST-Maps). No new dispatch arm needed. |
| `/text` | source text as String (also visible via printValue) |
| `/ast` | the AST-Map for structural navigation |
| `eq` | structural comparison: `deepEqual` on the `.ast` AST-Maps, ignoring `.source` (two Quotes with different whitespace but same AST are equal) |
| `toPlain` | source string (lossy — Quote identity lost, same as keyword → colon-prefixed string) |

**Where it unblocks**:

- Conduit as Map value: zero-arity `` :double `mul(2)` `` — name
  from Map key, body from Quote, no duplication. Parametric
  conduits carry the full `let` form inside the Quote:
  `` :@surround `let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))` ``
  — name duplicated because params+body+name have no anonymous
  literal form.
- Inline code in doc-comments (see §3).
- AST-Maps in error descriptors: printValue renders any Map
  carrying `:qlang/kind` + `:text` as `` `text` `` instead of
  the full AST tree. `:fault` and `:trail` entries become
  one-line Quotes.

**Type system impact**: every type-dispatching site needs a Quote
branch — `describeType`, `typeKeyword`, `printValue`, `toPlain`,
`toTaggedJSON`, `fromTaggedJSON`, `deepEqual`. AST traversal:
`astChildrenOf` (Quote body is a child), `astNodeToMap` /
`qlangMapToAst` (QuoteLit ↔ AST-Map codec), `AST_KIND_TO_TYPE`.
Tokenizer: `highlight.mjs` needs a `'quote'` token kind for
QuoteLit spans. Effect-check: `decorateAstWithEffectMarkers`
does NOT descend into Quote bodies (frozen code, effects fire
only on `eval`). `FORK_ISOLATING_AST_TYPES` includes `QuoteLit`
(let/as inside a Quote body are inert and must not leak to
outer scope via `bindingNamesVisibleAt`). All eight existing
`is*` classifiers naturally return `false` for Quote. New
classifier `isQuote` added alongside them in `predicates.mjs`,
registered in `PRIMITIVE_REGISTRY`, entry in `core.qlang`.

**Grammar**: backtick is currently unused. Inside backticks,
content is parsed as `Pipeline` (full form, with comment
absorption — a Quote can contain `|~~ doc ~~|` steps, which is
essential for quoting module fragments that carry doc-comments).
Nesting: N backticks open, N backticks close (markdown rule).
Two levels sufficient.

```
QuoteLit
  = "`" content:Pipeline "`"

Primary
  = ParenGroup / ErrorLit / SetLit / VecLit / MapLit
  / QuoteLit
  / Projection / OperandCall / Scalar
```

---

### 2. Doc-comments attach to keywords (not MapEntries)

**Grammar change.** `MapEntryDocPrefix` removed from grammar.
`foldEntryDocs` removed from `eval.mjs`. Doc-comments attach
to **keywords** directly, in any position — Vec elements, Set
elements, Map values, Map keys, pipeline position, standalone.

Current grammar (removed):
```
MapEntry
  = docs:MapEntryDocPrefix? _L key:Keyword __ value:PipelineInLiteral
```

New grammar — `DocKeyword` recognized in `Scalar`:
```
DocKeyword
  = docs:DocComment+ _ kw:Keyword
  { return { ...kw, docs: docs.map(d => d.content) }; }

Scalar
  = StringLit / NumberLit / BooleanLit / NullLit
  / DocKeyword
  / Keyword
```

`MapEntry` simplified — no `MapEntryDocPrefix`:
```
MapEntry
  = _L key:Keyword __ value:PipelineInLiteral
  / _L key:StringLit _L ":" _L value:PipelineInLiteral
```

Doc-comments before a MapEntry key keyword are consumed by
`DocKeyword` inside the `Keyword` position. The keyword AST
node carries `.docs`. The MapEntry has no separate docs field.

**In `:throws` Vec**:
```qlang
:throws [
  |~~ Name arg was not a keyword. ~~|
  :LetNameNotKeyword
  |~~ Params not a Vec of keywords. ~~|
  :LetParamsNotVecOfKeywords
  |~~ Fewer than 2 captured args. ~~|
  :LetBodyMissing]
```

**In `:category` value**:
```qlang
:category |~~ Operands that keep or test items by predicate:
              :filter, :every, :any. ~~|
          :container-selector
```

**In `:subject` Vec**:
```qlang
:subject [|~~ Ordered indexed finite sequence. ~~| :vec
          |~~ Insertion-ordered associative container. ~~| :map
          |~~ Unordered unique collection. ~~| :set]
```

**Standalone in pipeline**:
```qlang
|~~ Operands that keep or test items by predicate. ~~|
:container-selector
```

**Eval**: keyword with `.docs` evaluates to plain keyword value
(no runtime behavioral difference) AND registers docs in
vocabulary registry `env["qlang/vocabulary"]`. The vocabulary
registry is a `Map<keywordName, docsVec>`. Accumulated across
module loads — each documented keyword adds its docs to the
registry. Registration is a side-effect of evaluating a
documented keyword.

**`foldEntryDocs`**: deleted entirely.
**`MapEntryDocPrefix`**: deleted from grammar.

**`reify(:keyword)`**: checks vocabulary registry in env. If
keyword has docs, returns them. No `:docs` field on any value.

**printValue**: when rendering a keyword, checks vocabulary
registry. If docs exist, emits `|~~ content ~~|` before the
keyword. Works at any nesting depth — Vec element, Map value,
Map key, Set element, standalone.

---

### 3. Rich doc-comment content — structured segments

Doc-comment content (`|~~ ... ~~|`, `|~~| ...`) is currently
parsed as a flat string `(!"~~|" .)*`. Extend the grammar to
recognize structured segments inside the content.

**Four segment types**:

| Segment | Syntax inside comment | Parsed as |
|---|---|---|
| prose | everything not matched below | String |
| keyword ref | `:name` (`:` + identifier-start) | Keyword value |
| quote | `` `qlang code` `` | Quote value |
| assertion | `` `snippet` → `expected` `` | Map `{:snippet Quote :expected Quote}` |

Grammar sketch:

```
BlockDocContent
  = segments:DocContentSegment*

DocContentSegment
  = DocAssertion
  / DocQuote
  / DocKeywordRef
  / DocProse

DocAssertion
  = snippet:DocQuote _ "→" _ expected:DocQuote

DocQuote
  = "`" Pipeline "`"

DocKeywordRef
  = ":" NamespacedName
  / ":" KeywordName

DocProse
  = (not-keyword-start, not-backtick, not-closer)+
```

`→` is U+2192, grammar-level (not convention).

**Result**: doc-comment content parses into a Vec of segments.

**Example** — source:

```qlang
|~~ Keeps items of :vec, :set, or :map where the predicate
    is truthy.

    `[1 2 3 4 5] | filter(gt(2))` → `[3 4 5]`
    `{:a 1 :b 2 :c 3} | filter(gt(1))` → `{:b 2 :c 3}`

    Throws :FilterSubjectNotContainer ~~|
```

Parsed segments:

```
prose("Keeps items of ")
keyword(:vec)
prose(", ")
keyword(:set)
prose(", or ")
keyword(:map)
prose(" where the predicate\n    is truthy.\n\n    ")
assertion(:snippet `[1 2 3 4 5] | filter(gt(2))`
          :expected `[3 4 5]`)
prose("\n    ")
assertion(:snippet `{:a 1 :b 2 :c 3} | filter(gt(1))`
          :expected `{:b 2 :c 3}`)
prose("\n\n    Throws ")
keyword(:FilterSubjectNotContainer)
```

**Impact on `runExamples`**: extracts assertion segments from
vocabulary registry docs. `snippet | eval`, `expected | eval`,
`deepEqual`. Standalone Quotes without `→` are demo examples
(parse-verify only).

**Impact on `:examples` field**: removed. Examples live in
doc-comments as inline assertions.

---

### 4. printValue reconstruction

**Hard invariant: zero doc-comment stripping.** Every doc-comment
present in source survives eval and appears in printValue output.
Top-level doc-comments on keywords, nested doc-comments on
keywords inside Vecs/Sets/Maps, multiple doc-comments on the
same keyword — all preserved. If the author wrote 5 doc-comments
on a keyword, all 5 render.

printValue changes so that post-eval values render as close to
source form as possible. Goal: `env | inter(#{:count})` prints
valid, readable qlang that parses back to the same value.

**4a. Keyword docs → `|~~ ~~|` prefix**

printValue checks vocabulary registry for each keyword rendered.
If docs exist, emits `|~~ content ~~|` before the keyword.
Multiple docs = multiple `|~~ ~~|` blocks. Recursive into nested
containers.

Structured segments inside `|~~ ~~|` rendered back as:
- prose → bare text
- keyword ref → `:name`
- quote → `` `source` ``
- assertion → `` `snippet` → `expected` ``

Example — keyword inside a `:throws` Vec rendered with docs:
```qlang
:throws [|~~ Subject not Vec, Set, or Map. ~~|
         :CountSubjectNotContainer]
```

Example — nested docs on `:category` and `:subject` keywords:
```qlang
{:qlang/kind :builtin
 :qlang/impl :qlang/prim/count
 :category |~~ Reduce any container to a scalar. ~~|
           :container-reducer
 :subject [|~~ Ordered indexed sequence. ~~| :vec
           |~~ Unordered unique collection. ~~| :set
           |~~ Associative container. ~~| :map]
 :throws [|~~ Subject not Vec, Set, or Map. ~~|
          :CountSubjectNotContainer]}
```

**4b. Function values → keyword**

When rendering a Map entry whose key is `qlang/impl` and whose
value is a function, render `:qlang/prim/<fn.name>` instead of
`<function:name arity=N>`. Context-sensitive: only the
`:qlang/impl` entry on builtin descriptors triggers this.
Computational model unchanged — function stays on the descriptor
at runtime, printValue renders the keyword form.

Before:
```
:qlang/impl <function:count arity=1>
```

After:
```
:qlang/impl :qlang/prim/count
```

**4c. Conduit values**

Standalone (pipeValue): `let(:name, body-source)` with
doc-comment prefix. Already implemented.

Inside a Map value position: zero-arity renders as
`` `body-source` `` (name comes from the Map key, no
duplication). Parametric renders as
`` `let(:name, [:params], body-source)` `` (name duplicated —
no anonymous conduit literal exists). Requires Quote (§1).

**4d. Snapshot values**

Standalone: bare value (projection auto-unwraps). Already
implemented.

Inside a Map: render the wrapped value directly (snapshot is
transparent in pipeline, its wrapper is reachable only via
`reify`).

**4e. AST-Maps → Quote rendering**

Any Map carrying `:qlang/kind` (AST node discriminator) +
`:text` renders as `` `text` `` instead of the full Map tree.
Applies to:
- `:fault/step` in error descriptors
- `:trail` entries
- `parse` operand output

Error descriptor before:
```
:fault {:step {:qlang/kind :OperandCall :name "add" :args [{
    :qlang/kind :NumberLit :value 1 :text "1" :location {
      :start {:offset 14 :line 1 :column 15}
      :end {:offset 15 :line 1 :column 16}}}]
    :effectful false :text "add(1)" :location {
      :start {:offset 10 :line 1 :column 11}
      :end {:offset 16 :line 1 :column 17}}}
  :input "hello"}
```

After:
```
:fault {:step `add(1)` :input "hello"}
```

---

### 5. Module AST storage

Module-load sites already parse source into AST. Currently
discarded after eval. Not discarding. One reference per module.
Parse already paid — storage is free.

**`langRuntime()`** in `runtime/index.mjs`:
```js
const coreAst = parse(CORE_SOURCE, { uri: 'qlang/core' });
// ... eval ...
templateEnv.set('qlang/ast/qlang/core', coreAst);
```

**`resolveNamespaceEnv()`** in `intro.mjs`:
```js
const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
// ... eval ...
envWithNamespace.set('qlang/ast/' + nsKeyword.name, moduleAst);
```

**`session.evalCell()`** in `session.mjs`:
Already stores AST in `cellHistory[].ast`. No change needed.

**Used by**: `reify` for source fragment lookup — walk stored
AST, find node by binding name, read `.text` (includes
doc-comment context). Lazy cross-module index built on first
`reify` call, cached as module-level state.

**Lifecycle**: session owns env, env carries AST references.
Module loaded → AST in env. Session dies → env GC'd → ASTs
GC'd.

---

### 6. `reify` output contract — all types

`reify(:name)` returns a **single-entry Map** `{:name value}`.
Keywords with vocabulary docs render `|~~ ~~|` prefix via
printValue. All output is valid parseable qlang.

**Builtin**:
```qlang
{
|~~ Returns the number of elements.

    `[1 2 3] | count` → `3`
    `#{:a :b} | count` → `2` ~~|
:count {:qlang/kind :builtin
        :qlang/impl :qlang/prim/count
        :category |~~ Reduce any container to a scalar. ~~|
                  :container-reducer
        :subject [|~~ Ordered indexed sequence. ~~| :vec
                  |~~ Unordered unique collection. ~~| :set
                  |~~ Associative container. ~~| :map]
        :throws [|~~ Subject not Vec, Set, or Map. ~~|
                 :CountSubjectNotContainer]}}
```

**Vocabulary keyword (standalone)**:
```qlang
{|~~ Subject not Vec, Set, or Map. ~~|
 :CountSubjectNotContainer |~~ Subject not Vec, Set, or Map. ~~|
                           :CountSubjectNotContainer}
```

**Zero-arity conduit**:
```qlang
{|~~ Doubles a number. ~~|
 :double `mul(2)`}
```

**Parametric conduit**:
```qlang
{|~~ Wraps between prefix and suffix. ~~|
 :@surround `let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))`}
```

**Snapshot (with docs)**:
```qlang
{|~~ Raw exam scores before filtering. ~~|
 :scores [85 92 47 78 68 95 52]}
```

**Snapshot (scalar, no docs)**:
```qlang
{:answer 42}
```

**Plain value (Map via use)**:
```qlang
{:config {:host "localhost" :port 5432}}
```

**Error value**:
```qlang
{:lastError !{:kind :type-error
              :thrown |~~ add expects Number at position 1. ~~|
                     :AddLeftNotNumber
              :fault {:step `add(1)` :input "hello"}
              :trail []}}
```

**Host function with descriptor (jdt)**:
```qlang
{
|~~ Single :type detail by fully qualified name.
    Inner classes use dotted form: pkg.Outer.Inner. ~~|
:@type {:qlang/kind :builtin
        :qlang/impl null
        :category :jdt/graph
        :subject [:map :string]
        :throws [|~~ FQN not resolved. ~~|
                 :TypeNotFound]}}
```

**Host function without descriptor (CLI)**:
```qlang
{:@in {:qlang/kind :host-function
       :name "@in"}}
```

---

### 7. `:examples` → inline assertions in doc-comments

Content rewrite of `core.qlang`. External modules (`graph.qlang`,
`coverage.qlang` in the `eclipse-jdt-search` repo) rewrite
separately.

Before:

```qlang
|~~ Returns the number of elements. ~~|
:count {:qlang/kind :builtin
        :qlang/impl :qlang/prim/count
        :examples [
          {:doc "Vec length"  :snippet "[1 2 3] | count"  :expected "3"}
          {:doc "Set size"    :snippet "#{:a :b} | count"  :expected "2"}]
        ...}
```

After:

```qlang
|~~ Returns the number of elements. Polymorphic over
    :vec (length), :set (size), and :map (entry count).

    `[1 2 3] | count` → `3`
    `#{:a :b} | count` → `2`
    `{:x 1 :y 2 :z 3} | count` → `3` ~~|
:count {:qlang/kind :builtin
        :qlang/impl :qlang/prim/count
        :category |~~ Reduce any container to a scalar. ~~|
                  :container-reducer
        :subject [|~~ Ordered indexed sequence. ~~| :vec
                  |~~ Unordered unique collection. ~~| :set
                  |~~ Associative container. ~~| :map]
        :throws [|~~ Subject not Vec, Set, or Map. ~~|
                 :CountSubjectNotContainer]}
```

Descriptor Map is clean: only machine-readable structure. All
prose, examples, and keyword references live in doc-comments
attached to keywords. `:examples`, `:docs`, `:returns`,
`:modifiers` fields removed from descriptors.

---

## Implementation order

| Phase | Change | Scope |
|---|---|---|
| **0** | printValue fixes (§4b, §4d, §4e) — function as keyword, snapshot bare, AST-Map as Quote | `format.mjs` only |
| **1** | Quote type (§1) — grammar, types, eval, printValue, codec, equality, walk, highlight, isQuote | `grammar.peggy`, `types.mjs`, `eval.mjs`, `format.mjs`, `codec.mjs`, `equality.mjs`, `walk.mjs`, `highlight.mjs`, `predicates.mjs`, `core.qlang` |
| **2** | Doc-on-keyword (§2) — grammar `DocKeyword`, eval vocabulary registration, delete `foldEntryDocs` + `MapEntryDocPrefix` | `grammar.peggy`, `eval.mjs` |
| **3** | Rich doc-comment content (§3) — grammar structured segments, printValue keyword docs rendering (§4a) | `grammar.peggy`, `format.mjs` |
| **4** | printValue for conduit-in-Map (§4c) — uses Quote | `format.mjs` |
| **5** | Module AST storage (§5) — store parsed ASTs in env at module-load time | `runtime/index.mjs`, `intro.mjs` |
| **6** | `reify` output contract (§6) + `runExamples` rewrite — single-entry Map, vocabulary registry, source fragment lookup (atomic commit) | `intro.mjs`, `core.qlang` |
| **7** | Content rewrite (§7) — `:examples` removed, inline assertions, vocabulary keywords documented, `:returns`/`:modifiers`/`:docs` removed from descriptors | `core.qlang` |

Phases 0–1 independent. 2 depends on 1 (Quotes inside
doc-comments). 3 depends on 2. 4 depends on 1. 5 independent.
6 depends on 2+3+5. 7 depends on 6.

---

## Decisions

- **Backtick nesting**: N backticks open, N backticks close.
  Two levels sufficient.
- **Quote in tagged-JSON codec**: `{ "$quote": "source" }` —
  source string sufficient for reconstruction (parse on decode).
- **`:examples`**: removed. `runExamples` reads assertion
  segments from vocabulary registry docs.
- **`MapEntryDocPrefix`**: removed from grammar. Replaced by
  `DocKeyword`.
- **`foldEntryDocs`**: removed from `eval.mjs`.
- **Doc-on-keyword**: grammar `DocKeyword` rule. Doc-comments
  attach to keywords in any position. Eval registers in
  vocabulary registry `env["qlang/vocabulary"]`.
- **Vocabulary docs**: mechanism TBD — see "To think through"
  section at the end.
- **AST-Map rendering**: any Map with `:qlang/kind` + `:text`
  renders as `` `text` ``.
- **Snapshot in Map**: bare wrapped value.
- **Parametric conduit in Map**: `` `let(:name, [:params], body)` ``
  with name duplication.
- **Module AST storage**: `env["qlang/ast/<uri>"]` per loaded
  module. AST already parsed — storing is one reference.
- **Namespace persistence**: `use(:ns)` stores namespace Map +
  AST in env. Qualified access via `env | /:namespace | /keyword`.
- **Guide documents**: separate RFC after Quote + vocabulary.

---

## To think through

### Reflective render operand instead of pure printValue

`printValue` is pure `(value, indent) → string`. Cannot access
env, module ASTs, vocabulary docs. Every approach to put docs
on keyword values or in singleton registries was rejected for
valid reasons (interning removed in PR #8, `:docs` field
pollution, singleton global state).

**Idea**: `printValue` stays pure for `json`, `table`, codec.
A new reflective operand (`render`? `print`? `show`?) is a
`stateOp` with full `(state, lambdas)` access. Reads
`state.env` → module ASTs (§5) → walks AST to find
doc-comments for keywords, conduits, entries. Produces
enriched output string with `|~~ ~~|`, Quotes, everything.

REPL implicitly pipes every query result through this operand.
Like an implicit `| render` at the end. User never types it.

This separates concerns:
- Pure `printValue` → machine rendering (codec, json, table)
- Reflective render operand → human/model rendering (REPL,
  CLI output, `@sourceCard`-like cards)

Docs live in module ASTs stored in env. Zero fields on values.
Zero singleton registries. The render operand has env access
and walks ASTs on demand. Overhead only at render time.

Questions to resolve:
- Does this operand return a String (like `table`)? Or a
  richer value?
- How does the REPL know to use it? Implicit pipe? Config?
- For `reify(:count)` — does reify itself return enriched
  output, or does the render operand enrich reify's raw
  output at display time?
- Does `DocKeyword` eval still need to do ANYTHING beyond
  creating a bare keyword? If all docs come from module ASTs
  at render time — eval ignores doc-comments entirely (zero
  overhead). `foldEntryDocs` deleted. `DocKeyword` reduces
  to bare `Keyword` at eval. Docs survive only in stored AST.
- How does this interact with `inter(#{:filter :count})` —
  the render operand sees the result Map, knows the keys
  "filter" and "count", looks up their doc-comments in module
  ASTs, renders `|~~ ~~|` prefixes?

### CORE_SOURCE codegen

`build-core.mjs` embeds `lib/qlang/core.qlang` as a string
constant in `gen/core.mjs` via `JSON.stringify`. The codegen
exists because `core/src/` has a browser-ready invariant (zero
`node:*` imports) and there's no cross-platform way to import
raw text files in ES modules without `node:fs` or a bundler.

`import.meta.resolve` gives the file URL but not the content.
`fetch` with `file://` URLs doesn't work in Node. Import
attributes (`with { type: 'text' }`) not yet standardized.

Options discussed:
- `langRuntime(coreSource)` — caller provides source. CLI
  reads file, site fetches. `core/src/` stays browser-ready.
  Breaking API change.
- Keep codegen — pragmatic, same pattern as grammar build.
- Find a cross-platform text import mechanism.

### Namespace qualified access

`use(:ns)` merges flat into env + stores namespace Map under
`env["ns"]`. After merge, no provenance — `reify(:keyword)`
doesn't know which module the keyword came from.

Qualified access via projection works: `env | /:jdt/graph | /TypeNotFound`. But identifier-level qualified access
(`jdt/graph/TypeNotFound` as a binding name) not supported
by grammar.

Collision on `use([:a :b])` — last wins, silent. No
disambiguation beyond `use(#{:a :b})` (error on collision)
and manual projection.

### evalKeyword and env modification

`DocKeyword` eval: if docs are recorded in vocabulary registry
(in env), `evalKeyword` must return updated env (not just
updated pipeValue). This changes `evalKeyword` from a pure
value step to an env-modifying step. Same pattern as `let`/`as`
but implicit — the keyword literal silently modifies env.

If reflective render operand reads docs from stored ASTs
instead — `evalKeyword` stays pure. Docs never enter env.
They live in ASTs and are accessed at render time.

### printValue for documented keywords — per-instance vs global

Per-instance: `.docs` on the keyword value created from
`DocKeyword`. Only THAT instance renders `|~~ ~~|`. Other
bare `:vec` instances render bare. Problem: `reify(:vec)`
receives a bare keyword, can't find docs.

Global: vocabulary registry or singleton. ALL `:vec` render
with docs. Problem: noisy output — every `:subject [:vec]`
gets `|~~ ~~|` on every operand.

Reflective render operand might resolve this: render operand
decides WHEN to render docs based on context (reify output →
yes; nested `:subject` Vec → maybe not; standalone keyword →
yes). Context-sensitive rendering with env access.
