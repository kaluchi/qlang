// LSP feature implementations — pure functions over qlang's public
// API. No vscode-languageserver imports, no node: imports. The
// server.mjs wiring layer translates between LSP protocol types
// and these returns.
//
// Each function takes a parsed state and returns plain objects that
// server.mjs maps to LSP responses. This split keeps the logic
// testable without LSP transport.

import {
  parse, ParseError,
  langRuntime, evalQuery,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  VALUE_NAMESPACE,
  TAG_NAMESPACE,
  FORK_ISOLATING_AST_TYPES,
  walkAst,
  isModuleAstKey,
  isModuleNamespaceKey,
  isTagBindingName,
  RUNTIME_LOCATOR_KEY,
  tagBindingKey,
  tokenize
} from '@kaluchi/qlang-core';

// Interned keyword references for descriptor-Map field projection.
const F_CATEGORY  = 'category';
const F_SUBJECT   = 'subject';
const F_MODIFIERS = 'modifiers';

// Cached docs lookup — `:name | docs` (or `::Tag | docs`) axis-call
// returns a Vec of Doc-values. LSP wants the raw content strings;
// pull them once on first request and reuse the array on subsequent
// hovers / completions for the same binding. Cache key is the full
// binding name including the `::` prefix for tag-namespace lookups
// so value/tag-namespace entries do not collide.
const docsCache = new Map();
async function fetchDocsContents(name) {
  if (docsCache.has(name)) return docsCache.get(name);
  const query = isTagBindingName(name)
    ? `${name} | docs`
    : `:"${name}" | docs`;
  let docs;
  try {
    docs = await evalQuery(query);
  } catch {
    docs = [];
  }
  const contents = Array.isArray(docs) ? docs.map(d => d.content) : [];
  docsCache.set(name, contents);
  return contents;
}

// ── Document state ────────────────────────────────────────────

export function parseDocument(source, uri) {
  const diagnostics = [];
  let ast = null;
  try {
    ast = parse(source, { uri });
  } catch (e) {
    if (e instanceof ParseError && e.location) {
      diagnostics.push({
        startLine: e.location.start.line - 1,
        startChar: e.location.start.column - 1,
        endLine: e.location.end ? e.location.end.line - 1 : e.location.start.line - 1,
        endChar: e.location.end ? e.location.end.column - 1 : e.location.start.column,
        message: e.message,
        severity: 'error'
      });
    } else {
      diagnostics.push({
        startLine: 0, startChar: 0,
        endLine: 0, endChar: 0,
        message: e.message ?? String(e),
        severity: 'error'
      });
    }
  }
  return { ast, diagnostics };
}

// ── Catalog context ───────────────────────────────────────────
//
// Parsed lib/qlang/core.qlang AST + its file URI, provided by
// the server at startup. Used as fallback for go-to-definition
// on builtin operands that have no in-document declaration.
//
// core.qlang is a series of `BindStep` declarations — one per
// builtin operand or tag-binding — so the index walks for
// `BindStep` nodes and records the entire BindStep span as the
// jump-target (the keyword key plus attached docs plus descriptor
// body). Both value-namespace keys (`:count {…}`) and tag-
// namespace keys (`::AddLeftNotNumberError {…}`) land in the index
// under the canonical name a `definitionAtOffset` lookup builds.

export function buildCatalogIndex(catalogAst) {
  const index = new Map();
  if (!catalogAst) return index;
  walkAst(catalogAst, (node) => {
    if (node.type !== 'BindStep') return;
    let name;
    if (node.key.type === 'Keyword') name = node.key.name;
    else if (node.key.type === 'BareTypeKeyword') name = tagBindingKey(node.key.tag);
    else return;
    index.set(name, {
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return index;
}

// ── Completion ────────────────────────────────────────────────
//
// Two catalogs cached at startup: value-namespace builtins
// (`count`, `filter`, `parse`, ...) and tag-namespace bindings
// (`::AddLeftNotNumberError`, `::conduit`, ...). Walked from
// `langRuntime` directly because the namespace partitioning runs
// off `isTagBindingName` on the env key; the catalog index built
// in `buildCatalogIndex` covers the same surface and carries the
// source-range info goto-definition needs.

let _valueCompletions = null;
let _tagCompletions = null;

async function valueNamespaceCompletions() {
  if (_valueCompletions) return _valueCompletions;
  const runtime = await langRuntime();
  _valueCompletions = [];
  for (const [k, descriptor] of runtime) {
    if (isModuleAstKey(k)) continue;
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    if (isTagBindingName(k)) continue;
    if (!(descriptor instanceof Map)) continue;
    const docContents = await fetchDocsContents(k);
    _valueCompletions.push({
      label: k,
      kind: 'function',
      detail: formatMetaValue(descriptor.get(F_CATEGORY)),
      documentation: docContents[0] ?? ''
    });
  }
  return _valueCompletions;
}

async function tagNamespaceCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const runtime = await langRuntime();
  _tagCompletions = [];
  for (const [k] of runtime) {
    if (!isTagBindingName(k)) continue;
    const docContents = await fetchDocsContents(k);
    _tagCompletions.push({
      label: k,
      kind: 'tag',
      detail: 'tag-binding',
      documentation: docContents[0] ?? ''
    });
  }
  return _tagCompletions;
}

// `source.substring(offset - 2, offset)` tells the completion path
// whether the cursor sits right after a `::` prefix — that picks
// the tag-namespace catalog alone. Without a source slice the
// default merges both catalogs so hover-style discovery works
// inside `filter(::` / `eq(::` / first-token contexts.
function justTypedDoubleColon(source, offset) {
  if (typeof source !== 'string' || offset < 2) return false;
  return source[offset - 2] === ':' && source[offset - 1] === ':';
}

export async function completionsAtOffset(ast, offset, source = null) {
  const tagOnly = justTypedDoubleColon(source, offset);

  let items;
  if (tagOnly) {
    items = [...(await tagNamespaceCompletions())];
    if (ast) {
      for (const tagName of bindingNamesVisibleAt(ast, offset, TAG_NAMESPACE)) {
        if (!items.some(i => i.label === tagName)) {
          items.push({
            label: tagName,
            kind: 'tag',
            detail: 'in-document tag-binding',
            documentation: null
          });
        }
      }
    }
    return items;
  }

  items = [...(await valueNamespaceCompletions()), ...(await tagNamespaceCompletions())];
  if (ast) {
    for (const name of bindingNamesVisibleAt(ast, offset, VALUE_NAMESPACE)) {
      if (!items.some(i => i.label === name)) {
        items.push({
          label: name,
          kind: 'variable',
          detail: 'BindStep / as binding',
          documentation: null
        });
      }
    }
    for (const tagName of bindingNamesVisibleAt(ast, offset, TAG_NAMESPACE)) {
      if (!items.some(i => i.label === tagName)) {
        items.push({
          label: tagName,
          kind: 'tag',
          detail: 'in-document tag-binding',
          documentation: null
        });
      }
    }
  }

  return items;
}

// ── Hover ─────────────────────────────────────────────────────

export async function hoverAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  if (node.type === 'OperandCall') {
    return await hoverForOperand(node);
  }
  if (node.type === 'BareTypeKeyword' || node.type === 'TaggedLit') {
    return await hoverForTag(node);
  }
  if (node.type === 'Projection') {
    return hoverForProjection(node);
  }
  if (node.type === 'Keyword') {
    return {
      content: `keyword \`:${node.name}\``,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  }
  return null;
}

async function hoverForOperand(node) {
  const runtime = await langRuntime();
  if (!runtime.has(node.name)) return null;

  const descriptor = runtime.get(node.name);
  const docContents = await fetchDocsContents(node.name);

  return {
    content: [
      `**${node.name}** — ${formatMetaValue(descriptor.get(F_CATEGORY))}`,
      `Subject: ${formatMetaValue(descriptor.get(F_SUBJECT))}`,
      '',
      docContents.join('\n')
    ].join('\n'),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

// Tag-namespace hover — `::Tag` reference (BareTypeKeyword) or
// `::Tag<payload>` constructor invocation (TaggedLit). Both resolve
// the same way: lookup `::Tag` in env, pull `:docs` via the docs
// axis-operand, render a markdown popup with the tag's identity
// banner plus the joined doc content.
//
// `::Tag` head span (the two `::` chars + the tag identifier) is
// what reads as the hover range — for a TaggedLit the payload
// sits outside the popup region so the editor highlights the tag
// head alone.
async function hoverForTag(node) {
  const tagKey = tagBindingKey(node.tag);
  const runtime = await langRuntime();
  if (!runtime.has(tagKey)) return null;

  const docContents = await fetchDocsContents(tagKey);
  const headStart = node.location.start.offset;
  const headEnd = headStart + 2 + node.tag.length;

  return {
    content: [
      `**${tagKey}** — tag-binding`,
      '',
      docContents.join('\n')
    ].join('\n'),
    startOffset: headStart,
    endOffset: headEnd
  };
}

function hoverForProjection(node) {
  const pathStr = '/' + node.keys.join('/');
  return {
    content: `projection \`${pathStr}\` — extracts value from Map`,
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

function formatMetaValue(value) {
  if (value === null || value === undefined) return 'any';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.type === 'keyword') return value.name;
  if (Array.isArray(value)) {
    return value.map(formatMetaValue).join(' | ');
  }
  return String(value);
}

// ── Go to Definition ──────────────────────────────────────────
//
// Three-tier resolution:
//   1. In-document BindStep / `as(:name)` declaration visible at
//      the cursor — last-write-wins with fork isolation
//      (shadowing-aware)
//   2. Catalog declaration for builtins, walked across every
//      `core/lib/qlang/**/*.qlang` module
//   3. null (identifier has no reachable declaration)

export function definitionAtOffset(ast, offset, catalogCtx) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  // Resolve the click position to a binding name. Three click-shapes
  // navigate to a declaration:
  //   * `OperandCall` — its own `.name` (read site, e.g. `count`).
  //   * `BareTypeKeyword` — `::` + `.tag` (type identifier reference).
  //   * `TaggedLit` — `::` + `.tag` (type constructor invocation).
  let name;
  if (node.type === 'OperandCall')        name = node.name;
  else if (node.type === 'BareTypeKeyword') name = tagBindingKey(node.tag);
  else if (node.type === 'TaggedLit')       name = tagBindingKey(node.tag);
  else return null;

  // Tier 1: last visible in-document declaration — only offsets;
  // the caller maps them through the current document's
  // positionAt for line/column resolution.
  const localDecl = findLastVisibleDeclaration(ast, name, offset);
  if (localDecl) return localDecl;

  // Tier 2: catalog fallback. The index entry carries
  // `{ startOffset, endOffset, fileUri, source }` so the caller
  // can resolve offsets in the originating catalog file.
  if (catalogCtx?.index?.has(name)) {
    return catalogCtx.index.get(name);
  }

  return null;
}

// bindingDeclarationOf(node) → { name, kind } | null
//
// Single recogniser for every AST shape that introduces a binding
// in env: `BindStep` with a Keyword key (`:name body`), `BindStep`
// with a BareTypeKeyword key (`::Tag body` — tag-binding), or an
// `as(:name)` OperandCall. The user-facing symbol kind tracks what
// the binding will hold once `evalBindStep` runs:
//   * `tag`      — BareTypeKeyword head (descriptor under `::Tag`)
//   * `snapshot` — Keyword head with a pure-literal body or a
//                  doc-only declaration (no body), or any `as(:name)`
//   * `conduit`  — Keyword head with an impure / parametric body
function bindingDeclarationOf(node) {
  if (node.type === 'BindStep') {
    if (node.key.type === 'BareTypeKeyword') {
      return { name: tagBindingKey(node.key.tag), kind: 'tag' };
    }
    if (node.key.type === 'Keyword') {
      const kind = bindingKindForKeywordHead(node);
      return { name: node.key.name, kind };
    }
    return null;
  }
  if (node.type === 'OperandCall' && node.name === 'as'
      && Array.isArray(node.args) && node.args.length > 0
      && node.args[0].type === 'Keyword') {
    return { name: node.args[0].name, kind: 'snapshot' };
  }
  return null;
}

function bindingKindForKeywordHead(bindStepNode) {
  if (bindStepNode.body === null) return 'snapshot';
  if (bindStepNode.params !== null) return 'conduit';
  return isPureLiteralBody(bindStepNode.body) ? 'snapshot' : 'conduit';
}

// Mirror of `core/src/walk.mjs::isPureLiteralAst` — kept local to
// the LSP layer to avoid pulling a non-public traversal helper into
// the public surface. Diverging from the core predicate would mis-
// label outline entries, so any AST node-type the core treats as
// pure also lives here.
const PURE_LITERAL_LEAF_TYPES = new Set([
  'NumberLit', 'StringLit', 'BooleanLit', 'NullLit',
  'Keyword', 'QuoteLit', 'DocLit', 'BareTypeKeyword'
]);
function isPureLiteralBody(node) {
  if (PURE_LITERAL_LEAF_TYPES.has(node.type)) return true;
  if (node.type === 'VecLit' || node.type === 'JsonArrayLit' || node.type === 'SetLit') {
    return node.elements.every(isPureLiteralBody);
  }
  if (node.type === 'MapLit' || node.type === 'JsonObjectLit' || node.type === 'ErrorLit') {
    return node.entries.every(e => isPureLiteralBody(e.value));
  }
  if (node.type === 'TaggedLit') return isPureLiteralBody(node.payload);
  return false;
}

// findLastVisibleDeclaration(ast, name, offset) — walks the AST
// collecting BindStep / `as(:name)` declarations for `name` that
// are lexically visible at `offset` (before the cursor, in a
// fork-reachable ancestor). Returns the LAST one (closest to
// cursor = most recent shadowing), or null if no in-document
// declaration is visible.
function findLastVisibleDeclaration(ast, name, offset) {
  let lastVisible = null;

  walkAst(ast, (node) => {
    const decl = bindingDeclarationOf(node);
    if (decl === null || decl.name !== name) return;
    if (!node.location || node.location.end.offset > offset) return;

    // Fork-isolation check: walk ancestors from the declaration
    // up to the root. If any fork-isolating ancestor does NOT
    // contain the cursor offset, the declaration is invisible.
    if (!isVisibleAcrossForks(node, offset)) return;

    // This declaration is visible — keep it (last-write-wins).
    lastVisible = {
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  });

  return lastVisible;
}

function isVisibleAcrossForks(declNode, cursorOffset) {
  let current = declNode;
  let parent = current.parent;
  while (parent) {
    if (FORK_ISOLATING_AST_TYPES.has(parent.type)) {
      if (!current.location
          || current.location.start.offset > cursorOffset
          || current.location.end.offset < cursorOffset) {
        return false;
      }
    }
    current = parent;
    parent = current.parent;
  }
  return true;
}

// ── Find References ───────────────────────────────────────────

export function referencesAtOffset(ast, offset) {
  if (!ast) return [];

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return [];

  // Five click-positions resolve to a binding name:
  //   1. OperandCall named `as` whose first arg is a Keyword
  //      (`as(:foo)` → 'foo').
  //   2. Plain OperandCall (`count`) — its own name is the lookup
  //      target.
  //   3. BindStep wrapper (cursor between key and body) — the
  //      declared name from `node.key`.
  //   4. Keyword node whose parent is a BindStep key or an
  //      `as(:name)` first arg — the name of the keyword.
  //   5. BareTypeKeyword either standalone or as a BindStep key —
  //      the tag-namespace identifier `::tag`.
  let name = null;
  if (node.type === 'OperandCall') {
    if (node.name === 'as'
        && Array.isArray(node.args) && node.args.length > 0
        && node.args[0].type === 'Keyword') {
      name = node.args[0].name;
    } else {
      name = node.name;
    }
  } else if (node.type === 'BindStep') {
    if (node.key.type === 'Keyword') name = node.key.name;
    else if (node.key.type === 'BareTypeKeyword') name = tagBindingKey(node.key.tag);
  } else if (node.type === 'Keyword' && node.parent) {
    const parent = node.parent;
    if (parent.type === 'BindStep' && parent.key === node) {
      name = node.name;
    } else if (parent.type === 'OperandCall' && parent.name === 'as'
               && Array.isArray(parent.args) && parent.args[0] === node) {
      name = node.name;
    }
  } else if (node.type === 'BareTypeKeyword') {
    name = tagBindingKey(node.tag);
  }

  if (!name) return [];

  const occurrences = findIdentifierOccurrences(ast, name);
  return occurrences
    .filter(occ => occ.location)
    .map(occ => ({
      startOffset: occ.location.start.offset,
      endOffset: occ.location.end.offset
    }));
}

// ── Document Symbols ──────────────────────────────────────────

export function documentSymbols(ast) {
  if (!ast) return [];

  const symbols = [];
  walkAst(ast, (node) => {
    const decl = bindingDeclarationOf(node);
    if (decl === null || !node.location) return;

    symbols.push({
      name: decl.name,
      kind: decl.kind,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return symbols;
}

// ── Signature Help ────────────────────────────────────────────

export async function signatureHelpAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  const operandCall = findEnclosingOperandCall(node);
  if (!operandCall) return null;

  const runtime = await langRuntime();
  if (!runtime.has(operandCall.name)) return null;

  const descriptor = runtime.get(operandCall.name);
  const modifiers = descriptor.get(F_MODIFIERS).map(formatMetaValue);
  const docContents = await fetchDocsContents(operandCall.name);

  const argsStartOffset = operandCall.location.start.offset
    + operandCall.name.length + 1;
  const textBeforeCursor = source.substring(argsStartOffset, offset);
  const activeParameter = (textBeforeCursor.match(/,/g) || []).length;

  return {
    label: modifiers.length > 0
      ? `${operandCall.name}(${modifiers.join(', ')})`
      : `${operandCall.name}()`,
    documentation: docContents[0] ?? '',
    parameters: modifiers.map(mod => ({ label: mod })),
    activeParameter
  };
}

function findEnclosingOperandCall(node) {
  let current = node;
  while (current) {
    if (current.type === 'OperandCall' && current.args !== null) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// ── Semantic tokens ───────────────────────────────────────────
//
// Bridges the AST-driven `tokenize` from core into LSP's
// semantic-tokens encoding. Each qlang highlight kind maps to an
// LSP standard semantic-token type chosen for visual differentiation
// under default editor themes:
//
//   operand  → function   (built-in operand name)
//   atom     → variable   (user-bound identifier reference)
//   effect   → decorator  (`@`-prefixed effectful operand)
//   keyword  → keyword    (`as`, BindStep key)
//   tag      → struct     (`::Tag` head, matching CompletionItemKind)
//   string   → string     (String literal)
//   quote    → string     (Quote literal — source-as-data)
//   number   → number     (Number / Boolean / Null literal)
//   comment  → comment    (line / block / doc comment)
//   err      → keyword    (`!{` / `!|` fail-track sigil)
//
// Bracket / punctuation kinds (`vec`, `set`, `punct`, `whitespace`)
// have no LSP semantic-token type; the tmLanguage grammar paints
// them as a fallback.
//
// Builtin names come from `langRuntime()` and are cached per server
// process; they drive the operand-vs-atom classification inside
// `tokenize`.

export const SEMANTIC_TOKEN_TYPES = [
  'function',
  'variable',
  'decorator',
  'keyword',
  'struct',
  'string',
  'number',
  'comment'
];

const KIND_TO_TYPE_INDEX = {
  operand: 0,
  atom:    1,
  effect:  2,
  keyword: 3,
  tag:     4,
  string:  5,
  quote:   5,
  number:  6,
  comment: 7,
  err:     3
};

let _builtinNamesCache = null;
async function builtinNamesForTokenize() {
  if (_builtinNamesCache) return _builtinNamesCache;
  const runtime = await langRuntime();
  _builtinNamesCache = new Set();
  for (const k of runtime.keys()) {
    if (isModuleAstKey(k)) continue;
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    if (isTagBindingName(k)) continue;
    _builtinNamesCache.add(k);
  }
  return _builtinNamesCache;
}

// semanticTokensFor(source) → { data: Uint32Array }
//
// Five-int encoding per token (LSP spec): [deltaLine, deltaStart,
// length, tokenType, tokenModifiers]. deltaLine is relative to the
// previous token's line; deltaStart is relative to the previous
// token's start on the same line, or absolute on a new line.
// Multi-line tokens (block comments, multi-line Quote bodies) split
// per line because the LSP encoding has no length-spans-newlines
// representation — each line slice emits its own token entry.
export async function semanticTokensFor(source) {
  const builtinNames = await builtinNamesForTokenize();
  const tokens = tokenize(source, builtinNames);
  const data = [];
  let prevLine = 0;
  let prevChar = 0;
  // Pre-compute per-offset (line, char) — single linear scan
  // outperforms repeated indexOf walks across the line table.
  const offsetToLineChar = buildLineCharIndex(source);
  for (const tok of tokens) {
    const typeIndex = KIND_TO_TYPE_INDEX[tok.kind];
    if (typeIndex === undefined) continue;
    // Split multi-line span into per-line entries.
    let segStart = tok.start;
    while (segStart < tok.end) {
      const { line: segLine, char: segChar } = offsetToLineChar(segStart);
      const segLineEnd = offsetOfLineEnd(source, segStart);
      const segEnd = Math.min(tok.end, segLineEnd);
      const segLen = segEnd - segStart;
      if (segLen > 0) {
        const dLine = segLine - prevLine;
        const dChar = dLine === 0 ? segChar - prevChar : segChar;
        data.push(dLine, dChar, segLen, typeIndex, 0);
        prevLine = segLine;
        prevChar = segChar;
      }
      // Advance past the newline (if any) to the next line's offset 0.
      segStart = segEnd + (segEnd < tok.end ? 1 : 0);
    }
  }
  return { data: Uint32Array.from(data) };
}

function buildLineCharIndex(source) {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  return function offsetToLineChar(offset) {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo, char: offset - lineStarts[lo] };
  };
}

function offsetOfLineEnd(source, fromOffset) {
  const nl = source.indexOf('\n', fromOffset);
  return nl === -1 ? source.length : nl;
}
