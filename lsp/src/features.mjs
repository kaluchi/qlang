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
  langRuntime,
  keyword,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  FORK_ISOLATING_AST_TYPES,
  walkAst
} from '@kaluchi/qlang-core';

// Interned keyword references for descriptor-Map field projection.
// Each `keyword(name)` call returns the same interned object as the
// catalog's `:name` literal, so `descriptor.get(KW_*)` is a native
// Map lookup against the same key identity.
const KW_CATEGORY  = keyword('category');
const KW_SUBJECT   = keyword('subject');
const KW_DOCS      = keyword('docs');
const KW_MODIFIERS = keyword('modifiers');

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
// Under Variant-B every builtin lives as a MapEntry inside
// core.qlang's outer MapLit (`:count {:qlang/kind :builtin ...}`),
// so the index walks for MapEntry nodes whose key is a Keyword.

export function buildCatalogIndex(catalogAst) {
  const index = new Map();
  if (!catalogAst) return index;
  walkAst(catalogAst, (node) => {
    if (node.type !== 'MapEntry') return;
    index.set(node.key.name, {
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return index;
}

// ── Completion ────────────────────────────────────────────────

let _builtinCompletions = null;

async function builtinCompletions() {
  if (_builtinCompletions) return _builtinCompletions;
  const runtime = await langRuntime();
  _builtinCompletions = [];
  for (const [k, descriptor] of runtime) {
    _builtinCompletions.push({
      label: k.name,
      kind: 'function',
      detail: formatMetaValue(descriptor.get(KW_CATEGORY)),
      documentation: descriptor.get(KW_DOCS)[0]
    });
  }
  return _builtinCompletions;
}

export async function completionsAtOffset(ast, offset) {
  const items = [...(await builtinCompletions())];

  if (ast) {
    const userNames = bindingNamesVisibleAt(ast, offset);
    for (const name of userNames) {
      if (!items.some(i => i.label === name)) {
        items.push({
          label: name,
          kind: 'variable',
          detail: 'let/as binding',
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
  const kw = keyword(node.name);
  if (!runtime.has(kw)) return null;

  const descriptor = runtime.get(kw);
  const docs = descriptor.get(KW_DOCS);

  return {
    content: [
      `**${node.name}** — ${formatMetaValue(descriptor.get(KW_CATEGORY))}`,
      `Subject: ${formatMetaValue(descriptor.get(KW_SUBJECT))}`,
      '',
      docs.join('\n')
    ].join('\n'),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
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
//   1. In-document let/as declaration visible at the cursor —
//      last-write-wins with fork isolation (shadowing-aware)
//   2. lib/qlang/core.qlang catalog declaration for builtins
//   3. null (identifier has no reachable declaration)

export function definitionAtOffset(ast, offset, catalogCtx) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node || node.type !== 'OperandCall') return null;

  const name = node.name;

  // Tier 1: last visible in-document declaration
  const localDecl = findLastVisibleDeclaration(ast, name, offset);
  if (localDecl) {
    return { uri: null, ...localDecl };
  }

  // Tier 2: core.qlang catalog fallback for builtins
  if (catalogCtx?.index?.has(name)) {
    return {
      uri: catalogCtx.uri,
      ...catalogCtx.index.get(name)
    };
  }

  return null;
}

// findLastVisibleDeclaration(ast, name, offset) — walks the AST
// collecting let/as declarations for `name` that are lexically
// visible at `offset` (before cursor, not fork-isolated). Returns
// the LAST one (closest to cursor = most recent shadowing), or
// null if no in-document declaration is visible.
function findLastVisibleDeclaration(ast, name, offset) {
  let lastVisible = null;

  walkAst(ast, (node) => {
    if (node.type !== 'OperandCall') return;
    if (node.name !== 'let' && node.name !== 'as') return;
    if (!Array.isArray(node.args) || node.args.length === 0) return;
    const firstArg = node.args[0];
    if (firstArg.type !== 'Keyword' || firstArg.name !== name) return;
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

  let name = null;
  if (node.type === 'OperandCall') {
    if ((node.name === 'let' || node.name === 'as')
        && Array.isArray(node.args) && node.args.length > 0
        && node.args[0].type === 'Keyword') {
      name = node.args[0].name;
    } else {
      name = node.name;
    }
  } else if (node.type === 'Keyword' && node.parent
             && node.parent.type === 'OperandCall'
             && (node.parent.name === 'let' || node.parent.name === 'as')
             && Array.isArray(node.parent.args)
             && node.parent.args[0] === node) {
    name = node.name;
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
    if (node.type !== 'OperandCall') return;
    if (node.name !== 'let' && node.name !== 'as') return;
    if (!Array.isArray(node.args) || node.args.length === 0) return;
    const firstArg = node.args[0];
    if (firstArg.type !== 'Keyword') return;
    if (!node.location) return;

    symbols.push({
      name: firstArg.name,
      kind: node.name === 'let' ? 'conduit' : 'snapshot',
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
  const kw = keyword(operandCall.name);
  if (!runtime.has(kw)) return null;

  const descriptor = runtime.get(kw);
  const modifiers = descriptor.get(KW_MODIFIERS).map(formatMetaValue);
  const docs = descriptor.get(KW_DOCS);

  const argsStartOffset = operandCall.location.start.offset
    + operandCall.name.length + 1;
  const textBeforeCursor = source.substring(argsStartOffset, offset);
  const activeParameter = (textBeforeCursor.match(/,/g) || []).length;

  return {
    label: modifiers.length > 0
      ? `${operandCall.name}(${modifiers.join(', ')})`
      : `${operandCall.name}()`,
    documentation: docs[0],
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
